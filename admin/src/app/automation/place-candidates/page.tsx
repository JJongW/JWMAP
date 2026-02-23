import { redirect } from 'next/navigation';

export default function AutomationPlaceCandidatesPage() {
  redirect('/content-engine?tab=candidates');
}
