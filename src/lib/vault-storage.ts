// ─── Vault Storage ────────────────────────────────────────────────────────────
// Encrypted credential vault. Stored as a single AES-GCM blob in localStorage.
// The decrypted entries live only in memory while the vault is unlocked.

import {
  CipherBlob,
  decryptJson,
  deriveKey,
  encryptJson,
  newSalt,
  saltFromB64,
  saltToB64,
} from './vault-crypto';
import type { ReportImage } from '@/types/report';

const VAULT_META_KEY = 'vault-meta';   // { salt, verifier }
const VAULT_DATA_KEY = 'vault-data';   // CipherBlob of CredentialEntry[]

export interface CredentialEntry {
  id: string;
  label: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  images?: ReportImage[];
  createdAt: string;
  updatedAt: string;
}

interface VaultMeta {
  salt: string;          // base64
  verifier: CipherBlob;  // encrypted known plaintext to validate the password
}

const VERIFIER_PLAINTEXT = 'vault-ok';

export function isVaultSetup(): boolean {
  return !!localStorage.getItem(VAULT_META_KEY);
}

/**
 * True when an encrypted data blob exists. Used to block re-initialization
 * attacks where `vault-meta` is deleted to force the setup screen — that would
 * silently overwrite (destroy) the existing encrypted credentials.
 */
export function hasVaultData(): boolean {
  return !!localStorage.getItem(VAULT_DATA_KEY);
}

function getMeta(): VaultMeta | null {
  const raw = localStorage.getItem(VAULT_META_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as VaultMeta; } catch { return null; }
}

/**
 * Create the vault for the first time. Derives a key from the master password,
 * encrypts a verifier blob, and writes an empty encrypted entry list.
 */
export async function setupVault(masterPassword: string): Promise<CryptoKey> {
  if (localStorage.getItem(VAULT_DATA_KEY)) {
    throw new Error(
      'An encrypted vault already exists on this device. Creating a new vault would destroy it. Restore the original master password, or use "Reset vault" to delete the existing data first.'
    );
  }
  const salt = newSalt();
  const key = await deriveKey(masterPassword, salt);
  const verifier = await encryptJson(key, VERIFIER_PLAINTEXT);
  const meta: VaultMeta = { salt: saltToB64(salt), verifier };
  localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
  const empty = await encryptJson(key, [] as CredentialEntry[]);
  localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(empty));
  return key;
}

/**
 * Verify the master password and return a decryption key.
 * Returns null if the password is wrong.
 */
export async function unlockVault(masterPassword: string): Promise<CryptoKey | null> {
  const meta = getMeta();
  if (!meta) return null;
  try {
    const salt = saltFromB64(meta.salt);
    const key = await deriveKey(masterPassword, salt);
    const check = await decryptJson<string>(key, meta.verifier);
    if (check !== VERIFIER_PLAINTEXT) return null;
    return key;
  } catch {
    return null;
  }
}

export async function readEntries(key: CryptoKey): Promise<CredentialEntry[]> {
  const raw = localStorage.getItem(VAULT_DATA_KEY);
  if (!raw) return [];
  try {
    const blob = JSON.parse(raw) as CipherBlob;
    return await decryptJson<CredentialEntry[]>(key, blob);
  } catch {
    return [];
  }
}

export async function writeEntries(key: CryptoKey, entries: CredentialEntry[]): Promise<void> {
  const blob = await encryptJson(key, entries);
  localStorage.setItem(VAULT_DATA_KEY, JSON.stringify(blob));
}

/** Change the master password by re-encrypting the verifier and the data with a new key. */
export async function changeMasterPassword(currentKey: CryptoKey, newPassword: string): Promise<CryptoKey> {
  const entries = await readEntries(currentKey);
  const salt = newSalt();
  const newKey = await deriveKey(newPassword, salt);
  const verifier = await encryptJson(newKey, VERIFIER_PLAINTEXT);
  localStorage.setItem(VAULT_META_KEY, JSON.stringify({ salt: saltToB64(salt), verifier } as VaultMeta));
  await writeEntries(newKey, entries);
  return newKey;
}

/** WARNING: destroys the entire vault and all credentials. */
export function destroyVault(): void {
  localStorage.removeItem(VAULT_META_KEY);
  localStorage.removeItem(VAULT_DATA_KEY);
}

export function makeEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}