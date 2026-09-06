# Shared chore backend

The app selects local or Supabase persistence in `src/services/index.ts`.
The chore board, completion history and Balance all use the selected services.

## Deployment

1. Reconcile this branch with current main and review the SQL migration.
2. Apply any unapplied files in `supabase/migrations` in filename order to the
   intended linked Supabase project using the team's database migration workflow.
   Completion undo requires `202609060007_undo_chore_completion.sql`. Do not
   rerun the initial schema against an existing database.
3. Configure `EXPO_PUBLIC_DATA_SOURCE=supabase`, `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the local/EAS environment. Anonymous auth
   must be enabled. Never put a service-role key in Expo public configuration.
4. Run `npm run typecheck`, `npm test`, and `npm run verify:hosted` with the public
   hosted configuration. The hosted script creates temporary verification users
   and a household, and exercises creation, votes, edits, completion and totals.
5. On two devices, join the same household. Create a recurring chore, approve it
   as the second member, edit it, and approve the edit. Complete it and check the
   completer's points in Balance. Refresh/reopen both devices. Delete another
   active chore and approve the deletion; prior earned points must remain.

Deployment is not performed merely by starting Expo. Without hosted configuration,
the app remains in persistent local mode and data is not shared across devices.

## Database checks without a hosted project

`scripts/verify-chore-database.mjs` runs the actual migrations against a disposable
PGlite PostgreSQL instance, with a small auth-schema fixture. Install
`@electric-sql/pglite` in a temporary directory, then run:

```text
node scripts/verify-chore-database.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
```

The test removes only the unsupported `pgcrypto` extension declaration from the
initial migration; PostgreSQL's built-in UUID generator is used. It checks RPC
permissions, two-member approval, stale versions, multi-assignee writes, recurring
occurrences, archiving, duplicate completion requests and per-member totals.
This verifies SQL behavior, not hosted auth/network/device configuration.

## Data ownership

- Chore mutations go through `request_chore_change` and `vote_chore_change`.
  Client-provided member identities are not trusted; the actor comes from
  `auth.uid()` and household membership.
- `get_chore_board` returns chores, awards, settings and pending requests and
  materializes eligible next occurrences transactionally.
- `complete_chore` awards the first completion only. `undo_chore_completion`
  lets only the completing member remove that award and restore the occurrence,
  rolling back only an untouched generated successor when needed. Points belong to the member
  who completes the chore, including when multiple people are assigned.
- `member_point_totals` derives totals from saved awards. It is a security-invoker
  view so each caller retains the underlying membership visibility rules.
- Direct chore insert/update/delete grants are revoked. Private write helpers
  are not executable by client roles. Historical legacy columns are retained for
  compatibility; the new structured schedule and assignment table are authoritative.

The next occurrence uses UTC calendar arithmetic; monthly schedules clamp to the
last valid day of the destination month. Refresh-on-read avoids a background job.
New hosted households start empty; existing seeded household data remains intact.
