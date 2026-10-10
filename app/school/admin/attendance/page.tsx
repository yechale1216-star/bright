'use client'

import React, { Suspense } from 'react'
import { StudentAttendanceOverview } from '@/components/school/student-attendance-overview'
import { AttendanceByGrade } from '@/components/school/attendance-by-grade'
import { Reports } from '@/components/school/reports'
import { AttendanceEditRequestsScreen } from '@/components/school/attendance-edit-requests-screen'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, BarChart2, FileText, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { AuthGuard } from '@/components/auth/auth-guard'

function AttendancePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'overview'

  const handleTabChange = (tab: string) => {
    router.replace(`/school/admin/attendance?tab=${tab}`, { scroll: false })
  }

  const handleNavigate = (tab: string) => {
    if (tab === 'attendance-by-grade' || tab === 'analytics') {
      handleTabChange('analytics')
      return
    }
    if (tab === 'reports') {
      handleTabChange('reports')
      return
    }
    if (tab === 'requests' || tab === 'attendance-requests') {
      handleTabChange('requests')
      return
    }
    const tabToPath: Record<string, string> = {
      'dashboard': '/school/admin',
      'students': '/school/admin/students',
      'teachers': '/school/admin/teachers',
      'attendance': '/school/admin/attendance',
      'settings': '/school/admin/settings',
      'teacher-assignments': '/school/admin/teacher-assignments',
      'discipline': '/school/admin/discipline',
    }

    const path = tabToPath[tab]
    if (path) {
      router.push(path)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Horizontal Unified Attendance Navigation Tabs */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-2xs w-fit max-w-full overflow-x-auto no-scrollbar">
          <Button
            variant={currentTab === 'overview' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('overview')}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold gap-2 transition-all whitespace-nowrap shrink-0",
              currentTab === 'overview' ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Attendance Overview</span>
          </Button>

          <Button
            variant={currentTab === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('analytics')}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold gap-2 transition-all whitespace-nowrap shrink-0",
              currentTab === 'analytics' ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Grade Analytics</span>
          </Button>

          <Button
            variant={currentTab === 'reports' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('reports')}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold gap-2 transition-all whitespace-nowrap shrink-0",
              currentTab === 'reports' ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="w-4 h-4" />
            <span>Attendance Reports</span>
          </Button>

          <Button
            variant={currentTab === 'requests' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('requests')}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold gap-2 transition-all whitespace-nowrap shrink-0",
              currentTab === 'requests' ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCheck className="w-4 h-4" />
            <span>Edit Requests</span>
          </Button>
        </div>
      </div>

      {/* View Content */}
      {currentTab === 'analytics' && <AttendanceByGrade />}
      {currentTab === 'reports' && <Reports />}
      {currentTab === 'requests' && <AttendanceEditRequestsScreen onBack={() => handleTabChange('overview')} />}
      {currentTab === 'overview' && <StudentAttendanceOverview onNavigate={handleNavigate} />}
    </div>
  )
}

export default function AttendancePage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head', 'discipline_officer']}>
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <AttendancePageContent />
    </Suspense>
    </AuthGuard>
  )
}
