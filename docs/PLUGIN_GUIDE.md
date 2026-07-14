# Plugin Guide

Adding support for a new ZTE router is intentionally tiny: a plugin only
declares **which models it matches**, **which auth strategy** the family uses,
and **baseline capabilities**. All transport, signal parsing, discovery, and UI
are shared and model-agnostic.

## 1. Declare the plugin

Add an entry in `src/plugins/models.ts`:

```ts
export const mc889Plugin: RouterPlugin = {
  id: 'mc889',
  name: 'ZTE MC889 / MC889A',
  models: ['MC889', 'MC889A'], // matched case-insensitively, by prefix
  authStrategyId: 'classic-zte',
  capabilities: () => ({
    lteBandLock: true,
    lteCellLock: true,
    nrBandLock: true,
    nrCellLock: true,
    towerScan: true,
    carrierAggregation: true,
    temperature: true,
    thermalControl: true,
  }),
};
```

Then register it in the `MODEL_PLUGINS` array in the same file. Detection
(`src/plugins/registry.ts`) automatically picks the **most specific** matching
plugin (longest matched model string) and falls back to `genericPlugin`.

## 2. Custom matching (optional)

If model/hardware strings are insufficient, add a `matches(device)` predicate:

```ts
matches: (device) => (device.firmware ?? '').includes('MC889A'),
```

## 3. Auth differences (optional)

If a family signs requests differently, add a new `AuthStrategy` in
`src/api/auth.ts`, register it in `AUTH_STRATEGIES`, and point the plugin's
`authStrategyId` at it. Callers never change — the client resolves the strategy
from the detected plugin.

## 4. Command name differences (optional)

If a family renames a field, provide `commandAliases`:

```ts
commandAliases: { lte_snr: 'lte_sinr' },
```

## 5. Capabilities vs. discovery

Static `capabilities()` is the baseline that hides unsupported UI. Runtime
discovery (the reverse-engineering engine) then refines what is actually
available on the specific firmware. Prefer discovery; use capabilities only for
coarse gating.

That's it — no duplicated transport or parsing logic. See
[REVERSE_ENGINEERING_GUIDE.md](REVERSE_ENGINEERING_GUIDE.md) for how commands are
discovered.
