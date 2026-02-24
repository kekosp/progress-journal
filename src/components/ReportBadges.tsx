import { ReportPriority, ReportStatus, ReportCategory } from '@/types/report';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const priorityStyles: Record<ReportPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/15 text-info',
  high: 'bg-warning/15 text-warning',
  critical: 'bg-destructive/15 text-destructive',
};

const statusStyles: Record<ReportStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  'in-progress': 'bg-info/15 text-info',
  completed: 'bg-success/15 text-success',
  archived: 'bg-muted text-muted-foreground',
};

const categoryIcons: Record<ReportCategory, string> = {
  inspection: '🔍',
  maintenance: '🔧',
  safety: '🛡️',
  quality: '✅',
  progress: '📊',
  incident: '⚠️',
  other: '📋',
};

export function PriorityBadge({ priority }: { priority: ReportPriority }) {
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium border-0', priorityStyles[priority])}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const label = status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge variant="secondary" className={cn('text-xs font-medium border-0', statusStyles[status])}>
      {label}
    </Badge>
  );
}

export function CategoryIcon({ category }: { category: ReportCategory }) {
  return <span className="text-base">{categoryIcons[category]}</span>;
}
