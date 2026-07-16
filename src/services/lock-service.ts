import type { GoformClient } from '@/api/goform-client';
import type { GoformSetResult } from '@/types';
import { maskFromBands, maskToHex, parseMask, bandsFromMask } from '@/signals/band-mask';
import { toStringOrNull } from '@/signals/parse';
import { setNetworkAuto } from './device-service';

/**
 * Band / cell lock operations.
 *
 * Only two goformIds are experimentally verified (see KNOWN_DISCOVERIES.md):
 *   - LTE_LOCK_CELL_SET       (lte_pci_lock, lte_earfcn_lock)
 *   - WAN_PERFORM_NR5G_BAND_LOCK (nr5g_band_mask)
 * Anything beyond these is marked experimental in the type below and must be
 * confirmed against the target firmware before it is surfaced destructively.
 */

export function isSuccess(result: GoformSetResult): boolean {
  return /success|ok|true/i.test(result.result ?? '');
}

// --- lock status (read) ------------------------------------------------------

export interface LockStatus {
  lteBandLock: string | null;
  nrBandLock: string | null;
  lteCellLock: string | null;
  /** LTE bands the modem is restricted to, if a (small) band lock is active. */
  lockedLteBands: number[];
  cellLocked: boolean;
  anyLocked: boolean;
  /** Human summary, e.g. "B3", "PCI 224", or "Auto (free)". */
  summary: string;
}

function isMaskSet(v: string | null): boolean {
  return v !== null && v !== '' && v !== '0' && v.toLowerCase() !== '0x0';
}

/** A band lock restricts to a small set; auto reports the full supported mask. */
const RESTRICTIVE_MAX_BANDS = 4;

function decodeRestrictiveBands(mask: string | null): number[] {
  if (!isMaskSet(mask)) return [];
  try {
    const bands = bandsFromMask(parseMask(mask as string));
    return bands.length > 0 && bands.length <= RESTRICTIVE_MAX_BANDS ? bands : [];
  } catch {
    return [];
  }
}

/**
 * Read whether any band/cell lock is currently active (requires login).
 *
 * NOTE: on 5G NSA the NR band is chosen by the LTE anchor, and "unlock NR" is
 * itself expressed as a wide band mask — so a non-empty NR mask does NOT mean
 * the user is stuck. We therefore base the "locked" flag on the things the user
 * actually controls here: the LTE band lock and the LTE cell lock.
 */
export async function readLockStatus(client: GoformClient): Promise<LockStatus> {
  const r = await client.get({ cmd: ['lte_band_lock', 'wan_nr5g_band_lock', 'lte_pci_lock'] });
  const lteBandLock = toStringOrNull(r.lte_band_lock);
  const nrBandLock = toStringOrNull(r.wan_nr5g_band_lock);
  const lteCellLock = toStringOrNull(r.lte_pci_lock);
  // `lte_band_lock` is non-empty even in auto (it reports the *allowed* mask),
  // so we treat it as a lock only when it restricts to a small set of bands.
  const cellLocked = isMaskSet(lteCellLock);
  const lockedLteBands = decodeRestrictiveBands(lteBandLock);
  const anyLocked = cellLocked || lockedLteBands.length > 0;

  let summary = 'Auto (free)';
  if (cellLocked) summary = `Cell PCI ${lteCellLock}`;
  else if (lockedLteBands.length > 0) summary = lockedLteBands.map((b) => `B${b}`).join(' + ');

  return { lteBandLock, nrBandLock, lteCellLock, lockedLteBands, cellLocked, anyLocked, summary };
}

// --- LTE cell lock (verified) ------------------------------------------------

export interface LteCellLockRequest {
  pci: number;
  earfcn: number;
}

export function lockLteCell(
  client: GoformClient,
  { pci, earfcn }: LteCellLockRequest,
): Promise<GoformSetResult> {
  return client.set({
    goformId: 'LTE_LOCK_CELL_SET',
    params: { lte_pci_lock: pci, lte_earfcn_lock: earfcn },
  });
}

/** Convention across ZTE firmware: zeroed PCI/EARFCN clears the cell lock. */
export function unlockLteCell(client: GoformClient): Promise<GoformSetResult> {
  return client.set({
    goformId: 'LTE_LOCK_CELL_SET',
    params: { lte_pci_lock: 0, lte_earfcn_lock: 0 },
  });
}

// --- LTE band lock (verified: goformId BAND_SELECT) --------------------------

/**
 * LTE band lock via `BAND_SELECT`. Confirmed from the router's own service.js:
 *   goformId=BAND_SELECT, is_gw_band, gw_band_mask, is_lte_band, lte_band_mask
 * We set `is_lte_band=1` and the LTE mask, and leave the 2G/3G ("gw") selection
 * untouched (`is_gw_band=0`).
 */
