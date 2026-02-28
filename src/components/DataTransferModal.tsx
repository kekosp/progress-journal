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
import {
  Download,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Share2,
} from 'lucide-react';

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
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reportCount = getReports().length;

  // ── Export: save to Downloads ─────────────────────────────────────────────

  async function handleSaveToDownloads() {
    setBusy(true);
    try {
      const path = await exportAllData();
      toast({
        title: 'Backup saved!',
        description: `Saved to ${path}. Open the Files app to find it.`,
      });
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  // ── Export: share sheet ───────────────────────────────────────────────────

  async function handleShare() {
    setBusy(true);
    try {
      await exportAllData({ share: true });
    } catch (e) {
      // User dismissed the share sheet — not a real error
      if (!(e instanceof Error && e.message.includes('cancel'))) {
        toast({
          title: 'Share failed',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  // Capacitor's WebView forwards <input type="file"> to the Android file picker natively.
  function handlePickFile() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBusy(false);
      if (importMode === 'replace') {
        setPendingJson(text);
        setStep('confirm-replace');
      } else {
        performImport(text, 'merge');
      }
    };
    reader.onerror = () => {
      setBusy(false);
      setErrorMsg('Could not read the file.');
      setStep('error');
    };
    reader.readAsText(file);
    // Reset so the same file can be re-picked
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
    setErrorMsg('');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-bold">Transfer Data</DialogTitle>
          <DialogDescription className="text-xs">
            Move your reports between Android devices — no internet needed.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex mx-5 mt-4 rounded-lg overflow-hidden border border-border text-sm font-medium">
          {(['export', 'import'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); reset(); }}
              className={`flex-1 py-2 capitalize transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3">

          {/* ── EXPORT ── */}
          {tab === 'export' && (
            <>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                You have{' '}
                <span className="font-semibold text-foreground">{reportCount}</span>{' '}
                report{reportCount !== 1 ? 's' : ''} saved.
              </div>

              {/* Option 1 – Save to Downloads */}
              <Button
                onClick={handleSaveToDownloads}
                className="w-full gap-2 bg-primary text-primary-foreground"
                disabled={reportCount === 0 || busy}
              >
                <Download className="w-4 h-4" />
                {busy ? 'Saving…' : 'Save to Downloads folder'}
              </Button>

              <div className="relative flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Option 2 – Android share sheet */}
              <Button
                variant="outline"
                onClick={handleShare}
                className="w-full gap-2"
                disabled={reportCount === 0 || busy}
              >
                <Share2 className="w-4 h-4" />
                Share via WhatsApp / Bluetooth / email…
              </Button>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                The backup is a <span className="font-mono">.json</span> file. Send it any
                way you like, then open PVP on the other phone and tap <strong>Import</strong>.
              </p>
            </>
          )}

          {/* ── IMPORT – idle ── */}
          {tab === 'import' && step === 'idle' && (
            <>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Pick the <span className="font-mono font-semibold text-foreground">.json</span>{' '}
                backup file from your other phone.
              </div>

              {/* Import mode */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Import mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['merge', 'replace'] as ImportMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setImportMode(m)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        importMode === m
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background'
                      }`}
                    >
                      <p className="text-xs font-semibold capitalize text-foreground">{m}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {m === 'merge'
                          ? 'Add new reports, keep existing'
                          : 'Wipe current data & replace'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {importMode === 'replace' && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">
                    Replace mode will permanently delete all current reports.
                  </p>
                </div>
              )}

              {/* Hidden native file picker — Capacitor forwards this to Android */}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />

              <Button
                onClick={handlePickFile}
                className="w-full gap-2 bg-primary text-primary-foreground"
                disabled={busy}
              >
                <Upload className="w-4 h-4" />
                {busy ? 'Reading file…' : 'Choose backup file'}
              </Button>
            </>
          )}

          {/* ── Confirm replace ── */}
          {tab === 'import' && step === 'confirm-replace' && (
            <div className="space-y-3 py-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm font-semibold">Are you sure?</p>
                <p className="text-xs text-muted-foreground">
                  This will delete all your current reports and replace them with the imported data.
                </p>
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

          {/* ── Success ── */}
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
                    : resultCount > 0
                      ? `Added ${resultCount} new report${resultCount !== 1 ? 's' : ''}.`
                      : 'No new reports found — all IDs already existed on this device.'}
                </p>
              </div>
              <Button className="w-full" onClick={() => { reset(); onClose(); }}>Done</Button>
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={reset}>
                <RefreshCw className="w-3.5 h-3.5" /> Import another file
              </Button>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="space-y-3 py-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm font-semibold">Import failed</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{errorMsg}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={reset}>Try again</Button>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
            onClick={() => { reset(); onClose(); }}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
