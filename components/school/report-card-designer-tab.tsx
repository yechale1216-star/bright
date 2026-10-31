'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Palette,
  RotateCcw,
  Save,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { notifications } from '@/lib/utils/notifications';
import { StudentReportCard } from '@/components/school/student-report-card';
import { ComprehensiveReportCardData } from '@/lib/gradebook-service';
import { authService } from '@/lib/auth/auth';

const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_TEXT_COLOR = '#0f172a';
const DEFAULT_BORDER_RADIUS = 4;

// Realistic, high-fidelity sample student report card data for live preview
const SAMPLE_REPORT_CARD_DATA: ComprehensiveReportCardData = {
  reportCardId: 'BP-2018-09-00124',
  issueDate: '28 Jul 2026',
  school: {
    name: 'Bright Path School',
    amharicName: 'ብራይት ፓዝ ት/ቤት',
    address: 'Dire Dawa, Ethiopia',
    phone: '0251 - 11 41 87',
    logo: '/bright-path-logo.png',
    primaryColor: '#1e3a8a',
    backgroundColor: DEFAULT_BG_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    borderRadius: DEFAULT_BORDER_RADIUS,
  },
  student: {
    id: 'sample-student-1',
    studentId: 'BPS/2018/042',
    fullName: 'Yonas Abebe Tadesse',
    gender: 'M',
    age: 15,
    dateOfBirth: '2011-04-12',
    photo: null,
    status: 'ACTIVE',
  },
  academic: {
    academicYearId: 'ay-2018',
    academicYearName: '2018 E.C. (2025/2026)',
    academicTermId: 'term-all',
    academicTermName: 'Full Academic Year',
    gradeId: 'grade-10',
    gradeName: 'Grade 10',
    sectionId: 'sec-a',
    sectionName: 'A',
    streamName: undefined,
    homeroomTeacherName: 'Anteeh Addisu Legesse',
  },
  periods: [
    { id: 'sem1', label: 'Sem 1' },
    { id: 'sem2', label: 'Sem 2' },
  ],
  subjectRows: [
    { subjectId: 'eng', subjectName: 'English Language', code: 'ENG', weight: 100, scores: { sem1: 88, sem2: 92 }, total: 180, average: 90, isPassing: true },
    { subjectId: 'amh', subjectName: 'Amharic Literature', code: 'AMH', weight: 100, scores: { sem1: 82, sem2: 86 }, total: 168, average: 84, isPassing: true },
    { subjectId: 'math', subjectName: 'Mathematics', code: 'MAT', weight: 100, scores: { sem1: 94, sem2: 96 }, total: 190, average: 95, isPassing: true },
    { subjectId: 'phy', subjectName: 'Physics', code: 'PHY', weight: 100, scores: { sem1: 85, sem2: 89 }, total: 174, average: 87, isPassing: true },
    { subjectId: 'chem', subjectName: 'Chemistry', code: 'CHE', weight: 100, scores: { sem1: 79, sem2: 83 }, total: 162, average: 81, isPassing: true },
    { subjectId: 'bio', subjectName: 'Biology', code: 'BIO', weight: 100, scores: { sem1: 91, sem2: 93 }, total: 184, average: 92, isPassing: true },
    { subjectId: 'hist', subjectName: 'History', code: 'HIS', weight: 100, scores: { sem1: 80, sem2: 84 }, total: 164, average: 82, isPassing: true },
    { subjectId: 'geo', subjectName: 'Geography', code: 'GEO', weight: 100, scores: { sem1: 86, sem2: 88 }, total: 174, average: 87, isPassing: true },
    { subjectId: 'civ', subjectName: 'Citizenship Education', code: 'CIV', weight: 100, scores: { sem1: 90, sem2: 92 }, total: 182, average: 91, isPassing: true },
    { subjectId: 'it', subjectName: 'Information Technology', code: 'ICT', weight: 100, scores: { sem1: 95, sem2: 97 }, total: 192, average: 96, isPassing: true },
    { subjectId: 'pe', subjectName: 'Health & Physical Ed.', code: 'HPE', weight: 100, scores: { sem1: 92, sem2: 94 }, total: 186, average: 93, isPassing: true },
  ],
  summary: {
    totalRow: {
      weight: 1100,
      periodSums: { sem1: 962, sem2: 1004 },
      total: 1966,
      average: 89.36,
    },
    averageRow: {
      periodAverages: { sem1: 87.45, sem2: 91.27 },
      overallAverage: 89.36,
    },
    rank: '1 / 38',
    conduct: 'A',
    absence: '0 Day',
    isPassing: true,
    remarkBadge: 'Promoted with Distinction',
    failedSubjectsCount: 0,
    passingMinScore: 50,
    teacherComment: 'Outstanding academic commitment, exemplary discipline, and active peer leadership throughout the school year.',
    principalComment: 'Exceptional academic excellence. Congratulations on achieving top class honors.',
  },
  gradingPolicy: {
    passingMinScore: 50,
    scales: [
      { grade: 'A+', minScore: 90, maxScore: 100, gpaPoint: 4.0, isPassing: true, description: 'Outstanding' },
      { grade: 'A', minScore: 85, maxScore: 89.99, gpaPoint: 4.0, isPassing: true, description: 'Excellent' },
      { grade: 'B+', minScore: 80, maxScore: 84.99, gpaPoint: 3.5, isPassing: true, description: 'Very Good' },
      { grade: 'B', minScore: 75, maxScore: 79.99, gpaPoint: 3.0, isPassing: true, description: 'Good' },
      { grade: 'C+', minScore: 65, maxScore: 74.99, gpaPoint: 2.5, isPassing: true, description: 'Satisfactory' },
      { grade: 'C', minScore: 60, maxScore: 64.99, gpaPoint: 2.0, isPassing: true, description: 'Average' },
      { grade: 'D', minScore: 50, maxScore: 59.99, gpaPoint: 1.0, isPassing: true, description: 'Passing' },
      { grade: 'F', minScore: 0, maxScore: 49.99, gpaPoint: 0.0, isPassing: false, description: 'Failing' },
    ],
  },
  status: 'PUBLISHED',
  qrCodeData: 'https://zetime.pro.et/verify/report-card?id=BPS/2018/042',
};

