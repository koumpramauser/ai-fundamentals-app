-- ============================================================
-- StudyAI: AI Fundamentals Edition — Supabase SQL Schema
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,           -- bcrypt hash
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- TOPICS
CREATE TABLE IF NOT EXISTS topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  summary_text  TEXT,                    -- Bullet-point study material
  podcast_url   TEXT,                    -- External audio link
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- QUESTIONS
CREATE TABLE IF NOT EXISTS questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id       UUID REFERENCES topics(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('mcq', 'tf', 'open')),
  text           TEXT NOT NULL,
  options        JSONB,                  -- Array of strings for MCQ
  correct_answer TEXT,                   -- For MCQ/TF; null for open
  rubric         TEXT,                   -- Grading rubric for open-ended
  keywords       JSONB,                  -- Array of technical keywords
  points         INTEGER NOT NULL DEFAULT 10,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- SCORES  (one row per student)
CREATE TABLE IF NOT EXISTS scores (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points   INTEGER NOT NULL DEFAULT 0,
  last_updated   TIMESTAMPTZ DEFAULT now()
);

-- ANSWERS  (audit log of all submissions)
CREATE TABLE IF NOT EXISTS answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id    UUID REFERENCES questions(id) ON DELETE CASCADE,
  answer_text    TEXT,
  score          INTEGER DEFAULT 0,
  ai_feedback    TEXT,
  submitted_at   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (enable in Supabase Dashboard too)
-- ─────────────────────────────────────────────
-- NOTE: The app uses the service_role key server-side, which bypasses RLS.
-- These policies protect direct client-side access only.

ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers  ENABLE ROW LEVEL SECURITY;

-- Allow service_role (server) full access — handled automatically by Supabase
-- Deny all anon/authenticated direct access (app uses service_role server-side)

-- ─────────────────────────────────────────────
-- SEED: Create default admin account
-- Change password hash as needed (below = bcrypt of "Admin@FAU2024")
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, role) VALUES (
  'Course Admin',
  'admin@fau.edu',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCInkd0Pu',  -- replace with your own hash
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_answers_user    ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_points   ON scores(total_points DESC);
