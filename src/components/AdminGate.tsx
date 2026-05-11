import { useState, useEffect } from 'react';
import { isAdminSetup, setupAdmin, verifyAdmin } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Eye, EyeOff, AlertCircle, UserPlus, LogIn } from 'lucide-react';

interface Props {
  children: React.ReactNode | ((opts: { onLogout: () => void }) => React.ReactNode);
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_KEY = 'admin-lock-attempts';
const BASE_LOCKOUT_SECONDS = 30;

interface LockoutState { attempts: number; lockedUntil: number | null; }

function readLockout(): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: null };
}
function writeLockout(s: LockoutState) { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(s)); }
function clearLockout() { localStorage.removeItem(LOCKOUT_KEY); }

export function AdminGate({ children }: Props) {
  const [authenticated, setAuthenticated] = useState(false);
  const handleLogout = () => setAuthenticated(false);
  const needsSetup = !isAdminSetup();
  const [mode, setMode] = useState<'login' | 'setup'>(needsSetup ? 'setup' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const initial = readLockout();
  const [attempts, setAttempts] = useState(initial.attempts);
  const [lockedUntil, setLockedUntil] = useState<number | null>(initial.lockedUntil);
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const [lockTimer, setLockTimer] = useState(() => isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { setLockTimer(0); setError(''); }
      else setLockTimer(remaining);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  if (authenticated) return <>{typeof children === 'function' ? children({ onLogout: handleLogout }) : children}</>;

  const handleSubmit = async () => {
    if (isLocked) return;
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    setError('');

    if (mode === 'setup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        setLoading(false);
        return;
      }
      await setupAdmin(username.trim(), password);
      clearLockout();
      setAuthenticated(true);
    } else {
      const ok = await verifyAdmin(username.trim(), password);
      if (ok) {
        clearLockout();
        setAuthenticated(true);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setPassword('');
        if (next >= MAX_ATTEMPTS) {
          const multiplier = Math.pow(2, Math.floor(next / MAX_ATTEMPTS) - 1);
          const lockoutSeconds = Math.min(BASE_LOCKOUT_SECONDS * multiplier, 900);
          const until = Date.now() + lockoutSeconds * 1000;
          setLockedUntil(until);
          writeLockout({ attempts: next, lockedUntil: until });
          setError(`Too many attempts. Wait ${lockoutSeconds} seconds.`);
        } else {
          writeLockout({ attempts: next, lockedUntil: null });
          const left = MAX_ATTEMPTS - (next % MAX_ATTEMPTS || MAX_ATTEMPTS);
          setError(`Invalid username or password. ${left} attempt${left !== 1 ? 's' : ''} left.`);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === 'setup' ? 'Setup Admin Account' : 'Admin Login'}
          </h1>
          <p className="text-xs text-muted-foreground text-center">
            {mode === 'setup'
              ? 'Create admin credentials to access the Activity Log'
              : 'Enter your admin credentials to continue'}
          </p>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Username"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="h-12 text-base"
            autoFocus
          />
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="h-12 text-base pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'setup' && (
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="h-12 text-base"
            />
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {isLocked ? `${error} (${lockTimer}s)` : error}
            </div>
          )}

          <Button className="w-full h-12 text-base gap-2" onClick={handleSubmit} disabled={loading || isLocked}>
            {mode === 'setup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {isLocked ? `Locked (${lockTimer}s)` : loading ? 'Please wait…' : mode === 'setup' ? 'Create Admin' : 'Login'}
          </Button>
        </div>
      </div>
    </div>
  );
}
