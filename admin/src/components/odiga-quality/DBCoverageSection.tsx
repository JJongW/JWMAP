import type { ElementType } from 'react';
import Link from 'next/link';
import { MapPin, Landmark, Tags, ImageOff, Bookmark, Search, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DBPressureTable } from './DBPressureTable';
import type { DBPressureRow } from '@/types/odiga-quality';

interface ActivityPoint {
  date: string;
  label: string;
  webSearches: number;
  clicks: number;
  odigaSearches: number;
}

interface DBCoverageSectionProps {
  db: {
    total: number;
    noTagsCount: number;
    noImageCount: number;
    attractionsTotal: number;
    attractionsNoTagsCount: number;
    activityTotals: {
      webSearches: number;
      clicks: number;
      odigaSearches: number;
      savedCourses: number;
    };
    activitySeries: ActivityPoint[];
  };
  pressure: DBPressureRow[];
}

function CoverageCard({
  icon: Icon,
  label,
  value,
  note,
  href,
  accent = false,
}: {
  icon: ElementType;
  label: string;
  value: number | string;
  note?: string;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <Card
      className={`shadow-sm rounded-xl border-gray-100 bg-white h-full ${
        href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <div className="px-4 pt-4 pb-0.5 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <CardContent className="px-4 pb-4">
        <div className={`text-2xl font-bold ${accent ? 'text-orange-500' : ''}`}>{value}</div>
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function getMaxValue(series: ActivityPoint[]): number {
  const max = Math.max(...series.flatMap((d) => [d.webSearches, d.clicks, d.odigaSearches]));
  return max > 0 ? max : 1;
}

export function DBCoverageSection({ db, pressure }: DBCoverageSectionProps) {
  const graphMax = getMaxValue(db.activitySeries);

  return (
    <div className="space-y-4">
      {/* Row 1: DB Coverage — locations + attractions */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <CoverageCard
          icon={MapPin}
          label="맛집 / 카페"
          value={db.total.toLocaleString()}
          note="locations 테이블"
        />
        <CoverageCard
          icon={Landmark}
          label="볼거리"
          value={db.attractionsTotal.toLocaleString()}
          note="attractions 테이블"
        />
        <CoverageCard
          icon={Tags}
          label="태그 없음 (맛집)"
          value={db.noTagsCount}
          note="클릭해서 확인 →"
          href="/locations/incomplete?filter=no_tags"
          accent={db.noTagsCount > 0}
        />
        <CoverageCard
          icon={ImageOff}
          label="이미지 없음"
          value={db.noImageCount}
          note="클릭해서 확인 →"
          href="/locations/incomplete?filter=no_image"
          accent={db.noImageCount > 0}
        />
      </div>

      {/* Row 2: Activity totals */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <CoverageCard
          icon={Tags}
          label="태그 없음 (볼거리)"
          value={db.attractionsNoTagsCount}
          accent={db.attractionsNoTagsCount > 0}
          note="attractions 미태깅"
        />
        <CoverageCard
          icon={Search}
          label="웹 검색 (14일)"
          value={db.activityTotals.webSearches.toLocaleString()}
        />
        <CoverageCard
          icon={Activity}
          label="odiga 검색 (14일)"
          value={db.activityTotals.odigaSearches.toLocaleString()}
        />
        <CoverageCard
          icon={Bookmark}
          label="저장된 코스"
          value={db.activityTotals.savedCourses.toLocaleString()}
        />
      </div>

      {/* Activity trend chart (14 days) */}
      <Card className="shadow-sm rounded-xl border-gray-100 bg-white">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">활동 추이 (14일)</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">웹 검색 · 클릭 · odiga CLI 검색 일별 추이</p>
        </div>
        <CardContent className="px-5 pb-5">
          <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-sky-400" />웹 검색
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" />클릭
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-orange-400" />odiga
            </div>
          </div>
          <div className="flex items-end gap-1 overflow-x-auto pb-1">
            {db.activitySeries.map((d) => (
              <div key={d.date} className="flex min-w-8 flex-col items-center gap-1.5">
                <div className="flex h-24 items-end gap-0.5">
                  <div
                    className="w-1.5 rounded-t bg-sky-400"
                    style={{
                      height: `${(d.webSearches / graphMax) * 100}%`,
                      minHeight: d.webSearches > 0 ? 2 : 0,
                    }}
                    title={`웹 검색 ${d.webSearches}`}
                  />
                  <div
                    className="w-1.5 rounded-t bg-emerald-400"
                    style={{
                      height: `${(d.clicks / graphMax) * 100}%`,
                      minHeight: d.clicks > 0 ? 2 : 0,
                    }}
                    title={`클릭 ${d.clicks}`}
                  />
                  <div
                    className="w-1.5 rounded-t bg-orange-400"
                    style={{
                      height: `${(d.odigaSearches / graphMax) * 100}%`,
                      minHeight: d.odigaSearches > 0 ? 2 : 0,
                    }}
                    title={`odiga ${d.odigaSearches}`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DB Pressure Table */}
      <DBPressureTable rows={pressure} />
    </div>
  );
}
