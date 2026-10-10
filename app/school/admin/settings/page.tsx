'use client'

import { Settings } from '@/components/school/settings'
import { AuthGuard } from '@/components/auth/auth-guard'

export default function SchoolSettingsPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin']}>
      <div className="p-4 md:p-8">
        <Settings />
      </div>
    </AuthGuard>
  )
}
