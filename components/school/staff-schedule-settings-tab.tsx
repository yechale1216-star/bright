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
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  MapPin,
  CalendarOff,
  Sun,
  Moon,
  Info,
  LayoutList,
  Layers,
  GripVertical,
} from "lucide-react"

// ── Session type (mirrors backend StaffSession interface) ──
interface StaffSession {
  id: string
  name: string
  startTime: string
  endTime: string
  lateGraceMinutes: number
  earlyDepartureToleranceMinutes: number
  isActive: boolean
}

const DEFAULT_SESSIONS: StaffSession[] = [
  { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true },
  { id: "afternoon", name: "Afternoon", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, isActive: true },
]

function parseSessionsFromSettings(raw: any): StaffSession[] {
  if (!raw) return DEFAULT_SESSIONS
  try {
    const arr: StaffSession[] = typeof raw === "string" ? JSON.parse(raw) : raw
    if (Array.isArray(arr) && arr.length > 0) return arr
  } catch (_) {}
  return DEFAULT_SESSIONS
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

  // ── Session management state ──
  const [sessions, setSessions] = useState<StaffSession[]>(() => parseSessionsFromSettings(settings?.staffSessions))
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<StaffSession | null>(null)
  const [sessionForm, setSessionForm] = useState<Omit<StaffSession, "id">>({
    name: "", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true
  })

  // Sync sessions state when settings change
  useEffect(() => {
    setSessions(parseSessionsFromSettings(settings?.staffSessions))
  }, [settings?.staffSessions])

  const persistSessions = (updated: StaffSession[]) => {
    setSessions(updated)
    setSettings((prev: any) => ({ ...prev, staffSessions: updated }))
  }

  const handleOpenAddSession = () => {
    setEditingSession(null)
    setSessionForm({ name: "", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true })
    setSessionModalOpen(true)
  }

  const handleOpenEditSession = (s: StaffSession) => {
    setEditingSession(s)
    setSessionForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, lateGraceMinutes: s.lateGraceMinutes, earlyDepartureToleranceMinutes: s.earlyDepartureToleranceMinutes, isActive: s.isActive })
    setSessionModalOpen(true)
  }

  const handleSaveSession = () => {
    if (!sessionForm.name.trim()) { notifications.error("Session", "Session name is required."); return }
    if (sessionForm.startTime >= sessionForm.endTime) { notifications.error("Session", "End time must be after start time."); return }
    if (editingSession) {
      const updated = sessions.map(s => s.id === editingSession.id ? { ...editingSession, ...sessionForm, name: sessionForm.name.trim() } : s)
      persistSessions(updated)
      notifications.success("Updated", `Session "${sessionForm.name}" updated.`)
    } else {
      const id = sessionForm.name.toLowerCase().trim().replace(/\s+/g, "-")
      if (sessions.find(s => s.id === id)) { notifications.error("Session", "A session with this name already exists."); return }
      persistSessions([...sessions, { id, ...sessionForm, name: sessionForm.name.trim() }])
      notifications.success("Added", `Session "${sessionForm.name}" added.`)
    }
    setSessionModalOpen(false)
  }

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) { notifications.error("Session", "At least one session must remain."); return }
    persistSessions(sessions.filter(s => s.id !== id))
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

  // Dynamic threshold calculations for UI feedback
  const computeLateCutoff = () => {
    const start = settings.staffWorkStartTime || "08:00"
    const grace = parseInt(settings.staffLateGraceMinutes || "15", 10) || 0
    const [h, m] = start.split(":").map(Number)
    let total = h * 60 + m + grace
    const newH = Math.floor(total / 60) % 24
    const newM = total % 60
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
  }

  const computeEarlyCutoff = () => {
    const end = settings.staffWorkEndTime || "17:00"
    const tol = parseInt(settings.staffEarlyCheckoutToleranceMinutes || "15", 10) || 0
    const [h, m] = end.split(":").map(Number)
    let total = h * 60 + m - tol
    if (total < 0) total = 0
    const newH = Math.floor(total / 60)
    const newM = total % 60
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
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
                Choose between single daily check-in/out or multiple session-based attendance per day.
              </CardDescription>
            </div>
            <Button
              onClick={onSaveSettings}
              disabled={isSaving}
              className="bg-primary text-white font-bold text-xs uppercase tracking-wider h-10 px-6 rounded-xl shadow-sm"
            >
              {isSaving ? "Saving..." : "Save Mode"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Mode */}
            <button
              type="button"
              onClick={() => setSettings((prev: any) => ({ ...prev, staffAttendanceMode: "daily" }))}
              className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                (settings.staffAttendanceMode || "daily") === "daily"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                (settings.staffAttendanceMode || "daily") === "daily" ? "border-primary" : "border-muted-foreground"
              }`}>
                {(settings.staffAttendanceMode || "daily") === "daily" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <LayoutList className="w-4 h-4 text-primary" />
                  Daily Attendance
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff check-in once per day and check-out once per day. Lateness and early departure calculated against daily working hours.
                </p>
              </div>
            </button>

            {/* Session-Based Mode */}
            <button
              type="button"
              onClick={() => setSettings((prev: any) => ({ ...prev, staffAttendanceMode: "session_based" }))}
              className={`flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${
                settings.staffAttendanceMode === "session_based"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                settings.staffAttendanceMode === "session_based" ? "border-primary" : "border-muted-foreground"
              }`}>
                {settings.staffAttendanceMode === "session_based" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Layers className="w-4 h-4 text-primary" />
                  Session-Based Attendance
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff mark attendance separately for each defined session (e.g., Morning and Afternoon). Each session has its own time thresholds.
                </p>
              </div>
            </button>
          </div>

          {/* Session Configuration — visible only in session mode */}
          {settings.staffAttendanceMode === "session_based" && (
            <div className="pt-2">
              <Separator className="mb-5" />
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label className="text-sm font-semibold">Configured Sessions</Label>
                  <p className="text-xs text-muted-foreground">Add and configure the sessions for the school day. Staff will mark attendance once per session.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleOpenAddSession} className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Session
                </Button>
              </div>
              <div className="space-y-3">
                {sessions.map((s) => {
                  const lateAfter = (() => {
                    const [h, m] = s.startTime.split(":").map(Number)
                    const t = h * 60 + m + s.lateGraceMinutes
                    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
                  })()
                  const earlyBefore = (() => {
                    const [h, m] = s.endTime.split(":").map(Number)
                    const t = Math.max(0, h * 60 + m - s.earlyDepartureToleranceMinutes)
                    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
                  })()
                  return (
                    <div key={s.id} className={`flex items-center gap-3 p-4 rounded-xl border ${s.isActive ? "border-border bg-card" : "border-border/40 bg-muted/30 opacity-60"}` }>
                      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{s.name}</span>
                          {!s.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                          <span className="text-xs text-muted-foreground font-mono">{s.startTime} – {s.endTime}</span>
                        </div>
                        <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="text-amber-600">Late after {lateAfter}</span>
                          <span className="text-orange-600">Early before {earlyBefore}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={s.isActive}
                          onCheckedChange={(v) => persistSessions(sessions.map(x => x.id === s.id ? { ...x, isActive: v } : x))}
                          className="scale-75"
                        />
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenEditSession(s)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteSession(s.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                <Info className="w-3 h-3 inline mr-1" />
                After editing sessions, click <strong>Save Mode</strong> above to persist changes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── SECTION 1: WORKING SCHEDULE & HOURS ────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Staff Working Hours & Shift Rules
              </CardTitle>
              <CardDescription>
                Configure official school working days, check-in/out times, and arrival/departure thresholds.
              </CardDescription>
            </div>
            <Button
              onClick={onSaveSettings}
              disabled={isSaving}
              className="bg-primary text-white font-bold text-xs uppercase tracking-wider h-10 px-6 rounded-xl shadow-sm"
            >
              {isSaving ? "Saving..." : "Save Working Hours"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Working Days */}
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

          {/* Time pickers grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="staffWorkStartTime" className="text-xs font-semibold">
                Expected Start / Check-in Time
              </Label>
              <Input
                id="staffWorkStartTime"
                type="time"
                value={settings.staffWorkStartTime || "08:00"}
                onChange={(e) => setSettings({ ...settings, staffWorkStartTime: e.target.value })}
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Official arrival time</p>
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
                Late after {computeLateCutoff()}
              </p>
            </div>

            <div>
              <Label htmlFor="staffWorkEndTime" className="text-xs font-semibold">
                Expected End / Check-out Time
              </Label>
              <Input
                id="staffWorkEndTime"
                type="time"
                value={settings.staffWorkEndTime || "17:00"}
                onChange={(e) => setSettings({ ...settings, staffWorkEndTime: e.target.value })}
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Official departure time</p>
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
                Early departure before {computeEarlyCutoff()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <Label htmlFor="staffEarliestCheckinTime" className="text-xs font-semibold">
                Earliest Allowed Check-in
              </Label>
              <Input
                id="staffEarliestCheckinTime"
                type="time"
                value={settings.staffEarliestCheckinTime || "06:00"}
                onChange={(e) => setSettings({ ...settings, staffEarliestCheckinTime: e.target.value })}
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Check-in blocked before this time</p>
            </div>

            <div>
              <Label htmlFor="staffLatestCheckoutTime" className="text-xs font-semibold">
                Latest Allowed Check-out
              </Label>
              <Input
                id="staffLatestCheckoutTime"
                type="time"
                value={settings.staffLatestCheckoutTime || "20:00"}
                onChange={(e) => setSettings({ ...settings, staffLatestCheckoutTime: e.target.value })}
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Maximum allowed shift boundary</p>
            </div>
          </div>

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

      {/* ─── SESSION ADD / EDIT DIALOG ──────────────────────────────────── */}
      <Dialog open={sessionModalOpen} onOpenChange={setSessionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Add Session"}</DialogTitle>
            <DialogDescription>
              Configure the session name, time window, and thresholds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="sessionName" className="text-xs font-semibold">Session Name *</Label>
              <Input
                id="sessionName"
                placeholder="e.g. Morning, Afternoon, Evening"
                value={sessionForm.name}
                onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sessionStart" className="text-xs font-semibold">Start Time *</Label>
                <Input id="sessionStart" type="time" value={sessionForm.startTime} onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })} className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="sessionEnd" className="text-xs font-semibold">End Time *</Label>
                <Input id="sessionEnd" type="time" value={sessionForm.endTime} onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })} className="mt-1 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sessionLateGrace" className="text-xs font-semibold">Late Grace (min)</Label>
                <Input id="sessionLateGrace" type="number" min={0} max={60} value={sessionForm.lateGraceMinutes} onChange={(e) => setSessionForm({ ...sessionForm, lateGraceMinutes: parseInt(e.target.value) || 0 })} className="mt-1 font-mono" />
                <p className="text-[11px] text-amber-600 mt-1">
                  Late after {(() => { const [h,m] = sessionForm.startTime.split(":").map(Number); const t = h*60+m+sessionForm.lateGraceMinutes; return `${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}` })()}
                </p>
              </div>
              <div>
                <Label htmlFor="sessionEarlyTol" className="text-xs font-semibold">Early Departure (min)</Label>
                <Input id="sessionEarlyTol" type="number" min={0} max={60} value={sessionForm.earlyDepartureToleranceMinutes} onChange={(e) => setSessionForm({ ...sessionForm, earlyDepartureToleranceMinutes: parseInt(e.target.value) || 0 })} className="mt-1 font-mono" />
                <p className="text-[11px] text-orange-600 mt-1">
                  Early before {(() => { const [h,m] = sessionForm.endTime.split(":").map(Number); const t = Math.max(0, h*60+m-sessionForm.earlyDepartureToleranceMinutes); return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}` })()}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="sessionActive" className="text-xs font-semibold">Active</Label>
              <Switch id="sessionActive" checked={sessionForm.isActive} onCheckedChange={(v) => setSessionForm({ ...sessionForm, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSession} className="bg-primary text-white">
              {editingSession ? "Update Session" : "Add Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
