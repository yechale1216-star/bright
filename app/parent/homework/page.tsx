'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileText,
  Send,
  ChevronDown,
  Filter,
  Sparkles,
  Star,
} from 'lucide-react';
import { homeworkClientService, Homework } from '@/lib/homework-service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type TabType = 'pending' | 'submitted' | 'all';

export default function ParentHomeworkPage() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabType>('pending');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [submitItem, setSubmitItem] = useState<Homework | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    const sid = localStorage.getItem('parent_selected_student_id') || '';
    setStudentId(sid);
    if (sid) loadHomework(sid);
  }, []);

  const loadHomework = async (sid: string) => {
    setLoading(true);
    try {
      const data = await homeworkClientService.getStudentHomework(sid, {
        subjectId: selectedSubjectId || undefined,
      });
      setHomework(data);
      // Extract unique subjects
      const uniqueSubjects = Array.from(
        new Map(data.map((h) => [h.subjectId, h.subject])).values()
      ).filter(Boolean);
      setSubjects(uniqueSubjects as any[]);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) loadHomework(studentId);
  }, [selectedSubjectId]);

  const filtered = useMemo(() => {
    let list = homework;
    if (selectedSubjectId) list = list.filter((h) => h.subjectId === selectedSubjectId);
    if (tab === 'pending') return list.filter((h) => !h.isSubmitted);
    if (tab === 'submitted') return list.filter((h) => h.isSubmitted);
    return list;
  }, [homework, tab, selectedSubjectId]);

  const pendingCount = homework.filter((h) => !h.isSubmitted).length;
  const overdueCount = homework.filter((h) => h.isOverdue).length;

  const handleSubmit = async () => {
    if (!submitItem || !studentId) return;
    setSubmitting(true);
    try {
      await homeworkClientService.submitHomework(submitItem.id, studentId, {
        submissionText: submitText,
      });
      setSubmitItem(null);
      setSubmitText('');
      loadHomework(studentId);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const daysLabel = (dueDate: string) => {
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-red-400', bg: 'bg-red-500/10' };
    if (diff === 0) return { label: 'Due today', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    if (diff <= 2) return { label: `${diff}d left`, color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { label: `${diff}d left`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            Homework
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track and submit assignments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{homework.length}</p>
          <p className="text-muted-foreground text-xs mt-0.5">Total</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          <p className="text-amber-400/70 text-xs mt-0.5">Pending</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
          <p className="text-red-400/70 text-xs mt-0.5">Overdue</p>
        </div>
      </div>

      {/* Tabs + Subject Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
          {(['pending', 'submitted', 'all'] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
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

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{tab === 'pending' ? 'No pending homework! Great job.' : 'No homework found.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((hw) => {
            const due = daysLabel(hw.dueDate);
            return (
              <div
                key={hw.id}
                className="bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ backgroundColor: (hw.subject?.color || '#3b82f6') + '22', color: hw.subject?.color || '#3b82f6' }}
                      >
                        {hw.subject?.name || 'Unknown'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${due.bg} ${due.color}`}>
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {due.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">{hw.title}</h3>
                    {hw.description && <p className="text-muted-foreground text-sm mt-0.5 line-clamp-2">{hw.description}</p>}
                    <p className="text-muted-foreground text-xs mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due: {new Date(hw.dueDate).toLocaleDateString()}
                      <span className="ml-2">· Max: {hw.maxScore} pts</span>
                    </p>
                  </div>

                  {hw.isSubmitted ? (
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Submitted
                      </div>
                      {hw.submission?.status === 'GRADED' && (
                        <div className="mt-1">
                          <span className="text-lg font-bold text-foreground">{hw.submission.score}</span>
                          <span className="text-muted-foreground text-xs">/{hw.maxScore}</span>
                        </div>
                      )}
                      {hw.submission?.feedback && (
                        <p className="text-muted-foreground text-xs mt-1 max-w-[120px] text-right italic">
                          "{hw.submission.feedback}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => { setSubmitItem(hw); setSubmitText(''); }}
                      disabled={hw.isOverdue}
                      className="flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Submit
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Dialog */}
      <Dialog open={!!submitItem} onOpenChange={(v) => { if (!v) setSubmitItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Homework</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="font-medium text-foreground text-sm">{submitItem?.title}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {submitItem?.subject?.name} · Due {submitItem && new Date(submitItem.dueDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-sm mb-1 block">Your Answer / Notes</Label>
              <textarea
                value={submitText}
                onChange={(e) => setSubmitText(e.target.value)}
                rows={5}
                placeholder="Write your answer, notes, or describe what you've done..."
                className="w-full bg-card border border-border rounded-xl text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitItem(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-primary text-primary-foreground">
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : <Send className="w-4 h-4 mr-1" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
