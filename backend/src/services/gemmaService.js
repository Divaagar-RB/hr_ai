const axios = require("axios");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");

async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    console.log(`[gemmaService] Extracting text from file: ${filePath} (ext: ${ext})`);

    if (ext === ".pdf") {
        console.log("[gemmaService] Using pdf-parse for PDF...");
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        console.log("[gemmaService] PDF text extracted, length:", data.text.length);
        return data.text;
    } else {
        console.log("[gemmaService] Using Tesseract OCR for image...");
        const { data: { text } } = await Tesseract.recognize(filePath, "eng", {
            logger: (m) => {
                if (m.status === "recognizing text") {
                    process.stdout.write(`\r[Tesseract] Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });
        console.log("\n[gemmaService] Tesseract OCR complete. Extracted text:", text.trim());
        return text;
    }
}

async function callGemma(prompt, filePath) {
    try {
        const extractedText = await extractTextFromFile(filePath);

        const finalPrompt = prompt + "\n\nHere is the text extracted from the document:\n" + extractedText;

        const payload = {
            model: process.env.MODEL_NAME || "gemma4",
            prompt: finalPrompt,
            stream: false,
            options: {
                num_ctx: 2048
            }
        };

        console.log("[gemmaService] Sending prompt to Ollama model:", payload.model);
        const response = await axios.post(
            process.env.OLLAMA_URL || "http://localhost:11434/api/generate",
            payload,
            { timeout: 120000 } // 2 minute timeout
        );

        let responseText = response.data.response;
        console.log("[gemmaService] Raw Gemma response:", responseText);

        // Find JSON array or object within response (handles markdown wrappers & conversational text)
        const jsonMatch = responseText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
            responseText = jsonMatch[0];
        } else {
            responseText = responseText.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
        }

        console.log("[gemmaService] Sanitized JSON:", responseText);
        return responseText;

    } catch (error) {
        console.error("[gemmaService] Error calling Ollama:", error.message);
        if (error.response && error.response.data) {
            console.error("[gemmaService] Ollama Response Data:", error.response.data);
        }
        throw new Error("AI extraction failed: " + error.message);
    }
}

async function extractResume(filePath) {
    const prompt = `
    You are an AI resume parser.
    Analyze the provided text extracted from a resume and extract the following details in a STRICT VALID JSON format.
    
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
    Return ONLY a single JSON object. No extra text, no markdown.
    `;

    return await callGemma(prompt, filePath);
}

async function extractFeedback(filePath) {
    const prompt = `
    You are an HR data extraction AI.
    Analyze the text below which contains interview feedback notes.
    Extract each interview round and return a JSON ARRAY of round objects.
    
    For each round extract:
    - round_number (number, e.g. 1, 2, 3)
    - feedback (string describing the feedback or score, e.g. "done", "3/5", "improve technical side")
    - interviewer (string, name of the interviewer if mentioned, else null)
    - status (one of: "Selected", "Rejected", "Hold", or null if not clearly mentioned)

    Rules:
    - If a round only says "done" with no status, set status to null.
    - A score like "3/5" means the candidate was evaluated, not necessarily selected.
    - "selected" → status: "Selected", "rejected" → status: "Rejected".
    - Return ONLY the JSON array. No markdown, no explanation.

    Example output:
    [{"round_number": 1, "feedback": "done", "interviewer": null, "status": null}, {"round_number": 2, "feedback": "3/5", "interviewer": "rupa", "status": "Selected"}]
    `;

    return await callGemma(prompt, filePath);
}

module.exports = {
    extractResume,
    extractFeedback,
};
