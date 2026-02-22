'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricCard } from './MetricCard';
import type { FrictionMetrics } from '@/types/odiga-quality';

interface FrictionScoreCardProps {
  data: FrictionMetrics;
}

export function FrictionScoreCard({ data }: FrictionScoreCardProps) {
  const donutData = [
    { name: '지역 누락', value: Math.round(data.regionMissingRate), fill: '#FF8A3D' },
    { name: '지역 있음', value: Math.round(100 - data.regionMissingRate), fill: '#F3F4F6' },
  ];

  return (
    <MetricCard
      title="Friction Score"
      explanation="사용자의 의사결정 마찰과 UX 불편 감지"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          {/* Donut chart */}
          <div className="h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={48}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [v != null ? `${v}%` : '-', '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Right side metrics */}
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">지역 누락률</p>
              <p
                className={`text-xl font-bold tabular-nums mt-0.5 ${data.regionMissingRate > 30 ? 'text-orange-500' : 'text-foreground'}`}
              >
                {data.regionMissingRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">미선택 세션율</p>
              <p className={`text-xl font-bold tabular-nums mt-0.5 ${data.noSelectionRate > 50 ? 'text-amber-500' : 'text-foreground'}`}>
                {data.noSelectionRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">파싱 오류율</p>
              <p
                className={`text-xl font-bold tabular-nums mt-0.5 ${data.parseErrorRate > 20 ? 'text-red-500' : 'text-foreground'}`}
              >
                {data.parseErrorRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Parse error breakdown */}
        {data.parseErrorBreakdown.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">파싱 오류 필드 분포</p>
            <div className="space-y-1.5">
              {data.parseErrorBreakdown.map((item) => (
                <div key={item.field} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{item.field}</span>
                  <span className="font-semibold tabular-nums">{item.count}건</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MetricCard>
  );
}
