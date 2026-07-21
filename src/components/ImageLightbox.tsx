import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize, Shield, ShieldOff } from 'lucide-react';

interface Props {
  src: string | null;
  alt?: string;
  caption?: string;
  onClose: () => void;
  /** When true (default), disables right-click, drag, and long-press save. */
  secure?: boolean;
}

/**
 * Full-screen image viewer with zoom (wheel / pinch / buttons / double-tap),
 * pan when zoomed, fullscreen toggle, and a secure mode that discourages
 * downloads by blocking context menu, drag, and image selection.
 */
export function ImageLightbox({ src, alt = '', caption, onClose, secure: initialSecure = true }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [secure, setSecure] = useState(initialSecure);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchState = useRef<{ dist: number; scale: number } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);
  const zoomBy = useCallback((delta: number) => {
    setScale(s => Math.min(6, Math.max(1, +(s + delta).toFixed(2))));
  }, []);

  // Reset when a new image is opened.
  useEffect(() => { if (src) reset(); }, [src, reset]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomBy(0.5);
      else if (e.key === '-') zoomBy(-0.5);
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose, zoomBy, reset]);

  // Track native fullscreen changes.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* not supported (iOS Safari) — ignore */ }
  }, []);

  if (!src) return null;

  // Wheel zoom.
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? -0.25 : 0.25);
  };

  // Pointer drag to pan (only meaningful when zoomed).
  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { x: e.clientX, y: e.clientY, tx, ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    setTx(dragState.current.tx + (e.clientX - dragState.current.x));
    setTy(dragState.current.ty + (e.clientY - dragState.current.y));
  };
  const onPointerUp = () => { dragState.current = null; };

  // Pinch zoom (two-finger).
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchState.current = { dist: Math.hypot(dx, dy), scale };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        // Double-tap toggles zoom.
        if (scale > 1) reset();
        else setScale(2.5);
      }
      lastTap.current = now;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = pinchState.current.scale * (dist / pinchState.current.dist);
      setScale(Math.min(6, Math.max(1, +next.toFixed(2))));
    }
  };
  const onTouchEnd = () => { pinchState.current = null; };

  const secureProps = secure
    ? {
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        onDragStart: (e: React.DragEvent) => e.preventDefault(),
        style: {
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          userSelect: 'none' as const,
          WebkitUserSelect: 'none' as const,
          WebkitTouchCallout: 'none' as const,
          pointerEvents: 'none' as const,
          transition: dragState.current || pinchState.current ? 'none' : 'transform 0.15s ease-out',
        },
      }
    : {
        style: {
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: dragState.current || pinchState.current ? 'none' : 'transform 0.15s ease-out',
        },
      };

  const btn = 'w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-40';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center select-none"
      onClick={onClose}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Toolbar */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2 py-1.5"
        onClick={e => e.stopPropagation()}
      >
        <button className={btn} onClick={() => zoomBy(-0.5)} disabled={scale <= 1} aria-label="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-white text-xs tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
        <button className={btn} onClick={() => zoomBy(0.5)} disabled={scale >= 6} aria-label="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button className={btn} onClick={reset} aria-label="Reset zoom">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button className={btn} onClick={toggleFullscreen} aria-label="Toggle fullscreen">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
        <button
          className={btn}
          onClick={() => setSecure(s => !s)}
          aria-label={secure ? 'Secure mode on — click to allow downloads' : 'Secure mode off — click to disable downloads'}
          title={secure ? 'Downloads disabled' : 'Downloads allowed'}
        >
          {secure ? <Shield className="w-4 h-4 text-primary" /> : <ShieldOff className="w-4 h-4" />}
        </button>
      </div>

      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-[95vw] max-h-[85vh] object-contain select-none"
          {...secureProps}
        />
      </div>

      {caption && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-3 py-1.5 rounded-full max-w-[90vw] text-center"
          onClick={e => e.stopPropagation()}
        >
          {caption}
        </div>
      )}
    </div>
  );
}