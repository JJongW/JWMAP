'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const CATEGORY_MAINS = [
  '밥', '면', '국물', '고기요리', '해산물',
  '간편식', '양식·퓨전', '디저트', '카페', '술안주',
];

interface Props {
  regions: string[];
}

export function LocationFilters({ regions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set('page', '1');
      router.push(`/locations?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push('/locations');
  }, [router]);

  const hasFilters =
    searchParams.get('search') ||
    searchParams.get('region') ||
    searchParams.get('category_main') ||
    searchParams.get('price_level');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">필터</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="mr-1 h-3 w-3" />
            초기화
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">검색</Label>
          <Input
            placeholder="장소명 검색..."
            defaultValue={searchParams.get('search') ?? ''}
            onChange={(e) => updateParam('search', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs">지역</Label>
          <Select
            value={searchParams.get('region') ?? 'all'}
            onValueChange={(v) => updateParam('region', v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">카테고리</Label>
          <Select
            value={searchParams.get('category_main') ?? 'all'}
            onValueChange={(v) => updateParam('category_main', v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {CATEGORY_MAINS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">가격대</Label>
          <Select
            value={searchParams.get('price_level') ?? 'all'}
            onValueChange={(v) => updateParam('price_level', v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="1">$ (저렴)</SelectItem>
              <SelectItem value="2">$$ (보통)</SelectItem>
              <SelectItem value="3">$$$ (비쌈)</SelectItem>
              <SelectItem value="4">$$$$ (고급)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
