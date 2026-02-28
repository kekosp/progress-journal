// ─── Auth ─────────────────────────────────────────────────────────────────────
// PIN/password are never stored in plain text.
// We store a SHA-256 hex hash + the chosen method.

const AUTH_KEY = 'app-auth';

export type AuthMethod = 'pin' | 'password';

interface AuthStore {
  method: AuthMethod;
  hash: string; // SHA-256 hex of the PIN or password
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
  const hash = await sha256(secret);
  const store: AuthStore = { method, hash };
  localStorage.setItem(AUTH_KEY, JSON.stringify(store));
}

export async function verifyAuth(secret: string): Promise<boolean> {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return true; // no auth set up
  try {
    const store = JSON.parse(raw) as AuthStore;
    const hash = await sha256(secret);
    return hash === store.hash;
  } catch {
    return false;
  }
}

export function removeAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}
