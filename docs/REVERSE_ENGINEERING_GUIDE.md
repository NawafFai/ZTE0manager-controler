# Reverse Engineering Guide

How the app automatically discovers the router's hidden API, and how to extend
the engine. The pipeline lives in `src/reverse/`.

## Pipeline

```
crawl JS  →  parse commands  →  classify  →  merge with seed  →  persist  →  diff
 crawler       parser           classifier    database          cache      diff
```

1. **Crawler** (`crawler.ts`) — starts from the router index page and the known
   seed files (`service.js`, `main.js`, `app.js`), then follows `<script src>`
   and `.js` references one hop. All fetches go through the same-origin proxy so
   nothing leaves localhost. Capped at 60 files.

2. **Parser** (`parser.ts`) — focused regexes extract:
   - `goformId` POST actions (`UPPER_SNAKE`),
   - `cmd=` GET commands (`lower_snake`, multi-reads split on comma),
   - interesting string literals matching the spec keywords
     (`LTE_`, `NR5G`, `BAND`, `LOCK`, `CELL`, `PCI`, `EARFCN`, `ARFCN`, `RF`,
     `ANTENNA`) as experimental candidates.
   Every match is attributed to the file it came from.

3. **Classifier** (`classifier.ts`) — heuristically buckets each command into a
   category (`lte`, `nr5g`, `wifi`, `vpn`, `sms`, `factory`, `experimental`, …).

4. **Database merge** (`database.ts`) — combines three sources by confidence:
   - `seed` — curated, verified knowledge (`knowledge/seed.ts`, mirrors the
     `.md` knowledge base),
   - `discovered` — from the JS parse,
   - `observed` — seen live in the console/network log.
   A command corroborated by both seed and discovery is promoted to `verified`.

5. **Cache** (`cache.ts`) — snapshots are stored in `localStorage`, keyed by
   firmware, so a firmware/SIM change creates a new record instead of clobbering.

6. **Diff** (`diff.ts`) — compares the new database against the previous snapshot
   and reports added / removed / changed commands.

7. **Docgen** (`docgen.ts`) — renders the database to Markdown for export.

## Running discovery

- UI: **API Explorer → Discover APIs**.
- Programmatic:

```ts
import { runDiscovery } from '@/reverse/engine';
const { database, diff, crawledFiles, errors } = await runDiscovery({
  baseUrl: '',
  firmware: 'BD_SASTCEMC801A1V1.0.0B01',
});
```

## Extending the parser

The current parser is lexical (regex) because firmware bundles are minified and
non-standard. To recover **parameter lists per goformId**, add an optional
acorn-based AST pass behind the same `parseJavaScript(inputs) => ApiCommand[]`
signature and merge its params in — no downstream change required. This is the
top "Next up" item in [ROADMAP.md](../ROADMAP.md).

## Keeping knowledge honest

When you verify a command experimentally, update **both**
[KNOWN_DISCOVERIES.md](../KNOWN_DISCOVERIES.md) and
[REVERSE_ENGINEERING_NOTES.md](../REVERSE_ENGINEERING_NOTES.md), and mirror it in
`src/reverse/knowledge/seed.ts`. Prefer experimentally verified results over
assumptions; mark anything unverified as `inferred`/`experimental`.
