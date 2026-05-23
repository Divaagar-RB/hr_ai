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

const RESUME_PROMPT = `You are an Enterprise HR Data Extraction Engine.

Your purpose is to extract structured candidate information from resumes, CVs, email conversations, and hiring documents.

==================================================
PRIMARY OBJECTIVE
==================================================
Extract information accurately.
Missing information is acceptable.
Incorrect information is unacceptable.
Never hallucinate. Never generate summaries.
If a value cannot be found confidently, return: "", [], or null.

==================================================
DOCUMENT ANALYSIS
==================================================
1. Read the entire document.
2. Analyze all sections.
3. Cross-reference information.
4. Handle OCR mistakes and broken formatting.
Perform a second verification pass before generating output.

==================================================
EXTRACTION FIELDS
==================================================
name       - Full candidate name (from header/contact section, NOT recruiter name)
email      - Valid email address only (look for @ symbol)
phone      - Complete phone number (extract any sequence of digits, +, or spaces resembling a phone number)
linkedin   - LinkedIn URL or username (look for linkedin.com or /in/)
location   - City, State, or Country if present
skills     - Array of skills from Skills section, Projects, Experience, Technologies
education  - Array of objects: { degree, institution, graduation_year, cgpa }
experience - Array of objects: { company, role, start_date, end_date }
certifications - Array of certification name strings

==================================================
RULES
==================================================
- Do NOT summarize education or experience. Extract exact values only.
- Remove duplicate skills.
- Phone: Extract EXACTLY as written. Do NOT enforce a 10-digit rule. Even if it's 9 or 11 digits, extract it.
- Look very closely at the top and bottom of the document for contact information (Email/Phone).
- If a field has absolutely no data, use null or [].

==================================================
OUTPUT FORMAT
==================================================
Return ONLY valid JSON. No markdown, no explanation, no notes.

{
  "candidate": {
    "name": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "location": "",
    "skills": [],
    "education": [],
    "experience": [],
    "certifications": []
  },
  "interview_rounds": [],
  "final_status": "",
  "action": "INSERT"
}`;

const FEEDBACK_PROMPT = `You are an Enterprise HR Interview Feedback Extraction Engine.

Your purpose is to extract structured interview round information from:
- Handwritten interview notes
- Feedback screenshots
- Recruiter notes
- Interview assessment sheets

==================================================
PRIMARY OBJECTIVE
==================================================
Extract interview round information accurately.
Do NOT extract candidate personal details (name, email, phone).
Do NOT hallucinate rounds that do not exist.
If a field cannot be found, use null.

==================================================
ROUND IDENTIFICATION
==================================================
Recognize these patterns as round indicators:
  round 1, round1, r1, 1st round, R1, Round 1, 1
  round 2, round2, r2, 2nd round, R2, Round 2, 2
  round 3, round3, r3, 3rd round, R3, Round 3, 3

If a line starts with: 1, 2, 3, 4, 5 — treat as round number.

==================================================
STATUS EXTRACTION
==================================================
Selected keywords: selected, pass, passed, cleared, shortlisted, next round
  → status = "Selected"

Rejected keywords: rejected, failed, not selected, not shortlisted
  → status = "Rejected"

Completed keywords: done, completed
  → status = "Completed"

Hold keyword: hold, on hold
  → status = "Hold"

==================================================
FEEDBACK EXTRACTION
==================================================
Extract only the performance notes/score. Remove status keywords and interviewer name from feedback.

Examples:
  "round 1 done"               → feedback="done"
  "round 2 3/5 selected rupa"  → feedback="3/5", status="Selected", interviewer="rupa"
  "round 3 improve technical side rejected ranjith" → feedback="improve technical side", status="Rejected", interviewer="ranjith"

==================================================
ROUND PROGRESSION RULE
==================================================
If Round N+1 exists, Round N status = "Selected" (progression implies success).

==================================================
INTERVIEWER EXTRACTION
==================================================
Assign the name ONLY to the round it appears in. Never copy an interviewer to other rounds.

==================================================
OUTPUT FORMAT
==================================================
Return ONLY valid JSON. No markdown, no explanation, no notes.

{
  "candidate": {
    "name": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "location": "",
    "skills": [],
    "education": [],
    "experience": [],
    "certifications": []
  },
  "interview_rounds": [
    {
      "round_number": 1,
      "feedback": "",
      "interviewer": null,
      "status": null
    }
  ],
  "final_status": "",
  "action": "INSERT"
}`;

async function extractResume(filePath) {
    return await callAI(RESUME_PROMPT, filePath);
}

async function extractFeedback(filePath) {
    return await callAI(FEEDBACK_PROMPT, filePath);
}

module.exports = {
    extractResume,
    extractFeedback,
};
