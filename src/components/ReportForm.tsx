import { useState, useEffect } from 'react';
import { Report, ReportCategory, ReportPriority, ReportStatus, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { saveReport, generateId } from '@/lib/storage';
import { useImageAttachments } from '@/hooks/use-image-attachments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Camera, ImagePlus, X, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ReportFormProps {
  report?: Report;
  onBack: () => void;
  onSaved: () => void;
}

export function ReportForm({ report, onBack, onSaved }: ReportFormProps) {
  const [title, setTitle] = useState(report?.title ?? '');
  const [description, setDescription] = useState(report?.description ?? '');
  const [category, setCategory] = useState<ReportCategory>(report?.category ?? 'progress');
  const [priority, setPriority] = useState<ReportPriority>(report?.priority ?? 'medium');
  const [status, setStatus] = useState<ReportStatus>(report?.status ?? 'draft');
  const [notes, setNotes] = useState(report?.notes ?? '');
  const [projectName, setProjectName] = useState(report?.projectName ?? '');
  const [location, setLocation] = useState(report?.location ?? '');

  const { images, setImages, addImages, removeImage, triggerInput, takeNativePhoto, inputRef } = useImageAttachments(report?.images ?? []);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a report title');
      return;
    }
    const now = new Date().toISOString();
    const data: Report = {
      id: report?.id ?? generateId(),
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status,
      images,
      notes,
      projectName: projectName.trim(),
      location: location.trim(),
      createdAt: report?.createdAt ?? now,
      updatedAt: now,
    };
    saveReport(data);
    toast.success(report ? 'Report updated' : 'Report created');
    onSaved();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <h1 className="text-sm font-semibold text-foreground">{report ? 'Edit Report' : 'New Report'}</h1>
        <Button size="sm" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
          <Save className="w-4 h-4" />
          Save
        </Button>
      </div>

      <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Report title..."
            className="bg-card border-border focus-visible:ring-accent"
          />
        </div>

        {/* Project & Location row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project</Label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name" className="bg-card border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="bg-card border-border" />
          </div>
        </div>

        {/* Category, Priority, Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
              <SelectTrigger className="bg-card border-border text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [ReportCategory, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as ReportPriority)}>
              <SelectTrigger className="bg-card border-border text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(PRIORITY_LABELS) as [ReportPriority, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ReportStatus)}>
              <SelectTrigger className="bg-card border-border text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the work performed..."
            rows={3}
            className="bg-card border-border resize-none"
          />
        </div>

        {/* Images */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attachments</Label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => e.target.files && addImages(e.target.files)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={triggerInput} className="gap-1.5 text-xs">
              <ImagePlus className="w-4 h-4" /> Gallery
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={takeNativePhoto} className="gap-1.5 text-xs">
              <Camera className="w-4 h-4" /> Camera
            </Button>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {images.map((img, idx) => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden bg-muted">
                  <div className="aspect-square">
                    <img src={img.dataUrl} alt={img.caption || ''} className="w-full h-full object-cover" />
                  </div>
                  <input
                    type="text"
                    value={img.caption || ''}
                    onChange={e => {
                      const updated = [...images];
                      updated[idx] = { ...updated[idx], caption: e.target.value };
                      setImages(updated);
                    }}
                    placeholder="Caption..."
                    className="w-full text-[10px] px-1.5 py-1 bg-card border-t border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes, observations, recommendations..."
            rows={5}
            className="bg-card border-border resize-none"
          />
        </div>
      </div>
    </div>
  );
}
