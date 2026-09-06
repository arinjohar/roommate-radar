# Roommate Radar: two-day development plan

## 1. The product we are actually shipping

The hackathon build answers one question: **Is our household workload balanced,
and what is one kind, concrete way to improve it?**

The demo loop is deliberately small:

1. Create or join a household.
2. See this week's recurring chores.
3. Complete a chore and earn its effort points.
4. See each roommate's actual effort versus an equal expected share.
5. Submit a three-question house pulse.
6. Receive one neutral insight and one suggested swap.

Anything that does not strengthen that loop is out of scope for the two days.
That means no payments, receipt OCR, chat, landlord portal, smart-home data,
push notifications, complicated permissions, or open-ended AI mediator.

## 2. Definition of done

By the final demo:

- The app installs on at least one physical iPhone and one physical Android phone.
- A new user can create or join a four-person demo household.
- The chore list loads, a chore can be completed, and the change survives an app restart.
- The fairness dashboard updates from the saved completions.
- A user can answer cleanliness, noise, and communication pulse questions.
- The app produces a deterministic, respectful rebalance suggestion.
- Empty, loading, and recoverable error states exist for the core screens.
- A rehearsed 90-second demo can be completed even if the network becomes unreliable.

## 3. Technical shape

### Client

- Expo SDK 57, React Native, and TypeScript.
- Expo Router for a simple route structure once feature work begins.
- Keep server data access behind a small `src/services` layer; screens should not
  call a database SDK directly.
- Use React Context plus hooks for session and household state. Do not add a large
  state library during the hackathon.

### Backend

Use Supabase for email-less demo auth, Postgres data, and realtime only if it is
working early. For the lowest-friction demo, generate a persistent local guest ID
and associate it with an invite code. If auth work threatens the core loop, fall
back to seeded identities selected from the demo household.

Required tables:

| Table | Minimum fields |
| --- | --- |
| `households` | `id`, `name`, `invite_code`, `created_at` |
| `members` | `id`, `household_id`, `display_name`, `avatar_color` |
| `chores` | `id`, `household_id`, `title`, `points`, `due_at`, `recurrence`, plus assignments through member IDs |
| `completions` | `id`, `chore_id`, `member_id`, `points_awarded`, `completed_at` |
| `pulse_responses` | `id`, `household_id`, `member_id`, `week_start`, `cleanliness`, `noise`, `communication` |

The backend adds `households.created_by` and `members.user_id` to bind anonymous
Supabase users to RLS-protected household membership. Completion retry keys and
table timestamps are persistence details and do not change the client domain
contract. The app defaults to a persistent AsyncStorage adapter; Supabase is
selected only through `src/services/index.ts` after environment and auth setup.

Create one `src/types/domain.ts` file from this contract before parallel feature
work starts. IDs are strings, dates cross boundaries as ISO 8601 strings, chore
assignments cross the client boundary as `assigneeIds: string[]` (never encoded
strings), and scores are integers. Changes to shared types require a small, early
pull request.

### Shared chore workflows (September 6 update)

The configured `services.chores` API exposes board workflows alongside the
existing reads and completions. Local mode uses the unified data store and board
settings from the service cleanup; hosted mode uses authenticated Supabase RPCs.
Screens obtain this service through `src/services/index.ts`. The former standalone
`choreService.ts` remains removed.

- New chore writes accept 1–10 effort points, multiple household member IDs,
  an optional ISO due date, and structured `repeatEvery`/`repeatUnit` values.
  Legacy recurrence strings remain a compatibility/display field. When a
  repeating chore has no due date, services assign its next scheduled occurrence
  at 18:00 UTC (including the next named weekday for weekday schedules).
- `chore_assignees` stores assignments; no rows means Everyone. Existing
  single-assignee values are backfilled by the migration.
- `chore_series` retains future settings. Editing one occurrence preserves the
  series template and schedule anchor; changing recurrence requires choosing
  This and future. The next occurrence is generated on a board read once the
  preceding occurrence is completed or skipped and its next scheduled date is
  reached. At most one unfinished occurrence exists per series. There is no
  background scheduler or realtime dependency.
- Delete archives active chores. Completed chores and their awarded points are
  immutable through these workflows. Deleting This and future stops the series;
  deleting one occurrence skips it. History-window settings hide older completed
  cards without deleting the stored awards.
- `chore_board_settings` and `chore_requests` persist trust levels, saved options,
  proposed edits/deletions and votes. Open applies changes immediately; Points &
  new chores reviews new templates and point changes; Review changes reviews
  edits/deletions and changed templates. Relaxing trust needs all current members;
  stricter trust applies immediately. All policy checks run in database RPCs,
  including for the owner. Concurrent edits use versions and household locking.
- Completion is awarded once per occurrence, even across two members/devices.
  `completions.points_awarded` is the durable ledger; the RLS-protected
  `member_point_totals` view computes each member's overall total from it. Balance
  displays overall earned points alongside the existing weekly calculation.

