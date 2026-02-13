'use client';

import { useState, useRef } from 'react';
import { Upload, Link, X, Loader2, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

async function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas ctx')); return; }
      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

async function compressToUnder2MB(file: File): Promise<Blob> {
  const MAX = 2 * 1024 * 1024;
  let w = 1200, h = 1200, q = 0.8;
  for (let i = 0; i < 8; i++) {
    const blob = await compressImage(file, w, h, q);
    if (blob.size <= MAX) return blob;
    if (q > 0.3) { q -= 0.1; } else { w = Math.round(w * 0.8); h = Math.round(h * 0.8); }
  }
  return compressImage(file, w, h, q);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(value);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드 가능합니다.'); return; }

    setError(null);
    setCompressionInfo(null);
    setIsUploading(true);

    try {
      const original = file.size;
      const compressed = await compressToUnder2MB(file);
      const reduction = Math.round((1 - compressed.size / original) * 100);
      setCompressionInfo(`${formatBytes(original)} → ${formatBytes(compressed.size)} (${reduction}% 감소)`);

      const previewUrl = URL.createObjectURL(compressed);
      setPreview(previewUrl);

      if (!cloudName || !uploadPreset) {
        setError('Cloudinary 환경변수가 설정되지 않았습니다.');
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', compressed, 'image.jpg');
      formData.append('upload_preset', uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || '업로드 실패');

      onChange(data.secure_url);
      setPreview(data.secure_url);
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      setError(`업로드 실패: ${(err as Error).message}`);
      setPreview('');
    } finally {
      setIsUploading(false);
    }
  }

  function handleClear() {
    onChange('');
    setPreview('');
    setError(null);
    setCompressionInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-md w-fit">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
            mode === 'upload' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="h-3 w-3" /> 업로드
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
            mode === 'url' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link className="h-3 w-3" /> URL
        </button>
      </div>

      {/* Upload mode */}
      {mode === 'upload' && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="admin-image-upload"
          />
          {preview ? (
            <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full h-full object-cover" onError={() => setPreview('')} />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-md hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <label
              htmlFor="admin-image-upload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <span className="text-sm text-muted-foreground">클릭하여 이미지 선택</span>
              <span className="text-xs text-muted-foreground/70 mt-1">자동으로 2MB 미만으로 압축</span>
            </label>
          )}
        </>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div className="relative">
          <Input
            type="text"
            value={value}
            onChange={(e) => { onChange(e.target.value); setPreview(e.target.value); }}
            placeholder="https://example.com/image.jpg"
          />
          {value && (
            <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {compressionInfo && <p className="text-xs text-green-600">{compressionInfo}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
