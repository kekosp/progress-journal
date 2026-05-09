import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flashlight, FlashlightOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  continuous?: boolean;
}

/** Camera-based barcode/QR scanner overlay using html5-qrcode. */
export function BarcodeScanner({ open, onClose, onDetected, continuous }: Props) {
  const containerId = 'barcode-scanner-region';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStarting(true);
    setTorchOn(false);
    setTorchSupported(false);

    const start = async () => {
      try {
        // Wait for the dialog portal to mount the container element
        for (let i = 0; i < 30; i++) {
          if (document.getElementById(containerId)) break;
          await new Promise(r => setTimeout(r, 50));
        }
        if (cancelled) return;
        if (!document.getElementById(containerId)) {
          throw new Error('Scanner container failed to mount');
        }
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            onDetected(decoded);
            if (!continuous) onClose();
          },
          () => {},
        );
        if (cancelled) await scanner.stop().catch(() => {});
        // Detect torch support on the active video track
        try {
          const video = document.querySelector(`#${containerId} video`) as HTMLVideoElement | null;
          const track = (video?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
          const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
          if (caps && 'torch' in caps && caps.torch) setTorchSupported(true);
        } catch { /* ignore */ }
      } catch (err) {
        toast({ title: 'Camera unavailable', description: String((err as Error).message ?? err), variant: 'destructive' });
        onClose();
      } finally {
        if (!cancelled) setStarting(false);
      }
    };
    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        Promise.resolve(s.stop()).catch(() => {}).finally(() => {
          try { s.clear(); } catch { /* ignore */ }
        });
      }
    };
  }, [open, continuous, onDetected, onClose]);

  const toggleTorch = async () => {
    try {
      const video = document.querySelector(`#${containerId} video`) as HTMLVideoElement | null;
      const track = (video?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
      if (!track) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet & { torch: boolean }] });
      setTorchOn(next);
    } catch (err) {
      toast({ title: 'Torch unavailable', description: String((err as Error).message ?? err), variant: 'destructive' });
      setTorchSupported(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan barcode / QR</DialogTitle>
        </DialogHeader>
        <div id={containerId} className="w-full overflow-hidden rounded-md bg-black aspect-[4/3]" />
        <p className="text-xs text-muted-foreground text-center">
          {starting ? 'Starting camera…' : continuous ? 'Point at each barcode. Tap Done when finished.' : 'Point camera at the barcode'}
        </p>
        <div className="flex gap-2">
          {torchSupported && (
            <Button type="button" variant={torchOn ? 'default' : 'outline'} onClick={toggleTorch} className="gap-2">
              {torchOn ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
              {torchOn ? 'Torch off' : 'Torch on'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="flex-1">{continuous ? 'Done' : 'Cancel'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}