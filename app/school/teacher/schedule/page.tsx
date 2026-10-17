"use client";

import React, { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, BookOpen, MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timetableDb, type TimetableSlotData } from "@/lib/db/timetable-db";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_MAP = Object.fromEntries(DAYS_SHORT.map((s, i) => [s, DAYS_FULL[i]]));

const DEFAULT_PERIODS = [
  { periodNumber: 1, time: "08:30 - 09:15", label: "P1" },
  { periodNumber: 2, time: "09:20 - 10:05", label: "P2" },
  { periodNumber: 3, time: "10:30 - 11:15", label: "P3" },
  { periodNumber: 4, time: "11:20 - 12:05", label: "P4" },
  { periodNumber: 5, time: "01:10 - 01:55", label: "P5" },
  { periodNumber: 6, time: "02:00 - 02:45", label: "P6" },
];

export default function TeacherSchedulePage() {
  const [schedule, setSchedule] = useState<Record<string, TimetableSlotData[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMobileDay, setSelectedMobileDay] = useState("Mon");

  useEffect(() => {
    timetableDb
      .getMySchedule()
      .then((data) => setSchedule(data))
      .catch((err) => {
        console.error("[TeacherSchedule] Error:", err);
        setError("Unable to load your schedule. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  const getSlot = (day: string, periodNumber: number): TimetableSlotData | null => {
    const fullDay = DAY_MAP[day];
    const daySlots = schedule[fullDay];
    if (!Array.isArray(daySlots)) return null;
    return daySlots.find((s) => s.periodNumber === periodNumber) || null;
  };

  const totalClasses = Object.values(schedule).reduce((sum, slots) => sum + (slots?.length || 0), 0);

  const subjectsSeen = new Set<string>();
  const uniqueSubjects: { name: string; color?: string }[] = [];
  Object.values(schedule).forEach((slots) => {
    slots?.forEach((s) => {
      const name = s.subject?.name || "Unknown";
      if (!subjectsSeen.has(name)) {
        subjectsSeen.add(name);
        uniqueSubjects.push({ name, color: s.subject?.color });
      }
    });
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-5 h-5 text-primary" />
            <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
              My Weekly Schedule
            </h1>
            {!loading && totalClasses > 0 && (
              <Badge className="bg-emerald-600 text-white font-semibold text-[10px]">
                {totalClasses} periods/week
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your published teaching schedule across all assigned classes
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-2xl border shadow-2xs self-start sm:self-auto">
          <Button variant="ghost" size="icon" className="w-6 h-6 rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-foreground">This Week</span>
          <Button variant="ghost" size="icon" className="w-6 h-6 rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ─── Stats strip ────────────────────────────────────────────────── */}
      {!loading && uniqueSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uniqueSubjects.map((sub) => (
            <div
              key={sub.name}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold"
              style={
                sub.color
                  ? { backgroundColor: `${sub.color}15`, borderColor: `${sub.color}40`, color: sub.color }
                  : undefined
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: sub.color || "#6d28d9" }}
              />
              {sub.name}
            </div>
          ))}
        </div>
      )}

      {/* ─── Error state ────────────────────────────────────────────────── */}
      {error && (
        <Card className="rounded-3xl border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center text-sm text-destructive font-medium">
            {error}
          </CardContent>
        </Card>
      )}

      {/* ─── Desktop Weekly Grid ─────────────────────────────────────────── */}
      <Card className="hidden md:block rounded-3xl border shadow-sm bg-card overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground">
                    <th className="py-3.5 px-4 text-left w-32">Period</th>
                    {DAYS_SHORT.map((day) => (
                      <th key={day} className="py-3.5 px-3">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {DEFAULT_PERIODS.map((period) => (
                    <tr key={period.periodNumber} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-left bg-muted/20">
                        <div className="font-bold text-foreground text-[11px]">{period.label}</div>
                        <div className="text-muted-foreground font-mono text-[10px]">{period.time}</div>
                      </td>
                      {DAYS_SHORT.map((day) => {
                        const slot = getSlot(day, period.periodNumber);
                        const color = slot?.subject?.color;
                        return (
                          <td key={`${day}-${period.periodNumber}`} className="py-2 px-1.5">
                            {slot ? (
                              <div
                                className="p-2 rounded-xl border text-center transition-all hover:scale-[1.03] shadow-2xs"
                                style={
                                  color
                                    ? {
                                        backgroundColor: `${color}15`,
                                        borderColor: `${color}40`,
                                        color,
                                      }
                                    : { backgroundColor: "hsl(var(--primary)/0.08)", borderColor: "hsl(var(--primary)/0.25)", color: "hsl(var(--primary))" }
                                }
                              >
                                <p className="font-extrabold text-[11px] leading-none truncate max-w-[80px] mx-auto">
                                  {slot.subject?.name || "—"}
                                </p>
                                <p className="text-[9px] opacity-75 mt-0.5 font-medium truncate max-w-[80px] mx-auto">
                                  {slot.classroom?.name || "TBA"}
                                </p>
                                {slot.grade && (
                                  <span className="text-[8px] font-bold opacity-60 mt-0.5 inline-block">
                                    {(slot as any).grade?.name || ""} {(slot as any).section?.name || ""}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Mobile Day View ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-4">
        {/* Day tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {DAYS_SHORT.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedMobileDay(day)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedMobileDay === day
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Slots for selected day */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {DEFAULT_PERIODS.map((period) => {
              const slot = getSlot(selectedMobileDay, period.periodNumber);
              if (!slot) return null;
              const color = slot?.subject?.color || "#6d28d9";
              return (
                <div
                  key={`mob-${period.periodNumber}`}
                  className="p-3.5 rounded-2xl bg-card border shadow-2xs flex items-center justify-between gap-3"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="text-left font-mono font-bold text-[10px] px-2 py-1 rounded-lg shrink-0"
                      style={{ color, backgroundColor: `${color}15` }}
                    >
                      {period.time}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {slot.subject?.name || "—"}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {slot.classroom?.name || "TBA"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[9px] font-bold">
                      {(slot as any).grade?.name || ""} {(slot as any).section?.name || ""}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {DEFAULT_PERIODS.every((p) => !getSlot(selectedMobileDay, p.periodNumber)) && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No classes on {selectedMobileDay}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
