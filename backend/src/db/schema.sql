CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    linkedin TEXT,
    location TEXT,
    skills TEXT[],
    education JSONB,
    experience JSONB,
    certifications TEXT[],
    resume_path TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN (
        'Pending', 'Selected', 'Rejected', 'Interviewing', 'Hold',
        'Hired', 'Offered', 'Assessment Completed', 'Under Review',
        'Applied', 'Withdrawn'
    )),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    round_number INTEGER,
    feedback JSONB,
    interviewer TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(candidate_id, round_number)
);
