import { useState } from 'react';
import {
  Report, ReportCategory, ReportPriority, ReportStatus,
  CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS
} from '@/types/report';
import { saveReport, generateId } from '@/lib/storage';
import { useImageAttachments } from '@/hooks/use-image-attachments';
import { ImageAnnotator } from '@/components/ImageAnnotator';
import { SignaturePad } from '@/components/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ArrowLeft, Camera, ImagePlus, X, Save, PenTool, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  report?: Report;
  onBack: () => void;
  onSaved: () => void;
}

export function ReportForm({ report, onBack, onSaved }: Props) {
  const [title, setTitle] = useState(report?.title ?? '');
  const [description, setDescription] = useState(report?.description ?? '');
  const [category, setCategory] = useState<ReportCategory>(report?.category ?? 'inspection');
  const [priority, setPriority] = useState<ReportPriority>(report?.priority ?? 'medium');
  const [status, setStatus] = useState<ReportStatus>(report?.status ?? 'draft');
  const [notes, setNotes] = useState(report?.notes ?? '');
  const [projectName, setProjectName] = useState(report?.projectName ?? '');
  const [location, setLocation] = useState(report?.location ?? '');
  const [lostTimeHours, setLostTimeHours] = useState<string>(
    report?.lostTimeHours != null ? String(report.lostTimeHours) : ''
  );
  const [lostTimeMinutes, setLostTimeMinutes] = useState<string>(
    report?.lostTimeMinutes != null ? String(report.lostTimeMinutes) : ''
  );

  const [signatureDataUrl, setSignatureDataUrl] = useState(report?.signatureDataUrl ?? '');
  const [signedBy, setSignedBy] = useState(report?.signedBy ?? '');
  const [annotatingImageId, setAnnotatingImageId] = useState<string | null>(null);

  const { images, setImages, addImages, removeImage, triggerInput, takeNativePhoto, inputRef } =
    useImageAttachments(report?.images ?? []);

  const annotatingImage = annotatingImageId ? images.find(i => i.id === annotatingImageId) : null;

  // Parsed lost time as decimal hours for storage
  const parsedLostHours = (): number | undefined => {
    const h = parseFloat(lostTimeHours);
    const m = parseFloat(lostTimeMinutes);
    if (isNaN(h) && isNaN(m)) return undefined;
    return (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const now = new Date().toISOString();
    const lt = parsedLostHours();
    const data: Report = {
      id: report?.id ?? generateId(),
      title: title.trim(),
      description,
      category,
      priority,
      status,
      images,
      notes,
      projectName: projectName || undefined,
      location: location || undefined,
      createdAt: report?.createdAt ?? now,
      updatedAt: now,
      signatureDataUrl: signatureDataUrl || undefined,
      signedBy: signedBy || undefined,
      signedAt: signatureDataUrl ? (report?.signedAt ?? now) : undefined,
      lostTimeHours: lt,
      lostTimeMinutes: lostTimeMinutes ? parseFloat(lostTimeMinutes) : undefined,
    };
    saveReport(data);
    toast.success(report ? 'Report updated' : 'Report created');
    onSaved();
  };

  if (annotatingImage) {
    return (
      <ImageAnnotator
        imageDataUrl={annotatingImage.annotatedDataUrl || annotatingImage.dataUrl}
        onSave={(annotatedDataUrl) => {
          setImages(prev =>
            prev.map(img => img.id === annotatingImageId ? { ...img, annotatedDataUrl } : img)
          );
          setAnnotatingImageId(null);
        }}
        onCancel={() => setAnnotatingImageId(null)}
      />
    );
  }

  // Total lost time display for the label
  const totalMins = (parseFloat(lostTimeHours || '0') * 60) + parseFloat(lostTimeMinutes || '0');
  const ltDisplay = totalMins > 0
    ? `${Math.floor(totalMins / 60)}h ${Math.round(totalMins % 60)}m`
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={onBack}
              className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-bold">{report ? 'Edit Report' : 'New Report'}</h1>
          </div>
          <Button size="sm" onClick={handleSave}
            className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Report title..." className="bg-card border-border text-sm" />
        </div>

        {/* Project & Location */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project</Label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="Project name..." className="bg-card border-border text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Site location..." className="bg-card border-border text-xs" />
          </div>
        </div>

        {/* Category / Priority / Status */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as ReportCategory)}>
              <SelectTrigger className="text-xs h-9 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [ReportCategory, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</Label>
            <Select value={priority} onValueChange={v => setPriority(v as ReportPriority)}>
              <SelectTrigger className="text-xs h-9 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(PRIORITY_LABELS) as [ReportPriority, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as ReportStatus)}>
              <SelectTrigger className="text-xs h-9 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Lost Time ──────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              Lost Time
            </Label>
            {ltDisplay && (
              <span className="text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                {ltDisplay} total
              </span>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Record actual time lost due to this issue (downtime, delays, incidents).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Hours</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    value={lostTimeHours}
                    onChange={e => setLostTimeHours(e.target.value)}
                    placeholder="0"
                    className="bg-background border-border text-sm pr-8"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Minutes</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={lostTimeMinutes}
                    onChange={e => setLostTimeMinutes(e.target.value)}
                    placeholder="0"
                    className="bg-background border-border text-sm pr-8"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                </div>
              </div>
            </div>
            {/* Quick presets */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: '30m', h: '0', m: '30' },
                { label: '1h', h: '1', m: '0' },
                { label: '2h', h: '2', m: '0' },
                { label: '4h', h: '4', m: '0' },
                { label: '8h', h: '8', m: '0' },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setLostTimeHours(preset.h); setLostTimeMinutes(preset.m); }}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors
                    ${lostTimeHours === preset.h && lostTimeMinutes === preset.m
                      ? 'bg-orange-500 border-orange-500 text-white font-semibold'
                      : 'border-border text-muted-foreground hover:border-orange-400 hover:text-orange-500'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
              {(lostTimeHours || lostTimeMinutes) && (
                <button
                  type="button"
                  onClick={() => { setLostTimeHours(''); setLostTimeMinutes(''); }}
                  className="text-[10px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe the report..."
            className="bg-card border-border text-sm min-h-[100px] resize-none" />
        </div>

        {/* Images */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Photos ({images.length})
          </Label>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map(img => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden bg-muted">
                  <div className="aspect-square">
                    <img src={img.annotatedDataUrl || img.dataUrl} alt={img.caption || ''}
                      className="w-full h-full object-cover" />
                  </div>
                  <input
                    value={img.caption ?? ''}
                    onChange={e => setImages(prev =>
                      prev.map(i => i.id === img.id ? { ...i, caption: e.target.value } : i)
                    )}
                    placeholder="Caption..."
                    className="w-full text-[10px] px-1.5 py-1 bg-card border-t border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="absolute top-1 right-1 flex gap-1">
                    <button onClick={() => setAnnotatingImageId(img.id)}
                      className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow"
                      title="Annotate">
                      <PenTool className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeImage(img.id)}
                      className="w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {img.annotatedDataUrl && (
                    <div className="absolute top-1 left-1">
                      <span className="bg-primary/80 text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-full font-medium">
                        Annotated
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={takeNativePhoto} className="gap-1.5 text-xs flex-1">
              <Camera className="w-3.5 h-3.5" /> Camera
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={triggerInput} className="gap-1.5 text-xs flex-1">
              <ImagePlus className="w-3.5 h-3.5" /> Gallery
            </Button>
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files) addImages(e.target.files); }} />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes..."
            className="bg-card border-border text-sm min-h-[80px] resize-none" />
        </div>

        {/* Digital Signature */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Digital Signature
          </Label>
          {signatureDataUrl ? (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <img src={signatureDataUrl} alt="Signature" className="h-16 mx-auto" />
              {signedBy && <p className="text-xs text-center text-muted-foreground">Signed by: {signedBy}</p>}
              <Button type="button" variant="outline" size="sm" className="w-full text-xs"
                onClick={() => { setSignatureDataUrl(''); setSignedBy(''); }}>
                Replace Signature
              </Button>
            </div>
          ) : (
            <SignaturePad
              initialSignature={signatureDataUrl || undefined}
              initialName={signedBy || undefined}
              onSave={(dataUrl, name) => {
                setSignatureDataUrl(dataUrl);
                setSignedBy(name);
                toast.success('Signature applied');
              }}
              onClear={() => { setSignatureDataUrl(''); setSignedBy(''); }}
            />
          )}
        </div>

        {/* Bottom save button */}
        <Button onClick={handleSave} className="w-full gap-2 bg-primary text-primary-foreground h-12">
          <Save className="w-4 h-4" />
          {report ? 'Update Report' : 'Create Report'}
        </Button>

        <div className="h-6" />
      </div>
    </div>
  );
}
