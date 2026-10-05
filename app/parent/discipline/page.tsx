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
  Calendar,
  UserCheck,
  AlertTriangle,
  Activity,
  Search,
  RotateCw,
  X,
  GraduationCap,
  Filter,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
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
          const student = matched || studentList[0];
          setSelectedStudent(student);
          return student;
        }
      }
    } catch {
      // ignore parsing error
    }
    return null;
  }, []);

  const fetchParentIncidents = useCallback(async (isManualRefresh = false, showLoading = true) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else if (showLoading) {
      setIsLoading(true);
    }

    try {
      const studentId = typeof window !== 'undefined' ? localStorage.getItem('parent_selected_student_id') : null;
      const params: Record<string, any> = { limit: 50 };
      if (studentId) {
        params.studentId = studentId;
      }
      const res = await DisciplineApi.getIncidents(params);
      if (res && Array.isArray(res.items)) {
        setIncidents(res.items);
      }
    } catch (err: any) {
      console.error('Failed to load discipline records:', err);
      setIncidents((current) => {
        if (current.length === 0) {
          toast.error(t('failed_to_load_discipline'));
        }
        return current;
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const student = loadActiveStudent();
    const studentId = student?.id || (typeof window !== 'undefined' ? localStorage.getItem('parent_selected_student_id') : null);

    // 0ms SWR instant hydration: if already cached, render immediately without waiting
    const cached = DisciplineApi.getCachedIncidents({ studentId: studentId || undefined, limit: 50 });
    const hasCachedData = Boolean(cached && Array.isArray(cached.items) && cached.items.length > 0);
    if (hasCachedData && cached) {
      setIncidents(cached.items);
      setIsLoading(false);
    }

    // Silent background revalidation (only show skeleton if we have zero data)
    fetchParentIncidents(false, !hasCachedData);

    const handleStudentChanged = () => {
      const s = loadActiveStudent();
      const sId = s?.id || (typeof window !== 'undefined' ? localStorage.getItem('parent_selected_student_id') : null);
      const c = DisciplineApi.getCachedIncidents({ studentId: sId || undefined, limit: 50 });
      const hasC = Boolean(c && Array.isArray(c.items) && c.items.length > 0);
      if (hasC && c) {
        setIncidents(c.items);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      fetchParentIncidents(false, !hasC);
    };

    const handleDisciplineChanged = () => {
      fetchParentIncidents(true, false);
    };

    window.addEventListener('studentChanged', handleStudentChanged);
    window.addEventListener('disciplineDataChanged', handleDisciplineChanged);

    return () => {
      window.removeEventListener('studentChanged', handleStudentChanged);
      window.removeEventListener('disciplineDataChanged', handleDisciplineChanged);
    };
  }, []);

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
        return { label: t('severity_low'), cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-500' };
      case 'MEDIUM':
        return { label: t('severity_medium'), cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', dot: 'bg-amber-500' };
      case 'HIGH':
        return { label: t('severity_high'), cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20', dot: 'bg-rose-500' };
      case 'CRITICAL':
        return { label: t('severity_critical'), cls: 'bg-red-600/10 text-red-700 dark:text-red-300 border-red-600/25', dot: 'bg-red-600' };
      default:
        return { label: severity, cls: 'bg-muted text-muted-foreground border-border/40', dot: 'bg-muted-foreground' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return { label: t('status_open'), cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' };
      case 'UNDER_REVIEW':
        return { label: t('status_under_review'), cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' };
      case 'INVESTIGATION':
        return { label: t('status_investigation'), cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' };
      case 'ACTION_REQUIRED':
        return { label: t('status_action_required'), cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20' };
      case 'RESOLVED':
        return { label: t('status_resolved'), cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' };
      case 'CLOSED':
        return { label: t('status_closed'), cls: 'bg-muted text-muted-foreground border-border/40' };
      default:
        return { label: status, cls: 'bg-muted text-muted-foreground border-border/40' };
    }
  };

  const StatusBadge = ({ cfg }: { cfg: { label: string; cls: string; dot?: string } }) => (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 max-w-full min-w-0', cfg.cls)}>
      {cfg.dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />}
      <span className="truncate min-w-0">{cfg.label}</span>
    </span>
  );
  const GlassBadge = StatusBadge;

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

      {/* ── Mobile-First Clean Header ── */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 w-full max-w-full box-border">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 w-full sm:w-auto">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground break-words">
                {t('student_discipline_title')}
              </h1>
              {selectedStudent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary text-secondary-foreground border border-border/40 shrink-0 max-w-[150px] truncate">
                  <GraduationCap className="w-3 h-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selectedStudent.fullName}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5 break-words line-clamp-2 sm:line-clamp-none">
              {t('discipline_subtitle')}
            </p>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-border/40">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchParentIncidents(true)}
            disabled={isRefreshing}
            className="h-9 px-3 rounded-xl border-border/60 bg-background text-foreground hover:bg-muted active:scale-95 transition-all gap-1.5 shrink-0"
            title={t('refresh')}
          >
            <RotateCw className={cn("w-3.5 h-3.5 shrink-0", isRefreshing && "animate-spin text-primary")} />
            <span className="text-xs font-semibold hidden xs:inline">{t('refresh')}</span>
          </Button>

          <Button
            onClick={handleMessageTeacher}
            className="h-9 px-3.5 rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs active:scale-95 transition-all flex-1 sm:flex-initial min-w-0"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('message_homeroom_teacher')}</span>
          </Button>
        </div>
      </div>

      {/* ── Android-First Glanceable Metric Cards (3-column native card grid) ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-full">
        {[
          {
            label: t('total_discipline_reports'),
            value: totalReports,
            icon: <ShieldAlert className="w-4 h-4 text-foreground/80" />,
            activeTabTarget: 'ALL' as FilterTab,
            isActive: activeTab === 'ALL',
          },
          {
            label: t('open_cases'),
            value: openReports,
            icon: <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
            activeTabTarget: 'ACTIVE' as FilterTab,
            isActive: activeTab === 'ACTIVE',
          },
          {
            label: t('resolved_cases'),
            value: resolvedReports,
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
            activeTabTarget: 'RESOLVED' as FilterTab,
            isActive: activeTab === 'RESOLVED',
          },
        ].map((card, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab(card.activeTabTarget)}
            className={cn(
              'group text-left rounded-2xl border p-3 sm:p-4 transition-all duration-150 cursor-pointer active:scale-[0.96] w-full min-w-0 box-border flex flex-col justify-between min-h-[96px] sm:min-h-[104px]',
              card.isActive
                ? 'bg-primary/[0.04] dark:bg-primary/[0.08] border-primary text-foreground shadow-xs ring-1 ring-primary/30'
                : 'bg-card border-border/60 hover:border-border text-foreground hover:bg-muted/30 shadow-xs'
            )}
          >
            {/* Top row: Icon */}
            <div className="flex items-center justify-between w-full">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-muted/80 dark:bg-muted/50 flex items-center justify-center shrink-0">
                {card.icon}
              </span>
              {card.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </div>

            {/* Bottom: Value and Label */}
            <div className="mt-2 min-w-0">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground block">
                {isLoading ? '—' : card.value}
              </span>
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground mt-0.5 truncate leading-tight" title={card.label}>
                {card.label}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── High-Priority Android Action Card: Needs Acknowledgment Banner ── */}
      {needsAckReports > 0 && (
        <div
          role="button"
          onClick={() => setActiveTab('NEEDS_ACK')}
          className={cn(
            'rounded-2xl border p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] transition-all shadow-xs',
            activeTab === 'NEEDS_ACK'
              ? 'bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-amber-500/10 dark:bg-amber-500/[0.08] border-amber-500/25 hover:border-amber-500/40'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 truncate">
                {needsAckReports === 1 ? '1 Report Requires Acknowledgment' : `${needsAckReports} Reports Require Acknowledgment`}
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium truncate">
                {t('acknowledge_modal_desc')}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20">
            {t('view_details')}
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}

      {/* ── Search & Clean Filter Pills ── */}
      <div className="space-y-2.5 w-full max-w-full min-w-0">
        {/* Search Bar */}
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none shrink-0" />
          <Input
            type="text"
            placeholder={t('search_discipline_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-card border-border/60 rounded-xl h-10 text-xs sm:text-sm shadow-xs focus-visible:ring-primary/20 w-full min-w-0 truncate"
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
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 overscroll-contain w-full max-w-full min-w-0">
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
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer active:scale-95",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground"
                )}
              >
                <TabIcon className="w-3 h-3 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : tab.highlightBadge
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Incident Timeline List ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden w-full max-w-full min-w-0 box-border">
        {/* List Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-border/40 bg-muted/20 flex items-center justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-xs uppercase tracking-wider text-foreground truncate">
                {t('discipline_history_timeline')}
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                {selectedStudent?.fullName ? `${selectedStudent.fullName} • ` : ''}{t('all_reports_for_child')}
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {filteredIncidents.length} {filteredIncidents.length === 1 ? 'report' : 'reports'}
          </span>
        </div>

        <div className="p-3 sm:p-5 md:p-6 w-full max-w-full min-w-0 box-border">
          {isLoading ? (
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12 sm:py-16 space-y-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                {searchQuery || activeTab !== 'ALL' ? 'No matching reports found' : t('no_discipline_incidents')}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium px-4 break-words">
                {searchQuery || activeTab !== 'ALL'
                  ? 'Try clearing your search query or selecting a different filter tab.'
                  : t('no_discipline_incidents_desc')}
              </p>
              {(searchQuery || activeTab !== 'ALL') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSearchQuery(''); setActiveTab('ALL'); }}
                  className="rounded-xl text-xs font-semibold border-border/60"
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
                  <div
                    key={inc.id}
                    className={cn(
                      'group relative rounded-xl border p-4 transition-all duration-150 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 w-full max-w-full min-w-0 box-border',
                      needsAck
                        ? 'border-amber-500/40 bg-amber-500/[0.03] dark:bg-amber-500/[0.05] border-l-4 border-l-amber-500'
                        : 'border-border/60 bg-card hover:border-border'
                    )}
                  >
                    {/* Left content */}
                    <div className="space-y-3 flex-1 min-w-0 w-full">
                      {/* Needs acknowledgment banner */}
                      {needsAck && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('filter_needs_ack')}</span>
                        </div>
                      )}

                      {/* Incident Title if available */}
                      {inc.title && (
                        <h3 className="font-semibold text-foreground text-sm leading-snug break-words">
                          {inc.title}
                        </h3>
                      )}

                      {/* Labeled key-value rows */}
                      <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/40 overflow-hidden text-xs">
                        {/* Case # row */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-muted-foreground font-medium shrink-0">{t('case_number_label')}:</span>
                          <span className="font-mono font-semibold text-foreground truncate">
                            {inc.caseNumber ? (inc.caseNumber.startsWith('#') ? inc.caseNumber : `#${inc.caseNumber}`) : `#${inc.id.slice(0, 8)}`}
                          </span>
                        </div>

                        {/* Incident type row */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-muted-foreground font-medium shrink-0">{t('incident_category_label')}:</span>
                          <span className="font-semibold text-foreground text-right truncate">
                            {getCategoryLabel(inc.categoryName)}
                          </span>
                        </div>

                        {/* Severity row */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-muted-foreground font-medium shrink-0">{t('severity_label')}:</span>
                          <StatusBadge cfg={sevCfg} />
                        </div>

                        {/* Status row */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-muted-foreground font-medium shrink-0">{t('status_label')}:</span>
                          <StatusBadge cfg={staCfg} />
                        </div>

                        {/* Date row */}
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-muted-foreground font-medium shrink-0">{t('date_label')}:</span>
                          <span className="text-foreground font-medium flex items-center gap-1.5 text-right">
                            <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span>{formatLocalizedDate(inc.date, language)}</span>
                            {inc.time && <span className="text-muted-foreground">· {inc.time}</span>}
                          </span>
                        </div>

                        {/* Official action row — only when present */}
                        {(inc.approvedAction || inc.immediateAction) && (
                          <div className="flex items-start justify-between gap-3 px-3 py-2">
                            <span className="text-muted-foreground font-medium shrink-0">{t('official_action_label')}:</span>
                            <span className="font-medium text-foreground text-right break-words min-w-0">
                              {getActionLabel(inc.approvedAction || inc.immediateAction || '')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Description preview below the table */}
                      {inc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed break-words px-0.5">
                          {inc.description}
                        </p>
                      )}
                    </div>

                    {/* Action buttons (Mobile-first stack on phone, inline flex on desktop) */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-border/40 pt-3 md:pt-0">
                      {!inc.parentAcknowledged ? (
                        <Button
                          size="sm"
                          className="h-9 px-3.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95 transition-all gap-1.5 justify-center w-full sm:w-auto"
                          onClick={() => {
                            setSelectedIncident(inc);
                            setIsAckModalOpen(true);
                          }}
                        >
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t('acknowledge_report')}</span>
                        </Button>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 w-full sm:w-auto">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t('acknowledged')}</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3.5 rounded-xl text-xs font-medium border-border/60 bg-background hover:bg-muted active:scale-95 transition-all gap-1.5 justify-center w-full sm:w-auto"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{t('view_details')}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[95vw] sm:max-w-2xl max-h-[88dvh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border border-border/60 shadow-xl box-border"
        >
          {selectedIncident && (
            <>
              {/* Sticky Modal Header */}
              <div className="px-4 pt-4 pb-3 sm:px-5 sm:pt-5 border-b border-border/40 shrink-0 flex items-start justify-between gap-3 min-w-0">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md shrink-0">
                      #{selectedIncident.caseNumber || selectedIncident.id.slice(0, 8)}
                    </span>
                    <StatusBadge cfg={getSeverityConfig(selectedIncident.severity)} />
                    <StatusBadge cfg={getStatusConfig(selectedIncident.status)} />
                  </div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-tight break-words">
                    {selectedIncident.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground font-medium break-words">
                    {t('child_label')}: <span className="font-semibold text-foreground">{selectedIncident.student?.fullName}</span> &nbsp;·&nbsp; {t('date_label')}: {formatLocalizedDate(selectedIncident.date, language)}
                  </DialogDescription>
                </div>

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 space-y-3 min-w-0">
                {/* Category & Disciplinary Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-muted/30 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      {t('incident_category_label')}
                    </span>
                    <span className="font-semibold text-foreground text-xs sm:text-sm break-words">
                      {getCategoryLabel(selectedIncident.categoryName)}
                    </span>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-muted/30 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      {t('disciplinary_action_label')}
                    </span>
                    <span className="font-semibold text-foreground text-xs sm:text-sm break-words">
                      {selectedIncident.approvedAction
                        ? getActionLabel(selectedIncident.approvedAction)
                        : selectedIncident.immediateAction
                        ? getActionLabel(selectedIncident.immediateAction)
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Description Box */}
                <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-muted/30 space-y-1.5 min-w-0">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('incident_description')}
                  </h4>
                  <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                    {selectedIncident.description}
                  </p>
                </div>

                {/* Action Taken by School Banner */}
                {(selectedIncident.approvedAction || selectedIncident.immediateAction) && (
                  <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-muted/30 space-y-1 min-w-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('action_taken_by_school')}
                    </h4>
                    <p className="text-xs sm:text-sm font-semibold text-foreground break-words">
                      {getActionLabel(selectedIncident.approvedAction || selectedIncident.immediateAction || '')}
                    </p>
                  </div>
                )}

                {/* Evidence Attachments */}
                {selectedIncident.evidence && Array.isArray(selectedIncident.evidence) && selectedIncident.evidence.length > 0 && (
                  <div className="space-y-2 min-w-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('evidence_files', { count: selectedIncident.evidence.length })}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedIncident.evidence.map((att: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewAttachment(att)}
                          className="p-3 rounded-xl border border-border/60 bg-card hover:border-border cursor-pointer flex items-center gap-2 text-xs font-medium transition-all active:scale-[0.98] min-w-0"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1 min-w-0 text-foreground">{att.name}</span>
                          <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-ups Timeline */}
                {selectedIncident.followUps && selectedIncident.followUps.length > 0 && (
                  <div className="space-y-2 min-w-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('teacher_notes_updates')}
                    </h4>
                    <div className="relative pl-4 sm:pl-5 border-l-2 border-border space-y-3">
                      {selectedIncident.followUps.slice().reverse().map((fu) => (
                        <div key={fu.id} className="relative min-w-0">
                          <div className="absolute -left-[1.375rem] sm:-left-[1.625rem] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-sm" />
                          <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">
                                {fu.authorName || t('staff')}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatLocalizedDate(fu.createdAt, language)}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed break-words">
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
              <div className="px-4 py-3 sm:px-5 border-t border-border/40 bg-muted/20 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={handleMessageTeacher}
                  className="h-9 rounded-xl text-xs font-medium border-border/60 bg-background gap-1.5 justify-center"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{t('message_homeroom_teacher')}</span>
                </Button>

                {!selectedIncident.parentAcknowledged && (
                  <Button
                    onClick={() => {
                      setIsDetailOpen(false);
                      setIsAckModalOpen(true);
                    }}
                    className="h-9 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('acknowledge_report')}</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Acknowledge Modal ── */}
      <Dialog open={isAckModalOpen} onOpenChange={setIsAckModalOpen}>
        <DialogContent className="w-[92vw] sm:max-w-md rounded-2xl p-4 sm:p-5 bg-background border border-border/60 shadow-xl box-border">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <UserCheck className="w-4.5 h-4.5" />
              </div>
              <DialogTitle className="text-base font-bold text-foreground leading-tight">
                {t('acknowledge_discipline_report')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              {t('acknowledge_modal_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={t('optional_message_placeholder')}
              rows={3}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              className="rounded-xl text-xs bg-muted/30 border-border/60 focus-visible:ring-emerald-500/20 resize-none"
            />
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsAckModalOpen(false)}
              className="h-9 rounded-xl text-xs font-medium border-border/60 justify-center"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleAcknowledgeSubmit}
              disabled={isSubmittingAck}
              className="h-9 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs justify-center gap-1.5"
            >
              {isSubmittingAck ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{t('confirm_acknowledgment')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Evidence Preview Modal ── */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[88dvh] overflow-y-auto rounded-2xl p-4 sm:p-5 bg-background border border-border/60 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-semibold text-foreground truncate">
              {previewAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {previewAttachment?.type?.startsWith('image/') ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-[60vh] mx-auto rounded-xl object-contain shadow-sm"
              />
            ) : previewAttachment?.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-h-[60vh] w-full rounded-xl" />
            ) : (
              <iframe
                src={previewAttachment?.url}
                className="w-full h-[55vh] rounded-xl border border-border/40"
                title={previewAttachment?.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
