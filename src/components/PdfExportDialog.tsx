import { useState, useMemo } from 'react';
import { Report } from '@/types/report';
import { exportReportToPdf, PdfExportOptions } from '@/lib/export-pdf';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  report: Report;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function PdfExportDialog({ report, open, onOpenChange }: Props) {
  const allIds = useMemo(() => report.images.map(i => i.id), [report.images]);
  const [selectedIds, setSelectedIds] = useState<string[]>(allIds);
  const [extraNotes, setExtraNotes] = useState('');
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeLostTime, setIncludeLostTime] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [exporting, setExporting] = useState(false);

  const toggleImage = (id: string) =>
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectAll = () => setSelectedIds(allIds);
  const clearAll  = () => setSelectedIds([]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const opts: PdfExportOptions = {
        selectedImageIds: includePhotos ? selectedIds : [],
        extraNotes: extraNotes.trim() || undefined,
        includeDescription,
        includeLostTime,
        includePhotos,
        includeNotes,
        includeSignature,
      };
      const result = await exportReportToPdf(report, opts);
      if (result.saved && (result as { shared?: boolean }).shared) {
        toast.success('PDF ready — choose where to save it');
      } else if (result.saved) {
        toast.success(`PDF saved: ${result.path}`);
      } else {
        toast.success(`PDF downloaded: ${result.path}`);
      }
      onOpenChange(false);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize PDF Export</DialogTitle>
          <DialogDescription className="text-xs">
            Pick sections, photos, and add extra notes for this export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Sections */}
          <div className="space-y-2.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sections</Label>
            <SectionToggle label="Description"       enabled={includeDescription} onChange={setIncludeDescription} disabled={!report.description} />
            <SectionToggle label="Lost time"         enabled={includeLostTime}    onChange={setIncludeLostTime}    disabled={!(report.lostTimeHours || report.lostTimeMinutes)} />
            <SectionToggle label={`Photos (${report.images.length})`} enabled={includePhotos} onChange={setIncludePhotos} disabled={report.images.length === 0} />
            <SectionToggle label="Notes"             enabled={includeNotes}       onChange={setIncludeNotes} />
            <SectionToggle label="Signature"         enabled={includeSignature}   onChange={setIncludeSignature} disabled={!report.signatureDataUrl} />
          </div>

          {/* Photo picker */}
          {includePhotos && report.images.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Photos to include ({selectedIds.length}/{allIds.length})
                </Label>
                <div className="flex gap-1">
                  <button onClick={selectAll} className="text-[10px] text-primary font-medium px-1.5 py-0.5 rounded hover:bg-primary/10">All</button>
                  <button onClick={clearAll}  className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted">None</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {report.images.map((img, i) => {
                  const on = selectedIds.includes(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => toggleImage(img.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${on ? 'border-primary ring-2 ring-primary/30' : 'border-border opacity-50'}`}
                    >
                      <img src={img.annotatedDataUrl || img.dataUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
                        {i + 1}
                      </div>
                      {on && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">✓</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extra notes */}
          <div className="space-y-2">
            <Label htmlFor="extra-notes" className="text-xs uppercase tracking-wider text-muted-foreground">
              Additional notes (optional)
            </Label>
            <Textarea
              id="extra-notes"
              value={extraNotes}
              onChange={e => setExtraNotes(e.target.value)}
              placeholder="Add extra context, follow-up actions, or summary…"
              rows={4}
              maxLength={2000}
              className="resize-none text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Appended to the Notes section. Use blank lines to separate paragraphs.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {exporting ? 'Generating…' : 'Export PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionToggle({
  label, enabled, onChange, disabled,
}: { label: string; enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border border-border px-3 py-2 ${disabled ? 'opacity-40' : ''}`}>
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={enabled && !disabled} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}