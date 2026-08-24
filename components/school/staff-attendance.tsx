"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  CalendarOff,
  LogOut,
  LogIn,
  Search,
  WifiOff,
  UserCheck,
  UserX,
  History,
  FileSpreadsheet,
  RotateCcw,
  Loader2,
} from "lucide-react"
import { db } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { useAuth } from "@/lib/context/auth-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { useCalendar } from "@/lib/context/calendar-context"
import { resolveLocationData, GeofenceLocationData } from "@/lib/utils/geofence"
import { notifications } from "@/lib/utils/notifications"
import { FaceVerificationCamera } from "@/components/school/face-verification-camera"
import { StaffFaceEnrollModal } from "@/components/school/staff-face-enroll"
import {
  queueOfflineStaffCheckIn,
  getOfflineStaffQueue,
  flushOfflineStaffQueue,
} from "@/lib/utils/staff-attendance-offline-store"
import {
  getStaffAttendanceDisplay,
  getCheckInButtonState,
  getCheckOutButtonState,
  addMinutesToHHMM,
} from "@/lib/utils/staff-attendance-status"
import { formatEthiopianTime } from "@/lib/utils/ethiopian-time"

type VerificationStep =
  | "idle"
  | "getting_location"
  | "verifying_geofence"
  | "face_verification"
  | "saving"
  | "success"
  | "error"

