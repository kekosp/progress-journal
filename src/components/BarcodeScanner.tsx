import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flashlight, FlashlightOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type TorchConstraints = MediaTrackConstraints & {
  torch?: boolean;
  advanced?: Array<MediaTrackConstraintSet & { torch?: boolean }>;
};

type TorchSettings = MediaTrackSettings & { torch?: boolean };

type TorchSupportedConstraints = MediaTrackSupportedConstraints & { torch?: boolean };

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
  const onCloseRef = useRef(onClose);
  const onDetectedRef = useRef(onDetected);
  const handledSingleScanRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  const detectTorchSupport = (scanner: Html5Qrcode) => {
    try {
      const constraints = navigator.mediaDevices.getSupportedConstraints() as TorchSupportedConstraints;
      if (constraints.torch === false) return false;
    } catch {
      return false;
    }

    try {
      const settings = scanner.getRunningTrackSettings?.() as TorchSettings;
      return 'torch' in settings;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStarting(true);
    setTorchOn(false);
    setTorchSupported(false);
    handledSingleScanRef.current = false;

    const start = async () => {
      try {
        // On native (Android/iOS), ensure camera permission is granted first.
        // Without this, the WebView's getUserMedia returns NotAllowedError.
        if (Capacitor.isNativePlatform()) {
          try {
            const status = await Camera.checkPermissions();
            if (status.camera !== 'granted' && status.camera !== 'limited') {
              const req = await Camera.requestPermissions({ permissions: ['camera'] });
              if (req.camera !== 'granted' && req.camera !== 'limited') {
                throw new Error('Camera permission denied. Enable Camera for this app in Android Settings → Apps.');
              }
            }
          } catch (permErr) {
            // If the plugin itself errors, surface a clear message
            throw new Error((permErr as Error)?.message ?? 'Unable to request camera permission');
          }
        }
        // Pre-flight: ensure mediaDevices is available
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not available on this device/browser');
        }
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
          { fps: 6, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            if (!continuous && handledSingleScanRef.current) return;
            handledSingleScanRef.current = true;
            try { onDetectedRef.current(decoded); } catch { /* ignore */ }
            if (!continuous) window.setTimeout(() => onCloseRef.current(), 0);
          },
          () => {},
        );
        if (cancelled) {
          try { await scanner.stop(); } catch { /* ignore */ }
          return;
        }
        setTorchSupported(detectTorchSupport(scanner));
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        toast({
          title: 'Camera unavailable',
          description: /permission|denied|notallowed/i.test(msg)
            ? 'Camera permission denied. Enable it in your browser/app settings.'
            : msg,
          variant: 'destructive',
        });
        scannerRef.current = null;
        onCloseRef.current();
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
        // Only stop if actively scanning to avoid html5-qrcode throwing
        const isScanning = (() => {
          try { return typeof s.getState === 'function' ? [2, 3].includes(s.getState()) : true; }
          catch { return true; }
        })();
        const stopP = isScanning
          ? Promise.resolve(s.stop()).catch(() => {})
          : Promise.resolve();
        stopP.finally(() => {
          try { s.clear(); } catch { /* ignore */ }
        });
      }
    };
  }, [open, continuous]);

  const toggleTorch = async () => {
    try {
      const scanner = scannerRef.current;
      if (!scanner) return;
      const next = !torchOn;
      await scanner.applyVideoConstraints({ torch: next, advanced: [{ torch: next }] } as TorchConstraints);
      setTorchOn(next);
    } catch (err) {
      toast({ title: 'Torch unavailable', description: 'Flashlight is not supported by this camera/browser.' });
      setTorchOn(false);
      setTorchSupported(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan barcode / QR</DialogTitle>
          <DialogDescription className="sr-only">
            Use your device camera to scan a barcode or QR code.
          </DialogDescription>
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