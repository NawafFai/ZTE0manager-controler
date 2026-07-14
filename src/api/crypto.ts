import CryptoJS from 'crypto-js';

/**
 * Thin wrappers over the hashes the ZTE firmware uses. Kept in one place so the
 * exact primitives are auditable and swappable if a firmware differs.
 */

export function md5(input: string): string {
  return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
}

export function sha256(input: string): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex);
}

export function md5Upper(input: string): string {
  return md5(input).toUpperCase();
}

export function sha256Upper(input: string): string {
  return sha256(input).toUpperCase();
}
