'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Eye,
  Check,
  Tag,
  Sliders,
  Calendar,
  UserCheck,
  AlertTriangle,
  Activity,
  Search,
  RotateCw,
  X,
  GraduationCap,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/utils';

import { DisciplineApi, StudentDiscipline } from '@/lib/discipline-service';
import { useLanguage } from '@/lib/context/language-context';
import { formatLocalizedDate } from '@/lib/utils/date-utils';

type FilterTab = 'ALL' | 'NEEDS_ACK' | 'ACTIVE' | 'RESOLVED';

export default function ParentDisciplinePage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [incidents, setIncidents] = useState<StudentDiscipline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<StudentDiscipline | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Active student state
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  // Acknowledgment Modal
  const [isAckModalOpen, setIsAckModalOpen] = useState(false);
  const [ackNotes, setAckNotes] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  // Evidence Preview
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);

  // Load current selected student from localStorage
  const loadActiveStudent = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const studentId = localStorage.getItem('parent_selected_student_id');
      const studentsStr = localStorage.getItem('parent_students');
      if (studentsStr) {
        const studentList = JSON.parse(studentsStr);
        if (Array.isArray(studentList) && studentList.length > 0) {
          const matched = studentId ? studentList.find((s: any) => s.id === studentId) : studentList[0];
          setSelectedStudent(matched || studentList[0]);
          return matched || studentList[0];
        }
      }
    } catch {
      // ignore parsing error
    }
    return null;
  }, []);

  const fetchParentIncidents = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const studentId = typeof window !== 'undefined' ? localStorage.getItem('parent_selected_student_id') : null;
      const params: Record<string, any> = { limit: 50 };
      if (studentId) {
        params.studentId = studentId;
      }
      const res = await DisciplineApi.getIncidents(params);
      setIncidents(res.items || []);
    } catch (err: any) {
      console.error('Failed to load discipline records:', err);
      toast.error(t('failed_to_load_discipline'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadActiveStudent();
    fetchParentIncidents();

    const handleStudentChanged = () => {
      loadActiveStudent();
      fetchParentIncidents();
    };

    window.addEventListener('studentChanged', handleStudentChanged);
    window.addEventListener('disciplineDataChanged', () => fetchParentIncidents());

    return () => {
      window.removeEventListener('studentChanged', handleStudentChanged);
      window.removeEventListener('disciplineDataChanged', () => fetchParentIncidents());
    };
  }, [loadActiveStudent, fetchParentIncidents]);

  const handleAcknowledgeSubmit = async () => {
    if (!selectedIncident) return;
    setIsSubmittingAck(true);
    try {
      const updated = await DisciplineApi.acknowledgeIncident(selectedIncident.id, ackNotes);
      setSelectedIncident(updated);
      toast.success(t('report_acknowledged_success'));
      setIsAckModalOpen(false);
      setAckNotes('');
      fetchParentIncidents();
    } catch (err: any) {
      toast.error(err.message || t('report_acknowledge_failed'));
    } finally {
      setIsSubmittingAck(false);
    }
  };

  const handleMessageTeacher = () => {
    router.push('/parent/communication');
  };

  const getCategoryLabel = (categoryName: string) => {
    if (!categoryName) return '';
    const norm = categoryName.trim().toLowerCase();
    if (norm.includes('late')) return t('cat_late_arrival');
    if (norm.includes('absence') || norm.includes('absent')) return t('cat_unexcused_absence');
    if (norm.includes('uniform')) return t('cat_uniform_violation');
    if (norm.includes('classroom') || norm.includes('misbehavior')) return t('cat_classroom_misbehavior');
    if (norm.includes('disrespect')) return t('cat_disrespect');
    if (norm.includes('bullying') || norm.includes('harass')) return t('cat_bullying');
    if (norm.includes('fighting') || norm.includes('conflict')) return t('cat_fighting');
    if (norm.includes('cheating') || norm.includes('academic')) return t('cat_cheating');
    if (norm.includes('phone') || norm.includes('tech')) return t('cat_phone_misuse');
    if (norm.includes('property') || norm.includes('damage')) return t('cat_property_damage');
    if (norm.includes('theft') || norm.includes('stole')) return t('cat_theft');
    if (norm.includes('smoking') || norm.includes('substance')) return t('cat_smoking');
    if (norm.includes('violence') || norm.includes('assault')) return t('cat_violence');
    if (norm.includes('other')) return t('cat_other');
    return categoryName;
  };

  const getActionLabel = (actionText: string) => {
    if (!actionText) return '';
    const norm = actionText.trim().toLowerCase();
    if (norm.includes('verbal warning')) return t('act_verbal_warning');
    if (norm.includes('written warning')) return t('act_written_warning');
    if (norm.includes('conference') || norm.includes('parent meeting') || norm.includes('meeting')) return t('act_parent_conference');
    if (norm.includes('counseling')) return t('act_counseling_session');
    if (norm.includes('restorative')) return t('act_restorative_task');
    if (norm.includes('behavioral plan') || norm.includes('behavior plan')) return t('act_behavioral_plan');
    if (norm.includes('detention')) return t('act_detention');
    if (norm.includes('in-school suspension')) return t('act_in_school_suspension');
    if (norm.includes('out-of-school suspension') || norm.includes('suspension')) return t('act_out_of_school_suspension');
    if (norm.includes('contract')) return t('act_behavior_contract');
    return actionText;
  };

  // Translate system-generated follow-up notes (stored in English in DB) to current language
  const translateFollowUpNote = (note: string): string => {
    if (language === 'en' || !note) return note;

    let result = note;

    const statusMap: Record<string, string> = {
      'OPEN': 'ክፍት',
      'UNDER_REVIEW': 'በግምገማ ላይ',
      'INVESTIGATION': 'በምርመራ ላይ',
      'ACTION_REQUIRED': 'እርምጃ ያስፈልገዋል',
      'RESOLVED': 'የተፈታ',
      'CLOSED': 'የተዘጋ',
    };

    const severityMap: Record<string, string> = {
      'LOW': 'ዝቅተኛ',
      'MEDIUM': 'መካከለኛ',
      'HIGH': 'ከፍተኛ',
      'CRITICAL': 'አስቸኳይ/ወሳኝ',
    };

    const actionMap: Record<string, string> = {
      'Verbal Warning': 'የቃል ማስጠንቀቂያ',
      'Written Warning': 'የጽሑፍ ማስጠንቀቂያ',
      'Parent Conference': 'የወላጅ ውይይት / ስብሰባ',
      'Parent Meeting': 'የወላጅ ስብሰባ',
      'Counseling Session': 'የምክር እና የሥነ-ልቦና ድጋፍ',
      'Restorative Task': 'የማስተካከያ አገልግሎት',
      'Behavioral Plan': 'የባህሪ ማሻሻያ እቅድ',
      'Behavior Plan': 'የባህሪ ማሻሻያ እቅድ',
      'Detention': 'ከትምህርት በኋላ ማቆየት',
      'In-School Suspension': 'በትምህርት ቤት ውስጥ እገዳ',
      'Out-of-School Suspension': 'ከትምህርት ቤት ጊዜያዊ እገዳ',
      'Behavior Contract': 'የባህሪ ስምምነት ውል',
      'Behaviour Contract': 'የባህሪ ስምምነት ውል',
    };

    result = result.replace(
      /Case (#[\w-]+) created with status (\w+) and severity (\w+)\./i,
      (_, caseNum, status, sev) =>
        `ጉዳይ ${caseNum} ሁኔታ ${statusMap[status.toUpperCase()] ?? status} እና ክብደት ${severityMap[sev.toUpperCase()] ?? sev} ሆኖ ተፈጥሯል።`
    );

    result = result.replace(
      /Updated incident status to (\w+) and severity to (\w+)\./i,
      (_, status, sev) =>
        `የክስተቱ ሁኔታ ወደ ${statusMap[status.toUpperCase()] ?? status} እና ክብደት ወደ ${severityMap[sev.toUpperCase()] ?? sev} ተቀይሯል።`
    );

    result = result.replace(
      /Updated incident status to (\w+)\./i,
      (_, status) =>
        `የክስተቱ ሁኔታ ወደ ${statusMap[status.toUpperCase()] ?? status} ተቀይሯል።`
    );

    result = result.replace(
      /Updated severity to (\w+)\./i,
      (_, sev) =>
        `ክብደቱ ወደ ${severityMap[sev.toUpperCase()] ?? sev} ተቀይሯል።`
    );

    result = result.replace(
      /Disciplinary Action set: (.+?)\./i,
      (_, action) => {
        const actionKey = Object.keys(actionMap).find(k =>
          action.trim().toLowerCase().includes(k.toLowerCase())
        );
        const translatedAction = actionKey ? actionMap[actionKey] : action.trim();
        return `የሥነ-ምግባር እርምጃ ተወስኗል: ${translatedAction}።`;
      }
    );

    result = result.replace(/Disciplinary Action removed\./i, 'የሥነ-ምግባር እርምጃ ተሰርዟል።');
    result = result.replace(/Assigned to (.+?)\./i, (_, name) => `ለ${name} ተመድቧል።`);
    result = result.replace(/Investigation updated\. Findings: (.+?)\./i, (_, findings) => `ምርመራ ተካሂዷል። ውጤት: ${findings}።`);
    result = result.replace(/Incident resolved\./i, 'ጉዳዩ ተፈቷል።');
    result = result.replace(/Incident closed\./i, 'ጉዳዩ ተዘግቷል።');
    result = result.replace(/Note added\./i, 'ማስታወሻ ታክሏል።');
    result = result.replace(/Parent acknowledged this report\./i, 'ወላጅ ሪፖርቱን አረጋግጠዋል።');

    return result;
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'LOW':
        return { label: t('severity_low'), cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' };
      case 'MEDIUM':
        return { label: t('severity_medium'), cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25', dot: 'bg-amber-500' };
      case 'HIGH':
        return { label: t('severity_high'), cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25', dot: 'bg-rose-500' };
      case 'CRITICAL':
        return { label: t('severity_critical'), cls: 'bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30 animate-pulse', dot: 'bg-red-600' };
      default:
        return { label: severity, cls: 'bg-slate-500/10 text-slate-600 border-slate-500/20', dot: 'bg-slate-500' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return { label: t('status_open'), cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' };
      case 'UNDER_REVIEW':
        return { label: t('status_under_review'), cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' };
      case 'INVESTIGATION':
        return { label: t('status_investigation'), cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25' };
      case 'ACTION_REQUIRED':
        return { label: t('status_action_required'), cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25' };
      case 'RESOLVED':
        return { label: t('status_resolved'), cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' };
      case 'CLOSED':
        return { label: t('status_closed'), cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
      default:
        return { label: status, cls: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
    }
  };

  const GlassBadge = ({ cfg }: { cfg: { label: string; cls: string; dot?: string } }) => (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl text-[10px] sm:text-[11px] font-bold border backdrop-blur-sm shrink-0 max-w-full min-w-0', cfg.cls)}>
      {cfg.dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />}
      <span className="truncate min-w-0">{cfg.label}</span>
    </span>
  );

  // Derived counts
  const totalReports = incidents.length;
  const needsAckReports = useMemo(() => incidents.filter(i => !i.parentAcknowledged).length, [incidents]);
  const openReports = useMemo(() => incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER_REVIEW' || i.status === 'ACTION_REQUIRED' || i.status === 'INVESTIGATION').length, [incidents]);
  const resolvedReports = useMemo(() => incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length, [incidents]);

  // Filtered incidents based on activeTab and searchQuery
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Tab filter
      if (activeTab === 'NEEDS_ACK' && inc.parentAcknowledged) return false;
      if (activeTab === 'ACTIVE' && !(inc.status === 'OPEN' || inc.status === 'UNDER_REVIEW' || inc.status === 'ACTION_REQUIRED' || inc.status === 'INVESTIGATION')) return false;
      if (activeTab === 'RESOLVED' && !(inc.status === 'RESOLVED' || inc.status === 'CLOSED')) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = inc.title?.toLowerCase().includes(query);
        const matchCase = inc.caseNumber?.toLowerCase().includes(query);
        const matchCategory = inc.categoryName?.toLowerCase().includes(query);
        const matchDesc = inc.description?.toLowerCase().includes(query);
        const matchAction = inc.approvedAction?.toLowerCase().includes(query) || inc.immediateAction?.toLowerCase().includes(query);
        if (!matchTitle && !matchCase && !matchCategory && !matchDesc && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, activeTab, searchQuery]);

  return (
    <div className="relative space-y-4 sm:space-y-6 w-full max-w-6xl mx-auto pb-24 md:pb-8 box-border">

      {/* ── Ambient Background Blur (Contain overflow to prevent mobile scrollbar jank) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 w-full max-w-full">
        <div className="absolute top-10 -left-10 w-72 sm:w-80 h-72 sm:h-80 bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -right-10 w-72 sm:w-80 h-72 sm:h-80 bg-rose-500/10 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 left-1/3 w-72 sm:w-80 h-72 sm:h-80 bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      {/* ── Frosted Glass Mobile-First Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-[20px] sm:rounded-[28px] border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-3.5 sm:p-6 md:p-8 shadow-xl shadow-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 w-full max-w-full box-border"
      >
        {/* Subtle decorative shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        <div className="flex items-center gap-3 sm:gap-4 z-10 min-w-0 w-full sm:w-auto">
          <div className="p-2 sm:p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 shrink-0">
            <ShieldAlert className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-base sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white break-words">
                {t('student_discipline_title')}
              </h1>
              {selectedStudent && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0 max-w-[150px] truncate">
                  <GraduationCap className="w-3 h-3 shrink-0" />
                  <span className="truncate">{selectedStudent.fullName}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 break-words line-clamp-2 sm:line-clamp-none">
              {t('discipline_subtitle')}
            </p>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto z-10 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-border/40">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchParentIncidents(true)}
            disabled={isRefreshing}
            className="h-10 px-3 rounded-2xl border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm text-slate-700 dark:text-slate-200 active:scale-95 transition-all gap-1.5 shrink-0"
            title={t('refresh')}
          >
            <RotateCw className={cn("w-3.5 h-3.5 shrink-0", isRefreshing && "animate-spin text-indigo-500")} />
            <span className="text-xs font-bold hidden xs:inline">{t('refresh')}</span>
          </Button>

          <Button
            onClick={handleMessageTeacher}
            className="h-10 px-3.5 sm:px-5 rounded-2xl gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 active:scale-95 transition-all border border-white/20 flex-1 sm:flex-initial min-w-0"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('message_homeroom_teacher')}</span>
          </Button>
        </div>
      </motion.div>

      {/* ── Mobile-First KPI Glanceable Metrics (1 card per row) ── */}
      <div className="grid grid-cols-1 gap-2.5 w-full max-w-full">
        {[
          {
            label: t('total_discipline_reports'),
            value: totalReports,
            icon: <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-500/10 border-indigo-500/20',
            hoverBorder: 'hover:border-indigo-500/30',
            activeTabTarget: 'ALL' as FilterTab,
            isActive: activeTab === 'ALL',
            delay: 0.05,
          },
          {
            label: t('open_cases'),
            value: openReports,
            color: 'text-amber-600 dark:text-amber-400',
            icon: <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
            bg: 'bg-amber-500/10 border-amber-500/20',
            hoverBorder: 'hover:border-amber-500/30',
            activeTabTarget: 'ACTIVE' as FilterTab,
            isActive: activeTab === 'ACTIVE',
            delay: 0.1,
          },
          {
            label: t('resolved_cases'),
            value: resolvedReports,
            color: 'text-emerald-600 dark:text-emerald-400',
            icon: <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />,
            bg: 'bg-emerald-500/10 border-emerald-500/20',
            hoverBorder: 'hover:border-emerald-500/30',
            activeTabTarget: 'RESOLVED' as FilterTab,
            isActive: activeTab === 'RESOLVED',
            delay: 0.15,
          },
        ].map((card, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => setActiveTab(card.activeTabTarget)}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: card.delay }}
            className={cn(
              'group text-left rounded-2xl border px-4 py-3.5 backdrop-blur-xl shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] w-full min-w-0 box-border relative overflow-hidden flex items-center gap-3',
              card.isActive
                ? 'bg-white dark:bg-slate-800 border-primary shadow-md shadow-primary/5 ring-2 ring-primary/20'
                : 'bg-white/70 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs',
              card.hoverBorder
            )}
          >
            {/* Left: icon */}
            <span className={cn('p-2.5 rounded-xl border shrink-0', card.bg, card.color)}>
              {card.icon}
            </span>
            {/* Middle: label */}
            <p className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-300 truncate min-w-0">
              {card.label}
            </p>
            {/* Right: value */}
            <span className={cn('text-2xl font-black tracking-tight shrink-0', card.color)}>
              {isLoading ? '—' : card.value}
            </span>
          </motion.button>
        ))}
      </div>

      {/* ── 3. Search & Horizontally Scrollable Pills (Matching Announcement Page) ── */}
      <div className="space-y-2.5 w-full max-w-full min-w-0">
        {/* Search Bar */}
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
          <Input
            type="text"
            placeholder={t('search_discipline_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 rounded-2xl h-11 text-xs sm:text-sm shadow-xs focus-visible:ring-indigo-500/20 w-full min-w-0 truncate"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 overscroll-contain w-full max-w-full min-w-0">
          {[
            { id: 'ALL' as FilterTab, label: t('filter_all'), count: totalReports, icon: Filter },
            { id: 'NEEDS_ACK' as FilterTab, label: t('filter_needs_ack'), count: needsAckReports, icon: AlertTriangle, highlightBadge: needsAckReports > 0 },
            { id: 'ACTIVE' as FilterTab, label: t('filter_active'), count: openReports, icon: Clock },
            { id: 'RESOLVED' as FilterTab, label: t('filter_resolved'), count: resolvedReports, icon: CheckCircle2 },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer active:scale-95",
                  isSelected
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 font-black"
                    : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                )}
              >
                <TabIcon className="w-3 h-3 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                    isSelected
                      ? "bg-white/20 text-white"
                      : tab.highlightBadge
                      ? "bg-rose-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Glass Incident Timeline List ── */}
      <div className="rounded-[20px] sm:rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-xl shadow-slate-900/5 overflow-hidden w-full max-w-full min-w-0 box-border">
        {/* List Header */}
        <div className="px-3.5 sm:px-6 py-3.5 sm:py-4 border-b border-white/40 dark:border-white/10 bg-slate-50/40 dark:bg-slate-950/40 flex items-center justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Activity className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-xs sm:text-sm uppercase tracking-widest text-slate-900 dark:text-white truncate">
                {t('discipline_history_timeline')}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {selectedStudent?.fullName ? `${selectedStudent.fullName} • ` : ''}{t('all_reports_for_child')}
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-slate-400 shrink-0">
            {filteredIncidents.length} {filteredIncidents.length === 1 ? 'report' : 'reports'}
          </span>
        </div>

        <div className="p-3 sm:p-5 md:p-6 w-full max-w-full min-w-0 box-border">
          {isLoading ? (
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-white/40 dark:bg-slate-800/40 rounded-[20px] animate-pulse" />
              ))}
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12 sm:py-16 space-y-3">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {searchQuery || activeTab !== 'ALL' ? 'No matching reports found' : t('no_discipline_incidents')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium px-4 break-words">
                {searchQuery || activeTab !== 'ALL'
                  ? 'Try clearing your search query or selecting a different filter tab.'
                  : t('no_discipline_incidents_desc')}
              </p>
              {(searchQuery || activeTab !== 'ALL') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSearchQuery(''); setActiveTab('ALL'); }}
                  className="rounded-xl text-xs font-bold border-white/40 dark:border-white/10"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4 w-full max-w-full min-w-0">
              {filteredIncidents.map((inc, idx) => {
                const sevCfg = getSeverityConfig(inc.severity);
                const staCfg = getStatusConfig(inc.status);
                const needsAck = !inc.parentAcknowledged;

                return (
                  <motion.div
                    key={inc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className={cn(
                      'group relative rounded-[18px] sm:rounded-[20px] border backdrop-blur-xl p-3.5 sm:p-5 transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 w-full max-w-full min-w-0 box-border',
                      needsAck
                        ? 'border-amber-500/40 bg-amber-500/[0.03] dark:bg-amber-500/[0.02] shadow-amber-500/5'
                        : 'border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/40 hover:border-indigo-500/30 hover:shadow-md'
                    )}
                  >
                    {/* Left content */}
                    <div className="space-y-2 flex-1 min-w-0 w-full">
                      {/* Badges row with wrap safety */}
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
                        <span className="font-mono text-[10px] sm:text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-xl backdrop-blur-sm shrink-0">
                          #{inc.caseNumber || inc.id.slice(0, 8)}
                        </span>
                        <GlassBadge cfg={sevCfg} />
                        <GlassBadge cfg={staCfg} />
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/8 border border-indigo-500/20 px-2 py-0.5 rounded-xl backdrop-blur-sm shrink-0 max-w-full min-w-0">
                          <Tag className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[140px] sm:max-w-none min-w-0">{getCategoryLabel(inc.categoryName)}</span>
                        </span>
                        {needsAck && (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-xl backdrop-blur-sm shrink-0 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="truncate">{t('filter_needs_ack')}</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Date Metadata */}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug break-words overflow-hidden">
                          {inc.title}
                        </h3>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                          <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                          <span>{formatLocalizedDate(inc.date, language)}</span>
                          {inc.time && <span>• {inc.time}</span>}
                          {inc.reportedByName && <span>• {t('reported_for', { name: inc.student?.fullName || '', date: '', time: '', reporter: inc.reportedByName }).replace(/^[^\w]+/, '')}</span>}
                        </p>
                      </div>

                      {/* Description Preview */}
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed break-words overflow-hidden">
                        {inc.description}
                      </p>

                      {/* Official Action Tag */}
                      {(inc.approvedAction || inc.immediateAction) && (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-xl backdrop-blur-sm max-w-full min-w-0">
                          <Sliders className="w-3 h-3 shrink-0" />
                          <span className="truncate min-w-0">
                            {t('official_action_label')}: {getActionLabel(inc.approvedAction || inc.immediateAction || '')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons (Mobile-first stack on phone, inline flex on desktop) */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-white/40 dark:border-white/10 pt-3 md:pt-0">
                      {!inc.parentAcknowledged ? (
                        <Button
                          size="sm"
                          className="h-10 md:h-9 px-3.5 sm:px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-white/20 shadow-md shadow-emerald-500/20 active:scale-95 transition-all gap-1 justify-center w-full sm:w-auto"
                          onClick={() => {
                            setSelectedIncident(inc);
                            setIsAckModalOpen(true);
                          }}
                        >
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t('acknowledge_report')}</span>
                        </Button>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1.5 h-10 md:h-9 px-3 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 backdrop-blur-sm w-full sm:w-auto">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t('acknowledged')}</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 md:h-9 px-3.5 sm:px-4 rounded-xl text-xs font-bold border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:border-indigo-500/30 hover:text-indigo-600 active:scale-95 transition-all gap-1 justify-center w-full sm:w-auto"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t('view_details')}</span>
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile-First Detail Modal (Scrollable Middle, Sticky Top & Bottom) ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[94vw] sm:max-w-2xl max-h-[88dvh] flex flex-col p-0 overflow-hidden rounded-[20px] sm:rounded-[28px] bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-2xl box-border"
        >
          {selectedIncident && (
            <>
              {/* Sticky Modal Header */}
              <div className="p-3.5 sm:p-6 pb-3 border-b border-white/30 dark:border-white/10 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-start justify-between gap-3 min-w-0">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] sm:text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-xl shrink-0">
                      #{selectedIncident.caseNumber || selectedIncident.id.slice(0, 8)}
                    </span>
                    <GlassBadge cfg={getSeverityConfig(selectedIncident.severity)} />
                    <GlassBadge cfg={getStatusConfig(selectedIncident.status)} />
                  </div>
                  <DialogTitle className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight break-words">
                    {selectedIncident.title}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium break-words">
                    {t('child_label')}: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedIncident.student?.fullName}</span> | {t('date_label')}: {formatLocalizedDate(selectedIncident.date, language)}
                  </DialogDescription>
                </div>

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Smooth Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-3 sm:space-y-4 min-w-0">
                {/* Category & Disciplinary Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-3.5 sm:p-4 rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      {t('incident_category_label')}
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm break-words">
                      {getCategoryLabel(selectedIncident.categoryName)}
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      {t('disciplinary_action_label')}
                    </span>
                    <span className="font-bold text-purple-600 dark:text-purple-400 text-xs sm:text-sm break-words">
                      {selectedIncident.approvedAction
                        ? getActionLabel(selectedIncident.approvedAction)
                        : selectedIncident.immediateAction
                        ? getActionLabel(selectedIncident.immediateAction)
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Description Box */}
                <div className="p-3.5 sm:p-4 rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md space-y-1.5 min-w-0">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {t('incident_description')}
                  </h4>
                  <p className="text-xs sm:text-sm leading-relaxed font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                    {selectedIncident.description}
                  </p>
                </div>

                {/* Action Taken by School Banner */}
                {(selectedIncident.approvedAction || selectedIncident.immediateAction) && (
                  <div className="p-3.5 sm:p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-md space-y-1 min-w-0">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                      {t('action_taken_by_school')}
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300 break-words">
                      {getActionLabel(selectedIncident.approvedAction || selectedIncident.immediateAction || '')}
                    </p>
                  </div>
                )}

                {/* Evidence Attachments */}
                {selectedIncident.evidence && Array.isArray(selectedIncident.evidence) && selectedIncident.evidence.length > 0 && (
                  <div className="space-y-2 min-w-0">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {t('evidence_files', { count: selectedIncident.evidence.length })}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedIncident.evidence.map((att: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewAttachment(att)}
                          className="p-3 rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 hover:border-indigo-500/30 cursor-pointer flex items-center gap-2 text-xs font-bold backdrop-blur-sm transition-all active:scale-98 min-w-0"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate flex-1 min-w-0">{att.name}</span>
                          <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-ups Timeline */}
                {selectedIncident.followUps && selectedIncident.followUps.length > 0 && (
                  <div className="space-y-2 min-w-0">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {t('teacher_notes_updates')}
                    </h4>
                    <div className="relative pl-4 sm:pl-5 border-l-2 border-indigo-500/30 space-y-3">
                      {selectedIncident.followUps.slice().reverse().map((fu) => (
                        <div key={fu.id} className="relative min-w-0">
                          <div className="absolute -left-[1.375rem] sm:-left-[1.625rem] top-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center">
                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white" />
                          </div>
                          <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md p-3 space-y-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {fu.authorName || t('staff')}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatLocalizedDate(fu.createdAt, language)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                              {translateFollowUpNote(fu.note)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Action Footer */}
              <div className="p-3 sm:p-4 border-t border-white/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={handleMessageTeacher}
                  className="h-10 rounded-xl font-bold text-xs border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm gap-1.5 justify-center"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{t('message_homeroom_teacher')}</span>
                </Button>

                {!selectedIncident.parentAcknowledged && (
                  <Button
                    onClick={() => {
                      setIsDetailOpen(false);
                      setIsAckModalOpen(true);
                    }}
                    className="h-10 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{t('acknowledge_report')}</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Mobile-First Acknowledge Modal ── */}
      <Dialog open={isAckModalOpen} onOpenChange={setIsAckModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 md:p-8 bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-2xl box-border">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                {t('acknowledge_discipline_report')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('acknowledge_modal_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={t('optional_message_placeholder')}
              rows={3}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              className="rounded-xl text-xs font-medium bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsAckModalOpen(false)}
              className="h-10 rounded-xl font-bold text-xs justify-center"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleAcknowledgeSubmit}
              disabled={isSubmittingAck}
              className="h-10 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 justify-center"
            >
              {isSubmittingAck ? '...' : t('confirm_acknowledgment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Evidence Preview Modal ── */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88dvh] overflow-y-auto rounded-[24px] p-4 sm:p-6 bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {previewAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {previewAttachment?.type?.startsWith('image/') ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-[60vh] mx-auto rounded-xl object-contain shadow-lg"
              />
            ) : previewAttachment?.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-h-[60vh] w-full rounded-xl" />
            ) : (
              <iframe
                src={previewAttachment?.url}
                className="w-full h-[55vh] rounded-xl border border-white/30"
                title={previewAttachment?.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
