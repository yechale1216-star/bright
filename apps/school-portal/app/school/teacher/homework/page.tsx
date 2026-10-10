'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit3,
  Eye,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  FileText,
  Calendar,
  X,
  Save,
  Star,
} from 'lucide-react';
import { homeworkClientService, Homework, HomeworkSubmission } from '@/lib/homework-service';
import { notifications } from '@/lib/utils/notifications';
import { getApiUrl } from '@/lib/api-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function TeacherHomeworkPage() {
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Homework | null>(null);
  const [submissionsItem, setSubmissionsItem] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<HomeworkSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    gradeId: '',
    sectionId: '',
    dueDate: '',
    maxScore: 100,
    status: 'PUBLISHED',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const API_URL = getApiUrl();
    try {
      const [gradesRes, subjectsRes] = await Promise.all([
        fetch(`${API_URL}/api/schools/grades`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_URL}/api/settings/subjects`, {
          headers: getAuthHeaders(),
        }),
      ]);
      if (gradesRes.ok) setGrades((await gradesRes.json()).data || []);
      if (subjectsRes.ok) setSubjects((await subjectsRes.json()).data || []);
    } catch {}
  };

  const loadSections = async (gradeId: string) => {
    // Sections come embedded in the grade object from schools/grades
    // try to get them from the already-loaded grades list first
    const grade = grades.find((g) => g.id === gradeId);
    if (grade?.sections && Array.isArray(grade.sections)) {
      setSections(grade.sections);
      return;
    }
    // fallback: fetch directly
    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/api/schools/sections?gradeId=${gradeId}`, { headers: getAuthHeaders() });
      if (res.ok) setSections((await res.json()).data || []);
    } catch {}
  };

  const loadHomework = async () => {
    setLoading(true);
    try {
      const data = await homeworkClientService.getAll({
        gradeId: selectedGradeId || undefined,
        sectionId: selectedSectionId || undefined,
        subjectId: selectedSubjectId || undefined,
      });
      setHomework(data);
    } catch {
      notifications.error('Error', 'Failed to load homework');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomework();
  }, [selectedGradeId, selectedSectionId, selectedSubjectId]);

  useEffect(() => {
    if (selectedGradeId) loadSections(selectedGradeId);
    else setSections([]);
    setSelectedSectionId('');
  }, [selectedGradeId]);

  const filtered = useMemo(() => {
    if (!searchQuery) return homework;
    const q = searchQuery.toLowerCase();
    return homework.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.subject?.name?.toLowerCase().includes(q) ||
        h.grade?.name?.toLowerCase().includes(q)
    );
  }, [homework, searchQuery]);

  const handleCreate = async () => {
    if (!form.title || !form.subjectId || !form.gradeId || !form.dueDate) {
      notifications.error('Validation Error', 'Please fill all required fields');
      return;
    }
    try {
      await homeworkClientService.create({
        ...form,
        sectionId: form.sectionId || undefined,
        maxScore: Number(form.maxScore),
      } as any);
      notifications.success('Success', 'Homework created successfully!');
      setCreateOpen(false);
      resetForm();
      loadHomework();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to create homework');
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    try {
      await homeworkClientService.update(editItem.id, {
        ...form,
        sectionId: form.sectionId || undefined,
        maxScore: Number(form.maxScore),
      } as any);
      notifications.success('Success', 'Homework updated successfully!');
      setEditItem(null);
      resetForm();
      loadHomework();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to update homework');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this homework?')) return;
    try {
      await homeworkClientService.delete(id);
      notifications.success('Success', 'Homework deleted successfully');
      loadHomework();
    } catch {
      notifications.error('Error', 'Failed to delete homework');
    }
  };

  const openEdit = (hw: Homework) => {
    setEditItem(hw);
    setForm({
      title: hw.title,
      description: hw.description || '',
      subjectId: hw.subjectId,
      gradeId: hw.gradeId,
      sectionId: hw.sectionId || '',
      dueDate: hw.dueDate ? hw.dueDate.substring(0, 10) : '',
      maxScore: hw.maxScore,
      status: hw.status,
    });
  };

  const openSubmissions = async (hw: Homework) => {
    setSubmissionsItem(hw);
    try {
      const subs = await homeworkClientService.getSubmissions(hw.id);
      setSubmissions(subs);
    } catch {
      notifications.error('Error', 'Failed to load submissions');
    }
  };

  const handleGrade = async () => {
    if (!gradingSubmission) return;
    try {
      await homeworkClientService.gradeSubmission(gradingSubmission.id, {
        score: Number(gradeScore),
        feedback: gradeFeedback,
      });
      notifications.success('Success', 'Submission graded successfully!');
      setGradingSubmission(null);
      if (submissionsItem) openSubmissions(submissionsItem);
    } catch {
      notifications.error('Error', 'Failed to grade submission');
    }
  };

  const resetForm = () => {
    setForm({ title: '', description: '', subjectId: '', gradeId: '', sectionId: '', dueDate: '', maxScore: 100, status: 'PUBLISHED' });
  };

  const statusColor = (hw: Homework) => {
    if (new Date(hw.dueDate) < new Date()) return 'text-red-400';
    const daysLeft = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 2) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const daysUntilDue = (dueDate: string) => {
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Due today';
    return `${diff}d left`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-400" />
            Homework Manager
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Create, manage & grade homework assignments</p>
        </div>
        <Button
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 rounded-xl shadow-lg shadow-indigo-900/30"
        >
          <Plus className="w-4 h-4" />
          New Homework
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <select
          value={selectedGradeId}
          onChange={(e) => setSelectedGradeId(e.target.value)}
          className="col-span-1 bg-white/10 border border-white/10 rounded-xl text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select
          value={selectedSectionId}
          onChange={(e) => setSelectedSectionId(e.target.value)}
          disabled={!selectedGradeId}
          className="col-span-1 bg-white/10 border border-white/10 rounded-xl text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
        >
          <option value="">All Sections</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="col-span-1 bg-white/10 border border-white/10 rounded-xl text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="col-span-2 md:col-span-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search homework..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/10 border-white/10 text-white placeholder:text-slate-500 rounded-xl"
          />
        </div>
      </div>

      {/* Homework Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No homework found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((hw) => (
            <div
              key={hw.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-white/8 transition-all group"
            >
              {/* Subject tag */}
              <div className="flex items-start justify-between mb-3">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: (hw.subject?.color || '#3b82f6') + '22', color: hw.subject?.color || '#3b82f6' }}
                >
                  <FileText className="w-3 h-3" />
                  {hw.subject?.name || 'Unknown Subject'}
                </span>
                <span className={`text-xs font-medium ${hw.status === 'DRAFT' ? 'text-slate-400' : 'text-emerald-400'}`}>
                  {hw.status}
                </span>
              </div>

              <h3 className="font-semibold text-white text-base mb-1 line-clamp-1">{hw.title}</h3>
              <p className="text-slate-400 text-sm mb-3 line-clamp-2">{hw.description || 'No description'}</p>

              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                <span className="flex items-center gap-1 text-slate-400">
                  <Users className="w-3 h-3" />
                  {hw.grade?.name}{hw.section ? ` · ${hw.section.name}` : ''}
                </span>
                <span className={`flex items-center gap-1 font-medium ${statusColor(hw)}`}>
                  <Clock className="w-3 h-3" />
                  {daysUntilDue(hw.dueDate)}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <CheckCircle2 className="w-3 h-3" />
                  {hw._count?.submissions ?? 0} submitted
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-white/10">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openSubmissions(hw)}
                  className="flex-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" /> Submissions
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(hw)}
                  className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(hw.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen || !!editItem} onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditItem(null); } }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{editItem ? 'Edit Homework' : 'Create Homework'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Chapter 5 Problems"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Instructions or details..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Subject *</Label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Grade *</Label>
                <select
                  value={form.gradeId}
                  onChange={(e) => { setForm({ ...form, gradeId: e.target.value, sectionId: '' }); loadSections(e.target.value); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select grade</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Section</Label>
                <select
                  value={form.sectionId}
                  onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                  disabled={!form.gradeId}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                >
                  <option value="">All Sections</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Max Score</Label>
                <Input
                  type="number"
                  value={form.maxScore}
                  onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Due Date *</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setEditItem(null); }} className="text-slate-400 hover:text-white">
              Cancel
            </Button>
            <Button onClick={editItem ? handleUpdate : handleCreate} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              <Save className="w-4 h-4 mr-1" />
              {editItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions Dialog */}
      <Dialog open={!!submissionsItem} onOpenChange={(v) => { if (!v) { setSubmissionsItem(null); setSubmissions([]); } }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Submissions — {submissionsItem?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-96 overflow-y-auto">
            {submissions.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No submissions yet</p>
            ) : (
              submissions.map((sub) => (
                <div key={sub.id} className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{sub.student?.fullName || 'Unknown'}</p>
                    <p className="text-slate-400 text-xs">{sub.student?.student_id}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {new Date(sub.submittedAt).toLocaleDateString()} ·
                      <span className={`ml-1 font-medium ${sub.status === 'GRADED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {sub.status}
                      </span>
                      {sub.score != null && <span className="ml-2 text-indigo-400">{sub.score}/{submissionsItem?.maxScore}</span>}
                    </p>
                    {sub.feedback && <p className="text-slate-300 text-xs mt-1 italic">"{sub.feedback}"</p>}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => { setGradingSubmission(sub); setGradeScore(String(sub.score ?? '')); setGradeFeedback(sub.feedback || ''); }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg"
                  >
                    <Star className="w-3 h-3 mr-1" /> Grade
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={!!gradingSubmission} onOpenChange={(v) => { if (!v) setGradingSubmission(null); }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Grade Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">Score (max {submissionsItem?.maxScore})</Label>
              <Input
                type="number"
                value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)}
                placeholder="e.g. 85"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">Feedback</Label>
              <textarea
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                rows={3}
                placeholder="Optional feedback..."
                className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGradingSubmission(null)} className="text-slate-400">Cancel</Button>
            <Button onClick={handleGrade} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Submit Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  let userRole: string | null = null;
  try {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('attendance_current_user') : null;
    if (userStr) {
      const u = JSON.parse(userStr);
      userRole = u?.role || null;
    }
  } catch {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (schoolId) headers['x-school-id'] = schoolId;
  if (userRole) headers['x-requested-role'] = userRole;
  return headers;
}
