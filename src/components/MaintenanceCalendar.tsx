import { useState, useMemo } from 'react';
import {
  getEvents, saveEvent, deleteEvent, toggleEventComplete,
  generateEventId, MaintenanceEvent, MaintenancePriority, MaintenanceCategory
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
  ChevronLeft, ChevronRight, Plus, Trash2, Check, X, Calendar, ClipboardList
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isSameMonth, isToday, parseISO, addMonths, subMonths } from 'date-fns';

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low:      'bg-blue-400/80',
  medium:   'bg-yellow-400/80',
  high:     'bg-orange-500/80',
  critical: 'bg-red-500/80',
};

const PRIORITY_BORDER: Record<MaintenancePriority, string> = {
  low:      'border-blue-400',
  medium:   'border-yellow-400',
  high:     'border-orange-500',
  critical: 'border-red-500',
};

const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  inspection: 'Inspection', maintenance: 'Maintenance', safety: 'Safety',
  quality: 'Quality', progress: 'Progress', incident: 'Incident', other: 'Other',
};

const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

interface EventFormData {
  title: string;
  description: string;
  date: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
}

const empty = (date?: string): EventFormData => ({
  title: '', description: '', date: date ?? format(new Date(), 'yyyy-MM-dd'),
  category: 'maintenance', priority: 'medium',
});

export function MaintenanceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<MaintenanceEvent[]>(getEvents);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MaintenanceEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(empty());
  const [showDayModal, setShowDayModal] = useState(false);

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
    setForm({ title: evt.title, description: evt.description ?? '', date: evt.date, category: evt.category, priority: evt.priority });
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
      category: form.category,
      priority: form.priority,
      completed: editingEvent?.completed ?? false,
      completedAt: editingEvent?.completedAt,
    };
    saveEvent(event);
    refresh();
    setShowForm(false);
  }

  function handleDelete(id: string) {
    deleteEvent(id);
    refresh();
  }

  function handleToggle(id: string) {
    toggleEventComplete(id);
    refresh();
  }

  const selectedDayEvents = selectedDate ? eventsForDay(selectedDate) : [];
  const selectedDayReports = selectedDate ? reportsForDay(selectedDate) : [];

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

        {/* Month navigation */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-1 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {/* Padding */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[56px] border-b border-r border-border/50" />
            ))}
            {days.map((day, idx) => {
              const dayEvents = eventsForDay(day);
              const dayReports = reportsForDay(day);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const col = (startPadding + idx) % 7;
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => { setSelectedDate(day); setShowDayModal(true); }}
                  className={`min-h-[56px] p-1 border-b border-border/50 cursor-pointer transition-colors
                    ${col < 6 ? 'border-r' : ''}
                    ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                    ${!isSameMonth(day, currentMonth) ? 'opacity-30' : ''}
                  `}
                >
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5 mx-auto
                    ${isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  {/* Event dots */}
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id}
                        className={`w-1.5 h-1.5 rounded-full ${e.completed ? 'opacity-40' : ''} ${PRIORITY_COLORS[e.priority]}`}
                      />
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
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(e.date), 'EEE, MMM d')} · {CATEGORY_LABELS[e.category]}</p>
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
                      <p className="text-[10px] text-muted-foreground mt-0.5">{CATEGORY_LABELS[e.category]} · {PRIORITY_LABELS[e.priority]}</p>
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
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="h-9 text-sm" />
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
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <Button className="flex-1 h-9" onClick={handleSave} disabled={!form.title.trim()}>
              {editingEvent ? 'Save Changes' : 'Schedule'}
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
