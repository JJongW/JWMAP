import { redirect } from 'next/navigation';

export default function DraftsPage() {
  redirect('/content-engine?tab=drafts');
}
