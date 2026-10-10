'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Search,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  Filter,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notifications } from '@/lib/utils/notifications';
import { cn } from '@/lib/utils/utils';

// ─── API Helper ────────────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  const { getApiUrl } = await import('@/lib/api-config');
  const base = getApiUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(schoolId ? { 'x-school-id': schoolId } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || `API error ${res.status}`);
  return json;
}

// ─── Color Palette ──────────────────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#6366f1',
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const isStreamGrade = (name: string) => {
  const l = (name || '').toLowerCase();
  return l.includes('11') || l.includes('12') || l.includes('prep');
};

function BulkAssignAssessmentContent() {
  const searchParams = useSearchParams();
  const urlSchemeId = searchParams?.get('schemeId') || searchParams?.get('templateId') || '';
  const urlYearId = searchParams?.get('yearId') || '';
  const urlTermId = searchParams?.get('termId') || '';

  // Wizard Step (1 to 5)
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Metadata
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Step 1: Context & Template
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedSchemeId, setSelectedSchemeId] = useState('');

  // Step 2: Grades & Streams
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([]);
  const [streamNatural, setStreamNatural] = useState(true);
  const [streamSocial, setStreamSocial] = useState(true);

  // Step 3: Subjects
  const [subjectSearch, setSubjectSearch] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());

  // Step 4: Policy & Preview
  const [policy, setPolicy] = useState<'SKIP_EXISTING' | 'UPDATE_EXISTING'>('SKIP_EXISTING');
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 5: Execution Result
  const [applyLoading, setApplyLoading] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  // Stepper Steps configuration matching Promotion page pattern
  const steps = [
    { number: 1, label: 'Template' },
    { number: 2, label: 'Grades & Streams' },
    { number: 3, label: 'Select Subjects' },
    { number: 4, label: 'Preview & Policy' },
    { number: 5, label: 'Results' },
  ];

  // ─── Load Initial Data ───────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      const [ayRes, schemesRes, gradesRes, subjectsRes] = await Promise.all([
        apiFetch('/api/academic-years'),
        apiFetch('/api/assessment-policy/schemes'),
        apiFetch('/api/schools/grades'),
        apiFetch('/api/settings/subjects').catch(() => ({ data: [] })),
      ]);

      if (ayRes?.data) {
        setAcademicYears(ayRes.data);
        const paramYear = urlYearId ? ayRes.data.find((y: any) => y.id === urlYearId) : null;
        const cur = paramYear || ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        if (cur) {
          setSelectedYearId(cur.id);
          const paramTerm = urlTermId ? cur.terms?.find((t: any) => t.id === urlTermId) : null;
          const curTerm = paramTerm || cur.terms?.find((t: any) => t.isCurrent) || cur.terms?.[0];
          if (curTerm) setSelectedTermId(curTerm.id);
        }
      }

      if (schemesRes?.data?.length > 0) {
        setSchemes(schemesRes.data);
        const match = urlSchemeId ? schemesRes.data.find((s: any) => s.id === urlSchemeId) : null;
        const def = match || schemesRes.data.find((s: any) => s.isDefault || s.isTemplate) || schemesRes.data[0];
        if (def) setSelectedSchemeId(def.id);
      }

      if (gradesRes?.data) {
        setGrades(gradesRes.data);
        // Default: secondary grades
        const sec = gradesRes.data.filter((g: any) => {
          const l = (g.name || '').toLowerCase();
          return l.includes('9') || l.includes('10') || l.includes('11') || l.includes('12');
        });
        setSelectedGradeIds(sec.length > 0 ? sec.map((g: any) => g.id) : gradesRes.data.map((g: any) => g.id));
      }

      if (subjectsRes?.data) setSubjects(subjectsRes.data);
    } catch (err: any) {
      notifications.error('Load Error', err.message || 'Failed to load bulk assignment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Derived State ───────────────────────────────────────────────────────
  const activeTemplate = useMemo(() => schemes.find(s => s.id === selectedSchemeId) || null, [schemes, selectedSchemeId]);
  const activeYear = useMemo(() => academicYears.find(y => y.id === selectedYearId) || academicYears[0], [academicYears, selectedYearId]);
  const activeTerms = useMemo(() => activeYear?.terms || [], [activeYear]);

  const sortedGrades = useMemo(() =>
    [...grades].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })),
    [grades]);

  // ─── Grade Quick-Selects ─────────────────────────────────────────────────
  const selectAllGrades = () => setSelectedGradeIds(grades.map(g => g.id));
  const selectSecondaryGrades = () => {
    const sec = grades.filter(g => {
      const l = (g.name || '').toLowerCase();
      return l.includes('9') || l.includes('10') || l.includes('11') || l.includes('12') || l.includes('secondary') || l.includes('high');
    });
    setSelectedGradeIds(sec.map(g => g.id));
  };
  const selectPrimaryGrades = () => {
    const prim = grades.filter(g => {
      const l = (g.name || '').toLowerCase();
      return l.includes('1') || l.includes('2') || l.includes('3') || l.includes('4') ||
        l.includes('5') || l.includes('6') || l.includes('7') || l.includes('8') ||
        l.includes('primary') || l.includes('middle');
    });
    setSelectedGradeIds(prim.map(g => g.id));
  };
  const toggleGrade = (id: string) =>
    setSelectedGradeIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  // ─── Eligible Combinations ───────────────────────────────────────────────
  const eligibleCombinations = useMemo(() => {
    const combos: Array<{
      key: string; gradeId: string; gradeName: string;
      stream: string; subjectId: string; subjectName: string; subjectCode: string;
    }> = [];
    const activeSubs = subjects.filter(s => s.isActive !== false);
    for (const gId of selectedGradeIds) {
      const grade = grades.find(g => g.id === gId);
      if (!grade) continue;
      const isUpper = isStreamGrade(grade.name);
      if (isUpper) {
        if (streamNatural) for (const sub of activeSubs) combos.push({ key: `${gId}:Natural:${sub.id}`, gradeId: gId, gradeName: grade.name, stream: 'Natural', subjectId: sub.id, subjectName: sub.name, subjectCode: sub.code || '' });
        if (streamSocial) for (const sub of activeSubs) combos.push({ key: `${gId}:Social:${sub.id}`, gradeId: gId, gradeName: grade.name, stream: 'Social', subjectId: sub.id, subjectName: sub.name, subjectCode: sub.code || '' });
      } else {
        for (const sub of activeSubs) combos.push({ key: `${gId}:General:${sub.id}`, gradeId: gId, gradeName: grade.name, stream: 'General', subjectId: sub.id, subjectName: sub.name, subjectCode: sub.code || '' });
      }
    }
    return combos;
  }, [selectedGradeIds, streamNatural, streamSocial, grades, subjects]);

  const filteredCombinations = useMemo(() => {
    if (!subjectSearch.trim()) return eligibleCombinations;
    const q = subjectSearch.toLowerCase();
    return eligibleCombinations.filter(c =>
      c.subjectName.toLowerCase().includes(q) ||
      (c.subjectCode || '').toLowerCase().includes(q) ||
      c.gradeName.toLowerCase().includes(q) ||
      c.stream.toLowerCase().includes(q));
  }, [eligibleCombinations, subjectSearch]);

  const toggleTarget = (key: string) => {
    const next = new Set(selectedTargets);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedTargets(next);
  };
  const selectAll = () => { const s = new Set<string>(); filteredCombinations.forEach(c => s.add(c.key)); setSelectedTargets(s); };
  const clearAll = () => setSelectedTargets(new Set());

  // ─── Metrics ─────────────────────────────────────────────────────────────
  const uniqueGradeCount = useMemo(() => { const s = new Set<string>(); selectedTargets.forEach(k => s.add(k.split(':')[0])); return s.size; }, [selectedTargets]);
  const uniqueSubjectCount = useMemo(() => { const s = new Set<string>(); selectedTargets.forEach(k => s.add(k.split(':')[2])); return s.size; }, [selectedTargets]);

  // ─── Build Targets Payload ───────────────────────────────────────────────
  const buildTargets = () => Array.from(selectedTargets).map(key => {
    const [gradeId, , subjectId] = key.split(':');
    return { gradeId, streamId: null, subjectId };
  });

  // ─── Fetch Preview ───────────────────────────────────────────────────────
  const fetchPreview = useCallback(async (pol = policy) => {
    if (selectedTargets.size === 0) {
      notifications.warning('Selection Required', 'Please select at least one subject combination.');
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await apiFetch('/api/assessment-policy/bulk-assign/preview', {
        method: 'POST',
        body: JSON.stringify({
          schemeId: selectedSchemeId,
          academicYearId: selectedYearId,
          academicTermId: selectedTermId || undefined,
          targets: buildTargets(),
          policy: pol,
        }),
      });
      setPreviewData(res.data);
    } catch (err: any) {
      notifications.error('Preview Error', err.message || 'Failed to generate preview.');
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedTargets, selectedSchemeId, selectedYearId, selectedTermId, policy]);

  const handlePolicyChange = (newPolicy: 'SKIP_EXISTING' | 'UPDATE_EXISTING') => {
    setPolicy(newPolicy);
    if (selectedTargets.size > 0) {
      fetchPreview(newPolicy);
    }
  };

  // ─── Apply Bulk Assignment ───────────────────────────────────────────────
  const handleApply = async () => {
    if (selectedTargets.size === 0) {
      notifications.warning('Selection Required', 'Please select at least one grade-subject combination.');
      return;
    }
    if (policy === 'UPDATE_EXISTING' && !confirmUpdate) {
      notifications.warning('Confirmation Required', 'Please check the confirmation box to proceed with overwriting existing records.');
      return;
    }
    setApplyLoading(true);
    try {
      const res = await apiFetch('/api/assessment-policy/bulk-assign/apply', {
        method: 'POST',
        body: JSON.stringify({
          schemeId: selectedSchemeId,
          academicYearId: selectedYearId,
          academicTermId: selectedTermId || undefined,
          targets: buildTargets(),
          policy,
          confirmUpdate,
        }),
      });
      setResultData(res.data);
      setCurrentStep(5);
      notifications.success('Bulk Assignment Complete', res.message || 'Assessment templates assigned successfully.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      notifications.error('Assignment Error', err.message || 'Failed to complete bulk assignment.');
    } finally {
      setApplyLoading(false);
    }
  };

  // ─── Wizard Navigation Controls ──────────────────────────────────────────
  const isNextDisabled = useMemo(() => {
    if (currentStep === 1) return !selectedYearId || !selectedSchemeId;
    if (currentStep === 2) return selectedGradeIds.length === 0;
    if (currentStep === 3) return selectedTargets.size === 0;
    if (currentStep === 4) return selectedTargets.size === 0 || (policy === 'UPDATE_EXISTING' && !confirmUpdate);
    return false;
  }, [currentStep, selectedYearId, selectedSchemeId, selectedGradeIds, selectedTargets, policy, confirmUpdate]);

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedYearId || !selectedSchemeId) {
        notifications.warning('Selection Required', 'Please select both an Academic Year and an Assessment Template.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedGradeIds.length === 0) {
        notifications.warning('Selection Required', 'Please select at least one grade.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (selectedTargets.size === 0) {
        notifications.warning('Selection Required', 'Please select at least one subject combination.');
        return;
      }
      fetchPreview();
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-9 h-9 animate-spin text-blue-600" />
        <p className="text-sm font-semibold text-muted-foreground">Loading Bulk Assessment Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 md:pt-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
      {/* ─── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/school/admin/assessments"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <SlidersHorizontal className="w-5 h-5 text-blue-600" /> Bulk Assign Assessment Template
            </h1>
          </div>
          <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Batch configure assessment weight schemes across classes in a guided workflow.
          </p>
        </div>
      </div>

      {/* ─── STEP PROGRESS INDICATOR (Promotion-style Horizontal Stepper) ─── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        {/* Desktop & Tablet Stepper */}
        <div className="hidden sm:flex justify-between items-center relative max-w-3xl mx-auto">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-muted -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((s) => {
            const isActive = currentStep >= s.number;
            const isCurrent = currentStep === s.number;
            const isPast = currentStep > s.number;
            return (
              <div
                key={s.number}
                onClick={() => {
                  if (isPast && currentStep !== 5) setCurrentStep(s.number);
                }}
                className={cn(
                  'flex flex-col items-center z-10 relative select-none',
                  isPast && currentStep !== 5 && 'cursor-pointer'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border-2',
                    isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                      : isActive
                        ? 'bg-blue-600/10 border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'bg-card border-border text-muted-foreground'
                  )}
                >
                  {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : s.number}
                </div>
                <span
                  className={cn(
                    'text-xs font-semibold mt-2 transition-all duration-300',
                    isCurrent ? 'text-blue-600 dark:text-blue-400 font-bold' : isPast ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mobile Stepper */}
        <div className="sm:hidden space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Step {currentStep} of {steps.length}: {steps[currentStep - 1].label}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {Math.round(((currentStep) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── Main 2-Column Content Layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ═══════════════════════════════════════════════════════════════════
            LEFT: Active Step View + Action Bar
        ════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 space-y-6">

          {/* ─────────────── STEP 1: SETUP & TEMPLATE ──────────────────────── */}
          {currentStep === 1 && (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-5 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Select Template & Academic Context</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose the target academic year, term, and assessment template for this bulk operation.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {/* Academic Year */}
                <div>
                  <Label className="text-xs font-semibold text-foreground">Academic Year *</Label>
                  <div className="relative mt-1.5">
                    <select
                      value={selectedYearId}
                      onChange={e => setSelectedYearId(e.target.value)}
                      className="w-full h-10 pl-3 pr-9 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>
                      ))}
                    </select>
                    <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Term */}
                <div>
                  <Label className="text-xs font-semibold text-foreground">Term / Semester</Label>
                  <select
                    value={selectedTermId}
                    onChange={e => setSelectedTermId(e.target.value)}
                    className="w-full h-10 px-3 mt-1.5 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Terms (Annual)</option>
                    {activeTerms.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' (Current)' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Assessment Template */}
                <div>
                  <Label className="text-xs font-semibold text-foreground">Assessment Template *</Label>
                  <select
                    value={selectedSchemeId}
                    onChange={e => setSelectedSchemeId(e.target.value)}
                    className="w-full h-10 px-3 mt-1.5 rounded-xl border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Template Detail Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                {/* Info card */}
                <div className="md:col-span-7 p-4 sm:p-5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Template Overview</h4>
                      <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400 mt-1 leading-relaxed">
                        This template applies percentage weights to all selected grade–subject combinations.
                        Only templates totalling 100% can be assigned.
                      </p>
                    </div>
                  </div>
                  {activeTemplate?.description && (
                    <p className="text-xs text-muted-foreground italic border-t border-blue-500/10 pt-2">"{activeTemplate.description}"</p>
                  )}
                </div>

                {/* Categories card */}
                <div className="md:col-span-5 p-4 sm:p-5 rounded-xl bg-card border border-border space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-foreground">Categories & Weights</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    {activeTemplate?.categories?.map((cat: any, idx: number) => (
                      <div key={cat.id || idx} className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                          <span className="text-muted-foreground font-medium">{cat.name}</span>
                        </div>
                        <span className="font-bold text-foreground">{cat.weight}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs sm:text-sm font-black text-foreground">
                    <span>Total Weight</span>
                    <span className="text-blue-600 dark:text-blue-400">{activeTemplate?.categories?.reduce((s: number, c: any) => s + Number(c.weight || 0), 0) || 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────── STEP 2: GRADES & STREAMS ──────────────────────── */}
          {currentStep === 2 && (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-xs">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Select Target Grades & Streams</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                      Choose which grades and high-school streams will receive this template.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="outline" size="sm" onClick={selectAllGrades} className="h-8 text-xs font-semibold px-3">
                    All Grades
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectSecondaryGrades} className="h-8 text-xs font-semibold px-3">
                    Secondary (9–12)
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectPrimaryGrades} className="h-8 text-xs font-semibold px-3">
                    Primary (1–8)
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGradeIds([])} className="h-8 text-xs font-semibold px-2.5 text-muted-foreground">
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Grade Cards Grid (Full Width) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-semibold text-foreground">
                    Grades ({selectedGradeIds.length} of {grades.length} selected)
                  </Label>
                  {selectedGradeIds.length === 0 && (
                    <span className="text-xs text-rose-500 font-medium">Please select at least one grade to continue</span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sortedGrades.map(grade => {
                    const isSelected = selectedGradeIds.includes(grade.id);
                    const hasStream = isStreamGrade(grade.name);
                    return (
                      <div
                        key={grade.id}
                        onClick={() => toggleGrade(grade.id)}
                        className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-500/10 dark:bg-blue-500/15 shadow-sm'
                            : 'border-border bg-card hover:border-blue-300 dark:hover:border-blue-800 hover:bg-muted/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`text-sm block font-bold leading-snug whitespace-normal break-words ${
                            isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-foreground'
                          }`}>
                            {grade.name}
                          </span>
                          {hasStream && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 mt-1.5">
                              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" /> Streams
                            </span>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-muted-foreground/40 bg-background'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Streams Policy Configuration (Full Width Below Grades) */}
              {selectedGradeIds.some(id => isStreamGrade(grades.find(g => g.id === id)?.name || '')) ? (
                <div className="p-4 sm:p-5 rounded-xl bg-amber-500/5 border border-amber-500/25 space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <h3 className="text-sm font-bold text-foreground">Upper Secondary Stream Configuration</h3>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        Grades 11–12
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStreamNatural(true); setStreamSocial(true); }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      Select Both Tracks
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Selected upper grades support specialized streams. Choose which academic tracks should receive this template:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    <label
                      onClick={() => setStreamNatural(!streamNatural)}
                      className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                        streamNatural ? 'border-blue-600 bg-blue-500/10' : 'border-border bg-card hover:border-border/80'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs sm:text-sm font-bold text-foreground block">Natural Science Track</span>
                        <span className="text-[11px] text-muted-foreground block">Includes Physics, Chemistry, Biology, Technical Drawing</span>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ml-2 ${
                        streamNatural ? 'border-blue-600 bg-blue-600 text-white' : 'border-muted-foreground/40'
                      }`}>
                        {streamNatural && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </label>

                    <label
                      onClick={() => setStreamSocial(!streamSocial)}
                      className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                        streamSocial ? 'border-blue-600 bg-blue-500/10' : 'border-border bg-card hover:border-border/80'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs sm:text-sm font-bold text-foreground block">Social Science Track</span>
                        <span className="text-[11px] text-muted-foreground block">Includes History, Geography, Economics, General Business</span>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ml-2 ${
                        streamSocial ? 'border-blue-600 bg-blue-600 text-white' : 'border-muted-foreground/40'
                      }`}>
                        {streamSocial && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>
                    Standard curriculum applies to all currently selected grades. Stream configuration (Natural/Social Science) activates automatically when Grades 11 or 12 are selected.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── STEP 3: SELECT SUBJECTS ───────────────────────── */}
          {currentStep === 3 && (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Select Subjects</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedTargets.size} of {eligibleCombinations.length} combinations selected
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll} className="h-8 text-xs font-semibold px-3">
                    Select All ({filteredCombinations.length})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs font-semibold px-3 text-muted-foreground">
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by subject name, code, grade or stream..."
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                  className="pl-9 pr-9 h-10 text-xs rounded-xl bg-muted/20 border-border"
                />
                <Filter className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>

              {/* Table */}
              <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold text-[11px] sticky top-0 z-10 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredCombinations.length > 0 && filteredCombinations.every(c => selectedTargets.has(c.key))}
                          onChange={e => e.target.checked ? selectAll() : clearAll()}
                          className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Grade</th>
                      <th className="py-2.5 px-3">Stream</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3 text-right">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCombinations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          {selectedGradeIds.length === 0 ? 'No grades selected. Go back to step 2 to select grades.' : 'No matching subjects found.'}
                        </td>
                      </tr>
                    ) : filteredCombinations.map(c => {
                      const isChecked = selectedTargets.has(c.key);
                      return (
                        <tr
                          key={c.key}
                          onClick={() => toggleTarget(c.key)}
                          className={`hover:bg-muted/40 transition-colors cursor-pointer ${isChecked ? 'bg-blue-500/5' : ''}`}
                        >
                          <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTarget(c.key)}
                              className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-foreground">{c.gradeName}</td>
                          <td className="py-2 px-3">
                            {c.stream !== 'General' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">{c.stream}</span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">General</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">{c.subjectName}</td>
                          <td className="py-2 px-3 text-right font-mono text-[10px] text-muted-foreground">{c.subjectCode || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground font-semibold">
                {selectedTargets.size} combination{selectedTargets.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {/* ─────────────── STEP 4: PREVIEW & POLICY ───────────────────────── */}
          {currentStep === 4 && (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Conflict Policy & Impact Preview</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review each target and configure how existing assessment configurations are handled.
                  </p>
                </div>
              </div>

              {/* Policy Selection Cards */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-foreground">Handling Policy for Existing Configurations</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => handlePolicyChange('SKIP_EXISTING')}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      policy === 'SKIP_EXISTING' ? 'border-emerald-600 bg-emerald-500/5 shadow-xs' : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Option A — Skip Existing (Safe)</span>
                      {policy === 'SKIP_EXISTING' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Only creates configs for unassigned combinations. Leaves existing weights and assessments untouched.
                    </p>
                  </div>

                  <div
                    onClick={() => handlePolicyChange('UPDATE_EXISTING')}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      policy === 'UPDATE_EXISTING' ? 'border-amber-600 bg-amber-500/5 shadow-xs' : 'border-border bg-card hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Option B — Update Existing Configurations</span>
                      {policy === 'UPDATE_EXISTING' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Replaces existing schemes with the new template. Locked report-card policies are always protected.
                    </p>
                  </div>
                </div>

                {policy === 'UPDATE_EXISTING' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 mt-2">
                    <input
                      type="checkbox"
                      id="confirmUpdate"
                      checked={confirmUpdate}
                      onChange={e => setConfirmUpdate(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-amber-600 cursor-pointer"
                    />
                    <label htmlFor="confirmUpdate" className="text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                      <strong>I confirm this update:</strong> I understand that modifying existing configurations will update grading weight rules for all unpublished scores in the selected subjects.
                    </label>
                  </div>
                )}
              </div>

              {/* Pre-flight Impact Preview */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-foreground">Calculated Impact Matrix</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPreview()}
                    disabled={previewLoading}
                    className="h-7 text-xs font-semibold gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${previewLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {previewLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                    <p className="text-xs font-semibold text-muted-foreground">Calculating pre-flight configuration matrix...</p>
                  </div>
                ) : previewData ? (
                  <>
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Targets', value: previewData.summary?.total || 0, cls: 'bg-card border-border text-foreground' },
                        { label: 'To Create (New)', value: previewData.summary?.toCreate || 0, cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
                        { label: 'Existing Configs', value: (previewData.summary?.toUpdate || 0) + (previewData.summary?.alreadyAssigned || 0) + (previewData.summary?.lockedCount || 0), cls: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' },
                        { label: 'Action Target', value: policy === 'UPDATE_EXISTING' ? (previewData.summary?.toCreate || 0) + (previewData.summary?.toUpdate || 0) : previewData.summary?.toCreate || 0, cls: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400' },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className={`p-3 rounded-xl border ${cls}`}>
                          <span className="text-[10px] font-semibold uppercase opacity-70 block">{label}</span>
                          <p className="text-lg font-black mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Preview Table */}
                    <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-muted/70 text-muted-foreground font-semibold uppercase text-[10px] sticky top-0 z-10 border-b border-border">
                          <tr>
                            <th className="py-2.5 px-3">Grade</th>
                            <th className="py-2.5 px-3">Stream</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Current Scheme</th>
                            <th className="py-2.5 px-3 text-right">Proposed Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {previewData.items?.map((item: any, idx: number) => {
                            const actionColor =
                              item.proposedAction === 'CREATE' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              item.proposedAction === 'UPDATE' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                              item.proposedAction === 'LOCKED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                              'bg-muted text-muted-foreground border-border';
                            return (
                              <tr key={idx} className="hover:bg-muted/30">
                                <td className="py-2 px-3 font-semibold text-foreground">{item.gradeName}</td>
                                <td className="py-2 px-3 text-muted-foreground">{item.streamName || '—'}</td>
                                <td className="py-2 px-3 font-medium text-foreground">{item.subjectName}</td>
                                <td className="py-2 px-3 text-muted-foreground">
                                  {item.currentScheme ? item.currentScheme.name : <span className="italic text-muted-foreground/60">None (Unassigned)</span>}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionColor}`}>
                                    {item.proposedAction}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Preview not yet calculated. Click Refresh above.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ─────────────── STEP 5: RESULTS & AUDIT ───────────────────────── */}
          {currentStep === 5 && (
            <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-xs">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-300">
                    Bulk Assignment Complete!
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-0.5">
                    Template <strong>"{resultData?.template?.name}"</strong> successfully processed for {resultData?.summary?.total} target combinations.
                  </p>
                </div>
              </div>

              {/* Result Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Created', value: resultData?.summary?.created || 0, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
                  { label: 'Updated', value: resultData?.summary?.updated || 0, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
                  { label: 'Skipped', value: resultData?.summary?.skipped || 0, color: 'text-muted-foreground bg-muted border-border' },
                  { label: 'Failed', value: resultData?.summary?.failed || 0, color: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-3.5 rounded-xl border text-center ${color}`}>
                    <span className="text-[10px] font-semibold uppercase opacity-80">{label}</span>
                    <p className="text-xl font-black mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Audit Detail Table */}
              {resultData?.results?.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/70 text-muted-foreground font-semibold uppercase text-[10px] sticky top-0 z-10 border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3">Subject ID</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Reason / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {resultData.results.map((res: any, idx: number) => {
                        const sc = res.status === 'CREATED' ? 'bg-emerald-500/10 text-emerald-600' :
                          res.status === 'UPDATED' ? 'bg-amber-500/10 text-amber-600' :
                          res.status === 'FAILED' ? 'bg-rose-500/10 text-rose-600' :
                          'bg-muted text-muted-foreground';
                        return (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground">{res.subjectId}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sc}`}>{res.status}</span>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground text-[11px]">{res.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Post-execution Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep(1);
                    setResultData(null);
                    setPreviewData(null);
                    setSelectedTargets(new Set());
                  }}
                  className="rounded-xl text-xs font-bold h-11 px-5"
                >
                  Run Another Assignment
                </Button>
                <Link href="/school/admin/assessments">
                  <Button className="rounded-xl text-xs font-bold h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white">
                    Done — View Assessments
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ─────────────── WIZARD ACTION BAR (Promotion style) ────────────── */}
          {currentStep < 5 && (
            <div className="pt-6 mt-6 border-t border-border flex justify-between items-center gap-4">
              {currentStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="h-11 md:h-12 rounded-xl font-bold px-6 border-border hover:bg-muted text-sm gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={isNextDisabled}
                  className="h-11 md:h-12 rounded-xl text-sm font-bold px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all gap-1.5"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleApply}
                  disabled={applyLoading || isNextDisabled}
                  className="h-11 md:h-12 rounded-xl text-sm font-bold px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all gap-2"
                >
                  {applyLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Processing Assignment...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Confirm & Execute ({selectedTargets.size})</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT: Sticky Summary Panel
        ════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-6">

          {/* Card 1: Selected Template */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-foreground">Selected Template</h3>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    {activeTemplate?.name || '—'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                  Active
                </span>
              </div>
              <div className="space-y-1 text-xs border-t border-border/60 pt-2">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground block">Applicable Grades</span>
                  <span className="text-foreground font-semibold text-xs">
                    {grades.filter(g => selectedGradeIds.includes(g.id)).map(g => g.name.replace(/Grade\s*/i, '')).join(', ') || 'None selected'}
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground block">Streams</span>
                  <span className="text-foreground font-semibold text-xs">
                    {streamNatural && streamSocial ? 'Natural & Social' : streamNatural ? 'Natural' : streamSocial ? 'Social' : 'None'}
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground block">Term</span>
                  <span className="text-foreground font-semibold text-xs">
                    {selectedTermId ? activeTerms.find((t: any) => t.id === selectedTermId)?.name || selectedTermId : 'All Terms'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Assignment Metrics & Summary */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-foreground">Assignment Summary</h3>
            <div className="space-y-2.5">
              {[
                { icon: <GraduationCap className="w-4 h-4" />, label: 'Selected Grades', value: uniqueGradeCount, sub: grades.filter(g => selectedGradeIds.includes(g.id)).map(g => g.name.replace(/Grade\s*/i, '')).join(', ') || 'None' },
                { icon: <BookOpen className="w-4 h-4" />, label: 'Unique Subjects', value: uniqueSubjectCount, sub: `across ${uniqueGradeCount} grade(s)` },
                { icon: <SlidersHorizontal className="w-4 h-4" />, label: 'Total Combinations', value: selectedTargets.size, sub: `${eligibleCombinations.length} eligible in scope` },
              ].map(({ icon, label, value, sub }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground block">{label}</span>
                    <p className="text-sm font-black text-foreground">{value}</p>
                    <span className="text-[10px] text-muted-foreground">{sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning banner on step 3 and 4 */}
            {selectedTargets.size > 0 && currentStep <= 4 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">Pre-Flight Scope</span>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                    {selectedTargets.size} combination{selectedTargets.size !== 1 ? 's' : ''} targeted. Policy: <strong>{policy === 'SKIP_EXISTING' ? 'Skip Existing (Safe)' : 'Update Existing'}</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BulkAssignAssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <RefreshCw className="w-9 h-9 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-muted-foreground">Loading Bulk Assessment Engine...</p>
        </div>
      }
    >
      <BulkAssignAssessmentContent />
    </Suspense>
  );
}
