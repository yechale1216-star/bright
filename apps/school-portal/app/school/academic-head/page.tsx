'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Layers, Award, FileText, ArrowRight,
  CheckCircle2, Clock, Users, AlertTriangle,
  RefreshCw, Check, X, ChevronRight, BarChart2, ShieldCheck,
  Calendar, BookOpen, SlidersHorizontal, Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { gradebookService, type AssessmentSubmissionItem, type SubmissionDashboardMetrics, type Exam } from '@/lib/gradebook-service'
import { db } from '@/lib/db/database'
import { apiFetch } from '@/lib/utils/fetch-with-timeout'
import { API_URL } from '@/lib/api-config'
import { notifications } from '@/lib/utils/notifications'
import { useGreeting } from '@/lib/utils/greeting-utils'
import { useCalendar } from '@/lib/context/calendar-context'
import { useAuth } from '@/lib/context/auth-context'
import { cn } from '@/lib/utils/utils'

export default function AcademicHeadDashboardPage() {
  const { user } = useAuth()
  const greeting = useGreeting('academic_head')
  const { formatDate } = useCalendar()
  const headName = user?.name || (user as any)?.full_name || 'Academic Head'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Live Operational Metrics
  const [metrics, setMetrics] = useState<SubmissionDashboardMetrics>({
    total: 0,
    submitted: 0,
    pendingApproval: 0,
    requiringAttention: 0,
    approved: 0,
    published: 0,
  })

  // Pending Submissions Queue
  const [pendingSubmissions, setPendingSubmissions] = useState<AssessmentSubmissionItem[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Academic Structure Counts
  const [structureCounts, setStructureCounts] = useState({
    grades: 0,
    sections: 0,
    streams: 0,
    subjects: 0,
  })

  // Exams & Reports
  const [exams, setExams] = useState<Exam[]>([])
  const [activeYearName, setActiveYearName] = useState<string>('Current Academic Year')
  const [activeTermName, setActiveTermName] = useState<string>('Active Term')

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null
    const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (schoolId) headers['x-school-id'] = schoolId
    return headers
  }

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const [
        metricsData,
        submissionsData,
        examsData,
        gradesRes,
        sectionsRes,
        streamsRes,
        subjectsRes,
        yearRes,
      ] = await Promise.allSettled([
        gradebookService.getSubmissionDashboard().catch(() => ({
          total: 0, submitted: 0, pendingApproval: 0, requiringAttention: 0, approved: 0, published: 0
        })),
        gradebookService.getSubmissions({ status: 'PENDING_APPROVAL', limit: 6 }).catch(() => ({
          submissions: [], pagination: { total: 0, page: 1, limit: 6, totalPages: 1 }
        })),
        gradebookService.getExams().catch(() => []),
        db.getGrades().catch(() => []),
        db.getSections().catch(() => []),
        db.getStreams().catch(() => []),
        db.getSubjects().catch(() => []),
        apiFetch<{ success: boolean; data: any }>(`${API_URL}/api/academic-years/current`, { headers: getHeaders() }).catch(() => ({ success: true, data: null })),
      ])

      if (metricsData.status === 'fulfilled') {
        setMetrics(metricsData.value)
      }

      if (submissionsData.status === 'fulfilled') {
        const subs = submissionsData.value.submissions || []
        setPendingSubmissions(subs)
      }

      if (examsData.status === 'fulfilled') {
        setExams(examsData.value || [])
      }

      const gradesCount = gradesRes.status === 'fulfilled' && Array.isArray(gradesRes.value) ? gradesRes.value.length : 0
      const sectionsCount = sectionsRes.status === 'fulfilled' && Array.isArray(sectionsRes.value) ? sectionsRes.value.length : 0
      const streamsCount = streamsRes.status === 'fulfilled' && Array.isArray(streamsRes.value) ? streamsRes.value.length : 0
      const subjectsCount = subjectsRes.status === 'fulfilled' && Array.isArray(subjectsRes.value) ? subjectsRes.value.length : 0

      setStructureCounts({
        grades: gradesCount,
        sections: sectionsCount,
        streams: streamsCount,
        subjects: subjectsCount,
      })

      if (yearRes.status === 'fulfilled' && yearRes.value?.data) {
        const yData = yearRes.value.data
        if (yData.name) setActiveYearName(yData.name)
        const currentTerm = yData.terms?.find((t: any) => t.isCurrent) || yData.terms?.[0]
        if (currentTerm?.name) setActiveTermName(currentTerm.name)
      }
    } catch (err) {
      console.error('Failed to load academic head dashboard data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleQuickApprove = async (id: string, assessmentTitle: string) => {
    setApprovingId(id)
    try {
      await gradebookService.approveSubmission(id)
      notifications.success('Marks Approved', `Successfully approved marks for ${assessmentTitle}`)
      setPendingSubmissions(prev => prev.filter(s => s.id !== id))
      setMetrics(prev => ({
        ...prev,
        pendingApproval: Math.max(0, prev.pendingApproval - 1),
        approved: prev.approved + 1,
      }))
    } catch (err: any) {
      notifications.error('Approval Failed', err.message || 'Could not approve marks submission.')
    } finally {
      setApprovingId(null)
    }
  }

  const totalActionNeeded = (metrics.pendingApproval || 0) + (metrics.submitted || 0)
  const approvalRate = metrics.total > 0
    ? Math.round(((metrics.approved + metrics.published) / metrics.total) * 100)
    : 100

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 relative">

      {/* Header — Greeting + Date & Badges */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="space-y-1 w-full md:w-auto">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span>{greeting},</span>
            <span className="text-violet-600 dark:text-violet-400">{headName}</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Academic coordination, assessment policies, and mark approval console
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Academic Year & Term Badges */}
          <span className="text-xs font-semibold bg-white/70 dark:bg-slate-800/60 backdrop-blur-md text-foreground px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-white/10 shadow-2xs flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> {activeYearName}
          </span>
          <span className="text-xs font-semibold bg-white/70 dark:bg-slate-800/60 backdrop-blur-md text-foreground px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-white/10 shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {activeTermName}
          </span>

          {/* Date & Refresh Pill */}
          <div className="text-xs font-semibold bg-white/70 dark:bg-slate-800/60 backdrop-blur-md text-foreground px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-white/10 shadow-2xs flex items-center gap-2.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{formatDate(new Date(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing || loading}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing ? "animate-spin text-violet-500" : "")} />
            </button>
          </div>
        </div>
      </div>

      {/* Top Operational Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending Approvals */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-5 shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-xl hover:border-violet-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Approvals</span>
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground text-center">
                {loading ? '...' : totalActionNeeded}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium">
              {totalActionNeeded > 0 ? `${totalActionNeeded} awaiting review` : 'All marks reviewed'}
            </span>
            <Link href="/school/academic-head/assessments/submissions" className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Review <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Metric 2: Academic Structure */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-5 shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-xl hover:border-violet-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Academic Structure</span>
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground text-center">
                {loading ? '...' : structureCounts.sections}
              </span>
              <span className="text-xs font-medium text-muted-foreground">sections active</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium truncate max-w-[150px]">
              {structureCounts.grades} grades • {structureCounts.subjects} subjects
            </span>
            <Link href="/school/academic-head/academic-structure" className="font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Metric 3: Active Exams & Grading */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-5 shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-xl hover:border-violet-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scheduled Exams</span>
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground text-center">
                {loading ? '...' : exams.length}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium">
              {exams.filter(e => e.status === 'PUBLISHED' || e.isPublished).length} published terms
            </span>
            <Link href="/school/academic-head/exams" className="font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Exams <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Metric 4: Clearance & Completion Rate */}
        <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-5 shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-xl hover:border-violet-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approval Rate</span>
            </div>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-foreground text-center">
                {loading ? '...' : `${approvalRate}%`}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium">
              {metrics.approved + metrics.published} of {metrics.total || 0} batches
            </span>
            <Link href="/school/academic-head/report-cards" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Reports <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Executive Quick Launchpad */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          { label: 'Assessment Policy', desc: 'Weights & schemes', href: '/school/academic-head/assessments/policy', icon: SlidersHorizontal, color: 'text-violet-500 bg-violet-500/10 dark:bg-violet-500/20' },
          { label: 'Bulk Assignment', desc: 'Distribute tests to grades', href: '/school/academic-head/assessments/bulk-assignment', icon: Layers, color: 'text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20' },
          { label: 'Timetable Console', desc: 'Class schedules & conflicts', href: '/school/academic-head/timetables', icon: Calendar, color: 'text-sky-500 bg-sky-500/10 dark:bg-sky-500/20' },
          { label: 'Report Clearance', desc: 'Batch review & publish', href: '/school/academic-head/report-cards', icon: FileText, color: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20' },
        ].map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="p-4 rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-violet-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300 group flex items-center gap-3.5"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", item.color)}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                {item.label}
              </h4>
              <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>

      {/* Main Grid: Pending Approvals & Status Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 overflow-hidden">
            <div className="p-5 pb-4 border-b border-slate-200/60 dark:border-white/10 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-500" />
                  Pending Mark Submissions
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Teacher mark submissions awaiting academic verification and approval
                </p>
              </div>
              <Link href="/school/academic-head/assessments/submissions">
                <Button variant="ghost" size="sm" className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 gap-1 rounded-xl">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="p-0">
              {loading ? (
                <div className="p-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-violet-500" /> Loading submissions...
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">All Submissions Reviewed</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-0.5">
                      No teacher mark sheets are currently pending academic approval.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                  {pendingSubmissions.map((sub) => {
                    const teacherName = sub.teacher?.name || 'Assigned Teacher'
                    const subjectName = sub.subject?.name || 'Subject'
                    const gradeName = sub.grade?.name || 'Grade'
                    const sectionName = sub.section?.name || ''
                    const title = `${subjectName} - ${gradeName}${sectionName ? ` (${sectionName})` : ''}`

                    return (
                      <div key={sub.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground truncate">{title}</span>
                            <Badge variant="outline" className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 rounded-full">
                              Pending
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">{subjectName}</span>
                            <span>•</span>
                            <span>{gradeName} {sectionName ? `(${sectionName})` : ''}</span>
                            <span>•</span>
                            <span>By: {teacherName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            disabled={approvingId === sub.id}
                            onClick={() => handleQuickApprove(sub.id, title)}
                            className="text-xs font-bold gap-1.5 h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/30"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {approvingId === sub.id ? 'Approving...' : 'Approve'}
                          </Button>
                          <Link href="/school/academic-head/assessments/submissions">
                            <Button size="sm" variant="outline" className="text-xs font-semibold h-8 px-3 rounded-xl border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800">
                              Inspect
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Submission Status */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-violet-500" />
                Submission Status
              </h3>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {approvalRate}% Done
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Approved Batches:</span>
                <span className="text-foreground">{metrics.approved + metrics.published}</span>
              </div>
              <div className="w-full bg-slate-200/70 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${approvalRate}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending Review:
                </span>
                <span className="font-bold text-foreground">{metrics.pendingApproval + metrics.submitted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Needs Attention:
                </span>
                <span className="font-bold text-foreground">{metrics.requiringAttention || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500" /> Total Submitted:
                </span>
                <span className="font-bold text-foreground">{metrics.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Structure Breakdown */}
      <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              Academic Structure Directory
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grade levels, class sections, academic streams, and taught subjects
            </p>
          </div>
          <Link href="/school/academic-head/academic-structure">
            <Button size="sm" variant="outline" className="text-xs font-bold gap-1 rounded-xl border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800">
              Manage Structure <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-2xs hover:shadow-md hover:scale-[1.02] transition-all duration-200">
            <p className="text-3xl font-black text-foreground">{structureCounts.grades}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Grades</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-2xs hover:shadow-md hover:scale-[1.02] transition-all duration-200">
            <p className="text-3xl font-black text-foreground">{structureCounts.sections}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Sections</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-2xs hover:shadow-md hover:scale-[1.02] transition-all duration-200">
            <p className="text-3xl font-black text-foreground">{structureCounts.streams}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Streams</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-2xs hover:shadow-md hover:scale-[1.02] transition-all duration-200">
            <p className="text-3xl font-black text-foreground">{structureCounts.subjects}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1.5">Subjects</p>
          </div>
        </div>
      </div>
    </div>
  )
}
