import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Circle, ArrowRight, Type, Undo2, Check, X, Minus } from 'lucide-react';

type Tool = 'pen' | 'line' | 'circle' | 'arrow' | 'text';

type DrawAction = {
  tool: Tool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
};

interface ImageAnnotatorProps {
  imageDataUrl: string;
  onSave: (annotatedDataUrl: string) => void;
  onCancel: () => void;
}

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff', '#000000'];

export function ImageAnnotator({ imageDataUrl, onSave, onCancel }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Size canvas to fit container while maintaining aspect ratio
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const img = imgRef.current;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight - 8;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    setCanvasSize({ w: Math.floor(img.width * scale), h: Math.floor(img.height * scale) });
  }, [imgLoaded]);

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const allActions = currentAction ? [...actions, currentAction] : actions;
    allActions.forEach(a => {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (a.tool === 'pen' && a.points && a.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(a.points[0].x, a.points[0].y);
        a.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (a.tool === 'line' && a.start && a.end) {
        ctx.beginPath();
        ctx.moveTo(a.start.x, a.start.y);
        ctx.lineTo(a.end.x, a.end.y);
        ctx.stroke();
      } else if (a.tool === 'circle' && a.start && a.end) {
        const rx = Math.abs(a.end.x - a.start.x) / 2;
        const ry = Math.abs(a.end.y - a.start.y) / 2;
        const cx = (a.start.x + a.end.x) / 2;
        const cy = (a.start.y + a.end.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (a.tool === 'arrow' && a.start && a.end) {
        const angle = Math.atan2(a.end.y - a.start.y, a.end.x - a.start.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(a.start.x, a.start.y);
        ctx.lineTo(a.end.x, a.end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(a.end.x, a.end.y);
        ctx.lineTo(a.end.x - headLen * Math.cos(angle - Math.PI / 6), a.end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(a.end.x, a.end.y);
        ctx.lineTo(a.end.x - headLen * Math.cos(angle + Math.PI / 6), a.end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (a.tool === 'text' && a.start && a.text) {
        ctx.font = `${a.lineWidth * 5}px sans-serif`;
        ctx.fillText(a.text, a.start.x, a.start.y);
      }
    });
  }, [actions, currentAction]);

  useEffect(() => { redraw(); }, [redraw, canvasSize]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e
      ? e.touches[0]?.clientX ?? (e as React.TouchEvent).changedTouches[0]?.clientX ?? 0
      : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e
      ? e.touches[0]?.clientY ?? (e as React.TouchEvent).changedTouches[0]?.clientY ?? 0
      : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    setIsDrawing(true);
    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        setActions(prev => [...prev, { tool, color, lineWidth, start: pos, text }]);
      }
      setIsDrawing(false);
      return;
    }
    if (tool === 'pen') {
      setCurrentAction({ tool, color, lineWidth, points: [pos] });
    } else {
      setCurrentAction({ tool, color, lineWidth, start: pos, end: pos });
    }
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing || !currentAction) return;
    const pos = getPos(e);
    if (tool === 'pen') {
      setCurrentAction(prev => prev ? { ...prev, points: [...(prev.points || []), pos] } : null);
    } else {
      setCurrentAction(prev => prev ? { ...prev, end: pos } : null);
    }
  };

  const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    setActions(prev => [...prev, currentAction]);
    setCurrentAction(null);
  };

  const undo = () => setActions(prev => prev.slice(0, -1));

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const scaleX = img.width / canvasSize.w;
    const scaleY = img.height / canvasSize.h;
    actions.forEach(a => {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.lineWidth * scaleX;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (a.tool === 'pen' && a.points && a.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(a.points[0].x * scaleX, a.points[0].y * scaleY);
        a.points.forEach(p => ctx.lineTo(p.x * scaleX, p.y * scaleY));
        ctx.stroke();
      } else if (a.tool === 'line' && a.start && a.end) {
        ctx.beginPath();
        ctx.moveTo(a.start.x * scaleX, a.start.y * scaleY);
        ctx.lineTo(a.end.x * scaleX, a.end.y * scaleY);
        ctx.stroke();
      } else if (a.tool === 'circle' && a.start && a.end) {
        const rx = Math.abs(a.end.x - a.start.x) / 2 * scaleX;
        const ry = Math.abs(a.end.y - a.start.y) / 2 * scaleY;
        const cx = (a.start.x + a.end.x) / 2 * scaleX;
        const cy = (a.start.y + a.end.y) / 2 * scaleY;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (a.tool === 'arrow' && a.start && a.end) {
        const sx = a.start.x * scaleX, sy = a.start.y * scaleY;
        const ex = a.end.x * scaleX, ey = a.end.y * scaleY;
        const angle = Math.atan2(ey - sy, ex - sx);
        const headLen = 16 * scaleX;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (a.tool === 'text' && a.start && a.text) {
        ctx.font = `${a.lineWidth * 5 * scaleX}px sans-serif`;
        ctx.fillText(a.text, a.start.x * scaleX, a.start.y * scaleY);
      }
    });
    onSave(canvas.toDataURL('image/jpeg', 0.85));
  };

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen', icon: <Pencil className="w-4 h-4" />, label: 'Pen' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { id: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { id: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-1 flex-wrap">
          {tools.map(t => (
            <Button
              key={t.id}
              size="sm"
              variant={tool === t.id ? 'default' : 'ghost'}
              onClick={() => setTool(t.id)}
              className="h-8 w-8 p-0"
              title={t.label}
            >
              {t.icon}
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-ring' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <select
            value={lineWidth}
            onChange={e => setLineWidth(Number(e.target.value))}
            className="h-8 text-xs bg-card border border-border rounded px-1"
          >
            <option value={2}>Thin</option>
            <option value={3}>Medium</option>
            <option value={5}>Thick</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={undo} disabled={actions.length === 0} className="h-8 w-8 p-0">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 w-8 p-0 text-destructive">
            <X className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleSave} className="h-8 gap-1 text-xs">
            <Check className="w-4 h-4" /> Done
          </Button>
        </div>
      </div>
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-2">
        {canvasSize.w > 0 && (
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="touch-none border border-border rounded-lg shadow-lg"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        )}
      </div>
    </div>
  );
}
