import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAutomationStats } from '@/lib/queries/automation';
import { FileText, TrendingUp, Sparkles } from 'lucide-react';

export default async function AutomationPage() {
  const stats = await getAutomationStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Automation</h1>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/automation/trend-reports">
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Trend Reports</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.trendReportCount}</div>
                <p className="mt-1 text-xs text-muted-foreground">daily_trend_reports 보기</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/automation/place-candidates">
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Place Candidates</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.pendingCandidateCount}</div>
                <p className="mt-1 text-xs text-muted-foreground">pending 후보 검토</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/automation/drafts">
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Drafts</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.draftCount}</div>
                <p className="mt-1 text-xs text-muted-foreground">generated_drafts 관리</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
