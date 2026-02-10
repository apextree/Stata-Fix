# StataFix Backend (Supabase) – Detailed Guide

This document explains the Supabase backend setup in detail. It is written for non‑experts and uses step‑by‑step instructions.

## What This Setup Does

- Enables real authentication with email and password
- Requires email verification before login
- Adds password reset flow
- Enforces Row Level Security (RLS) on all tables
- Stores issue images in Supabase Storage
- Awards points via database functions (not by the client)

## Step 1: Authentication Settings

1. Open the Supabase Dashboard.
2. Go to **Authentication** → **Providers** → **Email**.
3. Turn on **Confirm email** (email verification required).

## Step 2: Redirect URLs

Supabase sends email links (verification and reset). After the user clicks, Supabase redirects back to your app. It only allows redirects that you explicitly list.

1. Go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to your dev URL, usually `http://localhost:5173`.
3. Add **Additional Redirect URLs**:
   - `http://localhost:5173`
   - `http://localhost:5173/reset-password`

When you deploy, add your production URL and production reset URL.

## Step 3: Run the SQL Setup Script

This will **drop all existing data** and recreate everything with RLS and functions.

1. Go to **SQL Editor** in Supabase.
2. Open the file `SUPABASE_SETUP.sql` in this repo.
3. Paste it into the SQL Editor and run it.

## Step 4: Storage Bucket

1. Go to **Storage**.
2. Create a bucket named `issue-images`.
3. Make sure the bucket is **Public**.

The SQL script also enforces:
- Public read for images
- Authenticated users can upload only to their own folder
- Authenticated users can delete only their own files

Image paths are stored as `userId/filename`.

## Database Schema (Tables)

- `profiles`
  - Linked 1‑to‑1 with `auth.users`
  - Stores `username` and `cumulative_points`

- `stata_issues`
  - Stores issue content and metadata
  - Fields include `user_id`, `username`, `title`, `description`, `image_url`

- `comments`
  - Stores comment text and verified fix flags

- `point_ledger`
  - Append‑only record of point changes

- `user_votes`
  - Tracks a user’s vote on issues or comments

## RLS Policies (Summary)

RLS is enabled for all tables. Policies enforce:

- `profiles`
  - Public read
  - Only the owner can update

- `stata_issues`
  - Public read
  - Only the owner can insert, update, or delete

- `comments`
  - Public read
  - Only the owner can insert or delete
  - Owner or issue author can update (used for “verified fix”)

- `point_ledger`
  - Only the owner can read their own entries
  - No direct inserts from the client

- `user_votes`
  - Users can only read, insert, update, and delete their own votes

## Database Functions (RPC)

These functions are called from the app instead of direct inserts.

- `award_points_for_issue_post()`
  - Adds +5 points when a user posts an issue

- `award_points_for_comment(issue_id UUID)`
  - Adds +3 points when a user comments on someone else’s issue

- `award_points_for_accepted_fix(comment_id UUID)`
  - Adds +5 points to the commenter when the issue owner marks a fix

- `vote_issue(issue_id UUID, vote_type TEXT)`
  - Handles issue voting and keeps counts consistent

- `vote_comment(comment_id UUID, vote_type TEXT)`
  - Handles comment voting and keeps counts consistent

## Triggers

- `handle_new_user`
  - Creates a row in `profiles` when a new auth user registers

- `apply_points_change`
  - Automatically updates `profiles.cumulative_points` whenever a row is inserted into `point_ledger`

## Common Issues and Fixes

- **“new row violates row‑level security policy”**
  - RLS is enabled but no policy allows the operation
  - Verify the policies or use the RPC functions instead

- **“Bucket not found” for public image URL**
  - The bucket is not public in the database
  - Run:
    - `update storage.buckets set public = true where id = 'issue-images';`

- **Images upload but do not display**
  - Ensure the image URL is a public URL
  - The app normalizes signed URLs to public URLs

## How the App Uses Supabase

- Auth uses Supabase Auth session
- Profiles are read from `profiles`
- Posts and comments are public read
- Writes are protected by RLS and use RPC where needed

## File References

- SQL setup: `SUPABASE_SETUP.sql`
- Supabase client config: `src/client.js`
- Auth context: `src/context/AuthContext.jsx`
- Auth pages: `src/pages/Login.jsx`, `src/pages/Register.jsx`, `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`
