// Emergency reset: clears every password/credential gate in the app.
// - App lock (PIN / password)
// - Admin (activity log) credentials
// - Encrypted vault (data is unrecoverable without master password anyway)
// - Lockout / attempts counter
//
// Reports, inventory, maintenance, settings are NOT touched.
import { removeAuth } from './auth';
import { removeAdmin } from './admin-auth';
import { destroyVault } from './vault-storage';

export function resetAllPasswords(): void {
  try { removeAuth(); } catch { /* ignore */ }
  try { removeAdmin(); } catch { /* ignore */ }
  try { destroyVault(); } catch { /* ignore */ }
  try { localStorage.removeItem('lock-attempts'); } catch { /* ignore */ }
}