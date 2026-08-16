"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Search,
  Save,
  Calendar,
  Mail,
  MessageSquare,
  Settings,
  UserX,
  UserCheck,
  Clock,
  AlertTriangle,
  Phone,
  Copy,
  Check,
  Download,
  MapPin,
  Lock,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  XCircle,
  History,
  AlertCircle,
  Unlock,
} from "lucide-react"
import { db, type Student } from "@/lib/db/database"
import { notifications, combinedNotificationService, emailService } from "@/lib/utils/notifications"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { authService } from "@/lib/auth/auth"
import { parseJsonResponse } from "@/lib/utils/parse-json-response"
import { NativeBridge } from "@/lib/utils/native-bridge"
import { ImpactStyle } from "@capacitor/haptics"
import { cn } from "@/lib/utils/utils"
import { useCalendar } from "@/lib/context/calendar-context"
import { DualDatePicker } from "@/components/ui/dual-date-picker"


interface AttendanceRecordState {
  status: "present" | "late" | "absent" | "excused" | null
  note: string
  isDirty?: boolean
}

interface AttendanceState {
  [studentId: string]: AttendanceRecordState
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

export function AttendanceTracking() {
  const { formatDate } = useCalendar()
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [attendanceState, setAttendanceState] = useState<AttendanceState>({})
  const [baseAttendanceState, setBaseAttendanceState] = useState<AttendanceState>({})
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' }))
  const [selectedSession, setSelectedSession] = useState<"morning" | "afternoon">(
    parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour12: false, hour: 'numeric' }), 10) < 12 ? "morning" : "afternoon"
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [gradeFilter, setGradeFilter] = useState("All Grades")
  const [streamFilter, setStreamFilter] = useState("All Streams")
  const [sectionFilter, setSectionFilter] = useState("All Sections")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [isSendingNotifications, setIsSendingNotifications] = useState(false)
  const [showAbsentStudents, setShowAbsentStudents] = useState(false)
  const [absentSearchTerm, setAbsentSearchTerm] = useState("")
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [showSessionConfirm, setShowSessionConfirm] = useState(false)
  const [pendingSession, setPendingSession] = useState<"morning" | "afternoon" | null>(null)
  const { settings } = useSchoolSettings()

  const [isTeacher, setIsTeacher] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false)
  const [uiType, setUiType] = useState<"card_based" | "tabular">("card_based")

  // Refs so event listeners & polling intervals always use the current date/session
  // instead of the stale closure values from mount time
  const selectedDateRef = useRef(selectedDate)
  const selectedSessionRef = useRef(selectedSession)
  const studentsRef = useRef<Student[]>([])
  const prevDateRef = useRef(selectedDate)
  const prevSessionRef = useRef(selectedSession)

  // Attendance Edit Permission & Audit Log state
  const [editRequests, setEditRequests] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [editRequestModalOpen, setEditRequestModalOpen] = useState(false)
  const [showRequestsModal, setShowRequestsModal] = useState(false)
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false)
  const [editReason, setEditReason] = useState("")
  const [adminNote, setAdminNote] = useState("")
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)

  const pendingRequestsCount = editRequests.filter((r: any) => r.status === 'PENDING').length

  useEffect(() => {
    if (settings?.attendanceUiType) {
      setUiType(settings.attendanceUiType)
    }
  }, [settings?.attendanceUiType])

  useEffect(() => {
    const user = authService.getCurrentUser()
    setIsTeacher(user?.role === "teacher")
    loadStudents()
    fetchEditRequests()

    const handleAttendanceChanged = () => {
      // Read from refs to always use the current date/session (not stale closure values)
      loadAttendanceForDateStable(true)
      fetchEditRequests()
    }

    window.addEventListener("attendanceDataChanged", handleAttendanceChanged)

    // Background polling every 30 seconds
    const pollInterval = setInterval(() => {
      loadAttendanceForDateStable(true)
      fetchEditRequests()
    }, 30000)

    return () => {
      window.removeEventListener("attendanceDataChanged", handleAttendanceChanged)
      clearInterval(pollInterval)
    }
  }, [])

  const fetchEditRequests = async () => {
    try {
      const requests = await db.getAttendanceEditRequests()
      setEditRequests(requests || [])
    } catch (err) {
      console.error("Error fetching edit requests:", err)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const logs = await db.getAttendanceAuditLogs()
      setAuditLogs(logs || [])
    } catch (err) {
      console.error("Error fetching audit logs:", err)
    }
  }

  const handleRequestPermission = async () => {
    setIsSubmittingRequest(true)
    try {
      await db.createAttendanceEditRequest({
        date: selectedDate,
        session: settings?.attendanceMode === "session_based" ? selectedSession : null,
        reason: editReason,
      })
      notifications.success("Request Submitted", "Your edit request has been sent to the School Admin for approval.")
      setEditRequestModalOpen(false)
      setEditReason("")
      await fetchEditRequests()
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to submit request")
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    try {
      await db.approveAttendanceEditRequest(requestId, adminNote)
      notifications.success("Approved", "Edit request approved successfully.")
      setAdminNote("")
      await fetchEditRequests()
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to approve request")
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      await db.rejectAttendanceEditRequest(requestId, adminNote)
      notifications.success("Rejected", "Edit request rejected.")
      setAdminNote("")
      await fetchEditRequests()
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to reject request")
    }
  }

  const isEditingBlockedForTeacher = () => {
    if (!isTeacher) return false
    if (settings?.allowAttendanceEditing !== false) return false

    // Allow initial attendance marking if no records are saved yet
    const hasSavedRecords = Object.values(attendanceState).some(item => item.status !== null)
    if (!hasSavedRecords) return false

    // Check if teacher has active approved request
    const dateStr = selectedDate
    const isSessionBased = settings?.attendanceMode === "session_based"
    const hasApproved = editRequests.some(
      (req: any) =>
        req.status === 'APPROVED' &&
        !req.isUsed &&
        req.date?.split("T")[0] === dateStr &&
        (!isSessionBased || !req.session || req.session.toLowerCase() === selectedSession.toLowerCase())
    )

    return !hasApproved
  }

  // Keep refs in sync with state
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate])
  useEffect(() => { selectedSessionRef.current = selectedSession; }, [selectedSession])
  useEffect(() => { studentsRef.current = students; }, [students])

  useEffect(() => {
    const dateChanged = prevDateRef.current !== selectedDate
    const sessionChanged = prevSessionRef.current !== selectedSession
    prevDateRef.current = selectedDate
    prevSessionRef.current = selectedSession

    const forceReset = dateChanged || sessionChanged
    loadAttendanceForDate(false, forceReset)
  }, [selectedDate, students, selectedSession, settings?.attendanceMode])

  useEffect(() => {
    filterStudents()
  }, [students, searchTerm, gradeFilter, streamFilter, sectionFilter, showUnmarkedOnly, attendanceState])

  const loadStudents = async () => {
    setIsLoading(true)
    try {
      const user = authService.getCurrentUser()

      if (user?.role === "teacher") {
        // Parallel fetch: active students + teacher assignments fire simultaneously
        const [studentsData, assignmentsData] = await Promise.all([
          db.getStudents(false, "ACTIVE"),
          db.getTeacherAssignments(user.schoolId, user.teacherId || user.id),
        ])
        const classes = assignmentsData || []

        const allFilteredStudents = studentsData.filter((student: Student) => {
          // Strictly exclude transferred, withdrawn, graduated, expelled, or inactive students
          const isStudentActive = !student.status || student.status.toUpperCase() === "ACTIVE"
          if (!isStudentActive) return false

          return classes.some((cls: any) => {
            const studentGrade = (student.grade || "").toLowerCase().replace("grade ", "").trim()
            // cls.grade is a formatted string name (e.g. "9", "Grade 9") from formatField()
            // cls.gradeId is a UUID — students don't store UUIDs, so we match by name only
            const clsGradeName = String(cls.grade || cls.gradeObj?.name || "").toLowerCase().replace("grade ", "").trim()
            
            const gradeMatch = studentGrade !== "" && clsGradeName !== "" && studentGrade === clsGradeName
            
            const studentSection = (student.section || "").toLowerCase().trim()
            // cls.section is a formatted string name (e.g. "A", "B") from formatField()
            const clsSectionName = String(cls.section || cls.sectionObj?.name || "").toLowerCase().trim()
            
            const sectionMatch = studentSection !== "" && clsSectionName !== "" && studentSection === clsSectionName

            const studentStream = (student.stream || "").toLowerCase().trim()
            // cls.stream is a formatted string name (e.g. "Natural Science") from formatField()
            const clsStreamName = String(cls.stream || cls.streamObj?.name || "").toLowerCase().trim()
            // If the assignment has no stream, all students in the grade/section match
            const streamMatch = !cls.streamId || (studentStream !== "" && clsStreamName !== "" && studentStream === clsStreamName)
            
            return gradeMatch && sectionMatch && streamMatch
          })
        })

        setStudents(allFilteredStudents)
        console.log(
          `[Teacher] Assignments: ${classes.length}, All students: ${studentsData.length}, Matched: ${allFilteredStudents.length}`,
          classes.map((c: any) => `Grade "${c.grade}" Section "${c.section}" Stream "${c.stream || 'none'}"`)
        )
      } else {
        // Admin / school_admin path: fetch ONLY active enrolled students
        const studentsData = await db.getStudents(false, "ACTIVE")
        const activeOnly = studentsData.filter((s: Student) => !s.status || s.status.toUpperCase() === "ACTIVE")
        setStudents(activeOnly)
      }
    } catch (error: any) {
      console.error("Error loading students for teacher:", error)
      notifications.error("Error", error.message || "Failed to load students")
    } finally {
      setIsLoading(false)
    }
  }

  // Stable version of loadAttendanceForDate — reads from refs so it's safe
  // to call from event listeners and polling intervals
  const loadAttendanceForDateStable = useCallback(async (isBackground = false, forceReset = false) => {
    const currentStudents = studentsRef.current
    const currentDate = selectedDateRef.current
    const currentSession = selectedSessionRef.current
    if (currentStudents.length === 0) return

    try {
      const isSessionBased = settings?.attendanceMode === "session_based"

      const attendanceRecords = await db.getAttendanceByDateAndMode(
        currentDate,
        isSessionBased ? currentSession : null
      )

      const filteredRecords = isSessionBased
        ? attendanceRecords.filter(
            (r: any) => r.session?.toLowerCase() === currentSession.toLowerCase()
          )
        : attendanceRecords.filter(
            (r: any) => r.session === null || r.session === undefined || r.session === ""
          )

      const serverState: AttendanceState = {}

      currentStudents.forEach((student) => {
        serverState[student.id] = {
          status: null,
          note: "",
          isDirty: false,
        }
      })

      filteredRecords.forEach((record) => {
        if (serverState[record.student_id]) {
          serverState[record.student_id] = {
            status: record.status?.toLowerCase() as any,
            note: record.note || "",
            isDirty: false,
          }
        }
      })

      setBaseAttendanceState(serverState)

      setAttendanceState((prevEditable) => {
        if (forceReset) {
          return { ...serverState }
        }

        const newEditable: AttendanceState = {}

        currentStudents.forEach((student) => {
          const existing = prevEditable[student.id]
          const serverVal = serverState[student.id] || { status: null, note: "", isDirty: false }

          if (existing?.isDirty) {
            // Teacher has an unsaved local edit — preserve it!
            newEditable[student.id] = existing
          } else {
            // Use authoritative server value
            newEditable[student.id] = {
              status: serverVal.status,
              note: serverVal.note,
              isDirty: false,
            }
          }
        })

        // Preserve dirty records for any students not currently in filtered/loaded list
        Object.keys(prevEditable).forEach((studentId) => {
          if (!newEditable[studentId] && prevEditable[studentId]?.isDirty) {
            newEditable[studentId] = prevEditable[studentId]
          }
        })

        return newEditable
      })
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to load attendance records")
    }
  }, [settings?.attendanceMode])

  const loadAttendanceForDate = async (isBackground = false, forceReset = false) => {
    return loadAttendanceForDateStable(isBackground, forceReset)
  }

  const filterStudents = () => {
    let filtered = students

    if (searchTerm) {
      filtered = filtered.filter(
        (student) =>
        (student.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.student_id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.grade || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.stream?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.section || "").toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (gradeFilter !== "All Grades") {
      filtered = filtered.filter((student) => student.grade === gradeFilter)
    }

    if (streamFilter !== "All Streams") {
      filtered = filtered.filter((student) => student.stream === streamFilter)
    }

    if (sectionFilter !== "All Sections") {
      filtered = filtered.filter((student) => student.section === sectionFilter)
    }

    if (showUnmarkedOnly) {
      filtered = filtered.filter((student) => !attendanceState[student.id]?.status)
    }

    setFilteredStudents(filtered)
  }

  const updateAttendance = (studentId: string, status: "present" | "late" | "absent" | "excused", note?: string) => {
    NativeBridge.vibrate(ImpactStyle.Light)
    setAttendanceState((prev) => {
      const currentNote = note !== undefined ? note : (prev[studentId]?.note || "")
      const baseRecord = baseAttendanceState[studentId]
      const isDirty = status !== baseRecord?.status || currentNote !== (baseRecord?.note || "")
      return {
        ...prev,
        [studentId]: {
          status,
          note: currentNote,
          isDirty,
        },
      }
    })
  }

  const handleSessionChange = (session: "morning" | "afternoon") => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
    // Only warn if selecting for today
    if (selectedDate !== today) {
      setSelectedSession(session)
      return
    }

    const currentHour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour12: false, hour: 'numeric' }), 10)
    const isMorningTime = currentHour < 12
    
    if ((session === "morning" && !isMorningTime) || (session === "afternoon" && isMorningTime)) {
      setPendingSession(session)
      setShowSessionConfirm(true)
    } else {
      setSelectedSession(session)
    }
  }

  const confirmSessionChange = () => {
    if (pendingSession) {
      setSelectedSession(pendingSession)
    }
    setShowSessionConfirm(false)
    setPendingSession(null)
  }

  const updateNote = (studentId: string, note: string) => {
    setAttendanceState((prev) => {
      const currentStatus = prev[studentId]?.status || null
      const baseRecord = baseAttendanceState[studentId]
      const isDirty = currentStatus !== baseRecord?.status || note !== (baseRecord?.note || "")
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          status: currentStatus,
          note,
          isDirty,
        },
      }
    })
  }

  const markAllAsPresent = () => {
    setAttendanceState((prev) => {
      const next = { ...prev }
      filteredStudents.forEach((student) => {
        const baseRecord = baseAttendanceState[student.id]
        const isDirty = "present" !== baseRecord?.status || (prev[student.id]?.note || "") !== (baseRecord?.note || "")
        next[student.id] = {
          status: "present",
          note: prev[student.id]?.note || "",
          isDirty,
        }
      })
      return next
    })
    notifications.success("Success", `Marked ${filteredStudents.length} students as present`)
  }

  const markSelectedPresent = () => {
    if (selectedStudents.size === 0) return
    setAttendanceState((prev) => {
      const next = { ...prev }
      selectedStudents.forEach((id) => {
        const baseRecord = baseAttendanceState[id]
        const isDirty = "present" !== baseRecord?.status || (prev[id]?.note || "") !== (baseRecord?.note || "")
        next[id] = {
          status: "present",
          note: prev[id]?.note || "",
          isDirty,
        }
      })
      return next
    })
    setSelectedStudents(new Set())
    notifications.success("Success", `Marked ${selectedStudents.size} students as present`)
  }

  const markSelectedAbsent = () => {
    if (selectedStudents.size === 0) {
      notifications.warning("No Selection", "Please select students first")
      return
    }
    setAttendanceState((prev) => {
      const next = { ...prev }
      selectedStudents.forEach((id) => {
        const baseRecord = baseAttendanceState[id]
        const isDirty = "absent" !== baseRecord?.status || (prev[id]?.note || "") !== (baseRecord?.note || "")
        next[id] = {
          status: "absent",
          note: prev[id]?.note || "",
          isDirty,
        }
      })
      return next
    })
    setSelectedStudents(new Set())
    notifications.success("Success", `Marked ${selectedStudents.size} students as absent`)
  }

  const resetAttendance = () => {
    setAttendanceState((prev) => {
      const next = { ...prev }
      filteredStudents.forEach((student) => {
        const baseRecord = baseAttendanceState[student.id] || { status: null, note: "", isDirty: false }
        next[student.id] = {
          status: baseRecord.status,
          note: baseRecord.note,
          isDirty: false,
        }
      })
      return next
    })
    notifications.info("Attendance Reset", "Cleared unsaved changes for filtered students")
  }

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudents)
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId)
    } else {
      newSelection.add(studentId)
    }
    setSelectedStudents(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)))
    }
  }

  const resolveLocationData = async () => {
    let locationData: any = null

    if (settings?.restrictLocation && !settings?.allowOutsideAttendance) {
      if (!navigator.geolocation) {
        notifications.error(
          "GPS Required",
          "Geolocation is not supported by your device/browser. Cannot verify school location."
        )
        throw new Error("Geolocation not supported")
      }

      // Native Android Pre-flight: Check System GPS & Request Runtime Permissions
      if (NativeBridge.isNative()) {
        const gpsActive = await NativeBridge.isLocationServicesEnabled()
        if (!gpsActive) {
          notifications.error(
            "GPS Turned Off",
            "Device Location Services (GPS) are turned off. Please turn on Location in Settings to submit attendance."
          )
          throw new Error("GPS turned off")
        }

        const permResult = await NativeBridge.requestLocationPermission()
        if (permResult === 'denied' || permResult === 'prompt-with-rationale') {
          notifications.error(
            "Location Permission Required",
            "Location permission is required to verify school proximity. Please enable location access in App Settings."
          )
          throw new Error("Location permission required")
        }
      }

      notifications.info("Verifying Location", "Fetching GPS location to verify school proximity...")

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
          })
        })

        const userLat = position.coords.latitude
        const userLon = position.coords.longitude

        if (settings.schoolLatitude != null && settings.schoolLongitude != null) {
          const distance = calculateDistanceMeters(
            userLat,
            userLon,
            Number(settings.schoolLatitude),
            Number(settings.schoolLongitude)
          )

          const allowedRadius = Number(settings.allowedRadiusMeters) || 200

          if (distance > allowedRadius) {
            notifications.error(
              "Submission Blocked",
              `Outside school boundary! You are ${distance}m away (Allowed: ${allowedRadius}m). Attendance submission blocked.`
            )
            throw new Error("Outside school boundary")
          }

          locationData = {
            latitude: userLat,
            longitude: userLon,
            locationVerified: true,
            locationDistance: distance,
          }
          notifications.success("Location Verified", `GPS verified: ${distance}m from school.`)
        }
      } catch (geoError: any) {
        if (geoError.message === "Outside school boundary") throw geoError
        let msg = "Failed to obtain GPS coordinates."
        if (geoError.code === 1) {
          msg = "Location permission denied. Please grant location permission in Settings to submit attendance."
        } else if (geoError.code === 2) {
          msg = "GPS location unavailable. Please verify your device location services are enabled."
        } else if (geoError.code === 3) {
          msg = "Location request timed out. Please try again."
        }
        notifications.error("GPS Verification Failed", msg)
        throw new Error(msg)
      }
    } else if (navigator.geolocation) {
      // Optional location capture when geofence restriction is OFF or bypass is ON
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        }).catch(() => null)

        if (position) {
          const userLat = position.coords.latitude
          const userLon = position.coords.longitude
          let dist: number | null = null
          if (settings?.schoolLatitude != null && settings?.schoolLongitude != null) {
            dist = calculateDistanceMeters(userLat, userLon, Number(settings.schoolLatitude), Number(settings.schoolLongitude))
          }
          locationData = {
            latitude: userLat,
            longitude: userLon,
            locationVerified: dist != null ? dist <= (Number(settings?.allowedRadiusMeters) || 200) : false,
            locationDistance: dist,
          }
        }
      } catch (err) {
        // Ignore fallback errors
      }
    }

    return locationData
  }

  const saveSingleStudentAttendance = async (studentId: string) => {
    // 1. Check Edit Permission Restriction for Teachers
    if (isEditingBlockedForTeacher()) {
      notifications.warning(
        "Edit Permission Required",
        "Attendance editing is disabled by School Admin. Please submit an edit request for approval."
      )
      setEditRequestModalOpen(true)
      return
    }

    const studentData = attendanceState[studentId]
    if (!studentData || studentData.status === null) {
      notifications.warning("No Status Selected", "Please select an attendance status before saving.")
      return
    }

    setSavingStudentId(studentId)
    try {
      const locationData = await resolveLocationData()
      const isSessionBased = settings?.attendanceMode === "session_based"

      await db.saveAttendance({
        student_id: studentId,
        date: selectedDate,
        status: studentData.status,
        note: studentData.note || "",
        session: isSessionBased ? selectedSession : null,
      }, locationData)

      // Update base state and clear isDirty
      setBaseAttendanceState((prev) => ({
        ...prev,
        [studentId]: {
          status: studentData.status,
          note: studentData.note || "",
          isDirty: false,
        }
      }))

      setAttendanceState((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          isDirty: false,
        }
      }))

      const student = students.find((s) => s.id === studentId)
      const studentName = student?.name || "Student"
      notifications.success("Attendance Saved", `Saved ${studentData.status.toUpperCase()} for ${studentName}`)
      await fetchEditRequests()
    } catch (error: any) {
      console.error("Error saving single attendance:", error)
      if (error.message !== "Outside school boundary" && error.message !== "GPS turned off" && error.message !== "Location permission required") {
        notifications.error("Save Failed", error.message || "Failed to save attendance.")
      }
    } finally {
      setSavingStudentId(null)
    }
  }

  const saveAttendance = async () => {
    // 1. Check Edit Permission Restriction for Teachers
    if (isEditingBlockedForTeacher()) {
      notifications.warning(
        "Edit Permission Required",
        "Attendance editing is disabled by School Admin. Please submit an edit request for approval."
      )
      setEditRequestModalOpen(true)
      return
    }

    setIsSaving(true)
    try {
      const isSessionBased = settings?.attendanceMode === "session_based"
      const attendanceRecords = Object.entries(attendanceState)
        .filter(([_, data]) => data.status !== null)
        .map(([studentId, data]) => ({
          student_id: studentId,
          date: selectedDate,
          status: data.status!,
          note: data.note,
          session: isSessionBased ? selectedSession : null,
        }))

      if (attendanceRecords.length === 0) {
        notifications.warning("No Data", "Please mark attendance for at least one student")
        setIsSaving(false)
        return
      }

      const locationData = await resolveLocationData()

      await db.markAttendance(attendanceRecords, locationData)

      // Update baseAttendanceState with newly saved records and clear isDirty on editable state
      setBaseAttendanceState((prevBase) => {
        const newBase = { ...prevBase }
        attendanceRecords.forEach((r) => {
          newBase[r.student_id] = {
            status: r.status as any,
            note: r.note || "",
            isDirty: false,
          }
        })
        return newBase
      })

      setAttendanceState((prevEditable) => {
        const newEditable = { ...prevEditable }
        attendanceRecords.forEach((r) => {
          newEditable[r.student_id] = {
            status: r.status as any,
            note: r.note || "",
            isDirty: false,
          }
        })
        return newEditable
      })

      notifications.success("Attendance Saved Successfully", "The student attendance records have been updated.")

      await fetchEditRequests()
    } catch (error: any) {
      console.error("Error saving attendance:", error)
      if (error.message !== "Outside school boundary" && error.message !== "GPS turned off" && error.message !== "Location permission required") {
        notifications.error("Error", error.message || "Failed to save attendance. Please try again.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const sendEmailNotifications = async () => {
    setIsSendingNotifications(true)
    try {
      const notificationsToSend = Object.entries(attendanceState)
        .filter(([_, data]) => data.status && ["absent", "late", "excused"].includes(data.status))
        .map(([studentId, data]) => {
          const student = students.find((s) => s.id === studentId)
          return student
            ? {
                student,
                status: data.status as "absent" | "late" | "excused",
                note: data.note,
              }
            : null
        })
        .filter(Boolean) as Array<{
        student: Student
        status: "absent" | "late" | "excused"
        note: string
      }>

      if (notificationsToSend.length === 0) {
        notifications.info("No Notifications", "No absent, late, or excused students to notify via email")
        return
      }

      const result = await combinedNotificationService.sendBulkNotifications(notificationsToSend, {
        email: true,
        sms: false,
      })

      if (result.email.failed > 0) {
        notifications.warning("Email Partially Sent", `${result.email.success} emails sent. ${result.email.failed} failed.`)
      } else {
        notifications.success("Emails Sent", `Successfully sent ${result.email.success} email alerts.`)
      }
    } catch (error) {
      notifications.error("Error", "Failed to send email notifications")
    } finally {
      setIsSendingNotifications(false)
    }
  }

  const sendSMSNotifications = async () => {
    setIsSendingNotifications(true)
    try {
      const notificationsToSend = Object.entries(attendanceState)
        .filter(([_, data]) => data.status && ["absent", "late", "excused"].includes(data.status))
        .map(([studentId, data]) => {
          const student = students.find((s) => s.id === studentId)
          return student
            ? {
                student,
                status: data.status as "absent" | "late" | "excused",
                note: data.note,
              }
            : null
        })
        .filter(Boolean) as Array<{
        student: Student
        status: "absent" | "late" | "excused"
        note: string
      }>

      if (notificationsToSend.length === 0) {
        notifications.info("No Notifications", "No absent, late, or excused students to notify via SMS")
        return
      }

      const result = await combinedNotificationService.sendBulkNotifications(notificationsToSend, {
        email: false,
        sms: true,
      })

      if (result.sms.failed > 0) {
        notifications.warning("SMS Partially Sent", `${result.sms.success} SMS sent. ${result.sms.failed} failed.`)
      } else {
        notifications.success("SMS Sent", `Successfully sent ${result.sms.success} SMS alerts.`)
      }
    } catch (error) {
      notifications.error("Error", "Failed to send SMS notifications")
    } finally {
      setIsSendingNotifications(false)
    }
  }

  const sendStudentNotification = async (studentId: string, channel: "email" | "sms") => {
    const data = attendanceState[studentId]
    if (!data || !data.status || !["absent", "late", "excused"].includes(data.status)) {
      notifications.warning("Status Required", "Student must be marked as Absent, Late, or Excused to send an alert.")
      return
    }

    const student = students.find((s) => s.id === studentId)
    if (!student) return

    setIsSendingNotifications(true)
    try {
      const result = await combinedNotificationService.sendBulkNotifications(
        [{ student, status: data.status as any, note: data.note }],
        { email: channel === "email", sms: channel === "sms" }
      )

      if (channel === "email") {
        if (result.email.success > 0) notifications.success("Email Sent", `Alert sent to ${student.name}'s parent.`)
        else notifications.error("Failed", "Failed to send email alert.")
      } else {
        if (result.sms.success > 0) notifications.success("SMS Sent", `Alert sent to ${student.name}'s parent.`)
        else notifications.error("Failed", "Failed to send SMS alert.")
      }
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to send notification")
    } finally {
      setIsSendingNotifications(false)
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "present":
        return "bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-500 shadow-sm font-semibold scale-[1.02]"
      case "late":
        return "bg-amber-500 text-white border-amber-600 dark:bg-amber-500 shadow-sm font-semibold scale-[1.02]"
      case "absent":
        return "bg-rose-600 text-white border-rose-700 dark:bg-rose-500 shadow-sm font-semibold scale-[1.02]"
      case "excused":
        return "bg-sky-600 text-white border-sky-700 dark:bg-sky-500 shadow-sm font-semibold scale-[1.02]"
      default:
        return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 font-medium"
    }
  }

  const getAttendanceStats = () => {
    const stats = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      unmarked: 0,
    }

    Object.values(attendanceState).forEach((data) => {
      if (data.status) {
        stats[data.status]++
      } else {
        stats.unmarked++
      }
    })

    return stats
  }

  const getAbsentStudents = () => {
    return filteredStudents.filter((student) => {
      const attendance = attendanceState[student.id]
      return attendance?.status === "absent"
    })
  }

  const getFilteredAbsentStudents = () => {
    const absentStudents = getAbsentStudents()

    if (!absentSearchTerm) {
      return absentStudents
    }

    return absentStudents.filter(
      (student) =>
        (student.name || "").toLowerCase().includes(absentSearchTerm.toLowerCase()) ||
        (student.student_id || "").toLowerCase().includes(absentSearchTerm.toLowerCase()) ||
        (student.grade || "").toLowerCase().includes(absentSearchTerm.toLowerCase()) ||
        student.stream?.toLowerCase().includes(absentSearchTerm.toLowerCase()) ||
        (student.section || "").toLowerCase().includes(absentSearchTerm.toLowerCase()),
    )
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPhone(text)
      notifications.success("Copied!", `${label} copied to clipboard`)
      setTimeout(() => setCopiedPhone(null), 2000)
    } catch (error) {
      notifications.error("Error", "Failed to copy to clipboard")
    }
  }

  const initiateCall = (parentPhone: string, schoolPhone?: string) => {
    try {
      window.open(`tel:${parentPhone}`, "_blank")
    } catch (error) {
      const message = schoolPhone
        ? `Please call ${parentPhone} from your school phone: ${schoolPhone}`
        : `Please call ${parentPhone}`
      notifications.info("Call Instructions", message, 5000)
    }
  }

  const clearAbsentStudents = () => {
    setAttendanceState((prev) => {
      const next = { ...prev }
      let clearedCount = 0

      Object.keys(next).forEach((studentId) => {
        if (next[studentId]?.status === "absent") {
          const baseRecord = baseAttendanceState[studentId] || { status: null, note: "", isDirty: false }
          next[studentId] = {
            status: baseRecord.status,
            note: baseRecord.note,
            isDirty: false,
          }
          clearedCount++
        }
      })

      if (clearedCount > 0) {
        notifications.success("Cleared", `Cleared ${clearedCount} absent student${clearedCount !== 1 ? "s" : ""}`)
      }
      return next
    })
  }


  const exportAttendanceToCSV = () => {
    console.log("Starting attendance CSV export...")

    try {
      const headers = ["Student Name", "Student ID", "Grade", "Stream", "Section", "Status", "Date", "Note"]

      const csvData = filteredStudents.map((student) => {
        const attendance = attendanceState[student.id]
        return [
          `"${student.name}"`,
          student.student_id || "",
          `"${student.grade || ""}"`,
          `"${student.stream || ""}"`,
          student.section || "",
          attendance?.status || "Not Marked",
          selectedDate,
          `"${attendance?.note || ""}"`,
        ]
      })

      const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `attendance_${selectedDate}.csv`
      link.style.display = "none"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)

      notifications.success("Export Complete", `Exported attendance for ${filteredStudents.length} students`)

    } catch (error) {
      console.error("CSV export error:", error)
      notifications.error("Export Failed", "Failed to export attendance. Please try again.")

    }
  }

  const stats = getAttendanceStats()
  const grades = [...new Set(students.map((s) => s.grade))].filter(Boolean)
  const streams = [...new Set(students.map((s) => s.stream).filter(Boolean))]
  const sections = [...new Set(students.map((s) => s.section))].filter(Boolean)

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-2 md:pt-4">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-normal">
            Attendance
          </h1>
          <p className="text-[10px] md:text-sm font-bold text-slate-500/60 dark:text-slate-400/60 uppercase tracking-widest mt-1">
            Student Daily Status
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Segmented control for Grid vs Table views */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl h-11 border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto justify-center sm:justify-start">
            <Button
              variant={uiType === "card_based" ? "default" : "ghost"}
              onClick={() => setUiType("card_based")}
              size="sm"
              className={cn(
                "h-9 rounded-lg px-4 text-[10px] uppercase font-black tracking-widest flex-1 sm:flex-none",
                uiType === "card_based" && "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              )}
            >
              Grid
            </Button>
            <Button
              variant={uiType === "tabular" ? "default" : "ghost"}
              onClick={() => setUiType("tabular")}
              size="sm"
              className={cn(
                "h-9 rounded-lg px-4 text-[10px] uppercase font-black tracking-widest flex-1 sm:flex-none",
                uiType === "tabular" && "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              )}
            >
              Table
            </Button>
          </div>

          <Button 
            onClick={exportAttendanceToCSV} 
            disabled={filteredStudents.length === 0} 
            variant="outline"
            className="flex-1 sm:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>

          {!isTeacher && (
            <>
              <Button
                onClick={() => {
                  fetchEditRequests()
                  setShowRequestsModal(true)
                }}
                variant="outline"
                className="relative flex-1 sm:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
              >
                <FileCheck className="w-4 h-4 mr-2 text-primary" />
                Requests
                {pendingRequestsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-full">
                    {pendingRequestsCount}
                  </span>
                )}
              </Button>

              <Button
                onClick={() => {
                  fetchAuditLogs()
                  setShowAuditLogsModal(true)
                }}
                variant="outline"
                className="flex-1 sm:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
              >
                <History className="w-4 h-4 mr-2 text-primary" />
                Audit Log
              </Button>
            </>
          )}

          {isTeacher && isEditingBlockedForTeacher() ? (
            <Button
              onClick={() => setEditRequestModalOpen(true)}
              className="flex-1 sm:flex-none h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest px-5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Lock className="w-4 h-4 mr-2" />
              Request Permission
            </Button>
          ) : (
            <Button
              onClick={saveAttendance}
              disabled={isSaving}
              className="hidden lg:flex h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-blue-500/20 active:scale-95 transition-all animate-in fade-in zoom-in-95 duration-200"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Now"}
            </Button>
          )}
        </div>
      </div>

      {/* Geofence & Permission Alert Banner */}
      <div className="space-y-3">
        {settings?.restrictLocation && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs font-medium">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                Location Restriction Active: Attendance must be marked within <strong>{settings.allowedRadiusMeters || 200}m</strong> of school.
              </span>
            </div>
            {settings.allowOutsideAttendance && (
              <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/30">
                Bypass Allowed
              </Badge>
            )}
          </div>
        )}

        {isTeacher && settings?.allowAttendanceEditing === false && isEditingBlockedForTeacher() && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Attendance Editing Restricted</p>
                <p className="text-xs opacity-80">
                  School Admin has disabled attendance record modifications after submission without prior approval.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider px-4 shrink-0"
              onClick={() => setEditRequestModalOpen(true)}
            >
              <FileCheck className="h-4 w-4 mr-2" /> Request Permission
            </Button>
          </div>
        )}
      </div>

      <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <CardHeader className="pb-0 border-none">
          <CardTitle className="typography-card-title flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Attendance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col p-4 bg-white/95 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transform transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                  <UserCheck className="h-4 w-4" />
                </div>
                <p className="typography-label text-[10px] text-muted-foreground uppercase">Present</p>
              </div>
              <p className="typography-page-title text-emerald-600 dark:text-emerald-500">{stats.present}</p>
            </div>

            <div className="flex flex-col p-4 bg-white/95 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transform transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-50 dark:bg-amber-950/40 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50">
                  <Clock className="h-4 w-4" />
                </div>
                <p className="typography-label text-[10px] text-muted-foreground uppercase">Late</p>
              </div>
              <p className="typography-page-title text-amber-600 dark:text-amber-500">{stats.late}</p>
            </div>

            <div className="flex flex-col p-4 bg-white/95 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transform transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-rose-50 dark:bg-rose-950/40 rounded-lg flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50">
                  <UserX className="h-4 w-4" />
                </div>
                <p className="typography-label text-[10px] text-muted-foreground uppercase">Absent</p>
              </div>
              <p className="typography-page-title text-rose-600 dark:text-rose-500">{stats.absent}</p>
            </div>

            <div className="flex flex-col p-4 bg-white/95 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transform transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-sky-50 dark:bg-sky-950/40 rounded-lg flex items-center justify-center text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="typography-label text-[10px] text-muted-foreground uppercase">Excused</p>
              </div>
              <p className="typography-page-title text-sky-600 dark:text-sky-500">{stats.excused}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-6 max-w-3xl">
        <Card className="flex-1 border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <CardHeader className="pb-0 border-none">
            <CardTitle className="typography-label text-[10px] uppercase text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Attendance Date
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <DualDatePicker
              id="attendance-date"
              value={selectedDate}
              onChange={(val) => setSelectedDate(val)}
              className="bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl"
            />
            <div className="mt-2 text-xs font-semibold text-primary flex items-center gap-1.5">
              <span>Selected:</span>
              <Badge variant="outline" className="font-bold text-xs bg-primary/5 text-primary border-primary/20">
                {formatDate(selectedDate, { month: 'long', day: 'numeric', year: 'numeric' })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {settings?.attendanceMode === "session_based" && (
          <Card className="flex-1 border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <CardHeader className="pb-0 border-none">
              <CardTitle className="typography-label text-[10px] uppercase text-muted-foreground">Attendance Session</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex gap-1.5 p-1 bg-white/95 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700">
                <Button
                  variant={selectedSession === "morning" ? "default" : "ghost"}
                  onClick={() => handleSessionChange("morning")}
                  className={`typography-label flex-1 h-9 uppercase rounded-lg transition-all ${selectedSession === "morning" ? "shadow-md scale-[1.02]" : ""}`}
                >
                  Morning
                </Button>
                <Button
                  variant={selectedSession === "afternoon" ? "default" : "ghost"}
                  onClick={() => handleSessionChange("afternoon")}
                  className={`typography-label flex-1 h-9 uppercase rounded-lg transition-all ${selectedSession === "afternoon" ? "shadow-md scale-[1.02]" : ""}`}
                >
                  Afternoon
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search name, ID, or section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="flex-1 sm:flex-none w-full sm:w-[120px] h-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl">
                  <SelectValue placeholder="Grade" />
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
                <SelectTrigger className="flex-1 sm:flex-none w-full sm:w-[120px] h-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl">
                  <SelectValue placeholder="Stream" />
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
                <SelectTrigger className="flex-1 sm:flex-none w-full sm:w-[120px] h-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl">
                  <SelectValue placeholder="Section" />
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={selectedStudents.size > 0 ? markSelectedPresent : markAllAsPresent}
              disabled={isSaving}
              variant="outline"
              className="typography-label bg-white/95 dark:bg-slate-800/90 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 h-9 rounded-xl uppercase"
            >
              {selectedStudents.size > 0 ? `Mark Selected Present (${selectedStudents.size})` : "Mark All Present"}
            </Button>
            {selectedStudents.size > 0 && (
              <Button
                onClick={markSelectedAbsent}
                disabled={isSaving}
                variant="outline"
                className="typography-label bg-white/95 dark:bg-slate-800/90 border-orange-200 dark:border-orange-900 hover:bg-orange-50 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-400 h-9 rounded-xl uppercase"
              >
                Mark Selected Absent ({selectedStudents.size})
              </Button>
            )}
            <Button
              onClick={() => setShowAbsentStudents(true)}
              variant="outline"
              className="typography-label bg-white/95 dark:bg-slate-800/90 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 h-9 rounded-xl uppercase"
            >
              <UserX className="w-4 h-4 mr-2" />
              Absent ({getAbsentStudents().length})
            </Button>
            <Button
              onClick={resetAttendance}
              variant="ghost"
              className="typography-label text-muted-foreground hover:text-foreground h-9 rounded-xl uppercase"
            >
              Reset
            </Button>
            <Button
              onClick={() => setShowUnmarkedOnly(!showUnmarkedOnly)}
              variant={showUnmarkedOnly ? "default" : "outline"}
              className={`typography-label h-9 rounded-xl uppercase ${
                showUnmarkedOnly 
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm border-blue-600" 
                  : "bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground"
              }`}
            >
              Unmarked ({stats.unmarked})
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <PageSkeleton variant="table" />
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <p className="text-gray-600">No students found</p>
        </div>
      ) : uiType === "card_based" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 md:pb-0 px-1 md:px-0">
          {filteredStudents.map((student) => {
            const attendance = attendanceState[student.id] || { status: null, note: "" }
            return (
              <div 
                key={student.id} 
                className={cn(
                  "group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all",
                  attendance.status === 'present' && "ring-2 ring-emerald-500/30",
                  attendance.status === 'absent' && "ring-2 ring-rose-500/30",
                  attendance.status === 'late' && "ring-2 ring-amber-500/30",
                  attendance.status === 'excused' && "ring-2 ring-sky-500/30"
                )}
              >
                <div className="flex items-center gap-3.5 mb-5">
                  <div className="h-12 w-12 rounded-[18px] bg-primary/10 flex items-center justify-center text-primary text-base font-black border border-primary/20 shadow-inner shrink-0">
                    {(student.name || "S").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate uppercase tracking-tight leading-none mb-1.5">
                      {student.name}
                    </h3>
                    <p className="text-[9px] font-black text-slate-500/50 uppercase tracking-widest truncate">
                      {student.student_id} • {student.grade} {student.section}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'present', icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500' },
                    { id: 'late', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500' },
                    { id: 'absent', icon: UserX, color: 'text-rose-500', bg: 'bg-rose-500' },
                    { id: 'excused', icon: AlertTriangle, color: 'text-sky-500', bg: 'bg-sky-500' }
                  ].map((status) => {
                    const Icon = status.icon
                    const isActive = attendance.status === status.id
                    return (
                      <button
                        key={status.id}
                        onClick={() => updateAttendance(student.id, status.id as any)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl transition-all border",
                          isActive 
                            ? cn(status.bg, "text-white border-transparent shadow-lg shadow-current/20 scale-[1.05] z-10") 
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400"
                        )}
                      >
                        <Icon className={cn("w-4 h-4", isActive ? "text-white" : status.color)} />
                        <span className="text-[8px] font-black uppercase tracking-widest leading-none">{status.id}</span>
                      </button>
                    )
                  })}
                </div>

                {attendance.status && ["absent", "late", "excused"].includes(attendance.status) && (
                  <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <Input
                      placeholder="Reason for status..."
                      value={attendance.note}
                      onChange={(e) => updateNote(student.id, e.target.value)}
                      className="h-11 text-[11px] font-bold tracking-wide bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-primary/20 placeholder:text-slate-400/50 flex-1 px-3.5"
                    />
                    <Button
                      size="sm"
                      disabled={savingStudentId === student.id}
                      onClick={() => saveSingleStudentAttendance(student.id)}
                      className={cn(
                        "h-11 w-11 p-0 rounded-2xl text-white font-black shrink-0 transition-all shadow-md active:scale-95",
                        attendance.isDirty
                          ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                          : "bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                      )}
                      title={`Save attendance for ${student.name}`}
                    >
                      {savingStudentId === student.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : attendance.isDirty ? (
                        <Save className="w-4 h-4" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-hidden border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <div className="overflow-x-auto max-h-[600px] relative scrollbar-hide">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md z-10 border-b border-slate-200 dark:border-slate-800">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-12">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                      checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-16">Photo</TableHead>
                  <TableHead className="min-w-[150px]">Student Name</TableHead>
                  <TableHead className="w-32">Student ID</TableHead>
                  <TableHead className="w-40 xl:w-[350px] text-center">Attendance Status</TableHead>
                  <TableHead className="min-w-[150px]">Remarks</TableHead>
                  <TableHead className="w-24 text-center">Save</TableHead>
                  <TableHead className="w-24 text-center">Notify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const attendance = attendanceState[student.id] || { status: null, note: "" }
                  return (
                    <TableRow key={student.id} className={`hover:bg-blue-50/30 transition-colors ${selectedStudents.has(student.id) ? 'bg-blue-50/50' : ''}`}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="typography-label h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                          {(student.name || student.first_name || "S").charAt(0).toUpperCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="typography-label text-foreground dark:text-white">{student.name}</div>
                        <div className="typography-helper text-muted-foreground">{student.grade || ""} {student.stream || ""} {student.section || ""}</div>
                      </TableCell>
                      <TableCell className="typography-helper font-mono text-foreground dark:text-slate-300">{student.student_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {(["present", "late", "absent", "excused"] as const).map((status) => {
                            const Icon = status === 'present' ? UserCheck : status === 'late' ? Clock : status === 'absent' ? UserX : AlertTriangle;
                            return (
                              <Button
                                key={status}
                                variant={attendance.status === status ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "typography-helper capitalize h-8 px-2 xl:px-3 hover:scale-105 transition-transform flex items-center gap-1.5",
                                  attendance.status === status ? getStatusColor(status) : "text-slate-600 dark:text-slate-400"
                                )}
                                onClick={() => updateAttendance(student.id, status)}
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden xl:inline">{status}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Note..."
                          value={attendance.note}
                          onChange={(e) => updateNote(student.id, e.target.value)}
                          className="typography-helper h-8 border-gray-200 focus:border-blue-400"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant={attendance.isDirty ? "default" : "ghost"}
                          disabled={!attendance.status || savingStudentId === student.id}
                          onClick={() => saveSingleStudentAttendance(student.id)}
                          className={cn(
                            "h-8 w-8 p-0 rounded-xl transition-all mx-auto flex items-center justify-center",
                            attendance.isDirty
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              : "text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                          )}
                          title={`Save attendance for ${student.name}`}
                        >
                          {savingStudentId === student.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : attendance.isDirty ? (
                            <Save className="w-3.5 h-3.5" />
                          ) : attendance.status ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Save className="w-3.5 h-3.5 opacity-30" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {attendance.status && ["absent", "late", "excused"].includes(attendance.status) ? (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => sendStudentNotification(student.id, "email")}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => sendStudentNotification(student.id, "sms")}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400">N/A</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="typography-body text-gray-600">
        Showing {filteredStudents.length} of {students.length} students
      </div>


      <Dialog open={showAbsentStudents} onOpenChange={setShowAbsentStudents}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" />
              Absent Students - {selectedDate}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search absent students by name, ID, grade, stream, or section"
                value={absentSearchTerm}
                onChange={(e) => setAbsentSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {settings?.schoolPhone && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <span className="typography-label text-blue-900">School Phone Number:</span>
                    <span className="typography-body font-mono text-blue-700">{settings.schoolPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(settings.schoolPhone!, "School phone")}
                      className="typography-helper h-8"
                    >
                      {copiedPhone === settings.schoolPhone ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Badge variant="outline" className="typography-helper bg-white border-blue-300">
                      Call families from this number
                    </Badge>
                  </div>
                </div>
                <p className="typography-helper text-blue-600 mt-2">
                  💡 Use your school phone to call parents. Click "Call" buttons below to dial parent numbers.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <p className="typography-body text-gray-600">
                Showing {getFilteredAbsentStudents().length} of {getAbsentStudents().length} absent students
              </p>
              {getAbsentStudents().length === 0 && (
                <Badge className="bg-green-100 text-green-800">No absent students today!</Badge>
              )}
            </div>

            {getAbsentStudents().length === 0 ? (
              <div className="text-center py-12">
                <UserX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="typography-label text-gray-600">No absent students for this date</p>
                <p className="typography-body text-gray-500 mt-1">All students are marked as present, late, or excused</p>
              </div>
            ) : getFilteredAbsentStudents().length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="typography-label text-gray-600">No students found</p>
                <p className="typography-body text-gray-500 mt-1">Try adjusting your search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                {getFilteredAbsentStudents().map((student) => {
                  const attendance = attendanceState[student.id]
                  return (
                    <Card key={student.id} className="border-red-200 bg-red-50/30">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="typography-label h-10 w-10 rounded-full bg-red-600 flex items-center justify-center text-white">
                              {(student.name || student.first_name || "S").charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="typography-label text-foreground dark:text-white truncate">{student.name}</div>
                            <div className="typography-helper text-muted-foreground mt-0.5">ID: {student.student_id || ""}</div>
                            <div className="typography-helper text-muted-foreground">
                              {student.grade || ""} {student.stream || ""} {student.section || ""}
                            </div>
                            <div className="mt-3 space-y-2">
                              <div className="typography-helper">
                                <span className="typography-label text-foreground dark:text-slate-200">Parent:</span>
                                <span className="text-muted-foreground ml-1">{student.parent_name}</span>
                              </div>
                              <div className="typography-helper">
                                <span className="typography-label text-foreground dark:text-slate-200">Email:</span>
                                <span className="text-muted-foreground ml-1 break-all">{student.parent_email}</span>
                              </div>
                              <div className="bg-white border border-gray-200 rounded-lg p-2 mt-2">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="typography-helper text-gray-700">Parent Phone:</span>
                                  <span className="typography-label font-mono text-gray-900">
                                    {student.parent_phone}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => initiateCall(student.parent_phone || "", settings?.schoolPhone)}
                                    className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <Phone className="w-3 h-3 mr-1" />
                                    Call Family
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(student.parent_phone || "", "Parent phone")}
                                    className="h-8 px-3"
                                  >
                                    {copiedPhone === student.parent_phone ? (
                                      <Check className="w-3 h-3" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                                {settings?.schoolPhone && (
                                  <div className="typography-helper text-blue-600 mt-2 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <span>Call from: {settings.schoolPhone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {attendance?.note && (
                              <div className="mt-2 pt-2 border-t border-red-200">
                                <p className="typography-helper text-gray-700">
                                  <span className="typography-label">Note:</span> {attendance.note}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {getAbsentStudents().length > 0 && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAbsentStudents(false)
                    setAbsentSearchTerm("")
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={async () => {
                    setShowAbsentStudents(false)
                    await sendEmailNotifications()
                  }}
                  disabled={isSendingNotifications}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Notifications to Absent Students
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showSessionConfirm} onOpenChange={setShowSessionConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Session Change</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="typography-body text-gray-600">
              You are selecting the <span className="typography-label text-blue-600 capitalize">{pendingSession}</span> session, 
              but it is currently <span className="typography-label text-orange-600">{parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour12: false, hour: 'numeric' }), 10) < 12 ? "Morning" : "Afternoon"}</span>. 
              Are you sure you want to take attendance for the {pendingSession} session?
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowSessionConfirm(false)}>Cancel</Button>
            <Button onClick={confirmSessionChange}>Confirm and Proceed</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Request Edit Permission Dialog */}
      <Dialog open={editRequestModalOpen} onOpenChange={setEditRequestModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Request Attendance Edit Permission
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Editing attendance for <strong>{selectedDate}</strong> ({selectedSession}) is currently restricted. Submit a request to the School Admin for approval.
            </p>
            <div>
              <Label htmlFor="editReason" className="text-xs font-semibold">
                Reason for Edit Request (Optional)
              </Label>
              <Textarea
                id="editReason"
                rows={3}
                placeholder="e.g. Correcting inadvertent late status for Grade 8A students..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="mt-1 text-sm rounded-xl"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEditRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestPermission} disabled={isSubmittingRequest} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isSubmittingRequest ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Edit Requests Modal */}
      <Dialog open={showRequestsModal} onOpenChange={setShowRequestsModal}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-blue-600" />
              Attendance Edit Requests
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {editRequests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileCheck className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p>No attendance edit requests found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {editRequests.map((req: any) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{req.teacher?.name || "Teacher"}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "uppercase text-[10px]",
                            req.status === "PENDING" && "bg-amber-50 text-amber-700 border-amber-300",
                            req.status === "APPROVED" && "bg-emerald-50 text-emerald-700 border-emerald-300",
                            req.status === "REJECTED" && "bg-rose-50 text-rose-700 border-rose-300"
                          )}
                        >
                          {req.status}
                        </Badge>
                        {req.isUsed && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 text-[10px]">
                            Permission Used
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Requested Date: <strong>{req.date?.split("T")[0]}</strong> {req.session ? `(${req.session})` : ""}
                      </p>
                      {req.reason && <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{req.reason}"</p>}
                    </div>

                    {!isTeacher && req.status === "PENDING" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          placeholder="Admin note..."
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          className="h-8 text-xs w-36"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(req.id)}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(req.id)}
                          className="h-8 border-rose-300 text-rose-700 hover:bg-rose-50 text-xs px-3"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Attendance Audit Logs Modal */}
      <Dialog open={showAuditLogsModal} onOpenChange={setShowAuditLogsModal}>
        <DialogContent className="max-w-4xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Attendance Audit Logs
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {auditLogs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <History className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p>No audit logs available.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-semibold uppercase">
                        <Badge variant="outline" className="text-[10px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.entity_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.new_values ? JSON.stringify(log.new_values) : log.old_values ? JSON.stringify(log.old_values) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile & Tablet Sticky Action Bar */}
      <div className="lg:hidden fixed bottom-24 md:bottom-6 left-0 right-0 z-40 px-4 pb-safe pointer-events-none">
        <div className="bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-xl rounded-[32px] p-2.5 border border-white/10 shadow-2xl flex items-center gap-2 pointer-events-auto max-w-lg mx-auto transform translate-y-[-10px]">
          <div className="flex-1 flex items-center gap-1 px-4">
            <div className="text-left">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-tight">Unmarked</p>
              <p className="text-base font-black text-white leading-none">{stats.unmarked}</p>
            </div>
            <div className="w-px h-6 bg-white/10 mx-3" />
            <div className="text-left">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-tight">Present</p>
              <p className="text-base font-black text-emerald-400 leading-none">{stats.present}</p>
            </div>
          </div>
          
          <Button
            onClick={saveAttendance}
            disabled={isSaving}
            className="h-12 px-8 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all outline-none"
          >
            {isSaving ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}


