# API Reference

The complete, per-command reference is **auto-generated** from the live
reverse-engineering database — it is not hand-maintained here (so it never drifts
out of date). Generate it from the app:

> **API Explorer → Export docs** → `zte-api-reference.md`

or programmatically:

```ts
import { generateApiMarkdown } from '@/reverse/docgen';
import { runDiscovery } from '@/reverse/engine';

const { database } = await runDiscovery({ baseUrl: '' });
const markdown = generateApiMarkdown(database);
```

## Transport

Two endpoints carry every command:

| Method | URL | Purpose |
| --- | --- | --- |
| GET | `/goform/goform_get_cmd_process?cmd=<names>&multi_data=1` | read |
| POST | `/goform/goform_set_cmd_process` (`goformId=<action>&…&AD=…`) | action |

Reads return a flat JSON string map. Writes return `{ result: "success" | … }`.

## Authentication

State-changing POSTs are signed:

```
RD  = GET goform_get_cmd_process?cmd=RD           # fresh nonce per request
AD  = MD5( MD5(wa_inner_version + hardware_version) + RD )   # classic strategy
```

The algorithm is isolated behind `AuthStrategy` (`src/api/auth.ts`) so firmware
variants override it without touching callers.

## Verified commands (seed)

See [KNOWN_DISCOVERIES.md](../KNOWN_DISCOVERIES.md) for the authoritative,
experimentally-verified list (GET commands, the two verified goformIds
`LTE_LOCK_CELL_SET` and `WAN_PERFORM_NR5G_BAND_LOCK`, and inferred goformIds).

## Confidence levels

| Level | Meaning |
| --- | --- |
| `verified` | Confirmed experimentally or corroborated by seed + discovery |
| `inferred` | Present in firmware JS; semantics/params not yet confirmed |
| `experimental` | Discovered as a candidate literal; treat with caution |

Mutating commands are flagged and gated in the UI regardless of confidence.
