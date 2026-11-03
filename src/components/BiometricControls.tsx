import { useEffect, useRef } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  bio: {
    available: boolean;
    enabled: boolean;
    optIn: boolean;
    setOptIn: (v: boolean) => void;
  };
  onFingerprint: () => void;
  disabled?: boolean;
  /** Open the fingerprint prompt automatically when the screen appears. */
  autoPrompt?: boolean;
}

export function BiometricControls({ bio, onFingerprint, disabled, autoPrompt = true }: Props) {
  const prompted = useRef(false);
  useEffect(() => {
    if (autoPrompt && bio.enabled && !disabled && !prompted.current) {
      prompted.current = true;
      onFingerprint();
    }
  }, [autoPrompt, bio.enabled, disabled, onFingerprint]);

  if (!bio.available) return null;

  if (bio.enabled) {
    return (
      <Button type="button" variant="outline" className="w-full h-12 gap-2" onClick={onFingerprint} disabled={disabled}>
        <Fingerprint className="w-5 h-5" /> Use fingerprint
      </Button>
    );
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Checkbox checked={bio.optIn} onCheckedChange={v => bio.setOptIn(v === true)} />
      Enable fingerprint unlock next time
    </label>
  );
}
