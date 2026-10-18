"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BookOpen, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentDb } from "@/lib/db/student-db";

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

  const isEmpty = !loading && subjects.length === 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Marks / Results
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Published academic scores, term assessments, and official grading reports
        </p>
      </div>

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
    </div>
  );
}
