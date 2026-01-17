import { useState } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import type { Location } from '../types/location';
import { searchLogApi } from '../utils/supabase';

interface TopSearchBarProps {
  onResults: (places: Location[]) => void;
  onSelect: (placeId: string) => void;
  onReset: () => void;
  isSearchMode: boolean;
  onSearchIdChange?: (searchId: string | null) => void; // 검색 ID 전달 (클릭 로그용)
}

export function TopSearchBar({ onResults, onSelect, onReset, isSearchMode, onSearchIdChange }: TopSearchBarProps) {
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

    const startTime = Date.now();

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
      const totalMs = Date.now() - startTime;

      // 검색 로그 기록
      const searchId = await searchLogApi.log({
        query: trimmedQuery,
        parsed: data.parsed || {},
        result_count: places.length,
        llm_ms: data.llm_ms || 0,
        db_ms: data.db_ms || 0,
        total_ms: totalMs,
      });

      // 검색 ID 전달 (클릭 로그에서 사용)
      onSearchIdChange?.(searchId);

      if (places.length === 0) {
        setHasEmptyResults(true);
        // Keep the list unchanged on empty results (per UX guideline)
      } else {
        onResults(places);
        // Auto-select first result
        if (places[0]?.id) {
          onSelect(places[0].id);
        }
        // Scroll to list section
        setTimeout(() => {
          const listElement = document.querySelector('[data-location-list]');
          if (listElement) {
            listElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
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
    onSearchIdChange?.(null); // 검색 ID 초기화
    onReset();
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    setHasEmptyResults(false);
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-base">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 서울 용산 혼밥 맛집"
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-base focus:border-point focus:ring-2 focus:ring-point/20 outline-none transition-all text-sm"
            disabled={isLoading}
          />
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/50"
          />
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-accent/50 hover:text-accent/80 p-1"
              aria-label="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="h-11 px-5 bg-point text-white text-sm font-medium rounded-xl hover:bg-point-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-w-[80px] justify-center"
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
            className="h-11 px-4 bg-base text-accent text-sm font-medium rounded-xl hover:bg-opacity-80 transition-colors flex items-center gap-2"
            title="필터로 다시 보기"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">필터로 다시 보기</span>
          </button>
        )}
      </form>

      {/* Status messages */}
      {isLoading && (
        <p className="mt-3 text-sm text-accent/70 flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-point border-t-transparent rounded-full animate-spin" />
          검색 중입니다...
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {hasEmptyResults && !isLoading && (
        <p className="mt-3 text-sm text-accent/70">
          아직 등록된 장소가 없어요. 다른 지역/키워드로 검색해보세요.
        </p>
      )}
    </div>
  );
}
