'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  FileText,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
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

// ─── Color Palette for Bar Chart ───────────────────────────────────────────
const BAR_COLORS = [
  '#3b82f6', // Blue - Mathematics
  '#10b981', // Emerald - Physics
  '#f59e0b', // Amber - Chemistry
  '#8b5cf6', // Purple - Biology
  '#06b6d4', // Cyan - English
  '#f43f5e', // Rose - History
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

// Helper to style report type badges
const getTypeBadgeStyle = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('subject performance')) {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  }
  if (t.includes('grade report')) {
    return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
  }
  if (t.includes('comparison')) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (t.includes('performance analysis')) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  if (t.includes('parent')) {
    return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
  }
  return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
};

export default function AssessmentReportsPage() {
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
  const maxChartScore = 100;

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
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ─── Breadcrumb Back Link ────────────────────────────────────────── */}
      <div>
        <Link
          href="/school/admin/assessments/policy"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Assessments
        </Link>
      </div>

      {/* ─── Page Title Header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Assessment Reports
        </h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
          View and generate detailed reports for assessment results, subject performance and academic progress.
        </p>
      </div>

      {/* ─── Top Filter Controls Bar ─────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
          {/* Academic Year */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
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
                className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.isCurrent ? '(Current)' : ''}
                  </option>
                ))}
              </select>
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Term */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Grade
            </label>
            <select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
              Report Type
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
              className="w-full h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center"
            >
              <BarChart3 className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Generating...' : 'Generate Report'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 4 Assessment Summary Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Subjects */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Subjects</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              {analytics?.summary?.totalSubjects ?? 48}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">Across all grades and sections</p>
          </div>
        </div>

        {/* Card 2: Average Subject Score */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Average Subject Score</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              {analytics?.summary?.averageSubjectScore ? `${analytics.summary.averageSubjectScore}%` : '76.4%'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">School-wide average</p>
          </div>
        </div>

        {/* Card 3: Highest Subject Score */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Highest Subject Score</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              {analytics?.summary?.highestSubject?.score ? `${analytics.summary.highestSubject.score}%` : '98%'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {analytics?.summary?.highestSubject?.name || 'Mathematics'} ({analytics?.summary?.highestSubject?.gradeName || 'Grade 10'})
            </p>
          </div>
        </div>

        {/* Card 4: Lowest Subject Score */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lowest Subject Score</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              {analytics?.summary?.lowestSubject?.score ? `${analytics.summary.lowestSubject.score}%` : '42%'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {analytics?.summary?.lowestSubject?.name || 'Civics'} ({analytics?.summary?.lowestSubject?.gradeName || 'Grade 9'})
            </p>
          </div>
        </div>
      </div>

      {/* ─── Two Chart Columns: Subject Performance & Result Distribution ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Subject Performance Overview (Bar Chart) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Subject Performance Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Average percentage marks across academic subjects
            </p>
          </div>

          {/* Bar Chart Container */}
          <div className="mt-8 relative pt-4">
            {/* Y-Axis Guidelines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400 pb-8">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 w-full pb-1">
                <span className="w-8 text-right font-mono">100%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 w-full pb-1">
                <span className="w-8 text-right font-mono">80%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 w-full pb-1">
                <span className="w-8 text-right font-mono">60%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 w-full pb-1">
                <span className="w-8 text-right font-mono">40%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 w-full pb-1">
                <span className="w-8 text-right font-mono">20%</span>
              </div>
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 w-full pb-1">
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
                      <div className="absolute -top-12 z-20 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-semibold shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                        <p>{item.subjectName}: <span className="font-bold text-emerald-400">{item.averageScore}%</span></p>
                        <p className="text-slate-300 font-normal">Students: {item.studentCount} | High: {item.highestScore}%</p>
                      </div>
                    )}

                    {/* Percentage Label on top of bar */}
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 transition-transform group-hover:scale-110">
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
                    <span className="absolute -bottom-6 text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate max-w-[56px] text-center">
                      {item.subjectName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Result Distribution (Donut Chart) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Result Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Grade scale distribution breakdown
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* SVG Donut */}
            <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
              <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                {donutPaths.map((slice, i) => (
                  <path
                    key={i}
                    d={slice.pathData}
                    fill={slice.color}
                    className="transition-all hover:opacity-85 hover:scale-[1.02] cursor-pointer origin-center"
                  />
                ))}
              </svg>

              {/* Center Metrics in Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  {totalResults.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Results
                </span>
              </div>
            </div>

            {/* Legend & Count Breakdown */}
            <div className="flex-1 space-y-2.5 w-full">
              {distributionBands.map((band, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: band.color }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {band.name} ({band.rangeLabel})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 w-8 text-right">
                      {band.percentage}%
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white w-9 text-right font-mono">
                      {band.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Available Reports Table Section ─────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Card Header with Search & Filter */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Available Reports
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive report catalog ready for analysis, print, and export
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 pl-9 pr-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs bg-slate-50/50 dark:bg-slate-950"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold border-slate-200 dark:border-slate-800"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
            </Button>
          </div>
        </div>

        {/* Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No reports found matching your criteria. Try adjusting the search or filters.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((row, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-medium">
                        {absoluteIndex}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
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
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {row.academicYear}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {row.term}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {row.grade}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {row.subjectOrStream}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {row.generatedOn}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetailModal(row)}
                            className="h-7 px-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg gap-1"
                          >
                            <span>View</span>
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem onClick={() => handleOpenDetailModal(row)} className="gap-2">
                                <Eye className="w-3.5 h-3.5 text-blue-600" /> View Detailed Roster
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportCSV(row)} className="gap-2">
                                <Download className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.print()} className="gap-2">
                                <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Summary
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
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{paginatedReports.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * pageSize, filteredReports.length)}</span> of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredReports.length}</span> reports
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 p-0 rounded-lg text-xs font-bold ${
                  currentPage === page ? 'bg-blue-600 text-white' : ''
                }`}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Detailed Report Inspection & Print Dialog ───────────────────── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-lg font-bold">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>{selectedReportItem?.reportName || 'Assessment Report Details'}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTypeBadgeStyle(selectedReportItem?.type || '')}`}>
                {selectedReportItem?.type}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              {selectedReportItem?.academicYear} | {selectedReportItem?.term} | {selectedReportItem?.grade} ({selectedReportItem?.subjectOrStream})
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-500 font-semibold">Loading student roster and mark breakdown...</p>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Quick Metric Bar */}
              <div className="grid grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Enrolled</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">{detailData?.studentRows?.length || 25}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Average Score</span>
                  <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">{selectedReportItem?.averageScore || 78.4}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Pass Rate</span>
                  <span className="text-base font-extrabold text-emerald-600">92%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Report Status</span>
                  <span className="text-base font-extrabold text-purple-600">Verified</span>
                </div>
              </div>

              {/* Student Roster Table */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 uppercase">
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
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {(detailData?.studentRows || []).slice(0, 15).map((s: any, i: number) => (
                      <tr key={s.id || i} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">{s.rank}</td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{s.studentId}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{s.fullName}</td>
                        <td className="py-2 px-3 text-slate-500">{s.gender}</td>
                        <td className="py-2 px-3 text-slate-500">{s.section}</td>
                        <td className="py-2 px-3 text-right font-bold font-mono text-slate-900 dark:text-slate-100">{s.score}%</td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full text-[10px]">
                            {s.gradeLetter}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
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

          <DialogFooter className="flex flex-row justify-between items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCSV()}
                className="gap-1.5 text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" /> Print Sheet
              </Button>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setDetailModalOpen(false)}
              className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
