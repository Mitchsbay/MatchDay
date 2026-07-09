# Claude Handoff — Admin Auth + Cross-Device Recovery Sync (post-P45)

Base before this cycle: your P45 delivery (P30–P45, advanced data calibration), reviewed and
confirmed clean — nothing needed patching on the football side that round. Everything below is
new work done directly with Mitchel since then, on top of that same P45 base. You haven't seen any
of this yet.

Standing items tracked (all still true, verified this cycle too):

- Tennis Quality/Form/Serve/Surface/H2H gates
- Alias-priority fix
- P28 probability rounding fix
- Public npm lockfile guard

Two new standing items as of this cycle — see below for detail:

- Whole-app admin login gate (client + server-side)
- Recovery vault mirrors to Supabase (with an anti-nesting constraint — read this one before
  touching `lib/workspace.ts`, `lib/workspaceBackupVault.ts`, or either workspace-sync hook)

---

## New — Whole-App Admin Login

### What changed

The app previously had no access control at all beyond an optional Supabase magic-link sign-in
that only gated cloud sync — every tab and every feature was reachable by anyone with the URL,
including tennis predictions that consume a metered 50-requests/day external API key.

Replaced with a single-admin model, MS-AES-style: one user, created manually in the Supabase
dashboard (Authentication → Users → Add user, email + password, no self-service sign-up). The
entire app is gated behind that one login — nothing renders, on any tab, until signed in.

Added:

- `components/AuthGatePanel.tsx` — the login screen. Also handles a distinct "signed in, but not
  the admin account" state, in case public sign-ups ever get left on by mistake.
- `lib/serverAuth.ts` — `verifyRequestSession(req)`, checks a request's Supabase JWT against
  `NEXT_PUBLIC_ADMIN_EMAIL` server-side.

Changed:

- `hooks/useSupabaseAuth.ts` — now exposes `isAdmin`, `signInWithPassword`, `loginEmail`/`loginPassword`
  state. The old magic-link flow is gone entirely.
- `app/page.tsx` — early-returns to `<AuthGatePanel>` whenever `supabase && !isAdmin`. Also added a
  small "Signed in as X · Sign out" control in the header, since there's no other reason to reach
  the Data & Import tab just to sign out anymore.
- `components/WorkspacePanels.tsx` — `CloudSyncPanel` had its own redundant magic-link form removed,
  since sign-in only happens once now, at the app gate.
- `app/api/tennis/players/route.ts` and `app/api/tennis/matchup/route.ts` — both now call
  `verifyRequestSession` and return 401 if it fails. **This is the part that actually matters most**:
  a client-side-only gate doesn't stop someone who bypasses the browser and curls these routes
  directly. Verified they were genuinely unprotected before this.
- `components/TennisPanels.tsx` — sends `Authorization: Bearer <access_token>` on both requests now.

### Why

Mitchel realized anyone with the deployed link had full access, including the ability to burn his
tennis API quota anonymously. Checked Vercel's own password protection first — doesn't actually
help on the Hobby plan (only protects preview URLs, not production, without a paid add-on) — so
this had to be built at the app level instead.

### Fail-open / fail-closed behavior, worth knowing if you ever touch this

- If Supabase isn't configured at all (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` unset): fails **open**.
  Otherwise nobody, including Mitchel, could ever sign in — permanent lockout with no recovery path.
- If Supabase is configured but `NEXT_PUBLIC_ADMIN_EMAIL` isn't set: fails **closed**. Unlike the
  case above, this is fixable by just setting the env var and redeploying, so there's no reason to
  let anyone in during that gap.
- Verified all of this by actually running the logic against real inputs, not just reading it.

### Required setup (not code — dashboard steps Mitchel needs to do)

1. Supabase → Authentication → Users → Add user (email + password, toggle Auto Confirm User on)
2. Supabase → Authentication → Settings → turn off "Allow new users to sign up"
3. Vercel env vars: `NEXT_PUBLIC_ADMIN_EMAIL` (required — app fails closed without it)

