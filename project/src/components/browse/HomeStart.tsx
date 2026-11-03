/**
 * HomeStart.tsx
 *
 * 첫 진입 화면. 새 방문자가 가장 먼저 할 일은 "조건 입력 → 추천 1곳 확인"이다.
 * 결과에서 '조건 수정'으로 오면 입력했던 문장을 그대로 두고, 결과로 돌아가는 버튼을 위에 보여준다.
 * 이름 검색·지도·전체 목록·저장한 곳은 없애지 않고 아래 '직접 찾아보기'로 한 단계 내려 둔다.
 */

import type { ReactNode } from 'react';
import { CheckCircle2, List, Map as MapIcon, Search } from 'lucide-react';
import type { ContentMode } from '../../types/location';
import type { IntentConditions } from '../../utils/intentChips';
import { IntentInput } from './IntentInput';

/** 예시는 실제 데이터에서 추천이 나오는 문장으로 고른다 */
const EXAMPLES: Record<ContentMode, string[]> = {
  food: ['종로에서 둘이 저녁', '혼자 점심, 줄 안 서는 곳', '용산 카페 조용한 곳'],
  space: ['비 오는 날 실내 전시', '산책하기 좋은 공원'],
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
  /** 입력 문장 (결과를 다녀와도 남도록 App이 들고 있다) */
  text?: string;
  onTextChange?: (text: string) => void;
  /** 결과에서 '조건 수정'으로 왔을 때: 고치지 않고 결과로 돌아가기 */
  onCancelEdit?: () => void;
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
  text,
  onTextChange,
  onCancelEdit,
}: HomeStartProps) {
  const accentText = contentMode === 'space' ? 'text-violet-600' : 'text-orange-700';

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white">
      {/* 모바일: 한 줄 흐름. 넓은 화면: 왼쪽 추천받기, 오른쪽 직접 찾아보기 */}
      <div className="ko-text mx-auto w-full max-w-lg px-4 pb-10 pt-6 md:px-6 md:pt-14 lg:max-w-5xl lg:px-10 lg:pt-12">
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

        {onCancelEdit && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-gray-50 px-3 py-2.5 lg:mt-8">
            <p className="text-sm text-gray-700">문장을 고친 뒤 추천받기를 누르면 다시 골라 드려요.</p>
            <button
              type="button"
              onClick={onCancelEdit}
              className="min-h-[40px] shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:border-gray-500"
            >
              ← 결과로 돌아가기
            </button>
          </div>
        )}

        <div className="lg:mt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-16">
          <div>
            {/* ── 대표 행동: 조건 입력 → 추천 1곳 ── */}
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 md:mt-10 md:text-3xl lg:mt-0 lg:text-4xl">
              {contentMode === 'space' ? '오늘 뭐 보러 갈까요?' : '오늘 어디 갈까요?'}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 lg:mt-3 lg:text-[1rem]">
              지역이나 상황을 한 줄로 적어 주세요. 운영자가 직접 가본 곳부터 골라 드려요.
            </p>

            <div className="mt-5">
              <IntentInput
                contentMode={contentMode}
                regionOptions={regionOptions}
                onSubmitText={onRecommendText}
                onQuickStart={onQuickStart}
                size="lg"
                examples={EXAMPLES[contentMode]}
                text={text}
                onTextChange={onTextChange}
                autoFocus={Boolean(onCancelEdit)}
              />
            </div>

            <button
              type="button"
              onClick={onPickConditions}
              className="mt-3 text-sm font-semibold text-gray-600 underline-offset-2 hover:text-gray-800 hover:underline"
            >
              문장 대신 하나씩 골라서 추천받기 →
            </button>

            {/* 방문 표시 설명: 문장 속에 끼워 넣지 않고 배지 그대로 보여준다 */}
            <dl className="mt-4 space-y-1.5 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">운영자 직접 방문</dt>
                <dd>운영자가 다녀온 곳</dd>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="whitespace-nowrap rounded border border-dashed border-gray-300 px-1.5 py-0.5 font-medium text-gray-600">아직 안 가본 후보</dt>
                <dd>아직 못 가봐서 정보만 모아 둔 곳</dd>
              </div>
            </dl>
          </div>

          {/* ── 보조 경로: 직접 찾아보기 (넓은 화면에서는 오른쪽 옆 패널) ── */}
          <section
            className="mt-8 border-t border-gray-100 pt-5 lg:mt-0 lg:rounded-2xl lg:border-t-0 lg:bg-gray-50 lg:p-5"
            aria-labelledby="explore-heading"
          >
            <h2 id="explore-heading" className="text-sm font-bold text-gray-700">
              직접 찾아보기
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">이름으로 찾거나 지도와 목록으로 둘러볼 수 있어요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              <ExploreTile icon={<Search size={15} />} label="이름으로 찾기" onClick={() => onExplore('search')} />
              <ExploreTile icon={<MapIcon size={15} />} label="지도에서 보기" onClick={() => onExplore('map')} />
              <ExploreTile icon={<List size={15} />} label={`전체 목록 ${totalCount}곳`} onClick={() => onExplore('all')} />
              <ExploreTile icon={<CheckCircle2 size={15} />} label={`저장한 곳 ${savedCount}`} onClick={() => onExplore('saved')} />
            </div>
          </section>
        </div>
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
