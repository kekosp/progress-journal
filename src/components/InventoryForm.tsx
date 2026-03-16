import { useState } from 'react';
import { InventoryItem } from '@/types/inventory';
import { saveInventoryItem, generateInventoryId } from '@/lib/inventory-storage';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';

interface Props {
  item?: InventoryItem;
  onBack: () => void;
  onSaved: () => void;
}

export function InventoryForm({ item, onBack, onSaved }: Props) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [takenFrom, setTakenFrom] = useState(item?.takenFrom ?? '');
  const [receivedDate, setReceivedDate] = useState(item?.receivedDate ?? new Date().toISOString().slice(0, 10));
  const [returnByDate, setReturnByDate] = useState(item?.returnByDate ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Item name is required', variant: 'destructive' });
      return;
    }
    if (!takenFrom.trim()) {
      toast({ title: 'Taken from location is required', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const record: InventoryItem = {
      id: item?.id ?? generateInventoryId(),
      name: name.trim(),
      quantity,
      takenFrom: takenFrom.trim(),
      returnedTo: item?.returnedTo,
      receivedDate,
      returnByDate: returnByDate || undefined,
      returnedDate: item?.returnedDate,
      status: item?.status ?? 'in-hand',
      notes: notes.trim() || undefined,
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
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Angle grinder" className="bg-card" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Quantity</Label>
            <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value) || 1)} className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Taken From *</Label>
            <Input value={takenFrom} onChange={e => setTakenFrom(e.target.value)} placeholder="e.g. Main warehouse" className="bg-card" />
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
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra details..." rows={3} className="bg-card" />
        </div>

        <Button onClick={handleSave} className="w-full gap-2">
          <Save className="w-4 h-4" /> {isEdit ? 'Update Item' : 'Add Item'}
        </Button>
      </div>
    </div>
  );
}
