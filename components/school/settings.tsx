"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { db } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"

import { parseJsonResponse } from "@/lib/utils/parse-json-response"
import { Check, Calendar, MapPin, ShieldCheck, Navigation } from "lucide-react"
import { useCalendar } from "@/lib/context/calendar-context"

import { AcademicYearManagementTab } from "@/components/school/academic-year-management-tab"
import { StaffScheduleSettingsTab } from "@/components/school/staff-schedule-settings-tab"
import { validateAllScheduleSettings } from "@/lib/utils/schedule-validation"

export function Settings() {
  const { calendarPreference, setCalendarPreference } = useCalendar()
  const [settings, setSettings] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      notifications.error("Geolocation Unsupported", "Your browser does not support GPS location detection.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lon = parseFloat(pos.coords.longitude.toFixed(6))
        setSettings((prev: any) => ({
          ...prev,
          schoolLatitude: lat,
          schoolLongitude: lon,
        }))
        notifications.success("Location Set", `Coordinates detected: ${lat}, ${lon}`)
      },
      (err) => {
        notifications.error("Location Failed", err.message || "Failed to retrieve device location. Check GPS permissions.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    loadSettings()
    const user = authService.getCurrentUser()
    setCurrentUser(user)
    setUser(user)
    setMounted(true)

    const handleSettingsChanged = () => {
      loadSettings()
    }
    window.addEventListener("settingsDataChanged", handleSettingsChanged)
    return () => window.removeEventListener("settingsDataChanged", handleSettingsChanged)
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const currentSettings = await db.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    console.log("Starting to save settings:", settings)
    setIsSaving(true)
    try {
      const updatedSettings = {
        ...settings,
      }

      // Validate schedule settings prior to sending to backend
      const validationRes = validateAllScheduleSettings(updatedSettings)
      if (!validationRes.isValid) {
        const firstError = validationRes.errors[0]?.message || "Invalid schedule configuration."
        notifications.error("Validation Error", firstError)
        setIsSaving(false)
        return
      }

      console.log("Calling db.updateSettings with:", updatedSettings)
      const savedSettings = await db.updateSettings(updatedSettings)
      console.log("Settings saved successfully to database")

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("userSessionChanged"))
        window.dispatchEvent(new CustomEvent("settingsDataChanged"))
        window.dispatchEvent(new CustomEvent("schoolSettingsUpdated"))
      }

      setSettings(savedSettings || updatedSettings)

      notifications.success("Settings Saved", "All settings have been updated successfully.")
      console.log("Save settings completed successfully")
    } catch (error: any) {
      console.error("Error saving settings:", error)
      const errorMsg = error?.message || "Failed to save settings"
      notifications.error("Error", errorMsg)
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (confirm("Are you sure you want to reset all settings to default values?")) {
      setIsLoading(true)
      try {
        await db.resetSettings()
        await loadSettings()
        notifications.success("Settings Reset", "All settings have been reset to default values.")

      } catch (error) {
        notifications.error("Error", "Failed to reset settings")

      } finally {
        setIsLoading(false)
      }
    }
  }

  const clearAllData = async () => {
    notifications.error("Not Available", "Clearing all data must be done through the database admin panel for safety. Contact your system administrator.")
  }

  const exportData = async () => {
    try {
      const students = await db.getStudents()
      const attendance = await db.getAllAttendance()
      const currentSettings = await db.getSettings()

      const exportData = {
        students,
        attendance,
        settings: currentSettings,
        exportDate: new Date().toISOString(),
        exportedBy: user?.name,
        version: "1.0",
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `attendance-system-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      notifications.success("Export Complete", "System data has been exported successfully.")

    } catch (error) {
      notifications.error("Error", "Failed to export data")

    }
  }

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string)

        if (confirm("This will replace all existing data. Are you sure you want to continue?")) {
          setIsLoading(true)

          // Note: clearAllData not available via frontend API
          // Data import will add to existing data rather than replacing

          if (importData.students) {
            for (const student of importData.students) {
              await db.addStudent(student)
            }
          }

          if (importData.attendance) {
            for (const record of importData.attendance) {
              await db.saveAttendance(record)
            }
          }

          if (importData.settings) {
            await db.updateSettings(importData.settings)
            setSettings(importData.settings)
          }

          notifications.success("Import Complete", "Data has been imported successfully.")



        }
      } catch (error) {
        notifications.error("Import Error", "Failed to import data. Please check the file format.")

      } finally {
        setIsLoading(false)
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  if (isLoading) {
    return <PageSkeleton variant="form" />
  }

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-safe">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-normal">
            Settings
          </h1>
          <p className="text-[10px] font-bold text-slate-500/60 dark:text-slate-400/60 uppercase tracking-widest mt-1">
            System Configuration & Preferences
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Badge variant="secondary" className="h-11 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none font-black text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-400">
            Admin Panel
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex w-full bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-[20px] overflow-x-auto scrollbar-hide border border-slate-200/50 dark:border-slate-800/50 h-12">
          <TabsTrigger value="general" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">General</TabsTrigger>
          <TabsTrigger value="academic_year" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">Academic Year</TabsTrigger>
          <TabsTrigger value="staff_schedule" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">Staff Schedule & Holidays</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">Student Rules</TabsTrigger>
          <TabsTrigger value="system" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">System</TabsTrigger>
        </TabsList>

        <TabsContent value="academic_year" className="space-y-4">
          <AcademicYearManagementTab />
        </TabsContent>

        <TabsContent value="staff_schedule" className="space-y-4">
          <StaffScheduleSettingsTab
            settings={settings}
            setSettings={setSettings}
            onSaveSettings={saveSettings}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>General Configuration</CardTitle>
                <CardDescription>Academic year, system calendar, and school address</CardDescription>
              </div>
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="rounded-xl font-bold px-6 shadow-sm"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    value={settings.academicYear || ""}
                    onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                    placeholder="e.g. 2026/2018"
                    className="mt-1.5"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Active academic year cohort identifier
                  </p>
                </div>

                <div>
                  <Label htmlFor="calendarPreference">System Calendar Preference</Label>
                  <Select
                    value={calendarPreference}
                    onValueChange={(val: 'ethiopian' | 'gregorian') => setCalendarPreference(val)}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue placeholder="Select Calendar System" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethiopian">
                        Ethiopian Calendar (የኢትዮጵያ ዘመን አቆጣጠር / EC) - Default
                      </SelectItem>
                      <SelectItem value="gregorian">
                        Gregorian Calendar (የፈረንጆች ዘመን አቆጣጠር / GC)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Display calendar (EC / GC) across all portals
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="schoolAddress">School Address</Label>
                <Textarea
                  id="schoolAddress"
                  value={settings.schoolAddress || ""}
                  onChange={(e) => setSettings({ ...settings, schoolAddress: e.target.value })}
                  placeholder="Enter complete school address"
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              <Separator />

              {/* Campus GPS & Geofencing Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2 font-bold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" /> Restrict Attendance to School Location (Geofencing)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verify teacher &amp; staff GPS proximity against configured school coordinates during attendance.
                    </p>
                  </div>
                  <Switch
                    checked={settings.restrictLocation ?? false}
                    onCheckedChange={(checked) => setSettings({ ...settings, restrictLocation: checked })}
                  />
                </div>

                {settings.restrictLocation && (
                  <div className="bg-muted/40 border rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">School Geographic Coordinates</span>
                      <Button type="button" variant="outline" size="sm" onClick={detectCurrentLocation} className="rounded-xl font-semibold gap-1.5">
                        <Navigation className="h-4 w-4 text-primary" /> Detect My Location
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="schoolLatitude">School Latitude</Label>
                        <Input
                          id="schoolLatitude"
                          type="number"
                          step="any"
                          placeholder="e.g. 9.030000"
                          value={settings.schoolLatitude ?? ""}
                          onChange={(e) => setSettings({ ...settings, schoolLatitude: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="schoolLongitude">School Longitude</Label>
                        <Input
                          id="schoolLongitude"
                          type="number"
                          step="any"
                          placeholder="e.g. 38.740000"
                          value={settings.schoolLongitude ?? ""}
                          onChange={(e) => setSettings({ ...settings, schoolLongitude: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="allowedRadiusMeters">Allowed Radius (meters)</Label>
                        <Input
                          id="allowedRadiusMeters"
                          type="number"
                          min="10"
                          max="5000"
                          placeholder="200"
                          value={settings.allowedRadiusMeters ?? 200}
                          onChange={(e) => setSettings({ ...settings, allowedRadiusMeters: parseInt(e.target.value) || 200 })}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div>
                        <Label>Allow Attendance Outside School</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable bypass to allow recording attendance outside school radius when needed.
                        </p>
                      </div>
                      <Switch
                        checked={settings.allowOutsideAttendance ?? true}
                        onCheckedChange={(checked) => setSettings({ ...settings, allowOutsideAttendance: checked })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="rounded-xl font-bold px-6 shadow-sm"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Student Attendance Rules</CardTitle>
                <CardDescription>Configure student attendance tracking preferences</CardDescription>
              </div>
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="rounded-xl font-bold px-6 shadow-sm"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="attendanceThreshold">Attendance Threshold (%)</Label>
                <Input
                  id="attendanceThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.attendanceThreshold || 75}
                  onChange={(e) => setSettings({ ...settings, attendanceThreshold: Number.parseInt(e.target.value) })}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum attendance percentage for alerts</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="typography-card-title">Attendance Tracking Mode</h3>
                    <p className="typography-body text-muted-foreground">Select how your school tracks daily student presence</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    onClick={() => setSettings({ ...settings, attendanceMode: "daily" })}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      (settings.attendanceMode || "session_based") === "daily" 
                        ? "border-primary bg-primary/10 shadow-md" 
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="typography-label">Daily Mode</span>
                      {(settings.attendanceMode || "session_based") === "daily" && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="typography-helper text-muted-foreground">
                      Single check-in per day. Best for simple attendance tracking where students are marked present once.
                    </p>
                  </div>

                  <div 
                    onClick={() => setSettings({ ...settings, attendanceMode: "session_based" })}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                      (settings.attendanceMode || "session_based") === "session_based" 
                        ? "border-primary bg-primary/10 shadow-md" 
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="typography-label">Session Based</span>
                      {(settings.attendanceMode || "session_based") === "session_based" && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="typography-helper text-muted-foreground">
                      Split tracking for Morning and Afternoon sessions. Ideal for schools with multiple shifts or precise monitoring.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="gradeSystem">Grade System</Label>
                <Select
                  value={settings.gradeSystem || "standard"}
                  onValueChange={(value) => setSettings({ ...settings, gradeSystem: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (K-12)</SelectItem>
                    <SelectItem value="college">College/University</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Late Mark</Label>
                  <p className="typography-body text-muted-foreground">Allow marking students as late</p>
                </div>
                <Switch
                  checked={settings.allowLateMark || true}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowLateMark: checked })}
                />
              </div>
              <Separator />
              <div>
                <Label htmlFor="attendanceUiType">Attendance UI Type</Label>
                <Select
                  value={settings.attendanceUiType || "card_based"}
                  onValueChange={(value) => setSettings({ ...settings, attendanceUiType: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card_based">Card-Based (Standard)</SelectItem>
                    <SelectItem value="tabular">Tabular (Professional)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="typography-body text-gray-600 mt-1">Choose between the card-based layout or a professional table view</p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Attendance Editing by Homeroom Teachers</Label>
                  <p className="typography-body text-muted-foreground">
                    If disabled, teachers cannot edit records after submission without requesting admin permission.
                  </p>
                </div>
                <Switch
                  checked={settings.allowAttendanceEditing ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowAttendanceEditing: checked })}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="rounded-xl font-bold px-6 shadow-sm"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Import and manage system data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    style={{ display: "none" }}
                    id="import-file"
                  />
                  <Button
                    onClick={() => document.getElementById("import-file")?.click()}
                    variant="outline"
                    className="w-full"
                  >
                    📥 Import Data
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Button onClick={resetToDefaults} variant="outline" className="w-full bg-transparent">
                  🔄 Reset to Defaults
                </Button>
                <Button onClick={clearAllData} variant="destructive" className="w-full">
                  🗑️ Clear All Data
                </Button>
                <p className="typography-helper text-muted-foreground text-center">Warning: These actions cannot be undone</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Current system status and information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="typography-body grid grid-cols-2 gap-4">
                <div>
                  <Label>Current User</Label>
                  <p className="font-mono">
                    {user?.name} ({user?.role})
                  </p>
                </div>
                <div>
                  <Label>Last Login</Label>
                  <p className="font-mono">{mounted ? new Date().toLocaleString() : ""}</p>
                </div>
                <div>
                  <Label>Version</Label>
                  <p className="font-mono">1.0.0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mobile Sticky Save Button */}
      <div className="md:hidden fixed bottom-24 left-0 right-0 z-40 px-4 pb-safe pointer-events-none">
        <div className="bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-xl rounded-[32px] p-2.5 border border-white/10 shadow-2xl flex items-center gap-2 pointer-events-auto max-w-lg mx-auto transform translate-y-[-10px]">
          <div className="flex-1 px-4">
               <p className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-tight">Status</p>
               <p className="text-sm font-black text-white leading-none">Ready to Save</p>
          </div>
          <Button
            onClick={saveSettings}
            disabled={isSaving}
            className="h-12 px-8 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/30 active:scale-95 transition-all outline-none"
          >
            {isSaving ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Save All"
            )}
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <Card className="rounded-[32px] border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tight">Save Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={saveSettings} disabled={isSaving} className="w-full h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">
              {isSaving ? "Saving..." : "Save System Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


