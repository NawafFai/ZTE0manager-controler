import type { RadioSnapshot } from '@/types';
import type { GoformClient } from '@/api/goform-client';
import { SIGNAL_COMMANDS, buildSnapshot } from '@/signals/signal-engine';

/** Reads every signal command in one round-trip and normalizes to a snapshot. */
export async function readRadioSnapshot(client: GoformClient): Promise<RadioSnapshot> {
  const raw = await client.get({ cmd: [...SIGNAL_COMMANDS], multi: true });
  return buildSnapshot(raw);
}
