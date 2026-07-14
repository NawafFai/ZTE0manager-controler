import { md5 } from './crypto';

/**
 * ZTE CSRF-style request signing.
 *
 * Verified directly from the reference MC801A1 `service.js`:
 *
 *     a  = hex_md5(wa_inner_version + cr_version)   // rd_params0 + rd_params1
 *     AD = hex_md5(a + RD)                          // RD read fresh per request
 *
 * i.e. AD = MD5( MD5(wa_inner_version + cr_version) + RD ). The two version
 * strings are read via GET (and require an authenticated session to be
 * non-empty). This lives behind a strategy interface so other firmware families
 * can override it without changing any caller.
 */

export interface AuthInputs {
  rd: string;
  waInnerVersion: string;
  crVersion: string;
}

export interface AuthStrategy {
  readonly id: string;
  computeAd(inputs: AuthInputs): string;
}

/** Verified ZTE algorithm: MD5(MD5(wa_inner_version + cr_version) + RD). */
export const classicZteAuth: AuthStrategy = {
  id: 'classic-zte',
  computeAd({ rd, waInnerVersion, crVersion }: AuthInputs): string {
    const versionHash = md5(waInnerVersion + crVersion);
    return md5(versionHash + rd);
  },
};

/** Alternate ordering observed on some builds (cr_version first). */
export const swappedZteAuth: AuthStrategy = {
  id: 'swapped-zte',
  computeAd({ rd, waInnerVersion, crVersion }: AuthInputs): string {
    const versionHash = md5(crVersion + waInnerVersion);
    return md5(versionHash + rd);
  },
};

export const AUTH_STRATEGIES: Record<string, AuthStrategy> = {
  [classicZteAuth.id]: classicZteAuth,
  [swappedZteAuth.id]: swappedZteAuth,
};
