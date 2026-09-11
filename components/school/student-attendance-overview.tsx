"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, UserCheck, UserX, Clock, AlertTriangle, TrendingUp, Calendar, RefreshCw } from "lucide-react"
import { db, type Student } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { useAuth } from "@/lib/context/auth-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { ErrorBanner } from "@/components/ui/data-state-view"
import { cn } from "@/lib/utils/utils"
import { useCalendar } from "@/lib/context/calendar-context"

export interface StudentAttendanceStats {
  totalStudents: number
  presentToday: number
  lateToday: number
  absentToday: number
  excusedToday: number
  attendanceRate: number
}

export interface StudentAttendanceRecentActivity {
  grade: string
  section: string
  stream?: string
  session?: string
  presentCount: number
  lateCount: number
  absentCount: number
  excusedCount: number
  totalCount: number
  time: string
  date: string
}

export interface StudentAttendanceOverviewProps {
  onNavigate?: (tab: string) => void
}

export function StudentAttendanceOverview({ onNavigate }: StudentAttendanceOverviewProps) {
  const { formatDate, calendarPreference } = useCalendar()
  const [stats, setStats] = useState<StudentAttendanceStats>({
    totalStudents: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    excusedToday: 0,
    attendanceRate: 0,
  })
  const [recentActivity, setRecentActivity] = useState<StudentAttendanceRecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sessionFilter, setSessionFilter] = useState<"morning" | "afternoon" | "total">("total")
  const [rawData, setRawData] = useState<{ today: any[]; all: any[]; students: Student[] } | null>(null)

  const { user: authUser } = useAuth()
  const { settings } = useSchoolSettings()
  const isSessionBased = settings?.attendanceMode === "session_based"
  const confirmedSchoolId = authUser?.schoolId || "single-school"

  useEffect(() => {
    if (!authUser) return

    loadStudentAttendanceData()

    // Poll for real-time updates from other users/tabs (every 10 seconds)
    const pollInterval = setInterval(() => {
      loadStudentAttendanceData(true)
    }, 10000)

    const handleDataChanged = () => loadStudentAttendanceData(true)
    window.addEventListener("studentDataChanged", handleDataChanged)
    window.addEventListener("teacherDataChanged", handleDataChanged)
    window.addEventListener("attendanceDataChanged", handleDataChanged)

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener("studentDataChanged", handleDataChanged)
      window.removeEventListener("teacherDataChanged", handleDataChanged)
      window.removeEventListener("attendanceDataChanged", handleDataChanged)
    }
  }, [confirmedSchoolId])

  useEffect(() => {
    if (rawData) {
      setRawData((prev) => (prev ? { ...prev } : null))
    }
  }, [isSessionBased])

  const loadStudentAttendanceData = async (isBackground = false) => {
    if (!isBackground && !rawData) setIsLoading(true)
    setFetchError(null)
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        setIsLoading(false)
        return
      }
      let students: Student[] = []

      const isTeacherRole = user?.role === "teacher" || (typeof window !== "undefined" && window.location.pathname.startsWith("/school/teacher"))

      if (isTeacherRole) {
        const teacherTargetId = (user as any).teacher_id || user.teacherId || user.id
        const [assignmentsData, allStudents] = await Promise.all([
          db.getTeacherAssignments(user.schoolId || "single-school", teacherTargetId),
          db.getStudents(false, "ACTIVE"),
        ])
        let classes = assignmentsData || []

        // If direct lookup by teacherId returned empty, search all assignments by user id, teacher id or email
        if (classes.length === 0) {
          try {
            const allAssignments = await db.getTeacherAssignments(user.schoolId || "single-school")
            classes = (allAssignments || []).filter((a: any) =>
              a.teacher_id === user.id ||
              a.teacher_id === (user as any).teacher_id ||
              a.teacherId === user.id ||
              a.teacher?.id === user.id ||
              a.teacher?.id === (user as any).teacher_id ||
              a.teacher?.user_id === user.id ||
              (user.email && a.teacher?.email && a.teacher.email.toLowerCase() === user.email.toLowerCase())
            )
          } catch (e) {
            console.warn("Fallback assignment lookup failed:", e)
          }
        }

        // When a teacher has no assigned classes, they should see 0 students (not the entire school)
        if (classes.length === 0) {
          students = []
        } else {
          students = (allStudents || []).filter((student: Student) => {
            const isStudentActive = !student.status || student.status.toUpperCase() === "ACTIVE"
            if (!isStudentActive) return false

            return classes.some((cls: any) => {
              // Normalize Student Grade
              const studentGrade = String(student.grade || "").toLowerCase().replace(/^grade\s+/i, "").replace(/^g-/i, "").trim()
              const studentGradeId = String((student as any).grade_id || (student as any).gradeId || "").toLowerCase().trim()

              // Normalize Class Grade
              const clsGradeName = String(
                (typeof cls.grade === "object" && cls.grade !== null ? cls.grade.name : cls.grade) ||
                cls.gradeObj?.name ||
                ""
              ).toLowerCase().replace(/^grade\s+/i, "").replace(/^g-/i, "").trim()
              const clsGradeId = String(cls.gradeId || cls.grade_id || (typeof cls.grade === "object" ? cls.grade?.id : "") || "").toLowerCase().trim()

              const gradeMatches =
                (studentGrade !== "" && clsGradeName !== "" && (studentGrade === clsGradeName || studentGrade.replace(/^0+/, "") === clsGradeName.replace(/^0+/, ""))) ||
                (studentGradeId !== "" && clsGradeId !== "" && studentGradeId === clsGradeId) ||
                (studentGrade !== "" && clsGradeId !== "" && studentGrade === clsGradeId)

              if (!gradeMatches) return false

              // Normalize Student Section
              const studentSec = String(student.section || "").toLowerCase().replace(/^section\s+/i, "").trim()
              const studentSecId = String((student as any).section_id || (student as any).sectionId || "").toLowerCase().trim()

              // Normalize Class Section
              const clsSecName = String(
                (typeof cls.section === "object" && cls.section !== null ? cls.section.name : cls.section) ||
                cls.sectionObj?.name ||
                ""
              ).toLowerCase().replace(/^section\s+/i, "").trim()
              const clsSecId = String(cls.sectionId || cls.section_id || (typeof cls.section === "object" ? cls.section?.id : "") || "").toLowerCase().trim()

              const hasSectionConstraint = clsSecName !== "" && clsSecName !== "all" && clsSecName !== "general"
              if (hasSectionConstraint) {
                const sectionMatches =
                  (studentSec !== "" && (studentSec === clsSecName || studentSec.includes(clsSecName) || clsSecName.includes(studentSec))) ||
                  (studentSecId !== "" && clsSecId !== "" && studentSecId === clsSecId) ||
                  (studentSec !== "" && clsSecId !== "" && studentSec === clsSecId)
                if (!sectionMatches) return false
              }

              // Normalize Stream
              const studentStream = String(student.stream || (student as any).stream_id || "").toLowerCase().trim()
              const clsStreamName = String(
                (typeof cls.stream === "object" && cls.stream !== null ? cls.stream.name : cls.stream) ||
                cls.streamObj?.name ||
                cls.streamId ||
                ""
              ).toLowerCase().trim()

              const hasStreamConstraint = cls.streamId || (clsStreamName !== "" && clsStreamName !== "all" && clsStreamName !== "general" && clsStreamName !== "none")
              if (hasStreamConstraint && studentStream && clsStreamName) {
                if (studentStream !== clsStreamName && !studentStream.includes(clsStreamName) && !clsStreamName.includes(studentStream)) {
                  return false
                }
              }

              return true
            })
          })
        }
      } else {
        const allStudents = await db.getStudents(false, "ACTIVE")
        students = (allStudents || []).filter((s: Student) => !s.status || s.status.toUpperCase() === "ACTIVE")
      }

      const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
      const [todayAttendance, allAttendance] = await Promise.all([
        db.getAttendanceByDate(todayDate),
        db.getAttendance(),
      ])

      const studentIds = new Set(students.map((s) => s.id))
      const relevantToday = todayAttendance.filter((a) => studentIds.has(a.student_id))
      const relevantAll = allAttendance.filter((a) => studentIds.has(a.student_id))

      setRawData({ today: relevantToday, all: relevantAll, students })
    } catch (error) {
      console.error("Failed to load student attendance overview data:", error)
      if (!isBackground) {
        const { getErrorMessage } = await import("@/lib/utils/fetch-with-timeout")
        setFetchError(getErrorMessage(error))
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!rawData) return

    const { today: rawToday, all: rawAll, students } = rawData

    const today = isSessionBased
      ? rawToday.filter((r) => r.session && r.session !== "")
      : rawToday.filter((r) => r.session === null || r.session === undefined || r.session === "")

    const all = isSessionBased
      ? rawAll.filter((r) => r.session && r.session !== "")
      : rawAll.filter((r) => r.session === null || r.session === undefined || r.session === "")

    const sessionFilteredToday =
      sessionFilter === "total"
        ? today
        : today.filter((a) => a.session?.toLowerCase() === sessionFilter.toLowerCase())

    const sessionFilteredAll =
      sessionFilter === "total"
        ? all
        : all.filter((a) => a.session?.toLowerCase() === sessionFilter.toLowerCase())

    let presentToday = 0
    let lateToday = 0
    let absentToday = 0
    let excusedToday = 0

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

    if (isSessionBased && sessionFilter === "total") {
      const studentGroups: { [studentId: string]: any[] } = {}
      sessionFilteredToday.forEach((a) => {
        if (!studentGroups[a.student_id]) studentGroups[a.student_id] = []
        studentGroups[a.student_id].push(a)
      })

      Object.values(studentGroups).forEach((records) => {
        const m = records.find((r) => r.session?.toLowerCase() === "morning")
        const a = records.find((r) => r.session?.toLowerCase() === "afternoon")
        const status = resolveFullDay(m?.status, a?.status)
        if (status === "present") presentToday++
        else if (status === "late") lateToday++
        else if (status === "excused") excusedToday++
        else if (status === "absent") absentToday++
      })
    } else {
      presentToday = sessionFilteredToday.filter((a) => a.status?.toLowerCase() === "present").length
      lateToday = sessionFilteredToday.filter((a) => a.status?.toLowerCase() === "late").length
      absentToday = sessionFilteredToday.filter((a) => a.status?.toLowerCase() === "absent").length
      excusedToday = sessionFilteredToday.filter((a) => a.status?.toLowerCase() === "excused").length
    }

    const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
    const recentAttendance = sessionFilteredAll.filter((a) => {
      return a.attendance_date === todayDate && ["present", "late"].includes(a.status?.toLowerCase())
    })

    const totalRecentRecords = sessionFilteredAll.filter((a) => {
      return a.attendance_date === todayDate
    }).length

    // School-wide attendance rate: divide (present + late) by ALL active students (students.length)
    const hasSubmittedToday =
      isSessionBased && sessionFilter === "total"
        ? Object.keys(sessionFilteredToday).length > 0
        : totalRecentRecords > 0

    const attendanceRate =
      students.length > 0 && hasSubmittedToday
        ? Math.round(((presentToday + lateToday) / students.length) * 100)
        : 0

    setStats({
      totalStudents: students.length,
      presentToday,
      lateToday,
      absentToday,
      excusedToday,
      attendanceRate: Math.round(attendanceRate),
    })

    // Process Recent Activity Feed
    const studentMap = new Map(students.map((s) => [s.id, s]))
    const classActivityMap: Record<string, any> = {}

    sessionFilteredToday.forEach((record) => {
      const student = studentMap.get(record.student_id)
      if (!student || !student.grade || !student.section) return

      const classKey = `${student.grade}_${student.section}_${student.stream || "none"}_${record.session || "none"}`

      if (!classActivityMap[classKey]) {
        classActivityMap[classKey] = {
          grade: student.grade,
          section: student.section,
          stream: student.stream,
          session: record.session,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          excusedCount: 0,
          totalCount: 0,
          lastTimestamp: new Date(record.created_at || record.attendance_date).getTime(),
          date: record.created_at || record.attendance_date,
        }
      }

      const st = record.status?.toLowerCase()
      if (st === "present") classActivityMap[classKey].presentCount++
      else if (st === "late") classActivityMap[classKey].lateCount++
      else if (st === "absent") classActivityMap[classKey].absentCount++
      else if (st === "excused") classActivityMap[classKey].excusedCount++
      classActivityMap[classKey].totalCount++

      const currentTimestamp = new Date(record.created_at || record.attendance_date).getTime()
      if (currentTimestamp > classActivityMap[classKey].lastTimestamp) {
        classActivityMap[classKey].lastTimestamp = currentTimestamp
        classActivityMap[classKey].date = record.created_at || record.attendance_date
      }
    })

    const activity = Object.values(classActivityMap)
      .sort((a: any, b: any) => b.lastTimestamp - a.lastTimestamp)
      .map((group: any) => ({
        grade: group.grade,
        section: group.section,
        stream: group.stream,
        session: group.session,
        presentCount: group.presentCount,
        lateCount: group.lateCount,
        absentCount: group.absentCount,
        excusedCount: group.excusedCount,
        totalCount: group.totalCount,
        time: new Date(group.date).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: group.date,
      }))

    setRecentActivity(activity as StudentAttendanceRecentActivity[])
  }, [rawData, sessionFilter, calendarPreference, formatDate, isSessionBased])

  return (
    <div className="space-y-6 px-4 md:px-0 pb-24">
      {/* Error Banner */}
      {fetchError && (
        <ErrorBanner
          message={fetchError}
          onRetry={() => loadStudentAttendanceData()}
          className="mb-4"
        />
      )}

      {/* Top Controls: Date indicator & Session filter */}
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-2.5 mb-2">
        <div className="flex flex-wrap items-center gap-2.5 ml-auto">
          <div className="text-xs font-medium bg-primary/10 text-primary px-3.5 py-1.5 rounded-full border border-primary/20 shadow-2xs flex items-center gap-2.5">
            {formatDate(new Date(), { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            <button
              onClick={() => loadStudentAttendanceData()}
              className="hover:text-primary-focus transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {isSessionBased && (
            <div className="flex gap-1.5 p-1 bg-white/60 dark:bg-slate-800/60 rounded-full border border-slate-200 dark:border-slate-700/60">
              <Button
                variant={sessionFilter === "total" ? "default" : "ghost"}
                onClick={() => setSessionFilter("total")}
                size="sm"
                className="h-7 px-3 text-xs font-semibold rounded-full"
              >
                Full Day
              </Button>
              <Button
                variant={sessionFilter === "morning" ? "default" : "ghost"}
                onClick={() => setSessionFilter("morning")}
                size="sm"
                className="h-7 px-3 text-xs font-semibold rounded-full"
              >
                Morning
              </Button>
              <Button
                variant={sessionFilter === "afternoon" ? "default" : "outline"}
                onClick={() => setSessionFilter("afternoon")}
                size="sm"
                className="h-7 px-3 text-xs font-semibold rounded-full border-none"
              >
                Afternoon
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* School Overview Stats — 6 columns matching modern style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Students", value: stats.totalStudents, icon: Users, iconBg: "bg-slate-100 dark:bg-slate-800", iconColor: "text-slate-500 dark:text-slate-400", valColor: "text-slate-700 dark:text-slate-200" },
          { label: "Present", value: stats.presentToday, icon: UserCheck, iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconColor: "text-emerald-600 dark:text-emerald-400", valColor: "text-emerald-600 dark:text-emerald-400" },
          { label: "Late", value: stats.lateToday, icon: Clock, iconBg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-500 dark:text-amber-400", valColor: "text-amber-500 dark:text-amber-400" },
          { label: "Absent", value: stats.absentToday, icon: UserX, iconBg: "bg-rose-50 dark:bg-rose-900/20", iconColor: "text-rose-500 dark:text-rose-400", valColor: "text-rose-500 dark:text-rose-400" },
          { label: "Excused", value: stats.excusedToday, icon: AlertTriangle, iconBg: "bg-sky-50 dark:bg-sky-900/20", iconColor: "text-sky-500 dark:text-sky-400", valColor: "text-sky-500 dark:text-sky-400" },
          { label: "Attendance", value: `${stats.attendanceRate}%`, icon: TrendingUp, iconBg: "bg-indigo-50 dark:bg-indigo-900/20", iconColor: "text-indigo-500 dark:text-indigo-400", valColor: "text-indigo-600 dark:text-indigo-400" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all duration-200 group hover:shadow-md"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110", item.iconBg, item.iconColor)}>
              <item.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 leading-tight">
              {item.label}
            </p>
            <p className={cn("text-2xl md:text-3xl font-bold tracking-tight leading-none", item.valColor)}>
              {isLoading ? (
                <span className="inline-block w-8 h-7 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
              ) : (
                item.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Realtime Attendance Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Feed</h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight opacity-50 bg-slate-50 border-slate-100">
            Today
          </Badge>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="space-y-2 w-full">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="typography-label">No recent attendance activity recorded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentActivity.map((activity, index) => (
              <Card key={index} className="hover:shadow-md transition-all duration-200 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden group">
                <CardContent className="p-4 space-y-3">
                  {/* Card Header: Grade + Section/Stream/Session + Time */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 shrink-0">
                        {activity.grade.match(/\d+/)?.[0] || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground uppercase tracking-tight truncate">
                          {activity.grade}
                        </p>
                        <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-tight">
                          Sec {activity.section} {activity.stream ? `• ${activity.stream}` : ""} {activity.session ? `• ${activity.session}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground/80 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 px-2 py-0.5 shrink-0">
                      <Clock className="w-3 h-3 inline mr-1 opacity-60" />
                      {activity.time}
                    </Badge>
                  </div>

                  {/* Status Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {activity.presentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {activity.presentCount} Present
                      </span>
                    )}
                    {activity.lateCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {activity.lateCount} Late
                      </span>
                    )}
                    {activity.absentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {activity.absentCount} Absent
                      </span>
                    )}
                    {activity.excusedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {activity.excusedCount} Excused
                      </span>
                    )}
                  </div>

                  {/* Footer Total */}
                  {activity.totalCount > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Total Submitted</span>
                      <span className="font-bold text-foreground">{activity.totalCount} Students</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Aliases for backwards compatibility
export { StudentAttendanceOverview as StudentAttendanceDashboard, StudentAttendanceOverview as Dashboard }
