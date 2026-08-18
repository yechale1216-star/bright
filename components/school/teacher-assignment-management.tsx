"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2, Plus, GraduationCap, Users, CheckCircle2, RefreshCw, Pencil } from "lucide-react"

import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { PageSkeleton } from "@/components/ui/page-skeleton"

interface Teacher {
  id: string
  full_name: string
  email: string
}

interface Class {
  id: string
  name: string
  grade: string
  section: string
  students: any[]
}

interface TeacherAssignment {
  id: string
  teacher_id: string
  class_id: string
  subject?: string
  grade?: { id: string; name: string }
  section?: { id: string; name: string }
  stream?: { id: string; name: string }
  gradeId?: string
  sectionId?: string
  streamId?: string
  teacher?: {
    id: string
    full_name: string
    email: string
    profile_photo?: string
  }
}

export function TeacherAssignmentManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSection, setSelectedSection] = useState("")
  const [selectedStream, setSelectedStream] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [schoolId, setSchoolId] = useState<string>("")
  const [isEditing, setIsEditing] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [availableGrades, setAvailableGrades] = useState<any[]>([])
  const [availableSections, setAvailableSections] = useState<any[]>([])
  const [availableStreams, setAvailableStreams] = useState<any[]>([])

  const getInitials = (name: string) => {
    if (!name) return "T"
    const parts = name.trim().split(/\s+/)
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2)
  }

  const getAvatarGradient = (id: string) => {
    if (!id) return "from-blue-500 to-indigo-600"
    const gradients = [
      "from-blue-500 to-indigo-600",
      "from-emerald-400 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-pink-500 to-rose-600",
      "from-amber-400 to-orange-600",
      "from-cyan-400 to-blue-600",
    ]
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return gradients[Math.abs(hash) % gradients.length]
  }

  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        const user = authService.getCurrentUser()
        if (!user?.schoolId) throw new Error("School ID not found - please login again")
        setSchoolId(user.schoolId)
        await loadAllData(user.schoolId)
      } catch (error) {
        console.error("Error initializing teacher assignment:", error)
        setIsLoading(false)
      }
    }
    initializeAndLoad()

    const handleTeacherChanged = () => {
      const storedSchoolId = localStorage.getItem("x-school-id") || ""
      loadAllData(storedSchoolId, true, true)
    }

    window.addEventListener("teacherDataChanged", handleTeacherChanged)

    // Background polling every 60 seconds for multi-user/multi-device sync
    let pollSchoolId = ""
    const getSchoolIdForPoll = () => localStorage.getItem("x-school-id") || ""
    const pollInterval = setInterval(() => {
      const sid = getSchoolIdForPoll()
      if (sid) loadAllData(sid, true, false)
    }, 60_000)

    return () => {
      window.removeEventListener("teacherDataChanged", handleTeacherChanged)
      clearInterval(pollInterval)
    }
  }, [])

  const loadAllData = async (school: string, isBackground = false, forceRefetch = false) => {
    try {
      if (!isBackground && assignments.length === 0) setIsLoading(true)
      const [teachersData, assignmentsData, gradesData, sectionsData, streamsData] = await Promise.all([
        db.getTeachers(forceRefetch),
        db.getTeacherAssignments(),
        db.getGrades(),
        db.getSections(),
        db.getStreams()
      ])
      
      setTeachers(teachersData)
      setAssignments(assignmentsData as any)
      setAvailableGrades(gradesData)
      setAvailableSections(sectionsData)
      setAvailableStreams(streamsData)
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
    setIsEditing(false)
    setEditingAssignmentId(null)
    setShowSuccess(false)
  }

  const handleAssignTeacher = async () => {
    const isHighGrade = selectedGrade === "11" || selectedGrade === "12"

    if (!selectedTeacher || !selectedGrade || !selectedSection) {
      notifications.error("Error", "Please select teacher, grade, and section")
      return
    }
    if (isHighGrade && !selectedStream) {
      notifications.error("Error", "Stream is required for Grade 11 and 12")
      return
    }

    // HOMEROOM RULE: Check if the target class already has a homeroom teacher assigned.
    // One class/section = max one homeroom teacher.
    // The same teacher IS allowed to manage multiple different classes.
    const classAlreadyHasTeacher = assignments.some(
      (assign) =>
        assign.id !== editingAssignmentId &&
        (assign.gradeId === selectedGrade || assign.grade?.id === selectedGrade) &&
        (assign.sectionId === selectedSection || assign.section?.id === selectedSection) &&
        ((assign.streamId || assign.stream?.id || "") === (selectedStream || ""))
    )

    if (classAlreadyHasTeacher) {
      const existingAssign = assignments.find(
        (assign) =>
          assign.id !== editingAssignmentId &&
          (assign.gradeId === selectedGrade || assign.grade?.id === selectedGrade) &&
          (assign.sectionId === selectedSection || assign.section?.id === selectedSection) &&
          ((assign.streamId || assign.stream?.id || "") === (selectedStream || ""))
      )
      const existingTeacherName = existingAssign?.teacher?.full_name || "another teacher"
      notifications.error(
        "Class Already Has a Homeroom Teacher",
        `This class is already assigned to ${existingTeacherName}. Edit or remove the existing assignment first.`
      )
      return
    }

    try {
      setIsAssigning(true)
      const data = {
        teacher_id: selectedTeacher,
        gradeId: selectedGrade,
        sectionId: selectedSection,
        streamId: selectedStream || undefined
      }

      if (isEditing && editingAssignmentId) {
        // Optimistic update for edit
        setAssignments(prev => prev.map(a => a.id === editingAssignmentId
          ? { ...a, teacher_id: selectedTeacher, gradeId: selectedGrade, sectionId: selectedSection, streamId: selectedStream || undefined }
          : a
        ))
        await db.updateTeacherAssignment(editingAssignmentId, data)
      } else {
        const classId = `class-${selectedGrade}-${selectedSection}-${selectedStream || "none"}`
        const created = await db.assignTeacherToClass(selectedTeacher, classId, undefined, selectedGrade, selectedSection, selectedStream || undefined)
        // Optimistic update: add new assignment to local state
        if (created) setAssignments(prev => [created as any, ...prev])
      }

      setShowSuccess(true)
      // Background refresh to sync real data (no skeleton)
      loadAllData(schoolId, true, true)
      setTimeout(() => {
        setShowSuccess(false)
        setIsDialogOpen(false)
        resetForm()
      }, 2500)
    } catch (error: any) {
      notifications.error("Error", error.message)
      // Revert on failure
      loadAllData(schoolId, true, true)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleEditAssignment = (assignment: TeacherAssignment) => {
    setEditingAssignmentId(assignment.id)
    setSelectedTeacher(assignment.teacher_id)
    setSelectedGrade(assignment.gradeId || assignment.grade?.id || "")
    setSelectedSection(assignment.sectionId || assignment.section?.id || "")
    setSelectedStream(assignment.streamId || assignment.stream?.id || "")
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleRemoveAssignment = async (e: React.MouseEvent | null, assignmentId: string) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    console.log("Delete clicked for assignment:", assignmentId)
    
    const isConfirmed = window.confirm("Are you sure you want to remove this teacher assignment?")
    if (!isConfirmed) {
      return
    }
    
    try {
      setDeletingId(assignmentId)
      // Optimistic update: remove from local state immediately
      setAssignments(prev => prev.filter(a => a.id !== assignmentId))
      await db.removeTeacherAssignment(assignmentId)
      notifications.success("Assignment Removed", "Teacher assignment has been removed.")
      // Background sync (no skeleton)
      loadAllData(schoolId, true, true)
    } catch (error: any) {
      console.error("Deletion failed:", error)
      notifications.error("Delete Failed", error.message || "Failed to remove assignment")
      // Revert optimistic update on failure
      loadAllData(schoolId, true, true)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <PageSkeleton variant="cards" />
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-safe">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-normal">
            Assignments
          </h1>
          <p className="text-[10px] font-bold text-slate-500/60 dark:text-slate-400/60 uppercase tracking-widest mt-1">
            Teacher Class Allocation
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button
            onClick={() => loadAllData(schoolId)}
            variant="outline"
            className="flex-1 md:flex-none h-11 rounded-2xl border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync
          </Button>
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true) }}
            className="hidden md:flex h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>
      </div>

      {/* Mobile Floating Add Button */}
      <Button
        onClick={() => { resetForm(); setIsDialogOpen(true) }}
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-2xl bg-primary text-white shadow-2xl shadow-primary/40 z-40 flex items-center justify-center active:scale-95 transition-all outline-none"
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
              <h2 className="typography-page-title text-emerald-700 dark:text-emerald-400">Assignment Successful!</h2>
              <p className="typography-body text-slate-500 dark:text-slate-400 mt-1">The teacher has been assigned to the class.</p>
            </div>
          ) : (
            <>
              <DialogHeader className="bg-gradient-to-r from-blue-50/60 to-indigo-50/20 dark:from-slate-800/60 dark:to-slate-900/20 border-b border-slate-100 dark:border-slate-800/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <DialogTitle className="typography-section-title">
                      {isEditing ? "Edit Class Assignment" : "New Class Assignment"}
                    </DialogTitle>
                    <p className="typography-helper text-slate-500 dark:text-slate-400 mt-0.5">
                      {isEditing ? "Modify assignment details for this teacher." : "Select a teacher and assign them to a grade section."}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-6 space-y-5">
                {/* Teacher */}
                <div className="space-y-2">
                  <label className="typography-label text-slate-700 dark:text-slate-300 uppercase">
                    Select Teacher <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="typography-body w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">-- Choose a Teacher --</option>
                    {teachers.length > 0 ? (
                      teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)
                    ) : (
                      <option disabled>No teachers available</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Grade */}
                  <div className="space-y-2">
                    <label className="typography-label text-slate-700 dark:text-slate-300 uppercase">
                      Grade <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => { setSelectedGrade(e.target.value); setSelectedStream("") }}
                      className="typography-body w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    >
                      <option value="">-- Grade --</option>
                      {availableGrades.map((g) => <option key={g.id} value={g.id}>Grade {g.name}</option>)}
                    </select>
                  </div>

                  {/* Section */}
                  <div className="space-y-2">
                    <label className="typography-label text-slate-700 dark:text-slate-300 uppercase">
                      Section <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="typography-body w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    >
                      <option value="">-- Section --</option>
                      {availableSections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Stream */}
                <div className="space-y-2">
                  <label className="typography-label text-slate-700 dark:text-slate-300 uppercase">
                    Stream {/* High grade check logic would need the actual grade name/type here */}
                  </label>
                  <select
                    value={selectedStream}
                    onChange={(e) => setSelectedStream(e.target.value)}
                    disabled={!selectedGrade}
                    className="typography-body w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                  >
                    <option value="">
                      -- Choose Stream (Optional) --
                    </option>
                    {availableStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Preview */}
                {selectedGrade && selectedSection && (
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <p className="typography-label text-blue-700 dark:text-blue-400">
                      Assigning to selected Class entities.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/50">
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignTeacher}
                    disabled={
                      isAssigning ||
                      !selectedTeacher ||
                      !selectedGrade ||
                      !selectedSection
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md px-6 min-w-[140px] flex items-center justify-center"
                  >
                    {isAssigning ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><Plus className="w-4 h-4 mr-2" />{isEditing ? "Update Assignment" : "Assign Teacher"}</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assignments Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Active Assignments ({assignments.length})
          </h2>
        </div>

        {assignments.length === 0 ? (
          <div className="py-24 text-center bg-slate-50 dark:bg-slate-900/30 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 mx-1">
            <div className="w-20 h-20 bg-background rounded-[28px] shadow-sm flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No assignments found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1 md:px-0">
            {assignments.map((assignment) => {
              const teacherName = assignment.teacher?.full_name || "Unknown Teacher"
              const bgGradient = getAvatarGradient(assignment.teacher?.id || assignment.teacher_id)
              return (
                <div
                  key={assignment.id}
                  className="group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all hover:shadow-md h-[180px] flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      {assignment.teacher?.profile_photo ? (
                        <img
                          src={assignment.teacher.profile_photo}
                          alt={teacherName}
                          className="w-14 h-14 rounded-[20px] object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-[20px] bg-gradient-to-br ${bgGradient} flex items-center justify-center text-white text-lg font-black shadow-inner`}>
                          {getInitials(teacherName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none truncate uppercase tracking-normal">
                          {teacherName}
                        </h3>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1.5 flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Grade {String(typeof assignment.grade === 'object' ? assignment.grade?.name : (assignment.grade || '')).replace(/^Grade\s+/i, '').trim()} {typeof assignment.section === 'object' ? assignment.section?.name : (assignment.section || '')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleEditAssignment(assignment); }}
                         className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                         title="Edit Assignment"
                       >
                         <Pencil className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(null, assignment.id); }}
                         className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-rose-400 hover:text-rose-600 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Stream</span>
                        <span className="text-xs font-bold text-foreground">
                          {assignment.stream?.name || (typeof assignment.stream === 'string' && assignment.stream ? assignment.stream : "General")}
                        </span>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                       <span className="text-[9px] font-black text-foreground uppercase tracking-widest">Active</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
