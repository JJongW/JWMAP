import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface MetricCardProps {
  title: string;
  explanation?: string;
  children: React.ReactNode;
  className?: string;
  detailsHref?: string;
}

export function MetricCard({ title, explanation, children, className, detailsHref }: MetricCardProps) {
  return (
    <Card className={cn('flex flex-col shadow-sm rounded-xl border-gray-100 bg-white', className)}>
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          {explanation && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{explanation}</p>
          )}
        </div>
        {detailsHref && (
          <Link
            href={detailsHref}
            className="text-xs text-muted-foreground hover:text-orange-500 transition-colors shrink-0 ml-3 mt-0.5"
          >
            Details →
          </Link>
        )}
      </div>
      <CardContent className="flex-1 px-5 pb-5">{children}</CardContent>
    </Card>
  );
}
