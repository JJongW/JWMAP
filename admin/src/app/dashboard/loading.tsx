import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ''}`} />;
}

export default function AnalyticsLoading() {
  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Sk className="h-7 w-44" />
            <Sk className="h-3 w-64" />
          </div>
          <Sk className="h-3 w-36" />
        </div>

        {/* Filter bar */}
        <div className="flex gap-2">
          <Sk className="h-9 w-52 rounded-lg" />
          <Sk className="h-9 w-32 rounded-lg" />
          <Sk className="h-9 w-32 rounded-lg" />
        </div>

        {/* Hero */}
        <Card className="shadow-sm rounded-xl border-gray-100">
          <CardContent className="px-5 py-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="space-y-2">
                <Sk className="h-3 w-24" />
                <Sk className="h-20 w-32" />
                <Sk className="h-3 w-16" />
              </div>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Sk key={i} className="h-20 w-36 rounded-xl" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section divider + 2-col */}
        <Sk className="h-3 w-28" />
        <div className="grid gap-4 md:grid-cols-2">
          <Sk className="h-52 rounded-xl" />
          <Sk className="h-52 rounded-xl" />
        </div>

        {/* Section divider + full-width table */}
        <Sk className="h-3 w-20" />
        <Sk className="h-56 rounded-xl" />

        {/* Section divider + 2-col */}
        <Sk className="h-3 w-36" />
        <div className="grid gap-4 md:grid-cols-2">
          <Sk className="h-52 rounded-xl" />
          <Sk className="h-52 rounded-xl" />
        </div>

        {/* Section divider + coverage mini-cards + chart + pressure table */}
        <Sk className="h-3 w-32" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Sk key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Sk className="h-44 rounded-xl" />
        <Sk className="h-48 rounded-xl" />
      </div>
    </AdminLayout>
  );
}
