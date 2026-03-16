import { useState, useMemo } from 'react';
import { InventoryItem } from '@/types/inventory';
import { getInventoryItems, saveInventoryItem, deleteInventoryItem } from '@/lib/inventory-storage';
import { toast } from '@/hooks/use-toast';
import { InventoryForm } from '@/components/InventoryForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Search, Package, MapPin, CalendarClock, RotateCcw, Pencil, Trash2 } from 'lucide-react';

type View = 'list' | 'create' | 'edit';

export function InventoryList() {
  const [view, setView] = useState<View>('list');
  const [items, setItems] = useState<InventoryItem[]>(getInventoryItems);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>();
  const [search, setSearch] = useState('');

  // Return dialog state
  const [returningItem, setReturningItem] = useState<InventoryItem | null>(null);
  const [returnedTo, setReturnedTo] = useState('');

  const refresh = () => setItems(getInventoryItems());

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.takenFrom.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in-hand' ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, search]);

  const handleReturnConfirm = () => {
    if (!returningItem) return;
    if (!returnedTo.trim()) {
      toast({ title: 'Please enter where you put it', variant: 'destructive' });
      return;
    }
    saveInventoryItem({
      ...returningItem,
      status: 'returned',
      returnedDate: new Date().toISOString().slice(0, 10),
      returnedTo: returnedTo.trim(),
    });
    toast({ title: `"${returningItem.name}" marked as returned` });
    setReturningItem(null);
    setReturnedTo('');
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteInventoryItem(id);
    toast({ title: 'Item deleted' });
    refresh();
  };

  const today = new Date().toISOString().slice(0, 10);

  const getDueBadge = (item: InventoryItem) => {
    if (item.status === 'returned' || !item.returnByDate) return null;
    const due = item.returnByDate.slice(0, 10);
    if (due < today) return <Badge variant="destructive" className="text-[10px]">Overdue</Badge>;
    if (due === today) return <Badge className="bg-warning text-warning-foreground text-[10px]">Due Today</Badge>;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (due === tomorrow) return <Badge className="bg-warning text-warning-foreground text-[10px]">Due Tomorrow</Badge>;
    return null;
  };

  if (view === 'create') return <InventoryForm onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} />;
  if (view === 'edit' && editingItem) return <InventoryForm item={editingItem} onBack={() => setView('list')} onSaved={() => { refresh(); setView('list'); }} />;

  const inHandCount = items.filter(i => i.status === 'in-hand').length;
  const returnedCount = items.filter(i => i.status === 'returned').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold tracking-tight">Inventory</h1>
            <Button size="sm" onClick={() => setView('create')} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 shadow-lg">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: 'Total', value: items.length }, { label: 'In Hand', value: inHandCount }, { label: 'Returned', value: returnedCount }].map(s => (
              <div key={s.label} className="bg-primary-foreground/10 rounded-lg p-2 text-center backdrop-blur-sm">
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] opacity-70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 max-w-lg mx-auto">
        <div className="bg-card rounded-xl shadow-sm border border-border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or locations..." className="pl-9 bg-background border-border text-sm h-9" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{items.length === 0 ? 'No items tracked yet' : 'No matching items'}</h3>
            <p className="text-sm text-muted-foreground mb-4">{items.length === 0 ? 'Add your first inventory item' : 'Try adjusting your search'}</p>
            {items.length === 0 && (
              <Button onClick={() => setView('create')} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Item
              </Button>
            )}
          </div>
        ) : (
          filtered.map(item => (
            <Card key={item.id} className={`transition-all ${item.status === 'returned' ? 'opacity-60' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">{item.name}</span>
                      <Badge variant={item.status === 'in-hand' ? 'default' : 'secondary'} className="text-[10px]">
                        {item.status === 'in-hand' ? 'In Hand' : 'Returned'}
                      </Badge>
                      {getDueBadge(item)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Qty: {item.quantity}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> From: {item.takenFrom}</span>
                      {item.returnedTo && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> To: {item.returnedTo}</span>
                      )}
                      {item.returnByDate && (
                        <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Return by {item.returnByDate}</span>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'in-hand' && (
                      <Button size="sm" variant="ghost" onClick={() => { setReturningItem(item); setReturnedTo(''); }} className="h-7 w-7 p-0 text-success hover:text-success" title="Mark returned">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setEditingItem(item); setView('edit'); }} className="h-7 w-7 p-0" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Return dialog – asks where the item was put back */}
      <Dialog open={!!returningItem} onOpenChange={open => { if (!open) setReturningItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Return "{returningItem?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Where did you put it? *</Label>
            <Input
              value={returnedTo}
              onChange={e => setReturnedTo(e.target.value)}
              placeholder="e.g. Main warehouse, Shelf B2"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturningItem(null)}>Cancel</Button>
            <Button onClick={handleReturnConfirm} className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
