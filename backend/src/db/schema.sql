CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    skills TEXT[],
    education TEXT,
    experience TEXT,
    certifications TEXT,
    resume_path TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Selected', 'Rejected', 'Interviewing', 'Hold')),
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
