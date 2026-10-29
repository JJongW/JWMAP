import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

/** 장소 수정은 새 큐레이션 화면(/places)에서 한다. 새 장소는 검토함에서 */
export default async function LegacyDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(id === 'new' ? '/intake' : `/places/${id}`);
}
