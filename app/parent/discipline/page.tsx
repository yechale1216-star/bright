'use client';

import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/utils';

import { DisciplineApi, StudentDiscipline } from '@/lib/discipline-service';
import { useLanguage } from '@/lib/context/language-context';
import { formatLocalizedDate } from '@/lib/utils/date-utils';

export default function ParentDisciplinePage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [incidents, setIncidents] = useState<StudentDiscipline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<StudentDiscipline | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Acknowledgment Modal
  const [isAckModalOpen, setIsAckModalOpen] = useState(false);
  const [ackNotes, setAckNotes] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);

  // Evidence Preview
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);

  const fetchParentIncidents = async () => {
    setIsLoading(true);
    try {
      const res = await DisciplineApi.getIncidents({ limit: 50 });
      setIncidents(res.items);
    } catch (err: any) {
      console.error("Failed to load discipline records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParentIncidents();
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

    // ── Status names ──
    const statusMap: Record<string, string> = {
      'OPEN':             'ክፍት',
      'UNDER_REVIEW':     'በግምገማ ላይ',
      'INVESTIGATION':    'በምርመራ ላይ',
      'ACTION_REQUIRED':  'እርምጃ ያስፈልገዋል',
      'RESOLVED':         'የተፈታ',
      'CLOSED':           'የተዘጋ',
    };

    // ── Severity names ──
    const severityMap: Record<string, string> = {
      'LOW':      'ዝቅተኛ',
      'MEDIUM':   'መካከለኛ',
      'HIGH':     'ከፍተኛ',
      'CRITICAL': 'አስቸኳይ/ወሳኝ',
    };

    // ── Action names ──
    const actionMap: Record<string, string> = {
      'Verbal Warning':               'የቃል ማስጠንቀቂያ',
      'Written Warning':              'የጽሑፍ ማስጠንቀቂያ',
      'Parent Conference':            'የወላጅ ውይይት / ስብሰባ',
      'Parent Meeting':               'የወላጅ ስብሰባ',
      'Counseling Session':           'የምክር እና የሥነ-ልቦና ድጋፍ',
      'Restorative Task':             'የማስተካከያ አገልግሎት',
      'Behavioral Plan':              'የባህሪ ማሻሻያ እቅድ',
      'Behavior Plan':                'የባህሪ ማሻሻያ እቅድ',
      'Detention':                    'ከትምህርት በኋላ ማቆየት',
      'In-School Suspension':         'በትምህርት ቤት ውስጥ እገዳ',
      'Out-of-School Suspension':     'ከትምህርት ቤት ጊዜያዊ እገዳ',
      'Behavior Contract':            'የባህሪ ስምምነት ውል',
      'Behaviour Contract':           'የባህሪ ስምምነት ውል',
    };

    // Pattern: "Case #XX created with status OPEN and severity LOW."
    result = result.replace(
      /Case (#[\w-]+) created with status (\w+) and severity (\w+)\./i,
      (_, caseNum, status, sev) =>
        `ጉዳይ ${caseNum} ሁኔታ ${statusMap[status.toUpperCase()] ?? status} እና ክብደት ${severityMap[sev.toUpperCase()] ?? sev} ሆኖ ተፈጥሯል።`
    );

    // Pattern: "Updated incident status to X and severity to Y."
    result = result.replace(
      /Updated incident status to (\w+) and severity to (\w+)\./i,
      (_, status, sev) =>
        `የክስተቱ ሁኔታ ወደ ${statusMap[status.toUpperCase()] ?? status} እና ክብደት ወደ ${severityMap[sev.toUpperCase()] ?? sev} ተቀይሯል።`
    );

    // Pattern: "Updated incident status to X."
    result = result.replace(
      /Updated incident status to (\w+)\./i,
      (_, status) =>
        `የክስተቱ ሁኔታ ወደ ${statusMap[status.toUpperCase()] ?? status} ተቀይሯል።`
    );

    // Pattern: "Updated severity to X."
    result = result.replace(
      /Updated severity to (\w+)\./i,
      (_, sev) =>
        `ክብደቱ ወደ ${severityMap[sev.toUpperCase()] ?? sev} ተቀይሯል።`
    );

    // Pattern: "Disciplinary Action set: <Action>."
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

    // Pattern: "Disciplinary Action removed."
    result = result.replace(
      /Disciplinary Action removed\./i,
      'የሥነ-ምግባር እርምጃ ተሰርዟል።'
    );

    // Pattern: "Assigned to <Name>."
    result = result.replace(
      /Assigned to (.+?)\./i,
      (_, name) => `ለ${name} ተመድቧል።`
    );

    // Pattern: "Investigation updated. Findings: X."
    result = result.replace(
      /Investigation updated\. Findings: (.+?)\./i,
      (_, findings) => `ምርመራ ተካሂዷል። ውጤት: ${findings}።`
    );

    // Pattern: "Incident resolved."
    result = result.replace(/Incident resolved\./i, 'ጉዳዩ ተፈቷል።');

    // Pattern: "Incident closed."
    result = result.replace(/Incident closed\./i, 'ጉዳዩ ተዘግቷል።');

    // Pattern: "Note added."
    result = result.replace(/Note added\./i, 'ማስታወሻ ታክሏል።');

    // Pattern: "Parent acknowledged this report."
    result = result.replace(/Parent acknowledged this report\./i, 'ወላጅ ሪፖርቱን አረጋግጠዋል።');

    return result;
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'LOW':    return { label: t('severity_low'),      cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' };
      case 'MEDIUM': return { label: t('severity_medium'),   cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',         dot: 'bg-amber-500' };
      case 'HIGH':   return { label: t('severity_high'),     cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',             dot: 'bg-rose-500' };
      case 'CRITICAL': return { label: t('severity_critical'), cls: 'bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/30 animate-pulse',  dot: 'bg-red-600' };
      default: return { label: severity, cls: 'bg-slate-500/10 text-slate-600 border-slate-500/20', dot: 'bg-slate-500' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':            return { label: t('status_open'),            cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' };
      case 'UNDER_REVIEW':    return { label: t('status_under_review'),    cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' };
      case 'INVESTIGATION':   return { label: t('status_investigation'),   cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25' };
      case 'ACTION_REQUIRED': return { label: t('status_action_required'), cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25' };
      case 'RESOLVED':        return { label: t('status_resolved'),        cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' };
      case 'CLOSED':          return { label: t('status_closed'),          cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
      default: return { label: status, cls: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
    }
  };

  const GlassBadge = ({ cfg }: { cfg: { label: string; cls: string; dot?: string } }) => (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border backdrop-blur-sm', cfg.cls)}>
      {cfg.dot && <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />}
      {cfg.label}
    </span>
  );

  const totalReports = incidents.length;
  const openReports = incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER_REVIEW' || i.status === 'ACTION_REQUIRED').length;
  const resolvedReports = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  return (
    <div className="relative min-h-screen p-4 md:p-8 space-y-7 max-w-6xl mx-auto overflow-hidden">

      {/* ── Ambient Blur Orbs ── */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-[110px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 -right-20 w-80 h-80 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute -bottom-20 left-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none -z-10" />

      {/* ── Frosted Glass Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 md:p-8 shadow-2xl shadow-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
      >
        {/* subtle shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        <div className="flex items-center gap-4 z-10">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('student_discipline_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('discipline_subtitle')}
            </p>
          </div>
        </div>

        <Button
          onClick={handleMessageTeacher}
          className="z-10 h-11 px-5 rounded-2xl gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 active:scale-95 transition-all border border-white/20 w-full sm:w-auto"
        >
          <MessageSquare className="w-4 h-4" />
          {t('message_homeroom_teacher')}
        </Button>
      </motion.div>

      {/* ── Glass KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        {[
          {
            label: t('total_discipline_reports'),
            value: totalReports,
            icon: <ShieldAlert className="w-5 h-5" />,
            iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
            hoverBorder: 'hover:border-indigo-500/30',
            delay: 0.05,
          },
          {
            label: t('open_cases'),
            value: openReports,
            valueColor: 'text-amber-600 dark:text-amber-400',
            icon: <Clock className="w-5 h-5" />,
            iconBg: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/20 text-amber-600 dark:text-amber-400',
            hoverBorder: 'hover:border-amber-500/30',
            delay: 0.1,
          },
          {
            label: t('resolved_cases'),
            value: resolvedReports,
            valueColor: 'text-emerald-600 dark:text-emerald-400',
            icon: <CheckCircle2 className="w-5 h-5" />,
            iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
            hoverBorder: 'hover:border-emerald-500/30',
            delay: 0.15,
          },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: card.delay }}
            className={cn(
              'group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 transition-all duration-300',
              card.hoverBorder
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn('w-11 h-11 rounded-2xl border flex items-center justify-center group-hover:scale-105 transition-transform', card.iconBg)}>
                {card.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</span>
            </div>
            <p className={cn('text-3xl font-black tracking-tight', card.valueColor || 'text-slate-900 dark:text-white')}>
              {isLoading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Glass Incident List ── */}
      <div className="rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-slate-900/5 overflow-hidden">
        {/* List Header */}
        <div className="px-6 py-5 border-b border-white/40 dark:border-white/10 bg-slate-50/40 dark:bg-slate-950/40 flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-primary" />
          <div>
            <h2 className="font-black text-sm uppercase tracking-widest text-slate-900 dark:text-white">
              {t('discipline_history_timeline')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('all_reports_for_child')}
            </p>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-white/40 dark:bg-slate-800/40 rounded-[20px] animate-pulse" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('no_discipline_incidents')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
                {t('no_discipline_incidents_desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc, idx) => {
                const sevCfg = getSeverityConfig(inc.severity);
                const staCfg = getStatusConfig(inc.status);
                return (
                  <motion.div
                    key={inc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                    className="group relative rounded-[20px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/40 backdrop-blur-xl p-5 hover:border-indigo-500/30 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Left content */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-xl backdrop-blur-sm">
                          #{inc.caseNumber || inc.id.slice(0, 8)}
                        </span>
                        <GlassBadge cfg={sevCfg} />
                        <GlassBadge cfg={staCfg} />
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/8 border border-indigo-500/20 px-2.5 py-0.5 rounded-xl backdrop-blur-sm">
                          <Tag className="w-3 h-3" />
                          {getCategoryLabel(inc.categoryName)}
                        </span>
                      </div>

                      {/* Title & meta */}
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">{inc.title}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          {t('reported_for', {
                            name: inc.student?.fullName || '',
                            date: formatLocalizedDate(inc.date, language),
                            time: inc.time || '',
                            reporter: inc.reportedByName || t('staff')
                          })}
                        </p>
                      </div>

                      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {inc.description}
                      </p>

                      {/* Official action chip */}
                      {(inc.approvedAction || inc.immediateAction) && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-xl backdrop-blur-sm">
                          <Sliders className="w-3 h-3" />
                          {t('official_action_label')}: {getActionLabel(inc.approvedAction || inc.immediateAction || '')}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 border-t md:border-t-0 border-white/30 dark:border-white/10 pt-3 md:pt-0">
                      {!inc.parentAcknowledged ? (
                        <Button
                          size="sm"
                          className="h-9 px-4 rounded-xl text-[11px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-white/20 shadow-md shadow-emerald-500/20 active:scale-95 transition-all gap-1"
                          onClick={() => {
                            setSelectedIncident(inc);
                            setIsAckModalOpen(true);
                          }}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('acknowledge_report')}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 backdrop-blur-sm">
                          <Check className="w-3.5 h-3.5" />
                          {t('acknowledged')}
                        </span>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-4 rounded-xl text-[11px] font-bold border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm hover:border-indigo-500/30 hover:text-indigo-600 active:scale-95 transition-all gap-1"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t('view_details')}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] p-6 md:p-8 bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-2xl">
          {selectedIncident && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-xl">
                    #{selectedIncident.caseNumber || selectedIncident.id.slice(0, 8)}
                  </span>
                  <GlassBadge cfg={getSeverityConfig(selectedIncident.severity)} />
                  <GlassBadge cfg={getStatusConfig(selectedIncident.status)} />
                </div>
                <DialogTitle className="text-xl font-black mt-2 text-slate-900 dark:text-white">
                  {selectedIncident.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t('child_label')}: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedIncident.student?.fullName}</span> | {t('date_label')}: {formatLocalizedDate(selectedIncident.date, language)}
                </DialogDescription>
              </DialogHeader>

              {/* Category & Action Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('incident_category_label')}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{getCategoryLabel(selectedIncident.categoryName)}</span>
                </div>
                <div className="p-4 rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('disciplinary_action_label')}</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                    {selectedIncident.approvedAction
                      ? getActionLabel(selectedIncident.approvedAction)
                      : selectedIncident.immediateAction
                        ? getActionLabel(selectedIncident.immediateAction)
                        : '—'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/60 backdrop-blur-md space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('incident_description')}</h4>
                <p className="text-sm leading-relaxed font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Action taken */}
              {(selectedIncident.approvedAction || selectedIncident.immediateAction) && (
                <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-md space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">{t('action_taken_by_school')}</h4>
                  <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                    {getActionLabel(selectedIncident.approvedAction || selectedIncident.immediateAction || '')}
                  </p>
                </div>
              )}

              {/* Evidence */}
              {selectedIncident.evidence && Array.isArray(selectedIncident.evidence) && selectedIncident.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {t('evidence_files', { count: selectedIncident.evidence.length })}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedIncident.evidence.map((att: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewAttachment(att)}
                        className="p-3 rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 hover:border-indigo-500/30 cursor-pointer flex items-center gap-2 text-xs font-bold backdrop-blur-sm transition-all"
                      >
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-ups timeline */}
              {selectedIncident.followUps && selectedIncident.followUps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('teacher_notes_updates')}</h4>
                  <div className="relative pl-5 border-l-2 border-indigo-500/30 space-y-4">
                    {selectedIncident.followUps.slice().reverse().map((fu) => (
                      <div key={fu.id} className="relative">
                        <div className="absolute -left-[1.625rem] w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{fu.authorName || t('staff')}</span>
                            <span className="text-[10px] text-slate-400">{formatLocalizedDate(fu.createdAt, language)}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{translateFollowUpNote(fu.note)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="flex items-center justify-between gap-2 border-t border-white/30 dark:border-white/10 pt-4">
                <Button
                  variant="outline"
                  onClick={handleMessageTeacher}
                  className="rounded-2xl font-bold text-xs border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm gap-1.5"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  {t('message_homeroom_teacher')}
                </Button>

                {!selectedIncident.parentAcknowledged && (
                  <Button
                    onClick={() => { setIsDetailOpen(false); setIsAckModalOpen(true); }}
                    className="rounded-2xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                  >
                    {t('acknowledge_report')}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Acknowledge Modal ── */}
      <Dialog open={isAckModalOpen} onOpenChange={setIsAckModalOpen}>
        <DialogContent className="max-w-md rounded-[28px] p-6 md:p-8 bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <UserCheck className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white">
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
              className="rounded-2xl text-xs font-medium bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsAckModalOpen(false)}
              className="rounded-2xl font-bold text-xs"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleAcknowledgeSubmit}
              disabled={isSubmittingAck}
              className="rounded-2xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20"
            >
              {isSubmittingAck ? '...' : t('confirm_acknowledgment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Evidence Preview Modal ── */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-2xl rounded-[28px] p-6 bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              {previewAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {previewAttachment?.type?.startsWith('image/') ? (
              <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[60vh] mx-auto rounded-2xl object-contain shadow-xl" />
            ) : previewAttachment?.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-h-[60vh] w-full rounded-2xl" />
            ) : (
              <iframe src={previewAttachment?.url} className="w-full h-[60vh] rounded-2xl border border-white/30" title={previewAttachment?.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
