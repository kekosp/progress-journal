// ─── Vault Crypto ─────────────────────────────────────────────────────────────
// AES-256-GCM encryption with PBKDF2 key derivation (100k iterations).
// The master key is NEVER persisted — derived on demand from the master password.

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export function saltToB64(salt: Uint8Array): string {
  return bufToB64(salt);
}

export function saltFromB64(b64: string): Uint8Array {
  return b64ToBuf(b64);
}

export interface CipherBlob {
  iv: string;     // base64
  data: string;   // base64 (ciphertext + auth tag)
}

export async function encryptJson(key: CryptoKey, payload: unknown): Promise<CipherBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext);
  return { iv: bufToB64(iv), data: bufToB64(ct) };
}

export async function decryptJson<T = unknown>(key: CryptoKey, blob: CipherBlob): Promise<T> {
  const iv = b64ToBuf(blob.iv);
  const ct = b64ToBuf(blob.data);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}