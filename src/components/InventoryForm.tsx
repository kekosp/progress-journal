import { useState } from 'react';
import { InventoryItem } from '@/types/inventory';
import { saveInventoryItem, generateInventoryId } from '@/lib/inventory-storage';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Plus, Minus, ScanLine } from 'lucide-react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { InventoryPhotoField } from '@/components/InventoryPhotoField';
import { ReportImage } from '@/types/report';

interface Props {
  item?: InventoryItem;
  onBack: () => void;
  onSaved: () => void;
}

export function InventoryForm({ item, onBack, onSaved }: Props) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? '');
  const initialSerials = item?.serialNumbers && item.serialNumbers.length > 0
    ? item.serialNumbers
    : item?.serialNumber ? [item.serialNumber] : [''];
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [serials, setSerials] = useState<string[]>(() => {
    const q = item?.quantity ?? 1;
    const arr = [...initialSerials];
    while (arr.length < q) arr.push('');
    return arr.slice(0, q);
  });
  const [takenFrom, setTakenFrom] = useState(item?.takenFrom ?? '');
  const [receivedDate, setReceivedDate] = useState(item?.receivedDate ?? new Date().toISOString().slice(0, 10));
  const [returnByDate, setReturnByDate] = useState(item?.returnByDate ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [servicedOutside, setServicedOutside] = useState(item?.servicedOutside ?? false);
  const [serviceLocation, setServiceLocation] = useState(item?.serviceLocation ?? '');
  const [serviceReturnDate, setServiceReturnDate] = useState(item?.serviceReturnDate ?? '');
  const [serviceStartDate, setServiceStartDate] = useState(item?.serviceStartDate ?? '');
  const [serviceActualReturnDate, setServiceActualReturnDate] = useState(item?.serviceActualReturnDate ?? '');
  const [scanTarget, setScanTarget] = useState<number | 'all' | null>(null);
  const [photos, setPhotos] = useState<ReportImage[]>(item?.photos ?? []);
  const [dailyCarry, setDailyCarry] = useState(item?.dailyCarry ?? false);

  const updateQuantity = (next: number) => {
    const q = Math.max(1, Math.min(999, next));
    setQuantity(q);
    setSerials(prev => {
      const arr = [...prev];
      while (arr.length < q) arr.push('');
      return arr.slice(0, q);
    });
  };

  const updateSerial = (idx: number, value: string) => {
    setSerials(prev => prev.map((s, i) => (i === idx ? value : s)));
  };

  const handleScanned = (code: string) => {
    const value = code.trim();
    if (!value) return;
    setSerials(prev => {
      if (scanTarget === 'all') {
        // Fill next empty slot; ignore if duplicate already in list
        if (prev.includes(value)) {
          toast({ title: 'Duplicate skipped', description: value });
          return prev;
        }
        const nextEmpty = prev.findIndex(s => !s.trim());
        if (nextEmpty === -1) {
          toast({ title: 'All units already have serials' });
          return prev;
        }
        const updated = prev.map((s, i) => (i === nextEmpty ? value : s));
        toast({ title: `Unit ${nextEmpty + 1} captured`, description: value });
        return updated;
      }
      if (typeof scanTarget === 'number') {
        return prev.map((s, i) => (i === scanTarget ? value : s));
      }
      return prev;
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Item name is required', variant: 'destructive' });
      return;
    }
    if (!takenFrom.trim()) {
      toast({ title: 'Taken from location is required', variant: 'destructive' });
      return;
    }
    if (servicedOutside && !serviceLocation.trim()) {
      toast({ title: 'Service location is required', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const cleanedSerials = serials.map(s => s.trim()).filter(Boolean);
    const record: InventoryItem = {
      id: item?.id ?? generateInventoryId(),
      name: name.trim(),
      serialNumber: cleanedSerials[0] || undefined,
      serialNumbers: cleanedSerials.length > 0 ? cleanedSerials : undefined,
      quantity,
      takenFrom: takenFrom.trim(),
      returnedTo: item?.returnedTo,
      receivedDate,
      returnByDate: returnByDate || undefined,
      returnedDate: item?.returnedDate,
      status: item?.status ?? 'in-hand',
      notes: notes.trim() || undefined,
      servicedOutside: servicedOutside || undefined,
      serviceLocation: servicedOutside ? serviceLocation.trim() || undefined : undefined,
      serviceReturnDate: servicedOutside ? serviceReturnDate || undefined : undefined,
      serviceStartDate: servicedOutside ? serviceStartDate || undefined : undefined,
      serviceActualReturnDate: servicedOutside ? serviceActualReturnDate || undefined : undefined,
      photos: photos.length > 0 ? photos : undefined,
      returnPhotos: item?.returnPhotos,
      dailyCarry: dailyCarry || undefined,
      snoozedUntil: item?.snoozedUntil,
      createdAt: item?.createdAt ?? now,
      updatedAt: now,
    };

    saveInventoryItem(record);
    toast({ title: isEdit ? 'Item updated' : 'Item added' });
    onSaved();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onBack} className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-bold">{isEdit ? 'Edit Item' : 'Add Inventory Item'}</h1>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Item Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Angle grinder" className="bg-card" maxLength={200} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Quantity</Label>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="outline" className="h-10 w-10 p-0 shrink-0" onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1}>
                <Minus className="w-4 h-4" />
              </Button>
              <Input type="number" min={1} value={quantity} onChange={e => updateQuantity(Number(e.target.value) || 1)} className="bg-card text-center" />
              <Button type="button" size="sm" variant="outline" className="h-10 w-10 p-0 shrink-0" onClick={() => updateQuantity(quantity + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Taken From *</Label>
            <Input value={takenFrom} onChange={e => setTakenFrom(e.target.value)} placeholder="e.g. Main warehouse" className="bg-card" maxLength={200} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">
              {quantity > 1 ? `Serial Numbers (${serials.filter(s => s.trim()).length}/${quantity})` : 'Serial Number'}
            </Label>
            {quantity > 1 ? (
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => setScanTarget('all')}>
                <ScanLine className="w-3.5 h-3.5" /> Scan all
              </Button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            {serials.map((sn, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {quantity > 1 && (
                  <span className="text-[11px] text-muted-foreground w-6 text-right shrink-0">#{idx + 1}</span>
                )}
                <Input
                  value={sn}
                  onChange={e => updateSerial(idx, e.target.value)}
                  placeholder={quantity > 1 ? `Unit ${idx + 1} serial` : 'e.g. SN-12345'}
                  className="bg-card"
                  maxLength={100}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && idx < serials.length - 1) {
                      e.preventDefault();
                      const next = (e.currentTarget.parentElement?.parentElement?.children[idx + 1]?.querySelector('input')) as HTMLInputElement | null;
                      next?.focus();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="outline" className="h-10 w-10 p-0 shrink-0" onClick={() => setScanTarget(idx)} title="Scan barcode">
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Received Date</Label>
            <Input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Return By</Label>
            <Input type="date" value={returnByDate} onChange={e => setReturnByDate(e.target.value)} className="bg-card" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra details..." rows={3} className="bg-card" maxLength={2000} />
        </div>

        <InventoryPhotoField
          label="Photos when taken (optional)"
          value={photos}
          onChange={setPhotos}
        />

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="dailyCarry"
              checked={dailyCarry}
              onCheckedChange={v => setDailyCarry(!!v)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="dailyCarry" className="text-xs font-medium cursor-pointer">
                Daily carry (bag/tool)
              </Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Must be returned to its original place the same day before 4:00 PM.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Checkbox id="servicedOutside" checked={servicedOutside} onCheckedChange={v => setServicedOutside(!!v)} />
            <Label htmlFor="servicedOutside" className="text-xs font-medium cursor-pointer">
              Serviced outside the company
            </Label>
          </div>
          {servicedOutside && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Service Location *</Label>
                <Input value={serviceLocation} onChange={e => setServiceLocation(e.target.value)} placeholder="e.g. ABC Repair Shop" maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sent on</Label>
                  <Input type="date" value={serviceStartDate} onChange={e => setServiceStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Expected Return</Label>
                  <Input type="date" value={serviceReturnDate} onChange={e => setServiceReturnDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Actual Return Date</Label>
                <Input type="date" value={serviceActualReturnDate} onChange={e => setServiceActualReturnDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} className="w-full gap-2">
          <Save className="w-4 h-4" /> {isEdit ? 'Update Item' : 'Add Item'}
        </Button>
      </div>

      <BarcodeScanner
        open={scanTarget !== null}
        continuous={scanTarget === 'all'}
        onClose={() => setScanTarget(null)}
        onDetected={handleScanned}
      />
    </div>
  );
}
