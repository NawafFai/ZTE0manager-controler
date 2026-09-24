# HANDOFF — ZTE Router Manager

Continuation notes for a fresh session. The project is **complete and shipping**
(Windows + Android built in CI and published to a GitHub Release). This file is
the single place to (re)learn: how to run it, the **verified router facts**, what
is shipped, and the few genuine open items. Last updated **2026-09-24**.

---

## 0. Toolchain / how to run (Windows dev box)

- Node is **not** on PATH by default. Prepend it in every shell (the PowerShell
  tool does NOT persist env between calls):
  `$env:Path = "C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.18.0-win-x64;$env:Path"`
- npm here has an **allow-scripts guard** that blocks postinstall (esbuild/electron/sharp).
  `tsc`/`vitest`/`vite build` still work. If the Electron binary is missing:
  `node node_modules/electron/install.js`. CI (clean Ubuntu/Windows) has no such guard.
- **Gates (must stay green):** `npx tsc --noEmit` · `npm run lint` (`--max-warnings 0`) ·
  `npx vitest run` (**85 tests / 11 files**) · `npm run build`.
- Desktop package: `npm run dist:win` → `release/ZTE Router Manager-win32-x64/ZTE Router Manager.exe`.
- Android locally: `npm run apk:debug` (runs `scripts/patch-android.mjs` after `cap add`).
- Icons: `npm run icons` (regenerates from `resources/icon.svg`).

## 1. Git / deploy state

- Repo: `https://github.com/NawafFai/ZTE0manager-controler` · default branch **main**.
- Local: `C:\Users\Admin\zte`, branch `main`, remote `origin`. **Local tracks
  `origin/main` (0/0)** — the earlier duplicate-history drift was fixed on
  2026-09-24 with `git fetch origin && git reset --hard origin/main` (tree was clean).
- Commit author must be `Eng. Nawaf <NawafFai@users.noreply.github.com>` (GH007
  rejects the private email). Already set in local `git config`.
- ⚠️ Do NOT edit files on github.com (causes divergence). Edit locally → `git push`.
- CI `.github/workflows/android-apk.yml` builds **Android APK + Windows zip** and
  publishes both to the **`latest` Release** via `.github/scripts/publish-release.sh`
  (REST API; recreates the release from empty to avoid HTTP 422). Every push to
  `main` republishes.

## 2. Architecture (Clean, feature-based)

```
src/
  api/         goform client + RD/AD auth + platform transport (fetch | CapacitorHttp)
               hilink-{client,crypto,map,net,xml}.ts = Huawei HiLink adapter
  signals/     signal normalization, quality, band-mask math, optimizer scoring
  services/    device / radio / lock / tower / auth / optimizer / latency / feature-unlock
  reverse/     JS crawler → parser → classifier → merged API database → diff → docgen
  plugins/     generic, mc801a, mc888, mc889, mc8020, huawei-h155 + detection registry
  store/       zustand: connection, credentials, safemode, runtime, theme, console, devlog
  hooks/       TanStack Query bindings + use-lock-actions, use-recovery, use-safemode, use-optimizer
  components/  ui primitives (incl. Notice), layout, charts, SafeModeBanner, ConnectionGate, ConfirmButton
  pages/       Dashboard, LiveMonitor, Lte, Nr, Tower, Optimizer, FeatureUnlock, ApiExplorer,
               ApiConsole, Developer, Settings   (routes: src/router/nav.ts)
  i18n/        en + ar dictionaries (RTL aware)
electron/      main.cjs = local server + router proxy (Referer rewrite) + auto-discovery
scripts/       gen-icons.mjs, patch-android.mjs (adds android:usesCleartextTraffic)
```

Dependency direction: `pages → hooks → services → (api | signals | reverse | plugins) → types`.
Router-specific behaviour lives ONLY in `plugins/`.

## 3. Shipped features (all present on `main`)

