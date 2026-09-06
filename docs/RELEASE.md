# Mobile release runbook

The Expo app is linked in `app.json` to EAS project
`f9ebb69e-6b4e-4e21-8123-82517159cd43`, owned by `arjohar`. The identifiers are
`com.roommateradar.app` on both platforms. Confirm that this project and owner are
accessible to the release operator before starting a cloud build.

## Local release checks

```bash
npm ci
npm run check:env
npm run typecheck
npm test
npm run health
npm run export:android
npm run export:ios
```

The exports validate Metro bundling but are not installable APK/IPA files. Generated
exports live under ignored `.expo-exports/`.

## EAS environment values

Create `preview` and `production` EAS environments. Keep local-demo builds on
`EXPO_PUBLIC_DATA_SOURCE=local`, or set these three variables for a configured
hosted backend:

```text
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=PUBLIC_CLIENT_KEY
```

Do not add the service-role key or native signing credentials to the repository.

## Installable builds

Authenticate first with `npx eas-cli@latest login`, then confirm the linkage with
`npx eas-cli@latest project:info`.

- `npm run build:preview:android` requests an internally distributed APK.
- `npm run build:preview:ios` requests an internal iOS build. It requires an active
  Apple Developer membership, registered device UDIDs, and valid signing assets.
- `npm run build:production:android` and `npm run build:production:ios` use the
  store-oriented production profile and remote version increments.

EAS should manage keystores, distribution certificates, and provisioning profiles;
do not download them into this repository. A build is not verified until its EAS
job succeeds, the artifact is downloaded from the build page, and the acceptance
script in `docs/DEVELOPMENT_PLAN.md` passes on a physical device.
