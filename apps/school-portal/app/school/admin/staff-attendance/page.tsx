"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  ChevronLeft,
  TrendingUp,
  X,
  ScanFace,
  Info,
  CalendarClock,
  ArrowRight,
  ChevronDown,
  Check
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
import { formatEthiopianTime, formatEthiopianFullDateTime } from "@/lib/utils/ethiopian-time"


const DEFAULT_ROLE_BADGES: Record<string, { label: string; color: string; dotColor: string }> = {
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
  LEAVE_PERMISSION: {
    label: "Leave & Permission",
    color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    dotColor: "bg-indigo-500",
  },
  HOLIDAY: {
    label: "Holiday",
    color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    dotColor: "bg-purple-500",
  },
  NON_WORKING_DAY: {
    label: "Non-Working Day",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotColor: "bg-amber-500",
  },
}

export default function AdminStaffAttendanceDashboard() {
  const { formatDate } = useCalendar()
  const { settings } = useSchoolSettings()

  const isSessionMode = settings?.staffAttendanceMode === "session_based"
  const staffSessions = useMemo(() => {
    const defaults = [
      { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true },
      { id: "afternoon", name: "Afternoon", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, isActive: true },
    ]
    if (!settings?.staffSessions) return defaults
    try {
      const arr = typeof settings.staffSessions === "string" ? JSON.parse(settings.staffSessions) : settings.staffSessions
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
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL")
  const [sessionFilter, setSessionFilter] = useState("morning")
  const [geoFilter, setGeoFilter] = useState<string>("all")

  // Data states
  const [records, setRecords] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const PAGE_LIMIT = 50
  const [reportPage, setReportPage] = useState(1)
  const REPORT_PAGE_LIMIT = 50
  const searchDebounceRef = React.useRef<NodeJS.Timeout | null>(null)

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
    isRange: false,
    startDate: selectedDate,
    endDate: selectedDate,
    status: "LEAVE" as "LEAVE" | "PERMISSION",
    reason: "",
    session: "all" as string,  // "all" for full day or specific session
  })
  const [isSavingLeave, setIsSavingLeave] = useState(false)
  const [leaveStaffSearch, setLeaveStaffSearch] = useState("")
  const [isLeaveStaffDropdownOpen, setIsLeaveStaffDropdownOpen] = useState(false)
  const leaveStaffDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leaveStaffDropdownRef.current && !leaveStaffDropdownRef.current.contains(e.target as Node)) {
        setIsLeaveStaffDropdownOpen(false)
      }
    }
    if (isLeaveStaffDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isLeaveStaffDropdownOpen])


  // Offline Sync State
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isSyncingOffline, setIsSyncingOffline] = useState(false)

  // Report state
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const paginatedStaffSummary = useMemo(() => {
    if (!reportData?.staffSummary) return []
    const start = (reportPage - 1) * REPORT_PAGE_LIMIT
    return reportData.staffSummary.slice(start, start + REPORT_PAGE_LIMIT)
  }, [reportData?.staffSummary, reportPage])

  // Load all users for leave dropdown
  const [allUsers, setAllUsers] = useState<any[]>([])

  // Dynamic roles state (all system and created custom roles)
  const [availableRoles, setAvailableRoles] = useState<any[]>([])

  const loadRoles = useCallback(async () => {
    try {
      const rolesData = await db.getSystemRoles(true)
      setAvailableRoles(rolesData || [])
    } catch (err) {
      console.error("Failed to load staff roles:", err)
    }
  }, [])

  // Dynamically compute all unique staff roles from:
  // 1. Configured system and custom roles from DB (/api/roles)
  // 2. Any active roles found on loaded users / records
  // 3. Fallback to default base staff roles
  const dynamicRoleOptions = useMemo(() => {
    const roleMap = new Map<string, { key: string; label: string; color?: string }>()

    // 1. Add from DB roles (system + custom created roles)
    availableRoles.forEach((r) => {
      if (r.key && !["parent", "student", "admin", "school_admin"].includes(r.key)) {
        roleMap.set(r.key, {
          key: r.key,
          label: r.name || r.key.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
          color: r.color,
        })
      }
    })

    // 2. Ensure base default roles exist if not yet in roleMap
    const baseDefaults: Array<{ key: string; label: string }> = [
      { key: "teacher", label: "Teachers" },
      { key: "registrar", label: "Registrars" },
      { key: "discipline_officer", label: "Discipline Officers" },
      { key: "staff", label: "General Staff" },
    ]

    baseDefaults.forEach((def) => {
      if (!roleMap.has(def.key)) {
        roleMap.set(def.key, { key: def.key, label: def.label })
      }
    })

    // 3. Include any roles that exist on loaded users/records that might not be in DB roles
    allUsers.forEach((u) => {
      if (u.role && !["parent", "student", "admin", "school_admin"].includes(u.role) && !roleMap.has(u.role)) {
        roleMap.set(u.role, {
          key: u.role,
          label: u.role.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        })
      }
    })

    records.forEach((r) => {
      const uRole = r.user?.role
      if (uRole && !["parent", "student", "admin", "school_admin"].includes(uRole) && !roleMap.has(uRole)) {
        roleMap.set(uRole, {
          key: uRole,
          label: uRole.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        })
      }
    })

    return Array.from(roleMap.values())
  }, [availableRoles, allUsers, records])

  // Get dynamic role badge info with color support
  const getRoleBadge = useCallback(
    (roleKey?: string) => {
      if (!roleKey) {
        return {
          label: "Staff",
          color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
          dotColor: "bg-slate-400",
          isHex: false,
        }
      }

      if (DEFAULT_ROLE_BADGES[roleKey]) {
        return { ...DEFAULT_ROLE_BADGES[roleKey], isHex: false }
      }

      const foundCustom = availableRoles.find((r) => r.key === roleKey)
      if (foundCustom) {
        return {
          label: foundCustom.name || roleKey.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
          color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25",
          dotColor: foundCustom.color || "#6366f1",
          isHex: !!foundCustom.color && foundCustom.color.startsWith("#"),
        }
      }

      return {
        label: roleKey.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
        dotColor: "bg-slate-400",
        isHex: false,
      }
    },
    [availableRoles]
  )

  const selectedLeaveUser = useMemo(() => {
    return allUsers.find((u) => u.id === leaveForm.userId)
  }, [allUsers, leaveForm.userId])

  const filteredLeaveStaff = useMemo(() => {
    if (!leaveStaffSearch.trim()) return allUsers
    const q = leaveStaffSearch.toLowerCase()
    return allUsers.filter((u) => {
      const name = (u.full_name || "").toLowerCase()
      const email = (u.email || "").toLowerCase()
      const phone = (u.phone_number || u.phone || "").toLowerCase()
      const roleLabel = getRoleBadge(u.role).label.toLowerCase()
      return name.includes(q) || email.includes(q) || phone.includes(q) || roleLabel.includes(q)
    })
  }, [allUsers, leaveStaffSearch, getRoleBadge])

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
      const sess = isSessionMode ? sessionFilter : undefined
      const s = await db.getStaffAttendanceStats(selectedDate, sess)
      setStats(s)
    } catch (err) {
      console.error("Failed to fetch staff stats:", err)
    } finally {
      setStatsLoading(false)
    }
  }, [selectedDate, sessionFilter])

  const fetchData = useCallback(async (pageOverride?: number) => {
    setLoading(true)
    const targetPage = pageOverride ?? 1
    try {
      const filterPayload: any = {
        // Always pass the mode so the backend enforces strict mode separation
        mode: isSessionMode ? "session_based" : "daily",
        role: roleFilter !== "all" ? roleFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        // Always pass session filter when in session-based mode
        session: isSessionMode ? sessionFilter : undefined,
        search: search.trim() || undefined,
        geofenceVerified: geoFilter === "verified" ? true : geoFilter === "unverified" ? false : undefined,
        page: targetPage,
        limit: PAGE_LIMIT,
      }

      if (isRangeMode) {
        filterPayload.startDate = startDate
        filterPayload.endDate = endDate
      } else {
        filterPayload.date = selectedDate
      }

      const res = await db.getStaffAttendance(filterPayload)
      const list = Array.isArray(res) ? res : ((res as any)?.data || [])
      setRecords(list)
      setTotalRecords(res?.total ?? list.length)
      setCurrentPage(targetPage)
    } catch (err: any) {
      console.error("Failed to load staff attendance records:", err)
      setRecords([])
      setTotalRecords(0)
    } finally {
      setLoading(false)
    }
  }, [isSessionMode, isRangeMode, selectedDate, startDate, endDate, roleFilter, statusFilter, sessionFilter, search, geoFilter])

  const fetchReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const r = await db.getStaffAttendanceReport({
        startDate,
        endDate,
        role: roleFilter !== "all" ? roleFilter : undefined,
        status: reportStatusFilter !== "ALL" ? reportStatusFilter : undefined,
        // Pass active mode so the backend strictly filters by mode
        mode: isSessionMode ? "session_based" : "daily",
        // In session-based mode, always pass the selected session
        session: isSessionMode ? sessionFilter : undefined,
      })
      setReportData(r)
    } catch (err) {
      console.error("Failed to load attendance report:", err)
      setReportData(null)
    } finally {
      setReportLoading(false)
    }
  }, [isSessionMode, startDate, endDate, roleFilter, reportStatusFilter, sessionFilter])

  const loadAllUsers = useCallback(async () => {
    try {
      // Fetch mode-correct records to build the users map
      const res = await db.getStaffAttendance({
        mode: isSessionMode ? "session_based" : "daily",
      })
      const userMap = new Map<string, any>()
      const list = Array.isArray(res) ? res : ((res as any)?.data || [])
      list.forEach((r: any) => {
        if (r.user && !["parent", "student", "admin", "school_admin"].includes(r.user.role) && !userMap.has(r.user.id)) {
          userMap.set(r.user.id, r.user)
        }
      })
      setAllUsers(Array.from(userMap.values()))
    } catch {
      /* ignore */
    }
  }, [isSessionMode])

  useEffect(() => {
    fetchStats()
    fetchData()
    checkOfflineQueue()
    loadAllUsers()
    loadRoles()

    const handleDataChanged = () => {
      fetchStats()
      fetchData()
      checkOfflineQueue()
      loadRoles()
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
        loadRoles()
      } catch (err) {
        console.error("Offline sync error:", err)
      }
    }

    window.addEventListener("staffAttendanceDataChanged", handleDataChanged)
    window.addEventListener("userDataChanged", handleDataChanged)
    window.addEventListener("roleDataChanged", handleDataChanged)
    window.addEventListener("online", handleOnline)

    let lastAdminResumeTime = 0
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now()
        if (now - lastAdminResumeTime > 3000) {
          lastAdminResumeTime = now
          fetchData()
          fetchStats()
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("staffAttendanceDataChanged", handleDataChanged)
      window.removeEventListener("userDataChanged", handleDataChanged)
      window.removeEventListener("roleDataChanged", handleDataChanged)
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchStats, fetchData, checkOfflineQueue, loadAllUsers, loadRoles, activeTab, fetchReport])

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

    if (leaveForm.isRange && leaveForm.startDate > leaveForm.endDate) {
      notifications.error("Invalid Dates", "Start date cannot be after end date.")
      return
    }

    setIsSavingLeave(true)
    try {
      // Pass mode and session so the backend stores with the correct session key
      const leaveSession = isSessionMode ? leaveForm.session : undefined
      const leaveMode = isSessionMode ? "session_based" : "daily"
      const targetEndDate = leaveForm.isRange ? leaveForm.endDate : leaveForm.startDate
      await db.setStaffLeave(
        leaveForm.userId,
        leaveForm.startDate,
        leaveForm.status,
        leaveForm.reason,
        leaveSession,
        leaveMode,
        targetEndDate
      )

      const daysCount = leaveForm.isRange
        ? Math.max(1, Math.round((new Date(leaveForm.endDate).getTime() - new Date(leaveForm.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : 1

      if (daysCount > 1) {
        notifications.success(
          "Leave Recorded",
          `Marked ${leaveForm.status === "PERMISSION" ? "permission" : "leave"} for ${daysCount} days (${leaveForm.startDate} to ${leaveForm.endDate}).`
        )
      } else {
        notifications.success("Leave Recorded", `Marked staff member as ${leaveForm.status}.`)
      }

      setIsLeaveModalOpen(false)
      setLeaveForm({
        userId: "",
        isRange: false,
        startDate: selectedDate,
        endDate: selectedDate,
        status: "LEAVE",
        reason: "",
        session: "all",
      })
      fetchData()
      fetchStats()
    } catch (err: any) {
      notifications.error("Failed to Set Leave", err.message || "Failed to record leave.")
    } finally {
      setIsSavingLeave(false)
    }
  }

  const [isProcessingAbsences, setIsProcessingAbsences] = useState(false)

  const handleProcessAbsencesNow = async () => {
    setIsProcessingAbsences(true)
    try {
      const sess = sessionFilter !== "all" ? sessionFilter : undefined
      const res = await db.processStaffAbsences({
        date: selectedDate,
        session: sess,
        force: false,
      })
      if (res.markedAbsent > 0) {
        notifications.success("Absences Processed", `Marked ${res.markedAbsent} staff members as Absent.`)
      } else {
        notifications.info("Absence Evaluation", `No new absences to mark. (Evaluated ${res.totalEligibleStaff || 0} staff)`)
      }
      fetchData()
      fetchStats()
    } catch (err: any) {
      notifications.error("Processing Failed", err.message || "Failed to process automatic absences.")
    } finally {
      setIsProcessingAbsences(false)
    }
  }

  // Export to CSV
  const handleExportCSV = () => {
    if (activeTab === "reports" && reportData?.staffSummary) {
      if (!reportData.staffSummary.length) {
        notifications.error("Export Notice", "No attendance report records available to export.")
        return
      }

      const headers = [
        "Staff Name",
        "Email",
        "Role",
        "Start Date",
        "End Date",
        ...(isSessionMode ? ["Session"] : []),
        ...(reportStatusFilter !== "ALL" ? ["State Filter"] : []),
        "Total Days Logged",
        "Present (On-Time)",
        "Late",
        "Absent",
        "Permission",
        "On Leave",
      ]

      const rows = reportData.staffSummary.map((item: any) => {
        const permissionCount = item.permission || 0
        const leaveCount = Math.max(0, (item.onLeave || 0) - permissionCount)
        return [
          `"${item.user?.full_name || ""}"`,
          `"${item.user?.email || ""}"`,
          `"${item.user?.role || ""}"`,
          `"${startDate}"`,
          `"${endDate}"`,
          ...(isSessionMode ? [`"${staffSessions.find((s: any) => s.id === sessionFilter)?.name || sessionFilter}"`] : []),
          ...(reportStatusFilter !== "ALL" ? [`"${STATUS_CONFIG[reportStatusFilter]?.label || reportStatusFilter}"`] : []),
          item.totalRecords,
          item.present || 0,
          item.late || 0,
          item.absent || 0,
          permissionCount,
          leaveCount,
        ]
      })

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n")
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute(
        "download",
        `Staff_Attendance_Report_${startDate}_to_${endDate}${reportStatusFilter !== "ALL" ? `_${reportStatusFilter.toLowerCase()}` : ""}${isSessionMode ? `_${sessionFilter}` : ""}.csv`
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      notifications.success("Report Exported", "Report CSV download started successfully.")
      return
    }

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
      "Lateness (Minutes)",
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
        display.latenessMinutes ? display.latenessMinutes : "",
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

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n")
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
            Monitor real-time biometric check-ins, school geofencing compliance, audit logs, and attendance reports
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
            onClick={handleProcessAbsencesNow}
            disabled={isProcessingAbsences}
            variant="outline"
            className="h-10 px-4 rounded-xl gap-2 text-xs font-bold border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
          >
            <Clock className={`w-4 h-4 ${isProcessingAbsences ? "animate-spin" : ""}`} />
            {isProcessingAbsences ? "Evaluating..." : "Process Absences"}
          </Button>

          <Button
            onClick={() => setIsLeaveModalOpen(true)}
            variant="outline"
            className="h-10 px-4 rounded-xl gap-2 text-xs font-bold border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
          >
            <CalendarClock className="w-4 h-4" />
            Mark Leave / Permission
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
                {stats.displayReason || (stats.isHoliday
                  ? `School Holiday — ${stats.holidayName}`
                  : stats.calendarNote || `${stats.dayOfWeek} (Scheduled Non-Working Day)`)}
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

        {/* Unchecked / Pending Staff */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.14 }}
          className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-lg shadow-slate-900/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Clock className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Pending</span>
          </div>
          <p className="text-2xl font-black text-slate-700 dark:text-slate-300 tracking-tight">
            {statsLoading ? "..." : (stats?.pendingCheckIn || stats?.notStarted || stats?.notCheckedIn || 0)}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {stats?.notStarted ? "Not Started" : stats?.absenceCutoffTime ? `Cutoff: ${formatEthiopianTime(stats.absenceCutoffTime)}` : "Pending Check-In"}
          </p>
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
                  onChange={(e) => {
                    const val = e.target.value
                    setSearch(val)
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                    searchDebounceRef.current = setTimeout(() => {
                      fetchData(1)
                    }, 350)
                  }}
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
            <div className="flex flex-col gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
              {/* Session Filter Tabs — full-width row, visible in session mode only */}
              {isSessionMode && (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0 hidden sm:block">Session</span>
                  <div className="flex flex-1 gap-1.5 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-white/40 dark:border-white/10">
                    {staffSessions.map((sess: any) => (
                      <button
                        key={sess.id}
                        type="button"
                        onClick={() => setSessionFilter(sess.id)}
                        className={cn(
                          "flex-1 h-8 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5",
                          sessionFilter === sess.id
                            ? "bg-primary text-white shadow-md shadow-primary/30 scale-[1.02]"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60"
                        )}
                      >
                        {sess.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Second row: Role, Status, Geofence */}
            <div className={`grid grid-cols-2 ${isSessionMode ? "sm:grid-cols-3" : "sm:grid-cols-4"} gap-2.5`}>
              {/* Role */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="all">All Staff Roles</option>
                {dynamicRoleOptions.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
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

              {/* Geofence */}
              <select
                value={geoFilter}
                onChange={(e) => setGeoFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
              >
                <option value="all">GPS: All Statuses</option>
                <option value="verified">GPS: Verified School</option>
                <option value="unverified">GPS: Unverified / Outside</option>
              </select>
            </div>
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
              <div className="overflow-x-auto overflow-y-auto max-h-[540px]">
                <table className="w-full text-sm min-w-[950px]">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-white/40 dark:border-white/10 bg-slate-50/95 dark:bg-slate-950/95 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold backdrop-blur-md shadow-sm">
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
                      const roleBadge = getRoleBadge(rec.user?.role)
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
                              <span
                                className={cn("w-1.5 h-1.5 rounded-full", !roleBadge.isHex ? roleBadge.dotColor : "")}
                                style={roleBadge.isHex ? { backgroundColor: roleBadge.dotColor } : undefined}
                              />
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
                                  Outside School
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

                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalRecords > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/40 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min((currentPage - 1) * PAGE_LIMIT + 1, totalRecords)}</span> to <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * PAGE_LIMIT, totalRecords)}</span> of <span className="font-bold text-slate-800 dark:text-slate-200">{totalRecords}</span> records
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => fetchData(currentPage - 1)}
                    className="h-8 px-2.5 rounded-xl text-xs gap-1 border-white/40 dark:border-white/10"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Button>
                  <span className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Page {currentPage} of {Math.max(1, Math.ceil(totalRecords / PAGE_LIMIT))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= Math.ceil(totalRecords / PAGE_LIMIT) || loading}
                    onClick={() => fetchData(currentPage + 1)}
                    className="h-8 px-2.5 rounded-xl text-xs gap-1 border-white/40 dark:border-white/10"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: REPORTS & ANALYTICS VIEW ─── */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Report Date Controls */}
          <div className="rounded-[24px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
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
                  {dynamicRoleOptions.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="h-10 px-3.5 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
                  aria-label="Attendance State Filter"
                >
                  <option value="ALL">All States</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="ABSENT">Absent</option>
                  <option value="PERMISSION">Permission (Duty / Training)</option>
                  <option value="LEAVE">On Leave (Personal / Sick)</option>
                  <option value="LEAVE_PERMISSION">Leave & Permission (All Excused)</option>
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

            {/* Session Filter Tabs — visible in session mode */}
            {isSessionMode && (
              <div className="flex items-center gap-2 w-full pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0 hidden sm:block">Session</span>
                <div className="flex flex-1 gap-1.5 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-white/40 dark:border-white/10">
                  {staffSessions.map((sess: any) => (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => setSessionFilter(sess.id)}
                      className={cn(
                        "flex-1 h-8 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5",
                        sessionFilter === sess.id
                          ? "bg-primary text-white shadow-md shadow-primary/30 scale-[1.02]"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/60"
                      )}
                    >
                      {sess.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Check-Ins</span>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {reportData.totalRecords}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {reportStatusFilter !== "ALL" ? `State: ${STATUS_CONFIG[reportStatusFilter]?.label || reportStatusFilter}` : "Logged in selected period"}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Present (On-Time)</span>
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + (s.present || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">On-time attendances</p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Late Arrivals</span>
                  <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + (s.late || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Late arrivals logged</p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Absences</span>
                  <p className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + (s.absent || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Absences logged</p>
                </div>

                <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Permissions</span>
                  <p className="text-3xl font-black text-sky-600 dark:text-sky-400 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + (s.permission || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {reportData.staffSummary.reduce((acc: number, s: any) => acc + Math.max(0, (s.onLeave || 0) - (s.permission || 0)), 0)} approved leaves
                  </p>
                </div>
              </div>

              {/* Staff Aggregate Roster */}
              <div className="rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-xl overflow-hidden">
                <div className="p-5 border-b border-white/40 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Staff Member Performance Summary</h3>
                    <p className="text-xs text-slate-500">
                      Per-employee cumulative breakdown between {startDate} and {endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {reportStatusFilter !== "ALL" && (
                      <Badge variant="outline" className={cn("text-xs font-bold uppercase", STATUS_CONFIG[reportStatusFilter]?.color || "border-primary/30 text-primary")}>
                        State: {STATUS_CONFIG[reportStatusFilter]?.label || reportStatusFilter}
                      </Badge>
                    )}
                    {isSessionMode && (
                      <Badge variant="outline" className="text-xs font-bold uppercase border-primary/30 text-primary">
                        {staffSessions.find((s: any) => s.id === sessionFilter)?.name || sessionFilter} Session
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto max-h-[540px]">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-white/40 dark:border-white/10 bg-slate-50/95 dark:bg-slate-950/95 text-left text-[11px] uppercase tracking-wider text-slate-500 font-bold backdrop-blur-md shadow-sm">
                        <th className="px-6 py-3.5">Staff Member</th>
                        <th className="px-4 py-3.5">Role</th>
                        <th className="px-4 py-3.5 text-center">Days Logged</th>
                        <th className="px-4 py-3.5 text-center text-emerald-600">Present</th>
                        <th className="px-4 py-3.5 text-center text-amber-600">Late</th>
                        <th className="px-4 py-3.5 text-center text-rose-600">Absent</th>
                        <th className="px-4 py-3.5 text-center text-sky-600">Permission</th>
                        <th className="px-4 py-3.5 text-center text-purple-600">Leave</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/30 dark:divide-white/5">
                      {paginatedStaffSummary.map((item: any) => {
                        const permissionCount = item.permission || 0
                        const leaveCount = Math.max(0, (item.onLeave || 0) - permissionCount)
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
                            <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                              {getRoleBadge(item.user?.role).label}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold">{item.totalRecords}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-emerald-600">{item.present || 0}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-amber-600">{item.late || 0}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-rose-600">{item.absent || 0}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-sky-600">{permissionCount}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-purple-600">{leaveCount}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Report Pagination Controls */}
                {reportData.staffSummary && reportData.staffSummary.length > REPORT_PAGE_LIMIT && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/40 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      Showing <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min((reportPage - 1) * REPORT_PAGE_LIMIT + 1, reportData.staffSummary.length)}</span> to <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(reportPage * REPORT_PAGE_LIMIT, reportData.staffSummary.length)}</span> of <span className="font-bold text-slate-800 dark:text-slate-200">{reportData.staffSummary.length}</span> staff members
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reportPage <= 1}
                        onClick={() => setReportPage((p) => p - 1)}
                        className="h-8 px-2.5 rounded-xl text-xs gap-1 border-white/40 dark:border-white/10"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                      </Button>
                      <span className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                        Page {reportPage} of {Math.max(1, Math.ceil(reportData.staffSummary.length / REPORT_PAGE_LIMIT))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reportPage >= Math.ceil(reportData.staffSummary.length / REPORT_PAGE_LIMIT)}
                        onClick={() => setReportPage((p) => p + 1)}
                        className="h-8 px-2.5 rounded-xl text-xs gap-1 border-white/40 dark:border-white/10"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
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
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                      {getRoleBadge(detailRecord.user?.role).label}
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
                              ? formatEthiopianTime(detailRecord.checkInTime)
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
                              ? formatEthiopianTime(detailRecord.checkOutTime)
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
                      <MapPin className="w-4 h-4 text-emerald-600" /> School Geofence Check:
                    </span>
                    {detailRecord.geofenceVerified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
                        Inside Boundary {detailRecord.geofenceDistance ? `(${Math.round(detailRecord.geofenceDistance)}m)` : "✓"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[11px]">Outside School / None</Badge>
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
                        ? formatEthiopianFullDateTime(detailRecord.correctedAt)
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
                  onClick={() => {
                    setIsLeaveModalOpen(false)
                    setIsLeaveStaffDropdownOpen(false)
                    setLeaveStaffSearch("")
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLeave} className="space-y-4 overflow-y-auto flex-1 py-3 pr-1">
                {/* Staff Member Searchable Selector */}
                <div className="space-y-1.5 relative" ref={leaveStaffDropdownRef}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Staff Member *</label>
                    {selectedLeaveUser && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold truncate max-w-[200px]">
                        {getRoleBadge(selectedLeaveUser.role).label}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLeaveStaffDropdownOpen((prev) => !prev)}
                    className={cn(
                      "w-full px-3.5 h-11 rounded-xl border text-left flex items-center justify-between transition-all bg-white/70 dark:bg-slate-950/70",
                      isLeaveStaffDropdownOpen
                        ? "border-purple-500 ring-2 ring-purple-500/20"
                        : "border-white/40 dark:border-white/10 hover:border-slate-300 dark:hover:border-slate-700",
                      !selectedLeaveUser && "text-slate-400 dark:text-slate-500"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {selectedLeaveUser ? (
                        <>
                          <Avatar className="w-7 h-7 border border-primary/20 shrink-0">
                            <AvatarImage src={selectedLeaveUser.profile_photo || ""} />
                            <AvatarFallback className="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                              {selectedLeaveUser.full_name?.substring(0, 2).toUpperCase() || "ST"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {selectedLeaveUser.full_name}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-xs font-medium">Select a staff member...</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {selectedLeaveUser && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setLeaveForm({ ...leaveForm, userId: "" })
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Clear selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-slate-400 transition-transform duration-200",
                          isLeaveStaffDropdownOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {/* Dropdown panel */}
                  {isLeaveStaffDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                      {/* Search Header */}
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={leaveStaffSearch}
                            onChange={(e) => setLeaveStaffSearch(e.target.value)}
                            placeholder="Search by name, role, email..."
                            autoFocus
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                          />
                          {leaveStaffSearch && (
                            <button
                              type="button"
                              onClick={() => setLeaveStaffSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Staff Options List */}
                      <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                        {filteredLeaveStaff.length > 0 ? (
                          filteredLeaveStaff.map((u) => {
                            const isSelected = leaveForm.userId === u.id
                            const badge = getRoleBadge(u.role)
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setLeaveForm({ ...leaveForm, userId: u.id })
                                  setIsLeaveStaffDropdownOpen(false)
                                  setLeaveStaffSearch("")
                                }}
                                className={cn(
                                  "w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 text-xs transition-colors",
                                  isSelected
                                    ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar className="w-7 h-7 border border-primary/20 shrink-0">
                                    <AvatarImage src={u.profile_photo || ""} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                                      {u.full_name?.substring(0, 2).toUpperCase() || "ST"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate leading-tight font-semibold text-slate-800 dark:text-slate-200">
                                      {u.full_name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                      {badge.label}{u.email ? ` · ${u.email}` : ""}
                                    </p>
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                )}
                              </button>
                            )
                          })
                        ) : (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            {allUsers.length === 0 ? "No staff members available" : `No staff matching "${leaveStaffSearch}"`}
                          </div>
                        )}
                      </div>

                      {/* Footer showing count */}
                      <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                        <span>{filteredLeaveStaff.length} staff member{filteredLeaveStaff.length === 1 ? "" : "s"} found</span>
                        {leaveStaffSearch && (
                          <button
                            type="button"
                            onClick={() => setLeaveStaffSearch("")}
                            className="text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Duration Type: Single Day vs Date Range */}
                <div>
                  <div className="flex items-center justify-between pb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Duration Type
                    </label>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                      <button
                        type="button"
                        onClick={() =>
                          setLeaveForm((f) => ({
                            ...f,
                            isRange: false,
                            endDate: f.startDate,
                          }))
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-lg transition-all",
                          !leaveForm.isRange
                            ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                      >
                        Single Day
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLeaveForm((f) => ({
                            ...f,
                            isRange: true,
                          }))
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-lg transition-all",
                          leaveForm.isRange
                            ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                      >
                        Date Range
                      </button>
                    </div>
                  </div>

                  {!leaveForm.isRange ? (
                    <div>
                      <Input
                        type="date"
                        required
                        value={leaveForm.startDate}
                        onChange={(e) =>
                          setLeaveForm({
                            ...leaveForm,
                            startDate: e.target.value,
                            endDate: e.target.value,
                          })
                        }
                        className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-bold"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Start Date</span>
                          <Input
                            type="date"
                            required
                            value={leaveForm.startDate}
                            onChange={(e) =>
                              setLeaveForm({ ...leaveForm, startDate: e.target.value })
                            }
                            className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">End Date</span>
                          <Input
                            type="date"
                            required
                            min={leaveForm.startDate}
                            value={leaveForm.endDate}
                            onChange={(e) =>
                              setLeaveForm({ ...leaveForm, endDate: e.target.value })
                            }
                            className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-bold"
                          />
                        </div>
                      </div>
                      {leaveForm.startDate && leaveForm.endDate && (
                        <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                          {Math.max(
                            1,
                            Math.round(
                              (new Date(leaveForm.endDate).getTime() -
                                new Date(leaveForm.startDate).getTime()) /
                                (1000 * 60 * 60 * 24)
                            ) + 1
                          )}{" "}
                          calendar days will be marked as {leaveForm.status === "PERMISSION" ? "Permission" : "Leave"}
                        </p>
                      )}
                    </div>
                  )}
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

                {/* Session Selector — only shown in Session-Based mode */}
                {isSessionMode && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Session *</label>
                    <select
                      value={leaveForm.session}
                      onChange={(e) => setLeaveForm({ ...leaveForm, session: e.target.value })}
                      className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">All Sessions (Full Day)</option>
                      {staffSessions.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} Session</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {leaveForm.session === "all" ? "Leave applies to all sessions throughout the day." : "Leave applies to the selected session only."}
                    </p>
                  </div>
                )}
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
                  {isSavingLeave ? "Saving..." : leaveForm.isRange ? "Record Multi-Day Leave" : "Record Leave"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
