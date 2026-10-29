'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Location, Tag, LocationTag } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { getCurationLabel } from './CurationLevelSelector';

interface Props {
  locations: Location[];
  totalCount: number;
  page: number;
  perPage: number;
  allTags: Tag[];
  locationTagsByLocId: Record<string, LocationTag[]>;
  basePath?: string;
  tagDomain?: 'food' | 'space';
  domain?: 'locations' | 'attractions';
}

export function LocationTable({
  locations,
  totalCount,
  page,
  perPage,
  basePath = '/locations',
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(totalCount / perPage);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', p.toString());
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">장소</TableHead>
              <TableHead>지역</TableHead>
              <TableHead>장소 종류</TableHead>
              <TableHead className="text-center">가봤나요</TableHead>
              <TableHead>추천하는 이유</TableHead>
              <TableHead className="text-center">사진</TableHead>
              <TableHead className="text-center">추천 강도</TableHead>
              <TableHead className="text-right">등록일</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  장소가 없습니다
                </TableCell>
              </TableRow>
            )}
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">
                  <Link href={`/places/${loc.id}`} className="hover:underline">
                    {loc.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{loc.region}</TableCell>
                <TableCell className="text-xs">
                  {[loc.category_main, loc.category_sub].filter(Boolean).join(' · ') || (
                    <span className="text-red-500">미정</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {loc.curator_visited ? (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">가봤음</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground">후보</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={loc.short_desc ?? undefined}>
                  {loc.curator_visited && loc.short_desc ? loc.short_desc : <span className="text-muted-foreground/50">없음</span>}
                </TableCell>
                <TableCell className="text-center">
                  {loc.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={loc.imageUrl} alt="" className="mx-auto h-8 w-8 rounded object-cover" loading="lazy" />
                  ) : (
                    <ImageOff className="mx-auto h-4 w-4 text-muted-foreground/40" />
                  )}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {loc.curation_level ? getCurationLabel(loc.curation_level) : '-'}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {loc.created_at ? new Date(loc.created_at).toLocaleDateString('ko-KR') : '-'}
                </TableCell>
                <TableCell>
                  <Link href={`/places/${loc.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 {totalCount}개 중 {(page - 1) * perPage + 1}-{Math.min(page * perPage, totalCount)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
