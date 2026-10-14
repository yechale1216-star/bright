'use client'

import React from 'react'
import { Reports } from '@/components/school/reports'
import { useTeacherRole } from '@/hooks/use-teacher-role'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function TeacherReportsPage() {
  const { isHomeroomTeacher, loading } = useTeacherRole()

  if (loading) {
    return <PageSkeleton variant="dashboard" />
  }

  if (!isHomeroomTeacher) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 my-12">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">Homeroom Access Required</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Student Attendance Reports are managed by assigned Homeroom Teachers. As a Subject Teacher, student attendance reports are not part of your assigned responsibilities.
        </p>
        <div className="pt-2">
          <Button asChild className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">
            <Link href="/school/teacher">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <Reports />
    </div>
  )
}
