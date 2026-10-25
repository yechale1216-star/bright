'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  RefreshCw,
  Sparkles,
  BarChart3,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  GraduationCap,
  Users,
  Award,
  Layers,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  X,
  Info,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import {
  gradebookService,
  AssessmentReportsAnalyticsData,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/utils';

// Color Palette for Visual Analytics
const BAR_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#f43f5e', // Rose
];

export interface ReportCategoryMeta {
  key: string;
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  icon: any;
}

const REPORT_CATEGORIES: ReportCategoryMeta[] = [
  {
    key: 'CLASS_PERFORMANCE',
    title: 'Class Academic Performance',
    shortTitle: 'Class Performance',
    badge: 'Section / Cohort',
    description: 'Evaluate active and completed counts, class averages, pass rates, and academic support needs.',
    icon: Users,
  },
  {
    key: 'SUBJECT_PERFORMANCE',
    title: 'Subject Performance Report',
    shortTitle: 'Subject Report',
    badge: 'Curriculum Subject',
    description: 'Evaluate marks, pass rates, mark distribution across grading scale bands, and section comparisons.',
    icon: BookOpen,
  },
  {
    key: 'GRADE_LEVEL',
    title: 'Grade-Level Academic Report',
    shortTitle: 'Grade-Level',
    badge: 'Inter-Section',
    description: 'Review academic performance and benchmark comparisons across all sections within a grade.',
    icon: Layers,
  },
  {
    key: 'ANNUAL_ACADEMIC',
    title: 'Annual Academic Report',
    shortTitle: 'Annual Report',
    badge: 'Full-Year Promotion',
    description: 'Consolidated annual review with one record per student and authoritative promotion eligibility.',
    icon: Award,
  },
];

