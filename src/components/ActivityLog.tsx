import { useState, useMemo } from 'react';
import { getActivityLog, clearActivityLog, ActivityEntry, ActivityModule, ActivityAction } from '@/lib/activity-log';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClipboardList, Calendar, Package, Plus, Pencil, Trash2, CheckCircle2, Archive,
  RotateCcw, FileDown, FileUp, PenLine, History, FilterX, LogOut
} from 'lucide-react';

const MODULE_META: Record<ActivityModule, { label: string; Icon: React.ElementType; color: string }> = {
  report:      { label: 'Report',      Icon: ClipboardList, color: 'text-blue-500' },
  maintenance: { label: 'Maintenance', Icon: Calendar,      color: 'text-amber-500' },
  inventory:   { label: 'Inventory',   Icon: Package,       color: 'text-emerald-500' },
};

const ACTION_META: Record<ActivityAction, { label: string; Icon: React.ElementType }> = {
  created:   { label: 'Created',   Icon: Plus },
  updated:   { label: 'Updated',   Icon: Pencil },
  deleted:   { label: 'Deleted',   Icon: Trash2 },
  completed: { label: 'Completed', Icon: CheckCircle2 },
  archived:  { label: 'Archived',  Icon: Archive },
  returned:  { label: 'Returned',  Icon: RotateCcw },
  exported:  { label: 'Exported',  Icon: FileDown },
  imported:  { label: 'Imported',  Icon: FileUp },
  signed:    { label: 'Signed',    Icon: PenLine },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function groupByDate(entries: ActivityEntry[]): Record<string, ActivityEntry[]> {
  const groups: Record<string, ActivityEntry[]> = {};
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (const entry of entries) {
    const d = entry.timestamp.slice(0, 10);
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }
  return groups;
}

export function ActivityLog({ onLogout }: { onLogout?: () => void }) {
  const [log, setLog] = useState(getActivityLog);
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (moduleFilter === 'all') return log;
    return log.filter(e => e.module === moduleFilter);
  }, [log, moduleFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const handleClear = () => {
    if (confirm('Clear all activity history?')) {
      clearActivityLog();
      setLog([]);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <h1 className="text-lg font-bold">Activity Log</h1>
            </div>
            {log.length > 0 && (
              <Button size="sm" variant="ghost" onClick={handleClear}
                className="text-primary-foreground hover:bg-primary-foreground/10 gap-1 text-xs h-7">
                <FilterX className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
            {onLogout && (
              <Button size="sm" variant="ghost" onClick={onLogout}
                className="text-primary-foreground hover:bg-primary-foreground/10 gap-1 text-xs h-7">
                <LogOut className="w-3.5 h-3.5" /> Logout
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="report">Reports</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-primary-foreground/60 self-center ml-auto">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No activity yet</p>
            <p className="text-sm mt-1">Changes to reports, maintenance, and inventory will appear here.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, entries]) => (
            <div key={dateLabel}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{dateLabel}</h2>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const mod = MODULE_META[entry.module];
                  const act = ACTION_META[entry.action];
                  return (
                    <Card key={entry.id} className="shadow-sm">
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-full bg-muted ${mod.color}`}>
                          <mod.Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <act.Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs font-medium text-muted-foreground">{act.label}</span>
                            <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">{relativeTime(entry.timestamp)}</span>
                          </div>
                          <p className="text-sm font-medium truncate mt-0.5">{entry.itemTitle}</p>
                          {entry.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.details}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
