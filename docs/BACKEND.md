# Backend and service integration

Screens import interfaces or the configured `services` object from `src/services`.
They do not import a database client. The default `local` adapter stores the seeded
Maple House demo in AsyncStorage, so the core flow remains usable offline and after
an app restart.

## Configuration boundary

Copy `.env.example` to `.env` and keep the file untracked. Supported values are:

- `EXPO_PUBLIC_DATA_SOURCE=local` (default): no account or network required.
- `EXPO_PUBLIC_DATA_SOURCE=supabase`: also requires the project URL and the public
  anonymous/publishable key.

Validate the selected mode with `npm run check:env`. Expo public variables are
embedded in the app binary. Never expose a Supabase service-role key, database
password, or signing credential through an `EXPO_PUBLIC_` variable.

Supabase mode creates and refreshes an anonymous Supabase session in AsyncStorage.
An integration with a different auth/session layer can instead pass `getAccessToken`
to `createServices`. Anonymous sign-ins must be enabled in the Supabase project's
Auth settings. This explicit boundary prevents an unconfigured hosted backend from
breaking the local demo.

## Database setup

The migration in `supabase/migrations` creates the five planned tables, indexes,
constraints, RLS policies, and transactional RPCs. `supabase/seed.sql` creates the
same four-member, eight-chore Maple House story as the local adapter (`MAPLE4`).

With the Supabase CLI and Docker installed:

```bash
supabase start
supabase db reset
```

For a hosted project, link it deliberately and review the target before pushing:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push --linked --include-seed
```

`--include-seed` is required for the hosted `MAPLE4` demo household. In the
Supabase dashboard, enable **Authentication → Allow anonymous sign-ins** before
testing. The project must use the same public URL and publishable/anon key in its
EAS `preview` and `production` environments:

```text
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

Run `npm run check:env` followed by `npm run verify:hosted`. The verifier uses
only those public values and creates temporary anonymous users. It checks that an
unjoined user cannot read a household, then exercises create, join, the seeded
demo, completion idempotency, pulse upsert, and the user-scoped reset RPC. It
leaves a uniquely named verification household behind because the client-facing
roles intentionally cannot delete households.

The access model is intentionally narrow:

- authenticated (including anonymous) users can read only households they joined;
- invite-code lookup and joining happen in a controlled security-definer function;
- only the household creator can change chores;
- chore completion is atomic, credits the acting member, and deduplicates retries;
- pulse writes are limited to the acting member and a score range of 1–5;
- demo reset deletes only the acting user's completions and pulse responses.

Seed identities have no Supabase user attached. Joining `MAPLE4` creates a separate
member linked to the anonymous user, while still allowing that user to see the
seeded household story.
