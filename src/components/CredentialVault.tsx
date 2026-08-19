import { useState, useEffect, useRef, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import {
  CredentialEntry,
  isVaultSetup,
  hasVaultData,
  setupVault,
  unlockVault,
  readEntries,
  writeEntries,
  changeMasterPassword,
  destroyVault,
  makeEntryId,
} from '@/lib/vault-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { InventoryPhotoField } from '@/components/InventoryPhotoField';
import { ImageLightbox } from '@/components/ImageLightbox';
import {
  KeyRound, Lock, Eye, EyeOff, Plus, Pencil, Trash2, Copy, ShieldAlert,
  Search, RotateCw, AlertCircle, Settings,
} from 'lucide-react';

const AUTO_LOCK_MS = 2 * 60 * 1000; // 2 minutes of inactivity
const MIN_PW_LEN = 8;

// ── Brute-force protection (mirrors AdminGate) ────────────────────────────────
const VAULT_LOCKOUT_KEY = 'vault-lock-attempts';
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_SECONDS = 30;
const MAX_LOCKOUT_SECONDS = 900;

interface LockoutState { attempts: number; lockedUntil: number | null; }

function readLockout(): LockoutState {
  try {
    const raw = localStorage.getItem(VAULT_LOCKOUT_KEY);
    if (raw) return JSON.parse(raw) as LockoutState;
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: null };
}
function writeLockout(s: LockoutState) { localStorage.setItem(VAULT_LOCKOUT_KEY, JSON.stringify(s)); }
function clearLockout() { localStorage.removeItem(VAULT_LOCKOUT_KEY); }

type Mode = 'setup' | 'unlock' | 'unlocked';

export function CredentialVault() {
  const [mode, setMode] = useState<Mode>(isVaultSetup() ? 'unlock' : 'setup');
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [entries, setEntries] = useState<CredentialEntry[]>([]);
  const [search, setSearch] = useState('');

  // Setup / unlock form state
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Brute-force lockout state
  const initialLock = readLockout();
  const [attempts, setAttempts] = useState(initialLock.attempts);
  const [lockedUntil, setLockedUntil] = useState<number | null>(initialLock.lockedUntil);
  const [lockTimer, setLockTimer] = useState(0);
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  // Entry editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialEntry | null>(null);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [destroyConfirm, setDestroyConfirm] = useState(false);

  // Revealed password ids
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // Image preview lightbox
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Lock helpers ────────────────────────────────────────────────────────────
  const lock = useCallback(() => {
    setKey(null);
    setEntries([]);
    setRevealed(new Set());
    setPw('');
    setPw2('');
    setErr('');
    setMode(isVaultSetup() ? 'unlock' : 'setup');
  }, []);

  // Auto-lock on inactivity
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (mode !== 'unlocked') return;
    idleTimer.current = setTimeout(() => {
      lock();
      toast({ title: '🔒 Vault locked', description: 'Auto-locked after inactivity.' });
    }, AUTO_LOCK_MS);
  }, [mode, lock]);

  useEffect(() => {
    if (mode !== 'unlocked') return;
    resetIdle();
    const evts: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    evts.forEach(e => document.addEventListener(e, resetIdle));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      evts.forEach(e => document.removeEventListener(e, resetIdle));
    };
  }, [mode, resetIdle]);

  // Lock when app goes to background
  useEffect(() => {
    let handler: { remove: () => void } | undefined;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && key) lock();
    }).then(h => { handler = h; });
    return () => { handler?.remove(); };
  }, [key, lock]);

  // ── Setup / unlock submit ───────────────────────────────────────────────────
  // Countdown ticker while locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { setLockTimer(0); setLockedUntil(null); setErr(''); }
      else setLockTimer(remaining);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (pw.length < MIN_PW_LEN) { setErr(`Master password must be at least ${MIN_PW_LEN} characters.`); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const k = await setupVault(pw);
      setKey(k);
      setEntries([]);
      setPw(''); setPw2('');
      clearLockout();
      setMode('unlocked');
      toast({ title: '✅ Vault created', description: 'Your encrypted vault is ready.' });
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to create vault.');
    } finally { setBusy(false); }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (isLocked) {
      setErr(`Too many attempts. Wait ${lockTimer} seconds.`);
      return;
    }
    setBusy(true);
    try {
      const k = await unlockVault(pw);
      if (!k) {
        const next = attempts + 1;
        setAttempts(next);
        setPw('');
        if (next % MAX_ATTEMPTS === 0) {
          const multiplier = Math.pow(2, Math.floor(next / MAX_ATTEMPTS) - 1);
          const seconds = Math.min(BASE_LOCKOUT_SECONDS * multiplier, MAX_LOCKOUT_SECONDS);
          const until = Date.now() + seconds * 1000;
          setLockedUntil(until);
          writeLockout({ attempts: next, lockedUntil: until });
          setErr(`Too many attempts. Wait ${seconds} seconds.`);
        } else {
          writeLockout({ attempts: next, lockedUntil: null });
          const left = MAX_ATTEMPTS - (next % MAX_ATTEMPTS);
          setErr(`Incorrect master password. ${left} attempt${left !== 1 ? 's' : ''} left.`);
        }
        return;
      }
      const list = await readEntries(k);
      setKey(k);
      setEntries(list);
      setPw('');
      setAttempts(0);
      setLockedUntil(null);
      clearLockout();
      setMode('unlocked');
    } catch {
      setErr('Failed to unlock vault.');
    } finally { setBusy(false); }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditing({
      id: '', label: '', username: '', password: '', url: '', notes: '', images: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    setEditorOpen(true);
  }
  function openEdit(entry: CredentialEntry) {
    setEditing({ ...entry });
    setEditorOpen(true);
  }

  async function saveEntry() {
    if (!key || !editing) return;
    if (!editing.label.trim()) { toast({ title: 'Label required', variant: 'destructive' }); return; }
    const now = new Date().toISOString();
    let next: CredentialEntry[];
    if (editing.id) {
      next = entries.map(e => e.id === editing.id ? { ...editing, updatedAt: now } : e);
    } else {
      next = [...entries, { ...editing, id: makeEntryId(), createdAt: now, updatedAt: now }];
    }
    try {
      await writeEntries(key, next);
      setEntries(next);
      setEditorOpen(false);
      setEditing(null);
      toast({ title: '✅ Saved' });
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e?.message, variant: 'destructive' });
    }
  }

  async function deleteEntry(id: string) {
    if (!key) return;
    const next = entries.filter(e => e.id !== id);
    try {
      await writeEntries(key, next);
      setEntries(next);
      toast({ title: '🗑️ Deleted' });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message, variant: 'destructive' });
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `📋 ${label} copied`, description: 'Cleared from clipboard in 30s.' });
      setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
      }, 30_000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  function toggleReveal(id: string) {
    setRevealed(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // ── Settings: change master password / destroy vault ────────────────────────
  const [cpwOld, setCpwOld] = useState('');
  const [cpwNew, setCpwNew] = useState('');
  const [cpwNew2, setCpwNew2] = useState('');
  const [cpwErr, setCpwErr] = useState('');

  async function handleChangeMaster() {
    setCpwErr('');
    if (!key) return;
    if (cpwNew.length < MIN_PW_LEN) { setCpwErr(`New password must be at least ${MIN_PW_LEN} characters.`); return; }
    if (cpwNew !== cpwNew2) { setCpwErr('New passwords do not match.'); return; }
    const check = await unlockVault(cpwOld);
    if (!check) { setCpwErr('Current password is incorrect.'); return; }
    try {
      const newKey = await changeMasterPassword(key, cpwNew);
      setKey(newKey);
      setCpwOld(''); setCpwNew(''); setCpwNew2('');
      setSettingsOpen(false);
      toast({ title: '✅ Master password updated' });
    } catch (e: any) {
      setCpwErr(e?.message ?? 'Failed to change password.');
    }
  }

  function handleDestroy() {
    destroyVault();
    clearLockout();
    setAttempts(0);
    setLockedUntil(null);
    setDestroyConfirm(false);
    setSettingsOpen(false);
    lock();
    toast({ title: '🗑️ Vault destroyed', description: 'All credentials have been erased.' });
  }

  // ── Render: Setup ───────────────────────────────────────────────────────────
  if (mode === 'setup') {
    const orphaned = hasVaultData();
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Create your Vault</h1>
            <p className="text-xs text-muted-foreground px-4">
              All credentials are encrypted with AES-256 using a key derived from this master password. The password is never stored — if you forget it, your vault cannot be recovered.
            </p>
          </div>
          {orphaned && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2 text-destructive text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  An encrypted vault already exists on this device, but its settings are missing or damaged.
                  Creating a new vault is blocked so the existing encrypted data is not destroyed.
                </span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setDestroyConfirm(true)}
              >
                Erase existing vault data
              </Button>
            </div>
          )}
          <form onSubmit={handleSetup} className="space-y-3">
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="Master password (min 8 chars)"
                className="pr-10 h-12"
                autoFocus
                maxLength={128}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type={showPw ? 'text' : 'password'}
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              placeholder="Confirm master password"
              className="h-12"
              maxLength={128}
            />
            {err && (
              <div className="flex items-center gap-1.5 text-destructive text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{err}
              </div>
            )}
            <Button type="submit" className="w-full h-12" disabled={busy || !pw || !pw2 || orphaned}>
              {busy ? 'Creating…' : 'Create Vault'}
            </Button>
          </form>
        </div>
        <AlertDialog open={destroyConfirm} onOpenChange={setDestroyConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Erase existing vault data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the encrypted credentials stored on this device. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDestroy}>Erase</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Render: Unlock ──────────────────────────────────────────────────────────
  if (mode === 'unlock') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Unlock Vault</h1>
            <p className="text-xs text-muted-foreground">Enter your master password to access credentials.</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-3">
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => { setPw(e.target.value); setErr(''); }}
                placeholder="Master password"
                className="pr-10 h-12"
                autoFocus
                maxLength={128}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {err && (
              <div className="flex items-center gap-1.5 text-destructive text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{err}
              </div>
            )}
            <Button type="submit" className="w-full h-12" disabled={busy || !pw}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Unlocked vault ──────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.label.toLowerCase().includes(q) || e.username.toLowerCase().includes(q) || (e.url ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              <h1 className="text-lg font-bold tracking-tight">Vault</h1>
              <span className="text-xs opacity-70">({entries.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0" title="Settings">
                <Settings className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={lock}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0" title="Lock vault">
                <Lock className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 shadow-lg">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search credentials..." className="pl-9 bg-background text-foreground text-sm h-9" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {entries.length === 0 ? 'No credentials yet' : 'No matches'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {entries.length === 0 ? 'Add your first credential entry' : 'Try a different search'}
            </p>
            {entries.length === 0 && (
              <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" /> Add Credential</Button>
            )}
          </div>
        ) : filtered.map(entry => {
          const shown = revealed.has(entry.id);
          return (
            <div key={entry.id} className="bg-card border border-border rounded-xl p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-foreground truncate">{entry.label}</div>
                  {entry.url && <div className="text-[11px] text-muted-foreground truncate">{entry.url}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(entry)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteEntry(entry.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0">Username</span>
                  <span className="font-mono truncate flex-1">{entry.username || '—'}</span>
                  {entry.username && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(entry.username, 'Username')} title="Copy">
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0">Password</span>
                  <span className="font-mono truncate flex-1">{shown ? entry.password : '••••••••••'}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleReveal(entry.id)} title={shown ? 'Hide' : 'Show'}>
                    {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  {entry.password && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(entry.password, 'Password')} title="Copy">
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {entry.notes && (
                  <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 whitespace-pre-wrap break-words">
                    {entry.notes}
                  </div>
                )}
                {entry.images && entry.images.length > 0 && (
                  <div className="flex gap-1.5 pt-1.5 border-t border-border/50 overflow-x-auto">
                    {entry.images.map(img => {
                      const src = img.annotatedDataUrl ?? img.dataUrl;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setPreviewUrl(src)}
                          className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border bg-muted"
                          aria-label="View image"
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ImageLightbox src={previewUrl} onClose={() => setPreviewUrl(null)} />

      {/* Entry editor */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o) { setEditorOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Credential' : 'Add Credential'}</DialogTitle>
            <DialogDescription>Stored encrypted on this device only.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} maxLength={80} placeholder="e.g. Gmail" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Username / Email</Label>
                <Input value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} maxLength={120} autoComplete="off" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={editing.password}
                    onChange={e => setEditing({ ...editing, password: e.target.value })}
                    maxLength={256}
                    autoComplete="new-password"
                    className="pr-10 font-mono"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL (optional)</Label>
                <Input value={editing.url ?? ''} onChange={e => setEditing({ ...editing, url: e.target.value })} maxLength={200} placeholder="https://" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} maxLength={500} rows={2} />
              </div>
              <InventoryPhotoField
                label="Images (optional)"
                value={editing.images ?? []}
                onChange={imgs => setEditing(prev => prev ? { ...prev, images: imgs } : prev)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditorOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveEntry}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vault Settings</DialogTitle>
            <DialogDescription>Change master password or erase the vault.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><RotateCw className="w-4 h-4" /> Change master password</div>
              <Input type="password" placeholder="Current password" value={cpwOld} onChange={e => setCpwOld(e.target.value)} maxLength={128} />
              <Input type="password" placeholder="New password (min 8)" value={cpwNew} onChange={e => setCpwNew(e.target.value)} maxLength={128} />
              <Input type="password" placeholder="Confirm new password" value={cpwNew2} onChange={e => setCpwNew2(e.target.value)} maxLength={128} />
              {cpwErr && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{cpwErr}
                </div>
              )}
              <Button size="sm" className="w-full" onClick={handleChangeMaster} disabled={!cpwOld || !cpwNew || !cpwNew2}>Update password</Button>
            </div>
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive"><ShieldAlert className="w-4 h-4" /> Danger zone</div>
              <p className="text-xs text-muted-foreground">Permanently delete all credentials and reset the vault.</p>
              <Button size="sm" variant="destructive" className="w-full" onClick={() => setDestroyConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> Destroy vault
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={destroyConfirm} onOpenChange={setDestroyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Destroy vault?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL stored credentials. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDestroy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, destroy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}