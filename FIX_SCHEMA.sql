-- Fix Schema Issues for StataFix
-- Run this if you get "Could not find the 'password_hash' column" error

-- ==============================================
-- OPTION 1: Drop and Recreate Tables (RECOMMENDED)
-- ==============================================
-- WARNING: This will delete all existing data!

-- Drop existing tables in correct order (respecting foreign keys)
DROP VIEW IF EXISTS issue_details CASCADE;
DROP VIEW IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS point_ledger CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS stata_issues CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Now run the full SUPABASE_SETUP.sql script
-- Or copy the table creation commands below:

-- Table: profiles (replaces users table)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cumulative_points BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stata_issues (replaces polipions table)
CREATE TABLE stata_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  command TEXT NOT NULL,
  error_category TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  is_resolved BOOLEAN DEFAULT FALSE
);

-- Table: comments (new - replaces all_comments JSON array)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID REFERENCES stata_issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  is_verified_fix BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: point_ledger (new - for analytics)
CREATE TABLE point_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_points ON profiles(cumulative_points DESC);
CREATE INDEX idx_stata_issues_user_id ON stata_issues(user_id);
CREATE INDEX idx_stata_issues_is_resolved ON stata_issues(is_resolved);
CREATE INDEX idx_stata_issues_created_at ON stata_issues(created_at DESC);
CREATE INDEX idx_stata_issues_command ON stata_issues(command);
CREATE INDEX idx_comments_issue_id ON comments(issue_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
CREATE INDEX idx_comments_verified ON comments(is_verified_fix);
CREATE INDEX idx_point_ledger_user_id ON point_ledger(user_id);
CREATE INDEX idx_point_ledger_created_at ON point_ledger(created_at DESC);

-- ==============================================
-- OPTION 2: Add Missing Column (If table exists)
-- ==============================================
-- Use this ONLY if you have existing data to preserve

-- Check if profiles table exists and add password_hash if missing
-- DO NOT USE IF YOU ALREADY DROPPED THE TABLE ABOVE!

-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- ==============================================
-- AFTER RUNNING THIS SCRIPT
-- ==============================================
-- 1. Go to Supabase Dashboard
-- 2. Click on "API" in the left sidebar
-- 3. Look for the "Reload schema cache" or refresh button
-- 4. Or just wait 30 seconds for automatic cache refresh
-- 5. Try creating an account again
