import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

/** Where fingerprint unlock can be used. Each scope keeps its own secret in the Android Keystore. */
export type BiometricScope = 'app' | 'admin' | 'vault';

const SERVER = (s: BiometricScope) => `pvp-reports.${s}`;
const FLAG = (s: BiometricScope) => `biometric-enabled-${s}`;

const TITLES: Record<BiometricScope, string> = {
  app: 'Unlock PVP Reports',
  admin: 'Admin login',
  vault: 'Unlock Vault',
};

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await NativeBiometric.isAvailable();
    return r.isAvailable;
  } catch {
    return false;
  }
}

export function isBiometricEnabled(scope: BiometricScope): boolean {
  return localStorage.getItem(FLAG(scope)) === '1';
}

/** Store the secret behind the fingerprint. Only call after the password was verified. */
export async function enableBiometric(scope: BiometricScope, username: string, password: string): Promise<boolean> {
  try {
    await NativeBiometric.setCredentials({ server: SERVER(scope), username: username || scope, password });
    localStorage.setItem(FLAG(scope), '1');
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometric(scope: BiometricScope): Promise<void> {
  localStorage.removeItem(FLAG(scope));
  try { await NativeBiometric.deleteCredentials({ server: SERVER(scope) }); } catch { /* ignore */ }
}

/** Ask for a fingerprint and return the stored secret, or null if cancelled/failed. */
export async function unlockWithBiometric(scope: BiometricScope): Promise<{ username: string; password: string } | null> {
  if (!isBiometricEnabled(scope)) return null;
  try {
    await NativeBiometric.verifyIdentity({
      title: TITLES[scope],
      subtitle: 'Use your fingerprint',
      negativeButtonText: 'Use password',
    });
    const c = await NativeBiometric.getCredentials({ server: SERVER(scope) });
    return { username: c.username, password: c.password };
  } catch {
    return null;
  }
}

/** React helper used by every lock screen. */
export function useBiometric(scope: BiometricScope) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(() => isBiometricEnabled(scope));
  const [optIn, setOptIn] = useState(true);

  useEffect(() => { isBiometricAvailable().then(setAvailable); }, []);

  const unlock = useCallback(() => unlockWithBiometric(scope), [scope]);

  /** Call after a successful password unlock. */
  const afterPasswordSuccess = useCallback(async (username: string, password: string) => {
    if (!available) return;
    if (enabled || optIn) {
      const ok = await enableBiometric(scope, username, password);
      setEnabled(ok);
    }
  }, [available, enabled, optIn, scope]);

  /** Call when the stored secret no longer works (e.g. password changed). */
  const reset = useCallback(async () => {
    await disableBiometric(scope);
    setEnabled(false);
  }, [scope]);

  return { available, enabled: available && enabled, optIn, setOptIn, unlock, afterPasswordSuccess, reset };
}