Deploy migration `202609060001_shared_chore_workflows.sql` before enabling the
new hosted client. See [CHORE_BACKEND.md](CHORE_BACKEND.md) for verification and
deployment steps. This changes shared service contracts and database permissions;
it adds no production dependencies.

### Fairness calculation

For member `m` in the selected week:

```text
actual(m) = sum(points_awarded for m)
expected = sum(points_awarded for household) / active_member_count
gap(m) = actual(m) - expected
```

For the demo, the engine is transparent and deterministic:

- Balanced: every member is within 20% of `expected`.
- Needs a nudge: at least one member is more than 20% below `expected`.
- Suggested swap: choose the lowest-gap member, then assign the smallest upcoming
  chore that reduces their gap without overshooting `expected` by more than the
  largest chore value.
- The message comes from reviewed templates. An LLM is optional polish only and
  must never block the suggestion.

This avoids a tiny-task exploit because effort points, not completion count, drive
the score. Constraints and invisible labor are excellent follow-up features, but
they are not part of the two-day calculation.

## 4. Screen map

```text
Landing
├── Create household → Name household → Add/select identity → Home
└── Join with code → Enter code → Add/select identity → Home

Home
├── Chores → Chore detail / complete
├── Balance → Weekly effort + suggestion
├── Pulse → Three ratings → Weekly insight
└── Members → Current residence roster, with the active member labeled “(You)”
```

Use a four-tab app after onboarding: **Chores**, **Balance**, **Pulse**, and
**Members**. The Members tab is a lightweight, read-only roster for orienting
household conversations; it is not a permissions or social-management system.
Avoid nested navigation except the chore detail sheet.

## 5. Team ownership and branch boundaries

### Developer 1 — onboarding and navigation

Branch: `feature/household-onboarding`

- Add Expo Router and route groups.
- Preserve the landing screen as `/`.
- Build create/join household screens and local session state.
- Own shared header, buttons, form inputs, and base colors/spacing.
- Deliver mocked callbacks first so the backend can connect later.

### Developer 2 — chores

Branch: `feature/chore-board`

- Build the weekly chore list, chore card, completion interaction, and empty state.
- Seed 8 chores with point values from 1–6.
- Use the shared `Chore` and `Completion` types.
- Use the shared `services.chores` contract so the board, balance view, and selected
  data adapter all read the same chore and completion state.

### Developer 3 — balance and pulse

Branch: `feature/fairness-dashboard`

- Implement the fairness engine as pure functions with unit tests.
- Build member effort bars, status label, rebalance card, and pulse form.
- Implement a template-based insight from aggregate pulse results.
- Provide a seeded story where one roommate has done noticeably more work.

### Developer 4 — backend, integration, and release

Branch: `feature/backend-and-builds`

- Create the Supabase project, schema, seed script, and access policies.
- Implement service adapters matching the mock service interfaces.
- Configure EAS project linkage, signing, preview profiles, and environment values.
- Produce device builds by the end of day one and again after final integration.

Before declaring the hosted path ready, this developer runs `npm run verify:hosted`
against the linked project after `db push --include-seed`, then installs a preview
build configured with the hosted public values on a physical Android and iOS device.

This developer also acts as integrator, but does not rewrite other branches during
merge. Broken contracts go back to the owning developer with a minimal reproduction.

## 6. Merge strategy

1. Tag the current landing baseline as `landing-v1`.
2. Merge a tiny shared-contract PR first: routes, `src/types/domain.ts`, service
   interfaces, design tokens, and seeded fixture shape.
3. Rebase or merge that new `main` into all four feature branches.
4. Merge onboarding/navigation next because it establishes route destinations.
5. Merge chores and balance/pulse after each passes its own smoke test.
6. Merge the backend adapter last; flip services via one configuration point.
7. Cut `release/demo`, accept only critical fixes, build both platforms, and keep
   the last known-good preview URLs.

Pull requests should be small enough to review in 15 minutes. Every PR includes:

- a one-sentence behavior summary;
- a screenshot or short recording;
- exact test steps;
- `npm run typecheck` result;
- any known demo risk.

## 7. Detailed 48-hour schedule

### Day 1, hours 0–2: align and de-risk

- Everyone clones, installs, and launches the landing page on a phone.
- Confirm one person has an Expo account and Apple Developer access.
- Confirm the Android application ID and iOS bundle ID before signed builds.
- Agree on domain types, service interfaces, seeded dataset, and route names.
- Create branches and a shared project board with only must-have tickets.
- Developer 4 links the EAS project and starts blank preview builds immediately.

Checkpoint: the landing screen runs on four machines and cloud builds have begun.

### Day 1, hours 2–6: build vertical slices against mocks

