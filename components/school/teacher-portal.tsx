"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { 
  BookOpen, Users, FileText, CheckCircle2, Plus, ArrowLeft, Calendar, 
  Clock, Award, FolderOpen, Send, Download, ExternalLink, Search, 
  Filter, Sparkles, AlertCircle, RefreshCw, ChevronRight, Edit3, 
  Trash2, Check, X, Shield, Star, GraduationCap, Eye, UserCheck, 
  AlertTriangle, Home, BookMarked, Layers, BarChart3, HelpCircle, Upload
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { authService } from "@/lib/auth/auth"
import { homeworkClientService, type Homework, type HomeworkSubmission } from "@/lib/homework-service"
import { learningMaterialClientService, type LearningMaterial } from "@/lib/homework-service"
import { gradebookService, type Assessment, type StudentMarksRow } from "@/lib/gradebook-service"
import { TeacherSharedMaterials } from "@/components/school/teacher-shared-materials"
import { cn } from "@/lib/utils/utils"

// -”€-”€-”€ Interfaces -”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€-”€

interface PortalAssignment {
  id: string
  teacher_id: string
  role?: "SUBJECT_TEACHER" | "HOMEROOM_TEACHER"
  gradeId?: string
  sectionId?: string
  streamId?: string
  subjectId?: string
  subject?: string
  academicYearId?: string
  grade?: { id: string; name: string }
  section?: { id: string; name: string }
  stream?: { id: string; name: string }
  subjectRef?: { id: string; name: string; code?: string }
  academicYear?: { id: string; name: string }
  teacher?: { id: string; name: string; email?: string }
}

interface ClassStudent {
  id: string
  fullName: string
  student_id: string
  gender?: string | null
  parent_phone?: string | null
  parent_name?: string | null
}

interface ClassDetails {
  students: ClassStudent[]
  homework: (Homework & { submissions?: HomeworkSubmission[] })[]
  materials: LearningMaterial[]
  assessments: Assessment[]
}

