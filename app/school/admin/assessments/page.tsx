'use client';

import AssessmentPolicyPage from './policy/page';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AssessmentsIndexPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head']}>
      <AssessmentPolicyPage />
    </AuthGuard>
  );
}
