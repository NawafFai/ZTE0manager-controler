# ZTE Router Reverse Engineering Notes

**Project:** ZTE Router Manager
**Status:** Reverse engineering phase (ongoing)

> Authoritative working notes. Keep synchronized with
> [KNOWN_DISCOVERIES.md](KNOWN_DISCOVERIES.md). Prefer verified results over
> assumptions; mark unverified items explicitly.

---

## Reference Device

| Field | Value |
| --- | --- |
| Model | MC801A1 |
| Firmware | BD_SASTCEMC801A1V1.0.0B01 |
| Hardware | MC801A1HW-1.0.0 |
| ISP | STC Saudi Arabia |
| Network | 5G NSA (ENDC) |

---

## Endpoints

```
GET  /goform/goform_get_cmd_process      # ?cmd=a,b,c&multi_data=1
POST /goform/goform_set_cmd_process      # goformId=...&<params>&AD=...
```

---

## Authentication (working model)

1. The web UI keeps a browser session cookie after login; that cookie can be reused.
2. Read tokens: `GET goform_get_cmd_process?cmd=RD` returns the current `RD`.
3. `AD` is derived locally and attached to state-changing POSTs.
   Working hypothesis (classic ZTE):
   `AD = MD5( MD5(wa_inner_version + hardware_version) + RD )`.
   The inputs (`wa_inner_version`, `hardware_version`) are read via GET and
   may differ by firmware — this is intentionally isolated behind the auth
   strategy in code so it can be corrected per plugin without touching callers.
4. Login (when not reusing a session) typically uses an `LD` salt with a
   hashed password. To be re-verified against this firmware's service.js.

---

## Confirmed GET commands + captured values

| Command | Captured value (reference device) |
| --- | --- |
| `network_type` | ENDC |
| `lte_ca_pcell_band` | 3 |
| `wan_lte_ca` | ca_activated |
| `lte_pci` | 224 |
| `nr5g_pci` | 206 |
| `cell_id` | 0xB6A2C11 |
| `nr5g_action_band` | n78 |
| `lte_band_lock` | 0x180080800c5 |
| `wa_inner_version` | (read at runtime) |
| `hardware_version` | MC801A1HW-1.0.0 |
| `signalbar` | 3 |
| `network_provider` | stc ksa |
| `ppp_status` | ipv4_ipv6_connected |
| `rmcc` / `rmnc` | (mobile country/network code) |
| `lte_earfcn` | (exists; value not yet captured) |
| `wan_lte_band` / `wan_nr5g_band` | (serving band strings) |
| `wan_nr5g_band_lock` | (current NR lock mask) |
| `factory_mode` / `adb_enable` | (engineering flags) |
| `loginfo` | login/session state |

---

## Hidden POST commands

Verified:

- `LTE_LOCK_CELL_SET` — params `lte_pci_lock`, `lte_earfcn_lock` → lock LTE serving cell.
- `WAN_PERFORM_NR5G_BAND_LOCK` — param `nr5g_band_mask` → lock NR bands.

Present in service.js (semantics inferred, verify before shipping actions):

```
SET_NETWORK  SET_BEARER_PREFERENCE  SET_CONNECTION_MODE  SET_DEVICE_MTU
SET_WIFI_BAND  SET_WIFI_COVERAGE  SET_DEVICE_LED  SET_THERMAL_CONTROL
SET_NV  APN_PROC  APN_PROC_EX  VPN_CLIENT_SET  VOIP_VOICE_WORK_TYPE_SET
WIFI_ADVANCE_SET  MGMT_CONTROL_POWER_ON_SPEED  OPERATION_MODE  UNLOCK_NETWORK
```

---

## Missing information (research backlog)

LTE EARFCN value · Neighbor cells · Tower scan API · NR Cell ID ·
Engineering-mode APIs · Factory APIs · Band-mask bit mapping ·
Carrier-aggregation details · Temperature API · CPU usage API · Memory usage API.

---

## Engineering goals (tracked in ROADMAP.md)

API discovery · typed API wrappers · automatic JS parser · hidden API
extraction · firmware diffing · automatic documentation · plugin system ·
tower scanner · LTE lock · NR band lock · developer console · API explorer ·
signal monitor.

---

## Ground rules

Do NOT hardcode APIs that can be discovered. Always scan router JavaScript.
Support future firmware and models via plugins. No firmware modification.
No rooting. No cloud. Everything runs locally.
