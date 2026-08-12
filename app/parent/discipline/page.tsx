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
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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
      toast.error(err.message || t('failed_to_load_discipline'));
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

  // Translation Helper for Incident Categories
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

  // Translation Helper for Disciplinary Actions
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

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'LOW':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-bold">{t('severity_low')}</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 font-bold">{t('severity_medium')}</Badge>;
      case 'HIGH':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-bold">{t('severity_high')}</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-900 text-red-100 border-red-950 dark:bg-red-950 dark:text-red-200 dark:border-red-900 font-bold animate-pulse">{t('severity_critical')}</Badge>;
      default:
        return <Badge variant="outline" className="font-bold">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 font-bold">{t('status_open')}</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400 font-bold">{t('status_under_review')}</Badge>;
      case 'INVESTIGATION':
        return <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400 font-bold">{t('status_investigation')}</Badge>;
      case 'ACTION_REQUIRED':
        return <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400 font-bold">{t('status_action_required')}</Badge>;
      case 'RESOLVED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold">{t('status_resolved')}</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary" className="font-bold">{t('status_closed')}</Badge>;
      default:
        return <Badge variant="outline" className="font-bold">{status}</Badge>;
    }
  };

  const totalReports = incidents.length;
  const openReports = incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER_REVIEW' || i.status === 'ACTION_REQUIRED').length;
  const resolvedReports = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <div className="p-3.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
            <ShieldAlert className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{t('student_discipline_title')}</h1>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              {t('discipline_subtitle')}
            </p>
          </div>
        </div>

        <Button onClick={handleMessageTeacher} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl h-11 px-5 text-xs shadow-lg">
          <MessageSquare className="w-4 h-4 mr-2" />
          {t('message_homeroom_teacher')}
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{t('total_discipline_reports')}</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{totalReports}</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{t('open_cases')}</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{openReports}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{t('resolved_cases')}</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{resolvedReports}</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Timeline / List */}
      <Card className="border shadow-sm rounded-3xl">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-black uppercase tracking-tight">{t('discipline_history_timeline')}</CardTitle>
          <CardDescription className="text-xs font-medium">{t('all_reports_for_child')}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto opacity-70" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('no_discipline_incidents')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">
                {t('no_discipline_incidents_desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-5 border border-slate-200/80 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        {t('case_number_label')} #{inc.caseNumber || inc.id.slice(0, 8)}
                      </span>
                      {getSeverityBadge(inc.severity)}
                      {getStatusBadge(inc.status)}
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-indigo-500" />
                        {getCategoryLabel(inc.categoryName)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mt-1">{inc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
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

                    {/* Show Official Action if approved or taken */}
                    {(inc.approvedAction || inc.immediateAction) && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-xl border border-purple-200/60 dark:border-purple-900/60">
                        <Sliders className="w-3.5 h-3.5 text-purple-600" />
                        <span>{t('official_action_label')}: {getActionLabel(inc.approvedAction || inc.immediateAction || '')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 shrink-0">
                    {!inc.parentAcknowledged ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl h-10 px-4 text-xs shadow-md"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setIsAckModalOpen(true);
                        }}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {t('acknowledge_report')}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-bold gap-1 px-3 py-1 rounded-xl text-xs">
                        <Check className="w-3.5 h-3.5" /> {t('acknowledged')}
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-2xl font-bold h-10 px-4 text-xs"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      {t('view_details')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 bg-white dark:bg-slate-900">
          {selectedIncident && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {t('case_number_label')} #{selectedIncident.caseNumber || selectedIncident.id.slice(0, 8)}
                  </span>
                  {getSeverityBadge(selectedIncident.severity)}
                  {getStatusBadge(selectedIncident.status)}
                </div>
                <DialogTitle className="text-xl font-bold mt-2 text-slate-900 dark:text-white">{selectedIncident.title}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-medium">
                  {t('child_label')}: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedIncident.student?.fullName}</span> | {t('date_label')}: {formatLocalizedDate(selectedIncident.date, language)}
                </DialogDescription>
              </DialogHeader>

              {/* Category & Action Summary Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">{t('incident_category_label')}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{getCategoryLabel(selectedIncident.categoryName)}</span>
                </div>
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">{t('disciplinary_action_label')}</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {selectedIncident.approvedAction ? getActionLabel(selectedIncident.approvedAction) : (selectedIncident.immediateAction ? getActionLabel(selectedIncident.immediateAction) : '—')}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('incident_description')}</h4>
                <p className="text-sm leading-relaxed font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{selectedIncident.description}</p>
              </div>

              {/* Action Taken by School */}
              {(selectedIncident.approvedAction || selectedIncident.immediateAction) && (
                <div className="p-4 border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 rounded-2xl space-y-1">
                  <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">{t('action_taken_by_school')}</h4>
                  <p className="text-xs text-purple-800 dark:text-purple-200 font-bold">{getActionLabel(selectedIncident.approvedAction || selectedIncident.immediateAction || '')}</p>
                </div>
              )}

              {/* Evidence attachments */}
              {selectedIncident.evidence && Array.isArray(selectedIncident.evidence) && selectedIncident.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t('evidence_files', { count: selectedIncident.evidence.length })}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedIncident.evidence.map((att: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewAttachment(att)}
                        className="p-3 border rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2 text-xs font-bold"
                      >
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">{att.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Timeline */}
              {selectedIncident.followUps && selectedIncident.followUps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('teacher_notes_updates')}</h4>
                  <div className="relative pl-5 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-4">
                    {selectedIncident.followUps.slice().reverse().map((fu) => (
                      <div key={fu.id} className="relative">
                        <div className="absolute -left-[1.625rem] w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{fu.authorName || t('staff')}</span>
                            <span className="text-[10px] text-slate-400">
                              {formatLocalizedDate(fu.createdAt, language)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{fu.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <DialogFooter className="flex items-center justify-between gap-2 border-t pt-4">
                <Button variant="outline" onClick={handleMessageTeacher} className="rounded-2xl font-bold text-xs">
                  <MessageSquare className="w-4 h-4 mr-2 text-indigo-600" />
                  {t('message_homeroom_teacher')}
                </Button>

                {!selectedIncident.parentAcknowledged && (
                  <Button
                    onClick={() => {
                      setIsDetailOpen(false);
                      setIsAckModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs"
                  >
                    {t('acknowledge_report')}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ACKNOWLEDGE MODAL */}
      <Dialog open={isAckModalOpen} onOpenChange={setIsAckModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{t('acknowledge_discipline_report')}</DialogTitle>
            <DialogDescription className="text-xs font-medium mt-1">
              {t('acknowledge_modal_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={t('optional_message_placeholder')}
              rows={3}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              className="rounded-2xl text-xs font-medium"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAckModalOpen(false)} className="rounded-2xl font-bold text-xs">{t('cancel')}</Button>
            <Button
              onClick={handleAcknowledgeSubmit}
              disabled={isSubmittingAck}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl"
            >
              {t('confirm_acknowledgment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EVIDENCE PREVIEW MODAL */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{previewAttachment?.name}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {previewAttachment?.type?.startsWith('image/') ? (
              <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[60vh] mx-auto rounded-2xl object-contain shadow" />
            ) : previewAttachment?.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-h-[60vh] w-full rounded-2xl" />
            ) : (
              <iframe src={previewAttachment?.url} className="w-full h-[60vh] rounded-2xl border" title={previewAttachment?.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
