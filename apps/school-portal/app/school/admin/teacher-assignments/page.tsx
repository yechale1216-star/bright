'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TeacherAssignmentManagement } from '@/components/school/teacher-assignment-management'

export default function TeacherAssignmentsPage() {
  const router = useRouter()

  useEffect(() => {
    // Preserve route while steering user to Academic Structure -> Teacher Assignment
    router.replace('/school/admin/academic-structure?tab=teacher_assignments')
  }, [router])

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TeacherAssignmentManagement />
    </div>
  )
}
