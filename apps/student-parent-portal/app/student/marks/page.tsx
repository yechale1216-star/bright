"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  Filter,
  Layers,
  ChevronDown,
  TrendingUp,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentDb } from "@/lib/db/student-db";

export default function StudentMarksPage() {
  const [academicYear, setAcademicYear] = useState("2026/27");
  const [term, setTerm] = useState("term1");
  const [subject, setSubject] = useState("all");
  const [marksData, setMarksData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studentDb.getMarks(academicYear, term, subject)
      .then((res) => {
        setMarksData(res);
      })
      .catch((err) => {
        console.error("[Marks] Error fetching marks:", err);
      })
      .finally(() => setLoading(false));
  }, [academicYear, term, subject]);

  const marksList = marksData?.marks || [
    { id: "1", subject: "Mathematics", assessment: "Midterm", score: 85, maxScore: 100, scoreDisplay: "85/100", grade: "A" },
    { id: "2", subject: "Mathematics", assessment: "Final", score: 88, maxScore: 100, scoreDisplay: "88/100", grade: "A" },
    { id: "3", subject: "Physics", assessment: "Midterm", score: 78, maxScore: 100, scoreDisplay: "78/100", grade: "B+" },
    { id: "4", subject: "Physics", assessment: "Final", score: 82, maxScore: 100, scoreDisplay: "82/100", grade: "A-" },
    { id: "5", subject: "English", assessment: "Midterm", score: 92, maxScore: 100, scoreDisplay: "92/100", grade: "A+" },
    { id: "6", subject: "English", assessment: "Final", score: 90, maxScore: 100, scoreDisplay: "90/100", grade: "A" },
    { id: "7", subject: "Chemistry", assessment: "Midterm", score: 88, maxScore: 100, scoreDisplay: "88/100", grade: "A" },
    { id: "8", subject: "Chemistry", assessment: "Final", score: 86, maxScore: 100, scoreDisplay: "86/100", grade: "A" },
    { id: "9", subject: "Biology", assessment: "Midterm", score: 80, maxScore: 100, scoreDisplay: "80/100", grade: "A-" },
    { id: "10", subject: "Biology", assessment: "Final", score: 84, maxScore: 100, scoreDisplay: "84/100", grade: "A-" },
  ];

  const overallAvg = marksData?.overallAverage ?? 82.6;
  const gradeLetter = marksData?.gradeLetter ?? "A-";

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Marks / Results
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Published academic scores, term assessments, and official grading reports
        </p>
      </div>

      {/* Filter Row (Screen 5 in UI reference) */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Academic Year Filter */}
        <Select value={academicYear} onValueChange={setAcademicYear}>
          <SelectTrigger className="w-36 h-9 rounded-xl bg-white border-slate-200 text-xs font-semibold text-slate-800">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="2026/27">2026/27 (Active)</SelectItem>
            <SelectItem value="2025/26">2025/26</SelectItem>
            <SelectItem value="2024/25">2024/25</SelectItem>
          </SelectContent>
        </Select>

        {/* Term Filter */}
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-32 h-9 rounded-xl bg-white border-slate-200 text-xs font-semibold text-slate-800">
            <SelectValue placeholder="Term" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="term1">Term 1</SelectItem>
            <SelectItem value="term2">Term 2</SelectItem>
            <SelectItem value="all">All Terms</SelectItem>
          </SelectContent>
        </Select>

        {/* Subject Filter */}
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-36 h-9 rounded-xl bg-white border-slate-200 text-xs font-semibold text-slate-800">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Subjects</SelectItem>
            <SelectItem value="math">Mathematics</SelectItem>
            <SelectItem value="phys">Physics</SelectItem>
            <SelectItem value="chem">Chemistry</SelectItem>
            <SelectItem value="bio">Biology</SelectItem>
            <SelectItem value="eng">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Marks Table Card (Screen 5 in UI reference) */}
      <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold text-[11px]">
                  <th className="py-3.5 px-6">Subject</th>
                  <th className="py-3.5 px-6">Assessment</th>
                  <th className="py-3.5 px-6">Score</th>
                  <th className="py-3.5 px-6 text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marksList.map((m: any, idx: number) => (
                  <tr key={m.id || idx} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {m.subject}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 font-medium">
                      {m.assessment}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-800 font-mono">
                      {m.scoreDisplay || `${m.score}/100`}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span
                        className={`inline-block font-black text-xs px-2.5 py-0.5 rounded-md ${
                          m.grade?.startsWith("A")
                            ? "bg-emerald-50 text-emerald-700"
                            : m.grade?.startsWith("B")
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
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

          {/* Bottom Summary Bar (Screen 5 in UI reference) */}
          <div className="p-4 sm:px-6 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Overall Average
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-slate-900 font-mono">
                {overallAvg}%
              </span>
              <span className="font-black text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                {gradeLetter}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