export function lockLteBands(
  client: GoformClient,
  bandsOrMask: number[] | bigint,
): Promise<GoformSetResult> {
  const mask = Array.isArray(bandsOrMask) ? maskFromBands(bandsOrMask) : bandsOrMask;
  return client.set({
    goformId: 'BAND_SELECT',
    params: {
      is_gw_band: 0,
      gw_band_mask: '0x0',
      is_lte_band: 1,
      lte_band_mask: maskToHex(mask),
    },
  });
}

/** Unlock LTE = let the modem choose freely (is_lte_band=0). */
export function unlockLteBands(client: GoformClient): Promise<GoformSetResult> {
  return client.set({
    goformId: 'BAND_SELECT',
    params: {
      is_gw_band: 0,
      gw_band_mask: '0x0',
      is_lte_band: 0,
      lte_band_mask: '0x0',
    },
  });
}

// --- NR band lock (verified) -------------------------------------------------

/**
 * NR band lock uses a COMMA-SEPARATED LIST OF BAND NUMBERS — verified from the
 * live device: `nr5g_band_lock` read back `"1,3,40,41,77,78"`. This is NOT a hex
 * bitmask (LTE's `BAND_SELECT` uses a bitmask; NR does not). So to lock n78 we
 * send `nr5g_band_mask=78`; to allow several, `nr5g_band_mask=77,78`.
 *
 * Reminder: on 5G NSA the LTE anchor still decides which NR band is offered, so
 * restricting to a band the anchor doesn't provide yields no NR.
 */
export function lockNrBands(
  client: GoformClient,
  bands: number[] | string,
): Promise<GoformSetResult> {
  const list = Array.isArray(bands) ? bands.join(',') : bands.trim();
  return client.set({
    goformId: 'WAN_PERFORM_NR5G_BAND_LOCK',
    params: { nr5g_band_mask: list },
  });
}

/** Accepts a band list like "78" or "77,78" (also tolerates "n78, n41"). */
export function setNrBandMask(client: GoformClient, bandList: string): Promise<GoformSetResult> {
  const nums = bandList.match(/\d+/g) ?? [];
  return lockNrBands(client, nums.join(','));
}

/** Full supported NR set for this modem class (allow-all = auto). */
const NR_ALL_BANDS = [1, 3, 5, 7, 8, 20, 28, 38, 40, 41, 66, 71, 77, 78, 79];

export function unlockNrBands(client: GoformClient): Promise<GoformSetResult> {
  return lockNrBands(client, NR_ALL_BANDS);
}

// --- NR cell lock (experimental — surfaced only when discovery finds it) -----

/**
 * NR (5G) cell lock via `NR5G_LOCK_CELL_SET`. This goformId is NOT present in
 * the reference MC801A1 service.js — it comes from the decompiled Easy Control
 * APK, which drives it on other ZTE models (see KNOWN_DISCOVERIES.md). Param
 * names follow the LTE cell-lock convention (`nr5g_pci_lock`/`nr5g_freq_lock`)
 * and are still unverified on real hardware (the APK also references a
 * `nr5g_cell_lock` field), so the Feature Unlock page only renders this control
 * when the command actually exists in the discovered database, and flags it
 * experimental.
 */
export interface NrCellLockRequest {
  pci: number;
  /** NR-ARFCN of the target cell. */
  arfcn: number;
}

export function lockNrCell(
  client: GoformClient,
  { pci, arfcn }: NrCellLockRequest,
): Promise<GoformSetResult> {
  return client.set({
    goformId: 'NR5G_LOCK_CELL_SET',
    params: { nr5g_pci_lock: pci, nr5g_freq_lock: arfcn },
  });
}

/** Zeroed PCI/ARFCN clears the NR cell lock (same convention as LTE). */
export function unlockNrCell(client: GoformClient, retry = true): Promise<GoformSetResult> {
  return client.set({
    goformId: 'NR5G_LOCK_CELL_SET',
    params: { nr5g_pci_lock: 0, nr5g_freq_lock: 0 },
    retry,
  });
}

// --- Safe Mode revert --------------------------------------------------------

/**
 * Return the radio to a free/auto state: clear the LTE cell lock and LTE band
 * lock (which restores service), then widen the NR band set. Each step is
 * best-effort so a partial failure still restores as much as possible.
 *
 * The NR cell unlock runs with retry disabled: firmwares without
 * `NR5G_LOCK_CELL_SET` (like the reference MC801A1) answer `failure`, and the
 * panic path must not burn 4 retries on a command that cannot succeed.
 */
export async function revertToAuto(client: GoformClient): Promise<void> {
  const steps = [
    () => unlockLteCell(client),
    () => unlockNrCell(client, false),
    () => unlockLteBands(client),
    () => unlockNrBands(client),
    // Restore auto RAT preference (all bands, prefer 5G) so a leftover "4G only"
    // mode doesn't cap speed after a reset.
    () => setNetworkAuto(client),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch {
      /* keep going — restoring LTE alone usually recovers service */
    }
  }
}
