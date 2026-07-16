import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClient, useRuntimeStore, useSafeModeStore } from '@/store';
import {
  lockLteCell,
  unlockLteCell,
  lockLteBands,
  unlockLteBands,
  lockNrBands,
  unlockNrBands,
  lockNrCell as lockNrCellOp,
  unlockNrCell as unlockNrCellOp,
  setNrBandMask,
  setBearerPreference,
  setNetworkAuto,
  type BearerPreference,
  type LteCellLockRequest,
  type NrCellLockRequest,
} from '@/services';

/**
 * Mutations for the verified lock operations.
 *
 * Each mutation is wrapped so that, for its whole duration, background signal
 * polling is paused AND any in-flight reads are cancelled. This is essential:
 * the firmware rotates the RD nonce on reads, so a concurrent poll would
 * invalidate the AD signature and the router would answer `{"result":"failure"}`.
 * On completion we resume and refresh the radio/tower views.
 */
export function useLockActions() {
  const client = useClient();
  const qc = useQueryClient();
  const setMutating = useRuntimeStore((s) => s.setMutating);
  const arm = useSafeModeStore((s) => s.arm);
  const disarm = useSafeModeStore((s) => s.disarm);

  const POLLED_KEYS = [['radio'], ['telemetry'], ['wan'], ['tower-scan']];

  const guard = {
    onMutate: async () => {
      setMutating(true);
      // Stop in-flight reads so none rotates RD between signing and sending.
      await Promise.all(POLLED_KEYS.map((queryKey) => qc.cancelQueries({ queryKey })));
    },
    onSettled: () => {
      setMutating(false);
      qc.invalidateQueries({ queryKey: ['radio'] });
      qc.invalidateQueries({ queryKey: ['tower-scan'] });
    },
  };
  // A lock arms Safe Mode (auto-revert if the link drops); an unlock disarms it.
  const lockGuard = (label: string) => ({ ...guard, onSuccess: () => arm(label) });
  const unlockGuard = { ...guard, onSuccess: () => disarm() };

  const lockCell = useMutation({
    mutationFn: (req: LteCellLockRequest) => lockLteCell(client!, req),
    ...lockGuard('LTE cell lock'),
  });
  const unlockCell = useMutation({ mutationFn: () => unlockLteCell(client!), ...unlockGuard });
  const lockLteBand = useMutation({
    mutationFn: (bands: number[]) => lockLteBands(client!, bands),
    ...lockGuard('LTE band lock'),
  });
  const unlockLteBand = useMutation({ mutationFn: () => unlockLteBands(client!), ...unlockGuard });
  const lockNr = useMutation({
    mutationFn: (bands: number[]) => lockNrBands(client!, bands),
    ...lockGuard('NR band lock'),
  });
  const lockNrMask = useMutation({
    mutationFn: (hexMask: string) => setNrBandMask(client!, hexMask),
    ...lockGuard('NR band mask'),
  });
  const unlockNr = useMutation({ mutationFn: () => unlockNrBands(client!), ...unlockGuard });
  const lockNrCell = useMutation({
    mutationFn: (req: NrCellLockRequest) => lockNrCellOp(client!, req),
    ...lockGuard('NR cell lock'),
  });
  const unlockNrCell = useMutation({ mutationFn: () => unlockNrCellOp(client!), ...unlockGuard });
  const setMode = useMutation({
    mutationFn: (pref: BearerPreference) => setBearerPreference(client!, pref),
    ...lockGuard('Network mode'),
  });
  const setAuto = useMutation({
    mutationFn: () => setNetworkAuto(client!),
    ...unlockGuard,
  });

  return {
    lockCell,
    unlockCell,
    lockLteBand,
    unlockLteBand,
    lockNr,
    lockNrMask,
    unlockNr,
    lockNrCell,
    unlockNrCell,
    setMode,
    setAuto,
  };
}
