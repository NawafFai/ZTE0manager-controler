# Desktop app (.exe)

ZTE Router Manager ships as a **portable Windows app** — no installer, no admin
rights. It is an Electron shell that runs a tiny local server on `127.0.0.1`
which serves the UI and proxies the hidden API to your router. Everything stays
on your machine.

## Run the prebuilt app

After a build, the app is here:

```
release\ZTE Router Manager-win32-x64\ZTE Router Manager.exe
```

Double-click `ZTE Router Manager.exe`. You can copy the whole
`ZTE Router Manager-win32-x64` folder anywhere (USB stick, another PC) and run
it there — it is self-contained.

## First-time setup

1. Launch the app.
2. Menu **Router → Set Router IP…** — enter your router address if it isn't the
   default `http://192.168.0.1` (STC MC801A1 uses `192.168.0.1`).
3. Menu **Router → Login to Router…** — this opens your router's own login page
   inside the app (same origin), so after you log in the session is shared with
   the manager. Close that window when done.
4. Back in the app, click **Connect**.

The chosen router IP is remembered between runs (stored in
`%APPDATA%\ZTE Router Manager\config.json`).

## Build it yourself

```bash
npm install
# one-time: the Electron binary download may be blocked by npm's script guard —
# if so, run:  node node_modules/electron/install.js
npm run dist:win
```

Output: `release\ZTE Router Manager-win32-x64\`.

- `npm run app:dev` — build once and launch the desktop app (fast dev loop).
- `npm run dist:win` — build the portable app folder (recommended).
- `npm run dist:win:installer` — build an NSIS installer **(requires Windows
  Developer Mode or admin so electron-builder can extract its signing toolkit;
  the portable build above has no such requirement).**

## Why a local proxy instead of talking to the router directly?

The router enforces same-origin for its `/goform` API and scopes its session
cookie to its own host. A desktop app calling `http://192.168.0.1` cross-origin
would be blocked by CORS and couldn't reuse the login. The bundled proxy makes
every request same-origin (`127.0.0.1`), forwards the session cookie (stripping
the `Domain` attribute so it binds locally), and never sends anything off-device.

## Troubleshooting

- **"Connect" fails / no data:** set the correct Router IP, then use
  *Login to Router…* first. Confirm the router web UI opens at that address in a
  normal browser.
- **Port already in use:** the app tries ports 42431–42435; if all are busy it
  falls back to a random port (note: a random port resets stored UI state for
  that session, since browser storage is per-origin).
- **SmartScreen warning:** the app is unsigned. Choose *More info → Run anyway*,
  or build it yourself from source.
