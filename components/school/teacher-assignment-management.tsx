"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Trash2, Plus, GraduationCap, Users, RefreshCw, Pencil,
  Search, ChevronRight, Check, X, BookOpen, Home,
  UserCheck, ArrowLeft, ArrowRight
} from "lucide-react"

import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { cn } from "@/lib/utils/utils"

type AssignmentRole = "SUBJECT_TEACHER" | "HOMEROOM_TEACHER"
type MainTab = "HOMEROOM" | "SUBJECT"

interface Teacher {
  id: string
  full_name: string
  email: string
  profile_photo?: string
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
  grade?: { id: string; name: string } | string
  section?: { id: string; name: string } | string
  stream?: { id: string; name: string } | string
  subjectRef?: { id: string; name: string; code?: string }
  academicYear?: { id: string; name: string }
  teacher?: {
    id: string
    name?: string
    full_name?: string
    email?: string
    profile_photo?: string
  }
}

interface SelectedSectionView {
  gradeId: string
  gradeName: string
  streamId?: string
  streamName?: string
  sectionId: string
  sectionName: string
}

interface DirectModalState {
  isOpen: boolean
  mode: "ASSIGN_SUBJECT" | "UPDATE_SUBJECT" | "ASSIGN_HOMEROOM" | "UPDATE_HOMEROOM"
  gradeId: string
  gradeName: string
  streamId?: string
  streamName?: string
  sectionId: string
  sectionName: string
  subjectId?: string
  subjectName?: string
  subjectCode?: string
  assignmentId?: string
  currentTeacherId?: string
  currentTeacherName?: string
  currentTeacherPhoto?: string
  currentTeacherEmail?: string
}

// Helper: Determine if grade is 11 or 12
function isGrade11or12Name(name?: string): boolean {
  if (!name) return false
  const lower = name.toLowerCase().trim()
  return /\b(11|12)\b/.test(lower) || lower.includes("11") || lower.includes("12")
}

// Helper: Format grade display name
function formatGradeLabel(name?: string): string {
  if (!name) return "Unknown Grade"
  const cleaned = name.trim()
  if (/^grade\s+/i.test(cleaned)) return cleaned
  return `Grade ${cleaned}`
}

// Helper: Format section display name
function formatSectionLabel(name?: string): string {
  if (!name) return "Unknown Section"
  const cleaned = name.trim()
  if (/^section\s+/i.test(cleaned)) return cleaned
  return `Section ${cleaned}`
}

// Helper: Sort grades naturally (1, 2, ... 9, 10, 11, 12)
function sortGradesNaturally(a: { name?: string }, b: { name?: string }): number {
  const parsePriority = (name: string) => {
    const n = name.trim().toLowerCase()
    // KG grades always come first (KG, KG1, KG2, Kindergarten, etc.)
    if (n.startsWith("kg") || n.startsWith("kindergarten")) {
      const kgNum = parseInt(n.replace(/\D/g, "") || "0", 10)
      return { order: 0, num: isNaN(kgNum) ? 0 : kgNum }
    }
    // Strip "grade " prefix, then parse the numeric part
    const stripped = n.replace(/^grade\s*/i, "")
    const num = parseInt(stripped.replace(/\D/g, "") || "0", 10)
    return { order: 1, num: isNaN(num) ? 999 : num }
  }
  const pa = parsePriority(a.name || "")
  const pb = parsePriority(b.name || "")
  if (pa.order !== pb.order) return pa.order - pb.order
  if (pa.num !== pb.num) return pa.num - pb.num
  return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true })
}

// Helper: Sort sections naturally (A, B, C or 1, 2, 3)
function sortSectionsNaturally(a: { name?: string }, b: { name?: string }): number {
  return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true })
}

