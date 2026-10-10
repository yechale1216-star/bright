"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { 
  BookOpen, Users, FileText, CheckCircle2, Plus, ArrowLeft, Calendar, 
  Clock, Award, FolderOpen, Send, Download, ExternalLink, Search, 
  Filter, Sparkles, AlertCircle, RefreshCw, ChevronRight, Edit3, 
  Trash2, Check, X, Shield, Star, GraduationCap, Eye, UserCheck, 
  AlertTriangle, Home, BookMarked, Layers, BarChart3, HelpCircle
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
import { cn } from "@/lib/utils/utils"

// ─── Interfaces ─────────────────────────────────────────────────────────────

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
  // ── State ──
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

  // ── Dialog States ──
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

  // ── Load Portal Data ──
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

  // ── Load Selected Class Details ──
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

  // ── Filtered Classes ──
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

  // ── Actions: Create Homework ──
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

  // ── Actions: View & Grade Submissions ──
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

  // ── Actions: Share Learning Material ──
  const handleShareMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment?.gradeId) return
    if (!matTitle.trim() || !matFileUrl.trim()) {
      notifications.error("Validation Error", "Title and File URL / Link are required.")
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
      })

      notifications.success("Shared!", "Learning material published to class.")
      setIsMaterialOpen(false)
      setMatTitle("")
      setMatDescription("")
      setMatFileUrl("")
      setMatFileType("PDF")
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

  // ── Actions: Create Assessment ──
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

  // ── Actions: Marks Sheet (Gradebook Entry) ──
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

  // ── Render Loading ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageSkeleton variant="dashboard" />
      </div>
    )
  }

  // ── VIEW 1: Directory / All Classes Grid ──
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
              className="pl-10 h-11 bg-card/60 backdrop-blur-sm border-border/80 focus-visible:ring-indigo-500 rounded-xl"
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
          <Card className="border-dashed p-12 text-center rounded-3xl bg-card/40">
            <div className="w-16 h-16 rounded-3xl bg-muted mx-auto flex items-center justify-center text-muted-foreground mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No assigned classes found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              {searchQuery
                ? "No classes match your current search query."
                : "You do not have any teaching assignments assigned for this academic year yet. Please contact your school administrator."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((assignment) => {
              const isHomeroom = assignment.role === "HOMEROOM_TEACHER"
              const subjectName = assignment.subjectRef?.name || assignment.subject || (isHomeroom ? "Homeroom Class" : "General Subject")

              return (
                <Card
                  key={assignment.id}
                  onClick={() => handleSelectClass(assignment)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-border/70 hover:border-indigo-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-card/80 backdrop-blur-md"
                >
                  {/* Subtle top role accent bar */}
                  <div
                    className={cn(
                      "h-2 w-full",
                      isHomeroom
                        ? "bg-gradient-to-r from-violet-500 to-purple-600"
                        : "bg-gradient-to-r from-blue-500 to-indigo-600"
                    )}
                  />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-1 font-semibold text-xs gap-1.5 border shadow-sm",
                          isHomeroom
                            ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"
                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                        )}
                      >
                        {isHomeroom ? <Home className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {isHomeroom ? "Homeroom Teacher" : "Subject Teacher"}
                      </Badge>

                      {assignment.academicYear && (
                        <span className="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded bg-muted">
                          {assignment.academicYear.name}
                        </span>
                      )}
                    </div>

                    <CardTitle className="text-xl font-bold mt-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {assignment.grade?.name} — Section {assignment.section?.name}
                    </CardTitle>
                    {assignment.stream && (
                      <p className="text-xs text-muted-foreground font-medium">Stream: {assignment.stream.name}</p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-muted/50 border border-border/50">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <BookMarked className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Subject</div>
                        <div className="text-sm font-semibold truncate text-foreground">{subjectName}</div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground font-medium border-t border-border/50">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        Students Roster
                      </span>
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
                        Open Portal
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── VIEW 2: Selected Class Workspace ──
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
                <SelectTrigger className="h-9 text-xs rounded-xl border-border bg-card max-w-[220px]">
                  <SelectValue placeholder="Switch class" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
                {selectedAssignment.grade?.name} — Section {selectedAssignment.section?.name}
              </h1>

              <div className="flex items-center gap-3 text-indigo-200 text-sm">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4 text-indigo-400" />
                  {currentSubjectName}
                </span>
                {selectedAssignment.stream && (
                  <>
                    <span>•</span>
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
          <TabsList className="bg-muted/70 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 border border-border/50">
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
              <Card className="rounded-2xl border border-border/70 p-5 bg-card/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Class Roster</div>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.students?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Active registered students</div>
              </Card>

              <Card className="rounded-2xl border border-border/70 p-5 bg-card/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Assignments</div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.homework?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Posted homework tasks</div>
              </Card>

              <Card className="rounded-2xl border border-border/70 p-5 bg-card/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Learning Materials</div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.materials?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Shared study resources</div>
              </Card>

              <Card className="rounded-2xl border border-border/70 p-5 bg-card/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium">Assessments</div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-foreground">{classDetails.assessments?.length || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Recorded gradebook tests</div>
              </Card>
            </div>

            {/* Quick Preview Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Homework */}
              <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-bold">Recent Homework & Tasks</CardTitle>
                    <CardDescription className="text-xs">Latest assignments posted to this class</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("homework")} className="text-xs text-indigo-600">
                    View All →
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {classDetails.homework?.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No assignments posted yet. Click "Post Homework" to get started.
                    </div>
                  ) : (
                    classDetails.homework.slice(0, 3).map((hw) => (
                      <div
                        key={hw.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/40 hover:bg-muted/70 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate text-foreground">{hw.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            Due {new Date(hw.dueDate).toLocaleDateString()}
                            <span>•</span>
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
                </CardContent>
              </Card>

              {/* Recent Materials */}
              <Card className="rounded-3xl border border-border/70 bg-card/70 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-bold">Shared Learning Materials</CardTitle>
                    <CardDescription className="text-xs">Class notes, slides, and study links</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("materials")} className="text-xs text-indigo-600">
                    View All →
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {classDetails.materials?.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No materials shared yet. Click "Share Material" to upload notes.
                    </div>
                  ) : (
                    classDetails.materials.slice(0, 3).map((mat) => (
                      <div
                        key={mat.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/40 hover:bg-muted/70 transition-colors"
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
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: STUDENTS */}
          <TabsContent value="students" className="space-y-4">
            <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
                <div>
                  <CardTitle className="text-lg font-bold">Students Roster</CardTitle>
                  <CardDescription className="text-xs">
                    Enrolled students in {selectedAssignment.grade?.name} - Section {selectedAssignment.section?.name}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold text-xs">
                  {classDetails.students?.length || 0} Students
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
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
                              {student.student_id || "—"}
                            </td>
                            <td className="px-6 py-4 text-xs">
                              {student.gender ? (
                                <Badge variant="secondary" className="rounded-md font-medium text-[11px]">
                                  {student.gender}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground">
                              {student.parent_phone ? (
                                <div>
                                  <div className="text-foreground">{student.parent_name || "Parent"}</div>
                                  <div className="text-[11px]">{student.parent_phone}</div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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
              <Card className="p-12 text-center rounded-3xl border-dashed bg-card/40">
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
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classDetails.homework.map((hw) => {
                  const submissionCount = hw._count?.submissions ?? hw.submissions?.length ?? 0
                  return (
                    <Card
                      key={hw.id}
                      className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-5 space-y-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground leading-snug">{hw.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                              <Calendar className="w-3.5 h-3.5" />
                              Due {new Date(hw.dueDate).toLocaleDateString()}
                            </span>
                            <span>•</span>
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
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-2.5 rounded-xl border border-border/40">
                          {hw.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
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
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: LEARNING MATERIALS */}
          <TabsContent value="materials" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Learning Materials & Resources</h3>
                <p className="text-xs text-muted-foreground">Upload and share slides, notes, readings, and study guides</p>
              </div>
              <Button
                onClick={() => setIsMaterialOpen(true)}
                size="sm"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                Share Material
              </Button>
            </div>

            {classDetails.materials?.length === 0 ? (
              <Card className="p-12 text-center rounded-3xl border-dashed bg-card/40">
                <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-semibold text-foreground">No learning materials shared yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  Share study notes, document links, or presentation slides for this class and subject.
                </p>
                <Button
                  onClick={() => setIsMaterialOpen(true)}
                  size="sm"
                  className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Share Material
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classDetails.materials.map((mat) => (
                  <Card
                    key={mat.id}
                    className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-5 space-y-3 hover:shadow-md transition-shadow relative group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                        {mat.fileType || "DOC"}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMaterial(mat.id)}
                        className="w-8 h-8 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground truncate">{mat.title}</h4>
                      {mat.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                          {mat.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                      {mat.fileUrl && (
                        <a
                          href={mat.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                        >
                          Open Resource <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
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
              <Card className="p-12 text-center rounded-3xl border-dashed bg-card/40">
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
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classDetails.assessments.map((as) => {
                  const marksCount = (as as any)._count?.marks ?? (as as any).marks?.length ?? 0
                  return (
                    <Card
                      key={as.id}
                      className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-5 space-y-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground">{as.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="rounded-md font-semibold text-[11px]">
                              {as.type}
                            </Badge>
                            <span>•</span>
                            <span>Max: {as.maxScore} Pts</span>
                            <span>•</span>
                            <span>Weightage: {as.weightage}%</span>
                          </div>
                        </div>

                        {as.date && (
                          <span className="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded bg-muted">
                            {new Date(as.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
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
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {/* ─── MODAL 1: Create Homework ─── */}
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

      {/* ─── MODAL 2: View Submissions & Grade ─── */}
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
                  <Card key={sub.id} className="rounded-2xl border border-border/70 p-4 space-y-3 bg-card/60">
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
                  </Card>
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

      {/* ─── MODAL 3: Share Learning Material ─── */}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Type</Label>
                <Select value={matFileType} onValueChange={setMatFileType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="PDF">PDF Document</SelectItem>
                    <SelectItem value="SLIDES">Presentation Slides</SelectItem>
                    <SelectItem value="LINK">Web Link / Article</SelectItem>
                    <SelectItem value="VIDEO">Video Link</SelectItem>
                    <SelectItem value="DOC">Word / Doc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">File URL / Web Link *</Label>
                <Input
                  placeholder="https://..."
                  value={matFileUrl}
                  onChange={(e) => setMatFileUrl(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
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

      {/* ─── MODAL 4: Create Assessment ─── */}
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

      {/* ─── MODAL 5: Marks Sheet (Enter/Edit Marks) ─── */}
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
