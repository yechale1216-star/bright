'use client';

import { ExecutiveApprovalsInbox } from '@/components/school/executive-approvals-inbox';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AdminApprovalsPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head']}>
      <ExecutiveApprovalsInbox />
    </AuthGuard>
  );
}