export default function AssessmentReportsPage() {
  const pathname = usePathname();
  const isAcademicHead = pathname?.startsWith('/school/academic-head');
  const assessmentsBackHref = isAcademicHead
    ? '/school/academic-head/assessments'
    : '/school/admin/assessments';

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Metadata dropdowns
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // Selected Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('CLASS_PERFORMANCE');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('all');
  const [selectedGradeId, setSelectedGradeId] = useState('all');
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [selectedStreamId, setSelectedStreamId] = useState('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('all');

  // Analytics Data
  const [analytics, setAnalytics] = useState<AssessmentReportsAnalyticsData | null>(null);

  // Table Search and Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // View Detailed Report Dialog
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReportItem, setSelectedReportItem] = useState<any | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Hover state for Bar Chart tooltips
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Check if senior grade selected (Grades 11 or 12 require stream filtering)
  const isSeniorGrade = useMemo(() => {
    if (!selectedGradeId || selectedGradeId === 'all') return false;
    const g = grades.find((gr) => gr.id === selectedGradeId);
    if (!g) return false;
    const name = (g.name || '').toLowerCase();
    return name.includes('11') || name.includes('12') || name.includes('grade 11') || name.includes('grade 12');
  }, [selectedGradeId, grades]);

  // Current Academic Year & Terms
  const activeYearObj = useMemo(() => {
    return academicYears.find((y) => y.id === selectedYearId) || academicYears[0] || null;
  }, [academicYears, selectedYearId]);

  const availableTerms = useMemo(() => {
    return activeYearObj?.terms || [];
  }, [activeYearObj]);

  // 1. Initial Load of Metadata (Academic Years, Grades, Streams, Subjects)
  useEffect(() => {
    loadInitialMetadata();
  }, []);

  const loadInitialMetadata = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const [ayRes, gradesRes, streamsRes, subjectsRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/schools/me/streams`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/settings/subjects`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (ayRes?.success && Array.isArray(ayRes.data) && ayRes.data.length > 0) {
        setAcademicYears(ayRes.data);
        const currentYear = ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        setSelectedYearId(currentYear.id);
        if (currentYear.terms && currentYear.terms.length > 0) {
          const currentTerm = currentYear.terms.find((t: any) => t.isCurrent) || currentYear.terms[0];
          setSelectedTermId(currentTerm.id);
        }
      }

      if (gradesRes?.success && Array.isArray(gradesRes.data)) {
        setGrades(gradesRes.data);
      }

      if (streamsRes?.success && Array.isArray(streamsRes.data)) {
        setStreams(streamsRes.data);
      }

      if (subjectsRes?.success && Array.isArray(subjectsRes.data)) {
        setSubjects(subjectsRes.data);
      }
    } catch (err: any) {
      notifications.error('Metadata Error', err?.message || 'Failed to load filters');
    } finally {
      setLoading(false);
    }
  };

  // 2. Dynamic Sections when selectedGradeId changes
  useEffect(() => {
    if (!selectedGradeId || selectedGradeId === 'all') {
      setSections([]);
      setSelectedSectionId('all');
      return;
    }

    const fetchSections = async () => {
      try {
        const token = localStorage.getItem('attendance_token');
        const { getApiUrl } = await import('@/lib/api-config');
        const res = await fetch(`${getApiUrl()}/api/schools/sections?gradeId=${selectedGradeId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json());
        if (res?.success && Array.isArray(res.data)) {
          setSections(res.data);
        } else {
          setSections([]);
        }
      } catch {
        setSections([]);
      }
    };

    fetchSections();
  }, [selectedGradeId]);

  // 3. Dynamic Students when Grade/Section changes (for Student Academic Report)
  useEffect(() => {
    if (selectedCategory !== 'STUDENT_ACADEMIC') return;

    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem('attendance_token');
        const { getApiUrl } = await import('@/lib/api-config');
        const query = new URLSearchParams();
        if (selectedGradeId && selectedGradeId !== 'all') query.set('gradeId', selectedGradeId);
        if (selectedSectionId && selectedSectionId !== 'all') query.set('sectionId', selectedSectionId);

        const res = await fetch(`${getApiUrl()}/api/students?${query.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json());

        if (res?.success && Array.isArray(res.data)) {
          setStudents(res.data);
          if (res.data.length > 0 && selectedStudentId === 'all') {
            setSelectedStudentId(res.data[0].id);
          }
        } else {
          setStudents([]);
        }
      } catch {
        setStudents([]);
      }
    };

    fetchStudents();
  }, [selectedCategory, selectedGradeId, selectedSectionId]);

  // 4. Load or Generate Analytics Report
  const loadReportAnalytics = useCallback(async () => {
    if (!selectedYearId) return;
    try {
      setGenerating(true);
      const data = await gradebookService.getAssessmentReportsAnalytics({
        academicYearId: selectedYearId,
        academicTermId: selectedCategory === 'ANNUAL_ACADEMIC' ? undefined : (selectedTermId !== 'all' ? selectedTermId : undefined),
        gradeId: selectedGradeId !== 'all' ? selectedGradeId : undefined,
        sectionId: selectedCategory === 'GRADE_LEVEL' ? undefined : (selectedSectionId !== 'all' ? selectedSectionId : undefined),
        streamId: isSeniorGrade && selectedStreamId !== 'all' ? selectedStreamId : undefined,
        subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
        studentId: selectedCategory === 'STUDENT_ACADEMIC' && selectedStudentId !== 'all' ? selectedStudentId : undefined,
        reportType: selectedCategory,
      });

      setAnalytics(data);
      setCurrentPage(1);
    } catch (err: any) {
      notifications.error('Report Generation Error', err?.message || 'Failed to load report analytics');
    } finally {
      setGenerating(false);
    }
  }, [
    selectedYearId,
    selectedTermId,
    selectedGradeId,
    selectedSectionId,
    selectedStreamId,
    selectedSubjectId,
    selectedStudentId,
    selectedCategory,
    isSeniorGrade,
  ]);

  useEffect(() => {
    if (selectedYearId) {
      loadReportAnalytics();
    }
  }, [selectedYearId, selectedCategory, loadReportAnalytics]);

  // Reset Filters
  const handleResetFilters = () => {
    if (academicYears.length > 0) {
      const currentYear = academicYears.find((y: any) => y.isCurrent) || academicYears[0];
      setSelectedYearId(currentYear.id);
      if (currentYear.terms && currentYear.terms.length > 0) {
        setSelectedTermId(currentYear.terms[0].id);
      } else {
        setSelectedTermId('all');
      }
    }
    setSelectedGradeId('all');
    setSelectedSectionId('all');
    setSelectedStreamId('all');
    setSelectedSubjectId('all');
    setSelectedStudentId('all');
  };

  // Inspect Detailed Report Modal
  const handleOpenDetail = async (reportItem: any) => {
    setSelectedReportItem(reportItem);
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const detail = await gradebookService.getDetailedAssessmentReport(reportItem.id, {
        academicYearId: selectedYearId,
        academicTermId: selectedCategory === 'ANNUAL_ACADEMIC' ? undefined : (selectedTermId !== 'all' ? selectedTermId : undefined),
        gradeId: selectedGradeId !== 'all' ? selectedGradeId : undefined,
        sectionId: selectedCategory === 'GRADE_LEVEL' ? undefined : (selectedSectionId !== 'all' ? selectedSectionId : undefined),
        streamId: isSeniorGrade && selectedStreamId !== 'all' ? selectedStreamId : undefined,
        subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
        studentId: selectedCategory === 'STUDENT_ACADEMIC' && selectedStudentId !== 'all' ? selectedStudentId : undefined,
        reportType: selectedCategory,
      });
      setDetailData(detail);
    } catch (err: any) {
      notifications.error('Detail Error', 'Failed to load detailed report data');
    } finally {
      setDetailLoading(false);
    }
  };

  // Export to CSV
  const handleExportCSV = (customRows?: any[], customFilename?: string) => {
    const rows = customRows || detailData?.studentRows || analytics?.availableReports || [];
    if (!rows || rows.length === 0) {
      notifications.warning('Export Alert', 'No report records available to export.');
      return;
    }

    const filename = customFilename || `${selectedReportItem?.reportName || selectedCategory}_${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) =>
        headers
          .map((h) => {
            const val = row[h] ?? '';
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifications.success('Export Successful', `Saved as ${filename}`);
  };

  // Active Category Meta
  const activeCategoryMeta = useMemo(() => {
    return REPORT_CATEGORIES.find((c) => c.key === selectedCategory) || REPORT_CATEGORIES[0];
  }, [selectedCategory]);

  // Filtered & Paginated Reports in the Catalog Table
  const filteredReports = useMemo(() => {
    const reports = analytics?.availableReports || [];
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        r.reportName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q) ||
        r.subjectOrStream.toLowerCase().includes(q)
    );
  }, [analytics?.availableReports, searchQuery]);

  const totalPages = Math.ceil(filteredReports.length / pageSize) || 1;
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  // Donut Chart Math for SVG Slices
  const distributionBands = analytics?.distribution?.bands || [];
  const totalResults = analytics?.distribution?.totalResults || 0;

  const donutPaths = useMemo(() => {
    if (totalResults === 0 || distributionBands.length === 0) return [];
    let cumulativeAngle = 0;
    const radius = 70;
    const innerRadius = 45;
    const centerX = 80;
    const centerY = 80;

    return distributionBands.map((band) => {
      const sliceAngle = (band.percentage / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + sliceAngle;
      cumulativeAngle += sliceAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const x3 = centerX + innerRadius * Math.cos(endRad);
      const y3 = centerY + innerRadius * Math.sin(endRad);
      const x4 = centerX + innerRadius * Math.cos(startRad);
      const y4 = centerY + innerRadius * Math.sin(startRad);

      const largeArc = sliceAngle > 180 ? 1 : 0;
      const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        pathData,
        color: band.color,
        name: band.name,
        percentage: band.percentage,
        count: band.count,
      };
    });
  }, [distributionBands, totalResults]);

  const [isChartExpanded, setIsChartExpanded] = useState(false);

  // Keyboard support: Escape key collapses the expanded chart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChartExpanded) {
        setIsChartExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChartExpanded]);

  const COLLAPSED_BAR_LIMIT = 6;
  const totalChartCohorts = analytics?.subjectPerformance?.length || 0;
  const hasMoreCohorts = totalChartCohorts > COLLAPSED_BAR_LIMIT;

  const DEFAULT_SCORE_RANGES = useMemo(() => [
    { subjectId: '90–100', subjectName: '90–100', subjectCode: '90–100', averageScore: 0, studentCount: 0, color: '#22c55e' },
    { subjectId: '80–89', subjectName: '80–89', subjectCode: '80–89', averageScore: 0, studentCount: 0, color: '#3b82f6' },
    { subjectId: '70–79', subjectName: '70–79', subjectCode: '70–79', averageScore: 0, studentCount: 0, color: '#8b5cf6' },
    { subjectId: '60–69', subjectName: '60–69', subjectCode: '60–69', averageScore: 0, studentCount: 0, color: '#fbbf24' },
    { subjectId: '50–59', subjectName: '50–59', subjectCode: '50–59', averageScore: 0, studentCount: 0, color: '#f97316' },
    { subjectId: 'Below 50', subjectName: 'Below 50', subjectCode: 'Below 50', averageScore: 0, studentCount: 0, color: '#ef4444' },
  ], []);

  const subjectsChartData = useMemo(() => {
    const list = analytics?.subjectPerformance || [];
    if (selectedCategory === 'CLASS_PERFORMANCE') {
      return list.length > 0 ? list : DEFAULT_SCORE_RANGES;
    }
    return isChartExpanded ? list : list.slice(0, COLLAPSED_BAR_LIMIT);
  }, [analytics?.subjectPerformance, isChartExpanded, selectedCategory, DEFAULT_SCORE_RANGES]);

  // For CLASS_PERFORMANCE: Dynamic student count scale
  // Matches the screenshot ticks: 20, 15, 10, 5, 0 (or adaptive multiple of 5 if max > 20)
  const classPerformanceYAxis = useMemo(() => {
    if (selectedCategory !== 'CLASS_PERFORMANCE') {
      return { yMax: 100, ticks: [100, 80, 60, 40, 20, 0] };
    }
    const maxStudents = Math.max(...subjectsChartData.map((d) => d.studentCount || 0), 0);
    // Base max is 20 (matching the screenshot) or rounded up to next multiple of 5
    const yMax = maxStudents <= 20 ? 20 : Math.ceil(maxStudents / 5) * 5;
    const step = yMax / 4;
    const ticks = [yMax, Math.round(step * 3), Math.round(step * 2), Math.round(step * 1), 0];
    return { yMax, ticks };
  }, [selectedCategory, subjectsChartData]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-screen text-foreground print:p-0 print:max-w-none">
      {/* ─── Header & Global Actions ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Link
            href={assessmentsBackHref}
            className={cn(
              "p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs",
              isAcademicHead ? "hover:text-violet-600 dark:hover:text-violet-400" : "hover:text-blue-600 dark:hover:text-blue-400"
            )}
            title="Back to Assessments"
            aria-label="Back to Assessments"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Academic Reports
          </h1>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReportAnalytics}
            disabled={generating || loading}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border bg-card text-foreground hover:bg-muted"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", generating ? "animate-spin" : "")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border bg-card text-foreground hover:bg-muted"
          >
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Print Report</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV()}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border bg-card text-foreground hover:bg-muted"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* ─── Standard Academic Report Categories Navigation ────────────── */}
      <div className="space-y-2 print:hidden">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Select Standard Report Category
          </label>
          <span className="text-[11px] text-muted-foreground font-medium">
            Category: <strong className="text-foreground">{activeCategoryMeta.shortTitle}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REPORT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  if (selectedCategory !== cat.key) {
                    setSelectedCategory(cat.key);
                  }
                }}
                className={cn(
                  "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 group relative overflow-hidden",
                  isSelected
                    ? isAcademicHead
                      ? "bg-violet-500/10 border-violet-500/40 text-violet-700 dark:text-violet-300 shadow-xs ring-1 ring-violet-500/30"
                      : "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30"
                    : "bg-card border-border hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-xs font-bold leading-tight line-clamp-1">
                    {cat.shortTitle}
                  </span>
                  {isSelected && generating && (
                    <Loader2 className="w-3 h-3 animate-spin text-current shrink-0" />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full border truncate w-fit max-w-full",
                  isSelected
                    ? isAcademicHead ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "border-border text-muted-foreground"
                )}>
                  {cat.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Contextual Filters Bar ──────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs print:hidden">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Report Scope & Context Filters</span>
          </span>
          <div className="flex items-center gap-2">
            {generating && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Evaluating Scope...</span>
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              disabled={generating}
              className="h-7 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset Scope</span>
            </Button>
          </div>
        </div>

        {generating && (
          <div className="h-0.5 w-full bg-primary/20 overflow-hidden rounded-full mb-3">
            <div className="h-full bg-primary w-full animate-pulse" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* Academic Year */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className={cn(
                "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
              )}
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Term */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Reporting Term
            </label>
            <select
              disabled={selectedCategory === 'ANNUAL_ACADEMIC'}
              value={selectedCategory === 'ANNUAL_ACADEMIC' ? 'full_year' : selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className={cn(
                "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 disabled:opacity-60",
                isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
              )}
            >
              {selectedCategory === 'ANNUAL_ACADEMIC' ? (
                <option value="full_year">Full Academic Year (Annual)</option>
              ) : (
                <>
                  <option value="all">All Configured Terms</option>
                  {availableTerms.map((term: any) => (
                    <option key={term.id} value={term.id}>
                      {term.name} {term.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Grade
            </label>
            <select
              value={selectedGradeId}
              onChange={(e) => {
                setSelectedGradeId(e.target.value);
                setSelectedSectionId('all');
                setSelectedStreamId('all');
              }}
              className={cn(
                "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
              )}
            >
              <option value="all">All Grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stream - Visible only for Senior Grades 11/12 */}
          {isSeniorGrade && (
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Stream</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Gr 11-12</span>
              </label>
              <select
                value={selectedStreamId}
                onChange={(e) => setSelectedStreamId(e.target.value)}
                className={cn(
                  "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                  isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
                )}
              >
                <option value="all">All Streams</option>
                {streams.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section (Hidden for Grade-Level inter-section reports) */}
          {selectedCategory !== 'GRADE_LEVEL' && (
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Section
              </label>
              <select
                disabled={selectedGradeId === 'all'}
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={cn(
                  "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 disabled:opacity-60",
                  isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
                )}
              >
                <option value="all">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject Filter (Relevant for Subject Performance) */}
          {selectedCategory === 'SUBJECT_PERFORMANCE' ? (
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className={cn(
                  "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                  isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
                )}
              >
                <option value="all">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Button
                onClick={loadReportAnalytics}
                disabled={generating || loading}
                className={cn(
                  "w-full h-9 gap-1.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center text-white",
                  isAcademicHead ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Generate Report</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Action button if subject dropdown took the 6th slot */}
          {selectedCategory === 'SUBJECT_PERFORMANCE' && (
            <div className="col-span-full sm:col-span-1">
              <Button
                onClick={loadReportAnalytics}
                disabled={generating || loading}
                className={cn(
                  "w-full h-9 gap-1.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center text-white",
                  isAcademicHead ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Apply Filters</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 4 Executive KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {generating ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs animate-pulse">
              <div className="h-3 w-24 bg-muted/80 rounded" />
              <div className="h-7 w-28 bg-muted rounded mt-2.5" />
              <div className="h-3 w-36 bg-muted/60 rounded mt-2" />
            </div>
          ))
        ) : (
          <>
            {/* Card 1 */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs transition-all hover:shadow-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {analytics?.summary?.card1Title || 'Active Enrolled'}
              </p>
              <p className="text-2xl font-black text-foreground tracking-tight mt-1">
                {analytics?.summary?.card1Val ?? '0'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {analytics?.summary?.card1Sub || 'Total active population'}
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs transition-all hover:shadow-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {analytics?.summary?.card2Title || 'Cohort Average'}
              </p>
              <p className={cn(
                "text-2xl font-black tracking-tight mt-1",
                isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400"
              )}>
                {analytics?.summary?.card2Val ?? '0%'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {analytics?.summary?.card2Sub || 'Institutional benchmark'}
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs transition-all hover:shadow-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {analytics?.summary?.card3Title || 'Pass Rate'}
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
                {analytics?.summary?.card3Val ?? '0%'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {analytics?.summary?.card3Sub || 'Assessed candidates meeting criteria'}
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs transition-all hover:shadow-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {analytics?.summary?.card4Title || 'Academic Support'}
              </p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight mt-1">
                {analytics?.summary?.card4Val ?? '0'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {analytics?.summary?.card4Sub || 'Requires academic intervention'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ─── Evidence-Based Academic Recommendations Banner ──────────────── */}
      {generating ? (
        <div className="p-4 rounded-2xl bg-muted/30 border border-border/70 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-muted/80" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-48 bg-muted/80 rounded" />
              <div className="h-3 w-72 bg-muted/60 rounded" />
            </div>
          </div>
          <div className="h-3 w-28 bg-muted/50 rounded hidden sm:block" />
        </div>
      ) : (
        analytics?.recommendations && analytics.recommendations.length > 0 && (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className={cn(
                "p-2 rounded-xl shrink-0 mt-0.5",
                isAcademicHead ? "bg-violet-600 text-white" : "bg-blue-600 text-white"
              )}>
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Evidence-Based Findings & Recommendations
                </h4>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                  {analytics.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground shrink-0 sm:text-right">
              Evaluated by Authoritative Engine
            </div>
          </div>
        )
      )}

      {/* ─── Visual Analytics: Bar Chart & Distribution Donut ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-300">
        {/* Left: Performance Overview (Bar Chart) - Expands across full width when toggled or for non-CLASS_PERFORMANCE */}
        <div
          className={cn(
            "p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between transition-all duration-300 ease-in-out min-w-0",
            (isChartExpanded || selectedCategory !== 'CLASS_PERFORMANCE') ? "lg:col-span-12" : "lg:col-span-7 overflow-hidden"
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    {selectedCategory === 'CLASS_PERFORMANCE'
                      ? 'Student Performance by Score Range'
                      : (analytics?.summary?.chartTitle || 'Performance Overview')}
                  </h2>
                  {isChartExpanded && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Full Width View
                    </span>
                  )}
                </div>
                {selectedCategory !== 'CLASS_PERFORMANCE' && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isChartExpanded
                      ? `Expanded view showing all ${subjectsChartData.length} evaluated cohorts across full width`
                      : (analytics?.summary?.chartSub || 'Percentage achievement comparisons across cohorts')}
                  </p>
                )}
              </div>

              {selectedCategory === 'CLASS_PERFORMANCE' ? (
                /* Screenshot Legend + Expand/Collapse button to toggle side-by-side with Result Distribution */
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-1.5 select-none">
                    <span className="w-3 h-3 rounded-xs bg-[#3b82f6] shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                      Number of Students
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChartExpanded((prev) => !prev)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsChartExpanded((prev) => !prev);
                      }
                    }}
                    aria-expanded={isChartExpanded}
                    aria-label={
                      isChartExpanded
                        ? "Collapse bar chart and restore side-by-side distribution chart"
                        : "Expand bar chart over adjacent result distribution chart to occupy full width"
                    }
                    title={
                      isChartExpanded
                        ? "Collapse to side-by-side layout (Press Esc)"
                        : "Expand bar chart across full width (temporarily hides distribution chart)"
                    }
                    className={cn(
                      "h-8 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 select-none cursor-pointer",
                      isChartExpanded
                        ? isAcademicHead
                          ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700 focus:ring-violet-500/30 shadow-xs"
                          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 focus:ring-blue-500/30 shadow-xs"
                        : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border focus:ring-primary/20"
                    )}
                  >
                    {isChartExpanded ? (
                      <>
                        <ChevronsLeft className="w-3.5 h-3.5 transition-transform" />
                        <span className="text-[11px] font-bold hidden sm:inline">Collapse</span>
                      </>
                    ) : (
                      <>
                        <ChevronsRight className="w-3.5 h-3.5 transition-transform" />
                        <span className="text-[11px] font-bold hidden sm:inline">View More</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Controls: Legend + Scale Badge + Expand/Collapse Arrow Button */
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 select-none">
                    <span className="w-3 h-3 rounded-xs bg-[#3b82f6] shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                      {selectedCategory === 'GRADE_LEVEL'
                        ? 'Academic Performance (%)'
                        : selectedCategory === 'SUBJECT_PERFORMANCE'
                        ? 'Average Score (%)'
                        : 'Academic Average (%)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground hidden md:inline-block">
                    Scale: 0–100%
                  </span>
                  {hasMoreCohorts && (
                    <button
                      type="button"
                      onClick={() => setIsChartExpanded((prev) => !prev)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setIsChartExpanded((prev) => !prev);
                        }
                      }}
                      aria-expanded={isChartExpanded}
                      aria-label={
                        isChartExpanded
                          ? "Collapse bar chart and restore standard view"
                          : "View more cohorts across full width"
                      }
                      title={
                        isChartExpanded
                          ? "Collapse to top cohorts (Press Esc)"
                          : "View more cohorts across full width"
                      }
                      className={cn(
                        "h-8 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 select-none cursor-pointer",
                        isChartExpanded
                          ? isAcademicHead
                            ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700 focus:ring-violet-500/30 shadow-xs"
                            : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 focus:ring-blue-500/30 shadow-xs"
                          : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border focus:ring-primary/20"
                      )}
                    >
                      {isChartExpanded ? (
                        <>
                          <ChevronsLeft className="w-3.5 h-3.5 transition-transform" />
                          <span className="text-[11px] font-bold hidden sm:inline">Collapse</span>
                        </>
                      ) : (
                        <>
                          <ChevronsRight className="w-3.5 h-3.5 transition-transform" />
                          <span className="text-[11px] font-bold hidden sm:inline">View More</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {generating ? (
            /* ─── Skeleton Loading State for Bar Chart ─── */
            <div className="mt-8 flex gap-2 sm:gap-4 w-full min-w-0">
              <div className="w-6 sm:w-8 shrink-0 flex items-center justify-center relative select-none">
                <span className="transform -rotate-90 whitespace-nowrap text-xs font-medium text-muted-foreground animate-pulse">
                  Evaluating...
                </span>
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <div className="relative h-64 sm:h-72 w-full rounded-2xl bg-muted/20 border border-border/40 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-end justify-center gap-3 sm:gap-6 h-40 w-full px-6">
                    <div className="flex-1 max-w-[84px] h-14 bg-muted/50 rounded-t-md animate-pulse" />
                    <div className="flex-1 max-w-[84px] h-28 bg-muted/70 rounded-t-md animate-pulse" />
                    <div className="flex-1 max-w-[84px] h-36 bg-muted rounded-t-md animate-pulse" />
                    <div className="flex-1 max-w-[84px] h-24 bg-muted/70 rounded-t-md animate-pulse" />
                    <div className="flex-1 max-w-[84px] h-16 bg-muted/50 rounded-t-md animate-pulse" />
                    <div className="flex-1 max-w-[84px] h-10 bg-muted/40 rounded-t-md animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mt-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Computing {activeCategoryMeta.shortTitle} benchmarks across selected scope...</span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedCategory === 'CLASS_PERFORMANCE' ? (
            /* ─── Exact Screenshot Bar Chart for CLASS_PERFORMANCE ─── */
            <div className="mt-8 flex gap-2 sm:gap-4 w-full min-w-0">
              {/* Rotated Y-Axis Label: "Number of Students" */}
              <div className="w-6 sm:w-8 shrink-0 flex items-center justify-center relative select-none">
                <span className="transform -rotate-90 whitespace-nowrap text-xs font-medium text-muted-foreground">
                  Number of Students
                </span>
              </div>

              {/* Chart Body */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Ticks & Horizontal Gridlines Container */}
                <div className="relative h-64 sm:h-72 w-full">
                  {/* Horizontal gridlines with Y tick numbers */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0">
                    {classPerformanceYAxis.ticks.map((tick) => (
                      <div key={tick} className="flex items-center gap-2.5 w-full">
                        <span className="w-5 text-right text-xs font-normal text-muted-foreground shrink-0 font-mono">
                          {tick}
                        </span>
                        <div className="flex-1 border-b border-border/60" />
                      </div>
                    ))}
                  </div>

                  {/* 6 Score Range Bars */}
                  <div className="absolute inset-0 pl-8 pr-2 flex items-end justify-around gap-2 sm:gap-6 z-10 pb-0">
                    {subjectsChartData.map((item, idx) => {
                      const count = item.studentCount || 0;
                      const heightPct = Math.min(100, Math.max(0, (count / classPerformanceYAxis.yMax) * 100));
                      const barColor = item.color || BAR_COLORS[idx % BAR_COLORS.length];
                      const isHovered = hoveredBarIndex === idx;

                      return (
                        <div
                          key={item.subjectId || idx}
                          className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative max-w-[84px]"
                          onMouseEnter={() => setHoveredBarIndex(idx)}
                          onMouseLeave={() => setHoveredBarIndex(null)}
                        >
                          {/* Tooltip */}
                          {isHovered && (
                            <div className="absolute -top-14 z-20 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground border border-border text-[10px] font-semibold shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                              <p className="font-bold text-foreground">Score Range: {item.subjectName}</p>
                              <p className="text-muted-foreground font-normal">
                                Students: <span className="font-bold text-foreground">{count}</span> ({item.averageScore}% of class)
                              </p>
                            </div>
                          )}

                          {/* Student Count Label directly above the bar */}
                          <span className="text-xs sm:text-sm font-bold text-foreground mb-1.5 transition-transform group-hover:scale-110">
                            {count}
                          </span>

                          {/* Bar */}
                          <div
                            className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:brightness-105 group-hover:shadow-md"
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: barColor,
                              minHeight: count > 0 ? '4px' : '0px',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-Axis labels underneath the bars */}
                <div className="pl-8 pr-2 mt-3 flex items-center justify-around gap-2 sm:gap-6">
                  {subjectsChartData.map((item, idx) => (
                    <div key={item.subjectId || idx} className="flex-1 text-center max-w-[84px]">
                      <span className="text-xs font-medium text-foreground select-none">
                        {item.subjectName}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Centered "Score Range" at bottom */}
                <div className="mt-4 text-center">
                  <span className="text-xs font-semibold text-muted-foreground select-none">
                    Score Range
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ─── Cohort Comparison Bar Chart (Grade Level / Subject / Annual) ─── */
            <div className="mt-8 flex gap-2 sm:gap-4 w-full min-w-0">
              {/* Rotated Y-Axis Label: "Academic Performance (%)" */}
              <div className="w-6 sm:w-8 shrink-0 flex items-center justify-center relative select-none">
                <span className="transform -rotate-90 whitespace-nowrap text-xs font-medium text-muted-foreground">
                  {selectedCategory === 'GRADE_LEVEL'
                    ? 'Academic Performance (%)'
                    : selectedCategory === 'SUBJECT_PERFORMANCE'
                    ? 'Average Score (%)'
                    : 'Academic Average (%)'}
                </span>
              </div>

              {/* Chart Body */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Ticks & Horizontal Gridlines Container */}
                <div className="relative h-64 sm:h-72 w-full">
                  {/* Horizontal gridlines with Y tick numbers */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0">
                    {[100, 80, 60, 40, 20, 0].map((tick) => (
                      <div key={tick} className="flex items-center gap-2.5 w-full">
                        <span className="w-7 text-right text-xs font-normal text-muted-foreground shrink-0 font-mono">
                          {tick}%
                        </span>
                        <div className="flex-1 border-b border-border/60" />
                      </div>
                    ))}
                  </div>

                  {/* Bars Container */}
                  <div className="absolute inset-0 pl-9 pr-2 flex items-end justify-around gap-2 sm:gap-6 z-10 pb-0">
                    {subjectsChartData.length === 0 ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground">
                        <BarChart3 className="w-8 h-8 stroke-1 text-muted-foreground/40 mb-2" />
                        <span>No completed assessment benchmarks recorded in this scope</span>
                      </div>
                    ) : (
                      subjectsChartData.map((item, idx) => {
                        const color = item.color || BAR_COLORS[idx % BAR_COLORS.length];
                        const heightPct = Math.min(100, Math.max(0, item.averageScore));
                        const isHovered = hoveredBarIndex === idx;

                        return (
                          <div
                            key={item.subjectId || idx}
                            className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative max-w-[84px]"
                            onMouseEnter={() => setHoveredBarIndex(idx)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                          >
                            {/* Tooltip */}
                            {isHovered && (
                              <div className="absolute -top-14 z-20 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground border border-border text-[10px] font-semibold shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                                <p className="font-bold text-foreground">{item.subjectName}: <span className="text-emerald-500">{item.averageScore}%</span></p>
                                <p className="text-muted-foreground font-normal">
                                  Students: <span className="font-semibold text-foreground">{item.studentCount}</span>
                                  {item.highestScore ? ` | High: ${item.highestScore}%` : ''}
                                  {item.lowestScore ? ` | Low: ${item.lowestScore}%` : ''}
                                </p>
                              </div>
                            )}

                            {/* Percentage Label on top of bar */}
                            <span className="text-xs sm:text-sm font-bold text-foreground mb-1.5 transition-transform group-hover:scale-110">
                              {Math.round(item.averageScore)}%
                            </span>

                            {/* The Bar */}
                            <div
                              className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:brightness-105 group-hover:shadow-md"
                              style={{
                                height: `${heightPct}%`,
                                backgroundColor: color,
                                minHeight: item.averageScore > 0 ? '4px' : '0px',
                              }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* X-Axis labels underneath the bars */}
                <div className="pl-9 pr-2 mt-3 flex items-center justify-around gap-2 sm:gap-6">
                  {subjectsChartData.map((item, idx) => (
                    <div key={item.subjectId || idx} className="flex-1 text-center max-w-[84px]">
                      <span className="text-xs font-medium text-foreground select-none truncate block" title={item.subjectName}>
                        {item.subjectCode || item.subjectName}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Centered Category at bottom (Grade Level / Class Sections / Curriculum Subjects) */}
                <div className="mt-4 text-center">
                  <span className="text-xs font-semibold text-muted-foreground select-none">
                    {selectedCategory === 'GRADE_LEVEL'
                      ? (selectedGradeId === 'all' ? 'Grade Level' : 'Class Sections')
                      : selectedCategory === 'SUBJECT_PERFORMANCE'
                      ? 'Curriculum Subjects'
                      : 'Academic Cohorts'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed view indicator and View More action (only for non-Class Performance) */}
          {!isChartExpanded && selectedCategory !== 'CLASS_PERFORMANCE' && hasMoreCohorts && (
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="text-[11px]">
                Showing top {COLLAPSED_BAR_LIMIT} of {totalChartCohorts} cohorts
              </span>
              <button
                type="button"
                onClick={() => setIsChartExpanded(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer focus:outline-none"
              >
                <span>View More</span>
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Result Distribution (Donut Chart) - Displayed ONLY for Class Performance report */}
        {!isChartExpanded && selectedCategory === 'CLASS_PERFORMANCE' && (
          <div className="lg:col-span-5 p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between transition-all duration-300 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Result Distribution
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Breakdown across official institutional grading scale bands
              </p>
            </div>

            {generating ? (
              <div className="my-8 flex flex-col items-center justify-center gap-3">
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-border flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground animate-pulse">
                  Evaluating distribution bands...
                </span>
              </div>
            ) : (
              <>
                {/* SVG Donut — centered */}
                <div className="mt-6 flex justify-center">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    {donutPaths.length > 0 ? (
                      <svg width="144" height="144" viewBox="0 0 160 160" className="transform -rotate-90">
                        {donutPaths.map((slice, i) => (
                          <path
                            key={i}
                            d={slice.pathData}
                            fill={slice.color}
                            className="transition-all hover:opacity-85 hover:scale-[1.02] cursor-pointer origin-center"
                          />
                        ))}
                      </svg>
                    ) : (
                      <div className="w-32 h-32 rounded-full border-4 border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground text-center p-2">
                        No graded results
                      </div>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-xl font-black text-foreground tracking-tight leading-tight">
                        {totalResults.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Evaluated
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
                  {distributionBands.map((band, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: band.color }}
                        />
                        <span className="font-medium text-foreground truncate">
                          {band.name}
                        </span>
                      </div>
                      <span className="font-semibold text-muted-foreground shrink-0">
                        {band.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Available Reports Catalog Table Section ─────────────────────── */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
        {/* Table Header with Search & Reset */}
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Standard Academic Reports Catalog
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Available reports in <strong className="text-foreground">{activeCategoryMeta.title}</strong> ready for review, print, and export
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search report roster..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className={cn(
                  "h-9 pl-9 pr-3 rounded-xl border border-input text-xs bg-background text-foreground placeholder:text-muted-foreground",
                  isAcademicHead ? "focus-visible:ring-violet-500/20" : "focus-visible:ring-blue-500/20"
                )}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
            >
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Report Title</th>
                <th className="py-3 px-4">Standard Category</th>
                <th className="py-3 px-4">Academic Year</th>
                <th className="py-3 px-4">Term</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4 text-right">Cohort Average</th>
                <th className="py-3 px-4 text-center">Students</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {generating ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-xs font-semibold text-foreground">
                        Loading reports for {activeCategoryMeta.shortTitle}...
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Evaluating report roster across selected scope and filters
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <FileText className="w-8 h-8 stroke-1 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-semibold text-sm">No report records found in this scope</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adjust your academic year, grade, or section filter to evaluate matching cohorts.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={report.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                        {globalIdx}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">
                          {report.reportName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Generated: {report.generatedOn}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border text-foreground">
                          {report.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {report.academicYear}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {report.term}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{report.grade}</div>
                        <div className="text-[11px] text-muted-foreground">{report.subjectOrStream}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg",
                          (report.averageScore || 0) >= 50
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}>
                          {report.averageScore !== undefined ? `${report.averageScore}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                        {report.studentCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetail(report)}
                            className={cn(
                              "h-7 px-2.5 rounded-lg text-xs font-semibold gap-1",
                              isAcademicHead
                                ? "text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-violet-200 dark:border-violet-800"
                                : "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 text-xs">
                              <DropdownMenuItem onClick={() => handleOpenDetail(report)} className="gap-2">
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View Roster
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedReportItem(report);
                                  handleExportCSV([report], `${report.reportName}.csv`);
                                }}
                                className="gap-2"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Export CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.print()} className="gap-2">
                                <Printer className="w-3.5 h-3.5 text-muted-foreground" /> Print Summary
                              </DropdownMenuItem>
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

        {/* Table Footer with Pagination */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-foreground">{paginatedReports.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, filteredReports.length)}</span> of{' '}
            <span className="font-semibold text-foreground">{filteredReports.length}</span> reports
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 rounded-lg border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "h-8 w-8 p-0 rounded-lg text-xs font-bold",
                  currentPage === page
                    ? (isAcademicHead
                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white")
                    : "border-border text-foreground hover:bg-muted"
                )}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 rounded-lg border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Standard Detailed Report Inspection & Print Dialog ──────────── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-lg font-bold text-foreground">
              <div className="flex items-center gap-2">
                <FileText
                  className={cn(
                    "w-5 h-5",
                    isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400"
                  )}
                />
                <span>{selectedReportItem?.reportName || 'Academic Report Details'}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-muted text-foreground">
                {selectedReportItem?.type}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {detailData?.schoolInfo?.name || 'Bright Path School'} • {selectedReportItem?.academicYear} | {selectedReportItem?.term} | {selectedReportItem?.grade} ({selectedReportItem?.subjectOrStream})
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw
                className={cn(
                  "w-8 h-8 animate-spin",
                  isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400"
                )}
              />
              <p className="text-xs text-muted-foreground font-semibold">
                Loading official student assessment roster and calculations...
              </p>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Quick Metric Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Candidates Evaluated</span>
                  <span className="text-base font-extrabold text-foreground">{detailData?.studentRows?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Cohort Benchmark</span>
                  <span className={cn(
                    "text-base font-extrabold",
                    isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400"
                  )}>
                    {selectedReportItem?.averageScore ?? 0}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Engine Calculation</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">Authoritative</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Audit Status</span>
                  <span className="text-base font-extrabold text-foreground">Verified</span>
                </div>
              </div>

              {/* Student Roster Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-[10px] font-bold text-muted-foreground uppercase">
                      <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                      <th className="py-2.5 px-3">Student ID</th>
                      <th className="py-2.5 px-3">Candidate Name</th>

                      {selectedReportItem?.typeKey === 'STUDENT_ACADEMIC' ? (
                        <>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3 text-right">Mark</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3">Teacher Remarks</th>
                        </>
                      ) : selectedReportItem?.typeKey === 'ANNUAL_ACADEMIC' ? (
                        <>
                          <th className="py-2.5 px-3">Grade & Section</th>
                          <th className="py-2.5 px-3 text-right">Term 1</th>
                          <th className="py-2.5 px-3 text-right">Term 2</th>
                          <th className="py-2.5 px-3 text-right">Annual Mean</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                          <th className="py-2.5 px-3 text-center">Promotion Status</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-3">Section</th>
                          <th className="py-2.5 px-3 text-right">Score</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3">Academic Recommendation</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(detailData?.studentRows || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No candidate records recorded in this cohort.
                        </td>
                      </tr>
                    ) : (
                      (detailData?.studentRows || []).map((s: any, i: number) => (
                        <tr key={s.id || i} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 text-center font-mono font-bold text-muted-foreground">{s.rank || i + 1}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{s.studentId}</td>
                          <td className="py-2 px-3 font-semibold text-foreground">{s.fullName}</td>

                          {selectedReportItem?.typeKey === 'STUDENT_ACADEMIC' ? (
                            <>
                              <td className="py-2 px-3 font-medium text-foreground">{s.subjectName}</td>
                              <td className="py-2 px-3 text-right font-bold font-mono text-foreground">{s.percentage !== null ? `${s.percentage}%` : 'N/A'}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold px-2 py-0.5 rounded-full text-[10px] bg-muted border border-border">
                                  {s.gradeLetter}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                  s.status === 'Passed'
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : s.status === 'Incomplete'
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                )}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground text-[11px]">{s.teacherRemarks}</td>
                            </>
                          ) : selectedReportItem?.typeKey === 'ANNUAL_ACADEMIC' ? (
                            <>
                              <td className="py-2 px-3 text-muted-foreground">{s.grade} - {s.section}</td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">{s.term1Score !== null ? `${s.term1Score}%` : '—'}</td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">{s.term2Score !== null ? `${s.term2Score}%` : '—'}</td>
                              <td className="py-2 px-3 text-right font-bold font-mono text-foreground">{s.percentage}%</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold px-2 py-0.5 rounded-full text-[10px] bg-muted border border-border">
                                  {s.gradeLetter}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                  s.promotionStatus === 'PROMOTED'
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : s.promotionStatus === 'INCOMPLETE'
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                )}>
                                  {s.promotionStatus}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-3 text-muted-foreground">{s.section}</td>
                              <td className="py-2 px-3 text-right font-bold font-mono text-foreground">{s.percentage !== null ? `${s.percentage}%` : '—'}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold px-2 py-0.5 rounded-full text-[10px] bg-muted border border-border">
                                  {s.gradeLetter}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                  s.status === 'Passed'
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : s.status === 'Incomplete'
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                )}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground text-[11px]">{s.recommendation || 'Regular academic tracking'}</td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-row justify-between items-center gap-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCSV(detailData?.studentRows, `${selectedReportItem?.reportName || 'Report'}.csv`)}
                className="gap-1.5 text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
              >
                <Printer className="w-3.5 h-3.5 text-muted-foreground" /> Print Sheet
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailModalOpen(false)}
              className="border-border text-foreground hover:bg-muted text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
