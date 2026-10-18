'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { StudentAttendanceOverview } from '@/components/school/student-attendance-overview'
import { SubjectTeacherDashboard } from '@/components/school/subject-teacher-dashboard'
import { UnifiedTeacherDashboard } from '@/components/school/unified-teacher-dashboard'
import { useTeacherRole } from '@/hooks/use-teacher-role'
import { Spinner } from '@/components/ui/spinner'

export default function TeacherDashboard() {
  const router = useRouter()
  const { isHomeroomTeacher, isDualRole, loading } = useTeacherRole()

  const handleNavigate = (tab: string) => {
    const tabToPath: Record<string, string> = {
      dashboard: '/school/teacher',
      schedule: '/school/teacher/schedule',
      classes: '/school/teacher/classes',
      gradebook: '/school/teacher/gradebook',
      attendance: '/school/teacher/attendance',
      reports: '/school/teacher/reports',
      profile: '/school/teacher/profile',
    }

    const path = tabToPath[tab]
    if (path) {
      router.push(path)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="md" className="text-primary" />
      </div>
    )
  }

  // 1. Dual-Role Teacher (Both Homeroom and Subject Teacher)
  if (isDualRole) {
    return <UnifiedTeacherDashboard />
  }

  // 2. Homeroom Teacher only
  if (isHomeroomTeacher) {
    return (
      <div className="p-4 md:p-8">
        <StudentAttendanceOverview onNavigate={handleNavigate} />
      </div>
    )
  }

  // 3. Subject Teacher only
  return <SubjectTeacherDashboard />
}
