import {
  getContentEngineStats,
  getDrafts,
  getTrendReports,
  getPendingPlaceCandidates,
} from '@/lib/queries/content-engine';
import type { PlaceTrend, KeywordTrend } from '@/lib/queries/content-engine';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DraftActions } from './DraftActions';
import { CandidateActions } from './CandidateActions';
import Link from 'next/link';

// ── 상수 ────────────────────────────────────────────────────

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: '🌅 오전',
  lunch: '☀️ 점심',
  evening: '🌙 저녁',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  approved: 'default',
  published: 'outline',
  rejected: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  approved: '승인됨',
  published: '발행됨',
  rejected: '반려',
};

const CATEGORY_LABEL: Record<string, string> = {
  cafe: '카페',
  restaurant: '음식점',
  bar: '바',
  shop: '상점',
  gallery: '갤러리',
  other: '기타',
};

// ── 페이지 ───────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function ContentEnginePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab ?? 'drafts';
  const status = params.status;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 12;
  const offset = (page - 1) * limit;

  // 탭 배지용 통계 + 탭별 데이터 병렬 페칭
  const [stats, tabData] = await Promise.all([
    getContentEngineStats(),
    tab === 'drafts'
      ? getDrafts({ status, limit, offset })
      : tab === 'trends'
        ? getTrendReports({ limit: 10, offset })
        : getPendingPlaceCandidates(200),
  ]);

  const drafts =
    tab === 'drafts' ? (tabData as Awaited<ReturnType<typeof getDrafts>>).drafts : [];
  const draftTotal =
    tab === 'drafts' ? (tabData as Awaited<ReturnType<typeof getDrafts>>).total : 0;
  const reports =
    tab === 'trends' ? (tabData as Awaited<ReturnType<typeof getTrendReports>>).reports : [];
  const reportTotal =
    tab === 'trends' ? (tabData as Awaited<ReturnType<typeof getTrendReports>>).total : 0;
  const candidates =
    tab === 'candidates'
      ? (tabData as Awaited<ReturnType<typeof getPendingPlaceCandidates>>)
      : [];

  const totalPages =
    tab === 'drafts'
      ? Math.ceil(draftTotal / limit)
      : tab === 'trends'
        ? Math.ceil(reportTotal / 10)
        : 1;

  function tabHref(t: string) {
    return `/content-engine?tab=${t}`;
  }

  function statusHref(s?: string) {
    return s ? `/content-engine?tab=drafts&status=${s}` : `/content-engine?tab=drafts`;
  }

  function pageHref(p: number) {
    const s = status ? `&status=${status}` : '';
    return `/content-engine?tab=${tab}${s}&page=${p}`;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <h1 className="text-2xl font-bold">콘텐츠 엔진</h1>

        {/* 탭 바 */}
        <div className="flex gap-1 border-b">
          {[
            {
              key: 'drafts',
              label: '초안 관리',
              badge: stats.pendingDrafts > 0 ? stats.pendingDrafts : null,
            },
            { key: 'trends', label: '트렌드 리포트', badge: null },
            { key: 'candidates', label: '장소 후보', badge: null },
          ].map(({ key, label, badge }) => (
            <Link
              key={key}
              href={tabHref(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {badge !== null && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  {badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* ── tab=drafts ───────────────────────────────────── */}
        {tab === 'drafts' && (
          <>
            {/* 상태 필터 pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: '전체', value: undefined },
                { label: '검토 대기', value: 'draft' },
                { label: '승인됨', value: 'approved' },
                { label: '발행됨', value: 'published' },
                { label: '반려', value: 'rejected' },
              ].map((pill) => (
                <Link
                  key={pill.label}
                  href={statusHref(pill.value)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    status === pill.value || (!status && !pill.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {pill.label}
                </Link>
              ))}
            </div>

            {/* 초안 카드 그리드 */}
            {drafts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  해당 조건의 초안이 없습니다
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {drafts.map((draft) => (
                  <Card
                    key={draft.id}
                    className="flex flex-col rounded-xl border-gray-100 bg-white shadow-sm"
                  >
                    <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                      {/* 상단 행 */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {draft.place_name && (
                            <p className="text-sm font-bold">{draft.place_name}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{draft.report_date}</span>
                            <span>{TIME_SLOT_LABEL[draft.time_slot] ?? draft.time_slot}</span>
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANT[draft.status]}>
                          {STATUS_LABEL[draft.status]}
                        </Badge>
                      </div>

                      {/* 캡션 */}
                      <p className="flex-1 text-sm leading-relaxed text-foreground">
                        {draft.caption || '(캡션 없음)'}
                      </p>

                      {/* 해시태그 */}
                      {draft.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {draft.hashtags.slice(0, 8).map((tag) => (
                            <span key={tag} className="text-xs text-sky-600">
                              #{tag}
                            </span>
                          ))}
                          {draft.hashtags.length > 8 && (
                            <span className="text-xs text-muted-foreground">
                              +{draft.hashtags.length - 8}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 참조 장소 */}
                      {draft.referenced_places.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          📍 {draft.referenced_places.join(', ')}
                        </div>
                      )}

                      <hr className="border-gray-100" />

                      {/* 액션 */}
                      <DraftActions id={draft.id} status={draft.status} />
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
                    href={pageHref(p)}
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
          </>
        )}

        {/* ── tab=trends ───────────────────────────────────── */}
        {tab === 'trends' && (
          <>
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
                              (IG: {report.platforms.instagram ?? 0}, Threads:{' '}
                              {report.platforms.threads ?? 0})
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
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-sm"
                                >
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
                              {(report.top_keywords as KeywordTrend[])
                                .slice(0, 12)
                                .map((kw, i) => (
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
                              <p className="text-sm font-medium">
                                {report.tone_analysis.dominant_tone}
                              </p>
                              {report.tone_analysis.trending_expressions?.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">자주 쓰이는 표현:</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {report.tone_analysis.trending_expressions
                                      .slice(0, 6)
                                      .map((expr: string, i: number) => (
                                        <span key={i} className="text-xs text-sky-600">
                                          {expr}
                                        </span>
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={pageHref(p)}
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
          </>
        )}

        {/* ── tab=candidates ───────────────────────────────── */}
        {tab === 'candidates' && (
          <>
            {candidates.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  pending 후보가 없습니다.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {candidates.map((candidate) => (
                  <Card key={candidate.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{candidate.place_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <span>mention_count</span>
                        <span className="text-right font-medium text-foreground">
                          {candidate.mention_count}
                        </span>
                        <span>confidence_score</span>
                        <span className="text-right font-medium text-foreground">
                          {(candidate.confidence_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {candidate.region || '미지정'} · {candidate.category}
                      </div>
                      <CandidateActions id={candidate.id} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
