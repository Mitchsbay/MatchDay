# Tipping Gates App P13

Evidence-based tipping engine with calculated gates, accuracy tracking, rule tuning, browser persistence and authenticated Supabase cloud persistence.

## What is included

- P2 Quality Gate calculator from raw team stats
- P3 Recent Form Gate calculator from last-five results
- P4 Availability Gate calculator from missing-player evidence
- P5 Context / Motivation Gate calculator
- P6 Odds / External Sanity Check Gate
- P7 Conflict + Confidence Gate upgrade
- P8 Result / Accuracy Tracking
- P9 Rule Learning Dashboard
- P10 Adjustable Rule Weights
- P11 Browser autosave, JSON export/import and reset
- P12 Optional Supabase cloud save/load by workspace ID
- P13 Supabase Auth with user-owned cloud workspaces

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel notes

This repo is root-level and Vercel-ready. Keep these files at the top of the GitHub repo:

```txt
app/
lib/
supabase/
package.json
package-lock.json
next.config.js
tsconfig.json
vercel.json
.npmrc
```

The app requests Node 24 via `package.json`.

## Supabase setup for P13

P13 does not require Supabase to run. Browser autosave still works without it.

To enable authenticated cloud save/load:

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. In Supabase Auth, make sure email sign-in / magic link is enabled.
5. In Vercel, add environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your Supabase anon public key
```

6. Redeploy the app.
7. In the P13 Supabase panel, enter your email, send a magic link, sign in, then save/load a workspace ID.

## Security note

P13 replaces the earlier public workspace-ID MVP policies with authenticated row ownership. Each row has `owner_user_id`, and RLS allows users to read/update/delete only their own workspaces.

If you already ran the P12 schema and created rows without `owner_user_id`, either delete/migrate those old rows or follow the comments in `supabase/schema.sql` before enforcing `owner_user_id not null`.
