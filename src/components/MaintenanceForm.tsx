import { useState } from 'react';
import { MaintenanceEvent, MaintenancePriority, MaintenanceStatus, MAINTENANCE_PRIORITY_LABELS, MAINTENANCE_STATUS_LABELS } from '@/types/maintenance';
import { saveMaintenanceEvent, generateMaintenanceId } from '@/lib/maintenance-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, Trash2 } from 'lucide-react';

interface MaintenanceFormProps {
  event?: MaintenanceEvent;
  defaultDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
}

export function MaintenanceForm({ event, defaultDate, open, onOpenChange, onSaved, onDelete }: MaintenanceFormProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [date, setDate] = useState(event?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(event?.time ?? '09:00');
  const [duration, setDuration] = useState(event?.duration ?? 60);
  const [priority, setPriority] = useState<MaintenancePriority>(event?.priority ?? 'medium');
  const [status, setStatus] = useState<MaintenanceStatus>(event?.status ?? 'planned');
  const [equipment, setEquipment] = useState(event?.equipment ?? '');
  const [assignedTo, setAssignedTo] = useState(event?.assignedTo ?? '');
  const [recurringType, setRecurringType] = useState(event?.recurring?.type ?? '');
  const [recurringInterval, setRecurringInterval] = useState(event?.recurring?.interval ?? 1);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    const now = new Date().toISOString();
    const data: MaintenanceEvent = {
      id: event?.id ?? generateMaintenanceId(),
      title: title.trim(),
      description: description.trim(),
      date,
      time,
      duration,
      priority,
      status,
      equipment: equipment.trim(),
      assignedTo: assignedTo.trim(),
      recurring: recurringType ? { type: recurringType as 'daily' | 'weekly' | 'monthly', interval: recurringInterval } : undefined,
      createdAt: event?.createdAt ?? now,
      updatedAt: now,
    };
    saveMaintenanceEvent(data);
    toast.success(event ? 'Event updated' : 'Event created');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{event ? 'Edit Maintenance' : 'Schedule Maintenance'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Maintenance title..." className="bg-card border-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-card border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-card border-border text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration (min)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={15} step={15} className="bg-card border-border text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as MaintenancePriority)}>
                <SelectTrigger className="bg-card border-border text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(MAINTENANCE_PRIORITY_LABELS) as [MaintenancePriority, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as MaintenanceStatus)}>
                <SelectTrigger className="bg-card border-border text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(MAINTENANCE_STATUS_LABELS) as [MaintenanceStatus, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Equipment/System</Label>
              <Input value={equipment} onChange={e => setEquipment(e.target.value)} placeholder="e.g. HVAC Unit 3" className="bg-card border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</Label>
              <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Technician/team" className="bg-card border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Details about the maintenance..." rows={3} className="bg-card border-border resize-none" />
          </div>

          {/* Recurring */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recurring Schedule</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={recurringType} onValueChange={setRecurringType}>
                <SelectTrigger className="bg-card border-border text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">None</SelectItem>
                  <SelectItem value="daily" className="text-xs">Daily</SelectItem>
                  <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {recurringType && recurringType !== 'none' && (
                <Input type="number" value={recurringInterval} onChange={e => setRecurringInterval(Number(e.target.value))} min={1} placeholder="Every N..." className="bg-card border-border text-sm" />
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {event && onDelete && (
              <Button variant="outline" size="sm" onClick={() => { onDelete(event.id); onOpenChange(false); }} className="text-destructive hover:bg-destructive hover:text-destructive-foreground gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="w-3.5 h-3.5" /> {event ? 'Update' : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
