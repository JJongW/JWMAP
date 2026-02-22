import { MetricCard } from './MetricCard';
import type { TrustMetrics } from '@/types/odiga-quality';

interface TrustEngagementCardProps {
  data: TrustMetrics;
}

function ProgressRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={emphasis ? 'text-sm font-semibold' : 'text-xs text-muted-foreground'}>
          {label}
        </span>
        <span className={emphasis ? 'text-lg font-bold tabular-nums' : 'text-sm font-medium tabular-nums'}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all bg-orange-400"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export function TrustEngagementCard({ data }: TrustEngagementCardProps) {
  return (
    <MetricCard
      title="Trust & Engagement"
      explanation="사용자가 추천을 얼마나 신뢰하고 행동했는지"
    >
      <div className="flex flex-col gap-5 pt-1">
        <ProgressRow label="선택/저장률 (Save Rate)" value={data.saveRate} emphasis />
        <ProgressRow label="피드백 참여율" value={data.engagementRate} />
        <ProgressRow label="코스 완료율" value={data.courseCompletionRate} />
      </div>
    </MetricCard>
  );
}
