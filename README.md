# Roommate Radar

**See the chores nobody talks about.**

Roommate Radar is a cooperative household app that makes shared effort visible,
spots imbalance early, and suggests friendly ways to rebalance the work.

This repository starts with a production-shaped Expo + React Native + TypeScript
landing screen so the team can ship one codebase to iOS and Android.

## Run the app locally

Roommate Radar runs through Expo. You can open it on a physical iPhone or Android
phone with Expo Go, in an iOS Simulator on a Mac, in an Android Emulator on a Mac
or Windows PC, or in a web browser.

### Requirements for every computer

- [Node.js](https://nodejs.org/) 22.13 or newer (use the current Node.js LTS
  release).
- npm, which is included with Node.js.
- This repository downloaded or cloned to the computer.
- [Expo Go](https://expo.dev/go) on each physical phone you want to test.
- Internet access on both the computer and phone when using a tunnel.

Verify Node.js and npm before continuing:

```text
node --version
npm --version
```

### Choose the data mode

Expo loads local development variables from a `.env` file in the project root.
Copy `.env.example` to `.env` if the file does not already exist.

The checked-in default is the persistent local demo adapter:

```dotenv
EXPO_PUBLIC_DATA_SOURCE=local
```

Local mode is useful for UI development, but its households exist only on that
one device. Two different phones cannot share or join the same local household.

For real multi-device testing, use the hosted Supabase project:

```dotenv
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_CLIENT_KEY
```

Use only the public anonymous or publishable key in the app. Never add a Supabase
service-role key to an `EXPO_PUBLIC_` variable or commit `.env`.

## macOS / MacBook instructions

Open Terminal, change to the repository directory, and install the exact locked
dependencies:

```bash
cd /path/to/roommate-radar
npm ci
```

On the first setup, create the local environment file if it does not exist, then
edit it for the data mode described above:

```bash
test -f .env || cp .env.example .env
```

Start Expo on the local network:

```bash
npm start
```

Expo prints a QR code and a list of keyboard shortcuts in Terminal. Keep this
Terminal window open while using the app.

### Open it on a physical phone from a Mac

1. Install Expo Go on the phone.
2. Put the Mac and phone on the same Wi-Fi network.
3. Run `npm start` and wait for the QR code.
4. On iPhone, scan the QR code with the built-in Camera app and tap the Expo Go
   banner. On Android, open Expo Go and choose **Scan QR code**.

If the phone cannot reach the Mac over Wi-Fi, stop Expo with `Control+C` and use
the public tunnel instead:

```bash
npm run start:tunnel
```

Wait until Terminal displays both `Tunnel connected` and `Tunnel ready`, then scan
the new QR code. A tunnel is slower than local Wi-Fi but works across different
networks.

### Open the iOS Simulator on a Mac

The iOS Simulator requires Xcode and is available only on macOS.

1. Install Xcode from the Mac App Store.
2. In Xcode, install the current iOS Simulator runtime from **Xcode > Settings >
   Components**.
3. Run `npm start`.
4. Press `i` in the Expo Terminal window to open the default iOS Simulator.
   Press `Shift+i` to choose a specific installed simulator.

You can also start Expo and request iOS in one command:

```bash
npm run ios
```

### Open the Android Emulator on a Mac

1. Install Android Studio, its Android SDK, and an Android Virtual Device.
2. Start the virtual device from Android Studio's Device Manager.
3. Run `npm start`, then press `a` in the Expo Terminal window.

You can also use:

```bash
npm run android
```

## Windows instructions

Open PowerShell or Command Prompt, change to the repository directory, and install
the exact locked dependencies:

```powershell
cd C:\path\to\roommate-radar
npm ci
```

On the first setup, create the local environment file if it does not exist, then
edit it for the data mode described above:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Start Expo on the local network:

```powershell
npm start
```

Expo prints a QR code and keyboard shortcuts. Keep the terminal open while using
the app.

### Open it on a physical phone from Windows

1. Install Expo Go on the iPhone or Android phone.
2. Put the Windows computer and phone on the same Wi-Fi network.
3. Run `npm start` and scan the QR code. Use the iPhone Camera app or Expo Go's
   **Scan QR code** option on Android.

If local Wi-Fi does not work, stop Expo with `Control+C` and run:

```powershell
npm run start:tunnel
```

Tunnel support and the Windows ngrok executable are installed by `npm ci`; no
global ngrok installation is required. Wait for `Tunnel connected` and `Tunnel
ready` before scanning the new QR code.

If Windows Security prompts for access, allow Node.js and this project's ngrok
executable for the network profile you are using. Do not disable antivirus or the
firewall. If antivirus quarantines ngrok, allow only the executable installed
under this project's `node_modules` directory.

If PowerShell says `npm.ps1` cannot be loaded, use the Windows command shims:

```powershell
npm.cmd ci
npm.cmd run start:tunnel
```

### Open the Android Emulator on Windows

1. Install Android Studio, its Android SDK, and an Android Virtual Device.
2. Start the virtual device from Android Studio's Device Manager.
3. Run `npm start`, then press `a` in the Expo terminal.

You can also use:

```powershell
npm run android
```

Windows cannot run Apple's iOS Simulator. To test iOS from Windows, scan the Expo
QR code with a physical iPhone, or use a signed EAS build on an Apple device.

## Expo terminal controls

After `npm start` or `npm run start:tunnel` is running, focus that terminal and
press:

| Key | Action |
| --- | --- |
| `i` | Open the app in the default iOS Simulator (macOS only). |
| `Shift+i` | Choose an installed iOS Simulator (macOS only). |
| `a` | Open the app in a running Android Emulator. |
| `w` | Open the web version in the default browser. |
| `r` | Reload the running app. |
| `m` | Open the developer menu. |
| `?` | Display all available Expo commands. |
| `Control+C` | Stop the Expo development server. |

These are keyboard keys typed in the terminal; they are not buttons inside the
Roommate Radar app.

## Common startup problems

- Run commands from the repository directory containing `package.json`.
- Use `npm ci` after pulling changes to keep dependencies consistent.
- If the QR code opens but cannot load the bundle, confirm the phone and computer
  are on the same Wi-Fi or switch to `npm run start:tunnel`.
- If a tunnel times out, stop it and retry. Expo tunnels depend on the external
  ngrok service and can be temporarily unavailable.
- If the app opens but two phones cannot share a household, confirm the local
  `.env` uses `EXPO_PUBLIC_DATA_SOURCE=supabase`; local mode is device-specific.
- If an emulator does not open, start the simulator/emulator manually before
  pressing `i` or `a`.
- Only one Expo server should use a given port. Stop old sessions with
  `Control+C` before starting another.

## Development checks

Before opening a pull request, run:

```bash
npm run check:env
npm run typecheck
npm test
npm run health
```

See [`docs/BACKEND.md`](docs/BACKEND.md) for the shared service contracts,
Supabase schema, and full environment configuration.

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
The exact local checks, EAS profiles, credential boundaries, and device-build steps
are in [`docs/RELEASE.md`](docs/RELEASE.md).