- Dashboard + Live Monitor (1 s graphs, CSV export) · LTE / 5G pages (band lock,
  cell lock, NR band lists incl. CA presets like `n41 + n78`) · Tower Scanner
  (serving + CA cells; shows a carrier-locked notice on Huawei H155).
- **Optimizer** modes: Max Speed (unlock all) · Gamer (real ping/jitter/loss) ·
  Balance · Network (Auto / 4G-only). Always includes an "Auto" baseline candidate.
- **Feature Unlock** (`/unlock`): discovery-based — `src/services/feature-unlock.ts`
  resolves which lock goformIds the device actually exposes (from the reverse-
  engineering DB) and renders controls only for those; "unavailable on this
  model" otherwise. Tests in `feature-unlock.test.ts`.
- **Safe Mode** (auto-revert after 60 s without connectivity) + 🚨 Restore
  (`useRecovery`, polling paused during writes).
- Native SHA-256/Base64 login with "Remember me", auto-login, auto-connect.
- **Router auto-discovery** (Electron server-side, native client-side):
  `192.168.0.1 → 192.168.100.1 → 192.168.8.1 → 192.168.1.1`. A user-set address is
  never overridden. The list lives in `src/api/transport.ts` (`CANDIDATE_ROUTER_URLS`)
  and `electron/main.cjs` (`CANDIDATE_HOSTS`) and is echoed in i18n
  `gate.unreachable` (en+ar), README / README.ar / MOBILE / DESKTOP /
  `.env.example` / `publish-release.sh` — **keep all in sync when changing it**.
- API Explorer / Console / Developer Mode (auto-discovers hidden commands).
- Huawei 5G CPE 5 (H155-383) HiLink driver plugin (`src/plugins/huawei-h155.ts`).

## 4. VERIFIED router facts (MC801A1 — live device + decompiled `service.js`/APK)

**Endpoints:** `GET /goform/goform_get_cmd_process?cmd=a,b&multi_data=1` ·
`POST /goform/goform_set_cmd_process`. Multiple `cmd`s **require** `multi_data=1`
(without it the firmware treats `a,b` as one unknown key and returns `""`).

**Auth (`src/api/auth.ts`, `goform-client.ts`):**
- `AD = MD5( MD5(wa_inner_version + cr_version) + RD )` — MD5 is **lowercase** (`md5.js hexcase=0`).
- `cr_version` is empty until **logged in** → AD only valid after login.
- **Referer/Origin CSRF:** `cmd=RD` returns `""` unless `Referer` is the router. The desktop
  proxy (`electron/main.cjs`) and dev proxy (`vite.config.ts`) rewrite it; on mobile the
  native transport (`src/api/transport.ts`, CapacitorHttp) sets it.
- **RD rotates on every read** → `buildTokens()` fetches versions first, RD **last**;
  lock actions **pause polling** (`useRuntimeStore.mutating`) + cancel in-flight;
  `client.set` **retries up to 4×** on `{"result":"failure"}` (never for LOGIN).

**Login (`src/services/auth-service.ts`):** `password = SHA256( SHA256(raw) + LD )`, SHA256
is **UPPERCASE** (`util.js` hex flag `d=1`), goformId `LOGIN`. Live-verified 2026-09-24:
`WEB_ATTR_IF_SUPPORT_SHA256` reads **empty before login even on SHA-256 firmware** → the
discriminator is `cmd=LD` itself (64-hex salt ⇒ SHA-256 login; `""` ⇒ legacy `Base64(pw)`).
LOGIN posts best-effort tokens, never auto-retries (lockout protection), one Base64
fallback max per session. Result codes: `0`/`4` success, `1` fail, `2` another user
online, `3` wrong password, `5` not logged in.

**Verified lock commands (this firmware):**
- **LTE band lock** → `BAND_SELECT`, params `is_lte_band`, `lte_band_mask` (HEX bitmask,
  bit = band−1), `is_gw_band`, `gw_band_mask`.
