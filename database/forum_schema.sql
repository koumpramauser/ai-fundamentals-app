-- ============================================================
-- StudyAI: Forum tables for Student Feedback
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- FORUM POSTS
CREATE TABLE IF NOT EXISTS forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  topic_id    UUID REFERENCES topics(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('content_quality', 'missing_topic', 'question_issue', 'general')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'declined')),
  votes       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- FORUM VOTES (one vote per user per post)
CREATE TABLE IF NOT EXISTS forum_votes (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- FORUM REPLIES
CREATE TABLE IF NOT EXISTS forum_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE forum_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies  ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forum_posts_status   ON forum_posts(status);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_votes    ON forum_posts(votes DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_post   ON forum_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_votes_post     ON forum_votes(post_id);
