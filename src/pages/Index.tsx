import { useState, useMemo } from 'react';
import { Report, ReportCategory, ReportPriority, CATEGORY_LABELS, PRIORITY_LABELS } from '@/types/report';
import { getReports, getReportById } from '@/lib/storage';
import { ReportCard } from '@/components/ReportCard';
import { ReportForm } from '@/components/ReportForm';
import { ReportDetail } from '@/components/ReportDetail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ClipboardList, Filter } from 'lucide-react';

type View = 'list' | 'create' | 'edit' | 'detail';

const Index = () => {
  const [view, setView] = useState<View>('list');
  const [editingReport, setEditingReport] = useState<Report | undefined>();
  const [viewingReport, setViewingReport] = useState<Report | undefined>();
  const [reports, setReports] = useState<Report[]>(getReports);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const refresh = () => setReports(getReports());

  const filtered = useMemo(() => {
    let r = reports;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(rep => rep.title.toLowerCase().includes(q) || rep.description.toLowerCase().includes(q) || rep.projectName?.toLowerCase().includes(q));
    }
    if (filterCategory !== 'all') r = r.filter(rep => rep.category === filterCategory);
    if (filterPriority !== 'all') r = r.filter(rep => rep.priority === filterPriority);
    return r;
  }, [reports, search, filterCategory, filterPriority]);

  const stats = useMemo(() => ({
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    inProgress: reports.filter(r => r.status === 'in-progress').length,
    critical: reports.filter(r => r.priority === 'critical').length,
  }), [reports]);

  if (view === 'create') {
    return <ReportForm onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} />;
  }
  if (view === 'edit' && editingReport) {
    return <ReportForm report={editingReport} onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} />;
  }
  if (view === 'detail' && viewingReport) {
    return (
      <ReportDetail
        report={viewingReport}
        onBack={() => setView('list')}
        onEdit={(id) => {
          const r = getReportById(id);
          if (r) { setEditingReport(r); setView('edit'); }
        }}
        onDeleted={() => { refresh(); setView('list'); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold tracking-tight">PVP Reports</h1>
              <p className="text-xs opacity-80">Personal Verification & Progress</p>
            </div>
            <Button
              size="sm"
              onClick={() => setView('create')}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 shadow-lg"
            >
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: stats.total },
              { label: 'Done', value: stats.completed },
              { label: 'Active', value: stats.inProgress },
              { label: 'Critical', value: stats.critical },
            ].map(s => (
              <div key={s.label} className="bg-primary-foreground/10 rounded-lg p-2 text-center backdrop-blur-sm">
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] opacity-70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-4 -mt-3 max-w-lg mx-auto">
        <div className="bg-card rounded-xl shadow-sm border border-border p-3 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reports..."
                className="pl-9 bg-background border-border text-sm h-9"
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9 w-9 p-0"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 gap-2 animate-slide-up">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="text-xs h-8 bg-background"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                  {(Object.entries(CATEGORY_LABELS) as [ReportCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="text-xs h-8 bg-background"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
                  {(Object.entries(PRIORITY_LABELS) as [ReportPriority, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Report List */}
      <div className="px-4 py-4 max-w-lg mx-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {reports.length === 0 ? 'No reports yet' : 'No matching reports'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {reports.length === 0 ? 'Create your first PVP report' : 'Try adjusting your search or filters'}
            </p>
            {reports.length === 0 && (
              <Button onClick={() => setView('create')} className="bg-primary text-primary-foreground gap-1.5">
                <Plus className="w-4 h-4" /> Create Report
              </Button>
            )}
          </div>
        ) : (
          filtered.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={(id) => {
                const r = getReportById(id);
                if (r) { setViewingReport(r); setView('detail'); }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Index;
