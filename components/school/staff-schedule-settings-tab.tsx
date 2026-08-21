"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import {
  Clock,
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Sparkles,
  MapPin,
  CalendarOff,
  Sun,
  Sunset,
  Info,
  LayoutList,
  Layers,
  Lock,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  AlertCircle,
  AlertTriangle,
  Save,
} from "lucide-react"
import { EthiopianTimeInput } from "@/components/ui/ethiopian-time-input"
import { formatEthiopianTime, formatHHMMAs12h } from "@/lib/utils/ethiopian-time"
import {
  validateAllScheduleSettings,
  validateSessionSchedule,
  validateDailySchedule,
  addMinutesToHHMM,
  getMinutesDiff,
  timeToMinutes,
  ValidationError,
  ValidationResult,
} from "@/lib/utils/schedule-validation"
import { cn } from "@/lib/utils/utils"

export interface StaffSession {
  id: "morning" | "afternoon"
  name: "Morning" | "Afternoon"
  startTime: string
  endTime: string
  lateGraceMinutes: number
  earlyDepartureToleranceMinutes: number
  absenceCutoffMinutes: number
  absenceCutoffTime: string
  earliestCheckinTime: string
  latestCheckoutTime: string
  allowCheckinAfterCutoff?: boolean
  isActive: boolean
}

export const DEFAULT_FIXED_SESSIONS: StaffSession[] = [
  {
    id: "morning",
    name: "Morning",
    startTime: "08:00",
    endTime: "12:30",
    lateGraceMinutes: 15,
    earlyDepartureToleranceMinutes: 10,
    absenceCutoffMinutes: 90,
    absenceCutoffTime: "09:30",
    earliestCheckinTime: "06:00",
    latestCheckoutTime: "13:30",
    allowCheckinAfterCutoff: false,
    isActive: true,
  },
  {
    id: "afternoon",
    name: "Afternoon",
    startTime: "13:30",
    endTime: "17:00",
    lateGraceMinutes: 10,
    earlyDepartureToleranceMinutes: 10,
    absenceCutoffMinutes: 90,
    absenceCutoffTime: "15:00",
    earliestCheckinTime: "12:30",
    latestCheckoutTime: "18:30",
    allowCheckinAfterCutoff: false,
    isActive: true,
  },
]

function parseSessionsFromSettings(raw: any): StaffSession[] {
  let arr: any[] = []
  if (raw) {
    try {
      arr = typeof raw === "string" ? JSON.parse(raw) : raw
      if (!Array.isArray(arr)) arr = []
    } catch (_) {
      arr = []
    }
  }

  const find = (key: "morning" | "afternoon") =>
    arr.find((s: any) => s && (s.id === key || s.name?.toLowerCase() === key))

  const morningRaw = find("morning")
  const afternoonRaw = find("afternoon")

  const merge = (
    key: "morning" | "afternoon",
    name: "Morning" | "Afternoon",
    r: any,
    fallback: StaffSession
  ): StaffSession => {
    const rawStartTime = r?.startTime || r?.start_time
    const startTime = rawStartTime || fallback.startTime

    const rawEndTime = r?.endTime || r?.end_time
    const endTime = rawEndTime || fallback.endTime

    const rawLateGrace = r?.lateGraceMinutes ?? r?.late_grace_minutes
    const lateGraceMinutes =
      Number.isFinite(Number(rawLateGrace)) && Number(rawLateGrace) >= 0
        ? Math.floor(Number(rawLateGrace))
        : fallback.lateGraceMinutes

    const rawEarlyTol = r?.earlyDepartureToleranceMinutes ?? r?.early_departure_tolerance_minutes
    const earlyDepartureToleranceMinutes =
      Number.isFinite(Number(rawEarlyTol)) && Number(rawEarlyTol) >= 0
        ? Math.floor(Number(rawEarlyTol))
        : fallback.earlyDepartureToleranceMinutes

    const rawCutoffMins = r?.absenceCutoffMinutes ?? r?.absence_cutoff_minutes
    let absenceCutoffMinutes =
      Number.isFinite(Number(rawCutoffMins)) && Number(rawCutoffMins) >= 0
        ? Math.floor(Number(rawCutoffMins))
        : fallback.absenceCutoffMinutes

    const rawCutoffTime = r?.absenceCutoffTime || r?.absence_cutoff_time
    let absenceCutoffTime: string
    if (typeof rawCutoffTime === "string" && rawCutoffTime.includes(":")) {
      absenceCutoffTime = rawCutoffTime
      const diff = getMinutesDiff(absenceCutoffTime, startTime)
      if (diff > 0) {
        absenceCutoffMinutes = diff
      } else {
        absenceCutoffTime = addMinutesToHHMM(startTime, absenceCutoffMinutes)
      }
    } else {
      absenceCutoffTime = addMinutesToHHMM(startTime, absenceCutoffMinutes)
    }

    const rawEarliest = r?.earliestCheckinTime || r?.earliestCheckInTime || r?.earliest_checkin_time
    const earliestCheckinTime = rawEarliest || fallback.earliestCheckinTime

    const rawLatest = r?.latestCheckoutTime || r?.latestCheckOutTime || r?.latest_checkout_time
    const latestCheckoutTime = rawLatest || fallback.latestCheckoutTime

    return {
      id: key,
      name,
      startTime,
      endTime,
      lateGraceMinutes,
      earlyDepartureToleranceMinutes,
      absenceCutoffMinutes,
      absenceCutoffTime,
      earliestCheckinTime,
      latestCheckoutTime,
      allowCheckinAfterCutoff: (r?.allowCheckinAfterCutoff ?? r?.allow_checkin_after_cutoff) === true,
      isActive: (r?.isActive ?? r?.is_active) !== false,
    }
  }

  return [
    merge("morning", "Morning", morningRaw, DEFAULT_FIXED_SESSIONS[0]),
    merge("afternoon", "Afternoon", afternoonRaw, DEFAULT_FIXED_SESSIONS[1]),
  ]
}

const ALL_WEEKDAYS = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
  { key: "SUNDAY", label: "Sunday", short: "Sun" },
]

