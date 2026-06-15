import { useState } from 'react';
import { ReportTemplate, getTemplates, deleteTemplate } from '@/lib/template-storage';
import { CATEGORY_LABELS, PRIORITY_LABELS } from '@/types/report';
import { Button } from '@/components/ui/button';
import { X, Trash2, LayoutTemplate, ChevronRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (template: ReportTemplate) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-blue-400', medium: 'text-yellow-400', high: 'text-orange-500', critical: 'text-red-500',
};

export function TemplatePickerModal({ open, onClose, onSelect }: Props) {
  const [templates, setTemplates] = useState(getTemplates);

  if (!open) return null;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteTemplate(id);
    setTemplates(getTemplates());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl border-t border-border pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Report Templates</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-2">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <LayoutTemplate className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No templates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Fill out a report form and tap <strong>"Save as Template"</strong> to create one.
              </p>
            </div>
          ) : (
            templates.map(t => (
              <button
                key={t.id}
                onClick={() => { onSelect(t); onClose(); }}
                className="w-full text-left bg-card border border-border rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform hover:border-primary/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {t.title || <span className="italic">No title preset</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                      {CATEGORY_LABELS[t.category]}
                    </span>
                    <span className={`text-[10px] font-semibold ${PRIORITY_COLOR[t.priority]}`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                    {t.projectName && (
                      <span className="text-[10px] text-muted-foreground truncate">· {t.projectName}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={e => handleDelete(e, t.id)}
                    className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-4 pb-6 pt-2">
          <Button variant="outline" className="w-full text-sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
