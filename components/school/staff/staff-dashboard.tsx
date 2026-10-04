"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Clock,
  UserCheck,
  UserX,
  Calendar,
  CalendarOff,
  LogIn,
  LogOut,
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
  Briefcase,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ScanFace,
  MapPin,
  CalendarDays,
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { useCalendar } from "@/lib/context/calendar-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { useGreeting } from "@/lib/utils/greeting-utils"
import { cn } from "@/lib/utils/utils"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { getStaffAttendanceDisplay, addMinutesToHHMM } from "@/lib/utils/staff-attendance-status"
import { formatEthiopianTime } from "@/lib/utils/ethiopian-time"
import { toEthiopianDate, ET_MONTHS_EN } from "@/lib/utils/ethiopian-calendar"
import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"

// Module-level cache: survives component unmount/remount during client-side navigation.
// Prevents the full loading spinner and blank-state flicker when navigating back to the dashboard.
interface StaffDashboardDataCache {
  hasLoaded: boolean
  attendanceLoaded: boolean
  calendarStatus: any
  allAttendance: any[]
  enrolledDescriptor: number[] | null
  announcements: any[]
}

let _staffDashboardCache: StaffDashboardDataCache = {
  hasLoaded: false,
  attendanceLoaded: false,
  calendarStatus: null,
  allAttendance: [],
  enrolledDescriptor: null,
  announcements: [],
}

