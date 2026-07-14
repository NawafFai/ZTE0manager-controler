import type { GoformClient } from '@/api';
import { sha256Upper } from '@/api/crypto';

/**
 * Native router login, matching the stock web UI exactly (verified in util.js /
 * service.js on the reference MC801A1):
 *
 *   SHA256(x) returns UPPERCASE hex   (util.js: hex table flag d = 1)
 *   paswordAlgorithmsCookie(x) = SHA256(x)
 *   LD  = GET goform_get_cmd_process?cmd=LD           // per-attempt salt (uppercase)
 *   password = SHA256( SHA256(rawPassword) + LD )     // WEB_ATTR_IF_SUPPORT_SHA256 = 2
 *   POST goformId=LOGIN, password=<hash>
 *
 * Doing this in-app (instead of a separate router-login window) guarantees the
 * resulting session lives in the same request context that performs every other
 * call — which is why band/cell locks were failing before.
 *
 * Result codes (verified in service.js): "0"/"4" = success; "2" = another user
 * already logged in (duplicateUser); "3" = wrong password (badPassword);
 * "1" = login fail; "5" = not logged in.
 */

export interface LoginResult {
  ok: boolean;
  code: string | undefined;
}

export async function login(client: GoformClient, password: string): Promise<LoginResult> {
  const ld = (await client.getValue('LD')) ?? '';
  // Both SHA-256 passes use UPPERCASE hex (matches the router's own JS).
  const hashed = sha256Upper(sha256Upper(password) + ld);
  const res = await client.set({ goformId: 'LOGIN', params: { password: hashed } });
  const code = res.result;
  return { ok: code === '0' || code === '4', code };
}

export async function logout(client: GoformClient): Promise<void> {
  try {
    await client.set({ goformId: 'LOGOUT' });
  } catch {
    /* best effort */
  }
}

const LOGIN_MESSAGES: Record<string, string> = {
  '1': 'Login failed',
  '2': 'Another user is already logged in (log out the router web page / other device first)',
  '3': 'Wrong password',
  '5': 'Session expired — try again',
};

export function loginErrorMessage(code: string | undefined): string {
  return (code && LOGIN_MESSAGES[code]) || 'Login failed';
}
