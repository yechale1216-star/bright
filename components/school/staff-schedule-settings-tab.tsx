"use client"

import React, { useState, useEffect } from "react"
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
} from "lucide-react"
import { EthiopianTimeInput } from "@/components/ui/ethiopian-time-input"
import { formatEthiopianTime } from "@/lib/utils/ethiopian-time"
import { cn } from "@/lib/utils/utils"

// ── Fixed Session Type (Strictly Morning and Afternoon) ──
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
    isActive: true,
  },
]

function addMinutesToHHMM(timeHHMM: string, minutes: number): string {
  if (!timeHHMM || !timeHHMM.includes(":")) return "08:00"
  const [h, m] = timeHHMM.split(":").map(Number)
  let total = (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m) + minutes
  if (total < 0) total = 0
  if (total >= 24 * 60) total = 24 * 60 - 1
  const newH = Math.floor(total / 60)
  const newM = total % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

function getMinutesDiff(timeA: string, timeB: string): number {
  if (!timeA || !timeB || !timeA.includes(":") || !timeB.includes(":")) return 0
  const [hA, mA] = timeA.split(":").map(Number)
  const [hB, mB] = timeB.split(":").map(Number)
  return (hA * 60 + mA) - (hB * 60 + mB)
}

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

  const findRaw = (key: "morning" | "afternoon") => {
    return arr.find(
      (s: any) =>
        s &&
        ((s.id && String(s.id).toLowerCase().trim() === key) ||
          (s.name && String(s.name).toLowerCase().trim() === key))
    )
  }

  const morningRaw = findRaw("morning")
  const afternoonRaw = findRaw("afternoon")

  const merge = (
    key: "morning" | "afternoon",
    name: "Morning" | "Afternoon",
    r: any,
    fallback: StaffSession
  ): StaffSession => {
    const startTime = r?.startTime || fallback.startTime
    const lateGraceMinutes = r?.lateGraceMinutes != null ? Number(r.lateGraceMinutes) : fallback.lateGraceMinutes
    const earlyDepartureToleranceMinutes =
      r?.earlyDepartureToleranceMinutes != null ? Number(r.earlyDepartureToleranceMinutes) : fallback.earlyDepartureToleranceMinutes
    let absenceCutoffMinutes =
      r?.absenceCutoffMinutes != null ? Number(r.absenceCutoffMinutes) : fallback.absenceCutoffMinutes
    let absenceCutoffTime = r?.absenceCutoffTime || addMinutesToHHMM(startTime, absenceCutoffMinutes)

    if (r?.absenceCutoffTime && !r?.absenceCutoffMinutes) {
      const diff = getMinutesDiff(r.absenceCutoffTime, startTime)
      if (diff > 0) absenceCutoffMinutes = diff
    }

    const earliestCheckinTime =
      r?.earliestCheckinTime || r?.earliestCheckInTime || fallback.earliestCheckinTime
    const latestCheckoutTime =
      r?.latestCheckoutTime || r?.latestCheckOutTime || fallback.latestCheckoutTime

    return {
      id: key,
      name,
      startTime,
      endTime: r?.endTime || fallback.endTime,
      lateGraceMinutes,
      earlyDepartureToleranceMinutes,
      absenceCutoffMinutes,
      absenceCutoffTime,
      earliestCheckinTime,
      latestCheckoutTime,
      isActive: r?.isActive !== false,
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
  const [sessions, setSessions] = useState<StaffSession[]>(() => parseSessionsFromSettings(settings?.staffSessions))
  const [expandedSessions, setExpandedSessions] = useState<{ morning: boolean; afternoon: boolean }>({
    morning: true,
    afternoon: false,
  })

  const toggleSessionExpand = (id: "morning" | "afternoon") => {
    setExpandedSessions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Sync sessions state when settings change
  useEffect(() => {
    setSessions(parseSessionsFromSettings(settings?.staffSessions))
  }, [settings?.staffSessions])

  const persistSessions = (updated: StaffSession[]) => {
    setSessions(updated)
    setSettings((prev: any) => ({ ...prev, staffSessions: updated }))
  }

  // Update field for a specific fixed session with bidirectional absence sync
  const updateSessionField = (id: "morning" | "afternoon", field: keyof StaffSession, value: any) => {
    const updated = sessions.map((s) => {
      if (s.id !== id) return s
      const copy = { ...s, [field]: value }

      // Bidirectional sync for absence cutoff
      if (field === "startTime") {
        copy.absenceCutoffTime = addMinutesToHHMM(value, s.absenceCutoffMinutes)
      } else if (field === "absenceCutoffMinutes") {
        const mins = Number(value) || 0
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

  // Daily Mode dynamic threshold calculations (returning Ethiopian Clock strings for display)
  const computeDailyLateCutoff = () => {
    const start = settings.staffWorkStartTime || "08:00"
    const grace = parseInt(settings.staffLateGraceMinutes || "15", 10) || 0
    return formatEthiopianTime(addMinutesToHHMM(start, grace))
  }

  const computeDailyEarlyCutoff = () => {
    const end = settings.staffWorkEndTime || "17:00"
    const tol = parseInt(settings.staffEarlyCheckoutToleranceMinutes || "15", 10) || 0
    return formatEthiopianTime(addMinutesToHHMM(end, -tol))
  }

  const computeDailyAbsenceCutoff = () => {
    if (settings.staffAbsenceCutoffTime) return formatEthiopianTime(settings.staffAbsenceCutoffTime)
    const start = settings.staffWorkStartTime || "08:00"
    const mins = parseInt(settings.staffAbsenceCutoffMinutes ?? "120", 10) || 120
    return formatEthiopianTime(addMinutesToHHMM(start, mins))
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
        notifications.success("Updated", "Holiday updated successfully.")
      } else {
        await db.addHoliday(payload)
        notifications.success("Added", "Holiday / Non-working day added successfully.")
      }

      setModalOpen(false)
      loadHolidays()
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to save holiday.")
    } finally {
      setIsSubmittingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the holiday '${name}'?`)) return
    try {
      await db.deleteHoliday(id)
      notifications.success("Deleted", "Holiday deleted successfully.")
      loadHolidays()
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to delete holiday.")
    }
  }

  const handleToggleHolidayStatus = async (h: any) => {
    try {
      await db.updateHoliday(h.id, { isActive: !h.isActive })
      notifications.info("Status Updated", `Holiday is now ${!h.isActive ? "Active" : "Inactive"}.`)
      loadHolidays()
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to update holiday status.")
    }
  }

  const morningSession = sessions.find((s) => s.id === "morning") || DEFAULT_FIXED_SESSIONS[0]
  const afternoonSession = sessions.find((s) => s.id === "afternoon") || DEFAULT_FIXED_SESSIONS[1]

  const isSessionMode = settings.staffAttendanceMode === "session_based"

  return (
    <div className="space-y-8">
      {/* ─── SECTION 0: STAFF ATTENDANCE MODE ──────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Staff Attendance Mode
              </CardTitle>
              <CardDescription>
                Choose between single daily check-in/out or fixed Morning and Afternoon session-based attendance.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Mode */}
            <button
              type="button"
              onClick={() => setSettings((prev: any) => ({ ...prev, staffAttendanceMode: "daily" }))}
              className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                !isSessionMode
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                !isSessionMode ? "border-primary" : "border-muted-foreground"
              }`}>
                {!isSessionMode && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <LayoutList className="w-4 h-4 text-primary" />
                  Daily Attendance
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff check in once per day and check out once per day. Lateness and early departure are calculated against daily working hours.
                </p>
              </div>
            </button>

            {/* Session-Based Mode */}
            <button
              type="button"
              onClick={() => setSettings((prev: any) => ({ ...prev, staffAttendanceMode: "session_based" }))}
              className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                isSessionMode
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isSessionMode ? "border-primary" : "border-muted-foreground"
              }`}>
                {isSessionMode && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Layers className="w-4 h-4 text-primary" />
                  Session-Based Attendance (Fixed: Morning & Afternoon)
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff mark attendance separately for fixed <strong>Morning</strong> and <strong>Afternoon</strong> sessions. Each session operates completely independently.
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 1: WORKING SCHEDULE & HOURS ────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {isSessionMode ? "Staff Working Days & Session Rules" : "Staff Working Hours & Shift Rules"}
              </CardTitle>
              <CardDescription>
                {isSessionMode
                  ? "Configure official school working days and independent Morning & Afternoon session thresholds."
                  : "Configure official school working days, check-in/out times, and arrival/departure thresholds."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Working Days (Common to both modes) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="text-sm font-semibold">Official Working Days</Label>
                <p className="text-xs text-muted-foreground">Select the days of the week staff are expected on campus.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("mon-fri")} className="text-xs h-7 px-2">
                  Mon - Fri
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("mon-sat")} className="text-xs h-7 px-2">
                  Mon - Sat
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("all")} className="text-xs h-7 px-2">
                  All 7 Days
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {ALL_WEEKDAYS.map((w) => {
                const isSelected = currentWorkingDays.includes(w.key)
                const isWeekend = w.key === "SATURDAY" || w.key === "SUNDAY"
                return (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => toggleWorkingDay(w.key)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider">{w.short}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">
                      {isSelected ? "Working" : isWeekend ? "Off" : "Off"}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* ─── MODE-ISOLATED CONTENT ─────────────────────────────────── */}
          {isSessionMode ? (
            /* ══════ SESSION-BASED MODE: MORNING & AFTERNOON CARDS ══════ */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Fixed Session Configurations
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure independent attendance times and thresholds for Morning and Afternoon sessions.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs px-2.5 py-1 font-semibold gap-1 bg-muted/50 border-border">
                  <Lock className="w-3 h-3 text-muted-foreground" /> Exactly 2 Fixed Sessions
                </Badge>
              </div>

              {/* ── 1. MORNING SESSION CARD ── */}
              <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent overflow-hidden transition-all shadow-xs">
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
                          🕒 {formatEthiopianTime(morningSession.startTime)} – {formatEthiopianTime(morningSession.endTime)}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{morningSession.lateGraceMinutes}m grace
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          Cutoff: {formatEthiopianTime(morningSession.absenceCutoffTime)}
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

                {/* 8 Configuration Fields for Morning (Shown when expanded) */}
                {expandedSessions.morning && (
                  <div className="p-5 pt-3 border-t border-amber-500/20 space-y-5 bg-background/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Field 1: Start Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected Start / Check-in Time</Label>
                        <EthiopianTimeInput
                          value={morningSession.startTime}
                          onChange={(val) => updateSessionField("morning", "startTime", val)}
                          allowedPeriods={["morning", "afternoon"]}
                          helperText="Official morning arrival time (ጠዋት)"
                          className="mt-1"
                        />
                      </div>

                      {/* Field 2: Late Grace */}
                      <div>
                        <Label className="text-xs font-semibold">Late Grace Period (Minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={morningSession.lateGraceMinutes}
                          onChange={(e) => updateSessionField("morning", "lateGraceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          Late after {formatEthiopianTime(addMinutesToHHMM(morningSession.startTime, morningSession.lateGraceMinutes))}
                        </p>
                      </div>

                      {/* Field 3: End Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected End / Check-out Time</Label>
                        <EthiopianTimeInput
                          value={morningSession.endTime}
                          onChange={(val) => updateSessionField("morning", "endTime", val)}
                          allowedPeriods={["morning", "afternoon"]}
                          helperText="Official morning departure time"
                          className="mt-1"
                        />
                      </div>

                      {/* Field 4: Early Checkout Tolerance */}
                      <div>
                        <Label className="text-xs font-semibold">Early Departure Tolerance (Min)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={morningSession.earlyDepartureToleranceMinutes}
                          onChange={(e) => updateSessionField("morning", "earlyDepartureToleranceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          Early departure before {formatEthiopianTime(addMinutesToHHMM(morningSession.endTime, -morningSession.earlyDepartureToleranceMinutes))}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                      {/* Field 5: Absence Cutoff Time */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff Time</Label>
                        <EthiopianTimeInput
                          value={morningSession.absenceCutoffTime}
                          onChange={(val) => updateSessionField("morning", "absenceCutoffTime", val)}
                          allowedPeriods={["morning", "afternoon"]}
                          className="mt-1"
                        />
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                          Auto-marked Absent after {formatEthiopianTime(morningSession.absenceCutoffTime)}
                        </p>
                      </div>

                      {/* Field 6: Absence Cutoff Minutes */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff (Minutes from Start)</Label>
                        <Input
                          type="number"
                          min="15"
                          max="360"
                          value={morningSession.absenceCutoffMinutes}
                          onChange={(e) => updateSessionField("morning", "absenceCutoffMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Unchecked staff become Absent</p>
                      </div>

                      {/* Field 7: Earliest Allowed Check-in */}
                      <div>
                        <Label className="text-xs font-semibold">Earliest Allowed Check-in</Label>
                        <EthiopianTimeInput
                          value={morningSession.earliestCheckinTime}
                          onChange={(val) => updateSessionField("morning", "earliestCheckinTime", val)}
                          allowedPeriods={["night", "morning"]}
                          helperText="Check-in blocked before this time"
                          className="mt-1"
                        />
                      </div>

                      {/* Field 8: Latest Allowed Check-out */}
                      <div>
                        <Label className="text-xs font-semibold">Latest Allowed Check-out</Label>
                        <EthiopianTimeInput
                          value={morningSession.latestCheckoutTime}
                          onChange={(val) => updateSessionField("morning", "latestCheckoutTime", val)}
                          allowedPeriods={["afternoon", "evening"]}
                          helperText="Maximum allowed shift boundary"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Morning Session Timeline Helper */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Morning Session Lifecycle Timeline (Ethiopian Clock):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-background/80 border border-border">
                          <span className="font-bold text-slate-600 dark:text-slate-400 block">1. Not Started</span>
                          <span className="opacity-80">Before {formatEthiopianTime(morningSession.startTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 block">2. On Time Check-In</span>
                          <span className="opacity-80">{formatEthiopianTime(morningSession.startTime)} – {formatEthiopianTime(addMinutesToHHMM(morningSession.startTime, morningSession.lateGraceMinutes))}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <span className="font-bold text-amber-700 dark:text-amber-300 block">3. Late Check-In</span>
                          <span className="opacity-80">{formatEthiopianTime(addMinutesToHHMM(morningSession.startTime, morningSession.lateGraceMinutes))} – {formatEthiopianTime(morningSession.absenceCutoffTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <span className="font-bold text-rose-700 dark:text-rose-300 block">4. Automatic Absent</span>
                          <span className="opacity-80">After {formatEthiopianTime(morningSession.absenceCutoffTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── 2. AFTERNOON SESSION CARD ── */}
              <div className="rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-b from-indigo-500/5 to-transparent overflow-hidden transition-all shadow-xs">
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
                          🕒 {formatEthiopianTime(afternoonSession.startTime)} – {formatEthiopianTime(afternoonSession.endTime)}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{afternoonSession.lateGraceMinutes}m grace
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          Cutoff: {formatEthiopianTime(afternoonSession.absenceCutoffTime)}
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

                {/* 8 Configuration Fields for Afternoon (Shown when expanded) */}
                {expandedSessions.afternoon && (
                  <div className="p-5 pt-3 border-t border-indigo-500/20 space-y-5 bg-background/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Field 1: Start Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected Start / Check-in Time</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.startTime}
                          onChange={(val) => updateSessionField("afternoon", "startTime", val)}
                          allowedPeriods={["afternoon", "evening"]}
                          helperText="Official afternoon arrival time (ከሰዓት)"
                          className="mt-1"
                        />
                      </div>

                      {/* Field 2: Late Grace */}
                      <div>
                        <Label className="text-xs font-semibold">Late Grace Period (Minutes)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={afternoonSession.lateGraceMinutes}
                          onChange={(e) => updateSessionField("afternoon", "lateGraceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          Late after {formatEthiopianTime(addMinutesToHHMM(afternoonSession.startTime, afternoonSession.lateGraceMinutes))}
                        </p>
                      </div>

                      {/* Field 3: End Time */}
                      <div>
                        <Label className="text-xs font-semibold">Expected End / Check-out Time</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.endTime}
                          onChange={(val) => updateSessionField("afternoon", "endTime", val)}
                          allowedPeriods={["afternoon", "evening"]}
                          helperText="Official afternoon departure time"
                          className="mt-1"
                        />
                      </div>

                      {/* Field 4: Early Checkout Tolerance */}
                      <div>
                        <Label className="text-xs font-semibold">Early Departure Tolerance (Min)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={afternoonSession.earlyDepartureToleranceMinutes}
                          onChange={(e) => updateSessionField("afternoon", "earlyDepartureToleranceMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          Early departure before {formatEthiopianTime(addMinutesToHHMM(afternoonSession.endTime, -afternoonSession.earlyDepartureToleranceMinutes))}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                      {/* Field 5: Absence Cutoff Time */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff Time</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.absenceCutoffTime}
                          onChange={(val) => updateSessionField("afternoon", "absenceCutoffTime", val)}
                          allowedPeriods={["afternoon", "evening"]}
                          className="mt-1"
                        />
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                          Auto-marked Absent after {formatEthiopianTime(afternoonSession.absenceCutoffTime)}
                        </p>
                      </div>

                      {/* Field 6: Absence Cutoff Minutes */}
                      <div>
                        <Label className="text-xs font-semibold">Absence Cutoff (Minutes from Start)</Label>
                        <Input
                          type="number"
                          min="15"
                          max="360"
                          value={afternoonSession.absenceCutoffMinutes}
                          onChange={(e) => updateSessionField("afternoon", "absenceCutoffMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                          className="mt-1 font-mono"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Unchecked staff become Absent</p>
                      </div>

                      {/* Field 7: Earliest Allowed Check-in */}
                      <div>
                        <Label className="text-xs font-semibold">Earliest Allowed Check-in</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.earliestCheckinTime}
                          onChange={(val) => updateSessionField("afternoon", "earliestCheckinTime", val)}
                          allowedPeriods={["morning", "afternoon"]}
                          helperText="Check-in blocked before this time"
                          className="mt-1"
                        />
                      </div>

                      {/* Field 8: Latest Allowed Check-out */}
                      <div>
                        <Label className="text-xs font-semibold">Latest Allowed Check-out</Label>
                        <EthiopianTimeInput
                          value={afternoonSession.latestCheckoutTime}
                          onChange={(val) => updateSessionField("afternoon", "latestCheckoutTime", val)}
                          allowedPeriods={["evening", "night"]}
                          helperText="Maximum allowed shift boundary"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Afternoon Session Timeline Helper */}
                    <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Sunset className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Afternoon Session Lifecycle Timeline (Ethiopian Clock):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-background/80 border border-border">
                          <span className="font-bold text-slate-600 dark:text-slate-400 block">1. Not Started</span>
                          <span className="opacity-80">Before {formatEthiopianTime(afternoonSession.startTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300 block">2. On Time Check-In</span>
                          <span className="opacity-80">{formatEthiopianTime(afternoonSession.startTime)} – {formatEthiopianTime(addMinutesToHHMM(afternoonSession.startTime, afternoonSession.lateGraceMinutes))}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <span className="font-bold text-amber-700 dark:text-amber-300 block">3. Late Check-In</span>
                          <span className="opacity-80">{formatEthiopianTime(addMinutesToHHMM(afternoonSession.startTime, afternoonSession.lateGraceMinutes))} – {formatEthiopianTime(afternoonSession.absenceCutoffTime)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <span className="font-bold text-rose-700 dark:text-rose-300 block">4. Automatic Absent</span>
                          <span className="opacity-80">After {formatEthiopianTime(afternoonSession.absenceCutoffTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Morning and Afternoon sessions function independently. Changes will be persisted when saving settings.
                </span>
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
                    onChange={(val) => setSettings({ ...settings, staffWorkStartTime: val })}
                    allowedPeriods={["morning", "afternoon"]}
                    helperText="Official daily arrival time"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="staffLateGraceMinutes" className="text-xs font-semibold">
                    Late Grace Period (Minutes)
                  </Label>
                  <Input
                    id="staffLateGraceMinutes"
                    type="number"
                    min="0"
                    max="120"
                    value={settings.staffLateGraceMinutes ?? 15}
                    onChange={(e) => setSettings({ ...settings, staffLateGraceMinutes: e.target.value })}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    Late after {computeDailyLateCutoff()}
                  </p>
                </div>

                <div>
                  <Label htmlFor="staffWorkEndTime" className="text-xs font-semibold">
                    Expected End / Check-out Time
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffWorkEndTime || "17:00"}
                    onChange={(val) => setSettings({ ...settings, staffWorkEndTime: val })}
                    allowedPeriods={["afternoon", "evening"]}
                    helperText="Official daily departure time"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="staffEarlyCheckoutToleranceMinutes" className="text-xs font-semibold">
                    Early Departure Tolerance (Min)
                  </Label>
                  <Input
                    id="staffEarlyCheckoutToleranceMinutes"
                    type="number"
                    min="0"
                    max="120"
                    value={settings.staffEarlyCheckoutToleranceMinutes ?? 15}
                    onChange={(e) => setSettings({ ...settings, staffEarlyCheckoutToleranceMinutes: e.target.value })}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                    Early departure before {computeDailyEarlyCutoff()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div>
                  <Label htmlFor="staffAbsenceCutoffTime" className="text-xs font-semibold">
                    Absence Cutoff Time
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffAbsenceCutoffTime || "10:00"}
                    onChange={(val) => setSettings({ ...settings, staffAbsenceCutoffTime: val })}
                    allowedPeriods={["morning", "afternoon"]}
                    className="mt-1"
                  />
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                    Auto-marked Absent after {computeDailyAbsenceCutoff()}
                  </p>
                </div>

                <div>
                  <Label htmlFor="staffAbsenceCutoffMinutes" className="text-xs font-semibold">
                    Absence Cutoff (Minutes from Start)
                  </Label>
                  <Input
                    id="staffAbsenceCutoffMinutes"
                    type="number"
                    min="30"
                    max="360"
                    value={settings.staffAbsenceCutoffMinutes ?? 120}
                    onChange={(e) => setSettings({ ...settings, staffAbsenceCutoffMinutes: e.target.value })}
                    className="mt-1 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Unchecked staff become Absent</p>
                </div>

                <div>
                  <Label htmlFor="staffEarliestCheckinTime" className="text-xs font-semibold">
                    Earliest Allowed Check-in
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffEarliestCheckinTime || "06:00"}
                    onChange={(val) => setSettings({ ...settings, staffEarliestCheckinTime: val })}
                    allowedPeriods={["night", "morning"]}
                    helperText="Check-in blocked before this time"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="staffLatestCheckoutTime" className="text-xs font-semibold">
                    Latest Allowed Check-out
                  </Label>
                  <EthiopianTimeInput
                    value={settings.staffLatestCheckoutTime || "20:00"}
                    onChange={(val) => setSettings({ ...settings, staffLatestCheckoutTime: val })}
                    allowedPeriods={["evening", "night"]}
                    helperText="Maximum allowed shift boundary"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Attendance Lifecycle Explanation Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/5 via-sky-500/5 to-emerald-500/5 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span>Daily Attendance Automatic Lifecycle Timeline (Ethiopian Clock):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-slate-500/10 border border-slate-500/20">
                    <span className="font-bold text-slate-600 dark:text-slate-400 block">1. Not Started</span>
                    <span className="opacity-80">Before {formatEthiopianTime(settings.staffWorkStartTime || "08:00")}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 block">2. On Time Check-In</span>
                    <span className="opacity-80">{formatEthiopianTime(settings.staffWorkStartTime || "08:00")} – {computeDailyLateCutoff()}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="font-bold text-amber-700 dark:text-amber-300 block">3. Late Check-In</span>
                    <span className="opacity-80">{computeDailyLateCutoff()} – {computeDailyAbsenceCutoff()}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="font-bold text-rose-700 dark:text-rose-300 block">4. Automatic Absent</span>
                    <span className="opacity-80">After {computeDailyAbsenceCutoff()} (Unrecorded)</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Staff with approved Leave or Permission are never automatically marked Absent. Holidays & non-working days are strictly excluded.
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Verification Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border">
              <div className="pr-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Staff Face Recognition Required
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Require camera facial verification for staff check-in and check-out.
                </p>
              </div>
              <Switch
                checked={settings.staffFaceRequired !== false}
                onCheckedChange={(checked) => setSettings({ ...settings, staffFaceRequired: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border">
              <div className="pr-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Staff Geofencing Location Required
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify staff GPS location matches school coordinates before allowing attendance.
                </p>
              </div>
              <Switch
                checked={settings.staffGeoRequired !== false}
                onCheckedChange={(checked) => setSettings({ ...settings, staffGeoRequired: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 2: HOLIDAYS & NON-WORKING DAYS ────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-amber-500" />
                School Holidays & Non-Working Days Calendar
              </CardTitle>
              <CardDescription>
                Configure public, religious, and custom school closure dates where attendance is not required.
              </CardDescription>
            </div>
            <Button
              onClick={handleOpenAddHoliday}
              className="bg-primary text-white font-bold text-xs uppercase tracking-wider h-10 px-5 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Holiday / Closure
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingHolidays ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading holidays and working calendar...
            </div>
          ) : holidays.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-border rounded-2xl">
              <CalendarDays className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-bold text-sm text-foreground">No Custom Holidays Configured</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                Staff will follow the standard weekly working schedule. Add public holidays, religious feasts, or term breaks to prevent false absence tracking.
              </p>
              <Button onClick={handleOpenAddHoliday} variant="outline" size="sm" className="rounded-xl">
                <Plus className="w-4 h-4 mr-1.5" />
                Add First Holiday
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                    <th className="py-3 px-4">Holiday / Reason</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {holidays.map((h) => {
                    const typeConfig = HOLIDAY_TYPES.find((t) => t.value === h.type) || HOLIDAY_TYPES[0]
                    const sDate = h.startDate ? new Date(h.startDate).toISOString().split("T")[0] : ""
                    const eDate = h.endDate ? new Date(h.endDate).toISOString().split("T")[0] : ""
                    const isMultiDay = sDate !== eDate

                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-foreground">{h.name}</div>
                          {h.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-xs">{h.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className={`text-[10px] font-bold ${typeConfig.color}`}>
                            {typeConfig.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-xs font-medium">
                            {isMultiDay ? `${sDate} to ${eDate}` : sDate}
                          </div>
                          {isMultiDay && (
                            <span className="text-[10px] text-muted-foreground">Multi-day closure</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleHolidayStatus(h)}
                            className="flex items-center gap-1.5 text-xs font-semibold"
                          >
                            {h.isActive ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" /> Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <XCircle className="w-4 h-4" /> Inactive
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditHoliday(h)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHoliday(h.id, h.name)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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
