/**
 * ConditionChips.tsx
 *
 * 추천 조건(지역·누구와·시간·분위기·종류)을 칩으로 보여주고 바로 고치게 한다.
 * - 값이 있으면 "둘이 ×" : 이름을 누르면 다른 값 고르기, ×는 조건 빼기
 * - 값이 없으면 "+ 누구와" : 눌러서 추가
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Companion, PriorityFeature, TimeSlot } from '../types/ui';
import {
  COMPANION_LABEL,
  KIND_LABEL,
  PRIORITY_LABEL,
  TIME_SLOT_LABEL,
  type IntentConditions,
  type PlaceKind,
} from '../utils/intentChips';

type ChipKey = keyof IntentConditions;

interface ConditionChipsProps {
  conditions: IntentConditions;
  onChange: (next: IntentConditions) => void;
  regionOptions: string[];
  /** 볼거리 모드에서는 밥집/카페 구분을 숨긴다 */
  showKind?: boolean;
}

const CHIP_TITLE: Record<ChipKey, string> = {
  region: '지역',
  companion: '누구와',
  timeSlot: '시간',
  priority: '분위기',
  kind: '종류',
};

function entries<K extends string>(labels: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

export function ConditionChips({ conditions, onChange, regionOptions, showKind = true }: ConditionChipsProps) {
  const [openKey, setOpenKey] = useState<ChipKey | null>(null);

  const options: Record<ChipKey, { value: string; label: string }[]> = {
    region: regionOptions.map((region) => ({ value: region, label: region })),
    companion: entries<Companion>(COMPANION_LABEL),
    timeSlot: entries<TimeSlot>(TIME_SLOT_LABEL),
    priority: entries<PriorityFeature>(PRIORITY_LABEL),
    kind: entries<PlaceKind>(KIND_LABEL),
  };

  const valueLabel = (key: ChipKey): string | null => {
    const value = conditions[key];
    if (value === null) return null;
    return options[key].find((option) => option.value === value)?.label ?? String(value);
  };

  const keys: ChipKey[] = showKind
    ? ['region', 'companion', 'timeSlot', 'priority', 'kind']
    : ['region', 'companion', 'timeSlot', 'priority'];

  const setValue = (key: ChipKey, value: string | null) => {
    onChange({ ...conditions, [key]: value });
    setOpenKey(null);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="추천 조건">
        {keys.map((key) => {
          const label = valueLabel(key);
          const isOpen = openKey === key;
          if (!label) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className={`flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isOpen ? 'border-gray-400 text-gray-700' : 'border-gray-300 text-gray-400 hover:text-gray-600'
                }`}
              >
                <Plus size={12} />
                {CHIP_TITLE[key]}
              </button>
            );
          }
          return (
            <span
              key={key}
              className={`flex items-center rounded-full border text-xs font-semibold ${
                isOpen ? 'border-orange-400 bg-orange-100 text-orange-800' : 'border-orange-200 bg-orange-50 text-orange-700'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                aria-label={`${CHIP_TITLE[key]} 바꾸기: ${label}`}
                className="py-1.5 pl-3 pr-1"
              >
                {label}
              </button>
              <button
                type="button"
                onClick={() => setValue(key, null)}
                aria-label={`${CHIP_TITLE[key]} 조건 빼기`}
                className="rounded-full py-1.5 pl-1 pr-2 text-orange-400 hover:text-orange-700"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>

      {openKey && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
          <p className="px-1 pb-1.5 text-[11px] font-semibold text-gray-400">{CHIP_TITLE[openKey]} 고르기</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {options[openKey].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue(openKey, option.value)}
                aria-pressed={conditions[openKey] === option.value}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  conditions[openKey] === option.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
