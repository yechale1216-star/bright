"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/lib/context/language-context"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  CalendarDays,
  ListOrdered,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserCheck
} from "lucide-react"
import { formatLocalizedDate } from "@/lib/utils/date-utils"
import { db } from "@/lib/db/database"
import { toEthiopianDate, ethiopicToJDN, jdnToGregorian, ET_MONTHS_AM, ET_MONTHS_EN } from "@/lib/utils/ethiopian-calendar"
import { useRef } from "react"

import { apiUrl } from "@/lib/api-config"
const API_URL = apiUrl;

export default function AttendanceHistory() {
  const { t, language } = useLanguage()
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Filters state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<"calendar" | "table">("calendar")
  const [attendanceMode, setAttendanceMode] = useState<"daily" | "session">("daily")
  const [sessionFilter, setSessionFilter] = useState<"morning" | "afternoon">("morning")

  const months = language === 'am' ? ET_MONTHS_AM : [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  // 1. Initial Load & Auth verification
  const loadData = async () => {
    const studentId = localStorage.getItem("parent_selected_student_id")
    const studentsStr = localStorage.getItem("parent_students")

    if (studentsStr && studentId) {
      const students = JSON.parse(studentsStr)
      const student = students.find((s: any) => s.id === studentId) || students[0]
      if (student) {
        setSelectedStudent(student)
        
        // Fetch academic year/settings and attendance concurrently
        const [settings] = await Promise.all([
          db.getSettings().catch((err) => {
            console.error("Failed to load school settings:", err)
            return null
          }),
          fetchStudentAttendance(student.id)
        ])

        if (settings?.attendanceMode) {
          const currentMode = settings.attendanceMode === 'session_based' ? 'session' : 'daily'
          setAttendanceMode(currentMode as any)
        }

        if (settings?.academicYear) {
          const yearMatch = settings.academicYear.match(/\d{4}/)
          if (yearMatch) {
            const gYear = parseInt(yearMatch[0])
            if (language === 'am') {
              const ec = toEthiopianDate(new Date(gYear, 4, 1))
              setSelectedYear(ec.year)
            } else {
              setSelectedYear(gYear)
            }
          }
        } else {
          const now = new Date()
          if (language === 'am') {
            setSelectedYear(toEthiopianDate(now).year)
          } else {
            setSelectedYear(now.getFullYear())
          }
        }
      }
    }
    setIsLoading(false)
  }

  // 2. Fetch student's attendance list
  const fetchStudentAttendance = async (studentId: string, mode?: string) => {
    setFetchError(null)
    try {
      const token = localStorage.getItem("attendance_token") || "";
      const schoolId = localStorage.getItem("x-school-id") || "";
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(schoolId ? { "x-school-id": schoolId } : {})
      };

      // Narrow fetch based on attendance mode if requested
      let url = `${API_URL}/api/attendance/student/${studentId}`
      if (mode === 'daily') {
        url += "?session=none"
      } else if (mode === 'session_based' || mode === 'session') {
        // If searching specifically for sessions, we could filter here, 
        // but often we want all records for session aggregation logic.
        // For now, let's keep session mode fetching everything to allow aggregation.
      }

      const res = await fetch(url, { headers })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.message || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setAttendance(data.data)
      } else {
        setAttendance([])
      }
    } catch (err: any) {
      console.error("[AttendanceHistory] Fetch error:", err)
      setFetchError(err?.message || "Failed to load attendance records.")
      setAttendance([])
    }
  }

  // Hook studentChanged event
  useEffect(() => {
    loadData()

    const handleStudentChange = () => {
      setIsLoading(true)
      setAttendance([])   // Clear stale data immediately on student switch
      setFetchError(null)
      loadData()
    }

    window.addEventListener("studentChanged", handleStudentChange)
    return () => window.removeEventListener("studentChanged", handleStudentChange)
  }, [])

  // 1.8 Re-fetch on mode change
  useEffect(() => {
    if (selectedStudent?.id) {
       fetchStudentAttendance(selectedStudent.id, attendanceMode)
    }
  }, [attendanceMode])

  // 1.5 Handle language change to sync calendar selection
  const lastLang = useRef(language)
  useEffect(() => {
    if (lastLang.current !== language) {
       // Convert current selection to the other calendar
       if (language === 'am') {
         // GC -> EC
         const gcDate = new Date(selectedYear, selectedMonth, 15) // Use middle of month
         const ec = toEthiopianDate(gcDate)
         setSelectedMonth(ec.month)
         setSelectedYear(ec.year)
       } else {
         // EC -> GC
         const jdn = ethiopicToJDN(selectedYear, selectedMonth, 15)
         const gc = jdnToGregorian(jdn)
         setSelectedMonth(gc.getMonth())
         setSelectedYear(gc.getFullYear())
       }
       lastLang.current = language
    }
  }, [language, selectedMonth, selectedYear])

  // ─── FILTER CALCULATIONS ────────────────────────────────────────────────

  const isP = (s: string | undefined) => s?.toLowerCase() === "present"
  const isL = (s: string | undefined) => s?.toLowerCase() === "late"
  const isE = (s: string | undefined) => s?.toLowerCase() === "excused"
  const isA = (s: string | undefined) => s?.toLowerCase() === "absent"
  const isAtt = (s: string | undefined) => isP(s) || isL(s)

  // Groups and metrics calculation based on current mode
  const { filteredAttendance, monthlyStats, calendarData } = (() => {
    const isAm = language === 'am'
    const selectedMonthStr = String(selectedMonth + 1).padStart(2, "0")
    const selectedMonthPrefix = `${selectedYear}-${selectedMonthStr}`

    // 1. Group by date to handle daily logic
    const byDate: Record<string, { morning?: any; afternoon?: any; daily?: any }> = {}
    attendance.forEach(a => {
      const dateStr = (a.date || "").slice(0, 10)
      if (!byDate[dateStr]) byDate[dateStr] = {}
      const sess = a.session?.toLowerCase()
      if (sess === "morning") byDate[dateStr].morning = a
      else if (sess === "afternoon") byDate[dateStr].afternoon = a
      else byDate[dateStr].daily = a
    })

    // 2. Derive records based on Mode
    const calendarData: Record<string, string> = {}
    const finalMonthlyRecords: any[] = []

    Object.entries(byDate).forEach(([dateStr, entry]) => {
      if (isAm) {
        const d = new Date(dateStr)
        const ec = toEthiopianDate(d)
        if (ec.month !== selectedMonth || ec.year !== selectedYear) return
      } else {
        if (!dateStr.startsWith(selectedMonthPrefix)) return
      }

      let status = ""
      if (attendanceMode === "daily") {
        if (entry.morning && entry.afternoon) {
          if (isP(entry.morning.status) && isP(entry.afternoon.status)) status = "present"
          else if (isAtt(entry.morning.status) && isAtt(entry.afternoon.status)) status = "late"
          else if (isE(entry.morning.status) && isE(entry.afternoon.status)) status = "excused"
          else if (isA(entry.morning.status) && isA(entry.afternoon.status)) status = "absent"
        } else if (entry.morning || entry.afternoon || entry.daily) {
          const r = entry.morning || entry.afternoon || entry.daily
          status = r.status?.toLowerCase() || ""
        }
        if (status) {
          calendarData[dateStr] = status
          finalMonthlyRecords.push({ id: dateStr, date: dateStr, status })
        }
      } else {
        // Session Mode
        const r = sessionFilter === "morning" ? entry.morning : entry.afternoon
        if (r) {
          status = r.status?.toLowerCase() || ""
          calendarData[dateStr] = status
          finalMonthlyRecords.push(r)
        }
      }
    })

    // 3. Stats from current month view
    const stats = {
      total: finalMonthlyRecords.length,
      presents: finalMonthlyRecords.filter(r => isP(r.status)).length,
      absents: finalMonthlyRecords.filter(r => isA(r.status)).length,
      lates: finalMonthlyRecords.filter(r => isL(r.status)).length,
      excused: finalMonthlyRecords.filter(r => isE(r.status)).length,
      rate: 100
    }
    const attending = stats.presents + stats.lates + stats.excused
    stats.rate = stats.total > 0 ? Math.round((attending / stats.total) * 100) : 100

    return {
      filteredAttendance: finalMonthlyRecords.sort((a, b) => a.date.localeCompare(b.date)),
      monthlyStats: stats,
      calendarData
    }
  })()

  // ─── CALENDAR RENDERING GENERATORS ──────────────────────────────────────

  const getEthioDaysInMonth = (year: number, month: number) => {
    if (month < 12) return 30
    // Pagume
    const isLeap = (year + 1) % 4 === 0
    return isLeap ? 6 : 5
  }

  const getEthioFirstDayOfMonth = (year: number, month: number) => {
    // Meskerem 1, 1 EC was a Monday (index 1)
    // Meskerem 1, 2016 EC was a Tuesday (index 2)? No, Sept 12 2023 was Tuesday.
    // Calculation of start day for EC:
    const jdn = ethiopicToJDN(year, month, 1)
    return (Math.floor(jdn + 1.5) % 7) // 0 = Sunday, 1 = Monday etc.
  }


  const getDaysInMonth = (year: number, month: number) => {
    if (language === 'am') return getEthioDaysInMonth(year, month)
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    if (language === 'am') return getEthioFirstDayOfMonth(year, month)
    return new Date(year, month, 1).getDay()
  }

  const handlePrevMonth = () => {
    const maxMonths = language === 'am' ? 13 : 12
    if (selectedMonth === 0) {
      setSelectedMonth(maxMonths - 1)
      setSelectedYear(prev => prev - 1)
    } else {
      setSelectedMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    const maxMonths = language === 'am' ? 13 : 12
    if (selectedMonth === maxMonths - 1) {
      setSelectedMonth(0)
      setSelectedYear(prev => prev + 1)
    } else {
      setSelectedMonth(prev => prev + 1)
    }
  }

  // Generate calendar days grid
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth)
  const firstDayIndex = getFirstDayOfMonth(selectedYear, selectedMonth)

  const calendarCells = []

  // Blank days before 1st of month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ day: null, dateStr: null })
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    let dateStr = ""
    if (language === 'am') {
      // Find the Gregorian date for this Ethiopian date
      const jdn = ethiopicToJDN(selectedYear, selectedMonth, d)
      const g = jdnToGregorian(jdn)
      const mm = String(g.getMonth() + 1).padStart(2, "0")
      const dd = String(g.getDate()).padStart(2, "0")
      dateStr = `${g.getFullYear()}-${mm}-${dd}`
    } else {
      const mm = String(selectedMonth + 1).padStart(2, "0")
      const dd = String(d).padStart(2, "0")
      dateStr = `${selectedYear}-${mm}-${dd}`
    }
    calendarCells.push({ day: d, dateStr })
  }


  // Find attendance status for a calendar day
  const getDayAttendance = (dateStr: string) => {
    return calendarData[dateStr] || null
  }

  // Visual classes for calendar circles
  const getCalendarDayColor = (status: string | null) => {
    if (!status) return "hover:bg-muted"
    switch (status.toLowerCase()) {
      case "present":
        return "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-extrabold ring-2 ring-emerald-500/30"
      case "absent":
        return "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 font-extrabold ring-2 ring-rose-500/30"
      case "late":
        return "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-extrabold ring-2 ring-amber-500/30"
      case "excused":
        return "bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300 font-extrabold ring-2 ring-blue-500/30"
      default:
        return "hover:bg-muted"
    }
  }

  const formatTableDate = (dateStr: string) => {
    return formatLocalizedDate(dateStr, language, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    switch (s) {
      case "present":
        return <Badge className="typography-label bg-emerald-500 hover:bg-emerald-600 border-none rounded-lg">{t("presents")}</Badge>
      case "absent":
        return <Badge className="typography-label bg-rose-500 hover:bg-rose-600 border-none rounded-lg">{t("absents")}</Badge>
      case "late":
        return <Badge className="typography-label bg-amber-500 hover:bg-amber-600 border-none rounded-lg">{t("late_arrivals")}</Badge>
      case "excused":
        return <Badge className="typography-label bg-blue-500 hover:bg-blue-600 border-none rounded-lg">{t("excused")}</Badge>
      default:
        return <Badge variant="outline" className="typography-label rounded-lg">{t("unmarked")}</Badge>
    }
  }

  if (isLoading) {
    return <PageSkeleton variant="table" />
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h3 className="typography-section-title text-foreground">{t("error_loading")}</h3>
        <p className="typography-label text-muted-foreground max-w-xs text-center">{fetchError}</p>
        <button
          onClick={() => selectedStudent && fetchStudentAttendance(selectedStudent.id, attendanceMode)}
          className="typography-label px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all"
        >
          {t("retry")}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ─── TITLE & MONTH SELECTOR BAR ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="typography-page-title text-foreground">{t("view_history")}</h1>
          <p className="typography-label text-muted-foreground mt-0.5">{t("attendance_history_desc")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-card/60 backdrop-blur-md p-1.5 rounded-2xl border border-border/40 shrink-0">

          {/* Mode Selector Dropdown */}
          <Select
            value={attendanceMode}
            onValueChange={(val) => setAttendanceMode(val as any)}
          >
            <SelectTrigger className="typography-label w-32 h-9 border-none bg-muted/40 hover:bg-muted/60 rounded-xl focus:ring-0 focus:ring-offset-0 px-3">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/40 shadow-xl">
              <SelectItem value="daily" className="typography-helper rounded-lg">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t("daily_view")}</span>
                </div>
              </SelectItem>
              <SelectItem value="session" className="typography-helper rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-sky-600" />
                  <span>{t("session_view")}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Session Sub-Selector (only if mode is session) */}
          {attendanceMode === "session" && (
            <div className="flex p-0.5 bg-sky-500/10 rounded-xl animate-in slide-in-from-left-2 duration-300">
              <button
                onClick={() => setSessionFilter("morning")}
                className={`px-4 py-1.5 rounded-lg typography-label text-[11px] uppercase transition-all flex items-center gap-1.5 ${sessionFilter === "morning" ? "bg-white dark:bg-slate-800 shadow-md text-sky-600 font-bold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("morning_session")}
              </button>
              <button
                onClick={() => setSessionFilter("afternoon")}
                className={`px-4 py-1.5 rounded-lg typography-label text-[11px] uppercase transition-all flex items-center gap-1.5 ${sessionFilter === "afternoon" ? "bg-white dark:bg-slate-800 shadow-md text-sky-600 font-bold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("afternoon_session")}
              </button>
            </div>
          )}

          <div className="h-6 w-px bg-border/40 mx-1 hidden sm:block" />

          <Select
            value={selectedMonth.toString()}
            onValueChange={(val) => setSelectedMonth(parseInt(val))}
          >
            <SelectTrigger className="typography-label w-32 h-9 border-none bg-transparent hover:bg-muted rounded-xl focus:ring-0 focus:ring-offset-0 px-3">
              <SelectValue placeholder={t("month")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {months.map((m, idx) => (
                <SelectItem key={m} value={idx.toString()} className="typography-helper rounded-lg">
                  {language === 'am' ? m : t(m.toLowerCase() as any)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-9 px-3 flex items-center bg-muted/20 rounded-xl border border-border/10">
             <span className="typography-label text-muted-foreground mr-2">{t("year")}:</span>
             <span className="typography-label font-bold text-foreground">{selectedYear}</span>
          </div>
        </div>
      </div>

      {/* ─── MONTHLY STATS SUMMARY CARD ───────────────────────────────────── */}
      <Card className="border-border/40 shadow-xl rounded-3xl bg-card/60 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">

            {/* Monthly attendance circular rate */}
            <div className="flex items-center gap-4 md:col-span-2 md:border-r border-border/20 md:pr-6">
              <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className="stroke-muted dark:stroke-slate-800" strokeWidth="10" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-emerald-500 dark:stroke-emerald-400 transition-all duration-700"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - monthlyStats.rate / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="typography-label absolute text-foreground">{monthlyStats.rate}%</span>
              </div>
              <div>
                <p className="typography-label text-[10px] text-muted-foreground uppercase">{t("monthly_score")}</p>
                <h3 className="typography-card-title">{t(months[selectedMonth].toLowerCase() as any)} {selectedYear}</h3>
                <span className="typography-label text-[10px] text-muted-foreground">
                  {attendanceMode === "session" ? t(sessionFilter === "morning" ? "morning_session" : "afternoon_session") : t("daily_view")} {t("for", { name: selectedStudent?.fullName.split(" ")[0] || "" })}
                </span>
              </div>
            </div>

            {/* Quick breakdown metrics */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 md:col-span-3">
              <div className="text-center space-y-0.5">
                <p className="typography-label text-[10px] text-muted-foreground">{t("total_days")}</p>
                <span className="typography-card-title text-foreground">{monthlyStats.total}</span>
              </div>
              <div className="text-center space-y-0.5">
                <p className="typography-label text-[10px] text-muted-foreground text-emerald-600 dark:text-emerald-400">{t("presents")}</p>
                <span className="typography-card-title text-emerald-600 dark:text-emerald-400">{monthlyStats.presents}</span>
              </div>
              <div className="text-center space-y-0.5">
                <p className="typography-label text-[10px] text-muted-foreground text-rose-600 dark:text-rose-400">{t("absents")}</p>
                <span className="typography-card-title text-rose-600 dark:text-rose-400">{monthlyStats.absents}</span>
              </div>
              <div className="text-center space-y-0.5">
                <p className="typography-label text-[10px] text-muted-foreground text-amber-600 dark:text-amber-400">{t("late_arrivals")}</p>
                <span className="typography-card-title text-amber-600 dark:text-amber-400">{monthlyStats.lates}</span>
              </div>
              <div className="text-center space-y-0.5">
                <p className="typography-label text-[10px] text-muted-foreground text-blue-600 dark:text-blue-400">{t("excused")}</p>
                <span className="typography-card-title text-blue-600 dark:text-blue-400">{monthlyStats.excused}</span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ─── CALENDAR / TABLE TABS DISPLAY ────────────────────────────────── */}
      <Tabs
        defaultValue="calendar"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="bg-card/60 backdrop-blur-md border border-border/40 p-1 rounded-2xl">
            <TabsTrigger value="calendar" className="typography-label gap-1.5 rounded-xl px-4 py-2">
              <CalendarDays className="w-4 h-4" />
              <span>{t("calendar_grid")}</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="typography-label gap-1.5 rounded-xl px-4 py-2">
              <ListOrdered className="w-4 h-4" />
              <span>{t("audit_log_list")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Indicators description */}
          <div className="typography-label hidden lg:flex items-center gap-4 text-[10px] uppercase text-muted-foreground/80">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>{t("presents")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>{t("absents")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>{t("late_arrivals")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>{t("excused")}</span>
            </div>
          </div>
        </div>

        {/* 1. CALENDAR GRID TRIGGER VIEW */}
        <TabsContent value="calendar" className="outline-none">
          <Card className="border-border/40 shadow-xl rounded-3xl bg-card/60 backdrop-blur-md overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/20 py-4 px-6">
              <div className="space-y-0.5">
                <CardTitle className="typography-label uppercase text-foreground">
                  {language === 'am' ? months[selectedMonth] : t(months[selectedMonth].toLowerCase() as any)} {selectedYear}
                </CardTitle>
                <CardDescription className="typography-helper">{t("attendance_history_desc")}</CardDescription>
              </div>
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/10">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-background rounded-md text-muted-foreground hover:text-foreground transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6">

              {/* Calendar Grid Header */}
              <div className="typography-label grid grid-cols-7 text-center uppercase text-muted-foreground/80 mb-4 pb-2 border-b border-border/20">
                <span>{t("sun")}</span>
                <span>{t("mon")}</span>
                <span>{t("tue")}</span>
                <span>{t("wed")}</span>
                <span>{t("thu")}</span>
                <span>{t("fri")}</span>
                <span>{t("sat")}</span>
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2.5 md:gap-4">
                {calendarCells.map((cell, idx) => {
                  if (cell.day === null || !cell.dateStr) {
                    return <div key={`empty-${idx}`} className="aspect-square bg-muted/5 rounded-2xl" />
                  }

                  const dayStatus = getDayAttendance(cell.dateStr)
                  return (
                    <div
                      key={cell.dateStr}
                      className={`aspect-square flex flex-col items-center justify-center p-1 border border-border/10 rounded-2xl transition-all relative group select-none ${getCalendarDayColor(dayStatus)}`}
                    >
                      <span className="typography-label text-sm sm:text-base font-semibold">{cell.day}</span>

                      {/* Status Icon */}
                      {dayStatus && (
                        <div className="mt-1 flex justify-center items-center opacity-90">
                          {dayStatus === "present" && <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />}
                          {dayStatus === "absent" && <XCircle className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />}
                          {dayStatus === "late" && <Clock className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />}
                          {dayStatus === "excused" && <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. TABLE AUDIT LOG LIST VIEW */}
        <TabsContent value="table" className="outline-none animate-in fade-in duration-300">
          <Card className="border-border/40 shadow-xl rounded-3xl bg-card/60 backdrop-blur-md overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border/20">
                    <TableRow>
                      <TableHead className="typography-label uppercase text-muted-foreground py-4 px-6">{t("date")}</TableHead>
                      <TableHead className="typography-label uppercase text-muted-foreground py-4 px-6">{t("session")}</TableHead>
                      <TableHead className="typography-label uppercase text-muted-foreground py-4 px-6">{t("status_label")}</TableHead>
                      <TableHead className="typography-label uppercase text-muted-foreground py-4 px-6">{t("remarks")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-16 text-muted-foreground">
                          <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="typography-label">{t("no_attendance_records")}</p>
                          <span className="typography-label text-[10px] text-muted-foreground/60">{t("verify_month")}</span>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAttendance.map((record) => (
                        <TableRow key={record.id} className="border-b border-border/20 hover:bg-muted/10">
                          <TableCell className="typography-label py-4 px-6">{formatTableDate(record.date)}</TableCell>
                          <TableCell className="typography-label py-4 px-6 text-muted-foreground">
                            {record.session ? (
                              <Badge variant="outline" className="typography-label capitalize text-[10px] rounded-md bg-muted/40">
                                {record.session === "morning" ? t("morning_session") : t("afternoon_session")}
                              </Badge>
                            ) : (
                              <span className="typography-helper italic text-muted-foreground/60">{t("full_day")}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 px-6">{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="typography-label py-4 px-6 text-muted-foreground max-w-xs truncate">
                            {record.remarks || <span className="text-muted-foreground/40 italic text-[11px]">{t("no_notes")}</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

    </div>
  )
}
