import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lon: number;
  category: string;
  phone?: string;
}

interface PlaceSearchProps {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
}

declare const kakao: any;

export function PlaceSearch({ onSelect, placeholder = '장소명으로 검색' }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Kakao Local API 검색
  const searchPlaces = useCallback((keyword: string) => {
    if (!keyword.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    const ps = new kakao.maps.services.Places();

    ps.keywordSearch(keyword, (data: any[], status: string) => {
      setIsSearching(false);

      if (status === kakao.maps.services.Status.OK) {
        const places: PlaceResult[] = data.slice(0, 8).map((place: any) => ({
          id: place.id,
          name: place.place_name,
          address: place.address_name,
          roadAddress: place.road_address_name || place.address_name,
          lat: parseFloat(place.y),
          lon: parseFloat(place.x),
          category: place.category_group_name || extractCategory(place.category_name),
          phone: place.phone,
        }));
        setResults(places);
        setIsOpen(true);
        setSelectedIndex(-1);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, {
      size: 10,
    });
  }, []);

  // 카테고리 추출 (예: "음식점 > 한식 > 국밥" -> "한식")
  const extractCategory = (categoryName: string): string => {
    if (!categoryName) return '';
    const parts = categoryName.split(' > ');
    if (parts.length >= 2) {
      return parts[1];
    }
    return parts[0] || '';
  };

  // Debounced 검색
  const handleInputChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  // 장소 선택
  const handleSelect = (place: PlaceResult) => {
    onSelect(place);
    setQuery(place.name);
    setIsOpen(false);
    setResults([]);
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        {isSearching && (
          <Loader2
            size={18}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orange-500 animate-spin"
          />
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {results.map((place, index) => (
              <button
                key={place.id}
                type="button"
                onClick={() => handleSelect(place)}
                className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                  index === selectedIndex ? 'bg-orange-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {place.name}
                      </span>
                      {place.category && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {place.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {place.roadAddress || place.address}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
