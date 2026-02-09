# StataFix Migration Guide

## Overview
This guide documents the transformation from "Polipine" (political opinion sharing platform) to "StataFix" (gamified STATA debugger).

## Database Schema Changes Required

### 1. Create New Tables in Supabase

You need to create the following tables in your Supabase database:

#### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cumulative_points BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for username lookups
CREATE INDEX idx_profiles_username ON profiles(username);
```

#### Table: `stata_issues`
```sql
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

-- Add indexes
CREATE INDEX idx_stata_issues_user_id ON stata_issues(user_id);
CREATE INDEX idx_stata_issues_is_resolved ON stata_issues(is_resolved);
CREATE INDEX idx_stata_issues_created_at ON stata_issues(created_at DESC);
```

#### Table: `comments`
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID REFERENCES stata_issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  is_verified_fix BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_comments_issue_id ON comments(issue_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
```

#### Table: `point_ledger`
```sql
CREATE TABLE point_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_point_ledger_user_id ON point_ledger(user_id);
CREATE INDEX idx_point_ledger_created_at ON point_ledger(created_at DESC);
```

### 2. Migrate Existing Data (Optional)

If you want to preserve existing data from the `users` and `polipions` tables:

```sql
-- Migrate users to profiles
INSERT INTO profiles (id, username, password_hash, cumulative_points)
SELECT id, username, password_hash, 0 
FROM users;

-- Note: You cannot directly migrate polipions to stata_issues 
-- because the schema is fundamentally different.
-- You would need to decide how to map:
-- - politician_name -> command
-- - party -> error_category
-- - user_opinion -> description
```

### 3. Enable Row Level Security (RLS) - Recommended

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stata_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;

-- Create policies (example - adjust based on your needs)
-- Profiles: Users can read all, but only update their own
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- STATA Issues: Everyone can read, authenticated users can create
CREATE POLICY "Issues are viewable by everyone"
  ON stata_issues FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create issues"
  ON stata_issues FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own issues"
  ON stata_issues FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own issues"
  ON stata_issues FOR DELETE
  USING (user_id = auth.uid());

-- Similar policies for comments and point_ledger
```

## Key Application Changes

### 1. Authentication System
- **Old**: Used `users` table with `localStorage` key `polipine_user`
- **New**: Uses `profiles` table with `localStorage` key `statafix_user`
- **Change**: User object now includes `cumulative_points`

### 2. Data Model Transformation

#### Old Schema (Polipions)
- `post_title`, `politician_name`, `party`, `country`, `user_opinion`
- Comments stored as JSON array in `all_comments`
- Likes/dislikes tracked with `post_likes`, `post_dislikes`

#### New Schema (STATA Issues)
- `command`, `error_category`, `description`
- Comments stored in separate `comments` table
- No voting system, replaced with gamification points
- Added `is_resolved` flag

### 3. Gamification System

#### Point Awards
- **Post Error**: +5 points (when creating a STATA issue)
- **Suggest Solution**: +3 points (when adding a comment)
- **Accepted Fix**: +5 points (when comment is marked as "The Fix" by issue author)

#### Point Tracking
- All point changes logged in `point_ledger` table
- User's total shown in `profiles.cumulative_points`
- Leaderboard shows top 50 users by cumulative points

### 4. New Features

#### Leaderboard Page
- Route: `/leaderboard`
- Displays top contributors by cumulative points
- Shows point earning guide
- Medal icons for top 3 users

#### Mark as The Fix
- Only issue author can mark a comment as the verified fix
- Marks issue as resolved (`is_resolved = true`)
- Awards +5 points to the comment author
- Visual indicators for resolved issues and verified fixes

### 5. UI/UX Changes

#### Theme Colors (Academic Palette)
- **Light Mode**:
  - Primary: Indigo-600 (#4f46e5)
  - Text: Slate-800 (#1e293b)
  - Background: Gray-50 (#f9fafb)
  
- **Dark Mode**:
  - Primary: Indigo-400 (#6366f1)
  - Text: Slate-100 (#f1f5f9)
  - Background: Slate-900 (#0f172a)

#### Icons Changed
- Political icons (🗳️🏛️) → Technical icons (💻📊🔍📈)
- Updated all navigation icons to be more technical/academic

#### Branding
- "Polipine" → "StataFix"
- "Political Opinion" → "STATA Issue/Error"
- "Share Opinion" → "Report Error"
- "All Polipions" → "Browse Issues"

## Files Modified

### Core Files
1. `src/context/AuthContext.jsx` - Updated to use profiles table
2. `src/styles/theme.css` - New academic color palette
3. `package.json` - Updated name to "statafix"
4. `index.html` - Updated title and meta description

### Pages
5. `src/pages/CreatePolipion.jsx` - Now creates STATA issues with point logic
6. `src/pages/PolipionDetails.jsx` - Comments table integration + "Mark as Fix"
7. `src/pages/SeePolipions.jsx` - Search by command/description
8. `src/pages/MyPolipions.jsx` - Display user's STATA issues
9. `src/pages/EditPolipion.jsx` - Edit STATA issues
10. `src/pages/Home.jsx` - StataFix branding
11. `src/pages/Leaderboard.jsx` - NEW: Leaderboard page
12. `src/pages/Leaderboard.css` - NEW: Leaderboard styles

### Components
13. `src/components/card.jsx` - Display command, error_category, resolved status
14. `src/components/Sidebar.jsx` - StataFix branding, leaderboard link, technical icons

### Routing
15. `src/App.jsx` - Added leaderboard route

## Testing Checklist

After setting up the database:

- [ ] Register a new user (should create profile with 0 points)
- [ ] Login with the new user
- [ ] Create a STATA issue (should award +5 points)
- [ ] Add a comment to an issue (should award +3 points)
- [ ] Mark a comment as "The Fix" as issue author (should award +5 points to commenter)
- [ ] View leaderboard (should show users ranked by points)
- [ ] Search for issues by command
- [ ] Search for issues by description
- [ ] Edit your own issue
- [ ] Delete your own issue
- [ ] Verify resolved issues show green badge
- [ ] Check that points display in sidebar
- [ ] Test dark/light theme toggle

## Known Issues & Considerations

1. **User Migration**: Existing users in the `users` table need to be migrated to `profiles` table
2. **Password Reset**: No password reset functionality (pseudo-auth limitation)
3. **Image Upload**: Still uses URL input (no file upload)
4. **Real-time Updates**: Comments/points don't update in real-time without refresh
5. **Point Validation**: No server-side validation to prevent point manipulation (would need Supabase functions/triggers)

## Next Steps

1. Create the database tables in Supabase using the SQL above
2. Migrate existing users if needed
3. Test all functionality with the new schema
4. Consider adding server-side validation for points (Supabase Edge Functions)
5. Add real-time subscriptions for live updates
6. Implement proper error handling and loading states
