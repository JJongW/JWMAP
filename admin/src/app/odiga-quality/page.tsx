import { AdminLayout } from '@/components/layout/AdminLayout';
import { FilterBar } from '@/components/odiga-quality/FilterBar';
import { HeroSection } from '@/components/odiga-quality/HeroSection';
import { FirstMatchCard } from '@/components/odiga-quality/FirstMatchCard';
import { TrustEngagementCard } from '@/components/odiga-quality/TrustEngagementCard';
import { IntentMatchTable } from '@/components/odiga-quality/IntentMatchTable';
import { CourseQualityCard } from '@/components/odiga-quality/CourseQualityCard';
import { FrictionScoreCard } from '@/components/odiga-quality/FrictionScoreCard';
import { DBPressureTable } from '@/components/odiga-quality/DBPressureTable';
import { AlertPanel } from '@/components/odiga-quality/AlertPanel';
import { getQualityData, parseFilters } from '@/lib/queries/odiga-quality';

interface PageProps {
  searchParams: Promise<{
    period?: string;
    region?: string;
    response_type?: string;
    activity_type?: string;
  }>;
}

export default async function OdigaQualityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const data = await getQualityData(filters);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Quality Console</h1>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.dateRange.from.slice(0, 10)} ~ {data.dateRange.to.slice(0, 10)}
          </span>
        </div>

        {/* Sticky Filter Bar */}
        <FilterBar
          period={filters.period}
          region={filters.region}
          response_type={filters.response_type}
          activity_type={filters.activity_type}
        />

        {/* OQS Hero */}
        <HeroSection oqs={data.oqs} totalSearches={data.totalSearches} />

        {/* Row 1: First Match + Trust */}
        <div className="grid gap-4 md:grid-cols-2">
          <FirstMatchCard data={data.firstMatch} />
          <TrustEngagementCard data={data.trust} />
        </div>

        {/* Intent Match Table (full width) */}
        <IntentMatchTable rows={data.intents} />

        {/* Row 2: Course Quality + Friction */}
        <div className="grid gap-4 md:grid-cols-2">
          <CourseQualityCard data={data.course} />
          <FrictionScoreCard data={data.friction} />
        </div>

        {/* DB Pressure (full width) */}
        <DBPressureTable rows={data.dbPressure} />
      </div>

      {/* Alert Panel (fixed, client component) */}
      <AlertPanel alerts={data.alerts} />
    </AdminLayout>
  );
}
