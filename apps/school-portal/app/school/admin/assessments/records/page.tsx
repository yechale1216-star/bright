'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AssessmentRecordsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/school/admin/assessments/bulk-assignment');
  }, [router]);

  return (
    <div className="p-8 text-center text-muted-foreground">
      Redirecting to Bulk Assignment...
    </div>
  );
}
