import { getTrendReports } from '@/lib/queries/content-engine';
import type { PlaceTrend, KeywordTrend } from '@/lib/queries/content-engine';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const CATEGORY_LABEL: Record<string, string> = {
  cafe: '카페',
  restaurant: '음식점',
  bar: '바',
  shop: '상점',
  gallery: '갤러리',
  other: '기타',
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function TrendsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 7;
  const offset = (page - 1) * limit;

  const { reports, total } = await getTrendReports({ limit, offset });
  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">트렌드 리포트</h1>
          <Link
            href="/content-engine"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 콘텐츠 엔진
          </Link>
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              아직 트렌드 리포트가 없습니다. 엔진이 실행되면 자동으로 생성됩니다.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {report.report_date}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {report.region}
                      </span>
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {report.total_posts_analyzed}개 게시물 분석
                      {report.platforms && (
                        <span className="ml-2">
                          (IG: {report.platforms.instagram ?? 0}, Threads: {report.platforms.threads ?? 0})
                        </span>
                      )}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* 인기 장소 */}
                    <div>
                      <h3 className="mb-2 text-sm font-medium">인기 장소</h3>
                      {(report.places as PlaceTrend[])?.length > 0 ? (
                        <div className="space-y-2">
                          {(report.places as PlaceTrend[]).slice(0, 5).map((place, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span>{place.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {CATEGORY_LABEL[place.category] ?? place.category}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(place.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">데이터 없음</p>
                      )}
                    </div>

                    {/* 키워드 */}
                    <div>
                      <h3 className="mb-2 text-sm font-medium">인기 키워드</h3>
                      {(report.top_keywords as KeywordTrend[])?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(report.top_keywords as KeywordTrend[]).slice(0, 12).map((kw, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {kw.keyword}
                              <span className="ml-1 text-muted-foreground">{kw.count}</span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">데이터 없음</p>
                      )}
                    </div>

                    {/* 톤 분석 */}
                    <div>
                      <h3 className="mb-2 text-sm font-medium">분위기</h3>
                      {report.tone_analysis?.dominant_tone ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{report.tone_analysis.dominant_tone}</p>
                          {report.tone_analysis.trending_expressions?.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">자주 쓰이는 표현:</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {report.tone_analysis.trending_expressions.slice(0, 6).map((expr, i) => (
                                  <span key={i} className="text-xs text-sky-600">{expr}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {report.tone_analysis.emoji_trends?.length > 0 && (
                            <p className="text-sm">
                              {report.tone_analysis.emoji_trends.slice(0, 8).join(' ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">데이터 없음</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/content-engine/trends?page=${p}`}
                className={`rounded px-3 py-1 text-sm ${
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
