"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Calendar as CalendarIcon,
  Search,
  WifiOff,
  UserCheck,
  UserX,
  History,
  FileSpreadsheet,
  Edit3,
  Eye,
  Filter,
  Download,
  AlertTriangle,
  Sparkles,
  BarChart3,
  CalendarRange,
  Users,
  ChevronRight,
  TrendingUp,
  X,
  ScanFace,
  Info,
  CalendarClock,
  ArrowRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { db } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { useCalendar } from "@/lib/context/calendar-context"
import { notifications } from "@/lib/utils/notifications"
import { cn } from "@/lib/utils/utils"
import dynamic from "next/dynamic"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import {
  getOfflineStaffQueue,
  flushOfflineStaffQueue,
} from "@/lib/utils/staff-attendance-offline-store"
import { getStaffAttendanceDisplay } from "@/lib/utils/staff-attendance-status"

// Dynamically import biometric face enrollment modal
const StaffFaceEnrollModal = dynamic(
  () => import("@/components/school/staff-face-enroll").then((m) => m.StaffFaceEnrollModal),
  { ssr: false }
)

const ROLE_BADGES: Record<string, { label: string; color: string; dotColor: string }> = {
  admin: {
    label: "Admin",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    dotColor: "bg-rose-500",
  },
  school_admin: {
    label: "School Admin",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    dotColor: "bg-rose-500",
  },
  teacher: {
    label: "Teacher",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    dotColor: "bg-blue-500",
  },
  registrar: {
    label: "Registrar",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25",
    dotColor: "bg-indigo-500",
  },
  discipline_officer: {
    label: "Discipline Officer",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25",
    dotColor: "bg-amber-500",
  },
  staff: {
    label: "General Staff",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
    dotColor: "bg-emerald-500",
  },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  PRESENT: {
    label: "Present",
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotColor: "bg-emerald-500",
  },
  LATE: {
    label: "Late",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotColor: "bg-amber-500",
  },
  ABSENT: {
    label: "Absent",
    color: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dotColor: "bg-rose-500",
  },
  EARLY_DEPARTURE: {
    label: "Early Departure",
    color: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dotColor: "bg-orange-500",
  },
  LEAVE: {
    label: "On Leave",
    color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    dotColor: "bg-purple-500",
  },
  PERMISSION: {
    label: "Permission",
    color: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dotColor: "bg-sky-500",
  },
}

