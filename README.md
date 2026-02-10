# StataFix

StataFix is a class‑focused platform for sharing, discussing, and solving Stata issues. It combines a discussion forum with points, voting, and verified fixes, backed by Supabase Auth, Postgres, and Storage.

## What’s In This Repo

StataFix is a refactor of the Polipine project into a Stata issue‑tracking and discussion app. The frontend is React (Vite), and the backend is Supabase (Auth, Postgres, Storage).

## Features

- Email‑based authentication with Supabase Auth
- Email verification required
- Forgot password and reset password flow
- Public issue feed and public comments
- User‑owned edit/delete rules enforced by RLS
- Voting on issues and comments
- Points system with automatic ledger and profile totals
- Image uploads to Supabase Storage

## Tech Stack

- React + Vite
- Supabase Auth
- Supabase Postgres
- Supabase Storage

## Local Development

1. Install dependencies.
2. Run the dev server.

```bash
npm install
npm run dev
```

Your local URL will be shown in the terminal, typically `http://localhost:5173`.

## App Routes

- `/` Home
- `/login` Login
- `/register` Register
- `/forgot-password` Request reset
- `/reset-password` Set new password
- `/polipions` Issue feed (protected)
- `/polipion/:id` Issue details (protected)
- `/new` Create issue (protected)
- `/edit/:id` Edit issue (protected)
- `/my-polipions` My issues (protected)
- `/leaderboard` Leaderboard (protected)

## Supabase Setup (Short Version)

1. Run the SQL in `SUPABASE_SETUP.sql` in the Supabase SQL Editor.
2. Create a Storage bucket named `issue-images`.
3. In the Supabase Auth settings:
   - Enable email confirmation.
   - Set redirect URLs (see next section).

For the full backend setup, read `SUPABASE_BACKEND_README.md`.

## Redirect URLs Explained

Supabase needs to know which URLs it can redirect back to after email verification or password reset.

Use your dev URL from Vite. Example:

- Site URL: `http://localhost:5173`
- Additional Redirect URLs:
  - `http://localhost:5173`
  - `http://localhost:5173/reset-password`

When you deploy, add your production domain and `https://your-domain/reset-password`.

## Project Notes

- All writes are protected by Row Level Security.
- Points are awarded by database functions, not by client updates.
- Images are stored in the `issue-images` bucket.

## License

Copyright [2025] [Anubhav Dhungana]

Licensed under the Apache License, Version 2.0.
