const express = require("express");
const pool = require("../db/db");

const router = express.Router();

// Get all candidates
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM candidates ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch candidates" });
    }
});

// Get single candidate with interviews
router.get("/:id", async (req, res) => {
    try {
        const candidateId = req.params.id;
        const candidate = await pool.query("SELECT * FROM candidates WHERE id = $1", [candidateId]);
        
        if (candidate.rows.length === 0) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        const interviews = await pool.query("SELECT * FROM interviews WHERE candidate_id = $1 ORDER BY created_at ASC", [candidateId]);

        res.json({
            ...candidate.rows[0],
            interviews: interviews.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch candidate details" });
    }
});

// Update candidate details
router.patch("/:id", async (req, res) => {
    try {
        const { name, email, phone, skills, education, experience, certifications, status } = req.body;
        const candidateId = req.params.id;

        const result = await pool.query(
            "UPDATE candidates SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), skills = COALESCE($4, skills), education = COALESCE($5, education), experience = COALESCE($6, experience), certifications = COALESCE($7, certifications), status = COALESCE($8, status) WHERE id = $9 RETURNING *",
            [name, email, phone, skills, education, experience, certifications, status, candidateId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update candidate details" });
    }
});

// Update interview round feedback
router.patch("/interviews/:id", async (req, res) => {
    try {
        const { round_number, feedback, interviewer, status } = req.body;
        const interviewId = req.params.id;

        const result = await pool.query(
            "UPDATE interviews SET round_number = COALESCE($1, round_number), feedback = COALESCE($2, feedback), interviewer = COALESCE($3, interviewer), status = COALESCE($4, status) WHERE id = $5 RETURNING *",
            [round_number, feedback, interviewer, status, interviewId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Interview not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update interview feedback" });
    }
});

module.exports = router;
