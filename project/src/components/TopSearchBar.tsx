import { useState } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import type { Location } from '../types/location';

interface TopSearchBarProps {
  onResults: (places: Location[]) => void;
  onSelect: (placeId: string) => void;
  onReset: () => void;
  isSearchMode: boolean;
}

export function TopSearchBar({ onResults, onSelect, onReset, isSearchMode }: TopSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEmptyResults, setHasEmptyResults] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsLoading(true);
    setError(null);
    setHasEmptyResults(false);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedQuery }),
      });

      if (!response.ok) {
        throw new Error('검색 중 문제가 발생했습니다.');
      }

      const data = await response.json();
      const places: Location[] = data.places || [];

      if (places.length === 0) {
        setHasEmptyResults(true);
        // Keep the list unchanged on empty results (per UX guideline)
      } else {
        onResults(places);
        // Auto-select first result
        if (places[0]?.id) {
          onSelect(places[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 문제가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setError(null);
    setHasEmptyResults(false);
    onReset();
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    setHasEmptyResults(false);
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 서울 용산 혼밥 맛집"
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-sm"
            disabled={isLoading}
          />
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="h-11 px-5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-w-[80px] justify-center"
        >
          {isLoading ? (
            <span className="text-sm">검색 중...</span>
          ) : (
            '검색'
          )}
        </button>
        {isSearchMode && (
          <button
            type="button"
            onClick={handleReset}
            className="h-11 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="필터로 다시 보기"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">필터로 다시 보기</span>
          </button>
        )}
      </form>

      {/* Status messages */}
      {isLoading && (
        <p className="mt-3 text-sm text-gray-500 flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          검색 중입니다...
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {hasEmptyResults && !isLoading && (
        <p className="mt-3 text-sm text-gray-500">
          아직 등록된 장소가 없어요. 다른 지역/키워드로 검색해보세요.
        </p>
      )}
    </div>
  );
}