export function ReportCardDesignerTab() {
  const [bgColor, setBgColor] = useState(DEFAULT_BG_COLOR);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [borderRadius, setBorderRadius] = useState(DEFAULT_BORDER_RADIUS);

  const [savedBgColor, setSavedBgColor] = useState(DEFAULT_BG_COLOR);
  const [savedTextColor, setSavedTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [savedBorderRadius, setSavedBorderRadius] = useState(DEFAULT_BORDER_RADIUS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);

  const bgInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Check if current user is authorized administrator
  const userRole = authService.getCurrentUser()?.role || '';
  const isAuthorizedAdmin = ['admin', 'school_admin'].includes(userRole.toLowerCase());

  // Detect dirty / unsaved changes
  const isDirty =
    bgColor.toLowerCase() !== savedBgColor.toLowerCase() ||
    textColor.toLowerCase() !== savedTextColor.toLowerCase() ||
    borderRadius !== savedBorderRadius;

  const isNotDefault =
    bgColor.toLowerCase() !== DEFAULT_BG_COLOR.toLowerCase() ||
    textColor.toLowerCase() !== DEFAULT_TEXT_COLOR.toLowerCase() ||
    borderRadius !== DEFAULT_BORDER_RADIUS;

  // Load saved settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('attendance_token');
      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const res = await fetch(`${API_URL}/api/settings`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).then((r) => r.json());

      if (res?.success && res.data) {
        const bg = res.data.report_card_bg_color || DEFAULT_BG_COLOR;
        const text = res.data.report_card_text_color || DEFAULT_TEXT_COLOR;
        const radius =
          typeof res.data.report_card_border_radius === 'number'
            ? res.data.report_card_border_radius
            : DEFAULT_BORDER_RADIUS;

        setBgColor(bg);
        setTextColor(text);
        setBorderRadius(radius);

        setSavedBgColor(bg);
        setSavedTextColor(text);
        setSavedBorderRadius(radius);
      }
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to load report card design settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!isAuthorizedAdmin) {
      notifications.error('Permission Denied', 'Only authorized school administrators can save design settings.');
      return;
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem('attendance_token');
      const { getApiUrl } = await import('@/lib/api-config');
      const API_URL = getApiUrl();

      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          report_card_bg_color: bgColor,
          report_card_text_color: textColor,
          report_card_border_radius: borderRadius,
        }),
      }).then((r) => r.json());

      if (res?.success) {
        setSavedBgColor(bgColor);
        setSavedTextColor(textColor);
        setSavedBorderRadius(borderRadius);
        notifications.success(
          'Design Saved',
          'The custom report card design is now the active school standard across all students and classes.'
        );
      } else {
        throw new Error(res?.message || 'Failed to persist design');
      }
    } catch (err: any) {
      notifications.error('Save Failed', err?.message || 'Failed to save report card design');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDesign = () => {
    setBgColor(DEFAULT_BG_COLOR);
    setTextColor(DEFAULT_TEXT_COLOR);
    setBorderRadius(DEFAULT_BORDER_RADIUS);
  };

  // Build live preview card object injecting active visual design
  const previewCardData = useMemo<ComprehensiveReportCardData>(() => {
    return {
      ...SAMPLE_REPORT_CARD_DATA,
      school: {
        ...SAMPLE_REPORT_CARD_DATA.school,
        backgroundColor: bgColor,
        textColor: textColor,
        borderRadius: borderRadius,
      },
    };
  }, [bgColor, textColor, borderRadius]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800/80">
        <CardContent className="p-12 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground">
            Loading Report Card Designer...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Designer Control Console Header */}
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 shadow-sm backdrop-blur-md">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/10 border border-pink-500/30 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                  Report Card Designer
                  {isDirty && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      Unsaved Changes
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Centralized theme studio for Bright Path official student report cards.
                </CardDescription>
              </div>
            </div>

            {/* Action Buttons: Reset & Save */}
            <div className="flex items-center gap-2">
              {isNotDefault && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDesign}
                  disabled={isSaving}
                  className="gap-1.5 text-xs h-9 border-border text-foreground hover:bg-muted"
                  title="Reset to default Bright Path design"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Design
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleSaveDesign}
                disabled={isSaving || !isDirty || !isAuthorizedAdmin}
                className={`gap-1.5 text-xs h-9 font-semibold ${
                  isDirty
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-muted/40 text-muted-foreground'
                }`}
                variant={isDirty ? 'default' : 'outline'}
                title={
                  !isAuthorizedAdmin
                    ? 'Only authorized administrators can modify report card design'
                    : 'Save and activate this design for all report cards'
                }
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isDirty ? (
                  <Save className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
                {isSaving ? 'Saving...' : isDirty ? 'Save Design' : 'Active Design Saved'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {!isAuthorizedAdmin && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                You are viewing the report card design in preview mode. Only authorized school administrators can modify and save changes.
              </span>
            </div>
          )}

          {/* Design Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Background Color Control */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  1. Background Color
                </label>
                <span className="text-[11px] font-mono font-bold text-foreground uppercase">
                  {bgColor}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Applies to the entire page, tables, summary rows, and headers.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <input
                  ref={bgInputRef}
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  disabled={!isAuthorizedAdmin}
                  className="sr-only"
                  aria-label="Report card background color"
                />
                <button
                  type="button"
                  onClick={() => bgInputRef.current?.click()}
                  disabled={!isAuthorizedAdmin}
                  className="flex-1 flex items-center justify-between px-3.5 py-2 rounded-xl border border-border bg-white dark:bg-slate-900 hover:bg-muted/70 transition-all shadow-2xs group cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="text-xs font-semibold text-foreground">Pick Color</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg border border-border/80 shadow-inner flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: bgColor }}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Text Color Control */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  2. Text Color
                </label>
                <span className="text-[11px] font-mono font-bold text-foreground uppercase">
                  {textColor}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Applies to headings, subject names, marks, comments, and labels.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <input
                  ref={textInputRef}
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  disabled={!isAuthorizedAdmin}
                  className="sr-only"
                  aria-label="Report card text color"
                />
                <button
                  type="button"
                  onClick={() => textInputRef.current?.click()}
                  disabled={!isAuthorizedAdmin}
                  className="flex-1 flex items-center justify-between px-3.5 py-2 rounded-xl border border-border bg-white dark:bg-slate-900 hover:bg-muted/70 transition-all shadow-2xs group cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="text-xs font-semibold text-foreground">Pick Color</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-lg border border-border/80 shadow-inner flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: textColor }}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Border Radius Control */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-border/80 space-y-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  3. Border Radius
                </label>
                <span className="text-[11px] font-mono font-bold text-foreground">
                  {borderRadius}px
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Corner curvature for card boundaries (0px = crisp modern, 32px = curved).
              </p>
              <div className="pt-2 space-y-2">
                <input
                  type="range"
                  min="0"
                  max="32"
                  step="1"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                  disabled={!isAuthorizedAdmin}
                  className="w-full accent-primary cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Report card border radius"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>0px (Sharp)</span>
                  <span>16px</span>
                  <span>32px (Curved)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview Display Card */}
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/40">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">
                Live Interactive Preview
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewZoom((z) => Math.max(60, z - 10))}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono text-muted-foreground min-w-[42px] text-center">
                {previewZoom}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewZoom((z) => Math.min(130, z + 10))}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              {previewZoom !== 100 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewZoom(100)}
                  className="h-8 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  title="Reset Zoom"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-8 bg-slate-100/70 dark:bg-slate-950/60 overflow-x-auto flex justify-center">
          <div
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="w-full flex justify-center py-2"
          >
            <StudentReportCard
              card={previewCardData}
              allowSideToggle={true}
              showPrintStyles={false}
              className="shadow-md"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
