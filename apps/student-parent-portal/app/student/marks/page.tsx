"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BookOpen, TrendingUp, AlertCircle, FileText, Printer, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentDb } from "@/lib/db/student-db";
import { gradebookService, ComprehensiveReportCardData } from "@/lib/gradebook-service";
import { StudentReportCard } from "@/components/school/student-report-card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentEntry {
  id: string;
  title: string;
  type: string;
  score: number | null;
  maxScore: number;
  percentage: number;
  grade: string;
  isAbsent?: boolean;
  remarks?: string;
}

interface SubjectRow {
  subjectId: string;
  subjectName: string;
  subjectColor?: string;
  assessments: AssessmentEntry[];
  averageScore: number;
  totalScore: number;
  maxPossible: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeBadgeClass(grade: string): string {
  if (!grade || grade === "N/A") return "bg-slate-100 text-slate-500";
  if (grade.startsWith("A")) return "bg-emerald-50 text-emerald-700";
  if (grade.startsWith("B")) return "bg-blue-50 text-blue-700";
  if (grade.startsWith("C")) return "bg-amber-50 text-amber-700";
  if (grade.startsWith("D")) return "bg-orange-50 text-orange-700";
  return "bg-red-50 text-red-600";
}

function overallGrade(avg: number): string {
  if (avg >= 90) return "A+";
  if (avg >= 85) return "A";
  if (avg >= 80) return "B+";
  if (avg >= 75) return "B";
  if (avg >= 70) return "C+";
  if (avg >= 65) return "C";
  if (avg >= 60) return "D+";
  if (avg >= 50) return "D";
  return "F";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentMarksPage() {
  const [academicYear, setAcademicYear] = useState("all");
  const [term, setTerm] = useState("all");
  const [subject, setSubject] = useState("all");
  const [marksData, setMarksData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    studentDb
      .getMarks(
        academicYear !== "all" ? academicYear : undefined,
        term !== "all" ? term : undefined,
        subject !== "all" ? subject : undefined
      )
      .then((res: any) => {
        setMarksData(res);
      })
      .catch((err: any) => {
        console.warn("[Marks] Error fetching marks:", err?.message || err);
        setError(err?.message || "Failed to load marks data.");
      })
      .finally(() => setLoading(false));
  }, [academicYear, term, subject]);

  // subjects array from API: { subjectId, subjectName, subjectColor, assessments[], averageScore }
  const subjects: SubjectRow[] = useMemo(() => {
    if (!marksData?.subjects?.length) return [];
    return marksData.subjects as SubjectRow[];
  }, [marksData]);

  // Collect all unique assessment *types* across all subjects for columns
  const assessmentTypes: string[] = useMemo(() => {
    const types = new Set<string>();
    for (const s of subjects) {
      for (const a of s.assessments) {
        if (a.type) types.add(a.type);
      }
    }
    return Array.from(types);
  }, [subjects]);

  // Calculate overall average across all subjects
  const overallAvg = useMemo(() => {
    if (!subjects.length) return marksData?.overallAverage ?? 0;
    const total = subjects.reduce((acc, s) => acc + s.averageScore, 0);
    return Math.round((total / subjects.length) * 10) / 10;
  }, [subjects, marksData]);

  const gradeLetter = overallGrade(overallAvg);

  // Filter subject options for the select
  const subjectOptions = useMemo(() => {
    return subjects.map((s) => ({ id: s.subjectId, name: s.subjectName }));
  }, [subjects]);

  const [activeTab, setActiveTab] = useState<"breakdown" | "reportCard">("breakdown");
  const [reportCardTerm, setReportCardTerm] = useState<string>("annual");
  const [comprehensiveCard, setComprehensiveCard] = useState<ComprehensiveReportCardData | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "reportCard") return;

    let isMounted = true;
    const loadReportCard = async () => {
      setCardLoading(true);
      setCardError(null);
      try {
        let studentId = marksData?.student?.id || marksData?.studentId;
        if (!studentId) {
          try {
            const userStr = typeof window !== "undefined" ? localStorage.getItem("attendance_current_user") : null;
            if (userStr) {
              const u = JSON.parse(userStr);
              studentId = u?.studentId || u?.id || u?.student_id;
            }
          } catch {}
        }
        if (!studentId) {
          try {
            const prof = await studentDb.getProfile();
            studentId = prof?.basicInfo?.id || prof?.id || prof?.student?.id || prof?.basicInfo?.studentId;
          } catch {}
        }

        const card = await gradebookService.getComprehensiveReportCard(
          studentId || "default",
          undefined,
          reportCardTerm !== "annual" ? reportCardTerm : undefined
        );
        if (isMounted) {
          setComprehensiveCard(card);
        }
      } catch (err: any) {
        console.warn("[Student Report Card] Failed to load:", err);
        if (isMounted) {
          setCardError(err?.message || "Failed to load comprehensive report card.");
        }
      } finally {
        if (isMounted) {
          setCardLoading(false);
        }
      }
    };

