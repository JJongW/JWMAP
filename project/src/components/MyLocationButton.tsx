/**
 * 내 위치 버튼 컴포넌트
 * 
 * 사용자의 현재 위치를 요청하고 지도를 해당 위치로 이동시키는 버튼입니다.
 * 지도 오버레이 상에 배치되어 사용할 수 있습니다.
 */

import { MapPin, Loader2 } from 'lucide-react';

interface MyLocationButtonProps {
  /** 사용자 위치 업데이트 중 여부 */
  isLoading?: boolean;
  /** 사용자 위치가 설정되어 있는지 여부 */
  hasLocation?: boolean;
  /** 버튼 클릭 핸들러 */
  onClick: () => void;
  /** 버튼 위치 (absolute positioning) */
  className?: string;
}

export function MyLocationButton({
  isLoading = false,
  hasLocation = false,
  onClick,
  className = '',
}: MyLocationButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        absolute z-10
        flex items-center justify-center
        w-12 h-12
        rounded-full
        bg-white
        shadow-lg
        border border-gray-200
        hover:bg-gray-50
        active:bg-gray-100
        disabled:opacity-50
        disabled:cursor-not-allowed
        transition-all
        ${hasLocation ? 'ring-2 ring-point ring-offset-2' : ''}
        ${className}
      `}
      aria-label="내 위치로 이동"
      title={hasLocation ? '내 위치로 이동' : '내 위치 찾기'}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 text-point animate-spin" />
      ) : (
        <MapPin className={`w-5 h-5 ${hasLocation ? 'text-point' : 'text-gray-600'}`} />
      )}
    </button>
  );
}
