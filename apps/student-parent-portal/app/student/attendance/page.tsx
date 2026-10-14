"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studentDb } from "@/lib/db/student-db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  date: string; // ISO string from API
  status: "PRESENT" | "ABSENT" | "LATE";
  session?: string | null;
  remarks?: string | null;
}

interface AttendanceSummary {
  present: number;   // raw count from API
  absent: number;
  late: number;
  total: number;
  percentage: number;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function navigateMonth(month: number, year: number, delta: number) {
  let m = month + delta;
  let y = year;
  if (m > 12) { m = 1;  y += 1; }
  if (m < 1)  { m = 12; y -= 1; }
  return { month: m, year: y };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentAttendancePage() {
  const now = new Date();

  const [mode, setMode] = useState<"daily" | "session">("daily");
  // Default to actual current month/year (not hardcoded)
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear]   = useState(now.getFullYear());
  const [rawData, setRawData]           = useState<{ records: AttendanceRecord[]; summary: AttendanceSummary } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // ── Fetch whenever month / year / mode changes ──────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    studentDb
      .getAttendance(currentMonth, currentYear, mode)
      .then((res: any) => {
        setRawData(res);
      })
      .catch((err: any) => {
        console.warn("[Attendance] Error loading attendance:", err?.message || err);
        setError(err?.message || "Failed to load attendance data.");
      })
      .finally(() => setLoading(false));
  }, [currentMonth, currentYear, mode]);

  // ── Build calendar day→status map from records[] ───────────────────────────
  const calendarStatus = useMemo<Record<number, string>>(() => {
    if (!rawData?.records) return {};
    const map: Record<number, string> = {};
    for (const rec of rawData.records) {
      try {
        const d = new Date(rec.date);
        if (d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear) {
          map[d.getDate()] = rec.status;
        }
      } catch { /* ignore bad dates */ }
    }
    return map;
  }, [rawData, currentMonth, currentYear]);

  // ── Build sorted recent records list ───────────────────────────────────────
  const recentRecords = useMemo<AttendanceRecord[]>(() => {
    if (!rawData?.records?.length) return [];
    return [...rawData.records]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [rawData]);

  // ── Compute display-safe summary (handle field name difference) ────────────
  // API returns: { present, absent, late, total, percentage }
  // UI was previously expecting: { presentDays, presentPercentage, ... }
  const summary = useMemo(() => {
    if (!rawData?.summary) {
      return { presentPct: 0, presentDays: 0, absentPct: 0, absentDays: 0, latePct: 0, lateDays: 0, total: 0, percentage: 0 };
    }
    const s = rawData.summary;
    const total = s.total > 0 ? s.total : 1;
    return {
      presentPct:  Math.round((s.present / total) * 100),
      presentDays: s.present,
      absentPct:   Math.round((s.absent  / total) * 100),
      absentDays:  s.absent,
      latePct:     Math.round((s.late    / total) * 100),
      lateDays:    s.late,
      total:       s.total,
      percentage:  s.percentage,
    };
  }, [rawData]);

  // ── Calendar math ──────────────────────────────────────────────────────────
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth    = new Date(currentYear, currentMonth, 0).getDate();
  const todayDay       = now.getDate();
  const isCurrentMY   = currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear();

  const handlePrev = () => {
    const n = navigateMonth(currentMonth, currentYear, -1);
    setCurrentMonth(n.month);
    setCurrentYear(n.year);
  };
  const handleNext = () => {
    const n = navigateMonth(currentMonth, currentYear, +1);
    setCurrentMonth(n.month);
    setCurrentYear(n.year);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* ── Header + Mode Toggle ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Attendance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time daily presence, monthly rates, and official verification
          </p>
        </div>

        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl inline-flex self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mode === "daily"
                ? "bg-purple-700 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setMode("session")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mode === "session"
                ? "bg-purple-700 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Session-based
          </button>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 3 Metric Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/90 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
          </div>
          {loading ? (
            <div className="h-8 w-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md mt-1" />
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{summary.presentPct}%</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{summary.presentDays} {summary.presentDays === 1 ? "day" : "days"}</p>
            </>
          )}
        </Card>

        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/90 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent
          </div>
          {loading ? (
            <div className="h-8 w-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md mt-1" />
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{summary.absentPct}%</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{summary.absentDays} {summary.absentDays === 1 ? "day" : "days"}</p>
            </>
          )}
        </Card>

        <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/90 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
          </div>
          {loading ? (
            <div className="h-8 w-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md mt-1" />
          ) : (
            <>
              <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{summary.latePct}%</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{summary.lateDays} {summary.lateDays === 1 ? "day" : "days"}</p>
            </>
          )}
        </Card>
      </div>

      {/* ── 2-Column: Calendar + Recent Records ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar */}
        <Card className="lg:col-span-8 rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/90 p-5 md:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={handlePrev} className="w-7 h-7 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" aria-label="Previous month">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext} className="w-7 h-7 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" aria-label="Next month">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span>
            <span>Thu</span><span>Fri</span><span>Sat</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-10 md:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 md:h-12" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const status = calendarStatus[day];
                const colIdx = (firstDayOfWeek + i) % 7;
                const isWeekend = colIdx === 0 || colIdx === 6;
                const isToday = isCurrentMY && day === todayDay;

                let dotColor: string | null = null;
                if (status === "PRESENT") dotColor = "bg-emerald-500";
                else if (status === "ABSENT") dotColor = "bg-red-500";
                else if (status === "LATE")   dotColor = "bg-amber-500";

                return (
                  <div
                    key={day}
                    title={status ? `${MONTH_NAMES[currentMonth - 1]} ${day}: ${status}` : undefined}
                    className={`h-10 md:h-12 rounded-xl flex flex-col items-center justify-center p-1 border transition-all ${
                      isToday
                        ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 font-bold"
                        : status === "ABSENT"
                        ? "border-red-100 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/20"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30"
                    }`}
                  >
                    <span className={`text-xs ${isWeekend ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"} ${isToday ? "text-purple-700 dark:text-purple-400 font-black" : ""}`}>
                      {day}
                    </span>
                    {dotColor && <span className={`w-1.5 h-1.5 rounded-full mt-1 ${dotColor}`} />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
            <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late</span>
          </div>
        </Card>

        {/* Recent Records */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/90 p-5">
            <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-4">Recent Records</CardTitle>

            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : recentRecords.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No attendance records found for this period.</p>
            ) : (
              <div className="space-y-2.5">
                {recentRecords.map((rec, idx) => {
                  const isPres = rec.status === "PRESENT";
                  const isLate = rec.status === "LATE";
                  let dateLabel: string;
                  try {
                    dateLabel = new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  } catch {
                    dateLabel = rec.date;
                  }
                  return (
                    <div
                      key={rec.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">{dateLabel}</span>
                        {rec.session && (
                          <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500 capitalize">{rec.session}</span>
                        )}
                      </div>
                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isPres
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : isLate
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
                        }`}
                      >
                        {isPres ? "Present" : isLate ? "Late" : "Absent"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
              {!loading && rawData && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {summary.total} record{summary.total !== 1 ? "s" : ""} · {summary.percentage}% attendance rate
                </p>
              )}
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                Verified by Bright Path Attendance Records
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
