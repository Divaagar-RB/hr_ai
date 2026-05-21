const axios = require("axios");
const fs = require("fs");

async function callGemma(prompt, imagePath) {
    try {
        const imageBase64 = fs.readFileSync(imagePath, {
            encoding: "base64",
        });

        const response = await axios.post(
            process.env.OLLAMA_URL || "http://localhost:11434/api/generate",
            {
                model: process.env.MODEL_NAME || "gemma3",
                prompt,
                images: [imageBase64],
                stream: false,
            }
        );

        let responseText = response.data.response;
        
        // Sanitize broken JSON (LLMs sometimes wrap in markdown code blocks)
        responseText = responseText.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
        
        return responseText;
    } catch (error) {
        console.error("Error calling Ollama:", error.message);
        throw new Error("AI extraction failed");
    }
}

async function extractResume(imagePath) {
    const prompt = `
    You are an AI resume parser.
    Analyze the provided image of a resume and extract the following details in a STRICT VALID JSON format.
    
    Fields:
    - name (string)
    - email (string)
    - phone (string)
    - skills (array of strings)
    - education (string)
    - experience (string)
    - certifications (string)

    If a field is unavailable, return null for that field.
    DO NOT hallucinate.
    Return ONLY JSON.
    `;

    return await callGemma(prompt, imagePath);
}

async function extractFeedback(imagePath) {
    const prompt = `
    Analyze this interview feedback image.
    Extract the following details in a STRICT VALID JSON format:
    
    Fields:
    - round_feedback (string)
    - final_status (string: 'Selected', 'Rejected', 'Hold')
    - remarks (string)
    - interviewer (string)
    - round_number (number)

    If a field is unavailable, return null.
    DO NOT hallucinate.
    Return ONLY JSON.
    `;

    return await callGemma(prompt, imagePath);
}

module.exports = {
    extractResume,
    extractFeedback,
};