    loadReportCard();
    return () => {
      isMounted = false;
    };
  }, [activeTab, reportCardTerm, marksData]);

  const isEmpty = !loading && subjects.length === 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Marks / Results
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Published academic scores, term assessments, and official grading reports
          </p>
        </div>

        {/* View Switcher Tabs (Responsive) */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-full sm:w-fit border border-slate-200/60 dark:border-slate-700/60 print:hidden">
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "breakdown"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Marks Breakdown</span>
          </button>
          <button
            onClick={() => setActiveTab("reportCard")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "reportCard"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Official Report Card</span>
          </button>
        </div>
      </div>

      {activeTab === "reportCard" ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline">Evaluation Period:</span>
              {[
                { id: "annual", label: "Full Year (Annual)" },
                { id: "sem1", label: "Semester 1" },
                { id: "sem2", label: "Semester 2" },
              ].map((t) => (
                <Button
                  key={t.id}
                  variant={reportCardTerm === t.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportCardTerm(t.id)}
                  className={`text-xs h-8 rounded-xl font-medium ${
                    reportCardTerm === t.id ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
                  }`}
                >
                  {t.label}
                </Button>
              ))}
            </div>

            <Button
              onClick={() => window.print()}
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Report</span>
            </Button>
          </div>

          {cardLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span>Generating official report card...</span>
            </div>
          ) : cardError ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cardError}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReportCardTerm(reportCardTerm)}
                className="text-xs font-bold shrink-0 hover:bg-amber-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
              </Button>
            </div>
          ) : comprehensiveCard ? (
            <div className="flex justify-center p-1 sm:p-4 md:p-6 bg-slate-100/60 dark:bg-slate-900/50 rounded-2xl border border-border/80 overflow-x-auto w-full max-w-full">
              <StudentReportCard card={comprehensiveCard} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <FileText className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">No official report card issued yet for this period.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="w-36 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <SelectValue placeholder="Academic Year" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="2026/27">2026/27 (Active)</SelectItem>
                <SelectItem value="2025/26">2025/26</SelectItem>
                <SelectItem value="2024/25">2024/25</SelectItem>
              </SelectContent>
            </Select>

            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="w-32 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Terms</SelectItem>
                <SelectItem value="term1">Term 1</SelectItem>
                <SelectItem value="term2">Term 2</SelectItem>
                <SelectItem value="term3">Term 3</SelectItem>
              </SelectContent>
            </Select>

            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-36 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Subjects</SelectItem>
                {subjectOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {error.includes("permission") && (
            <a
              href="/login"
              className="font-bold underline shrink-0 hover:opacity-80"
            >
              Sign In as Student
            </a>
          )}
        </div>
      )}

      {/* Marks Table */}
      <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/90 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Loading marks…
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <BookOpen className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">No marks available for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wide">
                    <th className="py-3.5 px-5 sticky left-0 bg-slate-50/80 dark:bg-slate-800/80 z-10 whitespace-nowrap">
                      Subject
                    </th>
                    {assessmentTypes.map((type) => (
                      <th key={type} className="py-3.5 px-4 whitespace-nowrap text-center">
                        {type}
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Average</th>
                    <th className="py-3.5 px-5 text-center whitespace-nowrap">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subjects.map((s) => {
                    // Build lookup: type → best/first assessment of that type
                    const byType: Record<string, AssessmentEntry> = {};
                    for (const a of s.assessments) {
                      if (!byType[a.type]) byType[a.type] = a;
                    }
                    const subjectGrade = overallGrade(s.averageScore);
                    return (
                      <tr
                        key={s.subjectId}
                        className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors group"
                      >
                        {/* Subject name — sticky on mobile */}
                        <td className="py-3.5 px-5 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-purple-50/30 dark:group-hover:bg-purple-950/20 transition-colors z-10">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: s.subjectColor || "#6366f1" }}
                            />
                            <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {s.subjectName}
                            </span>
                          </div>
                        </td>

                        {/* One cell per assessment type */}
                        {assessmentTypes.map((type) => {
                          const entry = byType[type];
                          if (!entry) {
                            return (
                              <td key={type} className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">
                                —
                              </td>
                            );
                          }
                          if (entry.isAbsent) {
                            return (
                              <td key={type} className="py-3.5 px-4 text-center">
                                <span className="text-[10px] font-bold bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 px-2 py-0.5 rounded-md">
                                  Absent
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={type} className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                                {entry.score ?? "—"}/{entry.maxScore}
                              </span>
                              <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                {entry.percentage}%
                              </span>
                            </td>
                          );
                        })}

                        {/* Average */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                            {s.averageScore}%
                          </span>
                        </td>

                        {/* Grade badge */}
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-block font-black text-[11px] px-2.5 py-0.5 rounded-md ${gradeBadgeClass(subjectGrade)}`}
                          >
                            {subjectGrade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Summary Bar */}
          {!loading && !isEmpty && (
            <div className="p-4 sm:px-6 bg-slate-50/90 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Overall Average
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                  {overallAvg}%
                </span>
                <span className="font-black text-xs px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                  {gradeLetter}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}

