import { useRef, useState } from 'react';
import { exportAllData, importData, ImportMode, getReports } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Download, Upload, X, AlertTriangle, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Tab = 'export' | 'import';
type Step = 'idle' | 'confirm-replace' | 'success' | 'error';

export function DataTransferModal({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('export');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [step, setStep] = useState<Step>('idle');
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reportCount = getReports().length;

  // ── Export ──────────────────────────────────────────────────────────────────

  function handleExport() {
    exportAllData();
    toast({ title: 'Backup downloaded!', description: `${reportCount} report${reportCount !== 1 ? 's' : ''} exported as JSON.` });
  }

  async function handleGenerateQr() {
    const reports = getReports();
    if (reports.length === 0) {
      toast({ title: 'Nothing to export', description: 'Add some reports first.', variant: 'destructive' });
      return;
    }

    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), reportCount: reports.length, reports });
    const KB = new Blob([json]).size / 1024;

    if (KB > 2) {
      toast({
        title: 'Data too large for QR',
        description: `Your data is ${KB.toFixed(0)} KB. QR works best under 2 KB (a few reports without images). Use the JSON export instead.`,
        variant: 'destructive',
      });
      return;
    }

    // Dynamically load qrcode library from CDN
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(json, { errorCorrectionLevel: 'L', width: 320 });
      setQrDataUrl(url);
      setShowQr(true);
    } catch {
      toast({ title: 'QR generation failed', description: 'Use the JSON file export instead.', variant: 'destructive' });
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (importMode === 'replace') {
        setPendingJson(text);
        setStep('confirm-replace');
      } else {
        performImport(text, 'merge');
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-picked
    e.target.value = '';
  }

  function performImport(json: string, mode: ImportMode) {
    try {
      const count = importData(json, mode);
      setResultCount(count);
      setStep('success');
      onImported();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }

  function reset() {
    setStep('idle');
    setPendingJson(null);
    setQrDataUrl(null);
    setShowQr(false);
    setErrorMsg('');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        {/* QR overlay */}
        {showQr && qrDataUrl && (
          <div className="absolute inset-0 z-50 bg-card flex flex-col items-center justify-center p-6 gap-4">
            <p className="text-sm font-semibold text-foreground">Scan to import on another device</p>
            <img src={qrDataUrl} alt="QR code" className="rounded-xl border border-border w-56 h-56" />
            <p className="text-xs text-muted-foreground text-center">The receiving phone should open the app and scan this code via Import → QR</p>
            <Button variant="outline" size="sm" onClick={() => setShowQr(false)} className="gap-1.5">
              <X className="w-4 h-4" /> Close
            </Button>
          </div>
        )}

        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-bold">Transfer Data</DialogTitle>
          <DialogDescription className="text-xs">
            Move your reports between devices without any internet connection.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex mx-5 mt-4 rounded-lg overflow-hidden border border-border text-sm font-medium">
          {(['export', 'import'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); reset(); }}
              className={`flex-1 py-2 capitalize transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3">

          {/* ── EXPORT tab ── */}
          {tab === 'export' && (
            <>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                You have <span className="font-semibold text-foreground">{reportCount}</span> report{reportCount !== 1 ? 's' : ''} saved.
                Export as a JSON file and transfer it to your other phone via AirDrop, Bluetooth, WhatsApp, email, USB, etc.
              </div>

              <Button onClick={handleExport} className="w-full gap-2 bg-primary text-primary-foreground" disabled={reportCount === 0}>
                <Download className="w-4 h-4" />
                Download backup (.json)
              </Button>

              <div className="relative flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button
                variant="outline"
                onClick={handleGenerateQr}
                className="w-full gap-2"
                disabled={reportCount === 0}
              >
                <QrCode className="w-4 h-4" />
                Generate QR code
                <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5">small data only</span>
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                QR works for a handful of text-only reports. Use JSON for reports with images.
              </p>
            </>
          )}

          {/* ── IMPORT tab ── */}
          {tab === 'import' && step === 'idle' && (
            <>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Pick the <span className="font-mono font-semibold text-foreground">.json</span> backup file from your other phone.
              </div>

              {/* Mode selector */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Import mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['merge', 'replace'] as ImportMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setImportMode(m)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${importMode === m ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                    >
                      <p className="text-xs font-semibold capitalize text-foreground">{m}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {m === 'merge' ? 'Add new reports, keep existing ones' : 'Wipe current data and replace'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {importMode === 'replace' && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">Replace mode will permanently delete all current reports.</p>
                </div>
              )}

              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
              <Button onClick={() => fileRef.current?.click()} className="w-full gap-2 bg-primary text-primary-foreground">
                <Upload className="w-4 h-4" />
                Choose backup file
              </Button>
            </>
          )}

          {/* Confirm replace */}
          {tab === 'import' && step === 'confirm-replace' && (
            <div className="space-y-3 py-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm font-semibold">Are you sure?</p>
                <p className="text-xs text-muted-foreground">This will delete all your current reports and replace them with the imported data.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={reset}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => pendingJson && performImport(pendingJson, 'replace')}
                >
                  Yes, replace
                </Button>
              </div>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="space-y-3 py-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-semibold">Import successful!</p>
                <p className="text-xs text-muted-foreground">
                  {importMode === 'replace'
                    ? `Replaced all data with ${resultCount} report${resultCount !== 1 ? 's' : ''}.`
                    : `Added ${resultCount} new report${resultCount !== 1 ? 's' : ''}${resultCount === 0 ? ' (no new reports found — all IDs already existed)' : '.'}`
                  }
                </p>
              </div>
              <Button className="w-full gap-2" onClick={() => { reset(); onClose(); }}>
                Done
              </Button>
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={reset}>
                <RefreshCw className="w-3.5 h-3.5" /> Import another file
              </Button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="space-y-3 py-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm font-semibold">Import failed</p>
                <p className="text-xs text-muted-foreground font-mono">{errorMsg}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={reset}>Try again</Button>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { reset(); onClose(); }}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
