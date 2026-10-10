'use client';

import { AuditLogsView } from '@/components/school/audit-logs-view';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AdminAuditLogsPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin']}>
      <AuditLogsView />
    </AuthGuard>
  );
}
