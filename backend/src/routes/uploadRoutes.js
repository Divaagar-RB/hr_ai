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

            // Save to DB
            const query = `
                INSERT INTO candidates (name, email, phone, skills, education, experience, certifications, resume_path)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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

            // 2. Save Candidate to DB
            const candidateQuery = `
                INSERT INTO candidates (name, email, phone, skills, education, experience, certifications, resume_path)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;
            const candidateValues = [
                resumeData.name,
                resumeData.email,
                resumeData.phone,
                resumeData.skills,
                resumeData.education,
                resumeData.experience,
                resumeData.certifications,
                resumeFile.path
            ];
            const candidateResult = await pool.query(candidateQuery, candidateValues);
            const candidate = candidateResult.rows[0];

            // 3. Extract Feedback
            const feedbackRaw = await extractFeedback(feedbackFile.path);
            const feedbackData = JSON.parse(feedbackRaw);

            // 4. Save Interview to DB
            const interviewQuery = `
                INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const interviewValues = [
                candidate.id,
                feedbackData.round_number || 1,
                feedbackData,
                feedbackData.interviewer,
                feedbackData.final_status
            ];
            const interviewResult = await pool.query(interviewQuery, interviewValues);

            // 5. Update Candidate Status
            if (feedbackData.final_status) {
                await pool.query(
                    'UPDATE candidates SET status = $1 WHERE id = $2',
                    [feedbackData.final_status, candidate.id]
                );
            }

            res.json({
                message: "Unified extraction successful",
                candidate: {
                    ...candidate,
                    status: feedbackData.final_status || candidate.status
                },
                interview: interviewResult.rows[0]
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
