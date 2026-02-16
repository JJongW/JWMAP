import { X } from 'lucide-react';

interface FeatureTagSectionProps {
  presetTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function FeatureTagSection({
  presetTags,
  selectedTags,
  onToggleTag,
}: FeatureTagSectionProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">빠른 태그</label>
        <div className="flex flex-wrap gap-2">
          {presetTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">선택된 태그</label>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onToggleTag(tag)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 transition-colors"
              >
                {tag}
                <X size={12} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