export function StaffDashboard() {
  const { user } = useAuth()
  const { formatDate } = useCalendar()
  const { settings } = useSchoolSettings()
  const greeting = useGreeting(user?.role || "staff")

  const getTodayStr = useCallback(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  }, [])

  const [todayStr, setTodayStr] = useState<string>(getTodayStr)
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [calendarStatus, setCalendarStatus] = useState<any>(_staffDashboardCache.calendarStatus)
  const [announcements, setAnnouncements] = useState<any[]>(_staffDashboardCache.announcements)
  const [isLoading, setIsLoading] = useState(!_staffDashboardCache.hasLoaded)
  const [isAttendanceLoaded, setIsAttendanceLoaded] = useState(
    Boolean(_staffDashboardCache.attendanceLoaded && _staffDashboardCache.allAttendance?.length > 0)
  )
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(_staffDashboardCache.enrolledDescriptor)
  const [allAttendance, setAllAttendance] = useState<any[]>(_staffDashboardCache.allAttendance)


  // Session filter for Monthly Performance ("morning" | "afternoon")
  const [monthlySessionFilter, setMonthlySessionFilter] = useState<"all" | "morning" | "afternoon">("morning")

  // Live active work duration tracker
  const [workingDuration, setWorkingDuration] = useState<string>("")

  const isSessionMode = (settings?.staffAttendanceMode || settings?.staff_attendance_mode) === "session_based"
  const staffSessions = useMemo(() => {
    const defaults = [
      { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, absenceCutoffMinutes: 90, absenceCutoffTime: "09:30", earliestCheckinTime: "06:00", latestCheckoutTime: "13:30", isActive: true },
      { id: "afternoon", name: "Afternoon", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, absenceCutoffMinutes: 90, absenceCutoffTime: "15:00", earliestCheckinTime: "12:30", latestCheckoutTime: "18:30", isActive: true },
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
    } catch (_) { }
    return defaults
  }, [settings?.staffSessions, settings?.staff_sessions])

  // Monthly statistics computation using Ethiopian Calendar month/year
  const monthlyStats = useMemo(() => {
    const now = new Date()

    // ── Determine the current Ethiopian year & month ─────────────────────
    // toEthiopianDate returns { year, month (0-indexed), day } (Africa/Addis_Ababa)
    const ecNow = toEthiopianDate(now)
    const currentECYear = ecNow.year
    const currentECMonth = ecNow.month // 0-indexed (0=Meskerem … 12=Pagume)

    const parseDateStr = (dateVal: any): string => {
      if (!dateVal) return ""
      if (typeof dateVal === "string") return dateVal.split("T")[0].trim()
      if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal.toISOString().split("T")[0]
      try {
        const d = new Date(dateVal)
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
      } catch { }
      return ""
    }

    const thisMonthRecords = allAttendance.filter((r) => {
      const dStr = parseDateStr(r?.date)
      if (!dStr) return false

      // Convert this attendance record's Gregorian date → Ethiopian date
      const ec = toEthiopianDate(dStr)
      if (ec.year !== currentECYear || ec.month !== currentECMonth) return false

      if (isSessionMode && monthlySessionFilter !== "all") {
        const sess = (r.session || "morning").toLowerCase()
        return sess === monthlySessionFilter.toLowerCase()
      }
      return true
    })

    let onTimeCount = 0
    let lateCount = 0
    let absentCount = 0
    const datesPresent = new Set<string>()
    const datesOnTime = new Set<string>()
    const datesLate = new Set<string>()
    const datesAbsent = new Set<string>()

    for (const r of thisMonthRecords) {
      const s = (r.status || "").toUpperCase()
      const dStr = parseDateStr(r.date)
      if (!dStr) continue

      const isLate = s === "LATE" || (s.includes("EARLY") && (r.previousStatus === "LATE" || (r as any)?.previous_status === "LATE"))
      const isPresent = s === "PRESENT" || s === "ON_TIME" || s === "EARLY_DEPARTURE" || s === "EARLY_LEAVE" || (Boolean(r.checkInTime) && s !== "ABSENT")

      if (isLate) {
        lateCount++
        datesPresent.add(dStr)
        datesLate.add(dStr)
      } else if (isPresent) {
        onTimeCount++
        datesPresent.add(dStr)
        datesOnTime.add(dStr)
      } else if (s === "ABSENT") {
        absentCount++
        datesAbsent.add(dStr)
      }
    }

    // Days / shifts present
    const presentCount = datesPresent.size

    // On-Time count: distinct on-time days if combined, or session count
    const onTimeDaysCount = monthlySessionFilter === "all" ? datesOnTime.size : onTimeCount

    // Late count: in independent session view, exact count of late shifts; in combined view, distinct late days
    const lateDaysCount = monthlySessionFilter === "all" ? datesLate.size : lateCount

    // Absent count: in independent session view, exact count of missed shifts; in combined view, days with no attendance
    const absentDaysCount = monthlySessionFilter === "all"
      ? Array.from(datesAbsent).filter((d) => !datesPresent.has(d)).length
      : absentCount

    // On-Time Rate: Percentage of attended shifts that arrived on time
    // If no attendances recorded (or only absent), rate is 0%, NEVER 100%!
    const totalAttended = onTimeCount + lateCount
    const onTimeRate = totalAttended > 0 ? Math.round((onTimeCount / totalAttended) * 100) : 0

    return {
      total: thisMonthRecords.length,
      presentCount,
      onTimeCount: onTimeDaysCount,
      lateCount: lateDaysCount,
      absentCount: absentDaysCount,
      onTimeRate,
      ecMonthName: ET_MONTHS_EN[currentECMonth] ?? "",
      ecYear: currentECYear,
    }
  }, [allAttendance, isSessionMode, monthlySessionFilter])

  const isPunctualityLoading = isLoading || !isAttendanceLoaded

  // Request ID and in-flight guard to prevent race conditions & out-of-order state overwrites
  const loadRequestIdRef = useRef(0)
  // hasMountedRef is now module-level (_staffDashboardHasMounted) — survives unmount
  // Keep a ref for volatile values used inside loadData so the callback stays stable (prevents re-mounting on settings changes)
  const isSessionModeRef = useRef(isSessionMode)
  const schoolIdRef = useRef(user?.schoolId)
  useEffect(() => { isSessionModeRef.current = isSessionMode }, [isSessionMode])
  useEffect(() => { schoolIdRef.current = user?.schoolId }, [user?.schoolId])

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const currentReqId = ++loadRequestIdRef.current
    if (!options?.silent) {
      setIsLoading(true)
      setIsAttendanceLoaded(false)
    }

    const currentToday = getTodayStr()
    setTodayStr(currentToday)

    try {
      const [calRes, myAttRes, descRes, annRes] = await Promise.allSettled([
        db.isDateWorkingDay(currentToday),
        db.getMyStaffAttendance({
          mode: isSessionModeRef.current ? "session_based" : "daily",
        }),
        db.getStaffFaceDescriptor(),
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/announcements?limit=1`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
            "x-school-id": schoolIdRef.current || "single-school",
            "x-requested-role": "staff",
          },
        }).catch(() => ({ success: false, data: [] })),
      ])

      if (currentReqId !== loadRequestIdRef.current) return

      if (calRes.status === "fulfilled") {
        setCalendarStatus(calRes.value)
        _staffDashboardCache.calendarStatus = calRes.value
      }
      if (myAttRes.status === "fulfilled") {
        const attData = myAttRes.value || []
        setAllAttendance(attData)
        _staffDashboardCache.allAttendance = attData
        _staffDashboardCache.attendanceLoaded = true
        setIsAttendanceLoaded(true)
      }
      if (descRes.status === "fulfilled") {
        const descData = descRes.value?.descriptor || null
        setEnrolledDescriptor(descData)
        _staffDashboardCache.enrolledDescriptor = descData
      }
      if (annRes.status === "fulfilled" && (annRes.value as any)?.success && Array.isArray((annRes.value as any).data)) {
        const annData = (annRes.value as any).data.slice(0, 1)
        setAnnouncements(annData)
        _staffDashboardCache.announcements = annData
      }
    } catch (err) {
      console.error("[StaffDashboard] Error loading attendance data:", err)
    } finally {
      if (currentReqId === loadRequestIdRef.current) {
        _staffDashboardCache.hasLoaded = true
        setIsAttendanceLoaded(true)
        setIsLoading(false)
      }
    }
    // Stable: reads isSessionMode & schoolId via refs, not as deps
  }, [getTodayStr])

  const normalizeDateStr = useCallback((d: any) => {
    if (!d) return ""
    if (typeof d === "string") return d.split("T")[0]
    if (d instanceof Date) return d.toISOString().split("T")[0]
    try {
      return new Date(d).toISOString().split("T")[0]
    } catch {
      return ""
    }
  }, [])

  const todayRecs = useMemo(() => {
    return allAttendance.filter((r) => normalizeDateStr(r.date) === todayStr)
  }, [allAttendance, todayStr, normalizeDateStr])

  const morningRec = useMemo(() => {
    return todayRecs.find((r) => (r.session || "morning").toLowerCase() === "morning") || null
  }, [todayRecs])

  const afternoonRec = useMemo(() => {
    return todayRecs.find((r) => (r.session || "").toLowerCase() === "afternoon") || null
  }, [todayRecs])

  // Internal session resolver: evaluates configured shift times against current Addis Ababa time
  const resolveActiveSession = useCallback((): "morning" | "afternoon" => {
    // 1. If actively clocked into a session today (checked in and not checked out), prioritize that active shift
    if (morningRec?.checkInTime && !morningRec?.checkOutTime) {
      return "morning"
    }
    if (afternoonRec?.checkInTime && !afternoonRec?.checkOutTime) {
      return "afternoon"
    }

    // 2. Resolve by current time vs configured session times in Africa/Addis_Ababa timezone
    let currentHHMM = "08:00"
    try {
      currentHHMM = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Addis_Ababa",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())
    } catch {
      const d = new Date()
      currentHHMM = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    }

    const afternoonSess = staffSessions.find((s: any) => s.id === "afternoon" || s.name?.toLowerCase() === "afternoon")
    const morningSess = staffSessions.find((s: any) => s.id === "morning" || s.name?.toLowerCase() === "morning")

    // The boundary when morning transitions to afternoon according to school configuration:
    // Earliest check-in for afternoon, or afternoon start time, or morning end time (fallback "12:30")
    const afternoonBoundary = afternoonSess?.earliestCheckinTime || afternoonSess?.startTime || morningSess?.endTime || "12:30"

    return currentHHMM >= afternoonBoundary ? "afternoon" : "morning"
  }, [morningRec, afternoonRec, staffSessions])

  const [currentSession, setCurrentSession] = useState<"morning" | "afternoon">(resolveActiveSession)

  // Auto-sync current session when records, mode, or configured shift times change
  useEffect(() => {
    if (!isSessionMode) return
    setCurrentSession(resolveActiveSession())

    const interval = setInterval(() => {
      setCurrentSession(resolveActiveSession())
    }, 30000)
    return () => clearInterval(interval)
  }, [isSessionMode, resolveActiveSession])

  useEffect(() => {
    if (isSessionMode) {
      const targetSession = currentSession
      const activeRec = targetSession === "afternoon" ? afternoonRec : morningRec
      // If no record exists for this session yet today, synthesize a pending record so the display status calculates correctly
      setTodayRecord(activeRec || { session: targetSession, date: todayStr })
    } else {
      if (!todayRecs.length) {
        setTodayRecord(null)
        return
      }
      // Daily mode: prioritize checked-in record if present
      const checkedInRec = todayRecs.find((r) => r.checkInTime)
      const dailyRec = todayRecs.find((r) => !r.session || r.session === "daily") || todayRecs[0]
      setTodayRecord(checkedInRec || dailyRec || null)
    }
  }, [todayRecs, todayStr, isSessionMode, currentSession, morningRec, afternoonRec])

  useEffect(() => {
    // On first mount: show skeleton if attendance not cached; only silent if already loaded
    const shouldBeSilent = Boolean(_staffDashboardCache.hasLoaded && _staffDashboardCache.attendanceLoaded)
    loadData({ silent: shouldBeSilent })

    const handleChanged = () => {
      loadData({ silent: true })
    }

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
    // Only run once on mount; loadData is now stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    return getStaffAttendanceDisplay(todayRecord, settings, undefined, calendarStatus)
  }, [todayRecord, settings, calendarStatus])

  const isCheckedIn = Boolean(todayRecord?.checkInTime)
  const isCheckedOut = Boolean(todayRecord?.checkOutTime)

  const workStatus = useMemo(() => {
    // 1. Checked in and actively on duty
    if (isCheckedIn && !isCheckedOut) {
      return {
        label: "Active / On Duty",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        dotColor: "bg-emerald-500",
        subtitle: workingDuration ? `Duration: ${workingDuration}` : "Currently at school",
      }
    }
    // 2. Shift fully completed
    if (isCheckedIn && isCheckedOut) {
      return {
        label: "Shift Completed",
        badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        dotColor: "bg-blue-500",
        subtitle: "Check-in & check-out logged",
      }
    }
    // 3. All pre-check-in states — derived from attendanceDisplay (single source of truth).
    //    This eliminates duplicate calendarStatus logic and keeps Card 4 in sync with Card 1.
    switch (attendanceDisplay.checkIn.status) {
      case "ABSENT":
        return {
          label: "Absent",
          badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
          dotColor: "bg-rose-500",
          subtitle: "Missed check-in cutoff",
        }
      case "LEAVE":
        return {
          label: "On Leave",
          badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
          dotColor: "bg-blue-500",
          subtitle: "Approved leave day",
        }
      case "PERMISSION":
        return {
          label: "Permission",
          badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
          dotColor: "bg-purple-500",
          subtitle: "Approved permission",
        }
      case "HOLIDAY":
      case "NON_WORKING_DAY":
        // Holiday Banner already gives the full notice; Card 4 shows a concise label
        return {
          label: "Day Off",
          badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
          dotColor: "bg-slate-400",
          subtitle: attendanceDisplay.checkIn.titleLabel,
        }
      case "PENDING":
        return {
          label: "Pending Check-In",
          badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
          dotColor: "bg-sky-500",
          subtitle: "Check-in window is open",
        }
      default:
        // NOT_STARTED: current time is before shift start
        return {
          label: "Not Started",
          badgeClass: "bg-muted text-muted-foreground border-border",
          dotColor: "bg-muted-foreground/50",
          subtitle: "Shift hasn't started yet",
        }
    }
  }, [isCheckedIn, isCheckedOut, workingDuration, attendanceDisplay])


  return (
    <div className="relative space-y-6 max-w-5xl mx-auto pb-10 w-full min-w-0">
      {/* ── Ambient Background Glow Spheres ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/15 dark:bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      {/* ─── 1. MODERN HEADER WITH TIME-BASED GREETING ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="space-y-1 w-full md:w-auto">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            {greeting}, <span className="text-primary">{user?.name || "Staff Member"}</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Date & Refresh Pill */}
          <div className="text-xs font-semibold bg-primary/10 text-primary px-3.5 py-2 rounded-full border border-primary/20 shadow-2xs flex items-center gap-2.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(todayStr || new Date(), { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
            <button
              onClick={() => loadData()}
              className="hover:text-primary-focus transition-colors p-0.5 rounded-full hover:bg-primary/20"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading ? "animate-spin" : "")} />
            </button>
          </div>
        </div>
      </div>


      {/* ─── Holiday / Non-Working Day Glass Banner ─── */}
      {calendarStatus && !calendarStatus.isWorkingDay && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-[22px] border backdrop-blur-xl flex items-start sm:items-center gap-3 sm:gap-3.5 shadow-md w-full min-w-0 ${calendarStatus.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200 shadow-purple-500/5"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-amber-500/5"
            }`}
        >
          <div
            className={`p-2 sm:p-2.5 rounded-xl shrink-0 shadow-sm mt-0.5 sm:mt-0 ${calendarStatus.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              }`}
          >
            {calendarStatus.isHoliday ? <CalendarOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-xs sm:text-sm">
                {calendarStatus.isHoliday
                  ? `Holiday: ${calendarStatus.holidayName}`
                  : calendarStatus.reason || "Scheduled Non-Working Day"}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] sm:text-[10px] uppercase font-black px-1.5 sm:px-2 py-0.5 rounded-md shrink-0 ${calendarStatus.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300 bg-purple-500/10"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10"
                  }`}
              >
                {calendarStatus.isHoliday ? "Official Holiday" : "Non-Working Day"}
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs opacity-75 mt-1 leading-snug">
              {calendarStatus.isHoliday
                ? "School operations are paused today for the official holiday. No attendance penalty applies."
                : "Attendance tracking is inactive for today. Auto-absences will not be marked."}
            </p>
          </div>
        </div>
      )}

      {/* ─── 2. WORKING HOURS & SCHEDULE BANNER (SESSION / DAILY) ─── */}
      <div className="p-4 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Configured Work Hours</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isSessionMode ? "Session-Based Tracking (Morning & Afternoon)" : "Daily Single Shift"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-8 w-44 rounded-xl bg-slate-200/60 dark:bg-slate-800/40 animate-pulse" />
              <div className="h-8 w-44 rounded-xl bg-slate-200/60 dark:bg-slate-800/40 animate-pulse hidden sm:block" />
            </div>
          ) : isSessionMode ? (
            <div className="flex flex-wrap items-center gap-2">
              {staffSessions.map((sess: any) => {
                const cutoff = sess?.absenceCutoffTime || (sess ? addMinutesToHHMM(sess.startTime, sess.absenceCutoffMinutes ?? 90) : "09:30")
                return (
                  <div
                    key={sess.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-950/60 border border-white/50 dark:border-white/10 text-xs shadow-xs max-w-full"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{sess.name}:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {formatEthiopianTime(sess.startTime)} - {formatEthiopianTime(sess.endTime)}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      +{sess.lateGraceMinutes ?? 15}m Grace
                    </span>
                    <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                      Cutoff: {formatEthiopianTime(cutoff)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            (() => {
              const startTime = settings?.staffWorkStartTime || "08:00"
              const endTime = settings?.staffWorkEndTime || "17:00"
              const cutoff = settings?.staffAbsenceCutoffTime || addMinutesToHHMM(startTime, settings?.staffAbsenceCutoffMinutes ?? 120)
              return (
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-950/60 border border-white/50 dark:border-white/10 text-xs shadow-xs max-w-full">
                  <span className="font-bold text-slate-900 dark:text-white">Shift:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {formatEthiopianTime(startTime)} - {formatEthiopianTime(endTime)}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    +{settings?.staffLateGraceMinutes ?? 15}m Grace
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                    Cutoff: {formatEthiopianTime(cutoff)}
                  </span>
                </div>
              )
            })()
          )}
        </div>
      </div>

      {/* ─── 3. FOUR STATUS METRIC CARDS ─── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Attendance Status */}
          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col justify-between gap-3 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Attendance {isSessionMode ? `• ${currentSession === "afternoon" ? "Afternoon" : "Morning"} Shift` : ""}
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-28 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                  <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
                </div>
              ) : (
                <>
                  <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white block truncate tracking-tight">
                    {attendanceDisplay.checkIn.titleLabel}
                  </span>
                  <div className="mt-1.5">
                    {/* Show latenessFormatted for LATE; hide badge when it would duplicate the titleLabel */}
                    {attendanceDisplay.checkIn.status === "LATE" && attendanceDisplay.checkIn.latenessFormatted ? (
                      <Badge className={`text-[9px] font-black uppercase py-0.5 px-2 tracking-wider ${attendanceDisplay.checkIn.badgeColor}`}>
                        {attendanceDisplay.checkIn.latenessFormatted}
                      </Badge>
                    ) : !["ABSENT", "HOLIDAY", "NON_WORKING_DAY", "LEAVE", "PERMISSION"].includes(attendanceDisplay.checkIn.status) ? (
                      <Badge className={`text-[9px] font-black uppercase py-0.5 px-2 tracking-wider ${attendanceDisplay.checkIn.badgeColor}`}>
                        {attendanceDisplay.overallStatus.replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Check-In Time */}
          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col justify-between gap-3 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Check-In</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shadow-xs">
                <LogIn className="w-4 h-4" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                  <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
                </div>
              ) : (
                <>
                  <span className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white block truncate tracking-tight">
                    {attendanceDisplay.checkIn.timeStr}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block truncate">
                    {isCheckedIn ? "Verified arrival" : "Pending check-in"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Card 3: Check-Out Time */}
          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col justify-between gap-3 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Check-Out</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 shadow-xs">
                <LogOut className="w-4 h-4" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                  <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
                </div>
              ) : (
                <>
                  <span className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white block truncate tracking-tight">
                    {attendanceDisplay.checkOut.timeStr}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block truncate">
                    {isCheckedOut ? "Verified departure" : "Pending departure"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Card 4: Work Status */}
          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col justify-between gap-3 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Status</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                  <div className="h-3.5 w-28 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${workStatus.dotColor} shrink-0`} />
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                      {workStatus.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block truncate">
                    {workStatus.subtitle}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. DEDICATED ATTENDANCE CTA BANNER ─── */}
      <div className="relative overflow-hidden rounded-[26px] border border-white/40 dark:border-white/10 bg-gradient-to-r from-primary/10 via-indigo-500/5 to-cyan-500/10 backdrop-blur-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Ready to record your arrival or departure?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instant 1-tap facial biometric scan and GPS geofence school verification.
            </p>
          </div>
        </div>
        <Link href="/school/staff/attendance" className="w-full sm:w-auto shrink-0">
          <Button className="w-full sm:w-auto font-black text-xs uppercase tracking-wider gap-2 rounded-xl h-11 px-6 bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-primary/25 active:scale-95">
            <UserCheck className="w-4 h-4" />
            <span>Open Attendance Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* ─── 5. MONTHLY PERFORMANCE & PUNCTUALITY METRICS ─── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Monthly Punctuality &amp; Attendance Performance
            </h2>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {`Independent metrics for ${monthlySessionFilter} shift`}
            </p>
          </div>

          {/* Session Switcher Tabs */}
          {isSessionMode && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs self-start sm:self-auto">
              <Button
                variant={monthlySessionFilter === "morning" ? "default" : "ghost"}
                onClick={() => setMonthlySessionFilter("morning")}
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-full transition-all",
                  monthlySessionFilter === "morning" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Morning
              </Button>
              <Button
                variant={monthlySessionFilter === "afternoon" ? "default" : "ghost"}
                onClick={() => setMonthlySessionFilter("afternoon")}
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs font-bold rounded-full transition-all",
                  monthlySessionFilter === "afternoon" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Afternoon
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col items-center text-center">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 mb-2">
              <UserCheck className="w-5 h-5" />
            </div>
            {isPunctualityLoading ? (
              <span className="inline-block w-12 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg my-0.5" />
            ) : (
              <span className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{monthlyStats.onTimeCount}</span>
            )}
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              Days On-Time
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col items-center text-center">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary mb-2">
              <TrendingUp className="w-5 h-5" />
            </div>
            {isPunctualityLoading ? (
              <span className="inline-block w-14 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg my-0.5" />
            ) : (
              <span className="text-xl sm:text-3xl font-black text-primary tracking-tight">{monthlyStats.onTimeRate}%</span>
            )}
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              On-Time Rate
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col items-center text-center">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 mb-2">
              <Clock className="w-5 h-5" />
            </div>
            {isPunctualityLoading ? (
              <span className="inline-block w-12 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg my-0.5" />
            ) : (
              <span className="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{monthlyStats.lateCount}</span>
            )}
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              Late Days
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-lg shadow-slate-900/5 flex flex-col items-center text-center">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mb-2">
              <UserX className="w-5 h-5" />
            </div>
            {isPunctualityLoading ? (
              <span className="inline-block w-12 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg my-0.5" />
            ) : (
              <span className="text-xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">{monthlyStats.absentCount}</span>
            )}
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              Absent Days
            </span>
          </div>
        </div>
      </div>



      {/* ─── 7. ANNOUNCEMENTS FEED ─── */}
      <div className="rounded-[26px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-xl shadow-slate-900/5 overflow-hidden">
        <div className="p-5 pb-3 flex items-center justify-between border-b border-white/20 dark:border-white/10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> School Announcements
          </h3>
          <Link
            href="/school/staff/announcements"
            className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-4 space-y-2.5">
          {isLoading ? (
            <div className="p-3.5 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-white/40 dark:border-white/10 space-y-2 animate-pulse shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-16" />
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-full" />
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No active announcements at this time.
            </div>
          ) : (
            announcements.slice(0, 1).map((ann: any) => (
              <div
                key={ann.id}
                className="p-3.5 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-white/40 dark:border-white/10 space-y-1 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{ann.title || "Announcement"}</p>
                    {ann.targetAudience === "STAFF" && (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9px] font-black px-1.5 py-0">
                        Staff Only
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{ann.content || ann.message}</p>
              </div>
            ))
          )}
        </div>
      </div>


    </div>
  )
}

