/**
 * Low-level transport types for the ZTE `goform` API.
 *
 * The router exposes exactly two endpoints:
 *   GET  /goform/goform_get_cmd_process   (read)
 *   POST /goform/goform_set_cmd_process   (action)
 *
 * Reads return a flat JSON object of string values. Writes return a small
 * status object. These types intentionally stay close to the wire format;
 * higher layers (services, signal engine) map them into domain models.
 */

/** A raw GET response: every value the firmware returns is a string. */
export type GoformGetResult = Record<string, string>;

/** Result of a POST action command. `result` is usually "success"/"failure". */
export interface GoformSetResult {
  result?: string;
  [key: string]: string | undefined;
}

/** Parameters for a read. When `multi` is true we request `multi_data=1`. */
export interface GetCommandRequest {
  /** One or more command names to read in a single round-trip. */
  cmd: string | string[];
  /** Force `multi_data=1` even for a single command. */
  multi?: boolean;
}

/** Parameters for an action command. */
export interface SetCommandRequest {
  goformId: string;
  /** Extra form fields (already stringified). */
  params?: Record<string, string | number>;
  /** When false, skip attaching the RD/AD CSRF tokens (rarely needed). */
  authenticated?: boolean;
  /** When false, do NOT retry on a `{"result":"failure"}` (used for probing). */
  retry?: boolean;
}

export class GoformError extends Error {
  constructor(
    message: string,
    readonly context: {
      endpoint: string;
      command?: string;
      goformId?: string;
      status?: number;
      body?: string;
    },
  ) {
    super(message);
    this.name = 'GoformError';
  }
}
