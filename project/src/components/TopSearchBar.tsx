import React, { useState } from 'react';
import { Search, X, RotateCcw, Info } from 'lucide-react';
import type { Location } from '../types/location';
import { searchLogApi } from '../utils/supabase';

// Enhanced response types from API
interface UIHints {
  message_type: 'success' | 'no_results_soft' | 'need_clarification';
  message: string;
  suggestions?: string[];
}

interface SearchActions {
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}

// Session ID for search log (persists across page loads in same tab)
function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('jwmap_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('jwmap_session_id', sid);
    }
    return sid;
  } catch {
    return `sess_${Date.now()}`;
  }
}

interface TopSearchBarProps {
  onResults: (places: Location[]) => void;
  onSelect: (placeId: string) => void;
  onReset: () => void;
  isSearchMode: boolean;
  onSearchIdChange?: (searchId: string | null) => void;
  uiRegion?: string;
  deviceType?: 'mobile' | 'pc';
  uiMode?: 'browse' | 'explore';
}

export function TopSearchBar({ onResults, onSelect, onReset, isSearchMode, onSearchIdChange, uiRegion, deviceType = 'pc', uiMode = 'browse' }: TopSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEmptyResults, setHasEmptyResults] = useState(false);
  const [uiHints, setUiHints] = useState<UIHints | null>(null);
  const [fallbackInfo, setFallbackInfo] = useState<{ applied: boolean; notes: string[] } | null>(null);
  const isSearchingRef = React.useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // DUPLICATE INSERT PREVENTION
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    setIsLoading(true);
    setError(null);
    setHasEmptyResults(false);
    setUiHints(null);
    setFallbackInfo(null);

    try {
      // STEP 1: INSERT search_log once (before API call)
      const searchLogId = await searchLogApi.insert({
        query: trimmedQuery,
        session_id: getOrCreateSessionId(),
        device_type: deviceType,
        ui_mode: uiMode,
      });
      onSearchIdChange?.(searchLogId ?? null);

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmedQuery,
          uiRegion,
          search_log_id: searchLogId,
        }),
      });

      if (!response.ok) {
        throw new Error('검색 중 문제가 발생했습니다.');
      }

      const data = await response.json();
      const places: Location[] = data.places || [];

      const actions: SearchActions | undefined = data.actions;
      const hints: UIHints | undefined = data.ui_hints;

      if (hints) setUiHints(hints);
      if (actions?.fallback_applied) {
        setFallbackInfo({ applied: actions.fallback_applied, notes: actions.fallback_notes || [] });
      }

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
      isSearchingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setError(null);
    setHasEmptyResults(false);
    setUiHints(null);
    setFallbackInfo(null);
    onSearchIdChange?.(null); // 검색 ID 초기화
    onReset();
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    setHasEmptyResults(false);
    setUiHints(null);
    setFallbackInfo(null);
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-base">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <div className="relative flex-1 min-w-0">
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
          className="h-10 px-3 bg-point text-white text-sm font-medium rounded-xl hover:bg-point-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 flex-shrink-0"
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
            className="h-10 w-10 p-0 bg-base text-accent rounded-xl hover:bg-opacity-80 transition-colors flex items-center justify-center flex-shrink-0"
            title="필터로 다시 보기"
            aria-label="필터로 다시 보기"
          >
            <RotateCcw size={18} />
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

      {/* Fallback notes - shown when search applied fallback strategies */}
      {!isLoading && fallbackInfo?.applied && fallbackInfo.notes.length > 0 && (
        <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-700 flex items-center gap-2">
            <Info size={14} className="flex-shrink-0" />
            <span>{fallbackInfo.notes.join(' / ')}</span>
          </p>
        </div>
      )}

      {/* UI hints - shown based on search result type */}
      {!isLoading && uiHints && uiHints.message_type !== 'success' && (
        <div className="mt-3">
          <p className="text-sm text-accent/70">
            {uiHints.message}
          </p>
          {uiHints.suggestions && uiHints.suggestions.length > 0 && (
            <ul className="mt-2 text-xs text-accent/60 space-y-1">
              {uiHints.suggestions.map((suggestion, idx) => (
                <li key={idx}>• {suggestion}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasEmptyResults && !isLoading && !uiHints && (
        <p className="mt-3 text-sm text-accent/70">
          아직 등록된 장소가 없어요. 다른 지역/키워드로 검색해보세요.
        </p>
      )}
    </div>
  );
}
