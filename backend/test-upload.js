const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function upload() {
    try {
        const form = new FormData();
        form.append('candidate_id', '1'); // candidate ID
        form.append('feedback', fs.createReadStream('dummy.png'));

        const response = await axios.post('http://localhost:5000/api/upload/feedback', form, {
            headers: form.getHeaders(),
        });
        console.log('Upload OK:', response.data);
    } catch (e) {
        console.log('Upload Error:', e.response ? e.response.data : e.message);
    }
}
upload();
