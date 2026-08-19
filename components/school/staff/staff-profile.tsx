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
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { db } from "@/lib/db/database"
import { StaffFaceEnrollModal } from "@/components/school/staff-face-enroll"

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
  const [isFaceEnrollModalOpen, setIsFaceEnrollModalOpen] = useState(false)

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
    if (newPassword !== confirmPassword) {
      notifications.error("Mismatch", "New passwords do not match.")
      return
    }
    if (newPassword.length < 6) {
      notifications.error("Weak Password", "New password must be at least 6 characters.")
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await apiFetch<{ success: boolean; message: string }>(`${API_URL}/api/users/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
          "x-school-id": user?.schoolId || "",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (res && res.success) {
        notifications.success("Password Updated", "Your password has been changed successfully.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        notifications.error("Password Change Failed", res.message || "Invalid current password.")
      }
    } catch (err: any) {
      notifications.error("Password Change Failed", err.message || "Failed to change password.")
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-8">
      {/* ─── Profile Header Card ─── */}
      <div className="bg-card border border-border/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary/30 shadow-md shrink-0">
          <AvatarImage src={profilePhoto || user?.profile_photo || ""} />
          <AvatarFallback className="text-lg sm:text-xl font-bold bg-primary/20 text-primary">
            {user?.name
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase() || "ST"}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{user?.name || "Staff Member"}</h1>
            <Badge className="bg-primary/10 text-primary border-primary/30 capitalize text-xs">
              {user?.role?.replace("_", " ") || "Staff Member"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{user?.email}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 pt-0.5">
            <Building className="w-3.5 h-3.5 text-primary" />
            <span>{user?.schoolName || "Addis Hiwot School"}</span>
          </p>
        </div>
      </div>

      {/* ─── Face ID Biometric Card ─── */}
      <Card className="border-border/80 shadow-xs bg-card/95 backdrop-blur-sm rounded-2xl">
        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Facial Biometric Authentication
            </CardTitle>
            <CardDescription className="text-xs">
              Facial descriptor used for automatic camera check-in & check-out. No raw photo is stored.
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={() => setIsFaceEnrollModalOpen(true)}
            variant={hasFaceEnrolled ? "outline" : "default"}
            size="sm"
            className="font-semibold gap-2 shrink-0 self-start sm:self-auto"
          >
            <Camera className="w-4 h-4" />
            {hasFaceEnrolled ? "Update Face ID" : "Enroll Face ID"}
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              hasFaceEnrolled ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
            }`}>
              {hasFaceEnrolled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                {hasFaceEnrolled ? "Biometric Template Active" : "No Biometric Face Template Registered"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {hasFaceEnrolled
                  ? "Your face signature is registered and ready for instant automatic verification."
                  : "Tap Enroll Face ID to register your biometric signature in seconds."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Personal Details Form */}
        <Card className="border-border/80 shadow-xs bg-card/95 backdrop-blur-sm rounded-2xl">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Profile Information
            </CardTitle>
            <CardDescription className="text-xs">Update your contact and personal information.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="staff-name" className="text-xs font-semibold">
                  Full Name
                </Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="h-10 text-xs sm:text-sm rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="staff-email" className="text-xs font-semibold">
                  Email Address (Read-only)
                </Label>
                <Input
                  id="staff-email"
                  value={user?.email || ""}
                  disabled
                  className="h-10 text-xs sm:text-sm bg-muted/50 cursor-not-allowed rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="staff-phone" className="text-xs font-semibold">
                  Phone Number
                </Label>
                <Input
                  id="staff-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251..."
                  className="h-10 text-xs sm:text-sm rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="staff-role" className="text-xs font-semibold">
                  System Role (Read-only)
                </Label>
                <Input
                  id="staff-role"
                  value={user?.role?.replace("_", " ").toUpperCase() || "STAFF"}
                  disabled
                  className="h-10 text-xs sm:text-sm bg-muted/50 cursor-not-allowed rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={isSavingProfile}
                className="w-full font-semibold gap-2 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground mt-2 rounded-xl h-11"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Profile
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Change Form */}
        <Card className="border-border/80 shadow-xs bg-card/95 backdrop-blur-sm rounded-2xl">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> Security & Password
            </CardTitle>
            <CardDescription className="text-xs">Update your account password regularly.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="current-pw" className="text-xs font-semibold">
                  Current Password
                </Label>
                <Input
                  id="current-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 text-xs sm:text-sm rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-pw" className="text-xs font-semibold">
                  New Password
                </Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-10 text-xs sm:text-sm rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirm-pw" className="text-xs font-semibold">
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="h-10 text-xs sm:text-sm rounded-xl"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isChangingPassword}
                variant="outline"
                className="w-full font-semibold gap-2 border-primary/40 hover:bg-primary/5 mt-2 rounded-xl h-11"
              >
                {isChangingPassword ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" /> Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Face Enrollment Modal */}
      {user?.id && (
        <StaffFaceEnrollModal
          open={isFaceEnrollModalOpen}
          onOpenChange={setIsFaceEnrollModalOpen}
          preselectedUserId={user.id}
          preselectedUserName={user.name || "Staff Member"}
          onEnrolled={() => {
            checkFaceStatus()
            notifications.success("Face ID Active", "Your face biometric signature is now active.")
          }}
        />
      )}
    </div>
  )
}
