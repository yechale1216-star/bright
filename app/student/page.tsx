"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CheckCircle2,
  GraduationCap,
  Calendar,
  Clock,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Award,
  FolderDown,
  Megaphone,
  Sparkles,
  ChevronRight,
  Sun,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studentDb, type StudentDashboardData } from "@/lib/db/student-db";

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentDashboardData | null>(null);

  useEffect(() => {
    studentDb.getDashboard()
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error("[Dashboard] Error loading student dashboard:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const studentName = data?.student?.name ? data.student.name.split(" ")[0] : "Amanuel";
  const gradeDisplay = data?.student?.grade ? `Grade ${data.student.grade}` : "Grade 12";
  const streamDisplay = data?.student?.stream || "Natural";
  const academicYearDisplay = data?.academicYear || "2026/27";

  const stats = data?.stats || {
    overallAverage: 82.6,
    averageTrend: "+2.3%",
    attendancePercentage: 96,
    attendanceStatus: "Excellent",
    presentDays: 26,
    absentDays: 2,
    lateDays: 1,
  };

  const timetable = data?.todayTimetable || [
    { id: "1", time: "08:30 - 09:15", subject: "Mathematics", teacher: "W/ro. Sara Y.", room: "Room 102" },
    { id: "2", time: "09:15 - 10:00", subject: "Physics", teacher: "Ato Abebe K.", room: "Room 102" },
    { id: "3", time: "10:30 - 11:15", subject: "English", teacher: "W/ro. Selam B.", room: "Room 101" },
    { id: "4", time: "12:00 - 01:00", subject: "Chemistry", teacher: "W/ro. Mihret A.", room: "Room 201" },
    { id: "5", time: "02:00 - 03:00", subject: "Biology", teacher: "Ato Getachew T.", room: "Room 204" },
  ];

  const marks = data?.recentMarks || [
    { id: "1", subject: "Mathematics", assessment: "Midterm", score: "85/100", grade: "A", date: new Date() },
    { id: "2", subject: "Physics", assessment: "Final", score: "78/100", grade: "B+", date: new Date() },
    { id: "3", subject: "English", assessment: "Test", score: "92/100", grade: "A+", date: new Date() },
    { id: "4", subject: "Chemistry", assessment: "Quiz", score: "88/100", grade: "A", date: new Date() },
    { id: "5", subject: "Biology", assessment: "Assignment", score: "84/100", grade: "A-", date: new Date() },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─── Hero Greeting Banner ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            Good morning, {studentName}! <span className="inline-block animate-bounce">☀️</span>
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            Keep going — your future is bright!
          </p>
        </div>
      </div>

      {/* ─── 4 Top Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        {/* Stat 1: Overall Average */}
        <Card className="rounded-2xl border-border shadow-xs bg-card hover:shadow-sm transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Overall Average</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-foreground">
                {stats.overallAverage}%
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> {stats.averageTrend}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stat 2: Attendance */}
        <Card className="rounded-2xl border-border shadow-xs bg-card hover:shadow-sm transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Attendance (This Month)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-foreground">
                {stats.attendancePercentage}%
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {stats.attendanceStatus}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stat 3: Current Grade */}
        <Card className="rounded-2xl border-border shadow-xs bg-card hover:shadow-sm transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Current Grade</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-foreground">
                {data?.student?.grade || "12"}
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                {streamDisplay}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stat 4: Academic Year */}
        <Card className="rounded-2xl border-border shadow-xs bg-card hover:shadow-sm transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Academic Year</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-black text-foreground">
                {academicYearDisplay}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 3 Column Grid Section ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Column 1: Today's Timetable (5 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="rounded-2xl border-border shadow-xs bg-card">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Today's Timetable
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Thursday, Oct 9, 2026
                </p>
              </div>
              <Link
                href="/student/timetable"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline transition-colors"
              >
                View Full Schedule
              </Link>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <div className="space-y-3">
                {timetable.map((slot, index) => (
                  <div
                    key={slot.id || index}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">
                        {slot.time}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {slot.subject}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {slot.teacher}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-foreground bg-card px-2 py-1 rounded-md border border-border shadow-2xs">
                      {slot.room}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Recent Marks (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="rounded-2xl border-border shadow-xs bg-card">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold text-foreground">
                Recent Marks
              </CardTitle>
              <Link
                href="/student/marks"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline transition-colors"
              >
                View All
              </Link>
            </CardHeader>
            <CardContent className="p-5 pt-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-bold text-[11px]">
                      <th className="pb-2.5">Subject</th>
                      <th className="pb-2.5">Assessment</th>
                      <th className="pb-2.5">Score</th>
                      <th className="pb-2.5 text-right">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {marks.map((m, index) => (
                      <tr key={m.id || index} className="group hover:bg-muted/30">
                        <td className="py-2.5 font-bold text-foreground">
                          {m.subject}
                        </td>
                        <td className="py-2.5 text-muted-foreground text-[11px]">
                          {m.assessment}
                        </td>
                        <td className="py-2.5 font-semibold text-foreground">
                          {m.score}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`inline-block font-black text-xs px-2 py-0.5 rounded-md ${
                              m.grade.startsWith("A")
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : m.grade.startsWith("B")
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {m.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Attendance, Quick Access, Motivational card (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Monthly Attendance breakdown */}
          <Card className="rounded-2xl border-border shadow-xs bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-foreground">
                Attendance (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="flex items-center gap-4">
                {/* Circular indicator */}
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-purple-600 dark:text-purple-400 transition-all duration-500"
                      strokeDasharray={`${stats.attendancePercentage}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-base font-black text-foreground leading-none">
                      {stats.attendancePercentage}%
                    </span>
                  </div>
                </div>

                {/* Counts */}
                <div className="space-y-1.5 text-xs flex-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present
                    </span>
                    <span className="font-bold text-foreground">{stats.presentDays}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Absent
                    </span>
                    <span className="font-bold text-foreground">{stats.absentDays}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Late
                    </span>
                    <span className="font-bold text-foreground">{stats.lateDays}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 border-border rounded-xl"
                >
                  <Link href="/student/attendance">View Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access Grid */}
          <Card className="rounded-2xl border-border shadow-xs bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-foreground">
                Quick Access
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 grid grid-cols-2 gap-2">
              <Link
                href="/student/marks"
                className="p-2.5 rounded-xl border border-border hover:border-purple-400 hover:bg-purple-500/5 flex items-center gap-2 transition-all text-xs font-semibold text-foreground"
              >
                <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>View Marks</span>
              </Link>
              <Link
                href="/student/attendance"
                className="p-2.5 rounded-xl border border-border hover:border-purple-400 hover:bg-purple-500/5 flex items-center gap-2 transition-all text-xs font-semibold text-foreground"
              >
                <CalendarCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Check Attendance</span>
              </Link>
              <Link
                href="/student/timetable"
                className="p-2.5 rounded-xl border border-border hover:border-purple-400 hover:bg-purple-500/5 flex items-center gap-2 transition-all text-xs font-semibold text-foreground"
              >
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>View Timetable</span>
              </Link>
              <Link
                href="/student/materials"
                className="p-2.5 rounded-xl border border-border hover:border-purple-400 hover:bg-purple-500/5 flex items-center gap-2 transition-all text-xs font-semibold text-foreground"
              >
                <FolderDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Learning Materials</span>
              </Link>
            </CardContent>
          </Card>

          {/* Announcements Card */}
          <Card className="rounded-2xl border-border shadow-xs bg-card">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Announcements
              </CardTitle>
              <Link href="/student/announcements" className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                View All
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs">
                <p className="font-bold text-foreground">
                  School will be closed on Meskel holiday (Oct 11, 2026).
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">2 days ago</p>
              </div>
            </CardContent>
          </Card>

          {/* Motivational Banner */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-900 to-purple-900 text-white relative overflow-hidden shadow-md">
            <div className="relative z-10">
              <p className="text-xs font-bold leading-relaxed max-w-[200px]">
                Small steps every day lead to big results.
              </p>
            </div>
            {/* Visual mountain svg silhouette */}
            <svg
              className="absolute right-0 bottom-0 w-28 h-20 text-white/10 pointer-events-none"
              viewBox="0 0 100 60"
              fill="currentColor"
            >
              <polygon points="10,60 40,20 60,45 80,10 100,60" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
