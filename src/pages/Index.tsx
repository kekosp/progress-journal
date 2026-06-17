// Index.tsx — thin shell: manages tabs, alerts, modals, bottom nav.
// All report list logic lives in ReportsTab.tsx.

import { useState, useEffect, useRef, useCallback } from 'react';
import { getReports } from '@/lib/storage';
import { getUpcomingCount, getDueSoonEvents } from '@/lib/maintenance-storage';
import { getInventoryDueCount, getDueSoonInventory, getDueSoonService } from '@/lib/inventory-storage';
import { toast } from '@/components/ui/use-toast';
import { Report } from '@/types/report';
import { ReportsTab } from '@/components/ReportsTab';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { MaintenanceCalendar } from '@/components/MaintenanceCalendar';
import { ActivityLog } from '@/components/ActivityLog';
import { AdminGate } from '@/components/AdminGate';
import { InventoryList } from '@/components/InventoryList';
import { CredentialVault } from '@/components/CredentialVault';
import { DataTransferModal } from '@/components/DataTransferModal';
import { AuthSetupModal } from '@/components/AuthSetupModal';
import { BarChart3, Calendar, ClipboardList, KeyRound, Package } from 'lucide-react';

type Tab = 'reports' | 'analytics' | 'calendar' | 'inventory' | 'vault' | 'activity';

const Index = ({ onLock }: { onLock?: () => void }) => {
  const [tab, setTab]                       = useState<Tab>('reports');
  const [reports, setReports]               = useState<Report[]>(getReports);
  const [showTransfer, setShowTransfer]     = useState(false);
  const [showAuth, setShowAuth]             = useState(false);
  const [upcomingCount, setUpcomingCount]   = useState(0);
  const [inventoryDueCount, setInventoryDueCount] = useState(0);

  // ── Badge counts — poll every 30 s ────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      setUpcomingCount(getUpcomingCount());
      setInventoryDueCount(getInventoryDueCount());
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [tab]);

  // ── Session-once alert toasts ──────────────────────────────────────────────
  useEffect(() => {
    const SESSION_KEY = 'maintenance-toast-shown';
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');

    // Maintenance due soon
    const mAlerts = getDueSoonEvents();
    if (mAlerts.length > 0) {
      const todayCount    = mAlerts.filter(a => a.isToday).length;
      const tomorrowCount = mAlerts.filter(a => !a.isToday).length;
      const parts: string[] = [];
      if (todayCount)    parts.push(`${todayCount} due today`);
      if (tomorrowCount) parts.push(`${tomorrowCount} due tomorrow`);
      toast({ title: '🔧 Upcoming Maintenance', description: parts.join(', ') + '. Tap Calendar to view details.' });
    }

    // Inventory returns
    const invAlerts = getDueSoonInventory();
    if (invAlerts.length > 0) {
      const parts: string[] = [];
      const overdue    = invAlerts.filter(a => a.isOverdue).length;
      const invToday   = invAlerts.filter(a => a.isToday).length;
      const invTomorrow= invAlerts.filter(a => a.isTomorrow).length;
      if (overdue)     parts.push(`${overdue} overdue`);
      if (invToday)    parts.push(`${invToday} due today`);
      if (invTomorrow) parts.push(`${invTomorrow} due tomorrow`);
      toast({ title: '📦 Inventory Returns', description: parts.join(', ') + '. Tap Inventory to review.' });
    }

    // Service-return alerts
    const svcAlerts = getDueSoonService();
    if (svcAlerts.length > 0) {
      const overdue    = svcAlerts.filter(a => a.isOverdue);
      const svcToday   = svcAlerts.filter(a => a.isToday);
      const svcTomorrow= svcAlerts.filter(a => a.isTomorrow);
      const parts: string[] = [];
      if (overdue.length)     parts.push(`${overdue.length} overdue`);
      if (svcToday.length)    parts.push(`${svcToday.length} due today`);
      if (svcTomorrow.length) parts.push(`${svcTomorrow.length} due tomorrow`);
      const names = [...overdue, ...svcToday, ...svcTomorrow]
        .slice(0, 3).map(a => a.item.name).join(', ');
      toast({ title: '🔧 Serviced items', description: `${parts.join(', ')}: ${names}${svcAlerts.length > 3 ? '…' : ''}. Tap Inventory or Calendar.` });
    }
  }, []);

  // ── Secret triple-tap → activity log ──────────────────────────────────────
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

  const refresh = useCallback(() => setReports(getReports()), []);

  return (
    <div className="relative min-h-screen">
      <DataTransferModal open={showTransfer} onClose={() => setShowTransfer(false)} onImported={refresh} />
      <AuthSetupModal open={showAuth} onClose={() => setShowAuth(false)} />

      <div className="pb-16">
        {tab === 'analytics' && <div key="analytics" className="animate-fade-in"><AnalyticsDashboard /></div>}
        {tab === 'calendar'  && <div key="calendar"  className="animate-fade-in"><MaintenanceCalendar /></div>}
        {tab === 'inventory' && <div key="inventory" className="animate-fade-in"><InventoryList /></div>}
        {tab === 'vault'     && <div key="vault"     className="animate-fade-in"><CredentialVault /></div>}
        {tab === 'activity'  && (
          <div key="activity" className="animate-fade-in">
            <AdminGate>{({ onLogout }) =>
              <ActivityLog onLogout={() => { onLogout(); setTab('reports'); }} />
            }</AdminGate>
          </div>
        )}
        {tab === 'reports' && (
          <ReportsTab
            reports={reports}
            onRefresh={refresh}
            onLock={onLock}
            onSecretTap={handleSecretTap}
            onShowTransfer={() => setShowTransfer(true)}
            onShowAuth={() => setShowAuth(true)}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border">
        <div className="flex max-w-lg mx-auto px-2">
          {([
            { id: 'reports',   Icon: ClipboardList, label: 'Reports',   badge: 0 },
            { id: 'analytics', Icon: BarChart3,      label: 'Analytics', badge: 0 },
            { id: 'calendar',  Icon: Calendar,       label: 'Calendar',  badge: upcomingCount },
            { id: 'inventory', Icon: Package,        label: 'Inventory', badge: inventoryDueCount },
            { id: 'vault',     Icon: KeyRound,       label: 'Vault',     badge: 0 },
          ] as { id: Tab; Icon: React.ComponentType<{ className?: string }>; label: string; badge: number }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-3 px-1 relative transition-all
                ${tab === t.id ? 'text-primary' : 'text-muted-foreground opacity-60'}`}>
              <div className={`w-1.5 h-1.5 rounded-full mb-0.5 transition-all
                ${tab === t.id ? 'bg-primary shadow-[0_0_6px_hsl(var(--primary))]' : 'bg-transparent'}`} />
              <div className="relative">
                <t.Icon className={`w-5 h-5 transition-transform ${tab === t.id ? 'scale-110' : ''}`} />
                {t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {t.badge > 99 ? '99+' : t.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] uppercase tracking-widest ${tab === t.id ? 'font-bold' : 'font-medium'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
