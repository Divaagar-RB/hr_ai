const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
    extractResume,
    extractFeedback,
} = require("../services/gemmaService");
const pool = require("../db/db");

const router = express.Router();

// ── In-memory Job Store ──────────────────────────────────────────────────
const extractionJobs = new Map();

router.get("/status/:jobId", (req, res) => {
    const job = extractionJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
});

// ── Status Priority ────────────────────────────────────────────────────────
const STATUS_PRIORITY = {
    'Hired': 80,
    'Offered': 70,
    'Selected': 60,
    'Assessment Completed': 50,
    'Under Review': 40,
    'Applied': 30,
    'Interviewing': 20,
    'Hold': 15,
    'Pending': 10,
    'Rejected': 5,
    'Withdrawn': 0
};

// Neutral/initial states that should always be overridden by any definitive result
const NEUTRAL_STATUSES = new Set(['Pending', 'Applied', '', null, undefined]);

function getHighestStatus(a, b) {
    // Neutral states are always overridden by any definitive status
    if (NEUTRAL_STATUSES.has(a)) return b || a;
    if (NEUTRAL_STATUSES.has(b)) return a;
    return (STATUS_PRIORITY[a] || 0) >= (STATUS_PRIORITY[b] || 0) ? a : b;
}

// Map interview-level status to a valid candidate-level status
const INTERVIEW_TO_CANDIDATE = {
    'Completed': 'Interviewing',  // 'Completed' is not in candidates CHECK constraint
};
function toCandidateStatus(s) {
    return INTERVIEW_TO_CANDIDATE[s] || s;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function toNull(v) {
    if (v === undefined || v === null || v === '' || v === 'null') return null;
    if (Array.isArray(v) && v.length === 0) return null;
    return v;
}

function toJsonb(v) {
    if (!v) return null;
    if (Array.isArray(v) && v.length === 0) return null;
    return JSON.stringify(v);
}

function toTextArray(v) {
    if (!v || (Array.isArray(v) && v.length === 0)) return null;
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return null;
}

// ── Uploads dir ────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ── Find existing candidate by email OR phone OR linkedin OR name ──────────
async function findCandidate(email, phone, linkedin, name) {
    const res = await pool.query(
        `SELECT * FROM candidates
         WHERE (email    = $1 AND $1 IS NOT NULL)
            OR (phone    = $2 AND $2 IS NOT NULL)
            OR (linkedin = $3 AND $3 IS NOT NULL)
            OR (LOWER(TRIM(name)) = LOWER(TRIM($4)) AND $4 IS NOT NULL)
         LIMIT 1`,
        [toNull(email), toNull(phone), toNull(linkedin), toNull(name)]
    );
    return res.rows[0] || null;
}

// ── Upsert candidate ───────────────────────────────────────────────────────
async function upsertCandidate(c, resumePath) {
    const name         = toNull(c.name);
    const email        = toNull(c.email);
    const phone        = toNull(c.phone);
    const linkedin     = toNull(c.linkedin);
    const location     = toNull(c.location);
    const skills       = toTextArray(c.skills);
    const education    = toJsonb(c.education);
    const experience   = toJsonb(c.experience);
    const certifications = toTextArray(c.certifications);

    const existing = await findCandidate(email, phone, linkedin, name);

    if (existing) {
        // MERGE — never overwrite valid data with null
        const res = await pool.query(
            `UPDATE candidates SET
                name          = COALESCE($1,  name),
                email         = COALESCE($2,  email),
                phone         = COALESCE($3,  phone),
                linkedin      = COALESCE($4,  linkedin),
                location      = COALESCE($5,  location),
                skills        = COALESCE($6,  skills),
                education     = COALESCE($7::jsonb, education),
                experience    = COALESCE($8::jsonb, experience),
                certifications= COALESCE($9,  certifications),
                resume_path   = COALESCE($10, resume_path)
             WHERE id = $11 RETURNING *`,
            [name, email, phone, linkedin, location, skills,
             education, experience, certifications, resumePath, existing.id]
        );
        return { row: res.rows[0], action: 'UPDATE' };
    } else {
        // INSERT
        const res = await pool.query(
            `INSERT INTO candidates
                (name, email, phone, linkedin, location, skills,
                 education, experience, certifications, resume_path)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
             RETURNING *`,
            [name, email, phone, linkedin, location, skills,
             education, experience, certifications, resumePath]
        );
        return { row: res.rows[0], action: 'INSERT' };
    }
}

// ── Save interview rounds ─────────────────────────────────────────────────
async function saveRounds(candidateId, rounds, existingStatus) {
    let finalStatus = existingStatus || 'Pending';

    // Progression inference + compute candidate-safe finalStatus
    for (let i = 0; i < rounds.length; i++) {
        if (!rounds[i].status && rounds[i + 1]) {
            rounds[i].status = 'Selected';
        }
        if (rounds[i].status) {
            // Map interview-only statuses (e.g. 'Completed') to valid candidate statuses
            const candidateStatus = toCandidateStatus(rounds[i].status);
            finalStatus = getHighestStatus(finalStatus, candidateStatus);
        }
    }

    const saved = [];
    for (const round of rounds) {
        const res = await pool.query(
            `INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (candidate_id, round_number) DO UPDATE SET
                feedback    = COALESCE(EXCLUDED.feedback,    interviews.feedback),
                interviewer = COALESCE(EXCLUDED.interviewer, interviews.interviewer),
                status      = COALESCE(EXCLUDED.status,      interviews.status),
                created_at  = NOW()
             RETURNING *`,
            [
                candidateId,
                round.round_number || 1,
                JSON.stringify(round.feedback || round.notes || null),
                toNull(round.interviewer),
                toNull(round.status)
            ]
        );
        saved.push(res.rows[0]);
    }

    if (finalStatus) {
        await pool.query(
            'UPDATE candidates SET status = $1 WHERE id = $2',
            [finalStatus, candidateId]
        );
    }

    return { saved, finalStatus };
}

// ── Parse AI response (handles both old flat and new enterprise JSON) ──────
function parseAIResponse(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error("AI returned invalid JSON: " + e.message);
    }

    // New enterprise format: { candidate: {...}, interview_rounds: [...], final_status, action }
    if (parsed.candidate) {
        return {
            candidate: parsed.candidate,
            interview_rounds: parsed.interview_rounds || [],
            final_status: parsed.final_status || null,
            action: parsed.action || 'INSERT'
        };
    }

    // Legacy flat resume format: { name, email, phone, skills, ... }
    return {
        candidate: parsed,
        interview_rounds: [],
        final_status: null,
        action: 'INSERT'
    };
}

