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
  Sparkles,
  Search,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { homeworkClientService, Homework } from '@/lib/homework-service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notifications } from '@/lib/utils/notifications';

type TabType = 'all' | 'pending' | 'submitted';

export default function StudentHomeworkPage() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabType>('pending');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitItem, setSubmitItem] = useState<Homework | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('attendance_current_user');
      if (stored) {
        const user = JSON.parse(stored);
        const sid = user?.id || user?.student_id || user?.studentId || '';
        setStudentId(sid);
        if (sid) {
          loadHomework(sid);
        }
      }
    } catch (e) {
      console.error('Failed to parse user session for homework:', e);
    }
  }, []);

  const loadHomework = async (sid: string) => {
    setLoading(true);
    try {
      const data = await homeworkClientService.getStudentHomework(sid, {
        subjectId: selectedSubjectId || undefined,
      });
      setHomework(data || []);
      const uniqueSubjects = Array.from(
        new Map((data || []).map((h) => [h.subjectId, { id: h.subjectId, name: h.subject }])).values()
      ).filter((s) => s.id && s.name);
      setSubjects(uniqueSubjects);
    } catch (err: any) {
      console.error('Failed to load student homework:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      loadHomework(studentId);
    }
  }, [selectedSubjectId]);

  const filteredList = useMemo(() => {
    let list = homework;
    if (selectedSubjectId) {
      list = list.filter((h) => h.subjectId === selectedSubjectId);
    }
    if (tab === 'pending') {
      list = list.filter((h) => !h.isSubmitted);
    } else if (tab === 'submitted') {
      list = list.filter((h) => h.isSubmitted);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          (h.description && h.description.toLowerCase().includes(q)) ||
          (h.subject?.name?.toLowerCase().includes(q) || false)
      );
    }
    return list;
  }, [homework, tab, selectedSubjectId, searchQuery]);

  const pendingCount = homework.filter((h) => !h.isSubmitted).length;
  const submittedCount = homework.filter((h) => h.isSubmitted).length;

  const handleSubmit = async () => {
    if (!submitItem || !studentId) return;
    if (!submitText.trim()) {
      notifications.error('Required', 'Please enter your submission answer or notes.');
      return;
    }
    setSubmitting(true);
    try {
      await homeworkClientService.submitHomework(submitItem.id, studentId, {
        submissionText: submitText,
      });
      notifications.success('Submitted', 'Homework submitted successfully!');
      setSubmitItem(null);
      setSubmitText('');
      loadHomework(studentId);
    } catch (err: any) {
      notifications.error('Error', err?.message || 'Failed to submit homework.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDaysRemainingBadge = (dueDate: string) => {
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
    if (diff < 0) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">{Math.abs(diff)}d overdue</span>;
    }
    if (diff === 0) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">Due today</span>;
    }
    if (diff <= 2) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">{diff}d left</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{diff}d left</span>;
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Homework & Assignments</h1>
            <p className="text-sm text-muted-foreground">
              Review assigned homework, track deadlines, and submit answers online.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            {pendingCount} Pending
          </div>
        </div>
      </div>

      {/* Filter and Tab Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setTab('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'pending'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setTab('submitted')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'submitted'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            Submitted ({submittedCount})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({homework.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {subjects.length > 0 && (
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium"
            >
              <option value="">All Subjects</option>
              {subjects.map((sub: any) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search homework..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Homework List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
            Loading assignments...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
            {tab === 'pending'
              ? 'Great job! No pending homework assignments.'
              : 'No homework assignments found.'}
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {item.subject?.name || 'General'}
                  </span>
                  {item.dueDate && getDaysRemainingBadge(item.dueDate)}
                  {item.isSubmitted ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Submitted
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Action Required
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  {item.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Due: {new Date(item.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {item.maxScore && (
                    <span className="font-semibold text-foreground">Max: {item.maxScore} pts</span>
                  )}
                  {item.submission?.score !== undefined && item.submission?.score !== null && (
                    <span className="font-bold text-emerald-600">
                      Score: {item.submission.score} / {item.maxScore}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                {item.isSubmitted ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSubmitItem(item);
                      setSubmitText(item.submission?.submissionText || '');
                    }}
                    className="text-xs gap-1.5"
                  >
                    View Submission
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSubmitItem(item);
                      setSubmitText('');
                    }}
                    className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Answer
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submission Dialog */}
      <Dialog open={!!submitItem} onOpenChange={(open) => !open && setSubmitItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {submitItem?.isSubmitted ? 'Your Submission' : 'Submit Homework'}
            </DialogTitle>
          </DialogHeader>

          {submitItem && (
            <div className="space-y-4 py-2">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Assignment</span>
                <h4 className="font-bold text-foreground text-sm mt-0.5">{submitItem.title}</h4>
                {submitItem.description && (
                  <p className="text-xs text-muted-foreground mt-1 p-2.5 rounded-lg bg-muted/40">
                    {submitItem.description}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold">Your Solution / Response</Label>
                <Textarea
                  placeholder="Type your homework answer, explanation, or notes here..."
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  disabled={submitItem.isSubmitted}
                  rows={6}
                  className="mt-1 text-xs"
                />
              </div>

              {submitItem.submission?.feedback && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground space-y-1">
                  <span className="font-bold text-emerald-600">Teacher Feedback:</span>
                  <p className="text-muted-foreground">{submitItem.submission.feedback}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitItem(null)}>
              Close
            </Button>
            {submitItem && !submitItem.isSubmitted && (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
