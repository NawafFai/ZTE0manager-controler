# Roadmap

Long-horizon engineering plan. Checked items are implemented in the current
codebase; the rest are prioritized follow-ups. This file is the living backlog —
update it as work lands.

## Done (v0.1 foundation)

- [x] Vite + React + TS strict + Tailwind + TanStack Query + Zustand + Router scaffold
- [x] `goform` transport client (GET/multi-GET, authenticated POST)
- [x] RD/AD/MD5 auth strategies (pluggable per firmware)
- [x] Signal engine: normalization, quality classification, band-mask math
- [x] Reverse-engineering engine: JS crawler → parser → classifier → merged DB
- [x] Firmware diffing + localStorage snapshot cache
- [x] Auto-generated Markdown API docs
- [x] Plugin architecture + model detection (MC801A/888/889/8020 + generic)
- [x] Dashboard, Live Monitor, LTE, NR, Tower, API Explorer, API Console, Developer Mode
- [x] Verified operations: LTE cell lock, NR band lock (+ experimental LTE band lock)
- [x] Unit tests for band-mask, auth, parser, DB merge, signal engine, plugin detection
- [x] **Portable Windows .exe** (Electron shell + built-in localhost router proxy, self-hosted Monaco)

## Next up (high priority)

- [ ] **Verify experimental goformIds** against real firmware and promote to `verified`.
- [ ] **AST-grade parser**: optional acorn-based pass to recover param lists per goformId.
- [ ] **Neighbour-cell decoding**: confirm the real command + field order per model.
- [ ] **Temperature / CPU / RAM**: locate the correct commands per model (currently partial).
- [ ] **Login flow**: implement `LD`-salt password login for when no session cookie exists.
- [ ] **Bandwidth & latency graphs**: add throughput + ping/packet-loss series to Live Monitor.
- [ ] **Carrier-aggregation detail**: parse SCC list into per-CC rows.

## Medium

- [ ] SMS / SIM / WiFi / Firewall / VPN feature pages driven by discovered categories.
- [ ] Production reverse-proxy recipe (nginx/Caddy) + optional Tauri desktop shell.
- [ ] Persisted, comparable firmware snapshots UI (timeline + diff viewer).
- [ ] E2E tests against a recorded fixture of router responses (MSW).
- [ ] i18n scaffolding.

## Guiding principles

1. Never hardcode a command that can be discovered.
2. Every router = a plugin; core stays model-agnostic.
3. Mutating actions are gated and clearly labelled by confidence.
4. Keep `KNOWN_DISCOVERIES.md` / `REVERSE_ENGINEERING_NOTES.md` synchronized with reality.
