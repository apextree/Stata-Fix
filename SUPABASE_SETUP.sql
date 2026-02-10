-- StataFix Database Setup Script (Supabase Auth + RLS)
-- WARNING: This script drops existing data.
-- Run this in your Supabase SQL Editor.

-- ==============================================
-- 0. EXTENSIONS
-- ==============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- 1. DROP VIEWS, FUNCTIONS, TRIGGERS, TABLES
-- ==============================================
DROP VIEW IF EXISTS stata_issues_hot;
DROP VIEW IF EXISTS user_stats;
DROP VIEW IF EXISTS issue_details;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_point_ledger_insert ON public.point_ledger;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.apply_points_change();
DROP FUNCTION IF EXISTS public.award_points_for_issue_post();
DROP FUNCTION IF EXISTS public.award_points_for_comment(uuid);
DROP FUNCTION IF EXISTS public.award_points_for_accepted_fix(uuid);
DROP FUNCTION IF EXISTS public.vote_issue(uuid, text);
DROP FUNCTION IF EXISTS public.vote_comment(uuid, text);

DROP TABLE IF EXISTS public.user_votes CASCADE;
DROP TABLE IF EXISTS public.point_ledger CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.stata_issues CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==============================================
-- 2. CREATE TABLES
-- ==============================================

-- Profiles: one row per auth user
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  cumulative_points BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STATA Issues
CREATE TABLE public.stata_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  title TEXT,
  command TEXT NOT NULL,
  error_category TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES public.stata_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  is_verified_fix BOOLEAN DEFAULT FALSE,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point ledger
CREATE TABLE public.point_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User votes (issues + comments)
CREATE TABLE public.user_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('issue', 'comment')),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id, target_type)
);

-- ==============================================
-- 3. INDEXES
-- ==============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(cumulative_points DESC);

-- STATA Issues indexes
CREATE INDEX IF NOT EXISTS idx_stata_issues_user_id ON public.stata_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_stata_issues_is_resolved ON public.stata_issues(is_resolved);
CREATE INDEX IF NOT EXISTS idx_stata_issues_created_at ON public.stata_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stata_issues_command ON public.stata_issues(command);
CREATE INDEX IF NOT EXISTS idx_stata_issues_upvotes ON public.stata_issues(upvotes DESC);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON public.comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_verified ON public.comments(is_verified_fix);
CREATE INDEX IF NOT EXISTS idx_comments_upvotes ON public.comments(upvotes DESC);

-- Point ledger indexes
CREATE INDEX IF NOT EXISTS idx_point_ledger_user_id ON public.point_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_point_ledger_created_at ON public.point_ledger(created_at DESC);

-- User votes indexes
CREATE INDEX IF NOT EXISTS idx_user_votes_user_id ON public.user_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_target ON public.user_votes(target_id, target_type);

-- ==============================================
-- 4. FUNCTIONS + TRIGGERS
-- ==============================================

-- Create profile row after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, cumulative_points)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-apply point changes to profiles
CREATE OR REPLACE FUNCTION public.apply_points_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET cumulative_points = COALESCE(cumulative_points, 0) + NEW.points_change
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_point_ledger_insert
AFTER INSERT ON public.point_ledger
FOR EACH ROW EXECUTE PROCEDURE public.apply_points_change();

