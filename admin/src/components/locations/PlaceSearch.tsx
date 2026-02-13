'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lon: number;
  category: string;
  categoryDetail: string; // full chain: "음식점 > 일식 > 라멘"
  phone?: string;
}

interface PlaceSearchProps {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  defaultValue?: string;
}

export function PlaceSearch({ onSelect, placeholder = '장소명으로 검색', defaultValue = '' }: PlaceSearchProps) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
    if (!apiKey) {
      console.warn('NEXT_PUBLIC_KAKAO_REST_API_KEY가 설정되지 않았습니다');
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(keyword)}&size=8`,
        { headers: { Authorization: `KakaoAK ${apiKey}` } }
      );
      const data = await res.json();

      if (data.documents) {
        const places: PlaceResult[] = data.documents.map((place: Record<string, string>) => ({
          id: place.id,
          name: place.place_name,
          address: place.address_name,
          roadAddress: place.road_address_name || place.address_name,
          lat: parseFloat(place.y),
          lon: parseFloat(place.x),
          category: place.category_group_name || extractCategory(place.category_name),
          categoryDetail: place.category_name || '',
          phone: place.phone,
        }));
        setResults(places);
        setIsOpen(true);
        setSelectedIndex(-1);
      }
    } catch (err) {
      console.error('카카오 장소 검색 실패:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function extractCategory(categoryName: string): string {
    if (!categoryName) return '';
    const parts = categoryName.split(' > ');
    return parts.length >= 2 ? parts[1] : parts[0] || '';
  }

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  }

  function handleSelect(place: PlaceResult) {
    onSelect(place);
    setQuery(place.name);
    setIsOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
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
        if (selectedIndex >= 0) handleSelect(results[selectedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {results.map((place, index) => (
              <button
                key={place.id}
                type="button"
                onClick={() => handleSelect(place)}
                className={`w-full px-3 py-2.5 text-left hover:bg-muted transition-colors border-b last:border-b-0 ${
                  index === selectedIndex ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{place.name}</span>
                      {place.category && (
                        <span className="text-xs text-muted-foreground shrink-0">{place.category}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
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
