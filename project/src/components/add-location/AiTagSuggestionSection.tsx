import { Loader2, Sparkles } from 'lucide-react';
import type { LLMSuggestions, TagSuggestion } from '../../schemas/llmSuggestions';
import { tagTypeLabels } from '../../schemas/llmSuggestions';

interface AiTagSuggestionSectionProps {
  shortDesc: string;
  isGeneratingTags: boolean;
  suggestions: LLMSuggestions | null;
  selectedTags: string[];
  suggestedFeaturesText: string;
  onShortDescChange: (value: string) => void;
  onGenerate: () => void;
  onToggleTag: (tagName: string) => void;
}

export function AiTagSuggestionSection({
  shortDesc,
  isGeneratingTags,
  suggestions,
  selectedTags,
  suggestedFeaturesText,
  onShortDescChange,
  onGenerate,
  onToggleTag,
}: AiTagSuggestionSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">이곳은 어땠나요?</label>
      <div className="relative">
        <input
          type="text"
          value={shortDesc}
          onChange={(e) => onShortDescChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="예: 혼자 가기 좋고 웨이팅 없어서 편해요"
        />
        {shortDesc.trim() && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGeneratingTags}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
            title="AI 태그 추천"
          >
            {isGeneratingTags ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          </button>
        )}
      </div>

      {suggestions && (
        <div className="mt-2">
          {suggestedFeaturesText && (
            <p className="text-xs text-orange-500">AI 추천 특징: {suggestedFeaturesText}</p>
          )}
          {suggestions.tags && suggestions.tags.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1.5">클릭하여 태그 추가:</p>
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