-- Award points for creating an issue
CREATE OR REPLACE FUNCTION public.award_points_for_issue_post()
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.point_ledger (user_id, points_change, reason)
  VALUES (auth.uid(), 5, 'POST_ERROR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Award points for commenting on an issue (not your own)
CREATE OR REPLACE FUNCTION public.award_points_for_comment(issue_id UUID)
RETURNS VOID AS $$
DECLARE
  issue_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO issue_owner
  FROM public.stata_issues
  WHERE id = issue_id;

  IF issue_owner IS NULL THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF issue_owner = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.point_ledger (user_id, points_change, reason)
  VALUES (auth.uid(), 3, 'SUGGESTION');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Award points for accepted fix (issue owner awards to commenter)
CREATE OR REPLACE FUNCTION public.award_points_for_accepted_fix(comment_id UUID)
RETURNS VOID AS $$
DECLARE
  comment_user UUID;
  issue_owner UUID;
  issue_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, issue_id INTO comment_user, issue_id
  FROM public.comments
  WHERE id = comment_id;

  IF issue_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  SELECT user_id INTO issue_owner
  FROM public.stata_issues
  WHERE id = issue_id;

  IF issue_owner IS NULL THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF issue_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Only the issue owner can award points';
  END IF;

  INSERT INTO public.point_ledger (user_id, points_change, reason)
  VALUES (comment_user, 5, 'ACCEPTED_FIX');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Vote on an issue (toggles and updates counts)
CREATE OR REPLACE FUNCTION public.vote_issue(issue_id UUID, vote_type TEXT)
RETURNS VOID AS $$
DECLARE
  current_vote TEXT;
  delta_up INT := 0;
  delta_down INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF vote_type NOT IN ('upvote', 'downvote') THEN
    RAISE EXCEPTION 'Invalid vote type';
  END IF;

  SELECT uv.vote_type INTO current_vote
  FROM public.user_votes uv
  WHERE uv.user_id = auth.uid()
    AND uv.target_id = issue_id
    AND uv.target_type = 'issue';

  IF current_vote = vote_type THEN
    -- Remove existing vote
    DELETE FROM public.user_votes
    WHERE user_id = auth.uid()
      AND target_id = issue_id
      AND target_type = 'issue';

    IF vote_type = 'upvote' THEN
      delta_up := -1;
    ELSE
      delta_down := -1;
    END IF;
  ELSE
    -- Upsert new vote
    INSERT INTO public.user_votes (user_id, target_id, target_type, vote_type)
    VALUES (auth.uid(), issue_id, 'issue', vote_type)
    ON CONFLICT (user_id, target_id, target_type)
    DO UPDATE SET vote_type = EXCLUDED.vote_type;

    IF current_vote = 'upvote' THEN
      delta_up := delta_up - 1;
    ELSIF current_vote = 'downvote' THEN
      delta_down := delta_down - 1;
    END IF;

    IF vote_type = 'upvote' THEN
      delta_up := delta_up + 1;
    ELSE
      delta_down := delta_down + 1;
    END IF;
  END IF;

  UPDATE public.stata_issues
  SET upvotes = GREATEST(0, upvotes + delta_up),
      downvotes = GREATEST(0, downvotes + delta_down)
  WHERE id = issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Vote on a comment (toggles and updates counts)
CREATE OR REPLACE FUNCTION public.vote_comment(comment_id UUID, vote_type TEXT)
RETURNS VOID AS $$
DECLARE
  current_vote TEXT;
  delta_up INT := 0;
  delta_down INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF vote_type NOT IN ('upvote', 'downvote') THEN
    RAISE EXCEPTION 'Invalid vote type';
  END IF;

  SELECT uv.vote_type INTO current_vote
  FROM public.user_votes uv
  WHERE uv.user_id = auth.uid()
    AND uv.target_id = comment_id
    AND uv.target_type = 'comment';

  IF current_vote = vote_type THEN
    -- Remove existing vote
    DELETE FROM public.user_votes
    WHERE user_id = auth.uid()
      AND target_id = comment_id
      AND target_type = 'comment';

    IF vote_type = 'upvote' THEN
      delta_up := -1;
    ELSE
      delta_down := -1;
    END IF;
  ELSE
    -- Upsert new vote
    INSERT INTO public.user_votes (user_id, target_id, target_type, vote_type)
    VALUES (auth.uid(), comment_id, 'comment', vote_type)
    ON CONFLICT (user_id, target_id, target_type)
    DO UPDATE SET vote_type = EXCLUDED.vote_type;

    IF current_vote = 'upvote' THEN
      delta_up := delta_up - 1;
    ELSIF current_vote = 'downvote' THEN
      delta_down := delta_down - 1;
    END IF;

    IF vote_type = 'upvote' THEN
      delta_up := delta_up + 1;
    ELSE
      delta_down := delta_down + 1;
    END IF;
  END IF;

  UPDATE public.comments
  SET upvotes = GREATEST(0, upvotes + delta_up),
      downvotes = GREATEST(0, downvotes + delta_down)
  WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================
-- 5. ENABLE RLS + POLICIES
-- ==============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stata_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_votes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- STATA Issues policies
DROP POLICY IF EXISTS "Issues are viewable by everyone" ON public.stata_issues;
CREATE POLICY "Issues are viewable by everyone"
  ON public.stata_issues FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create issues" ON public.stata_issues;
CREATE POLICY "Users can create issues"
  ON public.stata_issues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own issues" ON public.stata_issues;
CREATE POLICY "Users can update own issues"
  ON public.stata_issues FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own issues" ON public.stata_issues;
CREATE POLICY "Users can delete own issues"
  ON public.stata_issues FOR DELETE
  USING (auth.uid() = user_id);

-- Comments policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
CREATE POLICY "Users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments or issue owner" ON public.comments;
CREATE POLICY "Users can update own comments or issue owner"
  ON public.comments FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT user_id FROM public.stata_issues WHERE id = issue_id)
  );

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Point ledger policies (no direct inserts)
DROP POLICY IF EXISTS "Users can view own ledger" ON public.point_ledger;
CREATE POLICY "Users can view own ledger"
  ON public.point_ledger FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct point inserts" ON public.point_ledger;
