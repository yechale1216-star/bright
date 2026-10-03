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
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { db } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { useAuth } from "@/lib/context/auth-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { useCalendar } from "@/lib/context/calendar-context"
import { resolveLocationData, GeofenceLocationData, GeofenceValidationError } from "@/lib/utils/geofence"
import { notifications } from "@/lib/utils/notifications"
import { FaceVerificationCamera } from "@/components/school/face-verification-camera"
import { DualDatePicker } from "@/components/ui/dual-date-picker"
import dynamic from "next/dynamic"

const GeofenceAttendanceMap = dynamic(
  () => import("@/components/school/geofence-map-picker").then((m) => m.GeofenceAttendanceMap),
  { ssr: false }
)
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
  | "geofence_error"
  | "face_not_enrolled"
  | "face_verification"
  | "saving"
  | "success"
  | "error"

// Module-level cache: survives component unmount/remount during client-side navigation.
// Prevents the full loading spinner when navigating between tabs in the staff portal.
interface StaffAttendanceDataCache {
  hasLoaded: boolean
  calendarStatus: any
  myHistory: any[]
  allStaffAttendance: any[]
  enrolledDescriptor: number[] | null
}

let _staffAttendanceCache: StaffAttendanceDataCache = {
  hasLoaded: false,
  calendarStatus: null,
  myHistory: [],
  allStaffAttendance: [],
  enrolledDescriptor: null,
}

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
  } | null>(_staffAttendanceCache.calendarStatus)

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

  const [selectedSession, setSelectedSession] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search)
        const sess = params.get("session")
        if (sess && (sess.toLowerCase() === "morning" || sess.toLowerCase() === "afternoon")) {
          return sess.toLowerCase()
        }
      } catch (_) {}
    }
    return "morning"
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search)
        const sess = params.get("session")
        if (sess && (sess.toLowerCase() === "morning" || sess.toLowerCase() === "afternoon")) {
          setSelectedSession(sess.toLowerCase())
        }
      } catch (_) {}
    }
  }, [])

  // Current user's attendance status today
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [myHistory, setMyHistory] = useState<any[]>(_staffAttendanceCache.myHistory)
  const [allStaffAttendance, setAllStaffAttendance] = useState<any[]>(_staffAttendanceCache.allStaffAttendance)
  const [isLoading, setIsLoading] = useState(!_staffAttendanceCache.hasLoaded)

  // Request ID to prevent out-of-order state updates from concurrent fetches
  const loadRequestIdRef = useRef(0)

  // Verification workflow states
  const [actionType, setActionType] = useState<"checkin" | "checkout">("checkin")
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("idle")
  const [stepMessage, setStepMessage] = useState("")
  const [geofenceError, setGeofenceError] = useState<{
    title?: string
    message: string
    distance?: number | null
    allowedRadius?: number | null
    code?: string
    userLatitude?: number | null
    userLongitude?: number | null
  } | null>(null)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(_staffAttendanceCache.enrolledDescriptor)
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

  // Admin overview server-side pagination
  const [adminPage, setAdminPage] = useState(1)
  const [adminTotal, setAdminTotal] = useState(0)
  const ADMIN_PAGE_LIMIT = 50
  const [adminTableLoading, setAdminTableLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Date filter for personal recent attendance history
  const [historyFilterDate, setHistoryFilterDate] = useState<string>("")
  const filteredHistory = useMemo(() => {
    if (!historyFilterDate) return myHistory
    return myHistory.filter((rec) => {
      const recDate = rec.date?.split("T")[0]
      return recDate === historyFilterDate
    })
  }, [myHistory, historyFilterDate])

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
    if (!opts?.silent && !_staffAttendanceCache.hasLoaded) setIsLoading(true)
    const activeUser = authUser || authService.getCurrentUser()
    try {
      // 0. Load working calendar status for selected date
      try {
        const calStatus = await db.isDateWorkingDay(selectedDate)
        setCalendarStatus(calStatus)
        _staffAttendanceCache.calendarStatus = calStatus
      } catch (calErr) {
        console.warn("Could not check working day status:", calErr)
      }

      // 1. Load my history — strictly filtered to the configured attendance mode
      if (activeUser?.id) {
        const history = await db.getMyStaffAttendance({
          mode: isSessionMode ? "session_based" : "daily",
        })
        setMyHistory(history)
        _staffAttendanceCache.myHistory = history

        // Fetch enrolled face descriptor strictly for activeUser.id
        const descriptorData = await db.getStaffFaceDescriptor(activeUser.id)
        if (descriptorData?.descriptor && Array.isArray(descriptorData.descriptor) && descriptorData.descriptor.length === 128) {
          setEnrolledDescriptor(descriptorData.descriptor)
          _staffAttendanceCache.enrolledDescriptor = descriptorData.descriptor
        } else {
          setEnrolledDescriptor(null)
          _staffAttendanceCache.enrolledDescriptor = null
        }
      }

    // 2. If Admin, load all staff attendance for selected date (page 1 reset)
      if (activeUser?.role === "admin" || activeUser?.role === "school_admin") {
        setAdminTableLoading(true)
        setAdminError(null)
        try {
          const { data, total } = await db.getStaffAttendance({
            date: selectedDate,
            mode: isSessionMode ? "session_based" : "daily",
            page: 1,
            limit: ADMIN_PAGE_LIMIT,
          })
          setAllStaffAttendance(data)
          setAdminTotal(total)
          setAdminPage(1)
          _staffAttendanceCache.allStaffAttendance = data
        } catch (err: any) {
          setAdminError(err?.message || "Failed to load staff attendance.")
        } finally {
          setAdminTableLoading(false)
        }
      }
    } catch (err: any) {
      console.error("[StaffAttendance] Failed to load attendance data:", err)
    } finally {
      if (currentReqId === loadRequestIdRef.current) {
        _staffAttendanceCache.hasLoaded = true
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

    loadInitialData({ silent: _staffAttendanceCache.hasLoaded })
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
    setGeofenceError(null)
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
      setGeofenceError(null)

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
          setVerificationStep("face_not_enrolled")
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
      setCapturedLocation(null)
      setVerificationStep("geofence_error")

      const isOutside =
        geoErr?.code === "OUTSIDE_BOUNDARY" ||
        geoErr?.message?.toLowerCase().includes("outside") ||
        geoErr?.message?.toLowerCase().includes("boundary")
      const isPerm =
        geoErr?.code === "PERMISSION_DENIED" ||
        geoErr?.message?.toLowerCase().includes("permission")
      const isGpsOff =
        geoErr?.code === "GPS_DISABLED" ||
        geoErr?.message?.toLowerCase().includes("gps")

      setGeofenceError({
        title: isOutside
          ? "Outside School Boundary"
          : isPerm || isGpsOff
          ? "GPS Location Required"
          : "Location Verification Failed",
        message: isOutside
          ? "You are currently outside the designated school boundary. Attendance can only be recorded within school grounds."
          : isPerm || isGpsOff
          ? "Location access is required for attendance. Please enable GPS and grant location permission."
          : geoErr?.message || "Location access is required for attendance. Please enable GPS and grant location permission.",
        distance: geoErr?.distance ?? null,
        allowedRadius: geoErr?.allowedRadius ?? (Number(settings?.allowedRadiusMeters) || 200),
        code: geoErr?.code || (isOutside ? "OUTSIDE_BOUNDARY" : undefined),
        userLatitude: geoErr?.userLatitude,
        userLongitude: geoErr?.userLongitude,
      })
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
      }

      setTimeout(() => {
        setIsVerificationModalOpen(false)
        setVerificationStep("idle")
        isSubmittingAttendanceRef.current = false
      }, 1500)
    } catch (err: any) {
      console.error("Attendance submission error:", err)
      const rawMsg = err?.message || ""
      const isGeoError =
        rawMsg.toLowerCase().includes("boundary") ||
        rawMsg.toLowerCase().includes("location") ||
        rawMsg.toLowerCase().includes("geofence")

      if (isGeoError) {
        setVerificationStep("geofence_error")
        setGeofenceError({
          title: "Outside School Boundary",
          message: rawMsg || "Attendance submission blocked: You are outside the school boundary.",
          code: "OUTSIDE_BOUNDARY",
          allowedRadius: Number(settings?.allowedRadiusMeters) || 200,
        })
      } else {
        setVerificationStep("error")
        let friendlyMsg = rawMsg || "Unable to complete attendance right now. Please try again."
        if (rawMsg.toLowerCase().includes("already") || rawMsg.toLowerCase().includes("recorded")) {
          friendlyMsg = "Attendance already recorded for this session."
        }
        setStepMessage(friendlyMsg)
      }
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

  // ─── fetchAdminPage: loads paginated admin table ───
  const fetchAdminPage = useCallback(async (opts: {
    page?: number;
    search?: string;
    status?: string;
    date?: string;
  } = {}) => {
    const activeUser = authUser || authService.getCurrentUser()
    if (!activeUser || (activeUser.role !== "admin" && activeUser.role !== "school_admin")) return
    setAdminTableLoading(true)
    setAdminError(null)
    const targetPage = opts.page ?? adminPage
    try {
      const { data, total } = await db.getStaffAttendance({
        date: opts.date ?? selectedDate,
        mode: isSessionMode ? "session_based" : "daily",
        search: opts.search ?? (searchTerm || undefined),
        status: (opts.status ?? statusFilter) === "ALL" ? undefined : (opts.status ?? statusFilter),
        page: targetPage,
        limit: ADMIN_PAGE_LIMIT,
      })
      setAllStaffAttendance(data)
      setAdminTotal(total)
      setAdminPage(targetPage)
      _staffAttendanceCache.allStaffAttendance = data
    } catch (err: any) {
      setAdminError(err?.message || "Failed to load staff attendance.")
    } finally {
      setAdminTableLoading(false)
    }
  }, [authUser, selectedDate, isSessionMode, searchTerm, statusFilter, adminPage])

  // Filtered staff for admin overview (client-side only since search is server-side)
  const filteredAllStaff = allStaffAttendance


  // ─── Modern Spinner Loading State ───
  if (isLoading && !_staffAttendanceCache.hasLoaded && myHistory.length === 0 && allStaffAttendance.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[55vh] animate-in fade-in duration-300">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  return (
    <div className="relative space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0 p-0 sm:p-2 md:p-6 animate-in fade-in duration-300">
      {/* ── Ambient Background Glow Spheres ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/15 dark:bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-4 sm:p-6 md:p-7 shadow-xl sm:shadow-2xl shadow-indigo-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 sm:gap-2.5">
            <span className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25 shrink-0">
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <span>Staff Attendance & Biometrics</span>
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

        </div>
      </div>

      {/* Holiday / Non-Working Day Alert Banner */}
      {calendarStatus && !calendarStatus.isWorkingDay && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-[22px] border backdrop-blur-xl flex items-start sm:items-center gap-3 sm:gap-3.5 shadow-md w-full min-w-0 ${
            calendarStatus.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200 shadow-purple-500/5"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-amber-500/5"
          }`}
        >
          <div
            className={`p-2 sm:p-2.5 rounded-xl shrink-0 mt-0.5 sm:mt-0 ${
              calendarStatus.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            {calendarStatus.isHoliday ? <CalendarOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-xs sm:text-sm">
                {calendarStatus.displayReason || (calendarStatus.isHoliday
                  ? `School Holiday — ${calendarStatus.holidayName}`
                  : calendarStatus.reason || "Scheduled Non-Working Day")}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] sm:text-[10px] uppercase font-black px-1.5 sm:px-2 py-0.5 rounded-md shrink-0 ${
                  calendarStatus.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300 bg-purple-500/10"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10"
                }`}
              >
                {calendarStatus.isHoliday ? "Holiday" : "Non-Working Day"}
              </Badge>
            </div>
            <p className={`text-[11px] sm:text-xs mt-1 font-medium leading-snug ${
              calendarStatus.isHoliday
                ? "text-purple-700/80 dark:text-purple-300/80"
                : "text-amber-700/80 dark:text-amber-300/80"
            }`}>
              Attendance is unavailable today.
            </p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start w-full min-w-0">
          {/* Main Action Card */}
          <Card className="md:col-span-1 border-white/40 dark:border-white/10 shadow-xl sm:shadow-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl sm:rounded-[28px] w-full min-w-0">
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {isSessionMode ? "Session Attendance" : "Today's Check-In"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Addis_Ababa" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-3.5 sm:space-y-4">
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
                          {calendarStatus?.isWorkingDay !== false && (
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
                          )}
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
                            className={`text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider ${
                              calendarStatus && !calendarStatus.isWorkingDay
                                ? "bg-muted text-muted-foreground border-border"
                                : display.checkIn.badgeColor
                            }`}
                          >
                            {calendarStatus && !calendarStatus.isWorkingDay
                              ? "Unavailable"
                              : display.checkIn.titleLabel}
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
                            className={`text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider ${
                              calendarStatus && !calendarStatus.isWorkingDay
                                ? "bg-muted text-muted-foreground border-border"
                                : display.checkOut.badgeColor
                            }`}
                          >
                            {calendarStatus && !calendarStatus.isWorkingDay
                              ? "Unavailable"
                              : display.checkOut.titleLabel}
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
                        : btnState.isNonWorkingDay
                        ? "Unavailable"
                        : btnState.buttonText}
                    </Button>

                    {/* Contextual helper text — suppressed for non-working days since the global banner already explains the reason */}
                    {!btnState.canCheckIn && !btnState.isNonWorkingDay && !todayRecord?.checkInTime && btnState.helperText && !isFaceLocked && (
                      <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] font-medium ${
                        btnState.isBeforeEarliest
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
                        : checkOutBtnState.isNonWorkingDay
                        ? "Unavailable"
                        : checkOutBtnState.buttonText}
                    </Button>

                    {/* Contextual helper text — suppressed for non-working days since the global banner already explains the reason */}
                    {!checkOutBtnState.canCheckOut && !checkOutBtnState.isNonWorkingDay && !todayRecord?.checkOutTime && !checkOutBtnState.isBeforeCheckIn && checkOutBtnState.helperText && !isFaceLocked && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
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
          <Card className="md:col-span-2 border-white/40 dark:border-white/10 shadow-xl sm:shadow-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl sm:rounded-[28px] overflow-hidden w-full min-w-0">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-white/20 dark:border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> My Recent Attendance
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-0.5">
                    {historyFilterDate
                      ? `Showing records for ${formatDate(historyFilterDate)} (${filteredHistory.length} found)`
                      : "Your check-in and check-out records for the past 30 days."}
                  </CardDescription>
                </div>

                {/* Date Filter Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto w-full sm:w-auto">
                  <div className="w-full sm:w-44 min-w-[130px]">
                    <DualDatePicker
                      value={historyFilterDate}
                      onChange={(val) => setHistoryFilterDate(val)}
                      placeholder="Select date..."
                      className="h-8 sm:h-9 text-xs rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  {historyFilterDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHistoryFilterDate("")}
                      className="h-8 sm:h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold rounded-xl shrink-0"
                      title="Show all records"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      All
                    </Button>
                  )}
                  <Button
                    variant={historyFilterDate === selectedDate ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHistoryFilterDate(historyFilterDate === selectedDate ? "" : selectedDate)}
                    className="h-8 sm:h-9 px-2.5 text-xs font-semibold rounded-xl shrink-0"
                  >
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Card List View (< sm screens) */}
              <div className="sm:hidden divide-y divide-border/50 max-h-[580px] overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      {historyFilterDate
                        ? `No records found for ${formatDate(historyFilterDate)}.`
                        : "No attendance history found."}
                    </p>
                    {historyFilterDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryFilterDate("")}
                        className="text-xs font-semibold rounded-xl mt-1"
                      >
                        Show All Days
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredHistory.map((rec) => {
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
              <div className="hidden sm:block max-h-[580px] overflow-y-auto">
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
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isSessionMode ? 7 : 6} className="text-center py-10 text-muted-foreground">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">
                              {historyFilterDate
                                ? `No records found for ${formatDate(historyFilterDate)}.`
                                : "No attendance history found."}
                            </p>
                            {historyFilterDate && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryFilterDate("")}
                                className="text-xs font-semibold rounded-xl"
                              >
                                Show All Days
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((rec) => {
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
                  {adminTotal > 0 && (
                    <span className="ml-2 font-semibold text-foreground/70">
                      ({adminTotal} total record{adminTotal !== 1 ? "s" : ""})
                    </span>
                  )}
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    value={searchTerm}
                    onChange={(e) => {
                      const val = e.target.value
                      setSearchTerm(val)
                      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                      searchDebounceRef.current = setTimeout(() => {
                        fetchAdminPage({ page: 1, search: val })
                      }, 350)
                    }}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    fetchAdminPage({ page: 1, status: e.target.value })
                  }}
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
                  onClick={() => fetchAdminPage({ page: adminPage })}
                  disabled={adminTableLoading}
                  className="h-9 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${adminTableLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Error State */}
            {adminError && (
              <div className="mx-4 mb-4 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-sm flex items-center gap-2.5">
                <span className="font-bold shrink-0">⚠</span>
                <span>{adminError}</span>
                <Button variant="ghost" size="sm" onClick={() => fetchAdminPage({ page: adminPage })} className="ml-auto text-xs h-7">
                  Retry
                </Button>
              </div>
            )}

            {/* Mobile Card View for Roster (< md screens) */}
            <div className="md:hidden divide-y divide-border/50 max-h-[520px] overflow-y-auto">
              {adminTableLoading ? (
                // Skeleton cards for mobile
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3.5 space-y-2.5 animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-muted" />
                      <div className="space-y-1 flex-1">
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-2.5 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-12 bg-muted rounded-lg" />
                      <div className="h-12 bg-muted rounded-lg" />
                    </div>
                  </div>
                ))
              ) : filteredAllStaff.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {searchTerm || statusFilter !== "ALL" ? "No staff match your filters." : "No staff attendance records for this date."}
                  </p>
                  {(searchTerm || statusFilter !== "ALL") && (
                    <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); fetchAdminPage({ page: 1, search: "", status: "ALL" }) }} className="text-xs rounded-xl">
                      Clear Filters
                    </Button>
                  )}
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

            {/* Desktop Table View (>= md screens) with sticky header */}
            <div className="hidden md:block">
              <div className="overflow-x-auto overflow-y-auto max-h-[540px] relative">
                <Table>
                  <TableHeader className="bg-muted/60 backdrop-blur-sm sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="min-w-[180px]">Staff Member</TableHead>
                      <TableHead className="min-w-[100px]">Role</TableHead>
                      {isSessionMode && <TableHead className="min-w-[90px]">Session</TableHead>}
                      <TableHead className="min-w-[90px]">Check-In</TableHead>
                      <TableHead className="min-w-[120px]">Check-In Status</TableHead>
                      <TableHead className="min-w-[90px]">Check-Out</TableHead>
                      <TableHead className="min-w-[120px]">Check-Out Status</TableHead>
                      <TableHead className="min-w-[130px]">Biometric / GPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminTableLoading ? (
                      // Skeleton rows
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i} className="animate-pulse">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                              <div className="space-y-1.5">
                                <div className="h-3 bg-muted rounded w-28" />
                                <div className="h-2.5 bg-muted rounded w-20" />
                              </div>
                            </div>
                          </TableCell>
                          {Array.from({ length: isSessionMode ? 7 : 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-3 bg-muted rounded w-16" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredAllStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isSessionMode ? 8 : 7} className="text-center py-16 text-muted-foreground">
                          <div className="space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-full bg-muted/60 flex items-center justify-center">
                              <UserCheck className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              {searchTerm || statusFilter !== "ALL" ? "No staff match your filters." : "No staff attendance records for this date."}
                            </p>
                            {(searchTerm || statusFilter !== "ALL") && (
                              <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); fetchAdminPage({ page: 1, search: "", status: "ALL" }) }} className="text-xs rounded-xl">
                                Clear Filters
                              </Button>
                            )}
                          </div>
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
                          <TableRow key={rec.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8 border shrink-0">
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
                              <Badge className={`text-xs font-bold ${display.checkIn.badgeColor}`}>
                                {display.checkIn.titleLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono font-medium">
                              {display.checkOut.timeStr}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs font-bold ${display.checkOut.badgeColor}`}>
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

              {/* Pagination Controls */}
              {adminTotal > ADMIN_PAGE_LIMIT && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Showing {((adminPage - 1) * ADMIN_PAGE_LIMIT) + 1}–{Math.min(adminPage * ADMIN_PAGE_LIMIT, adminTotal)} of {adminTotal} records
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAdminPage({ page: adminPage - 1 })}
                      disabled={adminPage <= 1 || adminTableLoading}
                      className="h-8 w-8 p-0 rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, Math.ceil(adminTotal / ADMIN_PAGE_LIMIT)) }, (_, i) => {
                      const totalPages = Math.ceil(adminTotal / ADMIN_PAGE_LIMIT)
                      let page = i + 1
                      if (totalPages > 5) {
                        const start = Math.max(1, Math.min(adminPage - 2, totalPages - 4))
                        page = start + i
                      }
                      return (
                        <Button
                          key={page}
                          variant={page === adminPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => fetchAdminPage({ page })}
                          disabled={adminTableLoading}
                          className="h-8 w-8 p-0 rounded-lg text-xs font-bold"
                        >
                          {page}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAdminPage({ page: adminPage + 1 })}
                      disabled={adminPage >= Math.ceil(adminTotal / ADMIN_PAGE_LIMIT) || adminTableLoading}
                      className="h-8 w-8 p-0 rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
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
                {/* 1. Geofence Step Indicator */}
                <div
                  className={`p-2.5 rounded-lg border flex items-center gap-2 transition-colors ${
                    capturedLocation?.locationVerified
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : verificationStep === "getting_location"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 animate-pulse font-semibold"
                      : verificationStep === "geofence_error"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold"
                      : "bg-muted/40 text-muted-foreground border-border/40"
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>1. Geofence</span>
                  {capturedLocation?.locationVerified && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
                  {verificationStep === "geofence_error" && <XCircle className="w-3.5 h-3.5 ml-auto text-rose-500" />}
                </div>

                {/* 2. Face Auth Step Indicator */}
                <div
                  className={`p-2.5 rounded-lg border flex items-center gap-2 transition-colors ${
                    verificationStep === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : verificationStep === "face_not_enrolled"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold"
                      : verificationStep === "error" && capturedLocation?.locationVerified
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold"
                      : "bg-muted/40 text-muted-foreground border-border/40"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>2. Face Auth</span>
                  {verificationStep === "success" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />}
                  {verificationStep === "face_not_enrolled" && <AlertCircle className="w-3.5 h-3.5 ml-auto text-amber-500" />}
                  {verificationStep === "error" && capturedLocation?.locationVerified && (
                    <XCircle className="w-3.5 h-3.5 ml-auto text-rose-500" />
                  )}
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

            {/* Step 1 Error: Outside School Boundary / Geofence Blocked */}
            {verificationStep === "geofence_error" && (
              <div className="flex flex-col items-center gap-0 animate-in zoom-in-95 duration-300">
                <div
                  className="relative w-full rounded-2xl overflow-hidden border border-rose-600/70 p-6 sm:p-7"
                  style={{
                    background: "radial-gradient(ellipse at 50% 100%, rgba(120,15,20,0.6) 0%, rgba(20,5,5,0.98) 65%, #0d0102 100%)",
                    boxShadow: "0 0 0 1.5px rgba(220,38,38,0.4), 0 0 35px rgba(200,0,0,0.3), inset 0 0 50px rgba(150,0,0,0.12)",
                  }}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-rose-500/80 text-rose-400 text-[11px] font-black tracking-widest uppercase"
                      style={{ background: "rgba(20,0,0,0.85)", letterSpacing: "0.12em" }}
                    >
                      <MapPin className="w-3 h-3 text-rose-400" />
                      {geofenceError?.code === "OUTSIDE_BOUNDARY" ? "OUTSIDE BOUNDARY" : "GEOFENCE BLOCKED"}
                    </span>
                    {geofenceError?.allowedRadius && (
                      <span className="text-[11px] font-mono text-rose-200/70 bg-black/50 px-2.5 py-0.5 rounded-full border border-white/10">
                        Allowed: {geofenceError.allowedRadius}m
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    {/* Glowing MapPin icon */}
                    <div className="relative flex items-center justify-center my-1">
                      <div
                        className="w-20 h-20 rounded-full border border-rose-600/50 absolute animate-pulse"
                        style={{ boxShadow: "0 0 32px rgba(220,38,38,0.5), inset 0 0 20px rgba(180,0,0,0.2)" }}
                      />
                      <div
                        className="w-14 h-14 rounded-full border-2 border-rose-500 flex items-center justify-center text-rose-500 relative z-10 bg-rose-950/40"
                        style={{ boxShadow: "0 0 20px rgba(239,68,68,0.6)" }}
                      >
                        <MapPin className="w-7 h-7 stroke-[1.75]" />
                      </div>
                    </div>

                    <div className="space-y-1.5 max-w-sm">
                      <h3 className="text-lg font-black text-white tracking-wide">
                        {geofenceError?.title || "Outside School Boundary"}
                      </h3>
                      <p className="text-xs sm:text-sm text-rose-200/90 font-medium leading-relaxed">
                        {geofenceError?.message || "Location access is required for attendance. Please enable GPS and grant location permission."}
                      </p>
                      {geofenceError?.distance != null && (
                        <div className="mt-2.5 p-2 rounded-xl bg-black/60 border border-rose-500/30 text-xs font-mono text-rose-300">
                          Recorded Distance: <span className="font-bold text-white">{geofenceError.distance.toLocaleString()}m</span> away (Allowed: {geofenceError.allowedRadius ?? 200}m)
                        </div>
                      )}
                    </div>

                    {/* Live Geofence Mini Map (if school coords are available) */}
                    {settings?.schoolLatitude != null && settings?.schoolLongitude != null && (
                      <div className="w-full pt-1">
                        <GeofenceAttendanceMap
                          schoolLatitude={Number(settings.schoolLatitude)}
                          schoolLongitude={Number(settings.schoolLongitude)}
                          allowedRadiusMeters={Number(geofenceError?.allowedRadius) || Number(settings.allowedRadiusMeters) || 200}
                          userLatitude={geofenceError?.userLatitude}
                          userLongitude={geofenceError?.userLongitude}
                          distanceMeters={geofenceError?.distance}
                          isInside={false}
                        />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-3">
                      <Button
                        onClick={() => startAttendanceWorkflow(actionType)}
                        className="w-full sm:flex-1 h-11 rounded-xl font-bold text-sm gap-2 border-0 active:scale-95 transition-transform"
                        style={{
                          background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
                          boxShadow: "0 4px 16px rgba(244,63,94,0.4)",
                        }}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry Location Check
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsVerificationModalOpen(false)}
                        className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold bg-neutral-900/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Error: Face Biometric Profile Not Enrolled */}
            {verificationStep === "face_not_enrolled" && (
              <div className="text-center py-6 px-4 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="relative mx-auto w-16 h-16">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.3)]">
                    <Camera className="w-8 h-8 text-amber-500" />
                  </div>
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h3 className="text-base font-bold text-foreground">Face Biometric Profile Missing</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your face biometric profile has not been registered. Biometric enrollment must be performed by a school administrator. Please contact your school admin to register your face.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsVerificationModalOpen(false)}
                    className="h-10 px-6 rounded-xl text-xs font-semibold"
                  >
                    Close
                  </Button>
                </div>
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
                    // Camera is broken / hardware failure — let parent handle recovery
                    setVerificationStep("error")
                    setStepMessage(err || "Face verification camera error. Please try again.")
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

            {/* General Submission / Hardware Error state */}
            {verificationStep === "error" && (
              <div className="text-center py-6 px-4 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="relative mx-auto w-16 h-16">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 border-2 border-rose-500 flex items-center justify-center shadow-[0_0_24px_rgba(244,63,94,0.3)]">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h3 className="text-base font-bold text-foreground">Attendance Verification Notice</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {stepMessage || "Unable to complete attendance right now. Please try again."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    onClick={() => {
                      if (capturedLocation?.locationVerified) {
                        isSubmittingAttendanceRef.current = false
                        setVerificationStep("face_verification")
                        setStepMessage("Reinitializing face scanner...")
                      } else {
                        startAttendanceWorkflow(actionType)
                      }
                    }}
                    className="h-10 px-5 rounded-xl font-semibold text-xs gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsVerificationModalOpen(false)}
                    className="h-10 px-4 rounded-xl text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  )
}
