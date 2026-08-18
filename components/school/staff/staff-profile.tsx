"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  User,
  Mail,
  Phone,
  Building,
  ShieldCheck,
  Lock,
  Save,
  RefreshCw,
  Camera,
  CheckCircle2,
  AlertCircle,
  Key,
} from "lucide-react"
import { useAuth } from "@/lib/context/auth-context"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"

export function StaffProfile() {
  const { user } = useAuth()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [profilePhoto, setProfilePhoto] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setPhone(user.phone || "")
      setProfilePhoto(user.profile_photo || "")
    }
  }, [user])

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
          address,
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
      const res = await apiFetch<{ success: boolean; message: string }>(`${API_URL}/api/users/update-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("attendance_token") || ""}`,
          "x-school-id": user?.schoolId || "",
          "x-requested-role": "staff",
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
        notifications.error("Password Change Failed", res.message || "Invalid current password.")
      }
    } catch (err: any) {
      notifications.error("Password Change Failed", err.message || "Failed to change password.")
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header card */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Avatar className="w-20 h-20 border-2 border-primary/30 shadow-md">
          <AvatarImage src={profilePhoto || user?.profile_photo || ""} />
          <AvatarFallback className="text-xl font-bold bg-primary/20 text-primary">
            {user?.name
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase() || "ST"}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-1.5 text-center sm:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl font-bold text-foreground">{user?.name || "Staff Member"}</h1>
            <Badge className="bg-primary/10 text-primary border-primary/30 capitalize text-xs">
              {user?.role?.replace("_", " ") || "Staff Member"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 pt-1">
            <Building className="w-3.5 h-3.5 text-primary" />
            <span>{user?.schoolName || "Addis Hiwot School"}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details Form */}
        <Card className="border-border/60 shadow-md bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Profile Information
            </CardTitle>
            <CardDescription>Update your contact and personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name" className="text-xs font-semibold">
                  Full Name
                </Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-email" className="text-xs font-semibold">
                  Email Address (Read-only)
                </Label>
                <Input
                  id="staff-email"
                  value={user?.email || ""}
                  disabled
                  className="h-10 text-sm bg-muted/50 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-phone" className="text-xs font-semibold">
                  Phone Number
                </Label>
                <Input
                  id="staff-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251..."
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-role" className="text-xs font-semibold">
                  System Role (Read-only)
                </Label>
                <Input
                  id="staff-role"
                  value={user?.role?.replace("_", " ").toUpperCase() || "STAFF"}
                  disabled
                  className="h-10 text-sm bg-muted/50 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="staff-photo-url" className="text-xs font-semibold">
                  Profile Photo URL
                </Label>
                <Input
                  id="staff-photo-url"
                  value={profilePhoto}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                  placeholder="https://..."
                  className="h-10 text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={isSavingProfile}
                className="w-full font-semibold gap-2 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
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
        <Card className="border-border/60 shadow-md bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Security & Password
            </CardTitle>
            <CardDescription>Update your account password regularly.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-pw" className="text-xs font-semibold">
                  Current Password
                </Label>
                <Input
                  id="current-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-xs font-semibold">
                  New Password
                </Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-xs font-semibold">
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="h-10 text-sm"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isChangingPassword}
                variant="outline"
                className="w-full font-semibold gap-2 border-primary/40 hover:bg-primary/5 mt-4"
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
    </div>
  )
}
