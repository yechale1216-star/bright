"use client";

import { isGrade11or12Grade } from "@/components/school/grade-stream-section-selector";
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
  Copy,
  ArrowRightLeft,
  Check,
  AlertCircle,
  FileCheck2,
  Send,
  HelpCircle,
  Archive,
  Bell,
  ArrowUp,
  ArrowDown,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  type TimetableValidationResult,
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
  const [viewMode, setViewMode] = useState<"class" | "teacher" | "room" | "list" | "bell">("class");
  const [timetables, setTimetables] = useState<TimetableHeader[]>([]);
  const [activeTimetable, setActiveTimetable] = useState<TimetableDetail | null>(null);
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [editingPeriods, setEditingPeriods] = useState<TimetablePeriod[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  // Metadata dependencies
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [gradeSubjects, setGradeSubjects] = useState<any[]>([]);

  // Filters & Selected State
  const [selectedGradeId, setSelectedGradeId] = useState<string>(initialGradeId || "all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSectionId || "all");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [mobileDay, setMobileDay] = useState<string>("MONDAY");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Dialog States ─────────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlotData | null>(null);

  // Form states for Create Timetable
  const [newTitle, setNewTitle] = useState("");
  const [newGradeId, setNewGradeId] = useState("");
  const [newSectionId, setNewSectionId] = useState("");
  const [newStreamId, setNewStreamId] = useState("");

  // Form states for Compact Slot Editor
  const [slotDay, setSlotDay] = useState("MONDAY");
  const [slotPeriodNumber, setSlotPeriodNumber] = useState(1);
  const [slotSubjectId, setSlotSubjectId] = useState("");
  const [slotTeacherId, setSlotTeacherId] = useState("");
  const [slotRoomId, setSlotRoomId] = useState("");
  const [slotSubstituteId, setSlotSubstituteId] = useState("");
  const [slotNotes, setSlotNotes] = useState("");
  const [showMoveCopyOptions, setShowMoveCopyOptions] = useState(false);
  const [targetMoveDay, setTargetMoveDay] = useState("MONDAY");
  const [targetMovePeriod, setTargetMovePeriod] = useState(1);

  // Conflict & Validation states
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [validationResult, setValidationResult] = useState<TimetableValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

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
        fetchedTeacherAssignments,
      ] = await Promise.all([
        timetableDb.listTimetables(),
        timetableDb.getPeriods(),
        timetableDb.getClassrooms(),
        db.getGrades().catch(() => []),
        db.getSections().catch(() => []),
        db.getStreams().catch(() => []),
        db.getSubjects().catch(() => []),
        db.getTeachers(true).catch(() => []),
        db.getTeacherAssignments().catch(() => []),
      ]);

      setTimetables(fetchedTimetables);
      setPeriods(fetchedPeriods);
      setClassrooms(fetchedRooms);
      setGrades(fetchedGrades);
      setSections(fetchedSections);
      setStreams(fetchedStreams);
      setAllSubjects(fetchedSubjects);
      setTeachers(fetchedTeachers);
      setTeacherAssignments(fetchedTeacherAssignments || []);

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

  // ─── Dynamic Curriculum Subjects for Active Timetable ──────────────────────
  // Load GradeSubjects mapping whenever activeTimetable grade or stream changes
  useEffect(() => {
    if (!activeTimetable?.gradeId) {
      setGradeSubjects([]);
      return;
    }

    db.getGradeSubjects({
      gradeId: activeTimetable.gradeId,
      streamId: activeTimetable.streamId || undefined,
    })
      .then((gsList) => {
        setGradeSubjects(gsList || []);
      })
      .catch((err) => {
        console.warn("[Timetable] Could not fetch grade-subjects:", err);
        setGradeSubjects([]);
      });
  }, [activeTimetable?.gradeId, activeTimetable?.streamId]);

  // Compute allowed subjects for the active timetable
  const allowedSubjects = useMemo(() => {
    if (!activeTimetable) return [];

    // Check if grade is 11 or 12
    const gradeObj = grades.find((g) => g.id === activeTimetable.gradeId);
    const gradeName = (gradeObj?.name || "").toLowerCase();
    const isSeniorSecondary = gradeName.includes("11") || gradeName.includes("12");

    // If grade subjects curriculum records exist, strictly use them
    if (gradeSubjects.length > 0) {
      const allowedSubjectIds = new Set(gradeSubjects.map((gs) => gs.subjectId || gs.subject?.id));
      return allSubjects.filter((s) => allowedSubjectIds.has(s.id));
    }

    // Secondary fallback: Filter by stream if Grade 11/12
    if (isSeniorSecondary && activeTimetable.streamId) {
      const streamObj = streams.find((st) => st.id === activeTimetable.streamId);
      const streamName = (streamObj?.name || "").toLowerCase();

      return allSubjects.filter((s) => {
        const subName = (s.name || "").toLowerCase();
        if (streamName.includes("natural")) {
          // Exclude exclusive social subjects like History, Geography, Economics
          if (["history", "geography", "economics"].some((kw) => subName.includes(kw))) {
            return false;
          }
        } else if (streamName.includes("social")) {
          // Exclude exclusive natural subjects like Physics, Chemistry, Biology
          if (["physics", "chemistry", "biology"].some((kw) => subName.includes(kw))) {
            return false;
          }
        }
        return true;
      });
    }

    return allSubjects;
  }, [activeTimetable, gradeSubjects, allSubjects, grades, streams]);

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

  // ─── Real-time Conflict Check Runner ───────────────────────────────────────
  const runConflictCheck = useCallback(
    async (
      day: string,
      periodNum: number,
      subjId: string,
      teacherId?: string,
      roomId?: string
    ) => {
      if (!activeTimetable) return;
      try {
        setCheckingConflict(true);
        const res = await timetableDb.checkConflict({
          timetableId: activeTimetable.id,
          dayOfWeek: day,
          periodNumber: periodNum,
          subjectId: subjId || undefined,
          teacherId: teacherId || null,
          classroomId: roomId || null,
          gradeId: activeTimetable.gradeId,
          sectionId: activeTimetable.sectionId || undefined,
          streamId: activeTimetable.streamId || null,
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

  // Trigger conflict check when teacher, room, day, or period changes in editor
  useEffect(() => {
    if (slotDialogOpen) {
      runConflictCheck(slotDay, slotPeriodNumber, slotSubjectId, slotTeacherId, slotRoomId);
    }
  }, [slotDay, slotPeriodNumber, slotSubjectId, slotTeacherId, slotRoomId, slotDialogOpen, runConflictCheck]);

  // ─── Room Availability Map for the Active Period ───────────────────────────
  const availableClassrooms = useMemo(() => {
    // If active timetable or classrooms aren't loaded, return all
    if (!classrooms.length) return [];

    return classrooms.map((room) => {
      // Check if room is booked in active timetable on slotDay & slotPeriodNumber
      const isBookedInCurrent = Object.values(slotGridMap).some(
        (s) =>
          s.dayOfWeek.toUpperCase() === slotDay.toUpperCase() &&
          s.periodNumber === slotPeriodNumber &&
          s.classroomId === room.id &&
          s.id !== editingSlot?.id
      );

      return {
        ...room,
        isOccupied: isBookedInCurrent,
      };
    });
  }, [classrooms, slotGridMap, slotDay, slotPeriodNumber, editingSlot]);

  // ─── Teacher Qualification / Assignment for Selected Subject ───────────────
  const qualifiedTeachers = useMemo(() => {
    if (!teachers.length) return [];

    const selectedSub = allSubjects.find((s) => s.id === slotSubjectId);
    const subName = (selectedSub?.name || "").toLowerCase();
    const currentGradeId = activeTimetable?.gradeId;
    const currentSectionId = activeTimetable?.sectionId;

    return teachers.map((t) => {
      const effectiveId = t.teacher_id || t.id;
      const displayName = t.full_name || t.name || t.email || "Faculty";

      // 1. Is this teacher officially assigned to THIS Grade + Section + Subject in Academic Structure?
      const isClassSectionAssigned = teacherAssignments.some((ta) => {
        const matchesTeacher =
          (ta.teacher_id && (ta.teacher_id === t.teacher_id || ta.teacher_id === t.id)) ||
          (ta.teacher?.id && (ta.teacher.id === t.teacher_id || ta.teacher.id === t.id));
        const matchesGrade = !currentGradeId || ta.gradeId === currentGradeId;
        const matchesSection = !currentSectionId || ta.sectionId === currentSectionId;
        const matchesSubject =
          !slotSubjectId ||
          ta.subjectId === slotSubjectId ||
          (ta.subject && subName && ta.subject.toLowerCase() === subName);

        return matchesTeacher && matchesGrade && matchesSection && matchesSubject;
      });

      // 2. Is this teacher assigned to this subject anywhere in this Grade?
      const isGradeLevelAssigned = teacherAssignments.some((ta) => {
        const matchesTeacher =
          (ta.teacher_id && (ta.teacher_id === t.teacher_id || ta.teacher_id === t.id)) ||
          (ta.teacher?.id && (ta.teacher.id === t.teacher_id || ta.teacher.id === t.id));
        const matchesGrade = !currentGradeId || ta.gradeId === currentGradeId;
        const matchesSubject =
          !slotSubjectId ||
          ta.subjectId === slotSubjectId ||
          (ta.subject && subName && ta.subject.toLowerCase() === subName);

        return matchesTeacher && matchesGrade && matchesSubject;
      });

      // 3. Subject specialist attribute
      const teacherSub = (t.subject || "").toLowerCase();
      const isSubjectSpecialist = Boolean(
        teacherSub && subName && (teacherSub.includes(subName) || subName.includes(teacherSub))
      );

      return {
        ...t,
        effectiveId,
        displayName,
        isClassSectionAssigned,
        isGradeLevelAssigned,
        isSubjectSpecialist,
      };
    }).sort((a, b) => {
      if (a.isClassSectionAssigned && !b.isClassSectionAssigned) return -1;
      if (!a.isClassSectionAssigned && b.isClassSectionAssigned) return 1;
      if (a.isGradeLevelAssigned && !b.isGradeLevelAssigned) return -1;
      if (!a.isGradeLevelAssigned && b.isGradeLevelAssigned) return 1;
      if (a.isSubjectSpecialist && !b.isSubjectSpecialist) return -1;
      if (!a.isSubjectSpecialist && b.isSubjectSpecialist) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [slotSubjectId, teachers, allSubjects, teacherAssignments, activeTimetable]);

  // ─── Create Timetable Handler ──────────────────────────────────────────────
  const handleCreateTimetable = async () => {
    if (!newGradeId) {
      notifications.error("Validation Error", "Please select a Grade Level.");
      return;
    }
    if (!newSectionId) {
      notifications.error("Validation Error", "Please select a Section. Section is mandatory.");
      return;
    }

    const gradeObj = grades.find((g) => g.id === newGradeId);
    const gradeName = (gradeObj?.name || "").toLowerCase();
    const isSeniorSecondary = gradeName.includes("11") || gradeName.includes("12");

    if (isSeniorSecondary && !newStreamId) {
      notifications.error("Validation Error", "Academic Stream is mandatory for Grades 11 and 12.");
      return;
    }

    const sectionObj = sections.find((s) => s.id === newSectionId);
    const streamObj = streams.find((st) => st.id === newStreamId);
    const secLabel = sectionObj ? (sectionObj.name.toLowerCase().startsWith("section") ? sectionObj.name : `Section ${sectionObj.name}`) : "";
    const streamLabel = streamObj ? ` (${streamObj.name})` : "";
    const finalTitle = newTitle.trim() || `${gradeObj?.name || "Class"} - ${secLabel}${streamLabel} Timetable`;

    try {
      setActionLoading(true);
      const created = await timetableDb.createTimetable({
        title: finalTitle,
        gradeId: newGradeId,
        sectionId: newSectionId,
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

  // ─── Bell Schedule & Master Periods Handlers ──────────────────────────────
  useEffect(() => {
    if (periods.length > 0 && editingPeriods.length === 0) {
      setEditingPeriods(periods);
    }
  }, [periods, editingPeriods.length]);

  const handleAddPeriod = (isBreak = false) => {
    const nextNum = editingPeriods.length + 1;
    const lastPeriod = editingPeriods[editingPeriods.length - 1];
    let defaultStart = "08:30";
    let defaultEnd = "09:15";

    if (lastPeriod?.endTime) {
      defaultStart = lastPeriod.endTime;
      const [h, m] = defaultStart.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const totalMin = h * 60 + m + (isBreak ? 25 : 45);
        const newH = Math.floor(totalMin / 60) % 24;
        const newM = totalMin % 60;
        defaultEnd = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
      }
    }

    const newP: TimetablePeriod = {
      id: `new-${Date.now()}`,
      name: isBreak ? `Break ${nextNum}` : `Period ${nextNum}`,
      periodNumber: nextNum,
      startTime: defaultStart,
      endTime: defaultEnd,
      isBreak,
    };
    setEditingPeriods((prev) => [...prev, newP]);
  };

  const handleUpdatePeriodItem = (index: number, updates: Partial<TimetablePeriod>) => {
    setEditingPeriods((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleMovePeriod = (index: number, direction: "up" | "down") => {
    setEditingPeriods((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((p, idx) => ({ ...p, periodNumber: idx + 1 }));
    });
  };

  const handleDeletePeriod = (index: number) => {
    setEditingPeriods((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((p, idx) => ({ ...p, periodNumber: idx + 1 }));
    });
  };

  const handleSaveBellSchedule = async () => {
    try {
      setActionLoading(true);
      const saved = await timetableDb.updatePeriods(editingPeriods);
      setPeriods(saved);
      setEditingPeriods(saved);
      notifications.success("Bell Schedule Saved", "School master bell schedule updated successfully.");
    } catch (err: any) {
      notifications.error("Save Error", err.message || "Failed to update bell schedule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDefaultPeriods = () => {
    const defaultPeriods: TimetablePeriod[] = [
      { id: "p1", name: "Period 1", periodNumber: 1, startTime: "08:30", endTime: "09:15", isBreak: false },
      { id: "p2", name: "Period 2", periodNumber: 2, startTime: "09:20", endTime: "10:05", isBreak: false },
      { id: "b1", name: "Morning Break", periodNumber: 3, startTime: "10:05", endTime: "10:30", isBreak: true },
      { id: "p3", name: "Period 3", periodNumber: 4, startTime: "10:30", endTime: "11:15", isBreak: false },
      { id: "p4", name: "Period 4", periodNumber: 5, startTime: "11:20", endTime: "12:05", isBreak: false },
      { id: "b2", name: "Lunch Break", periodNumber: 6, startTime: "12:05", endTime: "01:05", isBreak: true },
      { id: "p5", name: "Period 5", periodNumber: 7, startTime: "01:10", endTime: "01:55", isBreak: false },
      { id: "p6", name: "Period 6", periodNumber: 8, startTime: "02:00", endTime: "02:45", isBreak: false },
    ];
    setEditingPeriods(defaultPeriods);
  };

  // ─── Publish / Status Handler with Critical Conflict Gate ─────────────────
  const handlePublishTimetable = async () => {
    if (!activeTimetable) return;

    const isCurrentlyPublished = activeTimetable.status === "PUBLISHED";
    const nextStatus = isCurrentlyPublished ? "DRAFT" : "PUBLISHED";

    try {
      setActionLoading(true);

      // If attempting to publish, run complete validation first
      if (!isCurrentlyPublished) {
        const val = await timetableDb.validateTimetable(activeTimetable.id);
        if (val.criticalConflicts.length > 0) {
          notifications.error(
            "Cannot Publish Schedule",
            `There are ${val.criticalConflicts.length} unresolved critical clashes. Resolve them before publishing.`
          );
          setValidationResult(val);
          setValidationDialogOpen(true);
          return;
        }
      }

      await timetableDb.updateTimetable(activeTimetable.id, {
        status: nextStatus,
      });

      setActiveTimetable((prev) => (prev ? { ...prev, status: nextStatus } : null));
      notifications.success(
        !isCurrentlyPublished ? "Timetable Published" : "Reverted to Draft",
        !isCurrentlyPublished
          ? "This schedule is now live and visible to students, parents, and teachers!"
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

  // ─── Comprehensive Validation Trigger ─────────────────────────────────────
  const handleRunValidation = async () => {
    if (!activeTimetable) return;
    try {
      setValidating(true);
      const result = await timetableDb.validateTimetable(activeTimetable.id);
      setValidationResult(result);
      setValidationDialogOpen(true);

      // If validated with 0 conflicts, refresh active status
      if (result.isValid && activeTimetable.status === "DRAFT") {
        setActiveTimetable((prev) => (prev ? { ...prev, status: "VALIDATED" } : null));
        const refreshed = await timetableDb.listTimetables();
        setTimetables(refreshed);
      }
    } catch (err: any) {
      notifications.error("Validation Failed", err.message);
    } finally {
      setValidating(false);
    }
  };

  // ─── Slot Dialog Openers ───────────────────────────────────────────────────
  const openAddSlot = (day: string, periodNumber: number) => {
    const periodObj = periods.find((p) => p.periodNumber === periodNumber);
    if (periodObj?.isBreak) {
      notifications.info("Break Period", `${periodObj.name} is a configured school break. Classes cannot be scheduled.`);
      return;
    }

    setEditingSlot(null);
    setSlotDay(day);
    setSlotPeriodNumber(periodNumber);

    // Dynamic subject: Default to first allowed subject for this grade
    const initialSubj = allowedSubjects[0]?.id || "";
    setSlotSubjectId(initialSubj);

    let defaultTeacherId = "";
    if (initialSubj && activeTimetable?.gradeId && activeTimetable?.sectionId) {
      const selectedSub = allSubjects.find((s) => s.id === initialSubj);
      const subName = (selectedSub?.name || "").toLowerCase();
      const assigned = teacherAssignments.find((ta) => {
        const matchesGrade = ta.gradeId === activeTimetable.gradeId;
        const matchesSection = ta.sectionId === activeTimetable.sectionId;
        const matchesSubject = ta.subjectId === initialSubj || (ta.subject && subName && ta.subject.toLowerCase() === subName);
        return matchesGrade && matchesSection && matchesSubject;
      });
      if (assigned) {
        defaultTeacherId = assigned.teacher_id || "";
      }
    }
    setSlotTeacherId(defaultTeacherId);
    setSlotRoomId(classrooms[0]?.id || "");
    setSlotSubstituteId("");
    setSlotNotes("");
    setShowMoveCopyOptions(false);
    setTargetMoveDay(day);
    setTargetMovePeriod(periodNumber);
    setConflictResult(null);
    setSlotDialogOpen(true);
  };

  const handleSlotSubjectChange = (newSubId: string) => {
    setSlotSubjectId(newSubId);
    if (newSubId && activeTimetable?.gradeId && activeTimetable?.sectionId) {
      const selectedSub = allSubjects.find((s) => s.id === newSubId);
      const subName = (selectedSub?.name || "").toLowerCase();
      const assigned = teacherAssignments.find((ta) => {
        const matchesGrade = ta.gradeId === activeTimetable.gradeId;
        const matchesSection = ta.sectionId === activeTimetable.sectionId;
        const matchesSubject = ta.subjectId === newSubId || (ta.subject && subName && ta.subject.toLowerCase() === subName);
        return matchesGrade && matchesSection && matchesSubject;
      });
      if (assigned && assigned.teacher_id) {
        setSlotTeacherId(assigned.teacher_id);
      }
    }
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
    setShowMoveCopyOptions(false);
    setTargetMoveDay(slot.dayOfWeek);
    setTargetMovePeriod(slot.periodNumber);
    setConflictResult(null);
    setSlotDialogOpen(true);
  };

  // ─── Save Slot Handler ─────────────────────────────────────────────────────
  const handleSaveSlot = async () => {
    if (!activeTimetable) return;

    if (!slotSubjectId) {
      notifications.error("Missing Subject", "Please select a subject from the allowed curriculum.");
      return;
    }

    if (allowedSubjects.length === 0) {
      notifications.error(
        "No Curriculum Assigned",
        "No subjects are assigned to this grade/stream. Configure academic structure first."
      );
      return;
    }

    // Check critical conflicts
    if (conflictResult?.hasCriticalConflict) {
      notifications.error(
        "Clash Detected",
        conflictResult.conflicts.find((c) => c.severity === "CRITICAL")?.message || "Resolve conflict first."
      );
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

  // ─── Move or Copy Slot Handler ─────────────────────────────────────────────
  const handleMoveOrCopySlot = async (isMove: boolean) => {
    if (!activeTimetable || !editingSlot) return;

    try {
      setActionLoading(true);
      await timetableDb.copyOrMoveSlot(activeTimetable.id, {
        slotId: editingSlot.id,
        targetDayOfWeek: targetMoveDay,
        targetPeriodNumber: targetMovePeriod,
        isMove,
      });

      notifications.success(
        isMove ? "Period Moved" : "Period Duplicated",
        `Slot successfully ${isMove ? "moved" : "copied"} to ${DAY_LABELS[targetMoveDay]} Period ${targetMovePeriod}.`
      );
      setSlotDialogOpen(false);

      const updated = await timetableDb.getTimetableById(activeTimetable.id);
      setActiveTimetable(updated);
    } catch (err: any) {
      notifications.error("Action Failed", err.message || "Conflict detected at destination period.");
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

  // ─── Available Sections for Clone Target ───────────────────────────────────
  const selectedNewGradeObj = useMemo(() => {
    return grades.find((g) => g.id === newGradeId);
  }, [grades, newGradeId]);

  const isNewGrade11or12 = useMemo(() => {
    return isGrade11or12Grade(selectedNewGradeObj?.name);
  }, [selectedNewGradeObj]);

  const filteredNewSections = useMemo(() => {
    if (!newGradeId) return [];
    return sections.filter((s) => {
      if (s.gradeId && s.gradeId !== newGradeId) return false;
      if (isNewGrade11or12) {
        if (!newStreamId) return false;
        return s.streamId === newStreamId;
      }
      return !s.streamId || s.gradeId === newGradeId;
    });
  }, [sections, newGradeId, newStreamId, isNewGrade11or12]);

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
              Design weekly schedules with automated clash prevention, academic curriculum filtering,
              complete timetable validation, section cloning, and live portal synchronization.
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
              onClick={() => setViewMode("bell")}
              className={cn(
                "bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-10 px-3.5 text-xs font-semibold gap-1.5 backdrop-blur-sm",
                viewMode === "bell" && "bg-white text-purple-950 font-bold hover:bg-white/90"
              )}
            >
              <Bell className="w-4 h-4 text-purple-200" />
              Bell Schedule &amp; Periods
            </Button>
            {activeTimetable && (
              <Button
                variant="outline"
                onClick={handleRunValidation}
                disabled={validating}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-10 px-3.5 text-xs font-semibold gap-1.5 backdrop-blur-sm"
              >
                <FileCheck2 className="w-4 h-4 text-purple-200" />
                Validate Schedule
              </Button>
            )}
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
      <Card className="rounded-2xl border-border bg-card shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Mode Tabs */}
          <div className="bg-muted p-1 rounded-xl inline-flex self-start flex-wrap gap-1">
            <button
              onClick={() => setViewMode("class")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "class"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
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
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
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
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              Room Allocation
            </button>
            <button
              onClick={() => setViewMode("bell")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "bell"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bell className="w-3.5 h-3.5" />
              Bell Schedule &amp; Periods
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              All Timetables ({timetables.length})
            </button>
          </div>

          {/* Active Timetable Selector & Workflow Status */}
          <div className="flex flex-wrap items-center gap-3">
            {viewMode === "class" && (
              <>
                <div className="w-64">
                  <Select
                    value={activeTimetable?.id || undefined}
                    onValueChange={handleSelectTimetable}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-border text-xs font-semibold bg-background text-foreground">
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
                    {/* Status Badge with Distinct Color */}
                    <Badge
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider",
                        activeTimetable.status === "PUBLISHED" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                        activeTimetable.status === "VALIDATED" && "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30",
                        activeTimetable.status === "DRAFT" && "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
                        activeTimetable.status === "ARCHIVED" && "bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30"
                      )}
                    >
                      {activeTimetable.status === "PUBLISHED" && "● Live Published"}
                      {activeTimetable.status === "VALIDATED" && "✓ Validated"}
                      {activeTimetable.status === "DRAFT" && "✎ Draft Mode"}
                      {activeTimetable.status === "ARCHIVED" && "📁 Archived"}
                    </Badge>

                    {/* Publish / Unpublish Action Button */}
                    <Button
                      size="sm"
                      onClick={handlePublishTimetable}
                      disabled={actionLoading}
                      className={cn(
                        "h-8 px-3 rounded-xl text-xs font-bold gap-1.5 transition-all shadow-xs",
                        activeTimetable.status === "PUBLISHED"
                          ? "bg-amber-600 hover:bg-amber-500 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      )}
                    >
                      {activeTimetable.status === "PUBLISHED" ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Revert to Draft
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Publish to Students & Teachers
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Completeness Summary Banner */}
        {activeTimetable && viewMode === "class" && (
          <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <strong className="text-foreground">{activeTimetable.slots?.length || 0}</strong> scheduled periods
              </span>
              <span>•</span>
              <span>
                Grade: <strong className="text-foreground">{activeTimetable.grade?.name || "General"}</strong>
              </span>
              {activeTimetable.section?.name && (
                <>
                  <span>•</span>
                  <span>
                    Section: <strong className="text-foreground">{activeTimetable.section.name}</strong>
                  </span>
                </>
              )}
              {activeTimetable.stream?.name && (
                <>
                  <span>•</span>
                  <span>
                    Stream: <strong className="text-primary font-bold">{activeTimetable.stream.name}</strong>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold">Curriculum Subjects Available:</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                {allowedSubjects.length} subjects
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ─── View 1: Interactive Class Weekly Timetable Grid ─────────────── */}
      {viewMode === "class" && activeTimetable && (
        <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
          {/* Mobile Day Selector Bar */}
          <div className="md:hidden flex items-center gap-1.5 p-3 overflow-x-auto bg-muted/50 border-b border-border">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day}
                onClick={() => setMobileDay(day)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors",
                  mobileDay === day
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-muted/60 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  <th className="py-3 px-4 w-28 sticky left-0 bg-muted z-10 border-r border-border">
                    Period
                  </th>
                  {DAYS_OF_WEEK.map((day) => (
                    <th key={day} className="py-3 px-3.5 text-center min-w-[140px]">
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {periods.map((period) => {
                  // If this period is a configured Break
                  if (period.isBreak) {
                    return (
                      <tr
                        key={period.id}
                        className="bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold text-xs"
                      >
                        <td className="py-2.5 px-4 sticky left-0 bg-amber-500/15 z-10 border-r border-border text-[11px]">
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
                    <tr key={period.id} className="hover:bg-muted/30 transition-colors">
                      {/* Period Header Column */}
                      <td className="py-3 px-4 sticky left-0 bg-card z-10 border-r border-border">
                        <div className="font-bold text-xs text-foreground">
                          {period.name}
                        </div>
                        <div className="text-[10px] font-mono text-primary font-semibold mt-0.5">
                          {period.startTime} - {period.endTime}
                        </div>
                      </td>

                      {/* Day Columns */}
                      {DAYS_OF_WEEK.map((day) => {
                        const cellKey = `${day}_${period.periodNumber}`;
                        const slot = slotGridMap[cellKey];

                        if (!slot) {
                          // Empty Slot - Click to Open Compact Assignment Modal
                          return (
                            <td
                              key={cellKey}
                              onClick={() => openAddSlot(day, period.periodNumber)}
                              className="p-2 text-center align-top group cursor-pointer border-r border-border/40 hover:bg-primary/5 transition-colors"
                            >
                              <div className="h-20 rounded-xl border border-dashed border-border/80 group-hover:border-primary/60 flex flex-col items-center justify-center text-muted-foreground/40 group-hover:text-primary transition-all">
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
                        const isSubstituted = Boolean(slot.substituteTeacherId);

                        return (
                          <td
                            key={cellKey}
                            className="p-2 align-top border-r border-border/40"
                          >
                            <div
                              onClick={() => openEditSlot(slot)}
                              className="h-24 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                              style={{
                                borderLeftWidth: "4px",
                                borderLeftColor: subjColor,
                              }}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-xs text-foreground truncate">
                                    {slot.subject?.name || "Subject"}
                                  </span>
                                  {isSubstituted && (
                                    <Badge className="bg-amber-500 text-white text-[9px] px-1 py-0 rounded">
                                      Sub
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-medium flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                  <span>
                                    {isSubstituted
                                      ? slot.substituteTeacher?.name || "Sub"
                                      : slot.teacher?.name || "Unassigned"}
                                  </span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between mt-1 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded-md bg-muted text-foreground font-mono font-semibold truncate max-w-[80px]">
                                  {slot.classroom?.name || "Room"}
                                </span>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditSlot(slot);
                                    }}
                                    className="text-muted-foreground hover:text-primary p-0.5"
                                    title="Edit Slot"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSlot(slot.id);
                                    }}
                                    className="text-muted-foreground hover:text-red-500 p-0.5"
                                    title="Delete Slot"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
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
        <Card className="rounded-3xl border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Teacher Workload &amp; Allocation Matrix
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect periods assigned across the week to prevent teacher overload.
              </p>
            </div>

            <div className="w-64">
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger className="h-9 rounded-xl border-border text-xs font-semibold">
                  <SelectValue placeholder="Filter by teacher..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  <SelectItem value="all" className="text-xs">
                    All Teachers ({teachers.length})
                  </SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.full_name || t.name || t.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teachers
              .filter((t) => selectedTeacherId === "all" || t.id === selectedTeacherId || t.teacher_id === selectedTeacherId)
              .map((teacher) => {
                const teacherIds = [teacher.id, teacher.teacher_id].filter(Boolean);
                const assignedCount = (activeTimetable?.slots || []).filter(
                  (s) => teacherIds.includes(s.teacherId) || (s.substituteTeacherId && teacherIds.includes(s.substituteTeacherId))
                ).length;
                const teacherName = teacher.full_name || teacher.name || teacher.email || "Faculty";

                return (
                  <div
                    key={teacher.id}
                    className="p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                        {teacherName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{teacherName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{teacher.subject || "General Faculty"}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-foreground">{assignedCount}</span>
                      <span className="text-[10px] text-muted-foreground block">periods/wk</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* ─── View 3: Room Allocation Matrix ──────────────────────────────── */}
      {viewMode === "room" && (
        <Card className="rounded-3xl border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Classroom Allocation &amp; Capacity
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active spaces, standard lecture rooms, and science/IT laboratories.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {classrooms.map((room) => {
              const countInCurrent = (activeTimetable?.slots || []).filter((s) => s.classroomId === room.id).length;

              return (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{room.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {room.building || "Campus Main"} • Floor: {room.floor || "1st"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase font-bold">
                      {room.type}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                    <span className="text-muted-foreground">Capacity: <strong className="text-foreground">{room.capacity || 40}</strong></span>
                    <span className="font-bold text-primary">{countInCurrent} periods scheduled</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ─── View 5: School Bell Schedule & Master Periods ───────────────── */}
      {viewMode === "bell" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card with Metrics and Actions */}
          <Card className="rounded-3xl border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border/80">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Master Bell Infrastructure
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {editingPeriods.length} Master Slots
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-black text-foreground mt-1">
                  School Bell Schedule &amp; Master Periods
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                  Configure daily period times, lecture durations, morning intervals, and recess breaks.
                  These periods dictate the timetable slots for all grades and prevent schedule clashes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddPeriod(false)}
                  className="rounded-xl text-xs font-semibold h-9 px-3 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Add Period
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddPeriod(true)}
                  className="rounded-xl text-xs font-semibold h-9 px-3 gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Break / Recess
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetDefaultPeriods}
                  className="rounded-xl text-xs font-semibold h-9 px-3 gap-1.5 text-muted-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset Defaults
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveBellSchedule}
                  disabled={actionLoading || editingPeriods.length === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold h-9 px-4 gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Bell Schedule
                </Button>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-5">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/80">
                <span className="text-[11px] font-semibold text-muted-foreground block">Total Day Slots</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-foreground">{editingPeriods.length}</span>
                  <span className="text-[11px] text-muted-foreground">intervals</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <span className="text-[11px] font-semibold text-primary block">Instructional Periods</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-primary">
                    {editingPeriods.filter((p) => !p.isBreak).length}
                  </span>
                  <span className="text-[11px] text-muted-foreground">teaching slots</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">Scheduled Breaks</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {editingPeriods.filter((p) => p.isBreak).length}
                  </span>
                  <span className="text-[11px] text-muted-foreground">recess/lunch</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/80">
                <span className="text-[11px] font-semibold text-muted-foreground block">School Bell Span</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-base font-black text-foreground">
                    {editingPeriods[0]?.startTime || "--:--"}
                  </span>
                  <span className="text-xs text-muted-foreground">to</span>
                  <span className="text-base font-black text-foreground">
                    {editingPeriods[editingPeriods.length - 1]?.endTime || "--:--"}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Periods List / Interactive Configurator */}
          <div className="space-y-3">
            {editingPeriods.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 border-border p-12 text-center bg-card/50">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-foreground">No Periods Configured</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Click &quot;Add Period&quot; or &quot;Reset Defaults&quot; to define your master daily bell schedule.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button size="sm" onClick={() => handleAddPeriod(false)} className="rounded-xl text-xs font-bold gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add First Period
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleResetDefaultPeriods} className="rounded-xl text-xs font-semibold">
                    Load Standard 8-Period Bell
                  </Button>
                </div>
              </Card>
            ) : (
              editingPeriods.map((period, index) => {
                let durationMinutes = 0;
                if (period.startTime && period.endTime) {
                  const [sh, sm] = period.startTime.split(":").map(Number);
                  const [eh, em] = period.endTime.split(":").map(Number);
                  if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
                    durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
                    if (durationMinutes < 0) durationMinutes += 24 * 60;
                  }
                }

                return (
                  <div
                    key={period.id || `idx-${index}`}
                    className={cn(
                      "group p-4 rounded-2xl border transition-all bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4",
                      period.isBreak
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : "border-border hover:border-primary/40 hover:shadow-sm"
                    )}
                  >
                    {/* Left: Reorder & Number */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMovePeriod(index, "up")}
                          disabled={index === 0}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="Move earlier"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePeriod(index, "down")}
                          disabled={index === editingPeriods.length - 1}
                          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="Move later"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black text-xs shrink-0",
                          period.isBreak
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                            : "bg-primary/10 text-primary border border-primary/20"
                        )}
                      >
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Slot</span>
                        <span>{index + 1}</span>
                      </div>

                      {/* Period Name Input */}
                      <div className="min-w-0 md:w-56">
                        <Label className="text-[10px] text-muted-foreground font-semibold">Period / Interval Label</Label>
                        <Input
                          value={period.name}
                          onChange={(e) => handleUpdatePeriodItem(index, { name: e.target.value })}
                          placeholder="e.g. Period 1 or Lunch Break"
                          className="h-8 rounded-xl text-xs font-bold mt-0.5"
                        />
                      </div>
                    </div>

                    {/* Middle: Timing Inputs & Duration badge */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-28">
                        <Label className="text-[10px] text-muted-foreground font-semibold">Start Time</Label>
                        <Input
                          type="time"
                          value={period.startTime}
                          onChange={(e) => handleUpdatePeriodItem(index, { startTime: e.target.value })}
                          className="h-8 rounded-xl text-xs font-mono font-semibold mt-0.5"
                        />
                      </div>

                      <div className="w-28">
                        <Label className="text-[10px] text-muted-foreground font-semibold">End Time</Label>
                        <Input
                          type="time"
                          value={period.endTime}
                          onChange={(e) => handleUpdatePeriodItem(index, { endTime: e.target.value })}
                          className="h-8 rounded-xl text-xs font-mono font-semibold mt-0.5"
                        />
                      </div>

                      <div className="pt-4">
                        <Badge
                          variant="secondary"
                          className="h-7 text-[10px] font-mono font-bold rounded-lg px-2 flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {durationMinutes > 0 ? `${durationMinutes} mins` : "--"}
                        </Badge>
                      </div>
                    </div>

                    {/* Right: Break Switch & Remove Action */}
                    <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={period.isBreak}
                          onCheckedChange={(checked) => handleUpdatePeriodItem(index, { isBreak: checked })}
                          id={`break-switch-${index}`}
                        />
                        <Label htmlFor={`break-switch-${index}`} className="text-xs cursor-pointer select-none">
                          {period.isBreak ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">Break / Recess</span>
                          ) : (
                            <span className="text-muted-foreground">Class Period</span>
                          )}
                        </Label>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePeriod(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-xl"
                        title="Delete slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Action Bar */}
          {editingPeriods.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-muted/40 border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  All changes made here automatically synchronize across timetable grids and classroom scheduling.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingPeriods([...periods])}
                  className="rounded-xl text-xs h-9 px-3"
                >
                  Discard Changes
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveBellSchedule}
                  disabled={actionLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs h-9 px-4 gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Bell Schedule
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── View 4: All Timetables Directory ────────────────────────────── */}
      {viewMode === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {timetables.map((item) => (
            <Card
              key={item.id}
              onClick={() => {
                handleSelectTimetable(item.id);
                setViewMode("class");
              }}
              className="rounded-2xl border-border hover:border-primary/50 cursor-pointer transition-all hover:shadow-md p-5 bg-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                      item.status === "PUBLISHED" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                      item.status === "VALIDATED" && "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30",
                      item.status === "DRAFT" && "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                    )}
                  >
                    {item.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">v{item.version || 1}</span>
                </div>

                <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Grade: {item.grade?.name || "General"}
                  {item.section?.name && ` • Section: ${item.section.name}`}
                  {item.stream?.name && ` • Stream: ${item.stream.name}`}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60 text-xs text-muted-foreground">
                <span>{item._count?.slots || 0} scheduled periods</span>
                <span className="text-primary font-bold flex items-center gap-1">
                  Open Grid <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Dialog 1: Create Timetable ──────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Create Class Timetable</DialogTitle>
            <DialogDescription className="text-xs">
              Generate an empty timetable container for a specific grade, stream, and section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Timetable Title *</Label>
              <Input
                placeholder="e.g. Grade 10 - Section A Timetable"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1.5 rounded-xl text-xs"
              />
            </div>

            {/* 1. Grade (Required First) */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                1. Grade <span className="text-destructive font-bold">*</span>
              </Label>
              <Select
                value={newGradeId}
                onValueChange={(val) => {
                  setNewGradeId(val);
                  setNewStreamId("");
                  setNewSectionId("");
                  const g = grades.find((gr) => gr.id === val);
                  if (g) {
                    setNewTitle(`${g.name} Timetable`);
                  }
                }}
              >
                <SelectTrigger className="mt-1.5 rounded-xl text-xs">
                  <SelectValue placeholder="Select Grade *" />
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

            {/* 2. Academic Stream (Displayed & Required ONLY for Grades 11-12) */}
            {isNewGrade11or12 && (
              <div className="animate-in fade-in duration-200">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  2. Academic Stream <span className="text-destructive font-bold">* (Required for Grades 11-12)</span>
                </Label>
                <Select
                  value={newStreamId || "none"}
                  onValueChange={(val) => {
                    const streamVal = val === "none" ? "" : val;
                    setNewStreamId(streamVal);
                    setNewSectionId("");
                    const g = grades.find((gr) => gr.id === newGradeId);
                    const st = streams.find((str) => str.id === streamVal);
                    const streamLabel = st ? ` (${st.name})` : "";
                    if (g) {
                      setNewTitle(`${g.name}${streamLabel} Timetable`);
                    }
                  }}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl text-xs border-amber-400">
                    <SelectValue placeholder="Select Stream (Natural / Social) *" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {streams.map((st) => (
                      <SelectItem key={st.id} value={st.id} className="text-xs">
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 3. Section (Filtered strictly to Grade and Stream) */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                {isNewGrade11or12 ? "3. Section *" : "2. Section *"}
              </Label>
              <Select
                value={newSectionId}
                disabled={!newGradeId || (isNewGrade11or12 && !newStreamId)}
                onValueChange={(val) => {
                  setNewSectionId(val);
                  const g = grades.find((gr) => gr.id === newGradeId);
                  const s = sections.find((sec) => sec.id === val);
                  const st = streams.find((str) => str.id === newStreamId);
                  const secLabel = s ? (s.name.toLowerCase().startsWith("section") ? s.name : `Section ${s.name}`) : "";
                  const streamLabel = st ? ` (${st.name})` : "";
                  if (g && secLabel) {
                    setNewTitle(`${g.name} - ${secLabel}${streamLabel} Timetable`);
                  }
                }}
              >
                <SelectTrigger className="mt-1.5 rounded-xl text-xs">
                  <SelectValue
                    placeholder={
                      !newGradeId
                        ? "Select Grade first"
                        : isNewGrade11or12 && !newStreamId
                        ? "Select Stream first"
                        : "Select Section *"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  {filteredNewSections.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs text-muted-foreground italic">
                      No sections found for this grade/stream
                    </SelectItem>
                  ) : (
                    filteredNewSections.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name.toLowerCase().startsWith("section") ? s.name : `Section ${s.name}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {newGradeId && (!isNewGrade11or12 || newStreamId) && filteredNewSections.length === 0 ? (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  No sections exist for this academic unit. Please add a section in Academic Structure.
                </p>
              ) : !newSectionId ? (
                <p className="text-[10px] text-muted-foreground mt-1">Section is mandatory for class timetables.</p>
              ) : null}
            </div>

            {/* Existing Timetable Notice */}
            {(() => {
              if (!newGradeId || !newSectionId) return null;
              const existing = timetables.find(
                (t) =>
                  t.gradeId === newGradeId &&
                  t.sectionId === newSectionId &&
                  (!newStreamId || t.streamId === newStreamId)
              );
              if (!existing) return null;
              return (
                <div className="rounded-xl p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>A timetable already exists for this class: <strong>{existing.title}</strong></span>
                </div>
              );
            })()}
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
              className="rounded-xl text-xs font-bold"
            >
              Create Draft Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog 2: Compact Assignment Drawer / Slot Modal ────────────── */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>{editingSlot ? "Edit Scheduled Period" : "Assign Class Period"}</span>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/10 text-primary border-primary/20">
                {DAY_LABELS[slotDay]} • Period {slotPeriodNumber}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an authorized curriculum subject, assigned teacher, and available room.
            </DialogDescription>
          </DialogHeader>

          {/* Dynamic Subject Availability Alert if No Subjects Configured */}
          {allowedSubjects.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold">No Curriculum Subjects Found</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  No subjects have been assigned to this grade/stream in Academic Structure.
                  Please allocate subjects before scheduling.
                </p>
              </div>
            </div>
          )}

          {/* Real-time Clash Detection Banner */}
          {conflictResult?.hasConflict && (
            <div
              className={cn(
                "p-3 rounded-2xl border space-y-1.5",
                conflictResult.hasCriticalConflict
                  ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {conflictResult.hasCriticalConflict
                    ? "Critical Scheduling Clash"
                    : "Scheduling Advisory Notice"}
                </span>
              </div>
              {conflictResult.conflicts.map((c, i) => (
                <p key={i} className="text-[11px] pl-5 leading-relaxed">
                  • {c.message}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-3.5 py-1 text-xs">
            {/* Dynamic Subject Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold">Curriculum Subject *</Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {allowedSubjects.length} authorized for this grade
                </span>
              </div>
              <Select value={slotSubjectId} onValueChange={handleSlotSubjectChange}>
                <SelectTrigger className="rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Choose subject..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  {allowedSubjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color || "#6366f1" }}
                        />
                        <span className="font-medium">{sub.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({sub.code})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Teacher Selector with Official Assignment & Specialist Badges */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold">Assigned Teacher</Label>
                {slotSubjectId && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {qualifiedTeachers.filter((t) => t.isClassSectionAssigned).length > 0
                      ? "✓ Official teacher assigned"
                      : "Optional / Any faculty"}
                  </span>
                )}
              </div>
              <Select
                value={slotTeacherId || "none"}
                onValueChange={(val) => setSlotTeacherId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Select instructor...">
                    {(() => {
                      if (!slotTeacherId || slotTeacherId === "none") return "Unassigned / Faculty to be announced";
                      const selected = qualifiedTeachers.find(
                        (t) => t.effectiveId === slotTeacherId || t.id === slotTeacherId || t.teacher_id === slotTeacherId
                      );
                      return selected ? selected.displayName : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-52">
                  <SelectItem value="none" className="text-xs text-muted-foreground">
                    Unassigned / Faculty to be announced
                  </SelectItem>
                  {qualifiedTeachers.map((t) => (
                    <SelectItem key={t.effectiveId || t.id} value={t.effectiveId || t.id} className="text-xs">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="font-medium">{t.displayName}</span>
                        <div className="flex items-center gap-1.5">
                          {t.isClassSectionAssigned ? (
                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                              ✓ Assigned Teacher
                            </span>
                          ) : t.isGradeLevelAssigned ? (
                            <span className="text-[9px] bg-sky-500/15 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded-full font-bold">
                              Grade Faculty
                            </span>
                          ) : t.isSubjectSpecialist ? (
                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                              ★ Specialist
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Classroom Selector with Availability & Capacity Badge */}
            <div>
              <Label className="text-xs font-semibold">Classroom Space</Label>
              <Select
                value={slotRoomId || "none"}
                onValueChange={(val) => setSlotRoomId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="mt-1.5 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Select classroom..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-52">
                  <SelectItem value="none" className="text-xs text-muted-foreground">
                    Default / Unallocated room
                  </SelectItem>
                  {availableClassrooms.map((room) => (
                    <SelectItem
                      key={room.id}
                      value={room.id}
                      disabled={room.isOccupied}
                      className={cn("text-xs", room.isOccupied && "opacity-50")}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{room.name} ({room.building || "Campus"})</span>
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold",
                            room.isOccupied
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {room.isOccupied ? "Occupied" : `Free (Cap: ${room.capacity || 40})`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Move / Copy Accordion */}
            {editingSlot && (
              <div className="pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowMoveCopyOptions(!showMoveCopyOptions)}
                  className="flex items-center justify-between w-full text-xs font-bold text-primary hover:underline py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Move or Duplicate this Period Slot
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showMoveCopyOptions && "rotate-180")} />
                </button>

                {showMoveCopyOptions && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] font-semibold">Target Day</Label>
                        <Select value={targetMoveDay} onValueChange={setTargetMoveDay}>
                          <SelectTrigger className="h-8 rounded-lg text-xs mt-1">
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
                        <Label className="text-[10px] font-semibold">Target Period</Label>
                        <Select
                          value={String(targetMovePeriod)}
                          onValueChange={(v) => setTargetMovePeriod(Number(v))}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {periods.filter((p) => !p.isBreak).map((p) => (
                              <SelectItem key={p.id} value={String(p.periodNumber)} className="text-xs">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMoveOrCopySlot(true)}
                        disabled={actionLoading}
                        className="h-7 text-xs flex-1 rounded-lg gap-1"
                      >
                        <ArrowRight className="w-3 h-3" />
                        Move Slot
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMoveOrCopySlot(false)}
                        disabled={actionLoading}
                        className="h-7 text-xs flex-1 rounded-lg gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Duplicate Slot
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/60">
            {editingSlot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleDeleteSlot(editingSlot.id);
                  setSlotDialogOpen(false);
                }}
                disabled={actionLoading}
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-xs mr-auto gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Slot
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSlotDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSlot}
              disabled={actionLoading || Boolean(conflictResult?.hasCriticalConflict) || allowedSubjects.length === 0}
              className="rounded-xl text-xs font-bold gap-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog 4: Comprehensive Validation Modal ────────────────────── */}
      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-primary" />
                Schedule Validation Report
              </span>
              {validationResult && (
                <Badge
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full font-bold",
                    validationResult.isValid
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                  )}
                >
                  {validationResult.isValid ? "All Clear" : `${validationResult.criticalConflicts.length} Clashes`}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              System analysis of teacher bookings, room occupancy, and weekly completeness.
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4 py-1 text-xs">
              {/* Completeness Gauge Card */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Weekly Period Coverage</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {validationResult.scheduledCount} of {validationResult.totalWeeklyPeriods} instruction periods scheduled
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-primary">
                    {validationResult.completenessScore}%
                  </span>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    {validationResult.unscheduledCount} unscheduled
                  </span>
                </div>
              </div>

              {/* Critical Conflict List */}
              {validationResult.criticalConflicts.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Critical Conflicts (Must be resolved before publishing):
                  </p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {validationResult.criticalConflicts.map((c, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-[11px]"
                      >
                        • {c.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">Zero Critical Conflicts</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      No overlapping teacher or classroom bookings detected across the entire schedule.
                    </p>
                  </div>
                </div>
              )}

              {/* Subject Distribution Summary */}
              {validationResult.subjectDistribution.length > 0 && (
                <div>
                  <p className="font-bold text-foreground mb-2">Subject Lesson Distribution (Periods / Week):</p>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {validationResult.subjectDistribution.map((item) => (
                      <div
                        key={item.subjectId}
                        className="p-2 rounded-xl border border-border/80 bg-background flex items-center justify-between text-[11px]"
                      >
                        <span className="truncate font-medium">{item.name}</span>
                        <Badge variant="outline" className="text-[10px] font-bold font-mono">
                          {item.count} periods
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setValidationDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Close Report
            </Button>
            {validationResult?.canPublish && activeTimetable?.status !== "PUBLISHED" && (
              <Button
                size="sm"
                onClick={() => {
                  setValidationDialogOpen(false);
                  handlePublishTimetable();
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Publish Live Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
