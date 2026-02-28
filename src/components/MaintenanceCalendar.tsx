import { useState, useMemo } from 'react';
import { MaintenanceEvent, PRIORITY_COLORS, STATUS_COLORS, MAINTENANCE_STATUS_LABELS } from '@/types/maintenance';
import { getEventsForMonth, deleteMaintenanceEvent, getMaintenanceById } from '@/lib/maintenance-storage';
import { MaintenanceForm } from '@/components/MaintenanceForm';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Wrench, RotateCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';

export function MaintenanceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MaintenanceEvent | undefined>();
  const [detailEvent, setDetailEvent] = useState<MaintenanceEvent | null>(null);

  const refresh = () => {
    const evts = getEventsForMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    setEvents(evts);
  };

  // Load events when month changes
  useMemo(() => {
    refresh();
  }, [currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getEventsForDay = (d: Date): MaintenanceEvent[] => {
    const dateStr = format(d, 'yyyy-MM-dd');
    return events.filter(e => e.date === dateStr);
  };

  const today = new Date();

  const handleDayClick = (d: Date) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
  };

  const handleAddEvent = () => {
    setEditingEvent(undefined);
    setFormOpen(true);
  };

  const handleEditEvent = (evt: MaintenanceEvent) => {
    setEditingEvent(evt);
    setDetailEvent(null);
    setFormOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    deleteMaintenanceEvent(id);
    toast.success('Event deleted');
    setDetailEvent(null);
    refresh();
  };

  const selectedDayEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-px">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {weeks.flat().map((d, i) => {
          const dayEvents = getEventsForDay(d);
          const isToday = isSameDay(d, today);
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const dateStr = format(d, 'yyyy-MM-dd');
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={i}
              onClick={() => handleDayClick(d)}
              className={`
                min-h-[60px] p-1 flex flex-col items-start text-left transition-colors
                ${isCurrentMonth ? 'bg-card' : 'bg-muted/30'}
                ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                hover:bg-accent/10
              `}
            >
              <span className={`
                text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5
                ${isToday ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'}
              `}>
                {format(d, 'd')}
              </span>
              <div className="w-full space-y-0.5">
                {dayEvents.slice(0, 2).map(evt => (
                  <div
                    key={evt.id}
                    className={`text-[8px] leading-tight px-1 py-0.5 rounded border truncate ${PRIORITY_COLORS[evt.priority]}`}
                    onClick={e => { e.stopPropagation(); setDetailEvent(evt); }}
                  >
                    {evt.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[8px] text-muted-foreground text-center">+{dayEvents.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Panel */}
      {selectedDate && (
        <div className="bg-card rounded-lg border border-border p-3 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">
              {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
            </h3>
            <Button size="sm" variant="outline" onClick={handleAddEvent} className="gap-1 text-xs h-7">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No maintenance scheduled</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map(evt => (
                <button
                  key={evt.id}
                  onClick={() => setDetailEvent(evt)}
                  className="w-full text-left bg-background rounded-md border border-border p-2.5 space-y-1.5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate">{evt.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[evt.status]}`}>
                      {MAINTENANCE_STATUS_LABELS[evt.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {evt.time} · {formatDuration(evt.duration)}</span>
                    {evt.equipment && <span className="flex items-center gap-0.5"><Wrench className="w-2.5 h-2.5" /> {evt.equipment}</span>}
                    {evt.assignedTo && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {evt.assignedTo}</span>}
                    {evt.recurring && <span className="flex items-center gap-0.5"><RotateCw className="w-2.5 h-2.5" /> {evt.recurring.type}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event Detail Panel */}
      {detailEvent && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{detailEvent.title}</h3>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleEditEvent(detailEvent)}>Edit</Button>
              <Button size="sm" variant="outline" className="text-xs h-7 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDeleteEvent(detailEvent.id)}>Delete</Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setDetailEvent(null)}>Close</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Date & Time</span>
              <p className="font-medium text-foreground">{format(new Date(detailEvent.date + 'T00:00:00'), 'MMM d, yyyy')} at {detailEvent.time}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <p className="font-medium text-foreground">{formatDuration(detailEvent.duration)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Priority</span>
              <p className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${PRIORITY_COLORS[detailEvent.priority]}`}>{detailEvent.priority}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[detailEvent.status]}`}>{MAINTENANCE_STATUS_LABELS[detailEvent.status]}</p>
            </div>
            {detailEvent.equipment && (
              <div>
                <span className="text-muted-foreground">Equipment</span>
                <p className="font-medium text-foreground">{detailEvent.equipment}</p>
              </div>
            )}
            {detailEvent.assignedTo && (
              <div>
                <span className="text-muted-foreground">Assigned To</span>
                <p className="font-medium text-foreground">{detailEvent.assignedTo}</p>
              </div>
            )}
          </div>

          {detailEvent.description && (
            <div>
              <span className="text-xs text-muted-foreground">Description</span>
              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{detailEvent.description}</p>
            </div>
          )}

          {detailEvent.recurring && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCw className="w-3 h-3" />
              Repeats every {detailEvent.recurring.interval > 1 ? `${detailEvent.recurring.interval} ` : ''}{detailEvent.recurring.type}
            </div>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <MaintenanceForm
        event={editingEvent}
        defaultDate={selectedDate ?? undefined}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={refresh}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
