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
  Check
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

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'LOW':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">{t('severity_low')}</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">{t('severity_medium')}</Badge>;
      case 'HIGH':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">{t('severity_high')}</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-900 text-red-100 border-red-950 dark:bg-red-950 dark:text-red-200 dark:border-red-900 animate-pulse">{t('severity_critical')}</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">{t('status_open')}</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">{t('status_under_review')}</Badge>;
      case 'RESOLVED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">{t('status_resolved')}</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">{t('status_closed')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalReports = incidents.length;
  const openReports = incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER_REVIEW').length;
  const resolvedReports = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
            <ShieldAlert className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('student_discipline_title')}</h1>
            <p className="text-sm text-slate-300">
              {t('discipline_subtitle')}
            </p>
          </div>
        </div>

        <Button onClick={handleMessageTeacher} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
          <MessageSquare className="w-4 h-4 mr-2" />
          {t('message_homeroom_teacher')}
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('total_discipline_reports')}</p>
              <p className="text-2xl font-bold mt-1">{totalReports}</p>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('open_cases')}</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{openReports}</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('resolved_cases')}</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{resolvedReports}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Timeline / List */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">{t('discipline_history_timeline')}</CardTitle>
          <CardDescription>{t('all_reports_for_child')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
              <h3 className="text-lg font-semibold">{t('no_discipline_incidents')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('no_discipline_incidents_desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-5 border rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getSeverityBadge(inc.severity)}
                      {getStatusBadge(inc.status)}
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                        {inc.categoryName}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{inc.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('reported_for', {
                          name: inc.student?.fullName || '',
                          date: formatLocalizedDate(inc.date, language),
                          time: inc.time || '',
                          reporter: inc.reportedByName || t('staff')
                        })}
                      </p>
                    </div>

                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                      {inc.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    {!inc.parentAcknowledged ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                        onClick={() => {
                          setSelectedIncident(inc);
                          setIsAckModalOpen(true);
                        }}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {t('acknowledge_report')}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1">
                        <Check className="w-3.5 h-3.5" /> {t('acknowledged')}
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIncident && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(selectedIncident.severity)}
                  {getStatusBadge(selectedIncident.status)}
                </div>
                <DialogTitle className="text-xl font-bold mt-2">{selectedIncident.title}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {t('child_label')}: <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedIncident.student?.fullName}</span> | {t('date_label')}: {formatLocalizedDate(selectedIncident.date, language)}
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900 space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('incident_description')}</h4>
                <p className="text-sm leading-relaxed">{selectedIncident.description}</p>
              </div>

              {selectedIncident.immediateAction && (
                <div className="p-3 border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl space-y-1">
                  <h4 className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">{t('action_taken_by_school')}</h4>
                  <p className="text-xs text-indigo-800 dark:text-indigo-200">{selectedIncident.immediateAction}</p>
                </div>
              )}

              {/* Evidence attachments */}
              {selectedIncident.evidence && Array.isArray(selectedIncident.evidence) && selectedIncident.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    {t('evidence_files', { count: selectedIncident.evidence.length })}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedIncident.evidence.map((att: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewAttachment(att)}
                        className="p-3 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2 text-xs"
                      >
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="truncate font-medium">{att.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teacher Follow-up Notes */}
              {selectedIncident.followUps && selectedIncident.followUps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('teacher_notes_updates')}</h4>
                  <div className="space-y-2 border rounded-xl p-3 max-h-40 overflow-y-auto">
                    {selectedIncident.followUps.map((fu) => (
                      <div key={fu.id} className="text-xs border-b last:border-b-0 pb-2 mb-2 space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{fu.authorName || t('staff')}</span>
                          <span className="text-muted-foreground">{formatLocalizedDate(fu.createdAt, language)}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{fu.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <DialogFooter className="flex items-center justify-between gap-2 border-t pt-4">
                <Button variant="outline" onClick={handleMessageTeacher}>
                  <MessageSquare className="w-4 h-4 mr-2 text-indigo-600" />
                  {t('message_homeroom_teacher')}
                </Button>

                {!selectedIncident.parentAcknowledged && (
                  <Button
                    onClick={() => {
                      setIsDetailOpen(false);
                      setIsAckModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('acknowledge_discipline_report')}</DialogTitle>
            <DialogDescription>
              {t('acknowledge_modal_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={t('optional_message_placeholder')}
              rows={3}
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAckModalOpen(false)}>{t('cancel')}</Button>
            <Button
              onClick={handleAcknowledgeSubmit}
              disabled={isSubmittingAck}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              {t('confirm_acknowledgment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EVIDENCE PREVIEW MODAL */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.name}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {previewAttachment?.type?.startsWith('image/') ? (
              <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[60vh] mx-auto rounded-lg object-contain" />
            ) : previewAttachment?.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-h-[60vh] w-full rounded-lg" />
            ) : (
              <iframe src={previewAttachment?.url} className="w-full h-[60vh] rounded-lg border" title={previewAttachment?.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