export default function AdminStaffAttendanceDashboard() {
  const { formatDate } = useCalendar()
  const { settings } = useSchoolSettings()

  const isSessionMode = settings?.staffAttendanceMode === "session_based"
  const staffSessions = useMemo(() => {
    if (!settings?.staffSessions) {
      return [
        { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:30" },
        { id: "afternoon", name: "Afternoon", startTime: "13:30", endTime: "17:00" },
      ]
    }
    try {
      const arr = typeof settings.staffSessions === "string" ? JSON.parse(settings.staffSessions) : settings.staffSessions
      if (Array.isArray(arr) && arr.length > 0) return arr.filter((s: any) => s.isActive !== false)
    } catch (_) {}
    return [
      { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:30" },
      { id: "afternoon", name: "Afternoon", startTime: "13:30", endTime: "17:00" },
    ]
  }, [settings?.staffSessions])

  // Active view tab: 'roster' | 'reports'
  const [activeTab, setActiveTab] = useState<"roster" | "reports">("roster")

  // Date and Range filter states
  const [isRangeMode, setIsRangeMode] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  )
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  })
  const [endDate, setEndDate] = useState<string>(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  )

  // Filters
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sessionFilter, setSessionFilter] = useState("all")
  const [geoFilter, setGeoFilter] = useState<string>("all")
  const [faceFilter, setFaceFilter] = useState<string>("all")

  // Data states
  const [records, setRecords] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // Modals
  const [detailRecord, setDetailRecord] = useState<any | null>(null)
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null)
  const [correctionForm, setCorrectionForm] = useState({
    status: "PRESENT",
    checkInTime: "",
    checkOutTime: "",
    remarks: "",
    reason: "",
  })
  const [isSavingCorrection, setIsSavingCorrection] = useState(false)

  // Leave Modal
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    userId: "",
    date: selectedDate,
    status: "LEAVE" as "LEAVE" | "PERMISSION",
    reason: "",
  })
  const [isSavingLeave, setIsSavingLeave] = useState(false)

  // Biometrics Enrollment Modal
  const [enrollTarget, setEnrollTarget] = useState<any | null>(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  // Offline Sync State
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isSyncingOffline, setIsSyncingOffline] = useState(false)

  // Report state
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Load all users for leave dropdown
  const [allUsers, setAllUsers] = useState<any[]>([])

  const checkOfflineQueue = useCallback(async () => {
    try {
      const queue = await getOfflineStaffQueue()
      setPendingOfflineCount(queue.length)
    } catch {
      /* ignore */
    }
  }, [])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const sess = sessionFilter !== "all" ? sessionFilter : undefined
      const s = await db.getStaffAttendanceStats(selectedDate, sess)
      setStats(s)
    } catch (err) {
      console.error("Failed to fetch staff stats:", err)
    } finally {
      setStatsLoading(false)
    }
  }, [selectedDate, sessionFilter])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const filterPayload: any = {
        role: roleFilter !== "all" ? roleFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        session: sessionFilter !== "all" ? sessionFilter : undefined,
        search: search.trim() || undefined,
        geofenceVerified: geoFilter === "verified" ? true : geoFilter === "unverified" ? false : undefined,
        faceVerified: faceFilter === "verified" ? true : faceFilter === "unverified" ? false : undefined,
      }

      if (isRangeMode) {
        filterPayload.startDate = startDate
        filterPayload.endDate = endDate
      } else {
        filterPayload.date = selectedDate
      }

      const res = await db.getStaffAttendance(filterPayload)
      setRecords(res)
    } catch (err: any) {
      console.error("Failed to load staff attendance records:", err)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [isRangeMode, selectedDate, startDate, endDate, roleFilter, statusFilter, sessionFilter, search, geoFilter, faceFilter])

  const fetchReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const r = await db.getStaffAttendanceReport({
        startDate,
        endDate,
        role: roleFilter !== "all" ? roleFilter : undefined,
      })
      setReportData(r)
    } catch (err) {
      console.error("Failed to load attendance report:", err)
      setReportData(null)
    } finally {
      setReportLoading(false)
    }
  }, [startDate, endDate, roleFilter])

  const loadAllUsers = useCallback(async () => {
    try {
      const res = await db.getStaffAttendance()
      const userMap = new Map<string, any>()
      res.forEach((r: any) => {
        if (r.user && !userMap.has(r.user.id)) {
          userMap.set(r.user.id, r.user)
        }
      })
      setAllUsers(Array.from(userMap.values()))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchData()
    checkOfflineQueue()
    loadAllUsers()

    const handleDataChanged = () => {
      fetchStats()
      fetchData()
      checkOfflineQueue()
      if (activeTab === "reports") fetchReport()
    }

    const handleOnline = async () => {
      try {
        const res = await flushOfflineStaffQueue()
        if (res.synced > 0) {
          notifications.success("Sync Complete", `Synced ${res.synced} offline staff records.`)
        }
        checkOfflineQueue()
        fetchData()
        fetchStats()
      } catch (err) {
        console.error("Offline sync error:", err)
      }
    }

    window.addEventListener("staffAttendanceDataChanged", handleDataChanged)
    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("staffAttendanceDataChanged", handleDataChanged)
      window.removeEventListener("online", handleOnline)
    }
  }, [fetchStats, fetchData, checkOfflineQueue, loadAllUsers, activeTab, fetchReport])

  useEffect(() => {
    if (activeTab === "reports") {
      fetchReport()
    }
  }, [activeTab, fetchReport])

  const handleManualSync = async () => {
    setIsSyncingOffline(true)
    try {
      const res = await flushOfflineStaffQueue()
      if (res.synced > 0) {
        notifications.success("Sync Complete", `Successfully synced ${res.synced} offline staff records.`)
      } else if (res.errors?.length > 0) {
        notifications.error("Sync Notice", res.errors[0])
      } else {
        notifications.info("Sync Up to Date", "No pending offline records found.")
      }
      await checkOfflineQueue()
      await fetchData()
      await fetchStats()
    } catch (err: any) {
      notifications.error("Sync Failed", err.message || "Failed to flush offline queue.")
    } finally {
      setIsSyncingOffline(false)
    }
  }

  // Open Correction Modal
  const openCorrectionModal = (rec: any) => {
    setCorrectingRecord(rec)
    // Pre-fill the datetime-local input using Ethiopia's fixed UTC+3 offset.
    // We must NOT use getTimezoneOffset() because that reflects the device's local
    // timezone — on a phone set to UTC+0 it would show a time 3 hours too early.
    const toInputVal = (dateStr?: string) => {
      if (!dateStr) return ""
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ""
      // Africa/Addis_Ababa is permanently UTC+3 (no DST)
      const ET_OFFSET_MS = 3 * 60 * 60 * 1000
      return new Date(d.getTime() + ET_OFFSET_MS).toISOString().slice(0, 16)
    }

    setCorrectionForm({
      status: rec.status || "PRESENT",
      checkInTime: toInputVal(rec.checkInTime),
      checkOutTime: toInputVal(rec.checkOutTime),
      remarks: rec.remarks || "",
      reason: "",
    })
  }

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctingRecord) return
    if (!correctionForm.reason.trim()) {
      notifications.error("Validation Error", "A correction reason is required for administrative audit trail.")
      return
    }

    setIsSavingCorrection(true)
    // The datetime-local inputs were pre-filled in Ethiopian time (UTC+3).
    // new Date("YYYY-MM-DDTHH:MM") treats the value as LOCAL device time,
    // which is wrong on non-ET devices. We must subtract ET's fixed offset to get UTC.
    const ET_OFFSET_MS = 3 * 60 * 60 * 1000
    const etLocalToUTC = (val: string) => {
      if (!val) return null
      // val is "YYYY-MM-DDTHH:MM" — interpret as ET, convert to UTC ISO
      const utcMs = new Date(val).getTime() - ET_OFFSET_MS
      return new Date(utcMs).toISOString()
    }
    try {
      await db.correctStaffAttendance(correctingRecord.id, {
        status: correctionForm.status,
        checkInTime: correctionForm.checkInTime ? etLocalToUTC(correctionForm.checkInTime) : null,
        checkOutTime: correctionForm.checkOutTime ? etLocalToUTC(correctionForm.checkOutTime) : null,
        remarks: correctionForm.remarks,
        reason: correctionForm.reason,
      })

      notifications.success(
        "Record Corrected",
        `Attendance for ${correctingRecord.user?.full_name} updated with audit trail.`
      )
      setCorrectingRecord(null)
      fetchData()
      fetchStats()
    } catch (err: any) {
      notifications.error("Correction Failed", err.message || "Failed to update record.")
    } finally {
      setIsSavingCorrection(false)
    }
  }

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveForm.userId || !leaveForm.reason.trim()) {
      notifications.error("Validation Error", "Please select a staff member and provide a reason.")
      return
    }

    setIsSavingLeave(true)
    try {
      await db.setStaffLeave(leaveForm.userId, leaveForm.date, leaveForm.status, leaveForm.reason)
      notifications.success("Leave Recorded", `Marked staff member as ${leaveForm.status}.`)
      setIsLeaveModalOpen(false)
      setLeaveForm({ userId: "", date: selectedDate, status: "LEAVE", reason: "" })
      fetchData()
      fetchStats()
    } catch (err: any) {
      notifications.error("Failed to Set Leave", err.message || "Failed to record leave.")
    } finally {
      setIsSavingLeave(false)
    }
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (!records.length) {
      notifications.error("Export Notice", "No attendance records available to export.")
      return
    }

    const headers = [
      "Staff Name",
      "Email",
      "Role",
      "Date",
      "Session",
      "Check-In Time",
      "Check-In Status",
      "Check-Out Time",
      "Check-Out Status",
      "Geofence Verified",
      "Geofence Distance (m)",
      "Face Verified",
      "Face Confidence (%)",
      "Remarks",
      "Corrected By",
      "Correction Reason",
    ]

    const rows = records.map((r) => {
      const sessCfg = isSessionMode
        ? staffSessions.find((s: any) => s.id.toLowerCase() === (r.session || "morning").toLowerCase())
        : undefined
      const display = getStaffAttendanceDisplay(r, settings, sessCfg)

      return [
        `"${r.user?.full_name || ""}"`,
        `"${r.user?.email || ""}"`,
        `"${r.user?.role || ""}"`,
        `"${r.date ? r.date.split("T")[0] : ""}"`,
        `"${r.session || "daily"}"`,
        `"${display.checkIn.timeStr !== "—" ? display.checkIn.timeStr : ""}"`,
        `"${display.checkIn.titleLabel}"`,
        `"${display.checkOut.timeStr !== "—" ? display.checkOut.timeStr : ""}"`,
        `"${display.checkOut.titleLabel}"`,
        r.geofenceVerified ? "YES" : "NO",
        r.geofenceDistance ? Math.round(r.geofenceDistance) : "",
        r.faceVerified ? "YES" : "NO",
        r.faceConfidence ? Math.round(r.faceConfidence * 100) : "",
        `"${(r.remarks || "").replace(/"/g, '""')}"`,
        `"${r.correctedBy || ""}"`,
        `"${(r.correctionReason || "").replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Staff_Attendance_${isRangeMode ? `${startDate}_to_${endDate}` : selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    notifications.success("Report Exported", "CSV download started successfully.")
  }

  return (
    <div className="relative min-h-full p-4 md:p-8 pb-24 space-y-8 max-w-7xl mx-auto w-full">
      {/* ── Ambient Background Blur Spheres ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      {/* ── Top Header Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 md:p-8 shadow-2xl shadow-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
      >
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/25">
              <UserCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Staff Attendance Dashboard
            </h1>
          </div>
          <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
            Monitor real-time biometric check-ins, campus geofencing compliance, audit logs, and attendance reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 z-10 w-full sm:w-auto">
          {/* Offline queue indicator */}
          {pendingOfflineCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncingOffline}
              className="h-10 px-3.5 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs gap-2"
            >
              <WifiOff className="w-4 h-4" />
              <span>{pendingOfflineCount} Offline Pending</span>
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? "animate-spin" : ""}`} />
            </Button>
          )}

          <Button
            onClick={() => setIsLeaveModalOpen(true)}
            variant="outline"
            className="h-10 px-4 rounded-xl gap-2 text-xs font-bold border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
          >
            <CalendarClock className="w-4 h-4" />
            Mark Leave / Permission
          </Button>

          <Button
            onClick={() => {
              setEnrollTarget(null)
              setShowEnrollModal(true)
            }}
            className="h-10 px-4 rounded-xl gap-2 bg-gradient-to-r from-primary to-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 active:scale-95"
          >
            <ScanFace className="w-4 h-4" />
            Face Biometrics
          </Button>
        </div>
      </motion.div>

      {/* Holiday / Non-Working Day Banner */}
      {!isRangeMode && stats && !stats.isWorkingDay && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm ${
            stats.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
          }`}
        >
          <div
            className={`p-2.5 rounded-xl ${
              stats.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            <CalendarClock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {stats.isHoliday
                  ? `School Holiday: ${stats.holidayName}`
                  : stats.calendarNote || `${stats.dayOfWeek} (Scheduled Non-Working Day)`}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold ${
                  stats.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300"
                }`}
              >
                {stats.isHoliday ? "Official Holiday" : "Non-Working Day"}
              </Badge>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              Attendance is not required on this date. Staff are not marked absent or penalized.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Glass Metric Cards Overview ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 md:gap-4">
        {/* Total Active Staff */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.02 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {statsLoading ? "..." : stats?.totalStaff ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Active Staff</p>
        </motion.div>

        {/* Present */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.04 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">On Time</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {statsLoading ? "..." : stats?.present ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Present</p>
        </motion.div>

        {/* Late */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.06 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Late</span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {statsLoading ? "..." : stats?.late ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Late Check-In</p>
        </motion.div>

        {/* Absent */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <UserX className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Absent</span>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            {statsLoading ? "..." : stats?.absent ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Marked Absent</p>
        </motion.div>

        {/* Early Departure */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Early Out</span>
          </div>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
            {statsLoading ? "..." : stats?.earlyDeparture ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Early Departure</p>
        </motion.div>

        {/* On Leave / Permission */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.12 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CalendarClock className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Leave</span>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            {statsLoading ? "..." : stats?.onLeave ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Approved Leave</p>
        </motion.div>

        {/* Unchecked Staff */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.14 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending</span>
          </div>
          <p className="text-2xl font-black text-slate-700 dark:text-slate-300 tracking-tight">
            {statsLoading ? "..." : stats?.notCheckedIn ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Not Checked In</p>
        </motion.div>
      </div>

      {/* ── View Navigation Tabs (Roster vs Reports) ── */}
      <div className="flex items-center justify-between border-b border-white/30 dark:border-white/10 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("roster")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "roster"
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "bg-white/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <UserCheck className="w-4 h-4" />
            Staff Attendance Roster ({records.length})
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "reports"
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "bg-white/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Reports & Analytics
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl h-9 px-3.5 text-xs font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* ─── TAB 1: ATTENDANCE ROSTER VIEW ─── */}
      {activeTab === "roster" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="rounded-[24px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-xl shadow-slate-900/5 space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search staff by name, email, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-medium"
                />
              </div>

              {/* Date / Range Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRangeMode(!isRangeMode)}
                  className={cn(
                    "h-10 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors",
                    isRangeMode
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600"
                      : "bg-white/70 dark:bg-slate-950/70 border-white/40 text-slate-600"
                  )}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  {isRangeMode ? "Range Mode" : "Single Date"}
                </button>

                {!isRangeMode ? (
                  <div className="flex items-center gap-1.5 bg-white/70 dark:bg-slate-950/70 border border-white/40 dark:border-white/10 rounded-xl px-3 h-10">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white/70 dark:bg-slate-950/70 border border-white/40 dark:border-white/10 rounded-xl px-2.5 h-10">
                      <span className="text-[10px] uppercase font-bold text-slate-400">From</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <div className="flex items-center gap-1.5 bg-white/70 dark:bg-slate-950/70 border border-white/40 dark:border-white/10 rounded-xl px-2.5 h-10">
                      <span className="text-[10px] uppercase font-bold text-slate-400">To</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchData()
                    fetchStats()
                  }}
                  disabled={loading}
                  className="h-10 px-3 rounded-xl border-white/40 gap-1.5 text-xs font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>

            {/* Sub-Filters: Role, Status, Session, Geofence, Face */}
            <div className={`grid grid-cols-2 ${isSessionMode ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/60`}>
              {/* Role */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Staff Roles</option>
                <option value="teacher">Teachers</option>
                <option value="registrar">Registrars</option>
                <option value="discipline_officer">Discipline Officers</option>
                <option value="staff">General Staff</option>
                <option value="admin">Admins</option>
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="EARLY_DEPARTURE">Early Departure</option>
                <option value="LEAVE">On Leave</option>
                <option value="PERMISSION">Permission</option>
              </select>

              {/* Session Filter (visible in Session-Based mode) */}
              {isSessionMode && (
                <select
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold focus:outline-none"
                >
                  <option value="all">All Sessions</option>
                  {staffSessions.map((sess: any) => (
                    <option key={sess.id} value={sess.id}>
                      {sess.name} ({sess.startTime} - {sess.endTime})
                    </option>
                  ))}
                </select>
              )}

              {/* Geofence */}
              <select
                value={geoFilter}
                onChange={(e) => setGeoFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="all">GPS: All Statuses</option>
                <option value="verified">GPS: Verified Campus</option>
                <option value="unverified">GPS: Unverified / Outside</option>
              </select>

              {/* Face */}
              <select
                value={faceFilter}
                onChange={(e) => setFaceFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="all">Face: All Verification</option>
                <option value="verified">Face: Authenticated ✓</option>
                <option value="unverified">Face: Not Verified</option>
              </select>
            </div>
          </div>

          {/* ── Main Attendance Roster Table ── */}
          <div className="rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-slate-900/5 overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 bg-white/40 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
                  <UserCheck className="w-8 h-8" />
                </div>
                <p className="font-black text-lg text-slate-900 dark:text-white">No attendance records found</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  No staff members matched your filter criteria for this date range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[950px]">
                  <thead>
                    <tr className="border-b border-white/40 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold backdrop-blur-sm">
                      <th className="px-6 py-4">Staff Member</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4">Date</th>
                      {isSessionMode && <th className="px-5 py-4">Session</th>}
                      <th className="px-5 py-4">Check-In</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Check-Out</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Biometric & GPS</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/30 dark:divide-white/5">
                    {records.map((rec) => {
                      const roleBadge = ROLE_BADGES[rec.user?.role] || {
                        label: rec.user?.role || "Staff",
                        color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
                        dotColor: "bg-slate-400",
                      }
                      const sessCfg = isSessionMode
                        ? staffSessions.find(
                            (s: any) => s.id.toLowerCase() === (rec.session || "morning").toLowerCase()
                          )
                        : undefined
                      const display = getStaffAttendanceDisplay(rec, settings, sessCfg)

                      return (
                        <tr key={rec.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors group">
                          {/* Staff Info */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 border border-primary/20">
                                <AvatarImage src={rec.user?.profile_photo || ""} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                  {rec.user?.full_name?.substring(0, 2).toUpperCase() || "ST"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white leading-tight">
                                  {rec.user?.full_name || "Unknown Staff"}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rec.user?.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold backdrop-blur-md", roleBadge.color)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", roleBadge.dotColor)} />
                              {roleBadge.label}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {formatDate(rec.date?.split("T")[0])}
                          </td>

                          {/* Session Badge in Session-Based Mode */}
                          {isSessionMode && (
                            <td className="px-5 py-4">
                              <Badge variant="outline" className="text-[10px] font-bold uppercase border-primary/30 text-primary">
                                {rec.session || "daily"}
                              </Badge>
                            </td>
                          )}

                          {/* Check-In Time */}
                          <td className="px-5 py-4 text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                            {display.checkIn.timeStr}
                          </td>

                          {/* Check-In Status */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-0.5">
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border backdrop-blur-md w-fit", display.checkIn.badgeColor)}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", display.checkIn.dotColor)} />
                                {display.checkIn.titleLabel}
                              </span>
                              {rec.correctedBy && (
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold pl-0.5">
                                  (Corrected)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Check-Out Time */}
                          <td className="px-5 py-4 text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                            {display.checkOut.timeStr}
                          </td>

                          {/* Check-Out Status */}
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border backdrop-blur-md w-fit", display.checkOut.badgeColor)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", display.checkOut.dotColor)} />
                              {display.checkOut.titleLabel}
                            </span>
                          </td>

                          {/* Biometric & GPS */}
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {rec.faceVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[11px] font-bold">
                                  <ShieldCheck className="w-3 h-3 text-cyan-600" />
                                  Face ✓
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-500 text-[11px] font-medium">
                                  No Face
                                </span>
                              )}

                              {rec.geofenceVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                                  <MapPin className="w-3 h-3 text-emerald-600" />
                                  GPS {rec.geofenceDistance ? `${Math.round(rec.geofenceDistance)}m` : "✓"}
                                </span>
                              ) : rec.checkInLatitude ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Outside Campus
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Row Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setDetailRecord(rec)}
                                title="View Record Details"
                                className="p-2 rounded-xl border border-transparent hover:border-white/40 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-500 hover:text-primary transition-all shadow-sm"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Correct Record */}
                              <button
                                onClick={() => openCorrectionModal(rec)}
                                title="Correct Attendance"
                                className="p-2 rounded-xl border border-transparent hover:border-white/40 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Enroll Face Biometrics in place */}
                              <button
                                onClick={() => {
                                  setEnrollTarget(rec.user)
                                  setShowEnrollModal(true)
                                }}
                                title="Enroll / Update Biometrics"
                                className="p-2 rounded-xl border border-transparent hover:border-white/40 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-400 hover:text-cyan-600 transition-all shadow-sm"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: REPORTS & ANALYTICS VIEW ─── */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Report Date Controls */}
          <div className="rounded-[24px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-950/70 border border-white/40 dark:border-white/10 rounded-xl px-3 h-10">
                <span className="text-[10px] uppercase font-bold text-slate-400">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-950/70 border border-white/40 dark:border-white/10 rounded-xl px-3 h-10">
                <span className="text-[10px] uppercase font-bold text-slate-400">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 px-3.5 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="teacher">Teachers</option>
                <option value="registrar">Registrars</option>
                <option value="discipline_officer">Discipline Officers</option>
                <option value="staff">General Staff</option>
              </select>

              <Button
                onClick={fetchReport}
                disabled={reportLoading}
                className="h-10 px-4 rounded-xl text-xs font-bold bg-primary text-white gap-2 shadow-md"
              >
                <BarChart3 className={`w-3.5 h-3.5 ${reportLoading ? "animate-spin" : ""}`} /> Generate Report
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="h-10 px-4 rounded-xl text-xs font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-2"
            >
              <Download className="w-4 h-4" /> Export Report (CSV)
            </Button>
          </div>

          {reportLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Calculating attendance aggregates...</p>
            </div>
          ) : !reportData ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">Select dates and click "Generate Report".</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Report Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Check-Ins</span>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {reportData.totalRecords}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Logged in selected period</p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Present (On-Time)</span>
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + s.present, 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">On-time attendances</p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Late Arrivals</span>
                  <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + s.late, 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Late arrivals logged</p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Approved Leaves</span>
                  <p className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + s.onLeave, 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Leave & permissions</p>
                </div>
              </div>

              {/* Staff Aggregate Roster */}
              <div className="rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-xl overflow-hidden">
                <div className="p-5 border-b border-white/40 dark:border-white/10">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Staff Member Performance Summary</h3>
                  <p className="text-xs text-slate-500">Per-employee cumulative breakdown between {startDate} and {endDate}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/40 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40 text-left text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                        <th className="px-6 py-3.5">Staff Member</th>
                        <th className="px-4 py-3.5">Role</th>
                        <th className="px-4 py-3.5 text-center">Days Logged</th>
                        <th className="px-4 py-3.5 text-center text-emerald-600">Present</th>
                        <th className="px-4 py-3.5 text-center text-amber-600">Late</th>
                        <th className="px-4 py-3.5 text-center text-rose-600">Absent</th>
                        <th className="px-4 py-3.5 text-center text-purple-600">Leave</th>
                        <th className="px-4 py-3.5 text-center text-cyan-600">Biometric %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/30 dark:divide-white/5">
                      {reportData.staffSummary.map((item: any) => {
                        const bioPct = item.totalRecords > 0 ? Math.round((item.faceVerified / item.totalRecords) * 100) : 0
                        return (
                          <tr key={item.user?.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30">
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8 border border-primary/20">
                                  <AvatarImage src={item.user?.profile_photo || ""} />
                                  <AvatarFallback className="text-xs font-bold text-primary">
                                    {item.user?.full_name?.substring(0, 2).toUpperCase() || "ST"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-slate-900 dark:text-white">{item.user?.full_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs capitalize text-slate-600 dark:text-slate-400">
                              {item.user?.role?.replace("_", " ")}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold">{item.totalRecords}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-emerald-600">{item.present}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-amber-600">{item.late}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-rose-600">{item.absent}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-purple-600">{item.onLeave}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-cyan-600">{bioPct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: RECORD DETAIL MODAL ─── */}
      <AnimatePresence>
        {detailRecord && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Attendance Record Details</h2>
                    <p className="text-xs text-slate-500">Detailed verification audit log</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailRecord(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 py-4 pr-1 text-xs">
                {/* Staff Member Info */}
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-white/40 dark:border-white/10">
                  <Avatar className="w-12 h-12 border border-primary/30">
                    <AvatarImage src={detailRecord.user?.profile_photo || ""} />
                    <AvatarFallback className="font-bold text-primary text-sm">
                      {detailRecord.user?.full_name?.substring(0, 2).toUpperCase() || "ST"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-black text-sm text-slate-900 dark:text-white">{detailRecord.user?.full_name}</p>
                    <p className="text-slate-500">{detailRecord.user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] capitalize">
                      {detailRecord.user?.role?.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Timestamps & Dual Statuses */}
                {(() => {
                  const sessCfg = isSessionMode
                    ? staffSessions.find((s: any) => s.id.toLowerCase() === (detailRecord.session || "morning").toLowerCase())
                    : undefined
                  const display = getStaffAttendanceDisplay(detailRecord, settings, sessCfg)

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-950/60 border border-white/40 dark:border-white/10">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Attendance Date</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {formatDate(detailRecord.date?.split("T")[0])}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-950/60 border border-white/40 dark:border-white/10">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {isSessionMode ? "Session" : "Attendance Mode"}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block uppercase">
                            {isSessionMode ? (detailRecord.session || "Morning") : "Daily"}
                          </span>
                        </div>
                      </div>

                      {/* Check-In / Check-Out Details with Independent Statuses */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-emerald-600">Check-In</span>
                            <Badge className={cn("text-[10px] font-extrabold uppercase px-2 py-0", display.checkIn.badgeColor)}>
                              {display.checkIn.titleLabel}
                            </Badge>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block font-mono">
                            {detailRecord.checkInTime
                              ? new Date(detailRecord.checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Addis_Ababa" })
                              : "Not Checked In"}
                          </span>
                          {detailRecord.checkInLatitude && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              GPS: {detailRecord.checkInLatitude.toFixed(5)}, {detailRecord.checkInLongitude.toFixed(5)}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-primary">Check-Out</span>
                            <Badge className={cn("text-[10px] font-extrabold uppercase px-2 py-0", display.checkOut.badgeColor)}>
                              {display.checkOut.titleLabel}
                            </Badge>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm block font-mono">
                            {detailRecord.checkOutTime
                              ? new Date(detailRecord.checkOutTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Addis_Ababa" })
                              : "Not Checked Out"}
                          </span>
                          {detailRecord.checkOutLatitude && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              GPS: {detailRecord.checkOutLatitude.toFixed(5)}, {detailRecord.checkOutLongitude.toFixed(5)}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* Verification Evidence */}
                <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 space-y-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Biometric & Geofence Evidence
                  </span>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                      <ScanFace className="w-4 h-4 text-cyan-600" /> Facial Biometric Verification:
                    </span>
                    {detailRecord.faceVerified ? (
                      <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 text-[11px]">
                        Authenticated ✓ {detailRecord.faceConfidence ? `(${Math.round(detailRecord.faceConfidence * 100)}%)` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 text-[11px]">Not Verified</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                      <MapPin className="w-4 h-4 text-emerald-600" /> Campus Geofence Check:
                    </span>
                    {detailRecord.geofenceVerified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
                        Inside Boundary {detailRecord.geofenceDistance ? `(${Math.round(detailRecord.geofenceDistance)}m)` : "✓"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[11px]">Outside Campus / None</Badge>
                    )}
                  </div>
                </div>

                {/* Remarks */}
                {detailRecord.remarks && (
                  <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-950/60 border border-white/40 dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Remarks / Notes</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                      {detailRecord.remarks}
                    </p>
                  </div>
                )}

                {/* Audit Trail if Corrected */}
                {detailRecord.correctedBy && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-amber-900 dark:text-amber-300">
                    <span className="text-[10px] font-black uppercase tracking-wider block flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Administrative Correction Audit
                    </span>
                    <p className="text-[11px]">
                      <span className="font-bold">Corrected At:</span>{" "}
                      {detailRecord.correctedAt
                        ? new Date(detailRecord.correctedAt).toLocaleString("en-US", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
                        : "—"}
                    </p>
                    <p className="text-[11px]">
                      <span className="font-bold">Previous Status:</span> {detailRecord.previousStatus || "—"}
                    </p>
                    <p className="text-[11px]">
                      <span className="font-bold">Correction Reason:</span> {detailRecord.correctionReason || "—"}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2 shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => setDetailRecord(null)}
                  className="rounded-xl h-10 px-4 text-xs font-bold"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const r = detailRecord
                    setDetailRecord(null)
                    openCorrectionModal(r)
                  }}
                  className="rounded-xl h-10 px-4 text-xs font-bold bg-primary text-white gap-1.5 shadow-md"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Correct This Record
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: ATTENDANCE CORRECTION MODAL ─── */}
      <AnimatePresence>
        {correctingRecord && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Correct Attendance Record</h2>
                    <p className="text-xs text-slate-500">{correctingRecord.user?.full_name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCorrection} className="space-y-4 overflow-y-auto flex-1 py-3 pr-1">
                {/* Status selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Attendance Status *</label>
                  <select
                    value={correctionForm.status}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="ABSENT">Absent</option>
                    <option value="EARLY_DEPARTURE">Early Departure</option>
                    <option value="LEAVE">On Leave</option>
                    <option value="PERMISSION">Permission</option>
                  </select>
                </div>

                {/* Check In Time */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Check-In Time</label>
                  <Input
                    type="datetime-local"
                    value={correctionForm.checkInTime}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, checkInTime: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-bold"
                  />
                </div>

                {/* Check Out Time */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Check-Out Time</label>
                  <Input
                    type="datetime-local"
                    value={correctionForm.checkOutTime}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, checkOutTime: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-bold"
                  />
                </div>

                {/* Mandatory Correction Reason */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mandatory Reason for Correction *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Device failure during check-in, approved manual override by Principal."
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    className="w-full mt-1 p-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Optional remarks */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Remarks (Optional)</label>
                  <Input
                    placeholder="Additional notes..."
                    value={correctionForm.remarks}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, remarks: e.target.value })}
                    className="mt-1 h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs"
                  />
                </div>

                {/* Audit Warning */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Your admin user ID and timestamp will be permanently attached to this correction audit log.
                    Original biometric and GPS readings are preserved as historical evidence.
                  </span>
                </div>
              </form>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCorrectingRecord(null)}
                  className="rounded-xl h-10 px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCorrection}
                  disabled={isSavingCorrection}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-bold shadow-lg shadow-primary/25"
                >
                  {isSavingCorrection ? "Saving Audit..." : "Save Correction"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 3: MARK LEAVE / PERMISSION MODAL ─── */}
      <AnimatePresence>
        {isLeaveModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Mark Leave / Permission</h2>
                    <p className="text-xs text-slate-500">Record officially approved absence or duty leave</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLeave} className="space-y-4 overflow-y-auto flex-1 py-3 pr-1">
                {/* Staff Member Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Staff Member *</label>
                  <select
                    required
                    value={leaveForm.userId}
                    onChange={(e) => setLeaveForm({ ...leaveForm, userId: e.target.value })}
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
                  >
                    <option value="">Select a staff member...</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role?.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Date *</label>
                  <Input
                    type="date"
                    required
                    value={leaveForm.date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-bold"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Type *</label>
                  <select
                    value={leaveForm.status}
                    onChange={(e) => setLeaveForm({ ...leaveForm, status: e.target.value as "LEAVE" | "PERMISSION" })}
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
                  >
                    <option value="LEAVE">Official Leave (Medical / Annual / Sick)</option>
                    <option value="PERMISSION">Official Duty Permission / Training</option>
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reason / Approved By *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Medical doctor appointment, approved by HR"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full mt-1 p-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none"
                  />
                </div>
              </form>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="rounded-xl h-10 px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveLeave}
                  disabled={isSavingLeave}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/25"
                >
                  {isSavingLeave ? "Saving..." : "Record Leave"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 4: BIOMETRIC FACE ENROLLMENT MODAL ─── */}
      {showEnrollModal && (
        <StaffFaceEnrollModal
          open={showEnrollModal}
          onOpenChange={setShowEnrollModal}
          onEnrolled={() => {
            setShowEnrollModal(false)
            fetchData()
            fetchStats()
          }}
          preselectedUserId={enrollTarget?.id}
          preselectedUserName={enrollTarget?.full_name}
        />
      )}
    </div>
  )
}
