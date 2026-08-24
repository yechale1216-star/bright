"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { 
  User, 
  GraduationCap, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar,
  Layers,
  HeartHandshake,
  ShieldAlert,
  Clock,
  Lock,
  KeyRound,
  Camera,
  Upload,
  X,
  CheckCircle2,
  ImageIcon,
  Trash2
} from "lucide-react"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useLanguage } from "@/lib/context/language-context"
import { useSchool } from "@/lib/context/school-context"
import { cn } from "@/lib/utils/utils"

import { apiUrl } from "@/lib/api-config"
const API_URL = apiUrl;

const MAX_FILE_SIZE_MB = 2;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function ProfilePage() {
  const { t } = useLanguage()
  const { activeSchool } = useSchool()
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [studentDetails, setStudentDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // Parent profile state
  const [parentName, setParentName] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [parentAddress, setParentAddress] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null | undefined>(undefined) // undefined = no change
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPhotoSaved, setIsPhotoSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // 1. Initial Load & Auth verification
  const loadData = async () => {
    const studentId = localStorage.getItem("parent_selected_student_id")
    const studentsStr = localStorage.getItem("parent_students")

    if (studentsStr && studentId) {
      const students = JSON.parse(studentsStr)
      const student = students.find((s: any) => s.id === studentId) || students[0]
      if (student) {
        setSelectedStudent(student)
        await fetchFullStudentDetails(student.id)
      }
    }
    
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      setParentName(currentUser.name || "")
      
      // Filter out only auto-generated internal emails (matches: parent-PHONE@zetime.com)
      const email = currentUser.email || ""
      const phoneDigits = (currentUser.phone || "").replace(/[^\d]/g, "")
      const isInternal = email.includes("@zetime.com") && 
                        email.startsWith("parent-") && 
                        (phoneDigits && email.includes(phoneDigits))

      setParentEmail(isInternal ? "" : email)
      
      setParentAddress((currentUser as any).address || "")
      
      // Load saved photo
      const savedPhoto = (currentUser as any).profile_photo || null
      setPhotoPreview(savedPhoto)
    }

    setIsLoading(false)
  }

  // 2. Fetch all student relations (like advisor/teacher details)
  const fetchFullStudentDetails = async (studentId: string) => {
    try {
      const token = localStorage.getItem("attendance_token") || "";
      const schoolId = localStorage.getItem("x-school-id") || "";
      const headers = { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(schoolId ? { "x-school-id": schoolId } : {})
      };

      const res = await fetch(`${API_URL}/api/students/${studentId}`, { headers })
      const data = await res.json()
      if (data.success && data.data) {
        setStudentDetails(data.data)
      }
    } catch (err) {
      console.error("[Profile] Fetch details error:", err)
    }
  }

  // Hook studentChanged event
  useEffect(() => {
    loadData()

    const handleStudentChange = () => {
      setIsLoading(true)
      loadData()
    }

    window.addEventListener("studentChanged", handleStudentChange)
    return () => window.removeEventListener("studentChanged", handleStudentChange)
  }, [])

  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  // ─── Photo Processing ─────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setPhotoError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhotoError("Please upload a JPG, PNG, WebP, or GIF image.")
      return
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setPhotoError(`Image is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      setPhotoPreview(base64)
      setPhotoBase64(base64)  // mark as changed
      setIsPhotoSaved(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleRemovePhoto = () => {
    setPhotoPreview(null)
    setPhotoBase64(null)  // null = explicitly remove
    setIsPhotoSaved(false)
    setPhotoError(null)
  }

  // ─── Profile Submit ────────────────────────────────────────────────────────
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentName) {
      notifications.error(t("validation_error"), t("name_required"))
      return
    }

    setIsUpdatingProfile(true)
    try {
      const payload: any = {
        name: parentName,
        email: parentEmail,
        address: parentAddress,
      }

      // Only include photo if it changed (photoBase64 !== undefined)
      if (photoBase64 !== undefined) {
        payload.profile_photo = photoBase64  // base64 string or null
      }

      const res = await authService.updateParentProfile(user.phone, payload)

      if (res.success) {
        notifications.success(t("success"), t("profile_updated"))
        if (res.user) setUser(res.user)
        if (photoBase64 !== undefined) {
          setIsPhotoSaved(true)
          setPhotoBase64(undefined)  // reset change tracker
        }
      } else {
        notifications.error(t("error"), res.message || t("update_failed"))
      }
    } catch (err) {
      notifications.error(t("error"), "An unexpected error occurred.")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  if (isLoading) {
    return <PageSkeleton variant="form" />
  }

  // Fallback default details if database fields are blank
  const activeStudent = studentDetails || selectedStudent
  const advisor = activeStudent?.school?.teachers?.[0] || {
    name: "School Advisor",
    email: activeStudent?.school?.email || "Not Provided",
    phone: activeStudent?.school?.phone || "Not Provided",
    office: "School Office",
    hours: "Standard Hours"
  }

  const hasPhotoChanged = photoBase64 !== undefined

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div>
        <h1 className="typography-page-title text-foreground">{t("profile_settings")}</h1>
        <p className="typography-label text-muted-foreground mt-0.5">{t("profile_settings_desc")}</p>
      </div>

      {/* ─── PARENT PROFILE SECTION ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Profile Photo + Parent Info Form */}
        <Card className="lg:col-span-2 border-border/40 shadow-lg rounded-3xl bg-card/60 backdrop-blur-md">
          <CardHeader className="border-b border-border/20 pb-4">
            <CardTitle className="typography-label uppercase text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-500" />
              <span>{t("account_info")}</span>
            </CardTitle>
            <CardDescription className="typography-helper mt-0.5">{t("account_info_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleUpdateProfile} className="space-y-6">

              {/* ── Photo Upload ─────────────────────────────────────────────── */}
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                {/* Avatar Preview */}
                <div className="relative flex-shrink-0">
                  <Avatar className="w-24 h-24 ring-4 ring-emerald-500/20 ring-offset-2 ring-offset-card shadow-xl rounded-2xl">
                    {photoPreview ? (
                      <AvatarImage
                        src={photoPreview}
                        alt="Profile photo"
                        className="object-cover rounded-2xl"
                      />
                    ) : null}
                    <AvatarFallback className="typography-page-title bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-2xl text-2xl font-bold">
                      {getInitials(parentName || user?.name || "")}
                    </AvatarFallback>
                  </Avatar>
                  {/* Camera badge overlay */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
                    title="Change photo"
                    aria-label="Change profile photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                {/* Upload Controls */}
                <div className="flex-1 min-w-0">
                  <p className="typography-label text-foreground font-semibold mb-0.5">Profile Photo</p>
                  <p className="typography-helper text-muted-foreground mb-3 text-[11px]">
                    Optional · JPG, PNG, WebP or GIF · Max {MAX_FILE_SIZE_MB}MB
                  </p>

                  {/* Drop Zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative border-2 border-dashed rounded-2xl px-4 py-3 cursor-pointer transition-all duration-200 flex items-center gap-3 group",
                      isDragging
                        ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
                        : "border-border/40 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                      isDragging ? "bg-emerald-500/20" : "bg-muted/50 group-hover:bg-emerald-500/10"
                    )}>
                      {isDragging ? (
                        <Upload className="w-4 h-4 text-emerald-500 animate-bounce" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="typography-label text-foreground text-[12px]">
                        {isDragging ? "Drop to upload" : "Click or drag & drop"}
                      </p>
                      <p className="typography-helper text-muted-foreground text-[10px] truncate">
                        Photo will appear across the app
                      </p>
                    </div>

                    {/* Photo changed indicator */}
                    {hasPhotoChanged && !isPhotoSaved && (
                      <Badge className="ml-auto flex-shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] px-2 py-0.5 rounded-lg">
                        Unsaved
                      </Badge>
                    )}
                    {isPhotoSaved && (
                      <div className="ml-auto flex items-center gap-1 text-emerald-600 flex-shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="typography-helper text-[10px]">Saved</span>
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {photoError && (
                    <p className="typography-helper text-red-500 text-[11px] mt-1.5 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {photoError}
                    </p>
                  )}

                  {/* Remove button — only visible when photo exists */}
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-red-500 transition-colors group"
                    >
                      <Trash2 className="w-3 h-3 group-hover:text-red-500" />
                      Remove photo
                    </button>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="sr-only"
                  onChange={handleFileChange}
                  aria-label="Upload profile photo"
                />
              </div>

              <div className="border-t border-border/10 pt-5 space-y-4">
                {/* Name + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentName" className="typography-label text-muted-foreground">{t("full_name")}</Label>
                    <Input
                      id="parentName"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder={t("enter_name")}
                      className="typography-body h-11 rounded-xl bg-background/50 border-border/50 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail" className="typography-label text-muted-foreground">{t("email")}</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder={t("enter_email")}
                      className="typography-body h-11 rounded-xl bg-background/50 border-border/50 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Phone (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="parentPhone" className="typography-label text-muted-foreground">{t("phone_number")}</Label>
                  <Input
                    id="parentPhone"
                    value={user?.phone || ""}
                    disabled
                    className="typography-body h-11 rounded-xl bg-muted/30 border-border/50 cursor-not-allowed"
                  />
                  <p className="typography-helper text-muted-foreground text-[10px]">{t("phone_change_not_allowed")}</p>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="parentAddress" className="typography-label text-muted-foreground">{t("address")}</Label>
                  <Input
                    id="parentAddress"
                    value={parentAddress}
                    onChange={(e) => setParentAddress(e.target.value)}
                    placeholder={t("enter_address")}
                    className="typography-body h-11 rounded-xl bg-background/50 border-border/50 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={isUpdatingProfile}
                    className="typography-label h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md shadow-emerald-500/10"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Spinner size="sm" className="text-white mr-2" />
                        {t("saving")}
                      </>
                    ) : (
                      t("save_changes")
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right: Security/Password card */}
        <Card className="border-border/40 shadow-lg rounded-3xl bg-card/60 backdrop-blur-md">
          <CardHeader className="border-b border-border/20 pb-4">
            <CardTitle className="typography-label uppercase text-muted-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span>{t("security_settings")}</span>
            </CardTitle>
            <CardDescription className="typography-helper mt-0.5">{t("security_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (newPassword !== confirmPassword) {
                notifications.error(t("validation_error"), t("passwords_not_match"))
                return
              }
              if (newPassword.length < 6) {
                notifications.error(t("validation_error"), t("password_len_error"))
                return
              }
              setIsChangingPassword(true)
              try {
                const res = await authService.updateParentPassword(user.phone, currentPassword, newPassword)
                if (res.success) {
                  notifications.success(t("security_update"), t("password_updated"))
                  setCurrentPassword("")
                  setNewPassword("")
                  setConfirmPassword("")
                } else {
                  notifications.error(t("update_failed"), res.message || t("invalid_credentials"))
                }
              } catch (err) {
                notifications.error(t("update_failed"), t("unexpected_error"))
              } finally {
                setIsChangingPassword(false)
              }
            }} className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="typography-label text-muted-foreground">{t("current_password")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="typography-body h-11 rounded-xl bg-background/50 border-border/50 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="typography-label text-muted-foreground">{t("new_password")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="typography-body h-11 rounded-xl bg-background/50 border-border/50 focus:ring-emerald-500/20"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="typography-label text-muted-foreground">{t("confirm_password")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="typography-body h-11 rounded-xl bg-background/50 border-border/50 focus:ring-emerald-500/20"
                />
              </div>

              <Button 
                type="submit" 
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="typography-label mt-2 h-11 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                {isChangingPassword ? (
                  <>
                    <Spinner size="sm" className="text-white mr-2" />
                    {t("updating")}...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" />
                    {t("update_password")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ─── STUDENT INFO SECTION ────────────────────────────────────────── */}
      <div className="pt-4">
        <h2 className="typography-section-title text-foreground mb-4">{t("student_info")}</h2>
        
        {/* Main Hero Card for Student */}
        <Card className="border-border/40 shadow-xl rounded-3xl bg-card/60 backdrop-blur-md overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-emerald-600 to-teal-500 opacity-80" />
          <CardContent className="p-6 relative">
            <div className="flex flex-col md:flex-row md:items-end justify-between -mt-16 gap-4">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                <Avatar className="w-24 h-24 border-4 border-card rounded-2xl ring-2 ring-emerald-600/10 shadow-xl">
                  <AvatarFallback className="typography-page-title bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-xl">
                    {getInitials(activeStudent?.fullName || activeStudent?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <div className="pb-1">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h2 className="typography-section-title text-foreground">{activeStudent?.fullName || activeStudent?.name}</h2>
                    <Badge variant="outline" className="typography-label bg-emerald-500/5 text-emerald-600 border-emerald-500/20 text-[9px] uppercase rounded-md py-0.5">
                      {t("active_status")}
                    </Badge>
                  </div>
                  <p className="typography-label text-muted-foreground mt-0.5">
                    {t("roll_id")}: <span className="typography-label">{activeStudent?.rollNumber || activeStudent?.id?.slice(0, 8).toUpperCase() || "N/A"}</span>
                  </p>
                </div>
              </div>

              <div className="typography-label flex flex-wrap justify-center gap-4 text-muted-foreground pt-2">
                <div className="flex items-center gap-1">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>{t("grade_section").replace("{grade}", activeStudent?.grade || "").replace("{section}", activeStudent?.section || "")}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/40 shadow-lg rounded-3xl bg-card/60 backdrop-blur-md">
            <CardHeader className="border-b border-border/20 pb-4">
              <CardTitle className="typography-label uppercase text-muted-foreground flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-500" />
                <span>{t("enrollment_info")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="typography-label p-6 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/10">
                <span className="text-muted-foreground">{t("full_name")}</span>
                <span className="typography-label text-foreground">{activeStudent?.fullName || activeStudent?.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/10">
                <span className="text-muted-foreground">{t("class_section")}</span>
                <span className="typography-label text-foreground">{t("grade_section").replace("{grade}", activeStudent?.grade || "").replace("{section}", activeStudent?.section || "")}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/10">
                <span className="text-muted-foreground">{t("academic_institution")}</span>
                <span className="typography-label text-foreground">{activeSchool?.name || "School Portal"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-lg rounded-3xl bg-card/60 backdrop-blur-md">
            <CardHeader className="border-b border-border/20 pb-4">
              <CardTitle className="typography-label uppercase text-muted-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-500" />
                <span>{t("faculty_advisor")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="typography-label p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border rounded-xl ring-2 ring-emerald-600/5">
                  <AvatarFallback className="typography-label bg-emerald-50 text-emerald-700 rounded-lg">
                    {getInitials(advisor.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="typography-label text-foreground">{advisor.name}</p>
                  <span className="typography-label text-[10px] text-muted-foreground block mt-0.5">{t("homeroom_advisor")}</span>
                </div>
              </div>
              <div className="space-y-2 border-t border-border/10 pt-3">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{advisor.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{advisor.phone}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="typography-label text-emerald-700 dark:text-emerald-300">{t("office_hours")}: {advisor.hours}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}