export function StaffAttendance() {
  const { formatDate } = useCalendar()
  const { settings } = useSchoolSettings()
  const { user: authUser, sessionReady } = useAuth()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Today's date in Africa/Addis_Ababa
  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  )

  // Working calendar status for the selected date
  const [calendarStatus, setCalendarStatus] = useState<{
    isWorkingDay: boolean
    isHoliday: boolean
    isWeekend: boolean
    dayOfWeek: string
    holidayName?: string
    holidayType?: string
    reason?: string
    displayReason?: string
    workingDaysList: string[]
  } | null>(null)

  // Session-based mode config
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
    } catch (_) {}
    return defaults
  }, [settings?.staffSessions, settings?.staff_sessions])

  const [selectedSession, setSelectedSession] = useState<string>("morning")

  // Current user's attendance status today
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [myHistory, setMyHistory] = useState<any[]>([])
  const [allStaffAttendance, setAllStaffAttendance] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Request ID to prevent out-of-order state updates from concurrent fetches
  const loadRequestIdRef = useRef(0)

  // Verification workflow states
  const [actionType, setActionType] = useState<"checkin" | "checkout">("checkin")
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("idle")
  const [stepMessage, setStepMessage] = useState("")
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(null)
  const [capturedLocation, setCapturedLocation] = useState<GeofenceLocationData | null>(null)
  const isSubmittingAttendanceRef = useRef(false)

  // Face verification attempt tracking (server-authoritative)
  const [faceAttemptStatus, setFaceAttemptStatus] = useState<{
    attemptCount: number
    maxAttempts: number
    remainingAttempts: number
    isLocked: boolean
    lockMessage?: string | null
  } | null>(null)

  // Admin view filters & modals
  const [activeTab, setActiveTab] = useState<"self" | "admin_overview">("self")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [isFaceEnrollModalOpen, setIsFaceEnrollModalOpen] = useState(false)

  // Offline queue state
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isSyncingOffline, setIsSyncingOffline] = useState(false)

  // Sync todayRecord whenever myHistory, selectedDate, or selectedSession changes
  useEffect(() => {
    if (!myHistory.length) {
      setTodayRecord(null)
      return
    }
    const todayRecs = myHistory.filter((r) => r.date?.split("T")[0] === selectedDate)
    if (isSessionMode) {
      const sessRec = todayRecs.find((r) => r.session?.toLowerCase() === selectedSession.toLowerCase())
      setTodayRecord(sessRec || null)
    } else {
      const dailyRec = todayRecs.find((r) => !r.session || r.session === "daily") || todayRecs[0]
      setTodayRecord(dailyRec || null)
    }
  }, [myHistory, selectedDate, selectedSession, isSessionMode])

  // Fetch face attempt status whenever date/session changes (guards against server-side lock)
  useEffect(() => {
    if (!sessionReady) return
    const session = isSessionMode ? selectedSession : "daily"
    const attendanceMode = isSessionMode ? "session_based" : "daily"
    db.getStaffFaceAttemptStatus({ date: selectedDate, session, mode: attendanceMode })
      .then((status) => setFaceAttemptStatus(status))
      .catch(() => setFaceAttemptStatus(null))
  }, [selectedDate, selectedSession, isSessionMode, sessionReady])

  // 1. Sync currentUser from auth context whenever sessionReady or authUser changes.
  //    This resolves the mount-time race where authService.getCurrentUser() returns null
  //    during authentication restoration (critical for Capacitor Android resume).
  useEffect(() => {
    if (!sessionReady) return
    const user = authUser || authService.getCurrentUser()
    setCurrentUser(user)
    const adminRole = user?.role === "admin" || user?.role === "school_admin"
    setIsAdmin(adminRole)
    if (adminRole) {
      setActiveTab("admin_overview")
    }
  }, [authUser, sessionReady])

  const checkOfflineQueue = useCallback(async () => {
    try {
      const queue = await getOfflineStaffQueue()
      setPendingOfflineCount(queue.length)
    } catch {
      /* ignore */
    }
  }, [])

  const loadInitialData = useCallback(async (opts?: { silent?: boolean }) => {
    const currentReqId = ++loadRequestIdRef.current
    if (!opts?.silent) setIsLoading(true)
    const activeUser = authUser || authService.getCurrentUser()
    try {
      // 0. Load working calendar status for selected date
      try {
        const calStatus = await db.isDateWorkingDay(selectedDate)
        setCalendarStatus(calStatus)
      } catch (calErr) {
        console.warn("Could not check working day status:", calErr)
      }

      // 1. Load my history — strictly filtered to the configured attendance mode
      if (activeUser?.id) {
        const history = await db.getMyStaffAttendance({
          mode: isSessionMode ? "session_based" : "daily",
        })
        setMyHistory(history)

        // Fetch enrolled face descriptor strictly for activeUser.id
        const descriptorData = await db.getStaffFaceDescriptor(activeUser.id)
        if (descriptorData?.descriptor && Array.isArray(descriptorData.descriptor) && descriptorData.descriptor.length === 128) {
          setEnrolledDescriptor(descriptorData.descriptor)
        } else {
          setEnrolledDescriptor(null)
        }
      }

      // 2. If Admin, load all staff attendance for selected date
      if (activeUser?.role === "admin" || activeUser?.role === "school_admin") {
        const allAtt = await db.getStaffAttendance({
          date: selectedDate,
          mode: isSessionMode ? "session_based" : "daily",
        })
        setAllStaffAttendance(allAtt)
      }
    } catch (err: any) {
      console.error("[StaffAttendance] Failed to load attendance data:", err)
    } finally {
      if (currentReqId === loadRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [authUser, selectedDate, isSessionMode])

  // Reset cached enrolled template whenever the authenticated user ID changes
  useEffect(() => {
    setEnrolledDescriptor(null)
  }, [currentUser?.id, authUser?.id])

  // 2. Load data when auth is ready or selectedDate changes.
  //    Also subscribe to resume/visibility/online events.
  useEffect(() => {
    if (!sessionReady) return

    loadInitialData()
    checkOfflineQueue()

    const handleDataChanged = () => {
      loadInitialData({ silent: true })
      checkOfflineQueue()
    }

    const handleOnline = async () => {
      console.log("[StaffAttendance] Network online, flushing staff offline queue...")
      try {
        const res = await flushOfflineStaffQueue()
        if (res.synced > 0) {
          notifications.success("Sync Complete", `Synchronized ${res.synced} offline staff check-ins.`)
        }
        await checkOfflineQueue()
        loadInitialData({ silent: true })
      } catch (err) {
        console.error("Auto offline sync failed:", err)
      }
    }

    let lastResumeTime = 0
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now()
        if (now - lastResumeTime > 3000) {
          lastResumeTime = now
          loadInitialData({ silent: true })
          checkOfflineQueue()
        }
      }
    }

    window.addEventListener("staffAttendanceDataChanged", handleDataChanged)
    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("staffAttendanceDataChanged", handleDataChanged)
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadInitialData, checkOfflineQueue, sessionReady])

  // 2. Start Check-In / Check-Out Workflow
  const startAttendanceWorkflow = async (type: "checkin" | "checkout") => {
    if (calendarStatus && calendarStatus.isWorkingDay === false) {
      const reason = calendarStatus.displayReason || (calendarStatus.isHoliday ? `Holiday — ${calendarStatus.holidayName}` : "Non-working day")
      notifications.error("Attendance Unavailable", `Attendance cannot be recorded today: ${reason}`)
      return
    }

    if (type === "checkout") {
      const currentSess = isSessionMode
        ? staffSessions.find((s: any) => s.id.toLowerCase() === selectedSession.toLowerCase()) || staffSessions[0]
        : undefined
      const coState = getCheckOutButtonState(todayRecord, settings, currentSess, undefined, calendarStatus)
      if (!coState.canCheckOut) {
        notifications.error("Check-Out Unavailable", coState.helperText || coState.buttonText)
        return
      }
    }

    setActionType(type)
    setIsVerificationModalOpen(true)
    setVerificationStep("getting_location")
    setStepMessage("Verifying school location...")
    setCapturedLocation(null)
    isSubmittingAttendanceRef.current = false

    try {
      // Step 1: Geofence Location Verification
      const location = await resolveLocationData(
        {
          restrictLocation: settings?.restrictLocation,
          allowOutsideAttendance: settings?.allowOutsideAttendance,
          schoolLatitude: settings?.schoolLatitude,
          schoolLongitude: settings?.schoolLongitude,
          allowedRadiusMeters: settings?.allowedRadiusMeters,
          staffGeoRequired: (settings?.staffGeoRequired ?? settings?.staff_geo_required) !== false,
        },
        { isStaff: true, suppressSuccessToast: true }
      )
      setCapturedLocation(location)

      // Step 2: Face Verification Check
      const isFaceRequired = (settings?.staffFaceRequired ?? settings?.staff_face_required) !== false
      if (isFaceRequired) {
        const targetUserId = currentUser?.id || authUser?.id
        if (!targetUserId) {
          setVerificationStep("error")
          setStepMessage("Authentication required to verify face attendance.")
          return
        }

        // Always query fresh 1:1 template strictly for the authenticated staff account to prevent stale cross-user leakage
        const desc = await db.getStaffFaceDescriptor(targetUserId)
        if (!desc?.descriptor || !Array.isArray(desc.descriptor) || desc.descriptor.length !== 128) {
          setEnrolledDescriptor(null)
          setVerificationStep("error")
          setStepMessage("Face biometric profile not registered for your account. Please enroll your face first.")
          return
        }

        setEnrolledDescriptor(desc.descriptor)
        setVerificationStep("face_verification")
        setStepMessage("Geofence verified! Initializing automatic biometric scanner...")
      } else {
        // Face not required -> proceed directly to commit
        await commitAttendance(type, location, { faceVerified: true, confidence: 1.0 })
      }
    } catch (geoErr: any) {
      console.error("Geofence verification failed:", geoErr)
      setVerificationStep("error")
      setStepMessage(geoErr.message || "Location verification failed. You must be on school grounds.")
    }
  }

  // Step 3: Face Verified Callback -> Commit Attendance Record
  const handleFaceVerified = async (faceResult: { descriptor: number[]; confidence?: number }) => {
    if (isSubmittingAttendanceRef.current) return
    isSubmittingAttendanceRef.current = true

    setVerificationStep("saving")
    setStepMessage("Recording verified attendance...")

    await commitAttendance(actionType, capturedLocation, {
      faceVerified: true,
      confidence: faceResult.confidence || 1.0,
      descriptor: faceResult.descriptor,
    })
  }

  const commitAttendance = async (
    type: "checkin" | "checkout",
    location: GeofenceLocationData | null,
    face: { faceVerified: boolean; confidence?: number; descriptor?: number[] }
  ) => {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine

    if (!isOnline) {
      // Offline fallback: queue locally in IndexedDB
      try {
        await queueOfflineStaffCheckIn({
          schoolId: currentUser?.schoolId || "single-school",
          userId: currentUser?.id || "",
          type,
          date: selectedDate,
          latitude: location?.latitude,
          longitude: location?.longitude,
          locationVerified: location?.locationVerified,
          locationDistance: location?.locationDistance,
          faceVerified: face.faceVerified,
          faceConfidence: face.confidence,
        })

        setVerificationStep("success")
        setStepMessage(
          type === "checkin"
            ? "✓ Check-In Verified\nAttendance recorded offline (auto-syncs on reconnect)"
            : "✓ Check-Out Verified\nAttendance recorded offline (auto-syncs on reconnect)"
        )
        await checkOfflineQueue()
        setTimeout(() => {
          setIsVerificationModalOpen(false)
          setVerificationStep("idle")
          isSubmittingAttendanceRef.current = false
        }, 1800)
        return
      } catch (offlineErr: any) {
        setVerificationStep("error")
        setStepMessage("Failed to save offline attendance.")
        isSubmittingAttendanceRef.current = false
        return
      }
    }

    // Online submission
    try {
      const sessPayload = isSessionMode ? selectedSession : "daily"
      let returnedRecord: any = null

      if (type === "checkin") {
        returnedRecord = await db.staffCheckIn(
          {
            date: selectedDate,
            session: sessPayload,
            faceVerified: face.faceVerified,
            faceConfidence: face.confidence,
            faceDescriptor: face.descriptor,
          },
          location
        )
      } else {
        returnedRecord = await db.staffCheckOut(
          {
            date: selectedDate,
            session: sessPayload,
            faceVerified: face.faceVerified,
            faceConfidence: face.confidence,
            faceDescriptor: face.descriptor,
          },
          location
        )
      }

      // ── Immediate authoritative state update ──────────────────────────────
      // Apply the server-returned record directly so UI shows the correct
      // status (On Time, Late, Checked Out) without waiting for a refetch.
      if (returnedRecord) {
        setMyHistory((prev) => {
          const existing = prev.findIndex((r) => r.id === returnedRecord.id)
          if (existing !== -1) {
            const updated = [...prev]
            updated[existing] = returnedRecord
            return updated
          }
          return [...prev, returnedRecord]
        })
        setTodayRecord(returnedRecord)
      }

      setVerificationStep("success")
      setStepMessage(
        type === "checkin"
          ? "✓ Check-In Verified\nAttendance recorded successfully"
          : "✓ Check-Out Verified\nAttendance recorded successfully"
      )

      // Background silent refetch confirms state with backend
      loadInitialData({ silent: true })

      setTimeout(() => {
        setIsVerificationModalOpen(false)
        setVerificationStep("idle")
        isSubmittingAttendanceRef.current = false
      }, 1500)
    } catch (err: any) {
      console.error("Attendance submission error:", err)
      setVerificationStep("error")
      const rawMsg = err.message || ""
      let friendlyMsg = "Unable to complete attendance right now. Please try again."
      if (rawMsg.toLowerCase().includes("already") || rawMsg.toLowerCase().includes("recorded")) {
        friendlyMsg = "Attendance already recorded for this session."
      } else if (rawMsg.toLowerCase().includes("location") || rawMsg.toLowerCase().includes("geofence")) {
        friendlyMsg = "Location verification failed. You must be on school grounds."
      }
      setStepMessage(friendlyMsg)
      isSubmittingAttendanceRef.current = false
    }
  }

  const manualSyncOffline = async () => {
    setIsSyncingOffline(true)
    try {
      const res = await flushOfflineStaffQueue()
      if (res.synced > 0) {
        notifications.success("Sync Complete", `Successfully synced ${res.synced} staff records to server.`)
      } else if (res.errors.length > 0) {
        notifications.error("Sync Error", res.errors[0])
      }
      await checkOfflineQueue()
      await loadInitialData()
    } catch (err: any) {
      notifications.error("Sync Failed", err.message || "Failed to synchronize offline attendance.")
    } finally {
      setIsSyncingOffline(false)
    }
  }

  // Filtered staff attendance for Admin overview
  const filteredAllStaff = useMemo(() => {
    return allStaffAttendance.filter((record) => {
      const name = record.user?.full_name?.toLowerCase() || ""
      const role = record.user?.role?.toLowerCase() || ""
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || role.includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "ALL" || record.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [allStaffAttendance, searchTerm, statusFilter])

  // ─── Clean Spinner Loading State ───
  if (isLoading && myHistory.length === 0 && allStaffAttendance.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* ── Ambient Background Glow Spheres ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/15 dark:bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl shadow-indigo-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25">
              <UserCheck className="w-6 h-6" />
            </span>
            Staff Attendance & Biometrics
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">
            Biometric face verification with integrated school geofencing and dual session tracking.
          </p>
        </div>

        {/* Offline Queue Badge & Controls */}
        <div className="relative z-10 flex items-center gap-2">
          {pendingOfflineCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={manualSyncOffline}
              disabled={isSyncingOffline}
              className="gap-2 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-xs hover:bg-amber-500/20"
            >
              <WifiOff className="w-4 h-4" />
              <span>{pendingOfflineCount} Pending Sync</span>
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? "animate-spin" : ""}`} />
            </Button>
          )}

          {isAdmin && (
            <Button
              onClick={() => setIsFaceEnrollModalOpen(true)}
              className="gap-2 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-primary/25 active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              Manage Face Biometrics
            </Button>
          )}
        </div>
      </div>

      {/* Holiday / Non-Working Day Alert Banner */}
      {calendarStatus && !calendarStatus.isWorkingDay && (
        <div
          className={`p-4 rounded-[22px] border backdrop-blur-xl flex items-center gap-3.5 shadow-lg ${
            calendarStatus.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200 shadow-purple-500/5"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-amber-500/5"
          }`}
        >
          <div
            className={`p-2.5 rounded-xl ${
              calendarStatus.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            {calendarStatus.isHoliday ? <CalendarOff className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {calendarStatus.displayReason || (calendarStatus.isHoliday
                  ? `School Holiday — ${calendarStatus.holidayName}`
                  : calendarStatus.reason || "Scheduled Non-Working Day")}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md ${
                  calendarStatus.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300 bg-purple-500/10"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10"
                }`}
              >
                {calendarStatus.isHoliday ? "Holiday" : "Non-Working Day"}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Admin / Staff */}
      {isAdmin && (
        <div className="flex border-b border-white/20 dark:border-white/10 gap-4">
          <button
            onClick={() => setActiveTab("admin_overview")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "admin_overview"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            School Staff Roster ({allStaffAttendance.length})
          </button>
          <button
            onClick={() => setActiveTab("self")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "self"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            My Check-In / History
          </button>
        </div>
      )}

      {/* ─── SELF-SERVICE CHECK-IN / CHECK-OUT CARD ─── */}
      {(activeTab === "self" || !isAdmin) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Action Card */}
          <Card className="md:col-span-1 border-white/40 dark:border-white/10 shadow-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[28px]">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {isSessionMode ? "Session Attendance" : "Today's Check-In"}
              </CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Addis_Ababa" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Session Selector — visible when in Session-Based mode */}
              {isSessionMode && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Session</span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/40">
                    {staffSessions.map((sess: any) => {
                      const isSelected = selectedSession.toLowerCase() === sess.id.toLowerCase()
                      const sessRec = myHistory.find(
                        (r) => r.date?.split("T")[0] === selectedDate && r.session?.toLowerCase() === sess.id.toLowerCase()
                      )
                      const sessDisplay = getStaffAttendanceDisplay(sessRec, settings, sess, calendarStatus)
                      return (
                        <button
                          key={sess.id}
                          type="button"
                          onClick={() => setSelectedSession(sess.id)}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>{sess.name}</span>
                          <span className="text-[10px] opacity-80 font-mono font-normal">
                            {formatEthiopianTime(sess.startTime)} - {formatEthiopianTime(sess.endTime)}
                          </span>
                          <span className={`text-[9px] font-bold uppercase mt-0.5 px-1.5 py-0.5 rounded ${
                            sessDisplay.checkIn.status === 'NOT_STARTED'
                              ? 'bg-black/20 text-white/80'
                              : sessDisplay.checkIn.status === 'PENDING'
                              ? 'bg-sky-500/30 text-sky-100 border border-sky-400/40'
                              : sessDisplay.checkIn.status === 'ON_TIME' || sessDisplay.checkIn.status === 'PRESENT'
                              ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                              : sessDisplay.checkIn.status === 'LATE'
                              ? 'bg-amber-500/30 text-amber-100 border border-amber-400/40'
                              : sessDisplay.checkIn.status === 'ABSENT'
                              ? 'bg-rose-500/30 text-rose-100 border border-rose-400/40'
                              : 'bg-black/20 text-white'
                          }`}>
                            {sessDisplay.checkIn.titleLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Working Hours Info Box */}
              <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                {isSessionMode ? (
                  (() => {
                    const currentSess = staffSessions.find((s: any) => s.id.toLowerCase() === selectedSession.toLowerCase()) || staffSessions[0]
                    const cutoff = currentSess?.absenceCutoffTime || (currentSess ? addMinutesToHHMM(currentSess.startTime, currentSess.absenceCutoffMinutes ?? 90) : "09:30")
                    return (
                      <>
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-primary" /> {currentSess?.name}: {formatEthiopianTime(currentSess?.startTime)} - {formatEthiopianTime(currentSess?.endTime)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Grace: +{currentSess?.lateGraceMinutes ?? 15}m
                          </span>
                          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            Cutoff: {formatEthiopianTime(cutoff)}
                          </span>
                        </div>
                      </>
                    )
                  })()
                ) : (
                  (() => {
                    const startTime = settings?.staffWorkStartTime || "08:00"
                    const cutoff = settings?.staffAbsenceCutoffTime || addMinutesToHHMM(startTime, settings?.staffAbsenceCutoffMinutes ?? 120)
                    return (
                      <>
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-primary" /> Shift: {formatEthiopianTime(startTime)} - {formatEthiopianTime(settings?.staffWorkEndTime || "17:00")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Grace: +{settings?.staffLateGraceMinutes ?? 15}m
                          </span>
                          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            Cutoff: {formatEthiopianTime(cutoff)}
                          </span>
                        </div>
                      </>
                    )
                  })()
                )}
              </div>

              {/* ─── TODAY'S ATTENDANCE: Check-In & Check-Out Dual View ─── */}
              {(() => {
                const currentSess = isSessionMode
                  ? staffSessions.find((s: any) => s.id.toLowerCase() === selectedSession.toLowerCase()) || staffSessions[0]
                  : undefined
                const display = getStaffAttendanceDisplay(todayRecord, settings, currentSess, calendarStatus)

                return (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider font-bold text-foreground">
                        {isSessionMode
                          ? `${currentSess?.name || selectedSession} Attendance`
                          : "Today's Attendance"}
                      </span>
                      {todayRecord?.faceVerified && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Face ✓
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Check-In Block */}
                      <div className="p-2.5 rounded-lg bg-card/90 border border-border/60 flex flex-col justify-between gap-1.5 shadow-2xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                            Check-In
                          </span>
                          <span className="text-sm font-mono font-bold text-foreground block">
                            {display.checkIn.timeStr}
                          </span>
                        </div>
                        <div>
                          <Badge
                            className={`text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider ${display.checkIn.badgeColor}`}
                          >
                            {display.checkIn.titleLabel}
                          </Badge>
                        </div>
                      </div>

                      {/* Check-Out Block */}
                      <div className="p-2.5 rounded-lg bg-card/90 border border-border/60 flex flex-col justify-between gap-1.5 shadow-2xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                            Check-Out
                          </span>
                          <span className="text-sm font-mono font-bold text-foreground block">
                            {display.checkOut.timeStr}
                          </span>
                        </div>
                        <div>
                          <Badge
                            className={`text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider ${display.checkOut.badgeColor}`}
                          >
                            {display.checkOut.titleLabel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Action Buttons */}
              {(() => {
                const currentSess = isSessionMode
                  ? staffSessions.find((s: any) => s.id.toLowerCase() === selectedSession.toLowerCase()) || staffSessions[0]
                  : undefined
                const btnState = getCheckInButtonState(todayRecord, settings, currentSess, undefined, calendarStatus)
                const checkOutBtnState = getCheckOutButtonState(todayRecord, settings, currentSess, undefined, calendarStatus)
                const isFaceLocked = faceAttemptStatus?.isLocked === true

                return (
                  <div className="space-y-2 pt-2">
                    {/* Face Verification Lock Warning */}
                    {isFaceLocked && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                        <span>
                          {faceAttemptStatus?.lockMessage ||
                            (isSessionMode
                              ? "Face verification locked for this session. Try again in the next session."
                              : "Face verification locked for today. Please try again tomorrow.")}
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={() => startAttendanceWorkflow("checkin")}
                      disabled={!btnState.canCheckIn || verificationStep !== "idle" || isFaceLocked}
                      className={`w-full h-12 text-base font-bold gap-2 shadow-md transition-all ${
                        btnState.canCheckIn && !isFaceLocked
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                      }`}
                    >
                      <LogIn className="w-5 h-5" />
                      {todayRecord?.checkInTime
                        ? `Checked In ✓`
                        : btnState.buttonText}
                    </Button>

                    {/* Contextual helper text explaining why check-in is disabled */}
                    {!btnState.canCheckIn && !todayRecord?.checkInTime && btnState.helperText && !isFaceLocked && (
                      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] font-medium ${
                        btnState.isNonWorkingDay
                          ? "bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300"
                          : btnState.isBeforeEarliest
                          ? "bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300"
                          : "bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300"
                      }`}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{btnState.helperText}</span>
                      </div>
                    )}

                    <Button
                      onClick={() => startAttendanceWorkflow("checkout")}
                      disabled={!checkOutBtnState.canCheckOut || verificationStep !== "idle" || isFaceLocked}
                      variant="outline"
                      className={`w-full h-12 text-base font-bold gap-2 transition-all ${
                        checkOutBtnState.canCheckOut && !isFaceLocked
                          ? "border-primary/40 hover:bg-primary/5 text-foreground"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-60 border-border"
                      }`}
                    >
                      <LogOut className="w-5 h-5" />
                      {todayRecord?.checkOutTime
                        ? "Checked Out ✓"
                        : checkOutBtnState.buttonText}
                    </Button>

                    {/* Contextual helper text explaining why check-out is disabled */}
                    {!checkOutBtnState.canCheckOut && !todayRecord?.checkOutTime && !checkOutBtnState.isBeforeCheckIn && checkOutBtnState.helperText && !isFaceLocked && (
                      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] font-medium ${
                        checkOutBtnState.isNonWorkingDay
                          ? "bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300"
                          : "bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300"
                      }`}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{checkOutBtnState.helperText}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Security indicators */}
              <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Geofencing Active
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Face Auth Enforced
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Personal History Table */}
          <Card className="md:col-span-2 border-white/40 dark:border-white/10 shadow-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[28px] overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/20 dark:border-white/10">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> My Recent Attendance
              </CardTitle>
              <CardDescription>Your check-in and check-out records for the past 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card List View (< sm screens) */}
              <div className="sm:hidden divide-y divide-border/50 max-h-[380px] overflow-y-auto">
                {myHistory.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No attendance history found.
                  </div>
                ) : (
                  myHistory.map((rec) => {
                    const sessCfg = isSessionMode
                      ? staffSessions.find(
                          (s: any) => s.id.toLowerCase() === (rec.session || "morning").toLowerCase()
                        )
                      : undefined
                    const display = getStaffAttendanceDisplay(rec, settings, sessCfg)

                    return (
                      <div key={rec.id} className="p-3.5 space-y-2 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">
                            {formatDate(rec.date?.split("T")[0])}
                          </span>
                          {isSessionMode && (
                            <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-1.5">
                              {rec.session || "daily"}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Check-In */}
                          <div className="p-2 rounded-lg bg-muted/40 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground font-medium">Check-In</span>
                              <span className="font-semibold text-foreground">{display.checkIn.timeStr}</span>
                            </div>
                            <Badge
                              className={`text-[9px] font-extrabold uppercase py-0 px-1.5 ${display.checkIn.badgeColor}`}
                            >
                              {display.checkIn.titleLabel}
                            </Badge>
                          </div>

                          {/* Check-Out */}
                          <div className="p-2 rounded-lg bg-muted/40 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground font-medium">Check-Out</span>
                              <span className="font-semibold text-foreground">{display.checkOut.timeStr}</span>
                            </div>
                            <Badge
                              className={`text-[9px] font-extrabold uppercase py-0 px-1.5 ${display.checkOut.badgeColor}`}
                            >
                              {display.checkOut.titleLabel}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                          {rec.faceVerified && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="w-3.5 h-3.5" /> Face Verified
                            </span>
                          )}
                          {rec.geofenceVerified && (
                            <span className="flex items-center gap-1 text-primary">
                              <MapPin className="w-3.5 h-3.5" /> GPS Verified
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Desktop Table View (>= sm screens) */}
              <div className="hidden sm:block max-h-[380px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 backdrop-blur-sm">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {isSessionMode && <TableHead>Session</TableHead>}
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-In Status</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Check-Out Status</TableHead>
                      <TableHead>Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isSessionMode ? 7 : 6} className="text-center py-8 text-muted-foreground">
                          No attendance history found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      myHistory.map((rec) => {
                        const sessCfg = isSessionMode
                          ? staffSessions.find(
                              (s: any) => s.id.toLowerCase() === (rec.session || "morning").toLowerCase()
                            )
                          : undefined
                        const display = getStaffAttendanceDisplay(rec, settings, sessCfg)

                        return (
                          <TableRow key={rec.id}>
                            <TableCell className="font-medium text-xs">
                              {formatDate(rec.date?.split("T")[0])}
                            </TableCell>
                            {isSessionMode && (
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                  {rec.session || "daily"}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-xs font-mono font-medium">
                              {display.checkIn.timeStr}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs font-bold ${display.checkIn.badgeColor}`}
                              >
                                {display.checkIn.titleLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono font-medium">
                              {display.checkOut.timeStr}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs font-bold ${display.checkOut.badgeColor}`}
                              >
                                {display.checkOut.titleLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {rec.faceVerified && <span title="Face Verified"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /></span>}
                                {rec.geofenceVerified && <span title="Geofence Verified"><MapPin className="w-3.5 h-3.5 text-primary" /></span>}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── ADMIN OVERVIEW TABLE (ALL STAFF) ─── */}
      {isAdmin && activeTab === "admin_overview" && (
        <Card className="border-border/60 shadow-lg bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" /> Staff Attendance Roster
                </CardTitle>
                <CardDescription>
                  Daily overview for {formatDate(selectedDate)}
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="ABSENT">Absent</option>
                  <option value="EARLY_DEPARTURE">Early Departure</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadInitialData()}
                  disabled={isLoading}
                  className="h-9 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile Card View for Roster (< md screens) */}
            <div className="md:hidden divide-y divide-border/50 max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Loading staff records...
                </div>
              ) : filteredAllStaff.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  No staff attendance records for this date.
                </div>
              ) : (
                filteredAllStaff.map((rec) => {
                  const sessCfg = isSessionMode
                    ? staffSessions.find(
                        (s: any) => s.id.toLowerCase() === (rec.session || "morning").toLowerCase()
                      )
                    : undefined
                  const display = getStaffAttendanceDisplay(rec, settings, sessCfg)

                  return (
                    <div key={rec.id} className="p-3.5 space-y-2.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="w-8 h-8 border shrink-0">
                            <AvatarImage src={rec.user?.profile_photo || ""} />
                            <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                              {rec.user?.full_name?.substring(0, 2).toUpperCase() || "ST"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">{rec.user?.full_name || "Unknown Staff"}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{rec.user?.role?.replace("_", " ") || "Staff"}</p>
                          </div>
                        </div>
                        {isSessionMode && (
                          <Badge variant="outline" className="text-[10px] font-bold uppercase shrink-0">
                            {rec.session || "daily"}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-muted/40 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-medium">Check-In</span>
                            <span className="font-semibold text-foreground">{display.checkIn.timeStr}</span>
                          </div>
                          <Badge
                            className={`text-[9px] font-extrabold uppercase py-0 px-1.5 ${display.checkIn.badgeColor}`}
                          >
                            {display.checkIn.titleLabel}
                          </Badge>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/40 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-medium">Check-Out</span>
                            <span className="font-semibold text-foreground">{display.checkOut.timeStr}</span>
                          </div>
                          <Badge
                            className={`text-[9px] font-extrabold uppercase py-0 px-1.5 ${display.checkOut.badgeColor}`}
                          >
                            {display.checkOut.titleLabel}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                        {rec.faceVerified ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" /> Face ✓
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">No Face ID</span>
                        )}
                        {rec.geofenceVerified && (
                          <span className="flex items-center gap-1 text-primary">
                            <MapPin className="w-3.5 h-3.5" /> GPS Verified
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table View (>= md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    {isSessionMode && <TableHead>Session</TableHead>}
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-In Status</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Check-Out Status</TableHead>
                    <TableHead>Biometric / GPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={isSessionMode ? 8 : 7} className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading staff records...
                      </TableCell>
                    </TableRow>
                  ) : filteredAllStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSessionMode ? 8 : 7} className="text-center py-12 text-muted-foreground">
                        No staff attendance records for this date.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAllStaff.map((rec) => {
                      const sessCfg = isSessionMode
                        ? staffSessions.find(
                            (s: any) => s.id.toLowerCase() === (rec.session || "morning").toLowerCase()
                          )
                        : undefined
                      const display = getStaffAttendanceDisplay(rec, settings, sessCfg)

                      return (
                        <TableRow key={rec.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8 border">
                                <AvatarImage src={rec.user?.profile_photo || ""} />
                                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                  {rec.user?.full_name?.substring(0, 2).toUpperCase() || "ST"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-sm leading-none">{rec.user?.full_name || "Unknown Staff"}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{rec.user?.email || ""}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {rec.user?.role?.replace("_", " ") || "Staff"}
                            </Badge>
                          </TableCell>
                          {isSessionMode && (
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                {rec.session || "daily"}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-xs font-mono font-medium">
                            {display.checkIn.timeStr}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs font-bold ${display.checkIn.badgeColor}`}
                            >
                              {display.checkIn.titleLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono font-medium">
                            {display.checkOut.timeStr}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs font-bold ${display.checkOut.badgeColor}`}
                            >
                              {display.checkOut.titleLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs">
                              {rec.faceVerified ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Face ✓
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">No Face</span>
                              )}
                              {rec.geofenceVerified && (
                                <span className="flex items-center gap-1 text-primary">
                                  <MapPin className="w-3.5 h-3.5" /> GPS ({rec.geofenceDistance ? `${Math.round(rec.geofenceDistance)}m` : "✓"})
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── COMBINED VERIFICATION MODAL ─── */}
      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent className={verificationStep === "face_verification" ? "max-w-sm p-3" : "max-w-md p-6"}>
          {/* Show header only when NOT in camera step */}
          {verificationStep !== "face_verification" && (
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {actionType === "checkin" ? <LogIn className="w-5 h-5 text-emerald-500" /> : <LogOut className="w-5 h-5 text-primary" />}
                {actionType === "checkin" ? "Staff Check-In Verification" : "Staff Check-Out Verification"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Complete the security checks below to authenticate your attendance.
              </DialogDescription>
            </DialogHeader>
          )}

          <div className={verificationStep === "face_verification" ? "space-y-0" : "py-3 space-y-4"}>
            {/* Step Indicators — hide during active camera scan */}
            {verificationStep !== "face_verification" && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    capturedLocation?.locationVerified
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : verificationStep === "getting_location"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 animate-pulse font-semibold"
                      : "bg-muted/40 text-muted-foreground border-border/40"
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>1. Geofence</span>
                  {capturedLocation?.locationVerified && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
                </div>

                <div
                  className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    verificationStep === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : verificationStep === "error"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold"
                      : "bg-muted/40 text-muted-foreground border-border/40"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>2. Face Auth</span>
                  {verificationStep === "success" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
                </div>
              </div>
            )}

            {/* Step 1: Location in progress */}
            {verificationStep === "getting_location" && (
              <div className="text-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">{stepMessage}</p>
              </div>
            )}

            {/* Step 2: Biometric Scanner — no wrapper padding, fills dialog */}
            {verificationStep === "face_verification" && (
              <FaceVerificationCamera
                mode="verify"
                enrolledDescriptor={enrolledDescriptor}
                attemptCount={faceAttemptStatus?.attemptCount ?? 0}
                maxAttempts={faceAttemptStatus?.maxAttempts ?? 5}
                isLocked={faceAttemptStatus?.isLocked ?? false}
                lockMessage={faceAttemptStatus?.lockMessage}
                attendanceMode={isSessionMode ? "session_based" : "daily"}
                sessionName={isSessionMode ? selectedSession : undefined}
                onVerified={handleFaceVerified}
                onAttemptFailed={async ({ reason }) => {
                  try {
                    const session = isSessionMode ? selectedSession : "daily"
                    const mode = isSessionMode ? "session_based" : "daily"
                    const result = await db.recordStaffFaceFailedAttempt({
                      date: selectedDate,
                      session,
                      mode,
                      reason,
                    })
                    setFaceAttemptStatus(result)
                    return result
                  } catch (err) {
                    console.warn("[StaffAttendance] Failed to record attempt:", err)
                  }
                }}
                onFailed={(err) => {
                  // Only escalate to the parent error state for NON-RETRIABLE failures
                  // (e.g. camera hardware unavailable, no enrolled descriptor).
                  // For face mismatches the FaceVerificationCamera already shows its own
                  // "Face does not match" overlay with a correct camera-only retry button —
                  // transitioning to parent "error" here would unmount the camera and
                  // force a geofence re-run on the next attempt.
                  const isFaceMismatch =
                    !err ||
                    err.toLowerCase().includes("does not match") ||
                    err.toLowerCase().includes("mismatch")
                  if (!isFaceMismatch) {
                    // Camera is broken / no enrolled face — let parent handle recovery
                    setVerificationStep("error")
                    setStepMessage(err || "Face verification failed. Please try again.")
                  }
                  // For mismatches: camera's own overlay handles retry — do nothing here
                }}
                onCancel={() => setIsVerificationModalOpen(false)}
              />
            )}

            {/* Step 3: Saving */}
            {verificationStep === "saving" && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto" />
                <p className="text-sm font-medium text-foreground">{stepMessage}</p>
              </div>
            )}

            {/* Step 4: Success */}
            {verificationStep === "success" && (
              <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-200">
                <div className="relative mx-auto w-16 h-16">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_28px_rgba(16,185,129,0.4)]">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/50 animate-ping" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {actionType === "checkin" ? "✓ Check-In Verified" : "✓ Check-Out Verified"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Attendance recorded successfully
                  </p>
                </div>
              </div>
            )}

            {/* Error state — mismatch card matching reference design */}
            {verificationStep === "error" && (
              <div className="flex flex-col items-center gap-0 animate-in zoom-in-95 duration-300">
                {/* Camera-frame card */}
                <div
                  className="relative w-full rounded-2xl overflow-hidden border border-rose-600/70"
                  style={{
                    background: "radial-gradient(ellipse at 50% 100%, rgba(120,0,0,0.55) 0%, rgba(20,0,0,0.97) 60%, #0d0102 100%)",
                    boxShadow: "0 0 0 1.5px rgba(220,38,38,0.5), 0 0 40px rgba(200,0,0,0.4), inset 0 0 60px rgba(150,0,0,0.15)",
                  }}
                >
                  {/* Corner brackets — top-left */}
                  <span className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-rose-500 rounded-tl" />
                  {/* Corner brackets — top-right */}
                  <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-rose-500 rounded-tr" />
                  {/* Corner brackets — bottom-left */}
                  <span className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-rose-500 rounded-bl" />
                  {/* Corner brackets — bottom-right */}
                  <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-rose-500 rounded-br" />

                  {/* MISMATCH badge — top-left, speech-bubble style */}
                  <div className="absolute top-4 left-4 z-10">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-lg border border-rose-500/80 text-rose-400 text-[11px] font-black tracking-widest uppercase"
                      style={{ background: "rgba(20,0,0,0.85)", letterSpacing: "0.12em" }}
                    >
                      MISMATCH
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col items-center justify-center py-14 px-6 gap-5 text-center">
                    {/* Double-ring glowing X icon */}
                    <div className="relative flex items-center justify-center">
                      {/* Outer glow ring */}
                      <div
                        className="w-24 h-24 rounded-full border border-rose-600/50 absolute"
                        style={{ boxShadow: "0 0 32px rgba(220,38,38,0.5), inset 0 0 20px rgba(180,0,0,0.2)" }}
                      />
                      {/* Inner solid ring with X */}
                      <div
                        className="w-16 h-16 rounded-full border-2 border-rose-500 flex items-center justify-center text-rose-500 relative z-10"
                        style={{ boxShadow: "0 0 20px rgba(239,68,68,0.7)" }}
                      >
                        <XCircle className="w-9 h-9 stroke-[1.5]" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-black text-white tracking-wide">Face does not match.</h3>
                      <p className="text-sm text-rose-300/90 font-semibold">Please try again.</p>
                    </div>

                    <Button
                      onClick={() => {
                        // If geofence already succeeded in this session, preserve the
                        // capturedLocation and jump straight to the face-auth step.
                        // This is the fix for the "Face Mismatch → Geofence → Face Scanner"
                        // regression — we NEVER re-run geofence for a face-auth failure.
                        if (capturedLocation) {
                          isSubmittingAttendanceRef.current = false
                          setVerificationStep("face_verification")
                          setStepMessage("Reinitializing face scanner...")
                        } else {
                          // capturedLocation is null → geofence was what failed (or the
                          // session was cancelled and restarted). Run the full flow.
                          startAttendanceWorkflow(actionType)
                        }
                      }}
                      className="h-12 px-10 rounded-2xl font-bold text-base gap-2.5 border-0 active:scale-95 transition-transform"
                      style={{
                        background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
                        boxShadow: "0 4px 20px rgba(244,63,94,0.5)",
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── FACE ENROLLMENT MODAL (Self & Admin) ─── */}
      {currentUser?.id && (
        <StaffFaceEnrollModal
          open={isFaceEnrollModalOpen}
          onOpenChange={setIsFaceEnrollModalOpen}
          preselectedUserId={currentUser.id}
          preselectedUserName={currentUser.name || "Staff Member"}
          onEnrolled={() => {
            loadInitialData()
            notifications.success("Biometrics Active", "Your face has been registered for automatic attendance.")
          }}
        />
      )}
    </div>
  )
}
