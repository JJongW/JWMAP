import { createServerSupabase } from '@/lib/supabase/server';
import { getReviews } from '@/lib/queries/reviews';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { deleteReview } from './actions';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VISIT_TYPE_LABEL: Record<string, string> = {
  first: '첫 방문',
  repeat: '재방문',
  regular: '단골',
};

export default async function ReviewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createServerSupabase();

  const page = Number(params.page) || 1;
  const perPage = 30;

  const { data: reviews, count } = await getReviews(supabase, { page, per_page: perPage });

  const totalPages = Math.ceil((count ?? 0) / perPage);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">리뷰 관리</h1>
          <span className="text-sm text-muted-foreground">총 {count ?? 0}개</span>
        </div>

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">장소</th>
                <th className="px-4 py-2 text-left font-medium">리뷰</th>
                <th className="px-4 py-2 text-left font-medium">작성자</th>
                <th className="px-4 py-2 text-left font-medium">방문 유형</th>
                <th className="px-4 py-2 text-left font-medium">작성일</th>
                <th className="px-4 py-2 text-left font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    리뷰가 없습니다.
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{review.location_name || '-'}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{review.one_liner}</td>
                    <td className="px-4 py-2 text-muted-foreground">{review.user_display_name}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                        {VISIT_TYPE_LABEL[review.visit_type] ?? review.visit_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-2">
                      <form
                        action={async () => {
                          'use server';
                          await deleteReview(review.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {page > 1 && (
              <a
                href={`/reviews?page=${page - 1}`}
                className="rounded border px-3 py-1 text-sm hover:bg-muted"
              >
                이전
              </a>
            )}
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/reviews?page=${page + 1}`}
                className="rounded border px-3 py-1 text-sm hover:bg-muted"
              >
                다음
              </a>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