- Developer 1 completes navigation plus create/join happy paths.
- Developer 2 completes the chore list and local completion behavior.
- Developer 3 completes fairness functions and a static dashboard from fixtures.
- Developer 4 completes schema, seed data, and service adapter skeletons.
- At hour 4, integrate one path manually: landing → demo household → chores.

Checkpoint: the demo story works locally with mock data and no backend dependency.

### Day 1, hours 6–10: persistence and first integration

- Connect household, member, chore, and completion reads/writes.
- Add loading, empty, and error states only on core screens.
- Merge onboarding, then chores, then balance/pulse into `main`.
- Install the first Android APK and iOS build on real devices.
- Record issues by severity; defer cosmetic polish that does not affect the story.

Checkpoint: a completion persists and updates the balance on at least one device.

### Day 1, hours 10–12: stabilize

- Fix merge regressions and inconsistent data contracts.
- Verify a clean install and seeded household join.
- Save a known-good build link and screen recording.
- Stop adding scope.

### Day 2, hours 12–17: finish the product loop

- Complete pulse submission and aggregate insight.
- Complete deterministic rebalance suggestion.
- Verify each user action updates all dependent screens.
- Add demo reset: either a hidden reset action or a documented seed command.
- Test slow/offline behavior; fixture fallback must still demonstrate the concept.

Checkpoint: all six steps in the product loop pass on both platforms.

### Day 2, hours 17–21: polish and device QA

- Test a small iPhone, a large iPhone, and one Android size.
- Check keyboard avoidance, safe areas, long names, duplicate taps, and back behavior.
- Check text contrast, accessible labels, and touch targets.
- Replace generic Expo icons only if the core build is already stable.
- Freeze `main`, branch `release/demo`, and start final EAS builds.

### Day 2, hours 21–24: rehearse and preserve fallbacks

- Run the 90-second demo five times with a stopwatch.
- Install final binaries while previous known-good versions remain on backup devices.
- Capture a complete backup video and screenshots.
- Put the APK, iOS install/TestFlight link, seed credentials, and demo script in one
  team-accessible note.
- Make only showstopper fixes after this point.

## 8. Build and signing checklist

### Shared setup

1. Create an Expo account/organization and run `npx eas-cli@latest login`.
2. Run `npx eas-cli@latest build:configure` and commit the generated project link.
3. Verify `com.roommateradar.app` is available; change it once if needed, before
   distributing builds.
4. Store public Supabase URL/key in EAS environment variables, not committed files.

### Android APK

1. The `preview` profile already sets `android.buildType` to `apk`.
2. Run `npm run build:preview:android`.
3. Let EAS generate and retain the Android keystore.
4. Download the artifact from the build page and install it on a physical phone.
5. Preserve the final APK outside the build dashboard as a demo backup.

### iOS IPA

1. Confirm an active Apple Developer Program membership. A free Apple ID is not
   enough for normal EAS ad hoc distribution.
2. Register every physical test iPhone with EAS before the preview build.
3. Run `npm run build:preview:ios` and allow EAS to manage the distribution
   certificate and provisioning profile.
4. Install from the EAS build page. If device registration changes, rebuild because
   the provisioning profile must include that device.
5. TestFlight is a good alternative for broader access, but Apple processing can
   introduce delay; do not make the live demo depend on a last-minute review.

## 9. Acceptance test script

Run this on iOS and Android before the final build:

1. Fresh install opens to the Roommate Radar landing screen without clipping.
2. Create a household or join the seeded Shared Home household with its invite code.
3. Chores show title, assignee, due state, and effort points.
4. Complete “Clean bathroom” once; a second rapid tap does not duplicate it.
5. Relaunch; the completion remains.
6. Balance shows the new points and the expected share is mathematically correct.
7. The under-contributing member receives a specific upcoming chore suggestion.
8. Submit three pulse ratings; the app surfaces the lowest-rated category neutrally.
9. Turn off networking; the app shows cached/seeded data or a recoverable error.
10. Open Members and confirm the current household roster appears, with the active
    user labeled “(You)”.
11. Return to the welcome screen and repeat the 90-second pitch flow.

## 10. Risk register and cuts

| Risk | Early mitigation | If still broken |
| --- | --- | --- |
| Apple signing/device registration | First build in hour 1 | Demo via TestFlight or simulator plus Android physical device |
| Backend/auth consumes too much time | Mock service is the first implementation | Ship persistent local demo household |
| Realtime sync is unreliable | Manual refresh after mutations | Remove realtime; refresh on screen focus |
| LLM latency or unsafe tone | Deterministic templates are canonical | Remove LLM entirely |
| Merge conflicts | Feature folders and shared contract PR first | Integrator cherry-picks smallest coherent commits |
| Build queue is slow | Build day one and freeze early day two | Use last known-good binaries |

Cut order when behind: realtime, animations, custom icons, free-form AI, real auth,
then pulse history. Never cut completing a chore, fairness math, the rebalance card,
or installable device builds; those are the project.
