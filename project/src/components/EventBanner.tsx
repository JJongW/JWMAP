import React from 'react';
import { X, Sparkles } from 'lucide-react';

interface EventBannerProps {
  eventName: string;
  eventCount: number;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}

/**
 * 이벤트 배너 컴포넌트
 * 특정 이벤트 식당을 필터링할 수 있는 눈에 띄는 배너 UI
 * 
 * @param eventName - 이벤트 이름 (예: "흑백요리사 시즌2 식당")
 * @param eventCount - 해당 이벤트에 포함된 식당 개수
 * @param isActive - 현재 이벤트 필터가 활성화되어 있는지 여부
 * @param onActivate - 이벤트 필터를 활성화하는 콜백
 * @param onDeactivate - 이벤트 필터를 비활성화하는 콜백
 */
export function EventBanner({
  eventName,
  eventCount,
  isActive,
  onActivate,
  onDeactivate,
}: EventBannerProps) {
  if (isActive) {
    // 활성화된 상태: 배너가 강조되고 해제 버튼 표시
    return (
      <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 border-2 border-orange-400 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{eventName}</h3>
              <p className="text-white/90 text-sm mt-0.5">
                {eventCount}개 식당이 이벤트에 포함되어 있습니다
              </p>
            </div>
          </div>
          <button
            onClick={onDeactivate}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all duration-200 flex items-center gap-2 font-medium"
            aria-label="이벤트 필터 해제"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">필터 해제</span>
          </button>
        </div>
      </div>
    );
  }

  // 비활성화된 상태: 클릭하면 활성화되는 배너
  return (
    <div
      onClick={onActivate}
      className="relative bg-gradient-to-r from-orange-400 to-orange-500 rounded-2xl p-5 border border-orange-300 cursor-pointer hover:shadow-md transition-all duration-200 hover:from-orange-500 hover:to-orange-600"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{eventName}</h3>
            <p className="text-white/90 text-sm mt-0.5">
              클릭하여 {eventCount}개 식당 보기
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-white/20 rounded-xl">
          <span className="text-white font-semibold text-sm">{eventCount}개</span>
        </div>
      </div>
    </div>
  );
}
