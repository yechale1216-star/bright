'use client';

import { ExecutiveReportsView } from '@/components/school/executive-reports-view';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AdminReportsPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head']}>
      <ExecutiveReportsView />
    </AuthGuard>
  );
}
