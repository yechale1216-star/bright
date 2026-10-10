'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  Award,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import {
  gradebookService,
  Exam,
  GradingScale,
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

// ─── Main Exams & Grades Management Page ───────────────────────────────────
export default function AdminExamsAndGradesPage({
  initialTab = 'exams',
}: {
  initialTab?: 'exams' | 'scales';
}) {
  const [activeTab, setActiveTab] = useState<'exams' | 'scales'>(initialTab);
  const [loading, setLoading] = useState(false);

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  const [exams, setExams] = useState<Exam[]>([]);
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);

  // Exam modal state
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examName, setExamName] = useState('');
  const [examStartDate, setExamStartDate] = useState('');
  const [examEndDate, setExamEndDate] = useState('');
  const [examStatus, setExamStatus] = useState('SCHEDULED');
  const [examDesc, setExamDesc] = useState('');

  // Scale modal state
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleGrade, setScaleGrade] = useState('');
  const [scaleMin, setScaleMin] = useState(0);
  const [scaleMax, setScaleMax] = useState(100);
  const [scaleGpa, setScaleGpa] = useState(4.0);
  const [scaleDesc, setScaleDesc] = useState('');
  const [scaleColor, setScaleColor] = useState('#6366f1');
  const [scalePassing, setScalePassing] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [examsData, scalesData] = await Promise.all([
        gradebookService.getExams({ academicYearId: selectedYearId || undefined }),
        gradebookService.getGradingScales(),
      ]);
      setExams(examsData);
      setGradingScales(scalesData);
    } catch (err) {
      console.error(err);
    }
  }, [selectedYearId]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('attendance_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const ayRes = await fetch(`${API_URL}/api/academic-years`, { headers }).then((r) => r.json());

      if (ayRes?.success && Array.isArray(ayRes.data)) {
        setAcademicYears(ayRes.data);
        const currentYear = ayRes.data.find((y: any) => y.isCurrent) || ayRes.data[0];
        if (currentYear) {
          setSelectedYearId(currentYear.id);
          const currentTerm = currentYear.terms?.find((t: any) => t.isCurrent) || currentYear.terms?.[0];
          if (currentTerm) setSelectedTermId(currentTerm.id);
        }
      }
      await refreshData();
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (selectedYearId) refreshData();
  }, [selectedYearId, selectedTermId, refreshData]);

  // Exam handlers
  const resetExamForm = () => {
    setEditingExamId(null);
    setExamName('');
    setExamStartDate('');
    setExamEndDate('');
    setExamStatus('SCHEDULED');
    setExamDesc('');
  };

  const handleSaveExam = async () => {
    if (!examName.trim() || !selectedYearId) {
      notifications.error('Required', 'Exam name and academic year are required');
      return;
    }
    try {
      if (editingExamId) {
        await gradebookService.updateExam(editingExamId, {
          name: examName,
          academicYearId: selectedYearId,
          academicTermId: selectedTermId || undefined,
          startDate: examStartDate || undefined,
          endDate: examEndDate || undefined,
          status: examStatus,
          description: examDesc,
        });
        notifications.success('Updated', 'Exam updated successfully');
      } else {
        await gradebookService.createExam({
          name: examName,
          academicYearId: selectedYearId,
          academicTermId: selectedTermId || undefined,
          startDate: examStartDate || undefined,
          endDate: examEndDate || undefined,
          status: examStatus,
          description: examDesc,
        });
        notifications.success('Created', 'New exam created successfully');
      }
      setExamModalOpen(false);
      resetExamForm();
      refreshData();
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to save exam');
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Delete this exam?')) return;
    try {
      await gradebookService.deleteExam(id);
      notifications.success('Deleted', 'Exam removed');
      refreshData();
    } catch (err: any) {
      notifications.error('Error', err?.message);
    }
  };

  // Scale handlers
  const handleSaveScale = async () => {
    if (!scaleGrade.trim()) {
      notifications.error('Required', 'Grade letter is required');
      return;
    }
    try {
      await gradebookService.createGradingScale({
        grade: scaleGrade.trim().toUpperCase(),
        minScore: Number(scaleMin),
        maxScore: Number(scaleMax),
        gpaPoint: Number(scaleGpa),
        description: scaleDesc,
        color: scaleColor,
        isPassing: scalePassing,
      });
      notifications.success('Created', 'Grading scale rule added');
      setScaleModalOpen(false);
      setScaleGrade('');
      refreshData();
    } catch (err: any) {
      notifications.error('Error', err?.message);
    }
  };

  const handleDeleteScale = async (id: string) => {
    if (!confirm('Delete this grading scale?')) return;
    try {
      await gradebookService.deleteGradingScale(id);
      notifications.success('Deleted', 'Grading scale deleted');
      refreshData();
    } catch (err: any) {
      notifications.error('Error', err?.message);
    }
  };

  const currentYearObj = academicYears.find((y) => y.id === selectedYearId);
  const currentTerms = currentYearObj?.terms || [];

  const tabs = [
    { id: 'exams', label: 'Exams', icon: Calendar, count: exams.length },
    { id: 'scales', label: 'Grading Scales', icon: Award, count: gradingScales.length },
  ] as const;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Exams &amp; Grading Management</h1>
            <p className="text-sm text-muted-foreground">
              Configure examination sessions, institutional grading scales, and report card conversion.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Dedicated Assessment Policy Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Assessment Policy &amp; Weight Schemes</h3>
            <p className="text-xs text-muted-foreground">
              Percentage-weighted schemes (100% total), component categories, and bulk class assignments are managed in the dedicated Assessment Policy module.
            </p>
          </div>
        </div>
        <Link href="/school/admin/assessments/policy">
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold whitespace-nowrap shadow-xs"
          >
            Open Assessment Policy <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Scope Filter */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Filter Scope:</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Academic Year:</span>
          <select
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              const y = academicYears.find((ay) => ay.id === e.target.value);
              if (y?.terms?.length > 0) setSelectedTermId(y.terms[0].id);
            }}
            className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs"
          >
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Term:</span>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs"
          >
            <option value="">All Terms</option>
            {currentTerms.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* TAB: EXAMS */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Scheduled Examination Periods</h2>
            <Button
              onClick={() => {
                resetExamForm();
                setExamModalOpen(true);
              }}
              size="sm"
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Schedule Exam
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                No examination sessions configured. Click "Schedule Exam" to begin.
              </div>
            ) : (
              exams.map((ex) => (
                <div
                  key={ex.id}
                  className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-foreground leading-snug">{ex.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ex.status === 'PUBLISHED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : ex.status === 'ONGOING'
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ex.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {ex.description || 'No description provided.'}
                    </p>
                    <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Academic Year:</span>
                        <span className="font-medium text-foreground">{ex.academicYear?.name}</span>
                      </div>
                      {ex.academicTerm && (
                        <div className="flex justify-between">
                          <span>Term:</span>
                          <span className="font-medium text-foreground">{ex.academicTerm?.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Assessments:</span>
                        <span className="font-semibold text-primary">{ex._count?.assessments || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-border flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingExamId(ex.id);
                        setExamName(ex.name);
                        setExamStatus(ex.status);
                        setExamDesc(ex.description || '');
                        setExamStartDate(ex.startDate ? ex.startDate.split('T')[0] : '');
                        setExamEndDate(ex.endDate ? ex.endDate.split('T')[0] : '');
                        setExamModalOpen(true);
                      }}
                      className="h-8 px-2 text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteExam(ex.id)}
                      className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: GRADING SCALES */}
      {activeTab === 'scales' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Institutional Grading Scales &amp; GPA</h2>
              <p className="text-xs text-muted-foreground">
                Thresholds governing report card letter conversion and class position computations.
              </p>
            </div>
            <Button
              onClick={() => setScaleModalOpen(true)}
              size="sm"
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Add Scale Rule
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {gradingScales.map((scale) => (
              <div
                key={scale.id}
                className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: scale.color || '#6366f1' }}
                />
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-3xl font-black tracking-tight" style={{ color: scale.color || '#6366f1' }}>
                      {scale.grade}
                    </span>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                      {scale.description || 'Standard Grade'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      scale.isPassing ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    {scale.isPassing ? 'Passing' : 'Failing'}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Score Range:</span>
                    <span className="font-bold text-foreground">
                      {scale.minScore}% – {scale.maxScore}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPA:</span>
                    <span className="font-bold text-primary">{scale.gpaPoint !== null ? scale.gpaPoint : '—'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteScale(scale.id)}
                    className="h-7 px-2 text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODALS ─────────────────────────────────────────────────────── */}

      {/* Exam Modal */}
      <Dialog open={examModalOpen} onOpenChange={setExamModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              {editingExamId ? 'Edit Exam' : 'Schedule Examination'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Exam Title</Label>
              <Input
                placeholder="e.g. 2026 Term 1 Midterm Examination"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Start Date</Label>
                <Input
                  type="date"
                  value={examStartDate}
                  onChange={(e) => setExamStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">End Date</Label>
                <Input
                  type="date"
                  value={examEndDate}
                  onChange={(e) => setExamEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Status</Label>
              <select
                value={examStatus}
                onChange={(e) => setExamStatus(e.target.value)}
                className="w-full h-9 px-3 mt-1 rounded-md border border-input bg-background text-sm"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Notes / Instructions</Label>
              <Input
                placeholder="Optional exam notice..."
                value={examDesc}
                onChange={(e) => setExamDesc(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExamModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveExam} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scale Modal */}
      <Dialog open={scaleModalOpen} onOpenChange={setScaleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              New Grading Scale Rule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Grade Symbol</Label>
                <Input
                  placeholder="e.g. A+, B, C"
                  value={scaleGrade}
                  onChange={(e) => setScaleGrade(e.target.value)}
                  className="mt-1 font-bold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">GPA Points</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={scaleGpa}
                  onChange={(e) => setScaleGpa(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Min Score (%)</Label>
                <Input
                  type="number"
                  value={scaleMin}
                  onChange={(e) => setScaleMin(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Max Score (%)</Label>
                <Input
                  type="number"
                  value={scaleMax}
                  onChange={(e) => setScaleMax(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Description / Remark</Label>
              <Input
                placeholder="e.g. Excellent, Very Good, Unsatisfactory"
                value={scaleDesc}
                onChange={(e) => setScaleDesc(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs font-semibold">Is Passing Grade?</Label>
              <input
                type="checkbox"
                checked={scalePassing}
                onChange={(e) => setScalePassing(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              >
              </input>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScaleModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveScale} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Add Scale Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
