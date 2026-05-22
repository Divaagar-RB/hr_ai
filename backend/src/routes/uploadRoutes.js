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

            // Save to DB (Upsert on email)
            const query = `
                INSERT INTO candidates (name, email, phone, skills, education, experience, certifications, resume_path)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    skills = EXCLUDED.skills,
                    education = EXCLUDED.education,
                    experience = EXCLUDED.experience,
                    certifications = EXCLUDED.certifications,
                    resume_path = EXCLUDED.resume_path,
                    created_at = NOW()
                RETURNING *
            `;
            const values = [
                extractedData.name,
                extractedData.email,
                extractedData.phone,
                extractedData.skills,
                extractedData.education,
                extractedData.experience,
                extractedData.certifications,
                req.file.path
            ];

            const dbResult = await pool.query(query, values);

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

            const rawResult = await extractFeedback(req.file.path);
            let extractedRounds = JSON.parse(rawResult);

            if (!Array.isArray(extractedRounds)) {
                extractedRounds = [extractedRounds];
            }

            const dbResults = [];
            let finalStatus = null;

            for (const round of extractedRounds) {
                // Save to DB
                const query = `
                    INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (candidate_id, round_number) DO UPDATE SET
                        feedback = EXCLUDED.feedback,
                        interviewer = EXCLUDED.interviewer,
                        status = EXCLUDED.status,
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
                    finalStatus = round.status;
                }
            }

            // Update candidate status based on latest final_status
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
                if (!val) return null;
                if (typeof val === 'object') return JSON.stringify(val, null, 2);
                return String(val);
            };

            const cleanResume = {
                ...resumeData,
                education: cleanToText(resumeData.education),
                experience: cleanToText(resumeData.experience)
            };

            // 2. Save Candidate to DB (Upsert on email)
            const candidateQuery = `
                INSERT INTO candidates (name, email, phone, skills, education, experience, certifications, resume_path)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    skills = EXCLUDED.skills,
                    education = EXCLUDED.education,
                    experience = EXCLUDED.experience,
                    certifications = EXCLUDED.certifications,
                    resume_path = EXCLUDED.resume_path,
                    created_at = NOW()
                RETURNING *
            `;
            const candidateValues = [
                cleanResume.name,
                cleanResume.email,
                cleanResume.phone,
                cleanResume.skills,
                cleanResume.education,
                cleanResume.experience,
                cleanResume.certifications,
                resumeFile.path
            ];
            const candidateResult = await pool.query(candidateQuery, candidateValues);
            const candidate = candidateResult.rows[0];

            // 3. Extract Feedback
            const feedbackRaw = await extractFeedback(feedbackFile.path);
            let feedbackRounds = JSON.parse(feedbackRaw);
            if (!Array.isArray(feedbackRounds)) {
                feedbackRounds = [feedbackRounds];
            }

            // 4. Save Interviews to DB
            const interviewResults = [];
            let finalStatus = candidate.status || 'Pending';

            // Pre-process rounds for status inference
            for (let i = 0; i < feedbackRounds.length; i++) {
                if (!feedbackRounds[i].status && feedbackRounds[i+1]) {
                    feedbackRounds[i].status = 'Selected';
                }
                if (feedbackRounds[i].status) {
                    finalStatus = feedbackRounds[i].status;
                }
            }

            for (const round of feedbackRounds) {
                const interviewQuery = `
                    INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (candidate_id, round_number) DO UPDATE SET
                        feedback = EXCLUDED.feedback,
                        interviewer = EXCLUDED.interviewer,
                        status = EXCLUDED.status,
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

            // 5. Update Candidate Status
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
