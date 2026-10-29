/**
 * ConditionChips.tsx
 *
 * 추천 조건(지역·누구와·시간·분위기·종류·장소 종류·추천하는 이유·상황)을 칩으로 보여주고 바로 고치게 한다.
 * - 값이 있으면 "둘이 ×" : 이름을 누르면 다른 값 고르기, ×는 조건 빼기
 * - 값이 없는 조건은 "+ 조건 더하기" 하나로 모아 한 줄을 넘지 않게 한다
 * - 추천하는 이유·상황은 여러 개를 함께 고를 수 있다 (칩 하나에 값 하나)
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ContentMode } from '../types/location';
import type { Companion, PriorityFeature, TimeSlot } from '../types/ui';
import {
  KIND_LABEL,
  getConditionLabels,
  type IntentConditions,
  type PlaceKind,
} from '../utils/intentChips';
import { termLabel, termsOf } from '../utils/taxonomy';

type SingleKey = 'region' | 'companion' | 'timeSlot' | 'priority' | 'kind' | 'placeType';
type MultiKey = 'reasons' | 'situations';
type ChipKey = SingleKey | MultiKey;
type OpenKey = ChipKey | 'more';

interface ConditionChipsProps {
  conditions: IntentConditions;
  onChange: (next: IntentConditions) => void;
  regionOptions: string[];
  /** 볼거리 모드에서는 밥집/카페 구분을 숨기고, 질문 화면과 같은 볼거리 라벨을 쓴다 */
  contentMode?: ContentMode;
}

const CHIP_TITLE: Record<ChipKey, string> = {
  region: '지역',
  companion: '누구와',
  timeSlot: '시간',
  priority: '분위기',
  kind: '밥집/카페',
  placeType: '장소 종류',
  reasons: '추천하는 이유',
  situations: '이런 때',
};

function entries<K extends string>(labels: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
}

const isMulti = (key: ChipKey): key is MultiKey => key === 'reasons' || key === 'situations';

export function ConditionChips({ conditions, onChange, regionOptions, contentMode = 'food' }: ConditionChipsProps) {
  const [openKey, setOpenKey] = useState<OpenKey | null>(null);
  const showKind = contentMode === 'food';
  const labels = getConditionLabels(contentMode);
  const termOptions = (kind: 'place_type' | 'reason' | 'situation') =>
    termsOf(kind, contentMode).map((term) => ({ value: term.slug, label: term.label }));

  const options: Record<ChipKey, { value: string; label: string }[]> = {
    region: regionOptions.map((region) => ({ value: region, label: region })),
    companion: entries<Companion>(labels.companion),
    timeSlot: entries<TimeSlot>(labels.timeSlot),
    priority: entries<PriorityFeature>(labels.priority),
    kind: entries<PlaceKind>(KIND_LABEL),
    placeType: termOptions('place_type'),
    reasons: termOptions('reason'),
    situations: termOptions('situation'),
  };

  const singleLabel = (key: SingleKey): string | null => {
    const value = conditions[key];
    if (value === null) return null;
    if (key === 'placeType') return termLabel(value);
    return options[key].find((option) => option.value === value)?.label ?? String(value);
  };

  const singleKeys: SingleKey[] = showKind
    ? ['region', 'companion', 'timeSlot', 'priority', 'kind', 'placeType']
    : ['region', 'companion', 'timeSlot', 'priority', 'placeType'];

  const setSingle = (key: SingleKey, value: string | null) => {
    onChange({ ...conditions, [key]: value });
    setOpenKey(null);
  };
  const toggleMulti = (key: MultiKey, value: string) => {
    const current = conditions[key];
    onChange({
      ...conditions,
      [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    });
    setOpenKey(null);
  };

  const valueChip = (key: ChipKey, id: string, label: string, onRemove: () => void) => {
    const isOpen = openKey === key;
    return (
      <span
        key={id}
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
          onClick={onRemove}
          aria-label={`${CHIP_TITLE[key]} 조건 빼기: ${label}`}
          className="rounded-full py-1.5 pl-1 pr-2 text-orange-400 hover:text-orange-700"
        >
          <X size={12} />
        </button>
      </span>
    );
  };

  // 아직 고르지 않은 조건 (이유·상황은 여러 개라 항상 더할 수 있다)
  const addableKeys: ChipKey[] = [
    ...singleKeys.filter((key) => conditions[key] === null),
    'reasons',
    'situations',
  ];

  const isSelected = (key: ChipKey, value: string) =>
    isMulti(key) ? conditions[key].includes(value) : conditions[key] === value;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="추천 조건">
        {singleKeys.map((key) => {
          const label = singleLabel(key);
          return label ? valueChip(key, key, label, () => setSingle(key, null)) : null;
        })}
        {(['reasons', 'situations'] as MultiKey[]).flatMap((key) =>
          conditions[key].map((slug) =>
            valueChip(key, `${key}-${slug}`, termLabel(slug), () => toggleMulti(key, slug)),
          ),
        )}
        <button
          type="button"
          onClick={() => setOpenKey(openKey === 'more' ? null : 'more')}
          aria-expanded={openKey === 'more'}
          className={`flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors ${
            openKey === 'more' ? 'border-gray-400 text-gray-700' : 'border-gray-300 text-gray-400 hover:text-gray-600'
          }`}
        >
          <Plus size={12} />
          조건 더하기
        </button>
      </div>

      {openKey === 'more' && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
          {addableKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpenKey(key)}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              + {CHIP_TITLE[key]}
            </button>
          ))}
        </div>
      )}

      {openKey && openKey !== 'more' && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
          <p className="px-1 pb-1.5 text-[11px] font-semibold text-gray-400">
            {CHIP_TITLE[openKey]} {isMulti(openKey) ? '고르기 (여러 개 가능)' : '고르기'}
          </p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {options[openKey].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  isMulti(openKey) ? toggleMulti(openKey, option.value) : setSingle(openKey, option.value)
                }
                aria-pressed={isSelected(openKey, option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected(openKey, option.value)
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
