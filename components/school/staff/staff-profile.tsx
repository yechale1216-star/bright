"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  User,
  Building,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Save,
  RefreshCw,
  Camera,
  Key,
  ScanFace,
  Mail,
  Phone,
  Sparkles,
  XCircle,
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/utils/password-validator"
import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { db } from "@/lib/db/database"
import { supabase } from "@/lib/utils/supabase"

export function StaffProfile() {
  const { user } = useAuth()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [profilePhoto, setProfilePhoto] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Face ID state
  const [hasFaceEnrolled, setHasFaceEnrolled] = useState(false)

  const checkFaceStatus = useCallback(async () => {
    try {
      const desc = await db.getStaffFaceDescriptor()
      setHasFaceEnrolled(!!desc?.descriptor)
    } catch {
      setHasFaceEnrolled(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setPhone(user.phone || "")
      setProfilePhoto(user.profile_photo || "")
    }
    checkFaceStatus()
  }, [user, checkFaceStatus])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id || 'staff'}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        setProfilePhoto(data.publicUrl)
        notifications.success("Success", "Profile photo selected. Click 'Save Changes' to update.")
        return
      }
      console.warn("Supabase avatar upload error, fallback to local:", uploadError)
    } catch (err) {
      console.warn("Supabase avatar upload error, fallback to local:", err)
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setProfilePhoto(base64)
      notifications.success("Success", "Profile photo selected. Click 'Save Changes' to update.")
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setIsSavingProfile(true)
    try {
      const res = await apiFetch<{ success: boolean; data: any }>(`${API_URL}/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
          "x-school-id": user.schoolId || "",
          "x-requested-role": "staff",
        },
        body: JSON.stringify({
          full_name: name,
          phone,
          profile_photo: profilePhoto,
        }),
      })

      if (res && res.success) {
        notifications.success("Profile Updated", "Your profile details have been saved.")
        await authService.refreshUserProfile()
      } else {
        notifications.error("Update Failed", "Unable to update profile.")
      }
    } catch (err: any) {
      notifications.error("Update Failed", err.message || "Failed to update profile details.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword) {
      notifications.error("Current Password Required", "Please enter your current password.")
      return
    }

    if (!newPassword) {
      notifications.error("New Password Required", "Please enter a new password.")
      return
    }

    const pv = validatePassword(newPassword)
    if (!pv.isValid) {
      notifications.error("Password Requirements", pv.message)
      return
    }

    if (newPassword !== confirmPassword) {
      notifications.error("Password Mismatch", "New passwords do not match.")
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
          "x-school-id": user?.schoolId || "single-school",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (res && res.success) {
        notifications.success("Password Changed", "Your password has been successfully updated.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        notifications.error("Update Failed", res?.message || "Failed to update password.")
      }
    } catch (err: any) {
      notifications.error("Update Failed", err.message || "Failed to change password.")
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="relative space-y-6 max-w-4xl mx-auto pb-12">
      {/* ── Ambient Background Glow Spheres ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/15 dark:bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      {/* ── Header Card: Frosted Glass Profile Header ── */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/5">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-primary/15 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="relative shrink-0">
            <div className="p-1 rounded-[24px] bg-gradient-to-tr from-primary via-indigo-500 to-cyan-400 shadow-xl shadow-primary/25">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 rounded-[20px]">
                <AvatarImage src={profilePhoto || user?.profile_photo || ""} className="object-cover" />
                <AvatarFallback className="bg-slate-950 text-white font-black text-2xl">
                  {name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase() || "ST"}
                </AvatarFallback>
              </Avatar>
            </div>
            <label
              htmlFor="staff-avatar-upload"
              className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-primary text-white shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Upload profile photo"
            >
              <Camera className="w-3.5 h-3.5" />
              <input
                id="staff-avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {name || user?.name || "Staff Member"}
              </h1>
              <Badge className="bg-primary/15 text-primary border-primary/20 text-[11px] font-bold capitalize py-0.5 px-2.5 rounded-lg shadow-xs">
                {user?.role?.replace("_", " ") || "Staff Member"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              {user?.email || "staff@brightpath.edu.et"}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <Badge variant="outline" className="text-xs font-semibold border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-800/40">
                {user?.schoolName || "Bright Path"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Biometric & Security Status */}
        <div className="space-y-6 md:col-span-1">
          {/* Face ID Biometric Card */}
          <div className="rounded-[26px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-5 shadow-xl shadow-slate-900/5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ScanFace className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Face Biometrics</h3>
                <p className="text-[11px] text-slate-500">Touchless camera check-in</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-white/40 dark:border-white/10 text-center space-y-2">
              {hasFaceEnrolled ? (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300">Face ID Registered</span>
                  <p className="text-[10px] text-slate-500">128-dimensional neural facial vector enrolled</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-xs text-amber-700 dark:text-amber-300">Not Enrolled</span>
                  <p className="text-[10px] text-slate-500">Biometric face registration is managed by school administrators. Please contact your school admin.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Personal Information & Password Change */}
        <div className="space-y-6 md:col-span-2">
          {/* Edit Profile Details */}
          <div className="rounded-[26px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 shadow-xl shadow-slate-900/5 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/20 dark:border-white/10">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Personal Information</h3>
                <p className="text-xs text-slate-500">Update your public staff details</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abebe Bekele"
                  className="h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 9..."
                  className="h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-10 px-5 rounded-xl font-bold text-xs bg-primary text-white shadow-lg shadow-primary/25 gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? "Saving..." : "Save Changes"}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="rounded-[26px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 shadow-xl shadow-slate-900/5 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/20 dark:border-white/10">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Security &amp; Password</h3>
                <p className="text-xs text-slate-500">Change your account login credentials</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 chars (A-Z, a-z, 0-9)"
                    className="h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="h-10 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-xs"
                  />
                </div>
              </div>

              {/* Live validation feedback */}
              {newPassword && (() => {
                const pv = validatePassword(newPassword)
                return (
                  <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-white/5">
                    {[
                      { label: "8+ characters", ok: pv.hasMinLength },
                      { label: "Uppercase (A–Z)", ok: pv.hasUppercase },
                      { label: "Lowercase (a–z)", ok: pv.hasLowercase },
                      { label: "Number (0–9)", ok: pv.hasNumber },
                    ].map(({ label, ok }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-1.5 text-xs font-medium ${
                          ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                        }`}
                      >
                        {ok ? <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                        {label}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Password match feedback */}
              {confirmPassword && newPassword !== confirmPassword && (
                <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  Passwords do not match
                </div>
              )}
              {newPassword && confirmPassword && newPassword === confirmPassword && (
                <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  Passwords match
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || !validatePassword(newPassword).isValid || newPassword !== confirmPassword}
                  variant="outline"
                  className="h-10 px-5 rounded-xl font-bold text-xs border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 gap-2"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{isChangingPassword ? "Updating..." : "Update Password"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
