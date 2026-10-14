'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/spinner';

const TimetableManagement = dynamic(
  () => import('@/components/school/timetable-management').then((mod) => mod.TimetableManagement),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="md" className="text-purple-600" />
      </div>
    ),
  }
);

export default function AdminTimetablesPage() {
  return (
    <div className="p-4 md:p-8">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="md" className="text-purple-600" />
          </div>
        }
      >
        <TimetableManagement />
      </Suspense>
    </div>
  );
}
