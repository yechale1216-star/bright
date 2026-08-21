"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Clock,
  UserCheck,
  Calendar,
  CalendarOff,
  LogIn,
  LogOut,
  Bell,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  ChevronRight,
  RefreshCw,
  Sparkles,
  WifiOff,
  User,
  CheckCircle2,
  Building,
  TrendingUp,
  Activity,
  Flame,
  ArrowRight,
  Sun,
  Moon,
  Sunset,
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { useCalendar } from "@/lib/context/calendar-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { db } from "@/lib/db/database"
import { resolveLocationData, GeofenceLocationData } from "@/lib/utils/geofence"
import { notifications } from "@/lib/utils/notifications"
import { FaceVerificationCamera } from "@/components/school/face-verification-camera"
import { StaffFaceEnrollModal } from "@/components/school/staff-face-enroll"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  queueOfflineStaffCheckIn,
  getOfflineStaffQueue,
  flushOfflineStaffQueue,
} from "@/lib/utils/staff-attendance-offline-store"
import { getStaffAttendanceDisplay } from "@/lib/utils/staff-attendance-status"
import { formatEthiopianTime } from "@/lib/utils/ethiopian-time"

export function StaffDashboard() {
  const { user } = useAuth()
  const { formatDate } = useCalendar()
  const { settings } = useSchoolSettings()

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })

  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [calendarStatus, setCalendarStatus] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [enrolledDescriptor, setEnrolledDescriptor] = useState<number[] | null>(null)
  const [isFaceEnrollModalOpen, setIsFaceEnrollModalOpen] = useState(false)

  // Verification dialog state
  const [actionType, setActionType] = useState<"checkin" | "checkout">("checkin")
  const [verificationStep, setVerificationStep] = useState<
    "idle" | "getting_location" | "face_verification" | "saving" | "success" | "error"
  >("idle")
  const [stepMessage, setStepMessage] = useState("")
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [capturedLocation, setCapturedLocation] = useState<GeofenceLocationData | null>(null)

  // Offline queue
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isSyncingOffline, setIsSyncingOffline] = useState(false)

  // Live active work duration tracker
  const [workingDuration, setWorkingDuration] = useState<string>("")

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

  const [selectedSession, setSelectedSession] = useState<string>("morning")
  const [allAttendance, setAllAttendance] = useState<any[]>([])

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return { text: "Good morning", icon: Sun, color: "text-amber-500" }
    if (hour < 17) return { text: "Good afternoon", icon: Sunset, color: "text-orange-500" }
    return { text: "Good evening", icon: Moon, color: "text-indigo-400" }
  }, [])

  // Monthly statistics computation
  const monthlyStats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const thisMonthRecords = allAttendance.filter((r) => {
      if (!r.date) return false
      const d = new Date(r.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    const presentCount = thisMonthRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
    const onTimeCount = thisMonthRecords.filter((r) => r.status === "PRESENT").length
    const lateCount = thisMonthRecords.filter((r) => r.status === "LATE").length
    const onTimeRate = presentCount > 0 ? Math.round((onTimeCount / presentCount) * 100) : 100

    return {
      total: thisMonthRecords.length,
      presentCount,
      onTimeCount,
      lateCount,
      onTimeRate,
    }
  }, [allAttendance])

  const checkOffline = useCallback(async () => {
    try {
      const q = await getOfflineStaffQueue()
      setPendingOfflineCount(q.length)
    } catch {
      /* ignore */
    }
  }, [])

  const manualSyncOffline = async () => {
    if (isSyncingOffline) return
    setIsSyncingOffline(true)
    try {
      const result = await flushOfflineStaffQueue()
      if (result.synced > 0) {
        notifications.success("Sync Complete", `${result.synced} offline attendance record(s) uploaded.`)
        await loadData()
      } else {
        notifications.info("Up to Date", "No pending offline attendance records.")
      }
      await checkOffline()
    } catch (err: any) {
      notifications.error("Sync Failed", err.message || "Failed to sync offline attendance.")
    } finally {
      setIsSyncingOffline(false)
    }
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      // 0. Check today's working calendar status
      try {
        const cal = await db.isDateWorkingDay(todayStr)
        setCalendarStatus(cal)
      } catch (calErr) {
        console.warn("Could not fetch calendar status:", calErr)
      }

      // 1. Fetch staff's attendance records — filtered to the configured attendance mode
      const myAtt = await db.getMyStaffAttendance({
        mode: isSessionMode ? "session_based" : "daily",
      })
      setAllAttendance(myAtt || [])

      // 2. Fetch biometric enrollment descriptor
      const descriptorData = await db.getStaffFaceDescriptor()
      if (descriptorData?.descriptor) {
        setEnrolledDescriptor(descriptorData.descriptor)
      } else {
        setEnrolledDescriptor(null)
      }

      // 3. Fetch announcements / notices
      try {
        const annRes = await fetch(`/api/announcements?limit=3`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
            "x-school-id": user?.schoolId || "",
            "x-requested-role": "staff",
          },
        })
        const annData = await annRes.json()
        if (annData.success && Array.isArray(annData.data)) {
          setAnnouncements(annData.data.slice(0, 3))
        }
      } catch {
        /* ignore */
      }

      // 4. Fetch notifications
      try {
        const notifRes = await fetch(`/api/notifications?limit=3`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
            "x-school-id": user?.schoolId || "",
            "x-requested-role": "staff",
          },
        })
        const notifData = await notifRes.json()
        if (notifData.success && Array.isArray(notifData.data)) {
          setRecentNotifications(notifData.data.slice(0, 3))
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error("Staff dashboard load error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [todayStr, user?.schoolId])

  useEffect(() => {
    if (!allAttendance.length) {
      setTodayRecord(null)
      return
    }
    const todayRecs = allAttendance.filter((r) => r.date?.split("T")[0] === todayStr)
    if (isSessionMode) {
      const sessRec = todayRecs.find((r) => (r.session || "morning").toLowerCase() === selectedSession.toLowerCase())
      setTodayRecord(sessRec || null)
    } else {
      const dailyRec = todayRecs.find((r) => !r.session || r.session === "daily") || todayRecs[0]
      setTodayRecord(dailyRec || null)
    }
  }, [allAttendance, todayStr, selectedSession, isSessionMode])

  useEffect(() => {
    loadData()
    checkOffline()

    const handleChanged = () => {
      loadData()
      checkOffline()
    }
    window.addEventListener("staffAttendanceDataChanged", handleChanged)
    return () => window.removeEventListener("staffAttendanceDataChanged", handleChanged)
  }, [loadData, checkOffline])

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

  const isSubmittingAttendanceRef = useRef(false)

  // ─── Check-In & Check-Out Workflow Handlers ───
  const startAttendanceWorkflow = async (type: "checkin" | "checkout") => {
    setActionType(type)
    setIsVerificationModalOpen(true)
    setVerificationStep("getting_location")
    setStepMessage("Verifying campus location...")
    setCapturedLocation(null)
    isSubmittingAttendanceRef.current = false

    try {
      const location = await resolveLocationData(
        {
          restrictLocation: settings?.restrictLocation,
          allowOutsideAttendance: settings?.allowOutsideAttendance,
          schoolLatitude: settings?.schoolLatitude,
          schoolLongitude: settings?.schoolLongitude,
          allowedRadiusMeters: settings?.allowedRadiusMeters,
          staffGeoRequired: settings?.staff_geo_required,
        },
        { isStaff: true, suppressSuccessToast: true }
      )
      setCapturedLocation(location)

      if (settings?.staff_face_required !== false) {
        setVerificationStep("face_verification")
        setStepMessage("Geofence verified! Starting fast biometric scanner...")
      } else {
        await commitAttendance(type, location, { faceVerified: true, confidence: 1.0 })
      }
    } catch (geoErr: any) {
      console.error("Geofence check failed:", geoErr)
      setVerificationStep("error")
      setStepMessage(geoErr.message || "Location verification failed. You must be on school grounds.")
    }
  }

  const handleFaceVerified = async (faceResult: { descriptor: number[]; confidence?: number }) => {
    if (isSubmittingAttendanceRef.current) return
    isSubmittingAttendanceRef.current = true

    setVerificationStep("saving")
    setStepMessage("Recording verified attendance...")

    await commitAttendance(actionType, capturedLocation, {
      faceVerified: true,
      confidence: faceResult.confidence || 1.0,
    })
  }

  const commitAttendance = async (
    type: "checkin" | "checkout",
    location: GeofenceLocationData | null,
    face: { faceVerified: boolean; confidence?: number }
  ) => {
    const isOnline = typeof navigator !== "undefined" && navigator.onLine

    if (!isOnline) {
      try {
        await queueOfflineStaffCheckIn({
          schoolId: user?.schoolId || "",
          userId: user?.id || "",
          type,
          date: todayStr,
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
            ? "✓ Check-In Verified\nAttendance saved offline (auto-syncs on reconnect)"
            : "✓ Check-Out Verified\nAttendance saved offline (auto-syncs on reconnect)"
        )
        await checkOffline()
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

    try {
      const sessPayload = isSessionMode ? selectedSession : "daily"
      if (type === "checkin") {
        await db.staffCheckIn(
          {
            date: todayStr,
            session: sessPayload,
            faceVerified: face.faceVerified,
            faceConfidence: face.confidence,
          },
          location
        )
      } else {
        await db.staffCheckOut(
          {
            date: todayStr,
            session: sessPayload,
            faceVerified: face.faceVerified,
            faceConfidence: face.confidence,
          },
          location
        )
      }

      setVerificationStep("success")
      setStepMessage(
        type === "checkin"
          ? "✓ Check-In Verified\nAttendance recorded successfully"
          : "✓ Check-Out Verified\nAttendance recorded successfully"
      )
      await loadData()

      setTimeout(() => {
        setIsVerificationModalOpen(false)
        setVerificationStep("idle")
        isSubmittingAttendanceRef.current = false
      }, 1500)
    } catch (err: any) {
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

  const isCheckedIn = !!todayRecord?.checkInTime
  const isCheckedOut = !!todayRecord?.checkOutTime
  const GreetingIcon = greeting.icon

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-6">
      {/* ─── 1. MOBILE-FIRST HERO HEADER CARD ─── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/15 via-card to-background border border-border/80 p-4 sm:p-6 shadow-sm">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Staff Info */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 w-full sm:w-auto">
            <div className="relative shrink-0">
              <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-primary/30 shadow-md">
                <AvatarImage src={user?.profile_photo || ""} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {user?.name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase() || "ST"}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
                  isCheckedIn && !isCheckedOut ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                }`}
                title={isCheckedIn && !isCheckedOut ? "Active Check-In" : "Inactive"}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GreetingIcon className={`w-3.5 h-3.5 ${greeting.color}`} />
                <span>{greeting.text},</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {user?.name || "Staff Member"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] sm:text-xs font-semibold capitalize py-0 px-2">
                  {user?.role?.replace("_", " ") || "Staff Member"}
                </Badge>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  {user?.schoolName || "Addis Hiwot School"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Badges & Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-border/40">
            {enrolledDescriptor ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-2.5 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Face ID Active</span>
              </Badge>
            ) : (
              <button
                type="button"
                onClick={() => setIsFaceEnrollModalOpen(true)}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Enroll Face ID</span>
              </button>
            )}

            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={manualSyncOffline}
                disabled={isSyncingOffline}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
              >
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span>{pendingOfflineCount} Sync</span>
                <RefreshCw className={`w-3 h-3 ${isSyncingOffline ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Holiday / Non-Working Day Banner ─── */}
      {calendarStatus && !calendarStatus.isWorkingDay && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border flex items-center gap-3 shadow-xs ${
            calendarStatus.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
          }`}
        >
          <div
            className={`p-2 rounded-xl shrink-0 ${
              calendarStatus.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            {calendarStatus.isHoliday ? <CalendarOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm truncate">
                {calendarStatus.isHoliday
                  ? `Holiday: ${calendarStatus.holidayName}`
                  : calendarStatus.reason || "Scheduled Non-Working Day"}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                  calendarStatus.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300"
                }`}
              >
                {calendarStatus.isHoliday ? "Holiday" : "Off Day"}
              </Badge>
            </div>
            <p className="text-[11px] opacity-80 line-clamp-1">
              Attendance is optional today. Absences will not be marked.
            </p>
          </div>
        </div>
      )}

      {/* ─── 2. THUMB-FRIENDLY ATTENDANCE ACTION CARD (HERO WIDGET) ─── */}
      <Card className="border-border/80 shadow-md bg-card/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b border-border/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                  {isSessionMode ? "Session Attendance" : "Today's Attendance"}
                </CardTitle>
                <CardDescription className="text-xs">{formatDate(todayStr)}</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {workingDuration && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-mono font-bold animate-pulse">
                  ⏱ {workingDuration}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Session Selector (Session Mode) */}
          {isSessionMode && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Select Shift Session</span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border/40">
                {staffSessions.map((sess: any) => {
                  const isSelected = selectedSession.toLowerCase() === sess.id.toLowerCase()
                  const sessRec = allAttendance.find(
                    (r) => r.date?.split("T")[0] === todayStr && (r.session || "morning").toLowerCase() === sess.id.toLowerCase()
                  )
                  const sessDisplay = sessRec ? getStaffAttendanceDisplay(sessRec, settings, sess) : null

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
                      <span className="truncate">{sess.name}</span>
                      <span className="text-[10px] opacity-80 font-mono font-normal">
                        {formatEthiopianTime(sess.startTime)} - {formatEthiopianTime(sess.endTime)}
                      </span>
                      {sessDisplay && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-black/20 text-white">
                            IN: {sessDisplay.checkIn.label}
                          </span>
                          {sessRec.checkOutTime && (
                            <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-black/20 text-white">
                              OUT: {sessDisplay.checkOut.label}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Check-In & Check-Out Dual Status Grid ── */}
          {(() => {
            const currentSess = isSessionMode
              ? staffSessions.find((s: any) => s.id.toLowerCase() === selectedSession.toLowerCase()) || staffSessions[0]
              : undefined
            const display = getStaffAttendanceDisplay(todayRecord, settings, currentSess)

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Check-In Card */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col justify-between gap-1.5">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Check-In
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                      {display.checkIn.timeStr}
                    </span>
                  </div>
                  <div>
                    <Badge
                      className={`text-[9px] font-black uppercase py-0.5 px-2 tracking-wider ${display.checkIn.badgeColor}`}
                    >
                      {display.checkIn.label}
                    </Badge>
                  </div>
                </div>

                {/* Check-Out Card */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col justify-between gap-1.5">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Check-Out
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                      {display.checkOut.timeStr}
                    </span>
                  </div>
                  <div>
                    <Badge
                      className={`text-[9px] font-black uppercase py-0.5 px-2 tracking-wider ${display.checkOut.badgeColor}`}
                    >
                      {display.checkOut.label}
                    </Badge>
                  </div>
                </div>

                {/* Biometrics */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col justify-between gap-1.5">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Biometrics
                    </span>
                    <span className="text-xs font-bold text-foreground mt-1 flex items-center gap-1">
                      {todayRecord?.faceVerified ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Face Auth ✓
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs font-medium">Not Verified</span>
                      )}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {todayRecord?.faceConfidence ? `${Math.round(todayRecord.faceConfidence * 100)}% Match` : "Facial Scanner"}
                  </span>
                </div>

                {/* Campus GPS */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col justify-between gap-1.5">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Campus GPS
                    </span>
                    <span className="text-xs font-bold text-foreground mt-1 flex items-center gap-1">
                      {todayRecord?.geofenceVerified ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Boundary ✓
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs font-medium">Not Verified</span>
                      )}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {todayRecord?.geofenceDistance ? `${Math.round(todayRecord.geofenceDistance)}m from center` : "Geofenced"}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Big Action Buttons (Touch Friendly) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Button
              type="button"
              onClick={() => startAttendanceWorkflow("checkin")}
              disabled={isCheckedIn || verificationStep !== "idle"}
              className={`h-14 text-sm font-bold gap-2.5 rounded-xl shadow-md transition-all active:scale-[0.98] ${
                isCheckedIn
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-75"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
              }`}
            >
              <LogIn className="w-5 h-5 shrink-0" />
              <span>{isCheckedIn ? "Checked In ✓" : "Record Check-In (Arrival)"}</span>
            </Button>

            <Button
              type="button"
              onClick={() => startAttendanceWorkflow("checkout")}
              disabled={!isCheckedIn || isCheckedOut || verificationStep !== "idle"}
              variant="outline"
              className={`h-14 text-sm font-bold gap-2.5 rounded-xl transition-all active:scale-[0.98] ${
                isCheckedOut
                  ? "bg-muted text-muted-foreground cursor-not-allowed opacity-75"
                  : !isCheckedIn
                  ? "opacity-50 cursor-not-allowed"
                  : "border-primary/50 text-foreground hover:bg-primary/5 hover:border-primary shadow-xs"
              }`}
            >
              <LogOut className="w-5 h-5 shrink-0 text-primary" />
              <span>{isCheckedOut ? "Checked Out ✓" : "Record Check-Out (Departure)"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3. MONTHLY ATTENDANCE STATS STRIP ─── */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col items-center text-center">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
            <UserCheck className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-xl font-extrabold text-foreground">{monthlyStats.presentCount}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Days Present</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col items-center text-center">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-xl font-extrabold text-foreground">{monthlyStats.onTimeRate}%</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Punctuality</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col items-center text-center">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-base sm:text-xl font-extrabold text-foreground">{monthlyStats.lateCount}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Late Days</span>
        </div>
      </div>

      {/* ─── 4. QUICK ACTION SHORTCUTS (MOBILE CARDS) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/school/staff/attendance"
          className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all group active:scale-[0.99] shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-foreground">Attendance History</p>
              <p className="text-[11px] text-muted-foreground truncate">View 30-day logs & records</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href="/school/staff/communication"
          className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all group active:scale-[0.99] shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-foreground">School Notices</p>
              <p className="text-[11px] text-muted-foreground truncate">Announcements & alerts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href="/school/staff/profile"
          className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all group active:scale-[0.99] shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-foreground">My Profile</p>
              <p className="text-[11px] text-muted-foreground truncate">Account & Biometrics</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* ─── 5. ANNOUNCEMENTS & RECENT ALERTS FEED ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* School Announcements */}
        <Card className="border-border/80 shadow-xs bg-card/95 rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> School Announcements
            </CardTitle>
            <Link
              href="/school/staff/announcements"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {announcements.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No active announcements at this time.
              </div>
            ) : (
              announcements.map((ann: any) => (
                <div
                  key={ann.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{ann.title || "Announcement"}</p>
                      {ann.targetAudience === "STAFF" && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                          Staff Only
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{ann.content || ann.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="border-border/80 shadow-xs bg-card/95 rounded-2xl">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/40">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Recent Alerts
            </CardTitle>
            <Link
              href="/school/staff/communication"
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {recentNotifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                You have no unread notifications.
              </div>
            ) : (
              recentNotifications.map((notif: any) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{notif.title || "Notification"}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── 6. MOBILE-FIRST BIOMETRIC VERIFICATION MODAL ─── */}
      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent className="max-w-sm sm:max-w-md p-5 rounded-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              {actionType === "checkin" ? (
                <LogIn className="w-5 h-5 text-emerald-500" />
              ) : (
                <LogOut className="w-5 h-5 text-primary" />
              )}
              {actionType === "checkin" ? "Staff Check-In" : "Staff Check-Out"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verifying campus proximity and facial biometric identity.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {/* Step Indicators */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                  capturedLocation?.locationVerified
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : verificationStep === "getting_location"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 animate-pulse font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] truncate">1. Geofence</span>
                {capturedLocation?.locationVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500 shrink-0" />
                )}
              </div>

              <div
                className={`p-2 rounded-xl border flex items-center gap-1.5 ${
                  verificationStep === "face_verification"
                    ? "bg-primary/10 border-primary/30 text-primary font-semibold animate-pulse"
                    : verificationStep === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] truncate">2. Face Auth</span>
                {verificationStep === "success" && (
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500 shrink-0" />
                )}
              </div>
            </div>

            {/* Step 1: Getting location */}
            {verificationStep === "getting_location" && (
              <div className="text-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stepMessage}</p>
              </div>
            )}

            {/* Step 2: Face Verification Camera */}
            {verificationStep === "face_verification" && (
              <FaceVerificationCamera
                mode="verify"
                enrolledDescriptor={enrolledDescriptor}
                onVerified={handleFaceVerified}
                onFailed={(err) => {
                  setVerificationStep("error")
                  setStepMessage(err)
                }}
                onCancel={() => setIsVerificationModalOpen(false)}
              />
            )}

            {/* Step 3: Saving */}
            {verificationStep === "saving" && (
              <div className="text-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-xs sm:text-sm font-medium text-foreground">{stepMessage}</p>
              </div>
            )}

            {/* Step 4: Success */}
            {verificationStep === "success" && (
              <div className="text-center py-8 space-y-3 animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {actionType === "checkin" ? "✓ Check-In Verified" : "✓ Check-Out Verified"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Attendance recorded successfully
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Error */}
            {verificationStep === "error" && (
              <div className="text-center py-6 space-y-3">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
                <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-semibold px-2">
                  {stepMessage}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startAttendanceWorkflow(actionType)}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 7. DIRECT FACE ENROLLMENT MODAL ─── */}
      {user?.id && (
        <StaffFaceEnrollModal
          open={isFaceEnrollModalOpen}
          onOpenChange={setIsFaceEnrollModalOpen}
          preselectedUserId={user.id}
          preselectedUserName={user.name || "Staff Member"}
          onEnrolled={() => {
            loadData()
            notifications.success("Biometrics Active", "Your face has been registered for automatic attendance.")
          }}
        />
      )}
    </div>
  )
}
