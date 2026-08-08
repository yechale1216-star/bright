"use client"

import { useState, useEffect } from "react"
import { User, Mail, Save, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { parseJsonResponse } from "@/lib/utils/parse-json-response"
import { db } from "@/lib/db/database"
import { supabase } from "@/lib/utils/supabase"
import { useCalendar } from "@/lib/context/calendar-context"

export function UserProfile() {
  const { calendarPreference, setCalendarPreference } = useCalendar()
  const [user, setUser] = useState<any>(null)
  const [school, setSchool] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<any>({})

  // Normalize user object so full_name is always populated (User interface stores 'name')
  const normalizeUser = (u: any) => ({
    ...u,
    full_name: u.full_name || u.name || "",
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      // 1. Instantly hydrate from IndexedDB for 0ms offline rendering
      const { getCachedUserProfile, getCachedSchoolLogo, cacheUserProfile } = await import("@/lib/utils/indexeddb-store")
      const idbUser = await getCachedUserProfile()
      if (idbUser) {
        setUser(normalizeUser(idbUser))
        setFormData({
          full_name: idbUser.name || idbUser.full_name || "",
          email: idbUser.email || "",
          phone: idbUser.phone || "",
          profile_photo: idbUser.profile_photo || "",
        })
        setIsLoading(false)
      }

      // 2. Fetch latest user session and settings
      const currentUser = authService.getCurrentUser() as any
      if (currentUser) {
        const normalized = normalizeUser(currentUser)
        setUser(normalized)
        setFormData({
          full_name: currentUser.name || currentUser.full_name || "",
          email: currentUser.email || "",
          phone: currentUser.phone || "",
          profile_photo: currentUser.profile_photo || "",
        })
        await cacheUserProfile(normalized)
        
        const schoolDetails = await db.getSettings()
        setSchool(schoolDetails)
      }
    } catch (error) {
      console.error("Error loading user profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `user-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        setFormData((prev: any) => ({ ...prev, profile_photo: data.publicUrl }))
        notifications.success("Success", "Profile photo uploaded to Supabase Storage")
        return
      }
    } catch (err) {
      console.warn("Supabase avatar upload error, fallback to local:", err)
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setFormData((prev: any) => ({ ...prev, profile_photo: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async () => {
    try {
      if (!formData.full_name || formData.full_name.trim() === "") {
        notifications.error("Profile Update", "Full name cannot be empty")
        return
      }

      if (!formData.email || !formData.email.includes("@")) {
        notifications.error("Profile Update", "Please enter a valid email address")
        return
      }

      if (formData.password) {
        if (formData.password !== formData.confirmPassword) {
          notifications.error("Profile Update", "Passwords do not match")
          return
        }
        if (formData.password.length < 6) {
          notifications.error("Profile Update", "Password must be at least 6 characters long")
          return
        }
      }

      const updatePayload: any = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
      }

      if (formData.profile_photo !== undefined) {
        updatePayload.profile_photo = formData.profile_photo
      }

      if (formData.password) {
        updatePayload.password_hash = formData.password
      }

      // Use the generic user update endpoint — works for admin, teacher, and super_admin
      await db.updateTeacher(user.id, updatePayload)
      
      // Update local user session in localStorage so they remain authenticated with new credentials
      const updatedUser = { 
        ...user, 
        name: updatePayload.full_name,
        full_name: updatePayload.full_name,
        email: updatePayload.email,
        profile_photo: updatePayload.profile_photo || user.profile_photo
      }
      localStorage.setItem("attendance_current_user", JSON.stringify(updatedUser))
      setUser(updatedUser)
      setIsEditing(false)
      
      // Clear password inputs from form
      setFormData((prev: any) => ({
        ...prev,
        full_name: updatePayload.full_name,
        email: updatePayload.email,
        password: "",
        confirmPassword: ""
      }))

      notifications.success("Profile Update", "Profile updated successfully")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error("[v0] Profile update error:", errorMsg)
      notifications.error("Profile Update", `Failed to update profile: ${errorMsg}`)
    }
  }
  
  const getGreeting = () => {
    const hour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour12: false, hour: 'numeric' }), 10)
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  if (isLoading) {
    return <PageSkeleton variant="form" />
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-primary via-indigo-600 to-indigo-700 text-white rounded-2xl p-8 mb-8 shadow-lg shadow-primary/20">
        <div className="flex items-center gap-6">
          <div className="relative group">
            {(formData.profile_photo || user?.profile_photo) ? (
              <img
                src={formData.profile_photo || user.profile_photo}
                alt={user?.full_name || user?.name}
                className="w-20 h-20 rounded-full object-cover shadow-lg ring-4 ring-white/30 ring-offset-2 ring-offset-indigo-600"
              />
            ) : (
              <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full p-4 shadow-inner">
                <User className="w-10 h-10" />
              </div>
            )}
            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <label htmlFor="profile-photo-upload" className="cursor-pointer p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors">
                  <User className="w-6 h-6 text-white" />
                  <input
                    id="profile-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            )}
          </div>
          <div>
            <p className="typography-label text-indigo-100/80 mb-1">{getGreeting()}</p>
            <h1 className="typography-page-title">{user?.full_name || user?.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <p className="typography-label text-indigo-100/90 capitalize">{user?.role} Account</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="typography-card-title mb-6 text-foreground flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            Personal Information
          </h2>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="typography-label block text-muted-foreground">Name</label>
              <input
                type="text"
                value={formData.full_name || ""}
                onChange={(e) => handleInputChange("full_name", e.target.value)}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-muted/50 disabled:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="typography-label block text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={!isEditing}
                className="w-full px-4 py-2.5 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-muted/50 disabled:text-muted-foreground"
              />
            </div>
            {isEditing && (
              <>
                <div className="space-y-2">
                  <label className="typography-label block text-muted-foreground">New Password</label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current password"
                    value={formData.password || ""}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="w-full px-4 py-2.5 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="typography-label block text-muted-foreground">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm your new password"
                    value={formData.confirmPassword || ""}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className="w-full px-4 py-2.5 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label className="typography-label block text-muted-foreground">Role</label>
              <input
                type="text"
                value={formData.role || ""}
                disabled
                className="w-full px-4 py-2.5 border border-input bg-muted/30 rounded-lg text-muted-foreground capitalize cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* System Preferences */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="typography-card-title mb-4 text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Calendar System Preference
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Choose your preferred date and calendar format across all portal views.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCalendarPreference("ethiopian")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                calendarPreference === "ethiopian"
                  ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                  : "border-border hover:border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              <div className="text-sm font-semibold">Ethiopian Calendar (EC)</div>
              <div className="text-xs text-muted-foreground mt-1">የኢትዮጵያ ዘመን አቆጣጠር (Default)</div>
            </button>
            <button
              type="button"
              onClick={() => setCalendarPreference("gregorian")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                calendarPreference === "gregorian"
                  ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                  : "border-border hover:border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              <div className="text-sm font-semibold">Gregorian Calendar (GC)</div>
              <div className="text-xs text-muted-foreground mt-1">የፈረንጆች ዘመን አቆጣጠር</div>
            </button>
          </div>
        </div>

        {/* School Information */}
        {school && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="typography-card-title mb-6 text-foreground flex items-center gap-2">
              <div className="w-1 h-5 bg-primary rounded-full" />
              School Information
            </h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="typography-label block text-muted-foreground">School Name</label>
                <input
                  type="text"
                  value={school.schoolName || school.name || ""}
                  disabled
                  className="w-full px-4 py-2.5 border border-input bg-muted/30 rounded-lg text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="typography-label block text-muted-foreground">Phone</label>
                <input
                  type="text"
                  value={school.schoolPhone || school.phone || ""}
                  disabled
                  className="w-full px-4 py-2.5 border border-input bg-muted/30 rounded-lg text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="px-8 shadow-lg shadow-primary/20">
              Edit Profile
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  setIsEditing(false)
                  setFormData(normalizeUser(user))
                }}
                variant="outline"
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-6 shadow-lg shadow-green-500/20"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


