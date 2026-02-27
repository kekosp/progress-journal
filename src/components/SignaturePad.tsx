import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Undo2, Trash2 } from 'lucide-react';

interface SignaturePadProps {
  initialSignature?: string;
  initialName?: string;
  onSave: (dataUrl: string, name: string) => void;
  onClear: () => void;
}

export function SignaturePad({ initialSignature, initialName, onSave, onClear }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(!!initialSignature);
  const [signerName, setSignerName] = useState(initialName ?? '');
  const [paths, setPaths] = useState<{ x: number; y: number }[][]>([]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPaths([]);
    setHasStrokes(false);
  }, []);

  // Draw initial signature if editing
  useEffect(() => {
    if (!initialSignature || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
    img.src = initialSignature;
  }, [initialSignature]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'hsl(var(--foreground))';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paths.forEach(path => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      path.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  }, [paths]);

  useEffect(() => { redraw(); }, [redraw]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasStrokes(true);
    const pos = getPos(e);
    setPaths(prev => [...prev, [pos]]);
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    setPaths(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = [...updated[updated.length - 1], pos];
      return updated;
    });
  };

  const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const undo = () => {
    setPaths(prev => {
      const next = prev.slice(0, -1);
      if (next.length === 0) setHasStrokes(false);
      return next;
    });
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    onSave(canvas.toDataURL('image/png'), signerName.trim());
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Signed By</Label>
        <Input
          value={signerName}
          onChange={e => setSignerName(e.target.value)}
          placeholder="Full name..."
          className="bg-card border-border text-sm"
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
          Signature
        </Label>
        <div className="relative border-2 border-dashed border-border rounded-lg bg-card overflow-hidden">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full h-32 touch-none cursor-crosshair"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
          {!hasStrokes && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-muted-foreground">Sign here</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo} disabled={paths.length === 0} className="gap-1.5 text-xs">
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => { clear(); onClear(); }} className="gap-1.5 text-xs text-destructive">
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={!hasStrokes} className="gap-1.5 text-xs ml-auto">
          <Check className="w-3.5 h-3.5" /> Apply Signature
        </Button>
      </div>
    </div>
  );
}
