'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Printer,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Award,
  TrendingUp,
  Share2,
  Edit3,
  Calendar,
  X,
  Send,
  Eye,
  Layers,
  GraduationCap
} from 'lucide-react';
import {
  gradebookService,
  ReportCard,
  ComprehensiveReportCardData
} from '@/lib/gradebook-service';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StudentReportCard } from '@/components/school/student-report-card';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AdminReportCardsPage() {
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('annual');
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit comments modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [editConduct, setEditConduct] = useState('A-');
  const [editTeacherComment, setEditTeacherComment] = useState('');
  const [editPrincipalComment, setEditPrincipalComment] = useState('');

  // Single Print Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [comprehensiveCard, setComprehensiveCard] = useState<ComprehensiveReportCardData | null>(null);

  // Batch Print Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchCards, setBatchCards] = useState<ComprehensiveReportCardData[]>([]);

  const printSingleRef = useRef<HTMLDivElement>(null);
  const printBatchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('attendance_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const [ayRes, gradesRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()),
      ]);

      if (ayRes?.success && Array.isArray(ayRes.data)) {
        setAcademicYears(ayRes.data);
        const currentYear = ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        if (currentYear) {
          setSelectedYearId(currentYear.id);
        }
      }

      if (gradesRes?.success && Array.isArray(gradesRes.data)) {
        setGrades(gradesRes.data);
        if (gradesRes.data.length > 0) {
          setSelectedGradeId(gradesRes.data[0].id);
        }
      }
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  // When grade changes, load sections
  useEffect(() => {
    if (!selectedGradeId) return;
    const gradeObj = grades.find((g) => g.id === selectedGradeId);
    if (gradeObj?.sections && Array.isArray(gradeObj.sections)) {
      setSections(gradeObj.sections);
      if (gradeObj.sections.length > 0) {
        setSelectedSectionId(gradeObj.sections[0].id);
      } else {
        setSelectedSectionId('');
      }
    } else {
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
  }, [selectedGradeId, grades]);

  // Load report cards & students whenever filters change
  useEffect(() => {
    if (selectedGradeId && selectedSectionId && selectedYearId) {
      loadData();
    }
  }, [selectedGradeId, selectedSectionId, selectedYearId, selectedTermId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('attendance_token');
      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const [cardsData, studentsRes] = await Promise.all([
        gradebookService.getReportCards({
          gradeId: selectedGradeId,
          sectionId: selectedSectionId,
          academicYearId: selectedYearId,
          academicTermId: selectedTermId !== 'annual' ? selectedTermId : undefined,
        }),
        fetch(`${API_URL}/api/students?gradeId=${selectedGradeId}&sectionId=${selectedSectionId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json()),
      ]);

      setReportCards(cardsData);
      if (studentsRes?.success && Array.isArray(studentsRes.data)) {
        setStudents(studentsRes.data);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedGradeId || !selectedSectionId || !selectedYearId) {
      notifications.error('Required', 'Please select Grade, Section, and Academic Year');
      return;
    }

    try {
      setGenerating(true);
      const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
      const termToUse =
        selectedTermId !== 'annual'
          ? selectedTermId
          : currentYearObj?.terms?.[0]?.id || '';

      const res = await gradebookService.generateReportCards({
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        academicYearId: selectedYearId,
        academicTermId: termToUse,
      });

      notifications.success('Calculations Complete', res.message || `Generated ${res.count} student report cards.`);
      await loadData();
    } catch (err: any) {
      notifications.error('Generation Notice', err?.message || 'Error compiling marks');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPreview = async (studentId: string) => {
    try {
      setPreviewLoading(true);
      setPreviewModalOpen(true);
      const card = await gradebookService.getComprehensiveReportCard(
        studentId,
        selectedYearId,
        selectedTermId !== 'annual' ? selectedTermId : undefined
      );
      setComprehensiveCard(card);
    } catch (err: any) {
      notifications.error('Preview Error', err?.message || 'Failed to render report card');
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenBatchPrint = async () => {
    if (!selectedGradeId || !selectedSectionId) {
      notifications.error('Required', 'Select Grade and Section first');
      return;
    }

    try {
      setBatchLoading(true);
      setBatchModalOpen(true);
      const cards = await gradebookService.getBatchComprehensiveReportCards({
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        academicYearId: selectedYearId,
        academicTermId: selectedTermId !== 'annual' ? selectedTermId : undefined,
      });
      setBatchCards(cards);
    } catch (err: any) {
      notifications.error('Batch Print Error', err?.message || 'Failed to prepare batch cards');
      setBatchModalOpen(false);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingCard(item);
    setEditConduct(item.conduct || 'A-');
    setEditTeacherComment(item.homeroomTeacherComment || '');
    setEditPrincipalComment(item.principalComment || '');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCard) return;
    try {
      if (editingCard.id && editingCard.totalScore !== undefined) {
        await gradebookService.updateReportCard(editingCard.id, {
          conduct: editConduct,
          homeroomTeacherComment: editTeacherComment,
          principalComment: editPrincipalComment,
        });
      }
      notifications.success('Updated', 'Student remarks & conduct saved.');
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to update remarks');
    }
  };

  const handleBulkPublish = async () => {
    if (reportCards.length === 0) {
      notifications.error('No Cards', 'No report cards to publish. Please generate first.');
      return;
    }
    if (!confirm('Publish all generated report cards to parents?')) return;

    try {
      const ids = reportCards.map((c) => c.id);
      await gradebookService.bulkUpdateReportCardStatus(ids, 'PUBLISHED');
      notifications.success('Published', 'Report cards published to parents portal!');
      loadData();
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to publish');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Combine report cards and enrolled students into a unified list
  const studentRows = useMemo(() => {
    // If report cards exist, use them as primary source
    if (reportCards.length > 0) {
      return reportCards.map((rc, idx) => ({
        id: rc.id,
        studentId: rc.studentId,
        studentUniqueId: rc.student?.student_id || '—',
        fullName: rc.student?.fullName || 'Student',
        gender: rc.student?.gender || 'M',
        totalScore: rc.totalScore,
        averageScore: rc.averageScore,
        rank: rc.rank || idx + 1,
        totalStudents: rc.totalStudentsInClass || reportCards.length,
        conduct: rc.conduct || 'A-',
        absence: `${rc.attendanceTotalDays - rc.attendancePresentDays > 0 ? rc.attendanceTotalDays - rc.attendancePresentDays : 0} Day`,
        status: rc.status,
        homeroomTeacherComment: rc.homeroomTeacherComment,
        principalComment: rc.principalComment,
        rawCard: rc,
      }));
    }

    // Fallback to students enrolled in section
    return students.map((s, idx) => ({
      id: s.id,
      studentId: s.id,
      studentUniqueId: s.student_id || '—',
      fullName: s.fullName,
      gender: s.gender || 'M',
      totalScore: 0,
      averageScore: 0,
      rank: idx + 1,
      totalStudents: students.length || 1,
      conduct: 'A-',
      absence: '0 Day',
      status: 'PENDING',
      homeroomTeacherComment: '',
      principalComment: '',
      rawCard: null,
    }));
  }, [reportCards, students]);

  // Filtered rows by search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return studentRows;
    const q = searchQuery.toLowerCase();
    return studentRows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.studentUniqueId.toLowerCase().includes(q)
    );
  }, [studentRows, searchQuery]);

  // Overall Stats
  const stats = useMemo(() => {
    const total = studentRows.length;
    if (total === 0) return { total: 0, avgPct: 0, topScore: 0, published: 0 };

    const withScores = studentRows.filter((r) => r.averageScore > 0);
    const sumPct = withScores.reduce((acc, c) => acc + c.averageScore, 0);
    const avgPct = withScores.length > 0 ? Math.round((sumPct / withScores.length) * 10) / 10 : 0;
    const topScore = withScores.length > 0 ? Math.max(...withScores.map((c) => c.averageScore)) : 0;
    const published = studentRows.filter((c) => c.status === 'PUBLISHED').length;

    return { total, avgPct, topScore, published };
  }, [studentRows]);

  const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
  const currentTerms = currentYearObj?.terms || [];

  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'academic_head']}>
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto print:p-0">
      {/* Header (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Official Student Report Cards
            </h1>
            <p className="text-sm text-muted-foreground">
              Bright Path School academic evaluation cards, multi-period results, and A4 print generator.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating || loading || !selectedSectionId}
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Calculating...' : 'Recalculate Results'}
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenBatchPrint}
            disabled={studentRows.length === 0}
            className="gap-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Layers className="w-4 h-4" />
            Batch Print Class (A4)
          </Button>

          <Button
            variant="outline"
            onClick={handleBulkPublish}
            disabled={reportCards.length === 0}
            className="gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Send className="w-4 h-4" />
            Publish All
          </Button>
        </div>
      </div>

      {/* Filter Toolbar (Hidden in Print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-xs print:hidden">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Academic Year
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
          >
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? '(Active Year)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Evaluation Period
          </label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-medium"
          >
            <option value="annual">★ Annual / Full Year (Cumulative 4-Period)</option>
            {currentTerms.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Grade Level
          </label>
          <select
            value={selectedGradeId}
            onChange={(e) => setSelectedGradeId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Section
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Aggregate Stats Cards (Hidden in Print) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Class Enrollment</span>
            <GraduationCap className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{stats.total}</p>
          <span className="text-[11px] text-muted-foreground">Students in Section</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Class Average</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.avgPct > 0 ? `${stats.avgPct}%` : '—'}
          </p>
          <span className="text-[11px] text-muted-foreground">Across all subjects</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Top Score</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {stats.topScore > 0 ? `${stats.topScore}%` : '—'}
          </p>
          <span className="text-[11px] text-muted-foreground">Highest standing</span>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Published</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {stats.published} / {stats.total}
          </p>
          <span className="text-[11px] text-muted-foreground">Visible to parents</span>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search student by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Main Student Cards Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Student Details</th>
                <th className="py-3 px-4 text-center">Total Points</th>
                <th className="py-3 px-4 text-center">Average %</th>
                <th className="py-3 px-4 text-center">Conduct</th>
                <th className="py-3 px-4 text-center">Absences</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading report card data...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No students or report cards found for this selection.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-center font-bold">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-800 dark:text-slate-200">
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                        <span>{row.studentUniqueId}</span>
                        <span>•</span>
                        <span>Gender: {row.gender}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-foreground">
                      {row.totalScore > 0 ? row.totalScore : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-black">
                      <span
                        className={
                          row.averageScore >= 85
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : row.averageScore >= 70
                            ? 'text-blue-600 dark:text-blue-400'
                            : row.averageScore >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : row.averageScore > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {row.averageScore > 0 ? `${row.averageScore}%` : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                        {row.conduct}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                      {row.absence}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'PUBLISHED'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : row.status === 'GENERATED'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPreview(row.studentId)}
                          className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold"
                          title="View Official Report Card"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View / Print
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(row.rawCard || row)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit Remarks & Conduct"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. SINGLE OFFICIAL REPORT CARD MODAL */}
      {/* ==================================================== */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[94vh] overflow-y-auto p-0 border border-slate-300">
          <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between bg-muted/40 sticky top-0 backdrop-blur-md z-20 print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base sm:text-lg font-bold">
                Official Bright Path Grade Report
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                size="sm"
                className="gap-2 bg-primary text-primary-foreground font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print / Save A4 PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div ref={printSingleRef} className="p-2 sm:p-6 bg-slate-100 flex justify-center">
            {previewLoading ? (
              <div className="py-24 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                Generating official grade report...
              </div>
            ) : comprehensiveCard ? (
              <StudentReportCard card={comprehensiveCard} />
            ) : (
              <div className="py-12 text-center text-slate-500">Failed to render card.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* 2. BATCH PRINT MODAL (ENTIRE CLASS A4) */}
      {/* ==================================================== */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[94vh] overflow-y-auto p-0 border border-slate-300">
          <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between bg-muted/40 sticky top-0 backdrop-blur-md z-20 print:hidden">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Batch Print Class Report Cards ({batchCards.length} Students)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every report card will be printed on a separate standard A4 page.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                disabled={batchLoading || batchCards.length === 0}
                size="sm"
                className="gap-2 bg-primary text-primary-foreground font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print All ({batchCards.length} Cards)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBatchModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div ref={printBatchRef} className="p-2 sm:p-6 bg-slate-100 space-y-6">
            {batchLoading ? (
              <div className="py-24 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                Compiling all report cards for printing...
              </div>
            ) : batchCards.length > 0 ? (
              batchCards.map((c, i) => (
                <div key={c.student.id || i} className="batch-report-card-wrapper mb-8 print:mb-0">
                  <StudentReportCard card={c} />
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500">No cards to display.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================== */}
      {/* 3. EDIT REMARKS & CONDUCT MODAL */}
      {/* ==================================================== */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluation Remarks & Conduct</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Student</Label>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {editingCard?.student?.fullName || editingCard?.fullName}
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Conduct / Deportment</Label>
              <select
                value={editConduct}
                onChange={(e) => setEditConduct(e.target.value)}
                className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm font-semibold"
              >
                <option value="A+">A+ (Distinguished)</option>
                <option value="A">A (Excellent)</option>
                <option value="A-">A- (Very Good - Standard)</option>
                <option value="B+">B+ (Good)</option>
                <option value="B">B (Satisfactory)</option>
                <option value="C">C (Needs Improvement)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Home-room Teacher Remark</Label>
              <Input
                placeholder="e.g. Demonstrated strong analytical capability and exemplary diligence."
                value={editTeacherComment}
                onChange={(e) => setEditTeacherComment(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Principal / Academic Director Note</Label>
              <Input
                placeholder="e.g. Promoted with distinction to the next level."
                value={editPrincipalComment}
                onChange={(e) => setEditPrincipalComment(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-primary text-primary-foreground font-semibold">
              Save Remarks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  );
}
