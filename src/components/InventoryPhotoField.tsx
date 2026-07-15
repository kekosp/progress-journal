import { ReportImage } from '@/types/report';
import { useImageAttachments } from '@/hooks/use-image-attachments';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  label?: string;
  value: ReportImage[];
  onChange: (images: ReportImage[]) => void;
}

/** Compact optional-photo picker used across inventory flows. */
export function InventoryPhotoField({ label = 'Photos (optional)', value, onChange }: Props) {
  const { images, setImages, addImages, removeImage, triggerInput, takeNativePhoto, inputRef } =
    useImageAttachments(value);

  // Propagate internal changes upward.
  useEffect(() => {
    onChange(images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

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
          {images.map(img => (
            <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border border-border">
              <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { removeImage(img.id); setImages(prev => prev.filter(i => i.id !== img.id)); }}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                aria-label="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}