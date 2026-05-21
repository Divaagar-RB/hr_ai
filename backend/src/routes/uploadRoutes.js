const express = require("express");
const multer = require("multer");
const path = require("path");
const {
    extractResume,
    extractFeedback,
} = require("../services/gemmaService");
const pool = require("../db/db");

const router = express.Router();

// Configure multer for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads/"));
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
            const extractedData = JSON.parse(rawResult);

            // Save to DB
            const query = `
                INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const values = [
                candidate_id,
                extractedData.round_number || 1,
                extractedData,
                extractedData.interviewer,
                extractedData.final_status
            ];

            const dbResult = await pool.query(query, values);

            // Update candidate status based on final_status
            if (extractedData.final_status) {
                await pool.query(
                    'UPDATE candidates SET status = $1 WHERE id = $2',
                    [extractedData.final_status, candidate_id]
                );
            }

            res.json({
                message: "Feedback extracted and saved successfully",
                interview: dbResult.rows[0]
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

module.exports = router;
