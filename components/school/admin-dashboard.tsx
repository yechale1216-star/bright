"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ErrorBanner } from "@/components/ui/data-state-view"
import {
  Users, UserCheck, ShieldAlert, GraduationCap, Calendar, Bell,
  ChevronRight, BookOpen, TrendingUp, Sparkles, ShieldCheck,
  Activity, AlertTriangle, RefreshCw, BarChart3, FileCheck,
  CheckCircle2, XCircle, Clock, Lock, MessageSquare, Check, X
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { notifications } from "@/lib/utils/notifications"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from "recharts"

import { db, type Student, type AttendanceRecord } from "@/lib/db/database"
import { DisciplineApi, type StudentDiscipline } from "@/lib/discipline-service"
import { useAuth } from "@/lib/context/auth-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { useCalendar } from "@/lib/context/calendar-context"
import { useGreeting } from "@/lib/utils/greeting-utils"
import { useUnread } from "@/lib/context/unread-context"
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
  const { totalUnreadCount } = useUnread()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeChartTab, setActiveChartTab] = useState<"trend" | "grades">("trend")

  // Data states
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([])
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([])
  const [incidents, setIncidents] = useState<StudentDiscipline[]>([])
  const [staffStats, setStaffStats] = useState<any>(null)
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

    return () => {
      window.removeEventListener("studentDataChanged", handleDataChanged)
      window.removeEventListener("teacherDataChanged", handleDataChanged)
      window.removeEventListener("attendanceDataChanged", handleDataChanged)
      window.removeEventListener("disciplineDataChanged", handleDataChanged)
    }
  }, [])

  const loadDashboardData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true)
    setError(null)

    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })

      const [
        fetchedStudents,
        fetchedTeachers,
        fetchedTodayAttendance,
        fetchedAllAttendance,
        staffAttendanceStats,
        disciplineRes,
        fetchedEditRequests
      ] = await Promise.all([
        db.getStudents().catch(() => []),
        db.getTeachers().catch(() => []),
        db.getAttendanceByDate(today).catch(() => []),
        db.getAttendance().catch(() => []),
        db.getStaffAttendanceStats().catch(() => null),
        DisciplineApi.getIncidents({ limit: 10 }).catch(() => ({ items: [] })),
        db.getAttendanceEditRequests().catch(() => [])
      ])

      setStudents(fetchedStudents || [])
      setTeachers(fetchedTeachers || [])
      setTodayAttendance(fetchedTodayAttendance || [])
      setAllAttendance(fetchedAllAttendance || [])
      setStaffStats(staffAttendanceStats)
      setEditRequests(fetchedEditRequests || [])

      if (disciplineRes && Array.isArray(disciplineRes.items)) {
        setIncidents(disciplineRes.items)
      } else if (disciplineRes && Array.isArray((disciplineRes as any).data)) {
        setIncidents((disciplineRes as any).data)
      } else if (Array.isArray(disciplineRes)) {
        setIncidents(disciplineRes)
      }
    } catch (err: any) {
      console.error("Error loading admin dashboard data:", err)
      setError("Failed to load dashboard data. Click retry to refresh.")
    } finally {
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
  const totalStudents = students.length
  const totalTeachers = teachers.length
  const totalStaff = typeof staffStats?.totalStaff === "number" ? staffStats.totalStaff : totalTeachers
  const activeStaffCount = staffStats
    ? (typeof staffStats.present === "number" || typeof staffStats.late === "number"
        ? (staffStats.present || 0) + (staffStats.late || 0)
        : (staffStats.checkedInCount || totalTeachers))
    : totalTeachers

  // Attendance metrics
  const isPresent = (status?: string) => status?.toLowerCase() === "present" || status?.toLowerCase() === "late"
  const presentCount = todayAttendance.filter(a => a.status?.toLowerCase() === "present").length
  const lateCount = todayAttendance.filter(a => a.status?.toLowerCase() === "late").length
  const absentCount = todayAttendance.filter(a => a.status?.toLowerCase() === "absent").length
  const excusedCount = todayAttendance.filter(a => a.status?.toLowerCase() === "excused").length
  const submittedAttendanceCount = todayAttendance.length

  const attendanceRate = totalStudents > 0 && submittedAttendanceCount > 0
    ? Math.round(((presentCount + lateCount) / submittedAttendanceCount) * 100)
    : 0

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

    allAttendance.forEach((record) => {
      const d = record.attendance_date || (record as any).date
      if (d && trendDataMap[d]) {
        trendDataMap[d].total++
        if (isPresent(record.status)) {
          trendDataMap[d].present++
        }
      }
    })

    return Object.values(trendDataMap)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
      .map((item) => {
        const dateObj = new Date(item.dateStr + "T00:00:00")
        const label = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        const rate = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0
        return {
          date: label,
          rate,
          present: item.present,
          total: item.total,
        }
      })
  }, [allAttendance])

  // Chart data: Grade Enrollment
  const gradeChartData = useMemo(() => {
    return sortedGrades.slice(0, 7).map(([grade, count]) => ({
      grade: grade.replace(/^Grade\s+/i, "G-"),
      fullName: grade,
      students: count,
    }))
  }, [sortedGrades])

  // Chart data: Today's Attendance Status Donut
  const statusPieData = useMemo(() => {
    const data = [
      { name: "Present", value: presentCount, color: "#10b981" },
      { name: "Late", value: lateCount, color: "#f59e0b" },
      { name: "Absent", value: absentCount, color: "#ef4444" },
      { name: "Excused", value: excusedCount, color: "#3b82f6" },
    ].filter((item) => item.value > 0)

    return data
  }, [presentCount, lateCount, absentCount, excusedCount])

  // Recent Students (last 5)
  const recentStudents = useMemo(() => [...students].slice(-5).reverse(), [students])

  // Attendance Edit Requests helpers
  const pendingRequests = useMemo(() => editRequests.filter(r => r.status === "PENDING"), [editRequests])
  const resolvedRequests = useMemo(() => editRequests.filter(r => r.status === "APPROVED" || r.status === "REJECTED"), [editRequests])

  const displayedRequests = useMemo(() => {
    if (requestsFilter === "pending") return pendingRequests
    if (requestsFilter === "resolved") return resolvedRequests
    return editRequests
  }, [editRequests, pendingRequests, resolvedRequests, requestsFilter])

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
      action: () => {
        setRequestsFilter("pending")
        const el = document.getElementById("attendance-edit-requests-section")
        if (el) el.scrollIntoView({ behavior: "smooth" })
      },
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
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              School Administration
            </span>
            <Badge variant="outline" className="border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
              {activeAcademicYearName}
            </Badge>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            {greeting}, <span className="text-primary">{adminName}</span>
          </h2>
          <p className="text-xs md:text-sm font-medium text-muted-foreground">
            Comprehensive overview of school operations, student attendance, academics, and staff
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
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

          {/* Academic Term Pill */}
          <div className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-3.5 py-2 rounded-full border border-indigo-100 dark:border-indigo-900 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            <span>{activeTerm}</span>
          </div>

          {/* Notifications Button */}
          <Button
            onClick={() => navigateTo("/school/admin/communication")}
            variant="outline"
            size="sm"
            className="relative rounded-full h-9 px-3.5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold gap-2 shadow-2xs"
          >
            <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Alerts</span>
            {totalUnreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-rose-500 text-white font-black text-[10px] rounded-full flex items-center justify-center">
                {totalUnreadCount}
              </span>
            )}
          </Button>
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
            sub: `${presentCount + lateCount} Present Today`,
            icon: TrendingUp,
            iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
            iconColor: "text-indigo-600 dark:text-indigo-400",
            valColor: "text-indigo-600 dark:text-indigo-400",
            href: "/school/admin/attendance",
          },
          {
            label: "Staff On Duty",
            value: `${activeStaffCount}/${totalStaff}`,
            sub: "Active Today",
            icon: UserCheck,
            iconBg: "bg-purple-50 dark:bg-purple-900/20",
            iconColor: "text-purple-600 dark:text-purple-400",
            valColor: "text-purple-600 dark:text-purple-400",
            href: "/school/admin/staff-attendance",
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
                {activeChartTab === "trend" ? "5-Day Attendance Trend" : "Student Enrollment by Grade"}
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
            <CardTitle className="typography-card-title flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              Today's Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[250px] w-full mt-4 bg-slate-100 dark:bg-slate-800/20 animate-pulse rounded-2xl" />
            ) : statusPieData.length > 0 ? (
              <div className="h-[250px] w-full mt-4 p-2 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-200 dark:border-slate-700">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => {
                        const getColor = (name: string) => {
                          switch (name.toLowerCase()) {
                            case "present": return "#10b981" // Green
                            case "late": return "#f59e0b"    // Yellow
                            case "absent": return "#ef4444"  // Red
                            case "excused": return "#3b82f6" // Blue
                            default: return "#888888"
                          }
                        }
                        return <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
                      })}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}
                      itemStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                      labelStyle={{ color: "var(--muted-foreground)" }}
                      formatter={(value: number, name: string) => [
                        `${value} Student${value !== 1 ? "s" : ""}`,
                        name
                      ]}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground gap-3">
                <div className="p-4 bg-muted rounded-full">
                  <AlertTriangle className="w-8 h-8 opacity-20" />
                </div>
                <p className="typography-label">No attendance data for today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. ATTENDANCE EDIT REQUESTS SECTION */}
      <div id="attendance-edit-requests-section" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Attendance Edit Requests
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

          {/* Filter Pills */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-full border border-slate-200 dark:border-slate-700/60 w-fit">
            <Button
              variant={requestsFilter === "pending" ? "default" : "ghost"}
              onClick={() => setRequestsFilter("pending")}
              size="sm"
              className="h-6 px-3 text-[11px] font-bold rounded-full"
            >
              Pending ({pendingRequests.length})
            </Button>
            <Button
              variant={requestsFilter === "all" ? "default" : "ghost"}
              onClick={() => setRequestsFilter("all")}
              size="sm"
              className="h-6 px-3 text-[11px] font-bold rounded-full"
            >
              All ({editRequests.length})
            </Button>
            <Button
              variant={requestsFilter === "resolved" ? "default" : "ghost"}
              onClick={() => setRequestsFilter("resolved")}
              size="sm"
              className="h-6 px-3 text-[11px] font-bold rounded-full"
            >
              Resolved ({resolvedRequests.length})
            </Button>
          </div>
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
        ) : displayedRequests.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
            <FileCheck className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-bold text-foreground">
              {requestsFilter === "pending"
                ? "No Pending Attendance Edit Requests"
                : "No Edit Requests Found"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {requestsFilter === "pending"
                ? "All teacher attendance submissions are locked and in sync. New unlock requests will appear here for review."
                : "No attendance unlock records match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedRequests.map((req: any) => {
              const teacherName = req.teacher?.name || "Teacher"
              const teacherInitial = teacherName.slice(0, 1).toUpperCase()
              const isPending = req.status === "PENDING"
              const isApproved = req.status === "APPROVED"
              const isRejected = req.status === "REJECTED"
              const reqDate = req.date ? req.date.split("T")[0] : "N/A"
              const isActingOnThis = actionLoadingId === req.id

              return (
                <Card
                  key={req.id}
                  className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md group flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Teacher & Status Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 shrink-0">
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

                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5",
                            isPending && "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700",
                            isApproved && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
                            isRejected && "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700"
                          )}
                        >
                          {req.status}
                        </Badge>
                        {req.isUsed && (
                          <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                            Used
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Target Date & Session Details */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px] font-medium">Target Date:</span>
                        <span className="font-bold text-foreground">{reqDate}</span>
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
                      {req.adminNote && (
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-start gap-1 text-[10px] text-muted-foreground">
                          <MessageSquare className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                          <span>Admin Note: {req.adminNote}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for Pending Requests */}
                    {isPending && (
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
                    )}
                  </CardContent>
                </Card>
              )
            })}
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
