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

const ENTERPRISE_PROMPT = `You are an Enterprise HR Data Extraction Engine.

Your purpose is to extract structured recruitment information from:
- Resumes
- CVs
- Interview feedback screenshots
- Recruiter notes
- Email conversations
- Offer letters
- Hiring documents
- OCR text extracted from images
- Chat messages
- Candidate tracking documents

==================================================
PRIMARY OBJECTIVE
==================================================
Extract information accurately.
Missing information is acceptable.
Incorrect information is unacceptable.
Never hallucinate.
Never generate summaries.
Never create information that does not exist in the document.
If a value cannot be found confidently, return: "", [], or null.

==================================================
DOCUMENT ANALYSIS
==================================================
Before extraction:
1. Read the entire document.
2. Analyze all sections.
3. Cross-reference information.
4. Handle OCR mistakes.
5. Handle broken formatting.
6. Handle screenshots and images.
7. Handle interview notes.
Perform a second verification pass before generating output.

==================================================
CANDIDATE EXTRACTION
==================================================
Extract: name, email, phone, linkedin, location, skills, education, experience, certifications

==================================================
NAME EXTRACTION
==================================================
Extract full candidate name. Prefer: Resume Header, Profile Section, Contact Section.
Do not extract recruiter names.

==================================================
EMAIL & PHONE EXTRACTION
==================================================
Extract valid email only. (e.g. divaagarb@gmail.com)
Extract complete phone number only.
Validate: Indian numbers should contain 10 digits. Incomplete numbers must be ignored. (Wrong: 948982916, Correct: 9489829160)

==================================================
SKILLS EXTRACTION
==================================================
Extract skills from: Skills Section, Projects, Experience, Technologies Used, Certifications.
Remove duplicates.

==================================================
EDUCATION & EXPERIENCE EXTRACTION
==================================================
Search entire document.
Education fields: degree, institution, graduation_year, cgpa. Do not generate summaries.
Experience fields: company, role, start_date, end_date. Do not generate summaries or estimate years.

==================================================
CERTIFICATIONS EXTRACTION
==================================================
Extract certification names only.

==================================================
INTERVIEW FEEDBACK EXTRACTION
==================================================
Treat each line as an independent interview round.
Recognize rounds: round 1, round1, r1, 1st round, 1, etc.
If a line starts with 1, 2, 3, 4, 5, assume it represents a round number.

==================================================
INTERVIEW STATUS EXTRACTION
==================================================
Selected keywords: selected, pass, passed, cleared, shortlisted, next round -> Status = Selected
Rejected keywords: rejected, failed, not selected, not shortlisted -> Status = Rejected
Completed keywords: done, completed -> Status = Completed

==================================================
FEEDBACK & INTERVIEWER EXTRACTION
==================================================
Remove status and interviewer names from feedback.
Assign interviewer only to that round. Never copy interviewers across rounds.

==================================================
ROUND PROGRESSION RULE
==================================================
If a later round exists, Previous round is automatically considered Selected. Progression implies success.

==================================================
CANDIDATE & APPLICATION DEDUPLICATION
==================================================
Match candidates using: 1. Email 2. Phone 3. LinkedIn 4. Name
If candidate exists: action = UPDATE. Do not create duplicate records.
Match application: Candidate + Company + Role.

==================================================
FINAL STATUS CALCULATION
==================================================
Priority: Hired, Offered, Selected, Assessment Completed, Under Review, Applied, Rejected. Highest stage reached wins.

==================================================
VALIDATION PASS
==================================================
Before output: Verify all fields, phones, emails, rounds, interviewers, statuses. Remove duplicates. Search document again for empty fields.

==================================================
OUTPUT FORMAT
==================================================
Return JSON only.
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
}

Never return explanations. Never return markdown. Never return notes. Never return reasoning. Return valid JSON only.`;

async function extractResume(filePath) {
    return await callAI(ENTERPRISE_PROMPT, filePath);
}

async function extractFeedback(filePath) {
    return await callAI(ENTERPRISE_PROMPT, filePath);
}

module.exports = {
    extractResume,
    extractFeedback,
};
