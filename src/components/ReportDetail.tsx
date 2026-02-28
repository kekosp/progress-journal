import { useState } from 'react';
import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { deleteReport } from '@/lib/storage';
import { exportReportToPdf } from '@/lib/export-pdf';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit2, Trash2, FileDown, MapPin, FolderOpen, PenTool, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  report: Report;
  onBack: () => void;
  onEdit: (id: string) => void;
  onDeleted: () => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  high: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  critical: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  'in-progress': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
  archived: 'bg-muted text-muted-foreground',
};

function formatLostTime(report: Report): string | null {
  const h = report.lostTimeHours;
  if (!h || h <= 0) return null;
  const totalMins = Math.round(h * 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function ReportDetail({ report, onBack, onEdit, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleDelete = () => {
    deleteReport(report.id);
    toast.success('Report deleted');
    onDeleted();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportReportToPdf(report);
      toast.success(result.saved ? `Saved to ${result.path}` : 'PDF downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const lostTimeDisplay = formatLostTime(report);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Button size="sm" variant="ghost" onClick={onBack}
              className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleExport} disabled={exporting}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0" title="Export PDF">
                <FileDown className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(report.id)}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0">
                <Edit2 className="w-4 h-4" />
              </Button>
              {!confirmDelete ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}
                  className="text-primary-foreground hover:bg-destructive/20 h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex gap-1 items-center bg-destructive/20 rounded-lg px-2">
                  <span className="text-xs">Delete?</span>
                  <button onClick={handleDelete} className="text-xs font-bold text-destructive px-1">Yes</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs px-1">No</button>
                </div>
              )}
            </div>
          </div>

          <h1 className="text-lg font-bold leading-tight mb-2">{report.title}</h1>

          <div className="flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityColors[report.priority]}`}>
              {PRIORITY_LABELS[report.priority]}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[report.status]}`}>
              {STATUS_LABELS[report.status]}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-foreground/10">
              {CATEGORY_LABELS[report.category]}
            </span>
            {lostTimeDisplay && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {lostTimeDisplay} lost
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-5">

        {/* Meta */}
        <div className="bg-card rounded-xl border border-border p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created</span>
            <span className="font-medium text-foreground">
              {format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
          {report.updatedAt !== report.createdAt && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Updated</span>
              <span className="font-medium text-foreground">
                {format(new Date(report.updatedAt), 'MMM d, yyyy HH:mm')}
              </span>
            </div>
          )}
          {report.projectName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-foreground">{report.projectName}</span>
            </div>
          )}
          {report.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-foreground">{report.location}</span>
            </div>
          )}
        </div>

        {/* Lost Time card */}
        {lostTimeDisplay && (
          <div className="bg-orange-500/8 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Lost Time</p>
              <p className="text-2xl font-bold text-orange-500 leading-tight">{lostTimeDisplay}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Recorded downtime / delay for this report
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        {report.description && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Description</h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{report.description}</p>
          </div>
        )}

        {/* Images */}
        {report.images.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Photos ({report.images.length})
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {report.images.map(img => (
                <div key={img.id} className="rounded-lg overflow-hidden bg-muted">
                  <div className="aspect-square relative">
                    <img src={img.annotatedDataUrl || img.dataUrl} alt={img.caption || ''}
                      className="w-full h-full object-cover" />
                    {img.annotatedDataUrl && (
                      <div className="absolute top-1 left-1">
                        <span className="bg-primary/80 text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <PenTool className="w-2 h-2" /> Annotated
                        </span>
                      </div>
                    )}
                  </div>
                  {img.caption && (
                    <p className="text-xs text-muted-foreground px-2 py-1.5 bg-card border-t border-border">
                      {img.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature */}
        {report.signatureDataUrl && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Digital Signature
            </h2>
            <div className="bg-card rounded-lg p-4 border border-border text-center">
              <img src={report.signatureDataUrl} alt="Signature" className="h-16 mx-auto mb-2" />
              {report.signedBy && (
                <p className="text-sm font-medium text-foreground">{report.signedBy}</p>
              )}
              {report.signedAt && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Signed on {format(new Date(report.signedAt), 'MMM d, yyyy HH:mm')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {report.notes && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Notes</h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{report.notes}</p>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}
