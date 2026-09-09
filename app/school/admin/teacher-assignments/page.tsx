'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/spinner'

const TeacherManagement = dynamic(
  () => import('@/components/school/teacher-management').then(mod => mod.TeacherManagement),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="md" className="text-primary" />
      </div>
    )
  }
)

export default function TeacherAssignmentsPage() {
  return (
    <div className="p-4 md:p-8">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner size="md" className="text-primary" />
        </div>
      }>
        <TeacherManagement defaultTab="assignments" />
      </Suspense>
    </div>
  )
}
