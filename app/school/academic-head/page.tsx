'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Layers, Award, FileText, ArrowRight,
  Sparkles, CheckCircle2, Clock, Users, BookOpen, AlertTriangle,
  RefreshCw, Check, X, ChevronRight, BarChart2, ShieldCheck,
  Calendar, ArrowUpRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { gradebookService, type AssessmentSubmissionItem, type SubmissionDashboardMetrics, type Exam } from '@/lib/gradebook-service'
import { apiFetch } from '@/lib/utils/fetch-with-timeout'
import { API_URL } from '@/lib/api-config'
import { notifications } from '@/lib/utils/notifications'

export default function AcademicHeadDashboardPage() {
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
        subjectsRes,
        yearRes,
      ] = await Promise.allSettled([
        gradebookService.getSubmissionDashboardMetrics().catch(() => ({
          total: 0, submitted: 0, pendingApproval: 0, requiringAttention: 0, approved: 0, published: 0
        })),
        gradebookService.getSubmissions({ status: 'PENDING_APPROVAL', limit: 6 }).catch(() => ({
          submissions: [], pagination: { total: 0, page: 1, limit: 6, totalPages: 1 }
        })),
        gradebookService.getExams().catch(() => []),
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/school/grades`, { headers: getHeaders() }).catch(() => ({ success: true, data: [] })),
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/school/sections`, { headers: getHeaders() }).catch(() => ({ success: true, data: [] })),
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/school/subjects`, { headers: getHeaders() }).catch(() => ({ success: true, data: [] })),
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

      const gradesCount = gradesRes.status === 'fulfilled' ? (gradesRes.value.data?.length || 0) : 0
      const sectionsCount = sectionsRes.status === 'fulfilled' ? (sectionsRes.value.data?.length || 0) : 0
      const subjectsCount = subjectsRes.status === 'fulfilled' ? (subjectsRes.value.data?.length || 0) : 0
      setStructureCounts({
        grades: gradesCount,
        sections: sectionsCount,
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Academic Dean & Coordinator Console
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Academic Operations Overview</h1>
            <p className="mt-2 text-violet-100 text-sm leading-relaxed">
              Live curriculum structure, mark submission approvals, exam schedules, and grading performance across all grade levels.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-violet-200">
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-violet-300" /> {activeYearName}
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg font-medium text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {activeTermName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing || loading}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white text-xs font-bold gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Top Operational Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending Approvals */}
        <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden hover:border-amber-500/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Approvals</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalActionNeeded > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {loading ? '...' : totalActionNeeded}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">mark sheets</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                {totalActionNeeded > 0 ? `${totalActionNeeded} awaiting your sign-off` : 'All marks up to date'}
              </span>
              <Link href="/school/academic-head/assessments" className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5">
                Review <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Academic Structure */}
        <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden hover:border-violet-500/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Academic Structure</span>
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {loading ? '...' : structureCounts.sections}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">active sections</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                {structureCounts.grades} Grades • {structureCounts.subjects} Subjects
              </span>
              <Link href="/school/academic-head/academic-structure" className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Active Exams & Grading */}
        <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scheduled Exams</span>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-foreground">
                {loading ? '...' : exams.length}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">terms / sessions</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                {exams.filter(e => e.status === 'PUBLISHED' || e.isPublished).length} published
              </span>
              <Link href="/school/academic-head/exams" className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5">
                Exams <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Clearance & Completion Rate */}
        <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mark Approval Rate</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {loading ? '...' : `${approvalRate}%`}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">approved</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                {metrics.approved + metrics.published} of {metrics.total || 0} batches
              </span>
              <Link href="/school/academic-head/report-cards" className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5">
                Reports <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Operational Section: Pending Approvals Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Mark Submissions Requiring Your Approval
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Teacher grade submissions awaiting verification before entering official records
                </CardDescription>
              </div>
              <Link href="/school/academic-head/assessments">
                <Button variant="ghost" size="sm" className="text-xs font-bold text-primary gap-1">
                  View Full Queue <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Loading approval queue...
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Approval Queue is Clear!</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    All teacher mark submissions have been reviewed and approved. New submissions will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {pendingSubmissions.map((sub) => {
                    const teacherName = sub.teacher?.name || sub.teacher?.user?.full_name || 'Assigned Teacher'
                    const subjectName = sub.subjectRef?.name || sub.subject || 'Subject'
                    const gradeName = sub.grade?.name || 'Grade'
                    const sectionName = sub.section?.name || ''
                    const title = sub.assessment?.title || `${subjectName} Assessment`

                    return (
                      <div key={sub.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground truncate">{title}</span>
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold">
                              Pending Approval
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{subjectName}</span>
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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 h-8 px-3 rounded-lg shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {approvingId === sub.id ? 'Approving...' : 'Approve'}
                          </Button>
                          <Link href={`/school/academic-head/assessments`}>
                            <Button size="sm" variant="outline" className="text-xs font-semibold h-8 px-3 rounded-lg">
                              Inspect
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Structure Breakdown */}
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500" />
                Active Academic Programs
              </CardTitle>
              <CardDescription className="text-xs">
                Structural distribution across grades, classroom sections, and departmental curricula
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{structureCounts.grades}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-1">Grade Levels</p>
                </div>
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{structureCounts.sections}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-1">Class Sections</p>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{structureCounts.subjects}</p>
                  <p className="text-xs font-bold text-muted-foreground mt-1">Course Subjects</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Need to add new grades, section splits, or subjects?</span>
                <Link href="/school/academic-head/academic-structure" className="font-bold text-primary hover:underline flex items-center gap-1">
                  Open Structure Workspace <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Quick Operational Actions & Workspaces */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Academic Head Workspaces
              </CardTitle>
              <CardDescription className="text-xs">
                Direct access to module management consoles
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <Link href="/school/academic-head/assessments" className="block">
                <div className="p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Assessments & Marks</p>
                      <p className="text-[11px] text-muted-foreground">Weights, submissions & approvals</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>

              <Link href="/school/academic-head/academic-structure" className="block">
                <div className="p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Curriculum & Structure</p>
                      <p className="text-[11px] text-muted-foreground">Grades, sections & courses</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>

              <Link href="/school/academic-head/exams" className="block">
                <div className="p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Exams & Grading Scales</p>
                      <p className="text-[11px] text-muted-foreground">Exam rosters & GPA standards</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>

              <Link href="/school/academic-head/report-cards" className="block">
                <div className="p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Report Cards Console</p>
                      <p className="text-[11px] text-muted-foreground">Batch compile, verify & print</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Submission Pipeline Status Card */}
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" />
                Marks Submission Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Approved / Published:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{metrics.approved + metrics.published} batches</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${approvalRate}%` }}
                />
              </div>

              <div className="pt-2 border-t border-border/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending Review:
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{metrics.pendingApproval + metrics.submitted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Requires Attention:
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{metrics.requiringAttention || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Total Tracked Batches:
                  </span>
                  <span className="font-bold text-foreground">{metrics.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
