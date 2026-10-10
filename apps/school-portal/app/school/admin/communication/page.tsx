'use client';

import dynamic from 'next/dynamic';

const MessagingCenter = dynamic(
  () => import('@/components/messaging/messaging-center').then(mod => mod.MessagingCenter),
  { 
    ssr: false,
    loading: () => <div className="p-8">Loading messaging center...</div>
  }
);

export default function AdminMessagesPage() {
  return (
    <MessagingCenter />
  );
}
