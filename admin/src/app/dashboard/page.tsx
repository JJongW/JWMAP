import { AdminLayout } from '@/components/layout/AdminLayout';
import { FilterBar } from '@/components/odiga-quality/FilterBar';
import { HeroSection } from '@/components/odiga-quality/HeroSection';
import { FirstMatchCard } from '@/components/odiga-quality/FirstMatchCard';
import { TrustEngagementCard } from '@/components/odiga-quality/TrustEngagementCard';
import { IntentMatchTable } from '@/components/odiga-quality/IntentMatchTable';
import { CourseQualityCard } from '@/components/odiga-quality/CourseQualityCard';
import { FrictionScoreCard } from '@/components/odiga-quality/FrictionScoreCard';
import { DBCoverageSection } from '@/components/odiga-quality/DBCoverageSection';
import { AlertPanel } from '@/components/odiga-quality/AlertPanel';
import { getQualityData, parseFilters } from '@/lib/queries/odiga-quality';
import { getDashboardData } from '@/lib/queries/dashboard';

interface PageProps {
  searchParams: Promise<{
    period?: string;
    region?: string;
    response_type?: string;
    activity_type?: string;
  }>;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const [quality, db] = await Promise.all([
    getQualityData(filters),
    getDashboardData(),
  ]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Odiga Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              추천 품질 및 DB 현황 · odiga {quality.totalSearches.toLocaleString()}회 검색 기준
            </p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {quality.dateRange.from.slice(0, 10)} ~ {quality.dateRange.to.slice(0, 10)}
          </span>
        </div>

        {/* 1. Global Filter Bar */}
        <FilterBar
          period={filters.period}
          region={filters.region}
          response_type={filters.response_type}
          activity_type={filters.activity_type}
        />

        {/* 2. Hero — OQS + sub-metrics */}
        <HeroSection oqs={quality.oqs} totalSearches={quality.totalSearches} />

        {/* 3. Recommendation Experience */}
        <SectionDivider label="추천 경험 품질" />
        <div className="grid gap-4 md:grid-cols-2">
          <FirstMatchCard data={quality.firstMatch} />
          <TrustEngagementCard data={quality.trust} />
        </div>

        {/* 4. Intent Match Table (full width) */}
        <SectionDivider label="인텐트 매칭" />
        <IntentMatchTable rows={quality.intents} />

        {/* 5. Course Quality + Friction */}
        <SectionDivider label="코스 큐레이션 및 마찰" />
        <div className="grid gap-4 md:grid-cols-2">
          <CourseQualityCard data={quality.course} />
          <FrictionScoreCard data={quality.friction} />
        </div>

        {/* 6. DB Pressure & Coverage */}
        <SectionDivider label="DB 압력 및 커버리지" />
        <DBCoverageSection db={db} pressure={quality.dbPressure} />
      </div>

      {/* 7. Alert Panel (fixed bottom-right, client component) */}
      <AlertPanel alerts={quality.alerts} />
    </AdminLayout>
  );
}
