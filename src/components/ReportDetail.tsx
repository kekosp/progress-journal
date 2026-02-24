import { Report } from '@/types/report';
import { PriorityBadge, StatusBadge, CategoryIcon } from '@/components/ReportBadges';
import { CATEGORY_LABELS } from '@/types/report';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ArrowLeft, Edit, Trash2, MapPin, Briefcase, Clock } from 'lucide-react';
import { deleteReport } from '@/lib/storage';
import { toast } from 'sonner';

interface ReportDetailProps {
  report: Report;
  onBack: () => void;
  onEdit: (id: string) => void;
  onDeleted: () => void;
}

export function ReportDetail({ report, onBack, onEdit, onDeleted }: ReportDetailProps) {
  const handleDelete = () => {
    if (window.confirm('Delete this report? This cannot be undone.')) {
      deleteReport(report.id);
      toast.success('Report deleted');
      onDeleted();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(report.id)} className="gap-1.5 text-xs">
            <Edit className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={handleDelete} className="gap-1.5 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="p-4 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
        {/* Title Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CategoryIcon category={report.category} />
            <span className="text-xs text-muted-foreground font-medium">{CATEGORY_LABELS[report.category]}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{report.title}</h1>
          <div className="flex gap-2 flex-wrap">
            <PriorityBadge priority={report.priority} />
            <StatusBadge status={report.status} />
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}</span>
          {report.projectName && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {report.projectName}</span>}
          {report.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {report.location}</span>}
        </div>

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
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Attachments ({report.images.length})
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {report.images.map(img => (
                <div key={img.id} className="rounded-lg overflow-hidden aspect-square bg-muted">
                  <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {report.notes && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Notes</h2>
            <div className="bg-card rounded-lg p-3 border border-border">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{report.notes}</p>
            </div>
          </div>
        )}

        {/* Updated */}
        {report.updatedAt !== report.createdAt && (
          <p className="text-[10px] text-muted-foreground text-right font-mono">
            Updated {format(new Date(report.updatedAt), 'MMM d, yyyy HH:mm')}
          </p>
        )}
      </div>
    </div>
  );
}
