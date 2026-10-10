'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/db/database';
import { DisciplineApi, StudentDiscipline } from '@/lib/discipline-service';
import { notifications } from '@/lib/utils/notifications';
import { cn } from '@/lib/utils/utils';
import {
  CheckSquare, FileCheck, CheckCircle2, XCircle, Clock,
  ShieldAlert, TrendingUp, GraduationCap, ChevronRight,
  RefreshCw, Check, X, AlertTriangle, MessageSquare, ArrowUpRight
} from 'lucide-react';
import { AttendanceEditRequestsScreen } from './attendance-edit-requests-screen';

export function ExecutiveApprovalsInbox() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'attendance' | 'marks' | 'promotion' | 'discipline'>('attendance');
  const [attendanceRequests, setAttendanceRequests] = useState<any[]>([]);
  const [markSubmissions, setMarkSubmissions] = useState<any[]>([]);
  const [disciplineCases, setDisciplineCases] = useState<StudentDiscipline[]>([]);
  const [promotionCohorts, setPromotionCohorts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Approval modal states
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAllPendingApprovals = async () => {
    setIsLoading(true);
    try {
      const [attReqs, disc, promo] = await Promise.all([
        db.getAttendanceEditRequests().catch(() => []),
        DisciplineApi.getIncidents({ limit: 50 }).catch(() => ({ items: [] })),
        fetch('/api/promotion/preview').then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      ]);

      setAttendanceRequests(Array.isArray(attReqs) ? attReqs : []);

      const allIncidents = Array.isArray(disc.items) ? disc.items : (Array.isArray((disc as any).data) ? (disc as any).data : []);
      const criticalEscalations = allIncidents.filter((i: any) =>
        (i.severity === 'HIGH' || i.severity === 'CRITICAL' || i.status === 'ACTION_REQUIRED') &&
        i.status !== 'RESOLVED' && i.status !== 'CLOSED'
      );
      setDisciplineCases(criticalEscalations);

      setPromotionCohorts(promo?.data || []);
    } catch (err) {
      console.error('Failed to load executive approvals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllPendingApprovals();
  }, []);

  const pendingAttendanceCount = useMemo(() =>
    attendanceRequests.filter(r => r.status === 'PENDING').length,
    [attendanceRequests]
  );

  const pendingDisciplineCount = disciplineCases.length;
  const pendingPromotionCount = promotionCohorts.length;
  const totalPendingCount = pendingAttendanceCount + pendingDisciplineCount + pendingPromotionCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                Executive Approvals Center
                {totalPendingCount > 0 && (
                  <Badge className="bg-amber-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full">
                    {totalPendingCount} Pending
                  </Badge>
                )}
              </h1>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                Centralized sign-off inbox for attendance corrections, academic grades, promotions, and disciplinary escalations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllPendingApprovals}
            className="rounded-xl gap-2 font-bold text-xs h-9"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            Refresh Inbox
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="bg-muted/80 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="attendance" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <FileCheck className="w-4 h-4 text-amber-500" />
            Attendance Edits
            {pendingAttendanceCount > 0 && (
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black inline-flex items-center justify-center">
                {pendingAttendanceCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="marks" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <GraduationCap className="w-4 h-4 text-blue-500" />
            Marks &amp; Assessments
          </TabsTrigger>

          <TabsTrigger value="promotion" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Promotion Cohorts
            {pendingPromotionCount > 0 && (
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black inline-flex items-center justify-center">
                {pendingPromotionCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="discipline" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Conduct Escalations
            {pendingDisciplineCount > 0 && (
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black inline-flex items-center justify-center">
                {pendingDisciplineCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Attendance Edits */}
        <TabsContent value="attendance" className="mt-6">
          <AttendanceEditRequestsScreen onBack={() => router.push('/school/admin')} />
        </TabsContent>

        {/* Tab 2: Marks & Assessments */}
        <TabsContent value="marks" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Teacher Assessment &amp; Mark Submissions</span>
                <Button
                  size="sm"
                  onClick={() => router.push('/school/admin/assessments/submissions')}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  Open Gradebook Approvals
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Teachers submit finalized terminal and continuous assessment marks for academic validation prior to report card publishing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed border-border/80">
                <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-foreground">Mark Submission Console Active</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Verify submitted section marks, lock scores, or reopen submissions for correction.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/school/admin/assessments/submissions')}
                  className="mt-4 rounded-xl text-xs font-bold"
                >
                  Manage Assessment Submissions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Promotion Decisions */}
        <TabsContent value="promotion" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>End-of-Year Student Promotion Cohorts</span>
                <Button
                  size="sm"
                  onClick={() => router.push('/school/admin/promotion')}
                  className="rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Open Promotion Workflow
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Executive sign-off required to advance passing cohorts to the next academic grade and process academic retentions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {promotionCohorts.length === 0 ? (
                <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed border-border/80">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-foreground">All Promotion Cohorts Reconciled</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No pending promotions currently require executive sign-off.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promotionCohorts.map((cohort: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{cohort.gradeName || `Grade ${idx + 1}`}</p>
                        <p className="text-xs text-muted-foreground">{cohort.totalStudents || 0} Students eligible for review</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => router.push('/school/admin/promotion')}
                        className="rounded-xl text-xs font-bold"
                      >
                        Review Cohort
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Disciplinary Escalations */}
        <TabsContent value="discipline" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Critical Student Conduct Escalations</span>
                <Button
                  size="sm"
                  onClick={() => router.push('/school/admin/discipline')}
                  className="rounded-xl text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Open Discipline Hub
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </CardTitle>
              <CardDescription className="text-xs">
                Severe incidents requiring School Principal determination, suspension authorizations, or parent hearings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {disciplineCases.length === 0 ? (
                <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed border-border/80">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-foreground">Zero High-Severity Incidents Pending</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All student welfare and disciplinary matters are currently within normal thresholds.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disciplineCases.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{incident.title}</span>
                            <Badge className="bg-rose-600 text-white text-[10px] font-black uppercase">
                              {incident.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {incident.description || 'Action required by School Administration'}
                          </p>
                          <p className="text-[10px] text-muted-foreground/80 mt-1">
                            Status: <strong className="capitalize">{incident.status}</strong> • Category: {incident.categoryName || (incident as any).category || incident.categoryId || 'General'}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => router.push(`/school/admin/discipline?id=${incident.id}`)}
                        className="rounded-xl text-xs font-bold shrink-0 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-100"
                      >
                        Action Case
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
