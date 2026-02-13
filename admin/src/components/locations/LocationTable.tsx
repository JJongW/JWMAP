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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  InlinePriceLevelCell,
  InlineCurationLevelCell,
  InlineTagsCell,
} from './InlineEditableCells';

interface Props {
  locations: Location[];
  totalCount: number;
  page: number;
  perPage: number;
  allTags: Tag[];
  locationTagsByLocId: Record<string, LocationTag[]>;
}

export function LocationTable({
  locations,
  totalCount,
  page,
  perPage,
  allTags,
  locationTagsByLocId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(totalCount / perPage);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', p.toString());
    router.push(`/locations?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">장소명</TableHead>
              <TableHead>지역</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead className="text-center">가격대</TableHead>
              <TableHead className="text-center">큐레이션</TableHead>
              <TableHead className="min-w-[140px]">태그</TableHead>
              <TableHead className="text-right">수정일</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  장소가 없습니다
                </TableCell>
              </TableRow>
            )}
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">
                  <Link href={`/locations/${loc.id}`} className="hover:underline">
                    {loc.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{loc.region}</TableCell>
                <TableCell>
                  {loc.category_main && (
                    <Badge variant="secondary">{loc.category_main}</Badge>
                  )}
                  {loc.category_sub && (
                    <Badge variant="outline" className="ml-1">{loc.category_sub}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <InlinePriceLevelCell location={loc} />
                </TableCell>
                <TableCell className="text-center text-xs">
                  <InlineCurationLevelCell location={loc} />
                </TableCell>
                <TableCell>
                  <InlineTagsCell
                    location={loc}
                    locationTags={locationTagsByLocId[loc.id] ?? []}
                    allTags={allTags}
                  />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {loc.created_at ? new Date(loc.created_at).toLocaleDateString('ko-KR') : '-'}
                </TableCell>
                <TableCell>
                  <Link href={`/locations/${loc.id}`}>
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