const HOLIDAY_TYPES = [
  { value: "PUBLIC_HOLIDAY", label: "Public Holiday", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "RELIGIOUS_HOLIDAY", label: "Religious Holiday", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "SCHOOL_HOLIDAY", label: "School Holiday / Break", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "SPECIAL_CLOSURE", label: "Special School Closure", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "OTHER", label: "Other Non-Working Day", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
]

// ── Inline Field Error Component ──
function FieldError({ error }: { error?: string }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-semibold leading-tight animate-in fade-in slide-in-from-top-1 duration-150">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{error}</span>
    </div>
  )
}

export function StaffScheduleSettingsTab({
  settings,
  setSettings,
  onSaveSettings,
  isSaving,
}: {
  settings: any
  setSettings: React.Dispatch<React.SetStateAction<any>>
  onSaveSettings: () => Promise<void>
  isSaving: boolean
}) {
  const [holidays, setHolidays] = useState<any[]>([])
  const [loadingHolidays, setLoadingHolidays] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<any | null>(null)
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false)

  // ── Fixed Session Management State (Morning & Afternoon) ──
  const [sessions, setSessions] = useState<StaffSession[]>(() => parseSessionsFromSettings(settings?.staffSessions ?? settings?.staff_sessions))
  const [expandedSessions, setExpandedSessions] = useState<{ morning: boolean; afternoon: boolean }>({
    morning: true,
    afternoon: true,
  })

  const toggleSessionExpand = (id: "morning" | "afternoon") => {
    setExpandedSessions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Sync sessions state when settings change
  useEffect(() => {
    setSessions(parseSessionsFromSettings(settings?.staffSessions ?? settings?.staff_sessions))
  }, [settings?.staffSessions, settings?.staff_sessions])

  const persistSessions = (updated: StaffSession[]) => {
    setSessions(updated)
    setSettings((prev: any) => ({ ...prev, staffSessions: updated, staff_sessions: updated }))
  }

  // Live validation computation
  const validationResult: ValidationResult = useMemo(() => {
    return validateAllScheduleSettings(settings, sessions)
  }, [settings, sessions])

  // Update field for a specific fixed session with bidirectional absence sync
  const updateSessionField = (id: "morning" | "afternoon", field: keyof StaffSession, value: any) => {
    const updated = sessions.map((s) => {
      if (s.id !== id) return s
      const copy = { ...s, [field]: value }

      // Bidirectional sync for absence cutoff
      if (field === "startTime") {
        copy.absenceCutoffTime = addMinutesToHHMM(value, s.absenceCutoffMinutes)
      } else if (field === "absenceCutoffMinutes") {
        const mins = Math.max(0, Number(value) || 0)
        copy.absenceCutoffMinutes = mins
        copy.absenceCutoffTime = addMinutesToHHMM(s.startTime, mins)
      } else if (field === "absenceCutoffTime") {
        copy.absenceCutoffTime = value
        const diff = getMinutesDiff(value, s.startTime)
        if (diff > 0) {
          copy.absenceCutoffMinutes = diff
        } else {
          copy.absenceCutoffMinutes = 0
        }
      }

      return copy
    })
    persistSessions(updated)
  }

  // Update Daily mode field with bidirectional absence sync
  const updateDailyField = (field: string, value: any) => {
    setSettings((prev: any) => {
      const copy = { ...prev, [field]: value }
      const startTime = field === "staffWorkStartTime" ? value : prev.staffWorkStartTime || "08:00"

      if (field === "staffWorkStartTime") {
        const mins = Number(prev.staffAbsenceCutoffMinutes) || 120
        copy.staffAbsenceCutoffTime = addMinutesToHHMM(value, mins)
      } else if (field === "staffAbsenceCutoffMinutes") {
        const mins = Math.max(0, Number(value) || 0)
        copy.staffAbsenceCutoffMinutes = mins
        copy.staffAbsenceCutoffTime = addMinutesToHHMM(startTime, mins)
      } else if (field === "staffAbsenceCutoffTime") {
        copy.staffAbsenceCutoffTime = value
        const diff = getMinutesDiff(value, startTime)
        if (diff > 0) {
          copy.staffAbsenceCutoffMinutes = diff
        } else {
          copy.staffAbsenceCutoffMinutes = 0
        }
      }

      return copy
    })
  }

  // Guarded save button action
  const handleSaveWithValidation = async () => {
    const res = validateAllScheduleSettings(settings, sessions)
    if (!res.isValid) {
      const firstError = res.errors[0]?.message || "Please resolve schedule validation errors before saving."
      notifications.error("Validation Error", firstError)
      return
    }
    await onSaveSettings()
  }

  useEffect(() => {
    loadHolidays()
    const handler = () => loadHolidays()
    window.addEventListener("holidaysDataChanged", handler)
    return () => window.removeEventListener("holidaysDataChanged", handler)
  }, [])

  // Form state for holiday dialog
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    type: "PUBLIC_HOLIDAY",
    isRange: false,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    description: "",
    isActive: true,
  })

  const loadHolidays = async () => {
    try {
      setLoadingHolidays(true)
      const data = await db.getHolidays({ includeInactive: true })
      setHolidays(data)
    } catch (err: any) {
      console.error("Failed to load holidays:", err)
    } finally {
      setLoadingHolidays(false)
    }
  }

  // Parse working days from comma-separated string
  const currentWorkingDays: string[] = (settings.staffWorkingDays || "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY")
    .split(",")
    .map((d: string) => d.trim().toUpperCase())
    .filter(Boolean)

  const toggleWorkingDay = (dayKey: string) => {
    let next: string[]
    if (currentWorkingDays.includes(dayKey)) {
      if (currentWorkingDays.length === 1) {
        notifications.error("Working Days", "At least one working day must be configured.")
        return
      }
      next = currentWorkingDays.filter((d) => d !== dayKey)
    } else {
      next = [...currentWorkingDays, dayKey]
    }
    setSettings((prev: any) => ({
      ...prev,
      staffWorkingDays: next.join(","),
    }))
  }

  const applyPreset = (preset: "mon-fri" | "mon-sat" | "all") => {
    let days: string[]
    if (preset === "mon-fri") days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    else if (preset === "mon-sat") days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    else days = ALL_WEEKDAYS.map((w) => w.key)

    setSettings((prev: any) => ({
      ...prev,
      staffWorkingDays: days.join(","),
    }))
    notifications.info("Preset Applied", `Working days set to ${days.join(", ")}`)
  }

  // Daily Mode dynamic threshold calculations (display strings)
  const computeDailyLateCutoff = () => {
    const start = settings.staffWorkStartTime || "08:00"
    const grace = parseInt(settings.staffLateGraceMinutes || "15", 10) || 0
    return formatHHMMAs12h(addMinutesToHHMM(start, grace))
  }

  const computeDailyEarlyCutoff = () => {
    const end = settings.staffWorkEndTime || "17:00"
    const tol = parseInt(settings.staffEarlyCheckoutToleranceMinutes || "15", 10) || 0
    return formatHHMMAs12h(addMinutesToHHMM(end, -tol))
  }

  const computeDailyAbsenceCutoff = () => {
    if (settings.staffAbsenceCutoffTime) return formatHHMMAs12h(settings.staffAbsenceCutoffTime)
    const start = settings.staffWorkStartTime || "08:00"
    const mins = parseInt(settings.staffAbsenceCutoffMinutes ?? "120", 10) || 120
    return formatHHMMAs12h(addMinutesToHHMM(start, mins))
  }

  // Holiday Modal Handlers
  const handleOpenAddHoliday = () => {
    setEditingHoliday(null)
    const today = new Date().toISOString().split("T")[0]
    setHolidayForm({
      name: "",
      type: "PUBLIC_HOLIDAY",
      isRange: false,
      startDate: today,
      endDate: today,
      description: "",
      isActive: true,
    })
    setModalOpen(true)
  }

  const handleOpenEditHoliday = (h: any) => {
    setEditingHoliday(h)
    const sDate = h.startDate ? new Date(h.startDate).toISOString().split("T")[0] : ""
    const eDate = h.endDate ? new Date(h.endDate).toISOString().split("T")[0] : ""
    setHolidayForm({
      name: h.name,
      type: h.type || "PUBLIC_HOLIDAY",
      isRange: sDate !== eDate,
      startDate: sDate,
      endDate: eDate,
      description: h.description || "",
      isActive: h.isActive !== false,
    })
    setModalOpen(true)
  }

  const handleSaveHoliday = async () => {
    if (!holidayForm.name.trim()) {
      notifications.error("Validation", "Holiday name is required.")
      return
    }
    const finalEndDate = holidayForm.isRange ? holidayForm.endDate : holidayForm.startDate
    if (holidayForm.startDate > finalEndDate) {
      notifications.error("Validation", "Start date cannot be after end date.")
      return
    }

    try {
      setIsSubmittingHoliday(true)
      const payload = {
        name: holidayForm.name.trim(),
        type: holidayForm.type,
        startDate: holidayForm.startDate,
        endDate: finalEndDate,
        description: holidayForm.description.trim() || undefined,
        isActive: holidayForm.isActive,
      }

      if (editingHoliday) {
        await db.updateHoliday(editingHoliday.id, payload)
        notifications.success("Holiday Updated", `"${payload.name}" updated successfully.`)
      } else {
        await db.addHoliday(payload)
        notifications.success("Holiday Added", `"${payload.name}" added to calendar.`)
      }

      setModalOpen(false)
      loadHolidays()
      window.dispatchEvent(new Event("holidaysDataChanged"))
    } catch (err: any) {
      console.error("Failed to save holiday:", err)
      notifications.error("Error", err.message || "Failed to save holiday.")
    } finally {
      setIsSubmittingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      await db.deleteHoliday(id)
      notifications.success("Holiday Deleted", `"${name}" removed.`)
      loadHolidays()
      window.dispatchEvent(new Event("holidaysDataChanged"))
    } catch (err: any) {
      console.error("Failed to delete holiday:", err)
      notifications.error("Error", err.message || "Failed to delete holiday.")
    }
  }

  const isSessionBased = (settings.staffAttendanceMode || "daily") === "session_based"
  const morningSession = sessions[0] || DEFAULT_FIXED_SESSIONS[0]
  const afternoonSession = sessions[1] || DEFAULT_FIXED_SESSIONS[1]

  const errors = validationResult.errorMap

  return (
    <div className="space-y-8">
      {/* ── Top Header Action Bar with Save Button ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-[24px] bg-gradient-to-r from-primary/10 via-indigo-500/5 to-cyan-500/10 border border-white/50 dark:border-white/10 backdrop-blur-2xl shadow-xl shadow-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/25">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Staff Working Schedule &amp; Shifts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure check-in/out windows, late grace periods, absence cutoffs, and working days.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <Button
            onClick={handleSaveWithValidation}
            disabled={isSaving || !validationResult.isValid}
            className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white shadow-lg shadow-primary/25 active:scale-95 gap-2"
          >
            <Save className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
            <span>{isSaving ? "Saving Settings..." : "Save Schedule Settings"}</span>
          </Button>
        </div>
      </div>

      {/* Global Validation Warning Banner */}
      {!validationResult.isValid && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-800 dark:text-rose-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Schedule Configuration Requires Attention</span>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-300">
            Please resolve the following issue{validationResult.errors.length > 1 ? "s" : ""} before saving settings:
          </p>
          <ul className="list-disc list-inside text-xs space-y-1 text-rose-700 dark:text-rose-300">
            {validationResult.errors.map((e, idx) => (
              <li key={idx}><strong>{e.message}</strong></li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── SECTION 1: ATTENDANCE TRACKING MODE ──────────────────────────── */}
      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Staff Attendance Mode</CardTitle>
              <CardDescription className="text-xs">
                Select between a single full-day schedule or dual morning & afternoon shifts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Mode Card */}
            <div
              onClick={() => setSettings({ ...settings, staffAttendanceMode: "daily" })}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3",
                !isSessionBased
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border hover:border-border/80 bg-card/40 opacity-70 hover:opacity-100"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", !isSessionBased ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Daily Mode</h4>
                    <p className="text-[11px] text-muted-foreground">Single Check-In & Check-Out per day</p>
                  </div>
                </div>
                {!isSessionBased && (
                  <Badge className="bg-primary text-white text-[10px] font-bold">Active</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Staff check in once in the morning and out in the evening. Status is evaluated against one unified schedule.
              </p>
            </div>

            {/* Session-Based Mode Card */}
            <div
              onClick={() => setSettings({ ...settings, staffAttendanceMode: "session_based" })}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3",
                isSessionBased
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border hover:border-border/80 bg-card/40 opacity-70 hover:opacity-100"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isSessionBased ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    <LayoutList className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Session-Based Mode</h4>
                    <p className="text-[11px] text-muted-foreground">Morning & Afternoon Shifts</p>
                  </div>
                </div>
                {isSessionBased && (
                  <Badge className="bg-primary text-white text-[10px] font-bold">Active</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Independent tracking for Morning and Afternoon sessions with separate check-in windows, cutoffs, and metrics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 2: SCHEDULE CONFIGURATION ────────────────────────────── */}
      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">
                  {isSessionBased ? "Morning & Afternoon Session Schedules" : "Daily Working Schedule & Thresholds"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isSessionBased
                    ? "Configure official arrival, departure, late grace, and absence cutoffs for Morning and Afternoon."
                    : "Configure official arrival, departure, late grace, and absence cutoffs for standard full-day shifts."}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-medium">
              Africa/Addis_Ababa (12h AM/PM)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {isSessionBased ? (
            /* ══════ SESSION-BASED MODE: MORNING & AFTERNOON CARDS ══════ */
            <div className="space-y-6">
              {/* Cross-session Error Banner */}
              {(errors["sessions.order"] || errors["sessions.overlap"]) && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs font-bold space-y-0.5">
                    {errors["sessions.order"] && <p>{errors["sessions.order"]}</p>}
                    {errors["sessions.overlap"] && <p>{errors["sessions.overlap"]}</p>}
                  </div>
                </div>
              )}

              {/* ── 1. MORNING SESSION CARD ── */}
              <div className={cn(
                "rounded-2xl border-2 overflow-hidden transition-all shadow-xs",
                errors["morning.startTime"] || errors["morning.endTime"] || errors["morning.lateGraceMinutes"] || errors["morning.earlyDepartureToleranceMinutes"] || errors["morning.absenceCutoffTime"]
                  ? "border-rose-500/50 bg-rose-500/5"
                  : "border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent"
              )}>
                {/* Clickable Card Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSessionExpand("morning")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSessionExpand("morning") }}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-amber-500/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-base text-foreground">Morning Session</span>
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
                          Fixed Session
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-bold", morningSession.isActive ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10" : "text-slate-400 border-slate-400/30")}>
                          {morningSession.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      {/* Quick Summary Chips */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-muted-foreground">
                        <span className="font-mono font-bold text-foreground">
                          🕒 {formatHHMMAs12h(morningSession.startTime)} – {formatHHMMAs12h(morningSession.endTime)}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{morningSession.lateGraceMinutes}m grace
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          Cutoff: {formatHHMMAs12h(morningSession.absenceCutoffTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-500/20" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="morningActive" className="text-xs font-semibold cursor-pointer">
                        {morningSession.isActive ? "Active" : "Inactive"}
                      </Label>
                      <Switch
                        id="morningActive"
                        checked={morningSession.isActive}
                        onCheckedChange={(checked) => updateSessionField("morning", "isActive", checked)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSessionExpand("morning")}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold gap-1 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{expandedSessions.morning ? "Hide Config" : "Configure"}</span>
                      {expandedSessions.morning ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* 8 Configuration Fields for Morning */}
                {expandedSessions.morning && (
                  <div className="p-5 pt-3 border-t border-amber-500/20 space-y-5 bg-background/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Field 1: Start Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected Start / Check-in Time</Label>
                        <EthiopianTimeInput
                          value={morningSession.startTime}
                          onChange={(val) => updateSessionField("morning", "startTime", val)}
                          className="mt-1"
                        />
                        <FieldError error={errors["morning.startTime"]} />
                      </div>

                      {/* Field 2: Late Grace */}
                      <div>
                        <Label className="text-xs font-semibold">Late Grace Period (Minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="180"
                          value={morningSession.lateGraceMinutes}
                          onChange={(e) => updateSessionField("morning", "lateGraceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn("mt-1 font-mono", errors["morning.lateGraceMinutes"] && "border-rose-500")}
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          Late after {formatHHMMAs12h(addMinutesToHHMM(morningSession.startTime, morningSession.lateGraceMinutes))}
                        </p>
                        <FieldError error={errors["morning.lateGraceMinutes"]} />
                      </div>

                      {/* Field 3: End Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected End / Check-out Time</Label>
                        <EthiopianTimeInput
                          value={morningSession.endTime}
                          onChange={(val) => updateSessionField("morning", "endTime", val)}
                          className="mt-1"
                        />
                        <FieldError error={errors["morning.endTime"]} />
                      </div>

                      {/* Field 4: Early Checkout Tolerance */}
                      <div>
                        <Label className="text-xs font-semibold">Early Departure Tolerance (Min)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="180"
                          value={morningSession.earlyDepartureToleranceMinutes}
                          onChange={(e) => updateSessionField("morning", "earlyDepartureToleranceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn("mt-1 font-mono", errors["morning.earlyDepartureToleranceMinutes"] && "border-rose-500")}
                        />
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          Early departure before {formatHHMMAs12h(addMinutesToHHMM(morningSession.endTime, -morningSession.earlyDepartureToleranceMinutes))}
                        </p>
                        <FieldError error={errors["morning.earlyDepartureToleranceMinutes"]} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                      {/* Field 5: Absence Cutoff Time */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff Time</Label>
                        <EthiopianTimeInput
                          value={morningSession.absenceCutoffTime}
                          onChange={(val) => updateSessionField("morning", "absenceCutoffTime", val)}
                          className="mt-1"
                        />
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                          Auto-marked Absent after {formatHHMMAs12h(morningSession.absenceCutoffTime)}
                        </p>
                        <FieldError error={errors["morning.absenceCutoffTime"]} />
                      </div>

                      {/* Field 6: Absence Cutoff Minutes */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff (Minutes from Start)</Label>
                        <Input
                          type="number"
                          min="5"
                          max="360"
                          value={morningSession.absenceCutoffMinutes}
                          onChange={(e) => updateSessionField("morning", "absenceCutoffMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn("mt-1 font-mono", errors["morning.absenceCutoffMinutes"] && "border-rose-500")}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Synchronized with cutoff time</p>
                        <FieldError error={errors["morning.absenceCutoffMinutes"]} />
                      </div>

                      {/* Field 7: Earliest Allowed Check-in */}
                      <div>
                        <Label className="text-xs font-semibold">Earliest Allowed Check-in</Label>
                        <EthiopianTimeInput
                          value={morningSession.earliestCheckinTime}
                          onChange={(val) => updateSessionField("morning", "earliestCheckinTime", val)}
                          helperText="Check-in blocked before this time"
                          className="mt-1"
                        />
                        <FieldError error={errors["morning.earliestCheckinTime"]} />
                      </div>

                      {/* Field 8: Latest Allowed Check-out */}
                      <div>
                        <Label className="text-xs font-semibold">Latest Allowed Check-out</Label>
                        <EthiopianTimeInput
                          value={morningSession.latestCheckoutTime}
                          onChange={(val) => updateSessionField("morning", "latestCheckoutTime", val)}
                          helperText="Maximum allowed shift boundary"
                          className="mt-1"
                        />
                        <FieldError error={errors["morning.latestCheckoutTime"]} />
                      </div>
                    </div>

                    {/* Morning Session Timeline Helper */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Morning Session Lifecycle Timeline (12h AM/PM):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-background/80 border border-border">
                          <span className="font-bold text-slate-600 dark:text-slate-400 block">1. Not Started</span>
                          <span className="opacity-80">Before {formatHHMMAs12h(morningSession.earliestCheckinTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 block">2. On Time Check-In</span>
                          <span className="opacity-80">{formatHHMMAs12h(morningSession.startTime)} – {formatHHMMAs12h(addMinutesToHHMM(morningSession.startTime, morningSession.lateGraceMinutes))}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <span className="font-bold text-amber-700 dark:text-amber-300 block">3. Late Check-In</span>
                          <span className="opacity-80">{formatHHMMAs12h(addMinutesToHHMM(morningSession.startTime, morningSession.lateGraceMinutes))} – {formatHHMMAs12h(morningSession.absenceCutoffTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <span className="font-bold text-rose-700 dark:text-rose-300 block">4. Automatic Absent</span>
                          <span className="opacity-80">After {formatHHMMAs12h(morningSession.absenceCutoffTime)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Allow Check-In After Cutoff Toggle */}
                    <div className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-colors",
                      morningSession.allowCheckinAfterCutoff
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/20"
                    )}>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground">Allow Staff Check-In After Absence Cutoff</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {morningSession.allowCheckinAfterCutoff
                            ? `Enabled — Staff may still check in after ${formatHHMMAs12h(morningSession.absenceCutoffTime)} (recorded as Late).`
                            : `Disabled — Check-in button locks at ${formatHHMMAs12h(morningSession.absenceCutoffTime)}. Absent is auto-marked.`}
                        </p>
                      </div>
                      <Switch
                        id="morningAllowCheckinAfterCutoff"
                        checked={!!morningSession.allowCheckinAfterCutoff}
                        onCheckedChange={(checked) => updateSessionField("morning", "allowCheckinAfterCutoff", checked)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── 2. AFTERNOON SESSION CARD ── */}
              <div className={cn(
                "rounded-2xl border-2 overflow-hidden transition-all shadow-xs",
                errors["afternoon.startTime"] || errors["afternoon.endTime"] || errors["afternoon.lateGraceMinutes"] || errors["afternoon.earlyDepartureToleranceMinutes"] || errors["afternoon.absenceCutoffTime"]
                  ? "border-rose-500/50 bg-rose-500/5"
                  : "border-indigo-500/30 bg-gradient-to-b from-indigo-500/5 to-transparent"
              )}>
                {/* Clickable Card Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSessionExpand("afternoon")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSessionExpand("afternoon") }}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-indigo-500/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Sunset className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-base text-foreground">Afternoon Session</span>
                        <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                          Fixed Session
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-bold", afternoonSession.isActive ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10" : "text-slate-400 border-slate-400/30")}>
                          {afternoonSession.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      {/* Quick Summary Chips */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-muted-foreground">
                        <span className="font-mono font-bold text-foreground">
                          🕒 {formatHHMMAs12h(afternoonSession.startTime)} – {formatHHMMAs12h(afternoonSession.endTime)}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{afternoonSession.lateGraceMinutes}m grace
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          Cutoff: {formatHHMMAs12h(afternoonSession.absenceCutoffTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-indigo-500/20" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="afternoonActive" className="text-xs font-semibold cursor-pointer">
                        {afternoonSession.isActive ? "Active" : "Inactive"}
                      </Label>
                      <Switch
                        id="afternoonActive"
                        checked={afternoonSession.isActive}
                        onCheckedChange={(checked) => updateSessionField("afternoon", "isActive", checked)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSessionExpand("afternoon")}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold gap-1 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{expandedSessions.afternoon ? "Hide Config" : "Configure"}</span>
                      {expandedSessions.afternoon ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* 8 Configuration Fields for Afternoon */}
                {expandedSessions.afternoon && (
                  <div className="p-5 pt-3 border-t border-indigo-500/20 space-y-5 bg-background/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Field 1: Start Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected Start / Check-in Time</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.startTime}
                          onChange={(val) => updateSessionField("afternoon", "startTime", val)}
                          className="mt-1"
                        />
                        <FieldError error={errors["afternoon.startTime"]} />
                      </div>

                      {/* Field 2: Late Grace */}
                      <div>
                        <Label className="text-xs font-semibold">Late Grace Period (Minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="180"
                          value={afternoonSession.lateGraceMinutes}
                          onChange={(e) => updateSessionField("afternoon", "lateGraceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn("mt-1 font-mono", errors["afternoon.lateGraceMinutes"] && "border-rose-500")}
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          Late after {formatHHMMAs12h(addMinutesToHHMM(afternoonSession.startTime, afternoonSession.lateGraceMinutes))}
                        </p>
                        <FieldError error={errors["afternoon.lateGraceMinutes"]} />
                      </div>

                      {/* Field 3: End Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected End / Check-out Time</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.endTime}
                          onChange={(val) => updateSessionField("afternoon", "endTime", val)}
                          className="mt-1"
                        />
                        <FieldError error={errors["afternoon.endTime"]} />
                      </div>

                      {/* Field 4: Early Checkout Tolerance */}
                      <div>
                        <Label className="text-xs font-semibold">Early Departure Tolerance (Min)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="180"
                          value={afternoonSession.earlyDepartureToleranceMinutes}
                          onChange={(e) => updateSessionField("afternoon", "earlyDepartureToleranceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn("mt-1 font-mono", errors["afternoon.earlyDepartureToleranceMinutes"] && "border-rose-500")}
                        />
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          Early departure before {formatHHMMAs12h(addMinutesToHHMM(afternoonSession.endTime, -afternoonSession.earlyDepartureToleranceMinutes))}
                        </p>
                        <FieldError error={errors["afternoon.earlyDepartureToleranceMinutes"]} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                      {/* Field 5: Absence Cutoff Time */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff Time</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.absenceCutoffTime}
                          onChange={(val) => updateSessionField("afternoon", "absenceCutoffTime", val)}
                          className="mt-1"
                        />
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                          Auto-marked Absent after {formatHHMMAs12h(afternoonSession.absenceCutoffTime)}
                        </p>
                        <FieldError error={errors["afternoon.absenceCutoffTime"]} />
                      </div>

                      {/* Field 6: Absence Cutoff Minutes */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff (Minutes from Start)</Label>
                        <Input
                          type="number"
                          min="5"
                          max="360"
                          value={afternoonSession.absenceCutoffMinutes}
                          onChange={(e) => updateSessionField("afternoon", "absenceCutoffMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className={cn("mt-1 font-mono", errors["afternoon.absenceCutoffMinutes"] && "border-rose-500")}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Synchronized with cutoff time</p>
                        <FieldError error={errors["afternoon.absenceCutoffMinutes"]} />
                      </div>

                      {/* Field 7: Earliest Allowed Check-in */}
                      <div>
                        <Label className="text-xs font-semibold">Earliest Allowed Check-in</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.earliestCheckinTime}
                          onChange={(val) => updateSessionField("afternoon", "earliestCheckinTime", val)}
                          helperText="Check-in blocked before this time"
                          className="mt-1"
                        />
                        <FieldError error={errors["afternoon.earliestCheckinTime"]} />
                      </div>

                      {/* Field 8: Latest Allowed Check-out */}
                      <div>
                        <Label className="text-xs font-semibold">Latest Allowed Check-out</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.latestCheckoutTime}
                          onChange={(val) => updateSessionField("afternoon", "latestCheckoutTime", val)}
                          helperText="Maximum allowed shift boundary"
                          className="mt-1"
                        />
                        <FieldError error={errors["afternoon.latestCheckoutTime"]} />
                      </div>
                    </div>

                    {/* Afternoon Session Timeline Helper */}
                    <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Sunset className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Afternoon Session Lifecycle Timeline (12h AM/PM):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-background/80 border border-border">
                          <span className="font-bold text-slate-600 dark:text-slate-400 block">1. Not Started</span>
                          <span className="opacity-80">Before {formatHHMMAs12h(afternoonSession.earliestCheckinTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 block">2. On Time Check-In</span>
                          <span className="opacity-80">{formatHHMMAs12h(afternoonSession.startTime)} – {formatHHMMAs12h(addMinutesToHHMM(afternoonSession.startTime, afternoonSession.lateGraceMinutes))}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <span className="font-bold text-amber-700 dark:text-amber-300 block">3. Late Check-In</span>
                          <span className="opacity-80">{formatHHMMAs12h(addMinutesToHHMM(afternoonSession.startTime, afternoonSession.lateGraceMinutes))} – {formatHHMMAs12h(afternoonSession.absenceCutoffTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <span className="font-bold text-rose-700 dark:text-rose-300 block">4. Automatic Absent</span>
                          <span className="opacity-80">After {formatHHMMAs12h(afternoonSession.absenceCutoffTime)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Allow Check-In After Cutoff Toggle (Afternoon) */}
                    <div className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-colors",
                      afternoonSession.allowCheckinAfterCutoff
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/20"
                    )}>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground">Allow Staff Check-In After Absence Cutoff</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {afternoonSession.allowCheckinAfterCutoff
                            ? `Enabled — Staff may still check in after ${formatHHMMAs12h(afternoonSession.absenceCutoffTime)} (recorded as Late).`
                            : `Disabled — Check-in button locks at ${formatHHMMAs12h(afternoonSession.absenceCutoffTime)}. Absent is auto-marked.`}
                        </p>
                      </div>
                      <Switch
                        id="afternoonAllowCheckinAfterCutoff"
                        checked={!!afternoonSession.allowCheckinAfterCutoff}
                        onCheckedChange={(checked) => updateSessionField("afternoon", "allowCheckinAfterCutoff", checked)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ══════ DAILY ATTENDANCE MODE: SINGLE DAY SCHEDULE ══════ */
            <div className="space-y-6">
              {/* Time pickers grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="staffWorkStartTime" className="text-xs font-semibold">
                    Expected Start / Check-in Time
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffWorkStartTime || "08:00"}
                    onChange={(val) => updateDailyField("staffWorkStartTime", val)}
                    className="mt-1"
                  />
                  <FieldError error={errors["daily.staffWorkStartTime"]} />
                </div>

                <div>
                  <Label htmlFor="staffLateGraceMinutes" className="text-xs font-semibold">
                    Late Grace Period (Minutes)
                  </Label>
                  <Input
                    id="staffLateGraceMinutes"
                    type="number"
                    min="0"
                    max="180"
                    value={settings.staffLateGraceMinutes ?? 15}
                    onChange={(e) => updateDailyField("staffLateGraceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                    className={cn("mt-1 font-mono", errors["daily.staffLateGraceMinutes"] && "border-rose-500")}
                  />
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    Late after {computeDailyLateCutoff()}
                  </p>
                  <FieldError error={errors["daily.staffLateGraceMinutes"]} />
                </div>

                <div>
                  <Label htmlFor="staffWorkEndTime" className="text-xs font-semibold">
                    Expected End / Check-out Time
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffWorkEndTime || "17:00"}
                    onChange={(val) => updateDailyField("staffWorkEndTime", val)}
                    className="mt-1"
                  />
                  <FieldError error={errors["daily.staffWorkEndTime"]} />
                </div>

                <div>
                  <Label htmlFor="staffEarlyCheckoutToleranceMinutes" className="text-xs font-semibold">
                    Early Departure Tolerance (Min)
                  </Label>
                  <Input
                    id="staffEarlyCheckoutToleranceMinutes"
                    type="number"
                    min="0"
                    max="180"
                    value={settings.staffEarlyCheckoutToleranceMinutes ?? 15}
                    onChange={(e) => updateDailyField("staffEarlyCheckoutToleranceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                    className={cn("mt-1 font-mono", errors["daily.staffEarlyCheckoutToleranceMinutes"] && "border-rose-500")}
                  />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                    Early departure before {computeDailyEarlyCutoff()}
                  </p>
                  <FieldError error={errors["daily.staffEarlyCheckoutToleranceMinutes"]} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div>
                  <Label htmlFor="staffAbsenceCutoffTime" className="text-xs font-semibold">
                    Absence Cutoff Time
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffAbsenceCutoffTime || "10:00"}
                    onChange={(val) => updateDailyField("staffAbsenceCutoffTime", val)}
                    className="mt-1"
                  />
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                    Auto-marked Absent after {computeDailyAbsenceCutoff()}
                  </p>
                  <FieldError error={errors["daily.staffAbsenceCutoffTime"]} />
                </div>

                <div>
                  <Label htmlFor="staffAbsenceCutoffMinutes" className="text-xs font-semibold">
                    Absence Cutoff (Minutes from Start)
                  </Label>
                  <Input
                    id="staffAbsenceCutoffMinutes"
                    type="number"
                    min="5"
                    max="360"
                    value={settings.staffAbsenceCutoffMinutes ?? 120}
                    onChange={(e) => updateDailyField("staffAbsenceCutoffMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Synchronized with cutoff time</p>
                </div>

                <div>
                  <Label htmlFor="staffEarliestCheckinTime" className="text-xs font-semibold">
                    Earliest Allowed Check-in
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffEarliestCheckinTime || "06:00"}
                    onChange={(val) => updateDailyField("staffEarliestCheckinTime", val)}
                    className="mt-1"
                  />
                  <FieldError error={errors["daily.staffEarliestCheckinTime"]} />
                </div>

                <div>
                  <Label htmlFor="staffLatestCheckoutTime" className="text-xs font-semibold">
                    Latest Allowed Check-out
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffLatestCheckoutTime || "20:00"}
                    onChange={(val) => updateDailyField("staffLatestCheckoutTime", val)}
                    className="mt-1"
                  />
                  <FieldError error={errors["daily.staffLatestCheckoutTime"]} />
                </div>
              </div>

              {/* Daily Mode Lifecycle Timeline Banner */}
              <div className="p-3.5 rounded-xl bg-slate-500/10 border border-slate-500/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Daily Attendance Lifecycle Timeline (12h AM/PM):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-background/80 border border-border">
                    <span className="font-bold text-slate-600 dark:text-slate-400 block">1. Not Started</span>
                    <span className="opacity-80">Before {formatHHMMAs12h(settings.staffWorkStartTime || "08:00")}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 block">2. On Time</span>
                    <span className="opacity-80">{formatHHMMAs12h(settings.staffWorkStartTime || "08:00")} – {computeDailyLateCutoff()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="font-bold text-amber-700 dark:text-amber-300 block">3. Late</span>
                    <span className="opacity-80">{computeDailyLateCutoff()} – {computeDailyAbsenceCutoff()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="font-bold text-rose-700 dark:text-rose-300 block">4. Auto-Absent</span>
                    <span className="opacity-80">After {computeDailyAbsenceCutoff()}</span>
                  </div>
                </div>
              </div>

              {/* Global Daily Mode: Allow Check-In After Cutoff */}
              <div className={cn(
                "flex items-center justify-between p-3.5 rounded-xl border transition-colors",
                settings.allowStaffCheckinAfterCutoff
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-rose-500/10 border-rose-500/20"
              )}>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Allow Staff Check-In After Absence Cutoff</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {settings.allowStaffCheckinAfterCutoff
                      ? `Enabled — Staff may still check in after ${computeDailyAbsenceCutoff()} (recorded as Late).`
                      : `Disabled — Check-in button locks at ${computeDailyAbsenceCutoff()}. Absent is auto-marked.`}
                  </p>
                </div>
                <Switch
                  id="globalAllowCheckinAfterCutoff"
                  checked={!!settings.allowStaffCheckinAfterCutoff}
                  onCheckedChange={(checked) => setSettings((prev: any) => ({ ...prev, allowStaffCheckinAfterCutoff: checked }))}
                />
              </div>
            </div>
          )}

          {/* Direct Save Button Inside Tab */}
          <div className="pt-4 border-t border-border/40 flex justify-end">
            <Button
              onClick={handleSaveWithValidation}
              disabled={isSaving || !validationResult.isValid}
              className={cn(
                "h-11 px-6 rounded-2xl font-black text-xs uppercase tracking-wider gap-2 shadow-md transition-all",
                !validationResult.isValid
                  ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
              )}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Schedule Settings"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 3: WORKING DAYS SELECTION ────────────────────────────── */}
      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Standard Working Days</CardTitle>
                <CardDescription className="text-xs">
                  Days of the week when staff attendance is strictly expected and absences are marked.
                </CardDescription>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-semibold mr-1">Presets:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("mon-fri")}
                className="h-7 px-2 text-[11px] rounded-lg"
              >
                Mon–Fri
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("mon-sat")}
                className="h-7 px-2 text-[11px] rounded-lg"
              >
                Mon–Sat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset("all")}
                className="h-7 px-2 text-[11px] rounded-lg"
              >
                All 7 Days
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {ALL_WEEKDAYS.map((w) => {
              const isSelected = currentWorkingDays.includes(w.key)
              const isWeekend = w.key === "SATURDAY" || w.key === "SUNDAY"
              return (
                <div
                  key={w.key}
                  onClick={() => toggleWorkingDay(w.key)}
                  className={cn(
                    "p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center select-none space-y-1.5",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-center">
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/40" />
                    )}
                  </div>
                  <p className="font-bold text-xs text-foreground">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {isWeekend ? "Weekend" : "Weekday"}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
            💡 <strong>Calendar Behavior:</strong> On unselected non-working days or weekends, staff can still clock in for overtime or special duty without penalty, but auto-absences will <strong>never</strong> be marked.
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 4: SCHOOL HOLIDAYS & SPECIAL CLOSURES ────────────────── */}
      <Card className="rounded-3xl border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <CalendarOff className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">School Holidays & Special Closures</CardTitle>
                <CardDescription className="text-xs">
                  Official national, religious, or administrative school holidays when staff are excused.
                </CardDescription>
              </div>
            </div>

            <Button
              onClick={handleOpenAddHoliday}
              size="sm"
              className="h-9 px-4 rounded-xl text-xs font-bold gap-1.5 bg-primary text-white shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Holiday / Closure</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loadingHolidays ? (
            <div className="py-12 text-center text-muted-foreground text-xs font-medium">
              Loading holidays...
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <CalendarOff className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-foreground">No Holidays Configured Yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add national, religious, or school holidays so attendance is excused automatically.
              </p>
              <Button
                onClick={handleOpenAddHoliday}
                size="sm"
                variant="outline"
                className="h-8 px-3 rounded-xl text-xs font-bold gap-1 mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Holiday</span>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/50 text-[11px] uppercase font-bold text-muted-foreground">
                    <th className="py-3 px-4">Holiday Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {holidays.map((h) => {
                    const sDate = h.startDate ? new Date(h.startDate).toISOString().split("T")[0] : "—"
                    const eDate = h.endDate ? new Date(h.endDate).toISOString().split("T")[0] : sDate
                    const isMultiDay = sDate !== eDate
                    const catObj = HOLIDAY_TYPES.find((t) => t.value === h.type) || HOLIDAY_TYPES[0]

                    return (
                      <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-foreground block">{h.name}</span>
                          {h.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {h.description}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", catObj.color)}>
                            {catObj.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-foreground">
                          {isMultiDay ? `${sDate} → ${eDate}` : sDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold",
                              h.isActive
                                ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                : "text-slate-400 border-slate-400/30"
                            )}
                          >
                            {h.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditHoliday(h)}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHoliday(h.id, h.name)}
                              className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Bottom Save Action Bar ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-[24px] bg-white/70 dark:bg-slate-900/70 border border-white/50 dark:border-white/10 backdrop-blur-2xl shadow-xl shadow-slate-900/5">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Ready to apply schedule changes?</p>
          <p className="text-xs text-slate-500">Changes will take effect immediately across all staff check-in terminals and dashboards.</p>
        </div>
        <Button
          onClick={handleSaveWithValidation}
          disabled={isSaving || !validationResult.isValid}
          className="w-full sm:w-auto h-11 px-7 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white shadow-lg shadow-primary/25 active:scale-95 gap-2"
        >
          <Save className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
          <span>{isSaving ? "Saving Settings..." : "Save Schedule Settings"}</span>
        </Button>
      </div>

      {/* ─── ADD/EDIT HOLIDAY MODAL ────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Edit Holiday / Closure" : "Add School Holiday / Non-Working Date"}</DialogTitle>
            <DialogDescription>
              Configure dates when staff attendance is optional and absences are not penalized.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="holidayName" className="text-xs font-semibold">
                Holiday / Closure Name *
              </Label>
              <Input
                id="holidayName"
                placeholder="e.g. Meskel, Ethiopian New Year, Term Break"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="holidayType" className="text-xs font-semibold">
                Holiday Category
              </Label>
              <Select
                value={holidayForm.type}
                onValueChange={(val) => setHolidayForm({ ...holidayForm, type: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLIDAY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
              <div>
                <Label className="text-xs font-semibold">Multi-day Date Range</Label>
                <p className="text-[11px] text-muted-foreground">Enable if closure spans several consecutive days</p>
              </div>
              <Switch
                checked={holidayForm.isRange}
                onCheckedChange={(checked) => setHolidayForm({ ...holidayForm, isRange: checked })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate" className="text-xs font-semibold">
                  {holidayForm.isRange ? "Start Date" : "Date"}
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={holidayForm.startDate}
                  onChange={(e) => setHolidayForm({ ...holidayForm, startDate: e.target.value })}
                  className="mt-1 font-mono text-sm"
                />
              </div>

              {holidayForm.isRange && (
                <div>
                  <Label htmlFor="endDate" className="text-xs font-semibold">
                    End Date
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={holidayForm.endDate}
                    onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-semibold">
                Description / Notes (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Optional notes or administrative reference"
                rows={2}
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="isActive" className="text-xs font-semibold">
                Status Active
              </Label>
              <Switch
                id="isActive"
                checked={holidayForm.isActive}
                onCheckedChange={(checked) => setHolidayForm({ ...holidayForm, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHoliday} disabled={isSubmittingHoliday} className="bg-primary text-white">
              {isSubmittingHoliday ? "Saving..." : editingHoliday ? "Update Holiday" : "Create Holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
