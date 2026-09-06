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
- An **SDK 57-compatible** [Expo Go](https://expo.dev/go) build on each phone,
  or a Roommate Radar preview build. See the compatibility notes below before
  installing Expo Go from an app store.
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

For physical-phone testing from a Mac, start with a local-network connection:

```bash
npx expo start --go --lan
```

This targets Expo Go and requires the Mac and phone to be on the same Wi-Fi
network with permission to communicate. Stop any previous Expo server with
`Control+C` first, and keep this Terminal window open while using the app.
Neither LAN nor tunnel mode is guaranteed to work on every network.

### Open it on a physical phone from a Mac

1. Install an SDK 57-compatible Expo Go build on the phone (see compatibility
   notes below).
2. Connect the Mac and phone to the same Wi-Fi. On iPhone, enable **Settings →
   Privacy & Security → Local Network → Expo Go** if listed.
3. Run `npx expo start --go --lan` and wait for the QR code.
4. On iPhone, scan the QR code with the built-in Camera app and tap the Expo Go
   banner. On Android, open Expo Go and choose **Scan QR code**.

Scan the newly generated QR code each time you restart the server; an old code
may point to a server that is no longer running. Keep the Mac awake and the
server running while testing.

If the network prevents the phone from reaching the Mac, stop Expo and try:

```bash
npm run start:tunnel -- --go --clear
```

Wait for both `Tunnel connected` and `Tunnel ready` before scanning the new QR
code. Both devices need internet access, but can use different networks. Tunnels
depend on ngrok and can fail intermittently; they are an alternative, not a Mac
requirement. If startup reports `Cannot read properties of undefined (reading
'body')` with an ngrok status link, the tunnel has failed to start. Check
[ngrok status](https://status.ngrok.com/) and try LAN on a network that allows
device-to-device traffic. The empty-cache warning after `--clear` is expected
and is not itself a failure. Both modes require an SDK-compatible Expo Go build.

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

- This project uses **Expo SDK 57**. If a phone says the project is incompatible
  or requires a newer Expo Go, changing `npm start` to `npx expo start` or using
  a tunnel will not fix the native SDK mismatch. On Android, select SDK 57 at
  [expo.dev/go](https://expo.dev/go) and install the compatible build. For physical
  iPhones, Expo's September 2026 guidance says the App Store version stops at SDK
  54; use an SDK 57 Expo Go build through `eas go` and your TestFlight internal
  team (Apple Developer membership required), or the project's iOS preview build.
  Check [Expo's current compatibility instructions](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)
  for updated availability. Phones with different Expo Go builds can behave differently.
- Run commands from the repository directory containing `package.json`.
- Use `npm ci` after pulling changes to keep dependencies consistent.
- On an iPhone showing a connectivity timeout, check **Settings → Privacy &
  Security → Local Network → Expo Go** and allow access for LAN testing.
  Internet access alone does not mean Expo Go can reach the computer.
  See [Apple's local network permission guide](https://support.apple.com/en-us/102229).
- If the QR code opens but cannot load the bundle, confirm the phone and computer
  are on the same Wi-Fi or stop the old server and run
  `npm run start:tunnel -- --go --clear`, then scan the newly generated QR code.
  This targets Expo Go explicitly and uses a fresh bundle cache. A tunnel can
  help when a shared Wi-Fi network prevents devices from reaching each other;
  it does not fix an incompatible Expo Go version.
- If a tunnel times out, stop it and retry. Expo tunnels depend on the external
  ngrok service and can be temporarily unavailable.
- If the app opens but two phones cannot share a household, confirm the local
  `.env` uses `EXPO_PUBLIC_DATA_SOURCE=supabase` and both servers use the same
  Supabase project; local mode is device-specific. Restart Expo after changing
  `.env`. The terminal QR code opens the app; use the household's invite code
  inside Roommate Radar to join the household.
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
