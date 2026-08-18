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
  Info
} from "lucide-react"

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

  useEffect(() => {
    loadHolidays()
    const handler = () => loadHolidays()
    window.addEventListener("holidaysDataChanged", handler)
    return () => window.removeEventListener("holidaysDataChanged", handler)
  }, [])

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
    </div>
  )
}