### Football-side impact: none, but worth knowing

Nothing on the football side needed changes for this. If you're testing locally and the app just
shows a login screen with no way in, check `NEXT_PUBLIC_ADMIN_EMAIL` and that you've created a
Supabase Auth user matching it — that's almost certainly the whole story.

Standing items: tennis gates left alone; alias-priority fix left alone; P28 rounding fix left
alone; lockfile guard left alone.

---

## New — Recovery Vault Now Mirrors to Supabase

### What changed

The P39 recovery vault (snapshots before reset/import/restore, plus periodic automatic snapshots)
was localStorage-only — if the device it lived on died or was unreachable, the vault was gone,
even though the workspace itself was safely mirrored to Supabase. Now the vault rides along with
the rest of the workspace state, so it survives losing the device.

Added: `recoverySnapshots?: WorkspaceRecoverySnapshot[]` field on `PersistedAppState`.

Changed:

- `lib/workspace.ts` — `createPersistedState(...)` takes an **optional, defaulted-to-`[]`** 10th
  param for this. Every existing call site that doesn't pass it is completely unaffected.
- `hooks/useWorkspaceAutosave.ts` — the top-level state written to the main `localStorage` key now
  carries the live vault; `exportWorkspaceBackup`'s JSON download does too now, for a genuinely
  complete backup file.
- `hooks/useWorkspaceCloudSync.ts` — the state mirrored to Supabase carries the live vault; restoring
  from Supabase now adopts whatever vault comes back with it into local state + storage.

### The constraint you need to know before touching any of this

`WorkspaceRecoverySnapshot.state` is itself a full `PersistedAppState`. Since `PersistedAppState`
now has a `recoverySnapshots` field, naively passing the *live* vault into the state used to
*create a new snapshot* would mean every snapshot recursively embeds a copy of the entire vault,
including itself — exponentially nested data, worse with every snapshot taken.

The fix: **only the top-level state — the one written to `localStorage`'s main key or mirrored to
Supabase — carries the live vault.** The state built specifically to become a new snapshot's own
`.state` must always use the default (empty) vault. This is why the autosave effect in
`useWorkspaceAutosave.ts` builds two separate state objects rather than one — don't collapse them
back into one if you're refactoring that file.

There's a smoke test (`runWorkspaceRecoveryVaultSmokeTests`) that directly proves a freshly-created
snapshot's embedded state has an empty vault — if you touch this area, that test failing is the
signal something's wrong.

### A known, deliberately-unaddressed tradeoff

"Protected" snapshots (before a reset, import, or restore) aren't capped the way automatic ones are
(automatic snapshots cap at 10; protected ones don't cap at all). That was already true when the
vault was localStorage-only; it matters more now that it's mirrored to a network database. Not
fixed in this round — flagged as a reasonable next step if the vault grows large over time, e.g.
capping protected snapshots too, or only mirroring the most recent handful.

### Football-side impact

If you ever touch `createPersistedState`, `PersistedAppState`, or anything in
`workspaceBackupVault.ts` for a football feature, re-read the constraint above first. Everything
else (fixtures, entrants, tips, aliases, tuning presets, model change log) works exactly as it did
in your P45 delivery — nothing about how those fields are stored or migrated changed.

Standing items: tennis gates left alone; alias-priority fix left alone; P28 rounding fix left
alone; lockfile guard left alone.

---

## Quick env var checklist for this repo

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required for the app to have any
  access control at all; also needed for cloud sync
- `NEXT_PUBLIC_ADMIN_EMAIL` — required, app fails closed without it once Supabase is configured
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by the football cron job
- `FOOTBALL_DATA_API_KEY`, `CRON_SECRET` — football live-fixtures automation
- `MATCHSTAT_API_KEY` — tennis, 50 requests/day free tier

Full detail and setup steps for all of these are in `.env.example`.
