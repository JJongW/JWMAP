/**
 * DecisionEntryView.tsx
 *
 * 서비스의 새로운 기본 진입 화면.
 * "탐색(exploration)"이 아닌 "결정(decision)"에 초점을 맞춘 UX.
 *
 * 구조:
 * 1. Hero 텍스트 - 서비스 정체성 전달
 * 2. STEP1 지역: 시/도(전국구) 먼저 표시 → 클릭 시 세부지역 펼침
 * 3. STEP2~4: 동행, 시간대, 우선조건
 * 4. CTA 버튼 - 모든 선택 완료 시 활성화
 * 5. "돌아가기" 텍스트 버튼 - 들어오기 전 화면(첫 화면 또는 직접 찾아보기)으로 복귀
 *
 * 디자인 톤: calm, confident, minimal (Apple/Toss-like)
 */

import { useState, useCallback, useMemo } from 'react';
import type { ContentMode, Province } from '../types/location';
import { inferProvinceFromRegion } from '../types/location';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';
import { getConditionLabels } from '../utils/intentChips';

interface DecisionEntryViewProps {
  contentMode: ContentMode;
  /** 시/도별 세부지역. STEP1에서 시/도 먼저 보여주고, 클릭 시 세부지역 펼침 */
  availableProvincesWithDistricts: { province: Province; districts: string[] }[];
  /** 모든 선택 완료 후 CTA 클릭 시 호출 */
  onDecide: (
    region: string | null,
    companion: Companion,
    timeSlot: TimeSlot,
    priorityFeature: PriorityFeature,
  ) => void;
  /** 지도 탐색으로 돌아갈 때 호출 */
  onBrowse: () => void;
  /** 결과 없음 알림 메시지 (alert() 대체 인라인 메시지) */
  noResultMessage?: string | null;
}

// ─────────────────────────────────────────────
// 선택지 정의
// ─────────────────────────────────────────────

