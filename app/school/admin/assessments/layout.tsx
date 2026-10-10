'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AssessmentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head']}>
      {children}
    </AuthGuard>
  );
}
