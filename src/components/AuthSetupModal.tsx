import { useState } from 'react';
import { setupAuth, removeAuth, verifyAuth, isAuthEnabled, AuthMethod } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Lock, KeyRound, Hash, Eye, EyeOff, Trash2, CheckCircle2, Delete } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'choose' | 'setup-pin' | 'setup-password' | 'confirm' | 'change-verify' | 'disable-verify' | 'done';

export function AuthSetupModal({ open, onClose }: Props) {
  const authEnabled = isAuthEnabled();

  const [step, setStep] = useState<Step>(authEnabled ? 'confirm' : 'choose');
  const [method, setMethod] = useState<AuthMethod>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStage, setPinStage] = useState<'enter' | 'confirm'>('enter');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [currentSecret, setCurrentSecret] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep(isAuthEnabled() ? 'confirm' : 'choose');
    setPin(''); setConfirmPin('');
    setPassword(''); setConfirmPassword('');
    setCurrentSecret('');
    setPinStage('enter');
    setError('');
    setBusy(false);
  }

  function handleClose() { reset(); onClose(); }

  // ── PIN digit press ──────────────────────────────────────────────────────────
  function pressDigit(d: string) {
    setError('');
    if (pinStage === 'enter') {
      if (pin.length >= 6) return;
      const next = pin + d;
      setPin(next);
      if (next.length >= 4) setPinStage('confirm');
    } else {
      if (confirmPin.length >= 6) return;
      setConfirmPin(p => p + d);
    }
  }

  function backspacePin() {
    setError('');
    if (pinStage === 'confirm' && confirmPin.length === 0) {
      setPinStage('enter');
      setPin(p => p.slice(0, -1));
    } else if (pinStage === 'confirm') {
      setConfirmPin(p => p.slice(0, -1));
    } else {
      setPin(p => p.slice(0, -1));
    }
  }

  async function handleSavePin() {
    if (pin !== confirmPin) {
      setError("PINs don't match. Try again.");
      setConfirmPin('');
      setPinStage('enter');
      setPin('');
      return;
    }
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setBusy(true);
    await setupAuth('pin', pin);
    setBusy(false);
    setStep('done');
    toast({ title: 'PIN set!', description: 'Your app is now protected.' });
  }

  async function handleSavePassword() {
    if (password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    await setupAuth('password', password);
    setBusy(false);
    setStep('done');
    toast({ title: 'Password set!', description: 'Your app is now protected.' });
  }

  async function handleVerifyCurrent(nextStep: Step) {
    if (!currentSecret) { setError('Enter your current PIN or password.'); return; }
    setBusy(true);
    const ok = await verifyAuth(currentSecret);
    setBusy(false);
    if (!ok) { setError('Incorrect. Try again.'); return; }
    setCurrentSecret('');
    setError('');
    setStep(nextStep);
  }

  async function handleDisable() {
    setBusy(true);
    const ok = await verifyAuth(currentSecret);
    setBusy(false);
    if (!ok) { setError('Incorrect. Try again.'); return; }
    removeAuth();
    toast({ title: 'Lock removed', description: 'App protection has been disabled.' });
    reset();
    onClose();
  }

  // ── Shared PIN pad ───────────────────────────────────────────────────────────
  const PinPad = ({ activePin, stage }: { activePin: string; stage: 'enter' | 'confirm' }) => (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs text-muted-foreground">
        {stage === 'enter' ? 'Enter a 4–6 digit PIN' : 'Confirm your PIN'}
      </p>
      <div className="flex gap-3">
        {Array.from({ length: Math.max(4, activePin.length) }).map((_, i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${activePin.length > i ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <button key={d} onClick={() => pressDigit(d)}
            className="h-14 rounded-xl bg-muted text-lg font-semibold text-foreground active:scale-95 transition-transform">
            {d}
          </button>
        ))}
        <div />
        <button onClick={() => pressDigit('0')}
          className="h-14 rounded-xl bg-muted text-lg font-semibold text-foreground active:scale-95 transition-transform">0</button>
        <button onClick={backspacePin}
          className="h-14 rounded-xl bg-muted flex items-center justify-center active:scale-95 transition-transform">
          <Delete className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Lock className="w-4 h-4" /> App Lock
          </DialogTitle>
          <DialogDescription className="text-xs">
            {authEnabled ? 'Manage your app lock settings.' : 'Set up a PIN or password to protect your reports.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">

          {/* ── Choose method (new setup) ── */}
          {step === 'choose' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {([['pin', 'PIN', Hash], ['password', 'Password', KeyRound]] as [AuthMethod, string, any][]).map(([m, label, Icon]) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`rounded-xl border p-4 flex flex-col items-center gap-2 transition-colors ${method === m ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-[10px] text-muted-foreground text-center">
                      {m === 'pin' ? '4–6 digit code' : 'Text password'}
                    </span>
                  </button>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(method === 'pin' ? 'setup-pin' : 'setup-password')}>
                Continue
              </Button>
            </>
          )}

          {/* ── Setup PIN ── */}
          {step === 'setup-pin' && (
            <>
              <PinPad activePin={pinStage === 'enter' ? pin : confirmPin} stage={pinStage} />
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              {pinStage === 'confirm' && confirmPin.length >= 4 && (
                <Button className="w-full" onClick={handleSavePin} disabled={busy}>
                  {busy ? 'Saving…' : 'Set PIN'}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStep('choose')}>Back</Button>
            </>
          )}

          {/* ── Setup Password ── */}
          {step === 'setup-password' && (
            <>
              <div className="space-y-2">
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="New password (min 4 chars)" className="pr-10 h-11" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Input type={showConfirmPw ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Confirm password" className="pr-10 h-11" />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleSavePassword} disabled={busy || !password || !confirmPassword}>
                {busy ? 'Saving…' : 'Set Password'}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStep('choose')}>Back</Button>
            </>
          )}

          {/* ── Manage existing lock ── */}
          {step === 'confirm' && (
            <div className="space-y-2">
              <Button variant="outline" className="w-full gap-2 h-11" onClick={() => { setStep('change-verify'); setError(''); }}>
                <KeyRound className="w-4 h-4" /> Change PIN / Password
              </Button>
              <Button variant="outline" className="w-full gap-2 h-11 border-destructive/50 text-destructive hover:bg-destructive/5"
                onClick={() => { setStep('disable-verify'); setError(''); }}>
                <Trash2 className="w-4 h-4" /> Remove lock
              </Button>
            </div>
          )}

          {/* ── Verify current before changing ── */}
          {(step === 'change-verify' || step === 'disable-verify') && (
            <>
              <p className="text-xs text-muted-foreground">
                {step === 'disable-verify' ? 'Confirm current PIN/password to remove lock.' : 'Confirm current PIN/password before changing.'}
              </p>
              <div className="relative">
                <Input type={showCurrentPw ? 'text' : 'password'} value={currentSecret}
                  onChange={e => { setCurrentSecret(e.target.value); setError(''); }}
                  placeholder="Current PIN or password" className="pr-10 h-11" />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full h-11"
                onClick={() => step === 'disable-verify' ? handleDisable() : handleVerifyCurrent('choose')}
                disabled={busy || !currentSecret}>
                {busy ? 'Checking…' : step === 'disable-verify' ? 'Remove lock' : 'Continue'}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStep('confirm')}>Back</Button>
            </>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-semibold">Lock enabled!</p>
              <p className="text-xs text-muted-foreground text-center">Your app will lock on next launch.</p>
              <Button className="w-full" onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
