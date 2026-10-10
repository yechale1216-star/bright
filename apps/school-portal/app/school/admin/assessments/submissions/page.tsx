'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileCheck2,
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
  Users,
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

      const [ayRes, gradesRes, subjectsRes, teachersRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/settings/subjects`, { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
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

      if (subjectsRes?.success && Array.isArray(subjectsRes.data)) {
        setSubjects(subjectsRes.data);
      }

      if (teachersRes?.success && Array.isArray(teachersRes.data)) {
        setTeachers(teachersRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update sections when grade filter changes
  useEffect(() => {
    if (selectedGradeId === 'ALL') {
      setSections([]);
      setSelectedSectionId('ALL');
    } else {
      const grade = grades.find((g) => g.id === selectedGradeId);
      if (grade?.sections && Array.isArray(grade.sections)) {
        setSections(grade.sections);
      } else {
        setSections([]);
      }
      setSelectedSectionId('ALL');
    }
  }, [selectedGradeId, grades]);

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
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
    return color ? `${color}20` : '#3b82f620';
  };
  const getSubjectColorText = (color?: string) => {
    return color || '#3b82f6';
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* 1. Header Navigation & Title */}
      <div className="space-y-2">
        <Link
          href="/school/admin/assessments/bulk-assignment"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-1 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Assessments</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Mark Submission & Approval
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and manage assessment marks, submissions and approvals for your school.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSubmissionsAndMetrics}
              disabled={refreshing}
              className="gap-2 bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary Metrics Cards (5-in-a-row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Submissions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Submissions
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
              {metrics.total}
            </div>
            <span className="text-xs text-muted-foreground truncate block">Across all grades and subjects</span>
          </div>
        </div>

        {/* Card 2: Submitted */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Submitted
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
              {metrics.submitted}
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate block">Ready for review</span>
          </div>
        </div>

        {/* Card 3: Pending Approval */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Pending Approval
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
              {metrics.pendingApproval}
            </div>
            <span className="text-xs text-purple-600 dark:text-purple-400 truncate block">Awaiting admin approval</span>
          </div>
        </div>

        {/* Card 4: Requiring Attention */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Requiring Attention
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
              {metrics.requiringAttention}
            </div>
            <span className="text-xs text-amber-600 dark:text-amber-400 truncate block">Missing marks or issues</span>
          </div>
        </div>

        {/* Card 5: Published */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Check className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Published
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
              {metrics.published}
            </div>
            <span className="text-xs text-teal-600 dark:text-teal-400 truncate block">Official results released</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          {/* Academic Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Term</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Grade</label>
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={selectedGradeId === 'ALL'}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Teacher</label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status + Search Button */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                onClick={fetchSubmissionsAndMetrics}
                className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5 shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Submissions Grid: Left Table, Right Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Submissions Table (7 or 8 columns on large screens) */}
        <div className={`${currentSubmission ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Table Header Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Submissions</h2>
                {selectedRowIds.length > 0 && (
                  <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
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
                  className="h-9 gap-1.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  Export Report
                </Button>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 pl-5 w-10">
                      <input
                        type="checkbox"
                        checked={submissions.length > 0 && selectedRowIds.length === submissions.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                          <span className="text-xs">Loading mark submissions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : submissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <BookOpen className="w-8 h-8 text-slate-400" />
                          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No submissions found</p>
                          <p className="text-xs max-w-sm text-slate-500">
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
                              ? 'bg-blue-50/70 dark:bg-blue-950/30 font-medium'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3.5 pl-5" onClick={(e) => handleRowCheckbox(sub.id, e)}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
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
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{sub.subject.name}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{sub.grade.name}</td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                            {sub.section.name}
                          </td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{sub.teacher.name}</td>
                          <td className="p-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(sub.submittedAt)}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {renderStatusBadge(sub.status, sub.metrics?.hasInvalidMark)}
                          </td>
                          <td className="p-3.5 pr-5 text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 shadow-lg">
                                <DropdownMenuLabel className="text-xs">Submission Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedSubmissionId(sub.id);
                                    setReviewModalOpen(true);
                                  }}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
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
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
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
                      pagination.page === pageNum ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
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

        {/* Right Column: Submission Details Panel */}
        {currentSubmission && (
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-5 sticky top-6">
              {/* Details Header */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs"
                    style={{
                      backgroundColor: getSubjectColorBg(currentSubmission.subject?.color),
                      color: getSubjectColorText(currentSubmission.subject?.color),
                    }}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {currentSubmission.subject?.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">Submission Details</span>
                  </div>
                </div>
                {renderStatusBadge(currentSubmission.status, currentSubmission.metrics?.hasInvalidMark)}
              </div>

              {/* Info Matrix */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">Grade</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{currentSubmission.grade?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Section</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Section {currentSubmission.section?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Teacher</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{currentSubmission.teacher?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Academic Year</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{currentSubmission.academicYear?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Term</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{currentSubmission.academicTerm?.name || 'Term 1'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Submission Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(currentSubmission.submittedAt)}</span>
                </div>
              </div>

              {/* Progress Section */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800 dark:text-slate-200">Mark Entry Progress</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {selectedDetails ? selectedDetails.stats.completionPercentage : currentSubmission.metrics?.completionPercentage || 0}%
                  </span>
                </div>
                <Progress
                  value={selectedDetails ? selectedDetails.stats.completionPercentage : currentSubmission.metrics?.completionPercentage || 0}
                  className="h-2 bg-slate-100 dark:bg-slate-800"
                />
                <div className="text-xs text-muted-foreground">
                  {selectedDetails
                    ? `${selectedDetails.stats.completedStudents}/${selectedDetails.stats.totalStudents} students completed`
                    : `${currentSubmission.metrics?.validMarksCount || 0}/${currentSubmission.metrics?.totalStudents || 0} students completed`}
                </div>

                {/* Progress Metric Chips */}
                <div className="grid grid-cols-3 gap-2 pt-1.5">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{selectedDetails ? selectedDetails.stats.completedStudents : currentSubmission.metrics?.validMarksCount || 0}</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Complete</span>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{selectedDetails ? selectedDetails.stats.missingStudents : currentSubmission.metrics?.missingMarksCount || 0}</span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">Missing</span>
                  </div>

                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-rose-700 dark:text-rose-400 text-xs font-bold">
                      <UserX className="w-3.5 h-3.5" />
                      <span>{selectedDetails ? selectedDetails.stats.absentStudents : currentSubmission.metrics?.absentCount || 0}</span>
                    </div>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400">Absent</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => setReviewModalOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 gap-2 shadow-sm rounded-xl"
                >
                  <Eye className="w-4 h-4" />
                  Review Marks
                </Button>

                {(currentSubmission.status === 'SUBMITTED' || currentSubmission.status === 'PENDING_APPROVAL' || currentSubmission.status === 'REQUIRES_ATTENTION') && (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenApproveModal(currentSubmission)}
                    className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold text-xs h-10 gap-2 rounded-xl"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Submission
                  </Button>
                )}

                {(currentSubmission.status === 'SUBMITTED' || currentSubmission.status === 'PENDING_APPROVAL') && (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenReturnModal(currentSubmission)}
                    className="w-full border-orange-300 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium text-xs h-9 gap-2 rounded-xl"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Return for Correction
                  </Button>
                )}

                {(currentSubmission.status === 'APPROVED' || currentSubmission.status === 'PUBLISHED') && (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenReopenModal(currentSubmission)}
                    className="w-full border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-xs h-10 gap-2 rounded-xl"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reopen for Editing
                  </Button>
                )}

                {currentSubmission.status === 'APPROVED' && (
                  <Button
                    onClick={() => handlePublishResults(currentSubmission)}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs h-10 gap-2 rounded-xl shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Publish Results
                  </Button>
                )}
              </div>

              {/* Recent Activity Timeline */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Recent Activity
                </h4>
                <div className="relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {selectedDetails?.activities && selectedDetails.activities.length > 0 ? (
                    selectedDetails.activities.map((act) => (
                      <div key={act.id} className="relative text-xs space-y-0.5">
                        <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                        <span className="text-[11px] text-muted-foreground block font-mono">
                          {formatDate(act.timestamp)}
                        </span>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{act.title}</div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                          {act.author} — {act.description}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="relative text-xs space-y-0.5">
                      <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                      <span className="text-[11px] text-muted-foreground block font-mono">
                        {formatDate(currentSubmission.submittedAt)}
                      </span>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Teacher submitted marks</div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{currentSubmission.teacher.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Approve Confirmation Modal (Matches Screenshot Modal) */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Approve Submission
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {targetForApproval ? `${targetForApproval.subject.name} - Grade ${targetForApproval.grade.name} (${targetForApproval.section.name})` : ''}
              </DialogDescription>
            </div>
          </div>

          <div className="space-y-3.5 py-2 text-xs text-slate-600 dark:text-slate-300">
            <p>
              Are you sure you want to approve this submission? The marks will be locked for further editing.
            </p>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-start gap-2.5 text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
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
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
            >
              {approvalLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Review Marks Modal: Detailed Gradebook Breakdown */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
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

          {/* Validation Alert Banner */}
          {selectedDetails?.stats?.hasValidationErrors && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Attention: Some student records contain missing marks or scores exceeding maximum limits. Please review below.
              </span>
            </div>
          )}

          {/* Students Marks Sheet Table */}
          <div className="flex-1 overflow-y-auto min-h-[300px] border border-slate-200 dark:border-slate-800 rounded-xl">
            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Loading detailed marks...</span>
              </div>
            ) : !selectedDetails?.students || selectedDetails.students.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">No student marks recorded for this subject.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider sticky top-0 border-b border-slate-200 dark:border-slate-800">
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
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedDetails.students.map((student) => (
                    <tr key={student.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 pl-4 font-mono font-medium text-slate-500">{student.studentNumber}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{student.fullName}</td>
                      {selectedDetails.assessments?.map((assess) => {
                        const mark = student.marks?.find((m) => m.assessmentId === assess.id);
                        const isScoreMissing = mark?.score === null || mark?.score === undefined;
                        const isExceeding = mark?.score !== null && mark?.score !== undefined && mark.score > assess.maxScore;
                        const isNegative = mark?.score !== null && mark?.score !== undefined && mark.score < 0;

                        return (
                          <td key={assess.id} className="p-3 text-center">
                            {mark?.isAbsent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                                ABSENT
                              </span>
                            ) : isNegative || isExceeding ? (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                {mark?.score} ⚠
                              </span>
                            ) : isScoreMissing ? (
                              <span className="text-amber-600 font-bold">--</span>
                            ) : (
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{mark?.score}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {student.finalPercentage !== null ? `${student.finalPercentage}%` : '--'}
                      </td>
                      <td className="p-3 text-center">
                        {student.status === 'COMPLETE' ? (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                            Complete
                          </Badge>
                        ) : student.status === 'ABSENT' ? (
                          <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 text-[10px]">
                            Absent
                          </Badge>
                        ) : student.status === 'INVALID' ? (
                          <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200 text-[10px]">
                            Invalid Score
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
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

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {currentSubmission && (currentSubmission.status === 'SUBMITTED' || currentSubmission.status === 'PENDING_APPROVAL') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleOpenReturnModal(currentSubmission);
                  }}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50 text-xs rounded-xl gap-1.5"
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
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl gap-1.5 shadow-sm"
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
        <DialogContent className="max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600" />
              Return for Correction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please state why this submission is being returned. The teacher will be notified to revise and resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Correction Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. 2 students are missing marks for Midterm Quiz, and 1 mark is out of range."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
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
        <DialogContent className="max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              Reopen Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reopening will unlock assessment marks and allow the teacher to edit records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reopen Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Teacher requested score correction after re-grading student exam paper."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
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
        <DialogContent className="max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Bulk Approve Submissions
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                You have selected {selectedRowIds.length} submission(s) for approval.
              </DialogDescription>
            </div>
          </div>

          <div className="space-y-3.5 py-2 text-xs text-slate-600 dark:text-slate-300">
            <p>
              Each selected submission will be validated independently. Valid submissions will be approved and locked for editing.
            </p>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-start gap-2.5 text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
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
