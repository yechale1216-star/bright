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
  CheckCircle2, XCircle, Clock, Lock, MessageSquare, Check, X,
  Sun, Sunset
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { notifications } from "@/lib/utils/notifications"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
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

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeChartTab, setActiveChartTab] = useState<"trend" | "grades">("trend")

  // Data states
  const [dashboardSummary, setDashboardSummary] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])
  const [incidents, setIncidents] = useState<StudentDiscipline[]>([])
  const [staffStats, setStaffStats] = useState<any>(null)
  const [morningStaffStats, setMorningStaffStats] = useState<any>(null)
  const [afternoonStaffStats, setAfternoonStaffStats] = useState<any>(null)
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
    if (!isBackground) setIsLoading(true)
    setError(null)

    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })

      // Phase 1 — Fast critical path: lightweight summary + staff stats (single request each)
      // getDashboardSummary replaces: getStudents + getAttendanceByDate + getAttendanceByDateRange
      // getStaffAttendanceStats replaces 3 concurrent calls with 1 (sessions split client-side)
      const [summary, staffAttendanceStats, disciplineRes, fetchedEditRequests, fetchedTeachers] =
        await Promise.all([
          db.getDashboardSummary(today).catch(() => null),
          db.getStaffAttendanceStats(today).catch(() => null),
          DisciplineApi.getIncidents({ limit: 10 }).catch(() => ({ items: [] })),
          db.getAttendanceEditRequests().catch(() => []),
          db.getTeachers().catch(() => []),
        ])

      if (summary) {
        setDashboardSummary(summary)
      }
      setTeachers(fetchedTeachers || [])
      setStaffStats(staffAttendanceStats)
      // In session mode, the single stats response contains both morning & afternoon
      setMorningStaffStats(staffAttendanceStats?.sessionBreakdown?.morning ?? staffAttendanceStats)
      setAfternoonStaffStats(staffAttendanceStats?.sessionBreakdown?.afternoon ?? staffAttendanceStats)
      setEditRequests(fetchedEditRequests || [])

      if (disciplineRes && Array.isArray(disciplineRes.items)) {
        setIncidents(disciplineRes.items)
      } else if (disciplineRes && Array.isArray((disciplineRes as any).data)) {
        setIncidents((disciplineRes as any).data)
      } else if (Array.isArray(disciplineRes)) {
        setIncidents(disciplineRes)
      }

      // Phase 2 — Background (non-blocking): load full student & detailed attendance
      // only when needed for the student-breakdown chart or grade view
      setIsLoading(false)
      Promise.all([
        db.getStudents().catch(() => []),
        db.getAttendanceByDate(today).catch(() => []),
      ]).then(([fetchedStudents, fetchedTodayAttendance]) => {
        setStudents(fetchedStudents || [])
        setTodayAttendance(fetchedTodayAttendance || [])
      }).catch(() => {})

    } catch (err: any) {
      console.error("Error loading admin dashboard data:", err)
      setError("Failed to load dashboard data. Click retry to refresh.")
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
  // Prefer fast dashboardSummary count (available ~200ms); falls back to full student list when loaded
  const totalStudents = dashboardSummary?.totalStudents ?? students.length
  const totalTeachers = teachers.length
  const totalStaff = typeof staffStats?.totalStaff === "number" ? staffStats.totalStaff : totalTeachers

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
  const isSessionBased = !settings || settings?.attendanceMode === "session_based" || settings?.attendanceMode === "session"

  // Attendance metrics
  const isPresent = (status?: string) => status?.toLowerCase() === "present" || status?.toLowerCase() === "late"

  /**
   * resolveFullDay — strict matching rule (matches student attendance page):
   * A student is only counted for full day when BOTH morning and afternoon sessions
   * have the EXACT same status:
   *   morning present  + afternoon present  → full day present
   *   morning late     + afternoon late     → full day late
   *   morning excused  + afternoon excused  → full day excused
   *   morning absent   + afternoon absent   → full day absent
   *
   * Mixed combinations (e.g. morning present, afternoon late/absent) or single-session
   * records do NOT count towards any full-day status (returns null).
   */
  const resolveFullDay = (m?: string, a?: string): "present" | "late" | "excused" | "absent" | null => {
    if (!m || !a) return null
    const mn = m.toLowerCase()
    const an = a.toLowerCase()
    if (mn !== an) return null
    if (mn === "present") return "present"
    if (mn === "late") return "late"
    if (mn === "excused") return "excused"
    if (mn === "absent") return "absent"
    return null
  }

  // School-wide attendance metrics filtered by session (Full Day / Morning / Afternoon)
  // Scope: ALL active students in the current academic year (totalStudents)
  const attendanceMetrics = useMemo(() => {
    // Fast path: use pre-aggregated today summary (available within ~200ms)
    // Only used while todayAttendance (Phase 2) hasn't loaded yet
    if (dashboardSummary?.today && todayAttendance.length === 0) {
      const { present, absent, late, earlyDeparture, total } = dashboardSummary.today
      const notRecorded = Math.max(0, totalStudents - total)
      const rate = totalStudents > 0 && total > 0
        ? Math.round(((present + late) / totalStudents) * 100)
        : 0
      return {
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        excusedCount: earlyDeparture,
        submittedCount: total,
        notRecordedCount: notRecorded,
        attendanceRate: rate,
      }
    }

    if (!isSessionBased || sessionFilter !== "total") {
      const records = isSessionBased
        ? todayAttendance.filter(a => a.session?.toLowerCase() === sessionFilter.toLowerCase())
        : todayAttendance

      const present = records.filter(a => a.status?.toLowerCase() === "present").length
      const late = records.filter(a => a.status?.toLowerCase() === "late").length
      const absent = records.filter(a => a.status?.toLowerCase() === "absent").length
      const excused = records.filter(a => a.status?.toLowerCase() === "excused").length
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

  // Chart data: 5-Day Attendance Trend (School Weekdays)
  const trendData = useMemo(() => {
    // Fast path: use pre-aggregated data from dashboardSummary (available immediately)
    if (dashboardSummary?.trend?.length > 0 && allAttendance.length === 0) {
      return dashboardSummary.trend
        .slice(-5)
        .map((item: any) => {
          const dateObj = new Date(item.date + "T00:00:00")
          const label = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          const rate = totalStudents > 0 && item.total > 0
            ? Math.round(((item.present + item.late) / totalStudents) * 100)
            : (item.total > 0 ? Math.round(((item.present + item.late) / item.total) * 100) : 0)
          return {
            date: label,
            rate,
            present: item.present,
            total: totalStudents > 0 ? totalStudents : item.total,
            recorded: item.total,
          }
        })
    }

    // Full path: compute from detailed attendance records (once Phase 2 loads)
    const TARGET_TZ = "Africa/Addis_Ababa"
    const trendDataMap: Record<string, { dateStr: string; present: number; total: number }> = {}
    let daysFound = 0
    let dayOffset = 0

    const getTargetDateStr = (date: Date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TARGET_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date)
      const y = parts.find((p) => p.type === "year")?.value
      const m = parts.find((p) => p.type === "month")?.value
      const d = parts.find((p) => p.type === "day")?.value
      return `${y}-${m}-${d}`
    }

    const currentAddisDate = new Date()

    while (daysFound < 5 && dayOffset < 14) {
      const d = new Date(currentAddisDate)
      d.setDate(d.getDate() - dayOffset)

      const dayShort = new Intl.DateTimeFormat("en-US", {
        timeZone: TARGET_TZ,
        weekday: "short",
      }).format(d)

      if (dayShort !== "Sat" && dayShort !== "Sun") {
        const dateStr = getTargetDateStr(d)
        trendDataMap[dateStr] = { dateStr, present: 0, total: 0 }
        daysFound++
      }
      dayOffset++
    }

    if (!isSessionBased || sessionFilter !== "total") {
      allAttendance.forEach((record) => {
        const d = record.attendance_date || (record as any).date
        if (!d || !trendDataMap[d]) return

        if (isSessionBased) {
          const sess = record.session?.toLowerCase()
          if (sess !== sessionFilter.toLowerCase()) return
        }

        trendDataMap[d].total++
        if (isPresent(record.status)) {
          trendDataMap[d].present++
        }
      })
    } else {
      // Full Day session-based: group by (date + student)
      const dateStudentGroups: Record<string, Record<string, { morning?: string; afternoon?: string }>> = {}

      allAttendance.forEach((record) => {
        const d = record.attendance_date || (record as any).date
        if (!d || !trendDataMap[d]) return
        const sId = record.student_id
        if (!sId) return

        if (!dateStudentGroups[d]) dateStudentGroups[d] = {}
        if (!dateStudentGroups[d][sId]) dateStudentGroups[d][sId] = {}

        const sess = record.session?.toLowerCase()
        if (sess === "morning") dateStudentGroups[d][sId].morning = record.status
        else if (sess === "afternoon") dateStudentGroups[d][sId].afternoon = record.status
        else dateStudentGroups[d][sId].morning = record.status
      })

      Object.entries(dateStudentGroups).forEach(([d, studentsMap]) => {
        if (!trendDataMap[d]) return
        trendDataMap[d].total = Object.keys(studentsMap).length
        Object.values(studentsMap).forEach((group) => {
          const status = resolveFullDay(group.morning, group.afternoon)
          if (status === "present" || status === "late") {
            trendDataMap[d].present++
          }
        })
      })
    }

    return Object.values(trendDataMap)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
      .map((item) => {
        const dateObj = new Date(item.dateStr + "T00:00:00")
        const label = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        const rate = totalStudents > 0 && item.total > 0
          ? Math.round((item.present / totalStudents) * 100)
          : (item.total > 0 ? Math.round((item.present / item.total) * 100) : 0)
        return {
          date: label,
          rate,
          present: item.present,
          total: totalStudents > 0 ? totalStudents : item.total,
          recorded: item.total,
        }
      })
  }, [dashboardSummary, allAttendance, sessionFilter, isSessionBased, totalStudents])

  // Chart data: Grade Enrollment
  const gradeChartData = useMemo(() => {
    return sortedGrades.slice(0, 7).map(([grade, count]) => ({
      grade: grade.replace(/^Grade\s+/i, "G-"),
      fullName: grade,
      students: count,
    }))
  }, [sortedGrades])

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
  if (!isLoading && totalTeachers === 0) {
    systemAlerts.push({
      id: "no-teachers",
      title: "Incomplete Setup: No Teachers Registered",
      description: "No teaching staff are registered. Register teachers to assign classes.",
      severity: "warning",
      action: () => navigateTo("/school/admin/teachers"),
      actionText: "Add Teachers",
    })
  }
  if (!isLoading && totalStudents === 0) {
    systemAlerts.push({
      id: "no-students",
      title: "Incomplete Setup: No Students Enrolled",
      description: "No students enrolled in the current academic year.",
      severity: "warning",
      action: () => navigateTo("/school/admin/students"),
      actionText: "Add Students",
    })
  }
  if (casesRequiringAttention.length > 0) {
    systemAlerts.push({
      id: "urgent-discipline",
      title: `${casesRequiringAttention.length} High-Severity Discipline Case(s)`,
      description: "Discipline incidents requiring immediate administrative review.",
      severity: "danger",
      action: () => navigateTo("/school/admin/discipline"),
      actionText: "Review Cases",
    })
  }
  if (pendingRequests.length > 0) {
    systemAlerts.push({
      id: "pending-edit-requests",
      title: `${pendingRequests.length} Attendance Edit Request${pendingRequests.length > 1 ? "s" : ""} Pending`,
      description: "Teachers have requested permission to modify submitted attendance records.",
      severity: "warning",
      action: () => router.push("/school/admin/attendance/requests"),
      actionText: "Review Requests",
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
            iconBg: "bg-blue-50 dark:bg-blue-900/20",
            iconColor: "text-blue-600 dark:text-blue-400",
            valColor: "text-blue-600 dark:text-blue-400",
            href: "/school/admin/students",
          },
          {
            label: "Total Staff",
            value: totalStaff,
            sub: "Registered",
            icon: Users,
            iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            valColor: "text-emerald-600 dark:text-emerald-400",
            href: "/school/admin/teachers",
          },
          {
            label: "Attendance Rate",
            value: `${attendanceRate}%`,
            sub: `${presentCount + lateCount} of ${totalStudents} Present${sessionFilter !== "total" ? ` (${sessionFilter === "morning" ? "Morning" : "Afternoon"})` : ""}`,
            icon: TrendingUp,
            iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
            iconColor: "text-indigo-600 dark:text-indigo-400",
            valColor: "text-indigo-600 dark:text-indigo-400",
            href: `/school/admin/attendance${sessionFilter !== "total" ? `?session=${sessionFilter}` : ""}`,
          },
          {
            label: "Staff On Duty",
            value: !isStaffSessionMode ? (
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-2xl md:text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{dailyActiveStaff}</span>
                <span className="text-xs font-semibold text-muted-foreground">/{totalStaff}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 ml-0.5 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" /> Daily
                </span>
              </div>
            ) : sessionFilter === "morning" ? (
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-2xl md:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{morningActiveStaff}</span>
                <span className="text-xs font-semibold text-muted-foreground">/{totalStaff}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ml-0.5 flex items-center gap-0.5">
                  <Sun className="w-2.5 h-2.5 text-amber-600" /> Morn
                </span>
              </div>
            ) : sessionFilter === "afternoon" ? (
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-2xl md:text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">{afternoonActiveStaff}</span>
                <span className="text-xs font-semibold text-muted-foreground">/{totalStaff}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 ml-0.5 flex items-center gap-0.5">
                  <Sunset className="w-2.5 h-2.5 text-indigo-600" /> Aft
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full">
                <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                  <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 dark:text-amber-400">M:</span>
                  <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300">{morningActiveStaff}</span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">/{totalStaff}</span>
                </div>
                <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                  <Sunset className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-400">A:</span>
                  <span className="text-sm sm:text-base font-black text-indigo-700 dark:text-indigo-300">{afternoonActiveStaff}</span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">/{totalStaff}</span>
                </div>
              </div>
            ),
            sub: !isStaffSessionMode
              ? `${dailyActiveStaff} of ${totalStaff} staff clocked in today`
              : sessionFilter === "morning"
              ? `Morning: ${morningActiveStaff} of ${totalStaff} on duty`
              : sessionFilter === "afternoon"
              ? `Afternoon: ${afternoonActiveStaff} of ${totalStaff} on duty`
              : `Morning (${morningActiveStaff}) · Afternoon (${afternoonActiveStaff})`,
            icon: UserCheck,
            iconBg: "bg-purple-50 dark:bg-purple-900/20",
            iconColor: "text-purple-600 dark:text-purple-400",
            valColor: "text-purple-600 dark:text-purple-400",
            href: `/school/admin/staff-attendance${isStaffSessionMode && sessionFilter !== "total" ? `?session=${sessionFilter}` : ""}`,
          },
          {
            label: "Open Conduct Cases",
            value: openDisciplineCases.length,
            sub: `${casesRequiringAttention.length} High Severity`,
            icon: ShieldAlert,
            iconBg: casesRequiringAttention.length > 0 ? "bg-rose-50 dark:bg-rose-900/20" : "bg-amber-50 dark:bg-amber-900/20",
            iconColor: casesRequiringAttention.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
            valColor: casesRequiringAttention.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
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
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center text-center gap-1.5 shadow-sm transition-all duration-200 group hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20 select-none"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110", item.iconBg, item.iconColor)}>
              <item.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 leading-tight mt-1">
              {item.label}
            </p>
            <div className={cn("text-2xl md:text-3xl font-bold tracking-tight leading-none min-h-[32px] flex items-center justify-center", item.valColor)}>
              {isLoading ? (
                <span className="inline-block w-12 h-7 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
              ) : (
                item.value
              )}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground/80 truncate min-h-[14px] flex items-center justify-center">
              {isLoading ? (
                <span className="inline-block w-16 h-2.5 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-0.5" />
              ) : (
                item.sub
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 4. ANALYTICS & VISUALIZATIONS SECTION (2:1 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Dynamics Chart with Tabs */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">
                {activeChartTab === "trend"
                  ? `5-Day Attendance Trend${sessionFilter !== "total" ? ` (${sessionFilter === "morning" ? "Morning" : "Afternoon"})` : ""}`
                  : "Student Enrollment by Grade"}
              </h3>
            </div>

            {/* Tab Filter Pills */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
              <Button
                variant={activeChartTab === "trend" ? "default" : "ghost"}
                onClick={() => setActiveChartTab("trend")}
                size="sm"
                className="h-6 px-2.5 text-[11px] font-bold rounded-full"
              >
                Trend
              </Button>
              <Button
                variant={activeChartTab === "grades" ? "default" : "ghost"}
                onClick={() => setActiveChartTab("grades")}
                size="sm"
                className="h-6 px-2.5 text-[11px] font-bold rounded-full"
              >
                Grades
              </Button>
            </div>
          </div>

          <div className="h-[310px] w-full p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full bg-slate-100/80 dark:bg-slate-800/30 animate-pulse rounded-xl" />
            ) : activeChartTab === "trend" ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAdminTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "var(--primary)", fontWeight: "bold" }}
                    labelStyle={{ color: "var(--foreground)", marginBottom: "4px" }}
                    formatter={(value: number) => [`${value}%`, "Attendance Rate"]}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAdminTrend)" />
                </AreaChart>
              </ResponsiveContainer>
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

      {/* 5. ATTENDANCE EDIT REQUESTS SECTION (RECENT 3 PENDING ONLY) */}
      <div id="attendance-edit-requests-section" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Pending Attendance Edit Requests
            </h3>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded-full",
                pendingRequests.length > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              )}
            >
              {pendingRequests.length > 0 ? `${pendingRequests.length} Pending Approval` : "All Cleared"}
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/school/admin/attendance/requests")}
            className="h-8 px-3 text-xs font-bold rounded-xl gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span>View All Requests ({editRequests.length})</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 animate-pulse shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="space-y-1.5 w-full">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : recentPendingRequests.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <FileCheck className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-bold text-foreground">
              No Pending Attendance Edit Requests
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              All teacher attendance submissions are locked and in sync. New unlock requests will appear here for review.
            </p>
            {editRequests.length > 0 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/school/admin/attendance/requests")}
                  className="h-8 px-3 text-xs font-bold rounded-xl"
                >
                  View Request History ({editRequests.length})
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {recentPendingRequests.map((req: any) => {
                const teacherName = req.teacher?.name || "Teacher"
                const teacherInitial = teacherName.slice(0, 1).toUpperCase()
                const reqDate = req.date ? req.date.split("T")[0] : "N/A"
                const isActingOnThis = actionLoadingId === req.id

                return (
                  <Card
                    key={req.id}
                    className="border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md group flex flex-col justify-between"
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Teacher & Status Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black shrink-0">
                            {teacherInitial}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-foreground uppercase tracking-tight truncate">
                              {teacherName}
                            </p>
                            <p className="text-[10px] font-semibold text-muted-foreground/80 flex items-center gap-1">
                              <Clock className="w-3 h-3 opacity-60" />
                              {req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold uppercase px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                        >
                          Pending
                        </Badge>
                      </div>

                      {/* Target Date & Session Details */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground text-[11px] font-medium">Target Date:</span>
                          <span className="font-bold text-foreground font-mono">{reqDate}</span>
                        </div>
                        {req.session && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground text-[11px] font-medium">Session:</span>
                            <Badge variant="outline" className="text-[10px] font-semibold capitalize bg-white dark:bg-slate-800 border-slate-200">
                              {req.session}
                            </Badge>
                          </div>
                        )}
                        {req.reason && (
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic line-clamp-2">
                              "{req.reason}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={isActingOnThis}
                          onClick={() => {
                            setSelectedRequestForAction(req)
                            setActionType("approve")
                            setAdminNote("")
                          }}
                          className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isActingOnThis}
                          onClick={() => {
                            setSelectedRequestForAction(req)
                            setActionType("reject")
                            setAdminNote("")
                          }}
                          className="flex-1 h-8 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold rounded-xl"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* If more than 3 pending requests, show banner */}
            {pendingRequests.length > 3 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    Showing the 3 most recent requests. <strong>{pendingRequests.length - 3} more</strong> pending request{pendingRequests.length - 3 > 1 ? "s" : ""} awaiting your review.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push("/school/admin/attendance/requests")}
                  className="h-7 px-3 text-[11px] font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shrink-0 self-start sm:self-auto shadow-xs"
                >
                  View All {pendingRequests.length} Pending
                </Button>
              </div>
            )}
          </div>
        )}
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
                  {recentStudents.length > 0
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
                      <p className="text-[10px] font-semibold text-muted-foreground">{openDisciplineCases.length} Open Cases</p>
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
                    {casesRequiringAttention.length > 0 ? "Review Required" : "Stable"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {casesRequiringAttention.length > 0
                    ? `${casesRequiringAttention.length} cases flagged for administrative follow-up.`
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
