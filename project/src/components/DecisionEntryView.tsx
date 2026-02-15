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
 * 5. "직접 둘러보기" 텍스트 버튼 - 기존 browse 모드 진입
 *
 * 디자인 톤: calm, confident, minimal (Apple/Toss-like)
 */

import { useState, useCallback, useMemo } from 'react';
import type { ContentMode, Province } from '../types/location';
import { inferProvinceFromRegion } from '../types/location';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';

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
  /** "직접 둘러보기" 클릭 시 호출 → browse 모드로 전환 */
  onBrowse: () => void;
}

// ─────────────────────────────────────────────
// 선택지 정의
// ─────────────────────────────────────────────

const COMPANION_OPTIONS: { value: Companion; label: string }[] = [
  { value: 'solo', label: '혼자' },
  { value: 'pair', label: '둘이' },
  { value: 'group', label: '여럿이' },
];

const TIMESLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'late', label: '늦은 밤' },
];

const PRIORITY_OPTIONS: { value: PriorityFeature; label: string }[] = [
  { value: 'quiet', label: '조용한 곳' },
  { value: 'wait_short', label: '줄 안 서는 곳' },
  { value: 'fast_serve', label: '빨리 나오는 곳' },
  { value: 'date_ok', label: '분위기 좋은 곳' },
  { value: 'solo_ok', label: '혼밥 눈치 안 보이는 곳' },
];

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
}: DecisionEntryViewProps) {
  const [region, setRegion] = useState<string>(REGION_ANY_VALUE);
  const [expandedProvince, setExpandedProvince] = useState<Province | null>(null);
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [priorityFeature, setPriorityFeature] = useState<PriorityFeature | null>(null);

  const isComplete = companion !== null && timeSlot !== null && priorityFeature !== null;

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
        step1: '어디로 나들이 갈래?',
        cta: '지금 바로 정해줘',
        browse: '직접 둘러보기',
        accent: 'violet',
      };
    }

    return {
      step1: '어디서 먹고 싶어?',
      cta: '지금 바로 정해줘',
      browse: '직접 둘러보기',
      accent: 'orange',
    };
  }, [contentMode]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* ── 스크롤 가능한 메인 콘텐츠 영역 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-6 pb-32 pt-16 md:pt-24">

          {/* ── Hero 텍스트 ── */}
          <div className="mb-12 md:mb-16">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {contentMode === 'space' ? '오늘 뭐 보지?' : '오늘 오디가?'}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-gray-500 md:text-lg">
              지금 상황만 말해.<br />
              내가 바로 갈 곳 정해줄게.
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

          {/* ── STEP 2: 동행 ── */}
          <StepSection
            step={2}
            label="누구랑 가?"
            isActive={true}
          >
            <PillGroup
              options={COMPANION_OPTIONS}
              accent={modeText.accent}
              selected={companion}
              onSelect={setCompanion}
            />
          </StepSection>

          {/* ── STEP 3: 시간대 ── */}
          <StepSection
            step={3}
            label="언제?"
            isActive={companion !== null}
          >
            <PillGroup
              options={TIMESLOT_OPTIONS}
              accent={modeText.accent}
              selected={timeSlot}
              onSelect={setTimeSlot}
            />
          </StepSection>

          {/* ── STEP 4: 우선 조건 ── */}
          <StepSection
            step={4}
            label="가장 중요한 건?"
            isActive={companion !== null && timeSlot !== null}
          >
            <PillGroup
              options={PRIORITY_OPTIONS}
              accent={modeText.accent}
              selected={priorityFeature}
              onSelect={setPriorityFeature}
            />
          </StepSection>

        </div>
      </div>

      {/* ── 하단 CTA 영역 (Fixed bottom) ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 px-6 pb-8 pt-4 md:pb-6">
          <button
            onClick={handleDecide}
            disabled={!isComplete}
            className={`
              w-full rounded-2xl py-4 text-base font-semibold tracking-tight transition-all duration-200
              ${isComplete
                ? modeText.accent === 'violet'
                  ? 'bg-violet-600 text-white active:scale-[0.98]'
                  : 'bg-orange-500 text-white active:scale-[0.98]'
                : 'cursor-not-allowed bg-gray-100 text-gray-300'
              }
            `}
          >
            {modeText.cta}
          </button>
          <button
            onClick={onBrowse}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            {modeText.browse}
          </button>
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
      className={`mb-10 transition-opacity duration-300 ${
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
              rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-150
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
