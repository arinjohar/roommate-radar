# Roommate Radar agent guide

## Design continuity

Every new screen and component must follow the visual and interaction language of
the landing page in `App.tsx`: warm cream backgrounds, deep ink text, coral and
mint accents, rounded surfaces, generous spacing, clear hierarchy, and a calm,
cooperative tone. This product should feel like a helpful household mediator, not
a surveillance dashboard or chore scoreboard.

Before opening a pull request, test new work alongside the landing screen on a
phone-sized viewport. Reuse existing design tokens and shared UI primitives when
they exist; do not introduce an unrelated visual system for a feature.

## Product scope

Treat [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) as the current source
of truth for intended features, data contracts, core demo flow, team boundaries,
and release checks. Read the relevant section before starting feature work.

The plan is a living document, not a constraint on product judgment. The team may
change it at any time when new information, available time, user feedback, or the
hackathon direction calls for it. When a feature or technical decision changes the
plan materially, update the plan in the same pull request (or link the follow-up
pull request) so future contributors work from the current direction.

## Merge-ready work

Keep every branch safe to merge into `main`:

- Branch from the latest `main` and keep each branch focused on one coherent task.
- Do not commit generated build folders, secrets, local environment files, or
  unrelated formatting changes.
- Avoid changing shared contracts, navigation, dependencies, or app configuration
  unless the feature requires it; call out those changes clearly in the pull request.
- Reconcile with the latest `main` before requesting review and resolve conflicts on
  the feature branch.
- Run `npm run typecheck` and smoke-test the changed flow before merging.
- Preserve a working app at all times. Do not merge incomplete routes, broken entry
  points, or placeholder code that blocks the current demo path.

## Working style

Build the smallest complete slice that improves the core loop: household setup,
chores, weighted fairness, pulse check, and a constructive rebalance suggestion.
Prefer deterministic and testable behavior over ambitious integrations that could
put the demo at risk. If scope must change, update the plan and communicate the
tradeoff early rather than treating the original plan as fixed.
