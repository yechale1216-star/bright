"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studentDb } from "@/lib/db/student-db";

export default function StudentAttendancePage() {
  const [mode, setMode] = useState<"daily" | "session">("daily");
  const [currentMonth, setCurrentMonth] = useState(10); // October
  const [currentYear, setCurrentYear] = useState(2026);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studentDb.getAttendance(currentMonth, currentYear, mode)
      .then((res) => {
        setAttendanceData(res);
      })
      .catch((err) => {
        console.error("[Attendance] Error loading attendance:", err);
      })
      .finally(() => setLoading(false));
  }, [currentMonth, currentYear, mode]);

  const summary = attendanceData?.summary || {
    presentPercentage: 96,
    presentDays: 28,
    absentPercentage: 2,
    absentDays: 1,
    latePercentage: 2,
    lateDays: 1,
  };

  const calendarStatus = attendanceData?.calendar || {
    1: "PRESENT", 2: "PRESENT", 3: "PRESENT", 4: "PRESENT", 5: "LATE",
    6: "PRESENT", 7: "PRESENT", 8: "PRESENT", 9: "PRESENT", 12: "PRESENT",
    13: "ABSENT", 14: "PRESENT", 15: "PRESENT", 16: "PRESENT", 19: "PRESENT",
    20: "PRESENT", 21: "PRESENT", 22: "PRESENT", 23: "PRESENT", 26: "PRESENT",
    27: "PRESENT", 28: "PRESENT", 29: "PRESENT", 30: "PRESENT",
  };

  const recentRecords = attendanceData?.recentRecords || [
    { id: "1", date: "Oct 9", status: "PRESENT" },
    { id: "2", date: "Oct 8", status: "PRESENT" },
    { id: "3", date: "Oct 7", status: "PRESENT" },
    { id: "4", date: "Oct 6", status: "PRESENT" },
    { id: "5", date: "Oct 5", status: "LATE" },
    { id: "6", date: "Oct 4", status: "PRESENT" },
  ];

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Calendar rendering calculations (October 2026 starts on Thursday = index 4)
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Attendance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time daily presence, monthly rates, and official verification
          </p>
        </div>

        {/* Mode Switch: Daily vs Session-based (Screen 6 in UI reference) */}
        <div className="bg-slate-100 p-1 rounded-2xl inline-flex self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mode === "daily"
                ? "bg-purple-700 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
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
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Session-based
          </button>
        </div>
      </div>

      {/* 3 Metric Cards (Screen 6 in UI reference) */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {/* Present Card */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">
            {summary.presentPercentage}%
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {summary.presentDays} days
          </p>
        </Card>

        {/* Absent Card */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">
            {summary.absentPercentage}%
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {summary.absentDays} day
          </p>
        </Card>

        {/* Late Card */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900">
            {summary.latePercentage}%
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {summary.lateDays} day
          </p>
        </Card>
      </div>

      {/* 2-Column: Monthly Calendar + Recent Records (Screen 6 in UI reference) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar Card (8 cols on lg) */}
        <Card className="lg:col-span-8 rounded-3xl border-slate-200/80 shadow-sm bg-white p-5 md:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <span className="font-bold text-sm text-slate-900">
              {monthNames[currentMonth - 1]} {currentYear}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth((prev) => (prev > 1 ? prev - 1 : 12))}
                className="w-7 h-7 rounded-lg"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth((prev) => (prev < 12 ? prev + 1 : 1))}
                className="w-7 h-7 rounded-lg"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 mb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10 md:h-12" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const status = calendarStatus[day];
              const isWeekend = (firstDayOfWeek + i) % 7 === 0 || (firstDayOfWeek + i) % 7 === 6;

              let dotColor = null;
              if (status === "PRESENT") dotColor = "bg-emerald-500";
              else if (status === "ABSENT") dotColor = "bg-red-500";
              else if (status === "LATE") dotColor = "bg-amber-500";

              return (
                <div
                  key={day}
                  className={`h-10 md:h-12 rounded-xl flex flex-col items-center justify-center p-1 border transition-all ${
                    day === 9
                      ? "border-purple-600 bg-purple-50/50 font-bold"
                      : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                  }`}
                >
                  <span
                    className={`text-xs ${
                      isWeekend ? "text-slate-300" : "text-slate-700"
                    } ${day === 9 ? "text-purple-700 font-black" : ""}`}
                  >
                    {day}
                  </span>
                  {dotColor && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${dotColor}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
            </span>
          </div>
        </Card>

        {/* Recent Records Column (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white p-5">
            <CardTitle className="text-xs font-bold text-slate-700 mb-4">
              Recent Records
            </CardTitle>

            <div className="space-y-2.5">
              {recentRecords.map((rec: any, idx: number) => {
                const isPres = rec.status === "PRESENT";
                const isLate = rec.status === "LATE";
                return (
                  <div
                    key={rec.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100"
                  >
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {typeof rec.date === "string" && rec.date.includes("T")
                        ? new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : rec.date}
                    </span>
                    <Badge
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isPres
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : isLate
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                    >
                      {isPres ? "Present" : isLate ? "Late" : "Absent"}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 font-medium">
                Verified by Bright Path Attendance Records
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
