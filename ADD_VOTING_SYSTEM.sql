-- Add Voting System and Title to StataFix
-- Run this to add upvote/downvote functionality

-- ==============================================
-- 1. ADD COLUMNS TO EXISTING TABLES
-- ==============================================

-- Add title and voting columns to stata_issues
ALTER TABLE stata_issues 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- Add voting columns to comments
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- ==============================================
-- 2. CREATE USER_VOTES TABLE
-- ==============================================

-- Track individual user votes to prevent duplicate voting
CREATE TABLE IF NOT EXISTS user_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('issue', 'comment')),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id, target_type)
);

-- Create indexes for user_votes
CREATE INDEX IF NOT EXISTS idx_user_votes_user_id ON user_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_target ON user_votes(target_id, target_type);

-- ==============================================
-- 3. ADD INDEXES FOR SORTING
-- ==============================================

-- Add indexes for sorting by upvotes and hot
CREATE INDEX IF NOT EXISTS idx_stata_issues_upvotes ON stata_issues(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_comments_upvotes ON comments(upvotes DESC);

-- ==============================================
-- 4. CREATE VIEW FOR HOT POSTS
-- ==============================================

-- View for sorting by "hot" (comment count + upvotes)
CREATE OR REPLACE VIEW stata_issues_hot AS
SELECT 
  si.*,
  COUNT(c.id) as comment_count,
  (si.upvotes - si.downvotes + COUNT(c.id) * 2) as hot_score
FROM stata_issues si
LEFT JOIN comments c ON c.issue_id = si.id
GROUP BY si.id
ORDER BY hot_score DESC;

-- ==============================================
-- COMPLETE!
-- ==============================================
-- Now you can:
-- 1. Store post titles
-- 2. Upvote/downvote posts and comments
-- 3. Sort by upvotes, downvotes, or hot score
-- 4. Track individual user votes to prevent duplicates
