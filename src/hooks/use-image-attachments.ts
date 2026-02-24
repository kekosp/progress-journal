import { useState, useCallback, useRef } from 'react';
import { ReportImage } from '@/types/report';

export function useImageAttachments(initial: ReportImage[] = []) {
  const [images, setImages] = useState<ReportImage[]>(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback((files: FileList) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
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
          setImages(prev => [...prev, {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            dataUrl,
            timestamp: new Date().toISOString(),
          }]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const triggerInput = useCallback(() => inputRef.current?.click(), []);

  return { images, setImages, addImages, removeImage, triggerInput, inputRef };
}
