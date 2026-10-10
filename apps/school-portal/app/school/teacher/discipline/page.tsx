'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TeacherDisciplinePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/school/teacher');
  }, [router]);

  return (
    <div className="p-8 text-center text-sm font-bold text-slate-500">
      Redirecting to Teacher Dashboard...
    </div>
  );
}
