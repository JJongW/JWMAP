import { X } from 'lucide-react';
import type { Features } from '../../types/location';

interface FeatureTagSectionProps {
  features: Features;
  featureOptions: { key: keyof Features; label: string }[];
  selectedTags: string[];
  onToggleFeature: (key: keyof Features) => void;
  onToggleTag: (tag: string) => void;
}

export function FeatureTagSection({
  features,
  featureOptions,
  selectedTags,
  onToggleFeature,
  onToggleTag,
}: FeatureTagSectionProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">특징</label>
        <div className="flex flex-wrap gap-2">
          {featureOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onToggleFeature(option.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                features[option.key]
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
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
