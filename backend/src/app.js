const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const uploadRoutes = require("./routes/uploadRoutes");
const candidateRoutes = require("./routes/candidateRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/upload", uploadRoutes);
app.use("/api/candidates", candidateRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
