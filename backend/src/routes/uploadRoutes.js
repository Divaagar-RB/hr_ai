const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
    extractResume,
    extractFeedback,
} = require("../services/gemmaService");
const pool = require("../db/db");

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

function getHighestStatus(statusA, statusB) {
    const a = STATUS_PRIORITY[statusA] || 0;
    const b = STATUS_PRIORITY[statusB] || 0;
    return a >= b ? statusA : statusB;
}

const cleanToNull = (val) => {
    if (val === undefined || val === null || val === '') return null;
    if (Array.isArray(val) && val.length === 0) return null;
    return val;
};

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

router.post(
    "/resume",
    upload.single("resume"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const rawResult = await extractResume(req.file.path);
            const extractedData = JSON.parse(rawResult);

            // Data Cleaning
            const name = cleanToNull(extractedData.name);
            const email = cleanToNull(extractedData.email);
            const phone = cleanToNull(extractedData.phone);
            const skills = cleanToNull(extractedData.skills);
            const education = cleanToNull(extractedData.education);
            const experience = cleanToNull(extractedData.experience);
            const certifications = cleanToNull(extractedData.certifications);

            // Deduplication and Merge Logic
            let candidateQuery;
            let candidateValues;
            let candidateResult;
            
            // Check for existing by Email OR Phone
            const searchRes = await pool.query('SELECT * FROM candidates WHERE (email = $1 AND email IS NOT NULL) OR (phone = $2 AND phone IS NOT NULL) LIMIT 1', [email, phone]);
            
            if (searchRes.rows.length > 0) {
                // UPDATE (Merge fields, avoid overwriting with null)
                candidateQuery = `
                    UPDATE candidates SET
                        name = COALESCE($1, name),
                        email = COALESCE($2, email),
                        phone = COALESCE($3, phone),
                        skills = COALESCE($4, skills),
                        education = COALESCE($5, education),
                        experience = COALESCE($6, experience),
                        certifications = COALESCE($7, certifications),
                        resume_path = COALESCE($8, resume_path)
                    WHERE id = $9 RETURNING *
                `;
                candidateValues = [name, email, phone, skills, education, experience, certifications, req.file.path, searchRes.rows[0].id];
            } else {
                // INSERT
                candidateQuery = `
                    INSERT INTO candidates (name, email, phone, skills, education, experience, certifications, resume_path)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
                `;
                candidateValues = [name, email, phone, skills, education, experience, certifications, req.file.path];
            }

            const dbResult = await pool.query(candidateQuery, candidateValues);

            res.json({
                message: "Resume extracted and saved successfully",
                candidate: dbResult.rows[0]
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Resume extraction failed",
                details: err.message
            });
        }
    }
);

router.post(
    "/feedback",
    upload.single("feedback"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const { candidate_id } = req.body;
            if (!candidate_id) {
                return res.status(400).json({ error: "Candidate ID is required" });
            }

            let extractedRounds = [];
            try {
                const rawResult = await extractFeedback(req.file.path);
                extractedRounds = JSON.parse(rawResult);
                if (!Array.isArray(extractedRounds)) {
                    extractedRounds = [extractedRounds];
                }
            } catch (e) {
                return res.status(400).json({ error: "AI failed to extract valid feedback JSON. Please try a clearer image.", details: e.message });
            }

            const dbResults = [];
            
            // Fetch candidate's current status first
            const candRes = await pool.query('SELECT status FROM candidates WHERE id = $1', [candidate_id]);
            let finalStatus = candRes.rows.length > 0 ? candRes.rows[0].status : null;

            // Progression Inference Logic
            for (let i = 0; i < extractedRounds.length; i++) {
                if (!extractedRounds[i].status && extractedRounds[i+1]) {
                    extractedRounds[i].status = 'Selected'; // Progression implies success
                }
            }

            for (const round of extractedRounds) {
                // Save to DB (Merge new feedback into existing)
                const query = `
                    INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (candidate_id, round_number) DO UPDATE SET
                        feedback = COALESCE(EXCLUDED.feedback, interviews.feedback),
                        interviewer = COALESCE(EXCLUDED.interviewer, interviews.interviewer),
                        status = COALESCE(EXCLUDED.status, interviews.status),
                        created_at = NOW()
                    RETURNING *
                `;
                const values = [
                    candidate_id,
                    round.round_number || 1,
                    JSON.stringify(round.feedback),
                    round.interviewer,
                    round.status
                ];

                const dbResult = await pool.query(query, values);
                dbResults.push(dbResult.rows[0]);

                if (round.status) {
                    finalStatus = getHighestStatus(finalStatus, round.status);
                }
            }

            // Update candidate status based on highest status priority
            if (finalStatus) {
                await pool.query(
                    'UPDATE candidates SET status = $1 WHERE id = $2',
                    [finalStatus, candidate_id]
                );
            }

            res.json({
                message: "Feedback extracted and saved successfully",
                interviews: dbResults
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Feedback extraction failed",
                details: err.message
            });
        }
    }
);

