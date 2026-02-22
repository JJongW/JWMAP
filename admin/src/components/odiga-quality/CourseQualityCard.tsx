'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from './MetricCard';
import type { CourseMetrics } from '@/types/odiga-quality';

interface CourseQualityCardProps {
  data: CourseMetrics;
}

export function CourseQualityCard({ data }: CourseQualityCardProps) {
  return (
    <MetricCard
      title="Course Quality"
      explanation="큐레이션된 코스의 스토리텔링 효과 평가"
    >
      <div className="flex flex-col gap-4">
        {/* Primary metric */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            코스 선택률
          </p>
          <span className="text-5xl font-bold tabular-nums text-orange-500">
            {data.selectionRate.toFixed(1)}%
          </span>
        </div>

        {/* Secondary metrics */}
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">코스 요청수</p>
            <p className="font-semibold tabular-nums mt-0.5">{data.requestCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">저장률</p>
            <p className="font-semibold tabular-nums mt-0.5">{data.saveRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">평균 재추천</p>
            <p className="font-semibold tabular-nums mt-0.5">{data.avgReroll.toFixed(2)}회</p>
          </div>
        </div>

        {/* Trend area chart */}
        {data.selectionTrend.length > 1 ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.selectionTrend}>
                <defs>
                  <linearGradient id="orangeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF8A3D" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FF8A3D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                  width={32}
                />
                <Tooltip
                  formatter={(v) => [v != null ? `${v}%` : '-', '선택률']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#FF8A3D"
                  strokeWidth={2}
                  fill="url(#orangeAreaGrad)"
                  dot={{ r: 3, fill: '#FF8A3D', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#FF8A3D', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">트렌드 표시를 위한 데이터 부족</p>
        )}
      </div>
    </MetricCard>
  );
}
