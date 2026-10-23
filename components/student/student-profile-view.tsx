"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Award,
  History,
  Layers,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Save,
  Edit3,
  X,
  Shield,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { studentDb } from "@/lib/db/student-db";
import { notifications } from "@/lib/utils/notifications";
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/utils/password-validator";
import { cn } from "@/lib/utils/utils";

export function StudentProfileView() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("basic");
  const [copiedId, setCopiedId] = useState(false);

  // Edit personal details (phone & address)
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Profile photo upload
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Password update form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await studentDb.getProfile();
      if (res) {
        setProfile(res);
        setEditPhone(res.basicInfo?.phone || res.phone || "");
        setEditAddress(res.basicInfo?.address || res.address || "");
      }
    } catch (err) {
      console.error("[Profile] Error loading profile:", err);
      notifications.error("Profile Error", "Could not load complete profile details.");
    } finally {
      setLoading(false);
    }
  };

  const basic = profile?.basicInfo || {
    fullName: profile?.fullName || "Student",
    studentId: profile?.student_id || "BP-2026-00000",
    grade: profile?.grade || "12",
    section: profile?.section || "A",
    stream: profile?.stream || "General",
    academicYear: profile?.academicYear || "2026/27",
    dateOfBirth: profile?.date_of_birth || "N/A",
    gender: profile?.gender || "N/A",
    phone: profile?.phone || "",
    address: profile?.address || "",
    status: profile?.status || "ACTIVE",
    photo: profile?.photo || null,
    email: profile?.email || "",
  };

  const history = profile?.academicHistory || [
    {
      id: "h1",
      year: basic.academicYear,
      grade: `Grade ${basic.grade}`,
      section: `Section ${basic.section}`,
      stream: basic.stream || "General",
      status: "CURRENT",
    },
  ];

  const contact = profile?.contactInfo || {
    parentName: profile?.parent_name || "Parent / Guardian",
    parentPhone: profile?.parent_phone || "",
    parentEmail: profile?.parent_email || "",
    address: profile?.address || "",
  };

  // Copy Student ID to clipboard
  const handleCopyId = () => {
    if (!basic.studentId) return;
    navigator.clipboard.writeText(basic.studentId);
    setCopiedId(true);
    notifications.success("Copied", "Student ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Save personal contact info changes
  const handleSaveContact = async () => {
    setIsSavingDetails(true);
    try {
      await studentDb.updateProfile({
        phone: editPhone.trim(),
        address: editAddress.trim(),
      });
      notifications.success("Profile Updated", "Your contact details have been saved.");
      setIsEditingContact(false);
      await loadProfile();
    } catch (err: any) {
      notifications.error("Update Failed", err?.message || "Could not save profile details.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Photo Upload Handler (base64 fallback)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notifications.error("Invalid File", "Please select an image file (PNG, JPG, JPEG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notifications.error("File Too Large", "Photo size must be less than 5MB.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          await studentDb.updateProfile({ photo: base64 });
          notifications.success("Photo Updated", "Your profile photo has been updated.");
          await loadProfile();
        } catch (err: any) {
          notifications.error("Upload Failed", err?.message || "Could not update profile photo.");
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsUploadingPhoto(false);
      notifications.error("Upload Error", err?.message || "Could not read image file.");
    }
  };

  // Live password validation
  const pwdValidation = validatePassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordFormValid =
    currentPassword.trim().length > 0 && pwdValidation.isValid && passwordsMatch;

  // Handle Password Update
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      notifications.error("Current Password Required", "Please enter your current password.");
      return;
    }

    if (!newPassword) {
      notifications.error("New Password Required", "Please enter a new password.");
      return;
    }

    if (!pwdValidation.isValid) {
      notifications.error("Security Requirement", pwdValidation.message);
      return;
    }

    if (newPassword !== confirmPassword) {
      notifications.error("Password Mismatch", "New password and confirmation password do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await studentDb.changePassword(currentPassword, newPassword);
      if (res && res.success !== false) {
        notifications.success("Password Updated", "Your password has been successfully updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        throw new Error(res?.message || "Could not update password.");
      }
    } catch (err: any) {
      notifications.error("Update Failed", err?.message || "Could not update password. Please check your current password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-0 animate-pulse">
        <div className="h-8 bg-muted rounded-xl w-48" />
        <div className="h-4 bg-muted/60 rounded-lg w-72" />
        <Card className="rounded-3xl border-border overflow-hidden">
          <div className="h-28 bg-muted/70" />
          <CardContent className="p-6 pt-0 space-y-6">
            <div className="flex items-end gap-4 -mt-12">
              <div className="w-24 h-24 rounded-full bg-muted border-4 border-card" />
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-muted rounded-md w-40" />
                <div className="h-4 bg-muted/80 rounded-md w-28" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted/40" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            Student Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Academic identity, enrollment records, contact information, and security credentials
          </p>
        </div>

        <Button
          onClick={() => setActiveTab("security")}
          variant="outline"
          size="sm"
          className="rounded-xl border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-semibold gap-1.5 self-start sm:self-auto shadow-2xs"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Change Password</span>
        </Button>
      </div>

      {/* Hero Profile Card */}
      <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
        {/* Decorative Banner */}
        <div className="h-28 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        </div>

        <CardContent className="px-6 pb-6 relative pt-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-14 mb-4 gap-4">
            {/* Avatar & Key Identity */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              <div className="relative group">
                <Avatar className="w-24 h-24 ring-4 ring-card shadow-xl shadow-purple-900/10">
                  <AvatarImage src={basic.photo || ""} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-tr from-purple-700 to-indigo-600 text-white text-2xl font-black">
                    {basic.fullName?.slice(0, 2).toUpperCase() || "ST"}
                  </AvatarFallback>
                </Avatar>

                {/* Photo Upload Trigger */}
                <label
                  htmlFor="student-photo-upload"
                  className={cn(
                    "absolute -bottom-1 -right-1 p-2 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-900/30 hover:bg-purple-700 active:scale-95 transition-all cursor-pointer",
                    isUploadingPhoto && "opacity-50 pointer-events-none"
                  )}
                  title="Update profile photo"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <input
                    id="student-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                  />
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-foreground">{basic.fullName}</h3>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-[10px] px-2 py-0.5">
                    {basic.status || "Active"}
                  </Badge>
                </div>

                {/* Student ID with copy button */}
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-400">
                    {basic.studentId}
                  </span>
                  <button
                    onClick={handleCopyId}
                    type="button"
                    className="text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-0.5"
                    title="Copy Student ID"
                  >
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground font-semibold">
                  Grade {basic.grade} - Section {basic.section} • {basic.stream || "General"}
                </p>
              </div>
            </div>

            {/* Read-only status badge */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Certified School Registry</span>
            </div>
          </div>

          {/* Profile Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
            <TabsList className="bg-card/80 border border-border p-1 rounded-2xl w-full sm:w-auto grid grid-cols-2 sm:inline-flex gap-1">
              <TabsTrigger
                value="basic"
                className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"
              >
                Basic Info
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"
              >
                Academic History
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all"
              >
                Parent / Contact
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all flex items-center gap-1.5"
              >
                <KeyRound className="w-3 h-3" />
                Security
              </TabsTrigger>
            </TabsList>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: BASIC INFO */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            <TabsContent value="basic" className="pt-5 space-y-4">
              <div className="flex items-center justify-between pb-1">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  Personal & Academic Records
                </p>
                {!isEditingContact ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingContact(true)}
                    className="h-8 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Contact Details
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingContact(false);
                        setEditPhone(basic.phone || "");
                        setEditAddress(basic.address || "");
                      }}
                      disabled={isSavingDetails}
                      className="h-8 text-xs font-bold rounded-xl"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveContact}
                      disabled={isSavingDetails}
                      className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-1.5"
                    >
                      {isSavingDetails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Full Name</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">{basic.fullName}</p>
                </div>

                {/* Student ID */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Student ID</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {basic.studentId}
                  </p>
                </div>

                {/* Grade & Section */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Current Grade & Section</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    Grade {basic.grade} - Section {basic.section}
                  </p>
                </div>

                {/* Academic Stream */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Academic Stream</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">{basic.stream || "General"}</p>
                </div>

                {/* Academic Year */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Academic Year</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">{basic.academicYear}</p>
                </div>

                {/* Date of Birth */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Date of Birth</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">{basic.dateOfBirth}</p>
                </div>

                {/* Gender */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Gender</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Official
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground mt-0.5">{basic.gender}</p>
                </div>

                {/* Student Personal Phone (Editable) */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Personal Phone Number</p>
                    {isEditingContact && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Editable</span>
                    )}
                  </div>
                  {isEditingContact ? (
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+251 9..."
                      className="mt-1 h-8 text-xs rounded-xl bg-card border-border"
                    />
                  ) : (
                    <p className="text-xs font-bold text-foreground mt-0.5">{basic.phone || "Not specified"}</p>
                  )}
                </div>

                {/* Residential Address (Editable) */}
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">Residential Address</p>
                    {isEditingContact && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Editable</span>
                    )}
                  </div>
                  {isEditingContact ? (
                    <Input
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Enter residence location..."
                      className="mt-1 h-8 text-xs rounded-xl bg-card border-border"
                    />
                  ) : (
                    <p className="text-xs font-bold text-foreground mt-0.5">{basic.address || "Not specified"}</p>
                  )}
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3.5 bg-purple-500/10 dark:bg-purple-950/30 rounded-2xl border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Official Records Notice:</strong> Core student records including full name, student code, grade, and section assignment are officially managed by the school registrar office.
                </p>
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: ACADEMIC HISTORY */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            <TabsContent value="history" className="pt-5 space-y-4">
              <div className="p-4 bg-purple-500/10 dark:bg-purple-950/30 rounded-2xl border border-purple-500/20 text-xs text-foreground leading-relaxed">
                <span className="font-bold text-purple-600 dark:text-purple-400">Academic-Year Architecture:</span>{" "}
                Your complete educational records across all terms and academic years are safely consolidated under your unique student profile.
              </div>

              <div className="space-y-3">
                {history.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-foreground">{item.year}</span>
                        <Badge
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5",
                            item.status === "CURRENT"
                              ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          )}
                        >
                          {item.status || "COMPLETED"}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {item.grade} • {item.section} • {item.stream}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-muted-foreground">Registry Status</span>
                      <p className="text-xs font-bold text-foreground flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Certified by School
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: PARENT / CONTACT INFO */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            <TabsContent value="contact" className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground">Parent / Guardian Name</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{contact.parentName || "Not specified"}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground">Parent Contact Phone</p>
                  <p className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {contact.parentPhone || "Not specified"}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground">Parent Email Address</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{contact.parentEmail || "Not specified"}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground">Emergency Home Address</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{contact.address || basic.address || "Not specified"}</p>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-2xl border border-border text-xs text-muted-foreground leading-relaxed">
                Parents and guardians can also download the Bright Path Parent Portal and log in with their registered phone number to view report cards, daily attendance, and school announcements.
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* TAB 4: SECURITY & PASSWORD UPDATE */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            <TabsContent value="security" className="pt-5 space-y-6">
              <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 space-y-5 shadow-2xs">
                <div>
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-purple-600" />
                    Update Student Account Password
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Keep your account secure by using a strong, unique password.
                  </p>
                </div>

                <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-lg">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Current Password</label>
                    <div className="relative">
                      <Input
                        type={showCurrentPwd ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="pr-10 h-10 rounded-xl text-xs bg-muted/40 border-border focus:ring-purple-500/20"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">New Password</label>
                    <div className="relative">
                      <Input
                        type={showNewPwd ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pr-10 h-10 rounded-xl text-xs bg-muted/40 border-border focus:ring-purple-500/20"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Confirm New Password</label>
                    <div className="relative">
                      <Input
                        type={showConfirmPwd ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="pr-10 h-10 rounded-xl text-xs bg-muted/40 border-border focus:ring-purple-500/20"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="p-3.5 bg-muted/50 rounded-2xl border border-border space-y-2">
                    <p className="text-[11px] font-bold text-foreground">Password Requirements:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      <div className={cn("flex items-center gap-1.5", pwdValidation.hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground")}>
                        {pwdValidation.hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />}
                        <span>At least 8 characters</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", pwdValidation.hasUppercase ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground")}>
                        {pwdValidation.hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />}
                        <span>1 uppercase letter (A–Z)</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", pwdValidation.hasLowercase ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground")}>
                        {pwdValidation.hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />}
                        <span>1 lowercase letter (a–z)</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5", pwdValidation.hasNumber ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground")}>
                        {pwdValidation.hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />}
                        <span>1 number (0–9)</span>
                      </div>
                      <div className={cn("flex items-center gap-1.5 sm:col-span-2", passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground")}>
                        {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground shrink-0" />}
                        <span>Passwords match</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={!isPasswordFormValid || isUpdatingPassword}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold h-10 px-6 shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5 mr-2" />
                          Update Password
                        </>
                      )}
                    </Button>

                    {(currentPassword || newPassword || confirmPassword) && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                        className="rounded-xl text-xs font-semibold h-10"
                      >
                        Reset Form
                      </Button>
                    )}
                  </div>
                </form>
              </div>

              {/* Security Advisory */}
              <div className="p-4 bg-muted/40 rounded-2xl border border-border flex items-start gap-3">
                <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-bold text-foreground">Student Portal Security Guidelines</p>
                  <p>
                    Do not share your Student ID or password with other classmates. If you forget your password or suspect someone else knows it, change it immediately or reach out to your school administrator for assistance.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
