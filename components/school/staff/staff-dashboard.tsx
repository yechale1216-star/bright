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
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { useCalendar } from "@/lib/context/calendar-context"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { db } from "@/lib/db/database"
import { resolveLocationData, GeofenceLocationData } from "@/lib/utils/geofence"
import { notifications } from "@/lib/utils/notifications"
import { FaceVerificationCamera } from "@/components/school/face-verification-camera"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  queueOfflineStaffCheckIn,
  getOfflineStaffQueue,
  flushOfflineStaffQueue,
} from "@/lib/utils/staff-attendance-offline-store"

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

  const isSessionMode = settings?.staffAttendanceMode === "session_based"
  const staffSessions = useMemo(() => {
    if (!settings?.staffSessions) {
      return [
        { id: "morning", name: "Morning Session", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true },
        { id: "afternoon", name: "Afternoon Session", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, isActive: true },
      ]
    }
    try {
      const arr = typeof settings.staffSessions === "string" ? JSON.parse(settings.staffSessions) : settings.staffSessions
      if (Array.isArray(arr) && arr.length > 0) return arr.filter((s: any) => s.isActive !== false)
    } catch (_) {}
    return [
      { id: "morning", name: "Morning Session", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true },
      { id: "afternoon", name: "Afternoon Session", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, isActive: true },
    ]
  }, [settings?.staffSessions])

  const [selectedSession, setSelectedSession] = useState<string>("morning")
  const [allAttendance, setAllAttendance] = useState<any[]>([])

  const checkOffline = useCallback(async () => {
    try {
      const q = await getOfflineStaffQueue()
      setPendingOfflineCount(q.length)
    } catch {
      /* ignore */
    }
  }, [])

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

      // 1. Fetch staff's attendance records
      const myAtt = await db.getMyStaffAttendance()
      setAllAttendance(myAtt)

      // 2. Fetch biometric enrollment descriptor
      const descriptorData = await db.getStaffFaceDescriptor()
      if (descriptorData?.descriptor) {
        setEnrolledDescriptor(descriptorData.descriptor)
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

  const isSubmittingAttendanceRef = useRef(false)

  // ─── 4. Check-In & Check-Out Workflow Handlers ───
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
        setStepMessage("Geofence verified! Initializing automatic biometric scanner...")
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
            ? "✓ Check-In Verified\nAttendance recorded offline (auto-syncs on reconnect)"
            : "✓ Check-Out Verified\nAttendance recorded offline (auto-syncs on reconnect)"
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
      setStepMessage(err.message || "Failed to submit attendance.")
      isSubmittingAttendanceRef.current = false
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* ─── 1. Welcome & Staff Profile Summary ─── */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 md:w-16 md:h-16 border-2 border-primary/30 shadow-md">
            <AvatarImage src={user?.profile_photo || ""} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
              {user?.name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase() || "ST"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Welcome, {user?.name || "Staff Member"}
              </h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs capitalize">
                Active Staff
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{user?.schoolName || "Addis Hiwot School"}</span>
              <span>•</span>
              <span className="capitalize">{user?.role?.replace("_", " ") || "Staff Member"}</span>
              {user?.email && (
                <>
                  <span>•</span>
                  <span>{user.email}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Biometric & Geofence Security Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {enrolledDescriptor ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 py-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Face Registered
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 py-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Face Enrollment Pending
            </Badge>
          )}

          {pendingOfflineCount > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/40 gap-1 py-1">
              <WifiOff className="w-3.5 h-3.5" /> {pendingOfflineCount} Offline Record(s)
            </Badge>
          )}
        </div>
      </div>

      {/* Holiday / Non-Working Day Alert Banner */}
      {calendarStatus && !calendarStatus.isWorkingDay && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm ${
            calendarStatus.isHoliday
              ? "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
          }`}
        >
          <div
            className={`p-2.5 rounded-xl ${
              calendarStatus.isHoliday
                ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}
          >
            {calendarStatus.isHoliday ? <CalendarOff className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {calendarStatus.isHoliday
                  ? `School Holiday: ${calendarStatus.holidayName}`
                  : calendarStatus.reason || "Scheduled Non-Working Day"}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold ${
                  calendarStatus.isHoliday
                    ? "border-purple-500/40 text-purple-600 dark:text-purple-300"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-300"
                }`}
              >
                {calendarStatus.isHoliday ? "Holiday" : "Non-Working Day"}
              </Badge>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              Attendance is optional today. Absences are not tracked or penalized.
            </p>
          </div>
        </div>
      )}

      {/* ─── 2. Key Action Grid: Attendance & Quick Access ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Action Card */}
        <Card className="md:col-span-2 border-border/60 shadow-md bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {isSessionMode ? "Session Attendance" : "Today's Attendance"}
              </CardTitle>
              <CardDescription>{formatDate(todayStr)}</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                {isSessionMode
                  ? (() => {
                      const s = staffSessions.find((x: any) => x.id.toLowerCase() === selectedSession.toLowerCase()) || staffSessions[0]
                      return `${s?.name}: ${s?.startTime} - ${s?.endTime}`
                    })()
                  : `Shift: ${settings?.staffWorkStartTime || "08:00"} - ${settings?.staffWorkEndTime || "17:00"}`}
              </Badge>
              {todayRecord?.status ? (
                <Badge
                  className={`text-xs font-bold px-3 py-1 uppercase ${
                    todayRecord.status === "PRESENT"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : todayRecord.status === "LATE"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                  }`}
                >
                  {todayRecord.status}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs font-semibold">
                  Not Marked
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Session Selector Pills in Session-Based mode */}
            {isSessionMode && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Session Selection</span>
                <div className="flex gap-2 p-1 bg-muted/60 rounded-xl border border-border/40 overflow-x-auto">
                  {staffSessions.map((sess: any) => {
                    const isSelected = selectedSession.toLowerCase() === sess.id.toLowerCase()
                    const sessRec = allAttendance.find((r) => r.date?.split("T")[0] === todayStr && (r.session || "morning").toLowerCase() === sess.id.toLowerCase())
                    return (
                      <button
                        key={sess.id}
                        type="button"
                        onClick={() => setSelectedSession(sess.id)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <span className="truncate">{sess.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono opacity-80">{sess.startTime}</span>
                          {sessRec?.status && (
                            <span className="text-[9px] font-bold uppercase px-1 rounded bg-black/20 text-white">
                              {sessRec.status}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Status overview metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block">Check-In</span>
                <span className="text-base font-bold text-foreground">
                  {todayRecord?.checkInTime
                    ? new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block">Check-Out</span>
                <span className="text-base font-bold text-foreground">
                  {todayRecord?.checkOutTime
                    ? new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block">Biometrics</span>
                <span className="text-xs font-bold flex items-center justify-center gap-1 mt-1">
                  {todayRecord?.faceVerified ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block">Campus GPS</span>
                <span className="text-xs font-bold flex items-center justify-center gap-1 mt-1">
                  {todayRecord?.geofenceVerified ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              </div>
            </div>

            {/* Attendance action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                onClick={() => startAttendanceWorkflow("checkin")}
                disabled={!!todayRecord?.checkInTime || verificationStep !== "idle"}
                className="h-12 text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
              >
                <LogIn className="w-4 h-4" />
                {todayRecord?.checkInTime
                  ? `Checked In ✓`
                  : isSessionMode
                  ? `Record ${staffSessions.find((s: any) => s.id.toLowerCase() === selectedSession.toLowerCase())?.name || "Session"}`
                  : "Check-In (Arrival)"}
              </Button>

              <Button
                onClick={() => startAttendanceWorkflow("checkout")}
                disabled={!todayRecord?.checkInTime || !!todayRecord?.checkOutTime || verificationStep !== "idle"}
                variant="outline"
                className="h-12 text-sm font-bold gap-2 border-primary/40 hover:bg-primary/5"
              >
                <LogOut className="w-4 h-4" />
                {todayRecord?.checkOutTime
                  ? "Checked Out ✓"
                  : isSessionMode
                  ? "Session Departure"
                  : "Check-Out (Departure)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Portal Navigation Links */}
        <Card className="border-border/60 shadow-md bg-card/95 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 flex-1">
            <Link
              href="/school/staff/attendance"
              className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Attendance History</p>
                  <p className="text-[11px] text-muted-foreground">View 30-day logs</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            <Link
              href="/school/staff/communication"
              className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Announcements</p>
                  <p className="text-[11px] text-muted-foreground">School updates & notices</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            <Link
              href="/school/staff/profile"
              className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">My Profile</p>
                  <p className="text-[11px] text-muted-foreground">Account & contact details</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ─── 3. Announcements & Notifications Widgets ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School Announcements */}
        <Card className="border-border/60 shadow-md bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> School Announcements
            </CardTitle>
            <Link
              href="/school/staff/communication"
              className="text-xs text-primary font-semibold hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
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
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground">{ann.title || "Announcement"}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{ann.content || ann.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card className="border-border/60 shadow-md bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Recent Alerts
            </CardTitle>
            <Link
              href="/school/staff/communication"
              className="text-xs text-primary font-semibold hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
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
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground">{notif.title || "Notification"}</p>
                    <span className="text-[10px] text-muted-foreground">
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

      {/* ─── Verification Modal ─── */}
      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {actionType === "checkin" ? (
                <LogIn className="w-5 h-5 text-emerald-500" />
              ) : (
                <LogOut className="w-5 h-5 text-primary" />
              )}
              {actionType === "checkin" ? "Staff Check-In Verification" : "Staff Check-Out Verification"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verifying campus proximity and facial biometric identity.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            {/* Step Indicators */}
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
                {capturedLocation?.locationVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />
                )}
              </div>

              <div
                className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                  verificationStep === "face_verification"
                    ? "bg-primary/10 border-primary/30 text-primary font-semibold animate-pulse"
                    : verificationStep === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/40"
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>2. Face Auth</span>
                {verificationStep === "success" && (
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-500" />
                )}
              </div>
            </div>

            {/* Step 1: Getting location */}
            {verificationStep === "getting_location" && (
              <div className="text-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">{stepMessage}</p>
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

            {/* Step 3: Saving / Success / Error */}
            {verificationStep === "saving" && (
              <div className="text-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-foreground">{stepMessage}</p>
              </div>
            )}

            {verificationStep === "success" && (
              <div className="text-center py-8 space-y-3 animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                  <CheckCircle2 className="w-8 h-8" />
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

            {verificationStep === "error" && (
              <div className="text-center py-6 space-y-3">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{stepMessage}</p>
                <Button
                  variant="outline"
                  onClick={() => startAttendanceWorkflow(actionType)}
                  className="gap-2 mt-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
