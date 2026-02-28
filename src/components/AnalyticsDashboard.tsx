import { useMemo } from 'react';
import { getReports } from '@/lib/storage';
import { Report, ReportPriority, PRIORITY_LABELS, CATEGORY_LABELS, ReportCategory } from '@/types/report';
import { format, parseISO, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, BarChart3, Activity } from 'lucide-react';

// ─── Tiny inline bar ─────────────────────────────────────────────────────────
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

// ─── Sparkline (SVG) ─────────────────────────────────────────────────────────
function Sparkline({ data, color = '#60a5fa' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 100, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PRIORITY_COLORS: Record<ReportPriority, string> = {
  low: 'bg-blue-400', medium: 'bg-yellow-400', high: 'bg-orange-500', critical: 'bg-red-500',
};
const PRIORITY_TEXT: Record<ReportPriority, string> = {
  low: 'text-blue-500', medium: 'text-yellow-500', high: 'text-orange-500', critical: 'text-red-500',
};

function fmtHours(h: number): string {
  if (h === 0) return '0h';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function AnalyticsDashboard() {
  const reports = useMemo(() => getReports(), []);

  const months = useMemo(() => {
    const end = startOfMonth(new Date());
    const start = subMonths(end, 5);
    return eachMonthOfInterval({ start, end });
  }, []);

  // Per-month stats
  const byMonth = useMemo(() =>
    months.map(m => {
      const key = format(m, 'yyyy-MM');
      const mr = reports.filter(r => r.createdAt.startsWith(key));
      const completed = mr.filter(r => r.status === 'completed').length;
      const lostHours = mr.reduce((sum, r) => sum + (r.lostTimeHours ?? 0), 0);
      return {
        label: format(m, 'MMM'),
        total: mr.length,
        completed,
        rate: mr.length > 0 ? Math.round((completed / mr.length) * 100) : 0,
        lostHours,
      };
    }), [reports, months]);

  // Priority breakdown
  const byPriority = useMemo(() => {
    const counts: Record<ReportPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    reports.forEach(r => { counts[r.priority]++; });
    return counts;
  }, [reports]);

  // Category breakdown
  const byCategory = useMemo(() => {
    const counts: Partial<Record<ReportCategory, number>> = {};
    reports.forEach(r => { counts[r.category] = (counts[r.category] ?? 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5) as [ReportCategory, number][];
  }, [reports]);

  // ── Real lost time from reports ───────────────────────────────────────────
  const lostTime = useMemo(() => {
    // Reports that have explicitly logged lost time
    const withTime = reports.filter(r => r.lostTimeHours && r.lostTimeHours > 0);
    const totalHours = withTime.reduce((sum, r) => sum + (r.lostTimeHours ?? 0), 0);

    // Reports with no logged time but still open (estimated)
    const openNoTime = reports.filter(r =>
      r.status !== 'completed' && r.status !== 'archived' &&
      (!r.lostTimeHours || r.lostTimeHours === 0)
    );
    const estimatedHours = openNoTime.reduce((sum, r) => {
      const est: Record<string, number> = { critical: 8, high: 4, medium: 2, low: 0 };
      return sum + (est[r.priority] ?? 0);
    }, 0);

    // Top offenders (reports with most lost time)
    const topOffenders = [...withTime]
      .sort((a, b) => (b.lostTimeHours ?? 0) - (a.lostTimeHours ?? 0))
      .slice(0, 4);

    return { totalHours, estimatedHours, withTime: withTime.length, openNoTime: openNoTime.length, topOffenders };
  }, [reports]);

  // Monthly lost time trend (actual only)
  const lostTimeTrend = byMonth.map(m => m.lostHours);

  const overallRate = reports.length === 0 ? 0
    : Math.round((reports.filter(r => r.status === 'completed').length / reports.length) * 100);

  const thisMonthKey = format(new Date(), 'yyyy-MM');
  const thisMonth = reports.filter(r => r.createdAt.startsWith(thisMonthKey));
  const thisMonthRate = thisMonth.length === 0 ? 0
    : Math.round((thisMonth.filter(r => r.status === 'completed').length / thisMonth.length) * 100);

  const maxTotal = Math.max(...byMonth.map(m => m.total), 1);

  if (reports.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
          <div className="max-w-lg mx-auto">
            <h1 className="text-lg font-bold tracking-tight">Analytics</h1>
            <p className="text-xs opacity-70 mt-0.5">Insights from your reports</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <BarChart3 className="w-12 h-12 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No data yet</p>
          <p className="text-xs text-muted-foreground">Create reports to see analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold tracking-tight">Analytics</h1>
          <p className="text-xs opacity-70 mt-0.5">Insights from your reports</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: CheckCircle2, label: 'Overall Rate', value: `${overallRate}%`, sub: `${reports.filter(r => r.status === 'completed').length} done`, color: 'text-green-500' },
            { icon: Activity,     label: 'This Month',   value: `${thisMonthRate}%`, sub: `${thisMonth.length} reports`, color: 'text-primary' },
            { icon: AlertTriangle, label: 'Open Critical', value: String(reports.filter(r => r.priority === 'critical' && r.status !== 'completed').length), sub: 'unresolved', color: 'text-red-500' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card rounded-xl border border-border p-3 text-center">
              <kpi.icon className={`w-4 h-4 mx-auto mb-1 ${kpi.color}`} />
              <div className="text-xl font-bold text-foreground">{kpi.value}</div>
              <div className="text-[10px] font-medium text-muted-foreground">{kpi.label}</div>
              <div className="text-[9px] text-muted-foreground/70">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ── LOST TIME — real data ──────────────────────────────────────────── */}
        <div className={`rounded-xl border p-4 ${lostTime.totalHours > 0 ? 'border-orange-500/40 bg-orange-500/5' : 'border-border bg-card'}`}>
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${lostTime.totalHours > 0 ? 'bg-orange-500/10' : 'bg-muted'}`}>
              <Clock className={`w-5 h-5 ${lostTime.totalHours > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Lost Time</p>
              <p className="text-xs text-muted-foreground">Recorded across {lostTime.withTime} report{lostTime.withTime !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Main stat */}
          <div className="flex items-end gap-4 mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Logged</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${lostTime.totalHours > 0 ? 'text-orange-500' : 'text-foreground'}`}>
                  {fmtHours(lostTime.totalHours)}
                </span>
              </div>
            </div>
            {lostTime.estimatedHours > 0 && (
              <div className="pb-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">+ Estimated open</p>
                <span className="text-lg font-semibold text-muted-foreground">{fmtHours(lostTime.estimatedHours)}</span>
              </div>
            )}
          </div>

          {/* Monthly lost time bars */}
          {lostTimeTrend.some(v => v > 0) && (
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground mb-1">By month</p>
              <Sparkline data={lostTimeTrend} color="#f97316" />
              <div className="flex justify-between mt-0.5">
                {byMonth.map(m => (
                  <div key={m.label} className="flex flex-col items-center">
                    <span className="text-[9px] text-orange-500 font-medium">{m.lostHours > 0 ? fmtHours(m.lostHours) : ''}</span>
                    <span className="text-[8px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top offenders */}
          {lostTime.topOffenders.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top offenders</p>
              {lostTime.topOffenders.map(r => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg bg-orange-500/8 border border-orange-500/15 px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[9px] text-muted-foreground">{r.category} · {r.status}</p>
                  </div>
                  <span className="text-xs font-bold text-orange-500 shrink-0">
                    {fmtHours(r.lostTimeHours ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {lostTime.withTime === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              No lost time logged yet. Add it when creating or editing a report.
            </p>
          )}
        </div>

        {/* Completion rate sparkline */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Completion Rate</p>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <Sparkline data={byMonth.map(m => m.rate)} color="#60a5fa" />
          <div className="flex justify-between mt-1">
            {byMonth.map(m => (
              <div key={m.label} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-medium text-foreground">{m.rate}%</span>
                <span className="text-[8px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reports created per month */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Reports Created</p>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-2">
            {byMonth.map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-8 shrink-0">{m.label}</span>
                <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden relative">
                  <div className="h-full bg-primary/70 rounded-md transition-all duration-500"
                    style={{ width: `${(m.total / maxTotal) * 100}%` }} />
                  {m.completed > 0 && (
                    <div className="absolute top-0 left-0 h-full bg-green-500/60 rounded-md transition-all duration-500"
                      style={{ width: `${(m.completed / maxTotal) * 100}%` }} />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground w-6 shrink-0 text-right">{m.total}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-primary/70" /><span className="text-[9px] text-muted-foreground">Created</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-green-500/60" /><span className="text-[9px] text-muted-foreground">Completed</span></div>
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Priority Breakdown</p>
              <p className="text-xs text-muted-foreground">All reports</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="space-y-2.5">
            {(['critical', 'high', 'medium', 'low'] as ReportPriority[]).map(p => (
              <div key={p}>
                <div className="flex justify-between mb-1">
                  <span className={`text-xs font-medium capitalize ${PRIORITY_TEXT[p]}`}>{PRIORITY_LABELS[p]}</span>
                  <span className="text-xs text-muted-foreground">{byPriority[p]} reports</span>
                </div>
                <Bar value={byPriority[p]} max={reports.length} color={PRIORITY_COLORS[p]} />
              </div>
            ))}
          </div>
        </div>

        {/* Top categories */}
        {byCategory.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Top Categories</p>
            <div className="space-y-2">
              {byCategory.map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-foreground">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-xs text-muted-foreground">{count}</span>
                  </div>
                  <Bar value={count} max={reports.length} color="bg-primary/60" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Recent Activity</p>
          <div className="space-y-2">
            {reports.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[r.priority]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{r.title}</p>
                </div>
                {r.lostTimeHours ? (
                  <span className="text-[9px] font-medium text-orange-500 shrink-0 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{fmtHours(r.lostTimeHours)}
                  </span>
                ) : null}
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(parseISO(r.createdAt), 'MMM d')}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  r.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                  r.status === 'in-progress' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-muted text-muted-foreground'
                }`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
