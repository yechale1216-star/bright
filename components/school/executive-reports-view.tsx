'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, ShieldAlert, Clock, ArrowUpRight, CheckSquare, GraduationCap, RefreshCw } from 'lucide-react';
import { db } from '@/lib/db/database';
import { DisciplineApi } from '@/lib/discipline-service';

export function ExecutiveReportsView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'attendance' | 'academic' | 'conduct' | 'staff'>('attendance');
  const [summary, setSummary] = useState<any>(null);
  const [disciplineStats, setDisciplineStats] = useState<any>(null);
  const [staffStats, setStaffStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const [sum, disc, staff] = await Promise.all([
        db.getDashboardSummary(todayStr).catch(() => null),
        DisciplineApi.getAnalytics().catch(() => null),
        db.getStaffAttendanceStats(todayStr).catch(() => null),
      ]);
      setSummary(sum);
      setDisciplineStats(disc);
      setStaffStats(staff);
    } catch (err) {
      console.error('Failed to load executive reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Executive School Reports
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Cross-departmental analytical summaries, compliance trends, and institutional metrics for executive review.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadReportData}
          className="rounded-xl gap-2 font-bold text-xs h-9"
        >
          <RefreshCw className={isLoading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
          Refresh Analytics
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="bg-muted/80 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="attendance" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <CheckSquare className="w-4 h-4 text-emerald-500" />
            Student Attendance Analytics
          </TabsTrigger>
          <TabsTrigger value="academic" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <GraduationCap className="w-4 h-4 text-blue-500" />
            Academic Grade Distribution
          </TabsTrigger>
          <TabsTrigger value="staff" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <Clock className="w-4 h-4 text-amber-500" />
            Staff Compliance &amp; Punctuality
          </TabsTrigger>
          <TabsTrigger value="conduct" className="rounded-lg text-xs font-bold gap-2 py-2 px-3">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Student Conduct &amp; Welfare
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Attendance */}
        <TabsContent value="attendance" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Attendance Trends &amp; Grade Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Daily presence rate, absentees, and grade-level comparisons.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/school/admin/attendance?tab=reports')}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                Deep-Dive Attendance Reports
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Present Today</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {summary?.attendance?.present ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                  <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">Absentees Today</span>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {summary?.attendance?.absent ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">Late Arrivals</span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {summary?.attendance?.late ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Academic */}
        <TabsContent value="academic" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Academic Performance &amp; Gradebook Overview</CardTitle>
                <CardDescription className="text-xs">
                  Review student performance across examinations and terminal assessments.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/school/admin/report-cards')}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                Inspect Official Report Cards
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-6 text-center bg-muted/20 rounded-xl border border-dashed border-border">
                <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-foreground">Gradebook Summary Active</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Examine GPA averages, student pass rates, and report card readiness across all active classes.
                </p>
                <Button
                  size="sm"
                  onClick={() => router.push('/school/admin/exams')}
                  className="mt-4 rounded-xl text-xs font-bold"
                >
                  View Grading Scales &amp; Exams
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Staff Compliance */}
        <TabsContent value="staff" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Staff Attendance &amp; Clock-in Compliance</CardTitle>
                <CardDescription className="text-xs">
                  Punctuality analytics, facial biometric verification, and session breakdowns.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/school/admin/staff-attendance')}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                Staff Attendance Console
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Staff Checked In</span>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {staffStats?.checkedIn ?? 0} / {staffStats?.totalStaff ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Punctuality Rate</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {staffStats?.complianceRate ? `${Math.round(staffStats.complianceRate)}%` : '100%'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Tardiness / Late</span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {staffStats?.late ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Student Conduct */}
        <TabsContent value="conduct" className="mt-6 space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">Student Welfare &amp; Conduct Analytics</CardTitle>
                <CardDescription className="text-xs">
                  Incident volume, categories, and resolution velocity.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/school/admin/discipline?tab=analytics')}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                Discipline Analytics Dashboard
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Total Open Cases</span>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {disciplineStats?.openCases ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                  <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">High/Critical Severity</span>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {disciplineStats?.criticalCases ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Resolved Cases</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {disciplineStats?.resolvedCases ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
