'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AttendanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head', 'discipline_officer']}>
      {children}
    </AuthGuard>
  );
}