CREATE POLICY "No direct point inserts"
  ON public.point_ledger FOR INSERT
  WITH CHECK (false);

-- User votes policies
DROP POLICY IF EXISTS "Users can read own votes" ON public.user_votes;
CREATE POLICY "Users can read own votes"
  ON public.user_votes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own votes" ON public.user_votes;
CREATE POLICY "Users can insert own votes"
  ON public.user_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own votes" ON public.user_votes;
CREATE POLICY "Users can update own votes"
  ON public.user_votes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own votes" ON public.user_votes;
CREATE POLICY "Users can delete own votes"
  ON public.user_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================
-- 6. STORAGE POLICIES (ISSUE IMAGES)
-- ==============================================

-- Make sure the bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'issue-images';

-- Allow public read
DROP POLICY IF EXISTS "Public read for issue images" ON storage.objects;
CREATE POLICY "Public read for issue images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-images');

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Authenticated upload for issue images" ON storage.objects;
CREATE POLICY "Authenticated upload for issue images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'issue-images'
    AND auth.role() = 'authenticated'
    AND name LIKE auth.uid() || '/%'
  );

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "Authenticated delete for issue images" ON storage.objects;
CREATE POLICY "Authenticated delete for issue images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'issue-images'
    AND auth.role() = 'authenticated'
    AND name LIKE auth.uid() || '/%'
  );

-- ==============================================
-- 7. OPTIONAL VIEWS
-- ==============================================

CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
  p.id,
  p.username,
  p.cumulative_points,
  COUNT(DISTINCT si.id) as total_issues,
  COUNT(DISTINCT c.id) as total_comments,
  COUNT(DISTINCT CASE WHEN si.is_resolved = true THEN si.id END) as resolved_issues,
  COUNT(DISTINCT CASE WHEN c.is_verified_fix = true THEN c.id END) as verified_fixes
FROM public.profiles p
LEFT JOIN public.stata_issues si ON si.user_id = p.id
LEFT JOIN public.comments c ON c.user_id = p.id
GROUP BY p.id, p.username, p.cumulative_points;

CREATE OR REPLACE VIEW public.issue_details AS
SELECT 
  si.*,
  COUNT(c.id) as comment_count,
  (SELECT c2.id FROM public.comments c2 WHERE c2.issue_id = si.id AND c2.is_verified_fix = true LIMIT 1) as verified_fix_comment_id
FROM public.stata_issues si
LEFT JOIN public.comments c ON c.issue_id = si.id
GROUP BY si.id;

CREATE OR REPLACE VIEW public.stata_issues_hot AS
SELECT 
  si.*,
  COUNT(c.id) as comment_count,
  (si.upvotes - si.downvotes + COUNT(c.id) * 2) as hot_score
FROM public.stata_issues si
LEFT JOIN public.comments c ON c.issue_id = si.id
GROUP BY si.id
ORDER BY hot_score DESC;

-- ==============================================
-- SETUP COMPLETE
-- ==============================================
