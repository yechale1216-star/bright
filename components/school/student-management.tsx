"use client"

import { isGrade11or12Grade } from "@/components/school/grade-stream-section-selector";
import type React from "react"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Trash2, Edit, Plus, Search, Upload, Download, AlertCircle, Users, CheckCircle2, Clock, ShieldCheck, Eye, EyeOff, X, Calendar, Mail, Phone, GraduationCap, UploadCloud, RefreshCw, ChevronLeft, ChevronRight, XCircle, KeyRound, Printer, Copy, Check } from "lucide-react"
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/utils/password-validator"
import { db, type Student } from "@/lib/db/database"
import { StudentImportPreview } from "./student-import-preview"
import { ChangeStatusModal, StatusHistoryModal, ReEnrollModal } from "./student-status-modals"
import { motion, AnimatePresence } from "framer-motion"
import { notifications } from "@/lib/utils/notifications"
import { ValidationService } from "@/lib/utils/validation"
import { authService } from "@/lib/auth/auth"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Spinner } from "@/components/ui/spinner"
import { DataStateView } from "@/components/ui/data-state-view"
import { MobileCard, MobileCardList } from "@/components/ui/mobile-card"
import { NativeBridge } from "@/lib/utils/native-bridge"
import { Camera, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils/utils"
import { DisciplineApi, StudentDiscipline } from "@/lib/discipline-service"
import { useCalendar } from "@/lib/context/calendar-context"

import { PhoneInput } from "@/components/ui/phone-input"
import { useAcademicYear } from "@/lib/context/academic-year-context"
import { History } from "lucide-react"

export function StudentManagement() {
  const { formatDate } = useCalendar()
  const { activeAcademicYear, viewingAcademicYear, allAcademicYears, isHistoricalMode } = useAcademicYear()
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("")

  useEffect(() => {
    if (activeAcademicYear?.name && !selectedAcademicYear) {
      setSelectedAcademicYear(activeAcademicYear.name)
    }
  }, [activeAcademicYear?.name])
  const [students, setStudents] = useState<Student[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [gradeFilter, setGradeFilter] = useState("All Grades")
  const [streamFilter, setStreamFilter] = useState("All Streams")
  const [sectionFilter, setSectionFilter] = useState("All Sections")
  const [statusFilter, setStatusFilter] = useState("ACTIVE")
  const [statusModalStudent, setStatusModalStudent] = useState<Student | null>(null)
  const [historyModalStudent, setHistoryModalStudent] = useState<Student | null>(null)
  const [reEnrollModalStudent, setReEnrollModalStudent] = useState<Student | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentDisciplines, setStudentDisciplines] = useState<StudentDiscipline[]>([])
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false)

  useEffect(() => {
    if (selectedStudent?.id) {
      setIsLoadingDisciplines(true);
      DisciplineApi.getIncidents({ studentId: selectedStudent.id, limit: 20 })
        .then((res) => setStudentDisciplines(res.items || []))
        .catch((err) => console.error('Error fetching student disciplines:', err))
        .finally(() => setIsLoadingDisciplines(false));
    } else {
      setStudentDisciplines([]);
    }
  }, [selectedStudent]);
  const [showSuccess, setShowSuccess] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importPreviewData, setImportPreviewData] = useState<any[] | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)
  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<
    Array<{ grade: string; section: string; stream?: string }>
  >([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [registrationConfirmation, setRegistrationConfirmation] = useState<any>(null)
  const [showConfirmationPassword, setShowConfirmationPassword] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false)

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key)
        setTimeout(() => setCopiedKey(null), 2000)
      })
    }
  }

  const handleRegenerateCode = async (studentId: string) => {
    setIsRegeneratingCode(true)
    try {
      const slip = await db.generateStudentActivationCode(studentId)
      notifications.success("Activation Code Regenerated", `New activation code: ${slip.activationCode}`)
      if (selectedStudent && selectedStudent.id === studentId) {
        setSelectedStudent({
          ...selectedStudent,
          activation_code: slip.activationCode,
          activation_code_expires: slip.expiresAt,
          accountStatus: 'PENDING_ACTIVATION',
        })
      }
      await loadStudents(false, true)
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to regenerate activation code")
    } finally {
      setIsRegeneratingCode(false)
    }
  }

  const printActivationSlip = (slip: { student_id: string; fullName?: string; name?: string; grade?: string; section?: string; activationCode: string; initialPassword?: string; expiresAt?: string | Date }) => {
    const win = window.open("", "_blank")
    if (!win) return
    const sName = slip.fullName || slip.name || "Student"
    const expiryStr = slip.expiresAt
      ? new Date(slip.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "30 days"

    win.document.write(`
      <html>
        <head>
          <title>Activation Slip - ${slip.student_id}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { background: #f8fafc; padding: 32px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .slip { background: white; border: 2px dashed #9333ea; border-radius: 20px; padding: 28px; max-width: 460px; width: 100%; box-shadow: 0 10px 25px -5px rgba(147, 51, 234, 0.1); }
            .slip-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1.5px solid #f3e8ff; padding-bottom: 16px; }
            .slip-brand { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #7e22ce; }
            .slip-name { font-size: 18px; font-weight: 900; color: #0f172a; margin: 6px 0 2px; }
            .slip-meta { font-size: 12px; color: #64748b; font-weight: 600; }
            .slip-expires { font-size: 10px; color: #64748b; text-align: right; background: #fdf4ff; padding: 6px 10px; border-radius: 8px; border: 1px solid #fae8ff; }
            .code-box { background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 2px solid #d8b4fe; border-radius: 16px; padding: 18px; text-align: center; margin: 18px 0; }
            .code-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #7e22ce; font-weight: 800; margin-bottom: 6px; }
            .code { font-size: 30px; font-weight: 900; letter-spacing: 0.3em; color: #581c87; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; }
            .info-row { display: flex; justify-content: space-between; align-items: center; }
            .info-label { color: #64748b; font-weight: 500; }
            .info-value { font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace; background: white; padding: 2px 8px; border-radius: 6px; border: 1px solid #cbd5e1; }
            .steps-box { background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 12px; padding: 14px; font-size: 11px; color: #475569; line-height: 1.6; }
            .steps-title { font-weight: 800; color: #7e22ce; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .steps-box ol { padding-left: 18px; margin: 0; }
            .steps-box li { margin-bottom: 2px; }
            .steps-box strong { color: #581c87; }
            @media print {
              body { background: white; padding: 0; }
              .slip { box-shadow: none; max-width: 100%; border-width: 2px; }
            }
          </style>
        </head>
        <body>
          <div class="slip">
            <div class="slip-header">
              <div>
                <div class="slip-brand">Bright Path · Student Portal</div>
                <div class="slip-name">${sName}</div>
                <div class="slip-meta">${slip.student_id} · Grade ${slip.grade || "—"} - Section ${slip.section || "—"}</div>
              </div>
              <div class="slip-expires">
                <div style="font-weight: 700; color: #7e22ce;">Expires</div>
                <div>${expiryStr}</div>
              </div>
            </div>
            <div class="code-box">
              <div class="code-label">One-Time Activation Code</div>
              <div class="code">${slip.activationCode}</div>
            <div class="steps-box">
              <div class="steps-title">Activation Instructions:</div>
              <ol>
                <li>Visit <strong>brightpath.edu.et/student/activate</strong></li>
                <li>Enter Student ID: <strong>${slip.student_id}</strong> and the Activation Code above</li>
                <li>Set your personal permanent password to complete portal activation</li>
              </ol>
            </div>
          </div>
        </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print(); win.close(); }, 350)
  }

  // Form state
  const [academicGrades, setAcademicGrades] = useState<any[]>([]);
  const [academicSections, setAcademicSections] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      db.getGrades().catch(() => []),
      db.getSections().catch(() => []),
    ]).then(([gList, sList]) => {
      setAcademicGrades(gList || []);
      setAcademicSections(sList || []);
    });
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    student_id: "",
    grade: "",
    stream: "",
    section: "",
    parent_email: "",
    parent_phone: "+251",
    parent_name: "",
    parent_password: "",
    parent_address: "",
    relationshipType: "Guardian",
    existingParentId: "", // Added existingParentId
    gender: "",
    date_of_birth: "",
    address: "",
  })

const isFormGrade11or12 = isGrade11or12Grade(formData.grade);

  const availableSectionsForStudentForm = useMemo(() => {
    if (!formData.grade) return [];
    const is11or12 = isGrade11or12Grade(formData.grade);
    const gObj = academicGrades.find(
      (g) => g.name.toLowerCase() === formData.grade.toLowerCase()
    );
    const gId = gObj?.id;

    const matchingFromDb = academicSections.filter((s: any) => {
      const matchGrade =
        (s.gradeId && gId && s.gradeId === gId) ||
        (s.grade?.name && s.grade.name.toLowerCase() === formData.grade.toLowerCase());
      if (!matchGrade) return false;
      if (is11or12) {
        if (!formData.stream) return false;
        const streamLower = formData.stream.toLowerCase();
        return (
          (s.stream?.name && s.stream.name.toLowerCase().includes(streamLower)) ||
          s.streamId === formData.stream
        );
      }
      return true;
    });

    if (matchingFromDb.length > 0) {
      return [...new Set(matchingFromDb.map((s: any) => s.name))];
    }

    // Fallback to sections discovered in students matching this grade/stream
    const fromStudents = students
      .filter((s) => {
        const gMatch = s.grade?.toLowerCase() === formData.grade.toLowerCase();
        if (!gMatch) return false;
        if (is11or12) {
          return s.stream?.toLowerCase() === formData.stream.toLowerCase();
        }
        return true;
      })
      .map((s) => s.section)
      .filter((sec): sec is string => !!sec);

    return [...new Set(fromStudents)];
  }, [formData.grade, formData.stream, academicGrades, academicSections, students]);

  type ParentLookupState = 'idle' | 'searching' | 'found' | 'not_found' | 'error';
  const [parentLookupState, setParentLookupState] = useState<ParentLookupState>('idle')
  const [parentLookupError, setParentLookupError] = useState<string | null>(null)
  const [foundParent, setFoundParent] = useState<any>(null)
  const [linkExistingParent, setLinkExistingParent] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const searchSeqRef = useRef<number>(0)

  // Automatic Debounced Parent Lookup
  useEffect(() => {
    if (editingStudent) return; // Skip lookup in edit student mode
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const cleanPhone = formData.parent_phone.replace(/\s+/g, '');
    const isValidPhone = cleanPhone.length >= 10 && (cleanPhone.startsWith('+251') || cleanPhone.startsWith('09') || cleanPhone.startsWith('07') || cleanPhone.startsWith('9') || cleanPhone.startsWith('7'));

    if (isValidPhone) {
      setParentLookupState('searching');
      setParentLookupError(null);
      debounceTimerRef.current = setTimeout(() => {
        handleSearchParent(formData.parent_phone);
      }, 400);
    } else {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setParentLookupState('idle');
      setFoundParent(null);
      setLinkExistingParent(false);
      setParentLookupError(null);
      setFormData(prev => ({ ...prev, existingParentId: "" }));
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [formData.parent_phone, editingStudent]);

  useEffect(() => {
    const user = authService.getCurrentUser()
    setIsTeacher(user?.role === "teacher")
    loadStudents()
    fetchNextStudentId()

    const handleStudentChanged = () => {
      loadStudents(true, true)
    }

    window.addEventListener("studentDataChanged", handleStudentChanged)

    // Background polling for "instant" updates (every 15 seconds)
    const pollInterval = setInterval(() => {
      loadStudents(true, false)
    }, 15000)

    return () => {
      window.removeEventListener("studentDataChanged", handleStudentChanged)
      clearInterval(pollInterval)
    }
  }, [viewingAcademicYear?.name, activeAcademicYear?.name, selectedAcademicYear])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: students.length,
      ACTIVE: 0,
      SUSPENDED: 0,
      WITHDRAWN: 0,
      TRANSFERRED: 0,
      GRADUATED: 0,
      ARCHIVED: 0,
    }
    students.forEach((s) => {
      const st = (s.status || (s as any).enrollmentStatus || "ACTIVE").toUpperCase()
      if (st === "SUSPENDED" || st === "INACTIVE") {
        counts.SUSPENDED = (counts.SUSPENDED || 0) + 1
      } else if (counts[st] !== undefined) {
        counts[st] = (counts[st] || 0) + 1
      } else {
        counts.ACTIVE = (counts.ACTIVE || 0) + 1
      }
    })
    return counts
  }, [students])

  const filteredStudents = useMemo(() => {
    let filtered = students

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (student) =>
          student.name?.toLowerCase().includes(term) ||
          student.student_id?.toLowerCase().includes(term) ||
          student.grade?.toLowerCase().includes(term) ||
          student.stream?.toLowerCase().includes(term) ||
          student.section?.toLowerCase().includes(term),
      )
    }

    if (!isTeacher && statusFilter && statusFilter !== "All" && statusFilter !== "ALL") {
      const target = statusFilter.toUpperCase()
      filtered = filtered.filter((student) => {
        const studentStatus = (student.status || (student as any).enrollmentStatus || "ACTIVE").toUpperCase()
        if (target === "SUSPENDED") {
          return studentStatus === "SUSPENDED" || studentStatus === "INACTIVE"
        }
        return studentStatus === target
      })
    }

    if (!isTeacher && gradeFilter !== "All Grades") {
      filtered = filtered.filter((student) => student.grade?.toLowerCase() === gradeFilter.toLowerCase())
    }

    if (!isTeacher && streamFilter !== "All Streams") {
      filtered = filtered.filter((student) => student.stream?.toLowerCase() === streamFilter.toLowerCase())
    }

    if (!isTeacher && sectionFilter !== "All Sections") {
      filtered = filtered.filter((student) => student.section?.toLowerCase() === sectionFilter.toLowerCase())
    }

    return [...filtered].sort((a, b) => {
      const nameA = a.name || ""
      const nameB = b.name || ""
      return nameA.localeCompare(nameB)
    })
  }, [students, searchTerm, gradeFilter, streamFilter, sectionFilter, statusFilter, isTeacher])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, gradeFilter, streamFilter, sectionFilter, selectedAcademicYear, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize))
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredStudents.slice(start, start + pageSize)
  }, [filteredStudents, currentPage, pageSize])

  const loadStudents = async (isBackground = false, forceRefetch = false) => {
    if (!isBackground && students.length === 0) setIsLoading(true)
    try {
      const user = authService.getCurrentUser()
      const targetYearName = user?.role === "teacher"
        ? (activeAcademicYear?.name || "")
        : (selectedAcademicYear || viewingAcademicYear?.name || activeAcademicYear?.name || "")
      const studentsData = await db.getStudents(forceRefetch, "ALL", targetYearName)
      
      if (user?.role === "teacher") {
        // Fetch teacher's assigned classes
        const assignmentsData = await db.getTeacherAssignments(user.schoolId, user.teacherId || user.id)
        const classes = assignmentsData || []
        setTeacherAssignedClasses(classes as any)

        // Filter students based on teacher's assigned classes
        const filtered = studentsData.filter((student: Student) =>
          classes.some((cls) => {
            const studentGrade = student.grade?.replace("Grade ", "").trim() || ""
            const classGrade = String(cls.grade || cls.class?.grade || "").trim()
            const gradeMatch = studentGrade === classGrade
            const sectionMatch = (cls.section || cls.class?.section) === student.section
            const streamMatch = !cls.stream || cls.stream === student.stream

            return gradeMatch && sectionMatch && streamMatch
          }),
        )

        setStudents(filtered)
      } else {
        setStudents(studentsData)
      }
      setError(null)
    } catch (err: any) {
      console.error("Error loading students:", err)
      setError(err.message || "Failed to load students")
    } finally {
      setIsLoading(false)
    }
  }
 
  const fetchNextStudentId = async () => {
    try {
      const nextId = await db.getNextStudentId()
      if (nextId) {
        setFormData(prev => ({ ...prev, student_id: nextId }));
      } else {
        setFormData(prev => ({ ...prev, student_id: "Auto-Gen" }));
      }
    } catch (error) {
      console.error("Error fetching next student ID:", error);
      setFormData(prev => ({ ...prev, student_id: "Auto-Gen" }));
    }
  }

  const handleSearchParent = useCallback(async (phoneToSearch?: string) => {
    const targetPhone = (phoneToSearch !== undefined ? phoneToSearch : formData.parent_phone) || "";
    const cleanPhone = targetPhone.replace(/\s+/g, "");

    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log(`[ParentLookup] Aborted previous in-flight request for new search`);
    }

    if (cleanPhone.length < 10) {
      setParentLookupState('idle');
      setFoundParent(null);
      setLinkExistingParent(false);
      setParentLookupError(null);
      setFormData(prev => ({ ...prev, existingParentId: "" }));
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentSeq = ++searchSeqRef.current;

    console.log(`[ParentLookup] Starting lookup #${currentSeq} for phone: "${cleanPhone}"`);
    setParentLookupState('searching');
    setParentLookupError(null);

    try {
      const res = await authService.searchParentByPhone(cleanPhone, abortController.signal);

      // Ignore out-of-order responses or cancelled requests
      if (searchSeqRef.current !== currentSeq) {
        console.log(`[ParentLookup] Ignoring stale response #${currentSeq}`);
        return;
      }

      if (res.cancelled) {
        console.log(`[ParentLookup] Request #${currentSeq} was cancelled`);
        return;
      }

      if (res.success && res.data) {
        console.log(`[ParentLookup] Parent Found (#${currentSeq}): ${res.data.full_name || res.data.phone}`);
        setParentLookupState('found');
        setFoundParent(res.data);
        setLinkExistingParent(true);
        setParentLookupError(null);
        setFormData(prev => ({
          ...prev,
          parent_name: res.data.full_name || prev.parent_name,
          parent_email: res.data.email || prev.parent_email,
          parent_address: res.data.address || prev.parent_address,
          existingParentId: res.data.id || ""
        }));
      } else if (res.notFound) {
        console.log(`[ParentLookup] Parent Not Found (#${currentSeq})`);
        setParentLookupState('not_found');
        setFoundParent(null);
        setLinkExistingParent(false);
        setParentLookupError(null);
        setFormData(prev => ({ ...prev, existingParentId: "" }));
      } else if (res.error) {
        console.warn(`[ParentLookup] Search Failed (#${currentSeq}):`, res.message);
        setParentLookupState('error');
        setParentLookupError(res.message || "Unable to verify the parent account. Please check your connection and try again.");
        setFoundParent(null);
        setLinkExistingParent(false);
        setFormData(prev => ({ ...prev, existingParentId: "" }));
      }
    } catch (err: any) {
      if (searchSeqRef.current === currentSeq) {
        console.error(`[ParentLookup] Exception during search #${currentSeq}:`, err);
        setParentLookupState('error');
        setParentLookupError("Unable to verify the parent account. Please check your connection and try again.");
        setFoundParent(null);
        setLinkExistingParent(false);
        setFormData(prev => ({ ...prev, existingParentId: "" }));
      }
    }
  }, [formData.parent_phone]);

  const resetForm = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setFormData({
      name: "",
      student_id: "...", // Fetching...
      grade: "",
      stream: "",
      section: "",
      parent_email: "",
      parent_phone: "+251",
      parent_name: "",
      parent_password: "",
      parent_address: "",
      relationshipType: "Guardian",
      existingParentId: "",
      gender: "",
      date_of_birth: "",
      address: "",
    })
    fetchNextStudentId()
    setEditingStudent(null)
    setValidationErrors([])
    setFoundParent(null)
    setLinkExistingParent(false)
    setParentLookupState('idle')
    setParentLookupError(null)
  }

  const validateForm = () => {
    const existingStudentIds = students.map((s) => s.student_id || "")
    const currentStudentId = editingStudent?.student_id

    const nameValidation = ValidationService.validateName(formData.name)
    const studentIdValidation = ValidationService.validateStudentId(
      formData.student_id,
      existingStudentIds,
      currentStudentId,
    )
    const gradeValidation = ValidationService.validateRequired(formData.grade, "Grade")
    const sectionValidation = ValidationService.validateRequired(formData.section, "Section")

    // If linking an existing parent, skip parent field validation
    const isLinkingExisting = Boolean(formData.existingParentId)
    const parentEmailValidation = isLinkingExisting
      ? { isValid: true, errors: [] }
      : ValidationService.validateEmail(formData.parent_email, true)
    const parentPhoneValidation = isLinkingExisting
      ? { isValid: true, errors: [] }
      : ValidationService.validatePhone(formData.parent_phone)
    const parentNameValidation = isLinkingExisting
      ? { isValid: true, errors: [] }
      : ValidationService.validateName(formData.parent_name)

    const combinedResult = ValidationService.combineValidationResults(
      nameValidation,
      studentIdValidation,
      gradeValidation,
      sectionValidation,
      parentEmailValidation,
      parentPhoneValidation,
      parentNameValidation,
    )

    if (!editingStudent && parentLookupState === 'not_found') {
      if (!formData.parent_password) {
        notifications.error("Password Required", "Portal password is required for new parent accounts.")
        return false
      }
      const pv = validatePassword(formData.parent_password)
      if (!pv.isValid) {
        notifications.error("Password Requirements", pv.message)
        return false
      }
    }

    setValidationErrors(combinedResult.errors)
    return combinedResult.isValid
  }

  const handleTakePhoto = async () => {
    try {
      const photoPath = await NativeBridge.takePhoto()
      console.log('Mobile photo taken:', photoPath)
      notifications.success("Success", "Photo captured. In a production build, this would be uploaded to storage.")
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        notifications.error("Camera Error", error.message)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingStudent) {
      if (parentLookupState === 'searching') {
        notifications.warning("Lookup in Progress", "Please wait for parent account search to complete.");
        return;
      }
      if (parentLookupState === 'error') {
        notifications.error("Verification Required", "Unable to verify parent account connection. Please retry parent search before saving.");
        return;
      }
    }

    if (!validateForm()) {
      return
    }

    setIsSaving(true)

    try {
      if (editingStudent) {
        await db.updateStudent(editingStudent.id, formData)
        notifications.success("Student Updated Successfully", "The student information has been updated.")

        await loadStudents(false, true)
        setIsAddModalOpen(false)
        resetForm()
      } else {
        const result = await db.addStudent(formData)
        notifications.success("Student Enrolled Successfully", "Student account created with activation credentials.")

        await loadStudents(false, true)
        setIsAddModalOpen(false)
        resetForm()
        setRegistrationConfirmation(result)
      }
    } catch (error: any) {
      notifications.error("Error", error.message || "Failed to save student")

    } finally {
      setIsSaving(false)
    }
  }

  const handleGradeChange = (gradeValue: string) => {
    setFormData((prev) => ({
      ...prev,
      grade: gradeValue,
      stream: "",
      section: "",
    }));
  };

  const handleStreamChange = (streamValue: string) => {
    setFormData((prev) => ({
      ...prev,
      stream: streamValue,
      section: "",
    }));
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setFormData({
      name: student.name || "",
      student_id: student.student_id || "",
      grade: student.grade || "",
      stream: student.stream || "",
      section: student.section || "",
      parent_email: student.parent_email || "",
      parent_phone: student.parent_phone || "+251",
      parent_name: student.parent_name || "",
      parent_password: "",
      parent_address: student.parent_address || "",
      relationshipType: student.relationshipType || "Guardian",
      existingParentId: "",
      gender: student.gender || "",
      date_of_birth: student.date_of_birth || "",
      address: student.address || "",
    })
    setValidationErrors([])
    setFoundParent(null)
    setLinkExistingParent(false)
    setParentLookupState('idle')
    setParentLookupError(null)
    setIsAddModalOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, student: Student) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!student.id) {
      notifications.error("Error", "Student record is missing a valid identifier.")
      return
    }

    setConfirmingDeleteId(student.id)
  }

  const executeDelete = async (id: string) => {
    setDeletingId(id)
    setConfirmingDeleteId(null)
    try {
      await db.deleteStudent(id)
      notifications.success("Success", "Student deleted successfully")
      await loadStudents(false, true)
    } catch (error: any) {
      console.error("[StudentManagement] Delete error:", error);
      notifications.error("Deletion Failed", error.message || "Failed to delete student. Please try again.");
    } finally {
      setDeletingId(null)
    }
  }

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileValidation = ValidationService.validateCSVFile(file)
    if (!fileValidation.isValid) {
      notifications.error("Invalid File", fileValidation.error || "Unknown error")
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string
        const lines = csv.split("\n").filter((line) => line.trim())

        if (lines.length < 2) {
          notifications.error("CSV Error", "CSV file must contain at least a header row and one data row")
          return
        }

        // 1. Move helper to top of function for use in headers
        const splitCSVLine = (line: string) => {
          const result = []
          let startValueIndex = 0
          let inQuotes = false

          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
              inQuotes = !inQuotes
            }
            if (line[i] === "," && !inQuotes) {
              let value = line.substring(startValueIndex, i).trim()
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1).replace(/""/g, '"')
              }
              result.push(value)
              startValueIndex = i + 1
            }
          }
          let lastValue = line.substring(startValueIndex).trim()
          if (lastValue.startsWith('"') && lastValue.endsWith('"')) {
            lastValue = lastValue.substring(1, lastValue.length - 1).replace(/""/g, '"')
          }
          result.push(lastValue)
          return result
        }

        const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase())

        const requiredHeaders = [
          "name",
          "grade",
          "section",
          "parent_phone",
          "parent_name",
        ]
        const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h))

        if (missingHeaders.length > 0) {
          notifications.error("CSV Error", `Missing required columns: ${missingHeaders.join(", ")}`)
          return
        }

        const rowsToPreview = []
        for (let i = 1; i < lines.length; i++) {
          const rawValues = splitCSVLine(lines[i])
          if (rawValues.length === 0 || (rawValues.length === 1 && rawValues[0] === "")) continue

          const student: any = {}
          headers.forEach((header, index) => {
            student[header] = rawValues[index] || ""
          })
          rowsToPreview.push(student)
        }
        
        // Set data for preview instead of direct import
        setImportPreviewData(rowsToPreview)
      } catch (error) {
        console.error("Import error:", error)
        notifications.error("Import Failed", "Failed to process CSV file.")
      }
    }
    reader.readAsText(file)
  }

  const handleFinalImport = async (validData: Student[]) => {
    setIsImporting(true)
    try {
      const result = await db.bulkAddStudents(validData)
      notifications.success(
        "Import Successful",
        `Successfully imported ${result.data.created} students.`
      )
      setImportPreviewData(null)
      setShowUploadDialog(false)
      await loadStudents() // Force refresh student list after bulk import
    } catch (error: any) {
      console.error("Bulk add error:", error)
      notifications.error("Import Failed", "An error occurred during final data persistence.")
    } finally {
      setIsImporting(false)
    }
  }

  const downloadCSVTemplate = () => {
    console.log("Starting CSV template download...")

    try {
      const headers = [
        "name",
        "grade",
        "stream",
        "section",
        "gender",
        "date_of_birth",
        "address",
        "parent_name",
        "parent_phone",
        "parent_email",
        "relationshipType",
        "parent_address",
        "parent_password"
      ]
      // Example row 1: Grade 11 student WITH stream (required for Grade 11 & 12)
      const example1 = [
        "John Doe",
        "Grade 11",
        "Natural",
        "A",
        "Male",
        "2008-05-15",
        "Addis Ababa, Bole",
        "Jane Doe",
        "+251911223344",
        "jane.doe@example.com",
        "Mother",
        "Addis Ababa, Bole",
        "password123"
      ]
      // Example row 2: Grade 10 student WITHOUT stream (stream not required for Grade 1-10)
      const example2 = [
        "Sara Tadesse",
        "Grade 10",
        "",
        "B",
        "Female",
        "2009-08-20",
        "Addis Ababa, Kirkos",
        "Tadesse Alemu",
        "+251922334455",
        "tadesse@example.com",
        "Father",
        "Addis Ababa, Kirkos",
        "password456"
      ]

      const escapeCSV = (field: string) => {
        const stringField = String(field || "")
        if (stringField.includes(",") || stringField.includes('"') || stringField.includes("\n")) {
          return `"${stringField.replace(/"/g, '""')}"`
        }
        return stringField
      }

      let csvContent = headers.map(escapeCSV).join(",") + "\n"
      csvContent += example1.map(escapeCSV).join(",") + "\n"
      csvContent += example2.map(escapeCSV).join(",") + "\n"

      console.log("CSV template content generated")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)

      // Create download link
      const link = document.createElement("a")
      link.href = url
      link.download = "student_import_template.csv"
      link.style.display = "none"

      // Add to DOM, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the URL object
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)

      console.log("CSV template download initiated successfully")
      notifications.success("Template Downloaded", "CSV template downloaded successfully")
    } catch (error) {
      console.error("CSV template download error:", error)
      notifications.error("Download Failed", "Failed to download template. Please try again.")
    }
  }

  const exportStudentListToCSV = () => {
    console.log("Starting student list CSV export...")

    try {
      const headers = [
        "Student Name",
        "Student ID",
        "Grade",
        "Stream",
        "Section",
        "Gender",
        "Date of Birth",
        "Student Address",
        "Parent Name",
        "Parent Phone",
        "Parent Email",
        "Relationship",
        "Parent Address"
      ]

      const csvData = filteredStudents.map((student) => [
        `"${student.name}"`,
        student.student_id,
        `"${student.grade}"`,
        `"${student.stream || ""}"`,
        student.section,
        student.gender,
        student.date_of_birth || "",
        `"${student.address || ""}"`,
        `"${student.parent_name || ""}"`,
        student.parent_phone || "",
        student.parent_email || "",
        `"${student.relationshipType || "Guardian"}"`,
        `"${student.parent_address || ""}"`,
      ])

      const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `students_list_${new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })}.csv` // ISO filename kept for file system compatibility
      link.style.display = "none"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 100)

      notifications.success(
        "Export Successful",
        `${filteredStudents.length} students have been exported to CSV successfully.`,
      )
    } catch (error) {
      console.error("CSV export error:", error)
      notifications.error("Export Failed", "Failed to export student list. Please try again.")
    }
  }

  const { grades, streams, sections } = useMemo(() => {
    const isFilter11or12 = gradeFilter !== "All Grades" && isGrade11or12Grade(gradeFilter);

    // Grades
    const discoveredGrades = [...new Set(students.map((s) => s.grade))].filter((g): g is string => !!g);

    // Streams
    let discoveredStreams: string[] = [];
    if (gradeFilter === "All Grades") {
      discoveredStreams = ["Natural Science", "Social Science"];
    } else if (isFilter11or12) {
      discoveredStreams = ["Natural Science", "Social Science"];
    }

    // Sections: filtered by gradeFilter and streamFilter
    let candidateStudents = students;
    if (gradeFilter !== "All Grades") {
      candidateStudents = candidateStudents.filter(
        (s) => s.grade?.toLowerCase() === gradeFilter.toLowerCase()
      );
    }
    if (streamFilter !== "All Streams") {
      candidateStudents = candidateStudents.filter(
        (s) => s.stream?.toLowerCase() === streamFilter.toLowerCase()
      );
    }
    const studentSecs = candidateStudents.map((s) => s.section).filter((sec): sec is string => !!sec);

    // Also include academicSections that match grade and stream
    const dbSecs = academicSections
      .filter((s) => {
        if (gradeFilter !== "All Grades") {
          const gMatch = s.grade?.name?.toLowerCase() === gradeFilter.toLowerCase();
          if (!gMatch) return false;
        }
        if (streamFilter !== "All Streams") {
          const strMatch = s.stream?.name?.toLowerCase() === streamFilter.toLowerCase();
          if (!strMatch) return false;
        }
        return true;
      })
      .map((s) => s.name);

    const mergedSections = [...new Set([...studentSecs, ...dbSecs])].sort();

    return {
      grades: discoveredGrades.length > 0 ? discoveredGrades.sort() : academicGrades.map(g => g.name),
      streams: discoveredStreams,
      sections: mergedSections,
    };
  }, [students, gradeFilter, streamFilter, academicGrades, academicSections])

  return (
    <>
      <DataStateView
        isLoading={isLoading}
        isEmpty={students.length === 0}
        error={error}
        emptyTitle="No Students Yet"
        emptyDescription="There are no students available. Add students to get started."
        crumbsTitle="Students"
        emptyAction={
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[320px] sm:max-w-md justify-center items-center">
            <Button
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-2xl h-12 w-full sm:w-auto px-6 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4.5 h-4.5" />
              Add Student
            </Button>
            <Button
              onClick={() => setShowUploadDialog(true)}
              variant="outline"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-2xl h-12 w-full sm:w-auto px-6 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2 shadow-xs"
            >
              <Upload className="w-4.5 h-4.5 text-[#4f46e5]" />
              Bulk Import
            </Button>
          </div>
        }
        skeletonVariant="table"
      >
        <div className="space-y-6 pt-4 md:pt-6 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
          <h1 className="typography-page-title">
            Student Management
          </h1>
          <p className="typography-helper text-xs md:text-sm font-medium mt-0.5">
            Student directory, enrollment records, and academic profiles
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            onClick={() => setShowUploadDialog(true)} 
            variant="outline"
            className="flex-1 md:flex-none h-10 rounded-xl border-slate-200 dark:border-slate-800 font-semibold text-xs"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button 
            onClick={exportStudentListToCSV} 
            disabled={filteredStudents.length === 0}
            variant="outline"
            className="flex-1 md:flex-none h-10 rounded-xl border-slate-200 dark:border-slate-800 font-semibold text-xs"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
          <div className="hidden md:block">
            <Button 
              onClick={() => { resetForm(); setIsAddModalOpen(true); }} 
              className="h-11 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={(open) => { if (!open) { setIsAddModalOpen(false); setShowSuccess(false) } }}>
             <DialogContent className="sm:max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-0 overflow-hidden">
              {showSuccess ? (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                  <DialogTitle className="sr-only">Registration Successful</DialogTitle>
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce mb-5">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="typography-page-title text-emerald-700 dark:text-emerald-400">Enrolled Successfully!</h2>
                  <p className="typography-body text-slate-500 dark:text-slate-400 mt-1">The student has been added to the system.</p>
                </div>
              ) : (
                <>
                  <DialogHeader className="bg-gradient-to-r from-emerald-50/60 to-teal-50/20 dark:from-slate-800/60 dark:to-slate-900/20 border-b border-slate-100 dark:border-slate-800/50 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <DialogTitle className="typography-section-title">{editingStudent ? "Update Student Profile" : "Enroll New Student"}</DialogTitle>
                        <DialogDescription className="sr-only">
                          {editingStudent ? "Update the selected student's profile information." : "Enter the details to enroll a new student in the system."}
                        </DialogDescription>
                        <p className="typography-helper text-slate-500 dark:text-slate-400 mt-0.5">Provide complete personal and guardian contact fields.</p>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  <div className="px-6 py-6 max-h-[75vh] overflow-y-auto">
                    {validationErrors.length > 0 && (
                      <Alert variant="destructive" className="rounded-xl border-red-500/20 bg-red-500/10 mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="typography-helper list-disc list-inside space-y-0.5">
                            {validationErrors.map((error, index) => (
                              <li key={index} className="typography-label">{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-4">
                        <p className="typography-label text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Basic Information</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="typography-label">Full Name *</Label>
                            <Input
                              id="name"
                              placeholder="e.g. Abebe Bikila"
                              value={formData.name || ""}
                              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                              required
                              className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="student_id" className="typography-label">Student ID (Auto)</Label>
                            <Input
                              id="student_id"
                              value={formData.student_id || ""}
                              readOnly
                              className="typography-body h-11 rounded-xl bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="grade" className="typography-label">1. Grade *</Label>
                            <Select
                              value={formData.grade}
                              onValueChange={handleGradeChange}
                            >
                              <SelectTrigger className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800">
                                <SelectValue placeholder="Select Grade *" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                <SelectItem value="KG1">KG1</SelectItem>
                                <SelectItem value="KG2">KG2</SelectItem>
                                <SelectItem value="Prep">Prep</SelectItem>
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                                  <SelectItem key={g} value={`Grade ${g}`}>Grade {g}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="stream" className="typography-label">
                              2. Stream {isFormGrade11or12 && <span className="text-destructive">*</span>}
                            </Label>
                            {!formData.grade ? (
                              <Input
                                id="stream"
                                value=""
                                placeholder="Select grade first"
                                readOnly
                                disabled
                                className="typography-body h-11 rounded-xl bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed"
                              />
                            ) : !isFormGrade11or12 ? (
                              <Input
                                id="stream"
                                value="Standard / N/A"
                                readOnly
                                disabled
                                className="typography-body h-11 rounded-xl bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed"
                              />
                            ) : (
                              <Select
                                value={formData.stream || ""}
                                onValueChange={handleStreamChange}
                              >
                                <SelectTrigger className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800">
                                  <SelectValue placeholder="Select Stream *" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                  <SelectItem value="Natural Science">Natural Science</SelectItem>
                                  <SelectItem value="Social Science">Social Science</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="section" className="typography-label">
                              {isFormGrade11or12 ? "3. Section *" : "2. Section *"}
                            </Label>
                            <Select
                              value={formData.section || ""}
                              onValueChange={(val) => setFormData((prev) => ({ ...prev, section: val }))}
                              disabled={!formData.grade || (isFormGrade11or12 && !formData.stream)}
                            >
                              <SelectTrigger className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800">
                                <SelectValue
                                  placeholder={
                                    !formData.grade
                                      ? "Select Grade first"
                                      : isFormGrade11or12 && !formData.stream
                                      ? "Select Stream first"
                                      : "Select Section *"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                {availableSectionsForStudentForm.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No sections registered
                                  </SelectItem>
                                ) : (
                                  availableSectionsForStudentForm.map((sec) => (
                                    <SelectItem key={sec} value={sec}>
                                      {sec.toLowerCase().startsWith("section") ? sec : `Section ${sec}`}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            {formData.grade && (!isFormGrade11or12 || formData.stream) && availableSectionsForStudentForm.length === 0 && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                No sections found. Please configure in Academic Structure.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="gender" className="typography-label">Gender</Label>
                            <Select
                              value={formData.gender}
                              onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
                            >
                              <SelectTrigger className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800">
                                <SelectValue placeholder="Select Gender" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="date_of_birth" className="typography-label">Date of Birth</Label>
                            <Input
                              id="date_of_birth"
                              type="date"
                              value={formData.date_of_birth || ""}
                              onChange={(e) => setFormData((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                              className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="typography-label text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Parent/Guardian Contact</p>
                          {parentLookupState === 'searching' && (
                            <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 animate-pulse font-medium">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Searching for parent account...
                            </div>
                          )}
                          {parentLookupState === 'found' && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                              Account Linked
                            </span>
                          )}
                          {parentLookupState === 'not_found' && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                              New Parent Account
                            </span>
                          )}
                          {parentLookupState === 'error' && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold px-2 py-0.5 rounded-full">
                              Search Failed
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="parent_phone" className="typography-label text-slate-700 dark:text-slate-300">Parent Phone Number *</Label>
                            <PhoneInput
                              id="parent_phone"
                              value={formData.parent_phone || ""}
                              onChange={(val) => setFormData((prev) => ({ ...prev, parent_phone: val }))}
                              required
                            />
                            <p className="text-[10px] text-muted-foreground italic">Phone number is used for automatic global parent account detection.</p>
                          </div>

                          {/* Explicit State Views */}
                          {parentLookupState === 'searching' && !editingStudent && (
                            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl flex items-center gap-3 animate-pulse">
                              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                                <p className="font-semibold">Searching for parent account...</p>
                                <p className="text-[10px] opacity-80">Verifying global directory to prevent duplicate account creation.</p>
                              </div>
                            </div>
                          )}

                          {parentLookupState === 'error' && !editingStudent && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-3 animate-in fade-in">
                              <div className="flex items-start gap-2 text-rose-800 dark:text-rose-200">
                                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <h4 className="typography-label text-rose-900 dark:text-rose-100 font-semibold">Verification Failed</h4>
                                  <p className="text-xs mt-1 text-rose-700 dark:text-rose-300">
                                    {parentLookupError || "Unable to verify the parent account. Please check your connection and try again."}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1 border-t border-rose-200/50 dark:border-rose-800/50">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs border-rose-300 hover:bg-rose-100 dark:border-rose-700 dark:hover:bg-rose-900/40 text-rose-800 dark:text-rose-200"
                                  onClick={() => handleSearchParent(formData.parent_phone)}
                                >
                                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                  Retry Search
                                </Button>
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 italic">Creating a parent is disabled until search succeeds.</span>
                              </div>
                            </div>
                          )}

                          {parentLookupState === 'found' && foundParent && !editingStudent && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-center gap-2">
                                <span className="typography-label p-1 px-2 bg-emerald-600 text-white rounded text-[9px] uppercase">Auto-Detected</span>
                                <h4 className="typography-label text-emerald-800 dark:text-emerald-200 italic">Existing Parent Found</h4>
                              </div>
                              
                              <div className="typography-helper grid grid-cols-2 gap-x-4 gap-y-1 text-emerald-900/80 dark:text-emerald-100/80">
                                <p><span className="typography-label text-emerald-800/60 dark:text-emerald-200/60">Name:</span> <strong>{foundParent.full_name || foundParent.name}</strong></p>
                                <p><span className="typography-label text-emerald-800/60 dark:text-emerald-200/60">Email:</span> <strong className="truncate block">{foundParent.email}</strong></p>
                                <p className="col-span-2"><span className="typography-label text-emerald-800/60 dark:text-emerald-200/60">Address:</span> <strong>{foundParent.address || "No address provided"}</strong></p>
                              </div>
                              
                              <div className="space-y-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50">
                                <Label htmlFor="found_relationship" className="typography-label text-emerald-800 dark:text-emerald-300 uppercase">Relationship to Student *</Label>
                                <Select
                                  value={formData.relationshipType}
                                  onValueChange={(value) => setFormData((prev) => ({ ...prev, relationshipType: value }))}
                                >
                                  <SelectTrigger id="found_relationship" className="typography-label h-10 rounded-lg bg-white/60 border-emerald-200 dark:border-emerald-800">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-lg border-emerald-200 dark:border-emerald-800">
                                    <SelectItem value="Father">Father</SelectItem>
                                    <SelectItem value="Mother">Mother</SelectItem>
                                    <SelectItem value="Guardian">Guardian</SelectItem>
                                    <SelectItem value="Grandparent">Grandparent</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          {parentLookupState === 'not_found' && !editingStudent && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 fade-in">
                              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                                <span className="typography-label p-1 px-2 bg-amber-500 text-white rounded text-[9px] uppercase font-bold">New Profile</span>
                                <h4 className="typography-label text-amber-800 dark:text-amber-200 text-xs italic font-medium">No parent account found. Please fill in parent details below to register a new account.</h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="parent_name" className="typography-label text-slate-600">Parent Full Name *</Label>
                                  <Input
                                    id="parent_name"
                                    placeholder="First and Father Name"
                                    value={formData.parent_name || ""}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, parent_name: e.target.value }))}
                                    required
                                    className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="relationship" className="typography-label text-slate-600">Relationship *</Label>
                                  <Select
                                    value={formData.relationshipType}
                                    onValueChange={(value) => setFormData((prev) => ({ ...prev, relationshipType: value }))}
                                  >
                                    <SelectTrigger id="relationship" className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                                      <SelectItem value="Father">Father</SelectItem>
                                      <SelectItem value="Mother">Mother</SelectItem>
                                      <SelectItem value="Guardian">Guardian</SelectItem>
                                      <SelectItem value="Grandparent">Grandparent</SelectItem>
                                      <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="parent_email" className="typography-label text-slate-600">Email Address (Optional)</Label>
                                  <Input
                                    id="parent_email"
                                    type="email"
                                    placeholder="email@example.com"
                                    value={formData.parent_email || ""}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, parent_email: e.target.value }))}
                                    className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="parent_password" className="typography-label text-slate-600">Portal Password *</Label>
                                  <Input
                                    id="parent_password"
                                    type="text"
                                    placeholder="Min. 8 chars (A-Z, a-z, 0-9)"
                                    value={formData.parent_password || ""}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, parent_password: e.target.value }))}
                                    required={parentLookupState === 'not_found' && !editingStudent}
                                    className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                  />
                                  <p className="text-[11px] text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>

                                  {/* Live validation feedback */}
                                  {formData.parent_password && (() => {
                                    const pv = validatePassword(formData.parent_password)
                                    return (
                                      <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800">
                                        {[
                                          { label: '8+ characters', ok: pv.hasMinLength },
                                          { label: 'Uppercase (A–Z)', ok: pv.hasUppercase },
                                          { label: 'Lowercase (a–z)', ok: pv.hasLowercase },
                                          { label: 'Number (0–9)', ok: pv.hasNumber },
                                        ].map(({ label, ok }) => (
                                          <div
                                            key={label}
                                            className={`flex items-center gap-1 text-[11px] font-medium ${
                                              ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                                            }`}
                                          >
                                            {ok ? <ShieldCheck className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                                            {label}
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label htmlFor="parent_address" className="typography-label text-slate-600">Home Address (Optional)</Label>
                                  <Input
                                    id="parent_address"
                                    placeholder="Location details"
                                    value={formData.parent_address || ""}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, parent_address: e.target.value }))}
                                    className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {editingStudent && (
                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                               <p className="typography-label text-[10px] uppercase text-slate-400">Update Contact Info</p>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit_parent_name" className="typography-label text-slate-600">Parent Name</Label>
                                    <Input
                                      id="edit_parent_name"
                                      value={formData.parent_name || ""}
                                      onChange={(e) => setFormData((prev) => ({ ...prev, parent_name: e.target.value }))}
                                      className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit_relationship" className="typography-label text-slate-600">Relationship</Label>
                                    <Select
                                      value={formData.relationshipType}
                                      onValueChange={(value) => setFormData((prev) => ({ ...prev, relationshipType: value }))}
                                    >
                                      <SelectTrigger id="edit_relationship" className="typography-body h-11 rounded-xl bg-background/50 border-slate-200 dark:border-slate-800">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Father">Father</SelectItem>
                                        <SelectItem value="Mother">Mother</SelectItem>
                                        <SelectItem value="Guardian">Guardian</SelectItem>
                                        <SelectItem value="Grandparent">Grandparent</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                               </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button type="submit" className="typography-card-title w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/10 transition-all active:scale-[0.98]" disabled={isSaving}>
                        {isSaving ? (
                          <div className="flex items-center gap-2">
                            <Spinner size="sm" className="text-white" />
                            Saving...
                          </div>
                        ) : editingStudent ? "Update Student Profile" : "Enroll Student"}
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

      {/* Import Section */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="!max-w-none !w-screen !h-screen !translate-x-0 !translate-y-0 !top-0 !left-0 rounded-none border-none shadow-2xl bg-card/98 backdrop-blur-xl p-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-8 py-4 border-b border-border/50 bg-background/50">
            <DialogTitle className="typography-page-title">Import Student Data</DialogTitle>
            <DialogDescription className="sr-only">
              Upload a CSV file to bulk import student records into the database.
            </DialogDescription>
          </div>
          <div className="flex-1 overflow-hidden px-8 py-6">
            {importPreviewData ? (
              <StudentImportPreview 
                data={importPreviewData}
                onCancel={() => setImportPreviewData(null)}
                onImport={handleFinalImport}
                isImporting={isImporting}
              />
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl py-24 px-6 bg-muted/20 h-full">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <UploadCloud className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">Upload Student Roster</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
                  Upload a CSV file containing your student records. You'll be able to preview and correct data before finalized import.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                  <Button variant="outline" onClick={downloadCSVTemplate} className="typography-label flex-1 h-12 rounded-2xl border-border/50 bg-background/50 hover:bg-muted">
                    <Download className="w-4 h-4 mr-2 text-primary" />
                    Get Template
                  </Button>
                  
                  <div className="flex-1 relative">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVImport}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <Button className="typography-label w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                      Select File
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters and Search Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-sm sticky top-4 z-30 flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, ID, or class details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="typography-label pl-11 h-12 rounded-xl bg-background/50 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {!isTeacher && (
          <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            <Select
              value={selectedAcademicYear || activeAcademicYear?.name || ""}
              onValueChange={(val) => {
                setSelectedAcademicYear(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="typography-label h-12 w-[170px] rounded-xl bg-background/50 border-border/50">
                <Calendar className="w-4 h-4 mr-2 text-primary/70 shrink-0" />
                <SelectValue placeholder="Academic Year" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                {allAcademicYears && allAcademicYears.length > 0 ? (
                  allAcademicYears.map((ay) => (
                    <SelectItem key={ay.id} value={ay.name}>
                      <span className="flex items-center gap-1.5">
                        {ay.name}
                        {ay.isCurrent && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold ml-1">
                            Active
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  (activeAcademicYear?.name || selectedAcademicYear) && (
                    <SelectItem value={selectedAcademicYear || activeAcademicYear?.name || ""}>
                      {selectedAcademicYear || activeAcademicYear?.name} (Active)
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="typography-label h-12 w-[160px] rounded-xl bg-background/50 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="All">All Statuses ({statusCounts.ALL})</SelectItem>
                <SelectItem value="ACTIVE">Active ({statusCounts.ACTIVE})</SelectItem>
                <SelectItem value="SUSPENDED">Suspended ({statusCounts.SUSPENDED})</SelectItem>
                <SelectItem value="WITHDRAWN">Withdrawn ({statusCounts.WITHDRAWN})</SelectItem>
                <SelectItem value="TRANSFERRED">Transferred ({statusCounts.TRANSFERRED})</SelectItem>
                <SelectItem value="GRADUATED">Graduated ({statusCounts.GRADUATED})</SelectItem>
                <SelectItem value="ARCHIVED">Archived ({statusCounts.ARCHIVED})</SelectItem>
              </SelectContent>
            </Select>

            <Select value={gradeFilter} onValueChange={(val) => {
              setGradeFilter(val);
              setStreamFilter("All Streams");
              setSectionFilter("All Sections");
            }}>
              <SelectTrigger className="typography-label h-12 w-[140px] rounded-xl bg-background/50 border-border/50">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="All Grades">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={streamFilter} onValueChange={(val) => {
              setStreamFilter(val);
              setSectionFilter("All Sections");
            }}>
              <SelectTrigger className="typography-label h-12 w-[140px] rounded-xl bg-background/50 border-border/50">
                <SelectValue placeholder="Stream" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="All Streams">All Streams</SelectItem>
                {streams.map((stream) => (
                  <SelectItem key={stream} value={stream}>{stream}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="typography-label h-12 w-[140px] rounded-xl bg-background/50 border-border/50">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="All Sections">All Sections</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section} value={section}>{section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="hidden lg:block h-8 w-[1px] bg-border/50 mx-2" />
        
        <div className="typography-label flex items-center gap-2 text-muted-foreground/70 uppercase px-2 min-w-fit">
          <Users className="w-4 h-4 text-primary/60" />
          <span>{filteredStudents.length} Students</span>
        </div>

        {selectedAcademicYear && activeAcademicYear && selectedAcademicYear !== activeAcademicYear.name && (
          <Badge variant="outline" className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 flex items-center gap-1.5 px-2.5 py-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Historical: {selectedAcademicYear}</span>
            <button
              onClick={() => setSelectedAcademicYear(activeAcademicYear.name)}
              className="ml-1 text-[10px] underline hover:text-amber-900 dark:hover:text-amber-100 font-bold cursor-pointer"
            >
              Reset to Active
            </button>
          </Badge>
        )}
      </div>

      {/* Main List Area */}
      <div className="bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-sm overflow-hidden min-h-[400px]">
        {isLoading ? (
          <PageSkeleton variant="table" />
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center border border-border/50">
              <Search className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="typography-section-title text-foreground">No students found</h3>
              <p className="typography-label text-muted-foreground max-w-xs mx-auto">
                We couldn't find any students matching your search or filters. Try adjusting your criteria.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setSearchTerm(""); setSelectedAcademicYear(activeAcademicYear?.name || ""); setGradeFilter("All Grades"); setStreamFilter("All Streams"); setSectionFilter("All Sections"); setStatusFilter("ACTIVE"); }} className="rounded-xl border-border/50">
              Clear All Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200/80 dark:border-slate-800/80">
                    <TableHead className="w-[30%] font-semibold uppercase text-xs tracking-wider text-muted-foreground">Student Details</TableHead>
                    <TableHead className="w-[15%] font-semibold uppercase text-xs tracking-wider text-muted-foreground">ID Number</TableHead>
                    <TableHead className="w-[18%] font-semibold uppercase text-xs tracking-wider text-muted-foreground">Grade / Section</TableHead>
                    <TableHead className="w-[15%] font-semibold uppercase text-xs tracking-wider text-muted-foreground">Stream</TableHead>
                    <TableHead className="w-[12%] font-semibold uppercase text-xs tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="w-[10%] text-right font-semibold uppercase text-xs tracking-wider text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((student) => (
                    <TableRow key={student.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800/60">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 group-hover:scale-105 transition-transform shrink-0">
                            {student.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground tracking-tight truncate">{student.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] font-medium bg-background/50 border-border/50 h-4 py-0 text-muted-foreground">
                                {student.gender || 'N/A'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                          {student.student_id}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold text-foreground">{student.grade}</p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Section {student.section}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.stream ? (
                          <Badge variant="outline" className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/60 px-2.5 py-0.5">
                            {student.stream}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {(() => {
                            const status = (student.status || 'ACTIVE').toUpperCase()
                            if (status === 'ACTIVE') return (
                              <Badge variant="outline" className="text-xs font-bold flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </Badge>
                            )
                            if (status === 'SUSPENDED' || status === 'INACTIVE') return (
                              <Badge variant="outline" className="text-xs font-bold flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60">
                                <ShieldAlert className="w-3 h-3" /> {status === 'SUSPENDED' ? 'Suspended' : 'Inactive'}
                              </Badge>
                            )
                            if (status === 'WITHDRAWN') return (
                              <Badge variant="outline" className="text-xs font-bold flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700">
                                <XCircle className="w-3 h-3" /> Withdrawn
                              </Badge>
                            )
                            if (status === 'TRANSFERRED') return (
                              <Badge variant="outline" className="text-xs font-bold flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60">
                                <RefreshCw className="w-3 h-3" /> Transferred
                              </Badge>
                            )
                            if (status === 'GRADUATED') return (
                              <Badge variant="outline" className="text-xs font-bold flex items-center gap-1 text-teal-700 dark:text-teal-400 bg-teal-50/60 dark:bg-teal-950/30 border-teal-300 dark:border-teal-800/60">
                                <GraduationCap className="w-3 h-3" /> Graduated
                              </Badge>
                            )
                            if (status === 'ARCHIVED') return (
                              <Badge variant="outline" className="text-xs font-bold flex items-center gap-1 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800">
                                Archived
                              </Badge>
                            )
                            return (
                              <Badge variant="outline" className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60">
                                {status}
                              </Badge>
                            )
                          })()}

                          {student.accountStatus === 'PENDING_ACTIVATION' ? (
                            <Badge variant="outline" className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60">
                              <KeyRound className="w-2.5 h-2.5 mr-1 text-purple-500" />
                              Pending Activation
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-500" />
                              Portal Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedStudent(student)}
                            className="h-9 w-9 rounded-xl hover:bg-blue-500/10 hover:text-blue-600 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setStatusModalStudent(student)}
                            title="Change Lifecycle Status"
                            className="h-9 w-9 rounded-xl hover:bg-amber-500/10 hover:text-amber-600 transition-all"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setHistoryModalStudent(student)}
                            title="View Status History"
                            className="h-9 w-9 rounded-xl hover:bg-slate-500/10 hover:text-slate-600 transition-all"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          {(((student.status || '').toUpperCase() === 'WITHDRAWN') || ((student.status || '').toUpperCase() === 'TRANSFERRED')) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setReEnrollModalStudent(student)}
                              title="Re-Enroll Student"
                              className="h-9 w-9 rounded-xl hover:bg-teal-500/10 hover:text-teal-600 transition-all"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(student)}
                            className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleDelete(e, student)}
                            disabled={deletingId === student.id}
                            className="h-9 w-9 rounded-xl hover:bg-red-500/10 hover:text-red-600 transition-all text-muted-foreground"
                          >
                            {deletingId === student.id ? (
                              <Spinner size="sm" className="text-destructive" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Compact Table View */}
            <div className="md:hidden overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[340px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-[35%]">Student</th>
                    <th className="px-2 py-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-[22%]">Class / Stream</th>
                    <th className="px-2 py-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-[23%]">Status</th>
                    <th className="px-2 py-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 active:bg-slate-100 dark:active:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      {/* Student Name + ID */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center flex-shrink-0 border border-primary/20">
                            {student.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-black text-foreground truncate uppercase tracking-tight leading-tight">
                              {student.name}
                            </p>
                            <code className="text-[9px] font-mono text-muted-foreground/70">
                              {student.student_id}
                            </code>
                          </div>
                        </div>
                      </td>

                      {/* Grade / Section / Stream */}
                      <td className="px-2 py-2.5">
                        <p className="text-[11px] font-bold text-foreground uppercase leading-tight">{student.grade} - {student.section}</p>
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase truncate">
                          {student.stream || "—"}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col gap-1 items-start">
                          {(() => {
                            const st = (student.status || 'ACTIVE').toUpperCase()
                            const cls: Record<string, string> = {
                              ACTIVE: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300',
                              SUSPENDED: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-300',
                              INACTIVE: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-300',
                              WITHDRAWN: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border-slate-300',
                              TRANSFERRED: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200',
                              GRADUATED: 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border-teal-300',
                              ARCHIVED: 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/30 border-slate-200',
                            }
                            return (
                              <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 ${cls[st] || cls.ACTIVE}`}>
                                {st}
                              </Badge>
                            )
                          })()}
                          {student.accountStatus === 'PENDING_ACTIVATION' ? (
                            <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                              <KeyRound className="w-2.5 h-2.5" /> Pending
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Active
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleEdit(student); }}
                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setStatusModalStudent(student); }}
                            title="Change Status"
                            className="h-8 w-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-600"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setHistoryModalStudent(student); }}
                            title="Status History"
                            className="h-8 w-8 rounded-lg hover:bg-slate-500/10 hover:text-slate-600"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                          {(((student.status || '').toUpperCase() === 'WITHDRAWN') || ((student.status || '').toUpperCase() === 'TRANSFERRED')) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setReEnrollModalStudent(student); }}
                              title="Re-Enroll Student"
                              className="h-8 w-8 rounded-lg hover:bg-teal-500/10 hover:text-teal-600"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleDelete(e, student); }}
                            disabled={deletingId === student.id}
                            className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-500"
                          >
                            {deletingId === student.id
                              ? <Spinner size="sm" className="text-destructive" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredStudents.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Showing</span>
                  <span className="font-semibold text-foreground">
                    {Math.min((currentPage - 1) * pageSize + 1, filteredStudents.length)}–{Math.min(currentPage * pageSize, filteredStudents.length)}
                  </span>
                  <span>of</span>
                  <span className="font-semibold text-foreground">{filteredStudents.length}</span>
                  <span>students</span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="h-7 text-xs bg-background border border-border/60 rounded px-1.5 py-0.5 font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="h-8 px-2.5 text-xs rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <div className="text-xs font-semibold px-2 py-1 text-muted-foreground">
                    Page <span className="text-foreground">{currentPage}</span> of <span className="text-foreground">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-8 px-2.5 text-xs rounded-lg"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Student Profile Detail modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-950 sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[92vh] flex flex-col rounded-t-3xl">

            {/* ── Compact Modern Header ── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6 pt-6 pb-5">
              {/* decorative accent line */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-t-3xl" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedStudent(null)}
                className="absolute top-4 right-4 text-white/60 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 transition-colors"
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-4 pr-10">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40 flex-shrink-0">
                  <span className="text-2xl font-black text-white">
                    {selectedStudent.name?.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Name + meta */}
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white truncate leading-tight">
                    {selectedStudent.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/50 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                      Student Record
                    </span>
                    <code className="text-[11px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                      {selectedStudent.student_id}
                    </code>
                  </div>
                </div>
              </div>

              {/* Quick stat chips */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {[
                  { label: selectedStudent.grade || "—", sub: "Grade" },
                  { label: selectedStudent.section || "—", sub: "Section" },
                  { label: selectedStudent.gender || "—", sub: "Gender" },
                  ...(selectedStudent.stream ? [{ label: selectedStudent.stream, sub: "Stream" }] : []),
                ].map((chip) => (
                  <div key={chip.sub} className="flex flex-col items-center bg-white/8 border border-white/10 rounded-xl px-3 py-2 min-w-[64px]">
                    <span className="text-[11px] font-black text-white/90 leading-none">{chip.label}</span>
                    <span className="text-[9px] font-bold uppercase text-white/40 tracking-widest mt-0.5">{chip.sub}</span>
                  </div>
                ))}
                {(() => {
                  const st = (selectedStudent.status || 'ACTIVE').toUpperCase()
                  const chipColor: Record<string, string> = {
                    ACTIVE: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200',
                    SUSPENDED: 'bg-amber-500/20 border-amber-400/30 text-amber-200',
                    INACTIVE: 'bg-amber-500/20 border-amber-400/30 text-amber-200',
                    WITHDRAWN: 'bg-slate-500/20 border-slate-400/30 text-slate-200',
                    TRANSFERRED: 'bg-blue-500/20 border-blue-400/30 text-blue-200',
                    GRADUATED: 'bg-teal-500/20 border-teal-400/30 text-teal-200',
                    ARCHIVED: 'bg-slate-600/20 border-slate-500/30 text-slate-300',
                  }
                  return (
                    <div className={`flex flex-col items-center border rounded-xl px-3 py-2 min-w-[64px] ${chipColor[st] || chipColor.ACTIVE}`}>
                      <span className="text-[11px] font-black leading-none">{st}</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-70">Status</span>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="overflow-y-auto flex-1 bg-white dark:bg-slate-950 p-5 space-y-5">

              {/* Student Details */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Student Details</p>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900">
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-50/60 dark:bg-slate-900/40">
                    <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Calendar className="w-4 h-4 opacity-60" />
                      Date of Birth
                    </span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {selectedStudent.date_of_birth || "Not set"}
                    </span>
                  </div>
                  {selectedStudent.address && (
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/60 dark:bg-slate-900/40">
                      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <GraduationCap className="w-4 h-4 opacity-60" />
                        Address
                      </span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[55%]">
                        {selectedStudent.address}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Parent / Guardian */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">Parent / Guardian</p>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900">
                  {[
                    { icon: <Users className="w-4 h-4 opacity-60" />, label: "Name", value: selectedStudent.parent_name },
                    { icon: <Phone className="w-4 h-4 opacity-60" />, label: "Phone", value: selectedStudent.parent_phone },
                    { icon: <Mail className="w-4 h-4 opacity-60" />, label: "Email", value: selectedStudent.parent_email || "No email added" },
                    { icon: <ShieldCheck className="w-4 h-4 opacity-60" />, label: "Relationship", value: selectedStudent.relationshipType || "Guardian" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center px-4 py-3 bg-slate-50/60 dark:bg-slate-900/40">
                      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        {row.icon}
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[55%] truncate">
                        {row.value || "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Portal Account & Activation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Student Portal Account</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold",
                      selectedStudent.accountStatus === 'ACTIVE'
                        ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
                        : "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-300"
                    )}
                  >
                    {selectedStudent.accountStatus === 'ACTIVE' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Activated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-500" />
                        Pending Activation
                      </span>
                    )}
                  </Badge>
                </div>

                <div className="rounded-2xl border border-slate-100 dark:border-slate-900 p-4 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
                  {selectedStudent.accountStatus === 'ACTIVE' ? (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200">Account Activated & Verified</p>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                          The student has established their permanent login credentials and has active access to the student portal.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedStudent.activation_code ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-purple-200 dark:border-purple-800/60 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Activation Code</span>
                              <span className="text-xl font-black font-mono tracking-widest text-slate-900 dark:text-slate-100">
                                {selectedStudent.activation_code}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(selectedStudent.activation_code!, 'modal-code')}
                              className="h-8 gap-1.5 text-xs border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950"
                            >
                              {copiedKey === 'modal-code' ? (
                                <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                              ) : (
                                <><Copy className="w-3.5 h-3.5" /> Copy</>
                              )}
                            </Button>
                          </div>

                          {selectedStudent.activation_code_expires && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                              Expires: <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(selectedStudent.activation_code_expires).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 text-center space-y-1">
                          <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                            Activation Code Secured
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Stored securely. Click below to regenerate and print a fresh activation slip if lost or expired.
                          </p>
                          {selectedStudent.activation_code_expires && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              Expires: {new Date(selectedStudent.activation_code_expires).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        {selectedStudent.activation_code && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printActivationSlip({
                              student_id: selectedStudent.student_id || '',
                              fullName: selectedStudent.name,
                              grade: selectedStudent.grade,
                              section: selectedStudent.section,
                              activationCode: selectedStudent.activation_code!,
                              expiresAt: selectedStudent.activation_code_expires || undefined,
                            })}
                            className="flex-1 h-9 rounded-xl border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold gap-1.5 hover:bg-purple-50 dark:hover:bg-purple-950"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Slip
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRegeneratingCode}
                          onClick={() => handleRegenerateCode(selectedStudent.id)}
                          className="flex-1 h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5"
                        >
                          {isRegeneratingCode ? (
                            <><Spinner size="sm" /> Generating...</>
                          ) : (
                            <><RefreshCw className="w-3.5 h-3.5" /> {selectedStudent.activation_code ? 'Regenerate Code' : 'Generate Code'}</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Discipline Record Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Discipline & Conduct</p>
                  <Badge variant="outline" className="text-[10px]">
                    {studentDisciplines.length} Record(s)
                  </Badge>
                </div>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-900 p-4 bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
                  {isLoadingDisciplines ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Loading discipline history...</p>
                  ) : studentDisciplines.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No discipline incidents recorded for this student.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {studentDisciplines.map((inc) => (
                        <div key={inc.id} className="p-2.5 border rounded-xl bg-white dark:bg-slate-950 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{inc.title}</span>
                            <Badge variant="outline" className="text-[9px]">{inc.severity}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{inc.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                            <span>{formatDate(inc.date)}</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{inc.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-slate-100 dark:border-slate-900 px-5 py-4 flex flex-wrap gap-2 bg-white dark:bg-slate-950">
              <Button
                variant="outline"
                onClick={() => { setSelectedStudent(null); handleEdit(selectedStudent); }}
                className="flex-1 h-11 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-sm min-w-[120px]"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button
                variant="outline"
                onClick={() => { const s = selectedStudent; setSelectedStudent(null); setStatusModalStudent(s); }}
                className="flex-1 h-11 rounded-xl border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-bold text-sm min-w-[120px]"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Change Status
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => { const s = selectedStudent; setSelectedStudent(null); setHistoryModalStudent(s); }}
                title="View Status History"
                className="h-11 w-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500"
              >
                <History className="w-4 h-4" />
              </Button>
              {selectedStudent && (((selectedStudent.status || '').toUpperCase() === 'WITHDRAWN') || ((selectedStudent.status || '').toUpperCase() === 'TRANSFERRED')) && (
                <Button
                  variant="outline"
                  onClick={() => { const s = selectedStudent; setSelectedStudent(null); setReEnrollModalStudent(s); }}
                  className="flex-1 h-11 rounded-xl border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 font-bold text-sm min-w-[110px]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-Enroll
                </Button>
              )}
              <Button
                onClick={() => setSelectedStudent(null)}
                className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-sm shadow-lg min-w-[80px]"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <Dialog open={!!confirmingDeleteId} onOpenChange={(open) => !open && setConfirmingDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-center typography-page-title">Delete Student?</DialogTitle>
            <DialogDescription className="text-center typography-label text-slate-500">
              Are you sure you want to remove this student? This action will permanently delete all attendance records and parent links associated with them.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-6">
            <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setConfirmingDeleteId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700"
              onClick={() => confirmingDeleteId && executeDelete(confirmingDeleteId)}
            >
              Confirm Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registration Confirmation Dialog */}
      <Dialog open={!!registrationConfirmation} onOpenChange={(open) => !open && setRegistrationConfirmation(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 overflow-hidden">
          <DialogHeader className="text-center sm:text-center pb-2">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-purple-500/25">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">
              Student Registered Successfully!
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Portal account has been created. Provide the activation details below to the student.
            </DialogDescription>
          </DialogHeader>

          {registrationConfirmation && (
            <div className="space-y-4 pt-2">
              {/* Student Summary Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Student</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {registrationConfirmation.name || registrationConfirmation.fullName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Grade {registrationConfirmation.grade} - Section {registrationConfirmation.section}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Student ID</p>
                  <code className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">
                    {registrationConfirmation.student_id}
                  </code>
                </div>
              </div>

              {/* Activation Code Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 via-purple-50/50 to-indigo-50/50 dark:from-purple-950/40 dark:via-purple-950/20 dark:to-indigo-950/30 border-2 border-purple-200 dark:border-purple-800/60 text-center space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    One-Time Activation Code
                  </span>
                  <Badge variant="outline" className="text-[9px] text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 border-purple-200">
                    Valid for 30 Days
                  </Badge>
                </div>

                <div className="py-2 px-3 bg-white dark:bg-slate-950 rounded-xl border border-purple-100 dark:border-purple-900 flex items-center justify-center gap-3">
                  <span className="text-2xl font-black font-mono tracking-[0.25em] text-purple-900 dark:text-purple-100 pl-2">
                    {registrationConfirmation.activationCode || registrationConfirmation.activation_code || '—'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(registrationConfirmation.activationCode || registrationConfirmation.activation_code || '', 'confirm-code')}
                    className="h-8 px-2 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
                  >
                    {copiedKey === 'confirm-code' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-bold text-purple-900 dark:text-purple-200">Instructions for the student:</p>
                <p className="leading-relaxed text-[11px]">
                  Instruct the student to visit <strong className="text-purple-700 dark:text-purple-300">brightpath.edu.et/student/activate</strong>, enter their Student ID (<code className="font-mono text-purple-800 dark:text-purple-200">{registrationConfirmation.student_id}</code>) and activation code to activate their account and choose a personal password.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <Button
                  onClick={() => printActivationSlip({
                    student_id: registrationConfirmation.student_id,
                    fullName: registrationConfirmation.name || registrationConfirmation.fullName,
                    grade: registrationConfirmation.grade,
                    section: registrationConfirmation.section,
                    activationCode: registrationConfirmation.activationCode || registrationConfirmation.activation_code,
                    expiresAt: registrationConfirmation.activation_code_expires || registrationConfirmation.activationSlip?.expiresAt,
                  })}
                  className="flex-1 h-11 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs gap-2 shadow-lg shadow-purple-700/20"
                >
                  <Printer className="w-4 h-4" />
                  Print Activation Slip
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRegistrationConfirmation(null)}
                  className="h-11 px-5 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Lifecycle Status & Re-Enroll Modals */}
      <ChangeStatusModal
        isOpen={!!statusModalStudent}
        onClose={() => setStatusModalStudent(null)}
        student={statusModalStudent}
        onSuccess={() => loadStudents(false, true)}
      />
      <StatusHistoryModal
        isOpen={!!historyModalStudent}
        onClose={() => setHistoryModalStudent(null)}
        student={historyModalStudent}
      />
      <ReEnrollModal
        isOpen={!!reEnrollModalStudent}
        onClose={() => setReEnrollModalStudent(null)}
        student={reEnrollModalStudent}
        activeAcademicYear={activeAcademicYear}
        onSuccess={() => loadStudents(false, true)}
      />

      {/* Mobile Floating Action Button */}
      {!isTeacher && (
        <div className="md:hidden fixed bottom-24 right-6 z-50">
          <Button
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="h-14 w-14 rounded-full bg-primary text-white shadow-2xl shadow-primary/40 flex items-center justify-center p-0 active:scale-90 transition-all"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
        </div>
      </DataStateView>
    </>
  )
}

