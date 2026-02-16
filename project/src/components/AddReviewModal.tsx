import { useState } from 'react';
import { X, CheckCircle, RefreshCw } from 'lucide-react';
import type { Review, VisitType } from '../types/location';
import { reviewApi } from '../utils/supabase';

interface AddReviewModalProps {
  locationId: string;
  locationName: string;
  onClose: () => void;
  onSuccess: (review: Review) => void;
}

const reviewTagOptions = [
  '혼밥',
  '데이트',
  '모임',
  '조용한 분위기',
  '웨이팅 적음',
  '주차 가능',
  '예약 가능',
  '심야 영업',
  '반려동물 동반',
];

export function AddReviewModal({
  locationId,
  locationName,
  onClose,
  onSuccess,
}: AddReviewModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [visitType, setVisitType] = useState<VisitType>('first');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  // 제출 핸들러
  const handleSubmit = async () => {
    // 유효성 검사
    if (!confirmed) {
      setError('실제 방문 확인 체크가 필요합니다.');
      return;
    }
    if (!oneLiner.trim()) {
      setError('한 줄 후기를 입력해주세요.');
      return;
    }
    if (oneLiner.trim().length < 5) {
      setError('한 줄 후기는 최소 5자 이상 입력해주세요.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const newReview = await reviewApi.create({
        location_id: locationId,
        user_display_name: displayName.trim() || '익명',
        one_liner: oneLiner.trim(),
        visit_type: visitType,
        tags: [...selectedTags],
      });

      onSuccess(newReview);
      onClose();
    } catch (err: unknown) {
      console.error('리뷰 저장 오류:', err);
      // API에서 반환한 에러 메시지 표시
      const errorMessage = err instanceof Error
        ? err.message
        : '리뷰 저장 중 문제가 발생했습니다. 다시 시도해주세요.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">나도 다녀왔어요</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 장소명 표시 */}
          <div className="text-center py-2">
            <span className="text-sm text-gray-500">방문 장소</span>
            <p className="text-lg font-semibold text-gray-900 mt-1">{locationName}</p>
          </div>

          {/* 방문 유형 토글 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">방문 유형</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisitType('first')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  visitType === 'first'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <CheckCircle size={16} />
                첫 방문
              </button>
              <button
                type="button"
                onClick={() => setVisitType('revisit')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  visitType === 'revisit'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <RefreshCw size={16} />
                재방문
              </button>
            </div>
          </div>

          {/* 닉네임 입력 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              닉네임 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="익명으로 표시됩니다"
              maxLength={20}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* 한 줄 후기 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              한 줄 후기 <span className="text-orange-500">*</span>
            </label>
            <textarea
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
              placeholder="이 곳의 경험을 한 줄로 남겨주세요"
              maxLength={100}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{oneLiner.length}/100</p>
          </div>

          {/* 방문 태그 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이런 점이 좋았어요 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {reviewTagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedTags.has(tag)
                      ? 'bg-orange-100 text-orange-600 border border-orange-300'
                      : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* 실제 방문 확인 체크박스 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                이 장소를 실제로 방문했으며, 허위 리뷰가 아님을 확인합니다.
                <span className="text-orange-500 ml-1">*</span>
              </span>
            </label>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '저장 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
