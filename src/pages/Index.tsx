import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Report, ReportCategory, ReportPriority, CATEGORY_LABELS, PRIORITY_LABELS } from '@/types/report';
import { getReports, getReportById } from '@/lib/storage';
import { getUpcomingCount, getDueSoonEvents } from '@/lib/maintenance-storage';
import { getInventoryDueCount, getDueSoonInventory, getDueSoonService } from '@/lib/inventory-storage';
import { toast } from '@/hooks/use-toast';
import { ReportCard } from '@/components/ReportCard';
import { ReportForm } from '@/components/ReportForm';
import { ReportDetail } from '@/components/ReportDetail';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DataTransferModal } from '@/components/DataTransferModal';
import { AuthSetupModal } from '@/components/AuthSetupModal';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { MaintenanceCalendar } from '@/components/MaintenanceCalendar';
import { ActivityLog } from '@/components/ActivityLog';
import { AdminGate } from '@/components/AdminGate';
import { InventoryList } from '@/components/InventoryList';
import { CredentialVault } from '@/components/CredentialVault';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, ClipboardList, Filter, ArrowUpDown, ArrowLeftRight, Lock, Shield, BarChart3, Calendar, Package, CheckSquare, FileDown, FileText, FileSpreadsheet, History, KeyRound } from 'lucide-react';
import { exportBatchReportsToPdf } from '@/lib/export-pdf';
import { exportReportsCsv, exportReportsXlsx } from '@/lib/export-csv-xlsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isAuthEnabled } from '@/lib/auth';