// ════════════════════════════════════════════════════════════════════════════
// POST /upload/resume  — single resume
// ════════════════════════════════════════════════════════════════════════════
router.post("/resume", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const jobId = Date.now().toString();
        extractionJobs.set(jobId, { status: "processing", progress: 0 });

        // Run extraction in background
        (async () => {
            try {
                const raw = await extractResume(req.file.path);
                const { candidate, interview_rounds, final_status } = parseAIResponse(raw);
                const { row, action } = await upsertCandidate(candidate, req.file.path);

                let interviews = [];
                if (interview_rounds.length > 0) {
                    const { saved } = await saveRounds(row.id, interview_rounds, row.status);
                    interviews = saved;
                }

                if (final_status) {
                    const best = getHighestStatus(row.status || 'Pending', final_status);
                    await pool.query('UPDATE candidates SET status = $1 WHERE id = $2', [best, row.id]);
                }

                extractionJobs.set(jobId, { 
                    status: "completed", 
                    data: { message: "Resume extracted and saved", action, candidate: row, interviews }
                });
            } catch (err) {
                console.error(`[Job ${jobId}] Failed:`, err);
                extractionJobs.set(jobId, { status: "failed", error: err.message });
            }
        })();

        res.status(202).json({ jobId, message: "Extraction started" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to start extraction", details: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// POST /upload/feedback  — single feedback document
// ════════════════════════════════════════════════════════════════════════════
router.post("/feedback", upload.single("feedback"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const { candidate_id } = req.body;
        if (!candidate_id) return res.status(400).json({ error: "Candidate ID is required" });

        const jobId = "fb-" + Date.now().toString();
        extractionJobs.set(jobId, { status: "processing", progress: 0 });

        (async () => {
            try {
                const raw = await extractFeedback(req.file.path);
                const { interview_rounds, final_status } = parseAIResponse(raw);

                if (interview_rounds.length === 0) {
                    throw new Error("AI could not extract valid interview rounds.");
                }

                const candRes = await pool.query('SELECT status FROM candidates WHERE id = $1', [candidate_id]);
                const existingStatus = candRes.rows[0]?.status || 'Pending';

                const { saved, finalStatus } = await saveRounds(candidate_id, interview_rounds, existingStatus);

                const best = final_status ? getHighestStatus(finalStatus, final_status) : finalStatus;
                if (best) {
                    await pool.query('UPDATE candidates SET status = $1 WHERE id = $2', [best, candidate_id]);
                }

                extractionJobs.set(jobId, { 
                    status: "completed", 
                    data: { message: "Feedback extracted and saved", interviews: saved, final_status: best }
                });
            } catch (err) {
                console.error(`[Job ${jobId}] Failed:`, err);
                extractionJobs.set(jobId, { status: "failed", error: err.message });
            }
        })();

        res.status(202).json({ jobId, message: "Extraction started" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to start extraction", details: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// POST /upload/unified  — resume + feedback in one shot
// ════════════════════════════════════════════════════════════════════════════
router.post("/unified", upload.array("files", 2), async (req, res) => {
    try {
        if (!req.files || req.files.length < 2) {
            return res.status(400).json({ error: "Two files required: Resume and Feedback" });
        }

        const [resumeFile, feedbackFile] = req.files;
        const jobId = "uni-" + Date.now().toString();
        extractionJobs.set(jobId, { status: "processing", progress: 0 });

        (async () => {
            try {
                // 1. Extract Resume
                const resumeRaw = await extractResume(resumeFile.path);
                const { candidate, interview_rounds: resumeRounds, final_status: resumeFinalStatus } = parseAIResponse(resumeRaw);
                const { row, action } = await upsertCandidate(candidate, resumeFile.path);

                // 2. Extract Feedback
                let feedbackRounds = [];
                let feedbackFinalStatus = null;
                try {
                    const feedbackRaw = await extractFeedback(feedbackFile.path);
                    const parsed = parseAIResponse(feedbackRaw);
                    feedbackRounds = parsed.interview_rounds || [];
                    feedbackFinalStatus = parsed.final_status || null;
                } catch (e) {
                    console.warn("[uploadRoutes] Feedback extraction failed. Skipping.", e.message);
                }

                // 3. Merge all rounds
                const allRounds = [...resumeRounds, ...feedbackRounds];
                let interviews = [];
                let finalStatus = row.status || 'Pending';

                if (allRounds.length > 0) {
                    const { saved, finalStatus: computedStatus } = await saveRounds(row.id, allRounds, finalStatus);
                    interviews = saved;
                    finalStatus = computedStatus;
                }

                const aiFinal = feedbackFinalStatus || resumeFinalStatus;
                if (aiFinal) {
                    finalStatus = getHighestStatus(finalStatus, aiFinal);
                }

                if (finalStatus) {
                    await pool.query('UPDATE candidates SET status = $1 WHERE id = $2', [finalStatus, row.id]);
                }

                extractionJobs.set(jobId, { 
                    status: "completed", 
                    data: {
                        message: "Unified extraction successful",
                        action,
                        candidate: { ...row, status: finalStatus },
                        interviews
                    }
                });
            } catch (err) {
                console.error(`[Job ${jobId}] Failed:`, err);
                extractionJobs.set(jobId, { status: "failed", error: err.message });
            }
        })();

        res.status(202).json({ jobId, message: "Unified extraction started" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Unified extraction failed", details: err.message });
    }
});

module.exports = router;
