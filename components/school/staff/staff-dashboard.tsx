"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Clock,
  UserCheck,
  Calendar,
  CalendarOff,
  LogIn,
  LogOut,
  Bell,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  User,
  CheckCircle2,
  TrendingUp,
  Activity,
  ArrowRight,
  Sun,
  Moon,
  Sunset,
  Briefcase,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { useCalendar } from "@/lib/context/calendar-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { StaffFaceEnrollModal } from "@/components/school/staff-face-enroll"
import { getStaffAttendanceDisplay } from "@/lib/utils/staff-attendance-status"
import { formatEthiopianTime } from "@/lib/utils/ethiopian-time"

export function StaffDashboard() {
  const { user } = useAuth()
  const { formatDate } = useCalendar()
  const { settings } = useSchoolSettings()

  const getTodayStr = useCallback(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  }, [])

  const [todayStr, setTodayStr] = useState<string>(getTodayStr)
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [calendarStatus, setCalendarStatus] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(null)
  const [isFaceEnrollModalOpen, setIsFaceEnrollModalOpen] = useState(false)
  const [allAttendance, setAllAttendance] = useState<any[]>([])

  // Live active work duration tracker
  const [workingDuration, setWorkingDuration] = useState<string>("")

  const isSessionMode = (settings?.staffAttendanceMode || settings?.staff_attendance_mode) === "session_based"
  const staffSessions = useMemo(() => {
    const defaults = [
      { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true },
      { id: "afternoon", name: "Afternoon", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, isActive: true },
    ]
    const rawSessions = settings?.staffSessions ?? settings?.staff_sessions
    if (!rawSessions) return defaults
    try {
      const arr = typeof rawSessions === "string" ? JSON.parse(rawSessions) : rawSessions
      if (Array.isArray(arr) && arr.length > 0) {
        const morning = arr.find((s: any) => s && (s.id === "morning" || s.name?.toLowerCase() === "morning")) || defaults[0]
        const afternoon = arr.find((s: any) => s && (s.id === "afternoon" || s.name?.toLowerCase() === "afternoon")) || defaults[1]
        return [
          { ...defaults[0], ...morning, id: "morning", name: "Morning" },
          { ...defaults[1], ...afternoon, id: "afternoon", name: "Afternoon" },
        ].filter((s: any) => s.isActive !== false)
      }
    } catch (_) {}
    return defaults
  }, [settings?.staffSessions, settings?.staff_sessions])

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return { text: "Good morning", icon: Sun, color: "text-amber-500" }
    if (hour < 17) return { text: "Good afternoon", icon: Sunset, color: "text-orange-500" }
    return { text: "Good evening", icon: Moon, color: "text-indigo-400" }
  }, [])

  // Monthly statistics computation
  const monthlyStats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const thisMonthRecords = allAttendance.filter((r) => {
      if (!r.date) return false
      const d = new Date(r.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    const presentCount = thisMonthRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
    const onTimeCount = thisMonthRecords.filter((r) => r.status === "PRESENT").length
    const lateCount = thisMonthRecords.filter((r) => r.status === "LATE").length
    const onTimeRate = presentCount > 0 ? Math.round((onTimeCount / presentCount) * 100) : 100

    return {
      total: thisMonthRecords.length,
      presentCount,
      onTimeCount,
      lateCount,
      onTimeRate,
    }
  }, [allAttendance])

  // Request ID and in-flight guard to prevent race conditions & out-of-order state overwrites
  const loadRequestIdRef = useRef(0)

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const currentReqId = ++loadRequestIdRef.current
    if (!options?.silent) {
      setIsLoading(true)
    }

    const currentToday = getTodayStr()
    setTodayStr(currentToday)

    try {
      // Parallel fetch with settled handling so a single failed request never breaks others
      const [calRes, myAttRes, descRes, annRes, notifRes] = await Promise.allSettled([
        db.isDateWorkingDay(currentToday),
        db.getMyStaffAttendance({
          mode: isSessionMode ? "session_based" : "daily",
        }),
        db.getStaffFaceDescriptor(),
        fetch(`/api/announcements?limit=3`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
            "x-school-id": user?.schoolId || "",
            "x-requested-role": "staff",
          },
        }).then((r) => r.json()),
        fetch(`/api/notifications?limit=3`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
            "x-school-id": user?.schoolId || "",
            "x-requested-role": "staff",
          },
        }).then((r) => r.json()),
      ])

      // Ignore if a newer request was dispatched while this was fetching
      if (currentReqId !== loadRequestIdRef.current) return

      if (calRes.status === "fulfilled") {
        setCalendarStatus(calRes.value)
      }
      if (myAttRes.status === "fulfilled") {
        setAllAttendance(myAttRes.value || [])
      }
      if (descRes.status === "fulfilled") {
        setEnrolledDescriptor(descRes.value?.descriptor || null)
      }
      if (annRes.status === "fulfilled" && annRes.value?.success && Array.isArray(annRes.value.data)) {
        setAnnouncements(annRes.value.data.slice(0, 3))
      }
      if (notifRes.status === "fulfilled" && notifRes.value?.success && Array.isArray(notifRes.value.data)) {
        setRecentNotifications(notifRes.value.data.slice(0, 3))
      }
    } catch (err) {
      console.error("[StaffDashboard] Error loading attendance data:", err)
    } finally {
      if (currentReqId === loadRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [getTodayStr, isSessionMode, user?.schoolId])

  useEffect(() => {
    if (!allAttendance.length) {
      setTodayRecord(null)
      return
    }
    const todayRecs = allAttendance.filter((r) => r.date?.split("T")[0] === todayStr)
    if (isSessionMode) {
      // Pick most relevant active or recent session
      const morningRec = todayRecs.find((r) => (r.session || "morning").toLowerCase() === "morning")
      const afternoonRec = todayRecs.find((r) => (r.session || "").toLowerCase() === "afternoon")
      setTodayRecord(afternoonRec || morningRec || todayRecs[0] || null)
    } else {
      const dailyRec = todayRecs.find((r) => !r.session || r.session === "daily") || todayRecs[0]
      setTodayRecord(dailyRec || null)
    }
  }, [allAttendance, todayStr, isSessionMode])

  useEffect(() => {
    loadData()

    const handleChanged = () => {
      loadData({ silent: true })
    }

    // Visibility change listener (Android WebView resume & browser tab focus)
    let lastResumeTime = 0
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now()
        if (now - lastResumeTime > 3000) {
          lastResumeTime = now
          loadData({ silent: true })
        }
      }
    }

    const handleOnline = () => {
      loadData({ silent: true })
    }

    window.addEventListener("staffAttendanceDataChanged", handleChanged)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("online", handleOnline)

    return () => {
      window.removeEventListener("staffAttendanceDataChanged", handleChanged)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("online", handleOnline)
    }
  }, [loadData])

  // Live timer for active check-in duration
  useEffect(() => {
    if (!todayRecord?.checkInTime || todayRecord?.checkOutTime) {
      setWorkingDuration("")
      return
    }
    const updateDuration = () => {
      const checkInMs = new Date(todayRecord.checkInTime).getTime()
      const diffMs = Math.max(0, Date.now() - checkInMs)
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      setWorkingDuration(`${hours}h ${mins}m`)
    }
    updateDuration()
    const interval = setInterval(updateDuration, 30000)
    return () => clearInterval(interval)
  }, [todayRecord?.checkInTime, todayRecord?.checkOutTime])

  // Computed display status for today
  const attendanceDisplay = useMemo(() => {
    return getStaffAttendanceDisplay(todayRecord, settings)
  }, [todayRecord, settings])

  const isCheckedIn = Boolean(todayRecord?.checkInTime)
  const isCheckedOut = Boolean(todayRecord?.checkOutTime)

  const workStatus = useMemo(() => {
    if (isCheckedIn && !isCheckedOut) {
      return {
        label: "Active / On Duty",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        dotColor: "bg-emerald-500",
        subtitle: workingDuration ? `Duration: ${workingDuration}` : "Currently on campus",
      }
    }
    if (isCheckedIn && isCheckedOut) {
      return {
        label: "Shift Completed",
        badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        dotColor: "bg-blue-500",
        subtitle: "Check-in & check-out logged",
      }
    }
    if (calendarStatus && !calendarStatus.isWorkingDay) {
      return {
        label: "Off Duty / Holiday",
        badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
        dotColor: "bg-purple-500",
        subtitle: calendarStatus.holidayName || "Scheduled non-working day",
      }
    }
    return {
      label: "Not Started",
      badgeClass: "bg-muted text-muted-foreground border-border",
      dotColor: "bg-muted-foreground/50",
      subtitle: "Arrival check-in pending",
    }
  }, [isCheckedIn, isCheckedOut, workingDuration, calendarStatus])

  const GreetingIcon = greeting.icon

  // ─── Loading Skeleton ───
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-6 animate-pulse">
        {/* Hero Header Skeleton */}
        <div className="rounded-2xl sm:rounded-3xl bg-card/70 border border-border/60 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 w-full sm:w-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted/70 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 w-28 bg-muted/60 rounded-md" />
                <div className="h-6 w-48 bg-muted/80 rounded-md" />
                <div className="h-3 w-36 bg-muted/50 rounded-md" />
              </div>
            </div>
            <div className="w-full sm:w-44 h-10 bg-muted/50 rounded-xl" />
          </div>
        </div>

        {/* 4 Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-card/70 border border-border/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-muted/60" />
                <div className="w-16 h-4 bg-muted/40 rounded" />
              </div>
              <div className="h-6 w-24 bg-muted/80 rounded" />
              <div className="h-3 w-32 bg-muted/40 rounded" />
            </div>
          ))}
        </div>

        {/* Action Shortcut Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card/70 border border-border/60 p-3.5" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto pb-8">
      {/* ─── 1. WELCOME & PROFILE BANNER ─── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/15 via-card to-background border border-border/80 p-4 sm:p-6 shadow-sm">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Staff Profile Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 w-full sm:w-auto">
            <div className="relative shrink-0">
              <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-primary/30 shadow-md">
                <AvatarImage src={user?.profile_photo || ""} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {user?.name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase() || "ST"}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
                  isCheckedIn && !isCheckedOut ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                }`}
                title={isCheckedIn && !isCheckedOut ? "Active on duty" : "Not checked in"}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GreetingIcon className={`w-3.5 h-3.5 ${greeting.color}`} />
                <span>{greeting.text},</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {user?.name || "Staff Member"}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] sm:text-xs font-semibold capitalize py-0 px-2">
                  {user?.role?.replace("_", " ") || "Staff Member"}
                </Badge>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  {user?.schoolName || "Addis Hiwot School"}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  &bull; {formatDate(todayStr)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Status Badges & Enrollment */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-border/40">
            {enrolledDescriptor ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-2.5 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Face ID Active</span>
              </Badge>
            ) : (
              <button
                type="button"
                onClick={() => setIsFaceEnrollModalOpen(true)}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Enroll Face ID</span>
              </button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              className="h-8 px-2.5 rounded-xl border-border text-xs gap-1.5"
            >
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Holiday / Non-Working Day Banner ─── */}
      {calendarStatus && !calendarStatus.isWorkingDay && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex items-center gap-3 shadow-xs ${
            calendarStatus.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
          }`}
        >
          <div
            className={`p-2 rounded-xl shrink-0 ${
              calendarStatus.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            {calendarStatus.isHoliday ? <CalendarOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm truncate">
                {calendarStatus.isHoliday
                  ? `Holiday: ${calendarStatus.holidayName}`
                  : calendarStatus.reason || "Scheduled Non-Working Day"}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                  calendarStatus.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300"
                }`}
              >
                {calendarStatus.isHoliday ? "Holiday" : "Off Day"}
              </Badge>
            </div>
            <p className="text-[11px] opacity-80 line-clamp-1">
              Attendance is optional today. Absences will not be marked.
            </p>
          </div>
        </div>
      )}

      {/* ─── 2. TODAY AT A GLANCE (FOUR STATUS CARDS) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Today at a Glance</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Current attendance &amp; daily work status from server
            </p>
          </div>
          <Link
            href="/school/staff/attendance"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 group"
          >
            <span>Open Attend Page</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Four Status Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Attendance Status */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Attendance
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black text-foreground block truncate">
                {attendanceDisplay.checkIn.titleLabel}
              </span>
              <div className="mt-1">
                <Badge className={`text-[9px] font-bold uppercase py-0.5 px-2 tracking-wider ${attendanceDisplay.checkIn.badgeColor}`}>
                  {attendanceDisplay.overallStatus.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Card 2: Check-In Time */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Check-In Time
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <LogIn className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black font-mono text-foreground block truncate">
                {attendanceDisplay.checkIn.timeStr}
              </span>
              <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                {isCheckedIn ? "Server-recorded arrival" : "Not recorded yet"}
              </span>
            </div>
          </div>

          {/* Card 3: Check-Out Time */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Check-Out Time
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black font-mono text-foreground block truncate">
                {attendanceDisplay.checkOut.timeStr}
              </span>
              <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                {isCheckedOut ? "Server-recorded departure" : "Not recorded yet"}
              </span>
            </div>
          </div>

          {/* Card 4: Work Status */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Work Status
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${workStatus.dotColor} shrink-0`} />
                <span className="text-base sm:text-lg font-bold text-foreground truncate">
                  {workStatus.label}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                {workStatus.subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Attend Page Action Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-card via-card to-primary/5 border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">
                Need to record your arrival or departure?
              </h3>
              <p className="text-xs text-muted-foreground">
                Use the dedicated Attend page for facial biometric scan and GPS check-in/out.
              </p>
            </div>
          </div>
          <Link href="/school/staff/attendance" className="w-full sm:w-auto shrink-0">
            <Button className="w-full sm:w-auto font-bold gap-2 rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <UserCheck className="w-4 h-4" />
              <span>Go to Attend Page</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── 3. MONTHLY ATTENDANCE PERFORMANCE SUMMARY ─── */}
      <div className="space-y-2.5">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Monthly Overview
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col items-center text-center">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-base sm:text-xl font-extrabold text-foreground">{monthlyStats.presentCount}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Days Present</span>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col items-center text-center">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-base sm:text-xl font-extrabold text-foreground">{monthlyStats.onTimeRate}%</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Punctuality</span>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col items-center text-center">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-base sm:text-xl font-extrabold text-foreground">{monthlyStats.lateCount}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Late Days</span>
          </div>
        </div>
      </div>

      {/* ─── 4. QUICK ACCESS NAVIGATION GRID ─── */}
      <div className="space-y-2.5">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Quick Access
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/school/staff/attendance"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all group active:scale-[0.99] shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-foreground">My Attendance</p>
                <p className="text-[11px] text-muted-foreground truncate">Biometrics &amp; 30-day logs</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/school/staff/communication"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all group active:scale-[0.99] shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-foreground">Messages &amp; Chat</p>
                <p className="text-[11px] text-muted-foreground truncate">Direct staff communication</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/school/staff/profile"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all group active:scale-[0.99] shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-foreground">My Profile</p>
                <p className="text-[11px] text-muted-foreground truncate">Account &amp; Biometrics</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* ─── 5. ANNOUNCEMENTS & RECENT ALERTS FEED ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* School Announcements */}
        <Card className="border-border/80 shadow-xs bg-card/95 rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> School Announcements
            </CardTitle>
            <Link
              href="/school/staff/announcements"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {announcements.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No active announcements at this time.
              </div>
            ) : (
              announcements.map((ann: any) => (
                <div
                  key={ann.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{ann.title || "Announcement"}</p>
                      {ann.targetAudience === "STAFF" && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                          Staff Only
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{ann.content || ann.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="border-border/80 shadow-xs bg-card/95 rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Recent Alerts
            </CardTitle>
            <Link
              href="/school/staff/communication"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {recentNotifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                You have no unread notifications.
              </div>
            ) : (
              recentNotifications.map((notif: any) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{notif.title || "Notification"}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── 6. DIRECT FACE ENROLLMENT MODAL ─── */}
      {user?.id && (
        <StaffFaceEnrollModal
          open={isFaceEnrollModalOpen}
          onOpenChange={setIsFaceEnrollModalOpen}
          preselectedUserId={user.id}
          preselectedUserName={user.name || "Staff Member"}
          onEnrolled={() => {
            loadData()
            notifications.success("Biometrics Active", "Your face has been registered for automatic attendance.")
          }}
        />
      )}
    </div>
  )
}
