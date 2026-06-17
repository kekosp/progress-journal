import { useState, useMemo, useRef } from 'react';
import {
  getEvents, saveEvent, saveRecurringEvent, deleteEvent, deleteEventSeries,
  toggleEventComplete, generateEventId,
  MaintenanceEvent, MaintenancePriority, MaintenanceCategory, RepeatFrequency,
  CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_BORDER,
} from '@/lib/maintenance-storage';
import { getReports } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Check, X, Calendar, ClipboardList, Upload, Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isSameMonth, isToday, parseISO, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  repeat: RepeatFrequency;
  repeatEndDate: string;
}

const empty = (date?: string): EventFormData => ({
  title: '', description: '', date: date ?? format(new Date(), 'yyyy-MM-dd'),
  time: '',
  category: 'maintenance', priority: 'medium',
  repeat: 'none', repeatEndDate: '',
});

export function MaintenanceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [calView, setCalView] = useState<'month' | 'week'>('month');
  const [events, setEvents] = useState<MaintenanceEvent[]>(getEvents);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MaintenanceEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(empty());
  const [showDayModal, setShowDayModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => setEvents(getEvents());

  // Also pull existing reports onto the calendar
  const reports = useMemo(() => getReports(), [events]);

  // Days grid
  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startPadding = getDay(startOfMonth(currentMonth)); // 0=Sun

  const eventsForDay = (date: Date) =>
    events.filter(e => isSameDay(parseISO(e.date), date));

  const reportsForDay = (date: Date) =>
    reports.filter(r => isSameDay(parseISO(r.createdAt), date));

  // Upcoming events (next 7 days)
  const upcoming = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
    return events
      .filter(e => !e.completed && parseISO(e.date) >= now && parseISO(e.date) <= in7)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  function openNewForm(date: Date) {
    setEditingEvent(null);
    setForm(empty(format(date, 'yyyy-MM-dd')));
    setShowDayModal(false);
    setShowForm(true);
  }

  function openEditForm(evt: MaintenanceEvent) {
    setEditingEvent(evt);
    setForm({
      title: evt.title, description: evt.description ?? '',
      date: evt.date, time: evt.time ?? '',
      category: evt.category, priority: evt.priority,
      repeat: evt.repeat ?? 'none', repeatEndDate: evt.repeatEndDate ?? '',
    });
    setShowDayModal(false);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    const event: MaintenanceEvent = {
      id: editingEvent?.id ?? generateEventId(),
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      date: form.date,
      time: form.time || undefined,
      category: form.category,
      priority: form.priority,
      completed: editingEvent?.completed ?? false,
      completedAt: editingEvent?.completedAt,
      repeat: form.repeat !== 'none' ? form.repeat : undefined,
      repeatEndDate: form.repeat !== 'none' && form.repeatEndDate ? form.repeatEndDate : undefined,
      repeatParentId: editingEvent?.repeatParentId,
    };
    if (form.repeat && form.repeat !== 'none') {
      saveRecurringEvent(event);
    } else {
      saveEvent(event);
    }
    refresh();
    setShowForm(false);
  }

  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState<string | null>(null);

  function handleDelete(id: string) {
    const evt = events.find(e => e.id === id);
    if (evt?.repeatParentId) {
      setConfirmDeleteSeries(id);
    } else {
      deleteEvent(id);
      refresh();
    }
  }

  function handleToggle(id: string) {
    toggleEventComplete(id);
    refresh();
  }

  function normalizeDate(input: string): string | null {
    if (!input) return null;
    const s = String(input).trim();
    // YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    // DD/MM/YYYY or MM/DD/YYYY -> assume DD/MM/YYYY
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
    return null;
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        let imported = 0, skipped = 0;
        const validCats: MaintenanceCategory[] = ['inspection','maintenance','safety','quality','progress','incident','other'];
        const validPris: MaintenancePriority[] = ['low','medium','high','critical'];
        rows.forEach(row => {
          const lower: any = {};
          Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });
          const title = String(lower.title || lower.name || '').trim();
          const dateRaw = String(lower.date || lower.scheduled || '').trim();
          const date = normalizeDate(dateRaw);
          if (!title || !date) { skipped++; return; }
          const catRaw = String(lower.category || 'maintenance').toLowerCase().trim() as MaintenanceCategory;
          const priRaw = String(lower.priority || 'medium').toLowerCase().trim() as MaintenancePriority;
          const category = validCats.includes(catRaw) ? catRaw : 'maintenance';
          const priority = validPris.includes(priRaw) ? priRaw : 'medium';
          const description = String(lower.description || lower.notes || '').trim() || undefined;
          const timeRaw = String(lower.time || '').trim();
          const time = /^\d{1,2}:\d{2}$/.test(timeRaw)
            ? timeRaw.padStart(5, '0')  // ensure HH:MM
            : undefined;
          saveEvent({
            id: generateEventId(),
            title: title.slice(0, 200),
            description: description?.slice(0, 1000),
            date,
            time,
            category,
            priority,
            completed: false,
          });
          imported++;
        });
        refresh();
        toast({
          title: imported > 0 ? 'Import complete' : 'No events imported',
          description: `Imported ${imported}${skipped ? ` · Skipped ${skipped}` : ''}. Expected columns: title, date, category, priority, description.`,
        });
      } catch (err) {
        toast({ title: 'Import failed', description: 'Could not parse file.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
  }

  const selectedDayEvents = selectedDate
    ? eventsForDay(selectedDate).slice().sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    : [];
  const selectedDayReports = selectedDate ? reportsForDay(selectedDate) : [];

  function formatTime(t?: string): string {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold tracking-tight">Maintenance Calendar</h1>
          <p className="text-xs opacity-70 mt-0.5">Schedule and track planned maintenance</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">

        {/* Import CSV */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsvFile(f);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <Button
          variant="outline"
          className="w-full gap-2 h-9"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="text-xs">Import schedule from CSV</span>
        </Button>

        {/* View toggle + navigation */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button
              onClick={() => calView === 'month' ? setCurrentMonth(m => subMonths(m, 1)) : setCurrentWeek(w => subWeeks(w, 1))}
              className="p-1 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center gap-1">
              <span className="font-semibold text-sm">
                {calView === 'month'
                  ? format(currentMonth, 'MMMM yyyy')
                  : `${format(startOfWeek(currentWeek), 'MMM d')} – ${format(endOfWeek(currentWeek), 'MMM d, yyyy')}`}
              </span>
              {/* Month / Week toggle */}
              <div className="flex rounded-full bg-muted p-0.5 gap-0.5">
                {(['month', 'week'] as const).map(v => (
                  <button key={v} onClick={() => setCalView(v)}
                    className={`text-[10px] px-3 py-0.5 rounded-full font-semibold transition-colors capitalize
                      ${calView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => calView === 'month' ? setCurrentMonth(m => addMonths(m, 1)) : setCurrentWeek(w => addWeeks(w, 1))}
              className="p-1 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {calView === 'month' ? (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-border">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="min-h-[56px] border-b border-r border-border/50" />
                ))}
                {days.map((day, idx) => {
                  const dayEvents = eventsForDay(day);
                  const dayReports = reportsForDay(day);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const col = (startPadding + idx) % 7;
                  return (
                    <div key={day.toISOString()}
                      onClick={() => { setSelectedDate(day); setShowDayModal(true); }}
                      className={`min-h-[56px] p-1 border-b border-border/50 cursor-pointer transition-colors
                        ${col < 6 ? 'border-r' : ''}
                        ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                        ${!isSameMonth(day, currentMonth) ? 'opacity-30' : ''}`}>
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 mx-auto
                        ${isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {dayEvents.slice(0, 3).map(e => (
                          <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${e.completed ? 'opacity-40' : ''} ${PRIORITY_COLORS[e.priority]}`} />
                        ))}
                        {dayReports.slice(0, 2).map(r => (
                          <div key={r.id} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                        ))}
                        {(dayEvents.length + dayReports.length) > 3 && (
                          <span className="text-[8px] text-muted-foreground leading-none">+{dayEvents.length + dayReports.length - 3}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── WEEK VIEW ── */
            (() => {
              const weekDays = eachDayOfInterval({ start: startOfWeek(currentWeek), end: endOfWeek(currentWeek) });
              const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 – 22:00
              return (
                <div className="overflow-x-auto">
                  {/* Day headers */}
                  <div className="grid border-b border-border" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
                    <div className="border-r border-border" />
                    {weekDays.map(d => (
                      <div key={d.toISOString()}
                        onClick={() => { setSelectedDate(d); setShowDayModal(true); }}
                        className={`text-center py-2 cursor-pointer hover:bg-muted/50 transition-colors border-r border-border last:border-r-0
                          ${isToday(d) ? 'bg-primary/10' : ''}`}>
                        <p className="text-[9px] font-medium text-muted-foreground">{format(d, 'EEE')}</p>
                        <p className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full
                          ${isToday(d) ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                          {format(d, 'd')}
                        </p>
                        {/* Event count badge */}
                        {eventsForDay(d).length > 0 && (
                          <div className="flex justify-center gap-0.5 mt-0.5">
                            {eventsForDay(d).slice(0, 3).map(e => (
                              <div key={e.id} className={`w-1 h-1 rounded-full ${PRIORITY_COLORS[e.priority]}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Time grid */}
                  <div className="overflow-y-auto max-h-[400px]">
                    {hours.map(h => (
                      <div key={h} className="grid border-b border-border/40" style={{ gridTemplateColumns: '44px repeat(7, 1fr)', minHeight: '48px' }}>
                        {/* Hour label */}
                        <div className="border-r border-border px-1 pt-1 text-[9px] text-muted-foreground font-medium text-right pr-2 shrink-0">
                          {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
                        </div>
                        {/* Day columns */}
                        {weekDays.map(d => {
                          const slotEvents = eventsForDay(d).filter(e => {
                            if (!e.time) return false;
                            const [eh] = e.time.split(':').map(Number);
                            return eh === h;
                          });
                          const hasUntimedEvents = h === 8 && eventsForDay(d).filter(e => !e.time).length > 0;
                          return (
                            <div key={d.toISOString()}
                              className={`border-r border-border/40 last:border-r-0 p-0.5 relative
                                ${isToday(d) ? 'bg-primary/5' : ''}`}>
                              {slotEvents.map(e => (
                                <div key={e.id}
                                  onClick={() => { setSelectedDate(d); setShowDayModal(true); }}
                                  className={`text-[9px] font-semibold px-1 py-0.5 rounded mb-0.5 cursor-pointer truncate leading-tight
                                    border-l-2 ${PRIORITY_BORDER[e.priority]}
                                    ${e.completed ? 'opacity-50 line-through' : ''}
                                    bg-card`}>
                                  {e.title}
                                </div>
                              ))}
                              {hasUntimedEvents && eventsForDay(d).filter(e => !e.time).map(e => (
                                <div key={e.id}
                                  onClick={() => { setSelectedDate(d); setShowDayModal(true); }}
                                  className={`text-[9px] font-semibold px-1 py-0.5 rounded mb-0.5 cursor-pointer truncate leading-tight
                                    border-l-2 border-dashed ${PRIORITY_BORDER[e.priority]}
                                    ${e.completed ? 'opacity-50 line-through' : ''}
                                    bg-card`}>
                                  {e.title}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap px-1">
          {(Object.entries(PRIORITY_COLORS) as [MaintenancePriority, string][]).map(([p, cls]) => (
            <div key={p} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
              <span className="text-[10px] text-muted-foreground capitalize">{p}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground">Report</span>
          </div>
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming (7 days)</p>
            {upcoming.map(e => (
              <div key={e.id} className={`flex items-center gap-2 rounded-lg border-l-4 pl-2 py-1.5 bg-muted/30 ${PRIORITY_BORDER[e.priority]}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {format(parseISO(e.date), 'EEE, MMM d')}
                    {e.time && <><Clock className="w-2.5 h-2.5 ml-0.5" />{formatTime(e.time)}</>}
                    {' · '}{CATEGORY_LABELS[e.category]}
                  </p>
                </div>
                <button onClick={() => handleToggle(e.id)}
                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-primary hover:border-primary hover:text-primary-foreground transition-colors shrink-0">
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day detail modal */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-sm font-bold">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 space-y-2 max-h-[60vh] overflow-y-auto">
            {/* Scheduled events */}
            {selectedDayEvents.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scheduled</p>
                {selectedDayEvents.map(e => (
                  <div key={e.id} className={`rounded-lg border-l-4 pl-2 py-2 bg-muted/30 flex items-start gap-2 ${PRIORITY_BORDER[e.priority]}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${e.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{e.title}</p>
                      {e.description && <p className="text-[10px] text-muted-foreground mt-0.5">{e.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        {e.time && <><Clock className="w-2.5 h-2.5" />{formatTime(e.time)} ·</>}
                        {CATEGORY_LABELS[e.category]} · {PRIORITY_LABELS[e.priority]}
                        {(e.repeat || e.repeatParentId) && <span className="ml-1 text-primary font-medium">↻ recurring</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleToggle(e.id)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors
                          ${e.completed ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:bg-primary hover:border-primary hover:text-primary-foreground'}`}>
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => openEditForm(e)}
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                        <span className="text-[10px]">✏</span>
                      </button>
                      <button onClick={() => handleDelete(e.id)}
                        className="w-6 h-6 rounded-full border border-destructive/50 text-destructive flex items-center justify-center hover:bg-destructive/10">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reports on this day */}
            {selectedDayReports.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Reports</p>
                {selectedDayReports.map(r => (
                  <div key={r.id} className="rounded-lg border border-border px-2 py-1.5 flex items-center gap-2">
                    <ClipboardList className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">{r.status} · {r.priority}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDayEvents.length === 0 && selectedDayReports.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nothing scheduled for this day</p>
            )}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <Button className="flex-1 gap-1.5 h-9" onClick={() => selectedDate && openNewForm(selectedDate)}>
              <Plus className="w-3.5 h-3.5" /> Schedule
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setShowDayModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event form modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-sm font-bold">
              {editingEvent ? 'Edit Event' : 'Schedule Maintenance'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Monthly equipment check" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="h-9 text-sm" placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as MaintenanceCategory }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CATEGORY_LABELS) as [MaintenanceCategory, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as MaintenancePriority }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PRIORITY_LABELS) as [MaintenancePriority, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional details..." className="h-9 text-sm" />
            </div>

            {/* Repeat */}
            {!editingEvent && (
              <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                <Label className="text-xs font-semibold">Repeat</Label>
                <div className="grid grid-cols-4 gap-1">
                  {(['none', 'daily', 'weekly', 'monthly'] as RepeatFrequency[]).map(r => (
                    <button key={r}
                      onClick={() => setForm(f => ({ ...f, repeat: r }))}
                      className={`text-[11px] py-1.5 rounded-lg border font-medium capitalize transition-colors
                        ${form.repeat === r
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                      {r === 'none' ? 'Once' : r}
                    </button>
                  ))}
                </div>
                {form.repeat !== 'none' && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs text-muted-foreground">End Date (optional — defaults to 12 occurrences)</Label>
                    <Input type="date" value={form.repeatEndDate}
                      onChange={e => setForm(f => ({ ...f, repeatEndDate: e.target.value }))}
                      className="h-8 text-xs" min={form.date} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <Button className="flex-1 h-9" onClick={handleSave} disabled={!form.title.trim()}>
              {editingEvent ? 'Save Changes' : form.repeat !== 'none' ? `Schedule Series` : 'Schedule'}
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete series confirm */}
      <Dialog open={!!confirmDeleteSeries} onOpenChange={() => setConfirmDeleteSeries(null)}>
        <DialogContent className="max-w-xs rounded-2xl p-5 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Recurring Event</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Do you want to delete just this occurrence or the entire series?</p>
          <div className="flex flex-col gap-2">
            <Button variant="destructive" className="h-9 text-xs" onClick={() => {
              if (confirmDeleteSeries) { deleteEvent(confirmDeleteSeries); refresh(); }
              setConfirmDeleteSeries(null);
            }}>Delete This Event Only</Button>
            <Button variant="outline" className="h-9 text-xs border-destructive text-destructive hover:bg-destructive/10" onClick={() => {
              if (confirmDeleteSeries) { deleteEventSeries(confirmDeleteSeries); refresh(); }
              setConfirmDeleteSeries(null);
            }}>Delete Entire Series</Button>
            <Button variant="ghost" className="h-9 text-xs" onClick={() => setConfirmDeleteSeries(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
