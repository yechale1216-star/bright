"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ErrorBanner } from "@/components/ui/data-state-view"
import {
  Users, UserCheck, ShieldAlert, GraduationCap, Calendar,
  ChevronRight, TrendingUp, ShieldCheck,
  Activity, AlertTriangle, RefreshCw, BarChart3, FileCheck,
  CheckCircle2, XCircle, Lock, MessageSquare, Check, X
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { notifications } from "@/lib/utils/notifications"
import { queryCache } from "@/lib/utils/query-cache"
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from "recharts"

import { db, type Student, type AttendanceRecord } from "@/lib/db/database"
import { DisciplineApi, type StudentDiscipline } from "@/lib/discipline-service"
import { useAuth } from "@/lib/context/auth-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { useCalendar } from "@/lib/context/calendar-context"
import { useGreeting } from "@/lib/utils/greeting-utils"
import { cn } from "@/lib/utils/utils"

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { formatDate } = useCalendar()
  const greeting = useGreeting("school_admin")
  const { settings } = useSchoolSettings()

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" }), [])

  // Instant 0ms SWR hydration from query cache if already cached in session
  const [dashboardSummary, setDashboardSummary] = useState<any>(() => {
    return queryCache.get<any>(`dashboard_summary_single-school_${todayStr}_all`) ?? null
  })
  const [staffStats, setStaffStats] = useState<any>(() => {
    return queryCache.get<any>(`staff_attendance_stats_${todayStr}_daily`) ?? null
  })
  const [morningStaffStats, setMorningStaffStats] = useState<any>(() => {
    return staffStats?.sessionBreakdown?.morning ?? staffStats
  })
  const [afternoonStaffStats, setAfternoonStaffStats] = useState<any>(() => {
    return staffStats?.sessionBreakdown?.afternoon ?? staffStats
  })

  // Avoid flashing skeleton spinners if initial data is already cached
  const [isLoading, setIsLoading] = useState(!dashboardSummary && !staffStats)
  const [initialLoadDone, setInitialLoadDone] = useState(!!dashboardSummary?.totalTeachers || !!staffStats?.totalStaff)
  const [error, setError] = useState<string | null>(null)

  // Secondary/fallback states
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([])
  const [incidents, setIncidents] = useState<StudentDiscipline[]>([])
  const [editRequests, setEditRequests] = useState<any[]>([])
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [selectedRequestForAction, setSelectedRequestForAction] = useState<any | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [adminNote, setAdminNote] = useState("")
  const [requestsFilter, setRequestsFilter] = useState<"pending" | "all" | "resolved">("pending")

  const adminName = useMemo(() => {
    if (!user?.name) return "Administrator"
    const parts = user.name.trim().split(/\s+/)
    const titles = ["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof."]
    if (parts.length > 1 && titles.includes(parts[0].toLowerCase())) {
      return `${parts[0]} ${parts[1]}`
    }
    return parts[0]
  }, [user?.name])

  useEffect(() => {
    loadDashboardData()

    // Real-time data event listeners
    const handleDataChanged = () => loadDashboardData(true)
    window.addEventListener("studentDataChanged", handleDataChanged)
    window.addEventListener("teacherDataChanged", handleDataChanged)
    window.addEventListener("attendanceDataChanged", handleDataChanged)
    window.addEventListener("disciplineDataChanged", handleDataChanged)
    window.addEventListener("staffAttendanceDataChanged", handleDataChanged)

    return () => {
      window.removeEventListener("studentDataChanged", handleDataChanged)
      window.removeEventListener("teacherDataChanged", handleDataChanged)
      window.removeEventListener("attendanceDataChanged", handleDataChanged)
      window.removeEventListener("disciplineDataChanged", handleDataChanged)
      window.removeEventListener("staffAttendanceDataChanged", handleDataChanged)
    }
  }, [])

  const loadDashboardData = async (isBackground = false) => {
    // Only toggle isLoading to true if we don't already have cached summary data
    if (!isBackground && !dashboardSummary && !staffStats) {
      setIsLoading(true)
    }
    setError(null)

    try {
      // High-performance consolidated load:
      // db.getDashboardSummary returns active student count, attendance counts, grade distribution,
      // teacher count, pending requests count, discipline stats, recent student in ONE indexed query set.
      // db.getStaffAttendanceStats returns staff clock-in stats & session breakdown.
      const [summary, staffAttendanceStats] = await Promise.all([
        db.getDashboardSummary(todayStr, undefined, isBackground).catch(() => null),
        db.getStaffAttendanceStats(todayStr).catch(() => null),
      ])

      if (summary) {
        setDashboardSummary(summary)
      }
      if (staffAttendanceStats) {
        setStaffStats(staffAttendanceStats)
        setMorningStaffStats(staffAttendanceStats?.sessionBreakdown?.morning ?? staffAttendanceStats)
        setAfternoonStaffStats(staffAttendanceStats?.sessionBreakdown?.afternoon ?? staffAttendanceStats)
      }

      // If backend didn't supply gradeDistribution or totalTeachers, await secondary fallback
      let fallbackPromise: Promise<any> = Promise.resolve()
      if (!summary?.gradeDistribution || summary?.totalTeachers === undefined) {
        fallbackPromise = Promise.all([
          db.getStudents().catch(() => []),
          db.getAttendanceByDate(todayStr).catch(() => []),
          db.getTeachers().catch(() => []),
          db.getAttendanceEditRequests().catch(() => []),
          DisciplineApi.getIncidents({ limit: 10 }).catch(() => ({ items: [] })),
        ]).then(([st, att, tchs, reqs, disc]) => {
          setStudents(st || [])
          setTodayAttendance(att || [])
          setTeachers(tchs || [])
          setEditRequests(reqs || [])
          if (disc && Array.isArray(disc.items)) {
            setIncidents(disc.items)
          } else if (disc && Array.isArray((disc as any).data)) {
            setIncidents((disc as any).data)
          }
        }).catch(() => {})
      } else {
        // Still fetch edit requests and discipline incidents for quick actions
        Promise.all([
          db.getAttendanceByDate(todayStr).catch(() => []),
          db.getAttendanceEditRequests().catch(() => []),
          DisciplineApi.getIncidents({ limit: 10 }).catch(() => ({ items: [] })),
        ]).then(([att, reqs, disc]) => {
          if (att) setTodayAttendance(att)
          if (reqs) setEditRequests(reqs)
          if (disc && Array.isArray(disc.items)) {
            setIncidents(disc.items)
          } else if (disc && Array.isArray((disc as any).data)) {
            setIncidents((disc as any).data)
          }
        }).catch(() => {})
      }

      await fallbackPromise
      setInitialLoadDone(true)
      setIsLoading(false)
    } catch (err: any) {
      console.error("Error loading admin dashboard data:", err)
      setError("Failed to load dashboard data. Click retry to refresh.")
      setInitialLoadDone(true)
      setIsLoading(false)
    }
  }

  const navigateTo = (path: string) => {
    if (onNavigate) {
      const tabName = path.replace("/school/admin/", "").replace("/school/admin", "dashboard")
      onNavigate(tabName)
    } else {
      router.push(path)
    }
  }

  // Calculated Metrics
  const totalStudents = dashboardSummary?.totalStudents ?? students.length
  const totalTeachers = dashboardSummary?.totalTeachers ?? (teachers.length > 0 ? teachers.length : (typeof staffStats?.totalStaff === "number" ? staffStats.totalStaff : 0))
  const totalStaff = typeof staffStats?.totalStaff === "number" ? staffStats.totalStaff : totalTeachers
  const pendingRequestsCount = dashboardSummary?.pendingEditRequestsCount ?? editRequests.filter(r => r.status === "PENDING").length
  const openDisciplineCasesCount = dashboardSummary?.discipline?.openCases ?? incidents.filter(i => i.status === "OPEN" || i.status === "UNDER_REVIEW" || i.status === "INVESTIGATION" || i.status === "ACTION_REQUIRED").length
  const casesRequiringAttentionCount = dashboardSummary?.discipline?.criticalCases ?? incidents.filter(i => (i.severity === "HIGH" || i.severity === "CRITICAL") && (i.status === "OPEN" || i.status === "UNDER_REVIEW" || i.status === "INVESTIGATION" || i.status === "ACTION_REQUIRED")).length

  const getStaffActive = (st: any) => {
    if (!st) return 0
    if (typeof st.checkedIn === "number" && st.checkedIn > 0) {
      return st.checkedIn
    }
    if (typeof st.present === "number" || typeof st.late === "number" || typeof st.earlyDeparture === "number") {
      return (st.present || 0) + (st.late || 0) + (st.earlyDeparture || 0)
    }
    if (typeof st.checkedInCount === "number") {
      return st.checkedInCount
    }
    return 0
  }

  const isStaffSessionMode =
    staffStats?.attendanceMode === "session_based" ||
    (settings?.staffAttendanceMode || (settings as any)?.staff_attendance_mode) === "session_based"

  const dailyActiveStaff = getStaffActive(staffStats)
  const morningActiveStaff = getStaffActive(morningStaffStats)
  const afternoonActiveStaff = getStaffActive(afternoonStaffStats)
  const activeStaffCount = isStaffSessionMode
    ? (morningActiveStaff + afternoonActiveStaff)
    : dailyActiveStaff

  const [sessionFilter, setSessionFilter] = useState<"total" | "morning" | "afternoon">("total")
  const isSessionBased = !!settings && (settings?.attendanceMode === "session_based" || settings?.attendanceMode === "session")

  // Attendance metrics
  const isPresent = (status?: string) => status?.toLowerCase() === "present" || status?.toLowerCase() === "late"

  /**
   * resolveFullDay:
   * Consolidates morning and afternoon sessions into a single daily status.
   * If only one session has been taken so far today (e.g. morning), student's status reflects that session.
   * If both sessions exist, matches strict agreement with precedence for presence/lateness.
   */
  const resolveFullDay = (m?: string, a?: string): "present" | "late" | "excused" | "absent" | null => {
    if (!m && !a) return null
    if (m && !a) return m.toLowerCase() as any
    if (!m && a) return a.toLowerCase() as any
    const mn = m!.toLowerCase()
    const an = a!.toLowerCase()
    if (mn === an) return mn as any
    if (mn === "present" || an === "present") {
      return (mn === "late" || an === "late") ? "late" : "present"
    }
    if (mn === "late" || an === "late") return "late"
    if (mn === "excused" || an === "excused") return "excused"
    return "absent"
  }

  // School-wide attendance metrics filtered by session (Full Day / Morning / Afternoon)
  // Scope: ALL active students in the current academic year (totalStudents)
  const attendanceMetrics = useMemo(() => {
    // Fast path: use pre-aggregated dashboardSummary directly if available
    if (dashboardSummary?.today) {
      if (sessionFilter === "morning" && dashboardSummary.sessionBreakdown?.morning) {
        const m = dashboardSummary.sessionBreakdown.morning
        const present = m.present || 0
        const late = m.late || 0
        const absent = m.absent || 0
        const excused = m.earlyDeparture ?? m.excused ?? 0
        const total = m.total ?? (present + late + absent + excused)
        const notRecorded = Math.max(0, totalStudents - total)
        const rate = totalStudents > 0 && total > 0
          ? Math.round(((present + late) / totalStudents) * 100)
          : 0
        return {
          presentCount: present,
          lateCount: late,
          absentCount: absent,
          excusedCount: excused,
          submittedCount: total,
          notRecordedCount: notRecorded,
          attendanceRate: rate,
        }
      }
      if (sessionFilter === "afternoon" && dashboardSummary.sessionBreakdown?.afternoon) {
        const a = dashboardSummary.sessionBreakdown.afternoon
        const present = a.present || 0
        const late = a.late || 0
        const absent = a.absent || 0
        const excused = a.earlyDeparture ?? a.excused ?? 0
        const total = a.total ?? (present + late + absent + excused)
        const notRecorded = Math.max(0, totalStudents - total)
        const rate = totalStudents > 0 && total > 0
          ? Math.round(((present + late) / totalStudents) * 100)
          : 0
        return {
          presentCount: present,
          lateCount: late,
          absentCount: absent,
          excusedCount: excused,
          submittedCount: total,
          notRecordedCount: notRecorded,
          attendanceRate: rate,
        }
      }

      const t = dashboardSummary.today
      const present = t.present || 0
      const late = t.late || 0
      const absent = t.absent || 0
      const excused = t.earlyDeparture ?? t.excused ?? 0
      const total = t.total ?? (present + late + absent + excused)

      // Use pre-aggregated summary if it has records or if fallback attendance hasn't loaded
      if (total > 0 || todayAttendance.length === 0) {
        const notRecorded = Math.max(0, totalStudents - total)
        const rate = totalStudents > 0 && total > 0
          ? Math.round(((present + late) / totalStudents) * 100)
          : 0
        return {
          presentCount: present,
          lateCount: late,
          absentCount: absent,
          excusedCount: excused,
          submittedCount: total,
          notRecordedCount: notRecorded,
          attendanceRate: rate,
        }
      }
    }

    if (!isSessionBased || sessionFilter !== "total") {
      const records = isSessionBased
        ? todayAttendance.filter(a => a.session?.toLowerCase() === sessionFilter.toLowerCase())
        : todayAttendance

      const present = records.filter(a => a.status?.toLowerCase() === "present").length
      const late = records.filter(a => a.status?.toLowerCase() === "late").length
      const absent = records.filter(a => a.status?.toLowerCase() === "absent").length
      const excused = records.filter(a => a.status?.toLowerCase() === "excused" || a.status?.toLowerCase() === "early_departure").length
      const submitted = records.length
      const notRecorded = Math.max(0, totalStudents - submitted)
      const rate = totalStudents > 0 && submitted > 0
        ? Math.round(((present + late) / totalStudents) * 100)
        : 0

      return {
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        excusedCount: excused,
        submittedCount: submitted,
        notRecordedCount: notRecorded,
        attendanceRate: rate,
      }
    }

    // Full Day in session-based mode: group by student to pair morning & afternoon
    const studentGroups: Record<string, { morning?: string; afternoon?: string }> = {}
    todayAttendance.forEach((a) => {
      const sId = a.student_id
      if (!sId) return
      if (!studentGroups[sId]) studentGroups[sId] = {}
      const sess = a.session?.toLowerCase()
      if (sess === "morning") studentGroups[sId].morning = a.status
      else if (sess === "afternoon") studentGroups[sId].afternoon = a.status
      else studentGroups[sId].morning = a.status
    })

    let present = 0
    let late = 0
    let absent = 0
    let excused = 0

    Object.values(studentGroups).forEach(group => {
      const status = resolveFullDay(group.morning, group.afternoon)
      if (status === "present") present++
      else if (status === "late") late++
      else if (status === "absent") absent++
      else if (status === "excused") excused++
    })

    const submitted = present + late + absent + excused
    const notRecorded = Math.max(0, totalStudents - submitted)
    const rate = totalStudents > 0 && todayAttendance.length > 0
      ? Math.round(((present + late) / totalStudents) * 100)
      : 0

    return {
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      excusedCount: excused,
      submittedCount: submitted,
      notRecordedCount: notRecorded,
      attendanceRate: rate,
    }
  }, [dashboardSummary, todayAttendance, sessionFilter, isSessionBased, totalStudents])

  const {
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    submittedCount,
    notRecordedCount,
    attendanceRate
  } = attendanceMetrics

  // Student Breakdown by Grade
  const gradeCounts: Record<string, number> = {}
  const sectionCounts: Record<string, number> = {}

  students.forEach((st) => {
    const gr = st.grade || "Unassigned"
    const sec = st.section ? `${gr} - ${st.section}` : `${gr} (General)`
    gradeCounts[gr] = (gradeCounts[gr] || 0) + 1
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1
  })

  const sortedGrades = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])
  const sortedSections = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Chart data: Grade Enrollment (pre-aggregated server-side or fallback)
  const gradeChartData = useMemo(() => {
    if (dashboardSummary?.gradeDistribution && dashboardSummary.gradeDistribution.length > 0) {
      return dashboardSummary.gradeDistribution.slice(0, 7).map((item: any) => ({
        grade: (item.grade || "").replace(/^Grade\s+/i, "G-"),
        fullName: item.grade,
        students: item.students || item.count || 0,
      }))
    }
    return sortedGrades.slice(0, 7).map(([grade, count]) => ({
      grade: grade.replace(/^Grade\s+/i, "G-"),
      fullName: grade,
      students: count,
    }))
  }, [dashboardSummary?.gradeDistribution, sortedGrades])

  // Chart data: Today's Attendance Status Donut
  // Includes "Not Recorded" slice for students whose class hasn't been submitted yet
  const statusPieData = useMemo(() => {
    const data = [
      { name: "Present", value: presentCount, color: "#10b981" },
      { name: "Late", value: lateCount, color: "#f59e0b" },
      { name: "Absent", value: absentCount, color: "#ef4444" },
      { name: "Excused", value: excusedCount, color: "#3b82f6" },
      { name: "Not Recorded", value: notRecordedCount, color: "#cbd5e1" },
    ].filter((item) => item.value > 0)

    return data
  }, [presentCount, lateCount, absentCount, excusedCount, notRecordedCount])

  // Recent Students (last 5)
  const recentStudents = useMemo(() => [...students].slice(-5).reverse(), [students])

  // Attendance Edit Requests helpers
  const pendingRequests = useMemo(() => editRequests.filter(r => r.status === "PENDING"), [editRequests])
  const resolvedRequests = useMemo(() => editRequests.filter(r => r.status === "APPROVED" || r.status === "REJECTED"), [editRequests])
  // Dashboard requirement: only display recent 3 pending requests
  const recentPendingRequests = useMemo(() => pendingRequests.slice(0, 3), [pendingRequests])


  const handleApproveRequest = async (requestId: string, note?: string) => {
    setActionLoadingId(requestId)
    try {
      await db.approveAttendanceEditRequest(requestId, note || adminNote)
      notifications.success("Request Approved", "Attendance edit permission granted to the teacher.")
      setSelectedRequestForAction(null)
      setActionType(null)
      setAdminNote("")
      const updated = await db.getAttendanceEditRequests().catch(() => [])
      setEditRequests(updated || [])
    } catch (err: any) {
      notifications.error("Approval Failed", err.message || "Could not approve edit request.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRejectRequest = async (requestId: string, note?: string) => {
    setActionLoadingId(requestId)
    try {
      await db.rejectAttendanceEditRequest(requestId, note || adminNote)
      notifications.success("Request Rejected", "Attendance edit request declined.")
      setSelectedRequestForAction(null)
      setActionType(null)
      setAdminNote("")
      const updated = await db.getAttendanceEditRequests().catch(() => [])
      setEditRequests(updated || [])
    } catch (err: any) {
      notifications.error("Rejection Failed", err.message || "Could not reject edit request.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Discipline overview metrics
  const openDisciplineCases = incidents.filter(i => i.status === "OPEN" || i.status === "UNDER_REVIEW" || i.status === "INVESTIGATION" || i.status === "ACTION_REQUIRED")
  const casesRequiringAttention = openDisciplineCases.filter(i => i.severity === "HIGH" || i.severity === "CRITICAL")

  // System Alerts logic
  const systemAlerts = []
  if (initialLoadDone && !isLoading && totalTeachers === 0) {
    systemAlerts.push({
      id: "no-teachers",
      title: "Incomplete Setup: No Teachers Registered",
      description: "No teaching staff are registered. Register teachers to assign classes.",
      severity: "warning",
      action: () => navigateTo("/school/admin/teachers"),
      actionText: "Add Teachers",
    })
  }
  if (initialLoadDone && !isLoading && totalStudents === 0) {
    systemAlerts.push({
      id: "no-students",
      title: "Incomplete Setup: No Students Enrolled",
      description: "No students enrolled in the current academic year.",
      severity: "warning",
      action: () => navigateTo("/school/admin/students"),
      actionText: "Add Students",
    })
  }



  const activeAcademicYearName = settings?.academicYear || "2017 E.C."
  const activeTerm = settings?.currentTerm || "Semester 1"

  return (
    <div className="space-y-6 px-4 md:px-0 pb-24 max-w-[1600px] mx-auto">
      {/* Error Banner */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => loadDashboardData()}
          className="mb-4"
        />
      )}

      {/* 1. MODERN HEADER (Matching Student Attendance Page Aesthetic) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="space-y-1 w-full md:w-auto">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            {greeting}, <span className="text-primary">{adminName}</span>
          </h2>
          <p className="text-xs md:text-sm font-medium text-muted-foreground">
            Comprehensive overview of school operations, student attendance, academics, and staff
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Session Filter Tabs (Full Day / Morning / Afternoon) */}
          {isSessionBased && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Button
                variant={sessionFilter === "total" ? "default" : "ghost"}
                onClick={() => setSessionFilter("total")}
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-full transition-all",
                  sessionFilter === "total" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Full Day
              </Button>
              <Button
                variant={sessionFilter === "morning" ? "default" : "ghost"}
                onClick={() => setSessionFilter("morning")}
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-full transition-all",
                  sessionFilter === "morning" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Morning
              </Button>
              <Button
                variant={sessionFilter === "afternoon" ? "default" : "ghost"}
                onClick={() => setSessionFilter("afternoon")}
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-full transition-all",
                  sessionFilter === "afternoon" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Afternoon
              </Button>
            </div>
          )}

          {/* Date & Refresh Pill */}
          <div className="text-xs font-semibold bg-primary/10 text-primary px-3.5 py-2 rounded-full border border-primary/20 shadow-2xs flex items-center gap-2.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(new Date(), { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
            <button
              onClick={() => loadDashboardData()}
              className="hover:text-primary-focus transition-colors p-0.5 rounded-full hover:bg-primary/20"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading ? "animate-spin" : "")} />
            </button>
          </div>


        </div>
      </div>

      {/* 2. SYSTEM ALERTS (If any actionable warnings) */}
      {systemAlerts.length > 0 && (
        <div className="space-y-3">
          {systemAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm",
                alert.severity === "danger"
                  ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                  : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className={cn(
                  "w-5 h-5 mt-0.5 shrink-0",
                  alert.severity === "danger" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                )} />
                <div>
                  <h4 className="font-bold text-sm">{alert.title}</h4>
                  <p className="text-xs opacity-90 mt-0.5">{alert.description}</p>
                </div>
              </div>
              <Button
                onClick={alert.action}
                size="sm"
                className={cn(
                  "shrink-0 rounded-xl font-bold text-xs shadow-sm",
                  alert.severity === "danger"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                {alert.actionText}
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 3. 5 TOP OVERVIEW STAT CARDS (Matching Announcement/Attendance Card Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Total Students",
            value: totalStudents,
            sub: `${sortedGrades.length} Grades`,
            icon: GraduationCap,
            iconBg: "bg-slate-100 dark:bg-slate-800",
            iconColor: "text-slate-600 dark:text-slate-400",
            valColor: "text-foreground",
            href: "/school/admin/students",
          },
          {
            label: "Total Staff",
            value: totalStaff,
            sub: "Registered",
            icon: Users,
            iconBg: "bg-slate-100 dark:bg-slate-800",
            iconColor: "text-slate-600 dark:text-slate-400",
            valColor: "text-foreground",
            href: "/school/admin/teachers",
          },
          {
            label: "Attendance Rate",
            value: `${attendanceRate}%`,
            sub: `${presentCount + lateCount} of ${totalStudents} Present${sessionFilter !== "total" ? ` (${sessionFilter === "morning" ? "Morning" : "Afternoon"})` : ""}`,
            icon: TrendingUp,
            iconBg: "bg-slate-100 dark:bg-slate-800",
            iconColor: "text-slate-600 dark:text-slate-400",
            valColor: attendanceRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : attendanceRate >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400",
            href: `/school/admin/attendance${sessionFilter !== "total" ? `?session=${sessionFilter}` : ""}`,
          },
          {
            label: "Staff On Duty",
            value: (
              <div className="flex items-center justify-center gap-1">
                <span>
                  {!isStaffSessionMode
                    ? dailyActiveStaff
                    : sessionFilter === "morning"
                    ? morningActiveStaff
                    : sessionFilter === "afternoon"
                    ? afternoonActiveStaff
                    : (dailyActiveStaff || activeStaffCount)}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">/{totalStaff}</span>
              </div>
            ),
            sub: !isStaffSessionMode
              ? `${dailyActiveStaff} of ${totalStaff} clocked in`
              : sessionFilter === "morning"
              ? `Morning: ${morningActiveStaff} of ${totalStaff}`
              : sessionFilter === "afternoon"
              ? `Afternoon: ${afternoonActiveStaff} of ${totalStaff}`
              : `Morn. ${morningActiveStaff} · Aft. ${afternoonActiveStaff}`,
            icon: UserCheck,
            iconBg: "bg-slate-100 dark:bg-slate-800",
            iconColor: "text-slate-600 dark:text-slate-400",
            valColor: "text-foreground",
            href: `/school/admin/staff-attendance${isStaffSessionMode && sessionFilter !== "total" ? `?session=${sessionFilter}` : ""}`,
          },
          {
            label: "Open Conduct Cases",
            value: openDisciplineCasesCount,
            sub: `${casesRequiringAttentionCount} High Severity`,
            icon: ShieldAlert,
            iconBg: casesRequiringAttentionCount > 0 ? "bg-rose-50 dark:bg-rose-950/40" : "bg-slate-100 dark:bg-slate-800",
            iconColor: casesRequiringAttentionCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400",
            valColor: casesRequiringAttentionCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
            href: "/school/admin/discipline",
          },
        ].map((item, idx) => (
          <div
            key={idx}
            onClick={() => navigateTo(item.href)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                navigateTo(item.href)
              }
            }}
            role="button"
            tabIndex={0}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col gap-3 shadow-sm transition-all duration-200 group hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20 select-none"
          >
            {/* Top row: icon + label */}
            <div className="flex items-center gap-2.5">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", item.iconBg, item.iconColor)}>
                <item.icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                {item.label}
              </p>
            </div>
            {/* Value */}
            <div className={cn("text-2xl font-black tracking-tight leading-none", item.valColor)}>
              {isLoading ? (
                <span className="inline-block w-14 h-7 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
              ) : (
                item.value
              )}
            </div>
            {/* Sub-text */}
            <p className="text-[10px] font-medium text-muted-foreground/70 leading-snug -mt-1.5">
              {isLoading ? (
                <span className="inline-block w-20 h-2.5 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
              ) : (
                item.sub
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Edit Requests Quick Action Banner */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-sm transition-all",
          pendingRequestsCount > 0
            ? "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
            : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
            pendingRequestsCount > 0
              ? "bg-amber-100 dark:bg-amber-900/40"
              : "bg-slate-100 dark:bg-slate-800"
          )}>
            <FileCheck className={cn(
              "w-4 h-4",
              pendingRequestsCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-400"
            )} />
          </div>
          <div>
            <p className="text-xs font-black text-foreground uppercase tracking-wider">
              Attendance Edit Requests
            </p>
            <p className={cn(
              "text-[11px] font-medium",
              pendingRequestsCount > 0
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground"
            )}>
              {pendingRequestsCount > 0
                ? `${pendingRequests.length} request${pendingRequests.length > 1 ? "s" : ""} awaiting your review`
                : "All clear — no pending requests"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => router.push("/school/admin/attendance/requests")}
          className={cn(
            "h-8 px-3 text-xs font-bold rounded-xl gap-1.5 shrink-0",
            pendingRequestsCount > 0
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              : "variant-outline border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          {pendingRequestsCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-white/20 text-white text-[10px] font-black">
              {pendingRequestsCount}
            </span>
          )}
          View Requests
          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
        </Button>
      </div>

      {/* 4. ANALYTICS & VISUALIZATIONS SECTION (2:1 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Grade Enrollment Chart */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight">
              Student Enrollment by Grade
            </h3>
          </div>

          <div className="h-[310px] w-full p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full bg-slate-100/80 dark:bg-slate-800/30 animate-pulse rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="grade" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}
                    itemStyle={{ color: "#3b82f6", fontWeight: "bold" }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value: number) => [`${value} Students`, "Enrolled"]}
                  />
                  <Bar dataKey="students" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Today's Status Donut */}
        <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <CardHeader className="pb-0 border-none">
            <div className="flex items-center justify-between">
              <CardTitle className="typography-card-title flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                Today's Status
              </CardTitle>
              {isSessionBased && (
                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                  {sessionFilter === "total" ? "Full Day" : `${sessionFilter}`}
                </Badge>
              )}
            </div>
            {/* School-wide coverage pill */}
            {!isLoading && totalStudents > 0 && (
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                <span className={cn(
                  "font-bold",
                  notRecordedCount === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}>
                  {submittedCount} of {totalStudents}
                </span>{" "}
                students recorded
                {notRecordedCount === 0
                  ? " · Full coverage ✓"
                  : ` · ${notRecordedCount} unsubmitted`}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[220px] w-full mt-4 bg-slate-100 dark:bg-slate-800/20 animate-pulse rounded-2xl" />
            ) : totalStudents > 0 ? (
              <div className="h-[250px] w-full mt-3 p-2 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-200 dark:border-slate-700">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={78}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}
                      itemStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                      formatter={(value: number, name: string) => [
                        `${value} student${value !== 1 ? "s" : ""} (${totalStudents > 0 ? Math.round((value / totalStudents) * 100) : 0}%)`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground gap-3">
                <div className="p-4 bg-muted rounded-full">
                  <AlertTriangle className="w-8 h-8 opacity-20" />
                </div>
                <p className="typography-label">No students enrolled yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>



      {/* Action Dialog for Approval/Rejection with Optional Note */}
      <Dialog open={!!selectedRequestForAction} onOpenChange={(open) => !open && setSelectedRequestForAction(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {actionType === "approve" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Approve Attendance Edit Request
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  Reject Attendance Edit Request
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {actionType === "approve"
                ? `Grant permission to ${selectedRequestForAction?.teacher?.name || "Teacher"} to edit attendance for ${selectedRequestForAction?.date?.split("T")[0] || ""}.`
                : `Decline attendance edit request from ${selectedRequestForAction?.teacher?.name || "Teacher"}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {selectedRequestForAction?.reason && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">Teacher's Reason:</span>
                <p className="text-xs text-foreground italic">"{selectedRequestForAction.reason}"</p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Admin Note / Remarks (Optional)
              </label>
              <Textarea
                rows={2}
                placeholder={actionType === "approve" ? "e.g. Approved. Please update by 4:00 PM." : "e.g. Request denied. Records are already audited."}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRequestForAction(null)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!!actionLoadingId}
              onClick={() => {
                if (actionType === "approve") {
                  handleApproveRequest(selectedRequestForAction.id, adminNote)
                } else {
                  handleRejectRequest(selectedRequestForAction.id, adminNote)
                }
              }}
              className={cn(
                "rounded-xl text-xs font-bold text-white",
                actionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {actionLoadingId ? "Processing..." : actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. RECENT ADMINISTRATIVE ACTIVITY FEED (Matching the clean Feed in Student Attendance Dashboard) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              School Operations Stream
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight opacity-70 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            Realtime
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 animate-pulse shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full mt-2" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Academic Cycle Card */}
            <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold border border-purple-500/20">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground uppercase tracking-tight">Academic Cycle</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{activeAcademicYearName}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200">
                    {activeTerm}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Active term in session with {sortedGrades.length} registered grade levels and live attendance monitoring.
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Student Registration Stream */}
            <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold border border-blue-500/20">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground uppercase tracking-tight">Student Body</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{totalStudents} Enrolled</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200">
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {dashboardSummary?.recentStudent?.name
                    ? `Latest enrolled student: ${dashboardSummary.recentStudent.name} (${dashboardSummary.recentStudent.grade || "Grade N/A"}).`
                    : recentStudents.length > 0
                    ? `Latest enrolled student: ${recentStudents[0]?.first_name ? `${recentStudents[0].first_name} ${recentStudents[0].last_name || ""}`.trim() : (recentStudents[0]?.name || "Student")} (${recentStudents[0]?.grade || "Grade N/A"}).`
                    : "All student enrollment records verified and in good standing."}
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Conduct & Safety Stream */}
            <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 font-bold border border-rose-500/20">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground uppercase tracking-tight">School Climate</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{openDisciplineCasesCount} Open Cases</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold",
                      casesRequiringAttention.length > 0
                        ? "text-rose-600 bg-rose-50 border-rose-200"
                        : "text-emerald-600 bg-emerald-50 border-emerald-200"
                    )}
                  >
                    {casesRequiringAttentionCount > 0 ? "Review Required" : "Stable"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {casesRequiringAttentionCount > 0
                    ? `${casesRequiringAttentionCount} cases flagged for administrative follow-up.`
                    : "Campus conduct guidelines and student discipline tracking up to date."}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
