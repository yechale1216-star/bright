'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { AttendanceTracking } from '@/components/school/attendance-tracking'
import { useTeacherRole } from '@/hooks/use-teacher-role'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert, GraduationCap, ArrowLeft } from 'lucide-react'

export default function TeacherAttendancePage() {
  const router = useRouter()
  const { isHomeroomTeacher, loading } = useTeacherRole()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="md" className="text-primary" />
      </div>
    )
  }

  // Restrict attendance module from Subject Teachers
  if (!isHomeroomTeacher) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto flex items-center justify-center min-h-[70vh]">
        <Card className="rounded-3xl border-border bg-card shadow-lg p-6 md:p-8 text-center">
          <CardContent className="p-0 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              Student Attendance Module Restricted
            </h2>

            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              You are assigned as a <strong>Subject Teacher</strong>. Daily homeroom student attendance is exclusively managed and recorded by assigned <strong>Homeroom Teachers</strong>.
            </p>

            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground text-left space-y-1.5">
              <p className="font-bold text-foreground">As a Subject Teacher, you have access to:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>Gradebook: Enter assessment scores, quizzes, midterms, and final exam marks</li>
                <li>Homework: Create and distribute class assignments</li>
                <li>Materials: Upload learning guides and subject reference documents</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => router.push('/school/teacher/gradebook')}
                className="w-full sm:w-auto rounded-xl font-bold text-xs gap-2 bg-primary text-white"
              >
                <GraduationCap className="w-4 h-4" />
                Go to Gradebook
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/school/teacher')}
                className="w-full sm:w-auto rounded-xl font-bold text-xs gap-2 border-border"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <AttendanceTracking />
    </div>
  )
}
