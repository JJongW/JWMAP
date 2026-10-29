/**
 * IntentInput.tsx
 *
 * 첫 화면의 "오늘 어디 갈까요?" 입력창.
 * 문장을 입력하고 추천받기를 누르거나, 입력 없이 지역·밥집·카페·볼거리로 바로 시작한다.
 */

import { useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ContentMode } from '../../types/location';
import type { IntentConditions } from '../../utils/intentChips';

interface IntentInputProps {
  contentMode: ContentMode;
  regionOptions: string[];
  onSubmitText: (text: string) => Promise<void> | void;
  onQuickStart: (partial: Partial<IntentConditions>) => void;
  onContentModeChange?: (mode: ContentMode) => void;
}

export function IntentInput({
  contentMode,
  regionOptions,
  onSubmitText,
  onQuickStart,
  onContentModeChange,
}: IntentInputProps) {
  const [text, setText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isRegionOpen, setIsRegionOpen] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isResolving) return;
    setIsResolving(true);
    try {
      await onSubmitText(text);
    } finally {
      setIsResolving(false);
    }
  };

  const quickClass =
    'shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50';

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={contentMode === 'space' ? '예: 비 오는 날 가기 좋은 전시' : '예: 혼자 노트북 하기 좋은 카페'}
          aria-label="오늘 어디 갈까요?"
          enterKeyHint="go"
          className="min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-orange-400"
        />
        <button
          type="submit"
          disabled={isResolving}
          className={`shrink-0 rounded-xl px-4 text-sm font-bold text-white transition-colors disabled:opacity-60 ${
            contentMode === 'space' ? 'bg-violet-600' : 'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          {isResolving ? '읽는 중' : '추천받기'}
        </button>
      </form>

      <div className="flex gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setIsRegionOpen(!isRegionOpen)}
          aria-expanded={isRegionOpen}
          className={`${quickClass} flex items-center gap-1`}
        >
          지역
          <ChevronDown size={12} className={isRegionOpen ? 'rotate-180' : ''} />
        </button>
        {contentMode === 'food' && (
          <>
            <button type="button" onClick={() => onQuickStart({ kind: 'meal' })} className={quickClass}>
              밥집
            </button>
            <button type="button" onClick={() => onQuickStart({ kind: 'cafe' })} className={quickClass}>
              카페
            </button>
          </>
        )}
        {onContentModeChange && (
          <button
            type="button"
            onClick={() => onContentModeChange(contentMode === 'space' ? 'food' : 'space')}
            className={quickClass}
          >
            {contentMode === 'space' ? '맛집' : '볼거리'}
          </button>
        )}
      </div>

      {isRegionOpen && (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-gray-100 bg-white p-2">
          {regionOptions.map((region) => (
            <button
              key={region}
              type="button"
              onClick={() => {
                setIsRegionOpen(false);
                onQuickStart({ region });
              }}
              className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
            >
              {region}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