- **LTE cell lock** → `LTE_LOCK_CELL_SET`, params `lte_pci_lock`, `lte_earfcn_lock`.
- **NR band lock** → `WAN_PERFORM_NR5G_BAND_LOCK`, param `nr5g_band_mask` =
  **comma-separated band NUMBERS** e.g. `77,78` (NOT hex). Verified from live
  `nr5g_band_lock="1,3,40,41,77,78"`.
- Network mode → `SET_BEARER_PREFERENCE` param `BearerPreference` (`Only_LTE` = 4G;
  Auto is probed via `setNetworkAuto`). "5G only" is impossible on NSA.
- Reboot → `REBOOT_DEVICE`. Full goformId list in `KNOWN_DISCOVERIES.md`.

**Physics learned:** on 5G NSA the **LTE anchor decides the NR band**; restricting NR to a
band the anchor doesn't offer yields no NR. Best real result on the user's device:
LTE auto + NR `41,78` (NR carrier aggregation) ≈ 128 Mbps vs 26 Mbps on n40 alone.

**Live snapshot 2026-09-24:** `192.168.0.1` answers `model_name=MC801A1` in ~94 ms
(first discovery candidate); `network_type=ENDC`, `signalbar=5`,
`ppp_status=ipv4_ipv6_connected`; other candidates time out at 3 s each.

## 5. v0.2.0 "Login failed" fixes (2026-07-27) — keep in mind when touching connectivity

1. Android blocked all router `http://` traffic — the generated manifest lacked
   `android:usesCleartextTraffic="true"` (Capacitor's `server.cleartext` does NOT add it).
   `scripts/patch-android.mjs` patches it after `cap add`; wired into CI + `apk:debug`.
2. Default router IP had regressed to `192.168.8.1`; restored `192.168.0.1` and added the
   auto-discovery above (Electron config gains `source: 'user'|'auto'`).
3. Unreachable router looked like "Login failed" — store `login()` returns code
   `'unreachable'`; `ConnectionGate` auto-connects, shows status + real error + (mobile)
   an address field.
4. Login scheme discriminator = `cmd=LD` (see §4).
5. HiLink client used `window.fetch` (dead on Android) — now goes through `httpRequest`
   (CapacitorHttp on native); `HttpResult` carries lowercased `headers` for the
   `__RequestVerificationToken` chain.

## 6. Testing patterns

- Mock router: `src/test/mock-router.ts` (emulates goform GET/SET, RD/AD/LD, login,
  persists locks). Integration tests: `src/services/integration.test.ts` (real client
  over HTTP vs the mock). Scoring / parser / plugin / feature-unlock / HiLink tests in
  `src/**/*.test.ts`. What needs the router **password** (locks, gaming benchmark) is
  covered by these tests; everything below the login line was also verified live.

## 7. Gotchas

- Tables + Arabic in one markdown file render as a blob on GitHub → keep languages in
  separate files (`README.md` / `README.ar.md`).
- `nr5g_band_mask` is a band-NUMBER list, not hex. LTE `lte_band_mask` IS hex. Don't mix.
- `lte_band_lock` reads non-empty even in auto (allowed mask) → detect a lock via the LTE
  **cell** lock or a *small* decoded band set (`readLockStatus` does this).
- Signal fields (`lte_rsrp`, `Z5g_rsrp`, `cr_version`, `nr5g_band_list`, …) are empty
  until logged in.
- Huawei H155 carrier firmware disables neighbour-cell / cell-info endpoints → Tower
  Scanner shows a notice instead of cells on that device.

## 8. Open items (genuine, not started)

- Code-signing for Windows/Android (removes "unknown publisher/source" warnings).
- iOS build: project scaffolded (`npx cap add ios`) but needs a Mac + Apple account.
- Finish Arabic translation of remaining page-body strings.
- Optional: throughput (Mbps) measurement in the Optimizer (metered-data cost).
