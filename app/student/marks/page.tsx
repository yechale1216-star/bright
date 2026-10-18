"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BookOpen, TrendingUp } from "lucide-react";
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
  if (!grade || grade === "N/A") return "bg-muted text-muted-foreground";
  if (grade.startsWith("A")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (grade.startsWith("B")) return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  if (grade.startsWith("C")) return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
  if (grade.startsWith("D")) return "bg-orange-500/15 text-orange-800 dark:text-orange-300";
  return "bg-destructive/15 text-destructive";
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

  useEffect(() => {
    setLoading(true);
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
        <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
          Marks / Results
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Published academic scores, term assessments, and official grading reports
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={academicYear} onValueChange={setAcademicYear}>
          <SelectTrigger className="w-36 h-9 rounded-xl bg-background border-input text-xs font-semibold text-foreground">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-popover border-border text-popover-foreground">
            <SelectItem value="all">All Years</SelectItem>
            <SelectItem value="2026/27">2026/27 (Active)</SelectItem>
            <SelectItem value="2025/26">2025/26</SelectItem>
            <SelectItem value="2024/25">2024/25</SelectItem>
          </SelectContent>
        </Select>

        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-32 h-9 rounded-xl bg-background border-input text-xs font-semibold text-foreground">
            <SelectValue placeholder="Term" />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-popover border-border text-popover-foreground">
            <SelectItem value="all">All Terms</SelectItem>
            <SelectItem value="term1">Term 1</SelectItem>
            <SelectItem value="term2">Term 2</SelectItem>
            <SelectItem value="term3">Term 3</SelectItem>
          </SelectContent>
        </Select>

        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-36 h-9 rounded-xl bg-background border-input text-xs font-semibold text-foreground">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-popover border-border text-popover-foreground">
            <SelectItem value="all">All Subjects</SelectItem>
            {subjectOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Marks Table */}
      <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Loading marks…
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <BookOpen className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">No marks available for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead>
                  <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold text-[11px] uppercase tracking-wide">
                    <th className="py-3.5 px-5 sticky left-0 bg-muted/90 z-10 whitespace-nowrap text-foreground">
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
                <tbody className="divide-y divide-border">
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
                        className="hover:bg-accent/40 transition-colors group"
                      >
                        {/* Subject name — sticky on mobile */}
                        <td className="py-3.5 px-5 sticky left-0 bg-card group-hover:bg-accent/40 transition-colors z-10 border-r border-border/50">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: s.subjectColor || "#6366f1" }}
                            />
                            <span className="font-bold text-foreground whitespace-nowrap">
                              {s.subjectName}
                            </span>
                          </div>
                        </td>

                        {/* One cell per assessment type */}
                        {assessmentTypes.map((type) => {
                          const entry = byType[type];
                          if (!entry) {
                            return (
                              <td key={type} className="py-3.5 px-4 text-center text-muted-foreground/40">
                                —
                              </td>
                            );
                          }
                          if (entry.isAbsent) {
                            return (
                              <td key={type} className="py-3.5 px-4 text-center">
                                <span className="text-[10px] font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-md">
                                  Absent
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={type} className="py-3.5 px-4 text-center">
                              <span className="font-semibold text-foreground font-mono tabular-nums">
                                {entry.score ?? "—"}/{entry.maxScore}
                              </span>
                              <span className="block text-[10px] text-muted-foreground mt-0.5">
                                {entry.percentage}%
                              </span>
                            </td>
                          );
                        })}

                        {/* Average */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-bold text-foreground font-mono tabular-nums">
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
            <div className="p-4 sm:px-6 bg-muted/60 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Overall Average
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-foreground font-mono">
                  {overallAvg}%
                </span>
                <span className="font-black text-xs px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-800 dark:text-purple-300">
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
