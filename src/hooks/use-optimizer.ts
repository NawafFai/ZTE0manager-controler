import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useClient, useRuntimeStore, useSafeModeStore } from '@/store';
import {
  applyCandidate,
  chooseWinner,
  measureLatency,
  revertToAuto,
  runOptimization,
  type BenchResult,
  type Candidate,
  type OptProgress,
} from '@/services';
import type { LatencyStats, OptGoal } from '@/signals/optimizer';

export interface OptimizerState {
  running: boolean;
  progress: OptProgress | null;
  results: BenchResult[];
  error: string | null;
}

/**
 * Drives an optimization run: pauses background polling for the whole run (so
 * lock signing isn't disturbed), streams progress, ranks the candidates, and
 * can re-apply the winner.
 */
export function useOptimizer() {
  const client = useClient();
  const qc = useQueryClient();
  const setMutating = useRuntimeStore((s) => s.setMutating);
  const armSafeMode = useSafeModeStore((s) => s.arm);
  const disarmSafeMode = useSafeModeStore((s) => s.disarm);
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<OptimizerState>({
    running: false,
    progress: null,
    results: [],
    error: null,
  });

  const run = useCallback(
    async (candidates: Candidate[], goal: OptGoal, pingTarget?: string) => {
      if (!client || candidates.length === 0) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setMutating(true);
      await Promise.all(
        [['radio'], ['telemetry'], ['wan'], ['tower-scan']].map((queryKey) =>
          qc.cancelQueries({ queryKey }),
        ),
      );
      setState({ running: true, progress: null, results: [], error: null });
      try {
        const latencyProbe =
          goal === 'gaming'
            ? (signal?: AbortSignal): Promise<LatencyStats> =>
                measureLatency(pingTarget ?? '', 6, 2500, signal)
            : undefined;
        const results = await runOptimization(client, candidates, {
          goal,
          ...(latencyProbe ? { latencyProbe } : {}),
          signal: controller.signal,
          onProgress: (progress) =>
            setState((s) => ({
              ...s,
              progress,
              results: progress.result ? [...s.results, progress.result] : s.results,
            })),
        });
        // Apply the winner only if it clearly beats Auto; if nothing had
        // service, restore auto instead of leaving the modem on a dead band.
        const winner = chooseWinner(results);
        if (winner) {
          await applyCandidate(client, winner.candidate);
          winner.applied = true;
          if (winner.candidate.kind === 'auto') disarmSafeMode();
          else armSafeMode(`Optimizer: ${winner.candidate.label}`);
        } else {
          await revertToAuto(client);
          disarmSafeMode();
        }
        setState((s) => ({ ...s, running: false, results }));
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        // A cancelled/failed run leaves the modem on whichever candidate was
        // being tested — put it back on auto.
        await revertToAuto(client).catch(() => undefined);
        disarmSafeMode();
        setState((s) => ({
          ...s,
          running: false,
          error: aborted ? null : err instanceof Error ? err.message : String(err),
        }));
      } finally {
        setMutating(false);
        qc.invalidateQueries({ queryKey: ['radio'] });
      }
    },
    [client, qc, setMutating, armSafeMode, disarmSafeMode],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const applyBest = useCallback(
    async (result: BenchResult) => {
      if (!client) return;
      setMutating(true);
      try {
        await applyCandidate(client, result.candidate);
        armSafeMode(`Optimizer: ${result.candidate.label}`);
      } finally {
        setMutating(false);
        qc.invalidateQueries({ queryKey: ['radio'] });
      }
    },
    [client, qc, setMutating, armSafeMode],
  );

  return { ...state, run, cancel, applyBest };
}
