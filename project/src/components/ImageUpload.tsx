import { useState, useRef } from 'react';
import { Upload, Link, X, Loader2, ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  maxWidth?: number;      // 최대 너비 (기본: 1200px)
  maxHeight?: number;     // 최대 높이 (기본: 1200px)
  quality?: number;       // 압축 품질 0-1 (기본: 0.8)
}

// 이미지 압축 함수
async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 원본 크기
      let { width, height } = img;

      // 비율 유지하면서 리사이즈
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Canvas에 그리기
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // 흰색 배경 (PNG 투명 배경 대응)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG로 압축 (더 작은 파일 크기)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// 2MB 미만으로 압축하는 함수 (반복 압축)
async function compressToUnder2MB(
  file: File,
  initialMaxWidth: number,
  initialMaxHeight: number,
  initialQuality: number
): Promise<Blob> {
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  let currentWidth = initialMaxWidth;
  let currentHeight = initialMaxHeight;
  let currentQuality = initialQuality;
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  while (attempts < MAX_ATTEMPTS) {
    const compressed = await compressImage(file, currentWidth, currentHeight, currentQuality);
    
    if (compressed.size <= MAX_SIZE) {
      return compressed;
    }

    // 2MB를 넘으면 압축 강화
    if (currentQuality > 0.3) {
      // 품질을 낮춤
      currentQuality = Math.max(0.3, currentQuality - 0.1);
    } else {
      // 품질이 최소치면 크기를 줄임
      currentWidth = Math.round(currentWidth * 0.8);
      currentHeight = Math.round(currentHeight * 0.8);
    }

    attempts++;
  }

  // 최대 시도 횟수에 도달하면 마지막 결과 반환
  return await compressImage(file, currentWidth, currentHeight, currentQuality);
}

export function ImageUpload({
  value,
  onChange,
  label = '이미지',
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8,
}: ImageUploadProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>(value);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setError(null);
    setCompressionInfo(null);
    setIsUploading(true);

    try {
      // 이미지 압축 (자동으로 2MB 미만으로 압축)
      const originalSize = file.size;
      const compressedBlob = await compressToUnder2MB(file, maxWidth, maxHeight, quality);
      const compressedSize = compressedBlob.size;

      // 압축 정보 표시
      const reduction = Math.round((1 - compressedSize / originalSize) * 100);
      setCompressionInfo(
        `${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${reduction}% 감소)`
      );

      // 미리보기 생성
      const previewUrl = URL.createObjectURL(compressedBlob);
      setPreview(previewUrl);

      // Cloudinary 업로드
      const formData = new FormData();
      formData.append('file', compressedBlob, 'image.jpg');
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Cloudinary error:', data);
        throw new Error(data.error?.message || '업로드 실패');
      }

      const imageUrl = data.secure_url;

      onChange(imageUrl);
      setPreview(imageUrl);

      // 임시 URL 해제
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';

      // 환경변수 체크
      if (!cloudName || !uploadPreset) {
        setError('Cloudinary 설정이 없습니다. 환경변수를 확인해주세요.');
      } else {
        setError(`이미지 업로드 실패: ${errorMessage}`);
      }
      setPreview('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    onChange(url);
    setPreview(url);
    setError(null);
  };

  const handleClear = () => {
    onChange('');
    setPreview('');
    setError(null);
    setCompressionInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      {/* 모드 전환 탭 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            mode === 'upload'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload size={14} />
          업로드
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
            mode === 'url'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link size={14} />
          URL
        </button>
      </div>

      {/* 업로드 모드 */}
      {mode === 'upload' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-upload"
          />

          {/* 미리보기 또는 업로드 영역 */}
          {preview ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setPreview('')}
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-colors"
            >
              <ImageIcon className="w-10 h-10 text-gray-300 mb-2" />
              <span className="text-sm text-gray-500">클릭하여 이미지 선택</span>
              <span className="text-xs text-gray-400 mt-1">자동으로 2MB 미만으로 압축됩니다</span>
            </label>
          )}
        </div>
      )}

      {/* URL 모드 */}
      {mode === 'url' && (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* 압축 정보 */}
      {compressionInfo && (
        <p className="text-xs text-green-600">{compressionInfo}</p>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
