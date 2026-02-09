-- StataFix Database Setup Script for Supabase
-- Run this in your Supabase SQL Editor

-- ==============================================
-- 1. CREATE TABLES
-- ==============================================

-- Table: profiles (replaces users table)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cumulative_points BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stata_issues (replaces polipions table)
CREATE TABLE IF NOT EXISTS stata_issues (
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
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID REFERENCES stata_issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  is_verified_fix BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: point_ledger (new - for analytics)
CREATE TABLE IF NOT EXISTS point_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 2. CREATE INDEXES
-- ==============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON profiles(cumulative_points DESC);

-- STATA Issues indexes
CREATE INDEX IF NOT EXISTS idx_stata_issues_user_id ON stata_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_stata_issues_is_resolved ON stata_issues(is_resolved);
CREATE INDEX IF NOT EXISTS idx_stata_issues_created_at ON stata_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stata_issues_command ON stata_issues(command);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_verified ON comments(is_verified_fix);

-- Point ledger indexes
CREATE INDEX IF NOT EXISTS idx_point_ledger_user_id ON point_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_point_ledger_created_at ON point_ledger(created_at DESC);

-- ==============================================
-- 3. ENABLE ROW LEVEL SECURITY (OPTIONAL)
-- ==============================================
-- Uncomment if you want to use RLS

-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stata_issues ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 4. CREATE RLS POLICIES (OPTIONAL)
-- ==============================================
-- Uncomment and adjust based on your security requirements

-- Profiles policies
-- CREATE POLICY "Public profiles are viewable by everyone"
--   ON profiles FOR SELECT
--   USING (true);

-- CREATE POLICY "Users can insert their own profile"
--   ON profiles FOR INSERT
--   WITH CHECK (true);

-- CREATE POLICY "Users can update own profile"
--   ON profiles FOR UPDATE
--   USING (true);

-- STATA Issues policies
-- CREATE POLICY "Issues are viewable by everyone"
--   ON stata_issues FOR SELECT
--   USING (true);

-- CREATE POLICY "Authenticated users can create issues"
--   ON stata_issues FOR INSERT
--   WITH CHECK (true);

-- CREATE POLICY "Users can update own issues"
--   ON stata_issues FOR UPDATE
--   USING (true);

-- CREATE POLICY "Users can delete own issues"
--   ON stata_issues FOR DELETE
--   USING (true);

-- Comments policies
-- CREATE POLICY "Comments are viewable by everyone"
--   ON comments FOR SELECT
--   USING (true);

-- CREATE POLICY "Authenticated users can create comments"
--   ON comments FOR INSERT
--   WITH CHECK (true);

-- CREATE POLICY "Users can update own comments"
--   ON comments FOR UPDATE
--   USING (true);

-- CREATE POLICY "Users can delete own comments"
--   ON comments FOR DELETE
--   USING (true);

-- Point ledger policies
-- CREATE POLICY "Point ledger is viewable by everyone"
--   ON point_ledger FOR SELECT
--   USING (true);

-- CREATE POLICY "System can insert points"
--   ON point_ledger FOR INSERT
--   WITH CHECK (true);

-- ==============================================
-- 5. MIGRATE EXISTING DATA (OPTIONAL)
-- ==============================================
-- Only run this if you have existing data to migrate

-- Migrate users to profiles
-- INSERT INTO profiles (id, username, password_hash, cumulative_points)
-- SELECT id, username, password_hash, 0 
-- FROM users
-- ON CONFLICT (username) DO NOTHING;

-- Note: Cannot automatically migrate polipions to stata_issues
-- due to different schema. Manual mapping required if needed.

-- ==============================================
-- 6. CREATE HELPFUL VIEWS (OPTIONAL)
-- ==============================================

-- View: User statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  p.id,
  p.username,
  p.cumulative_points,
  COUNT(DISTINCT si.id) as total_issues,
  COUNT(DISTINCT c.id) as total_comments,
  COUNT(DISTINCT CASE WHEN si.is_resolved = true THEN si.id END) as resolved_issues,
  COUNT(DISTINCT CASE WHEN c.is_verified_fix = true THEN c.id END) as verified_fixes
FROM profiles p
LEFT JOIN stata_issues si ON si.user_id = p.id
LEFT JOIN comments c ON c.user_id = p.id
GROUP BY p.id, p.username, p.cumulative_points;

-- View: Issue details with comment count
CREATE OR REPLACE VIEW issue_details AS
SELECT 
  si.*,
  COUNT(c.id) as comment_count,
  (SELECT c2.id FROM comments c2 WHERE c2.issue_id = si.id AND c2.is_verified_fix = true LIMIT 1) as verified_fix_comment_id
FROM stata_issues si
LEFT JOIN comments c ON c.issue_id = si.id
GROUP BY si.id;

-- ==============================================
-- 7. STORAGE POLICIES (REQUIRED FOR IMAGE UPLOADS)
-- ==============================================
-- These policies allow public uploads/deletes for the issue-images bucket.
-- Run in Supabase SQL editor (Storage uses the storage.objects table).

-- Allow anyone to read objects from the public bucket
DROP POLICY IF EXISTS "Public read for issue images" ON storage.objects;
CREATE POLICY "Public read for issue images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-images');

-- Allow anyone (anon key) to upload to the bucket
DROP POLICY IF EXISTS "Public upload for issue images" ON storage.objects;
CREATE POLICY "Public upload for issue images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-images');

-- Allow anyone (anon key) to delete from the bucket
DROP POLICY IF EXISTS "Public delete for issue images" ON storage.objects;
CREATE POLICY "Public delete for issue images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'issue-images');

-- ==============================================
-- SETUP COMPLETE
-- ==============================================
-- Next steps:
-- 1. Verify all tables were created successfully
-- 2. Test inserting sample data
-- 3. Update your application to use the new schema
-- 4. Consider enabling RLS for production use
