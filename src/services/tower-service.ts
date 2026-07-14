import type { GoformClient } from '@/api/goform-client';
import type { NeighborCell, RadioSnapshot } from '@/types';
import { toIntFlexible, toNumber, isPlaceholder } from '@/signals/parse';

/**
 * Tower scanner. Neighbour-cell reporting is not standardized across ZTE
 * firmware and was flagged "unknown" in the knowledge base, so this reads a set
 * of candidate commands and parses whatever is present. The serving cell is
 * always synthesized from the live snapshot so the page is useful even when no
 * neighbour list is exposed.
 */

const NEIGHBOR_CANDIDATE_COMMANDS = [
  'lte_multi_ca_scell_info',
  'lte_neighbor_cell',
  'lte_ncell_info',
  'lte_cell_info',
  'wan_lte_ncell',
  'nr5g_cell_info',
  'nr5g_neighbor_cell',
  'monitor_cell_info',
  'cell_info',
  'cell_list',
  'wan_active_channel',
];

/** Parse a firmware neighbour blob: entries by `;`, fields by `,`. Lenient. */
function parseNeighborBlob(raw: string, rat: 'LTE' | 'NR'): NeighborCell[] {
  if (isPlaceholder(raw)) return [];
  const cells: NeighborCell[] = [];
  for (const entry of raw.split(';')) {
    const fields = entry.split(',').map((f) => f.trim());
    if (fields.length < 2) continue;
    const [pci, chan, band, rsrp, rsrq, sinr] = fields;
    const parsed: NeighborCell = {
      rat,
      pci: toIntFlexible(pci),
      earfcnArfcn: toIntFlexible(chan),
      band: band && !isPlaceholder(band) ? band : null,
      rsrp: toNumber(rsrp),
      rsrq: toNumber(rsrq),
      sinr: toNumber(sinr),
      isServing: false,
    };
    if (parsed.pci !== null || parsed.earfcnArfcn !== null) cells.push(parsed);
  }
  return cells;
}

function servingCells(snapshot: RadioSnapshot): NeighborCell[] {
  const cells: NeighborCell[] = [];
  if (snapshot.lte.pci !== null) {
    cells.push({
      rat: 'LTE',
      pci: snapshot.lte.pci,
      earfcnArfcn: snapshot.lte.earfcn,
      band: snapshot.lte.band,
      rsrp: snapshot.lte.rsrp.value,
      rsrq: snapshot.lte.rsrq.value,
      sinr: snapshot.lte.sinr.value,
      isServing: true,
    });
  }
  if (snapshot.nr.pci !== null) {
    cells.push({
      rat: 'NR',
      pci: snapshot.nr.pci,
      earfcnArfcn: snapshot.nr.arfcn,
      band: snapshot.nr.band,
      rsrp: snapshot.nr.rsrp.value,
      rsrq: snapshot.nr.rsrq.value,
      sinr: snapshot.nr.sinr.value,
      isServing: true,
    });
  }
  return cells;
}

export async function scanTowers(
  client: GoformClient,
  snapshot: RadioSnapshot,
): Promise<NeighborCell[]> {
  const serving = servingCells(snapshot);
  let neighbors: NeighborCell[] = [];
  try {
    const raw = await client.get({ cmd: NEIGHBOR_CANDIDATE_COMMANDS });
    for (const [key, value] of Object.entries(raw)) {
      const rat: 'LTE' | 'NR' = /nr/i.test(key) ? 'NR' : 'LTE';
      neighbors = neighbors.concat(parseNeighborBlob(value, rat));
    }
  } catch {
    // No neighbour API on this firmware — serving cells alone are still useful.
  }

  // Sort best signal first; serving cells pinned to the top.
  return [...serving, ...neighbors].sort((a, b) => {
    if (a.isServing !== b.isServing) return a.isServing ? -1 : 1;
    return (b.rsrp ?? -Infinity) - (a.rsrp ?? -Infinity);
  });
}
