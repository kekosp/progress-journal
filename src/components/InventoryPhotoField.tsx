import { ReportImage } from '@/types/report';
import { useImageAttachments } from '@/hooks/use-image-attachments';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, X, RefreshCw, Maximize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ImageLightbox } from '@/components/ImageLightbox';

interface Props {
  label?: string;
  value: ReportImage[];
  onChange: (images: ReportImage[]) => void;
}

/** Compact optional-photo picker used across inventory flows. */
export function InventoryPhotoField({ label = 'Photos (optional)', value, onChange }: Props) {
  const { images, setImages, addImages, removeImage, triggerInput, takeNativePhoto, inputRef } =
    useImageAttachments(value);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Propagate internal changes upward.
  useEffect(() => {
    onChange(images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const handleReplaceClick = (id: string) => {
    replaceTargetId.current = id;
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = (file: File) => {
    const targetId = replaceTargetId.current;
    if (!targetId || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1200;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize; }
          else { w = (w / h) * maxSize; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImages(prev => prev.map(p => p.id === targetId
          ? { ...p, dataUrl, annotatedDataUrl: undefined, timestamp: new Date().toISOString() }
          : p));
        replaceTargetId.current = null;
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">{label}</label>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={takeNativePhoto}>
          <Camera className="w-3.5 h-3.5" /> Camera
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={triggerInput}>
          <ImagePlus className="w-3.5 h-3.5" /> Gallery
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && addImages(e.target.files)}
        />
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {images.map(img => {
            const src = img.annotatedDataUrl ?? img.dataUrl;
            return (
              <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border border-border group bg-muted">
                <button
                  type="button"
                  onClick={() => setPreviewUrl(src)}
                  className="absolute inset-0"
                  aria-label="Preview photo"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex justify-between items-center px-1 py-1 bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity pointer-events-none">
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(src)}
                    className="p-1 pointer-events-auto text-foreground hover:text-primary"
                    aria-label="Enlarge photo"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReplaceClick(img.id)}
                    className="p-1 pointer-events-auto text-foreground hover:text-primary"
                    aria-label="Replace photo"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleReplaceClick(img.id)}
                    className="bg-background/80 rounded-full p-1 sm:hidden"
                    aria-label="Replace photo"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="bg-background/80 rounded-full p-1"
                    aria-label="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleReplaceFile(file);
          e.target.value = '';
        }}
      />

      <ImageLightbox src={previewUrl} onClose={() => setPreviewUrl(null)} />
    </div>
  );
}