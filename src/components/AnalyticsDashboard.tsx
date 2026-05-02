import { useMemo, useState, useEffect } from 'react';
import { getReports, getTimeInProgressMs } from '@/lib/storage';
import { Report, ReportPriority, PRIORITY_LABELS, CATEGORY_LABELS, ReportCategory } from '@/types/report';
import { format, parseISO, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, BarChart3, Activity, Hourglass } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar as ReBar, 
} from 'recharts';

const PRIORITY_CHART_COLORS: Record<ReportPriority, string> = {
  low: '#60a5fa', medium: '#eab308', high: '#f97316', critical: '#ef4444',
};

const CATEGORY_CHART_COLORS = ['#60a5fa', '#34d399', '#f97316', '#a78bfa', '#f472b6', '#facc15', '#94a3b8'];

const PRIORITY_COLORS_TW: Record<ReportPriority, string> = {
  low: 'bg-blue-400', medium: 'bg-yellow-400', high: 'bg-orange-500', critical: 'bg-red-500',
};

function fmtHours(h: number): string {
  if (h === 0) return '0h';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function fmtDuration(ms: number): string {
  if (!ms || ms < 1000) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && mins > 0) parts.push(`${mins}m`);
  return parts.join(' ') || '0m';
}

// Custom tooltip wrapper
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard() {
  const reports = useMemo(() => getReports(), []);
  const [trendRange, setTrendRange] = useState<6 | 12>(6);
  // Tick every 30s so live in-progress timers update on screen
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const hasLive = reports.some(r => r.status === 'in-progress' && r.inProgressStartedAt);
    if (!hasLive) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [reports]);

  const months = useMemo(() => {
    const end = startOfMonth(new Date());
    const start = subMonths(end, trendRange - 1);
    return eachMonthOfInterval({ start, end });
  }, [trendRange]);

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

  const byPriority = useMemo(() => {
    const counts: Record<ReportPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    reports.forEach(r => { counts[r.priority]++; });
    return counts;
  }, [reports]);

  const byCategory = useMemo(() => {
    const counts: Partial<Record<ReportCategory, number>> = {};
    reports.forEach(r => { counts[r.category] = (counts[r.category] ?? 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number)) as [ReportCategory, number][];
  }, [reports]);

  const lostTime = useMemo(() => {
    const withTime = reports.filter(r => r.lostTimeHours && r.lostTimeHours > 0);
    const totalHours = withTime.reduce((sum, r) => sum + (r.lostTimeHours ?? 0), 0);
    const openNoTime = reports.filter(r =>
      r.status !== 'completed' && r.status !== 'archived' && (!r.lostTimeHours || r.lostTimeHours === 0)
    );
    const estimatedHours = openNoTime.reduce((sum, r) => {
      const est: Record<string, number> = { critical: 8, high: 4, medium: 2, low: 0 };
      return sum + (est[r.priority] ?? 0);
    }, 0);
    const topOffenders = [...withTime].sort((a, b) => (b.lostTimeHours ?? 0) - (a.lostTimeHours ?? 0)).slice(0, 4);
    return { totalHours, estimatedHours, withTime: withTime.length, openNoTime: openNoTime.length, topOffenders };
  }, [reports]);

  const overallRate = reports.length === 0 ? 0
    : Math.round((reports.filter(r => r.status === 'completed').length / reports.length) * 100);

  // ─── Time in Progress (auto-tracked) ────────────────────────────────────────
  const timeInProgress = useMemo(() => {
    const nowDate = new Date(now);
    const enriched = reports
      .map(r => ({ report: r, ms: getTimeInProgressMs(r, nowDate) }))
      .filter(x => x.ms > 0);
    const totalMs = enriched.reduce((s, x) => s + x.ms, 0);
    const completed = enriched.filter(x => x.report.status === 'completed');
    const completedAvgMs = completed.length > 0
      ? completed.reduce((s, x) => s + x.ms, 0) / completed.length
      : 0;
    const liveCount = reports.filter(r => r.status === 'in-progress' && r.inProgressStartedAt).length;
    const top = [...enriched].sort((a, b) => b.ms - a.ms).slice(0, 4);
    return { totalMs, completedAvgMs, liveCount, top, count: enriched.length };
  }, [reports, now]);

  const thisMonthKey = format(new Date(), 'yyyy-MM');
  const thisMonth = reports.filter(r => r.createdAt.startsWith(thisMonthKey));
  const thisMonthRate = thisMonth.length === 0 ? 0
    : Math.round((thisMonth.filter(r => r.status === 'completed').length / thisMonth.length) * 100);

  // Data for recharts
  const priorityPieData = (['critical', 'high', 'medium', 'low'] as ReportPriority[])
    .filter(p => byPriority[p] > 0)
    .map(p => ({ name: PRIORITY_LABELS[p], value: byPriority[p], fill: PRIORITY_CHART_COLORS[p] }));

  const categoryPieData = byCategory.map(([cat, count], i) => ({
    name: CATEGORY_LABELS[cat], value: count, fill: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
  }));

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
            { icon: Activity, label: 'This Month', value: `${thisMonthRate}%`, sub: `${thisMonth.length} reports`, color: 'text-primary' },
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

        {/* ── Report Trends (Area Chart) ───────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Report Trends</p>
              <p className="text-xs text-muted-foreground">Created vs Completed</p>
            </div>
            <div className="flex gap-1">
              {([6, 12] as const).map(n => (
                <button key={n} onClick={() => setTrendRange(n)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${trendRange === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {n}M
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={byMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="total" name="Created" stroke="hsl(var(--primary))" fill="url(#gradCreated)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" fill="url(#gradCompleted)" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /><span className="text-[9px] text-muted-foreground">Created</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[9px] text-muted-foreground">Completed</span></div>
          </div>
        </div>

        {/* ── Category Distribution (Pie Chart) ────────────────────────────── */}
        {categoryPieData.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-foreground mb-1">Category Distribution</p>
            <p className="text-xs text-muted-foreground mb-2">All reports by type</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value" animationBegin={0} animationDuration={800}>
                  {categoryPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(value: string) => <span className="text-[10px] text-foreground">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Priority Breakdown (Bar Chart) ───────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Priority Breakdown</p>
              <p className="text-xs text-muted-foreground">All reports</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={priorityPieData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<ChartTooltip />} />
              <ReBar dataKey="value" name="Reports" radius={[0, 6, 6, 0]} barSize={18}>
                {priorityPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </ReBar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Completion Rate (Area) ───────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Completion Rate</p>
              <p className="text-xs text-muted-foreground">Monthly %</p>
            </div>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={byMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="rate" name="Rate" stroke="#60a5fa" fill="url(#gradRate)" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} unit="%" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Time in Progress (auto-tracked) ──────────────────────────────── */}
        <div className={`rounded-xl border p-4 ${timeInProgress.liveCount > 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${timeInProgress.liveCount > 0 ? 'bg-primary/10' : 'bg-muted'}`}>
              <Hourglass className={`w-5 h-5 ${timeInProgress.liveCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Time in Progress</p>
              <p className="text-xs text-muted-foreground">
                Auto-tracked while reports stay <span className="font-medium">in-progress</span>
                {timeInProgress.liveCount > 0 && (
                  <> · <span className="text-primary font-medium">{timeInProgress.liveCount} running</span></>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-card rounded-lg border border-border p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-foreground leading-tight">{fmtDuration(timeInProgress.totalMs)}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg (done)</p>
              <p className="text-lg font-bold text-foreground leading-tight">{fmtDuration(timeInProgress.completedAvgMs)}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Reports</p>
              <p className="text-lg font-bold text-foreground leading-tight">{timeInProgress.count}</p>
            </div>
          </div>

          {timeInProgress.top.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Longest in progress</p>
              {timeInProgress.top.map(({ report, ms }) => {
                const live = report.status === 'in-progress' && !!report.inProgressStartedAt;
                return (
                  <div key={report.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${live ? 'bg-primary/8 border-primary/20' : 'bg-muted/40 border-border'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{report.title}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {report.category} · {report.status}
                        {live && <span className="ml-1 text-primary">● live</span>}
                      </p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${live ? 'text-primary' : 'text-foreground'}`}>{fmtDuration(ms)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              No time tracked yet. Move a report to <span className="font-medium">In Progress</span> to start the clock.
            </p>
          )}
        </div>

        {/* ── Lost Time ────────────────────────────────────────────────────── */}
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

          <div className="flex items-end gap-4 mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Logged</p>
              <span className={`text-3xl font-bold ${lostTime.totalHours > 0 ? 'text-orange-500' : 'text-foreground'}`}>
                {fmtHours(lostTime.totalHours)}
              </span>
            </div>
            {lostTime.estimatedHours > 0 && (
              <div className="pb-0.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">+ Estimated open</p>
                <span className="text-lg font-semibold text-muted-foreground">{fmtHours(lostTime.estimatedHours)}</span>
              </div>
            )}
          </div>

          {byMonth.some(m => m.lostHours > 0) && (
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={byMonth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <ReBar dataKey="lostHours" name="Lost Hours" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {lostTime.topOffenders.length > 0 && (
            <div className="space-y-1.5 mt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top offenders</p>
              {lostTime.topOffenders.map(r => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg bg-orange-500/8 border border-orange-500/15 px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-[9px] text-muted-foreground">{r.category} · {r.status}</p>
                  </div>
                  <span className="text-xs font-bold text-orange-500 shrink-0">{fmtHours(r.lostTimeHours ?? 0)}</span>
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

        {/* Recent activity */}
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Recent Activity</p>
          <div className="space-y-2">
            {reports.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS_TW[r.priority]}`} />
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
