import { useState, useRef } from 'react';
import { Upload, Link, X, Loader2, ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label = '이미지' }: ImageUploadProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setError(null);
    setIsUploading(true);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Cloudinary 업로드
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const data = await response.json();
      const imageUrl = data.secure_url;

      onChange(imageUrl);
      setPreview(imageUrl);
    } catch (err) {
      console.error('Upload error:', err);
      setError('이미지 업로드 중 오류가 발생했습니다.');
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
              <span className="text-xs text-gray-400 mt-1">최대 10MB</span>
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

      {/* 에러 메시지 */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
