import { redirect } from 'next/navigation';

export default function AutomationDraftsPage() {
  redirect('/content-engine?tab=drafts');
}
