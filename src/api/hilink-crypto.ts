import CryptoJS from 'crypto-js';

/**
 * Huawei HiLink SCRAM login primitives (password_type 4, used by the
 * 5G CPE 5 / H155 family).
 *
 * Verified BYTE-FOR-BYTE against the device's own `emui-crypto.js`
 * (CryptoJS.SCRAM) by running its clientProof() and matching output — this
 * firmware's SCRAM is NON-standard in BOTH HMAC calls (key/message swapped vs
 * RFC 5802), and the two swaps are in OPPOSITE directions, so both must match
 * the vendor exactly:
 *
 *   SaltedPassword  = PBKDF2-SHA256(password, hex(salt), iterations, 32 bytes)
 *   ClientKey       = HMAC-SHA256(key="Client Key", msg=SaltedPassword)
 *   StoredKey       = SHA256(ClientKey)
 *   AuthMessage     = firstNonce + "," + serverNonce + "," + serverNonce
 *   ClientSignature = HMAC-SHA256(key=AuthMessage, msg=StoredKey)   // <-- key IS the auth message here
 *   ClientProof     = hex(ClientKey XOR ClientSignature)
 *
 * (emui-crypto's `signature(storedKey, authMessage)` maps to CryptoJS
 * HmacSHA256(message=storedKey, key=authMessage) — hence key=AuthMessage.)
 */

/** 32 random bytes as 64 lowercase hex chars — the SCRAM client nonce. */
export function randomHexNonce(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

export function scramClientProof(
  password: string,
  firstNonce: string,
  serverNonce: string,
  saltHex: string,
  iterations: number,
): string {
  const salted = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  // CryptoJS.HmacSHA256(message, key). ClientKey: key="Client Key", msg=salted.
  const clientKey = CryptoJS.HmacSHA256(salted, 'Client Key');
  const storedKey = CryptoJS.SHA256(clientKey);
  const authMessage = `${firstNonce},${serverNonce},${serverNonce}`;
  // ClientSignature: msg=storedKey, key=authMessage — matches emui-crypto's
  // signature(storedKey, authMessage). Getting this order wrong yields a
  // well-formed but rejected proof (router answers 108006 "wrong password").
  const signature = CryptoJS.HmacSHA256(storedKey, authMessage);

  const words = clientKey.words.map((w, i) => w ^ (signature.words[i] ?? 0));
  return CryptoJS.lib.WordArray.create(words, clientKey.sigBytes).toString(CryptoJS.enc.Hex);
}
