'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Tags, ImageOff, AlertTriangle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IncompleteLocation {
  id: string;
  name: string;
  region: string;
  category_main: string | null;
  category_sub: string | null;
  hasTags: boolean;
  hasImage: boolean;
  tagCount: number;
  imageUrl: string;
  created_at: string;
}

interface Props {
  locations: IncompleteLocation[];
  currentFilter: string;
}

const FILTER_TABS = [
  { key: 'both', label: '전체 미완성', icon: AlertTriangle },
  { key: 'no_tags', label: '태그 없음', icon: Tags },
  { key: 'no_image', label: '이미지 없음', icon: ImageOff },
] as const;

export function IncompleteList({ locations, currentFilter }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/locations">
          <Button type="button" variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">데이터 품질 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            태그나 이미지가 없는 장소를 빠르게 수정하세요
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-3">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'both'
            ? locations.length
            : tab.key === 'no_tags'
              ? locations.filter((l) => !l.hasTags).length
              : locations.filter((l) => !l.hasImage).length;

          // For the "both" filter, show totals from the full list
          const displayCount = tab.key === currentFilter
            ? locations.length
            : count;

          return (
            <Card
              key={tab.key}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                currentFilter === tab.key && 'ring-2 ring-primary'
              )}
              onClick={() => router.push(`/locations/incomplete?filter=${tab.key}`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tab.label}
                </CardTitle>
                <tab.icon className={cn(
                  'h-4 w-4',
                  currentFilter === tab.key ? 'text-primary' : 'text-muted-foreground'
                )} />
              </CardHeader>
              <CardContent>
                <div className={cn(
                  'text-3xl font-bold',
                  displayCount > 0 ? 'text-amber-600' : 'text-green-600'
                )}>
                  {displayCount}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">장소명</TableHead>
              <TableHead>지역</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead className="text-center">태그</TableHead>
              <TableHead className="text-center">이미지</TableHead>
              <TableHead className="text-right">등록일</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 text-green-500" />
                    <p className="font-medium text-green-600">모든 장소의 데이터가 완성되었습니다!</p>
                  </div>
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
                <TableCell className="text-muted-foreground text-sm">{loc.region}</TableCell>
                <TableCell>
                  {loc.category_main && (
                    <Badge variant="secondary" className="text-xs">{loc.category_main}</Badge>
                  )}
                  {loc.category_sub && (
                    <Badge variant="outline" className="ml-1 text-xs">{loc.category_sub}</Badge>
                  )}
                  {!loc.category_main && (
                    <span className="text-xs text-muted-foreground">미지정</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {loc.hasTags ? (
                    <Badge variant="secondary" className="text-xs">{loc.tagCount}개</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">없음</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {loc.hasImage ? (
                    <Badge variant="secondary" className="text-xs">있음</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">없음</Badge>
                  )}
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

      {locations.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          총 {locations.length}개 장소에 누락된 데이터가 있습니다
        </p>
      )}
    </div>
  );
}
