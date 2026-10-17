'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  Check,
  RotateCcw,
  Search,
  Download,
  MoreHorizontal,
  FileText,
  UserX,
  AlertCircle,
  Sparkles,
  BookOpen,
  Filter,
  CheckCheck,
  XCircle,
  Info,
  Calendar,
  Layers,
  GraduationCap,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import {
  gradebookService,
  SubmissionDashboardMetrics,
  AssessmentSubmissionItem,
  SubmissionDetailsResponse,
} from '@/lib/gradebook-service';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';

export default function MarkSubmissionApprovalPage() {
  const pathname = usePathname();
  const isAcademicHead = pathname?.startsWith('/school/academic-head');
  const assessmentsBackHref = isAcademicHead ? '/school/academic-head/assessments' : '/school/admin/assessments';

  // 1. Filter States
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const [selectedGradeId, setSelectedGradeId] = useState<string>('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 2. Data States
  const [metrics, setMetrics] = useState<SubmissionDashboardMetrics>({
    total: 0,
    submitted: 0,
    pendingApproval: 0,
    requiringAttention: 0,
    approved: 0,
    published: 0,
  });
  const [submissions, setSubmissions] = useState<AssessmentSubmissionItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Review modal search and filter
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'ISSUES' | 'ABSENT' | 'COMPLETE'>('ALL');

  // 3. Selection & Side Panel States
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<SubmissionDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);

  // Bulk Selection
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // 4. Modal States
  const [approveModalOpen, setApproveModalOpen] = useState<boolean>(false);
  const [targetForApproval, setTargetForApproval] = useState<AssessmentSubmissionItem | null>(null);
  const [approvalLoading, setApprovalLoading] = useState<boolean>(false);

  const [returnModalOpen, setReturnModalOpen] = useState<boolean>(false);
  const [targetForReturn, setTargetForReturn] = useState<AssessmentSubmissionItem | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnLoading, setReturnLoading] = useState<boolean>(false);

  const [reopenModalOpen, setReopenModalOpen] = useState<boolean>(false);
  const [targetForReopen, setTargetForReopen] = useState<AssessmentSubmissionItem | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [reopenLoading, setReopenLoading] = useState<boolean>(false);

  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);

  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  // 5. Initial Load: Academic Years, Grades, Subjects, Teachers
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const [ayRes, gradesRes, sectionsRes, subjectsRes, teachersRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/schools/sections`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/schools/subjects`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/teachers`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      if (ayRes?.success && Array.isArray(ayRes.data) && ayRes.data.length > 0) {
        setAcademicYears(ayRes.data);
        const currentYear = ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        setSelectedYearId(currentYear.id);
        const currentTerm = currentYear.terms?.find((t: any) => t.isCurrent) || currentYear.terms?.[0];
        if (currentTerm) setSelectedTermId(currentTerm.id);
      }

      if (gradesRes?.success && Array.isArray(gradesRes.data)) {
        setGrades(gradesRes.data);
      }

      if (sectionsRes?.success && Array.isArray(sectionsRes.data)) {
        setSections(sectionsRes.data);
      }

      if (subjectsRes?.success && Array.isArray(subjectsRes.data) && subjectsRes.data.length > 0) {
        setSubjects(subjectsRes.data);
      } else {
        const fallbackSub = await fetch(`${API_URL}/api/settings/subjects`, { headers }).then((r) => r.json()).catch(() => ({ data: [] }));
        if (fallbackSub?.success && Array.isArray(fallbackSub.data)) {
          setSubjects(fallbackSub.data);
        }
      }

      if (teachersRes?.success && Array.isArray(teachersRes.data) && teachersRes.data.length > 0) {
        setTeachers(teachersRes.data);
      } else {
        const fallbackT = await fetch(`${API_URL}/api/schools/teachers`, { headers }).then((r) => r.json()).catch(() => null);
        if (fallbackT?.success && Array.isArray(fallbackT.data) && fallbackT.data.length > 0) {
          setTeachers(fallbackT.data);
        } else {
          const userTeachers = await fetch(`${API_URL}/api/users?role=teacher`, { headers }).then((r) => r.json()).catch(() => ({ data: [] }));
          if (userTeachers?.success && Array.isArray(userTeachers.data)) {
            setTeachers(userTeachers.data);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update sections when grade filter changes
  useEffect(() => {
    const updateSectionsForGrade = async () => {
      try {
        const { getApiUrl } = await import('@/lib/api-config');
        const API_URL = getApiUrl();
        const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        if (selectedGradeId === 'ALL') {
          const res = await fetch(`${API_URL}/api/schools/sections`, { headers }).then((r) => r.json()).catch(() => null);
          if (res?.success && Array.isArray(res.data)) {
            setSections(res.data);
          }
        } else {
          const res = await fetch(`${API_URL}/api/schools/sections?gradeId=${selectedGradeId}`, { headers }).then((r) => r.json()).catch(() => null);
          if (res?.success && Array.isArray(res.data)) {
            setSections(res.data);
          } else {
            setSections([]);
          }
        }
      } catch (err) {
        console.error('Failed to update sections for grade:', err);
      }
    };

    updateSectionsForGrade();
  }, [selectedGradeId]);

  // Load submissions and dashboard data whenever filters or pagination change
  const fetchSubmissionsAndMetrics = useCallback(async () => {
    try {
      setRefreshing(true);
      const filterParams = {
        academicYearId: selectedYearId || undefined,
        academicTermId: selectedTermId || undefined,
        gradeId: selectedGradeId !== 'ALL' ? selectedGradeId : undefined,
        sectionId: selectedSectionId !== 'ALL' ? selectedSectionId : undefined,
        subjectId: selectedSubjectId !== 'ALL' ? selectedSubjectId : undefined,
        teacherId: selectedTeacherId !== 'ALL' ? selectedTeacherId : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        search: searchQuery.trim() || undefined,
        page: pagination.page,
        limit: pagination.limit,
      };

      const [metricsData, submissionsData] = await Promise.all([
        gradebookService.getSubmissionDashboard(filterParams),
        gradebookService.getSubmissions(filterParams),
      ]);

      setMetrics(metricsData);
      setSubmissions(submissionsData.submissions);
      setPagination(submissionsData.pagination);

      // Auto-select first submission if none selected
      if (submissionsData.submissions.length > 0) {
        if (!selectedSubmissionId || !submissionsData.submissions.some((s) => s.id === selectedSubmissionId)) {
          setSelectedSubmissionId(submissionsData.submissions[0].id);
        }
      } else {
        setSelectedSubmissionId(null);
        setSelectedDetails(null);
      }
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
      notifications.error('Data Fetch Error', err?.message || 'Failed to load submissions');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [
    selectedYearId,
    selectedTermId,
    selectedGradeId,
    selectedSectionId,
    selectedSubjectId,
    selectedTeacherId,
    selectedStatus,
    searchQuery,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    if (selectedYearId) {
      fetchSubmissionsAndMetrics();
    }
  }, [fetchSubmissionsAndMetrics, selectedYearId]);

  // Load details whenever selectedSubmissionId changes
  useEffect(() => {
    if (!selectedSubmissionId) {
      setSelectedDetails(null);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setDetailsLoading(true);
        const data = await gradebookService.getSubmissionDetails(selectedSubmissionId);
        if (isMounted) {
          setSelectedDetails(data);
        }
      } catch (err: any) {
        console.error('Error fetching submission details:', err);
      } finally {
        if (isMounted) setDetailsLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedSubmissionId]);

  // Current terms from selected year
  const currentTerms = useMemo(() => {
    const y = academicYears.find((year) => year.id === selectedYearId);
    return y?.terms || [];
  }, [academicYears, selectedYearId]);

  // Selected Submission Item for side panel
  const currentSubmission = useMemo(() => {
    return submissions.find((s) => s.id === selectedSubmissionId) || (selectedDetails ? selectedDetails.submission : null);
  }, [submissions, selectedSubmissionId, selectedDetails]);

  // Handlers for approval, return, reopen, and publish
  const handleOpenApproveModal = (sub: AssessmentSubmissionItem) => {
    setTargetForApproval(sub);
    setApproveModalOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!targetForApproval) return;
    try {
      setApprovalLoading(true);
      await gradebookService.approveSubmission(targetForApproval.id);
      notifications.success('Approved', `Assessment marks for ${targetForApproval.subject.name} have been approved.`);
      setApproveModalOpen(false);
      setReviewModalOpen(false);
      await fetchSubmissionsAndMetrics();
      if (selectedSubmissionId === targetForApproval.id) {
        const details = await gradebookService.getSubmissionDetails(targetForApproval.id);
        setSelectedDetails(details);
      }
    } catch (err: any) {
      notifications.error('Approval Failed', err?.message || 'Error approving submission');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleOpenReturnModal = (sub: AssessmentSubmissionItem) => {
    setTargetForReturn(sub);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!targetForReturn) return;
    if (!returnReason.trim()) {
      notifications.error('Reason Required', 'Please provide a reason for returning the submission.');
      return;
    }
    try {
      setReturnLoading(true);
      await gradebookService.returnSubmission(targetForReturn.id, returnReason.trim());
      notifications.success('Returned', `Submission for ${targetForReturn.subject.name} returned for correction.`);
      setReturnModalOpen(false);
      setReviewModalOpen(false);
      await fetchSubmissionsAndMetrics();
      if (selectedSubmissionId === targetForReturn.id) {
        const details = await gradebookService.getSubmissionDetails(targetForReturn.id);
        setSelectedDetails(details);
      }
    } catch (err: any) {
      notifications.error('Return Failed', err?.message || 'Error returning submission');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleOpenReopenModal = (sub: AssessmentSubmissionItem) => {
    setTargetForReopen(sub);
    setReopenReason('');
    setReopenModalOpen(true);
  };

  const handleConfirmReopen = async () => {
    if (!targetForReopen) return;
    if (!reopenReason.trim()) {
      notifications.error('Reason Required', 'Please provide a reason for reopening the submission.');
      return;
    }
    try {
      setReopenLoading(true);
      await gradebookService.reopenSubmission(targetForReopen.id, reopenReason.trim());
      notifications.success('Reopened', `Submission for ${targetForReopen.subject.name} reopened for editing.`);
      setReopenModalOpen(false);
      await fetchSubmissionsAndMetrics();
      if (selectedSubmissionId === targetForReopen.id) {
        const details = await gradebookService.getSubmissionDetails(targetForReopen.id);
        setSelectedDetails(details);
      }
    } catch (err: any) {
      notifications.error('Reopen Failed', err?.message || 'Error reopening submission');
    } finally {
      setReopenLoading(false);
    }
  };

  const handlePublishResults = async (sub: AssessmentSubmissionItem) => {
    try {
      await gradebookService.publishSubmission(sub.id);
      notifications.success('Published', `Results for ${sub.subject.name} are now published for report cards.`);
      await fetchSubmissionsAndMetrics();
      if (selectedSubmissionId === sub.id) {
        const details = await gradebookService.getSubmissionDetails(sub.id);
        setSelectedDetails(details);
      }
    } catch (err: any) {
      notifications.error('Publish Failed', err?.message || 'Error publishing submission');
    }
  };

  // Bulk Approval
  const handleBulkApprove = async () => {
    if (selectedRowIds.length === 0) return;
    try {
      setBulkLoading(true);
      const res = await gradebookService.bulkApproveSubmissions(selectedRowIds);
      if (res.totalApproved > 0) {
        notifications.success('Bulk Approval Complete', `Successfully approved ${res.totalApproved} submissions.`);
      }
      if (res.totalFailed > 0) {
        notifications.error('Some Items Failed', `${res.totalFailed} submissions could not be approved due to validation issues.`);
      }
      setSelectedRowIds([]);
      setBulkModalOpen(false);
      await fetchSubmissionsAndMetrics();
    } catch (err: any) {
      notifications.error('Bulk Approval Failed', err?.message || 'Error during bulk approval');
    } finally {
      setBulkLoading(false);
    }
  };

  // Select all checkbox handler
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRowIds(submissions.map((s) => s.id));
    } else {
      setSelectedRowIds([]);
    }
  };

  const handleRowCheckbox = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Sync Submissions across all assignments & assessments
  const handleSyncSubmissions = async () => {
    try {
      setSyncing(true);
      const res = await gradebookService.syncSubmissions(selectedYearId || undefined, selectedTermId || undefined);
      notifications.success('Sync Complete', res?.message || `Successfully synced ${res?.count ?? 0} submissions.`);
      await fetchSubmissionsAndMetrics();
    } catch (err: any) {
      notifications.error('Sync Error', err?.message || 'Failed to sync submissions');
    } finally {
      setSyncing(false);
    }
  };

  // Filtered review modal students
  const filteredReviewStudents = useMemo(() => {
    if (!selectedDetails?.students) return [];
    return selectedDetails.students.filter((st) => {
      const matchesSearch =
        !reviewSearch.trim() ||
        st.fullName.toLowerCase().includes(reviewSearch.toLowerCase()) ||
        st.studentNumber.toLowerCase().includes(reviewSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (reviewFilter === 'ISSUES') {
        return st.status === 'INVALID' || st.status === 'MISSING' || st.issues.length > 0;
      }
      if (reviewFilter === 'ABSENT') {
        return st.status === 'ABSENT' || st.marks?.some((m) => m.isAbsent);
      }
      if (reviewFilter === 'COMPLETE') {
        return st.status === 'COMPLETE';
      }
      return true;
    });
  }, [selectedDetails, reviewSearch, reviewFilter]);

  // Export CSV Report
  const handleExportReport = () => {
    if (submissions.length === 0) {
      notifications.error('Export Error', 'No submission records to export');
      return;
    }

    const headers = ['#', 'Subject', 'Grade', 'Section', 'Teacher', 'Submission Date', 'Status', 'Completion %', 'Total Students', 'Valid Marks', 'Missing Marks'];
    const csvRows = [
      headers.join(','),
      ...submissions.map((s, idx) => [
        idx + 1,
        `"${s.subject.name}"`,
        `"${s.grade.name}"`,
        `"${s.section.name}"`,
        `"${s.teacher.name}"`,
        `"${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : 'N/A'}"`,
        `"${s.status}"`,
        `"${s.metrics.completionPercentage}%"`,
        s.metrics.totalStudents,
        s.metrics.validMarksCount,
        s.metrics.missingMarksCount,
      ].join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Mark_Submissions_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifications.success('Report Exported', 'Submissions summary downloaded as CSV.');
  };

  // Export Detailed Review Marks Sheet
  const handleExportReviewSheet = () => {
    if (!selectedDetails || !selectedDetails.students || selectedDetails.students.length === 0) {
      notifications.error('Export Error', 'No student marks available to export');
      return;
    }

    const assessTitles = (selectedDetails.assessments || []).map((a) => `"${a.title} (Max ${a.maxScore})"`);
    const headers = ['Student ID', 'Student Name', ...assessTitles, 'Final Percentage', 'Status'];

    const rows = selectedDetails.students.map((st) => {
      const marksCols = (selectedDetails.assessments || []).map((a) => {
        const mark = st.marks?.find((m) => m.assessmentId === a.id);
        if (mark?.isAbsent) return '"ABSENT"';
        if (mark?.score !== null && mark?.score !== undefined) return mark.score;
        return '"--"';
      });
      return [
        `"${st.studentNumber}"`,
        `"${st.fullName}"`,
        ...marksCols,
        st.finalPercentage !== null ? `"${st.finalPercentage}%"` : '"--"',
        `"${st.status}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedDetails.submission.subject.name}_Marks_Sheet_${selectedDetails.submission.grade.name}_${selectedDetails.submission.section.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifications.success('Exported', 'Student marks sheet downloaded as CSV.');
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string, hasInvalid?: boolean) => {
    if (hasInvalid) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          Requires Attention
        </span>
      );
    }

    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Send className="w-3.5 h-3.5" />
            Submitted
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
            <Check className="w-3.5 h-3.5" />
            Published
          </span>
        );
      case 'REQUIRES_ATTENTION':
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
            <AlertCircle className="w-3.5 h-3.5" />
            {status === 'RETURNED' ? 'Returned for Correction' : 'Requires Attention'}
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <FileText className="w-3.5 h-3.5" />
            Draft
          </span>
        );
    }
  };

  // Helper for formatting date
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not submitted yet';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Subject icon helper colors
  const getSubjectColorBg = (color?: string) => {
    return color ? `${color}20` : '#8b5cf620';
  };
  const getSubjectColorText = (color?: string) => {
    return color || '#8b5cf6';
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header Navigation & Title */}
      <div className="space-y-2">
        <Link
          href={assessmentsBackHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-1 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Assessments</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border border-violet-500/30 text-violet-600 dark:text-violet-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Mark Submission & Approval
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Review and manage assessment marks, submissions and approvals for your school.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncSubmissions}
              disabled={syncing || refreshing}
              className="gap-2 bg-card border-border hover:bg-accent text-xs"
            >
              <Sparkles className={`w-4 h-4 text-amber-500 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Submissions'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSubmissionsAndMetrics}
              disabled={refreshing || syncing}
              className="gap-2 bg-card border-border hover:bg-accent text-xs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-violet-600 dark:text-violet-400' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary Metrics Cards (Interactive Filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Submissions */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`bg-card text-card-foreground rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'ALL'
              ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-500/10'
              : 'border-border dark:border-white/10 hover:border-violet-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Submissions
            </span>
            {selectedStatus === 'ALL' && <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Active</Badge>}
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight mt-1">
            {metrics.total}
          </div>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">Across all grades and subjects</span>
        </div>

        {/* Card 2: Submitted */}
        <div
          onClick={() => setSelectedStatus('SUBMITTED')}
          className={`bg-card text-card-foreground rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'SUBMITTED'
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
              : 'border-border dark:border-white/10 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Submitted
            </span>
            {selectedStatus === 'SUBMITTED' && <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Active</Badge>}
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight mt-1">
            {metrics.submitted}
          </div>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">Ready for review</span>
        </div>

        {/* Card 3: Pending Approval */}
        <div
          onClick={() => setSelectedStatus('PENDING_APPROVAL')}
          className={`bg-card text-card-foreground rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'PENDING_APPROVAL'
              ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-500/10'
              : 'border-border dark:border-white/10 hover:border-violet-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Pending Approval
            </span>
            {selectedStatus === 'PENDING_APPROVAL' && <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Active</Badge>}
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight mt-1">
            {metrics.pendingApproval}
          </div>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">Awaiting admin approval</span>
        </div>

        {/* Card 4: Requiring Attention */}
        <div
          onClick={() => setSelectedStatus('REQUIRES_ATTENTION')}
          className={`bg-card text-card-foreground rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'REQUIRES_ATTENTION'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10'
              : 'border-border dark:border-white/10 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Requiring Attention
            </span>
            {selectedStatus === 'REQUIRES_ATTENTION' && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Active</Badge>}
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight mt-1">
            {metrics.requiringAttention}
          </div>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">Missing marks or issues</span>
        </div>

        {/* Card 5: Published */}
        <div
          onClick={() => setSelectedStatus('PUBLISHED')}
          className={`bg-card text-card-foreground rounded-2xl p-4 border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'PUBLISHED'
              ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-500/10'
              : 'border-border dark:border-white/10 hover:border-teal-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Published
            </span>
            {selectedStatus === 'PUBLISHED' && <Badge variant="secondary" className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">Active</Badge>}
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight mt-1">
            {metrics.published}
          </div>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">Official results released</span>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-card text-card-foreground rounded-2xl p-4 sm:p-5 border border-border dark:border-white/10 shadow-sm space-y-3">
        {/* Search Input Row */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by subject, teacher name, grade, section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPagination((p) => ({ ...p, page: 1 }));
                fetchSubmissionsAndMetrics();
              }
            }}
            className="pl-9 h-9 text-xs rounded-xl bg-background border-input text-foreground"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          {/* Academic Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Term */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Term</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="">All Terms</option>
              {currentTerms.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Grade</label>
            <select
              value={selectedGradeId}
              onChange={(e) => {
                setSelectedGradeId(e.target.value);
                setSelectedSectionId('ALL');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="ALL">All Grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => {
                setSelectedSectionId(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="ALL">All Sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} {sub.code ? `(${sub.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Teacher</label>
            <select
              value={selectedTeacherId}
              onChange={(e) => {
                setSelectedTeacherId(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="ALL">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.teacher_id || t.id}>
                  {t.name || t.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status + Search Button */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Status</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="w-full h-9 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="REQUIRES_ATTENTION">Requires Attention</option>
                <option value="APPROVED">Approved</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
              <Button
                size="sm"
                onClick={() => {
                  setPagination((p) => ({ ...p, page: 1 }));
                  fetchSubmissionsAndMetrics();
                }}
                className="h-9 px-3.5 bg-violet-600 hover:bg-violet-700 text-white shrink-0 gap-1.5 shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </Button>
              {(selectedGradeId !== 'ALL' || selectedSectionId !== 'ALL' || selectedSubjectId !== 'ALL' || selectedTeacherId !== 'ALL' || selectedStatus !== 'ALL') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedGradeId('ALL');
                    setSelectedSectionId('ALL');
                    setSelectedSubjectId('ALL');
                    setSelectedTeacherId('ALL');
                    setSelectedStatus('ALL');
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  title="Reset filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Submissions Table (FULL WIDTH) */}
      <div className="w-full space-y-4">
        <div className="bg-card text-card-foreground rounded-2xl border border-border dark:border-white/10 shadow-sm overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-border dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">Submissions</h2>
              {selectedRowIds.length > 0 && (
                <Badge variant="secondary" className="gap-1 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  <CheckCheck className="w-3.5 h-3.5" />
                  {selectedRowIds.length} Selected
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedRowIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setBulkModalOpen(true)}
                  className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve Selected ({selectedRowIds.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportReport}
                className="h-9 gap-1.5 text-xs bg-card border-border hover:bg-accent"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                Export Report
              </Button>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border dark:border-white/10">
                <tr>
                  <th className="p-3.5 pl-5 w-10">
                    <input
                      type="checkbox"
                      checked={submissions.length > 0 && selectedRowIds.length === submissions.length}
                      onChange={handleSelectAll}
                      className="rounded border-input text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5 w-12 text-center">#</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Grade</th>
                  <th className="p-3.5">Section</th>
                  <th className="p-3.5">Teacher</th>
                  <th className="p-3.5">Submission Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-violet-600 dark:text-violet-400" />
                        <span className="text-xs">Loading mark submissions...</span>
                      </div>
                    </td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <BookOpen className="w-8 h-8 text-muted-foreground/60" />
                        <p className="text-base font-semibold text-foreground">No submissions found</p>
                        <p className="text-xs max-w-sm text-muted-foreground">
                          Try adjusting your filters or check if teachers have entered assessment marks for this term.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub, index) => {
                    const isSelected = selectedSubmissionId === sub.id;
                    const isChecked = selectedRowIds.includes(sub.id);
                    return (
                      <tr
                        key={sub.id}
                        onClick={() => setSelectedSubmissionId(sub.id)}
                        className={`group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-violet-500/10 dark:bg-violet-950/30 font-medium'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <td className="p-3.5 pl-5" onClick={(e) => handleRowCheckbox(sub.id, e)}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-input text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5 text-center text-xs text-muted-foreground font-mono">
                          {(pagination.page - 1) * pagination.limit + index + 1}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-xs"
                              style={{
                                backgroundColor: getSubjectColorBg(sub.subject.color),
                                color: getSubjectColorText(sub.subject.color),
                              }}
                            >
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-foreground">{sub.subject.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-foreground whitespace-nowrap">{sub.grade.name}</td>
                        <td className="p-3.5 text-foreground whitespace-nowrap font-medium">
                          {sub.section.name}
                        </td>
                        <td className="p-3.5 text-foreground whitespace-nowrap">{sub.teacher.name}</td>
                        <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(sub.submittedAt)}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {renderStatusBadge(sub.status, sub.metrics?.hasInvalidMark)}
                        </td>
                        <td className="p-3.5 pr-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSubmissionId(sub.id);
                                setReviewModalOpen(true);
                              }}
                              className="h-8 px-2.5 text-xs gap-1.5 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-900/60 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                              title="Review Marks"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Review</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-card text-card-foreground border-border shadow-lg">
                                <DropdownMenuLabel className="text-xs">Submission Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedSubmissionId(sub.id);
                                    setReviewModalOpen(true);
                                  }}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <Eye className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                                  Review Marks
                                </DropdownMenuItem>

                                {(sub.status === 'SUBMITTED' || sub.status === 'PENDING_APPROVAL' || sub.status === 'REQUIRES_ATTENTION') && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenApproveModal(sub)}
                                    className="gap-2 cursor-pointer text-xs text-emerald-600 dark:text-emerald-400"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Approve Submission
                                  </DropdownMenuItem>
                                )}

                                {(sub.status === 'SUBMITTED' || sub.status === 'PENDING_APPROVAL') && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenReturnModal(sub)}
                                    className="gap-2 cursor-pointer text-xs text-orange-600"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Return for Correction
                                  </DropdownMenuItem>
                                )}

                                {(sub.status === 'APPROVED' || sub.status === 'PUBLISHED') && (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenReopenModal(sub)}
                                    className="gap-2 cursor-pointer text-xs text-amber-600"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reopen for Editing
                                  </DropdownMenuItem>
                                )}

                                {sub.status === 'APPROVED' && (
                                  <DropdownMenuItem
                                    onClick={() => handlePublishResults(sub)}
                                    className="gap-2 cursor-pointer text-xs text-teal-600"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Publish Results
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="p-4 border-t border-border dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing {submissions.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} submissions
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={pagination.page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: pageNum }))}
                  className={`h-8 w-8 p-0 text-xs font-medium ${
                    pagination.page === pageNum ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''
                  }`}
                >
                  {pageNum}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Recent Activity Timeline at the Bottom */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border dark:border-white/10 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Recent Submission & Approval Activity
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit history of teacher mark entries, administrative reviews, returns, and grade publications.
              </p>
            </div>
          </div>
          {currentSubmission && (
            <Badge variant="outline" className="text-xs font-medium self-start sm:self-auto bg-muted border-border">
              Active: <strong className="ml-1 text-foreground">{currentSubmission.subject?.name}</strong> (Grade {currentSubmission.grade?.name} &ldquo;{currentSubmission.section?.name}&rdquo;)
            </Badge>
          )}
        </div>

        {/* Timeline Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {selectedDetails?.activities && selectedDetails.activities.length > 0 ? (
            selectedDetails.activities.map((act) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl border border-border/80 dark:border-white/10 bg-muted/20 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground">{formatDate(act.timestamp)}</span>
                  <span className="w-2 h-2 rounded-full bg-violet-600" />
                </div>
                <div className="text-xs font-bold text-foreground">{act.title}</div>
                <p className="text-[11px] text-muted-foreground">
                  <strong className="text-foreground">{act.author}</strong> — {act.description}
                </p>
              </div>
            ))
          ) : currentSubmission ? (
            <div className="p-3.5 rounded-xl border border-border/80 dark:border-white/10 bg-muted/20 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">{formatDate(currentSubmission.submittedAt)}</span>
                <span className="w-2 h-2 rounded-full bg-violet-600" />
              </div>
              <div className="text-xs font-bold text-foreground">Teacher Submitted Marks</div>
              <p className="text-[11px] text-muted-foreground">
                <strong className="text-foreground">{currentSubmission.teacher?.name}</strong> submitted assessment grades for {currentSubmission.subject?.name}.
              </p>
            </div>
          ) : (
            <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
              Select any submission in the table above to view its activity history.
            </div>
          )}
        </div>
      </div>

      {/* 5. Approve Confirmation Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="max-w-md p-6 bg-card text-card-foreground border border-border dark:border-white/10 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Approve Submission
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {targetForApproval ? `${targetForApproval.subject.name} - Grade ${targetForApproval.grade.name} (${targetForApproval.section.name})` : ''}
              </DialogDescription>
            </div>
          </div>

          <div className="space-y-3.5 py-2 text-xs text-muted-foreground">
            <p className="text-foreground">
              Are you sure you want to approve this submission? The marks will be locked for further editing.
            </p>
            <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-start gap-2.5 text-violet-700 dark:text-violet-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
              <p className="text-[11px] leading-relaxed">
                This action will make the results available for report card generation, subject to your school&apos;s publication policy.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setApproveModalOpen(false)}
              disabled={approvalLoading}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApproval}
              disabled={approvalLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
            >
              {approvalLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Review Marks Modal: Detailed Gradebook Breakdown */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-6 bg-card text-card-foreground border border-border dark:border-white/10 rounded-2xl shadow-2xl flex flex-col">
          <DialogHeader className="pb-3 border-b border-border dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Review Marks: {selectedDetails?.submission?.subject?.name || currentSubmission?.subject?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Grade {selectedDetails?.submission?.grade?.name || currentSubmission?.grade?.name} - Section{' '}
                  {selectedDetails?.submission?.section?.name || currentSubmission?.section?.name} | Teacher:{' '}
                  {selectedDetails?.submission?.teacher?.name || currentSubmission?.teacher?.name}
                </DialogDescription>
              </div>
              <div>{currentSubmission && renderStatusBadge(currentSubmission.status, currentSubmission.metrics?.hasInvalidMark)}</div>
            </div>
          </DialogHeader>

          {/* Mark Entry Progress (Inside Review Modal) */}
          <div className="bg-muted/40 text-foreground rounded-xl p-4 border border-border dark:border-white/10 shadow-sm space-y-2.5">
            <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              MARK ENTRY PROGRESS
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-base font-black text-foreground">
                {selectedDetails ? selectedDetails.stats.completionPercentage : currentSubmission?.metrics?.completionPercentage || 0}%
              </span>
              <span className="text-muted-foreground font-mono text-xs font-semibold">
                {selectedDetails
                  ? `${selectedDetails.stats.completedStudents}/${selectedDetails.stats.totalStudents}`
                  : `${currentSubmission?.metrics?.validMarksCount || 0}/${currentSubmission?.metrics?.totalStudents || 0}`}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300"
                style={{
                  width: `${selectedDetails ? selectedDetails.stats.completionPercentage : currentSubmission?.metrics?.completionPercentage || 0}%`,
                }}
              />
            </div>

            {/* Quick Completion Breakdown Chips */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-1 px-2">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">
                  ✓ {selectedDetails ? selectedDetails.stats.completedStudents : currentSubmission?.metrics?.validMarksCount || 0} Complete
                </span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg py-1 px-2">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block">
                  ⚠ {selectedDetails ? selectedDetails.stats.missingStudents : currentSubmission?.metrics?.missingMarksCount || 0} Missing
                </span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg py-1 px-2">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold block">
                  ✕ {selectedDetails ? selectedDetails.stats.absentStudents : currentSubmission?.metrics?.absentCount || 0} Absent
                </span>
              </div>
            </div>
          </div>

          {/* Validation Alert Banner */}
          {selectedDetails?.stats?.hasValidationErrors && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Attention: Some student records contain missing marks or scores exceeding maximum limits. Please review below.
              </span>
            </div>
          )}

          {/* Modal Student Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter student name or ID..."
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg bg-background border-input text-foreground"
              />
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <div className="flex items-center bg-muted/60 p-0.5 rounded-lg text-xs border border-border/50">
                <button
                  type="button"
                  onClick={() => setReviewFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    reviewFilter === 'ALL' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({selectedDetails?.students?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('ISSUES')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    reviewFilter === 'ISSUES' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Issues ({(selectedDetails?.stats?.missingStudents || 0) + (selectedDetails?.students?.filter((s) => s.status === 'INVALID').length || 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('ABSENT')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    reviewFilter === 'ABSENT' ? 'bg-card text-rose-600 dark:text-rose-400 shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Absent ({selectedDetails?.stats?.absentStudents || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('COMPLETE')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    reviewFilter === 'COMPLETE' ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Complete ({selectedDetails?.stats?.completedStudents || 0})
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportReviewSheet}
                className="h-8 gap-1.5 text-xs bg-card border-border hover:bg-accent text-foreground"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>

          {/* Students Marks Sheet Table */}
          <div className="flex-1 overflow-y-auto min-h-[300px] border border-border dark:border-white/10 rounded-xl bg-card">
            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-xs">Loading detailed marks...</span>
              </div>
            ) : !selectedDetails?.students || selectedDetails.students.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">No student marks recorded for this subject.</div>
            ) : filteredReviewStudents.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">No students match current search / filter.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 border-b border-border dark:border-white/10">
                  <tr>
                    <th className="p-3 pl-4">Student ID</th>
                    <th className="p-3">Student Name</th>
                    {selectedDetails.assessments?.map((a) => (
                      <th key={a.id} className="p-3 text-center">
                        <div>{a.title}</div>
                        <span className="text-[10px] text-muted-foreground font-normal">Max: {a.maxScore}</span>
                      </th>
                    ))}
                    <th className="p-3 text-center">Weighted Score</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredReviewStudents.map((student) => (
                    <tr key={student.studentId} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 pl-4 font-mono font-medium text-muted-foreground">{student.studentNumber}</td>
                      <td className="p-3 font-semibold text-foreground">{student.fullName}</td>
                      {selectedDetails.assessments?.map((assess) => {
                        const mark = student.marks?.find((m) => m.assessmentId === assess.id);
                        const isScoreMissing = mark?.score === null || mark?.score === undefined;
                        const isExceeding = mark?.score !== null && mark?.score !== undefined && mark.score > assess.maxScore;
                        const isNegative = mark?.score !== null && mark?.score !== undefined && mark.score < 0;

                        return (
                          <td key={assess.id} className="p-3 text-center">
                            {mark?.isAbsent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                ABSENT
                              </span>
                            ) : isNegative || isExceeding ? (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
                                {mark?.score} ⚠
                              </span>
                            ) : isScoreMissing ? (
                              <span className="text-amber-500 font-bold">--</span>
                            ) : (
                              <span className="font-semibold text-foreground">{mark?.score}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold text-violet-600 dark:text-violet-400">
                        {student.finalPercentage !== null ? `${student.finalPercentage}%` : '--'}
                      </td>
                      <td className="p-3 text-center">
                        {student.status === 'COMPLETE' ? (
                          <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 text-[10px]">
                            Complete
                          </Badge>
                        ) : student.status === 'ABSENT' ? (
                          <Badge variant="outline" className="text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 text-[10px]">
                            Absent
                          </Badge>
                        ) : student.status === 'INVALID' ? (
                          <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20 text-[10px]">
                            Invalid Score
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 text-[10px]">
                            Missing Mark
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border dark:border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {currentSubmission && (currentSubmission.status === 'SUBMITTED' || currentSubmission.status === 'PENDING_APPROVAL') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleOpenReturnModal(currentSubmission);
                  }}
                  className="border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 text-xs rounded-xl gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Return for Correction
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setReviewModalOpen(false)} className="text-xs rounded-xl">
                Close
              </Button>
              {currentSubmission && (currentSubmission.status === 'SUBMITTED' || currentSubmission.status === 'PENDING_APPROVAL' || currentSubmission.status === 'REQUIRES_ATTENTION') && (
                <Button
                  size="sm"
                  onClick={() => {
                    handleOpenApproveModal(currentSubmission);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve Submission
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Return for Correction Modal */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent className="max-w-md p-6 bg-card text-card-foreground border border-border dark:border-white/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600" />
              Return for Correction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please state why this submission is being returned. The teacher will be notified to revise and resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">
              Correction Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. 2 students are missing marks for Midterm Quiz, and 1 mark is out of range."
              className="w-full text-xs p-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReturnModalOpen(false)}
              disabled={returnLoading}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReturn}
              disabled={returnLoading || !returnReason.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
            >
              {returnLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Return Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. Reopen for Editing Modal */}
      <Dialog open={reopenModalOpen} onOpenChange={setReopenModalOpen}>
        <DialogContent className="max-w-md p-6 bg-card text-card-foreground border border-border dark:border-white/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              Reopen Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reopening will unlock assessment marks and allow the teacher to edit records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">
              Reopen Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Teacher requested score correction after re-grading student exam paper."
              className="w-full text-xs p-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReopenModalOpen(false)}
              disabled={reopenLoading}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReopen}
              disabled={reopenLoading || !reopenReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
            >
              {reopenLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Reopen Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Bulk Approval Confirmation Modal */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-md p-6 bg-card text-card-foreground border border-border dark:border-white/10 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Bulk Approve Submissions
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                You have selected {selectedRowIds.length} submission(s) for approval.
              </DialogDescription>
            </div>
          </div>

          <div className="space-y-3.5 py-2 text-xs text-muted-foreground">
            <p className="text-foreground">
              Each selected submission will be validated independently. Valid submissions will be approved and locked for editing.
            </p>
            <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-start gap-2.5 text-violet-700 dark:text-violet-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
              <p className="text-[11px] leading-relaxed">
                Results will become available for report card publication according to your school&apos;s configured policy.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkModalOpen(false)}
              disabled={bulkLoading}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={bulkLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
            >
              {bulkLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Confirm Bulk Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
