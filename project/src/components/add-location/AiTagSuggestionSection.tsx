import { Loader2, Sparkles } from 'lucide-react';
import type { LLMSuggestions, TagSuggestion } from '../../schemas/llmSuggestions';
import { tagTypeLabels } from '../../schemas/llmSuggestions';

interface AiTagSuggestionSectionProps {
  shortDesc: string;
  isGeneratingTags: boolean;
  suggestions: LLMSuggestions | null;
  selectedTags: string[];
  onShortDescChange: (value: string) => void;
  onGenerate: () => void;
  onToggleTag: (tagName: string) => void;
}

export function AiTagSuggestionSection({
  shortDesc,
  isGeneratingTags,
  suggestions,
  selectedTags,
  onShortDescChange,
  onGenerate,
  onToggleTag,
}: AiTagSuggestionSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">추천하는 이유</label>
      <p className="mb-1.5 mt-0.5 text-xs text-gray-400">직접 가서 좋았던 점을 문장으로 적어 주세요. 그대로 추천하는 이유로 보여요.</p>
      <div className="relative">
        <input
          type="text"
          value={shortDesc}
          onChange={(e) => onShortDescChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="예: 커피가 진하고 창가 자리가 넓어서 평일 오후에 작업하기 편해요"
        />
        {shortDesc.trim() && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGeneratingTags}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
            title="문장에서 태그 제안받기 (확정 전 확인)"
          >
            {isGeneratingTags ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          </button>
        )}
      </div>

      {suggestions && (
        <div className="mt-2">
          {suggestions.tags && suggestions.tags.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1.5">AI가 문장에서 찾은 제안이에요. 맞는 것만 눌러 추가하세요.</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.tags.map((tag: TagSuggestion, idx: number) => {
                  const isSelected = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onToggleTag(tag.name)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                        isSelected
                          ? 'bg-orange-500 text-white'
                          : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                      }`}
                      title={`${tagTypeLabels[tag.type]} (확신도: ${Math.round(tag.weight * 100)}%)`}
                    >
                      <span className={isSelected ? 'text-orange-200' : 'text-orange-400'}>
                        {tagTypeLabels[tag.type]}
                      </span>
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {suggestions.confidence > 0 && (
            <p className="text-xs text-gray-400 mt-1">확신도: {Math.round(suggestions.confidence * 100)}%</p>
          )}
        </div>
      )}
    </div>
  );
}
