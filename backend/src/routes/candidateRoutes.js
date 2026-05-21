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

// Update candidate status
router.patch("/:id", async (req, res) => {
    try {
        const { status } = req.body;
        const candidateId = req.params.id;

        const result = await pool.query(
            "UPDATE candidates SET status = $1 WHERE id = $2 RETURNING *",
            [status, candidateId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update candidate status" });
    }
});

module.exports = router;
