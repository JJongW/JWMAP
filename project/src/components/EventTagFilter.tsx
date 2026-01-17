interface EventTagFilterProps {
  availableEventTags: string[];
  selectedEventTag: string | null;
  onEventTagToggle: (tag: string | null) => void;
}

export function EventTagFilter({
  availableEventTags,
  selectedEventTag,
  onEventTagToggle,
}: EventTagFilterProps) {
  // 이벤트 태그가 없으면 표시하지 않음
  if (!availableEventTags || availableEventTags.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {availableEventTags.map((tag) => {
        const isSelected = selectedEventTag === tag;
        return (
          <button
            key={tag}
            onClick={() => onEventTagToggle(isSelected ? null : tag)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border-2 ${
              isSelected
                ? 'bg-[#FF8A3D] text-[#FFF7ED] border-[#FF8A3D]'
                : 'bg-[#FFF7ED] text-[#FF8A3D] border-[#FF8A3D] hover:bg-[#FF8A3D] hover:text-[#FFF7ED]'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
