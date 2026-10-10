"use client"

import { AcademicStructureTab } from "@/components/school/academic-structure-tab"
import { AuthGuard } from '@/components/auth/auth-guard'

export default function AcademicStructurePage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar']}>
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <AcademicStructureTab />
    </div>
    </AuthGuard>
  )
}
