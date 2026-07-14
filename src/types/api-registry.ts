/**
 * The API registry is the heart of the "don't hardcode APIs" principle.
 * Commands come from three sources that are merged by confidence:
 *   1. `seed`      — curated knowledge from the .md knowledge base (verified).
 *   2. `discovered`— extracted automatically from the router's JavaScript.
 *   3. `observed`  — seen live in the API console / developer network log.
 */

export type ApiMethod = 'GET' | 'POST';

/** Functional classification used to group commands in the UI. */
export type ApiCategory =
  | 'device'
  | 'network'
  | 'lte'
  | 'nr5g'
  | 'signal'
  | 'wifi'
  | 'firewall'
  | 'vpn'
  | 'sms'
  | 'sim'
  | 'voip'
  | 'thermal'
  | 'diagnostics'
  | 'engineering'
  | 'factory'
  | 'auth'
  | 'experimental';

export type ApiSource = 'seed' | 'discovered' | 'observed';

/** Confidence that the command exists and its metadata is correct. */
export type ApiConfidence = 'verified' | 'inferred' | 'experimental';

export interface ApiParam {
  name: string;
  required: boolean;
  description?: string;
  example?: string;
}

export interface ApiCommand {
  /** GET command name (`cmd=`) or POST action (`goformId=`). */
  id: string;
  method: ApiMethod;
  category: ApiCategory;
  confidence: ApiConfidence;
  source: ApiSource;
  params: ApiParam[];
  description?: string;
  /** Files the command was found in, for traceability. */
  foundIn?: string[];
  /** Free-form notes (e.g. captured example value). */
  notes?: string;
  /** True if the command mutates router state (used to gate destructive UI). */
  mutating?: boolean;
}

/** The merged, queryable database the app works against. */
export interface ApiDatabase {
  generatedAt: number;
  /** Firmware fingerprint this DB was built against, when known. */
  firmware?: string;
  commands: ApiCommand[];
}
