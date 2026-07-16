<div align="center">

# 📡 ZTE Router Manager

**Take full control of your ZTE 5G router — band lock, carrier aggregation, gamer mode, and an auto‑optimizer.**

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android%20%7C%20iOS-2563eb)](#-download)
[![License](https://img.shields.io/badge/license-MIT-16a34a)](#-license)
[![Privacy](https://img.shields.io/badge/privacy-local--only-059669)](#-privacy--security)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20Capacitor-38bdf8)](#)

### [![Download Android](https://img.shields.io/badge/⬇%20Download-Android%20APK-16a34a?style=for-the-badge&logo=android&logoColor=white)](../../releases/latest) [![Download Windows](https://img.shields.io/badge/⬇%20Download-Windows-2563eb?style=for-the-badge&logo=windows&logoColor=white)](../../releases/latest)

**English** · [🇸🇦 العربية](README.ar.md)

**Created & maintained by [Eng. Nawaf](https://github.com/NawafFai)**

</div>

---

An advanced, open‑source manager for the hidden HTTP API of ZTE 5G routers. It
does everything the stock web UI does — and much more — while keeping everything
**100% local**: your device talks only to your own router. No cloud. No telemetry.

> **Supported models:** MC801A · MC801A1 · MC888 · MC889 · MC8020 · and other ZTE 5G models.

## ✨ Features

- **📊 Dashboard & Live Monitor** — model, IMEI, bands, RSRP/SINR, temperature, and 1‑second live graphs.
- **⚡ Auto‑Optimizer** — one‑tap modes:
  - 🚀 **Max Speed** — unlock everything for the highest throughput.
  - 🎮 **Gamer** — benchmarks real ping/jitter/loss and locks the lowest‑latency option.
  - ⚖️ **Balance** — the strongest, most stable connection.
  - 📶 **Network** — switch 4G / 5G.
- **🔒 LTE / 5G tools** — band lock, cell lock, and NR carrier‑aggregation combos (e.g. `n41 + n78`).
- **🔓 Feature Unlock** — surfaces the band/cell‑lock controls your ISP's web UI hides. **Discovery‑based, never hardcoded:** the app reads your router's own firmware and shows a control only when that command really exists on your device — otherwise it says *"unavailable on this model"* instead of a dead button. Every lock is paired with Safe Mode auto‑revert and the 🚨 Restore button.
- **🛟 Safe Mode** — auto‑reverts to Auto if a lock drops the connection for 60 s, plus a 🚨 one‑tap **Restore**.
- **🧠 API Explorer / Console / Developer Mode** — automatically discovers the router's hidden commands.

## 📥 Download

| Platform | How to get it |
|:--|:--|
| 🪟 **Windows** | Download `ZTE-Router-Manager-Windows.zip` from [Releases](../../releases/latest) → unzip → run the `.exe`. |
| 🤖 **Android** | Download `ZTE-Router-Manager.apk` from [Releases](../../releases/latest) → install. |
| 🍎 **iOS** | Needs a Mac to build. See [MOBILE.md](MOBILE.md). |

> Both are built and published automatically by GitHub Actions. If the Releases
> page is empty, open the **Actions** tab and run **Build apps** once.

## 🤖 Build the Android APK (cloud — recommended)

1. Upload this project to a **GitHub** repository (private is fine).
2. Open the repo → **Actions** tab → **Build Android APK** → **Run workflow**.
3. Wait ~5 minutes → open the finished run → download the **`ZTE-Router-Manager-apk`** artifact → unzip → `app-debug.apk`.
4. Install it on your phone (enable *Install unknown apps*) and connect the phone to your **router's Wi‑Fi**.

## 🚀 Quick start

1. Open the app → enter your **router password** → tick **Remember me** → **Log in**.
2. For top speed: **Optimizer → 🚀 Max Speed**.
3. To force fast 5G: **5G / NR → preset `n41 + n78 (CA)` → Lock**.
4. If anything goes wrong: **🚨 Restore** (top bar) puts everything back to Auto.

## 🔐 Privacy & Security

Everything runs on your device and reaches only your own router. **No cloud, no
telemetry, no accounts.** Your password is stored on your device only.

## 📚 Documentation

[MOBILE.md](MOBILE.md) · [DESKTOP.md](DESKTOP.md) · [ROADMAP.md](ROADMAP.md) · [KNOWN_DISCOVERIES.md](KNOWN_DISCOVERIES.md) · [docs/](docs/)

## 📄 License

MIT © 2026 **Eng. Nawaf** — see [LICENSE](LICENSE). For use on routers you own
or are authorized to manage.
