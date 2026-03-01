import { useState, useMemo, useEffect } from 'react';
import { Report, ReportCategory, ReportPriority, CATEGORY_LABELS, PRIORITY_LABELS } from '@/types/report';
import { getReports, getReportById } from '@/lib/storage';
import { getUpcomingCount } from '@/lib/maintenance-storage';
import { ReportCard } from '@/components/ReportCard';
import { ReportForm } from '@/components/ReportForm';
import { ReportDetail } from '@/components/ReportDetail';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DataTransferModal } from '@/components/DataTransferModal';
import { AuthSetupModal } from '@/components/AuthSetupModal';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { MaintenanceCalendar } from '@/components/MaintenanceCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ClipboardList, Filter, ArrowUpDown, ArrowLeftRight, Lock, Shield, BarChart3, Calendar } from 'lucide-react';
import { isAuthEnabled } from '@/lib/auth';

type View = 'list' | 'create' | 'edit' | 'detail';
type Tab = 'reports' | 'analytics' | 'calendar';
type SortField = 'date' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

const Index = ({ onLock }: { onLock?: () => void }) => {
  const [tab, setTab] = useState<Tab>('reports');
  const [view, setView] = useState<View>('list');
  const [editingReport, setEditingReport] = useState<Report | undefined>();
  const [viewingReport, setViewingReport] = useState<Report | undefined>();
  const [reports, setReports] = useState<Report[]>(getReports);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    setUpcomingCount(getUpcomingCount());
    const interval = setInterval(() => setUpcomingCount(getUpcomingCount()), 30000);
    return () => clearInterval(interval);
  }, [tab]);

  const refresh = () => setReports(getReports());
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusOrder: Record<string, number> = { 'in-progress': 0, draft: 1, completed: 2, archived: 3 };

  const filtered = useMemo(() => {
    let r = reports;
    if (search) { const q = search.toLowerCase(); r = r.filter(rep => rep.title.toLowerCase().includes(q) || rep.description.toLowerCase().includes(q) || rep.projectName?.toLowerCase().includes(q)); }
    if (filterCategory !== 'all') r = r.filter(rep => rep.category === filterCategory);
    if (filterPriority !== 'all') r = r.filter(rep => rep.priority === filterPriority);
    if (dateFrom) r = r.filter(rep => rep.createdAt >= dateFrom);
    if (dateTo) r = r.filter(rep => new Date(rep.createdAt) <= new Date(dateTo + 'T23:59:59'));
    return [...r].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'priority') cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
      else if (sortField === 'status') cmp = statusOrder[a.status] - statusOrder[b.status];
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [reports, search, filterCategory, filterPriority, sortField, sortDir, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    inProgress: reports.filter(r => r.status === 'in-progress').length,
    critical: reports.filter(r => r.priority === 'critical').length,
  }), [reports]);

  if (view === 'create') return <ReportForm onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} />;
  if (view === 'edit' && editingReport) return <ReportForm report={editingReport} onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} />;
  if (view === 'detail' && viewingReport) return (
    <ReportDetail report={viewingReport} onBack={() => setView('list')}
      onEdit={(id) => { const r = getReportById(id); if (r) { setEditingReport(r); setView('edit'); } }}
      onDeleted={() => { refresh(); setView('list'); }} />
  );

  return (
    <div className="relative min-h-screen">
      <DataTransferModal open={showTransfer} onClose={() => setShowTransfer(false)} onImported={refresh} />
      <AuthSetupModal open={showAuth} onClose={() => setShowAuth(false)} />

      <div className="pb-16">
        {tab === 'analytics' && <AnalyticsDashboard />}
        {tab === 'calendar' && <MaintenanceCalendar />}
        {tab === 'reports' && (
          <div className="min-h-screen bg-background">
            <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
              <div className="max-w-lg mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-lg font-bold tracking-tight">Reports</h1>
                  <div className="flex items-center gap-1.5">
                    {isAuthEnabled() && onLock && (
                      <Button size="sm" variant="ghost" onClick={onLock} className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0" title="Lock app">
                        <Lock className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setShowAuth(true)} className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0"><Shield className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowTransfer(true)} className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0"><ArrowLeftRight className="w-4 h-4" /></Button>
                    <ThemeToggle />
                    <Button size="sm" onClick={() => setView('create')} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 shadow-lg">
                      <Plus className="w-4 h-4" /> New
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[{ label: 'Total', value: stats.total }, { label: 'Done', value: stats.completed }, { label: 'Active', value: stats.inProgress }, { label: 'Critical', value: stats.critical }].map(s => (
                    <div key={s.label} className="bg-primary-foreground/10 rounded-lg p-2 text-center backdrop-blur-sm">
                      <div className="text-lg font-bold">{s.value}</div>
                      <div className="text-[10px] opacity-70">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 -mt-3 max-w-lg mx-auto">
              <div className="bg-card rounded-xl shadow-sm border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports..." className="pl-9 bg-background border-border text-sm h-9" />
                  </div>
                  <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9 w-9 p-0"><Filter className="w-4 h-4" /></Button>
                </div>
                {showFilters && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="text-xs h-8 bg-background"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                          {(Object.entries(CATEGORY_LABELS) as [ReportCategory, string][]).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Select value={filterPriority} onValueChange={setFilterPriority}>
                        <SelectTrigger className="text-xs h-8 bg-background"><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
                          {(Object.entries(PRIORITY_LABELS) as [ReportPriority, string][]).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs h-8 bg-background" />
                      <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs h-8 bg-background" />
                      <Select value={`${sortField}-${sortDir}`} onValueChange={v => { const [f, d] = v.split('-') as [SortField, SortDir]; setSortField(f); setSortDir(d); }}>
                        <SelectTrigger className="text-xs h-8 bg-background"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date-desc" className="text-xs">Newest first</SelectItem>
                          <SelectItem value="date-asc" className="text-xs">Oldest first</SelectItem>
                          <SelectItem value="priority-asc" className="text-xs">Priority ↑</SelectItem>
                          <SelectItem value="priority-desc" className="text-xs">Priority ↓</SelectItem>
                          <SelectItem value="status-asc" className="text-xs">Status ↑</SelectItem>
                          <SelectItem value="status-desc" className="text-xs">Status ↓</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-4 max-w-lg mx-auto space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"><ClipboardList className="w-8 h-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-foreground mb-1">{reports.length === 0 ? 'No reports yet' : 'No matching reports'}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{reports.length === 0 ? 'Create your first report' : 'Try adjusting your search or filters'}</p>
                  {reports.length === 0 && (<Button onClick={() => setView('create')} className="bg-primary text-primary-foreground gap-1.5"><Plus className="w-4 h-4" /> Create Report</Button>)}
                </div>
              ) : (
                filtered.map(report => (
                  <ReportCard key={report.id} report={report} onClick={(id) => { const r = getReportById(id); if (r) { setViewingReport(r); setView('detail'); } }} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border">
        <div className="flex max-w-lg mx-auto">
          {([
            { id: 'reports',   Icon: ClipboardList, label: 'Reports',   badge: 0 },
            { id: 'analytics', Icon: BarChart3,      label: 'Analytics', badge: 0 },
            { id: 'calendar',  Icon: Calendar,       label: 'Calendar',  badge: upcomingCount },
          ] as { id: Tab; Icon: any; label: string; badge: number }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 relative transition-all ${tab === t.id ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="relative">
                <t.Icon className={`w-5 h-5 transition-transform ${tab === t.id ? 'scale-110' : ''}`} />
                {t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {t.badge > 99 ? '99+' : t.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{t.label}</span>
              {tab === t.id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
