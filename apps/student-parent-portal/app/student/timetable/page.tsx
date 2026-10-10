"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  MapPin,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studentDb } from "@/lib/db/student-db";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const PERIODS = [
  { id: 1, time: "08:30 - 09:15", name: "Period 1" },
  { id: 2, time: "09:20 - 10:05", name: "Period 2" },
  { id: 3, time: "10:30 - 11:15", name: "Period 3" },
  { id: 4, time: "12:00 - 01:00", name: "Period 4" },
  { id: 5, time: "02:00 - 03:00", name: "Period 5" },
];

export default function StudentTimetablePage() {
  const [timetableData, setTimetableData] = useState<any>(null);
  const [selectedMobileDay, setSelectedMobileDay] = useState("Mon");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentDb.getTimetable()
      .then((res) => {
        setTimetableData(res);
      })
      .catch((err) => {
        console.error("[Timetable] Error loading timetable:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Standard schedule blocks for default view matching UI reference panel 7
  const defaultSchedule: Record<string, Record<number, { subject: string; color: string; teacher: string; room: string }>> = {
    Mon: {
      1: { subject: "Math", color: "bg-amber-100 text-amber-900 border-amber-200", teacher: "W/ro. Sara Y.", room: "102" },
      2: { subject: "Phys", color: "bg-blue-100 text-blue-900 border-blue-200", teacher: "Ato Abebe K.", room: "102" },
      3: { subject: "Eng", color: "bg-red-100 text-red-900 border-red-200", teacher: "W/ro. Selam B.", room: "101" },
      4: { subject: "Chem", color: "bg-teal-100 text-teal-900 border-teal-200", teacher: "W/ro. Mihret A.", room: "201" },
      5: { subject: "Bio", color: "bg-emerald-100 text-emerald-900 border-emerald-200", teacher: "Ato Getachew T.", room: "204" },
    },
    Tue: {
      1: { subject: "Phys", color: "bg-blue-100 text-blue-900 border-blue-200", teacher: "Ato Abebe K.", room: "102" },
      2: { subject: "Math", color: "bg-amber-100 text-amber-900 border-amber-200", teacher: "W/ro. Sara Y.", room: "102" },
      3: { subject: "Chem", color: "bg-teal-100 text-teal-900 border-teal-200", teacher: "W/ro. Mihret A.", room: "201" },
      4: { subject: "Eng", color: "bg-red-100 text-red-900 border-red-200", teacher: "W/ro. Selam B.", room: "101" },
      5: { subject: "Geo", color: "bg-purple-100 text-purple-900 border-purple-200", teacher: "Ato Daniel F.", room: "103" },
    },
    Wed: {
      1: { subject: "Bio", color: "bg-emerald-100 text-emerald-900 border-emerald-200", teacher: "Ato Getachew T.", room: "204" },
      2: { subject: "Chem", color: "bg-teal-100 text-teal-900 border-teal-200", teacher: "W/ro. Mihret A.", room: "201" },
      3: { subject: "Math", color: "bg-amber-100 text-amber-900 border-amber-200", teacher: "W/ro. Sara Y.", room: "102" },
      4: { subject: "Phys", color: "bg-blue-100 text-blue-900 border-blue-200", teacher: "Ato Abebe K.", room: "102" },
      5: { subject: "Eng", color: "bg-red-100 text-red-900 border-red-200", teacher: "W/ro. Selam B.", room: "101" },
    },
    Thu: {
      1: { subject: "Eng", color: "bg-red-100 text-red-900 border-red-200", teacher: "W/ro. Selam B.", room: "101" },
      2: { subject: "Phys", color: "bg-blue-100 text-blue-900 border-blue-200", teacher: "Ato Abebe K.", room: "102" },
      3: { subject: "Bio", color: "bg-emerald-100 text-emerald-900 border-emerald-200", teacher: "Ato Getachew T.", room: "204" },
      4: { subject: "Math", color: "bg-amber-100 text-amber-900 border-amber-200", teacher: "W/ro. Sara Y.", room: "102" },
      5: { subject: "Chem", color: "bg-teal-100 text-teal-900 border-teal-200", teacher: "W/ro. Mihret A.", room: "201" },
    },
    Fri: {
      1: { subject: "Math", color: "bg-amber-100 text-amber-900 border-amber-200", teacher: "W/ro. Sara Y.", room: "102" },
      2: { subject: "Geo", color: "bg-purple-100 text-purple-900 border-purple-200", teacher: "Ato Daniel F.", room: "103" },
      3: { subject: "Chem", color: "bg-teal-100 text-teal-900 border-teal-200", teacher: "W/ro. Mihret A.", room: "201" },
      4: { subject: "Bio", color: "bg-emerald-100 text-emerald-900 border-emerald-200", teacher: "Ato Getachew T.", room: "204" },
      5: { subject: "Phys", color: "bg-blue-100 text-blue-900 border-blue-200", teacher: "Ato Abebe K.", room: "102" },
    },
    Sat: {
      1: { subject: "Tutorial", color: "bg-slate-100 text-slate-800 border-slate-200", teacher: "Faculty", room: "Hall A" },
      2: { subject: "Club", color: "bg-slate-100 text-slate-800 border-slate-200", teacher: "Staff", room: "Lab" },
    },
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Weekly Timetable
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active class schedule, period times, subject classrooms, and assigned teachers
          </p>
        </div>

        {/* Week Switcher (Screen 7 in UI reference) */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs self-start sm:self-auto">
          <Button variant="ghost" size="icon" className="w-6 h-6 rounded-lg text-slate-500 hover:text-slate-900">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-slate-700">
            Oct 6 - Oct 12, 2026
          </span>
          <Button variant="ghost" size="icon" className="w-6 h-6 rounded-lg text-slate-500 hover:text-slate-900">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ─── Desktop Weekly Grid (Screen 7 in UI reference) ─────────────── */}
      <Card className="hidden md:block rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-bold text-slate-500">
                  <th className="py-3.5 px-4 text-left font-bold text-slate-700 w-36">Time</th>
                  {DAYS.map((day) => (
                    <th key={day} className="py-3.5 px-3">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {PERIODS.map((period) => (
                  <tr key={period.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-4 text-left font-mono font-bold text-slate-700 bg-slate-50/40">
                      <div>{period.time}</div>
                      <span className="text-[10px] text-slate-400 font-sans font-normal">{period.name}</span>
                    </td>
                    {DAYS.map((day) => {
                      const item = defaultSchedule[day]?.[period.id];
                      return (
                        <td key={`${day}-${period.id}`} className="py-3 px-2">
                          {item ? (
                            <div className={`p-2.5 rounded-xl border text-center transition-all hover:scale-[1.02] shadow-2xs ${item.color}`}>
                              <p className="font-extrabold text-xs leading-none">{item.subject}</p>
                              <p className="text-[10px] opacity-80 mt-1 font-medium leading-none truncate">{item.teacher}</p>
                              <span className="inline-block text-[9px] font-bold opacity-75 mt-0.5">Room {item.room}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs font-light">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Mobile Day Tabs & Cards (Panel 11 in UI reference) ─────────── */}
      <div className="md:hidden space-y-4">
        {/* Day selection pill tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedMobileDay(day)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedMobileDay === day
                  ? "bg-purple-700 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Schedule cards for selected day */}
        <div className="space-y-2.5">
          {PERIODS.map((period) => {
            const item = defaultSchedule[selectedMobileDay]?.[period.id];
            if (!item) return null;

            return (
              <div
                key={`mob-${period.id}`}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-left font-mono font-bold text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                    {period.time}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.subject}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{item.teacher}</p>
                  </div>
                </div>

                <Badge variant="outline" className="text-[10px] font-bold border-slate-200">
                  Room {item.room}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
