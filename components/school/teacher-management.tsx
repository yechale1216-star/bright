"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { 
  Trash2, 
  Edit, 
  Download, 
  User, 
  Mail, 
  Phone, 
  BookOpen, 
  GraduationCap, 
  X, 
  Award, 
  Briefcase, 
  Eye, 
  ShieldCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  Camera,
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react"
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/utils/password-validator"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils/utils"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { TeacherAssignmentManagement } from "@/components/school/teacher-assignment-management"
import { useSearchParams } from "next/navigation"
import { useSchoolSettings } from "@/hooks/use-school-settings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Teacher {
  id: string
  full_name: string
  email: string
  phone?: string
  subject?: string
  qualification?: string
  experience_years?: number
  created_at?: string
  teacher_id?: string
  is_active?: boolean
  profile_photo?: string
  attendanceMode?: string
}

interface TeacherManagementProps {
  defaultTab?: "teachers" | "assignments"
}

export function TeacherManagement({ defaultTab = "teachers" }: TeacherManagementProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")

  const [activeTab, setActiveTab] = useState<"teachers" | "assignments">(
    tabParam === "assignments" ? "assignments" : defaultTab
  )
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "+251",
    subject: "",
    qualification: "",
    experience_years: "",
    attendanceMode: "DAILY",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)

  // Global attendance mode setting
  const { settings: schoolSettings } = useSchoolSettings()
  const globalAttendanceMode: "DAILY" | "SESSION" | "BOTH" = (() => {
    const raw = schoolSettings?.attendanceModeSetting ?? schoolSettings?.attendance_mode_setting ?? schoolSettings?.staffAttendanceMode ?? schoolSettings?.staff_attendance_mode ?? "daily"
    const upper = String(raw ?? "DAILY").trim().toUpperCase()
    if (upper === "SESSION" || upper === "SESSION_BASED") return "SESSION"
    if (upper === "BOTH") return "BOTH"
    return "DAILY"
  })()
  
  // Modal & assignment loading states
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)

  // Search, Filtering, Sorting & Pagination States
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all")
  const [subjectFilter, setSubjectFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"newest" | "name_asc" | "name_desc" | "experience_desc" | "experience_asc">("newest")

  const loadData = async (isBackground = false, forceRefetch = false) => {
    if (!isBackground && teachers.length === 0) setIsLoading(true)
    if (isBackground) setIsSyncing(true)
    try {
      const teachersData = await db.getTeachers(forceRefetch)
      setTeachers(teachersData)
    } catch (error) {
      console.error("Error loading teachers:", error)
    } finally {
      setIsLoading(false)
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    loadData()

    // Real-time synchronization event listener across components
    const handleTeacherChanged = () => {
      loadData(true, true)
    }

    window.addEventListener("teacherDataChanged", handleTeacherChanged)

    // Background polling for instant updates (every 30 seconds)
    const pollInterval = setInterval(() => {
      loadData(true, true)
    }, 30000)

    return () => {
      window.removeEventListener("teacherDataChanged", handleTeacherChanged)
      clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    if (tabParam === "assignments" && activeTab !== "assignments") {
      setActiveTab("assignments")
    } else if (tabParam === "teachers" && activeTab !== "teachers") {
      setActiveTab("teachers")
    }
  }, [tabParam])

  const handleTabChange = (newTab: "teachers" | "assignments") => {
    setActiveTab(newTab)
    try {
      const url = new URL(window.location.href)
      if (newTab === "assignments") {
        url.searchParams.set("tab", "assignments")
      } else {
        url.searchParams.delete("tab")
      }
      window.history.replaceState({}, "", url.toString())
    } catch {
      // ignore
    }
  }

  // Load teacher assignments when detail modal opens
  useEffect(() => {
    if (selectedTeacher) {
      const loadAssignments = async () => {
        setIsLoadingAssignments(true)
        try {
          const teacherIdToQuery = selectedTeacher.teacher_id || selectedTeacher.id
          const data = await db.getTeacherAssignments(undefined, teacherIdToQuery)
          setAssignments(data)
        } catch (error) {
          console.error("Error loading assignments:", error)
        } finally {
          setIsLoadingAssignments(false)
        }
      }
      loadAssignments()
    } else {
      setAssignments([])
    }
  }, [selectedTeacher])

  // Extract unique subjects for filtering
  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>()
    teachers.forEach(t => {
      if (t.subject && t.subject.trim()) {
        subjects.add(t.subject.trim())
      }
    })
    return Array.from(subjects).sort()
  }, [teachers])

  // Compute Statistics Cards
  const stats = useMemo(() => {
    const total = teachers.length
    const active = teachers.filter(t => t.is_active !== false).length
    const suspended = teachers.filter(t => t.is_active === false).length
    const subjectsCount = availableSubjects.length
    return { total, active, suspended, subjectsCount }
  }, [teachers, availableSubjects])

  // Apply Search, Filters, and Sorting
  const filteredTeachers = useMemo(() => {
    return teachers
      .filter((teacher) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchesName = teacher.full_name?.toLowerCase().includes(q)
          const matchesEmail = teacher.email?.toLowerCase().includes(q)
          const matchesPhone = teacher.phone?.toLowerCase().includes(q)
          const matchesSubject = teacher.subject?.toLowerCase().includes(q)
          if (!matchesName && !matchesEmail && !matchesPhone && !matchesSubject) {
            return false
          }
        }
        // Status Filter
        if (statusFilter === "active" && teacher.is_active === false) return false
        if (statusFilter === "suspended" && teacher.is_active !== false) return false

        // Subject Filter
        if (subjectFilter !== "all" && teacher.subject !== subjectFilter) return false

        return true
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") return a.full_name.localeCompare(b.full_name)
        if (sortBy === "name_desc") return b.full_name.localeCompare(a.full_name)
        if (sortBy === "experience_desc") return (b.experience_years || 0) - (a.experience_years || 0)
        if (sortBy === "experience_asc") return (a.experience_years || 0) - (b.experience_years || 0)
        // Newest default (by created_at or array position)
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        return 0
      })
  }, [teachers, searchQuery, statusFilter, subjectFilter, sortBy])

  // Show all teachers — no pagination

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (!editingTeacher && !formData.password) {
        notifications.error("Validation Error", "Password is required for new teachers")
        setIsSaving(false)
        return
      }

      if (formData.password) {
        const pv = validatePassword(formData.password)
        if (!pv.isValid) {
          notifications.error("Password Requirements", pv.message)
          setIsSaving(false)
          return
        }
      }

      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        subject: formData.subject.trim(),
        qualification: formData.qualification.trim(),
        experience_years: formData.experience_years ? Number.parseInt(formData.experience_years) : undefined,
        ...(formData.password && { password_hash: formData.password }),
        ...(profilePhoto && { profile_photo: profilePhoto }),
        attendanceMode: formData.attendanceMode || "DAILY",
      }

      if (editingTeacher) {
        // Optimistic update: update teacher in local state immediately
        const updatedPayload = { ...editingTeacher, ...payload }
        setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, ...updatedPayload } : t))
        
        await db.updateTeacher(editingTeacher.id, payload)
        notifications.success("Teacher Updated Successfully", "The teacher information has been updated.")
        setIsFormVisible(false)
        setEditingTeacher(null)
      } else {
        const newTeacher = await db.createTeacher(payload)
        // Optimistic update: add to local state immediately with real server data
        if (newTeacher) {
          setTeachers(prev => [newTeacher, ...prev])
        }
        setShowSuccess(true)
        setTimeout(() => {
          setShowSuccess(false)
          setIsFormVisible(false)
          setProfilePhoto(null)
        }, 2000)
      }

      // Background force refresh to sync exact server state
      loadData(true, true)

      // Reset form
      setFormData({
        full_name: "",
        email: "",
        password: "",
        phone: "+251",
        subject: "",
        qualification: "",
        experience_years: "",
        attendanceMode: "DAILY",
      })
    } catch (error: any) {
      console.error("Error saving teacher:", error)
      notifications.error("Error", error.message || "Failed to save teacher")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setIsFormVisible(true)
    setProfilePhoto(teacher.profile_photo || null)
    setFormData({
      full_name: teacher.full_name || "",
      email: teacher.email || "",
      password: "",
      phone: teacher.phone || "+251",
      subject: teacher.subject || "",
      qualification: teacher.qualification || "",
      experience_years: teacher.experience_years ? teacher.experience_years.toString() : "",
      attendanceMode: String(teacher.attendanceMode || "DAILY").trim().toUpperCase() === "SESSION" ? "SESSION" : "DAILY",
    })
  }

  const handleToggleStatus = async (teacher: Teacher) => {
    const isActivating = teacher.is_active === false
    const actionText = isActivating ? "Restore" : "Suspend"
    if (!window.confirm(`Are you sure you want to ${actionText.toLowerCase()} ${teacher.full_name}?`)) {
      return
    }

    // Optimistic update: update is_active in local state immediately
    const updatedStatus = isActivating ? true : false
    setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, is_active: updatedStatus } : t))

    try {
      if (isActivating) {
        await db.restoreTeacher(teacher.id)
        notifications.success("Teacher Restored", `${teacher.full_name} has been reactivated.`)
      } else {
        await db.updateTeacher(teacher.id, { is_active: false })
        notifications.success("Teacher Suspended", `${teacher.full_name} has been suspended.`)
      }
      loadData(true, true)
    } catch (error: any) {
      console.error(`Error toggling status for teacher:`, error)
      notifications.error("Status Update Failed", error.message || "Failed to update teacher status")
      // Revert optimistic update on failure
      loadData(true, true)
    }
  }

  const handleDelete = async (teacherId: string, teacherName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${teacherName}? This will also remove all class assignments linked to them.`)) {
      return
    }

    // Optimistic update: remove from local state immediately
    setTeachers(prev => prev.filter(t => t.id !== teacherId))
    if (selectedTeacher?.id === teacherId) {
      setSelectedTeacher(null)
    }

    try {
      await db.deleteTeacher(teacherId)
      notifications.success("Teacher Deleted Successfully", "The teacher has been removed from the system.")
      loadData(true, true)
    } catch (error: any) {
      console.error("Error deleting teacher:", error)
      notifications.error("Error", error.message || "Failed to delete teacher")
      // Revert optimistic update on failure
      loadData(true, true)
    }
  }

  const exportTeacherListToCSV = () => {
    try {
      const headers = ["Name", "Email", "Phone", "Subject", "Qualification", "Experience (Years)", "Status"]

      const csvData = filteredTeachers.map((teacher) => [
        `"${teacher.full_name}"`,
        teacher.email,
        teacher.phone || "",
        `"${teacher.subject || ""}"`,
        `"${teacher.qualification || ""}"`,
        teacher.experience_years || "",
        teacher.is_active !== false ? "Active" : "Suspended"
      ])

      const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `teachers_list_${new Date().toISOString().split("T")[0]}.csv`
      link.style.display = "none"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)

      notifications.success("Export Complete", `Successfully exported ${filteredTeachers.length} teachers to CSV`)
    } catch (error) {
      console.error("CSV export error:", error)
      notifications.error("Export Failed", "Failed to export teacher list. Please try again.")
    }
  }

  const getInitials = (name: string) => {
    if (!name) return "T"
    const parts = name.trim().split(/\s+/)
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2)
  }

  const getAvatarGradient = (id: string) => {
    const gradients = [
      "from-blue-500 to-indigo-600",
      "from-emerald-400 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-pink-500 to-rose-600",
      "from-amber-400 to-orange-600",
      "from-cyan-400 to-blue-600",
    ]
    let hash = 0
    for (let i = 0; i < (id || "").length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % gradients.length
    return gradients[index]
  }

  if (isLoading) {
    return <PageSkeleton variant="table" />
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto w-full">
      {/* Top Sub-Navigation Tabs: Teachers List & Assignments */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pt-safe">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Teacher Management
            </h1>
            {isSyncing && activeTab === "teachers" && (
              <span className="inline-flex items-center text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 animate-pulse">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing...
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            Faculty Directory & Class Allocations
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 w-fit">
          <button
            type="button"
            onClick={() => handleTabChange("teachers")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200",
              activeTab === "teachers"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Teachers List</span>
            <span className={cn(
              "ml-1 text-[10px] px-2 py-0.5 rounded-full font-extrabold",
              activeTab === "teachers"
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            )}>
              {teachers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("assignments")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200",
              activeTab === "assignments"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span>Class Assignments</span>
          </button>
        </div>
      </div>

      {activeTab === "assignments" ? (
        <TeacherAssignmentManagement />
      ) : (
        <>
          {/* Action Bar for Teachers List */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-normal">
                Faculty Directory
              </h2>
              <p className="text-[10px] font-bold text-slate-500/60 dark:text-slate-400/60 uppercase tracking-widest mt-0.5">
                Active & Registered Teachers Roster
              </p>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button 
                onClick={() => loadData(true, true)} 
                disabled={isSyncing}
                variant="outline" 
                className="flex-1 md:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin text-blue-600")} />
                Sync Roster
              </Button>

              <Button 
                onClick={exportTeacherListToCSV} 
                disabled={filteredTeachers.length === 0} 
                variant="outline"
                className="flex-1 md:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>

              <Button
                onClick={() => {
                  setEditingTeacher(null)
                  setFormData({ full_name: "", email: "", password: "", phone: "+251", subject: "", qualification: "", experience_years: "", attendanceMode: "DAILY" })
                  setShowSuccess(false)
                  setIsFormVisible(true)
                }}
                className="hidden md:flex h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </div>
          </div>

      {/* Floating Add Button for Mobile */}
      <Button
        onClick={() => {
          setEditingTeacher(null)
          setFormData({ full_name: "", email: "", password: "", phone: "+251", subject: "", qualification: "", experience_years: "", attendanceMode: "DAILY" })
          setShowSuccess(false)
          setIsFormVisible(true)
        }}
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-2xl bg-blue-600 text-white shadow-2xl shadow-blue-600/40 z-40 flex items-center justify-center active:scale-95 transition-all outline-none"
      >
        <Plus className="w-7 h-7" />
      </Button>

      {/* Dynamic Summary Widgets / Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1 md:px-0">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Faculty</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Faculty</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suspended</p>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{stats.suspended}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subjects Taught</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{stats.subjectsCount}</p>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search, Filters, Sorting */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              placeholder="Search by name, email, phone..."
              className="pl-10 h-11 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e: any) => { setStatusFilter(e.target.value); }}
              className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); }}
              className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">All Specializations</option>
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="newest">Sort: Recently Added</option>
              <option value="name_asc">Sort: Name (A to Z)</option>
              <option value="name_desc">Sort: Name (Z to A)</option>
              <option value="experience_desc">Sort: Experience (High to Low)</option>
              <option value="experience_asc">Sort: Experience (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Indicator */}
        {(searchQuery || statusFilter !== "all" || subjectFilter !== "all") && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500">
              Showing {filteredTeachers.length} of {teachers.length} faculty members
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("all")
                setSubjectFilter("all")
              }}
              className="h-7 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Faculty Card Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Faculty Roster ({filteredTeachers.length})
          </span>
        </h2>

        {filteredTeachers.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/30 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 mx-1">
            <div className="w-16 h-16 bg-background rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
              <User className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
              No faculty members found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search criteria or register a new teacher.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 px-1 md:px-0">
            {filteredTeachers.map((teacher) => {
              const bgGradient = getAvatarGradient(teacher.id)
              const isActive = teacher.is_active !== false

              return (
                <div 
                  key={teacher.id} 
                  className={cn(
                    "group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-[28px] border shadow-sm transition-all hover:shadow-md flex flex-col justify-between cursor-pointer",
                    isActive ? "border-slate-100 dark:border-slate-800" : "border-rose-200/60 dark:border-rose-950/60 bg-rose-50/10 dark:bg-rose-950/10"
                  )}
                  onClick={() => setSelectedTeacher(teacher)}
                >
                  <div>
                    {/* Teacher Avatar & Full Name Header */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      {teacher.profile_photo ? (
                        <img
                          src={teacher.profile_photo}
                          alt={teacher.full_name}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white text-base font-black shadow-inner flex-shrink-0`}>
                          {getInitials(teacher.full_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 
                          title={teacher.full_name}
                          className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100 leading-snug break-words uppercase tracking-tight line-clamp-2"
                        >
                          {teacher.full_name}
                        </h3>
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1.5 truncate">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                            isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                          )} />
                          <span className="truncate">{teacher.subject || "General Teacher"}</span>
                        </p>
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="mt-3.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate font-medium">{teacher.email}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate font-medium">{teacher.phone || "No phone added"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Experience, Actions & Status Badge */}
                  <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Experience</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {teacher.experience_years ? `${teacher.experience_years} Years` : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleToggleStatus(teacher)}
                          title={isActive ? "Suspend Faculty Member" : "Restore Faculty Member"}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                            isActive ? "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50" : "bg-rose-100 dark:bg-rose-900/40 text-rose-600 hover:text-emerald-600"
                          )}
                        >
                          {isActive ? <ShieldCheck className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => handleEdit(teacher)}
                          title="Edit Teacher Profile"
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(teacher.id, teacher.full_name)}
                          title="Delete Teacher"
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Attendance Mode Pill (when global is BOTH) */}
                      {globalAttendanceMode === "BOTH" && (
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border",
                          (teacher.attendanceMode || "DAILY").toUpperCase() === "SESSION"
                            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
                            : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                        )}>
                          {(teacher.attendanceMode || "DAILY").toUpperCase() === "SESSION" ? "Session" : "Daily"}
                        </span>
                      )}

                      {/* Status Pill */}
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border",
                        isActive 
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" 
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900"
                      )}>
                        {isActive ? "Active" : "Suspended"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}


      </div>

      {/* Register / Edit Dialog */}
      <Dialog open={isFormVisible} onOpenChange={(open) => { if (!open) { setIsFormVisible(false); setShowSuccess(false) } }}>
        <DialogContent className="sm:max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-0 overflow-hidden">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-300">
              <DialogTitle className="sr-only">Registration Successful</DialogTitle>
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce mb-5">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-lg font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Successfully Registered!</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">The teacher has been added and roster refreshed.</p>
            </div>
          ) : (
            <>
              <DialogHeader className="bg-gradient-to-r from-blue-50/60 to-indigo-50/20 dark:from-slate-800/60 dark:to-slate-900/20 border-b border-slate-100 dark:border-slate-800/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900 dark:text-white uppercase tracking-normal">
                      {editingTeacher ? "Update Faculty Member" : "Register Faculty Member"}
                    </DialogTitle>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Provide complete personal and academic specialization fields.</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-6 max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Profile Photo Upload */}
                  <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile preview"
                          className="w-20 h-20 rounded-full object-cover shadow-md ring-2 ring-blue-500/80 dark:ring-blue-400/80 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
                        />
                      ) : (
                        <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarGradient(formData.full_name || 'T')} flex items-center justify-center text-white text-xl font-black shadow-md`}>
                          {getInitials(formData.full_name || 'T')}
                        </div>
                      )}
                      <label
                        htmlFor="photo-upload"
                        className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors"
                        title="Upload photo"
                      >
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </label>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => setProfilePhoto(reader.result as string)
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Profile Photo</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Optional · JPG, PNG or WebP</p>
                      {profilePhoto && (
                        <button
                          type="button"
                          onClick={() => setProfilePhoto(null)}
                          className="text-[11px] text-rose-500 hover:text-rose-600 mt-1 transition-colors font-semibold"
                        >
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Full Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                        required
                        placeholder="e.g. Dr. Abebe Kebede"
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Email Address <span className="text-red-500">*</span></Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        required
                        placeholder="username@school.com"
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Password {!editingTeacher && <span className="text-red-500">*</span>}</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                        required={!editingTeacher}
                        placeholder={editingTeacher ? "Min. 8 chars to change (or leave empty)" : "Min. 8 chars (A-Z, a-z, 0-9)"}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <p className="text-[11px] text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
                      
                      {/* Live validation feedback */}
                      {formData.password && (() => {
                        const pv = validatePassword(formData.password)
                        return (
                          <div className="grid grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-white/5">
                            {[
                              { label: '8+ characters', ok: pv.hasMinLength },
                              { label: 'Uppercase (A–Z)', ok: pv.hasUppercase },
                              { label: 'Lowercase (a–z)', ok: pv.hasLowercase },
                              { label: 'Number (0–9)', ok: pv.hasNumber },
                            ].map(({ label, ok }) => (
                              <div
                                key={label}
                                className={`flex items-center gap-1.5 text-xs font-medium ${
                                  ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                                }`}
                              >
                                {ok ? <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                                {label}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Phone (Ethiopia +251)</Label>
                      <Input
                        id="phone"
                        placeholder="+251911223344"
                        maxLength={13}
                        value={formData.phone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^\d+]/g, "")
                          if (val.lastIndexOf("+") > 0) val = "+" + val.replace(/\+/g, "")
                          setFormData((prev) => ({ ...prev, phone: val }))
                        }}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Primary Subject</Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        placeholder="e.g. Mathematics"
                        onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qualification" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Qualification</Label>
                      <Input
                        id="qualification"
                        placeholder="e.g. BSc Education"
                        value={formData.qualification}
                        onChange={(e) => setFormData((prev) => ({ ...prev, qualification: e.target.value }))}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experience_years" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Experience (years)</Label>
                      <Input
                        id="experience_years"
                        type="number"
                        placeholder="e.g. 5"
                        value={formData.experience_years}
                        onChange={(e) => setFormData((prev) => ({ ...prev, experience_years: e.target.value }))}
                        className="rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  {/* Attendance Mode — only shown when global setting is BOTH */}
                  {globalAttendanceMode === "BOTH" && (
                    <div className="space-y-2 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                      <Label htmlFor="attendanceMode" className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">
                        Attendance Mode
                      </Label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Assign the attendance tracking mode for this staff member (global setting is <strong>Both</strong>).
                      </p>
                      <Select
                        value={formData.attendanceMode}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, attendanceMode: val }))}
                      >
                        <SelectTrigger id="attendanceMode" className="rounded-xl border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">Daily — Single Check-In / Check-Out</SelectItem>
                          <SelectItem value="SESSION">Session-Based — Morning &amp; Afternoon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsFormVisible(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md px-6 py-2 transition-all flex items-center justify-center min-w-[120px]"
                    >
                      {isSaving ? (
                        <Spinner size="sm" className="text-white" />
                      ) : editingTeacher ? (
                        "Update Record"
                      ) : (
                        "Register Teacher"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Detail modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-950/95 border border-slate-200/50 dark:border-slate-900/50 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Header Banner */}
            <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-8 text-white">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedTeacher(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
                {selectedTeacher.profile_photo ? (
                  <img
                    src={selectedTeacher.profile_photo}
                    alt={selectedTeacher.full_name}
                    className="w-24 h-24 rounded-full object-cover shadow-lg ring-4 ring-white/30 ring-offset-2 ring-offset-blue-600"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white text-slate-800 flex items-center justify-center text-2xl font-black shadow-lg">
                    {getInitials(selectedTeacher.full_name)}
                  </div>
                )}
                <div className="text-center sm:text-left space-y-1">
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight">{selectedTeacher.full_name}</h2>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-white/20 text-white border border-white/20 rounded-full">
                      Faculty Member
                    </span>
                  </div>
                  <p className="text-xs text-white/80 flex items-center justify-center sm:justify-start gap-1">
                    <Mail className="w-4 h-4" />
                    {selectedTeacher.email}
                  </p>
                  {selectedTeacher.subject && (
                    <div className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-white bg-white/20 px-3 py-1 rounded-full border border-white/10">
                      <BookOpen className="w-3.5 h-3.5" />
                      {selectedTeacher.subject} Teacher
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-white dark:bg-slate-950">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-900 flex flex-col items-center justify-center text-center">
                  <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Experience</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedTeacher.experience_years ? `${selectedTeacher.experience_years} Years` : "N/A"}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-900 flex flex-col items-center justify-center text-center">
                  <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-1" />
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Qualification</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate max-w-full" title={selectedTeacher.qualification || "N/A"}>
                    {selectedTeacher.qualification || "N/A"}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-900 flex flex-col items-center justify-center text-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Status</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedTeacher.is_active !== false ? "Active Account" : "Suspended"}
                  </span>
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Contact Details</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-900 border border-slate-100 dark:border-slate-900 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/20">
                  <div className="flex justify-between items-center p-4">
                    <span className="text-xs text-slate-500 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      Email Address
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedTeacher.email}</span>
                  </div>
                  <div className="flex justify-between items-center p-4">
                    <span className="text-xs text-slate-500 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      Phone Number
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedTeacher.phone || "No phone added"}</span>
                  </div>
                </div>
              </div>

              {/* Assignments Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Class Assignments</h3>
                
                {isLoadingAssignments ? (
                  <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Spinner size="sm" className="text-primary mx-auto mb-2" />
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200/50 dark:border-slate-800/50 rounded-2xl text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No classes assigned yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Use the Class Assignments panel to allocate grades and subjects.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assignments.map((assignment) => {
                      const gradeRaw = typeof assignment.grade === 'object' && assignment.grade !== null ? (assignment.grade as any).name : (assignment.grade || '')
                      const cleanGrade = String(gradeRaw).replace(/^Grade\s+/i, '').trim()
                      const sectionStr = typeof assignment.section === 'object' && assignment.section !== null ? (assignment.section as any).name : (assignment.section || '')
                      const streamStr = typeof assignment.stream === 'object' && assignment.stream !== null ? (assignment.stream as any).name : (assignment.stream || '')
                      const subjectStr = typeof assignment.subject === 'object' && assignment.subject !== null ? (assignment.subject as any).name : (assignment.subject || '')

                      return (
                        <div 
                          key={assignment.id} 
                          className="flex items-center gap-3 p-3 bg-blue-50/20 dark:bg-slate-900/50 rounded-xl border border-blue-100/50 dark:border-slate-800/80 hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Grade {cleanGrade}{sectionStr ? ` - Section ${sectionStr}` : ''}
                            </p>
                            {streamStr && streamStr !== "General" && (
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                {streamStr}
                              </p>
                            )}
                            {subjectStr && (
                              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                                {subjectStr}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-900/50 p-4 flex justify-end gap-2">
              <Button 
                onClick={() => {
                  const teacherToEdit = selectedTeacher
                  setSelectedTeacher(null)
                  handleEdit(teacherToEdit)
                }}
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button 
                onClick={() => setSelectedTeacher(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-1 transition-all"
              >
                Close Profile
              </Button>
            </div>

          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
