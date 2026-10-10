'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Award,
  TrendingUp,
  Percent,
  Users,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Send,
  Info,
  Lock,
  Unlock,
  Printer,
  Download,
  BarChart3,
  MoreVertical,
  Calendar,
  ArrowLeft,
  Check,
  X,
  FileText,
  SlidersHorizontal,
  Layers,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import {
  gradebookService,
  ClassGradebookData,
  ClassGradebookAssessment,
  ClassGradebookStudentRow,
  ClassGradebookCategorySummary,
} from '@/lib/gradebook-service';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Helper for category styling & badges
function getCategoryTheme(name: string, index: number) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('quiz')) {
    return {
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      border: 'border-purple-200 dark:border-purple-800/40',
      text: 'text-purple-700 dark:text-purple-300',
      badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
      headerBg: 'bg-purple-100/60 dark:bg-purple-950/40',
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
      accent: '#8b5cf6',
      icon: Award,
    };
  }
  if (lower.includes('assign') || lower.includes('homework')) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-800/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
      headerBg: 'bg-emerald-100/60 dark:bg-emerald-950/40',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50',
      accent: '#10b981',
      icon: FileText,
    };
  }
  if (lower.includes('test') || lower.includes('midterm')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800/40',
      text: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      headerBg: 'bg-amber-100/60 dark:bg-amber-950/40',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
      accent: '#f59e0b',
      icon: SlidersHorizontal,
    };
  }
  if (lower.includes('project') || lower.includes('lab') || lower.includes('practical')) {
    return {
      bg: 'bg-cyan-50 dark:bg-cyan-950/20',
      border: 'border-cyan-200 dark:border-cyan-800/40',
      text: 'text-cyan-700 dark:text-cyan-300',
      badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
      headerBg: 'bg-cyan-100/60 dark:bg-cyan-950/40',
      iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50',
      accent: '#06b6d4',
      icon: Layers,
    };
  }
  if (lower.includes('exam') || lower.includes('final')) {
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      border: 'border-rose-200 dark:border-rose-800/40',
      text: 'text-rose-700 dark:text-rose-300',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
      headerBg: 'bg-rose-100/60 dark:bg-rose-950/40',
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
      accent: '#f43f5e',
      icon: GraduationCap,
    };
  }
  const palettes = [
    {
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      border: 'border-indigo-200 dark:border-indigo-800/40',
      text: 'text-indigo-700 dark:text-indigo-300',
      badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
      headerBg: 'bg-indigo-100/60 dark:bg-indigo-950/40',
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50',
      accent: '#6366f1',
      icon: Sparkles,
    },
    {
      bg: 'bg-teal-50 dark:bg-teal-950/20',
      border: 'border-teal-200 dark:border-teal-800/40',
      text: 'text-teal-700 dark:text-teal-300',
      badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
      headerBg: 'bg-teal-100/60 dark:bg-teal-950/40',
      iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/50',
      accent: '#14b8a6',
      icon: Award,
    },
  ];
  return palettes[index % palettes.length];
}

interface EditableCell {
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  remarks: string;
}

