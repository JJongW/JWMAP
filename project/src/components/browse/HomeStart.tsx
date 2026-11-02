/**
 * HomeStart.tsx
 *
 * 첫 진입 화면. 새 방문자가 가장 먼저 할 일은 "조건 입력 → 추천 1곳 확인"이다.
 * 이름 검색·지도·전체 목록·저장한 곳은 없애지 않고 아래 '직접 찾아보기'로 한 단계 내려 둔다.
 */

import type { ReactNode } from 'react';
import { CheckCircle2, List, Map as MapIcon, Search } from 'lucide-react';
import type { ContentMode } from '../../types/location';
import type { IntentConditions } from '../../utils/intentChips';
import { IntentInput } from './IntentInput';

/** 예시는 실제 데이터에서 추천이 나오는 문장으로 고른다 */
const EXAMPLES: Record<ContentMode, string[]> = {
  food: ['종로에서 둘이 저녁', '혼자 점심, 빨리 먹을 곳', '용산 카페 조용한 곳'],
  space: ['비 오는 날 실내 전시', '둘이 가볍게 산책'],
};

export type ExploreEntry = 'search' | 'map' | 'all' | 'saved';

interface HomeStartProps {
  contentMode: ContentMode;
  onContentModeChange?: (mode: ContentMode) => void;
  regionOptions: string[];
  onRecommendText: (text: string) => Promise<void> | void;
  onQuickStart: (partial: Partial<IntentConditions>) => void;
  /** 문장 대신 하나씩 골라서 추천받기 */
  onPickConditions: () => void;
  onExplore: (entry: ExploreEntry) => void;
  totalCount: number;
  savedCount: number;
}

export function HomeStart({
  contentMode,
  onContentModeChange,
  regionOptions,
  onRecommendText,
  onQuickStart,
  onPickConditions,
  onExplore,
  totalCount,
  savedCount,
}: HomeStartProps) {
  const accentText = contentMode === 'space' ? 'text-violet-600' : 'text-orange-700';

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6 md:px-6 md:pt-14">
        <div className="flex items-center justify-between gap-4">
          <p className={`text-sm font-bold ${accentText}`}>오늘 오디가?</p>
          {onContentModeChange && (
            <div className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-1">
              {(['food', 'space'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onContentModeChange(mode)}
                  aria-pressed={contentMode === mode}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    contentMode === mode
                      ? mode === 'space'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-orange-500 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-white'
                  }`}
                >
                  {mode === 'space' ? '볼거리' : '맛집'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 대표 행동: 조건 입력 → 추천 1곳 ── */}
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 md:mt-10 md:text-3xl">
          {contentMode === 'space' ? '오늘 뭐 보러 갈까요?' : '오늘 어디 갈까요?'}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
          지역이나 상황을 한 줄로 적으면 추천 1곳과 대안 2곳을 골라드려요.
        </p>

        <div className="mt-5">
          <IntentInput
            contentMode={contentMode}
            regionOptions={regionOptions}
            onSubmitText={onRecommendText}
            onQuickStart={onQuickStart}
            size="lg"
            examples={EXAMPLES[contentMode]}
          />
        </div>

        <button
          type="button"
          onClick={onPickConditions}
          className="mt-3 text-xs font-semibold text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
        >
          문장 대신 하나씩 골라서 추천받기 →
        </button>

        <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
          제가 다녀온 곳은 <span className="font-semibold text-emerald-600">운영자 직접 방문</span>, 아직 못 가본 곳은{' '}
          <span className="font-semibold text-gray-600">아직 안 가본 후보</span>로 구분해서 보여드려요.
        </p>

        {/* ── 보조 경로: 직접 찾아보기 ── */}
        <section className="mt-8 border-t border-gray-100 pt-5" aria-labelledby="explore-heading">
          <h2 id="explore-heading" className="text-sm font-bold text-gray-700">
            직접 찾아보기
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">추천 대신 이름·지도·목록으로 둘러볼 수 있어요.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ExploreTile icon={<Search size={15} />} label="이름으로 찾기" onClick={() => onExplore('search')} />
            <ExploreTile icon={<MapIcon size={15} />} label="지도에서 보기" onClick={() => onExplore('map')} />
            <ExploreTile icon={<List size={15} />} label={`전체 목록 ${totalCount}곳`} onClick={() => onExplore('all')} />
            <ExploreTile icon={<CheckCircle2 size={15} />} label={`저장한 곳 ${savedCount}`} onClick={() => onExplore('saved')} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ExploreTile({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <span className="text-gray-400">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
