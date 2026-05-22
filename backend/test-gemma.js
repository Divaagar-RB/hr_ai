const axios = require('axios');
const text = 'round 1 done\nround 2 3/5 selected rupa\nround 3 improve technical side rejected ranjith';
const prompt = `
Analyze this interview feedback document (image or text).
Extract the interview rounds and return a STRICT VALID JSON ARRAY of objects.
There may be multiple rounds mentioned in the document (e.g. round 1, round 2, etc).

For each round, extract these fields:
- round_number (number, e.g. 1, 2, 3)
- feedback (string, e.g. "done", "3/5", "improve technical side")
- interviewer (string, the name of the person, e.g. "rupa", "ranjith")
- status (string: 'Selected', 'Rejected', 'Hold', or null if not mentioned)

If a field is unavailable, return null.
DO NOT hallucinate.
Return ONLY a JSON Array, like: [{"round_number": 1, "feedback": "good", "interviewer": "John", "status": "Selected"}]

Here is the text extracted from the image:
` + text;

axios.post('http://localhost:11434/api/generate', {
    model: 'gemma4:latest',
    prompt,
    stream: false,
    options: {num_ctx: 2048}
}).then(r => console.log('Response:', r.data.response))
  .catch(e => console.log('Error:', e.message));
