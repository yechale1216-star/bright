'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  GraduationCap,
  BookOpen,
  BookMarked,
  MessageSquare,
  UserCheck,
  Users,
  ChevronRight,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/context/auth-context'
import { useTeacherRole, type TeacherPortalAssignment } from '@/hooks/use-teacher-role'
import { useCalendar } from '@/lib/context/calendar-context'

export function SubjectTeacherDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const { formatDate } = useCalendar()
  const {
    assignments,
    subjectAssignments,
    currentYear,
    loading,
  } = useTeacherRole()

  const todayStr = formatDate(new Date(), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

  // Extract unique subjects taught
  const uniqueSubjects = Array.from(
    new Set(
      assignments
        .map((a) => a.subjectRef?.name || a.subject || '')
        .filter(Boolean)
    )
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Welcome Header ── */}
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 shadow-lg shadow-black/5 dark:shadow-black/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 backdrop-blur-sm">
                <BookOpen className="w-3.5 h-3.5" />
                Subject Teacher
              </Badge>
              {currentYear && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold text-xs px-2.5 py-0.5 flex items-center gap-1.5 backdrop-blur-sm">
                  <Calendar className="w-3 h-3" />
                  {currentYear.name}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, {user?.name || 'Teacher'}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/70" />
              {todayStr}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/school/teacher/staff-attendance">
              <Button variant="outline" className="rounded-xl h-10 px-4 text-xs font-bold gap-2 border-slate-300/80 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs">
                <UserCheck className="w-4 h-4 text-primary" />
                My Clock-In / Attendance
              </Button>
            </Link>
            <Link href="/school/teacher/gradebook">
              <Button className="rounded-xl h-10 px-5 text-xs font-bold gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
                <GraduationCap className="w-4 h-4" />
                Open Gradebook
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-primary/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Teaching Classes</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {assignments.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Active assigned sections
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-blue-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Subjects Taught</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {uniqueSubjects.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate" title={uniqueSubjects.join(', ')}>
            {uniqueSubjects.length > 0 ? uniqueSubjects.join(', ') : 'No subjects assigned'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-emerald-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Gradebook</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            Active Evaluation
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Weighted mark entry ready
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-purple-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Teaching Hub</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <BookMarked className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-extrabold text-foreground mt-1">
            Homework & Notes
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Resource sharing enabled
          </p>
        </div>
      </div>

      {/* ── My Teaching Classes & Subjects ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">My Assigned Classes & Subjects</h2>
            <p className="text-xs text-muted-foreground">
              Direct access to gradebook mark sheets, homework assignments, and class learning materials.
            </p>
          </div>
          <Link href="/school/teacher/classes">
            <Button variant="ghost" size="sm" className="text-xs font-bold gap-1 text-primary hover:text-primary/90">
              View All Classes <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 text-center p-8">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/80 backdrop-blur-md mx-auto flex items-center justify-center text-muted-foreground">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">No Classes Assigned Yet</h3>
              <p className="text-xs text-muted-foreground">
                You do not have any teaching class or subject assignments configured yet. Please contact your school administrator or academic head to assign your classes.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((assignment) => {
              const gradeName = assignment.grade?.name || 'Grade'
              const sectionName = assignment.section?.name || 'Section'
              const subjectName = assignment.subjectRef?.name || assignment.subject || 'General Subject'
              const subjectCode = assignment.subjectRef?.code || ''
              const subjectColor = assignment.subjectRef?.color || '#3b82f6'

              return (
                <div
                  key={assignment.id}
                  className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl hover:border-primary/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 shadow-md shadow-black/5 dark:shadow-black/20 flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Badge variant="outline" className="font-bold text-xs bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-foreground">
                            {gradeName} - {sectionName}
                          </Badge>
                          {assignment.stream?.name && (
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              {assignment.stream.name}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-foreground flex items-center gap-2 mt-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: subjectColor }}
                          />
                          {subjectName}
                        </h3>
                        {subjectCode && (
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            Code: {subjectCode}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/60 dark:border-white/10">
                      <Link
                        href={`/school/teacher/gradebook`}
                        className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-center transition-all group flex items-center justify-center gap-1.5 backdrop-blur-md"
                      >
                        <GraduationCap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold">Gradebook</span>
                      </Link>

                      <Link
                        href={`/school/teacher/classes`}
                        className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-foreground border border-slate-200/80 dark:border-white/10 text-center transition-all group flex items-center justify-center gap-1.5 backdrop-blur-md shadow-2xs"
                      >
                        <Layers className="w-4 h-4 group-hover:scale-110 transition-transform text-muted-foreground" />
                        <span className="text-xs font-bold">Class Hub</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Quick Tools Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link href="/school/teacher/gradebook" className="group">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl group-hover:border-primary/50 group-hover:bg-white/85 dark:group-hover:bg-slate-900/60 transition-all duration-300 p-5 shadow-md shadow-black/5 dark:shadow-black/20 h-full">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
                  Gradebook & Assessments
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record test marks, view weighted averages, and calculate final grades.
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/school/teacher/classes" className="group">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl group-hover:border-primary/50 group-hover:bg-white/85 dark:group-hover:bg-slate-900/60 transition-all duration-300 p-5 shadow-md shadow-black/5 dark:shadow-black/20 h-full">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
                  Class Workspace
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage class rosters, homework assignments, and shared learning materials.
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/school/teacher/communication" className="group">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl group-hover:border-primary/50 group-hover:bg-white/85 dark:group-hover:bg-slate-900/60 transition-all duration-300 p-5 shadow-md shadow-black/5 dark:shadow-black/20 h-full">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-foreground flex items-center justify-between">
                  Messages & Parent Chat
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send updates, reply to parent inquiries, and view notifications.
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
