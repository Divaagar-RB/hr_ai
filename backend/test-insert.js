const { Pool } = require('pg'); 
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'hr_ai', password: 'root', port: 5432 }); 
pool.query('INSERT INTO interviews (candidate_id, round_number, feedback, interviewer, status) VALUES ($1, $2, $3, $4, $5) RETURNING *', [1, 1, JSON.stringify('good'), 'rupa', 'Selected'])
.then(res => { console.log('Insert OK:', res.rows); pool.end(); })
.catch(e => { console.log('Insert Error:', e); pool.end(); });
