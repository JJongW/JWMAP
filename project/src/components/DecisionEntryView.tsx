/**
 * DecisionEntryView.tsx
 * 
 * 서비스의 새로운 기본 진입 화면.
 * "탐색(exploration)"이 아닌 "결정(decision)"에 초점을 맞춘 UX.
 * 
 * 구조:
 * 1. Hero 텍스트 - 서비스 정체성 전달
 * 2. 3단계 선택 - Companion → TimeSlot → PriorityFeature
 * 3. CTA 버튼 - 모든 선택 완료 시 활성화
 * 4. "직접 둘러보기" 텍스트 버튼 - 기존 browse 모드 진입
 * 
 * 디자인 톤: calm, confident, minimal (Apple/Toss-like)
 */

import { useState, useCallback } from 'react';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';

interface DecisionEntryViewProps {
  /** 모든 선택 완료 후 CTA 클릭 시 호출 */
  onDecide: (companion: Companion, timeSlot: TimeSlot, priorityFeature: PriorityFeature) => void;
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

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export function DecisionEntryView({ onDecide, onBrowse }: DecisionEntryViewProps) {
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [priorityFeature, setPriorityFeature] = useState<PriorityFeature | null>(null);

  const isComplete = companion !== null && timeSlot !== null && priorityFeature !== null;

  const handleDecide = useCallback(() => {
    if (!isComplete) return;
    onDecide(companion!, timeSlot!, priorityFeature!);
  }, [companion, timeSlot, priorityFeature, isComplete, onDecide]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* ── 스크롤 가능한 메인 콘텐츠 영역 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-6 pb-32 pt-16 md:pt-24">

          {/* ── Hero 텍스트 ── */}
          <div className="mb-12 md:mb-16">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              오늘 오디가?
            </h1>
            <p className="mt-3 text-base leading-relaxed text-gray-500 md:text-lg">
              지금 상황만 말해.<br />
              내가 바로 갈 곳 정해줄게.
            </p>
          </div>

          {/* ── STEP 1: 동행 ── */}
          <StepSection
            step={1}
            label="누구랑 가?"
            isActive={true}
          >
            <PillGroup
              options={COMPANION_OPTIONS}
              selected={companion}
              onSelect={setCompanion}
            />
          </StepSection>

          {/* ── STEP 2: 시간대 ── */}
          <StepSection
            step={2}
            label="언제?"
            isActive={companion !== null}
          >
            <PillGroup
              options={TIMESLOT_OPTIONS}
              selected={timeSlot}
              onSelect={setTimeSlot}
            />
          </StepSection>

          {/* ── STEP 3: 우선 조건 ── */}
          <StepSection
            step={3}
            label="가장 중요한 건?"
            isActive={companion !== null && timeSlot !== null}
          >
            <PillGroup
              options={PRIORITY_OPTIONS}
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
                ? 'bg-gray-900 text-white active:scale-[0.98]'
                : 'cursor-not-allowed bg-gray-100 text-gray-300'
              }
            `}
          >
            지금 바로 정해줘
          </button>
          <button
            onClick={onBrowse}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            직접 둘러보기
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
  selected: T | null;
  onSelect: (value: T) => void;
}

function PillGroup<T extends string>({ options, selected, onSelect }: PillGroupProps<T>) {
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
                ? 'border-gray-900 bg-gray-900 text-white'
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
