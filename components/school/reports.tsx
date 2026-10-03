"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Download, Printer, Calendar, Users, UserCheck, Clock, UserX, AlertTriangle, TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { db, type Student } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { ValidationService } from "@/lib/utils/validation"
import { authService } from "@/lib/auth/auth"
import { parseJsonResponse } from "@/lib/utils/parse-json-response"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts"
import { cn } from "@/lib/utils/utils"
import { useCalendar } from "@/lib/context/calendar-context"
import { DualDatePicker } from "@/components/ui/dual-date-picker"
import { toEthiopianDate, ethiopicToJDN, jdnToGregorian } from "@/lib/utils/ethiopian-calendar"

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
  const { formatDate, calendarPreference } = useCalendar()
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
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 50

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredReports.slice(start, start + PAGE_SIZE)
  }, [filteredReports, currentPage])

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
      if (calendarPreference === "ethiopian") {
        const ec = toEthiopianDate(today)
        const jdn = ethiopicToJDN(ec.year, ec.month, 1)
        const startGregorian = jdnToGregorian(jdn)
        const startISO = startGregorian.toISOString().split("T")[0]
        setStartDate(startISO)
      } else {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        setStartDate(firstDayOfMonth.toLocaleDateString('en-CA', { timeZone: TARGET_TZ }))
      }
      setEndDate(today.toLocaleDateString('en-CA', { timeZone: TARGET_TZ }))
    }
  }, [reportType, calendarPreference])

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
      console.log("Loading students for report - isAdmin:", user?.role === "admin")

      const studentsData = await db.getStudents()
      
      if (user?.role === "teacher") {
        const assignmentsData = await db.getTeacherAssignments(user.schoolId, user.teacherId || user.id)
        const classes = assignmentsData || []

        const filtered = studentsData.filter((student: Student) =>
          classes.some((cls: any) => {
            const studentGrade = (student.grade || "").toLowerCase().replace("grade ", "").trim()
            const clsGradeName = String(cls.grade || cls.gradeObj?.name || "").toLowerCase().replace("grade ", "").trim()
            
            const gradeMatch = studentGrade !== "" && clsGradeName !== "" && studentGrade === clsGradeName
            
            const studentSection = (student.section || "").toLowerCase().trim()
            const clsSectionName = String(cls.section || cls.sectionObj?.name || "").toLowerCase().trim()
            
            const sectionMatch = studentSection !== "" && clsSectionName !== "" && studentSection === clsSectionName

            const studentStream = (student.stream || "").toLowerCase().trim()
            const clsStreamName = String(cls.stream || cls.streamObj?.name || "").toLowerCase().trim()
            
            const streamMatch = !cls.streamId || (studentStream !== "" && clsStreamName !== "" && studentStream === clsStreamName)
            
            return gradeMatch && sectionMatch && streamMatch
          }),
        )

        setStudents(filtered)
        console.log(`[Reports] Loaded ${filtered.length} students for teacher from ${classes.length} assigned classes`)
      } else {
        setStudents(studentsData)
      }
    } catch (error) {
      console.error("Error loading students for report:", error)
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
      const reqSession = isSessionBased
        ? (sessionFilter === "total" ? "session_based" : sessionFilter)
        : "none"

      const rawAttendance = await db.getAttendanceByDateRange(startDate, endDate, reqSession)

      // Strict mode isolation filter:
      // - Daily mode (!isSessionBased): strictly use records where session is null / empty / undefined / "none"
      // - Session mode (isSessionBased): strictly use records where session is present ("morning", "afternoon", etc.)
      const modeFilteredAttendance = isSessionBased
        ? rawAttendance.filter(r => r.session && r.session.trim() !== "" && r.session.trim().toLowerCase() !== "none")
        : rawAttendance.filter(r => !r.session || r.session.trim() === "" || r.session.trim().toLowerCase() === "none")

      let processedAttendance = modeFilteredAttendance

      if (isSessionBased && sessionFilter !== "total") {
        processedAttendance = modeFilteredAttendance.filter(
          record => record.session?.trim().toLowerCase() === sessionFilter.toLowerCase()
        )
      }

      // Pre-group mode-filtered attendance by student ID for O(N) lookup
      const attendanceByStudent: Record<string, any[]> = {}
      modeFilteredAttendance.forEach(record => {
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

          const addStatusCount = (status?: string, weight = 0.5) => {
            if (isP(status)) presentDays += weight
            else if (isL(status)) lateDays += weight
            else if (isE(status)) excusedDays += weight
            else if (isA(status)) absentDays += weight
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
              const rec = m || (records.length > 0 ? records[0] : null)
              if (rec) addStatusCount(rec.status, 1)
            } else if (sessionFilter === "afternoon") {
              const rec = a || (records.length > 0 ? records[0] : null)
              if (rec) addStatusCount(rec.status, 1)
            } else {
              // sessionFilter === "total": Each session (Morning & Afternoon) counts as 0.5 days
              if (m || a) {
                if (m) addStatusCount(m.status, 0.5)
                if (a) addStatusCount(a.status, 0.5)
              } else {
                // Fallback for records marked without explicit "morning"/"afternoon" tags
                records.forEach(rec => {
                  morningTotal += 0.5
                  afternoonTotal += 0.5
                  if (isAtt(rec.status)) {
                    morningPresentCount += 0.5
                    afternoonPresentCount += 0.5
                  }
                  addStatusCount(rec.status, 1 / Math.max(records.length, 1))
                })
              }
            }
          })

          let totalDays = 0
          if (sessionFilter === "morning") {
            totalDays = morningTotal
          } else if (sessionFilter === "afternoon") {
            totalDays = afternoonTotal
          } else {
            // Combined total days: 0.5 per morning session + 0.5 per afternoon session
            totalDays = (morningTotal * 0.5) + (afternoonTotal * 0.5)
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
    setCurrentPage(1)
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
    console.log("Starting CSV export...")
    console.log("Filtered reports count:", filteredReports.length)

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

      console.log("CSV content generated, length:", csvContent.length)

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

      console.log("CSV download initiated successfully")
      notifications.success("Export Complete", `Report exported successfully with ${filteredReports.length} records`)
    } catch (error) {
      console.error("CSV export error:", error)
      notifications.error("Export Failed", "Failed to export report. Please try again.")
    }
  }

  const printReport = () => {
    try {
      window.print()
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
              <DualDatePicker value={startDate} onChange={(val) => setStartDate(val)} className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11" />
              {startDate && (
                <p className="text-[11px] font-semibold text-primary/80 pl-1">
                  {formatDate(startDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="typography-label text-[10px] uppercase text-muted-foreground ml-1">End Date</label>
              <DualDatePicker value={endDate} onChange={(val) => setEndDate(val)} className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl h-11" />
              {endDate && (
                <p className="text-[11px] font-semibold text-primary/80 pl-1">
                  {formatDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
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

      {/* Grade Performance Chart */}
      {filteredReports.length > 0 && gradeData.length > 0 && (
        <div className="space-y-4">
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
              {paginatedReports.map((report) => (
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

            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[560px] rounded-xl border border-slate-200/60 dark:border-slate-800">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
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
                  {paginatedReports.map((report) => (
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

            {/* Pagination Controls */}
            {filteredReports.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <p className="text-muted-foreground font-medium">
                  Showing <span className="font-bold text-foreground">{Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredReports.length)}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * PAGE_SIZE, filteredReports.length)}</span> of <span className="font-bold text-foreground">{filteredReports.length}</span> students
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="h-8 px-2.5 rounded-xl text-xs gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <span className="px-3 py-1 text-xs font-bold text-foreground">
                    Page {currentPage} of {Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= Math.ceil(filteredReports.length / PAGE_SIZE)}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="h-8 px-2.5 rounded-xl text-xs gap-1"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
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


