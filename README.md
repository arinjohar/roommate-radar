# Roommate Radar

**See the chores nobody talks about.**

Roommate Radar is a cooperative household app that makes shared effort visible,
spots imbalance early, and suggests friendly ways to rebalance the work.

This repository starts with a production-shaped Expo + React Native + TypeScript
landing screen so the team can ship one codebase to iOS and Android.

## Run locally

Prerequisites: Node.js 22.13 or newer and the Expo Go app on a phone (or an iOS /
Android simulator).

```bash
npm install
npm start
```

Scan the QR code with Expo Go. You can also run a platform directly:

```bash
npm run ios
npm run android
```

Check TypeScript before opening a pull request:

```bash
npm run typecheck
```

## Branch workflow

`main` should always launch. Each teammate creates one branch from the latest
`main`, keeps the branch focused, and opens a pull request rather than pushing
feature work directly to `main`.

Suggested first branches:

- `feature/household-onboarding`
- `feature/chore-board`
- `feature/fairness-dashboard`
- `feature/backend-and-builds`

Before merging, pull the latest `main`, resolve conflicts on the feature branch,
run `npm run typecheck`, and smoke-test the changed flow on a phone.

## Installable builds

The `preview` EAS profile produces an installable APK on Android and an internal
distribution build on iOS.

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npm run build:preview:android
npm run build:preview:ios
```

An iPhone `.ipa` requires Apple signing credentials and registered test devices
for ad hoc distribution (or TestFlight). Do the first signed iOS build on day one,
not at the end of the hackathon.

See [the development plan](docs/DEVELOPMENT_PLAN.md) for scope, ownership, data
contracts, merge order, demo acceptance criteria, and the hour-by-hour plan.
