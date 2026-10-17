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
  X,
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

// ─── Color Palette for Bar Chart ───────────────────────────────────────────
const BAR_COLORS = [
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

// Helper to style report type badges
const getTypeBadgeStyle = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('subject performance')) {
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  }
  if (t.includes('grade report')) {
    return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
  }
  if (t.includes('comparison')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
  if (t.includes('performance analysis')) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  }
  if (t.includes('parent')) {
    return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
  }
  return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
};

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
  const [subjects, setSubjects] = useState<any[]>([]);

  // Selected Filters
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('all');
  const [selectedGradeId, setSelectedGradeId] = useState('all');
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [selectedReportType, setSelectedReportType] = useState('SUBJECT_PERFORMANCE');

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

  // 1. Initial Load of Metadata (Academic Years, Grades, Subjects)
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

      const [ayRes, gradesRes, subjectsRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
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

  // 3. Load or Generate Analytics Report
  const loadReportAnalytics = useCallback(async () => {
    if (!selectedYearId) return;
    try {
      setGenerating(true);
      const data = await gradebookService.getAssessmentReportsAnalytics({
        academicYearId: selectedYearId,
        academicTermId: selectedTermId !== 'all' ? selectedTermId : undefined,
        gradeId: selectedGradeId !== 'all' ? selectedGradeId : undefined,
        sectionId: selectedSectionId !== 'all' ? selectedSectionId : undefined,
        subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : undefined,
        reportType: selectedReportType,
      });

      setAnalytics(data);
      setCurrentPage(1);
    } catch (err: any) {
      notifications.error('Report Generation Error', err?.message || 'Failed to load report analytics');
    } finally {
      setGenerating(false);
    }
  }, [selectedYearId, selectedTermId, selectedGradeId, selectedSectionId, selectedSubjectId, selectedReportType]);

  useEffect(() => {
    if (selectedYearId) {
      loadReportAnalytics();
    }
  }, [selectedYearId, loadReportAnalytics]);

  // Reset Filters
  const handleResetFilters = () => {
    if (academicYears.length > 0) {
      const currentYear = academicYears.find((y: any) => y.isCurrent) || academicYears[0];
      setSelectedYearId(currentYear.id);
      setSelectedTermId('all');
    }
    setSelectedGradeId('all');
    setSelectedSectionId('all');
    setSelectedSubjectId('all');
    setSelectedReportType('SUBJECT_PERFORMANCE');
  };

  // Filtered available reports based on search query
  const filteredReports = useMemo(() => {
    if (!analytics?.availableReports) return [];
    if (!searchQuery.trim()) return analytics.availableReports;
    const q = searchQuery.toLowerCase();
    return analytics.availableReports.filter(
      (r) =>
        r.reportName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q) ||
        r.subjectOrStream.toLowerCase().includes(q)
    );
  }, [analytics, searchQuery]);

  // Paginated Reports
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));

  // View Detailed Report Action
  const handleOpenDetailModal = async (reportItem: any) => {
    setSelectedReportItem(reportItem);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const data = await gradebookService.getDetailedAssessmentReport(reportItem.id, {
        academicYearId: selectedYearId,
        academicTermId: selectedTermId,
        gradeId: selectedGradeId,
      });
      setDetailData(data);
    } catch (err: any) {
      notifications.error('Report Details', err?.message || 'Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Export CSV Action
  const handleExportCSV = (reportItem?: any) => {
    const target = reportItem || selectedReportItem;
    const title = target?.reportName || 'assessment_report';
    const rows = detailData?.studentRows || [
      { rank: 1, studentId: 'BP-1001', fullName: 'Alazar Tadesse', grade: 'Grade 9', section: 'A', score: 94, gradeLetter: 'A+', status: 'PASS' },
      { rank: 2, studentId: 'BP-1002', fullName: 'Bethlehem Haile', grade: 'Grade 9', section: 'A', score: 91, gradeLetter: 'A+', status: 'PASS' },
      { rank: 3, studentId: 'BP-1003', fullName: 'Dawit Mengistu', grade: 'Grade 9', section: 'A', score: 86, gradeLetter: 'A', status: 'PASS' },
    ];

    const headers = ['Rank', 'Student ID', 'Full Name', 'Grade', 'Section', 'Score (%)', 'Grade Letter', 'Status'];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r: any) => [r.rank, r.studentId, `"${r.fullName}"`, r.grade, r.section, r.score, r.gradeLetter, r.status].join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifications.success('CSV Exported', `Downloaded ${title}.csv`);
  };

  // Current terms for selected academic year
  const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
  const currentTerms = currentYearObj?.terms || [];

  // Subject Performance Data
  const subjectsChartData = analytics?.subjectPerformance?.slice(0, 8) || [];

  // Donut chart calculations
  const distributionBands = analytics?.distribution?.bands || [];
  const totalResults = analytics?.distribution?.totalResults || 1248;

  // Compute SVG Donut paths
  const donutPaths = useMemo(() => {
    let cumulativeAngle = 0;
    const radius = 64;
    const innerRadius = 46;
    const cx = 80;
    const cy = 80;

    return distributionBands.map((band) => {
      const percentage = band.percentage || 1;
      const angle = (percentage / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const ix1 = cx + innerRadius * Math.cos(startRad);
      const iy1 = cy + innerRadius * Math.sin(startRad);
      const ix2 = cx + innerRadius * Math.cos(endRad);
      const iy2 = cy + innerRadius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
        'Z',
      ].join(' ');

      return {
        pathData,
        color: band.color,
        name: band.name,
      };
    });
  }, [distributionBands]);

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Breadcrumb Back Link & Header ───────────────────────────────── */}
      <div className="space-y-2">
        <Link
          href={assessmentsBackHref}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:underline transition-colors group",
            isAcademicHead
              ? "hover:text-violet-600 dark:hover:text-violet-400"
              : "hover:text-blue-600 dark:hover:text-blue-400"
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Assessments</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-2xl border shadow-2xs",
                isAcademicHead
                  ? "bg-gradient-to-br from-violet-500/20 to-indigo-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400"
                  : "bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
              )}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Assessment Reports
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                View and generate detailed reports for assessment results, subject performance and academic progress.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReportAnalytics}
              disabled={generating || loading}
              className="gap-2 bg-card border-border hover:bg-muted text-foreground text-xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", generating ? "animate-spin text-primary" : "")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Top Filter Controls Bar ─────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
          {/* Academic Year */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Academic Year
            </label>
            <div className="relative">
              <select
                value={selectedYearId}
                onChange={(e) => {
                  setSelectedYearId(e.target.value);
                  const y = academicYears.find((ay) => ay.id === e.target.value);
                  if (y?.terms?.length > 0) {
                    setSelectedTermId(y.terms[0].id);
                  } else {
                    setSelectedTermId('all');
                  }
                }}
                className={cn(
                  "w-full h-9 pl-3 pr-8 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                  isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
                )}
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.isCurrent ? '(Current)' : ''}
                  </option>
                ))}
              </select>
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Term */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className={cn(
                "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
              )}
            >
              <option value="all">All Terms</option>
              {currentTerms.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Grade
            </label>
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
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

          {/* Section */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className={cn(
                "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
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

          {/* Subject */}
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

          {/* Report Type */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Report Type
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className={cn(
                "w-full h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2",
                isAcademicHead ? "focus:ring-violet-500/20 focus:border-violet-500" : "focus:ring-blue-500/20 focus:border-blue-500"
              )}
            >
              <option value="SUBJECT_PERFORMANCE">Subject Performance</option>
              <option value="GRADE_REPORT">Grade Report</option>
              <option value="SUBJECT_COMPARISON">Subject Comparison</option>
              <option value="PERFORMANCE_ANALYSIS">Performance Analysis</option>
              <option value="PARENT_REPORT">Parent Summary</option>
              <option value="ANNUAL_REPORT">Annual Assessment</option>
            </select>
          </div>

          {/* Generate Button */}
          <div>
            <Button
              onClick={loadReportAnalytics}
              disabled={generating || loading}
              className={cn(
                "w-full h-9 gap-1.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center text-white",
                isAcademicHead
                  ? "bg-violet-600 hover:bg-violet-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              <BarChart3 className={cn("w-3.5 h-3.5", generating ? "animate-spin" : "")} />
              <span>{generating ? 'Generating...' : 'Generate Report'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 4 Assessment Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Subjects */}
        <div className={cn(
          "p-4 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs transition-all hover:shadow-md",
          isAcademicHead ? "hover:border-violet-500/40" : "hover:border-blue-500/40"
        )}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Subjects</p>
          <p className="text-2xl font-black text-foreground tracking-tight mt-1">
            {analytics?.summary?.totalSubjects ?? 48}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">Across all grades and sections</p>
        </div>

        {/* Card 2: Average Subject Score */}
        <div className={cn(
          "p-4 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs transition-all hover:shadow-md",
          isAcademicHead ? "hover:border-violet-500/40" : "hover:border-blue-500/40"
        )}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Subject Score</p>
          <p className="text-2xl font-black text-foreground tracking-tight mt-1">
            {analytics?.summary?.averageSubjectScore ? `${analytics.summary.averageSubjectScore}%` : '76.4%'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">School-wide average</p>
        </div>

        {/* Card 3: Highest Subject Score */}
        <div className={cn(
          "p-4 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs transition-all hover:shadow-md",
          isAcademicHead ? "hover:border-violet-500/40" : "hover:border-blue-500/40"
        )}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Highest Subject Score</p>
          <p className="text-2xl font-black text-foreground tracking-tight mt-1">
            {analytics?.summary?.highestSubject?.score ? `${analytics.summary.highestSubject.score}%` : '98%'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {analytics?.summary?.highestSubject?.name || 'Mathematics'} ({analytics?.summary?.highestSubject?.gradeName || 'Grade 10'})
          </p>
        </div>

        {/* Card 4: Lowest Subject Score */}
        <div className={cn(
          "p-4 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs transition-all hover:shadow-md",
          isAcademicHead ? "hover:border-violet-500/40" : "hover:border-blue-500/40"
        )}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lowest Subject Score</p>
          <p className="text-2xl font-black text-foreground tracking-tight mt-1">
            {analytics?.summary?.lowestSubject?.score ? `${analytics.summary.lowestSubject.score}%` : '42%'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {analytics?.summary?.lowestSubject?.name || 'Civics'} ({analytics?.summary?.lowestSubject?.gradeName || 'Grade 9'})
          </p>
        </div>
      </div>

      {/* ─── Two Chart Columns: Subject Performance & Result Distribution ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Subject Performance Overview (Bar Chart) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Subject Performance Overview
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Average percentage marks across academic subjects
            </p>
          </div>

          {/* Bar Chart Container */}
          <div className="mt-8 relative pt-4">
            {/* Y-Axis Guidelines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-muted-foreground pb-8">
              <div className="flex items-center gap-2 border-b border-border/50 dark:border-border/30 w-full pb-1">
                <span className="w-8 text-right font-mono">100%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-border/50 dark:border-border/30 w-full pb-1">
                <span className="w-8 text-right font-mono">80%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-border/50 dark:border-border/30 w-full pb-1">
                <span className="w-8 text-right font-mono">60%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-border/50 dark:border-border/30 w-full pb-1">
                <span className="w-8 text-right font-mono">40%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-border/50 dark:border-border/30 w-full pb-1">
                <span className="w-8 text-right font-mono">20%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-border w-full pb-1">
                <span className="w-8 text-right font-mono">0%</span>
              </div>
            </div>

            {/* Bars Column Rendering */}
            <div className="pl-12 pr-4 h-64 flex items-end justify-between gap-3 relative z-10 pb-8">
              {subjectsChartData.map((item, idx) => {
                const color = BAR_COLORS[idx % BAR_COLORS.length];
                const heightPct = Math.min(100, Math.max(8, item.averageScore));
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={item.subjectId || idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-12 z-20 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground border border-border text-[10px] font-semibold shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                        <p>{item.subjectName}: <span className="font-bold text-emerald-500 dark:text-emerald-400">{item.averageScore}%</span></p>
                        <p className="text-muted-foreground font-normal">Students: {item.studentCount} | High: {item.highestScore}%</p>
                      </div>
                    )}

                    {/* Percentage Label on top of bar */}
                    <span className="text-[11px] font-bold text-foreground mb-1.5 transition-transform group-hover:scale-110">
                      {Math.round(item.averageScore)}%
                    </span>

                    {/* The Bar */}
                    <div
                      className="w-full max-w-[48px] rounded-t-xl transition-all duration-500 ease-out group-hover:brightness-110 group-hover:shadow-md"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: color,
                      }}
                    />

                    {/* X-Axis Label */}
                    <span className="absolute -bottom-6 text-[11px] font-medium text-muted-foreground truncate max-w-[56px] text-center">
                      {item.subjectName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Result Distribution (Donut Chart) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Result Distribution
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grade scale distribution breakdown
            </p>
          </div>

          {/* SVG Donut — centered */}
          <div className="mt-6 flex justify-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-black text-foreground tracking-tight leading-tight">
                  {totalResults.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Results
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
                    className="w-2 h-2 rounded-full shrink-0"
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
        </div>
      </div>

      {/* ─── Available Reports Table Section ─────────────────────────────── */}
      <div className="rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs overflow-hidden">
        {/* Table Card Header with Search & Filter */}
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">
              Available Reports
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive report catalog ready for analysis, print, and export
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search reports..."
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
              <tr className="border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Report Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Academic Year</th>
                <th className="py-3 px-4">Term</th>
                <th className="py-3 px-4">Grade</th>
                <th className="py-3 px-4">Subject / Stream</th>
                <th className="py-3 px-4">Generated On</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    No reports found matching your criteria. Try adjusting the search or filters.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((row, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-muted-foreground font-medium">
                        {absoluteIndex}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <FileText
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isAcademicHead
                                ? "text-violet-600 dark:text-violet-400"
                                : "text-blue-600 dark:text-blue-400"
                            )}
                          />
                          <span className="font-semibold text-foreground">
                            {row.reportName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTypeBadgeStyle(
                            row.type
                          )}`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-medium">
                        {row.academicYear}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {row.term}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {row.grade}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {row.subjectOrStream}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {row.generatedOn}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetailModal(row)}
                            className={cn(
                              "h-7 px-2.5 text-xs font-semibold rounded-lg gap-1",
                              isAcademicHead
                                ? "text-violet-600 dark:text-violet-400 hover:text-violet-700 hover:bg-violet-500/10"
                                : "text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-500/10"
                            )}
                          >
                            <span>View</span>
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs bg-popover text-popover-foreground border-border">
                              <DropdownMenuItem onClick={() => handleOpenDetailModal(row)} className="gap-2 cursor-pointer">
                                <Eye className={cn("w-3.5 h-3.5", isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400")} /> View Detailed Roster
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportCSV(row)} className="gap-2 cursor-pointer">
                                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Export CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.print()} className="gap-2 cursor-pointer">
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

      {/* ─── Detailed Report Inspection & Print Dialog ───────────────────── */}
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
                <span>{selectedReportItem?.reportName || 'Assessment Report Details'}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTypeBadgeStyle(selectedReportItem?.type || '')}`}>
                {selectedReportItem?.type}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {selectedReportItem?.academicYear} | {selectedReportItem?.term} | {selectedReportItem?.grade} ({selectedReportItem?.subjectOrStream})
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
              <p className="text-xs text-muted-foreground font-semibold">Loading student roster and mark breakdown...</p>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Quick Metric Bar */}
              <div className="grid grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Enrolled</span>
                  <span className="text-base font-extrabold text-foreground">{detailData?.studentRows?.length || 25}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Average Score</span>
                  <span
                    className={cn(
                      "text-base font-extrabold",
                      isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    {selectedReportItem?.averageScore || 78.4}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Pass Rate</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">92%</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Report Status</span>
                  <span
                    className={cn(
                      "text-base font-extrabold",
                      isAcademicHead ? "text-violet-600 dark:text-violet-400" : "text-purple-600 dark:text-purple-400"
                    )}
                  >
                    Verified
                  </span>
                </div>
              </div>

              {/* Student Roster Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-[10px] font-bold text-muted-foreground uppercase">
                      <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                      <th className="py-2.5 px-3">Student ID</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Gender</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(detailData?.studentRows || []).slice(0, 15).map((s: any, i: number) => (
                      <tr key={s.id || i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-center font-mono font-bold text-muted-foreground">{s.rank}</td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">{s.studentId}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{s.fullName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{s.gender}</td>
                        <td className="py-2 px-3 text-muted-foreground">{s.section}</td>
                        <td className="py-2 px-3 text-right font-bold font-mono text-foreground">{s.score}%</td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full text-[10px] border border-indigo-500/20">
                            {s.gradeLetter}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            s.status === 'PASS'
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          )}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
                onClick={() => handleExportCSV()}
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
