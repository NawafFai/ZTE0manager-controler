# KNOWN DISCOVERIES

**Project:** ZTE Router Manager
**Status:** Verified discoveries (experimentally confirmed unless noted)
**Last Updated:** 2026-07-17

> This file is authoritative. Prefer experimentally verified results over
> assumptions. When new APIs are discovered or verified, update this file and
> keep it synchronized with [REVERSE_ENGINEERING_NOTES.md](REVERSE_ENGINEERING_NOTES.md).
> Machine-readable seeds derived from this file live in
> `src/reverse/knowledge/seed.ts`.

---

## Reference Device

| Field | Value |
| --- | --- |
| Model | MC801A1 |
| Hardware Version | MC801A1HW-1.0.0 |
| Firmware | BD_SASTCEMC801A1V1.0.0B01 |
| ISP | STC Saudi Arabia |
| Connection Type | ENDC (5G NSA) |
| Primary LTE Band | B3 |
| 5G Band | n78 |
| Carrier Aggregation | Enabled (`ca_activated`) |

---

## Verified Network Values (reference capture)

| Metric | Value |
| --- | --- |
| LTE PCI | 224 (0xE0) |
| NR PCI | 206 |
| Cell ID | 0xB6A2C11 |
| Signal Bar | 3 |
| PPP Status | ipv4_ipv6_connected |
| Provider | stc ksa |
| `network_type` | ENDC |
| `lte_ca_pcell_band` | 3 |
| `wan_lte_ca` | ca_activated |
| `nr5g_action_band` | n78 |
| `lte_band_lock` | 0x180080800c5 |

### Measured signal

| Radio | RSRP | SINR |
| --- | --- | --- |
| LTE | -101 dBm | 4 dB |
| NR | -104 dBm | 15 dB |

---

## Endpoints

- `GET  /goform/goform_get_cmd_process` — read commands (`cmd=`, `multi_data=1`)
- `POST /goform/goform_set_cmd_process` — action commands (`goformId=`)

---

## Verified Hidden GET Commands

```
lte_ca_pcell_band   wan_lte_ca          network_type        rmcc
rmnc                cell_id             lte_pci             signalbar
network_provider    ppp_status          loginfo             lte_band_lock
wan_nr5g_band       wan_lte_band        nr5g_action_band    wan_nr5g_band_lock
wa_inner_version    hardware_version    factory_mode        adb_enable
nr5g_pci            lte_earfcn
```

---

## Cross-verified from the official "Easy Control" APK (Ez_1.24, Flutter)

Decompiled `libapp.so` uses the SAME auth model (`RD`, `AD`, `cr_version`,
`wa_inner_version`, `Referer`, `isTest`, `md5`) — confirming ours. It also shows a
richer command set spanning many ZTE models:

- LTE band: `BAND_SELECT` (`is_lte_band`,`lte_band_mask`,`is_gw_band`,`gw_band_mask`).
- NR band: `WAN_PERFORM_NR5G_BAND_LOCK` (`nr5g_band_mask`), plus (other models)
  `NR5G_BAND_SELECT`, `SET_NR5G_BAND_CONFIG`, and NSA/SA-split masks
  `nr5g_nsa_band_mask` / `nr5g_sa_band_mask`, `nr5g_nsa_band_lock` / `nr5g_sa_band_lock`.
  → The reference MC801A1 service.js exposes ONLY `nr5g_band_mask`, so that is
  the correct command for this device.
- Cell lock: `LTE_LOCK_CELL_SET`, `NR5G_LOCK_CELL_SET` (`lte_pci_lock`,
  `lte_earfcn_lock`, `nr5g_cell_lock`).
- Neighbour/scan fields: `lte_multi_ca_scell_info`, `lte_multi_ca_scell_sig_info`,
  `RSRP_NBR`, `EARFCN_NBR`, `param_freq_pci`, `app_set_cell_list`.

### RD nonce gotcha (root cause of `{"result":"failure"}` on locks)

The firmware rotates `RD` on reads. If background signal polling reads while a
lock is being signed, the RD used for `AD` becomes stale → the router returns
`failure`. Fix: fetch `RD` last (right before the POST) and pause/cancel all
polling for the duration of the mutation.

