"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { parentDb, type ParentNotification } from "@/lib/db/parent-db"
import { useLanguage } from "@/lib/context/language-context"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { db } from "@/lib/db/database"
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  Activity,
  Heart,
  TrendingUp,
  MapPin,
  CalendarDays,
  Bell,
  Megaphone,
  AlertOctagon,
  ArrowRight,
  UserCheck,
  X
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { formatLocalizedDate } from "@/lib/utils/date-utils"

import { apiUrl } from "@/lib/api-config"
const API_URL = apiUrl;

export default function ParentDashboard() {
  const router = useRouter()
  const { t } = useLanguage()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [firstName, setFirstName] = useState("Parent")
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [notificationsList, setNotificationsList] = useState<ParentNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statsMode, setStatsMode] = useState<"daily" | "session">("daily")
  const [statsSession, setStatsSession] = useState<"morning" | "afternoon">("morning")

  // 1. Initial Load & Auth verification
  const loadStudentData = async () => {
    const userStr = localStorage.getItem("attendance_current_user")
    const studentsStr = localStorage.getItem("parent_students")
    const studentId = localStorage.getItem("parent_selected_student_id")

    if (!userStr) {
      router.push("/login")
      return
    }

    try {
      const user = JSON.parse(userStr)
      setCurrentUser(user)

      if (user.name) {
        const nameParts = user.name.trim().split(/\s+/)
        const titles = ['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.']
        if (nameParts.length > 1 && titles.includes(nameParts[0].toLowerCase())) {
          setFirstName(`${nameParts[0]} ${nameParts[1]}`)
        } else {
          setFirstName(nameParts[0])
        }
      } else if (user.full_name) {
        setFirstName(user.full_name.split(' ')[0])
      }

      const students = studentsStr ? JSON.parse(studentsStr) : []
      const student = studentId
        ? (students.find((s: any) => s.id === studentId) || students[0])
        : students[0]

      if (student) {
        setSelectedStudent(student)
        if (!studentId) localStorage.setItem("parent_selected_student_id", student.id)
        if (student.schoolId || student.school_id) {
          if (!localStorage.getItem("x-school-id")) {
            localStorage.setItem("x-school-id", student.schoolId || student.school_id)
          }
        }

        // Fetch settings, attendance, and notifications all in parallel
        const [settingsData] = await Promise.all([
          db.getSettings().catch((err: any) => {
            console.error("[Dashboard] Error fetching school settings:", err)
            return null
          }),
          fetchStudentAttendance(student.id, statsMode),
          fetchNotifications(user.phone),
        ])

        if (settingsData?.attendanceMode) {
          const resolvedMode = settingsData.attendanceMode === 'session_based' ? 'session' : 'daily'
          setStatsMode(resolvedMode as any)
          // If mode differs from what we used above, re-fetch attendance with correct mode
          if (resolvedMode !== statsMode) {
            fetchStudentAttendance(student.id, resolvedMode)
          }
        }
      }
    } catch (e) {
      console.error("[Dashboard] Load error:", e)
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Fetch student's attendance list
  const fetchStudentAttendance = async (studentId: string, mode?: string) => {
    try {
      const token = localStorage.getItem("attendance_token") || "";
      const schoolId = localStorage.getItem("x-school-id") || selectedStudent?.schoolId || selectedStudent?.school_id || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(schoolId ? { "x-school-id": schoolId } : {})
      };

      const params = new URLSearchParams()
      if (mode === 'daily') {
        params.set("session", "none")
      } else if (mode === 'session' || mode === 'session_based') {
        params.set("session", "session_based")
      }
      params.set("_t", Date.now().toString())

      const url = `${API_URL}/api/attendance/student/${studentId}?${params.toString()}`

      const res = await fetch(url, { headers, cache: "no-store" })
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setAttendance(data.data)
      } else {
        setAttendance([])
      }
    } catch (err) {
      console.error("[Dashboard] fetch attendance error:", err)
      setAttendance([])
    }
  }

  // 3. Fetch portal notifications & announcements
  const fetchNotifications = async (phone: string) => {
    const list = await parentDb.getNotifications(phone)
    setNotificationsList(list)
  }

  // 4. Hook studentChanged listener to reload on header switcher selection
  useEffect(() => {
    loadStudentData()

    // Background polling for "instant" updates (every 10 seconds)
    const pollInterval = setInterval(() => {
      const userStr = localStorage.getItem("attendance_current_user")
      const studentId = localStorage.getItem("parent_selected_student_id")
      
      if (userStr && studentId) {
        try {
          const user = JSON.parse(userStr)
          fetchNotifications(user.phone)
          fetchStudentAttendance(studentId, statsMode)
        } catch (e) {}
      }
    }, 10000)

    const handleStudentChange = () => {
      setIsLoading(true)
      loadStudentData()
    }

    window.addEventListener("studentChanged", handleStudentChange)
    return () => {
      window.removeEventListener("studentChanged", handleStudentChange)
      clearInterval(pollInterval)
    }
  }, [statsMode]) // Re-run poll if statsMode changes to ensure correct fetch

  // 1.5 Re-fetch on mode switch
  useEffect(() => {
     if (selectedStudent?.id) {
        fetchStudentAttendance(selectedStudent.id, statsMode)
     }
  }, [statsMode])

  const handleDismissAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await parentDb.markNotificationAsRead(id);
    if (success) {
      setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      window.dispatchEvent(new Event("refreshNotifications"));
    }
  }

  // ─── DATA CALCULATIONS ──────────────────────────────────────────────────

  // ─── GLOBAL STATS CALCULATIONS ──────────────────────────────────────────

  const isP = (s: string | undefined) => s?.toLowerCase() === "present"
  const isL = (s: string | undefined) => s?.toLowerCase() === "late"
  const isE = (s: string | undefined) => s?.toLowerCase() === "excused"
  const isA = (s: string | undefined) => s?.toLowerCase() === "absent"
  const isAtt = (s: string | undefined) => isP(s) || isL(s)

  const { dashboardStats } = (() => {
    // 1. Group by date
    const byDate: Record<string, { morning?: any; afternoon?: any; daily?: any }> = {}
    attendance.forEach(a => {
      const rawDate = a.date || a.attendance_date || a.createdAt || a.created_at
      if (!rawDate) return
      const dateStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : new Date(rawDate).toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
      if (!byDate[dateStr]) byDate[dateStr] = {}
      const sess = a.session?.toLowerCase()
      if (sess === "morning") byDate[dateStr].morning = a
      else if (sess === "afternoon") byDate[dateStr].afternoon = a
      else byDate[dateStr].daily = a
    })

    const finalRecords: any[] = []
    Object.values(byDate).forEach(entry => {
      let status = ""
      if (statsMode === "daily") {
        if (entry.morning && entry.afternoon) {
          if (isP(entry.morning.status) && isP(entry.afternoon.status)) status = "present"
          else if (isAtt(entry.morning.status) && isAtt(entry.afternoon.status)) status = "late"
          else if (isE(entry.morning.status) && isE(entry.afternoon.status)) status = "excused"
          else if (isA(entry.morning.status) && isA(entry.afternoon.status)) status = "absent"
        } else if (entry.morning || entry.afternoon || entry.daily) {
          status = (entry.morning || entry.afternoon || entry.daily).status?.toLowerCase() || ""
        }
      } else {
        const r = statsSession === "morning" ? entry.morning : entry.afternoon
        status = r?.status?.toLowerCase() || ""
      }
      if (status) finalRecords.push({ status })
    })

    const stats = {
      total: finalRecords.length,
      presents: finalRecords.filter(r => isP(r.status)).length,
      absents: finalRecords.filter(r => isA(r.status)).length,
      lates: finalRecords.filter(r => isL(r.status)).length,
      excused: finalRecords.filter(r => isE(r.status)).length,
      rate: 100
    }
    const attending = stats.presents + stats.lates + stats.excused
    stats.rate = stats.total > 0 ? Math.round((attending / stats.total) * 100) : 100

    return { dashboardStats: stats }
  })()

  // Today's attendance resolver
  const getTodayAttendance = () => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })

    // Filter records matching today's date in local timezone
    const todayRecords = attendance.filter(a => {
      const rawDate = a.date || a.attendance_date || a.createdAt || a.created_at
      if (!rawDate) return false
      const recDate = new Date(rawDate).toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
      return recDate === todayStr
    })

    const isP = (s: string | undefined) => s?.toLowerCase() === "present"
    const isL = (s: string | undefined) => s?.toLowerCase() === "late"
    const isE = (s: string | undefined) => s?.toLowerCase() === "excused"
    const isA = (s: string | undefined) => s?.toLowerCase() === "absent"
    const isAtt = (s: string | undefined) => isP(s) || isL(s)

    const morningRec = todayRecords.find(r => r.session?.toLowerCase() === "morning")
    const afternoonRec = todayRecords.find(r => r.session?.toLowerCase() === "afternoon")
    const dailyRec = todayRecords.find(r => !r.session)

    let dailyStatus = t("unmarked")
    if (morningRec && afternoonRec) {
      if (isP(morningRec.status) && isP(afternoonRec.status)) dailyStatus = t("presents")
      else if (isAtt(morningRec.status) && isAtt(afternoonRec.status)) dailyStatus = t("late_arrivals")
      else if (isE(morningRec.status) && isE(afternoonRec.status)) dailyStatus = t("excused")
      else if (isA(morningRec.status) && isA(afternoonRec.status)) dailyStatus = t("absents")
      else dailyStatus = t("mixed")
    } else if (morningRec || afternoonRec || dailyRec) {
      const rec = (morningRec || afternoonRec || dailyRec);
      const s = rec.status?.toLowerCase();
      if (s === "present") dailyStatus = t("presents");
      else if (s === "absent") dailyStatus = t("absents");
      else if (s === "late") dailyStatus = t("late_arrivals");
      else if (s === "excused") dailyStatus = t("excused");
      else dailyStatus = rec.status || t("unmarked");
    }

    return {
      daily: dailyRec?.status || null,
      morning: morningRec?.status || null,
      afternoon: afternoonRec?.status || null,
      isSessionBased: !!(morningRec || afternoonRec)
    }
  }

  const todayStatus = getTodayAttendance()

  // School announcements (general school alert notifications)
  const announcements = notificationsList.filter(n => n.type === "announcement" || n.type === "emergency" || n.type === "info")
  const emergencyNotices = announcements.filter(a => a.type === "emergency")

  // Child specific alerts (absent & late notifications)
  const recentAlerts = notificationsList.filter(n => !n.isRead && (n.type === "absent" || n.type === "late" || n.type === "warning") && n.studentId === selectedStudent?.id)

  const { language } = useLanguage()
  const formatNotificationTime = (dateStr: string) => {
    return formatLocalizedDate(dateStr, language, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Visual status stylers
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    switch (s) {
      case "present":
        return <Badge className="typography-label bg-emerald-50/50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 rounded-full h-8 px-4 font-bold shadow-none">{t("presents")}</Badge>
      case "absent":
        return <Badge className="typography-label bg-rose-50/50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 rounded-full h-8 px-4 font-bold shadow-none">{t("absents")}</Badge>
      case "late":
        return <Badge className="typography-label bg-amber-50/50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 rounded-full h-8 px-4 font-bold shadow-none">{t("late_arrivals")}</Badge>
      case "excused":
        return <Badge className="typography-label bg-sky-50/50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30 rounded-full h-8 px-4 font-bold shadow-none">{t("excused")}</Badge>
      default:
        return <Badge variant="outline" className="typography-label rounded-lg px-3 py-1">{t("unmarked")}</Badge>
    }
  }

  const getSessionCard = (title: string, status: string | null) => {
    if (!status) return null
    const s = status.toLowerCase()
    let colorClass = "bg-muted/50 border-border/20"
    let icon = <Clock className="w-4 h-4 text-muted-foreground" />
    let statusLabel = t("unmarked")

    if (s === "present") {
      colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
      icon = <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      statusLabel = t("presents")
    } else if (s === "absent") {
      colorClass = "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
      icon = <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
      statusLabel = t("absents")
    } else if (s === "late") {
      colorClass = "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
      icon = <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      statusLabel = t("late_arrivals")
    } else if (s === "excused") {
      colorClass = "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300"
      icon = <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      statusLabel = t("excused")
    }

    return (
      <div className={`flex items-center justify-between p-4 border rounded-2xl transition-all shadow-sm ${colorClass}`}>
        <span className="typography-label">{title}</span>
        <div className="flex items-center gap-2">
          {icon}
          <span className="typography-label uppercase">{statusLabel}</span>
        </div>
      </div>
    )
  }

  const getGreeting = () => {
    const hour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour12: false, hour: 'numeric' }), 10)
    if (hour < 12) return t("good_morning")
    if (hour < 17) return t("good_afternoon")
    return t("good_evening")
  }


  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-2">
        <div className="space-y-1.5 w-full md:w-auto">
          <h2 className="text-[22px] sm:text-3xl md:text-5xl font-semibold text-foreground leading-tight">
            {getGreeting()}, <span className="text-emerald-600 dark:text-emerald-400">{firstName}</span>
          </h2>
          <p className="typography-label text-muted-foreground">
            {t("dashboard_overview")}
          </p>
        </div>
      </div>

      {/* ─── EMERGENCY ALERTS BANNER ──────────────────────────────────────── */}
      {emergencyNotices.length > 0 && (
        <div className="space-y-4">
          {emergencyNotices.map((notice) => (
            <Alert key={notice.id} variant="destructive" className="border-rose-500/40 bg-rose-500/5 text-rose-800 dark:text-rose-200 rounded-2xl shadow-lg shadow-rose-500/5 animate-in slide-in-from-top-4 duration-500">
              <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <AlertTitle className="typography-card-title uppercase flex items-center gap-2">
                {t("emergency_notice")}
              </AlertTitle>
              <AlertDescription className="typography-label mt-2">
                <span className="text-rose-900 dark:text-rose-100 font-bold">{notice.title}:</span> {notice.message}
                <span className="typography-label block opacity-90 mt-2 uppercase text-[10px]">Posted: {formatNotificationTime(notice.createdAt)}</span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* ─── TODAY'S ATTENDANCE SUMMARY CARD ──────────────────────────────── */}
      <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 transition-all overflow-hidden relative">
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-inner">
                <UserCheck className="w-7 h-7" />
              </div>
              <div>
                <p className="typography-label text-emerald-600 dark:text-emerald-400 uppercase mb-1">{t("today_attendance")}</p>
                <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold text-foreground min-h-[38px] flex items-center">
                  {isLoading || !selectedStudent ? (
                    <span className="inline-block w-48 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md" />
                  ) : (
                    selectedStudent?.fullName
                  )}
                </h2>
                <p className="typography-label text-foreground/80 dark:text-foreground/70 mt-1.5 flex items-center gap-2">
                  {isLoading || !selectedStudent ? (
                    <span className="inline-block w-24 h-4 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md" />
                  ) : (
                    <>
                      <Badge variant="secondary" className="typography-label">{t("grade")} {selectedStudent?.grade}</Badge>
                      <span className="opacity-40">•</span>
                      <Badge variant="secondary" className="typography-label">{t("section")} {selectedStudent?.section}</Badge>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex-grow max-w-lg w-full">
              {isLoading ? (
                <div className="flex justify-center gap-4">
                  <div className="p-6 bg-muted/40 border-2 border-border/10 rounded-3xl flex flex-col justify-center items-center gap-3 shadow-sm max-w-xs w-full animate-pulse h-28" />
                </div>
              ) : todayStatus.isSessionBased ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Morning */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 rounded-3xl flex flex-col justify-center items-center gap-3 shadow-none hover:border-primary/20 transition-all group">
                    <span className="typography-label text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">{t("morning_session")}</span>
                    {todayStatus.morning ? getStatusBadge(todayStatus.morning) : <span className="typography-label text-muted-foreground/40 italic">-</span>}
                  </div>

                  {/* Afternoon */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 rounded-3xl flex flex-col justify-center items-center gap-3 shadow-none hover:border-primary/20 transition-all group">
                    <span className="typography-label text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">{t("afternoon_session")}</span>
                    {todayStatus.afternoon ? getStatusBadge(todayStatus.afternoon) : <span className="typography-label text-muted-foreground/40 italic">-</span>}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 rounded-3xl flex flex-col justify-center items-center gap-3 shadow-sm max-w-xs w-full hover:border-primary/20 transition-all group">
                    <span className="typography-label text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">{t("status_label")}</span>
                    {todayStatus.daily ? getStatusBadge(todayStatus.daily) : <span className="typography-label text-muted-foreground/40 italic">{t("unmarked")}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── QUICK STATS & CIRCULAR GAUGE ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Attendance Rate Circular Progress Card */}
        <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden transition-all">
          <CardHeader className="pb-4">
            <CardTitle className="typography-card-title uppercase text-foreground/80">{t("attendance_rate")}</CardTitle>
            <CardDescription className="typography-label">{t("attendance_rate_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 pt-0 flex-1">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* SVG Ring Gauge */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-muted dark:stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-emerald-500 dark:stroke-emerald-400 transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - dashboardStats.rate / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="typography-page-title text-foreground min-h-[38px] flex items-center">
                  {isLoading ? (
                    <span className="inline-block w-12 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md" />
                  ) : (
                    `${dashboardStats.rate}%`
                  )}
                </span>
                <span className="typography-label text-muted-foreground uppercase mt-1 opacity-80">{t("rating")}</span>
              </div>
            </div>

            <div className="typography-label flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mt-6 bg-emerald-500/10 p-2 px-4 rounded-full border border-emerald-500/20 shadow-sm">
              <TrendingUp className="w-4 h-4" />
              <span className="uppercase tracking-wide">{t("target_text")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Metrics Numbers Card */}
        <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden lg:col-span-2 transition-all">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div>
              <CardTitle className="typography-card-title uppercase text-foreground/80">{t("term_summary")}</CardTitle>
              <CardDescription className="typography-label">Out of {dashboardStats.total} {t("total_days")} recorded</CardDescription>
            </div>

            {/* Mode Selector Dropdown */}
            <div className="flex items-center gap-3">
              <Select
                value={statsMode}
                onValueChange={(val: string) => setStatsMode(val as any)}
              >
                <SelectTrigger className="typography-label w-28 h-8 border-none bg-muted/40 hover:bg-muted/60 rounded-xl focus:ring-0 focus:ring-offset-0 px-3">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/40 shadow-xl">
                  <SelectItem value="daily" className="typography-helper rounded-lg">{t("daily_view")}</SelectItem>
                  <SelectItem value="session" className="typography-helper rounded-lg">{t("session_view")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Session Filters (only if in session mode) */}
              {statsMode === "session" && (
                <div className="flex p-0.5 bg-sky-500/10 rounded-lg animate-in slide-in-from-left-2 duration-300">
                  <button
                    onClick={() => setStatsSession("morning")}
                    className={`px-3 py-1 rounded-md typography-label text-[10px] uppercase transition-all ${statsSession === "morning" ? "bg-white dark:bg-slate-800 shadow-sm text-sky-600 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t("morning_session")}
                  </button>
                  <button
                    onClick={() => setStatsSession("afternoon")}
                    className={`px-3 py-1 rounded-md typography-label text-[10px] uppercase transition-all ${statsSession === "afternoon" ? "bg-white dark:bg-slate-800 shadow-sm text-sky-600 font-bold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t("afternoon_session")}
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-center space-y-1.5 shadow-sm">
                <span className="typography-label text-emerald-700 dark:text-emerald-400 uppercase">{t("presents")}</span>
                <p className="typography-page-title text-emerald-600 dark:text-emerald-400 min-h-[38px] flex items-center justify-center">
                  {isLoading ? (
                    <span className="inline-block w-8 h-6 bg-emerald-500/20 animate-pulse rounded-md" />
                  ) : (
                    dashboardStats.presents
                  )}
                </p>
                <span className="typography-label text-muted-foreground/80 block">{t("days_in_class")}</span>
              </div>

              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-center space-y-1.5 shadow-sm">
                <span className="typography-label text-rose-700 dark:text-rose-400 uppercase">{t("absents")}</span>
                <p className="typography-page-title text-rose-600 dark:text-rose-400 min-h-[38px] flex items-center justify-center">
                  {isLoading ? (
                    <span className="inline-block w-8 h-6 bg-rose-500/20 animate-pulse rounded-md" />
                  ) : (
                    dashboardStats.absents
                  )}
                </p>
                <span className="typography-label text-muted-foreground/80 block">{t("unexcused_cuts")}</span>
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-center space-y-1.5 shadow-sm">
                <span className="typography-label text-amber-700 dark:text-amber-400 uppercase">{t("late_arrivals")}</span>
                <p className="typography-page-title text-amber-600 dark:text-amber-400 min-h-[38px] flex items-center justify-center">
                  {isLoading ? (
                    <span className="inline-block w-8 h-6 bg-amber-500/20 animate-pulse rounded-md" />
                  ) : (
                    dashboardStats.lates
                  )}
                </p>
                <span className="typography-label text-muted-foreground/80 block">{t("tardy_logs")}</span>
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-center space-y-1.5 shadow-sm">
                <span className="typography-label text-blue-700 dark:text-blue-400 uppercase">{t("excused")}</span>
                <p className="typography-page-title text-blue-600 dark:text-blue-400 min-h-[38px] flex items-center justify-center">
                  {isLoading ? (
                    <span className="inline-block w-8 h-6 bg-blue-500/20 animate-pulse rounded-md" />
                  ) : (
                    dashboardStats.excused
                  )}
                </p>
                <span className="typography-label text-muted-foreground/80 block">{t("approved_leaves")}</span>
              </div>

            </div>

            <div className="typography-body mt-8 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-t border-border/40 pt-5 px-1 text-foreground/70">
              <span className="typography-label">{t("leave_request_prompt")}</span>
              <button
                onClick={() => router.push("/parent/profile")}
                className="typography-label text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-4 flex items-center gap-2 group text-left"
              >
                <span>{t("contact_advisor")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ─── NOTIFICATIONS FEED & ANNOUNCEMENTS PANELS ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Recent Absences & Late Alerts */}
        <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 transition-all">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
            <div>
              <CardTitle className="typography-card-title uppercase text-foreground/80 flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-500" />
                <span>{t("recent_alerts")}</span>
              </CardTitle>
              <CardDescription className="typography-label mt-1 italic text-muted-foreground/80">{t("critical_notification_for", { name: selectedStudent?.fullName || "" })}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              [1, 2].map((i) => (
                <div key={i} className="flex gap-4 p-4 border-2 rounded-2xl animate-pulse bg-slate-50 dark:bg-slate-800/50 border-border/10">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : recentAlerts.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-3xl border-2 border-dashed border-border/20">
                <CheckCircle className="w-12 h-12 text-emerald-500/50 mb-3" />
                <p className="typography-label uppercase">{t("no_alerts")}</p>
                <span className="typography-label text-muted-foreground/80 mt-2">{t("excellent_consistency")}</span>
              </div>
            ) : (
              recentAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex gap-4 p-4 border-2 rounded-2xl transition-all shadow-sm ${alert.type === "absent"
                      ? "bg-rose-500/10 border-rose-500/20 shadow-rose-500/5"
                      : "bg-amber-500/10 border-amber-500/20 shadow-amber-500/5"
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${alert.type === "absent" ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                    }`}>
                    {alert.type === "absent" ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="typography-label text-foreground uppercase">{alert.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="typography-label text-muted-foreground opacity-70">{formatNotificationTime(alert.createdAt)}</span>
                        <button
                          onClick={(e) => handleDismissAlert(alert.id, e)}
                          className="text-muted-foreground hover:text-rose-500 transition-colors"
                          title="Dismiss alert"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="typography-label text-foreground/80 dark:text-foreground/70 mt-2">{alert.message}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right: School Announcements Board */}
        <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 transition-all">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
            <div className="flex flex-col">
              <CardTitle className="typography-card-title uppercase text-foreground/80 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-emerald-500" />
                <span>{t("school_announcements")}</span>
              </CardTitle>
              <CardDescription className="typography-label mt-1 italic text-muted-foreground/80">{t("notifications_desc")}</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push("/parent/announcements")}
              className="typography-label text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl gap-2 font-bold uppercase transition-all"
            >
              <span>{t("view_all")}</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              [1, 2].map((i) => (
                <div key={i} className="p-5 border-2 rounded-3xl space-y-3 animate-pulse bg-slate-50 dark:bg-slate-800/50 border-border/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                </div>
              ))
            ) : announcements.filter(a => a.type !== "emergency").length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-3xl border-2 border-dashed border-border/20">
                <BookOpen className="w-12 h-12 text-emerald-500/50 mb-3" />
                <p className="typography-label uppercase font-bold">{t("no_announcements")}</p>
                <span className="typography-label text-muted-foreground/80 mt-2 italic px-8 text-center">{t("check_back_later_newsletters")}</span>
              </div>
            ) : (
              announcements.slice(0, 5).map((announcement) => (
                <div 
                  key={announcement.id} 
                  className={`p-5 border-2 hover:border-emerald-500/20 rounded-3xl space-y-3 shadow-none group transition-all duration-300 cursor-pointer ${
                    announcement.type === "emergency" 
                      ? "bg-rose-500/5 border-rose-500/10 hover:bg-rose-500/10" 
                      : announcement.type === "info"
                      ? "bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10"
                      : "bg-muted/30 border-border/5 hover:bg-white dark:hover:bg-slate-800/50"
                  }`}
                  onClick={() => router.push("/parent/announcements")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {announcement.type === "emergency" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      <span className={`typography-label font-bold uppercase transition-colors truncate ${
                        announcement.type === "emergency" ? "text-rose-700" : "text-foreground group-hover:text-emerald-600"
                      }`}>
                        {announcement.title}
                      </span>
                    </div>
                    <span className="typography-label text-[10px] text-muted-foreground/60 whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full font-bold">
                       {formatNotificationTime(announcement.createdAt)}
                    </span>
                  </div>
                  <p className="typography-body text-sm text-foreground/70 dark:text-foreground/60 line-clamp-2 leading-relaxed italic">
                    "{announcement.message}"
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  )
}
