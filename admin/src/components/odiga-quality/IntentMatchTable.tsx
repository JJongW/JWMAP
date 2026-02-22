import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { IntentRow } from '@/types/odiga-quality';

const STATUS_CONFIG = {
  healthy: {
    label: '정상',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
  },
  watch: {
    label: '주의',
    dotClass: 'bg-orange-400',
    textClass: 'text-orange-600',
  },
  needs_improvement: {
    label: '개선 필요',
    dotClass: 'bg-red-500',
    textClass: 'text-red-600',
  },
};

interface IntentMatchTableProps {
  rows: IntentRow[];
}

export function IntentMatchTable({ rows }: IntentMatchTableProps) {
  if (rows.length === 0) {
    return (
      <Card className="shadow-sm rounded-xl border-gray-100 bg-white">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Intent Match Quality</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">활동 유형별 추천 품질 지표</p>
        </div>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">데이터 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm rounded-xl border-gray-100 bg-white">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Intent Match Quality</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          활동 유형별 추천 품질 — FMQ ≥ 70% + 선택률 ≥ 30% = 정상
        </p>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 bg-gray-50/60">
              <TableHead className="pl-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Intent</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">요청수</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">FMQ</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">선택률</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">재추천률</TableHead>
              <TableHead className="text-right pr-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const status = STATUS_CONFIG[row.status];
              return (
                <TableRow key={row.intent} className="border-gray-100 text-sm hover:bg-gray-50/50">
                  <TableCell className="pl-5 font-medium">{row.intent}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.requestCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={cn(
                        'font-semibold',
                        row.fmq >= 70
                          ? 'text-emerald-700'
                          : row.fmq >= 50
                            ? 'text-orange-500'
                            : 'text-red-600',
                      )}
                    >
                      {row.fmq}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.saveRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.rerollRate}%</TableCell>
                  <TableCell className="text-right pr-5">
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', status.textClass)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', status.dotClass)} />
                      {status.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