export default function TeacherGradebookPage() {
  // Selector options
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [teacherName, setTeacherName] = useState<string>('Assigned Teacher');

  // Selected filter states
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Main Gradebook Matrix Data
  const [gradebookData, setGradebookData] = useState<ClassGradebookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'assessments' | 'markEntry'>('markEntry');

  // Local Editable Marks State: [studentId][assessmentId] => cell
  const [localMarks, setLocalMarks] = useState<Record<string, Record<string, EditableCell>>>({});
  // Dirty cells set: Set of "studentId:assessmentId"
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedStudentForBreakdown, setSelectedStudentForBreakdown] = useState<ClassGradebookStudentRow | null>(null);

  // New assessment form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newType, setNewType] = useState('TEST');
  const [newMaxScore, setNewMaxScore] = useState(20);
  const [newWeightage, setNewWeightage] = useState(10);
  const [newDate, setNewDate] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Single remarks edit modal
  const [remarkModalStudent, setRemarkModalStudent] = useState<{
    student: { id: string; fullName: string };
    assessment: ClassGradebookAssessment;
    currentRemarks: string;
  } | null>(null);

  // Load Initial Academic Years and Teacher Assignments
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('attendance_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      // Parallel fetch academic years, teacher classes, fallback grades & subjects
      const [ayRes, portalRes, gradesRes, subjectsRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/assignments/teacher-portal/classes`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/settings/subjects`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      // 1. Academic Years
      if (ayRes?.success && Array.isArray(ayRes.data) && ayRes.data.length > 0) {
        setAcademicYears(ayRes.data);
        const currentYear = ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        setSelectedYearId(currentYear.id);
        const currentTerm = currentYear.terms?.find((t: any) => t.isCurrent) || currentYear.terms?.[0];
        if (currentTerm) setSelectedTermId(currentTerm.id);
      }

      // 2. Teacher assignments
      const assignments: any[] = portalRes?.success && Array.isArray(portalRes.data?.assignments)
        ? portalRes.data.assignments
        : [];
      setTeacherAssignments(assignments);

      if (assignments.length > 0) {
        // Teacher name
        const firstTeacher = assignments[0]?.teacher;
        if (firstTeacher?.name) setTeacherName(firstTeacher.name);

        // Build unique grades
        const gradeMap = new Map<string, any>();
        for (const a of assignments) {
          if (a.grade && !gradeMap.has(a.gradeId)) {
            gradeMap.set(a.gradeId, a.grade);
          }
        }
        const uniqueGrades = Array.from(gradeMap.values());
        setGrades(uniqueGrades);
        if (uniqueGrades.length > 0) {
          setSelectedGradeId(uniqueGrades[0].id);
        }
      } else {
        // Fallback for Admin or unassigned teachers
        if (gradesRes?.success && Array.isArray(gradesRes.data)) {
          setGrades(gradesRes.data);
          if (gradesRes.data.length > 0) setSelectedGradeId(gradesRes.data[0].id);
        }
        if (subjectsRes?.success && Array.isArray(subjectsRes.data)) {
          setSubjects(subjectsRes.data);
          if (subjectsRes.data.length > 0) setSelectedSubjectId(subjectsRes.data[0].id);
        }
      }
    } catch (err: any) {
      notifications.error('Failed to load initial data', err?.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // When selected grade changes: compute available sections and subjects
  useEffect(() => {
    if (!selectedGradeId) return;

    if (teacherAssignments.length > 0) {
      // Sections from assignments for this grade
      const sectionMap = new Map<string, any>();
      for (const a of teacherAssignments) {
        if (a.gradeId === selectedGradeId && a.section) {
          sectionMap.set(a.sectionId, a.section);
        }
      }
      const uniqueSections = Array.from(sectionMap.values());
      setSections(uniqueSections);
      setSelectedSectionId(uniqueSections.length > 0 ? uniqueSections[0].id : '');

      // Subjects from assignments for this grade
      const subjectMap = new Map<string, any>();
      for (const a of teacherAssignments) {
        if (a.gradeId === selectedGradeId) {
          if (a.subjectRef) {
            subjectMap.set(a.subjectRef.id, a.subjectRef);
          } else if (a.subject) {
            subjectMap.set(a.subject, { id: a.subject, name: a.subject, code: a.subject });
          }
        }
      }
      const uniqueSubjects = Array.from(subjectMap.values());
      setSubjects(uniqueSubjects);
      setSelectedSubjectId(uniqueSubjects.length > 0 ? uniqueSubjects[0].id : '');
    } else {
      // Fallback: Fetch sections for grade
      const fetchSections = async () => {
        try {
          const token = localStorage.getItem('attendance_token');
          const { getApiUrl } = await import('@/lib/api-config');
          const res = await fetch(`${getApiUrl()}/api/schools/sections?gradeId=${selectedGradeId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).then((r) => r.json());
          if (res?.success && Array.isArray(res.data)) {
            setSections(res.data);
            if (res.data.length > 0) setSelectedSectionId(res.data[0].id);
          }
        } catch {}
      };
      fetchSections();
    }
  }, [selectedGradeId, teacherAssignments]);

  // Load the full Class Gradebook Matrix whenever context selectors change
  useEffect(() => {
    if (!selectedYearId || !selectedGradeId || !selectedSectionId || !selectedSubjectId) {
      return;
    }
    loadClassGradebook();
  }, [selectedYearId, selectedTermId, selectedGradeId, selectedSectionId, selectedSubjectId]);

  const loadClassGradebook = async () => {
    try {
      setLoading(true);
      const data = await gradebookService.getClassGradebook({
        academicYearId: selectedYearId,
        academicTermId: selectedTermId || undefined,
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
      });

      setGradebookData(data);

      // Initialize local editable marks state
      const initialMarks: Record<string, Record<string, EditableCell>> = {};
      data.students.forEach((row) => {
        initialMarks[row.student.id] = {};
        data.assessments.forEach((ass) => {
          const markRecord = row.marks[ass.id];
          initialMarks[row.student.id][ass.id] = {
            score: markRecord?.score ?? null,
            isAbsent: markRecord?.isAbsent ?? false,
            isExcused: markRecord?.status === 'EXCUSED',
            remarks: markRecord?.remarks ?? '',
          };
        });
      });

      setLocalMarks(initialMarks);
      setDirtyCells(new Set());
      setCurrentPage(1);

      // Pre-select category for assessment creation if scheme has categories
      if (data.scheme?.categories?.length > 0) {
        setNewCategoryId(data.scheme.categories[0].id);
      }
    } catch (err: any) {
      notifications.error('Gradebook Load Error', err?.message || 'Failed to load gradebook');
    } finally {
      setLoading(false);
    }
  };

  // Warn on unsaved changes before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyCells.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyCells]);

  // Read-only lock status based on submissionRecord
  const submissionStatus = gradebookData?.submissionRecord?.status || 'DRAFT';
  const isLocked = submissionStatus === 'SUBMITTED' || submissionStatus === 'APPROVED' || submissionStatus === 'PUBLISHED';
  const isReturned = submissionStatus === 'RETURNED';

  // Handle Mark Cell Change (Instant client calculation & dirty tracking)
  const handleCellChange = useCallback(
    (studentId: string, assessmentId: string, value: string, maxScore: number) => {
      if (isLocked) return;

      setLocalMarks((prev) => {
        const studentRow = prev[studentId] || {};
        const cell = studentRow[assessmentId] || { score: null, isAbsent: false, isExcused: false, remarks: '' };

        const trimmed = value.trim().toLowerCase();
        let updated: EditableCell;

        if (trimmed === '') {
          updated = { ...cell, score: null, isAbsent: false, isExcused: false };
        } else if (trimmed === 'a' || trimmed === 'abs') {
          updated = { ...cell, score: 0, isAbsent: true, isExcused: false };
        } else if (trimmed === 'e' || trimmed === 'exc') {
          updated = { ...cell, score: null, isAbsent: false, isExcused: true };
        } else {
          const num = parseFloat(trimmed);
          if (isNaN(num)) {
            updated = cell; // Ignore invalid keystroke
          } else {
            const clamped = Math.max(0, Math.min(num, maxScore));
            updated = { ...cell, score: clamped, isAbsent: false, isExcused: false };
          }
        }

        return {
          ...prev,
          [studentId]: {
            ...studentRow,
            [assessmentId]: updated,
          },
        };
      });

      setDirtyCells((prev) => {
        const next = new Set(prev);
        next.add(`${studentId}:${assessmentId}`);
        return next;
      });
    },
    [isLocked]
  );

  // Keyboard navigation across cells
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
    totalRows: number,
    totalCols: number
  ) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextRow = Math.min(rowIndex + 1, totalRows - 1);
      const nextInput = document.getElementById(`cell-${nextRow}-${colIndex}`);
      nextInput?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = Math.max(rowIndex - 1, 0);
      const prevInput = document.getElementById(`cell-${prevRow}-${colIndex}`);
      prevInput?.focus();
    } else if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart === e.currentTarget.value.length || !e.currentTarget.value)) {
      if (colIndex < totalCols - 1) {
        e.preventDefault();
        const nextInput = document.getElementById(`cell-${rowIndex}-${colIndex + 1}`);
        nextInput?.focus();
      }
    } else if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart === 0 || !e.currentTarget.value)) {
      if (colIndex > 0) {
        e.preventDefault();
        const prevInput = document.getElementById(`cell-${rowIndex}-${colIndex - 1}`);
        prevInput?.focus();
      }
    }
  };

  // Live client-side percentage-weighted calculation for student rows
  const computedStudents = useMemo(() => {
    if (!gradebookData) return [];
    const assessments = gradebookData.assessments;
    const categories = gradebookData.scheme?.categories || [];

    return gradebookData.students.map((studentRow) => {
      const studentId = studentRow.student.id;
      const currentMarks = localMarks[studentId] || {};

      let allAssessmentsEntered = true;
      let missingCount = 0;
      let absentCount = 0;

      // Group assessments by category
      const categoryResults: Record<
        string,
        { earned: number; max: number; count: number; assessedCount: number; weight: number }
      > = {};

      categories.forEach((cat) => {
        categoryResults[cat.id] = { earned: 0, max: 0, count: 0, assessedCount: 0, weight: cat.weight };
      });

      assessments.forEach((ass) => {
        const catId = ass.categoryId || 'uncategorized';
        if (!categoryResults[catId]) {
          categoryResults[catId] = { earned: 0, max: 0, count: 0, assessedCount: 0, weight: 0 };
        }
        categoryResults[catId].count += 1;

        const cell = currentMarks[ass.id];
        if (!cell || (cell.score === null && !cell.isAbsent && !cell.isExcused)) {
          allAssessmentsEntered = false;
          missingCount += 1;
        } else {
          categoryResults[catId].assessedCount += 1;
          if (cell.isAbsent) {
            absentCount += 1;
            categoryResults[catId].earned += 0;
            categoryResults[catId].max += ass.maxScore;
          } else if (cell.isExcused) {
            // Excused omits from denominator unless all excused
          } else if (cell.score !== null) {
            categoryResults[catId].earned += cell.score;
            categoryResults[catId].max += ass.maxScore;
          }
        }
      });

      // Calculate category percentages & weighted sum
      let provisionalWeightedTotal = 0;
      let finalWeightedTotal: number | null = 0;

      categories.forEach((cat) => {
        const res = categoryResults[cat.id];
        if (res && res.max > 0) {
          const catPct = (res.earned / res.max) * 100;
          const contribution = (catPct * cat.weight) / 100;
          provisionalWeightedTotal += contribution;
        }
      });

      // If missing assessments exist, finalScore is null (provisional only)
      if (!allAssessmentsEntered || assessments.length === 0) {
        finalWeightedTotal = null;
      } else {
        finalWeightedTotal = Math.round(provisionalWeightedTotal * 10) / 10;
      }

      const isComplete = allAssessmentsEntered && assessments.length > 0;

      return {
        ...studentRow,
        computed: {
          isComplete,
          missingCount,
          absentCount,
          provisionalWeightedTotal: Math.round(provisionalWeightedTotal * 10) / 10,
          finalWeightedTotal,
        },
      };
    });
  }, [gradebookData, localMarks]);

  // Filtered rows by search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return computedStudents;
    const q = searchQuery.toLowerCase();
    return computedStudents.filter(
      (r) =>
        r.student.fullName.toLowerCase().includes(q) ||
        r.student.student_id.toLowerCase().includes(q)
    );
  }, [computedStudents, searchQuery]);

  // Paginated students
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));

  // Overall Statistics calculated dynamically
  const liveStats = useMemo(() => {
    const totalStudents = computedStudents.length;
    const completeCount = computedStudents.filter((s) => s.computed.isComplete).length;
    const missingCount = computedStudents.filter((s) => !s.computed.isComplete).length;
    const absentCount = computedStudents.filter((s) => s.computed.absentCount > 0).length;

    const completedScores = computedStudents
      .map((s) => s.computed.finalWeightedTotal)
      .filter((s): s is number => s !== null);

    const classAverage = completedScores.length > 0
      ? Math.round((completedScores.reduce((a, b) => a + b, 0) / completedScores.length) * 10) / 10
      : (gradebookData?.statistics?.classAverage ?? 0);

    const highestScore = completedScores.length > 0
      ? Math.max(...completedScores)
      : (gradebookData?.statistics?.highestScore ?? 0);

    const lowestScore = completedScores.length > 0
      ? Math.min(...completedScores)
      : (gradebookData?.statistics?.lowestScore ?? 0);

    const completionRate = totalStudents > 0
      ? Math.round((completeCount / totalStudents) * 100)
      : 0;

    return {
      totalStudents,
      completeCount,
      missingCount,
      absentCount,
      classAverage,
      highestScore,
      lowestScore,
      completionRate,
    };
  }, [computedStudents, gradebookData]);

  // Save Marks (Atomically across all assessments)
  const handleSaveMarks = async () => {
    if (isLocked) {
      notifications.error('Gradebook Locked', 'Marks cannot be edited after submission.');
      return;
    }
    if (!selectedYearId || !selectedGradeId || !selectedSectionId || !selectedSubjectId) {
      notifications.error('Validation', 'Please select class, section, and subject');
      return;
    }

    try {
      setSaving(true);
      // Flatten all local marks
      const marksPayload: Array<{
        assessmentId: string;
        studentId: string;
        score: number | null;
        isAbsent?: boolean;
        status?: string;
        remarks?: string;
      }> = [];

      Object.entries(localMarks).forEach(([studentId, assessmentsMap]) => {
        Object.entries(assessmentsMap).forEach(([assessmentId, cell]) => {
          marksPayload.push({
            assessmentId,
            studentId,
            score: cell.isAbsent ? 0 : cell.score,
            isAbsent: cell.isAbsent,
            status: cell.isExcused ? 'EXCUSED' : cell.isAbsent ? 'ABSENT' : cell.score !== null ? 'PRESENT' : 'UNGRADED',
            remarks: cell.remarks,
          });
        });
      });

      const res = await gradebookService.saveClassMarks({
        academicYearId: selectedYearId,
        academicTermId: selectedTermId || undefined,
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        marks: marksPayload,
      });

      notifications.success('Marks Saved', `${res.updatedCount} marks successfully saved as draft!`);
      setDirtyCells(new Set());
      await loadClassGradebook();
    } catch (err: any) {
      notifications.error('Save Failed', err?.message || 'Error occurred while saving marks');
    } finally {
      setSaving(false);
    }
  };

  // Submit for Administrator Approval
  const handleSubmitForApproval = async () => {
    if (!selectedYearId || !selectedGradeId || !selectedSectionId || !selectedSubjectId) {
      notifications.error('Validation', 'Please select full academic context');
      return;
    }

    try {
      setSaving(true);
      // Auto-save marks first if dirty
      if (dirtyCells.size > 0) {
        await handleSaveMarks();
      }

      await gradebookService.teacherSubmitMarks({
        academicYearId: selectedYearId,
        academicTermId: selectedTermId || '',
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        notes: `Submitted by teacher for term evaluation`,
      });

      notifications.success('Submitted for Approval', 'Your gradebook has been submitted to the School Administrator.');
      setSubmitModalOpen(false);
      await loadClassGradebook();
    } catch (err: any) {
      notifications.error('Submission Failed', err?.message || 'Error submitting gradebook');
    } finally {
      setSaving(false);
    }
  };

  // Create New Assessment
  const handleCreateAssessment = async () => {
    if (!newTitle.trim()) {
      notifications.error('Validation', 'Assessment title is required');
      return;
    }
    if (!newCategoryId) {
      notifications.error('Validation', 'Please select an assessment category');
      return;
    }
    if (newMaxScore <= 0) {
      notifications.error('Validation', 'Max marks must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      await gradebookService.createAssessment({
        title: newTitle.trim(),
        type: newType,
        categoryId: newCategoryId,
        maxScore: Number(newMaxScore),
        weightage: Number(newWeightage),
        date: newDate || undefined,
        description: newDescription || undefined,
        gradeId: selectedGradeId,
        sectionId: selectedSectionId || undefined,
        subjectId: selectedSubjectId,
        academicYearId: selectedYearId,
        academicTermId: selectedTermId || undefined,
      });

      notifications.success('Assessment Created', `"${newTitle}" added to gradebook.`);
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewDate('');
      await loadClassGradebook();
    } catch (err: any) {
      notifications.error('Creation Failed', err?.message || 'Error creating assessment');
    } finally {
      setSaving(false);
    }
  };

  // Export to Excel (CSV)
  const handleExportCSV = () => {
    if (!gradebookData || computedStudents.length === 0) {
      notifications.error('Export', 'No gradebook data to export');
      return;
    }

    const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
    const currentGradeObj = grades.find((g) => g.id === selectedGradeId);
    const currentSectionObj = sections.find((s) => s.id === selectedSectionId);
    const currentSubjectObj = subjects.find((s) => s.id === selectedSubjectId);

    const headers = [
      '#',
      'Student ID',
      'Student Name',
      ...gradebookData.assessments.map((a) => `${a.title} (Max ${a.maxScore})`),
      'Weighted Total (%)',
      'Status',
    ];

    const rows = computedStudents.map((row, idx) => {
      const studentScores = gradebookData.assessments.map((a) => {
        const cell = localMarks[row.student.id]?.[a.id];
        if (!cell) return '-';
        if (cell.isAbsent) return 'ABS';
        if (cell.isExcused) return 'EXC';
        return cell.score !== null ? cell.score : '-';
      });

      const finalMark = row.computed.finalWeightedTotal !== null ? `${row.computed.finalWeightedTotal}%` : 'Incomplete';
      const status = row.computed.isComplete ? 'Complete' : 'Missing Marks';

      return [
        idx + 1,
        `"${row.student.student_id}"`,
        `"${row.student.fullName}"`,
        ...studentScores,
        finalMark,
        status,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gradebook_${currentSubjectObj?.name || 'Subject'}_${currentGradeObj?.name || ''}_${currentSectionObj?.name || ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notifications.success('Export Successful', 'Gradebook downloaded as CSV');
  };

  // Print Gradebook
  const handlePrint = () => {
    window.print();
  };

  // Helper labels
  const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
  const currentTerms = currentYearObj?.terms || [];
  const currentTermObj = currentTerms.find((t: any) => t.id === selectedTermId);
  const currentGradeObj = grades.find((g) => g.id === selectedGradeId);
  const currentSectionObj = sections.find((s) => s.id === selectedSectionId);
  const currentSubjectObj = subjects.find((s) => s.id === selectedSubjectId);

  const categories = gradebookData?.scheme?.categories || [];
  const totalSchemeWeight = categories.reduce((sum, c) => sum + (c.weight || 0), 0);
  const assessments = gradebookData?.assessments || [];

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0">
      {/* ── BREADCRUMB & HEADER ─────────────────────────────────────────────────── */}
      <div className="space-y-1.5 print:hidden">
        <Link
          href="/school/teacher"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline transition-colors mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Teacher Gradebook
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enter and manage marks for your assigned classes. The system will calculate category and final subject marks based on the configured weights.
            </p>
          </div>

          {/* Quick status pill if submitted/approved */}
          <div className="flex items-center gap-2">
            {submissionStatus === 'SUBMITTED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <Lock className="w-3.5 h-3.5" />
                Submitted for Review
              </span>
            )}
            {submissionStatus === 'RETURNED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                <AlertCircle className="w-3.5 h-3.5" />
                Returned for Correction
              </span>
            )}
            {(submissionStatus === 'APPROVED' || submissionStatus === 'PUBLISHED') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved & Published
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── RETURNED FEEDBACK BANNER ────────────────────────────────────────────── */}
      {isReturned && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-800 dark:text-rose-200 print:hidden">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-rose-900 dark:text-rose-100">
              Gradebook returned by School Administrator for correction
            </p>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              {gradebookData?.submissionRecord?.rejectionReason || 'Please review missing or inconsistent marks and resubmit.'}
            </p>
          </div>
        </div>
      )}

      {/* ── CONTEXT SELECTORS ROW ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs print:hidden items-end">
        {/* Academic Year */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            Academic Year
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              const y = academicYears.find((ay) => ay.id === e.target.value);
              if (y?.terms?.length > 0) setSelectedTermId(y.terms[0].id);
            }}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Term */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Term
          </label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {currentTerms.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Grade */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Grade
          </label>
          <select
            value={selectedGradeId}
            onChange={(e) => setSelectedGradeId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Section
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Subject
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Assessment Details Button */}
        <div>
          <Button
            variant="outline"
            onClick={() => setDetailsModalOpen(true)}
            className="w-full h-10 rounded-xl text-xs font-semibold gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
          >
            <Info className="w-4 h-4 text-primary" />
            View Assessment Details
          </Button>
        </div>
      </div>

      {/* ── ASSESSMENT CATEGORIES & WEIGHTS DISPLAY (MATCHING MOCKUP) ──────────── */}
      <div className="space-y-2.5 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Assessment Categories & Weights
        </h2>

        {categories.length === 0 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                No administrator weighting scheme configured for this grade and subject. The system is operating in raw marks mode.
              </span>
            </div>
            <span className="text-xs font-semibold underline text-amber-900 dark:text-amber-200">
              Contact School Administrator
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {categories.map((cat, idx) => {
              const theme = getCategoryTheme(cat.name, idx);
              const IconComp = theme.icon;
              return (
                <div
                  key={cat.id}
                  className={`p-3.5 rounded-2xl border transition-all ${theme.bg} ${theme.border} flex items-center gap-3 shadow-xs`}
                >
                  <div className={`p-2.5 rounded-xl border ${theme.iconBg} shrink-0`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">{cat.name}</p>
                    <p className={`text-lg font-extrabold ${theme.text}`}>{cat.weight}%</p>
                  </div>
                </div>
              );
            })}

            {/* Aggregation Method Card (Right side of categories) */}
            <div className="p-3.5 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Aggregation Method
                </span>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {gradebookData?.scheme?.aggregationMethod === 'AVERAGE_OF_ASSESSMENTS'
                    ? 'Assessment Averages'
                    : 'Combined Marks (Default)'}
                </p>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-muted-foreground">Total Weight</span>
                  <span className={`font-bold ${totalSchemeWeight === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                    {totalSchemeWeight}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ASSESSMENTS HEADER & ACTION BAR ────────────────────────────────────── */}
      <div className="space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Assessments for {currentSubjectObj?.name || 'Selected Subject'} ({currentGradeObj?.name || ''} {currentSectionObj?.name || ''})
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Create and manage assessments, then enter marks for your students.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={isLocked}
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5 bg-primary text-primary-foreground shadow-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create Assessment
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={saving || isLocked || dirtyCells.size === 0}
              onClick={handleSaveMarks}
              className="gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : dirtyCells.size > 0 ? `Save Draft (${dirtyCells.size})` : 'Save Draft'}
            </Button>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 font-semibold">
                  <span>More Actions</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={handleSaveMarks}
                  disabled={saving || isLocked}
                  className="gap-2 cursor-pointer font-medium"
                >
                  <Save className="w-4 h-4 text-emerald-600" />
                  <span>Save All Marks</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setSubmitModalOpen(true)}
                  disabled={saving || isLocked}
                  className="gap-2 cursor-pointer font-medium text-primary"
                >
                  <Send className="w-4 h-4 text-primary" />
                  <span>Submit for Approval</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={loadClassGradebook} className="gap-2 cursor-pointer">
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh Marks</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Export to Excel (CSV)</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
                  <Printer className="w-4 h-4" />
                  <span>Print Gradebook</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View Tabs & Category Summary Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('assessments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'assessments'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Assessments ({assessments.length})
            </button>
            <button
              onClick={() => setActiveTab('markEntry')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'markEntry'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mark Entry Grid
            </button>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {dirtyCells.size > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {dirtyCells.size} Unsaved Changes
              </span>
            )}
          </div>
        </div>

        {/* Category Pill Cards with count & average percentage */}
        {gradebookData?.scheme?.categorySummaries && gradebookData.scheme.categorySummaries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {gradebookData.scheme.categorySummaries.map((catSummary, idx) => {
              const theme = getCategoryTheme(catSummary.name, idx);
              const IconComp = theme.icon;
              return (
                <div
                  key={catSummary.id}
                  className={`p-3 rounded-2xl border transition-all ${theme.bg} ${theme.border} flex items-center justify-between shadow-xs`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-xl ${theme.iconBg} shrink-0`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{catSummary.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {catSummary.assessmentCount} {catSummary.assessmentCount === 1 ? 'assessment' : 'assessments'}
                      </p>
                      <p className={`text-xs font-extrabold mt-0.5 ${theme.text}`}>
                        Avg. {catSummary.averagePercentage}%
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {/* Mark Entry Progress Notification Bar (Matching mockup) */}
        <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-foreground mr-1.5">Mark Entry Progress</span>
              <span className="text-muted-foreground">
                {liveStats.completeCount} of {liveStats.totalStudents} students have all marks entered ({liveStats.completionRate}%).
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:w-64">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${liveStats.completionRate}%` }}
              />
            </div>
            <span className="font-bold text-foreground w-10 text-right">{liveStats.completionRate}%</span>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE AREA: 2-COLUMN LAYOUT (TABLE + SIDEBAR) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* ── LEFT COLUMN: SPREADSHEET GRID TABLE (Span 3) ───────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 print:hidden">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student by name or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 rounded-xl text-xs bg-background"
                />
              </div>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>
                  <strong>Tip:</strong> Press <strong>Arrows</strong> to navigate cells. Type <strong>ABS</strong> for absent, <strong>EXC</strong> for excused.
                </span>
              </div>
            </div>

            {/* Multi-Assessment Grid Table */}
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 w-24">Student ID</th>
                    <th className="py-3 px-4 min-w-[150px]">Student Name</th>

                    {/* Dynamic Columns for each Assessment */}
                    {assessments.length === 0 ? (
                      <th className="py-3 px-4 text-muted-foreground italic text-center">
                        No assessments created yet
                      </th>
                    ) : (
                      assessments.map((ass, aIdx) => {
                        const theme = getCategoryTheme(ass.categoryName || '', aIdx);
                        return (
                          <th
                            key={ass.id}
                            className={`py-2 px-3 text-center min-w-[95px] max-w-[120px] border-l border-border/50 ${theme.headerBg}`}
                          >
                            <div className="font-bold text-foreground truncate" title={ass.title}>
                              {ass.title}
                            </div>
                            <div className={`text-[10px] font-bold ${theme.text}`}>
                              ({ass.maxScore})
                            </div>
                          </th>
                        );
                      })
                    )}

                    {/* Total (100) Column */}
                    <th className="py-3 px-4 w-24 text-center border-l border-border bg-primary/5 font-extrabold text-foreground">
                      Total (100)
                    </th>

                    {/* Status Column */}
                    <th className="py-3 px-3 w-28 text-center border-l border-border">
                      Status
                    </th>

                    {/* Actions Menu */}
                    <th className="py-3 px-2 w-10 text-center print:hidden"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6 + assessments.length} className="py-16 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                          <span>Loading gradebook and calculating weighted marks...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6 + assessments.length} className="py-16 text-center text-muted-foreground">
                        No students enrolled in this class and section.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((row, rIdx) => {
                      const student = row.student;
                      const globalRowIdx = (currentPage - 1) * pageSize + rIdx;
                      const isComplete = row.computed.isComplete;
                      const finalTotal = row.computed.finalWeightedTotal;

                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          {/* Row Number */}
                          <td className="py-2 px-3 text-center text-muted-foreground text-[11px]">
                            {globalRowIdx + 1}
                          </td>

                          {/* Student ID */}
                          <td className="py-2 px-3 font-mono text-[11px] font-semibold text-muted-foreground">
                            {student.student_id}
                          </td>

                          {/* Student Name */}
                          <td className="py-2 px-4 font-semibold text-foreground truncate max-w-[180px]">
                            {student.fullName}
                          </td>

                          {/* Assessment Inputs */}
                          {assessments.map((ass, cIdx) => {
                            const cell = localMarks[student.id]?.[ass.id] || {
                              score: null,
                              isAbsent: false,
                              isExcused: false,
                              remarks: '',
                            };
                            const isDirty = dirtyCells.has(`${student.id}:${ass.id}`);
                            const displayValue = cell.isAbsent
                              ? 'ABS'
                              : cell.isExcused
                              ? 'EXC'
                              : cell.score !== null
                              ? cell.score.toString()
                              : '';

                            return (
                              <td
                                key={ass.id}
                                className={`py-1 px-1.5 text-center border-l border-border/40 ${
                                  isDirty ? 'bg-amber-500/10' : ''
                                }`}
                              >
                                <input
                                  id={`cell-${rIdx}-${cIdx}`}
                                  type="text"
                                  disabled={isLocked}
                                  value={displayValue}
                                  onChange={(e) =>
                                    handleCellChange(student.id, ass.id, e.target.value, ass.maxScore)
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, rIdx, cIdx, paginatedStudents.length, assessments.length)
                                  }
                                  placeholder="-"
                                  className={`w-full h-8 px-1 text-center font-bold text-xs rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                                    isLocked
                                      ? 'bg-transparent text-foreground cursor-not-allowed'
                                      : cell.isAbsent
                                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 font-extrabold'
                                      : cell.isExcused
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-extrabold'
                                      : cell.score !== null
                                      ? 'bg-background text-foreground hover:bg-muted/50 border border-input/60'
                                      : 'bg-muted/40 text-muted-foreground border border-dashed border-input/50'
                                  }`}
                                />
                              </td>
                            );
                          })}

                          {/* Total (100) Weighted Score Column */}
                          <td className="py-2 px-4 text-center border-l border-border font-extrabold bg-primary/5">
                            {finalTotal !== null ? (
                              <span className="text-foreground text-xs">{finalTotal}</span>
                            ) : (
                              <span
                                className="text-muted-foreground text-[11px] italic"
                                title={`Provisional: ${row.computed.provisionalWeightedTotal} (in progress)`}
                              >
                                -
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2 px-3 text-center border-l border-border">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                <Check className="w-3 h-3" />
                                Complete
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400">
                                ↓ Missing Marks
                              </span>
                            )}
                          </td>

                          {/* Actions Column (⋮) */}
                          <td className="py-2 px-2 text-center print:hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-muted"
                                >
                                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => setSelectedStudentForBreakdown(row)}
                                  className="gap-2 cursor-pointer text-xs font-semibold"
                                >
                                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                                  <span>View Breakdown</span>
                                </DropdownMenuItem>

                                {assessments.length > 0 && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setRemarkModalStudent({
                                        student: { id: student.id, fullName: student.fullName },
                                        assessment: assessments[0],
                                        currentRemarks:
                                          localMarks[student.id]?.[assessments[0].id]?.remarks || '',
                                      })
                                    }
                                    className="gap-2 cursor-pointer text-xs font-semibold"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Add Remarks</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="p-3 sm:p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground print:hidden">
              <div>
                Showing{' '}
                <strong>{filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
                <strong>{Math.min(currentPage * pageSize, filteredStudents.length)}</strong> of{' '}
                <strong>{filteredStudents.length}</strong> students
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 rounded-lg text-xs"
                  >
                    ‹
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-8 w-8 p-0 rounded-lg text-xs font-bold"
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2.5 rounded-lg text-xs"
                  >
                    ›
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: SIDEBAR (SUMMARY, STATS & QUICK ACTIONS) ─────────────── */}
        <div className="space-y-4 print:hidden">
          {/* Card 1: Subject Summary & Statistics */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-primary font-bold text-sm border-b border-border/60 pb-3">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Subject Summary</span>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-foreground">
                {currentSubjectObj?.name || 'Mathematics'}
              </h3>
              <div className="grid grid-cols-2 gap-y-2 mt-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Grade</span>
                  <span className="font-bold text-foreground">{currentGradeObj?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Section</span>
                  <span className="font-bold text-foreground">{currentSectionObj?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Teacher</span>
                  <span className="font-bold text-foreground truncate block">{teacherName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Academic Year</span>
                  <span className="font-bold text-foreground">{currentYearObj?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Term</span>
                  <span className="font-bold text-foreground">{currentTermObj?.name || '-'}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Subject Statistics
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Total Students
                  </span>
                  <span className="font-bold text-foreground">{liveStats.totalStudents}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Complete Results
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {liveStats.completeCount} ({liveStats.completionRate}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Missing Marks
                  </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {liveStats.missingCount} ({100 - liveStats.completionRate}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Absent / Excused
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {liveStats.absentCount}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">Average Subject Mark</span>
                  <span className="font-extrabold text-foreground">{liveStats.classAverage}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Highest Mark</span>
                  <span className="font-bold text-foreground">{liveStats.highestScore}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lowest Mark</span>
                  <span className="font-bold text-foreground">{liveStats.lowestScore}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Quick Actions */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm border-b border-border/60 pb-2.5">
              <Sparkles className="w-4 h-4" />
              <span>Quick Actions</span>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReportModalOpen(true)}
                className="w-full justify-start gap-2.5 h-9 rounded-xl text-xs font-semibold"
              >
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>View Report</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="w-full justify-start gap-2.5 h-9 rounded-xl text-xs font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export to Excel</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="w-full justify-start gap-2.5 h-9 rounded-xl text-xs font-semibold"
              >
                <Download className="w-4 h-4 text-rose-600" />
                <span>Export to PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="w-full justify-start gap-2.5 h-9 rounded-xl text-xs font-semibold"
              >
                <Printer className="w-4 h-4 text-muted-foreground" />
                <span>Print Gradebook</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CREATE ASSESSMENT MODAL ────────────────────────────────────────────── */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="w-4 h-4 text-primary" />
              Create Assessment Component
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new assessment within your assigned subject and permitted category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold">Assessment Title *</Label>
              <Input
                placeholder="e.g. Quiz 3, Chapter Test 2, Group Project"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Category (Weight Scheme) *</Label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full h-9 px-3 mt-1 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-primary"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight}% weight)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Assessment Type</Label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full h-9 px-3 mt-1 rounded-xl border border-input bg-background text-xs font-medium"
                >
                  <option value="QUIZ">Quiz</option>
                  <option value="ASSIGNMENT">Assignment</option>
                  <option value="TEST">Class Test</option>
                  <option value="PROJECT">Project</option>
                  <option value="MIDTERM">Midterm</option>
                  <option value="FINAL">Final Exam</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">Max Marks (Points) *</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(Number(e.target.value))}
                  className="mt-1 h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Assessment Date (Optional)</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Description / Instructions</Label>
              <Input
                placeholder="Optional instructions for students or homeroom record"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleCreateAssessment}
              className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
            >
              {saving ? 'Creating...' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VIEW ASSESSMENT DETAILS MODAL ───────────────────────────────────────── */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Info className="w-4 h-4 text-primary" />
              Assessment Configuration Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Administrator-configured assessment weighting scheme for {currentSubjectObj?.name} ({currentGradeObj?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheme Name:</span>
                <span className="font-bold text-foreground">{gradebookData?.scheme?.name || 'Default Weight Scheme'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aggregation Method:</span>
                <span className="font-bold text-foreground">
                  {gradebookData?.scheme?.aggregationMethod === 'AVERAGE_OF_ASSESSMENTS'
                    ? 'Average of Assessments'
                    : 'Combined Marks (Sum of earned ÷ sum of max × 100)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Configured Weight:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalSchemeWeight}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Configured Categories & Weights
              </h4>
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted/40 font-bold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-center">Weight</th>
                      <th className="py-2.5 px-3 text-center">Assessments</th>
                      <th className="py-2.5 px-3 text-right">Class Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {categories.map((c, idx) => {
                      const summary = gradebookData?.scheme?.categorySummaries?.find((s) => s.id === c.id);
                      return (
                        <tr key={c.id}>
                          <td className="py-2.5 px-3 font-semibold">{c.name}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-primary">{c.weight}%</td>
                          <td className="py-2.5 px-3 text-center">{summary?.assessmentCount ?? 0}</td>
                          <td className="py-2.5 px-3 text-right font-bold">{summary?.averagePercentage ?? 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailsModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── STUDENT CALCULATION BREAKDOWN MODAL ─────────────────────────────────── */}
      <Dialog
        open={!!selectedStudentForBreakdown}
        onOpenChange={(open) => !open && setSelectedStudentForBreakdown(null)}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BarChart3 className="w-4 h-4 text-primary" />
              Weighted Calculation Breakdown
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedStudentForBreakdown?.student.fullName} ({selectedStudentForBreakdown?.student.student_id})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-muted/40 font-bold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Weight</th>
                    <th className="py-2.5 px-3 text-center">Result</th>
                    <th className="py-2.5 px-3 text-right">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {categories.map((cat) => {
                    const studentId = selectedStudentForBreakdown?.student.id || '';
                    const catAssessments = assessments.filter((a) => a.categoryId === cat.id);
                    let earned = 0;
                    let max = 0;
                    let allEntered = true;

                    catAssessments.forEach((a) => {
                      const cell = localMarks[studentId]?.[a.id];
                      if (!cell || (cell.score === null && !cell.isAbsent && !cell.isExcused)) {
                        allEntered = false;
                      } else if (cell.isAbsent) {
                        max += a.maxScore;
                      } else if (cell.score !== null) {
                        earned += cell.score;
                        max += a.maxScore;
                      }
                    });

                    const pct = max > 0 ? Math.round((earned / max) * 1000) / 10 : null;
                    const contrib = pct !== null ? Math.round(((pct * cat.weight) / 100) * 10) / 10 : 0;

                    return (
                      <tr key={cat.id}>
                        <td className="py-2.5 px-3 font-semibold">{cat.name}</td>
                        <td className="py-2.5 px-3 text-center font-bold">{cat.weight}%</td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {pct !== null ? `${pct}%` : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-primary">
                          {contrib > 0 ? contrib : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/20 font-extrabold border-t border-border">
                  <tr>
                    <td className="py-2.5 px-3" colSpan={3}>
                      Final Subject Mark (100%)
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm text-foreground">
                      {selectedStudentForBreakdown?.computed.finalWeightedTotal !== null
                        ? `${selectedStudentForBreakdown?.computed.finalWeightedTotal} / 100`
                        : `${selectedStudentForBreakdown?.computed.provisionalWeightedTotal} (Provisional)`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 text-muted-foreground text-[11px] leading-relaxed">
              <strong>Calculation Formula:</strong> Category % = (Total Earned ÷ Total Max) × 100.
              Weighted Contribution = Category % × Category Weight ÷ 100.
              Final Mark = Sum of all weighted category contributions.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedStudentForBreakdown(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SUBMIT FOR APPROVAL CONFIRMATION MODAL ──────────────────────────────── */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Send className="w-4 h-4 text-primary" />
              Submit Gradebook for Approval
            </DialogTitle>
            <DialogDescription className="text-xs">
              Submitting locks mark entry and sends this subject&apos;s evaluations to the School Administrator for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {liveStats.missingCount > 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Notice: Missing marks detected</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  {liveStats.missingCount} students still have unentered marks. Submitting now will finalize only complete students.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-xs">
                  All {liveStats.totalStudents} students have complete marks!
                </span>
              </div>
            )}

            <p className="text-muted-foreground text-[11px]">
              Once submitted, marks cannot be modified unless the Administrator returns them for correction.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSubmitModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSubmitForApproval}
              className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
            >
              {saving ? 'Submitting...' : 'Confirm & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── REMARK MODAL ───────────────────────────────────────────────────────── */}
      <Dialog
        open={!!remarkModalStudent}
        onOpenChange={(open) => !open && setRemarkModalStudent(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Add Student Remarks
            </DialogTitle>
            <DialogDescription className="text-xs">
              {remarkModalStudent?.student.fullName} ({remarkModalStudent?.assessment.title})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Label className="text-xs font-bold">Remarks / Feedback</Label>
            <Input
              value={remarkModalStudent?.currentRemarks || ''}
              onChange={(e) => {
                if (!remarkModalStudent) return;
                const updated = e.target.value;
                setRemarkModalStudent((prev) => prev ? { ...prev, currentRemarks: updated } : null);
                // Also update localMarks
                setLocalMarks((prev) => {
                  const studentRow = prev[remarkModalStudent.student.id] || {};
                  const cell = studentRow[remarkModalStudent.assessment.id] || {
                    score: null,
                    isAbsent: false,
                    isExcused: false,
                    remarks: '',
                  };
                  return {
                    ...prev,
                    [remarkModalStudent.student.id]: {
                      ...studentRow,
                      [remarkModalStudent.assessment.id]: {
                        ...cell,
                        remarks: updated,
                      },
                    },
                  };
                });
                setDirtyCells((prev) => {
                  const next = new Set(prev);
                  next.add(`${remarkModalStudent.student.id}:${remarkModalStudent.assessment.id}`);
                  return next;
                });
              }}
              placeholder="e.g. Excellent work, Good effort, Needs improvement"
              className="mt-1 h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setRemarkModalStudent(null)}
              className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VIEW REPORT MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Class Performance Report
            </DialogTitle>
            <DialogDescription className="text-xs">
              Performance breakdown for {currentSubjectObj?.name} - {currentGradeObj?.name} {currentSectionObj?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border text-center">
                <span className="text-[11px] text-muted-foreground block">Class Average</span>
                <span className="text-xl font-extrabold text-foreground">{liveStats.classAverage}%</span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border text-center">
                <span className="text-[11px] text-muted-foreground block">Highest Mark</span>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {liveStats.highestScore}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border text-center">
                <span className="text-[11px] text-muted-foreground block">Lowest Mark</span>
                <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                  {liveStats.lowestScore}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Category Average Performance
              </h4>
              <div className="space-y-2">
                {gradebookData?.scheme?.categorySummaries?.map((cs, idx) => {
                  const theme = getCategoryTheme(cs.name, idx);
                  return (
                    <div key={cs.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{cs.name} ({cs.weight}%)</span>
                        <span className="font-bold">{cs.averagePercentage}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, cs.averagePercentage)}%`,
                            backgroundColor: theme.accent,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportModalOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
