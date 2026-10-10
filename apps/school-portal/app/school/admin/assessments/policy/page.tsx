'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  BarChart3,
  Copy,
  BookOpen,
  Info,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
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

// ─── Types ─────────────────────────────────────────────────────────────────
interface AssessmentType {
  id: string;
  name: string;
  code: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
}

interface SchemeCategory {
  id?: string;
  name: string;
  weight: number;
  typeId?: string | null;
  aggregationMethod?: 'COMBINED_MARKS' | 'AVERAGE_PERCENTAGE';
  orderIndex?: number;
}

interface WeightScheme {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isTemplate: boolean;
  isLocked: boolean;
  academicYear?: { id: string; name: string };
  categories: (SchemeCategory & { id: string; type?: { name: string; code: string } })[];
  assignments?: any[];
  _count?: { assessments: number };
}

// ─── Colors ────────────────────────────────────────────────────────────────
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#0ea5e9', '#f97316', '#14b8a6',
];

function WeightBar({ categories }: { categories: SchemeCategory[] }) {
  const total = categories.reduce((s, c) => s + Number(c.weight || 0), 0);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden w-full gap-px">
        {categories.map((cat, i) => (
          <div
            key={i}
            style={{
              width: `${(Number(cat.weight) / Math.max(total, 100)) * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            title={`${cat.name}: ${cat.weight}%`}
          />
        ))}
        {total < 100 && (
          <div style={{ width: `${100 - total}%`, backgroundColor: '#e5e7eb' }} title="Unallocated" />
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {categories.map((cat, i) => (
          <span key={i} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {cat.name} <span className="font-bold text-foreground">{cat.weight}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Assessment Policy Page ───────────────────────────────────────────
export default function AssessmentPolicyPage() {
  const [loading, setLoading] = useState(false);

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [schemes, setSchemes] = useState<WeightScheme[]>([]);

  // Assessment Type modal state
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeDesc, setTypeDesc] = useState('');

  // Scheme modal state
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [schemeName, setSchemeName] = useState('');
  const [schemeDesc, setSchemeDesc] = useState('');
  const [schemeIsDefault, setSchemeIsDefault] = useState(false);
  const [schemeIsTemplate, setSchemeIsTemplate] = useState(false);
  const [schemeYearId, setSchemeYearId] = useState('');
  const [schemeCategories, setSchemeCategories] = useState<SchemeCategory[]>([
    { name: 'Quizzes', weight: 10, aggregationMethod: 'COMBINED_MARKS' },
    { name: 'Assignments', weight: 10, aggregationMethod: 'COMBINED_MARKS' },
    { name: 'Tests', weight: 30, aggregationMethod: 'COMBINED_MARKS' },
    { name: 'Projects', weight: 10, aggregationMethod: 'COMBINED_MARKS' },
    { name: 'Final Exam', weight: 40, aggregationMethod: 'COMBINED_MARKS' },
  ]);

  const catWeightTotal = schemeCategories.reduce((s, c) => s + Number(c.weight || 0), 0);

  const refreshPolicy = useCallback(async () => {
    try {
      setLoading(true);
      const [typesJson, schemesJson] = await Promise.all([
        apiFetch('/api/assessment-policy/types'),
        apiFetch('/api/assessment-policy/schemes'),
      ]);
      setAssessmentTypes(typesJson.data || []);
      setSchemes(schemesJson.data || []);
    } catch (err: any) {
      notifications.error('Policy Load Error', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetadata = async () => {
    try {
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
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to load metadata');
    }
  };

  useEffect(() => {
    loadMetadata();
    refreshPolicy();
  }, [refreshPolicy]);

  // Type handlers
  const openTypeModal = (type?: AssessmentType) => {
    if (type) {
      setEditingTypeId(type.id);
      setTypeName(type.name);
      setTypeCode(type.code);
      setTypeDesc(type.description || '');
    } else {
      setEditingTypeId(null);
      setTypeName('');
      setTypeCode('');
      setTypeDesc('');
    }
    setTypeModalOpen(true);
  };

  const handleSaveType = async () => {
    if (!typeName.trim()) {
      notifications.error('Required', 'Type name is required');
      return;
    }
    try {
      if (editingTypeId) {
        await apiFetch(`/api/assessment-policy/types/${editingTypeId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: typeName, description: typeDesc }),
        });
        notifications.success('Updated', 'Assessment type updated');
      } else {
        await apiFetch('/api/assessment-policy/types', {
          method: 'POST',
          body: JSON.stringify({ name: typeName, code: typeCode, description: typeDesc }),
        });
        notifications.success('Created', 'Assessment type created');
      }
      setTypeModalOpen(false);
      refreshPolicy();
    } catch (err: any) {
      notifications.error('Error', err.message);
    }
  };

  const handleDeleteType = async (id: string, isSystem?: boolean) => {
    if (isSystem) {
      notifications.error('Protected', 'System assessment types cannot be deleted.');
      return;
    }
    if (!confirm('Delete this assessment type?')) return;
    try {
      const r = await apiFetch(`/api/assessment-policy/types/${id}`, { method: 'DELETE' });
      notifications.success(r.deactivated ? 'Deactivated' : 'Deleted', r.message);
      refreshPolicy();
    } catch (err: any) {
      notifications.error('Error', err.message);
    }
  };

  // Scheme handlers
  const openSchemeModal = (scheme?: WeightScheme) => {
    if (scheme) {
      setEditingSchemeId(scheme.id);
      setSchemeName(scheme.name);
      setSchemeDesc(scheme.description || '');
      setSchemeIsDefault(scheme.isDefault);
      setSchemeIsTemplate(scheme.isTemplate);
      setSchemeYearId(scheme.academicYear?.id || '');
      setSchemeCategories(
        scheme.categories.map((c) => ({
          name: c.name,
          weight: c.weight,
          typeId: c.typeId,
          aggregationMethod: c.aggregationMethod || 'COMBINED_MARKS',
        }))
      );
    } else {
      setEditingSchemeId(null);
      setSchemeName('');
      setSchemeDesc('');
      setSchemeIsDefault(false);
      setSchemeIsTemplate(false);
      setSchemeYearId('');
      setSchemeCategories([
        { name: 'Quizzes', weight: 10, aggregationMethod: 'COMBINED_MARKS' },
        { name: 'Assignments', weight: 10, aggregationMethod: 'COMBINED_MARKS' },
        { name: 'Tests', weight: 30, aggregationMethod: 'COMBINED_MARKS' },
        { name: 'Projects', weight: 10, aggregationMethod: 'COMBINED_MARKS' },
        { name: 'Final Exam', weight: 40, aggregationMethod: 'COMBINED_MARKS' },
      ]);
    }
    setSchemeModalOpen(true);
  };

  const addCategory = () =>
    setSchemeCategories([...schemeCategories, { name: '', weight: 0, aggregationMethod: 'COMBINED_MARKS' }]);
  const removeCategory = (i: number) =>
    setSchemeCategories(schemeCategories.filter((_, idx) => idx !== i));
  const updateCategory = (i: number, field: keyof SchemeCategory, value: any) => {
    const updated = [...schemeCategories];
    (updated[i] as any)[field] = value;
    setSchemeCategories(updated);
  };

  const handleSaveScheme = async () => {
    if (!schemeName.trim()) {
      notifications.error('Required', 'Policy scheme name is required');
      return;
    }
    if (Math.abs(catWeightTotal - 100) > 0.01) {
      notifications.error('Invalid Weights', `Category weights must total 100%. Current: ${catWeightTotal.toFixed(2)}%`);
      return;
    }
    const body = {
      name: schemeName,
      description: schemeDesc,
      isDefault: schemeIsDefault,
      isTemplate: schemeIsTemplate,
      academicYearId: schemeYearId || null,
      categories: schemeCategories.map((c, i) => ({ ...c, weight: Number(c.weight), orderIndex: i })),
    };
    try {
      if (editingSchemeId) {
        await apiFetch(`/api/assessment-policy/schemes/${editingSchemeId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        notifications.success('Updated', 'Assessment policy updated');
      } else {
        await apiFetch('/api/assessment-policy/schemes', { method: 'POST', body: JSON.stringify(body) });
        notifications.success('Created', 'Assessment policy created');
      }
      setSchemeModalOpen(false);
      refreshPolicy();
    } catch (err: any) {
      notifications.error('Error', err.message);
    }
  };

  const handleDeleteScheme = async (id: string, isLocked?: boolean) => {
    if (isLocked) {
      notifications.error('Locked', 'Cannot delete a locked scheme with published results.');
      return;
    }
    if (!confirm('Delete this assessment policy scheme?')) return;
    try {
      await apiFetch(`/api/assessment-policy/schemes/${id}`, { method: 'DELETE' });
      notifications.success('Deleted', 'Scheme removed');
      refreshPolicy();
    } catch (err: any) {
      notifications.error('Error', err.message);
    }
  };

  const handleSeedTypes = async () => {
    try {
      await apiFetch('/api/assessment-policy/types/seed', { method: 'POST' });
      notifications.success('Seeded', 'Default assessment types added');
      refreshPolicy();
    } catch (err: any) {
      notifications.error('Error', err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Assessment Policy Management</h1>
            <p className="text-sm text-muted-foreground">
              Configure institutional percentage-weighted assessment schemes (100% total) and assessment types.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/school/admin/assessments/bulk-assignment">
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs font-semibold"
            >
              <Layers className="w-4 h-4" />
              Bulk Assign Template
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={refreshPolicy} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Scope Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
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
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Strict 100% total weight validation enabled</span>
        </div>
      </div>

      {/* Assessment Policy Schemes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-semibold">Assessment Policy Schemes</h2>
            <span className="text-xs text-muted-foreground">({schemes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openSchemeModal()}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New Policy Scheme
            </Button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-300/30 flex items-start gap-2.5 text-xs text-purple-800 dark:text-purple-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Percentage-weighted schemes define how each assessment category contributes to the final subject score out of 100%. Category weights <strong>must total exactly 100%</strong>. Schemes can be assigned per grade, subject, or term. Use <strong>Bulk Assign Template</strong> to apply a policy across multiple grades and subjects simultaneously.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {schemes.length === 0 ? (
            <div className="col-span-full py-10 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
              No assessment policy schemes configured. Click "New Policy Scheme" to define your school's grading weights.
            </div>
          ) : (
            schemes.map((scheme) => (
              <div
                key={scheme.id}
                className={`p-5 rounded-2xl bg-card border transition-all hover:shadow-md ${
                  scheme.isLocked
                    ? 'border-amber-300/60'
                    : scheme.isDefault
                    ? 'border-indigo-400/50'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-foreground">{scheme.name}</h3>
                      {scheme.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-600">
                          Default
                        </span>
                      )}
                      {scheme.isTemplate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-600">
                          Template
                        </span>
                      )}
                      {scheme.isLocked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600">
                          🔒 Locked
                        </span>
                      )}
                    </div>
                    {scheme.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{scheme.description}</p>
                    )}
                    {scheme.academicYear && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Year: {scheme.academicYear.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      title="Duplicate Template"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/assessment-policy/schemes/${scheme.id}/duplicate`, { method: 'POST' });
                          notifications.success('Duplicated', `Created a copy of "${scheme.name}"`);
                          await refreshPolicy();
                        } catch (err: any) {
                          notifications.error('Error', err.message);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {!scheme.isLocked && (
                      <button
                        title="Edit Scheme"
                        onClick={() => openSchemeModal(scheme)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      title="Delete Scheme"
                      onClick={() => handleDeleteScheme(scheme.id, scheme.isLocked)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <WeightBar categories={scheme.categories} />
                </div>

                <div className="mt-3 space-y-1.5">
                  {scheme.categories.map((cat, i) => (
                    <div key={cat.id || i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {cat.aggregationMethod === 'AVERAGE_PERCENTAGE' ? 'Avg %' : 'Combined'}
                        </span>
                        <span className="font-bold text-foreground bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                          {cat.weight}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>{scheme._count?.assessments || 0} assessments linked</span>
                  <div className="flex items-center gap-2">
                    <span>{scheme.assignments?.length || 0} class assignments</span>
                    <Link href={`/school/admin/assessments/bulk-assignment?schemeId=${scheme.id}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2 gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 font-semibold"
                      >
                        <SlidersHorizontal className="w-3 h-3" /> Bulk Assign
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assessment Component Types Section */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold">Assessment Component Types</h2>
            <span className="text-xs text-muted-foreground">({assessmentTypes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedTypes} className="gap-1.5 h-8 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Seed Default Types
            </Button>
            <Button
              size="sm"
              onClick={() => openTypeModal()}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New Type
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assessmentTypes.map((type) => (
            <div
              key={type.id}
              className="p-3 rounded-xl bg-card border border-border shadow-2xs flex flex-col justify-between hover:border-indigo-400/50 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono text-[10px] text-muted-foreground font-semibold uppercase">{type.code}</span>
                  {type.isSystem && (
                    <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.2 rounded font-medium">
                      system
                    </span>
                  )}
                </div>
                <p className="font-semibold text-xs text-foreground leading-snug">{type.name}</p>
                {type.description && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{type.description}</p>
                )}
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-end gap-1">
                <button
                  onClick={() => openTypeModal(type)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[10px]"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                {!type.isSystem && (
                  <button
                    onClick={() => handleDeleteType(type.id, type.isSystem)}
                    className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 text-[10px]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MODALS ─────────────────────────────────────────────────────── */}

      {/* Assessment Type Modal */}
      <Dialog open={typeModalOpen} onOpenChange={setTypeModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              {editingTypeId ? 'Edit Assessment Type' : 'New Assessment Type'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Name *</Label>
              <Input
                placeholder="e.g. Oral Examination"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                className="mt-1"
              />
            </div>
            {!editingTypeId && (
              <div>
                <Label className="text-xs font-semibold">Code (auto-generated if blank)</Label>
                <Input
                  placeholder="e.g. ORAL_EXAM"
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  className="mt-1 font-mono"
                />
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                placeholder="Optional short description..."
                value={typeDesc}
                onChange={(e) => setTypeDesc(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveType} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingTypeId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheme Modal */}
      <Dialog open={schemeModalOpen} onOpenChange={setSchemeModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              {editingSchemeId ? 'Edit Assessment Policy Scheme' : 'New Assessment Policy Scheme'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Policy Name *</Label>
                <Input
                  placeholder="e.g. Standard Ethiopian Policy (100%)"
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Description</Label>
                <Input
                  placeholder="Short summary of this policy..."
                  value={schemeDesc}
                  onChange={(e) => setSchemeDesc(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Academic Year (optional)</Label>
                <select
                  value={schemeYearId}
                  onChange={(e) => setSchemeYearId(e.target.value)}
                  className="w-full h-9 px-2.5 mt-1 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Any Year (Template)</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-3 pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schemeIsDefault}
                    onChange={(e) => setSchemeIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span className="text-xs font-semibold">Set as Default Scheme</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schemeIsTemplate}
                    onChange={(e) => setSchemeIsTemplate(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600"
                  />
                  <span className="text-xs font-semibold">Mark as Reusable Template</span>
                </label>
              </div>
            </div>

            {/* Categories */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-xs font-semibold">Assessment Categories &amp; Weights</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Each category's weight as a percentage of the final score. Total must equal 100%.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addCategory} className="gap-1 h-7 text-xs">
                  <Plus className="w-3 h-3" />
                  Add Category
                </Button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 mb-1 px-2.5 text-[10px] font-semibold text-muted-foreground uppercase">
                <div className="col-span-4">Category Name</div>
                <div className="col-span-2">Weight</div>
                <div className="col-span-3">Linked Type</div>
                <div className="col-span-2">Aggregation</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-2">
                {schemeCategories.map((cat, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-muted/40 border border-border/60"
                  >
                    <div className="col-span-4">
                      <Input
                        placeholder="Category name"
                        value={cat.name}
                        onChange={(e) => updateCategory(i, 'name', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="Wt"
                          value={cat.weight}
                          onChange={(e) => updateCategory(i, 'weight', e.target.value)}
                          className="h-8 text-xs pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <select
                        value={cat.typeId || ''}
                        onChange={(e) => updateCategory(i, 'typeId', e.target.value || null)}
                        className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Any type</option>
                        {assessmentTypes
                          .filter((t) => t.isActive)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <select
                        value={cat.aggregationMethod || 'COMBINED_MARKS'}
                        onChange={(e) => updateCategory(i, 'aggregationMethod', e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="COMBINED_MARKS">Combined</option>
                        <option value="AVERAGE_PERCENTAGE">Average %</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        onClick={() => removeCategory(i)}
                        className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total indicator */}
              <div
                className={`mt-3 flex items-center gap-2 text-sm font-semibold ${
                  Math.abs(catWeightTotal - 100) < 0.01 ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {Math.abs(catWeightTotal - 100) < 0.01 ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                Total: {catWeightTotal.toFixed(2)}%{' '}
                {Math.abs(catWeightTotal - 100) < 0.01
                  ? '✓ Ready to save'
                  : `— needs ${(100 - catWeightTotal).toFixed(2)}% more`}
              </div>

              {/* Visual preview */}
              {schemeCategories.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-card border border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase">Weight Preview</p>
                  <WeightBar categories={schemeCategories} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSchemeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveScheme}
              disabled={Math.abs(catWeightTotal - 100) > 0.01}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {editingSchemeId ? 'Update Scheme' : 'Create Scheme'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
