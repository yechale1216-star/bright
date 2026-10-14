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
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  CheckSquare,
  ShieldCheck,
  Bookmark,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/context/auth-context'
import { useTeacherRole, type TeacherPortalAssignment } from '@/hooks/use-teacher-role'
import { useCalendar } from '@/lib/context/calendar-context'

export function UnifiedTeacherDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const { formatDate } = useCalendar()
  const {
    assignments,
    homeroomAssignments,
    subjectAssignments,
    currentYear,
  } = useTeacherRole()

  const todayStr = formatDate(new Date(), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

  // Extract unique subjects taught
  const uniqueSubjects = Array.from(
    new Set(
      subjectAssignments
        .map((a) => a.subjectRef?.name || a.subject || '')
        .filter(Boolean)
    )
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Welcome Header ── */}
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 shadow-lg shadow-black/5 dark:shadow-black/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Dual Role Teacher
              </Badge>
              {currentYear && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold text-xs px-2.5 py-0.5 flex items-center gap-1.5 backdrop-blur-sm">
                  <Calendar className="w-3 h-3" />
                  {currentYear.name}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, {user?.name || 'Teacher'} 👋
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/70" />
              {todayStr}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/school/teacher/attendance">
              <Button className="rounded-xl h-10 px-4 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <CheckSquare className="w-4 h-4" />
                Take Homeroom Attendance
              </Button>
            </Link>
            <Link href="/school/teacher/gradebook">
              <Button className="rounded-xl h-10 px-4 text-xs font-bold gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
                <GraduationCap className="w-4 h-4" />
                Open Gradebook
              </Button>
            </Link>
          </div>
        </div>

        {/* Dual Role Summary Banner */}
        <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 dark:border-emerald-500/20 backdrop-blur-md">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-foreground">Homeroom Class</p>
              <p className="text-muted-foreground text-[11px]">
                {homeroomAssignments.map(h => `${h.grade?.name || 'Grade'} - Section ${h.section?.name || 'Sec'}`).join(', ') || 'Assigned Class'} (Daily Attendance Duty)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/30 dark:border-blue-500/20 backdrop-blur-md">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-foreground">Subject Teaching Hub</p>
              <p className="text-muted-foreground text-[11px]">
                {subjectAssignments.length} class{subjectAssignments.length !== 1 ? 'es' : ''} • {uniqueSubjects.join(', ') || 'Subjects'} (Assessments & Marks)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-emerald-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Homeroom</p>
            <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{homeroomAssignments.length}</h3>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Assigned Class</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-blue-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subject Classes</p>
            <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{subjectAssignments.length}</h3>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">Teaching Roster</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-purple-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subjects</p>
            <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">{uniqueSubjects.length}</h3>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">Taught Curricula</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-amber-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Gradebook</p>
            <h3 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">Active</h3>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Weighted System</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── SECTION 1: HOMEROOM ATTENDANCE CARD ── */}
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="p-5 md:p-6 pb-4 border-b border-slate-200/60 dark:border-white/10 bg-emerald-500/10 dark:bg-emerald-950/20 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-foreground">
                  Homeroom Management & Daily Attendance
                </h3>
                <p className="text-xs text-muted-foreground">
                  Daily student morning and afternoon roll calls are managed exclusively by you as the assigned homeroom teacher.
                </p>
              </div>
            </div>
            <Link href="/school/teacher/attendance">
              <Button size="sm" className="rounded-xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
                Open Attendance
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {homeroomAssignments.map((ha) => {
              const gradeName = ha.grade?.name || 'Grade'
              const secName = ha.section?.name || 'Section'
              return (
                <div
                  key={ha.id}
                  className="rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md p-4 flex flex-col justify-between space-y-3 shadow-xs hover:border-emerald-500/50 hover:bg-white dark:hover:bg-slate-900/60 transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        Homeroom Class
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">{secName}</span>
                    </div>
                    <h4 className="text-base font-extrabold text-foreground mt-2">{gradeName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Section {secName}</p>
                  </div>
                  <Button
                    onClick={() => router.push('/school/teacher/attendance')}
                    className="w-full rounded-xl text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Take Roll Call
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: SUBJECT TEACHING HUB ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              My Subject Teaching Classes
            </h2>
            <p className="text-xs text-muted-foreground">
              Classes where you teach specific subjects and record marks, quizzes, exams, and homework.
            </p>
          </div>
          <Link href="/school/teacher/gradebook">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-primary gap-1 hover:text-primary/90">
              All Gradebooks
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {subjectAssignments.length === 0 ? (
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-8 text-center text-muted-foreground text-xs shadow-md">
            No subject teaching assignments assigned.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectAssignments.map((a) => {
              const gradeName = a.grade?.name || 'Grade'
              const secName = a.section?.name || 'Section'
              const subjectName = a.subjectRef?.name || a.subject || 'Assigned Subject'
              const streamName = a.stream?.name || null

              return (
                <div
                  key={a.id}
                  className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl hover:border-primary/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 shadow-md shadow-black/5 dark:shadow-black/20 group overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            Subject
                          </span>
                          {streamName && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              {streamName}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                          {gradeName} - {secName}
                        </h3>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Bookmark className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-primary pt-2 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      {subjectName}
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-3">
                    <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => router.push(`/school/teacher/gradebook`)}
                        className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        Gradebook
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/school/teacher/classes`)}
                        className="rounded-xl text-xs font-bold gap-1.5 border-slate-300/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-foreground backdrop-blur-md shadow-2xs"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Class Hub
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: QUICK LAUNCHPAD ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <Link href="/school/teacher/gradebook" className="block group">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-4 hover:border-primary/40 hover:bg-white/85 dark:group-hover:bg-slate-900/60 hover:shadow-lg transition-all duration-300 shadow-md shadow-black/5 dark:shadow-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground">Gradebook Matrix</h4>
                <p className="text-[11px] text-muted-foreground truncate">Weighted scores & marks entry</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/school/teacher/attendance" className="block group">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-4 hover:border-emerald-500/40 hover:bg-white/85 dark:group-hover:bg-slate-900/60 hover:shadow-lg transition-all duration-300 shadow-md shadow-black/5 dark:shadow-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground">Student Attendance</h4>
                <p className="text-[11px] text-muted-foreground truncate">Homeroom roll calls & statuses</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href="/school/teacher/communication" className="block group">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-4 hover:border-primary/40 hover:bg-white/85 dark:group-hover:bg-slate-900/60 hover:shadow-lg transition-all duration-300 shadow-md shadow-black/5 dark:shadow-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground">School Messages</h4>
                <p className="text-[11px] text-muted-foreground truncate">Student and parent communications</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