Also: `cr_version` is empty until logged in, so `AD` is only valid after login.

---

## Live-verified from service.js (2026-07-06)

Read directly from the reference device's `js/service.js` (138 KB) + `js/config/config.js`.

### Confirmed signal / cell field names (GET)

| Metric | Command |
| --- | --- |
| LTE RSRP | `lte_rsrp` |
| LTE RSRQ | `lte_rsrq` |
| LTE SINR | `lte_snr` |
| RSSI | `rssi` |
| LTE PCC band / bw / earfcn | `lte_ca_pcell_band` / `lte_ca_pcell_bandwidth` / `lte_ca_pcell_arfcn` |
| LTE SCC (CA) | `lte_ca_scell_info`, `lte_ca_scell_band`, `lte_ca_scell_arfcn` |
| NR RSRP | `Z5g_rsrp` |
| NR SNR / SINR | `Z5g_snr` / `Z5g_SINR` |
| NR ARFCN | `Z5g_dlEarfcn` (also `nr5g_action_channel`) |
| NR cell id | `Z5g_CELL_ID` / `nr5g_cell_id` |
| NR band | `nr5g_action_band` / `ZCELLINFO_band` |
| NR PCI | `nr5g_pci` |

> Important: these return empty unless the browser session is **logged in**.
> `network_type` and `signalbar` are readable unauthenticated; signal/cell fields are not.

### LTE band lock (goformId `BAND_SELECT`) — corrects an earlier assumption

`BAND_SELECT` is the real LTE band-lock command (there is **no**
`WAN_PERFORM_LTE_BAND_LOCK` on this firmware). Params:
`is_gw_band`, `gw_band_mask`, `is_lte_band`, `lte_band_mask`.

### Other confirmed goformIds (selection from the full list in service.js)

`REBOOT_DEVICE`, `SHUTDOWN_DEVICE`, `SET_BEARER_PREFERENCE`, `WAN_OPERATE_MODE_SET`,
`BSP_ANTENNA_STATE_SET` (`antenna_name`,`state`), `WAN_ANT_SWITCH_SET`,
`RF_MMW_DISABLE_SET`, `SIGNAL_QUALITY_DETECT_START` / `_CANCEL` /
`SIGNAL_QUALITY_RECORD_ADD/DEL/CLEAR` (built-in signal/cell scan), `SCAN_NETWORK`,
`CONNECT_NETWORK`, `DISCONNECT_NETWORK`, `LOGIN` / `LOGOUT` / `CHANGE_PASSWORD`,
`SEND_SMS` / `DELETE_SMS`, `ENTER_PIN` / `ENTER_PUK`, `APN_PROC` / `APN_PROC_EX`,
`SET_WIFI_BAND`, `SET_THERMAL_CONTROL`, `SET_DEVICE_LED`, `VPN_CLIENT_SET`.

---

## Verified Hidden POST APIs (goformId)

| goformId | Parameters | Purpose | Source |
| --- | --- | --- | --- |
| `LTE_LOCK_CELL_SET` | `lte_pci_lock`, `lte_earfcn_lock` | Lock LTE serving cell | service.js |
| `WAN_PERFORM_NR5G_BAND_LOCK` | `nr5g_band_mask` (comma band-number list, e.g. `77,78` — NOT hex) | Lock NR bands | service.js + live read |
| `BAND_SELECT` | `is_lte_band`, `lte_band_mask`, `is_gw_band`, `gw_band_mask` | Lock LTE/2G/3G bands | service.js |
| `REBOOT_DEVICE` | — | Reboot router | service.js |
| `SIGNAL_QUALITY_DETECT_START` | — | Start signal/cell scan | service.js |

---

## Confirmed goformId (present in service.js, semantics partially inferred)

```
SET_NETWORK              SET_BEARER_PREFERENCE    SET_CONNECTION_MODE
SET_DEVICE_MTU           SET_WIFI_BAND            SET_WIFI_COVERAGE
SET_DEVICE_LED           SET_THERMAL_CONTROL      SET_NV
APN_PROC                 APN_PROC_EX              VPN_CLIENT_SET
VOIP_VOICE_WORK_TYPE_SET WIFI_ADVANCE_SET         MGMT_CONTROL_POWER_ON_SPEED
OPERATION_MODE           UNLOCK_NETWORK           LTE_LOCK_CELL_SET
WAN_PERFORM_NR5G_BAND_LOCK
```

