"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  UserCheck,
  Megaphone,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  BookMarked,
  Download,
  ExternalLink,
  Award,
  AlertOctagon,
  RefreshCw,
  Users,
  Bus,
  Check,
  X,
  User,
  Percent,
  Play,
  FileText,
  File,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { parentDb, type ParentNotification } from "@/lib/db/parent-db";
import { gradebookService, type ComprehensiveReportCardData } from "@/lib/gradebook-service";
import { homeworkClientService, type Homework } from "@/lib/homework-service";
import { learningMaterialClientService, type LearningMaterial } from "@/lib/homework-service";
import { DisciplineApi, type StudentDiscipline } from "@/lib/discipline-service";
import { useLanguage } from "@/lib/context/language-context";
import { useGreeting } from "@/lib/utils/greeting-utils";
import { useUnread } from "@/lib/context/unread-context";
import { db } from "@/lib/db/database";
import { getApiUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils/utils";
import { parseMaterialMeta } from "@/components/student/student-shared-materials";
import { getYouTubeThumbnailUrl } from "@/lib/utils/video-utils";

export function ParentDashboardView() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const greeting = useGreeting("parent");
  const { totalUnreadCount } = useUnread();

  // ─── Core State ───────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [firstName, setFirstName] = useState("Parent");
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Module Data States ───────────────────────────────────────────────────
  const [attendance, setAttendance] = useState<any[]>([]);
  const [statsMode, setStatsMode] = useState<"daily" | "session">("daily");
  const [notificationsList, setNotificationsList] = useState<ParentNotification[]>([]);
  const [reportCard, setReportCard] = useState<ComprehensiveReportCardData | null>(null);
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [materialsList, setMaterialsList] = useState<LearningMaterial[]>([]);
  const [disciplineIncidents, setDisciplineIncidents] = useState<StudentDiscipline[]>([]);

  // ─── 1. Load Initial Context (Parent & Selected Student) ──────────────────
  const initUserAndStudents = useCallback(() => {
    try {
      const userStr = typeof window !== "undefined" ? localStorage.getItem("attendance_current_user") : null;
      const studentsStr = typeof window !== "undefined" ? localStorage.getItem("parent_students") : null;
      const savedStudentId = typeof window !== "undefined" ? localStorage.getItem("parent_selected_student_id") : null;

      if (!userStr) {
        router.push("/login");
        return;
      }

      const user = JSON.parse(userStr);
      setCurrentUser(user);

      if (user.name) {
        const parts = user.name.trim().split(/\s+/);
        setFirstName(parts[0]);
      } else if (user.full_name) {
        setFirstName(user.full_name.split(" ")[0]);
      }

      const parsedStudents = studentsStr ? JSON.parse(studentsStr) : [];
      const students = Array.isArray(parsedStudents) ? parsedStudents : [parsedStudents].filter(Boolean);
      setAllStudents(students);

      const student = savedStudentId
        ? students.find((s: any) => s.id === savedStudentId) || students[0]
        : students[0];

      if (student) {
        setSelectedStudent(student);
        if (!savedStudentId && typeof window !== "undefined") {
          localStorage.setItem("parent_selected_student_id", student.id);
        }
        if (student.schoolId || student.school_id) {
          const scId = student.schoolId || student.school_id;
          if (typeof window !== "undefined" && !localStorage.getItem("x-school-id")) {
            localStorage.setItem("x-school-id", scId);
          }
        }
      }
    } catch (e) {
      console.error("[ParentDashboard] Context initialization error:", e);
    }
  }, [router]);

  // ─── 2. Fetch All School Management Data in Parallel ─────────────────────
  const loadDashboardData = useCallback(async (studentId: string, phone?: string) => {
    if (!studentId) return;

    try {
      const baseUrl = getApiUrl();

      // Resolve parent phone safely from arguments or localStorage
      let resolvedPhone = phone || "";
      if (!resolvedPhone && typeof window !== "undefined") {
        try {
          const uStr = localStorage.getItem("attendance_current_user");
          if (uStr) {
            const u = JSON.parse(uStr);
            resolvedPhone = u.phone || u.phoneNumber || "";
          }
        } catch {}
      }

      // Fetch school settings for attendance mode
      const settingsPromise = db.getSettings().catch(() => null);

      // Fetch Attendance records
      const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : "";
      const schoolId = typeof window !== "undefined" ? localStorage.getItem("x-school-id") : "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(schoolId ? { "x-school-id": schoolId } : {}),
      };

      const attendancePromise = fetch(
        `${baseUrl}/api/attendance/student/${studentId}?_t=${Date.now()}`,
        { headers, cache: "no-store" }
      )
        .then((r) => r.json())
        .then((data) => (data.success && Array.isArray(data.data) ? data.data : []))
        .catch(() => []);

      // Fetch Notifications & Announcements
      const notifsPromise = resolvedPhone
        ? parentDb.getNotifications(resolvedPhone).catch(() => [])
        : Promise.resolve([]);

      // Fetch Academic Report Card & Evaluated Marks
      const reportCardPromise = gradebookService.getComprehensiveReportCard(studentId).catch(() => null);
      const marksPromise = gradebookService.getStudentMarks(studentId).catch(() => []);

      // Fetch Active Homework
      const homeworkPromise = homeworkClientService.getStudentHomework(studentId).catch(() => []);

      // Fetch Shared Learning Materials
      const materialsPromise = learningMaterialClientService.getStudentMaterials(studentId).catch(() => []);

      // Fetch Discipline & Conduct status
      const disciplinePromise = (
        typeof DisciplineApi?.getStudentIncidents === "function"
          ? DisciplineApi.getStudentIncidents(studentId)
          : typeof DisciplineApi?.getIncidents === "function"
          ? DisciplineApi.getIncidents({ studentId, limit: 50 }).then((r: any) => r?.items || [])
          : Promise.resolve([])
      ).catch(() => []);

      const [
        settingsData,
        attendanceData,
        notifsData,
        cardData,
        marksData,
        hwData,
        matsData,
        discData,
      ] = await Promise.all([
        settingsPromise,
        attendancePromise,
        notifsPromise,
        reportCardPromise,
        marksPromise,
        homeworkPromise,
        materialsPromise,
        disciplinePromise,
      ]);

      if (settingsData?.attendanceMode) {
        setStatsMode(settingsData.attendanceMode === "session_based" ? "session" : "daily");
      }
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setNotificationsList(Array.isArray(notifsData) ? notifsData : []);
      setReportCard(cardData || null);
      setStudentMarks(Array.isArray(marksData) ? marksData : Array.isArray((marksData as any)?.marks) ? (marksData as any).marks : []);
      setHomeworkList(Array.isArray(hwData) ? hwData : []);
      setMaterialsList(Array.isArray(matsData) ? matsData : []);
      setDisciplineIncidents(Array.isArray(discData) ? discData : []);
    } catch (err) {
      console.error("[ParentDashboard] Load error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // ─── 3. Mount & Synchronization Listeners ─────────────────────────────────
  useEffect(() => {
    initUserAndStudents();
  }, [initUserAndStudents]);

  useEffect(() => {
    if (selectedStudent?.id) {
      setIsLoading(true);
      loadDashboardData(selectedStudent.id, currentUser?.phone);
    }
  }, [selectedStudent?.id, currentUser?.phone, loadDashboardData]);

  // Listen to student switch events from parent layout header
  useEffect(() => {
    const handleStudentChanged = () => {
      const savedStudentId = localStorage.getItem("parent_selected_student_id");
      const studentsStr = localStorage.getItem("parent_students");
      if (studentsStr && savedStudentId) {
        try {
          const list = JSON.parse(studentsStr);
          const found = list.find((s: any) => s.id === savedStudentId);
          if (found) {
            setSelectedStudent(found);
          }
        } catch {}
      }
    };

    window.addEventListener("studentChanged", handleStudentChanged);
    window.addEventListener("parentNotificationsChanged", handleStudentChanged);

    return () => {
      window.removeEventListener("studentChanged", handleStudentChanged);
      window.removeEventListener("parentNotificationsChanged", handleStudentChanged);
    };
  }, []);

  // Switch student from in-dashboard widget
  const handleSwitchChild = (student: any) => {
    setSelectedStudent(student);
    localStorage.setItem("parent_selected_student_id", student.id);
    if (student.schoolId || student.school_id) {
      localStorage.setItem("x-school-id", student.schoolId || student.school_id);
    }
    window.dispatchEvent(new Event("studentChanged"));
  };

  const handleRefresh = () => {
    if (selectedStudent?.id) {
      setIsRefreshing(true);
      loadDashboardData(selectedStudent.id, currentUser?.phone);
    }
  };

  // ─── 4. Compute Metrics & Analytics ───────────────────────────────────────

  // A. Attendance Metrics
  const attendanceStats = useMemo(() => {
    const total = attendance.length;
    if (total === 0) return { rate: 100, present: 0, absent: 0, late: 0, excused: 0, total: 0 };

    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    attendance.forEach((a) => {
      const status = (a.status || "").toUpperCase();
      if (status === "PRESENT") present++;
      else if (status === "LATE") late++;
      else if (status === "ABSENT") absent++;
      else if (status === "EXCUSED") excused++;
    });

    const attended = present + late;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 100;
    return { rate, present, late, absent, excused, total };
  }, [attendance]);

  // Today's Status
  const todayStatus = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" });
    const todayRecords = attendance.filter((a) => {
      const rawDate = a.date || a.attendance_date || a.createdAt;
      const d = typeof rawDate === "string" ? rawDate.slice(0, 10) : "";
      return d === todayStr;
    });

    const morning = todayRecords.find((r) => r.session?.toLowerCase() === "morning");
    const afternoon = todayRecords.find((r) => r.session?.toLowerCase() === "afternoon");
    const daily = todayRecords.find((r) => !r.session || r.session === "daily");

    return {
      isSessionBased: statsMode === "session",
      morning: morning?.status,
      afternoon: afternoon?.status,
      daily: daily?.status || morning?.status,
    };
  }, [attendance, statsMode]);

  // B. Academic Metrics
  const academicStats = useMemo(() => {
    if (reportCard?.summary?.averageRow?.overallAverage) {
      return {
        average: reportCard.summary.averageRow.overallAverage,
        rank: reportCard.summary.rank || "—",
        conduct: reportCard.summary.conduct || "Good",
        subjects: reportCard.subjectRows || [],
      };
    }

    if (studentMarks.length > 0) {
      const validMarks = studentMarks.filter(
        (m) => !m.isAbsent && m.score != null && m.assessment?.maxScore > 0
      );
      if (validMarks.length > 0) {
        const totalPct = validMarks.reduce(
          (acc, m) => acc + (m.score / m.assessment.maxScore) * 100,
          0
        );
        const avg = Math.round((totalPct / validMarks.length) * 10) / 10;
        return {
          average: avg,
          rank: "Evaluated",
          conduct: "Good",
          subjects: [],
        };
      }
    }

    return { average: null, rank: "Pending", conduct: "Good", subjects: [] };
  }, [reportCard, studentMarks]);

  // C. Homework Metrics
  const homeworkStats = useMemo(() => {
    const pending = homeworkList.filter((h) => !h.isSubmitted);
    const submitted = homeworkList.filter((h) => h.isSubmitted);
    const overdue = homeworkList.filter((h) => h.isOverdue && !h.isSubmitted);
    return {
      total: homeworkList.length,
      pendingCount: pending.length,
      submittedCount: submitted.length,
      overdueCount: overdue.length,
      upcoming: pending.slice(0, 3),
    };
  }, [homeworkList]);

  // D. Emergency & Broadcast Notices
  const emergencyNotices = useMemo(() => {
    return notificationsList.filter(
      (n) => n.type === "emergency" || n.priority === "urgent" || n.category === "EMERGENCY"
    );
  }, [notificationsList]);

  // Format Helper
  const getStatusBadge = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "present") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" /> Present
        </span>
      );
    }
    if (s === "late") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <Clock className="w-3.5 h-3.5" /> Late
        </span>
      );
    }
    if (s === "absent") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <X className="w-3.5 h-3.5" /> Absent
        </span>
      );
    }
    if (s === "excused") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          <Check className="w-3.5 h-3.5" /> Excused
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        Unmarked
      </span>
    );
  };

  // ─── Render Skeletons During Initial Load ─────────────────────────────────
  if (isLoading && !selectedStudent) {
    return (
      <div className="w-full space-y-4 sm:space-y-6 animate-pulse">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 sm:h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 sm:h-80 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* ─── 1. HERO HEADER & CHILD SWITCHER ─────────────────────────────── */}
      <div className="rounded-3xl p-4 sm:p-6 md:p-8 bg-gradient-to-br from-white via-white to-purple-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/20 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        {/* Decorative backdrop glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          {/* Welcome greeting & child identity */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <Avatar className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl ring-4 ring-purple-100 dark:ring-purple-900/40 shadow-sm shrink-0">
              {selectedStudent?.photo && (
                <AvatarImage src={selectedStudent.photo} alt={selectedStudent.fullName} />
              )}
              <AvatarFallback className="rounded-2xl bg-purple-600 text-white font-black text-xl">
                {selectedStudent?.fullName
                  ? selectedStudent.fullName.slice(0, 2).toUpperCase()
                  : "ST"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {greeting}, {firstName}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-foreground tracking-tight truncate">
                {selectedStudent?.fullName || selectedStudent?.name || "Student Dashboard"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge variant="secondary" className="font-bold text-xs rounded-lg">
                  Grade {typeof selectedStudent?.grade === "object" ? selectedStudent?.grade?.name : selectedStudent?.grade || "—"}
                  {selectedStudent?.section ? ` • Sec ${typeof selectedStudent?.section === "object" ? selectedStudent?.section?.name : selectedStudent?.section}` : ""}
                </Badge>
                {selectedStudent?.student_id && (
                  <Badge variant="outline" className="font-mono text-xs rounded-lg">
                    ID: {selectedStudent.student_id}
                  </Badge>
                )}
                {reportCard?.academic?.academicYearName && (
                  <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                    • {reportCard.academic.academicYearName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Child Switcher Pills & Refresh Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {allStudents.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto max-w-full no-scrollbar">
                {allStudents.map((s) => {
                  const isActive = s.id === selectedStudent?.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSwitchChild(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                        isActive
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-foreground"
                      )}
                    >
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{s.fullName?.split(" ")[0] || s.name?.split(" ")[0] || "Child"}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-2xl h-10 px-3.5 text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-800 shrink-0"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-purple-600")} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 2. EMERGENCY BROADCASTS BANNER (IF ANY) ─────────────────────── */}
      {emergencyNotices.length > 0 && (
        <div className="space-y-3">
          {emergencyNotices.map((notice) => (
            <Alert
              key={notice.id}
              variant="destructive"
              className="border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100 rounded-3xl shadow-sm"
            >
              <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              <AlertTitle className="font-black text-sm uppercase flex items-center gap-2">
                Emergency School Notice
              </AlertTitle>
              <AlertDescription className="text-xs font-medium mt-1 leading-relaxed">
                <strong>{notice.title}:</strong> {notice.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* ─── 3. TOP KPI METRICS STRIP (4 UNIFIED CARDS) ───────────────────── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {/* KPI 1: Academic Standing */}
        <Link href="/parent/academics" className="group block h-full">
          <Card className="rounded-3xl border border-border/80 bg-card hover:border-purple-400/80 hover:shadow-md transition-all h-full group-hover:scale-[1.01] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-2.5 sm:gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10.5px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
                  Academic Standing
                </span>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {academicStats.average != null ? `${academicStats.average}%` : "Good"}
                </div>
                <div className="text-[11px] sm:text-xs text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1 min-w-0">
                  <Award className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {academicStats.rank !== "Pending" ? `Rank ${academicStats.rank}` : "View Report Card"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPI 2: Attendance Rate */}
        <Link href="/parent/attendance" className="group block h-full">
          <Card className="rounded-3xl border border-border/80 bg-card hover:border-emerald-400/80 hover:shadow-md transition-all h-full group-hover:scale-[1.01] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-2.5 sm:gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10.5px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
                  Attendance Health
                </span>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {attendanceStats.rate}%
                </div>
                <div className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 min-w-0">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Today: {todayStatus.daily ? todayStatus.daily.toUpperCase() : "On Schedule"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPI 3: Homework & Tasks */}
        <Link href="/parent/homework" className="group block h-full">
          <Card className="rounded-3xl border border-border/80 bg-card hover:border-amber-400/80 hover:shadow-md transition-all h-full group-hover:scale-[1.01] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-2.5 sm:gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10.5px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
                  Active Homework
                </span>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-baseline gap-1">
                  {homeworkStats.pendingCount}
                  <span className="text-xs text-muted-foreground font-normal">pending</span>
                </div>
                <div className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 min-w-0">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {homeworkStats.overdueCount > 0
                      ? `${homeworkStats.overdueCount} Overdue`
                      : `${homeworkStats.submittedCount} completed`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPI 4: Communications & Notices */}
        <Link href="/parent/communication" className="group block h-full">
          <Card className="rounded-3xl border border-border/80 bg-card hover:border-blue-400/80 hover:shadow-md transition-all h-full group-hover:scale-[1.01] overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full gap-2.5 sm:gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10.5px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
                  Messages & Notices
                </span>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {totalUnreadCount > 0 ? `${totalUnreadCount} New` : "Clear"}
                </div>
                <div className="text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Chat with teachers</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ─── 4. MAIN DASHBOARD CONTENT GRID ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 items-stretch">
        {/* Card 1: Academic Performance & Evaluations */}
        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 sm:pb-3 pb-3 flex flex-row items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </span>
                <span className="truncate">Academic Performance</span>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Evaluations, exam results, and official term grade progress
              </CardDescription>
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl shrink-0 h-8 px-2.5"
            >
              <Link href="/parent/academics" className="gap-1 flex items-center">
                <span>Report Card</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 flex-1 flex flex-col justify-between space-y-4 min-w-0">
            {/* Subject Breakdown Progress Rows */}
            {academicStats.subjects.length > 0 ? (
              <div className="space-y-3">
                {academicStats.subjects.slice(0, 4).map((sub: any) => {
                  const pct = sub.cumulativeAverage ?? sub.average ?? 0;
                  return (
                    <div key={sub.subjectId || sub.subjectName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold gap-2">
                        <span className="text-foreground truncate">{sub.subjectName}</span>
                        <span className="text-purple-600 dark:text-purple-400 shrink-0">
                          {pct}% {sub.letterGrade ? `(${sub.letterGrade})` : ""}
                        </span>
                      </div>
                      <Progress value={pct} className="h-2 rounded-full" />
                    </div>
                  );
                })}
              </div>
            ) : studentMarks.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  Recent Evaluations & Test Scores:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {studentMarks.slice(0, 4).map((m: any) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-xs min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate">
                          {m.assessment?.title || "Assessment"}
                        </p>
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {m.assessment?.subject?.name || "Subject"}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-purple-600 text-sm">
                          {m.score ?? 0}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          /{m.assessment?.maxScore ?? 100}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 space-y-2 my-auto">
                <Award className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-muted-foreground font-medium">
                  No term evaluations recorded yet for this academic period.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mt-auto">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Conduct: <strong className="text-foreground">{academicStats.conduct}</strong></span>
              </span>
              <Link
                href="/parent/academics"
                className="font-bold text-purple-600 hover:underline flex items-center gap-1 ml-auto"
              >
                <span>Full Breakdown</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Today's Attendance Check-in */}
        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 sm:pb-3 pb-3 flex flex-row items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </span>
                <span className="truncate">Today&apos;s Attendance</span>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Real-time check-in and session presence
              </CardDescription>
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl shrink-0 h-8 px-2.5"
            >
              <Link href="/parent/attendance" className="gap-1 flex items-center">
                <span>Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 flex-1 flex flex-col justify-between space-y-4 min-w-0">
            <div className="space-y-3">
              {todayStatus.isSessionBased ? (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-center space-y-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Morning
                    </span>
                    <div className="flex justify-center">{getStatusBadge(todayStatus.morning)}</div>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-center space-y-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Afternoon
                    </span>
                    <div className="flex justify-center">{getStatusBadge(todayStatus.afternoon)}</div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-center space-y-1.5 min-w-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Daily Presence
                  </span>
                  <div className="flex justify-center">{getStatusBadge(todayStatus.daily)}</div>
                </div>
              )}

              {/* Attendance Breakdown Pills */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-xs pt-1">
                <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 min-w-0">
                  <div className="font-black text-sm">{attendanceStats.present}</div>
                  <span className="text-[9px] uppercase font-bold truncate block">Present</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 min-w-0">
                  <div className="font-black text-sm">{attendanceStats.late}</div>
                  <span className="text-[9px] uppercase font-bold truncate block">Late</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 min-w-0">
                  <div className="font-black text-sm">{attendanceStats.absent}</div>
                  <span className="text-[9px] uppercase font-bold truncate block">Absent</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 min-w-0">
                  <div className="font-black text-sm">{attendanceStats.excused}</div>
                  <span className="text-[9px] uppercase font-bold truncate block">Excused</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 mt-auto">
              <Button
                asChild
                variant="outline"
                className="w-full rounded-2xl text-xs font-bold border-slate-200 dark:border-slate-800 h-9"
              >
                <Link href="/parent/attendance" className="flex items-center justify-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">View Detailed Attendance Calendar</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Pending Homework & Deadlines */}
        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 sm:pb-3 pb-3 flex flex-row items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </span>
                <span className="truncate">Homework & Tasks</span>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Active assignments, submission deadlines, and grading
              </CardDescription>
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl shrink-0 h-8 px-2.5"
            >
              <Link href="/parent/homework" className="gap-1 flex items-center">
                <span>All Tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 flex-1 flex flex-col justify-between space-y-3 min-w-0">
            {homeworkStats.upcoming.length > 0 ? (
              <div className="space-y-2.5">
                {homeworkStats.upcoming.map((hw) => (
                  <div
                    key={hw.id}
                    className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2.5 hover:border-amber-300 dark:hover:border-amber-800 transition-colors min-w-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-white truncate max-w-[120px]"
                          style={{ backgroundColor: hw.subject?.color || "#f59e0b" }}
                        >
                          {hw.subject?.name || "Subject"}
                        </span>
                        {hw.isOverdue && (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-bold">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate">{hw.title}</h4>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>{hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : "No deadline"}</span>
                      </span>
                      <Badge
                        variant={hw.isSubmitted ? "secondary" : "outline"}
                        className="text-[10px] font-bold"
                      >
                        {hw.isSubmitted ? "Submitted" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 space-y-2 my-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-muted-foreground font-medium">
                  All homework is up to date! No pending assignments.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground mt-auto">
              <span>{homeworkStats.pendingCount} pending • {homeworkStats.submittedCount} submitted</span>
              <Link
                href="/parent/homework"
                className="font-bold text-amber-600 hover:underline flex items-center gap-1 ml-auto"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: School Announcements */}
        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 sm:pb-3 pb-3 flex flex-row items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </span>
                <span className="truncate">School Announcements</span>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Recent circulars, event alerts, and official notices
              </CardDescription>
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl shrink-0 h-8 px-2.5"
            >
              <Link href="/parent/announcements" className="gap-1 flex items-center">
                <span>All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 flex-1 flex flex-col justify-between space-y-3 min-w-0">
            {notificationsList.length > 0 ? (
              <div className="space-y-2.5">
                {notificationsList.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1 text-xs min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-bold text-foreground truncate min-w-0">{n.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 space-y-2 my-auto">
                <Megaphone className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-muted-foreground font-medium">
                  No active school announcements at this time.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground mt-auto">
              <span>{notificationsList.length} total messages</span>
              <Link
                href="/parent/announcements"
                className="font-bold text-purple-600 hover:underline flex items-center gap-1 ml-auto"
              >
                <span>Read Notices</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Recently Shared Learning Materials */}
        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 sm:pb-3 pb-3 flex flex-row items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <BookMarked className="w-4 h-4" />
                </span>
                <span className="truncate">Shared Learning Materials</span>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Lessons, video lectures, and worksheets published by teachers
              </CardDescription>
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl shrink-0 h-8 px-2.5"
            >
              <Link href="/parent/materials" className="gap-1 flex items-center">
                <span>Browse</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 flex-1 flex flex-col justify-between space-y-3 min-w-0">
            {materialsList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {materialsList.slice(0, 4).map((m) => {
                  const isVideo = (m.fileType || "").toUpperCase() === "VIDEO";
                  const { meta } = parseMaterialMeta(m.description);
                  const thumbUrl = meta.thumbnailUrl || (isVideo ? getYouTubeThumbnailUrl(m.fileUrl) : undefined);

                  return (
                    <Link
                      key={m.id}
                      href="/parent/materials"
                      className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 flex items-center justify-between gap-2.5 transition-colors group cursor-pointer min-w-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {thumbUrl ? (
                          <div className="w-11 h-8 sm:w-12 sm:h-9 rounded-xl overflow-hidden shrink-0 relative bg-slate-200 dark:bg-slate-800 border border-border/50">
                            <img
                              src={thumbUrl}
                              alt={m.title}
                              className="w-full h-full object-cover"
                            />
                            {isVideo && (
                              <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                                <Play className="w-3 h-3 text-white fill-current" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0",
                              isVideo
                                ? "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"
                            )}
                          >
                            {isVideo ? <Play className="w-4 h-4 fill-current" /> : <FileText className="w-4 h-4" />}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-foreground truncate group-hover:text-purple-600 transition-colors">
                            {m.title}
                          </h5>
                          <span className="text-[10px] text-muted-foreground uppercase truncate block">
                            {m.subject?.name || m.fileType || "Resource"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-purple-600 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 space-y-2 my-auto">
                <BookMarked className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-muted-foreground font-medium">
                  No learning materials uploaded yet for this class.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground mt-auto">
              <span>{materialsList.length} total resources</span>
              <Link
                href="/parent/materials"
                className="font-bold text-blue-600 hover:underline flex items-center gap-1 ml-auto"
              >
                <span>Explore Library</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Quick Actions Hub */}
        <Card className="rounded-3xl border border-border/80 bg-card overflow-hidden shadow-xs flex flex-col h-full hover:shadow-md transition-shadow">
          <CardHeader className="p-4 sm:p-5 sm:pb-3 pb-3 flex flex-row items-start justify-between gap-3 min-w-0">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-black flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </span>
                <span className="truncate">Quick Actions Hub</span>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Direct access to school services and child records
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 sm:pt-0 flex-1 flex flex-col justify-between space-y-2.5 min-w-0">
            <div className="space-y-2">
              <Link
                href="/parent/academics"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 transition-colors text-xs font-bold group min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="truncate">Print Official Term Report Card</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/parent/communication"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors text-xs font-bold group min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">Message Class & Subject Teachers</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/parent/discipline"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 transition-colors text-xs font-bold group min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">Review Conduct & Commendations</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/parent/transport"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800 transition-colors text-xs font-bold group min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Bus className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="truncate">Track School Bus & Route</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground mt-auto">
              <span>Parent Shortcuts</span>
              <span className="text-[11px] font-semibold text-purple-600">Portal Services</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