router.post(
    "/unified",
    upload.array("files", 2),
    async (req, res) => {
        try {
            if (!req.files || req.files.length < 2) {
                return res.status(400).json({ error: "Two files are required: Resume and Feedback" });
            }

            const resumeFile = req.files[0];
            const feedbackFile = req.files[1];

            // 1. Extract Resume
            const resumeRaw = await extractResume(resumeFile.path);
            const resumeData = JSON.parse(resumeRaw);

            // Data Cleaning Helper
            const cleanToText = (val) => {
                if (val === undefined || val === null || val === '') return null;
                if (typeof val === 'object' && Object.keys(val).length === 0) return null;
                if (Array.isArray(val) && val.length === 0) return null;
                if (typeof val === 'object') return JSON.stringify(val, null, 2);
                return String(val);
            };

            const name = cleanToText(resumeData.name);
            const email = cleanToText(resumeData.email);
            const phone = cleanToText(resumeData.phone);
            const skills = resumeData.skills && resumeData.skills.length > 0 ? resumeData.skills : null;
            const education = cleanToText(resumeData.education);
            const experience = cleanToText(resumeData.experience);
            const certifications = cleanToText(resumeData.certifications);

            // Deduplication and Merge Logic
            let candidateQuery;
            let candidateValues;
            let candidateResult;
            
            const searchRes = await pool.query('SELECT * FROM candidates WHERE (email = $1 AND email IS NOT NULL) OR (phone = $2 AND phone IS NOT NULL) LIMIT 1', [email, phone]);
            
            if (searchRes.rows.length > 0) {
                // UPDATE (Merge fields, avoid overwriting with null)
                candidateQuery = `
                    UPDATE candidates SET
                        name = COALESCE($1, name),
                        email = COALESCE($2, email),
                        phone = COALESCE($3, phone),
                        skills = COALESCE($4, skills),
                        education = COALESCE($5, education),
                        experience = COALESCE($6, experience),
                        certifications = COALESCE($7, certifications),
                        resume_path = COALESCE($8, resume_path)
                    WHERE id = $9 RETURNING *
                `;
                candidateValues = [name, email, phone, skills, education, experience, certifications, resumeFile.path, searchRes.rows[0].id];
            } else {
                // INSERT
                candidateQuery = `
                    INSERT INTO candidates (name, email, phone, skills, education, experience, certifications, resume_path)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
                `;
                candidateValues = [name, email, phone, skills, education, experience, certifications, resumeFile.path];
            }

            candidateResult = await pool.query(candidateQuery, candidateValues);
            const candidate = candidateResult.rows[0];

            // 3. Extract Feedback
            let feedbackRounds = [];
            try {
                const feedbackRaw = await extractFeedback(feedbackFile.path);
                feedbackRounds = JSON.parse(feedbackRaw);
                if (!Array.isArray(feedbackRounds)) {
                    feedbackRounds = [feedbackRounds];
                }
            } catch (e) {
                console.warn("Feedback AI extraction returned invalid JSON. Skipping feedback.", e.message);
            }

            // 4. Save Interviews to DB
            const interviewResults = [];
            let finalStatus = candidate.status || 'Pending';

            // Pre-process rounds for status inference
            for (let i = 0; i < feedbackRounds.length; i++) {
                if (!feedbackRounds[i].status && feedbackRounds[i+1]) {
                    feedbackRounds[i].status = 'Selected'; // Progression implies success
                }
                if (feedbackRounds[i].status) {
                    finalStatus = getHighestStatus(finalStatus, feedbackRounds[i].status);
                }
            }

            for (const round of feedbackRounds) {
                const interviewQuery = `
                    INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (candidate_id, round_number) DO UPDATE SET
                        feedback = COALESCE(EXCLUDED.feedback, interviews.feedback),
                        interviewer = COALESCE(EXCLUDED.interviewer, interviews.interviewer),
                        status = COALESCE(EXCLUDED.status, interviews.status),
                        created_at = NOW()
                    RETURNING *
                `;
                const interviewValues = [
                    candidate.id,
                    round.round_number || 1,
                    JSON.stringify(round.feedback),
                    round.interviewer,
                    round.status
                ];
                const result = await pool.query(interviewQuery, interviewValues);
                interviewResults.push(result.rows[0]);
            }

            // 5. Update Candidate Status with Highest Priority
            if (finalStatus) {
                await pool.query(
                    'UPDATE candidates SET status = $1 WHERE id = $2',
                    [finalStatus, candidate.id]
                );
            }

            res.json({
                message: "Unified extraction successful",
                candidate: {
                    ...candidate,
                    status: finalStatus || candidate.status
                },
                interviews: interviewResults
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: "Unified extraction failed",
                details: err.message
            });
        }
    }
);

module.exports = router;