---

## Feature Unlock candidate map (2026-07-17)

The Feature Unlock page (`src/services/feature-unlock.ts`) resolves each
logical lock feature against the discovered API database — a control renders
only when one of these goformIds is actually present on the device:

| Feature | Candidate goformIds (preferred first) | Driveable by lock-service |
| --- | --- | --- |
| LTE band lock | `BAND_SELECT` | yes |
| LTE cell lock | `LTE_LOCK_CELL_SET` | yes |
| NR band lock | `WAN_PERFORM_NR5G_BAND_LOCK` · `NR5G_BAND_SELECT` · `SET_NR5G_BAND_CONFIG` | first only |
| NR cell lock | `NR5G_LOCK_CELL_SET` | yes (experimental) |
| Network mode | `SET_BEARER_PREFERENCE` | yes |

### `NR5G_LOCK_CELL_SET` (experimental — NOT on the reference MC801A1)

Seen only in the decompiled Easy Control APK (other ZTE models); absent from
the reference MC801A1 `service.js`, so on that device the feature correctly
resolves as **unavailable**. `lockNrCell` sends params following the LTE
cell-lock convention — `nr5g_pci_lock`, `nr5g_freq_lock` — with zeros to clear.
**Param names unverified on real hardware** (the APK also references a
`nr5g_cell_lock` field); verify against a device that ships this goformId
before trusting it. `revertToAuto` fires the zeroed form best-effort with
retry disabled, so the panic path stays fast on firmwares without the command.

---

## Authentication (VERIFIED from service.js, 2026-07-06)

- Every state-changing POST carries an `AD` token. Algorithm confirmed:

  ```
  a  = hex_md5(wa_inner_version + cr_version)   // rd_params0 + rd_params1
  RD = GET goform_get_cmd_process?cmd=RD        // fresh nonce per request
  AD = hex_md5(a + RD)
  ```

  → **`AD = MD5( MD5(wa_inner_version + cr_version) + RD )`** (uses `cr_version`,
  NOT `hardware_version`).

- **Referer/Origin CSRF check:** `cmd=RD` returns `{"RD":""}` unless the request
  `Referer` is the router (e.g. `http://192.168.0.1/index.html`). A localhost app
  MUST rewrite Referer/Origin to the router when proxying, or every signed call
  fails with an empty RD.
- `wa_inner_version` is readable unauthenticated; `cr_version` and
  `hardware_version` are empty until the session is **logged in**. So AD is only
  correct after login.
- Login goformId is `LOGIN`; salt via `cmd=LD`. Verified in util.js/service.js:
  - `SHA256(x)` returns **UPPERCASE** hex (util.js hex-table flag `d = 1`);
    `MD5(x)` returns **lowercase** (md5.js `hexcase = 0`).
  - `WEB_ATTR_IF_SUPPORT_SHA256 = 2` → `password = SHA256( SHA256(rawPassword) + LD )` (uppercase).
  - Login result codes: `0`/`4` = success, `1` = login fail, `2` = duplicateUser
    (another session active), `3` = badPassword, `5` = not logged in.
  - Only one admin session at a time → `2` means log out the other session first.

---

## JavaScript Findings

Confirmed files: `main.js`, `app.js`, `service.js`.

`service.js` contains: hidden goformId definitions, authentication logic,
MD5 token generation, POST/GET wrappers, hidden engineering APIs, router
capability detection.

---

## Still Unknown / To Verify

- LTE EARFCN value (command `lte_earfcn` exists; value not captured)
- Neighbor Cell API
- Tower Scan API
- NR Cell ID
- Band Mask documentation / bit mapping
- Engineering Mode APIs
- Factory APIs
- Temperature / CPU / Memory APIs

---

## Evidence & Ethics

All discoveries were extracted directly from router JavaScript (`service.js`,
`main.js`, `app.js`) and live API responses from `goform_get_cmd_process`.
No firmware modification. No rooting. No cloud. Everything runs locally.