/** 라벨은 결과 칩·추천 근거와 같은 곳(intentChips)에서 가져온다 */
function toOptions<K extends string>(labels: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

/** 지역 선택: '' = 상관없어요 (전체) */
const REGION_ANY_VALUE = '';

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export function DecisionEntryView({
  contentMode,
  availableProvincesWithDistricts,
  onDecide,
  onBrowse,
  noResultMessage,
}: DecisionEntryViewProps) {
  const [region, setRegion] = useState<string>(REGION_ANY_VALUE);
  const [expandedProvince, setExpandedProvince] = useState<Province | null>(null);
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [priorityFeature, setPriorityFeature] = useState<PriorityFeature | null>(null);

  const labels = getConditionLabels(contentMode);
  const isComplete = companion !== null && timeSlot !== null && priorityFeature !== null;
  const completedCount = [companion, timeSlot, priorityFeature].filter(Boolean).length;

  const handleDecide = useCallback(() => {
    if (!isComplete) return;
    onDecide(region === REGION_ANY_VALUE ? null : region, companion!, timeSlot!, priorityFeature!);
  }, [region, companion, timeSlot, priorityFeature, isComplete, onDecide]);

  const handleSelectRegion = useCallback((value: string) => {
    setRegion(value);
    // 세부지역 선택 후에도 펼친 상태 유지 (선택 확인용)
  }, []);

  const handleExpandProvince = useCallback((province: Province) => {
    setExpandedProvince(province);
  }, []);

  const handleBackToProvinces = useCallback(() => {
    setExpandedProvince(null);
  }, []);

  const provinceOptions = useMemo(
    () => availableProvincesWithDistricts.map(({ province }) => ({ value: province, label: province })),
    [availableProvincesWithDistricts],
  );

  const expandedData = useMemo(() => {
    if (!expandedProvince) return null;
    return availableProvincesWithDistricts.find((p) => p.province === expandedProvince);
  }, [expandedProvince, availableProvincesWithDistricts]);

  const modeText = useMemo(() => {
    if (contentMode === 'space') {
      return {
        step1: '어디로 갈까요?',
        step3: '얼마나 머물 건가요?',
        step4: '무엇이 중요한가요?',
        hint3: '머무는 시간을 골라 주세요',
        cta: '추천받기',
        browse: '돌아가기',
        accent: 'violet' as const,
      };
    }

    return {
      step1: '어디서 찾을까요?',
      step3: '언제 가나요?',
      step4: '가장 중요한 건 뭔가요?',
      hint3: '시간대를 골라 주세요',
      cta: '추천받기',
      browse: '돌아가기',
      accent: 'orange' as const,
    };
  }, [contentMode]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* ── 스크롤 가능한 메인 콘텐츠 영역 ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="ko-text mx-auto w-full max-w-lg px-6 pb-8 pt-10 md:pt-16 lg:max-w-4xl lg:px-10 [@media(max-height:700px)]:pt-6">

          {/* ── Hero 텍스트 ── */}
          <div className="mb-8 md:mb-12 [@media(max-height:700px)]:mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {contentMode === 'space' ? '오늘 뭐 보러 갈까요?' : '오늘 어디 갈까요?'}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-gray-500 md:text-lg">
              몇 가지만 고르면 갈 곳을 추천해 드려요.
            </p>
          </div>

          {/* ── STEP 1: 어디서 (시/도 → 세부지역 2단계) ── */}
          <StepSection
            step={1}
            label={modeText.step1}
            isActive={true}
          >
            {expandedData ? (
              <div className="space-y-3">
                <PillGroup
                  options={[
                    { value: REGION_ANY_VALUE, label: '상관없어요' },
                    { value: expandedData.province, label: `${expandedData.province} 전체` },
                    ...expandedData.districts.map((d) => ({ value: d, label: d })),
                  ]}
                accent={modeText.accent}
                  selected={region}
                  onSelect={handleSelectRegion}
                />
                <button
                  type="button"
                  onClick={handleBackToProvinces}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← 시/도 선택으로
                </button>
              </div>
            ) : (
              <PillGroup
                options={[
                  { value: REGION_ANY_VALUE, label: '상관없어요' },
                  ...provinceOptions,
                ]}
                accent={modeText.accent}
                selected={
                  expandedProvince ??
                  (region === REGION_ANY_VALUE ? REGION_ANY_VALUE : (inferProvinceFromRegion(region) || region))
                }
                onSelect={(value) => {
                  if (value === REGION_ANY_VALUE) {
                    setRegion(REGION_ANY_VALUE);
                  } else {
                    handleExpandProvince(value as Province);
                  }
                }}
              />
            )}
          </StepSection>

          {/* 넓은 화면에서는 STEP 2~4를 나란히 놓아 한 화면에 보이게 */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            {/* ── STEP 2: 동행 ── */}
            <StepSection
              step={2}
              label="누구와 가나요?"
              isActive={true}
            >
              <PillGroup
                options={toOptions<Companion>(labels.companion)}
                accent={modeText.accent}
                selected={companion}
                onSelect={setCompanion}
              />
            </StepSection>

            {/* ── STEP 3: 시간대 ── */}
            <StepSection
              step={3}
              label={modeText.step3}
              isActive={companion !== null}
            >
              <PillGroup
                options={toOptions<TimeSlot>(labels.timeSlot)}
                accent={modeText.accent}
                selected={timeSlot}
                onSelect={setTimeSlot}
              />
            </StepSection>

            {/* ── STEP 4: 우선 조건 ── */}
            <StepSection
              step={4}
              label={modeText.step4}
              isActive={companion !== null && timeSlot !== null}
            >
              <PillGroup
                options={toOptions<PriorityFeature>(labels.priority)}
                accent={modeText.accent}
                selected={priorityFeature}
                onSelect={setPriorityFeature}
              />
            </StepSection>
          </div>

        </div>
      </div>

      {/* ── 하단 CTA 영역: 본문을 덮지 않게 흐름 안에 두고, 한 줄 버튼 + 한 줄 안내로 낮게 ── */}
      <div className="shrink-0 border-t border-gray-100 bg-white">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:max-w-4xl lg:flex-row lg:items-center lg:gap-4 lg:px-10">
          {noResultMessage && (
            <p className="w-full rounded-xl bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-800 lg:order-2 lg:w-auto lg:flex-1" role="alert" aria-live="assertive">
              {noResultMessage}
            </p>
          )}
          <div className="flex items-center gap-2 lg:order-3 lg:ml-auto lg:w-[26rem]">
            <button
              onClick={onBrowse}
              className="min-h-[44px] shrink-0 rounded-2xl border border-gray-200 px-4 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400"
            >
              {modeText.browse}
            </button>
            <button
              onClick={handleDecide}
              disabled={!isComplete}
              aria-disabled={!isComplete}
              className={`
                flex-1 rounded-2xl py-3.5 text-base font-semibold tracking-tight transition-all duration-200
                ${isComplete
                  ? modeText.accent === 'violet'
                    ? 'bg-violet-600 text-white active:scale-[0.98]'
                    : 'bg-orange-500 text-white active:scale-[0.98]'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
                }
              `}
            >
              {modeText.cta}
            </button>
          </div>
          {/* 진행 dots(동행·시간·조건 3칸)와 다음에 고를 것을 한 줄로 */}
          <div className="flex items-center justify-center gap-2 lg:order-1" role="status" aria-live="polite" aria-label={`${completedCount}/3 선택 완료`}>
            <span className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                    i < completedCount
                      ? modeText.accent === 'violet' ? 'bg-violet-500' : 'bg-orange-400'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </span>
            {!isComplete && (
              <span className="text-xs text-gray-500">
                {!companion ? '누구와 가는지 골라 주세요' : !timeSlot ? modeText.hint3 : '가장 중요한 걸 골라 주세요'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// StepSection: 각 단계 래퍼
// ─────────────────────────────────────────────

interface StepSectionProps {
  step: number;
  label: string;
  isActive: boolean;
  children: React.ReactNode;
}

function StepSection({ step, label, isActive, children }: StepSectionProps) {
  return (
    <div
      className={`mb-8 transition-opacity duration-300 ${
        isActive ? 'opacity-100' : 'pointer-events-none opacity-30'
      }`}
    >
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-xs font-medium tracking-widest text-gray-300">
          STEP {step}
        </span>
        <span className="text-base font-semibold text-gray-800">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// PillGroup: 선택 버튼 그룹
// ─────────────────────────────────────────────

interface PillGroupProps<T extends string> {
  options: { value: T; label: string }[];
  accent: 'orange' | 'violet';
  selected: T | null;
  onSelect: (value: T) => void;
}

function PillGroup<T extends string>({ options, accent, selected, onSelect }: PillGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`
              rounded-full border px-5 py-3 text-sm font-medium transition-all duration-150
              ${isSelected
                ? accent === 'violet'
                  ? 'border-violet-600 bg-violet-600 text-white'
                  : 'border-orange-500 bg-orange-500 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800'
              }
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
