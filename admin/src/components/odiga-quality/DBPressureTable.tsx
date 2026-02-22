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
import type { DBPressureRow } from '@/types/odiga-quality';

interface DBPressureTableProps {
  rows: DBPressureRow[];
}

function PressureBar({ score, status }: { score: number; status: DBPressureRow['status'] }) {
  const pct = Math.min(100, (score / 6) * 100);
  const barColor =
    status === 'ok' ? 'bg-emerald-400' : status === 'warn' ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={cn(
          'font-mono text-xs font-semibold tabular-nums',
          status === 'ok' ? 'text-emerald-700' : status === 'warn' ? 'text-orange-600' : 'text-red-600',
        )}
      >
        {score.toFixed(1)}x
      </span>
    </div>
  );
}

export function DBPressureTable({ rows }: DBPressureTableProps) {
  return (
    <Card className="shadow-sm rounded-xl border-gray-100 bg-white">
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">DB Pressure Heatmap</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          지역별 요청 수 / 장소 수 = 압력 지수 — 4.0 이상 시 장소 보강 필요
        </p>
      </div>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">데이터 없음</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 bg-gray-50/60">
                <TableHead className="pl-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">지역</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">요청수</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">장소수</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">압력 지수</TableHead>
                <TableHead className="text-right pr-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.region}
                  className={cn(
                    'border-gray-100 text-sm hover:bg-gray-50/50',
                    row.status === 'critical' && 'bg-red-50/50',
                  )}
                >
                  <TableCell className="pl-5 font-medium">{row.region}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.requestCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.placeCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <PressureBar score={row.pressureScore} status={row.status} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        row.status === 'ok' ? 'text-emerald-700' : row.status === 'warn' ? 'text-orange-600' : 'text-red-600',
                      )}
                    >
                      {row.status === 'ok' ? '정상' : row.status === 'warn' ? '주의' : '위험'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
