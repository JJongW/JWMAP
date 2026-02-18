import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPendingPlaceCandidates } from '@/lib/queries/automation';
import { CandidateActions } from './CandidateActions';

export default async function AutomationPlaceCandidatesPage() {
  const candidates = await getPendingPlaceCandidates(200);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Automation · Place Candidates</h1>
          <Link href="/automation" className="text-sm text-muted-foreground hover:underline">
            ← Automation
          </Link>
        </div>

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
                    <span className="text-right font-medium text-foreground">{candidate.mention_count}</span>
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
      </div>
    </AdminLayout>
  );
}
