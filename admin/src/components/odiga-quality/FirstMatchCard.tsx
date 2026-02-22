'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MetricCard } from './MetricCard';
import type { FirstMatchMetrics } from '@/types/odiga-quality';

interface FirstMatchCardProps {
  data: FirstMatchMetrics;
}

export function FirstMatchCard({ data }: FirstMatchCardProps) {
  const chartData = [
    { label: '0회', count: data.distribution.zero, fill: '#FF8A3D' },
    { label: '1회', count: data.distribution.one, fill: '#FFBB85' },
    { label: '2+회', count: data.distribution.twoPlus, fill: '#E5E7EB' },
  ];

  return (
    <MetricCard
      title="First Match Quality"
      explanation="처음 추천이 사용자를 만족시킨 비율"
    >
      <div className="flex flex-col gap-4">
        {/* Big number */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            재추천 없음
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tabular-nums text-orange-500">
              {data.zeroRerollRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">첫 결과 선택률</p>
            <p className="font-semibold tabular-nums mt-0.5">{data.firstSelectRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-medium">평균 재추천</p>
            <p className="font-semibold tabular-nums mt-0.5">{data.avgRerollCount.toFixed(2)}회</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={36} barCategoryGap="30%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(v) => [v, '세션']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                cursor={{ fill: '#F9FAFB' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </MetricCard>
  );
}
