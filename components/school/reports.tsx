"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Download, Printer, Calendar, Users, UserCheck, Clock, UserX, AlertTriangle, TrendingUp, TrendingDown, PieChart as PieChartIcon, Search } from "lucide-react"
import { db, type Student } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { ValidationService } from "@/lib/utils/validation"
import { authService } from "@/lib/auth/auth"
import { parseJsonResponse } from "@/lib/utils/parse-json-response"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts"
import { cn } from "@/lib/utils/utils"

interface StudentReport {
  student: Student
  totalDays: number
  presentDays: number
  lateDays: number
  absentDays: number
  excusedDays: number
  attendanceRate: number
  morningPresent?: number
  morningRate?: number
  afternoonPresent?: number
  afternoonRate?: number
}

export function Reports() {
  const [students, setStudents] = useState<Student[]>([])
  const [studentsLoaded, setStudentsLoaded] = useState(false)
  const [reportData, setReportData] = useState<StudentReport[]>([])
  const [filteredReports, setFilteredReports] = useState<StudentReport[]>([])
  const [rawAttendance, setRawAttendance] = useState<any[]>([])
  const [reportType, setReportType] = useState("monthly")
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    return firstDayOfMonth.toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return today.toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
  })
  const [gradeFilter, setGradeFilter] = useState("All Grades")
  const [streamFilter, setStreamFilter] = useState("All Streams")
  const [sectionFilter, setSectionFilter] = useState("All Sections")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<"total" | "morning" | "afternoon">("total")
  const [dateValidationErrors, setDateValidationErrors] = useState<string[]>([])
  const { settings } = useSchoolSettings()
  const isSessionBased = settings?.attendanceMode === "session_based"

  useEffect(() => {
    setMounted(true)
    const user = authService.getCurrentUser()
    setIsAdmin(user?.role === "admin")
    loadStudents()

    // Refresh student list when students are added/edited/deleted from another module
    const handleStudentChanged = () => loadStudents()
    window.addEventListener("studentDataChanged", handleStudentChanged)
    return () => window.removeEventListener("studentDataChanged", handleStudentChanged)
  }, [])

  useEffect(() => {
    const TARGET_TZ = 'Africa/Addis_Ababa'
    const getAddisDate = () => new Date()
    
    if (reportType === "daily") {
      const todayString = getAddisDate().toLocaleDateString('en-CA', { timeZone: TARGET_TZ })
      setStartDate(todayString)
      setEndDate(todayString)
    } else if (reportType === "weekly") {
      const today = getAddisDate()
      // Get day of week in Addis Ababa (0-6, 0=Sunday)
      const dayOfWeek = new Date(today.toLocaleString("en-US", { timeZone: TARGET_TZ })).getDay()
      
      const firstDayOfWeek = new Date(today)
      firstDayOfWeek.setDate(today.getDate() - dayOfWeek)
      
      setStartDate(firstDayOfWeek.toLocaleDateString('en-CA', { timeZone: TARGET_TZ }))
      setEndDate(today.toLocaleDateString('en-CA', { timeZone: TARGET_TZ }))
    } else if (reportType === "monthly") {
      const today = getAddisDate()
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(firstDayOfMonth.toLocaleDateString('en-CA', { timeZone: TARGET_TZ }))
      setEndDate(today.toLocaleDateString('en-CA', { timeZone: TARGET_TZ }))
    }
  }, [reportType])

  // Re-generate the report whenever dates, mode, session filter, or the student list changes.
  // `studentsLoaded` is included so the first report fires only AFTER loadStudents() has resolved,
  // preventing the race condition where generateReport() would run against an empty students array.
  useEffect(() => {
    if (!studentsLoaded) return
    if (startDate && endDate) {
      const validation = ValidationService.validateDateRange(startDate, endDate)
      setDateValidationErrors(validation.errors)
  
      if (validation.isValid) {
        generateReport()
      }
    }
  }, [startDate, endDate, reportType, sessionFilter, isSessionBased, studentsLoaded, students])


  useEffect(() => {
    filterReports()
  }, [reportData, gradeFilter, streamFilter, sectionFilter, searchQuery])

  const loadStudents = async () => {
    try {
      const user = authService.getCurrentUser()
      console.log("[v0] Loading students for report - isAdmin:", user?.role === "admin")

      const studentsData = await db.getStudents()
      
      if (user?.role === "teacher") {
        const assignmentsData = await db.getTeacherAssignments(user.schoolId, user.teacherId || user.id)
        const classes = assignmentsData || []

        const filtered = studentsData.filter((student: Student) =>
          classes.some((cls) => {
            const studentGrade = (student.grade || "").replace("Grade ", "").trim()
            const classGrade = String(cls.grade || "").trim()
            const gradeMatch = studentGrade === classGrade
            const sectionMatch = cls.section === student.section
            const streamMatch = !cls.stream || cls.stream === student.stream

            return gradeMatch && sectionMatch && streamMatch
          }),
        )

        setStudents(filtered)
      } else {
        setStudents(studentsData)
      }
    } catch (error) {
      console.error("[v0] Error loading students for report:", error)
      notifications.error("Error", "Failed to load students for report")
    } finally {
      // Always mark students as loaded so the report generation effect can proceed.
      // This fires regardless of success or failure — the report will simply show
      // an empty state when students is [] (e.g. unassigned teacher).
      setStudentsLoaded(true)
    }
  }

  const generateReport = async () => {
    if (!startDate || !endDate) return

    const validation = ValidationService.validateDateRange(startDate, endDate)
    if (!validation.isValid) {
      setDateValidationErrors(validation.errors)
      return
    }

    setIsLoading(true)
    try {
      const allAttendance = await db.getAttendanceByDateRange(startDate, endDate)
      
      // ── Strict mode isolation ──────────────────────────────────────────────
      // daily mode    → only records with null/undefined/empty session
      // session mode  → only records that have a real session value
      //   + optionally narrowed by sessionFilter (morning / afternoon / total)
      let processedAttendance: typeof allAttendance
      let sessionRecords: typeof allAttendance = []

      if (!isSessionBased) {
        // Daily mode: reject every record that carries a session tag
        processedAttendance = allAttendance.filter(
          record => !record.session
        )
      } else {
        // Session-based mode: reject records with no session
        sessionRecords = allAttendance.filter(
          record => !!record.session
        )
        // Narrow processedAttendance by selected session filter if not "total" (used for charts & raw data)
        processedAttendance = sessionFilter !== "total"
          ? sessionRecords.filter(
              record => record.session?.trim().toLowerCase() === sessionFilter.toLowerCase()
            )
          : sessionRecords
      }

      // Pre-group attendance by student ID for O(N) lookup
      // In session-based mode, use ALL session records so we can access both Morning & Afternoon for each date
      const targetRecords = isSessionBased ? sessionRecords : processedAttendance
      const attendanceByStudent: Record<string, any[]> = {}
      targetRecords.forEach(record => {
        if (!attendanceByStudent[record.student_id]) {
          attendanceByStudent[record.student_id] = []
        }
        attendanceByStudent[record.student_id].push(record)
      })

      const reports: StudentReport[] = students.map((student) => {
        const studentAttendance = attendanceByStudent[student.id] || []

        if (isSessionBased) {
          const dateGroups: { [date: string]: any[] } = {}
          studentAttendance.forEach(r => {
            if (!dateGroups[r.attendance_date]) dateGroups[r.attendance_date] = []
            dateGroups[r.attendance_date].push(r)
          })

          let presentDays = 0
          let lateDays = 0
          let absentDays = 0
          let excusedDays = 0
          let morningPresentCount = 0
          let morningTotal = 0
          let afternoonPresentCount = 0
          let afternoonTotal = 0

          // Local helpers (trim + lowerCase to guarantee case insensitivity)
          const isP = (s: string | undefined) => s?.trim().toLowerCase() === "present"
          const isL = (s: string | undefined) => s?.trim().toLowerCase() === "late"
          const isE = (s: string | undefined) => s?.trim().toLowerCase() === "excused"
          const isA = (s: string | undefined) => s?.trim().toLowerCase() === "absent"
          const isAtt = (s: string | undefined) => isP(s) || isL(s)

          const resolveFullDay = (ms?: string, as?: string): 'present' | 'late' | 'excused' | 'absent' | null => {
            if (!ms || !as) return null
            const mn = ms.trim().toLowerCase()
            const an = as.trim().toLowerCase()
            if (mn !== an) return null
            if (mn === 'present') return 'present'
            if (mn === 'late')    return 'late'
            if (mn === 'excused') return 'excused'
            if (mn === 'absent')  return 'absent'
            return null
          }

          Object.values(dateGroups).forEach(records => {
            const m = records.find(r => r.session?.trim().toLowerCase() === "morning")
            const a = records.find(r => r.session?.trim().toLowerCase() === "afternoon")

            if (m) {
              morningTotal++
              if (isAtt(m.status)) morningPresentCount++
            }
            if (a) {
              afternoonTotal++
              if (isAtt(a.status)) afternoonPresentCount++
            }

            if (sessionFilter === "morning") {
              if (m) {
                if (isP(m.status)) presentDays++
                else if (isL(m.status)) lateDays++
                else if (isE(m.status)) excusedDays++
                else if (isA(m.status)) absentDays++
              }
            } else if (sessionFilter === "afternoon") {
              if (a) {
                if (isP(a.status)) presentDays++
                else if (isL(a.status)) lateDays++
                else if (isE(a.status)) excusedDays++
                else if (isA(a.status)) absentDays++
              }
            } else {
              // sessionFilter === "total"
              const fullDayStatus = resolveFullDay(m?.status, a?.status)
              if (fullDayStatus === 'present')      presentDays++
              else if (fullDayStatus === 'late')    lateDays++
              else if (fullDayStatus === 'excused') excusedDays++
              else if (fullDayStatus === 'absent')  absentDays++
            }
          })

          let totalDays = Object.keys(dateGroups).length
          if (sessionFilter === "morning") {
            totalDays = morningTotal
          } else if (sessionFilter === "afternoon") {
            totalDays = afternoonTotal
          }

          const morningRate = morningTotal > 0 ? (morningPresentCount / morningTotal) * 100 : 0
          const afternoonRate = afternoonTotal > 0 ? (afternoonPresentCount / afternoonTotal) * 100 : 0
          const totalAttending = presentDays + lateDays
          const attendanceRate = totalDays > 0 ? (totalAttending / totalDays) * 100 : 0

          return {
            student,
            totalDays,
            presentDays,
            lateDays,
            absentDays,
            excusedDays,
            attendanceRate: Math.round(attendanceRate * 100) / 100,
            morningPresent: morningPresentCount,
            morningRate: Math.round(morningRate * 100) / 100,
            afternoonPresent: afternoonPresentCount,
            afternoonRate: Math.round(afternoonRate * 100) / 100,
          }
        } else {
          const presentDays = studentAttendance.filter((record) => record.status?.trim().toLowerCase() === "present").length
          const lateDays = studentAttendance.filter((record) => record.status?.trim().toLowerCase() === "late").length
          const absentDays = studentAttendance.filter((record) => record.status?.trim().toLowerCase() === "absent").length
          const excusedDays = studentAttendance.filter((record) => record.status?.trim().toLowerCase() === "excused").length
          const totalDays = studentAttendance.length

          const attendanceRate = totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0

          return {
            student,
            totalDays,
            presentDays,
            lateDays,
            absentDays,
            excusedDays,
            attendanceRate: Math.round(attendanceRate * 100) / 100,
          }
        }
      })

      setReportData(reports)
      setRawAttendance(processedAttendance)
      setDateValidationErrors([])
    } catch (error) {
      console.error("[Reports] generateReport error:", error)
      notifications.error("Error", "Failed to generate report")
    } finally {
      setIsLoading(false)
    }
  }

  const filterReports = () => {
    if (!reportData || reportData.length === 0) {
      setFilteredReports([])
      return
    }

    let filtered = reportData

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (report) =>
          report.student.name?.toLowerCase().includes(q) ||
          report.student.student_id?.toLowerCase().includes(q) ||
          (report.student.grade && report.student.grade.toLowerCase().includes(q)) ||
          (report.student.stream && report.student.stream.toLowerCase().includes(q))
      )
    }

    if (gradeFilter !== "All Grades") {
      filtered = filtered.filter((report) => report.student.grade === gradeFilter)
    }

    if (streamFilter !== "All Streams") {
      filtered = filtered.filter((report) => report.student.stream === streamFilter)
    }

    if (sectionFilter !== "All Sections") {
      filtered = filtered.filter((report) => report.student.section === sectionFilter)
    }

    setFilteredReports(filtered)
  }

  const exportToCSV = () => {
    console.log("[v0] Starting CSV export...")
    console.log("[v0] Filtered reports count:", filteredReports.length)

    if (filteredReports.length === 0) {
      notifications.warning("No Data", "No data available to export")
      return
    }

    try {
      const headers = [
        "Student Name",
        "Student ID",
        "Grade",
        "Stream",
        "Section",
        "Total Days",
        ...(isSessionBased && sessionFilter === "total" ? ["Morning %", "Afternoon %"] : []),
        "Present",
        "Late",
        "Absent",
        "Excused",
        "Attendance Rate (%)",
      ]

      const csvData = filteredReports.map((report) => [
        `"${report.student.name}"`,
        report.student.student_id,
        `"${report.student.grade}"`,
        `"${report.student.stream || ""}"`,
        report.student.section,
        report.totalDays,
        ...(isSessionBased && sessionFilter === "total" ? [report.morningRate, report.afternoonRate] : []),
        report.presentDays,
        report.lateDays,
        report.absentDays,
        report.excusedDays,
        report.attendanceRate,
      ])

      const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n")

      console.log("[v0] CSV content generated, length:", csvContent.length)

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)

      // Create download link
      const link = document.createElement("a")
      link.href = url
      link.download = `attendance_report_${startDate}_to_${endDate}.csv`
      link.style.display = "none"

      // Add to DOM, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the URL object
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)

      console.log("[v0] CSV download initiated successfully")
      notifications.success("Export Complete", `Report exported successfully with ${filteredReports.length} records`)
    } catch (error) {
      console.error("[v0] CSV export error:", error)
      notifications.error("Export Failed", "Failed to export report. Please try again.")
    }
  }

  const printReport = () => {
    try {
      window.print()
      notifications.info("Print", "Print dialog opened")
    } catch (error) {
      notifications.error("Print Failed", "Failed to open print dialog")
    }
  }

  const getAttendanceRateColor = (rate: number) => {
    if (rate >= 95) return "text-green-600"
    if (rate >= 85) return "text-yellow-600"
    return "text-red-600"
  }

  const getAttendanceRateBadge = (rate: number) => {
    if (rate >= 95) return "bg-green-500/10 text-green-500 border-green-500/20"
    if (rate >= 85) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    return "bg-red-500/10 text-red-500 border-red-500/20"
  }

  const grades = [...new Set(students.map((s) => s.grade))].filter(Boolean)
  const streams = [...new Set(students.map((s) => s.stream).filter(Boolean))]
  const sections = [...new Set(students.map((s) => s.section))].filter(Boolean)

  const totalStats =
    filteredReports && filteredReports.length > 0
      ? filteredReports.reduce(
          (acc, report) => ({
            totalStudents: acc.totalStudents + 1,
            totalPresent: acc.totalPresent + report.presentDays,
            totalLate: acc.totalLate + report.lateDays,
            totalAbsent: acc.totalAbsent + report.absentDays,
            totalExcused: acc.totalExcused + report.excusedDays,
            averageAttendance: acc.averageAttendance + report.attendanceRate,
          }),
          { totalStudents: 0, totalPresent: 0, totalLate: 0, totalAbsent: 0, totalExcused: 0, averageAttendance: 0 },
        )
      : { totalStudents: 0, totalPresent: 0, totalLate: 0, totalAbsent: 0, totalExcused: 0, averageAttendance: 0 }

  if (totalStats.totalStudents > 0) {
    totalStats.averageAttendance = Math.round((totalStats.averageAttendance / totalStats.totalStudents) * 100) / 100
  }

  // --- Analytics Dashboard Data Pre-processing ---
  const COLORS = ['#16a34a', '#ca8a04', '#dc2626', '#2563eb']
  const statusData = [
    { name: 'Present', value: totalStats.totalPresent },
    { name: 'Late', value: totalStats.totalLate },
    { name: 'Absent', value: totalStats.totalAbsent },
    { name: 'Excused', value: totalStats.totalExcused },
  ].filter(d => d.value > 0)

  // Grade Comparison Bar Chart
  const gradeData: any[] = []
  const gradeGroups: any = {}
  filteredReports.forEach(report => {
    const g = report.student.grade || "Unknown"
    if (!gradeGroups[g]) gradeGroups[g] = { grade: g, totalRate: 0, count: 0 }
    gradeGroups[g].totalRate += report.attendanceRate
    gradeGroups[g].count++
  })
  for (const g in gradeGroups) {
    gradeData.push({
      grade: g,
      attendanceRate: Math.round(gradeGroups[g].totalRate / gradeGroups[g].count * 10) / 10
    })
  }

  // Trend Area Chart
  const trendDataMap: any = {}
  
  if (startDate && endDate) {
    const start = new Date(startDate + "T00:00:00")
    const end = new Date(endDate + "T00:00:00")
    const current = new Date(start)
    
    while (current <= end) {
      const d = current.toLocaleDateString('en-CA') // YYYY-MM-DD
      trendDataMap[d] = { date: d, present: 0, late: 0, absent: 0, excused: 0, total: 0 }
      current.setDate(current.getDate() + 1)
    }
  }

  const filteredStudentIds = new Set(filteredReports.map(r => r.student.id))
  rawAttendance.forEach(record => {
    if (filteredStudentIds.has(record.student_id)) {
      const d = record.attendance_date
      if (trendDataMap[d]) {
        trendDataMap[d].total++
        const status = record.status?.toLowerCase()
        if (status === "present") trendDataMap[d].present++
        else if (status === "late") trendDataMap[d].late++
        else if (status === "absent") trendDataMap[d].absent++
        else if (status === "excused") trendDataMap[d].excused++
      }
    }
  })
  
  const trendData = Object.values(trendDataMap).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((d: any) => ({
    ...d,
    date: new Date(d.date + "T00:00:00").toLocaleDateString("en-ET", { timeZone: 'Africa/Addis_Ababa', weekday: "short", day: "numeric" }),
    rate: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0
  }))

  if (!mounted) return null

  if (isLoading || !studentsLoaded) {
    return <PageSkeleton variant="dashboard" />
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-safe">
        <div>
          <h2 className="text-lg md:text-xl font-black text-foreground uppercase tracking-normal">Reports</h2>
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Analytics & Export</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={printReport} variant="outline" className="flex-1 md:flex-none font-black text-[10px] uppercase bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl h-11 px-4 tracking-widest">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={exportToCSV} disabled={filteredReports.length === 0} className="flex-1 md:flex-none font-black text-[10px] uppercase rounded-2xl h-11 px-6 tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* Report Configuration */}
      <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <CardHeader className="pb-0 border-none">
          <CardTitle className="typography-card-title flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="typography-label text-[10px] uppercase text-muted-foreground ml-1">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Report</SelectItem>
                  <SelectItem value="weekly">Weekly Summary</SelectItem>
                  <SelectItem value="monthly">Monthly Overview</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="typography-label text-[10px] uppercase text-muted-foreground ml-1">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-primary/20" />
            </div>

            <div className="space-y-2">
              <label className="typography-label text-[10px] uppercase text-muted-foreground ml-1">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-primary/20" />
            </div>

            {isSessionBased && (
              <div className="space-y-2">
                <label className="typography-label text-[10px] uppercase text-muted-foreground ml-1">Session Filter</label>
                <Select value={sessionFilter} onValueChange={(v: any) => setSessionFilter(v)}>
                  <SelectTrigger className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total (Combined)</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {dateValidationErrors.length > 0 && (
            <div className="typography-body text-red-600">
              {dateValidationErrors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student by name, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-primary/20"
              />
            </div>

            {isAdmin && (
              <>
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger className="w-36 md:w-40 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Grades">All Grades</SelectItem>
                    {grades.map((grade) => (
                      <SelectItem key={grade || "unknown"} value={grade || "unknown"}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={streamFilter} onValueChange={setStreamFilter}>
                  <SelectTrigger className="w-36 md:w-40 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11">
                    <SelectValue placeholder="All Streams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Streams">All Streams</SelectItem>
                    {streams.map((stream) => (
                      <SelectItem key={stream || "unknown"} value={stream || "unknown"}>
                        {stream}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="w-36 md:w-40 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Sections">All Sections</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section || "unknown"} value={section || "unknown"}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {filteredReports.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 px-1 md:px-0">
          {[
            { label: "Students", value: totalStats.totalStudents, icon: Users, color: "blue" },
            { label: "Present", value: totalStats.totalPresent, icon: UserCheck, color: "emerald" },
            { label: "Late", value: totalStats.totalLate, icon: Clock, color: "amber" },
            { label: "Absent", value: totalStats.totalAbsent, icon: UserX, color: "rose" },
            { label: "Excused", value: totalStats.totalExcused, icon: AlertTriangle, color: "sky" },
            { label: "Avg Rate", value: `${totalStats.averageAttendance}%`, icon: TrendingUp, color: "indigo", isRate: true },
          ].map((item, idx) => (
            <div key={idx} className={cn(
              "flex flex-col items-center justify-center p-4 rounded-[24px] border shadow-sm transition-all active:scale-[0.98]",
              item.isRate 
                ? "bg-slate-900 dark:bg-primary text-white border-transparent" 
                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
            )}>
              <div className={cn(
                "w-9 h-9 rounded-2xl flex items-center justify-center mb-2.5",
                item.isRate ? "bg-white/10" : `bg-${item.color}-500/10 text-${item.color}-600 dark:text-${item.color}-400`
              )}>
                <item.icon className="h-4 w-4" />
              </div>
              <p className={cn(
                "text-lg font-black text-center tracking-tight leading-none mb-1",
                item.isRate ? "text-white" : "text-foreground"
              )}>
                {item.value}
              </p>
              <p className={cn(
                "text-[9px] font-black uppercase tracking-widest text-center",
                item.isRate ? "text-white/60" : "text-muted-foreground/60"
              )}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Analytics Dashboard Charts */}
      {filteredReports.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 px-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="typography-card-title text-foreground">Attendance Trends</h3>
            </div>
            <div className="h-[300px] w-full p-6 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                    labelStyle={{ color: 'var(--foreground)', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value}%`, 'Attendance Rate']}
                  />
                  <Area type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <CardHeader className="pb-0 border-none">
              <CardTitle className="typography-card-title flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full mt-4 p-2 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-200 dark:border-slate-700">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => {
                        const getColor = (name: string) => {
                          switch (name.toLowerCase()) {
                            case 'present': return '#16a34a' // Green
                            case 'late': return '#ca8a04'    // Yellow
                            case 'absent': return '#dc2626'  // Red
                            case 'excused': return '#2563eb' // Blue
                            default: return '#888888'
                          }
                        }
                        return <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
                      })}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                      formatter={(value: number, name: string) => [
                        `${value} Student${value !== 1 ? 's' : ''}`, 
                        name
                      ]}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {gradeData.length > 0 && (
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center gap-2 px-2">
                <TrendingDown className="w-5 h-5 text-purple-600 dark:text-purple-400 rotate-180" />
                <h3 className="typography-card-title text-foreground">Performance by Grade</h3>
              </div>
              <div className="h-[300px] w-full p-6 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="grade" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
                      formatter={(value: number) => [`${value}%`, 'Avg Attendance']}
                      cursor={{fill: 'var(--muted)', opacity: 0.2}}
                    />
                    <Bar dataKey="attendanceRate" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report Table */}
      {filteredReports.length > 0 ? (
        <Card className="overflow-hidden border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <CardHeader className="pb-0 border-none flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="typography-card-title flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Detailed Report
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-10 text-xs focus:ring-primary/20"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="md:hidden space-y-4">
              {filteredReports.map((report) => (
                <div key={report.student.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] shadow-sm flex flex-col gap-4 active:scale-[0.98] transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20">
                        {report.student.name?.slice(0, 1) || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground uppercase truncate">
                          {report.student.name || 'Unknown Student'}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                          ID: {report.student.student_id} • {report.student.grade} - {report.student.section}{report.student.stream ? ` (${report.student.stream})` : ''}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px] font-black uppercase rounded-full px-2.5", getAttendanceRateBadge(report.attendanceRate))}>
                      {report.attendanceRate}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-emerald-600">{report.presentDays}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/40 uppercase">Pre</p>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <p className="text-[10px] font-black text-amber-600">{report.lateDays}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/40 uppercase">Lat</p>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <p className="text-[10px] font-black text-rose-600">{report.absentDays}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/40 uppercase">Abs</p>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <p className="text-[10px] font-black text-sky-600">{report.excusedDays}</p>
                      <p className="text-[8px] font-bold text-muted-foreground/40 uppercase">Exc</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto scrollbar-hide">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Student</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Grade</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Stream</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Sect</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest text-emerald-600">P</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest text-amber-600">L</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest text-rose-600">A</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest text-sky-600">E</th>
                    <th className="px-4 py-4 text-right text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredReports.map((report) => (
                    <tr key={report.student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-4">
                        <p className="text-sm font-black text-foreground uppercase">{report.student.name}</p>
                        <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tight">ID: {report.student.student_id}</p>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-muted-foreground">{report.student.grade}</td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-muted-foreground">{report.student.stream || "-"}</td>
                      <td className="px-4 py-4 text-center text-xs font-bold text-muted-foreground">{report.student.section}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-emerald-600">{report.presentDays}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-amber-600">{report.lateDays}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-rose-600">{report.absentDays}</td>
                      <td className="px-4 py-4 text-center text-sm font-black text-sky-600">{report.excusedDays}</td>
                      <td className="px-4 py-4 text-right">
                        <Badge className={cn("text-[10px] font-black uppercase rounded-full px-2.5", getAttendanceRateBadge(report.attendanceRate))}>
                          {report.attendanceRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No data available for the selected criteria. Please adjust your filters or date range.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


