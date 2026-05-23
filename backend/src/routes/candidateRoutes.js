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
        const { name, email, phone, linkedin, location, skills, education, experience, certifications, status } = req.body;
        const candidateId = req.params.id;

        // JSONB and array fields need proper casting
        const educationVal  = education    ? (typeof education === 'string'    ? education    : JSON.stringify(education))    : null;
        const experienceVal = experience   ? (typeof experience === 'string'   ? experience   : JSON.stringify(experience))   : null;
        const certsVal      = certifications
            ? (Array.isArray(certifications) ? certifications
               : typeof certifications === 'string' ? certifications.split(',').map(s => s.trim()).filter(Boolean)
               : null)
            : null;

        const result = await pool.query(
            `UPDATE candidates SET
                name           = COALESCE($1,  name),
                email          = COALESCE($2,  email),
                phone          = COALESCE($3,  phone),
                linkedin       = COALESCE($4,  linkedin),
                location       = COALESCE($5,  location),
                skills         = COALESCE($6,  skills),
                education      = COALESCE($7::jsonb, education),
                experience     = COALESCE($8::jsonb, experience),
                certifications = COALESCE($9,  certifications),
                status         = COALESCE($10, status)
             WHERE id = $11 RETURNING *`,
            [name, email, phone, linkedin, location, skills,
             educationVal, experienceVal, certsVal, status, candidateId]
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

        // feedback can be plain string from textarea or a JSON object
        const feedbackVal = feedback
            ? (typeof feedback === 'string' ? feedback : JSON.stringify(feedback))
            : null;

        const result = await pool.query(
            `UPDATE interviews SET
                round_number = COALESCE($1, round_number),
                feedback     = COALESCE($2::jsonb, feedback),
                interviewer  = COALESCE($3, interviewer),
                status       = COALESCE($4, status)
             WHERE id = $5 RETURNING *`,
            [round_number, feedbackVal, interviewer, status, interviewId]
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
