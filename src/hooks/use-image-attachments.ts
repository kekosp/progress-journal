import { useState, useCallback, useRef } from 'react';
import { ReportImage } from '@/types/report';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

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

  const takeNativePhoto = useCallback(async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        width: 1200,
        height: 1200,
      });
      if (photo.dataUrl) {
        setImages(prev => [...prev, {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          dataUrl: photo.dataUrl!,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch {
      // User cancelled or camera unavailable — fall back to file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) addImages(files);
      };
      input.click();
    }
  }, [addImages]);

  return { images, setImages, addImages, removeImage, triggerInput, takeNativePhoto, inputRef };
}
