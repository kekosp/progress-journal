// ─── Auth ─────────────────────────────────────────────────────────────────────
// PIN/password are stored using PBKDF2 with a random salt.

const AUTH_KEY = 'app-auth';

export type AuthMethod = 'pin' | 'password';

interface AuthStore {
  method: AuthMethod;
  hash: string;   // hex-encoded PBKDF2 derived key
  salt: string;   // hex-encoded random salt
}

const PBKDF2_ITERATIONS = 100_000;

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

export function isAuthEnabled(): boolean {
  return !!localStorage.getItem(AUTH_KEY);
}

export function getAuthMethod(): AuthMethod | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as AuthStore).method;
  } catch {
    return null;
  }
}

export async function setupAuth(method: AuthMethod, secret: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(secret, salt);
  const store: AuthStore = { method, hash, salt: bufToHex(salt.buffer) };
  localStorage.setItem(AUTH_KEY, JSON.stringify(store));
}

export async function verifyAuth(secret: string): Promise<boolean> {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return true; // no auth set up
  try {
    const store = JSON.parse(raw) as AuthStore;
    // Migration: old entries without salt used plain SHA-256
    if (!store.salt) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const oldHash = bufToHex(buf);
      if (oldHash === store.hash) {
        // Re-hash with PBKDF2 on successful login
        await setupAuth(store.method, secret);
        return true;
      }
      return false;
    }
    const salt = hexToBuf(store.salt);
    const hash = await deriveKey(secret, salt);
    return hash === store.hash;
  } catch {
    return false;
  }
}

export function removeAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}
