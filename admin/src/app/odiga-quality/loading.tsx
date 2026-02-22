import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />;
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3 pt-2">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OdigaQualityLoading() {
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-3 py-3 border-b mb-2">
          {[28, 32, 28].map((w, i) => (
            <Skeleton key={i} className={`h-8 w-${w}`} />
          ))}
        </div>

        {/* Hero skeleton */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-20 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-wrap gap-3 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-36 rounded-lg" />
              ))}
            </div>
          </div>
        </Card>

        {/* Row 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
        </div>

        {/* Intent table */}
        <SkeletonCard rows={5} />

        {/* Row 2 */}
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={4} />
        </div>

        {/* DB Pressure */}
        <SkeletonCard rows={6} />
      </div>
    </AdminLayout>
  );
}
