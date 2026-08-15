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
import { supabase } from "@/lib/utils/supabase"
import { Edit2, Check, Calendar, MapPin, ShieldCheck, Navigation } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { useCalendar } from "@/lib/context/calendar-context"

import { AcademicYearManagementTab } from "@/components/school/academic-year-management-tab"

export function Settings() {
  const { calendarPreference, setCalendarPreference } = useCalendar()
  const [settings, setSettings] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [schoolInfo, setSchoolInfo] = useState({ 
    schoolName: "", 
    schoolLogo: "" 
  })
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isEditingSchoolInfo, setIsEditingSchoolInfo] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)



  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      notifications.error("Geolocation Unsupported", "Your browser does not support GPS location detection.")
      return
    }
    notifications.info("Detecting Location", "Fetching device GPS coordinates...")
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
    if (user) {
      setSchoolInfo({
        schoolName: user.schoolName || "",
        schoolLogo: user.schoolLogo || "",
      })
      if (currentUser?.role === "admin" && currentUser?.schoolName === "Setup Required") {
        setIsEditingSchoolInfo(true)
      }
    }

    const handleSettingsChanged = () => {
      loadSettings()
    }
    window.addEventListener("settingsDataChanged", handleSettingsChanged)
    return () => window.removeEventListener("settingsDataChanged", handleSettingsChanged)
  }, [])


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `logos/${fileName}`
      const { error: uploadError } = await supabase.storage.from('school-logos').upload(filePath, file)
      if (!uploadError) {
        const { data } = supabase.storage.from('school-logos').getPublicUrl(filePath)
        setSchoolInfo((prev) => ({ ...prev, schoolLogo: data.publicUrl }))
        notifications.success("Success", "School logo uploaded to Supabase Storage")
        return
      }
    } catch (err) {
      console.warn("Supabase logo upload error, fallback to local:", err)
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setSchoolInfo((prev) => ({ ...prev, schoolLogo: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const currentSettings = await db.getSettings()
      setSettings(currentSettings)
    } catch (error) {
      notifications.error("Error", "Failed to load settings")

    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    console.log("Starting to save settings:", settings)
    setIsSaving(true)
    try {
      if ((user?.role === "admin" || user?.role === "super_admin") && isEditingSchoolInfo) {
        console.log("Saving school info:", { ...schoolInfo })
        const result = await authService.updateSchoolInfo(
          schoolInfo.schoolName, 
          "", // legacy code param
          settings.schoolPhone,
          schoolInfo.schoolLogo
        )

        if (!result.success) {
          notifications.error("Error", result.error || "Failed to update school information")

          setIsSaving(false)
          return
        }

        // Update localStorage with new school info so AuthContext and SchoolContext
        // pick up the change without a full page reload.
        // A page reload causes the native WebView to drop the HTTP-only auth cookie,
        // making validateSession() receive a 401 and log the user out.
        if (typeof window !== "undefined") {
          const storedUserStr = localStorage.getItem("attendance_current_user")
          if (storedUserStr) {
            try {
              const storedUser = JSON.parse(storedUserStr)
              const updatedUser = {
                ...storedUser,
                schoolName: schoolInfo.schoolName,
                schoolLogo: schoolInfo.schoolLogo || storedUser.schoolLogo,
              }
              localStorage.setItem("attendance_current_user", JSON.stringify(updatedUser))

              // Also sync active_school so SchoolContext (TopNav) reflects the update
              const activeSchoolStr = localStorage.getItem("active_school")
              if (activeSchoolStr) {
                try {
                  const activeSchool = JSON.parse(activeSchoolStr)
                  localStorage.setItem("active_school", JSON.stringify({
                    ...activeSchool,
                    name: schoolInfo.schoolName,
                    logo: schoolInfo.schoolLogo || activeSchool.logo,
                  }))
                } catch { /* ignore parse errors */ }
              }
            } catch { /* ignore parse errors */ }
          }
          // Signal AuthContext to sync from localStorage without a full re-validate
          window.dispatchEvent(new Event("userSessionChanged"))
        }
      }

      // Update settings with school info
      const updatedSettings = {
        ...settings,
        schoolName: schoolInfo.schoolName,
        schoolLogo: schoolInfo.schoolLogo,
      }

      console.log("Calling db.updateSettings with:", updatedSettings)
      // updateSettings() now returns the server-confirmed mapped settings object directly.
      // We use it to update React state without an extra getSettings() round-trip,
      // which eliminates the cache-race that caused settings to revert to defaults in the APK.
      const savedSettings = await db.updateSettings(updatedSettings)
      console.log("Settings saved successfully to database")

      setSettings(savedSettings || updatedSettings)
      setIsEditingSchoolInfo(false)

      notifications.success("Settings Saved", "All settings have been updated successfully.")

      console.log("Save settings completed successfully")
    } catch (error) {
      console.error("Error saving settings:", error)
      notifications.error("Error", "Failed to save settings")

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
          <TabsTrigger value="attendance" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">Rules</TabsTrigger>
          <TabsTrigger value="system" className="flex-1 rounded-2xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-[10px] uppercase font-black tracking-widest transition-all">System</TabsTrigger>
        </TabsList>

        <TabsContent value="academic_year" className="space-y-4">
          <AcademicYearManagementTab />
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>School Information</CardTitle>
                  <CardDescription>Basic information about your school</CardDescription>
                </div>
                {mounted && (user?.role === "admin" || user?.role === "super_admin") && !isEditingSchoolInfo && (
                  <Button
                    onClick={() => setIsEditingSchoolInfo(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary/30">
                    {schoolInfo.schoolLogo ? (
                      <img src={schoolInfo.schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2">
                        <p className="typography-label text-[10px] text-muted-foreground uppercase">No Logo</p>
                      </div>
                    )}
                  </div>
                  {isEditingSchoolInfo && (
                    <div className="mt-2">
                      <Label htmlFor="logo-upload" className="typography-helper cursor-pointer text-primary hover:underline">
                        Upload Logo
                      </Label>
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="schoolName">School Name</Label>
                      <Input
                        id="schoolName"
                        value={schoolInfo.schoolName}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, schoolName: e.target.value })}
                        disabled={(user?.role !== "admin" && user?.role !== "super_admin") || !isEditingSchoolInfo}
                        className={(user?.role !== "admin" && user?.role !== "super_admin") || !isEditingSchoolInfo ? "bg-muted cursor-not-allowed" : ""}
                        placeholder="Enter school name"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    value={settings.academicYear || ""}
                    onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                    placeholder="e.g. 2026/2018"
                  />
                </div>
                <div>
                  <Label htmlFor="schoolPhone">School Phone Number</Label>
                  <PhoneInput
                    id="schoolPhone"
                    value={settings.schoolPhone || ""}
                    onChange={(val) => setSettings({ ...settings, schoolPhone: val })}
                  />
                </div>
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
                  Applies your preferred calendar display (EC / GC) across all school portals while preserving standard database integrity.
                </p>
              </div>

              <div>
                <Label htmlFor="schoolAddress">School Address</Label>
                <Textarea
                  id="schoolAddress"
                  value={settings.schoolAddress || ""}
                  onChange={(e) => setSettings({ ...settings, schoolAddress: e.target.value })}
                  placeholder="Enter complete school address"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Configuration</CardTitle>
              <CardDescription>Configure attendance tracking preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="attendanceThreshold">Attendance Threshold (%)</Label>
                <Input
                  id="attendanceThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.attendanceThreshold || 75}
                  onChange={(e) => setSettings({ ...settings, attendanceThreshold: Number.parseInt(e.target.value) })}
                />
                <p className="typography-body text-gray-600 mt-1">Minimum attendance percentage for alerts</p>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Restrict Attendance to School Location (Geofencing)
                    </Label>
                    <p className="typography-body text-muted-foreground">
                      Verify teacher GPS proximity against configured school coordinates before submission.
                    </p>
                  </div>
                  <Switch
                    checked={settings.restrictLocation ?? false}
                    onCheckedChange={(checked) => setSettings({ ...settings, restrictLocation: checked })}
                  />
                </div>

                {settings.restrictLocation && (
                  <div className="bg-muted/40 border rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">School Geographic Location</span>
                      <Button type="button" variant="outline" size="sm" onClick={detectCurrentLocation}>
                        <Navigation className="h-4 w-4 mr-2" /> Detect My Location
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
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <Label>Allow Attendance Outside School</Label>
                        <p className="typography-body text-muted-foreground text-xs">
                          Enable bypass to allow submission outside school radius when needed.
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


