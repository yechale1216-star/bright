"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Building2,
  BookOpen,
  Layers,
  Filter,
  Printer,
  ChevronDown,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Search,
  Eye,
  RefreshCw,
  X,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { db } from "@/lib/db/database";
import {
  timetableDb,
  type TimetableHeader,
  type TimetableDetail,
  type TimetableSlotData,
  type TimetablePeriod,
  type Classroom,
  type ConflictCheckResult,
} from "@/lib/db/timetable-db";
import { notifications } from "@/lib/utils/notifications";
import { cn } from "@/lib/utils/utils";

const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

interface TimetableManagementProps {
  initialGradeId?: string;
  initialSectionId?: string;
}

export function TimetableManagement({
  initialGradeId,
  initialSectionId,
}: TimetableManagementProps) {
  // ─── Main State ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"class" | "teacher" | "room" | "list">("class");
  const [timetables, setTimetables] = useState<TimetableHeader[]>([]);
  const [activeTimetable, setActiveTimetable] = useState<TimetableDetail | null>(null);
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  // Metadata dependencies
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  // Filters
  const [selectedGradeId, setSelectedGradeId] = useState<string>(initialGradeId || "all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSectionId || "all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Dialog States ─────────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [periodsDialogOpen, setPeriodsDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlotData | null>(null);

  // Form states for Create Timetable
  const [newTitle, setNewTitle] = useState("");
  const [newGradeId, setNewGradeId] = useState("");
  const [newSectionId, setNewSectionId] = useState("");
  const [newStreamId, setNewStreamId] = useState("");

  // Form states for Slot Editor
  const [slotDay, setSlotDay] = useState("MONDAY");
  const [slotPeriodNumber, setSlotPeriodNumber] = useState(1);
  const [slotSubjectId, setSlotSubjectId] = useState("");
  const [slotTeacherId, setSlotTeacherId] = useState("");
  const [slotRoomId, setSlotRoomId] = useState("");
  const [slotSubstituteId, setSlotSubstituteId] = useState("");
  const [slotNotes, setSlotNotes] = useState("");
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  // ─── Initial Data Fetch ────────────────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        fetchedTimetables,
        fetchedPeriods,
        fetchedRooms,
        fetchedGrades,
        fetchedSections,
        fetchedStreams,
        fetchedSubjects,
        fetchedTeachers,
      ] = await Promise.all([
        timetableDb.listTimetables(),
        timetableDb.getPeriods(),
        timetableDb.getClassrooms(),
        db.getGrades().catch(() => [
          { id: "g9", name: "Grade 9" },
          { id: "g10", name: "Grade 10" },
          { id: "g11", name: "Grade 11" },
          { id: "g12", name: "Grade 12" },
        ]),
        db.getSections().catch(() => [
          { id: "sec-a", name: "Section A" },
          { id: "sec-b", name: "Section B" },
          { id: "sec-c", name: "Section C" },
        ]),
        db.getStreams().catch(() => [
          { id: "stream-nat", name: "Natural Science" },
          { id: "stream-soc", name: "Social Science" },
        ]),
        db.getSubjects().catch(() => [
          { id: "sub-math", name: "Mathematics", code: "MATH", color: "#f59e0b" },
          { id: "sub-phys", name: "Physics", code: "PHYS", color: "#3b82f6" },
          { id: "sub-chem", name: "Chemistry", code: "CHEM", color: "#06b6d4" },
          { id: "sub-bio", name: "Biology", code: "BIO", color: "#10b981" },
          { id: "sub-eng", name: "English", code: "ENG", color: "#ef4444" },
          { id: "sub-geo", name: "Geography", code: "GEO", color: "#8b5cf6" },
        ]),
        db.getTeachers(true).catch(() => [
          { id: "t-1", name: "W/ro. Sara Yimer" },
          { id: "t-2", name: "Ato Abebe Kebede" },
          { id: "t-3", name: "W/ro. Selam Bekele" },
          { id: "t-4", name: "W/ro. Mihret Alem" },
          { id: "t-5", name: "Ato Getachew Tadesse" },
          { id: "t-6", name: "Ato Daniel Fikru" },
        ]),
      ]);

      setTimetables(fetchedTimetables);
      setPeriods(fetchedPeriods);
      setClassrooms(fetchedRooms);
      setGrades(fetchedGrades);
      setSections(fetchedSections);
      setStreams(fetchedStreams);
      setSubjects(fetchedSubjects);
      setTeachers(fetchedTeachers);

      // Select first timetable as active if available
      if (fetchedTimetables.length > 0) {
        const detail = await timetableDb.getTimetableById(fetchedTimetables[0].id);
        setActiveTimetable(detail);
        if (detail?.gradeId) setSelectedGradeId(detail.gradeId);
        if (detail?.sectionId) setSelectedSectionId(detail.sectionId);
      }
    } catch (err: any) {
      console.error("[TimetableManagement] Load error:", err);
      notifications.error("Failed to load timetables", err.message || "Please refresh");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load detailed timetable when active selection changes
  const handleSelectTimetable = async (id: string) => {
    try {
      setActionLoading(true);
      const detail = await timetableDb.getTimetableById(id);
      setActiveTimetable(detail);
      if (detail?.gradeId) setSelectedGradeId(detail.gradeId);
      if (detail?.sectionId) setSelectedSectionId(detail.sectionId);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Slot Map for Grid Representation ──────────────────────────────────────
  // Key: `${DAY}_${PERIOD_NUMBER}`
  const slotGridMap = useMemo(() => {
    const map: Record<string, TimetableSlotData> = {};
    if (!activeTimetable?.slots) return map;
    for (const slot of activeTimetable.slots) {
      const key = `${slot.dayOfWeek.toUpperCase()}_${slot.periodNumber}`;
      map[key] = slot;
    }
    return map;
  }, [activeTimetable]);

  // ─── Conflict Check Runner ─────────────────────────────────────────────────
  const runConflictCheck = useCallback(
    async (day: string, periodNum: number, teacherId?: string, roomId?: string) => {
      if (!teacherId && !roomId) {
        setConflictResult(null);
        return;
      }
      try {
        setCheckingConflict(true);
        const res = await timetableDb.checkConflict({
          dayOfWeek: day,
          periodNumber: periodNum,
          teacherId: teacherId || null,
          classroomId: roomId || null,
          gradeId: activeTimetable?.gradeId,
          sectionId: activeTimetable?.sectionId || undefined,
          excludeSlotId: editingSlot?.id,
        });
        setConflictResult(res);
      } catch (err) {
        console.error("Conflict check error:", err);
      } finally {
        setCheckingConflict(false);
      }
    },
    [activeTimetable, editingSlot]
  );

  // Trigger conflict check when teacher or room changes in editor
  useEffect(() => {
    if (slotDialogOpen) {
      runConflictCheck(slotDay, slotPeriodNumber, slotTeacherId, slotRoomId);
    }
  }, [slotDay, slotPeriodNumber, slotTeacherId, slotRoomId, slotDialogOpen, runConflictCheck]);

  // ─── Create Timetable Handler ──────────────────────────────────────────────
  const handleCreateTimetable = async () => {
    if (!newTitle.trim() || !newGradeId) {
      notifications.error("Validation Error", "Please provide a Title and select a Grade.");
      return;
    }

    try {
      setActionLoading(true);
      const created = await timetableDb.createTimetable({
        title: newTitle.trim(),
        gradeId: newGradeId,
        sectionId: newSectionId || undefined,
        streamId: newStreamId || undefined,
      });

      notifications.success("Timetable Created", `Created "${created.title}" as DRAFT.`);
      setCreateDialogOpen(false);
      setNewTitle("");
      setNewGradeId("");
      setNewSectionId("");
      setNewStreamId("");

      const refreshed = await timetableDb.listTimetables();
      setTimetables(refreshed);
      await handleSelectTimetable(created.id);
    } catch (err: any) {
      notifications.error("Error", err.message || "Failed to create timetable");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Publish / Status Handler ──────────────────────────────────────────────
  const handlePublishTimetable = async () => {
    if (!activeTimetable) return;

    const isPublishing = activeTimetable.status !== "PUBLISHED";
    const newStatus = isPublishing ? "PUBLISHED" : "DRAFT";

    try {
      setActionLoading(true);
      await timetableDb.updateTimetable(activeTimetable.id, {
        status: newStatus,
      });

      setActiveTimetable((prev) => (prev ? { ...prev, status: newStatus } : null));
      notifications.success(
        isPublishing ? "Timetable Published" : "Reverted to Draft",
        isPublishing
          ? "This schedule is now live and visible to students and teachers!"
          : "Timetable reverted to draft mode."
      );

      const refreshed = await timetableDb.listTimetables();
      setTimetables(refreshed);
    } catch (err: any) {
      notifications.error("Action Failed", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Slot Dialog Openers ───────────────────────────────────────────────────
  const openAddSlot = (day: string, periodNumber: number) => {
    const periodObj = periods.find((p) => p.periodNumber === periodNumber);
    setEditingSlot(null);
    setSlotDay(day);
    setSlotPeriodNumber(periodNumber);
    setSlotSubjectId(subjects[0]?.id || "");
    setSlotTeacherId(teachers[0]?.id || "");
    setSlotRoomId(classrooms[0]?.id || "");
    setSlotSubstituteId("");
    setSlotNotes("");
    setConflictResult(null);
    setSlotDialogOpen(true);
  };

  const openEditSlot = (slot: TimetableSlotData) => {
    setEditingSlot(slot);
    setSlotDay(slot.dayOfWeek);
    setSlotPeriodNumber(slot.periodNumber);
    setSlotSubjectId(slot.subjectId);
    setSlotTeacherId(slot.teacherId || "");
    setSlotRoomId(slot.classroomId || "");
    setSlotSubstituteId(slot.substituteTeacherId || "");
    setSlotNotes(slot.notes || "");
    setConflictResult(null);
    setSlotDialogOpen(true);
  };

  // ─── Save Slot Handler ─────────────────────────────────────────────────────
  const handleSaveSlot = async () => {
    if (!activeTimetable) return;
    if (!slotSubjectId) {
      notifications.error("Missing Subject", "Please select a subject.");
      return;
    }

    const currentPeriod = periods.find((p) => p.periodNumber === slotPeriodNumber);

    try {
      setActionLoading(true);
      await timetableDb.upsertSlot(activeTimetable.id, {
        slotId: editingSlot?.id,
        dayOfWeek: slotDay,
        periodNumber: slotPeriodNumber,
        periodId: currentPeriod?.id,
        startTime: currentPeriod?.startTime || "08:30",
        endTime: currentPeriod?.endTime || "09:15",
        subjectId: slotSubjectId,
        teacherId: slotTeacherId || null,
        classroomId: slotRoomId || null,
        gradeId: activeTimetable.gradeId,
        sectionId: activeTimetable.sectionId || "sec-a",
        streamId: activeTimetable.streamId || null,
        notes: slotNotes || null,
        substituteTeacherId: slotSubstituteId || null,
      });

      notifications.success(
        editingSlot ? "Period Updated" : "Period Scheduled",
        `${DAY_LABELS[slotDay]} Period ${slotPeriodNumber} saved successfully.`
      );
      setSlotDialogOpen(false);

      // Refresh timetable detail
      const updated = await timetableDb.getTimetableById(activeTimetable.id);
      setActiveTimetable(updated);
    } catch (err: any) {
      notifications.error("Cannot Save Slot", err.message || "Conflict or network error");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Delete Slot Handler ───────────────────────────────────────────────────
  const handleDeleteSlot = async (slotId: string) => {
    if (!activeTimetable) return;
    if (!confirm("Are you sure you want to remove this scheduled class period?")) return;

    try {
      setActionLoading(true);
      await timetableDb.deleteSlot(activeTimetable.id, slotId);
      notifications.success("Period Removed", "The period slot has been cleared.");

      const updated = await timetableDb.getTimetableById(activeTimetable.id);
      setActiveTimetable(updated);
    } catch (err: any) {
      notifications.error("Error", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Teacher Matrix Filtering ──────────────────────────────────────────────
  const teacherSlots = useMemo(() => {
    if (!activeTimetable || selectedTeacherId === "all") return [];
    return activeTimetable.slots.filter(
      (s) => s.teacherId === selectedTeacherId || s.substituteTeacherId === selectedTeacherId
    );
  }, [activeTimetable, selectedTeacherId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-16">
      {/* ─── Hero Header & Action Banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white p-6 md:p-8 shadow-xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-white border border-white/20 mb-3">
              <CalendarDays className="w-3.5 h-3.5 text-purple-200" />
              <span>Timetable Orchestrator</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              Centralized Timetable Management
            </h1>
            <p className="text-purple-100 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Design weekly schedules, resolve teacher and classroom clashes in real-time,
              assign substitute teachers, and publish live timetables to student and parent portals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-white text-purple-900 hover:bg-purple-50 font-bold rounded-xl shadow-md h-10 px-4 text-xs gap-1.5"
            >
              <Plus className="w-4 h-4 text-purple-700" />
              Create Timetable
            </Button>
            <Button
              variant="outline"
              onClick={() => setPeriodsDialogOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-10 px-3.5 text-xs font-semibold gap-1.5 backdrop-blur-sm"
            >
              <Clock className="w-4 h-4 text-purple-200" />
              Bell Schedule
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-10 px-3.5 text-xs font-semibold gap-1.5 backdrop-blur-sm"
            >
              <Printer className="w-4 h-4 text-purple-200" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Control Bar: View Switcher & Class Selectors ────────────────── */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Mode Tabs */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl inline-flex self-start">
            <button
              onClick={() => setViewMode("class")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "class"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Class Grid
            </button>
            <button
              onClick={() => setViewMode("teacher")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "teacher"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Teacher Load
            </button>
            <button
              onClick={() => setViewMode("room")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "room"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              Room Allocation
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "list"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              All Timetables ({timetables.length})
            </button>
          </div>

          {/* Active Timetable Selector & Status */}
          <div className="flex flex-wrap items-center gap-3">
            {viewMode === "class" && (
              <>
                <div className="w-64">
                  <Select
                    value={activeTimetable?.id || undefined}
                    onValueChange={handleSelectTimetable}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                      <SelectValue placeholder="Select class timetable..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-64">
                      {timetables.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activeTimetable && (
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide",
                        activeTimetable.status === "PUBLISHED"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      )}
                    >
                      {activeTimetable.status}
                    </Badge>

                    <Button
                      size="sm"
                      onClick={handlePublishTimetable}
                      disabled={actionLoading}
                      className={cn(
                        "h-8 rounded-xl text-xs font-bold px-3 transition-all",
                        activeTimetable.status === "PUBLISHED"
                          ? "bg-amber-600 hover:bg-amber-500 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      )}
                    >
                      {activeTimetable.status === "PUBLISHED" ? "Revert to Draft" : "Publish Live"}
                    </Button>
                  </div>
                )}
              </>
            )}

            {viewMode === "teacher" && (
              <div className="w-64">
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                    <SelectValue placeholder="Filter by teacher..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Teachers</SelectItem>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {viewMode === "room" && (
              <div className="w-64">
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                    <SelectValue placeholder="Filter by room..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Classrooms</SelectItem>
                    {classrooms.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.name} ({r.building || "Campus"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ─── View 1: Master Weekly Class Grid ────────────────────────────── */}
      {viewMode === "class" && (
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{activeTimetable?.title || "Weekly Schedule"}</span>
                {activeTimetable?.stream?.name && (
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {activeTimetable.stream.name}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any open cell to schedule a period or click a booked card to edit, assign a substitute, or remove.
              </CardDescription>
            </div>

            <div className="text-right text-xs text-slate-400 hidden sm:block">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {activeTimetable?.slots?.length || 0}
              </span>{" "}
              Periods Scheduled
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <th className="py-3 px-4 w-28 sticky left-0 bg-slate-50 dark:bg-slate-800/90 z-10 border-r border-slate-200/80 dark:border-slate-800">
                    Period
                  </th>
                  {DAYS_OF_WEEK.map((day) => (
                    <th key={day} className="py-3 px-3.5 text-center min-w-[140px]">
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {periods.map((period) => {
                  // If this period is a configured Break
                  if (period.isBreak) {
                    return (
                      <tr
                        key={period.id}
                        className="bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 font-semibold text-xs"
                      >
                        <td className="py-2.5 px-4 sticky left-0 bg-amber-50/60 dark:bg-amber-950/40 z-10 border-r border-slate-200/80 dark:border-slate-800 text-[11px]">
                          <div className="font-bold">{period.name}</div>
                          <div className="text-[10px] text-amber-700 dark:text-amber-400">
                            {period.startTime} - {period.endTime}
                          </div>
                        </td>
                        <td
                          colSpan={DAYS_OF_WEEK.length}
                          className="py-2 text-center text-xs italic tracking-wider font-medium text-amber-700 dark:text-amber-300"
                        >
                          ✦ {period.name} ({period.startTime} – {period.endTime}) ✦
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={period.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                      {/* Period Header Column */}
                      <td className="py-3 px-4 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200/80 dark:border-slate-800">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {period.name}
                        </div>
                        <div className="text-[10px] font-mono text-purple-700 dark:text-purple-400 font-semibold mt-0.5">
                          {period.startTime} - {period.endTime}
                        </div>
                      </td>

                      {/* Day Columns */}
                      {DAYS_OF_WEEK.map((day) => {
                        const cellKey = `${day}_${period.periodNumber}`;
                        const slot = slotGridMap[cellKey];

                        if (!slot) {
                          // Empty Slot - Click to Add
                          return (
                            <td
                              key={cellKey}
                              onClick={() => openAddSlot(day, period.periodNumber)}
                              className="p-2 text-center align-top group cursor-pointer border-r border-slate-100 dark:border-slate-800/50 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors"
                            >
                              <div className="h-20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 group-hover:border-purple-400 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 group-hover:text-purple-600 transition-all">
                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                  Assign
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // Scheduled Slot Card
                        const subjColor = slot.subject?.color || "#6366f1";
                        const isSubstituted = !!slot.substituteTeacherId;

                        return (
                          <td
                            key={cellKey}
                            className="p-2 align-top border-r border-slate-100 dark:border-slate-800/50"
                          >
                            <div
                              onClick={() => openEditSlot(slot)}
                              className="h-24 p-2.5 rounded-xl border bg-white dark:bg-slate-800/90 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                              style={{
                                borderLeftWidth: "4px",
                                borderLeftColor: subjColor,
                              }}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {slot.subject?.name || "Subject"}
                                  </span>
                                  {isSubstituted && (
                                    <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 rounded">
                                      Sub
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>
                                    {isSubstituted
                                      ? slot.substituteTeacher?.name || "Sub"
                                      : slot.teacher?.name || "Unassigned"}
                                  </span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-1 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-mono text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[80px]">
                                  {slot.classroom?.name || "Room"}
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSlot(slot.id);
                                  }}
                                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                  title="Delete Slot"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ─── View 2: Teacher Schedule Matrix ─────────────────────────────── */}
      {viewMode === "teacher" && (
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Teacher Workload &amp; Allocation Matrix
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect assigned classes and prevent double-booking across the school.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500">Scheduled Periods: </span>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                {teacherSlots.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {teachers.map((teacher) => {
              const count =
                activeTimetable?.slots.filter(
                  (s) => s.teacherId === teacher.id || s.substituteTeacherId === teacher.id
                ).length || 0;

              return (
                <div
                  key={teacher.id}
                  onClick={() => setSelectedTeacherId(teacher.id)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between",
                    selectedTeacherId === teacher.id
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30"
                      : "border-slate-200/80 dark:border-slate-800 hover:border-purple-300 bg-slate-50/50 dark:bg-slate-800/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs">
                      {teacher.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {teacher.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {count} assigned period{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    {count} hrs/wk
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ─── View 3: Classroom Utilization ───────────────────────────────── */}
      {viewMode === "room" && (
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Classroom &amp; Laboratory Occupancy
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ensure specialized science labs and standard lecture rooms are never double-booked.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {classrooms.map((room) => {
              const roomSlots =
                activeTimetable?.slots.filter((s) => s.classroomId === room.id) || [];

              return (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
                        {room.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {room.building || "Campus"} • Cap: {room.capacity || 40}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                      {room.type || "STANDARD"}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {roomSlots.length}
                    </span>{" "}
                    periods booked this week
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ─── View 4: List All Timetables Across Grades ───────────────────── */}
      {viewMode === "list" && (
        <Card className="rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              All Configured School Timetables
            </CardTitle>
            <CardDescription className="text-xs">
              Manage master schedules for every grade, section, and academic track.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {timetables.map((t) => (
                <div
                  key={t.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{t.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.grade?.name} {t.section?.name ? `• ${t.section.name}` : ""}{" "}
                        {t.stream?.name ? `• ${t.stream.name}` : ""} • {t._count?.slots || 0} periods
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      className={cn(
                        "text-xs font-bold",
                        t.status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      )}
                    >
                      {t.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleSelectTimetable(t.id);
                        setViewMode("class");
                      }}
                      className="rounded-xl text-xs font-semibold gap-1"
                    >
                      <span>Open Schedule</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Dialog 1: Create Timetable Modal ────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create New Timetable</DialogTitle>
            <DialogDescription className="text-xs">
              Configure a master schedule for a specific grade level and section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Timetable Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Grade 12 Natural - Section A (2026/27)"
                className="mt-1.5 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Grade Level</Label>
                <Select value={newGradeId} onValueChange={setNewGradeId}>
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id} className="text-xs">
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Section (Optional)</Label>
                <Select
                  value={newSectionId || "all"}
                  onValueChange={(val) => setNewSectionId(val === "all" ? "" : val)}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs">
                    <SelectValue placeholder="All / Select" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs text-slate-400">
                      All Sections (Default)
                    </SelectItem>
                    {sections.filter((s) => Boolean(s.id)).map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Academic Stream (Optional)</Label>
              <Select
                value={newStreamId || "none"}
                onValueChange={(val) => setNewStreamId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="mt-1.5 rounded-xl text-xs">
                  <SelectValue placeholder="General / Natural / Social" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none" className="text-xs text-slate-400">
                    General / No Specific Stream
                  </SelectItem>
                  {streams.filter((st) => Boolean(st.id)).map((st) => (
                    <SelectItem key={st.id} value={st.id} className="text-xs">
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTimetable}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
            >
              Create Draft Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog 2: Period Slot Editor & Conflict Validator ───────────── */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>{editingSlot ? "Edit Scheduled Period" : "Schedule New Class Period"}</span>
              <Badge variant="outline" className="text-xs font-mono font-bold">
                {DAY_LABELS[slotDay]} • Period {slotPeriodNumber}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign subject, instructor, and classroom. Real-time clash detection is active.
            </DialogDescription>
          </DialogHeader>

          {/* Conflict Warning Banner */}
          {conflictResult?.hasConflict && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Scheduling Conflict Warning</span>
              </div>
              {conflictResult.conflicts.map((c, i) => (
                <p key={i} className="text-[11px] text-red-600 dark:text-red-400 pl-5">
                  • {c.message}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            {/* Subject Selector */}
            <div>
              <Label className="text-xs font-semibold">Subject / Course</Label>
              <Select value={slotSubjectId} onValueChange={setSlotSubjectId}>
                <SelectTrigger className="mt-1.5 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Select subject..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {subjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: sub.color || "#6366f1" }}
                        />
                        <span>{sub.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({sub.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day and Period Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Day of Week</Label>
                <Select value={slotDay} onValueChange={setSlotDay}>
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {DAYS_OF_WEEK.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs">
                        {DAY_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Period Number</Label>
                <Select
                  value={String(slotPeriodNumber)}
                  onValueChange={(val) => setSlotPeriodNumber(Number(val))}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {periods
                      .filter((p) => !p.isBreak)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.periodNumber)} className="text-xs">
                          {p.name} ({p.startTime} - {p.endTime})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Teacher & Classroom Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Assigned Teacher</Label>
                <Select
                  value={slotTeacherId || "none"}
                  onValueChange={(val) => setSlotTeacherId(val === "none" ? "" : val)}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs font-semibold">
                    <SelectValue placeholder="Select teacher..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-48">
                    <SelectItem value="none" className="text-xs text-slate-400">
                      Unassigned / To be announced
                    </SelectItem>
                    {teachers.filter((t) => Boolean(t.id)).map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Classroom / Room</Label>
                <Select
                  value={slotRoomId || "none"}
                  onValueChange={(val) => setSlotRoomId(val === "none" ? "" : val)}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs font-semibold">
                    <SelectValue placeholder="Select room..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-48">
                    <SelectItem value="none" className="text-xs text-slate-400">
                      Unassigned / Default room
                    </SelectItem>
                    {classrooms.filter((r) => Boolean(r.id)).map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Substitute Teacher assignment */}
            <div>
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Substitute Teacher (Optional)</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Overrides primary teacher
                </span>
              </Label>
              <Select
                value={slotSubstituteId || "none"}
                onValueChange={(val) => setSlotSubstituteId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="mt-1.5 rounded-xl text-xs">
                  <SelectValue placeholder="None (Standard assignment)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-48">
                  <SelectItem value="none" className="text-xs font-medium text-slate-400">
                    None / Clear Substitute
                  </SelectItem>
                  {teachers.filter((t) => Boolean(t.id)).map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-semibold">Notes / Instructions</Label>
              <Input
                value={slotNotes}
                onChange={(e) => setSlotNotes(e.target.value)}
                placeholder="e.g. Lab equipment required, bi-weekly test"
                className="mt-1.5 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingSlot && (
              <Button
                variant="destructive"
                onClick={() => {
                  setSlotDialogOpen(false);
                  handleDeleteSlot(editingSlot.id);
                }}
                className="rounded-xl text-xs mr-auto bg-red-600 hover:bg-red-500 text-white"
              >
                Delete Slot
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setSlotDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSlot}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
            >
              Save Schedule Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog 3: Bell Schedule / Periods Overview ──────────────────── */}
      <Dialog open={periodsDialogOpen} onOpenChange={setPeriodsDialogOpen}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <span>School Bell Schedule &amp; Periods</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configured period times and recess breaks used across all school timetables.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {periods.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between text-xs",
                  p.isBreak
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-900 dark:text-amber-300 font-bold"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center font-mono font-bold text-[11px] shadow-2xs">
                    {p.periodNumber}
                  </span>
                  <div>
                    <p className="font-bold text-xs">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.isBreak ? "Break Interval" : "Class Period"}</p>
                  </div>
                </div>

                <div className="font-mono font-bold text-purple-700 dark:text-purple-400 text-xs">
                  {p.startTime} - {p.endTime}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setPeriodsDialogOpen(false)}
              className="rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
