const axios = require("axios");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    console.log(`[gemmaService] Checking file: ${filePath} (ext: ${ext})`);

    if (ext === ".pdf") {
        console.log("[gemmaService] Using pdf-parse for PDF...");
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        console.log("[gemmaService] PDF text extracted, length:", data.text.length);
        return data.text;
    }
    // For images, we return null and handle it via vision in callGemma
    return null;
}

async function callOllama(prompt, filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const isImage = [".png", ".jpg", ".jpeg"].includes(ext);
        
        let payload = {
            model: (process.env.MODEL_NAME || "gemma4:e2b").trim(),
            prompt: prompt,
            stream: false,
            options: {
                num_ctx: 4096,
                num_predict: 2048,
                temperature: 0 // More deterministic for data extraction
            },
            keep_alive: -1
        };

        if (isImage) {
            console.log("[gemmaService] File is image, using native vision extraction (Ollama)...");
            const imageBase64 = fs.readFileSync(filePath).toString("base64");
            payload.images = [imageBase64];
            payload.prompt = prompt + "\n\nPlease analyze the provided image and extract the details in the specified JSON format.";
        } else {
            const extractedText = await extractTextFromFile(filePath);
            if (extractedText) {
                payload.prompt = prompt + "\n\nHere is the text extracted from the document:\n" + extractedText;
            }
        }

        console.log("[gemmaService] Sending prompt to Ollama model:", payload.model);
        const response = await axios.post(
            process.env.OLLAMA_URL || "http://localhost:11434/api/generate",
            payload,
            { timeout: 600000 }
        );

        return response.data.response;
    } catch (error) {
        console.error("[gemmaService] Ollama Error:", error.message);
        throw error;
    }
}

async function callGemini(prompt, filePath) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            throw new Error("Gemini API key not configured in .env");
        }

        const ext = path.extname(filePath).toLowerCase();
        const isImage = [".png", ".jpg", ".jpeg"].includes(ext);
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        let contents = [];
        if (isImage) {
            console.log("[gemmaService] Using Gemini Vision extraction...");
            const imageBase64 = fs.readFileSync(filePath).toString("base64");
            const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
            contents = [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: imageBase64 } }
                ]
            }];
        } else {
            const extractedText = await extractTextFromFile(filePath);
            contents = [{
                parts: [{ text: `${prompt}\n\nDocument Text:\n${extractedText || ''}` }]
            }];
        }

        const response = await axios.post(url, { contents }, { timeout: 60000 });
        const result = response.data.candidates[0].content.parts[0].text;
        return result;

    } catch (error) {
        console.error("[gemmaService] Gemini Error:", error.message);
        if (error.response?.data) console.error(JSON.stringify(error.response.data));
        throw error;
    }
}

async function callAI(prompt, filePath) {
    const provider = (process.env.AI_PROVIDER || "OLLAMA").toUpperCase();
    let responseText;

    try {
        if (provider === "GEMINI") {
            try {
                responseText = await callGemini(prompt, filePath);
            } catch (geminiError) {
                if (geminiError.response?.status === 429) {
                    console.warn("[gemmaService] Gemini quota exceeded (429). Falling back to Ollama...");
                    responseText = await callOllama(prompt, filePath);
                } else {
                    throw geminiError;
                }
            }
        } else {
            responseText = await callOllama(prompt, filePath);
        }

        // Clean up response (handles markdown, extra text, etc.)
        const jsonMatch = responseText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        const sanitized = jsonMatch ? jsonMatch[0] : responseText.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
        
        console.log(`[gemmaService] Result | Sanitized JSON:`, sanitized);
        return sanitized;

    } catch (error) {
        console.error(`[gemmaService] AI Extraction failed:`, error.message);
        throw new Error(`AI extraction failed: ${error.message}`);
    }
}

async function extractResume(filePath) {
    const prompt = `
    You are an AI resume parser.
    Extract details from the document in STRICT VALID JSON format.
    Fields:
    - name (string: Full name)
    - email (string)
    - phone (string)
    - skills (array of strings)
    - education (STRICTLY a plain text string: Degree, College, Years. No JSON objects.)
    - experience (STRICTLY a plain text string: Job title, Company, Dates, and core Responsibilities as a readable paragraph or bulleted text. No JSON objects.)
    - certifications (string)

    Rules:
    - DO NOT return JSON objects inside the education or experience fields. Use plain text only.
    - education should include the college name.
    - Extract experience as readable text capturing the key roles and projects.
    - Return ONLY the top-level valid JSON object.
    `;
    return await callAI(prompt, filePath);
}

async function extractFeedback(filePath) {
    const prompt = `
    Extract interview rounds from the provided handwritten notes or document as a JSON ARRAY.
    
    Each object must have:
    - round_number (number, e.g., 1, 2, 3)
    - feedback (strictly the text describing performance, score, or notes like "done", "3/5", or "improve technical side")
    - interviewer (string: Name if mentioned, often at the end of the line, else null)
    - status (STRICTLY one of: "Selected", "Rejected", "Hold", or null)

    Rules for Parsing:
    - "selected" → status: "Selected"
    - "rejected" → status: "Rejected"
    - If a round is followed by another round, and no status is given, set status to "Selected" (inference).
    - If a name is mentioned (like "rupa" or "ranjith"), set it as the interviewer.
    - Capturing the feedback score (e.g. "3/5") is important.
    - Return ONLY the JSON array.
    `;
    return await callAI(prompt, filePath);
}

module.exports = {
    extractResume,
    extractFeedback,
};
