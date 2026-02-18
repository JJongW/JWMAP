import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAutomationTrendReports, type AutomationTrendReport } from '@/lib/queries/automation';

type PlaceItem = { name?: string; mention_count?: number; confidence?: number };
type KeywordItem = { keyword?: string; count?: number };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toToneDistribution(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const raw = (value as { tone_distribution?: unknown }).tone_distribution;
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v as number]);
  return Object.fromEntries(entries);
}

function getCompetitorSummary(report: AutomationTrendReport): string[] {
  const direct = report.competitor_engagement_summary;
  if (Array.isArray(direct)) return direct.map((v) => String(v));
  if (typeof direct === 'string') return [direct];

  const tone = report.tone_analysis;
  if (tone && typeof tone === 'object') {
    const summary = (tone as Record<string, unknown>).competitor_engagement_summary;
    if (Array.isArray(summary)) return summary.map((v) => String(v));
    if (typeof summary === 'string') return [summary];
  }

  const platforms = report.platforms;
  if (platforms && typeof platforms === 'object') {
    return Object.entries(platforms as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `${k}: ${v}`);
  }
  return [];
}

export default async function AutomationTrendReportsPage() {
  const reports = await getAutomationTrendReports(20);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Automation · Trend Reports</h1>
          <Link href="/automation" className="text-sm text-muted-foreground hover:underline">
            ← Automation
          </Link>
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              daily_trend_reports 데이터가 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const topPlaces = asArray<PlaceItem>(report.places).slice(0, 5);
              const keywords = asArray<KeywordItem>(report.top_keywords).slice(0, 12);
              const toneDistribution = toToneDistribution(report.tone_analysis);
              const competitorSummary = getCompetitorSummary(report);

              return (
                <Card key={report.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {report.report_date} · {report.region || '미지정'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div>
                        <h3 className="mb-2 text-sm font-medium">Top Places</h3>
                        {topPlaces.length === 0 ? (
                          <p className="text-xs text-muted-foreground">데이터 없음</p>
                        ) : (
                          <div className="space-y-1">
                            {topPlaces.map((place, idx) => (
                              <div key={`${place.name}-${idx}`} className="text-sm">
                                <span>{place.name || '-'}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {place.mention_count ?? 0}회 · {Math.round((place.confidence ?? 0) * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-medium">Keywords</h3>
                        {keywords.length === 0 ? (
                          <p className="text-xs text-muted-foreground">데이터 없음</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {keywords.map((kw, idx) => (
                              <Badge key={`${kw.keyword}-${idx}`} variant="secondary" className="text-xs">
                                {kw.keyword}
                                <span className="ml-1 text-muted-foreground">{kw.count ?? 0}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-medium">Tone Distribution</h3>
                        {Object.keys(toneDistribution).length === 0 ? (
                          <p className="text-xs text-muted-foreground">데이터 없음</p>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(toneDistribution).map(([tone, score]) => (
                              <div key={tone} className="flex items-center justify-between text-sm">
                                <span>{tone}</span>
                                <span className="text-xs text-muted-foreground">{score}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-medium">Competitor Engagement Summary</h3>
                        {competitorSummary.length === 0 ? (
                          <p className="text-xs text-muted-foreground">데이터 없음</p>
                        ) : (
                          <ul className="space-y-1 text-sm text-foreground">
                            {competitorSummary.slice(0, 6).map((line, idx) => (
                              <li key={`${line}-${idx}`}>• {line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
