"use client"

import { useState, useEffect } from "react"
import { User, Mail, Save, Calendar, Lock, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { supabase } from "@/lib/utils/supabase"
import { useCalendar } from "@/lib/context/calendar-context"

export function UserProfile() {
  const { calendarPreference, setCalendarPreference } = useCalendar()
  const [user, setUser] = useState<any>(null)
  const [school, setSchool] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<any>({})

  // Password change section state
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" })
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  // Normalize user object so full_name is always populated
  const normalizeUser = (u: any) => ({
    ...u,
    full_name: u.full_name || u.name || "",
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      const { getCachedUserProfile, cacheUserProfile } = await import("@/lib/utils/indexeddb-store")
      const idbUser = await getCachedUserProfile()
      if (idbUser) {
        const norm = normalizeUser(idbUser)
        setUser(norm)
        setFormData({
          full_name: norm.full_name,
          email: norm.email || "",
          role: norm.role || "",
          profile_photo: norm.profile_photo || "",
        })
        setIsLoading(false)
      }

      const currentUser = authService.getCurrentUser() as any
      if (currentUser) {
        const normalized = normalizeUser(currentUser)
        setUser(normalized)
        setFormData({
          full_name: normalized.full_name,
          email: normalized.email || "",
          role: normalized.role || "",
          profile_photo: normalized.profile_photo || "",
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
    setFormData((prev: any) => ({ ...prev, [field]: value }))
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
        notifications.success("Success", "Profile photo uploaded")
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
    if (!formData.full_name || formData.full_name.trim() === "") {
      notifications.error("Profile Update", "Full name cannot be empty")
      return
    }
    if (!formData.email || !formData.email.includes("@")) {
      notifications.error("Profile Update", "Please enter a valid email address")
      return
    }
    setIsSaving(true)
    try {
      const updatePayload: any = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
      }
      if (formData.profile_photo !== undefined) {
        updatePayload.profile_photo = formData.profile_photo
      }
      await db.updateTeacher(user.id, updatePayload)
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
      notifications.success("Profile Update", "Profile updated successfully")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      notifications.error("Profile Update", `Failed to update profile: ${errorMsg}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePassword = async () => {
    const { newPassword, confirmPassword } = passwordForm
    if (!newPassword) {
      notifications.error("Password Update", "Please enter a new password")
      return
    }
    if (newPassword.length < 6) {
      notifications.error("Password Update", "Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      notifications.error("Password Update", "Passwords do not match")
      return
    }
    setIsSavingPassword(true)
    try {
      await db.updateTeacher(user.id, { password_hash: newPassword })
      setPasswordForm({ newPassword: "", confirmPassword: "" })
      setShowPasswordSection(false)
      notifications.success("Password Update", "Password changed successfully")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      notifications.error("Password Update", `Failed to change password: ${errorMsg}`)
    } finally {
      setIsSavingPassword(false)
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
      {/* Hero Banner */}
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
              <label className="typography-label block text-muted-foreground">Full Name</label>
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
            <div className="space-y-2">
              <label className="typography-label block text-muted-foreground">Role</label>
              <input
                type="text"
                value={formData.role || user?.role || ""}
                disabled
                className="w-full px-4 py-2.5 border border-input bg-muted/30 rounded-lg text-muted-foreground capitalize cursor-not-allowed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-6">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="px-8 shadow-lg shadow-primary/20">
                Edit Profile
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setIsEditing(false)
                    setFormData({
                      full_name: user?.full_name || user?.name || "",
                      email: user?.email || "",
                      role: user?.role || "",
                      profile_photo: user?.profile_photo || "",
                    })
                  }}
                  variant="outline"
                  className="px-6"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-6 shadow-lg shadow-green-500/20"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving…" : "Save Changes"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ───── Change Password Section ───── */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPasswordSection((prev) => !prev)}
            className="w-full flex items-center justify-between p-6 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-xl">
                <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-foreground">Change Password</p>
                <p className="text-xs text-muted-foreground mt-0.5">Update your account password</p>
              </div>
            </div>
            <Lock className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showPasswordSection ? "rotate-180" : ""}`} />
          </button>

          {showPasswordSection && (
            <div className="px-6 pb-6 space-y-4 border-t border-border pt-5">
              {/* New Password */}
              <div className="space-y-2">
                <label className="typography-label block text-muted-foreground">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPwd ? "text" : "password"}
                    placeholder="Enter new password (min. 6 characters)"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-11 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="typography-label block text-muted-foreground">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-11 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mismatch & Strength Hints */}
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                  Passwords do not match
                </div>
              )}
              {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Passwords match
                </div>
              )}
              {passwordForm.newPassword && !passwordForm.confirmPassword && (
                <div className={`flex items-center gap-2 text-xs font-semibold ${passwordForm.newPassword.length >= 8 ? "text-green-600" : "text-amber-600"}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {passwordForm.newPassword.length >= 8 ? "Strong password" : "Use 8+ characters for a stronger password"}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordSection(false)
                    setPasswordForm({ newPassword: "", confirmPassword: "" })
                  }}
                  disabled={isSavingPassword}
                  className="px-5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePassword}
                  disabled={isSavingPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white flex items-center gap-2 px-6"
                >
                  <KeyRound className="w-4 h-4" />
                  {isSavingPassword ? "Updating…" : "Update Password"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Calendar Preference */}
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
      </div>
    </div>
  )
}
