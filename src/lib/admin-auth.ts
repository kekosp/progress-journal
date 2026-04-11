// ─── Admin Auth ───────────────────────────────────────────────────────────────
// Simple admin credentials stored in localStorage (hashed with PBKDF2).

const ADMIN_KEY = 'admin-auth';
const PBKDF2_ITERATIONS = 100_000;

interface AdminStore {
  usernameHash: string;
  passwordHash: string;
  salt: string;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

async function hash(value: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return bufToHex(bits);
}

export function isAdminSetup(): boolean {
  return !!localStorage.getItem(ADMIN_KEY);
}

export async function setupAdmin(username: string, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bufToHex(salt.buffer);
  const store: AdminStore = {
    usernameHash: await hash(username, salt),
    passwordHash: await hash(password, salt),
    salt: saltHex,
  };
  localStorage.setItem(ADMIN_KEY, JSON.stringify(store));
}

export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return false;
  try {
    const store = JSON.parse(raw) as AdminStore;
    const salt = hexToBuf(store.salt);
    const uHash = await hash(username, salt);
    const pHash = await hash(password, salt);
    return uHash === store.usernameHash && pHash === store.passwordHash;
  } catch {
    return false;
  }
}

export function removeAdmin(): void {
  localStorage.removeItem(ADMIN_KEY);
}
