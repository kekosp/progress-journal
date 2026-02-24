import { Report } from '@/types/report';
import { Card } from '@/components/ui/card';
import { PriorityBadge, StatusBadge, CategoryIcon } from '@/components/ReportBadges';
import { CATEGORY_LABELS } from '@/types/report';
import { format } from 'date-fns';
import { Image, FileText } from 'lucide-react';

interface ReportCardProps {
  report: Report;
  onClick: (id: string) => void;
}

export function ReportCard({ report, onClick }: ReportCardProps) {
  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 animate-slide-up border-border/60 active:scale-[0.98]"
      onClick={() => onClick(report.id)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CategoryIcon category={report.category} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate text-foreground">{report.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {report.description || 'No description'}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={report.priority} />
            <StatusBadge status={report.status} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">
              {format(new Date(report.createdAt), 'MMM d, HH:mm')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground">
            {report.images.length > 0 && (
              <span className="flex items-center gap-1 text-[10px]">
                <Image className="w-3 h-3" /> {report.images.length}
              </span>
            )}
            {report.notes && (
              <span className="flex items-center gap-1 text-[10px]">
                <FileText className="w-3 h-3" /> Notes
              </span>
            )}
            {report.projectName && (
              <span className="text-[10px] truncate">{report.projectName}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
