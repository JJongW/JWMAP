import { cn } from '@/lib/utils';
import type { OQSMetrics } from '@/types/odiga-quality';

interface SubMetric {
  label: string;
  value: number;
  unit: string;
  explanation: string;
  higherIsBetter: boolean;
}

interface HeroSectionProps {
  oqs: OQSMetrics;
  totalSearches: number;
}

function SubMetricCard({ metric }: { metric: SubMetric }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3 min-w-[140px]">
      <span className="text-[10px] font-semibold text-orange-600/80 uppercase tracking-wider">
        {metric.label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {metric.value.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">{metric.unit}</span>
      </div>
      <span className="text-[11px] text-muted-foreground leading-tight">{metric.explanation}</span>
    </div>
  );
}

export function HeroSection({ oqs, totalSearches }: HeroSectionProps) {
  const deltaPositive = oqs.delta >= 0;

  const subMetrics: SubMetric[] = [
    {
      label: 'First Match Quality',
      value: oqs.fmq,
      unit: '%',
      explanation: '첫 추천으로 만족한 비율',
      higherIsBetter: true,
    },
    {
      label: 'Trust Index',
      value: oqs.trustIndex,
      unit: '%',
      explanation: '장소/코스를 선택한 비율',
      higherIsBetter: true,
    },
    {
      label: 'Course Completion',
      value: oqs.courseCompletion,
      unit: '%',
      explanation: '코스 모드 선택 완료율',
      higherIsBetter: true,
    },
    {
      label: 'Friction Score',
      value: oqs.frictionScore,
      unit: '%',
      explanation: '파싱 오류 + 지역 누락 평균',
      higherIsBetter: false,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 mb-1">
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        {/* Main OQS number */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Odiga Quality Score
          </span>
          <div className="flex items-end gap-3">
            <span className="text-7xl font-bold tabular-nums leading-none text-orange-500">
              {oqs.oqs}
            </span>
            <div className="flex flex-col gap-1 pb-1">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                  deltaPositive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600',
                )}
              >
                {deltaPositive ? '+' : ''}{oqs.delta.toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">vs 이전 기간</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {totalSearches.toLocaleString()}건 분석
          </span>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px self-stretch bg-gray-100 mx-2" />

        {/* Sub-metrics */}
        <div className="flex flex-wrap gap-3 flex-1">
          {subMetrics.map((m) => (
            <SubMetricCard key={m.label} metric={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
