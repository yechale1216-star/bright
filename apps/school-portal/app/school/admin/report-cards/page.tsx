'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileText,
  Printer,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Award,
  TrendingUp,
  Edit3,
  X,
  Send,
  Eye,
  Layers,
  GraduationCap,
  AlertTriangle,
  ShieldCheck,
  Clock,
  BookOpen,
  Info,
  ChevronRight,
} from 'lucide-react';
import {
  gradebookService,
  ReportCard,
  ComprehensiveReportCardData,
} from '@/lib/gradebook-service';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StudentReportCard } from '@/components/school/student-report-card';
import { Skeleton } from '@/components/ui/skeleton';

type ReadinessOverview = {
  gradeId: string;
  sectionId: string;
  isFullyReady: boolean;
  totalRequiredSubjects: number;
  approvedSubjectsCount: number;
  pendingSubjects: Array<{ subjectId: string; subjectName: string; status: string }>;
  reportCardsSummary: {
    total: number;
    ready: number;
    draft: number;
    published: number;
    needsCorrection: number;
  };
} | null;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PUBLISHED: { label: 'Published', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' },
    READY: { label: 'Ready', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30' },
    DRAFT: { label: 'Draft', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-300/50' },
    NEEDS_CORRECTION: { label: 'Needs Correction', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30' },
    PENDING: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  };
  const cfg = map[status] || map.PENDING;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function AdminReportCardsPage() {
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('annual');
  const [grades, setGrades] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Unified loading state — one phase at a time
  type LoadPhase = 'idle' | 'data' | 'preview' | 'batch';
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('idle');
  const loading = loadPhase === 'data';
  const previewLoading = loadPhase === 'preview';
  const batchLoading = loadPhase === 'batch';
  const loadingMessage: Record<LoadPhase, string> = {
    idle: '',
    data: 'Loading report cards...',
    preview: 'Generating official grade report...',
    batch: 'Compiling all report cards for printing...',
  };

  // Readiness state
  const [readiness, setReadiness] = useState<ReadinessOverview>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [readinessPanelOpen, setReadinessPanelOpen] = useState(false);

  // Publishing state
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // Edit comments modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [editConduct, setEditConduct] = useState('A-');
  const [editTeacherComment, setEditTeacherComment] = useState('');
  const [editPrincipalComment, setEditPrincipalComment] = useState('');

  // Single Print Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [comprehensiveCard, setComprehensiveCard] = useState<ComprehensiveReportCardData | null>(null);

  // Batch Print Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false);
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

      const [ayRes, gradesRes, streamsRes] = await Promise.all([
        fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`${API_URL}/api/schools/grades`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`${API_URL}/api/schools/me/streams`, { headers }).then((r) => r.json()).catch(() => null),
      ]);

      if (ayRes?.success && Array.isArray(ayRes.data)) {
        setAcademicYears(ayRes.data);
        const currentYear = ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        if (currentYear) setSelectedYearId(currentYear.id);
      }

      if (gradesRes?.success && Array.isArray(gradesRes.data)) {
        setGrades(gradesRes.data);
        if (gradesRes.data.length > 0) setSelectedGradeId(gradesRes.data[0].id);
      }

      if (streamsRes?.success && Array.isArray(streamsRes.data)) {
        setStreams(streamsRes.data);
      }
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  // Reset stream when grade changes
  useEffect(() => {
    setSelectedStreamId('all');
  }, [selectedGradeId]);

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
          const res = await fetch(
            `${getApiUrl()}/api/schools/sections?gradeId=${selectedGradeId}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          ).then((r) => r.json());
          if (res?.success && Array.isArray(res.data)) {
            setSections(res.data);
            setSelectedSectionId(res.data.length > 0 ? res.data[0].id : '');
          } else {
            setSections([]);
            setSelectedSectionId('');
          }
        } catch {}
      };
      fetchSections();
    }
  }, [selectedGradeId, grades]);

  const selectedGradeObj = useMemo(() => {
    return grades.find((g) => g.id === selectedGradeId);
  }, [grades, selectedGradeId]);

  const isSeniorGrade = useMemo(() => {
    if (!selectedGradeObj) return false;
    const name = (selectedGradeObj.name || '').toLowerCase();
    return /\b(11|12)\b/.test(name) || name.includes('11') || name.includes('12');
  }, [selectedGradeObj]);

  const availableStreamsForGrade = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    sections.forEach((s: any) => {
      const sid = s.streamId || s.stream?.id;
      const sname = s.stream?.name;
      if (sid && !map.has(sid)) {
        map.set(sid, { id: sid, name: sname || sid });
      }
    });
    if (isSeniorGrade || map.size > 0 || streams.length > 0) {
      streams.forEach((st: any) => {
        if (!map.has(st.id)) {
          map.set(st.id, { id: st.id, name: st.name });
        }
      });
    }
    return Array.from(map.values());
  }, [sections, isSeniorGrade, streams]);

  const gradeHasStreams = useMemo(() => {
    return isSeniorGrade || availableStreamsForGrade.length > 0 || sections.some((s: any) => !!s.streamId || !!s.stream);
  }, [isSeniorGrade, availableStreamsForGrade, sections]);

  const filteredSections = useMemo(() => {
    if (!selectedStreamId || selectedStreamId === 'all') {
      return sections;
    }
    return sections.filter((s: any) => {
      const sid = s.streamId || s.stream?.id;
      const sname = (s.stream?.name || '').toLowerCase();
      const sel = selectedStreamId.toLowerCase();
      return sid === selectedStreamId || sname === sel || sname.includes(sel);
    });
  }, [sections, selectedStreamId]);

  // Sync selectedSectionId when filtered sections change
  useEffect(() => {
    // For senior grades: if no stream selected, clear section (enforce hierarchy)
    if (isSeniorGrade && selectedStreamId === 'all') {
      setSelectedSectionId('');
      return;
    }
    if (filteredSections.length === 0) {
      setSelectedSectionId('');
    } else if (!filteredSections.some((s: any) => s.id === selectedSectionId)) {
      setSelectedSectionId(filteredSections[0].id);
    }
  }, [filteredSections, selectedSectionId, isSeniorGrade, selectedStreamId]);

  // Load report cards & students + readiness whenever filters change
  useEffect(() => {
    if (selectedGradeId && selectedSectionId && selectedYearId) {
      loadData();
      loadReadiness();
    }
  }, [selectedGradeId, selectedSectionId, selectedStreamId, selectedYearId, selectedTermId]);

  const loadData = useCallback(async () => {
    try {
      setLoadPhase('data');
      const token = localStorage.getItem('attendance_token');
      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const [cardsData, studentsRes] = await Promise.all([
        gradebookService.getReportCards({
          gradeId: selectedGradeId,
          sectionId: selectedSectionId,
          streamId: selectedStreamId !== 'all' ? selectedStreamId : undefined,
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
      setLoadPhase('idle');
    }
  }, [selectedGradeId, selectedSectionId, selectedStreamId, selectedYearId, selectedTermId]);

  const loadReadiness = useCallback(async () => {
    if (!selectedGradeId || !selectedSectionId || !selectedYearId) return;
    try {
      setLoadingReadiness(true);
      const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
      const termToUse =
        selectedTermId !== 'annual'
          ? selectedTermId
          : currentYearObj?.terms?.[0]?.id || '';

      const data = await gradebookService.getClassReadinessOverview({
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        academicYearId: selectedYearId,
        academicTermId: termToUse || undefined,
      });
      setReadiness(data);
    } catch {
      setReadiness(null);
    } finally {
      setLoadingReadiness(false);
    }
  }, [selectedGradeId, selectedSectionId, selectedYearId, selectedTermId, academicYears]);

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

      notifications.success(
        'Calculations Complete',
        res.message || `Generated ${res.count} student report cards.`
      );
      await loadData();
      await loadReadiness();
    } catch (err: any) {
      notifications.error('Generation Notice', err?.message || 'Error compiling marks');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishSingle = async (reportCardId: string, studentName: string) => {
    if (!confirm(`Publish the report card for ${studentName} and make it visible to parents?`)) return;
    try {
      setPublishingId(reportCardId);
      const result = await gradebookService.publishReportCard(reportCardId);
      notifications.success('Published!', result.message || `Report card published for ${studentName}.`);
      await loadData();
      await loadReadiness();
    } catch (err: any) {
      notifications.error('Publish Failed', err?.message || 'Could not publish report card.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleBulkPublish = async () => {
    if (!readiness?.isFullyReady) {
      const pending = readiness?.pendingSubjects?.length || 0;
      const msg = pending > 0
        ? `${pending} subject(s) are not yet approved. All subjects must be approved before publishing.`
        : 'Not all required subjects are approved yet.';
      notifications.error('Not Ready to Publish', msg);
      return;
    }

    const readyCount = readiness?.reportCardsSummary?.ready || 0;
    if (readyCount === 0) {
      notifications.error('Nothing to Publish', 'No report cards are in READY state. Generate/recalculate first.');
      return;
    }

    if (!confirm(`Publish all ${readyCount} ready report cards to parents? This will make them visible on the parent and student portals.`)) return;

    try {
      setBulkPublishing(true);
      const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
      const termToUse =
        selectedTermId !== 'annual'
          ? selectedTermId
          : currentYearObj?.terms?.[0]?.id || '';

      const result = await gradebookService.bulkPublishReportCards({
        gradeId: selectedGradeId,
        sectionId: selectedSectionId,
        academicYearId: selectedYearId,
        academicTermId: termToUse || undefined,
      });

      notifications.success(
        'Bulk Publish Complete',
        result.message || `Published: ${result.published}, Skipped: ${result.skipped}`
      );
      await loadData();
      await loadReadiness();
    } catch (err: any) {
      notifications.error('Bulk Publish Failed', err?.message || 'Error publishing report cards');
    } finally {
      setBulkPublishing(false);
    }
  };

  const handleOpenPreview = async (studentId: string, termId?: string) => {
    try {
      setLoadPhase('preview');
      setPreviewModalOpen(true);
      const termToFetch = termId || (selectedTermId !== 'annual' ? selectedTermId : undefined);
      const card = await gradebookService.getComprehensiveReportCard(
        studentId,
        selectedYearId,
        termToFetch
      );
      setComprehensiveCard(card);
    } catch (err: any) {
      notifications.error('Preview Error', err?.message || 'Failed to render report card');
      setPreviewModalOpen(false);
    } finally {
      setLoadPhase('idle');
    }
  };

  const handleOpenBatchPrint = async () => {
    if (!selectedGradeId || !selectedSectionId) {
      notifications.error('Required', 'Select Grade and Section first');
      return;
    }

    try {
      setLoadPhase('batch');
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
      setLoadPhase('idle');
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

  const handlePrint = () => {
    window.print();
  };

  // Combine report cards and enrolled students into a unified list
  const studentRows = useMemo(() => {
    if (reportCards.length > 0) {
      return reportCards.map((rc, idx) => ({
        id: rc.id,
        studentId: rc.studentId,
        termId: rc.academicTermId,
        termName: rc.academicTerm?.name || '',
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

    return students.map((s, idx) => ({
      id: s.id,
      studentId: s.id,
      termId: undefined,
      termName: '',
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

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return studentRows;
    const q = searchQuery.toLowerCase();
    return studentRows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.studentUniqueId.toLowerCase().includes(q)
    );
  }, [studentRows, searchQuery]);

  const stats = useMemo(() => {
    const total = studentRows.length;
    if (total === 0) return { total: 0, avgPct: 0, topScore: 0, published: 0, ready: 0, needsCorrection: 0 };

    const withScores = studentRows.filter((r) => r.averageScore > 0);
    const sumPct = withScores.reduce((acc, c) => acc + c.averageScore, 0);
    const avgPct = withScores.length > 0 ? Math.round((sumPct / withScores.length) * 10) / 10 : 0;
    const topScore = withScores.length > 0 ? Math.max(...withScores.map((c) => c.averageScore)) : 0;
    const published = studentRows.filter((c) => c.status === 'PUBLISHED').length;
    const ready = studentRows.filter((c) => c.status === 'READY').length;
    const needsCorrection = studentRows.filter((c) => c.status === 'NEEDS_CORRECTION').length;

    return { total, avgPct, topScore, published, ready, needsCorrection };
  }, [studentRows]);

  const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
  const currentTerms = currentYearObj?.terms || [];

  const canBulkPublish = readiness?.isFullyReady && (readiness?.reportCardsSummary?.ready || 0) > 0;

  return (
    <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-3 border-b border-border/70 print:hidden">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 shrink-0">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
            Official Student Report Cards
          </h1>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating || loading || !selectedSectionId}
            className="flex-1 min-w-[130px] gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs justify-center"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Calculating...' : 'Recalculate'}
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenBatchPrint}
            disabled={studentRows.length === 0}
            className="flex-1 min-w-[120px] gap-2 border-border text-foreground hover:bg-muted justify-center"
          >
            <Layers className="w-4 h-4" />
            Batch Print
          </Button>

          <Button
            onClick={handleBulkPublish}
            disabled={bulkPublishing || !canBulkPublish}
            className={`flex-1 min-w-[120px] gap-2 justify-center ${canBulkPublish ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-transparent hover:bg-emerald-500/10'}`}
            variant={canBulkPublish ? 'default' : 'outline'}
          >
            {bulkPublishing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {bulkPublishing ? 'Publishing...' : 'Publish All Ready'}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar — Hierarchical: Year → Term → Grade → Stream (if 11/12) → Section */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-card border border-border dark:border-white/10 shadow-xs print:hidden min-w-0 ${isSeniorGrade ? 'md:grid-cols-3 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <div className="min-w-0">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Academic Year
          </label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? '(Active Year)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Evaluation Period
          </label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="annual">★ Annual / Full Year</option>
            {currentTerms.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Grade Level
          </label>
          <select
            value={selectedGradeId}
            onChange={(e) => setSelectedGradeId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stream — only shown when grade is 11 or 12 */}
        {isSeniorGrade && (
          <div className="min-w-0">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              Academic Stream
              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded uppercase tracking-wide">Required</span>
            </label>
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-background text-foreground transition-colors ${
                selectedStreamId === 'all'
                  ? 'border-amber-400 dark:border-amber-500 focus:ring-amber-500/30'
                  : 'border-input focus:ring-ring/40'
              }`}
            >
              <option value="all">— Select Stream —</option>
              {availableStreamsForGrade.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}{st.name.toLowerCase().includes('stream') ? '' : ' Stream'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Section — filtered by stream for senior grades */}
        <div className="min-w-0">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
            Section
          </label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={isSeniorGrade && selectedStreamId === 'all'}
            className={`w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 ${
              isSeniorGrade && selectedStreamId === 'all' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSeniorGrade && selectedStreamId === 'all' ? (
              <option value="">Select a stream first</option>
            ) : filteredSections.length === 0 ? (
              <option value="">No sections found</option>
            ) : (
              filteredSections.map((s) => {
                const prefix = s.name.toLowerCase().startsWith('section') ? s.name : `Section ${s.name}`;
                return (
                  <option key={s.id} value={s.id}>
                    {prefix}
                  </option>
                );
              })
            )}
          </select>
        </div>
      </div>

      {/* Readiness Banner */}
      {selectedSectionId && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-start gap-3 print:hidden cursor-pointer transition-all ${
            loadingReadiness
              ? 'border-border/50 bg-muted/30'
              : readiness?.isFullyReady
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : (readiness?.reportCardsSummary?.needsCorrection || 0) > 0
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-blue-500/20 bg-blue-500/5'
          }`}
          onClick={() => setReadinessPanelOpen((o) => !o)}
        >
          {loadingReadiness ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mt-0.5 shrink-0" />
          ) : readiness?.isFullyReady ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (readiness?.reportCardsSummary?.needsCorrection || 0) > 0 ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {loadingReadiness
                  ? 'Checking readiness...'
                  : readiness?.isFullyReady
                  ? 'All subjects approved — class is ready to publish!'
                  : (readiness?.reportCardsSummary?.needsCorrection || 0) > 0
                  ? `⚠ ${readiness?.reportCardsSummary?.needsCorrection} report card(s) need correction`
                  : `${readiness?.approvedSubjectsCount || 0} / ${readiness?.totalRequiredSubjects || '?'} subjects approved`}
              </p>
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${readinessPanelOpen ? 'rotate-90' : ''}`}
              />
            </div>
            {readiness && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Report cards: {readiness.reportCardsSummary.published} published •{' '}
                {readiness.reportCardsSummary.ready} ready •{' '}
                {readiness.reportCardsSummary.draft} draft
                {readiness.reportCardsSummary.needsCorrection > 0
                  ? ` • ${readiness.reportCardsSummary.needsCorrection} need correction`
                  : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Readiness Detail Panel */}
      {readinessPanelOpen && readiness && !readiness.isFullyReady && readiness.pendingSubjects?.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 print:hidden">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
            Pending Subject Approvals
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {readiness.pendingSubjects.map((s) => (
              <div
                key={s.subjectId}
                className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border"
              >
                <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{s.subjectName}</p>
                  <p className="text-[10px] text-muted-foreground">{s.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Enrollment</span>
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
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-muted-foreground">Visible to parents</span>
            {stats.ready > 0 && (
              <span className="text-[10px] font-bold text-blue-500">({stats.ready} ready)</span>
            )}
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl w-full"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { loadData(); loadReadiness(); }}
          disabled={loading || generating}
          className="gap-2 h-10 px-4 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 transition-transform ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* ============================================================ */}
      {/* MOBILE: Card list (visible below md)                         */}
      {/* ============================================================ */}
      <div className="md:hidden space-y-3 print:hidden">
        {loading ? (
          // Skeleton mobile cards
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-1 border-t border-border/40">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              </div>
            </div>
          ))
        ) : filteredRows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {!selectedSectionId
              ? 'Select filters above to load report cards.'
              : 'No students or report cards found for this selection.'}
          </div>
        ) : (
          filteredRows.map((row, idx) => (
            <div
              key={row.id ? `mrc-${row.id}` : `mstudent-${row.studentId}-${idx}`}
              className={`rounded-2xl border bg-card p-4 shadow-xs space-y-3 ${
                row.status === 'NEEDS_CORRECTION'
                  ? 'border-amber-400/40 bg-amber-500/5'
                  : 'border-border'
              }`}
            >
              {/* Top row: rank + name + status */}
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted border border-border text-xs font-black text-foreground shrink-0">
                  {row.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-foreground text-sm leading-tight truncate">{row.fullName}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{row.studentUniqueId} · {row.gender}</div>
                  {row.termName && (
                    <div className="text-[11px] font-semibold text-primary mt-0.5">{row.termName}</div>
                  )}
                </div>
                <StatusBadge status={row.status} />
              </div>

              {/* Scores row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/60 border border-border px-2 py-2">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase">Total</div>
                  <div className="font-black text-foreground text-base">{row.totalScore > 0 ? row.totalScore : '—'}</div>
                </div>
                <div className="rounded-xl bg-muted/60 border border-border px-2 py-2">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase">Average</div>
                  <div className={`font-black text-base ${
                    row.averageScore >= 85 ? 'text-emerald-600 dark:text-emerald-400'
                    : row.averageScore >= 70 ? 'text-blue-600 dark:text-blue-400'
                    : row.averageScore >= 50 ? 'text-amber-600 dark:text-amber-400'
                    : row.averageScore > 0 ? 'text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground'
                  }`}>{row.averageScore > 0 ? `${row.averageScore}%` : '—'}</div>
                </div>
                <div className="rounded-xl bg-muted/60 border border-border px-2 py-2">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase">Conduct</div>
                  <div className="font-black text-foreground text-base">{row.conduct}</div>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenPreview(row.studentId, row.termId)}
                  className="flex-1 h-9 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Card
                </Button>
                {(row.status === 'READY' || row.status === 'NEEDS_CORRECTION') && row.id && (
                  <Button
                    size="sm"
                    onClick={() => handlePublishSingle(row.id, row.fullName)}
                    disabled={publishingId === row.id}
                    className="flex-1 h-9 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {publishingId === row.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Publish
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(row.rawCard || row)}
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground shrink-0"
                  title="Edit Remarks & Conduct"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ============================================================ */}
      {/* DESKTOP: Full table (visible from md up)                     */}
      {/* ============================================================ */}
      <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden shadow-xs print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[11px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Student Details</th>
                <th className="py-3 px-4 text-center">Total</th>
                <th className="py-3 px-4 text-center">Average %</th>
                <th className="py-3 px-4 text-center">Conduct</th>
                <th className="py-3 px-4 text-center">Absences</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                // Skeleton table rows
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 px-4 text-center">
                      <Skeleton className="w-7 h-7 rounded-full mx-auto" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-36 mb-1.5" />
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-6 w-10 mx-auto rounded-md" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No students or report cards found for this selection.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={row.id ? `rc-${row.id}` : `student-${row.studentId}-${idx}`}
                    className={`hover:bg-muted/30 transition-colors ${
                      row.status === 'NEEDS_CORRECTION' ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted border border-border text-xs font-black text-foreground">
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                        <span>{row.studentUniqueId}</span>
                        <span>•</span>
                        <span>Gender: {row.gender}</span>
                        {row.termName && (
                          <>
                            <span>•</span>
                            <span className="font-sans font-semibold text-primary">{row.termName}</span>
                          </>
                        )}
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
                      <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-foreground">
                        {row.conduct}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs font-medium text-muted-foreground">
                      {row.absence}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(row.status === 'READY' || row.status === 'NEEDS_CORRECTION') && row.id && (
                          <Button
                            size="sm"
                            onClick={() => handlePublishSingle(row.id, row.fullName)}
                            disabled={publishingId === row.id}
                            className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            {publishingId === row.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPreview(row.studentId, row.termId)}
                          className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold"
                          title="View Official Report Card"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
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

      {/* ================================================ */}
      {/* 1. SINGLE OFFICIAL REPORT CARD MODAL            */}
      {/* ================================================ */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[94vh] overflow-y-auto p-0 border border-border">
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
                Print / Save PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div ref={printSingleRef} className="p-2 sm:p-6 bg-muted/60 flex justify-center">
            {previewLoading ? (
              <div className="py-24 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
                <span className="text-sm font-medium">{loadingMessage.preview}</span>
              </div>
            ) : comprehensiveCard ? (
              <StudentReportCard card={comprehensiveCard} />
            ) : (
              <div className="py-12 text-center text-muted-foreground">Failed to render card.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================ */}
      {/* 2. BATCH PRINT MODAL (ENTIRE CLASS A4)           */}
      {/* ================================================ */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[94vh] overflow-y-auto p-0 border border-border">
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
                Print All ({batchCards.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBatchModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div ref={printBatchRef} className="p-2 sm:p-6 bg-muted/60 space-y-6">
            {batchLoading ? (
              <div className="py-24 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
                <span className="text-sm font-medium">{loadingMessage.batch}</span>
              </div>
            ) : batchCards.length > 0 ? (
              batchCards.map((c, i) => (
                <div key={c.student.id || i} className="batch-report-card-wrapper mb-8 print:mb-0">
                  <StudentReportCard card={c} />
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-muted-foreground">No cards to display.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================ */}
      {/* 3. EDIT REMARKS & CONDUCT MODAL                  */}
      {/* ================================================ */}
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
                className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring/40"
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
  );
}
