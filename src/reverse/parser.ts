import type { ApiCommand, ApiMethod } from '@/types';
import { classifyCommand } from './classifier';

/**
 * Static extractor for the hidden API surface inside router JavaScript.
 *
 * We deliberately use a set of focused, well-understood regexes rather than a
 * full AST parse: the firmware bundles are minified and non-standard, and the
 * surface we care about (goformId + cmd string literals) is lexically regular.
 * Every match is attributed back to the file it came from for traceability.
 *
 * Nothing here is model-specific and no command names are assumed — we only
 * report what literally appears in the shipped code.
 */

export interface ParseInput {
  file: string;
  content: string;
}

/**
 * Keyword patterns from the project spec used to flag interesting literals.
 * Case-insensitive: GET command tokens are lower_snake (`nr5g_action_band`)
 * while POST actions are UPPER_SNAKE (`LTE_LOCK_CELL_SET`).
 */
const INTEREST = [
  /LTE_/i,
  /NR5?G/i,
  /BAND/i,
  /LOCK/i,
  /CELL/i,
  /PCI/i,
  /EARFCN/i,
  /ARFCN/i,
  /_RF_|_RF$|^RF_/i,
  /ANTENNA/i,
];

// POST action ids: UPPER_SNAKE, e.g. LTE_LOCK_CELL_SET.
const GOFORM_PATTERNS = [
  /goformId\s*[:=]\s*["']([A-Z][A-Z0-9_]{2,})["']/g,
  /["']goformId["']\s*:\s*["']([A-Z][A-Z0-9_]{2,})["']/g,
  /goformId=([A-Z][A-Z0-9_]{2,})/g,
];

// GET commands: lower_snake_case, e.g. lte_pci, nr5g_action_band.
const CMD_PATTERNS = [
  /[?&]cmd=([a-z][a-z0-9_,]{2,})/g,
  /\bcmd\s*[:=]\s*["']([a-z][a-z0-9_,]{2,})["']/g,
];

// String literals that look like command tokens (used to catch cmd arrays).
const STRING_LITERAL = /["']([A-Za-z][A-Za-z0-9_]{3,})["']/g;

function addMatches(
  content: string,
  patterns: RegExp[],
  onMatch: (token: string) => void,
): void {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      const captured = m[1];
      if (captured) onMatch(captured);
    }
  }
}

interface Accumulator {
  method: ApiMethod;
  files: Set<string>;
}

export function parseJavaScript(inputs: ParseInput[]): ApiCommand[] {
  const found = new Map<string, Accumulator>();

  const record = (id: string, method: ApiMethod, file: string) => {
    const key = `${method}:${id}`;
    let acc = found.get(key);
    if (!acc) {
      acc = { method, files: new Set() };
      found.set(key, acc);
    }
    acc.files.add(file);
  };

  for (const { file, content } of inputs) {
    addMatches(content, GOFORM_PATTERNS, (token) => record(token, 'POST', file));

    addMatches(content, CMD_PATTERNS, (tokens) => {
      // `cmd=a,b,c` is a multi-read; split into individual commands.
      for (const token of tokens.split(',')) {
        if (token) record(token, 'GET', file);
      }
    });

    // Interesting string literals (band/cell/pci/etc.) that look like GET cmd
    // tokens but weren't captured via an explicit `cmd=` — treat as candidates.
    STRING_LITERAL.lastIndex = 0;
    let lit: RegExpExecArray | null;
    while ((lit = STRING_LITERAL.exec(content)) !== null) {
      const token = lit[1]!;
      const isCmdShaped = /^[a-z][a-z0-9_]+$/.test(token) && token.includes('_');
      const isActionShaped = /^[A-Z][A-Z0-9_]+$/.test(token) && token.includes('_');
      if (!isCmdShaped && !isActionShaped) continue;
      if (!INTEREST.some((p) => p.test(token))) continue;
      record(token, isActionShaped ? 'POST' : 'GET', file);
    }
  }

  const commands: ApiCommand[] = [];
  for (const [key, acc] of found) {
    const id = key.slice(key.indexOf(':') + 1);
    commands.push({
      id,
      method: acc.method,
      category: classifyCommand(id),
      confidence: 'experimental',
      source: 'discovered',
      mutating: acc.method === 'POST',
      params: [],
      foundIn: [...acc.files],
    });
  }
  return commands;
}
