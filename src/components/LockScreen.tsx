import { useState, useEffect, useCallback } from 'react';
import { verifyAuth, getAuthMethod, AuthMethod } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Delete, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Props {
  onUnlocked: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_KEY = 'lock-attempts';
const BASE_LOCKOUT_SECONDS = 30;

interface LockoutState {
  attempts: number;
  lockedUntil: number | null; // epoch ms
}

function getLockoutState(): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: null };
}

function saveLockoutState(state: LockoutState) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
}

function clearLockoutState() {
  localStorage.removeItem(LOCKOUT_KEY);
}

export function LockScreen({ onUnlocked }: Props) {
  const method = getAuthMethod() as AuthMethod;
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const stored = getLockoutState();
  const [attempts, setAttempts] = useState(stored.attempts);
  const [lockedUntil, setLockedUntil] = useState<number | null>(stored.lockedUntil);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const [lockTimer, setLockTimer] = useState(() =>
    isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0
  );

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockTimer(0);
        setError('');
      } else {
        setLockTimer(remaining);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  const handleVerify = useCallback(async (secret: string) => {
    const nowLocked = lockedUntil !== null && Date.now() < lockedUntil;
    if (checking || nowLocked || !secret) return;
    setChecking(true);
    setError('');

    const ok = await verifyAuth(secret);
    setChecking(false);

    if (ok) {
      clearLockoutState();
      onUnlocked();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      setPassword('');
      if (next >= MAX_ATTEMPTS) {
        // Exponential backoff: 30s, 60s, 5min, 15min...
        const multiplier = Math.pow(2, Math.floor(next / MAX_ATTEMPTS) - 1);
        const lockoutSeconds = Math.min(BASE_LOCKOUT_SECONDS * multiplier, 900);
        const until = Date.now() + lockoutSeconds * 1000;
        setLockedUntil(until);
        saveLockoutState({ attempts: next, lockedUntil: until });
        setError(`Too many attempts. Wait ${lockoutSeconds} seconds.`);
      } else {
        saveLockoutState({ attempts: next, lockedUntil: null });
        setError(`Incorrect ${method === 'pin' ? 'PIN' : 'password'}. ${MAX_ATTEMPTS - (next % MAX_ATTEMPTS || MAX_ATTEMPTS)} attempt${MAX_ATTEMPTS - (next % MAX_ATTEMPTS || MAX_ATTEMPTS) !== 1 ? 's' : ''} left.`);
      }
    }
  }, [checking, lockedUntil, attempts, method, onUnlocked]);

  // Auto-submit when PIN reaches required length
  useEffect(() => {
    if (method === 'pin' && pin.length >= 4 && !checking) {
      handleVerify(pin);
    }
  }, [pin, method, checking, handleVerify]);

  function pressDigit(d: string) {
    if (locked || pin.length >= 6) return;
    setPin(p => p + d);
    setError('');
  }

  function backspace() {
    setPin(p => p.slice(0, -1));
    setError('');
  }

  // ── PIN pad ──────────────────────────────────────────────────────────────────
  if (method === 'pin') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6 px-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-1">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Enter PIN</h1>
          <p className="text-xs text-muted-foreground">Enter your PIN to unlock</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > i
                  ? 'bg-primary border-primary scale-110'
                  : 'border-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {locked ? `${error} (${lockTimer}s)` : error}
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              disabled={locked || pin.length >= 6}
              className="h-16 rounded-2xl bg-card border border-border text-xl font-semibold text-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-sm"
            >
              {d}
            </button>
          ))}
          {/* Bottom row */}
          <div /> {/* spacer */}
          <button
            onClick={() => pressDigit('0')}
            disabled={locked || pin.length >= 6}
            className="h-16 rounded-2xl bg-card border border-border text-xl font-semibold text-foreground active:scale-95 transition-transform disabled:opacity-40 shadow-sm"
          >
            0
          </button>
          <button
            onClick={backspace}
            disabled={locked || pin.length === 0}
            className="h-16 rounded-2xl bg-card border border-border flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 shadow-sm"
          >
            <Delete className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  // ── Password screen ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6 px-8">
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-1">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Enter Password</h1>
        <p className="text-xs text-muted-foreground">Enter your password to unlock</p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleVerify(password)}
            placeholder="Password"
            className="pr-10 text-base h-12"
            disabled={locked}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {locked ? `${error} (${lockTimer}s)` : error}
          </div>
        )}

        <Button
          className="w-full h-12 text-base"
          onClick={() => handleVerify(password)}
          disabled={!password || locked || checking}
        >
          {checking ? 'Checking…' : 'Unlock'}
        </Button>
      </div>
    </div>
  );
}
