import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStarting(true);

    const start = async () => {
      try {
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
        s.stop().catch(() => {}).finally(() => s.clear().catch(() => {}));
      }
    };
  }, [open, continuous, onDetected, onClose]);

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
        <Button variant="outline" onClick={onClose}>{continuous ? 'Done' : 'Cancel'}</Button>
      </DialogContent>
    </Dialog>
  );
}