type View = 'list' | 'create' | 'edit' | 'detail';
type Tab = 'reports' | 'analytics' | 'calendar' | 'inventory' | 'vault' | 'activity';
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
  const [inventoryDueCount, setInventoryDueCount] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchExporting, setBatchExporting] = useState(false);

  // Secret triple-tap to open admin activity log
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setTab('activity');
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 500);
    }
  }, []);

  useEffect(() => {
    setUpcomingCount(getUpcomingCount());
    setInventoryDueCount(getInventoryDueCount());
    const interval = setInterval(() => {
      setUpcomingCount(getUpcomingCount());
      setInventoryDueCount(getInventoryDueCount());
    }, 30000);
    return () => clearInterval(interval);
  }, [tab]);

  // Session-once toast for today/tomorrow maintenance
  useEffect(() => {
    const SESSION_KEY = 'maintenance-toast-shown';
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const alerts = getDueSoonEvents();
    if (alerts.length === 0) return;

    sessionStorage.setItem(SESSION_KEY, '1');

    const todayCount = alerts.filter(a => a.isToday).length;
    const tomorrowCount = alerts.filter(a => !a.isToday).length;

    const parts: string[] = [];
    if (todayCount) parts.push(`${todayCount} due today`);
    if (tomorrowCount) parts.push(`${tomorrowCount} due tomorrow`);

    if (parts.length > 0) {
      toast({
        title: '🔧 Upcoming Maintenance',
        description: parts.join(', ') + '. Tap Calendar to view details.',
      });
    }

    // Inventory alerts
    const invAlerts = getDueSoonInventory();
    if (invAlerts.length > 0) {
      const overdue = invAlerts.filter(a => a.isOverdue).length;
      const invToday = invAlerts.filter(a => a.isToday).length;
      const invTomorrow = invAlerts.filter(a => a.isTomorrow).length;
      const invParts: string[] = [];
      if (overdue) invParts.push(`${overdue} overdue`);
      if (invToday) invParts.push(`${invToday} due today`);
      if (invTomorrow) invParts.push(`${invTomorrow} due tomorrow`);
      toast({
        title: '📦 Inventory Returns',
        description: invParts.join(', ') + '. Tap Inventory to review.',
      });
    }

    // Service-return alerts (items being serviced outside the company)
    const svcAlerts = getDueSoonService();
    if (svcAlerts.length > 0) {
      const overdue = svcAlerts.filter(a => a.isOverdue);
      const svcToday = svcAlerts.filter(a => a.isToday);
      const svcTomorrow = svcAlerts.filter(a => a.isTomorrow);
      const parts: string[] = [];
      if (overdue.length) parts.push(`${overdue.length} overdue`);
      if (svcToday.length) parts.push(`${svcToday.length} due today`);
      if (svcTomorrow.length) parts.push(`${svcTomorrow.length} due tomorrow`);
      const names = [...overdue, ...svcToday, ...svcTomorrow]
        .slice(0, 3).map(a => a.item.name).join(', ');
      const description = `${parts.join(', ')}: ${names}${svcAlerts.length > 3 ? '…' : ''}. Tap Inventory or Calendar.`;
      toast({ title: '🔧 Serviced items', description });

      // Optional browser push notification
      if (typeof Notification !== 'undefined') {
        const fire = () => {
          try {
            new Notification('Serviced items due', {
              body: description,
              tag: 'service-due',
            });
          } catch { /* ignore */ }
        };
        if (Notification.permission === 'granted') fire();
        else if (Notification.permission === 'default') {
          Notification.requestPermission().then(p => { if (p === 'granted') fire(); }).catch(() => {});
        }
      }
    }
  }, []);

  const refresh = () => setReports(getReports());
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const handleBatchExport = async () => {
    const selected = reports.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) return;
    setBatchExporting(true);
    try {
      await exportBatchReportsToPdf(selected);
      toast({ title: '✅ Batch PDF exported', description: `${selected.length} reports combined into one PDF.` });
      setSelectMode(false); setSelectedIds(new Set());
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally { setBatchExporting(false); }
  };
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

  if (view === 'create') return <div key="create" className="min-h-screen animate-fade-in"><ReportForm onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} /></div>;
  if (view === 'edit' && editingReport) return <div key="edit" className="min-h-screen animate-fade-in"><ReportForm report={editingReport} onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} /></div>;
  if (view === 'detail' && viewingReport) return (
    <div key="detail" className="min-h-screen animate-fade-in">
      <ReportDetail report={viewingReport} onBack={() => setView('list')}
        onEdit={(id) => { const r = getReportById(id); if (r) { setEditingReport(r); setView('edit'); } }}
        onDeleted={() => { refresh(); setView('list'); }} />
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <DataTransferModal open={showTransfer} onClose={() => setShowTransfer(false)} onImported={refresh} />
      <AuthSetupModal open={showAuth} onClose={() => setShowAuth(false)} />

      <div className="pb-16">
        {tab === 'analytics' && <AnalyticsDashboard />}
        {tab === 'calendar' && <MaintenanceCalendar />}
        {tab === 'inventory' && <InventoryList />}
        {tab === 'vault' && <CredentialVault />}
        {tab === 'activity' && <AdminGate>{({ onLogout }) => <ActivityLog onLogout={() => { onLogout(); setTab('reports'); }} />}</AdminGate>}
        {tab === 'reports' && (
          <div className="min-h-screen bg-background">
            <div className="bg-card text-foreground px-4 pt-12 pb-6 border-b border-border">
              <div className="max-w-lg mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground select-none" onClick={handleSecretTap}>Reports</h1>
                  <div className="flex items-center gap-1.5">
                    {reports.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                        className={`text-foreground hover:bg-muted h-8 w-8 p-0 ${selectMode ? 'bg-muted' : ''}`} title="Select reports">
                        <CheckSquare className="w-4 h-4" />
                      </Button>
                    )}
                    {isAuthEnabled() && onLock && (
                      <Button size="sm" variant="ghost" onClick={onLock} className="text-foreground hover:bg-muted h-8 w-8 p-0" title="Lock app">
                        <Lock className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setShowAuth(true)} className="text-foreground hover:bg-muted h-8 w-8 p-0"><Shield className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowTransfer(true)} className="text-foreground hover:bg-muted h-8 w-8 p-0"><ArrowLeftRight className="w-4 h-4" /></Button>
                    <ThemeToggle />
                    <Button size="sm" onClick={() => setView('create')} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1 rounded-full px-4 font-display font-bold tracking-wide shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
                      <Plus className="w-4 h-4" /> NEW
                    </Button>
                  </div>
                </div>
                {selectMode && (
                  <div className="flex items-center gap-2 mb-2">
                    <Button size="sm" variant="secondary" className="text-xs h-7" onClick={() => {
                      if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filtered.map(r => r.id)));
                    }}>
                      {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90 gap-1 text-xs h-7"
                          disabled={selectedIds.size === 0 || batchExporting}>
                          <FileDown className="w-3.5 h-3.5" />
                          {batchExporting ? 'Exporting…' : 'Export'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleBatchExport} className="gap-2">
                          <FileText className="w-4 h-4" /> PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { exportReportsCsv(reports.filter(r => selectedIds.has(r.id))); setSelectMode(false); setSelectedIds(new Set()); }} className="gap-2">
                          <FileDown className="w-4 h-4" /> CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { exportReportsXlsx(reports.filter(r => selectedIds.has(r.id))); setSelectMode(false); setSelectedIds(new Set()); }} className="gap-2">
                          <FileSpreadsheet className="w-4 h-4" /> Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                {/* Bento Grid Stats — Noir editorial layout */}
                <div className="grid grid-cols-4 grid-rows-2 gap-2 h-44">
                  <div className="col-span-2 row-span-2 bg-muted rounded-2xl p-4 border border-border flex flex-col justify-between">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">Total Reports</span>
                    <div className="flex items-end gap-1">
                      <span className="font-display text-5xl font-extrabold text-foreground leading-none">{stats.total}</span>
                    </div>
                  </div>
                  <div className="col-span-2 bg-muted rounded-2xl p-3 border border-border flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">Active</span>
                      <span className="font-display text-xl font-bold text-foreground">{stats.inProgress}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                  </div>
                  <div className="col-span-1 bg-muted rounded-2xl p-2 border border-destructive/30 flex flex-col justify-center items-center">
                    <span className="font-display text-lg font-bold text-destructive">{String(stats.critical).padStart(2, '0')}</span>
                    <span className="text-[8px] uppercase tracking-tight text-muted-foreground">Critical</span>
                  </div>
                  <div className="col-span-1 bg-muted rounded-2xl p-2 border border-border flex flex-col justify-center items-center">
                    <span className="font-display text-lg font-bold text-foreground">{String(stats.completed).padStart(2, '0')}</span>
                    <span className="text-[8px] uppercase tracking-tight text-muted-foreground">Done</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pt-4 max-w-lg mx-auto">
              <div className="bg-card rounded-2xl border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search archives..." className="pl-9 bg-muted border-border text-sm h-9 rounded-xl" />
                  </div>
                  <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9 w-9 p-0 rounded-xl"><Filter className="w-4 h-4" /></Button>
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
              <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-primary font-medium mb-1 px-1">Recent Intelligence</div>
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"><ClipboardList className="w-8 h-8 text-muted-foreground" /></div>
                  <h3 className="font-semibold text-foreground mb-1">{reports.length === 0 ? 'No reports yet' : 'No matching reports'}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{reports.length === 0 ? 'Create your first report' : 'Try adjusting your search or filters'}</p>
                  {reports.length === 0 && (<Button onClick={() => setView('create')} className="bg-primary text-primary-foreground gap-1.5"><Plus className="w-4 h-4" /> Create Report</Button>)}
                </div>
              ) : (
                filtered.map(report => (
                  <div key={report.id} className="flex items-start gap-2">
                    {selectMode && (
                      <button onClick={() => toggleSelect(report.id)}
                        className={`mt-4 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(report.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background'
                        }`}>
                        {selectedIds.has(report.id) && <CheckSquare className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <div className="flex-1">
                      <ReportCard report={report} onClick={(id) => {
                        if (selectMode) { toggleSelect(id); return; }
                        const r = getReportById(id); if (r) { setViewingReport(r); setView('detail'); }
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar — Noir editorial */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border">
        <div className="flex max-w-lg mx-auto px-2">
          {([
            { id: 'reports',   Icon: ClipboardList, label: 'Reports',   badge: 0 },
            { id: 'analytics', Icon: BarChart3,      label: 'Analytics', badge: 0 },
            { id: 'calendar',  Icon: Calendar,       label: 'Calendar',  badge: upcomingCount },
            { id: 'inventory', Icon: Package,        label: 'Inventory', badge: inventoryDueCount },
            { id: 'vault',     Icon: KeyRound,       label: 'Vault',     badge: 0 },
          ] as { id: Tab; Icon: any; label: string; badge: number }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-3 px-1 relative transition-all ${tab === t.id ? 'text-primary' : 'text-muted-foreground opacity-60'}`}>
              <div className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-all ${tab === t.id ? 'bg-primary shadow-[0_0_6px_hsl(var(--primary))]' : 'bg-transparent'}`} />
              <div className="relative">
                <t.Icon className={`w-5 h-5 transition-transform ${tab === t.id ? 'scale-110' : ''}`} />
                {t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {t.badge > 99 ? '99+' : t.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] uppercase tracking-widest ${tab === t.id ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
