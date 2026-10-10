'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookMarked,
  Search,
  ExternalLink,
  FolderOpen,
  Filter,
} from 'lucide-react';
import { learningMaterialClientService, LearningMaterial } from '@/lib/homework-service';
import { Input } from '@/components/ui/input';

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

export default function ParentMaterialsPage() {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    const studentId = localStorage.getItem('parent_selected_student_id') || '';
    if (studentId) loadMaterials(studentId);
  }, []);

  const loadMaterials = async (studentId: string) => {
    setLoading(true);
    try {
      const data = await learningMaterialClientService.getStudentMaterials(studentId, {
        subjectId: selectedSubjectId || undefined,
      });
      setMaterials(data);
      const uniqueSubjects = Array.from(
        new Map(data.map((m) => [m.subjectId, m.subject])).values()
      ).filter(Boolean);
      setSubjects(uniqueSubjects as any[]);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = materials;
    if (selectedSubjectId) list = list.filter((m) => m.subjectId === selectedSubjectId);
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.subject?.name?.toLowerCase().includes(q)
    );
  }, [materials, selectedSubjectId, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, { subject: LearningMaterial['subject']; items: LearningMaterial[] }>();
    filtered.forEach((m) => {
      const key = m.subjectId;
      if (!map.has(key)) map.set(key, { subject: m.subject, items: [] });
      map.get(key)!.items.push(m);
    });
    return Array.from(map.values());
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookMarked className="w-6 h-6 text-violet-400" />
          Learning Materials
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Study resources shared by teachers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="bg-card border border-border rounded-xl text-sm px-3 py-2 text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">All Subjects</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Materials */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No learning materials found yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ subject, items }) => (
            <div key={subject?.id || 'unknown'}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: subject?.color || '#8b5cf6' }}
                />
                <h2 className="font-semibold text-foreground">{subject?.name || 'General'}</h2>
                <span className="text-muted-foreground text-sm">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((m) => (
                  <a
                    key={m.id}
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-primary/40 hover:bg-muted/30 transition-all group"
                  >
                    <div className="text-3xl flex-shrink-0">{getFileIcon(m.fileUrl, m.fileType)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                          {m.title}
                        </h3>
                        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                      </div>
                      {m.description && (
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{m.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        {m.fileType && <span className="uppercase">{m.fileType}</span>}
                        {m.fileSize && <span>· {formatSize(m.fileSize)}</span>}
                        <span>· {new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
