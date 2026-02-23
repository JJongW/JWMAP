import { redirect } from 'next/navigation';

export default function TrendsPage() {
  redirect('/content-engine?tab=trends');
}
