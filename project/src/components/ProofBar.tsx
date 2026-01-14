import { CheckCircle, Calendar, Clock, BadgeCheck } from 'lucide-react';
import type { DisclosureType } from '../types/location';

interface ProofBarProps {
  visitedAt?: string;
  visitSlot?: string;
  disclosure?: DisclosureType;
}

// 공개 유형 라벨
const disclosureLabels: Record<DisclosureType, { label: string; color: string }> = {
  paid: { label: '내돈내산', color: 'bg-green-100 text-green-700' },
  invited: { label: '초대', color: 'bg-blue-100 text-blue-700' },
  sponsored: { label: '협찬', color: 'bg-purple-100 text-purple-700' },
};

export function ProofBar({ visitedAt, visitSlot, disclosure }: ProofBarProps) {
  // 방문 날짜 포맷팅
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${year}.${month}.${day}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 border-y border-gray-100">
      {/* 큐레이터 직접 방문 배지 */}
      <div className="flex items-center gap-1.5 text-green-600">
        <CheckCircle size={16} className="flex-shrink-0" />
        <span className="text-sm font-medium">큐레이터 직접 방문</span>
      </div>

      {/* 방문 날짜 */}
      {visitedAt && (
        <div className="flex items-center gap-1 text-gray-500">
          <Calendar size={14} className="flex-shrink-0" />
          <span className="text-xs">{formatDate(visitedAt)}</span>
        </div>
      )}

      {/* 방문 시간대 */}
      {visitSlot && (
        <div className="flex items-center gap-1 text-gray-500">
          <Clock size={14} className="flex-shrink-0" />
          <span className="text-xs">{visitSlot}</span>
        </div>
      )}

      {/* 공개 유형 (내돈내산/초대/협찬) */}
      {disclosure && (
        <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${disclosureLabels[disclosure].color}`}>
          {disclosureLabels[disclosure].label}
        </span>
      )}
    </div>
  );
}