export function TeacherPortal() {
  // -”€-”€ State -”€-”€
  const [isLoading, setIsLoading] = useState(true)
  const [assignments, setAssignments] = useState<PortalAssignment[]>([])
  const [currentYear, setCurrentYear] = useState<{ id: string; name: string } | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Selection
  const [selectedAssignment, setSelectedAssignment] = useState<PortalAssignment | null>(null)
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("overview")

  // Search & Filters on Directory
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<"ALL" | "SUBJECT_TEACHER" | "HOMEROOM_TEACHER">("ALL")

  // -”€-”€ Dialog States -”€-”€
  // 1. Create Homework Modal
  const [isHomeworkOpen, setIsHomeworkOpen] = useState(false)
  const [isSubmittingHw, setIsSubmittingHw] = useState(false)
  const [hwTitle, setHwTitle] = useState("")
  const [hwDescription, setHwDescription] = useState("")
  const [hwDueDate, setHwDueDate] = useState("")
  const [hwMaxScore, setHwMaxScore] = useState("100")
  const [hwStatus, setHwStatus] = useState("PUBLISHED")

  // 2. View/Grade Submissions Modal
  const [selectedHomeworkForSubmissions, setSelectedHomeworkForSubmissions] = useState<Homework | null>(null)
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false)
  const [submissionsList, setSubmissionsList] = useState<HomeworkSubmission[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null)
  const [gradeScoreInput, setGradeScoreInput] = useState<Record<string, string>>({})
  const [gradeFeedbackInput, setGradeFeedbackInput] = useState<Record<string, string>>({})
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null)

  // 3. Share Material Modal
  const [isMaterialOpen, setIsMaterialOpen] = useState(false)
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false)
  const [matTitle, setMatTitle] = useState("")
  const [matDescription, setMatDescription] = useState("")
  const [matFileUrl, setMatFileUrl] = useState("")
  const [matFileType, setMatFileType] = useState("PDF")
  const [materialSource, setMaterialSource] = useState<"file" | "link">("file")
  const [matFileName, setMatFileName] = useState("")
  const [matFileSize, setMatFileSize] = useState<number | null>(null)
  const [isReadingFile, setIsReadingFile] = useState(false)

  // 4. Create Assessment Modal
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false)
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false)
  const [asTitle, setAsTitle] = useState("")
  const [asType, setAsType] = useState("QUIZ")
  const [asMaxScore, setAsMaxScore] = useState("100")
  const [asWeightage, setAsWeightage] = useState("10")
  const [asDate, setAsDate] = useState("")

  // 5. Marks Sheet Modal (Bulk enter marks)
  const [selectedAssessmentForMarks, setSelectedAssessmentForMarks] = useState<Assessment | null>(null)
  const [isMarksSheetOpen, setIsMarksSheetOpen] = useState(false)
  const [isLoadingMarksSheet, setIsLoadingMarksSheet] = useState(false)
  const [marksSheetRows, setMarksSheetRows] = useState<StudentMarksRow[]>([])
  const [isSavingBulkMarks, setIsSavingBulkMarks] = useState(false)

  // -”€-”€ Load Portal Data -”€-”€
  const loadPortalClasses = useCallback(async () => {
    try {
      setIsLoading(true)
      const user = authService.getCurrentUser()
      setCurrentUser(user)

      const res = await db.getTeacherPortalClasses()
      if (res) {
        setAssignments(res.assignments || [])
        setCurrentYear(res.currentYear || null)
      }
    } catch (error: any) {
      console.error("Failed to load teacher portal classes:", error)
      notifications.error("Failed to load classes", error.message || "Please refresh to try again.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPortalClasses()
  }, [loadPortalClasses])

  // -”€-”€ Load Selected Class Details -”€-”€
  const loadClassDetails = useCallback(async (assignment: PortalAssignment) => {
    if (!assignment.gradeId || !assignment.sectionId) return
    try {
      setIsLoadingDetails(true)
      const data = await db.getTeacherPortalClassDetails({
        gradeId: assignment.gradeId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId || undefined,
        academicYearId: assignment.academicYearId || undefined,
      })
      setClassDetails(data)
    } catch (error: any) {
      console.error("Failed to load class details:", error)
      notifications.error("Failed to load class data", error.message || "Could not retrieve class records.")
    } finally {
      setIsLoadingDetails(false)
    }
  }, [])

  const handleSelectClass = (assignment: PortalAssignment) => {
    setSelectedAssignment(assignment)
    setActiveTab("overview")
    loadClassDetails(assignment)
  }

  // -”€-”€ Filtered Classes -”€-”€
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (roleFilter !== "ALL" && a.role !== roleFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const gName = (a.grade?.name || "").toLowerCase()
      const sName = (a.section?.name || "").toLowerCase()
      const subName = (a.subjectRef?.name || a.subject || "").toLowerCase()
      return gName.includes(q) || sName.includes(q) || subName.includes(q)
    })
  }, [assignments, roleFilter, searchQuery])

  // -”€-”€ Actions: Create Homework -”€-”€
  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment?.gradeId) return
    if (!hwTitle.trim() || !hwDueDate) {
      notifications.error("Validation Error", "Title and Due Date are required.")
      return
    }

    try {
      setIsSubmittingHw(true)
      await homeworkClientService.create({
        title: hwTitle.trim(),
        description: hwDescription.trim() || undefined,
        gradeId: selectedAssignment.gradeId,
        sectionId: selectedAssignment.sectionId || undefined,
        subjectId: selectedAssignment.subjectId || "",
        dueDate: new Date(hwDueDate).toISOString(),
        maxScore: Number(hwMaxScore) || 100,
        status: hwStatus,
      })

      notifications.success("Success", "Homework assignment posted successfully!")
      setIsHomeworkOpen(false)
      setHwTitle("")
      setHwDescription("")
      setHwDueDate("")
      setHwMaxScore("100")
      setHwStatus("PUBLISHED")
      // Reload details
      if (selectedAssignment) loadClassDetails(selectedAssignment)
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to create homework.")
    } finally {
      setIsSubmittingHw(false)
    }
  }

  // -”€-”€ Actions: View & Grade Submissions -”€-”€
  const handleOpenSubmissions = async (hw: Homework) => {
    setSelectedHomeworkForSubmissions(hw)
    setIsSubmissionsModalOpen(true)
    setIsLoadingSubmissions(true)
    try {
      const subs = await homeworkClientService.getSubmissions(hw.id)
      setSubmissionsList(subs)
      // Pre-fill existing score & feedback
      const scores: Record<string, string> = {}
      const feedbacks: Record<string, string> = {}
      subs.forEach((s) => {
        if (s.score !== null && s.score !== undefined) scores[s.id] = String(s.score)
        if (s.feedback) feedbacks[s.id] = s.feedback
      })
      setGradeScoreInput(scores)
      setGradeFeedbackInput(feedbacks)
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to load submissions.")
    } finally {
      setIsLoadingSubmissions(false)
    }
  }

  const handleSaveSubmissionGrade = async (submissionId: string) => {
    const rawScore = gradeScoreInput[submissionId]
    if (rawScore === undefined || rawScore === "") {
      notifications.error("Validation Error", "Please enter a valid numeric score.")
      return
    }
    const scoreNum = Number(rawScore)
    if (isNaN(scoreNum) || scoreNum < 0) {
      notifications.error("Validation Error", "Score must be a positive number.")
      return
    }

    try {
      setSavingGradeId(submissionId)
      await homeworkClientService.gradeSubmission(submissionId, {
        score: scoreNum,
        feedback: gradeFeedbackInput[submissionId] || undefined,
      })
      notifications.success("Grade Saved", "Student submission marked successfully.")
      // Update local state
      setSubmissionsList((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, score: scoreNum, feedback: gradeFeedbackInput[submissionId] } : s))
      )
      setGradingSubmissionId(null)
      if (selectedAssignment) loadClassDetails(selectedAssignment)
    } catch (error: any) {
      notifications.error("Grading Failed", error.message || "Could not save grade.")
    } finally {
      setSavingGradeId(null)
    }
  }

  // -”€-”€ Actions: Share Learning Material -”€-”€
  const handleMaterialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 25 * 1024 * 1024) {
      notifications.error("File Too Large", "Maximum supported file size is 25MB.")
      return
    }

    setIsReadingFile(true)
    setMatFileName(file.name)
    setMatFileSize(file.size)

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    let detectedType = 'DOC'
    if (ext === 'pdf') detectedType = 'PDF'
    else if (['ppt', 'pptx'].includes(ext)) detectedType = 'SLIDES'
    else if (['doc', 'docx'].includes(ext)) detectedType = 'DOC'
    else if (['mp4', 'mov', 'webm'].includes(ext)) detectedType = 'VIDEO'
    else if (['xls', 'xlsx', 'csv'].includes(ext)) detectedType = 'SHEET'
    else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) detectedType = 'IMAGE'

    setMatFileType(detectedType)
    if (!matTitle.trim()) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setMatTitle(nameWithoutExt.replace(/[-_]/g, ' '))
    }

    const reader = new FileReader()
    reader.onload = () => {
      setMatFileUrl(reader.result as string)
      setIsReadingFile(false)
    }
    reader.onerror = () => {
      notifications.error("File Error", "Could not process file.")
      setIsReadingFile(false)
    }
    reader.readAsDataURL(file)
  }

  const handleShareMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment?.gradeId) return
    if (!matTitle.trim()) {
      notifications.error("Validation Error", "Material Title is required.")
      return
    }
    if (!matFileUrl.trim()) {
      notifications.error("Validation Error", materialSource === "file" ? "Please select a file to upload." : "File URL / Link is required.")
      return
    }

    try {
      setIsSubmittingMaterial(true)
      await learningMaterialClientService.create({
        title: matTitle.trim(),
        description: matDescription.trim() || undefined,
        gradeId: selectedAssignment.gradeId,
        subjectId: selectedAssignment.subjectId || "",
        fileUrl: matFileUrl.trim(),
        fileType: matFileType,
        fileSize: matFileSize || undefined,
      })

      notifications.success("Shared!", "Learning material published to class.")
      setIsMaterialOpen(false)
      setMatTitle("")
      setMatDescription("")
      setMatFileUrl("")
      setMatFileName("")
      setMatFileSize(null)
      setMatFileType("PDF")
      setMaterialSource("file")
      if (selectedAssignment) loadClassDetails(selectedAssignment)
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to share material.")
    } finally {
      setIsSubmittingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm("Are you sure you want to remove this learning material?")) return
    try {
      await learningMaterialClientService.delete(materialId)
      notifications.success("Removed", "Learning material deleted.")
      if (selectedAssignment) loadClassDetails(selectedAssignment)
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to remove material.")
    }
  }

  // -”€-”€ Actions: Create Assessment -”€-”€
  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment?.gradeId) return
    if (!asTitle.trim()) {
      notifications.error("Validation Error", "Title is required.")
      return
    }

    try {
      setIsSubmittingAssessment(true)
      await gradebookService.createAssessment({
        title: asTitle.trim(),
        type: asType,
        gradeId: selectedAssignment.gradeId,
        sectionId: selectedAssignment.sectionId || undefined,
        subjectId: selectedAssignment.subjectId || "",
        academicYearId: selectedAssignment.academicYearId || currentYear?.id || undefined,
        maxScore: Number(asMaxScore) || 100,
        weightage: Number(asWeightage) || 10,
        date: asDate ? new Date(asDate).toISOString() : undefined,
      })

      notifications.success("Created", "Assessment added to gradebook.")
      setIsAssessmentOpen(false)
      setAsTitle("")
      setAsType("QUIZ")
      setAsMaxScore("100")
      setAsWeightage("10")
      setAsDate("")
      if (selectedAssignment) loadClassDetails(selectedAssignment)
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to create assessment.")
    } finally {
      setIsSubmittingAssessment(false)
    }
  }

  // -”€-”€ Actions: Marks Sheet (Gradebook Entry) -”€-”€
  const handleOpenMarksSheet = async (assessment: Assessment) => {
    setSelectedAssessmentForMarks(assessment)
    setIsMarksSheetOpen(true)
    setIsLoadingMarksSheet(true)
    try {
      const data = await gradebookService.getMarksSheet(assessment.id)
      setMarksSheetRows(data.rows || [])
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to load marks sheet.")
    } finally {
      setIsLoadingMarksSheet(false)
    }
  }

  const handleUpdateMarksRow = (studentId: string, updates: Partial<StudentMarksRow>) => {
    setMarksSheetRows((prev) =>
      prev.map((row) => (row.student.id === studentId ? { ...row, ...updates } : row))
    )
  }

  const handleSaveBulkMarks = async () => {
    if (!selectedAssessmentForMarks) return
    try {
      setIsSavingBulkMarks(true)
      const payload = marksSheetRows.map((r) => ({
        studentId: r.student.id,
        score: r.score ?? 0,
        isAbsent: r.isAbsent,
        remarks: r.remarks || "",
      }))

      await gradebookService.saveBulkMarks(selectedAssessmentForMarks.id, payload)
      notifications.success("Saved!", "Student grades saved successfully.")
      setIsMarksSheetOpen(false)
      if (selectedAssignment) loadClassDetails(selectedAssignment)
    } catch (error: any) {
      notifications.error("Failed to save marks", error.message || "Could not save student grades.")
    } finally {
      setIsSavingBulkMarks(false)
    }
  }

  // -”€-”€ Render Loading -”€-”€
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageSkeleton variant="dashboard" />
      </div>
    )
  }

  // -”€-”€ VIEW 1: Directory / All Classes Grid -”€-”€
  if (!selectedAssignment) {
    const subjectTeacherCount = assignments.filter((a) => a.role === "SUBJECT_TEACHER").length
    const homeroomCount = assignments.filter((a) => a.role === "HOMEROOM_TEACHER").length

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white p-6 md:p-10 shadow-xl">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-white border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Subject Teacher Workspace</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                My Assigned Classes & Subjects
              </h1>
              <p className="text-blue-100 max-w-xl text-sm md:text-base">
                Welcome back{currentUser?.name ? `, ${currentUser.name}` : ""}. Select an assigned class to post homework, upload materials, record grades, and track student submissions.
              </p>
            </div>

            {currentYear && (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 self-start md:self-auto">
                <Calendar className="w-5 h-5 text-blue-200" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">Active Year</div>
                  <div className="font-bold text-white text-sm">{currentYear.name}</div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="text-xs text-blue-200">Total Classes</div>
              <div className="text-2xl font-black">{assignments.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="text-xs text-blue-200">Subject Roles</div>
              <div className="text-2xl font-black">{subjectTeacherCount}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10 col-span-2 sm:col-span-1">
              <div className="text-xs text-blue-200">Homeroom Roles</div>
              <div className="text-2xl font-black">{homeroomCount}</div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by grade, section, or subject..."
              className="pl-10 h-11 bg-white/80 dark:bg-slate-800/60 backdrop-blur-md border-slate-300/80 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-indigo-500 rounded-xl shadow-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={roleFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("ALL")}
              className="rounded-xl font-medium"
            >
              All ({assignments.length})
            </Button>
            <Button
              variant={roleFilter === "SUBJECT_TEACHER" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("SUBJECT_TEACHER")}
              className="rounded-xl font-medium gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Subject Teacher ({subjectTeacherCount})
            </Button>
            <Button
              variant={roleFilter === "HOMEROOM_TEACHER" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("HOMEROOM_TEACHER")}
              className="rounded-xl font-medium gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              Homeroom ({homeroomCount})
            </Button>
          </div>
        </div>

        {/* Classes Grid */}
        {filteredAssignments.length === 0 ? (
          <div className="border border-dashed border-slate-300/80 dark:border-white/10 p-12 text-center rounded-3xl bg-white/40 dark:bg-slate-900/30 backdrop-blur-xl shadow-md">
            <div className="w-16 h-16 rounded-3xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md mx-auto flex items-center justify-center text-muted-foreground mb-4 shadow-xs">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No assigned classes found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              {searchQuery
                ? "No classes match your current search query."
                : "You do not have any teaching assignments assigned for this academic year yet. Please contact your school administrator."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((assignment) => {
              const isHomeroom = assignment.role === "HOMEROOM_TEACHER"
              const subjectName = assignment.subjectRef?.name || assignment.subject || (isHomeroom ? "Homeroom Class" : "General Subject")

              return (
                <div
                  key={assignment.id}
                  onClick={() => handleSelectClass(assignment)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl hover:border-indigo-500/50 dark:hover:border-indigo-500/40 hover:bg-white/90 dark:hover:bg-slate-900/70 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-md shadow-black/5 dark:shadow-black/20"
                >
                  {/* Subtle top role accent bar */}
                  <div
                    className={cn(
                      "h-1.5 w-full",
                      isHomeroom
                        ? "bg-gradient-to-r from-violet-500 to-purple-600"
                        : "bg-gradient-to-r from-blue-500 to-indigo-600"
                    )}
                  />

                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-1 font-semibold text-xs gap-1.5 border shadow-xs backdrop-blur-sm",
                          isHomeroom
                            ? "bg-violet-500/10 text-violet-700 border-violet-300/60 dark:text-violet-300 dark:border-violet-700/40"
                            : "bg-blue-500/10 text-blue-700 border-blue-300/60 dark:text-blue-300 dark:border-blue-700/40"
                        )}
                      >
                        {isHomeroom ? <Home className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {isHomeroom ? "Homeroom Teacher" : "Subject Teacher"}
                      </Badge>

                      {assignment.academicYear && (
                        <span className="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm">
                          {assignment.academicYear.name}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold mt-3 text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {assignment.grade?.name} - Section {assignment.section?.name}
                    </h3>
                    {assignment.stream && (
                      <p className="text-xs text-muted-foreground font-medium">Stream: {assignment.stream.name}</p>
                    )}
                  </div>

                  <div className="px-5 pb-5 space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/80 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-2xs">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <BookMarked className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Subject</div>
                        <div className="text-sm font-semibold truncate text-foreground">{subjectName}</div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground font-medium border-t border-slate-200/60 dark:border-white/10">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        Students Roster
                      </span>
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
                        Open Portal
                        <ChevronRight className="w-4 h-4" />
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

  // -”€-”€ VIEW 2: Selected Class Workspace -”€-”€
  const isSelectedHomeroom = selectedAssignment.role === "HOMEROOM_TEACHER"
  const currentSubjectName =
    selectedAssignment.subjectRef?.name ||
    selectedAssignment.subject ||
    (isSelectedHomeroom ? "Homeroom Class" : "Subject")

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation & Workspace Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedAssignment(null)
              setClassDetails(null)
            }}
            className="rounded-xl gap-2 font-semibold text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Classes
          </Button>

          {/* Quick Class Switcher Dropdown */}
          {assignments.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Switch Class:</span>
              <Select
                value={selectedAssignment.id}
                onValueChange={(val) => {
                  const target = assignments.find((a) => a.id === val)
                  if (target) handleSelectClass(target)
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border border-slate-300/80 dark:border-white/10 bg-white/80 dark:bg-slate-800/60 backdrop-blur-md max-w-[220px]">
                  <SelectValue placeholder="Switch class" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl">
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.grade?.name} - {a.section?.name} ({a.subjectRef?.name || a.subject || a.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Class Banner Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "rounded-full px-3 py-1 font-semibold text-xs border gap-1.5",
                    isSelectedHomeroom
                      ? "bg-violet-500/20 text-violet-300 border-violet-400/30"
                      : "bg-blue-500/20 text-blue-300 border-blue-400/30"
                  )}
                >
                  {isSelectedHomeroom ? <Home className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                  {isSelectedHomeroom ? "Homeroom Teacher" : "Subject Teacher"}
                </Badge>
                {selectedAssignment.academicYear && (
                  <Badge variant="outline" className="text-xs border-white/20 text-indigo-200">
                    {selectedAssignment.academicYear.name}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {selectedAssignment.grade?.name} - Section {selectedAssignment.section?.name}
              </h1>

              <div className="flex items-center gap-3 text-indigo-200 text-sm">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4 text-indigo-400" />
                  {currentSubjectName}
                </span>
                {selectedAssignment.stream && (
                  <>
                                        <span>Stream: {selectedAssignment.stream.name}</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                onClick={() => setIsHomeworkOpen(true)}
                size="sm"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Post Homework
              </Button>
              <Button
                onClick={() => setIsMaterialOpen(true)}
                size="sm"
                variant="outline"
                className="rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white gap-1.5"
              >
                <FolderOpen className="w-4 h-4" />
                Share Material
              </Button>
              <Button
                onClick={() => setIsAssessmentOpen(true)}
                size="sm"
                variant="outline"
                className="rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white gap-1.5"
              >
                <Award className="w-4 h-4" />
                New Assessment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Tabs */}
      {isLoadingDetails ? (
        <div className="p-12 text-center">
          <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Loading class records and content...</p>
        </div>
      ) : classDetails ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 border border-white/60 dark:border-white/10 shadow-md shadow-black/5 dark:shadow-black/20">
            <TabsTrigger value="overview" className="rounded-xl text-xs md:text-sm font-medium gap-1.5 py-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-xl text-xs md:text-sm font-medium gap-1.5 py-2">
              <Users className="w-4 h-4" />
              Students ({classDetails.students?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="homework" className="rounded-xl text-xs md:text-sm font-medium gap-1.5 py-2">
              <BookOpen className="w-4 h-4" />
              Assignments & Homework ({classDetails.homework?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="materials" className="rounded-xl text-xs md:text-sm font-medium gap-1.5 py-2">
              <FolderOpen className="w-4 h-4" />
              Learning Materials ({classDetails.materials?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="gradebook" className="rounded-xl text-xs md:text-sm font-medium gap-1.5 py-2">
              <GraduationCap className="w-4 h-4" />
              Gradebook ({classDetails.assessments?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-white/60 dark:border-white/10 p-5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-blue-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Class Roster</div>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.students?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Active registered students</div>
              </div>

              <div className="rounded-2xl border border-white/60 dark:border-white/10 p-5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-indigo-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Assignments</div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.homework?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Posted homework tasks</div>
              </div>

              <div className="rounded-2xl border border-white/60 dark:border-white/10 p-5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-emerald-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Learning Materials</div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.materials?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Shared study resources</div>
              </div>

              <div className="rounded-2xl border border-white/60 dark:border-white/10 p-5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 hover:border-amber-500/40 hover:bg-white/80 dark:hover:bg-slate-900/60 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Assessments</div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.assessments?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Recorded gradebook tests</div>
              </div>
            </div>

            {/* Quick Preview Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Homework */}
              <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20">
                <div className="flex flex-row items-center justify-between p-5 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Recent Homework &amp; Tasks</h3>
                    <p className="text-xs text-muted-foreground">Latest assignments posted to this class</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("homework")} className="text-xs text-indigo-600">
                    View All &rarr;
                  </Button>
                </div>
                <div className="px-5 pb-5 space-y-3">
                  {classDetails.homework?.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No assignments posted yet. Click "Post Homework" to get started.
                    </div>
                  ) : (
                    classDetails.homework.slice(0, 3).map((hw) => (
                      <div
                        key={hw.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/80 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-slate-800/80 transition-all shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate text-foreground">{hw.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            Due {new Date(hw.dueDate).toLocaleDateString()}
                                                        <span>Max {hw.maxScore} pts</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSubmissions(hw)}
                          className="rounded-xl text-xs gap-1 ml-3"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Submissions ({hw._count?.submissions || hw.submissions?.length || 0})
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20">
                <div className="flex flex-row items-center justify-between p-5 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Shared Learning Materials</h3>
                    <p className="text-xs text-muted-foreground">Class notes, slides, and study links</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("materials")} className="text-xs text-indigo-600">
                    View All &rarr;
                  </Button>
                </div>
                <div className="px-5 pb-5 space-y-3">
                  {classDetails.materials?.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No materials shared yet. Click "Share Material" to upload notes.
                    </div>
                  ) : (
                    classDetails.materials.slice(0, 3).map((mat) => (
                      <div
                        key={mat.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/80 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-slate-800/80 transition-all shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate text-foreground">{mat.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {mat.description || mat.fileType || "Resource"}
                          </div>
                        </div>
                        {mat.fileUrl && (
                          <a
                            href={mat.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline ml-3"
                          >
                            Open <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: STUDENTS */}
          <TabsContent value="students" className="space-y-4">
            <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20 overflow-hidden">
              <div className="flex flex-row items-center justify-between p-5 pb-4 border-b border-slate-200/60 dark:border-white/10">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Students Roster</h3>
                  <p className="text-xs text-muted-foreground">
                    Enrolled students in {selectedAssignment.grade?.name} - Section {selectedAssignment.section?.name}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold text-xs">
                  {classDetails.students?.length || 0} Students
                </Badge>
              </div>

              <div className="overflow-x-auto">
                {classDetails.students?.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm">
                    No active students enrolled in this section.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">#</th>
                          <th className="px-6 py-3.5">Student Name</th>
                          <th className="px-6 py-3.5">Student ID</th>
                          <th className="px-6 py-3.5">Gender</th>
                          <th className="px-6 py-3.5">Parent Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-medium">
                        {classDetails.students.map((student, idx) => (
                          <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4 text-xs text-muted-foreground">{idx + 1}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-xs flex items-center justify-center">
                                  {student.fullName?.charAt(0)?.toUpperCase() || "S"}
                                </div>
                                <div className="font-semibold text-foreground">{student.fullName}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                              {student.student_id || "-"}
                            </td>
                            <td className="px-6 py-4 text-xs">
                              {student.gender ? (
                                <Badge variant="secondary" className="rounded-md font-medium text-[11px]">
                                  {student.gender}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground">
                              {student.parent_phone ? (
                                <div>
                                  <div className="text-foreground">{student.parent_name || "Parent"}</div>
                                  <div className="text-[11px]">{student.parent_phone}</div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: HOMEWORK & ASSIGNMENTS */}
          <TabsContent value="homework" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Homework & Assignments</h3>
                <p className="text-xs text-muted-foreground">Create assignments, track submissions, and grade work</p>
              </div>
              <Button
                onClick={() => setIsHomeworkOpen(true)}
                size="sm"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                Post Homework
              </Button>
            </div>

            {classDetails.homework?.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-semibold text-foreground">No homework tasks yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Create your first assignment for this class to start receiving student submissions.
                </p>
                <Button
                  onClick={() => setIsHomeworkOpen(true)}
                  size="sm"
                  className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Post Homework
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classDetails.homework.map((hw) => {
                  const submissionCount = hw._count?.submissions ?? hw.submissions?.length ?? 0
                  return (
                    <div
                      key={hw.id}
                      className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-5 space-y-4 shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground leading-snug">{hw.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                              <Calendar className="w-3.5 h-3.5" />
                              Due {new Date(hw.dueDate).toLocaleDateString()}
                            </span>
                                                        <span>Max {hw.maxScore} Pts</span>
                          </div>
                        </div>

                        <Badge
                          variant={hw.status === "PUBLISHED" ? "default" : "secondary"}
                          className="rounded-full text-[11px] font-semibold"
                        >
                          {hw.status}
                        </Badge>
                      </div>

                      {hw.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-slate-800/40">
                          {hw.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{submissionCount} Submissions</span>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSubmissions(hw)}
                          className="rounded-xl text-xs gap-1.5 font-semibold hover:bg-indigo-500 hover:text-white transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View & Grade Submissions
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: LEARNING MATERIALS */}
          <TabsContent value="materials">
            <TeacherSharedMaterials
              materials={classDetails.materials || []}
              onRefresh={() => {
                if (selectedAssignment) loadClassDetails(selectedAssignment)
              }}
              classContext={{
                gradeId: selectedAssignment?.gradeId,
                gradeName: selectedAssignment?.grade?.name,
                sectionId: selectedAssignment?.sectionId,
                sectionName: selectedAssignment?.section?.name,
                subjectId: selectedAssignment?.subjectId,
                subjectName: selectedAssignment?.subjectRef?.name || selectedAssignment?.subject,
                academicYearName: selectedAssignment?.academicYear?.name || currentYear?.name,
              }}
            />
          </TabsContent>

          {/* TAB 5: GRADEBOOK */}
          <TabsContent value="gradebook" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Gradebook & Assessments</h3>
                <p className="text-xs text-muted-foreground">Record quiz, test, and exam scores for students</p>
              </div>
              <Button
                onClick={() => setIsAssessmentOpen(true)}
                size="sm"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                New Assessment
              </Button>
            </div>

            {classDetails.assessments?.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-md shadow-black/5 dark:shadow-black/20">
                <Award className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-semibold text-foreground">No assessments recorded yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Create an assessment to record test marks, midterm scores, or class projects.
                </p>
                <Button
                  onClick={() => setIsAssessmentOpen(true)}
                  size="sm"
                  className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  New Assessment
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classDetails.assessments.map((as) => {
                  const marksCount = (as as any)._count?.marks ?? (as as any).marks?.length ?? 0
                  return (
                    <div
                      key={as.id}
                      className="rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-5 space-y-4 shadow-md shadow-black/5 dark:shadow-black/20 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground">{as.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="rounded-md font-semibold text-[11px]">
                              {as.type}
                            </Badge>
                                                        <span>Max: {as.maxScore} Pts</span>
                                                        <span>Weightage: {as.weightage}%</span>
                          </div>
                        </div>

                        {as.date && (
                          <span className="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-white/10">
                            {new Date(as.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between">
                        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{marksCount} Students Graded</span>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleOpenMarksSheet(as)}
                          className="rounded-xl text-xs gap-1.5 font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Enter / Edit Marks
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {/* -”€-”€-”€ MODAL 1: Create Homework -”€-”€-”€ */}
      <Dialog open={isHomeworkOpen} onOpenChange={setIsHomeworkOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Post New Homework</DialogTitle>
            <DialogDescription className="text-xs">
              Assign homework to {selectedAssignment?.grade?.name} - Section {selectedAssignment?.section?.name} for{" "}
              {currentSubjectName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateHomework} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title *</Label>
              <Input
                placeholder="e.g. Chapter 4 Practice Questions"
                value={hwTitle}
                onChange={(e) => setHwTitle(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Due Date & Time *</Label>
                <Input
                  type="datetime-local"
                  value={hwDueDate}
                  onChange={(e) => setHwDueDate(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Score</Label>
                <Input
                  type="number"
                  min="1"
                  value={hwMaxScore}
                  onChange={(e) => setHwMaxScore(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description / Instructions</Label>
              <Textarea
                placeholder="Provide task details, references, or instructions..."
                rows={3}
                value={hwDescription}
                onChange={(e) => setHwDescription(e.target.value)}
                className="rounded-xl resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status</Label>
              <Select value={hwStatus} onValueChange={setHwStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="PUBLISHED">Published (Visible to students)</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsHomeworkOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingHw}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                {isSubmittingHw ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Post Homework
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -”€-”€-”€ MODAL 2: View Submissions & Grade -”€-”€-”€ */}
      <Dialog open={isSubmissionsModalOpen} onOpenChange={setIsSubmissionsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" />
              Submissions: {selectedHomeworkForSubmissions?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review student answers, assign marks (Max: {selectedHomeworkForSubmissions?.maxScore || 100} pts), and provide feedback.
            </DialogDescription>
          </DialogHeader>

          {isLoadingSubmissions ? (
            <div className="p-12 text-center">
              <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading student submissions...</p>
            </div>
          ) : submissionsList.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm border border-dashed rounded-2xl my-2">
              No students have submitted this assignment yet.
            </div>
          ) : (
            <div className="space-y-4 my-2">
              {submissionsList.map((sub) => {
                const isEditingThis = gradingSubmissionId === sub.id
                return (
                  <div key={sub.id} className="rounded-2xl border border-slate-200/80 dark:border-white/10 p-4 space-y-3 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 font-bold text-xs flex items-center justify-center">
                          {sub.student?.fullName?.charAt(0) || "S"}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground">{sub.student?.fullName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{sub.student?.student_id}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge
                          variant={sub.score !== null && sub.score !== undefined ? "default" : "secondary"}
                          className="rounded-full text-xs"
                        >
                          {sub.score !== null && sub.score !== undefined ? `${sub.score} / ${selectedHomeworkForSubmissions?.maxScore}` : "Ungraded"}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Submitted {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Submission Content */}
                    {sub.submissionText && (
                      <div className="p-3 rounded-xl bg-muted/40 text-xs text-foreground font-mono border border-border/40 whitespace-pre-wrap">
                        {sub.submissionText}
                      </div>
                    )}

                    {/* Grading Form / Display */}
                    <div className="pt-2 border-t border-border/40 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">Score</Label>
                          <Input
                            type="number"
                            min="0"
                            max={selectedHomeworkForSubmissions?.maxScore || 100}
                            placeholder="Score"
                            className="h-8 text-xs rounded-lg"
                            value={gradeScoreInput[sub.id] || ""}
                            onChange={(e) =>
                              setGradeScoreInput((prev) => ({ ...prev, [sub.id]: e.target.value }))
                            }
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-[11px] font-semibold">Feedback / Comments</Label>
                          <Input
                            placeholder="Optional feedback..."
                            className="h-8 text-xs rounded-lg"
                            value={gradeFeedbackInput[sub.id] || ""}
                            onChange={(e) =>
                              setGradeFeedbackInput((prev) => ({ ...prev, [sub.id]: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleSaveSubmissionGrade(sub.id)}
                          disabled={savingGradeId === sub.id}
                          className="h-8 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5"
                        >
                          {savingGradeId === sub.id ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          Save Grade
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubmissionsModalOpen(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -”€-”€-”€ MODAL 3: Share Learning Material -”€-”€-”€ */}
      <Dialog open={isMaterialOpen} onOpenChange={setIsMaterialOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Share Learning Material</DialogTitle>
            <DialogDescription className="text-xs">
              Upload or link study materials for {currentSubjectName} in this class.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleShareMaterial} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Material Title *</Label>
              <Input
                placeholder="e.g. Unit 2 Lecture Slides & Notes"
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            {/* Source switch: File Upload vs Web Link */}
            <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMaterialSource("file")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  materialSource === "file" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File (PDF / Doc)
              </button>
              <button
                type="button"
                onClick={() => setMaterialSource("link")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  materialSource === "link" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Web / External Link
              </button>
            </div>

            {materialSource === "file" ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Choose File (PDF, DOCX, PPTX, etc.) *</Label>
                {matFileName ? (
                  <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{matFileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {matFileType} {matFileSize ? `(${matFileSize < 1024 * 1024 ? Math.round(matFileSize / 1024) + ' KB' : (matFileSize / (1024 * 1024)).toFixed(1) + ' MB'})` : ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMatFileUrl("")
                        setMatFileName("")
                        setMatFileSize(null)
                      }}
                      className="text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg px-2 h-7"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-border/80 hover:border-indigo-500/60 hover:bg-indigo-500/5 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.mp4"
                      onChange={handleMaterialFileChange}
                    />
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      {isReadingFile ? <Spinner className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                    </div>
                    <span className="text-xs font-bold text-foreground">Click to browse or drop file here</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Supports PDF, Word (DOC/DOCX), Slides (PPTX), Excel, Images (up to 25MB)
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Web Link / File URL *</Label>
                <Input
                  placeholder="https://drive.google.com/... or https://..."
                  value={matFileUrl}
                  onChange={(e) => setMatFileUrl(e.target.value)}
                  required={materialSource === "link"}
                  className="rounded-xl"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resource Type</Label>
              <Select value={matFileType} onValueChange={setMatFileType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="PDF">PDF Document</SelectItem>
                  <SelectItem value="SLIDES">Presentation Slides</SelectItem>
                  <SelectItem value="DOC">Word / Doc</SelectItem>
                  <SelectItem value="SHEET">Spreadsheet / Excel</SelectItem>
                  <SelectItem value="VIDEO">Video Link</SelectItem>
                  <SelectItem value="LINK">Web Link / Article</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description / Notes</Label>
              <Textarea
                placeholder="Additional notes for students regarding this material..."
                rows={3}
                value={matDescription}
                onChange={(e) => setMatDescription(e.target.value)}
                className="rounded-xl resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMaterialOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingMaterial}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                {isSubmittingMaterial ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Share Material
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -”€-”€-”€ MODAL 4: Create Assessment -”€-”€-”€ */}
      <Dialog open={isAssessmentOpen} onOpenChange={setIsAssessmentOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Assessment</DialogTitle>
            <DialogDescription className="text-xs">
              Add a quiz, test, or exam to the gradebook for {currentSubjectName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssessment} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assessment Title *</Label>
              <Input
                placeholder="e.g. Midterm Examination / Quiz 1"
                value={asTitle}
                onChange={(e) => setAsTitle(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assessment Type</Label>
                <Select value={asType} onValueChange={setAsType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="QUIZ">Quiz</SelectItem>
                    <SelectItem value="MIDTERM">Midterm Exam</SelectItem>
                    <SelectItem value="FINAL">Final Exam</SelectItem>
                    <SelectItem value="TEST">Unit Test</SelectItem>
                    <SelectItem value="ASSIGNMENT">Graded Assignment</SelectItem>
                    <SelectItem value="PROJECT">Project</SelectItem>
                    <SelectItem value="PARTICIPATION">Participation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date</Label>
                <Input
                  type="date"
                  value={asDate}
                  onChange={(e) => setAsDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Score</Label>
                <Input
                  type="number"
                  min="1"
                  value={asMaxScore}
                  onChange={(e) => setAsMaxScore(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Weightage (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={asWeightage}
                  onChange={(e) => setAsWeightage(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssessmentOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingAssessment}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                {isSubmittingAssessment ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Create Assessment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -”€-”€-”€ MODAL 5: Marks Sheet (Enter/Edit Marks) -”€-”€-”€ */}
      <Dialog open={isMarksSheetOpen} onOpenChange={setIsMarksSheetOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              Marks Sheet: {selectedAssessmentForMarks?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record student grades (Max Score: {selectedAssessmentForMarks?.maxScore || 100} pts). Uncheck Absent to award scores.
            </DialogDescription>
          </DialogHeader>

          {isLoadingMarksSheet ? (
            <div className="p-12 text-center">
              <Spinner className="w-8 h-8 text-indigo-600 mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading students marks sheet...</p>
            </div>
          ) : marksSheetRows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm border border-dashed rounded-2xl my-2">
              No students found in this class section.
            </div>
          ) : (
            <div className="my-2 border rounded-2xl overflow-hidden divide-y divide-border/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 w-28">Score</th>
                    <th className="px-4 py-3 w-24 text-center">Absent?</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {marksSheetRows.map((row, idx) => (
                    <tr key={row.student.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{row.student.fullName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{row.student.student_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          max={selectedAssessmentForMarks?.maxScore || 100}
                          disabled={row.isAbsent}
                          value={row.score ?? ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : Number(e.target.value)
                            handleUpdateMarksRow(row.student.id, { score: val })
                          }}
                          className="h-8 text-xs rounded-lg"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.isAbsent}
                          onChange={(e) =>
                            handleUpdateMarksRow(row.student.id, {
                              isAbsent: e.target.checked,
                              score: e.target.checked ? null : row.score,
                            })
                          }
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          placeholder="Remarks..."
                          value={row.remarks || ""}
                          onChange={(e) =>
                            handleUpdateMarksRow(row.student.id, { remarks: e.target.value })
                          }
                          className="h-8 text-xs rounded-lg"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMarksSheetOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBulkMarks}
              disabled={isSavingBulkMarks || marksSheetRows.length === 0}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5"
            >
              {isSavingBulkMarks ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              Save All Marks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
