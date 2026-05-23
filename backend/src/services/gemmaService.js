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
    You are an elite AI data extraction specialist. Your task is HIGH-PRECISION CONTEXTUAL EXTRACTION.
    
    EXTRACTION RULES:
    1. Analyze the complete document thoroughly before extracting fields.
    2. Resolve any OCR errors, broken formatting, forwarded emails, screenshots, or partial text automatically.
    3. Cross-reference information across the entire document. Prefer contextual understanding over pattern matching.
    4. If multiple values exist, extract the MOST RECENT and MOST ACCURATE value.
    5. Never leave fields empty if they can be confidently inferred from surrounding context.
    6. Accuracy is more important than speed. Think carefully about candidate identity before generating output.
    
    Extract details into STRICT VALID JSON format.
    Fields:
    - name (string: Full name of candidate)
    - email (string: Most accurate email)
    - phone (string: Most accurate phone number)
    - skills (array of strings)
    - education (STRICTLY a plain text string: Degree, College, Years. Consolidate into a clean readable paragraph. No JSON objects.)
    - experience (STRICTLY a plain text string: Job title, Company, Dates, and core Responsibilities as a clean readable paragraph. No JSON objects.)
    - certifications (string)

    Return ONLY the top-level valid JSON object. No explanation, no markdown.
    `;
    return await callAI(prompt, filePath);
}

async function extractFeedback(filePath) {
    const prompt = `
    You are an elite HR evaluation specialist. Your task is HIGH-PRECISION CONTEXTUAL EXTRACTION of interview feedback.
    
    EXTRACTION RULES:
    1. Analyze the complete document thoroughly before extracting. Preserve entity relationships between rounds, offers, and hiring status.
    2. Resolve OCR errors, broken formatting, or partial text.
    3. Cross-reference information. Understand the progression of interviews (e.g. Technical -> Managerial -> HR).
    4. If a round progressed to the next, the result of the previous round is definitively "Selected".
    5. Accuracy is paramount. Think through interview progression and hiring progression before generating output.

    Extract interview rounds as a JSON ARRAY.
    Each object must have:
    - round_number (number: e.g., 1, 2, 3)
    - feedback (strictly the text describing performance, score, or notes)
    - interviewer (string: Name if mentioned, else null)
    - status (STRICTLY one of: "Selected", "Rejected", "Hold", or null)

    Inference Rules for Parsing:
    - "selected", "cleared", "moved to next" → status: "Selected"
    - "rejected", "not a fit" → status: "Rejected"
    - If a round is followed by another round, set the previous round's status to "Selected" (inference).
    - If a name is mentioned (like "rupa" or "ranjith"), set it as the interviewer.
    - Return ONLY the JSON array. No markdown.
    `;
    return await callAI(prompt, filePath);
}

module.exports = {
    extractResume,
    extractFeedback,
};