export function TeacherAssignmentManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [availableGrades, setAvailableGrades] = useState<any[]>([])
  const [availableSections, setAvailableSections] = useState<any[]>([])
  const [availableStreams, setAvailableStreams] = useState<any[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([])
  const [gradeSubjects, setGradeSubjects] = useState<any[]>([])

  // Main Tab: "HOMEROOM" or "SUBJECT"
  const [activeTab, setActiveTab] = useState<MainTab>("HOMEROOM")

  // Dedicated section subject view state (null = show grade/section list)
  const [selectedSectionView, setSelectedSectionView] = useState<SelectedSectionView | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [schoolId, setSchoolId] = useState<string>("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Search & Filter state on main screen
  const [filterTeacherOrSection, setFilterTeacherOrSection] = useState("")
  const [filterGrade, setFilterGrade] = useState("ALL")
  const [filterStream, setFilterStream] = useState("ALL")

  // Search filter inside dedicated section screen
  const [sectionSubjectSearch, setSectionSubjectSearch] = useState("")

  // Direct Teacher Modal State
  const [directModal, setDirectModal] = useState<DirectModalState>({
    isOpen: false,
    mode: "ASSIGN_SUBJECT",
    gradeId: "",
    gradeName: "",
    sectionId: "",
    sectionName: "",
  })
  const [modalSelectedTeacher, setModalSelectedTeacher] = useState("")
  const [modalTeacherSearch, setModalTeacherSearch] = useState("")
  const [isSavingDirect, setIsSavingDirect] = useState(false)

  // Reset section view when switching main tabs
  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab)
    setSelectedSectionView(null)
  }

  // Initial avatar gradient helper
  const getInitials = (name: string) => {
    if (!name) return "T"
    return name.trim().split(/\s+/).map((p) => p[0]).join("").toUpperCase().slice(0, 2)
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
    if (!id) return gradients[0]
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
    return gradients[Math.abs(hash) % gradients.length]
  }

  // Data fetching
  const loadAllData = useCallback(async (school: string, isBackground = false, forceRefetch = false) => {
    try {
      if (!isBackground && assignments.length === 0) setIsLoading(true)
      const [teachersData, assignmentsData, gradesData, sectionsData, streamsData, subjectsData, gradeSubjectsData] = await Promise.all([
        db.getTeachers(forceRefetch),
        db.getTeacherAssignments(undefined, undefined, forceRefetch),
        db.getGrades(),
        db.getSections(),
        db.getStreams(),
        db.getSubjects(),
        db.getGradeSubjects(),
      ])
      setTeachers(teachersData || [])
      setAssignments((assignmentsData as any) || [])
      setAvailableGrades(gradesData || [])
      setAvailableSections(sectionsData || [])
      setAvailableStreams(streamsData || [])
      setAvailableSubjects(subjectsData || [])
      setGradeSubjects(gradeSubjectsData || [])
    } catch (error) {
      console.error("Error loading teacher assignments data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [assignments.length])

  useEffect(() => {
    const init = async () => {
      const user = authService.getCurrentUser()
      const sid = user?.schoolId || "single-school"
      setSchoolId(sid)
      await loadAllData(sid)
    }
    init()

    const handleDataChanged = () => {
      const sid = localStorage.getItem("x-school-id") || ""
      loadAllData(sid, true, true)
    }
    window.addEventListener("teacherDataChanged", handleDataChanged)
    window.addEventListener("gradeSubjectsChanged", handleDataChanged)
    const poll = setInterval(() => {
      const sid = localStorage.getItem("x-school-id") || ""
      if (sid) loadAllData(sid, true, false)
    }, 60_000)
    return () => {
      window.removeEventListener("teacherDataChanged", handleDataChanged)
      window.removeEventListener("gradeSubjectsChanged", handleDataChanged)
      clearInterval(poll)
    }
  }, [loadAllData])

  // Helper resolution functions for an assignment
  const resolveAssignmentDetails = useCallback((a: TeacherAssignment) => {
    let gradeId = a.gradeId || (typeof a.grade === "object" ? a.grade?.id : undefined) || ""
    let gradeObj = availableGrades.find((g) => g.id === gradeId)
    let gradeName = gradeObj?.name || (typeof a.grade === "string" ? a.grade : a.grade?.name) || ""
    if (!gradeId && gradeName) {
      const match = availableGrades.find((g) => g.name.toLowerCase() === gradeName.toLowerCase())
      if (match) {
        gradeId = match.id
        gradeObj = match
      }
    }

    let sectionId = a.sectionId || (typeof a.section === "object" ? a.section?.id : undefined) || ""
    let sectionObj = availableSections.find((s) => s.id === sectionId)
    let sectionName = sectionObj?.name || (typeof a.section === "string" ? a.section : a.section?.name) || ""
    if (!sectionId && sectionName) {
      const match = availableSections.find((s) => s.name.toLowerCase() === sectionName.toLowerCase() && (!gradeId || s.gradeId === gradeId))
      if (match) {
        sectionId = match.id
        sectionObj = match
      }
    }

    let streamId = a.streamId || (typeof a.stream === "object" ? a.stream?.id : undefined) || ""
    let streamObj = availableStreams.find((s) => s.id === streamId)
    let streamName = streamObj?.name || (typeof a.stream === "string" ? a.stream : a.stream?.name) || ""

    const teacherId = a.teacher_id || a.teacher?.id || ""
    const teacherFromList = teachers.find((t) => t.id === teacherId)
    // sanitizeName: reject null / undefined / "NaN" / "null" / "undefined" string values from DB
    const sanitizeName = (v: unknown): string | undefined => {
      if (v == null) return undefined
      const s = String(v).trim()
      if (!s || s === "NaN" || s === "null" || s === "undefined") return undefined
      return s
    }
    const teacherName =
      sanitizeName(a.teacher?.full_name) ??
      sanitizeName(a.teacher?.name) ??
      sanitizeName(teacherFromList?.full_name) ??
      sanitizeName((teacherFromList as any)?.name) ??
      "Not Assigned"
    const teacherEmail = a.teacher?.email || teacherFromList?.email || ""
    const teacherPhoto = a.teacher?.profile_photo || teacherFromList?.profile_photo || undefined

    let subjectName = a.subjectRef?.name || (typeof a.subject === "string" ? a.subject : "") || ""
    let subjectId = a.subjectId || a.subjectRef?.id || ""
    if (!subjectName && subjectId) {
      const subj = availableSubjects.find((s) => s.id === subjectId)
      if (subj) subjectName = subj.name
    }
    const subjectCode = a.subjectRef?.code || availableSubjects.find((s) => s.id === subjectId)?.code || ""

    return {
      assignmentId: a.id,
      gradeId,
      gradeName,
      gradeObj,
      sectionId,
      sectionName,
      sectionObj,
      streamId,
      streamName,
      streamObj,
      teacherId,
      teacherName,
      teacherEmail,
      teacherPhoto,
      subjectId,
      subjectName,
      subjectCode,
      role: (a.role as AssignmentRole) || "SUBJECT_TEACHER",
      raw: a,
    }
  }, [availableGrades, availableSections, availableStreams, availableSubjects, teachers])

  // Count totals for tabs
  const homeroomTotalCount = useMemo(() => {
    return assignments.filter((a) => a.role === "HOMEROOM_TEACHER").length
  }, [assignments])

  const subjectTotalCount = useMemo(() => {
    return assignments.filter((a) => a.role === "SUBJECT_TEACHER").length
  }, [assignments])

  // Helper: Get subjects for a class/section
  const getSubjectsForSection = useCallback((gradeId: string, streamId: string | null | undefined, sectionId: string) => {
    const map = new Map<string, any>()

    // 1. From curriculum gradeSubjects
    const curriculum = gradeSubjects.filter((gs) => {
      if (gs.gradeId !== gradeId) return false
      if (streamId) {
        return !gs.streamId || gs.streamId === streamId
      }
      return true
    })

    for (const gs of curriculum) {
      if (gs.subject && gs.subject.id) {
        map.set(gs.subject.id, gs.subject)
      } else if (gs.subjectId) {
        const full = availableSubjects.find((s) => s.id === gs.subjectId)
        if (full) {
          map.set(full.id, full)
        } else {
          map.set(gs.subjectId, { id: gs.subjectId, name: gs.subjectName || "Subject", code: "" })
        }
      }
    }

    // 2. From existing assignments in this section
    for (const a of assignments) {
      if (a.role === "SUBJECT_TEACHER") {
        const res = resolveAssignmentDetails(a)
        if (res.gradeId === gradeId && res.sectionId === sectionId && (!streamId || !res.streamId || res.streamId === streamId)) {
          if (res.subjectId && !map.has(res.subjectId)) {
            const full = availableSubjects.find((s) => s.id === res.subjectId)
            if (full) {
              map.set(full.id, full)
            } else {
              map.set(res.subjectId, { id: res.subjectId, name: res.subjectName || "Subject", code: res.subjectCode })
            }
          }
        }
      }
    }

    // 3. Fallback: If no curriculum records defined yet, offer available active school subjects so cards are NEVER empty
    if (map.size === 0 && availableSubjects.length > 0) {
      for (const s of availableSubjects) {
        if (s.isActive !== false) {
          map.set(s.id, s)
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [gradeSubjects, availableSubjects, assignments, resolveAssignmentDetails])

  // ─── Direct Assignment Actions ─────────────────────────────────────────────

  // 1. Direct Assign Subject Teacher
  const handleOpenDirectAssignSubject = (
    gradeId: string,
    gradeName: string,
    streamId: string | undefined,
    streamName: string | undefined,
    sectionId: string,
    sectionName: string,
    subject: { id: string; name: string; code?: string }
  ) => {
    setDirectModal({
      isOpen: true,
      mode: "ASSIGN_SUBJECT",
      gradeId,
      gradeName,
      streamId,
      streamName,
      sectionId,
      sectionName,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
    })
    setModalSelectedTeacher("")
    setModalTeacherSearch("")
  }

  // 2. Direct Update Subject Teacher
  const handleOpenDirectUpdateSubject = (
    gradeId: string,
    gradeName: string,
    streamId: string | undefined,
    streamName: string | undefined,
    sectionId: string,
    sectionName: string,
    subject: { id: string; name: string; code?: string },
    assignment: TeacherAssignment
  ) => {
    const res = resolveAssignmentDetails(assignment)
    setDirectModal({
      isOpen: true,
      mode: "UPDATE_SUBJECT",
      gradeId,
      gradeName,
      streamId,
      streamName,
      sectionId,
      sectionName,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
      assignmentId: assignment.id,
      currentTeacherId: res.teacherId,
      currentTeacherName: res.teacherName,
      currentTeacherPhoto: res.teacherPhoto,
      currentTeacherEmail: res.teacherEmail,
    })
    setModalSelectedTeacher(res.teacherId)
    setModalTeacherSearch("")
  }

  // 3. Direct Assign Homeroom Teacher
  const handleOpenDirectAssignHomeroom = (
    gradeId: string,
    gradeName: string,
    streamId: string | undefined,
    streamName: string | undefined,
    sectionId: string,
    sectionName: string
  ) => {
    setDirectModal({
      isOpen: true,
      mode: "ASSIGN_HOMEROOM",
      gradeId,
      gradeName,
      streamId,
      streamName,
      sectionId,
      sectionName,
    })
    setModalSelectedTeacher("")
    setModalTeacherSearch("")
  }

  // 4. Direct Update Homeroom Teacher
  const handleOpenDirectUpdateHomeroom = (
    gradeId: string,
    gradeName: string,
    streamId: string | undefined,
    streamName: string | undefined,
    sectionId: string,
    sectionName: string,
    assignment: TeacherAssignment
  ) => {
    const res = resolveAssignmentDetails(assignment)
    setDirectModal({
      isOpen: true,
      mode: "UPDATE_HOMEROOM",
      gradeId,
      gradeName,
      streamId,
      streamName,
      sectionId,
      sectionName,
      assignmentId: assignment.id,
      currentTeacherId: res.teacherId,
      currentTeacherName: res.teacherName,
      currentTeacherPhoto: res.teacherPhoto,
      currentTeacherEmail: res.teacherEmail,
    })
    setModalSelectedTeacher(res.teacherId)
    setModalTeacherSearch("")
  }

  // Submit direct assignment or update
  const handleSaveDirectTeacher = async () => {
    if (!modalSelectedTeacher) {
      notifications.error("Selection Required", "Please select a teacher")
      return
    }

    try {
      setIsSavingDirect(true)
      const { mode, gradeId, sectionId, streamId, subjectId, assignmentId, subjectName } = directModal

      if (mode === "ASSIGN_SUBJECT") {
        await db.assignTeacherToClass(
          modalSelectedTeacher,
          "",
          undefined,
          gradeId,
          sectionId,
          streamId || undefined,
          "SUBJECT_TEACHER",
          subjectId || undefined
        )
        notifications.success("Teacher Assigned", `Assigned teacher to ${subjectName || "subject"}`)
      } else if (mode === "UPDATE_SUBJECT" && assignmentId) {
        await db.updateTeacherAssignment(assignmentId, {
          teacher_id: modalSelectedTeacher,
          gradeId,
          sectionId,
          streamId: streamId || null,
          subjectId: subjectId || null,
          role: "SUBJECT_TEACHER",
        })
        notifications.success("Teacher Updated", `Updated teacher assignment for ${subjectName || "subject"}`)
      } else if (mode === "ASSIGN_HOMEROOM") {
        await db.assignTeacherToClass(
          modalSelectedTeacher,
          "",
          undefined,
          gradeId,
          sectionId,
          streamId || undefined,
          "HOMEROOM_TEACHER"
        )
        notifications.success("Homeroom Assigned", "Assigned homeroom teacher successfully")
      } else if (mode === "UPDATE_HOMEROOM" && assignmentId) {
        await db.updateTeacherAssignment(assignmentId, {
          teacher_id: modalSelectedTeacher,
          gradeId,
          sectionId,
          streamId: streamId || null,
          role: "HOMEROOM_TEACHER",
        })
        notifications.success("Homeroom Updated", "Updated homeroom teacher successfully")
      }

      setDirectModal((prev) => ({ ...prev, isOpen: false }))
      loadAllData(schoolId, true, true)
    } catch (error: any) {
      notifications.error("Action Failed", error.message || "Failed to save teacher assignment")
    } finally {
      setIsSavingDirect(false)
    }
  }

  // Remove assignment
  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!window.confirm("Are you sure you want to remove this teacher assignment?")) return
    try {
      setDeletingId(assignmentId)
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      await db.removeTeacherAssignment(assignmentId)
      notifications.success("Removed", "Teacher assignment removed.")
      loadAllData(schoolId, true, true)
    } catch (error: any) {
      notifications.error("Removal Failed", error.message || "Failed to remove assignment")
      loadAllData(schoolId, true, true)
    } finally {
      setDeletingId(null)
    }
  }

  // Filter teachers for modal
  const filteredModalTeachers = useMemo(() => {
    if (!modalTeacherSearch.trim()) return teachers
    const q = modalTeacherSearch.toLowerCase().trim()
    return teachers.filter((t) => {
      const name = (t.full_name || (t as any).name || "").toLowerCase()
      const email = (t.email || "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [teachers, modalTeacherSearch])

  // ─── Build the Display Hierarchy ──────────────────────────────────────────
  // Grade Heading (simple) → Sections as separate, independent clickable cards beneath
  interface AcademicGroup {
    heading: string
    grade: any
    stream: any | null
    isGrade11or12: boolean
    sections: any[]
  }

  const academicGroups = useMemo<AcademicGroup[]>(() => {
    const allGradeMap = new Map<string, any>()
    availableGrades.forEach((g) => allGradeMap.set(g.id, g))
    assignments.forEach((a) => {
      const res = resolveAssignmentDetails(a)
      if (res.gradeId && !allGradeMap.has(res.gradeId)) {
        allGradeMap.set(res.gradeId, { id: res.gradeId, name: res.gradeName || "Unknown Grade" })
      }
    })

    let gradeList = Array.from(allGradeMap.values()).sort(sortGradesNaturally)
    if (filterGrade !== "ALL") {
      gradeList = gradeList.filter((g) => g.id === filterGrade)
    }

    const groups: AcademicGroup[] = []

    gradeList.forEach((grade) => {
      const is11or12 = isGrade11or12Name(grade.name)

      if (is11or12) {
        // Grades 11–12: Headings with streams, e.g. "Grade 11 Natural Science"
        let streamList = [...availableStreams]
        if (filterStream !== "ALL") {
          streamList = streamList.filter((s) => s.id === filterStream)
        }

        streamList.forEach((stream) => {
          let sections = availableSections.filter((s: any) => s.gradeId === grade.id && s.streamId === stream.id)
          assignments.forEach((a) => {
            const res = resolveAssignmentDetails(a)
            if (res.gradeId === grade.id && res.streamId === stream.id && res.sectionId) {
              if (!sections.some((s: any) => s.id === res.sectionId)) {
                sections.push({
                  id: res.sectionId,
                  name: res.sectionName || "Section",
                  gradeId: grade.id,
                  streamId: stream.id,
                })
              }
            }
          })

          sections.sort(sortSectionsNaturally)

          groups.push({
            heading: `${formatGradeLabel(grade.name)} ${stream.name}`,
            grade,
            stream,
            isGrade11or12: true,
            sections,
          })
        })

        // Also check if there are sections without streamId in Grade 11/12
        if (filterStream === "ALL") {
          let nonStreamSections = availableSections.filter((s: any) => s.gradeId === grade.id && !s.streamId)
          if (nonStreamSections.length > 0) {
            groups.push({
              heading: formatGradeLabel(grade.name),
              grade,
              stream: null,
              isGrade11or12: true,
              sections: nonStreamSections.sort(sortSectionsNaturally),
            })
          }
        }
      } else {
        // Grades 1–10: Simple heading, e.g. "Grade 10"
        let sections = availableSections.filter((s: any) => s.gradeId === grade.id)
        assignments.forEach((a) => {
          const res = resolveAssignmentDetails(a)
          if (res.gradeId === grade.id && res.sectionId) {
            if (!sections.some((s: any) => s.id === res.sectionId)) {
              sections.push({
                id: res.sectionId,
                name: res.sectionName || "Section",
                gradeId: grade.id,
                streamId: null,
              })
            }
          }
        })

        sections.sort(sortSectionsNaturally)

        groups.push({
          heading: formatGradeLabel(grade.name),
          grade,
          stream: null,
          isGrade11or12: false,
          sections,
        })
      }
    })

    return groups
  }, [
    availableGrades,
    assignments,
    filterGrade,
    availableStreams,
    filterStream,
    availableSections,
    resolveAssignmentDetails,
  ])

  // Filter groups by text search
  const filteredGroups = useMemo(() => {
    if (!filterTeacherOrSection.trim()) return academicGroups
    const q = filterTeacherOrSection.toLowerCase().trim()

    return academicGroups
      .map((group) => {
        const matchesHeading = group.heading.toLowerCase().includes(q)
        const matchingSections = group.sections.filter((section) => {
          if (matchesHeading) return true
          if (section.name.toLowerCase().includes(q)) return true

          if (activeTab === "HOMEROOM") {
            const hmAssignment = assignments.find((a) => {
              if (a.role !== "HOMEROOM_TEACHER") return false
              const res = resolveAssignmentDetails(a)
              return res.gradeId === group.grade.id && res.sectionId === section.id
            })
            if (hmAssignment) {
              const res = resolveAssignmentDetails(hmAssignment)
              return res.teacherName.toLowerCase().includes(q) || res.teacherEmail.toLowerCase().includes(q)
            }
            return false
          } else {
            const subjects = getSubjectsForSection(group.grade.id, group.stream?.id, section.id)
            return subjects.some((subj) => {
              if (subj.name.toLowerCase().includes(q) || (subj.code && subj.code.toLowerCase().includes(q))) return true
              const assign = assignments.find((a) => {
                if (a.role !== "SUBJECT_TEACHER") return false
                const res = resolveAssignmentDetails(a)
                return (
                  res.gradeId === group.grade.id &&
                  res.sectionId === section.id &&
                  (!group.stream?.id || !res.streamId || res.streamId === group.stream.id) &&
                  (res.subjectId === subj.id || res.subjectName.toLowerCase() === subj.name.toLowerCase())
                )
              })
              if (assign) {
                const res = resolveAssignmentDetails(assign)
                return res.teacherName.toLowerCase().includes(q) || res.teacherEmail.toLowerCase().includes(q)
              }
              return false
            })
          }
        })

        return { ...group, sections: matchingSections }
      })
      .filter((group) => group.sections.length > 0)
  }, [academicGroups, filterTeacherOrSection, activeTab, assignments, resolveAssignmentDetails, getSubjectsForSection])

  const isFilterActive = filterTeacherOrSection.trim() !== "" || filterGrade !== "ALL" || filterStream !== "ALL"

  const clearAllFilters = () => {
    setFilterTeacherOrSection("")
    setFilterGrade("ALL")
    setFilterStream("ALL")
  }

  const selectedFilterGradeObj = useMemo(() => {
    if (filterGrade === "ALL") return null
    return availableGrades.find((g) => g.id === filterGrade)
  }, [availableGrades, filterGrade])

  const showFilterStream = !selectedFilterGradeObj || isGrade11or12Name(selectedFilterGradeObj.name)

  if (isLoading) return <PageSkeleton variant="cards" />

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW B: DEDICATED FULL-SCREEN SUBJECT LIST SCREEN FOR SELECTED SECTION
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedSectionView) {
    const { gradeId, gradeName, streamId, streamName, sectionId, sectionName } = selectedSectionView
    const allSubjects = getSubjectsForSection(gradeId, streamId, sectionId)

    // Filter subjects by section search
    const displayedSubjects = sectionSubjectSearch.trim()
      ? allSubjects.filter((subj) => {
          const q = sectionSubjectSearch.toLowerCase().trim()
          if (subj.name.toLowerCase().includes(q) || (subj.code && subj.code.toLowerCase().includes(q))) return true
          const assignment = assignments.find((a) => {
            if (a.role !== "SUBJECT_TEACHER") return false
            const res = resolveAssignmentDetails(a)
            return (
              res.gradeId === gradeId &&
              res.sectionId === sectionId &&
              (!streamId || !res.streamId || res.streamId === streamId) &&
              (res.subjectId === subj.id || res.subjectName.toLowerCase() === subj.name.toLowerCase())
            )
          })
          if (assignment) {
            const res = resolveAssignmentDetails(assignment)
            return res.teacherName.toLowerCase().includes(q) || res.teacherEmail.toLowerCase().includes(q)
          }
          return false
        })
      : allSubjects

    const assignedCount = allSubjects.filter((subj) => {
      return assignments.some((a) => {
        if (a.role !== "SUBJECT_TEACHER") return false
        const res = resolveAssignmentDetails(a)
        return (
          res.gradeId === gradeId &&
          res.sectionId === sectionId &&
          (!streamId || !res.streamId || res.streamId === streamId) &&
          (res.subjectId === subj.id || res.subjectName.toLowerCase() === subj.name.toLowerCase())
        )
      })
    }).length

    return (
      <div className="space-y-6 pb-12 max-w-7xl mx-auto w-full animate-in fade-in-50 duration-200">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSectionView(null)}
              className="px-2.5 h-8 -ml-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Grades &amp; Sections</span>
            </Button>

            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatGradeLabel(gradeName)} {streamName ? `– ${streamName}` : ""} – {formatSectionLabel(sectionName)}
              </h1>
              <Badge
                className={cn(
                  "text-xs font-bold py-0.5 px-2.5 rounded-lg border-0",
                  assignedCount === allSubjects.length && allSubjects.length > 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                )}
              >
                {assignedCount} / {allSubjects.length} Subjects Assigned
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage teacher allocations directly for each subject in this section.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => loadAllData(schoolId, false, true)}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Sync
            </Button>
          </div>
        </div>

        {/* Search Bar for this Section's Subjects */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={sectionSubjectSearch}
            onChange={(e) => setSectionSubjectSearch(e.target.value)}
            placeholder="Search subject or assigned teacher in this section..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
          />
          {sectionSubjectSearch && (
            <button
              type="button"
              onClick={() => setSectionSubjectSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dedicated Subject Cards Grid */}
        {displayedSubjects.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {sectionSubjectSearch ? "No subjects match your search" : "No subjects configured for this class"}
            </p>
            {sectionSubjectSearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSectionSubjectSearch("")}
                className="mt-3 rounded-xl text-xs font-bold"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedSubjects.map((subj) => {
              // Find assignment for this specific subject in this section
              const assignment = assignments.find((a) => {
                if (a.role !== "SUBJECT_TEACHER") return false
                const res = resolveAssignmentDetails(a)
                return (
                  res.gradeId === gradeId &&
                  res.sectionId === sectionId &&
                  (!streamId || !res.streamId || res.streamId === streamId) &&
                  (res.subjectId === subj.id || res.subjectName.toLowerCase() === subj.name.toLowerCase())
                )
              })

              const res = assignment ? resolveAssignmentDetails(assignment) : null
              const isAssigned = Boolean(assignment && res?.teacherId && res.teacherName !== "Not Assigned")

              return (
                <div
                  key={subj.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-xs",
                    isAssigned
                      ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-900"
                      : "bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  {/* Top: Subject Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <h5 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                          {subj.name}
                        </h5>
                      </div>
                      {subj.code && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                          {subj.code}
                        </span>
                      )}
                    </div>

                    {isAssigned ? (
                      <Badge className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold py-0.5 px-2 rounded-lg shrink-0">
                        Assigned
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-[10px] font-bold py-0.5 px-2 rounded-lg shrink-0"
                      >
                        Not Assigned
                      </Badge>
                    )}
                  </div>

                  {/* Middle: Assigned Teacher Info & Profile Photo */}
                  <div className="flex items-center gap-3 py-1 min-h-[48px]">
                    {isAssigned && res ? (
                      <>
                        {res.teacherPhoto ? (
                          <img
                            src={res.teacherPhoto}
                            alt={res.teacherName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm"
                          />
                        ) : (
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-black shadow-inner shrink-0",
                              getAvatarGradient(res.teacherId)
                            )}
                          >
                            {getInitials(res.teacherName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Assigned Teacher
                          </p>
                          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                            {res.teacherName}
                          </p>
                          {res.teacherEmail && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              {res.teacherEmail}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                          <Users className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Assigned Teacher
                          </p>
                          <p className="text-xs font-semibold text-slate-400 italic">
                            Not Assigned
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Bottom: Direct Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
                    {isAssigned && assignment ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleOpenDirectUpdateSubject(
                              gradeId,
                              gradeName,
                              streamId,
                              streamName,
                              sectionId,
                              sectionName,
                              subj,
                              assignment
                            )
                          }
                          className="flex-1 h-8 rounded-xl text-xs font-bold border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        >
                          <Pencil className="w-3 h-3 mr-1.5" />
                          Update Teacher
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          disabled={deletingId === assignment.id}
                          className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Remove assignment"
                        >
                          {deletingId === assignment.id ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleOpenDirectAssignSubject(
                            gradeId,
                            gradeName,
                            streamId,
                            streamName,
                            sectionId,
                            sectionName,
                            subj
                          )
                        }
                        className="w-full h-8 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Assign Teacher
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Direct Modal */}
        {renderDirectModal()}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW A: MAIN GRADE HEADINGS + SECTIONS AS SEPARATE INDEPENDENT CARDS
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto w-full">
      {/* ─── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Academic Structure</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Teacher Assignment
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select a class section below to view and manage its teacher assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            onClick={() => loadAllData(schoolId, false, true)}
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Sync
          </Button>
        </div>
      </div>

      {/* ─── Main Tabs: Home Room & Subject ──────────────────────────────────── */}
      <div className="bg-slate-100/90 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex gap-2">
        <button
          type="button"
          onClick={() => handleTabChange("HOMEROOM")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all",
            activeTab === "HOMEROOM"
              ? "bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 shadow-md border border-violet-200/60 dark:border-violet-900/60"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40"
          )}
        >
          <Home className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span>Home Room</span>
          <span
            className={cn(
              "text-[11px] font-black px-2 py-0.5 rounded-full ml-1",
              activeTab === "HOMEROOM"
                ? "bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            )}
          >
            {homeroomTotalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("SUBJECT")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all",
            activeTab === "SUBJECT"
              ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-md border border-blue-200/60 dark:border-blue-900/60"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/40"
          )}
        >
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Subject</span>
          <span
            className={cn(
              "text-[11px] font-black px-2 py-0.5 rounded-full ml-1",
              activeTab === "SUBJECT"
                ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            )}
          >
            {subjectTotalCount}
          </span>
        </button>
      </div>

      {/* ─── Search & Filters Bar (No expand/collapse!) ───────────────────────── */}
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-sm overflow-hidden">
        <CardContent className="p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Search by teacher or section */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterTeacherOrSection}
                onChange={(e) => setFilterTeacherOrSection(e.target.value)}
                placeholder="Search teacher, section, or subject..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              />
              {filterTeacherOrSection && (
                <button
                  type="button"
                  onClick={() => setFilterTeacherOrSection("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Grade */}
            <div>
              <select
                value={filterGrade}
                onChange={(e) => {
                  setFilterGrade(e.target.value)
                  if (e.target.value !== "ALL") {
                    const grp = availableGrades.find((g) => g.id === e.target.value)
                    if (grp && !isGrade11or12Name(grp.name)) {
                      setFilterStream("ALL")
                    }
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Grades</option>
                {availableGrades.slice().sort(sortGradesNaturally).map((g) => (
                  <option key={g.id} value={g.id}>
                    {formatGradeLabel(g.name)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Stream */}
            {showFilterStream ? (
              <div>
                <select
                  value={filterStream}
                  onChange={(e) => setFilterStream(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ALL">All Streams (Grades 11 &amp; 12)</option>
                  {availableStreams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} Stream
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-400 flex items-center font-medium">
                Standard Track (Grades 1–10)
              </div>
            )}
          </div>

          {isFilterActive && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">
                Filters active ({filteredGroups.reduce((acc, g) => acc + g.sections.length, 0)} sections found)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 px-2 text-[11px] font-bold text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-3 h-3 mr-1" />
                Reset Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Grades as Headings + Sections as Independent Clickable Cards ─────── */}
      {filteredGroups.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isFilterActive ? "No classes match your search/filters" : "No classes or sections configured yet"}
          </p>
          {isFilterActive && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4 rounded-xl text-xs font-bold">
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredGroups.map((group, groupIdx) => (
            <div key={`${group.grade.id}-${group.stream?.id || "none"}-${groupIdx}`} className="space-y-3.5">
              {/* 2. Grades as Headings (e.g. Grade 10, Grade 11 Natural Science) - NOT A CARD! */}
              <div className="flex items-center gap-2.5 pb-1">
                <div className="w-2 h-5 rounded-full bg-blue-600 dark:bg-blue-400" />
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {group.heading}
                </h3>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold rounded-lg border-slate-200 dark:border-slate-800 text-slate-500"
                >
                  {group.sections.length} {group.sections.length === 1 ? "Section" : "Sections"}
                </Badge>
              </div>

              {/* 3. Sections as separate, independent clickable cards beneath */}
              {group.sections.length === 0 ? (
                <div className="py-4 px-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  No sections configured under {group.heading}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.sections.map((section) => {
                    // IF HOMEROOM TAB:
                    if (activeTab === "HOMEROOM") {
                      const hmAssignment = assignments.find((a) => {
                        if (a.role !== "HOMEROOM_TEACHER") return false
                        const res = resolveAssignmentDetails(a)
                        const isGradeMatch = res.gradeId === group.grade.id ||
                          (Boolean(res.gradeName && group.grade.name) && res.gradeName.toLowerCase() === group.grade.name.toLowerCase())
                        const isSectionMatch = res.sectionId === section.id ||
                          (Boolean(res.sectionName && section.name) && res.sectionName.toLowerCase() === section.name.toLowerCase())
                        const isStreamMatch = !group.stream?.id || !res.streamId || res.streamId === group.stream.id ||
                          (Boolean(res.streamName && group.stream.name) && res.streamName.toLowerCase() === group.stream.name.toLowerCase())
                        return isGradeMatch && isSectionMatch && isStreamMatch
                      })

                      const res = hmAssignment ? resolveAssignmentDetails(hmAssignment) : null
                      const isAssigned = Boolean(hmAssignment && res?.teacherId && res.teacherName !== "Not Assigned")

                      return (
                        <div
                          key={section.id}
                          className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300 flex items-center justify-center font-black text-xs shrink-0">
                                {section.name ? section.name.replace(/^section\s+/i, '').trim().slice(0, 2).toUpperCase() : <Home className="w-4 h-4" />}
                              </div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                {formatSectionLabel(section.name)}
                              </h4>
                            </div>

                            {isAssigned ? (
                              <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 text-[9px] font-bold py-0.5 px-2 rounded-md border-0 shrink-0">
                                Assigned
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[9px] font-semibold py-0.5 px-1.5 rounded-md shrink-0"
                              >
                                Vacant
                              </Badge>
                            )}
                          </div>

                          {/* Homeroom Teacher Details */}
                          <div className="py-1 min-h-[44px] flex items-center gap-2.5">
                            {isAssigned && res ? (
                              <>
                                {res.teacherPhoto ? (
                                  <img
                                    src={res.teacherPhoto}
                                    alt={res.teacherName}
                                    className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                  />
                                ) : (
                                  <div
                                    className={cn(
                                      "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-black shrink-0",
                                      getAvatarGradient(res.teacherId)
                                    )}
                                  >
                                    {getInitials(res.teacherName)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                                    {res.teacherName}
                                  </p>
                                  {res.teacherEmail && (
                                    <p className="text-[10px] text-slate-400 truncate">{res.teacherEmail}</p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-slate-400 italic">No homeroom teacher assigned</p>
                            )}
                          </div>

                          {/* Homeroom Action */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
                            {isAssigned && hmAssignment ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleOpenDirectUpdateHomeroom(
                                      group.grade.id,
                                      group.grade.name,
                                      group.stream?.id,
                                      group.stream?.name,
                                      section.id,
                                      section.name,
                                      hmAssignment
                                    )
                                  }
                                  className="flex-1 h-8 rounded-xl text-xs font-bold border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                                >
                                  <Pencil className="w-3 h-3 mr-1" />
                                  Update
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment(hmAssignment.id)}
                                  disabled={deletingId === hmAssignment.id}
                                  className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  title="Remove homeroom teacher"
                                >
                                  {deletingId === hmAssignment.id ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleOpenDirectAssignHomeroom(
                                    group.grade.id,
                                    group.grade.name,
                                    group.stream?.id,
                                    group.stream?.name,
                                    section.id,
                                    section.name
                                  )
                                }
                                className="w-full h-8 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Assign Homeroom
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // IF SUBJECT TAB:
                    // Separate, independent clickable card!
                    // Clicking this section card opens the dedicated full-screen subject list screen!
                    const subjects = getSubjectsForSection(group.grade.id, group.stream?.id, section.id)
                    const assignedCount = subjects.filter((subj) => {
                      return assignments.some((a) => {
                        if (a.role !== "SUBJECT_TEACHER") return false
                        const res = resolveAssignmentDetails(a)
                        return (
                          res.gradeId === group.grade.id &&
                          res.sectionId === section.id &&
                          (!group.stream?.id || !res.streamId || res.streamId === group.stream.id) &&
                          (res.subjectId === subj.id || res.subjectName.toLowerCase() === subj.name.toLowerCase())
                        )
                      })
                    }).length

                    const isFullyAssigned = assignedCount === subjects.length && subjects.length > 0

                    return (
                      <div
                        key={section.id}
                        role="button"
                        onClick={() =>
                          setSelectedSectionView({
                            gradeId: group.grade.id,
                            gradeName: group.grade.name,
                            streamId: group.stream?.id,
                            streamName: group.stream?.name,
                            sectionId: section.id,
                            sectionName: section.name,
                          })
                        }
                        className="group p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between gap-3 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs shrink-0 group-hover:scale-105 transition-transform">
                              {section.name.trim().slice(0, 2).toUpperCase()}
                            </div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap">
                              {formatSectionLabel(section.name)}
                            </h4>
                          </div>

                          <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 group-hover:text-blue-600 transition-colors shrink-0">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Subjects Allocation</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {assignedCount} / {subjects.length}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isFullyAssigned ? "bg-emerald-500" : "bg-blue-600"
                              )}
                              style={{
                                width: `${subjects.length > 0 ? (assignedCount / subjects.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          <span>View Subjects</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Direct Modal */}
      {renderDirectModal()}
    </div>
  )

  // ─── Direct Teacher Selection Dialog Helper ────────────────────────────────
  function renderDirectModal() {
    return (
      <Dialog
        open={directModal.isOpen}
        onOpenChange={(open) => {
          if (!open) setDirectModal((prev) => ({ ...prev, isOpen: false }))
        }}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 dark:text-white">
                  {directModal.mode === "ASSIGN_SUBJECT" && "Assign Subject Teacher"}
                  {directModal.mode === "UPDATE_SUBJECT" && "Update Subject Teacher"}
                  {directModal.mode === "ASSIGN_HOMEROOM" && "Assign Homeroom Teacher"}
                  {directModal.mode === "UPDATE_HOMEROOM" && "Update Homeroom Teacher"}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select teacher to assign directly to this class.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* Academic Context Badges (Pre-locked context) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Academic Context
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="font-bold text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  {formatGradeLabel(directModal.gradeName)}
                </Badge>
                {directModal.streamName && (
                  <Badge variant="outline" className="font-bold text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                    {directModal.streamName} Stream
                  </Badge>
                )}
                <Badge variant="outline" className="font-bold text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  {formatSectionLabel(directModal.sectionName)}
                </Badge>
                {directModal.subjectName && (
                  <Badge className="font-bold text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-0">
                    {directModal.subjectName}
                  </Badge>
                )}
              </div>
            </div>

            {/* If Updating: Show Current Teacher */}
            {(directModal.mode === "UPDATE_SUBJECT" || directModal.mode === "UPDATE_HOMEROOM") &&
              directModal.currentTeacherName && (
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                      Currently Assigned
                    </span>
                    <span className="font-black text-slate-800 dark:text-slate-100 truncate block">
                      {directModal.currentTeacherName}
                    </span>
                    {directModal.currentTeacherEmail && (
                      <span className="text-[11px] text-slate-400 truncate block">
                        {directModal.currentTeacherEmail}
                      </span>
                    )}
                  </div>
                </div>
              )}

            {/* Teacher Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {directModal.mode.startsWith("UPDATE") ? "Select Replacement Teacher" : "Select Teacher"}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalTeacherSearch}
                  onChange={(e) => setModalTeacherSearch(e.target.value)}
                  placeholder="Filter teachers by name or email..."
                  autoFocus
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
                {modalTeacherSearch && (
                  <button
                    type="button"
                    onClick={() => setModalTeacherSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Teachers List */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 border border-slate-100 dark:border-slate-800 rounded-2xl p-1.5">
              {filteredModalTeachers.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No teachers found matching "{modalTeacherSearch}"
                </div>
              ) : (
                filteredModalTeachers.map((t) => {
                  const isSelected = modalSelectedTeacher === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setModalSelectedTeacher(t.id)}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 text-xs transition-colors",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {t.profile_photo ? (
                          <img
                            src={t.profile_photo}
                            alt={t.full_name}
                            className="w-8 h-8 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-black shrink-0",
                              getAvatarGradient(t.id)
                            )}
                          >
                            {getInitials(t.full_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{t.full_name}</p>
                          {t.email && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              {t.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDirectModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={isSavingDirect}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDirectTeacher}
              disabled={!modalSelectedTeacher || isSavingDirect}
              className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isSavingDirect ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : directModal.mode.startsWith("UPDATE") ? (
                "Update Teacher"
              ) : (
                "Assign Teacher"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
