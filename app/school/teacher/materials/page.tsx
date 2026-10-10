'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookMarked,
  Plus,
  Search,
  Trash2,
  Edit3,
  FileText,
  Download,
  ExternalLink,
  Save,
  FolderOpen,
  Filter,
} from 'lucide-react';
import { learningMaterialClientService, LearningMaterial } from '@/lib/homework-service';
import { getApiUrl } from '@/lib/api-config';
import { notifications } from '@/lib/utils/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  ppt: '📊',
  pptx: '📊',
  xls: '📈',
  xlsx: '📈',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  mp4: '🎬',
  mp3: '🎵',
  zip: '📦',
};

function getFileIcon(fileUrl: string, fileType?: string | null) {
  const ext = (fileType || fileUrl.split('.').pop() || '').toLowerCase();
  return FILE_ICONS[ext] || '📎';
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TeacherMaterialsPage() {
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<LearningMaterial | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    gradeId: '',
    fileUrl: '',
    fileType: '',
    fileSize: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const API_URL = getApiUrl();
    try {
      const [gradesRes, subjectsRes] = await Promise.all([
        fetch(`${API_URL}/api/schools/grades`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/settings/subjects`, { headers: getAuthHeaders() }),
      ]);
      if (gradesRes.ok) setGrades((await gradesRes.json()).data || []);
      if (subjectsRes.ok) setSubjects((await subjectsRes.json()).data || []);
    } catch {}
  };

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const data = await learningMaterialClientService.getAll({
        gradeId: selectedGradeId || undefined,
        subjectId: selectedSubjectId || undefined,
      });
      setMaterials(data);
    } catch {
      notifications.error('Error', 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMaterials(); }, [selectedGradeId, selectedSubjectId]);

  const filtered = useMemo(() => {
    if (!searchQuery) return materials;
    const q = searchQuery.toLowerCase();
    return materials.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.subject?.name?.toLowerCase().includes(q) ||
        m.grade?.name?.toLowerCase().includes(q)
    );
  }, [materials, searchQuery]);

  // Group by subject
  const grouped = useMemo(() => {
    const map = new Map<string, { subject: LearningMaterial['subject']; items: LearningMaterial[] }>();
    filtered.forEach((m) => {
      const key = m.subjectId;
      if (!map.has(key)) map.set(key, { subject: m.subject, items: [] });
      map.get(key)!.items.push(m);
    });
    return Array.from(map.values());
  }, [filtered]);

  const handleCreate = async () => {
    if (!form.title || !form.subjectId || !form.gradeId || !form.fileUrl) {
      notifications.error('Validation Error', 'Please fill required fields (title, subject, grade, file URL)');
      return;
    }
    try {
      await learningMaterialClientService.create({
        ...form,
        fileSize: form.fileSize ? Number(form.fileSize) : undefined,
      } as any);
      notifications.success('Success', 'Material added successfully!');
      setCreateOpen(false);
      resetForm();
      loadMaterials();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to add material');
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    try {
      await learningMaterialClientService.update(editItem.id, {
        ...form,
        fileSize: form.fileSize ? Number(form.fileSize) : undefined,
      } as any);
      notifications.success('Success', 'Material updated successfully!');
      setEditItem(null);
      resetForm();
      loadMaterials();
    } catch (e: any) {
      notifications.error('Error', e.message || 'Failed to update material');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    try {
      await learningMaterialClientService.delete(id);
      notifications.success('Success', 'Material deleted successfully');
      loadMaterials();
    } catch {
      notifications.error('Error', 'Failed to delete material');
    }
  };

  const openEdit = (m: LearningMaterial) => {
    setEditItem(m);
    setForm({
      title: m.title,
      description: m.description || '',
      subjectId: m.subjectId,
      gradeId: m.gradeId,
      fileUrl: m.fileUrl,
      fileType: m.fileType || '',
      fileSize: m.fileSize ? String(m.fileSize) : '',
    });
  };

  const resetForm = () => {
    setForm({ title: '', description: '', subjectId: '', gradeId: '', fileUrl: '', fileType: '', fileSize: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookMarked className="w-7 h-7 text-violet-400" />
            Learning Materials
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Upload and manage study resources for students</p>
        </div>
        <Button
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-2 rounded-xl shadow-lg shadow-violet-900/30"
        >
          <Plus className="w-4 h-4" />
          Add Material
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        <select
          value={selectedGradeId}
          onChange={(e) => setSelectedGradeId(e.target.value)}
          className="bg-white/10 border border-white/10 rounded-xl text-white text-sm px-3 py-2 focus:outline-none focus:border-violet-500"
        >
          <option value="">All Grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="bg-white/10 border border-white/10 rounded-xl text-white text-sm px-3 py-2 focus:outline-none focus:border-violet-500"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/10 border-white/10 text-white placeholder:text-slate-500 rounded-xl"
          />
        </div>
      </div>

      {/* Materials grouped by subject */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No materials found. Add some to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ subject, items }) => (
            <div key={subject?.id || 'unknown'}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subject?.color || '#8b5cf6' }}
                />
                <h2 className="text-white font-semibold">{subject?.name || 'Unknown Subject'}</h2>
                <span className="text-slate-500 text-sm">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-violet-500/40 hover:bg-white/8 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl flex-shrink-0">{getFileIcon(m.fileUrl, m.fileType)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm line-clamp-1">{m.title}</h3>
                        {m.description && <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{m.description}</p>}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                          <span>{m.grade?.name}</span>
                          {m.fileType && <span>· {m.fileType.toUpperCase()}</span>}
                          {m.fileSize && <span>· {formatSize(m.fileSize)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg py-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(m)}
                        className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(m.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen || !!editItem} onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditItem(null); } }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Material' : 'Add Learning Material'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Chapter 3 Notes"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="What this material covers..."
                className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Subject *</Label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-violet-500"
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">Grade *</Label>
                <select
                  value={form.gradeId}
                  onChange={(e) => setForm({ ...form, gradeId: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:border-violet-500"
                >
                  <option value="">Select grade</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">File URL *</Label>
              <Input
                value={form.fileUrl}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">File Type</Label>
                <Input
                  value={form.fileType}
                  onChange={(e) => setForm({ ...form, fileType: e.target.value })}
                  placeholder="pdf, docx, mp4..."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm mb-1 block">File Size (bytes)</Label>
                <Input
                  type="number"
                  value={form.fileSize}
                  onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
                  placeholder="Optional"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setEditItem(null); }} className="text-slate-400">Cancel</Button>
            <Button onClick={editItem ? handleUpdate : handleCreate} className="bg-violet-600 hover:bg-violet-500 text-white">
              <Save className="w-4 h-4 mr-1" />
              {editItem ? 'Update' : 'Add Material'}
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
    if (userStr) { const u = JSON.parse(userStr); userRole = u?.role || null; }
  } catch {}
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (schoolId) headers['x-school-id'] = schoolId;
  if (userRole) headers['x-requested-role'] = userRole;
  return headers;
}
