"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Trash2, Plus, GraduationCap, Users, CheckCircle2, RefreshCw, Pencil,
  Search, ChevronDown, Check, X, BookOpen, Home
} from "lucide-react"

import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { cn } from "@/lib/utils/utils"

type AssignmentRole = "SUBJECT_TEACHER" | "HOMEROOM_TEACHER"

interface Teacher {
  id: string
  full_name: string
  email: string
}

interface TeacherAssignment {
  id: string
  teacher_id: string
  class_id?: string
  subject?: string
  role?: AssignmentRole
  subjectId?: string
  gradeId?: string
  sectionId?: string
  streamId?: string
  academicYearId?: string
  grade?: { id: string; name: string }
  section?: { id: string; name: string }
  stream?: { id: string; name: string }
  subjectRef?: { id: string; name: string }
  academicYear?: { id: string; name: string }
  teacher?: {
    id: string
    name: string
    full_name?: string
    email: string
    profile_photo?: string
  }
}

export function TeacherAssignmentManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [availableGrades, setAvailableGrades] = useState<any[]>([])
  const [availableSections, setAvailableSections] = useState<any[]>([])
  const [availableStreams, setAvailableStreams] = useState<any[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([])

  // Form state
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSection, setSelectedSection] = useState("")
  const [selectedStream, setSelectedStream] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedRole, setSelectedRole] = useState<AssignmentRole>("SUBJECT_TEACHER")

  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [schoolId, setSchoolId] = useState<string>("")
  const [isEditing, setIsEditing] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [teacherSearchQuery, setTeacherSearchQuery] = useState("")
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false)
  const [assignmentSearch, setAssignmentSearch] = useState("")
  const [filterRole, setFilterRole] = useState<"ALL" | AssignmentRole>("ALL")

  const teacherDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teacherDropdownRef.current && !teacherDropdownRef.current.contains(e.target as Node)) {
        setIsTeacherDropdownOpen(false)
      }
    }
    if (isTeacherDropdownOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isTeacherDropdownOpen])

  const currentTeacher = useMemo(() => teachers.find((t) => t.id === selectedTeacher), [teachers, selectedTeacher])

  const filteredTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return teachers
    const q = teacherSearchQuery.toLowerCase()
    return teachers.filter((t) => {
      const name = (t.full_name || (t as any).name || "").toLowerCase()
      const email = (t.email || "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [teachers, teacherSearchQuery])

  const filteredAssignments = useMemo(() => {
    let result = assignments
    if (filterRole !== "ALL") result = result.filter((a) => a.role === filterRole)
    if (!assignmentSearch.trim()) return result
    const q = assignmentSearch.toLowerCase()
    return result.filter((a) => {
      const tName = ((a.teacher?.full_name || a.teacher?.name) ?? "").toLowerCase()
      const grade = (a.grade?.name ?? "").toLowerCase()
      const section = (a.section?.name ?? "").toLowerCase()
      const subject = (a.subjectRef?.name ?? a.subject ?? "").toLowerCase()
      return tName.includes(q) || grade.includes(q) || section.includes(q) || subject.includes(q)
    })
  }, [assignments, assignmentSearch, filterRole])

  const getInitials = (name: string) => {
    if (!name) return "T"
    return name.trim().split(/\s+/).map((p) => p[0]).join("").toUpperCase().slice(0, 2)
  }

  const getAvatarGradient = (id: string) => {
    const gradients = [
      "from-blue-500 to-indigo-600", "from-emerald-400 to-teal-600",
      "from-violet-500 to-purple-600", "from-pink-500 to-rose-600",
      "from-amber-400 to-orange-600", "from-cyan-400 to-blue-600",
    ]
    if (!id) return gradients[0]
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
    return gradients[Math.abs(hash) % gradients.length]
  }

  useEffect(() => {
    const init = async () => {
      const user = authService.getCurrentUser()
      const sid = user?.schoolId || "single-school"
      setSchoolId(sid)
      await loadAllData(sid)
    }
    init()

    const handleTeacherChanged = () => {
      const sid = localStorage.getItem("x-school-id") || ""
      loadAllData(sid, true, true)
    }
    window.addEventListener("teacherDataChanged", handleTeacherChanged)
    const poll = setInterval(() => {
      const sid = localStorage.getItem("x-school-id") || ""
      if (sid) loadAllData(sid, true, false)
    }, 60_000)
    return () => {
      window.removeEventListener("teacherDataChanged", handleTeacherChanged)
      clearInterval(poll)
    }
  }, [])

  const loadAllData = async (school: string, isBackground = false, forceRefetch = false) => {
    try {
      if (!isBackground && assignments.length === 0) setIsLoading(true)
      const [teachersData, assignmentsData, gradesData, sectionsData, streamsData, subjectsData] = await Promise.all([
        db.getTeachers(forceRefetch),
        db.getTeacherAssignments(),
        db.getGrades(),
        db.getSections(),
        db.getStreams(),
        db.getSubjects(),
      ])
      setTeachers(teachersData)
      setAssignments(assignmentsData as any)
      setAvailableGrades(gradesData)
      setAvailableSections(sectionsData)
      setAvailableStreams(streamsData)
      setAvailableSubjects(subjectsData)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedTeacher("")
    setSelectedGrade("")
    setSelectedSection("")
    setSelectedStream("")
    setSelectedSubject("")
    setSelectedRole("SUBJECT_TEACHER")
    setTeacherSearchQuery("")
    setIsTeacherDropdownOpen(false)
    setIsEditing(false)
    setEditingAssignmentId(null)
    setShowSuccess(false)
  }

  const handleAssignTeacher = async () => {
    if (!selectedTeacher || !selectedGrade || !selectedSection) {
      notifications.error("Error", "Please select teacher, grade, and section")
      return
    }
    if (selectedRole === "SUBJECT_TEACHER" && !selectedSubject) {
      notifications.error("Error", "A subject is required for Subject Teacher role")
      return
    }
    try {
      setIsAssigning(true)
      const data = {
        teacher_id: selectedTeacher,
        gradeId: selectedGrade,
        sectionId: selectedSection,
        streamId: selectedStream || undefined,
        subjectId: selectedSubject || undefined,
        role: selectedRole,
      }
      if (isEditing && editingAssignmentId) {
        await db.updateTeacherAssignment(editingAssignmentId, data)
      } else {
        await db.assignTeacherToClass(
          selectedTeacher, "", undefined,
          selectedGrade, selectedSection, selectedStream || undefined,
          selectedRole, selectedSubject || undefined
        )
      }
      setShowSuccess(true)
      loadAllData(schoolId, true, true)
      setTimeout(() => {
        setShowSuccess(false)
        setIsDialogOpen(false)
        resetForm()
      }, 2000)
    } catch (error: any) {
      notifications.error("Error", error.message)
      loadAllData(schoolId, true, true)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleEditAssignment = (a: TeacherAssignment) => {
    setEditingAssignmentId(a.id)
    setSelectedTeacher(a.teacher_id)
    setSelectedGrade(a.gradeId || a.grade?.id || "")
    setSelectedSection(a.sectionId || a.section?.id || "")
    setSelectedStream(a.streamId || a.stream?.id || "")
    setSelectedSubject(a.subjectId || a.subjectRef?.id || "")
    setSelectedRole((a.role as AssignmentRole) || "SUBJECT_TEACHER")
    setTeacherSearchQuery("")
    setIsTeacherDropdownOpen(false)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!window.confirm("Are you sure you want to remove this assignment?")) return
    try {
      setDeletingId(assignmentId)
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      await db.removeTeacherAssignment(assignmentId)
      notifications.success("Removed", "Teacher assignment removed.")
      loadAllData(schoolId, true, true)
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to remove assignment")
      loadAllData(schoolId, true, true)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <PageSkeleton variant="cards" />

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-safe">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-normal">
            Assignments
          </h1>
          <p className="text-[10px] font-bold text-slate-500/60 dark:text-slate-400/60 uppercase tracking-widest mt-1">
            Teacher Class & Subject Allocation
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button
            onClick={() => loadAllData(schoolId)}
            variant="outline"
            className="flex-1 md:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
          >
            <RefreshCw className="w-4 h-4 mr-2" />Sync
          </Button>
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true) }}
            className="hidden md:flex h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />New Assignment
          </Button>
        </div>
      </div>

      {/* Mobile FAB */}
      <Button
        onClick={() => { resetForm(); setIsDialogOpen(true) }}
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-2xl bg-primary text-white shadow-2xl shadow-primary/40 z-40 flex items-center justify-center active:scale-95 transition-all"
      >
        <Plus className="w-7 h-7" />
      </Button>

      {/* Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); setShowSuccess(false) } }}>
        <DialogContent className="sm:max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-0 overflow-hidden">
          {showSuccess ? (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
              <DialogTitle className="sr-only">Assignment Successful</DialogTitle>
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce mb-5">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-lg font-black text-emerald-700 dark:text-emerald-400">Assignment Successful!</h2>
              <p className="text-sm text-slate-500 mt-1">Teacher has been assigned.</p>
            </div>
          ) : (
            <>
              <DialogHeader className="bg-gradient-to-r from-blue-50/60 to-indigo-50/20 dark:from-slate-800/60 dark:to-slate-900/20 border-b border-slate-100 dark:border-slate-800/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-black text-slate-900 dark:text-white">
                      {isEditing ? "Edit Assignment" : "New Assignment"}
                    </DialogTitle>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isEditing ? "Modify assignment details" : "Assign a teacher to a class/subject"}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Role Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Assignment Role <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["SUBJECT_TEACHER", "HOMEROOM_TEACHER"] as AssignmentRole[]).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all",
                          selectedRole === role
                            ? role === "HOMEROOM_TEACHER"
                              ? "bg-violet-50 dark:bg-violet-950/30 border-violet-400 text-violet-700 dark:text-violet-300"
                              : "bg-blue-50 dark:bg-blue-950/30 border-blue-400 text-blue-700 dark:text-blue-300"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 bg-white/50 dark:bg-slate-900/50"
                        )}
                      >
                        {role === "HOMEROOM_TEACHER" ? <Home className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {role === "HOMEROOM_TEACHER" ? "Homeroom Teacher" : "Subject Teacher"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Teacher Selector */}
                <div className="space-y-2 relative" ref={teacherDropdownRef}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Teacher <span className="text-red-500">*</span>
                    </label>
                    {currentTeacher && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[200px]">
                        {currentTeacher.email}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTeacherDropdownOpen((p) => !p)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all bg-white/70 dark:bg-slate-900/70 text-xs",
                      isTeacherDropdownOpen
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                      !currentTeacher && "text-slate-400 dark:text-slate-500"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {currentTeacher ? (
                        <>
                          <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-[11px] font-black shrink-0", getAvatarGradient(currentTeacher.id))}>
                            {getInitials(currentTeacher.full_name)}
                          </div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{currentTeacher.full_name}</p>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>-- Choose a Teacher --</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {currentTeacher && (
                        <span role="button" onClick={(e) => { e.stopPropagation(); setSelectedTeacher("") }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isTeacherDropdownOpen && "rotate-180")} />
                    </div>
                  </button>
                  {isTeacherDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="text" value={teacherSearchQuery} onChange={(e) => setTeacherSearchQuery(e.target.value)}
                            placeholder="Search teachers..." autoFocus
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                          {teacherSearchQuery && (
                            <button type="button" onClick={() => setTeacherSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                        {filteredTeachers.length > 0 ? filteredTeachers.map((t) => {
                          const isSelected = selectedTeacher === t.id
                          return (
                            <button key={t.id} type="button"
                              onClick={() => { setSelectedTeacher(t.id); setIsTeacherDropdownOpen(false); setTeacherSearchQuery("") }}
                              className={cn("w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 text-xs transition-colors",
                                isSelected ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold" : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium"
                              )}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-[11px] font-black shrink-0", getAvatarGradient(t.id))}>
                                  {getInitials(t.full_name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">{t.full_name}</p>
                                  {t.email && <p className="text-[10px] text-muted-foreground truncate">{t.email}</p>}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                            </button>
                          )
                        }) : (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            {teachers.length === 0 ? "No teachers available" : `No match for "${teacherSearchQuery}"`}
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-[10px] text-muted-foreground font-medium">
                        {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? "s" : ""} found
                      </div>
                    </div>
                  )}
                </div>

                {/* Grade & Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Grade <span className="text-red-500">*</span>
                    </label>
                    <select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedStream("") }}
                      className="text-xs w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                      <option value="">-- Grade --</option>
                      {availableGrades.map((g) => <option key={g.id} value={g.id}>Grade {g.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Section <span className="text-red-500">*</span>
                    </label>
                    <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}
                      className="text-xs w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                      <option value="">-- Section --</option>
                      {availableSections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Subject (required for Subject Teacher) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Subject {selectedRole === "SUBJECT_TEACHER" && <span className="text-red-500">*</span>}
                    {selectedRole === "HOMEROOM_TEACHER" && <span className="text-slate-400 font-medium normal-case"> (optional – if they also teach a subject)</span>}
                  </label>
                  <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                    className="text-xs w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                    <option value="">-- Choose Subject --</option>
                    {availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Stream */}
                {availableStreams.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Stream</label>
                    <select value={selectedStream} onChange={(e) => setSelectedStream(e.target.value)} disabled={!selectedGrade}
                      className="text-xs w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50">
                      <option value="">-- Stream (Optional) --</option>
                      {availableStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Preview */}
                {selectedGrade && selectedSection && (
                  <div className={cn("p-3 rounded-xl border text-xs font-medium",
                    selectedRole === "HOMEROOM_TEACHER"
                      ? "bg-violet-50/60 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40 text-violet-700 dark:text-violet-300"
                      : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-300"
                  )}>
                    <span className="font-black">
                      {selectedRole === "HOMEROOM_TEACHER" ? "🏠 Homeroom" : "📚 Subject"}:
                    </span>{" "}
                    Grade {availableGrades.find((g) => g.id === selectedGrade)?.name} — Section {availableSections.find((s) => s.id === selectedSection)?.name}
                    {selectedSubject && ` — ${availableSubjects.find((s) => s.id === selectedSubject)?.name}`}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/50">
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button
                    onClick={handleAssignTeacher}
                    disabled={isAssigning || !selectedTeacher || !selectedGrade || !selectedSection || (selectedRole === "SUBJECT_TEACHER" && !selectedSubject)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md px-6 min-w-[140px] flex items-center justify-center"
                  >
                    {isAssigning ? <Spinner size="sm" className="text-white" /> : (
                      <><Plus className="w-4 h-4 mr-2" />{isEditing ? "Update" : "Assign"}</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Assignments ({filteredAssignments.length}{assignmentSearch || filterRole !== "ALL" ? ` of ${assignments.length}` : ""})
          </h2>
          {/* Role Filter Pills */}
          <div className="flex gap-1 ml-2">
            {(["ALL", "SUBJECT_TEACHER", "HOMEROOM_TEACHER"] as const).map((r) => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={cn("text-[9px] font-black uppercase px-2.5 py-1 rounded-full border transition-all",
                  filterRole === r
                    ? r === "HOMEROOM_TEACHER"
                      ? "bg-violet-600 text-white border-violet-600"
                      : r === "SUBJECT_TEACHER"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-700 text-white border-slate-700"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                )}>
                {r === "ALL" ? "All" : r === "SUBJECT_TEACHER" ? "Subject" : "Homeroom"}
              </button>
            ))}
          </div>
        </div>
        {assignments.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={assignmentSearch} onChange={(e) => setAssignmentSearch(e.target.value)}
              placeholder="Search assignments..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            {assignmentSearch && (
              <button onClick={() => setAssignmentSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cards Grid */}
      {assignments.length === 0 ? (
        <div className="py-24 text-center bg-slate-50 dark:bg-slate-900/30 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 mx-1">
          <div className="w-20 h-20 bg-background rounded-[28px] shadow-sm flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-slate-200" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No assignments yet</p>
          <p className="text-xs text-slate-400 mt-1">Use the New Assignment button to get started</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 dark:bg-slate-900/30 rounded-[28px] border border-dashed border-slate-200 dark:border-slate-800 mx-1">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No matches found</p>
          <Button variant="outline" size="sm" onClick={() => { setAssignmentSearch(""); setFilterRole("ALL") }} className="mt-3 rounded-xl text-xs">
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 px-1 md:px-0">
          {filteredAssignments.map((assignment) => {
            const teacherName = assignment.teacher?.full_name || assignment.teacher?.name || "Unknown Teacher"
            const bgGradient = getAvatarGradient(assignment.teacher?.id || assignment.teacher_id)
            const gradeName = (assignment.grade?.name ?? "").replace(/^Grade\s+/i, "").trim()
            const sectionName = assignment.section?.name ?? ""
            const subjectName = assignment.subjectRef?.name ?? assignment.subject ?? ""
            const isHomeroom = assignment.role === "HOMEROOM_TEACHER"
            const isDeleting = deletingId === assignment.id

            return (
              <div key={assignment.id}
                className={cn("group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-[28px] border shadow-sm hover:shadow-md transition-all min-h-[190px] flex flex-col justify-between",
                  isHomeroom
                    ? "border-violet-100 dark:border-violet-900/30"
                    : "border-slate-100 dark:border-slate-800"
                )}>
                {/* Role badge */}
                <div className="absolute top-4 right-4">
                  <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                    isHomeroom
                      ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-900"
                      : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                  )}>
                    {isHomeroom ? "Homeroom" : "Subject"}
                  </span>
                </div>

                {/* Avatar & Name */}
                <div className="flex items-center gap-3.5 min-w-0 pr-16">
                  {assignment.teacher?.profile_photo ? (
                    <img src={assignment.teacher.profile_photo} alt={teacherName}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0" />
                  ) : (
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white text-base font-black shadow-inner flex-shrink-0`}>
                      {getInitials(teacherName)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 title={teacherName} className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug break-words uppercase tracking-tight line-clamp-2">
                      {teacherName}
                    </h3>
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">Gr.{gradeName}{sectionName ? ` — Sec.${sectionName}` : ""}</span>
                    </p>
                    {subjectName && (
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <BookOpen className="w-3 h-3 shrink-0" />
                        {subjectName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stream</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                      {assignment.stream?.name || "General"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleEditAssignment(assignment) }}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                        title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(assignment.id) }}
                        disabled={isDeleting}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50"
                        title="Delete">
                        {isDeleting ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
