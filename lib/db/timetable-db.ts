import { API_URL } from "@/lib/api-config";
import { apiFetch } from "@/lib/utils/fetch-with-timeout";

export interface TimetableSlotData {
  id: string;
  timetableId: string;
  dayOfWeek: string;
  periodNumber: number;
  periodId?: string | null;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId?: string | null;
  classroomId?: string | null;
  gradeId: string;
  sectionId: string;
  streamId?: string | null;
  notes?: string | null;
  isCancelled?: boolean;
  substituteTeacherId?: string | null;
  subject?: { id: string; name: string; code: string; color?: string };
  teacher?: { id: string; name: string; phone?: string | null };
  substituteTeacher?: { id: string; name: string } | null;
  classroom?: { id: string; name: string; building?: string | null } | null;
  period?: { id: string; name: string; startTime: string; endTime: string; isBreak?: boolean } | null;
}

export interface TimetableHeader {
  id: string;
  title: string;
  gradeId: string;
  sectionId?: string | null;
  streamId?: string | null;
  academicYearId?: string | null;
  termId?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  grade?: { id: string; name: string };
  section?: { id: string; name: string };
  stream?: { id: string; name: string };
  academicYear?: { id: string; name: string };
  term?: { id: string; name: string };
  _count?: { slots: number };
}

export interface TimetableDetail extends TimetableHeader {
  slots: TimetableSlotData[];
}

export interface TimetablePeriod {
  id: string;
  name: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface Classroom {
  id: string;
  name: string;
  code?: string | null;
  building?: string | null;
  floor?: string | null;
  capacity?: number;
  type?: string;
  isActive?: boolean;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: "TEACHER" | "CLASSROOM" | "SECTION";
    message: string;
    existingSlot?: any;
  }>;
}

class TimetableDatabase {
  private getHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null;
    const schoolId = typeof window !== "undefined" ? localStorage.getItem("x-school-id") : null;
    let userRole: string | null = null;
    try {
      const userStr = typeof window !== "undefined" ? localStorage.getItem("attendance_current_user") : null;
      if (userStr) {
        const u = JSON.parse(userStr);
        userRole = u?.role || null;
      }
    } catch {}

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (schoolId) headers["x-school-id"] = schoolId;
    if (userRole) headers["x-requested-role"] = userRole;
    return headers;
  }

  async listTimetables(filters?: {
    gradeId?: string;
    sectionId?: string;
    academicYearId?: string;
    status?: string;
  }): Promise<TimetableHeader[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.gradeId) params.set("gradeId", filters.gradeId);
      if (filters?.sectionId) params.set("sectionId", filters.sectionId);
      if (filters?.academicYearId) params.set("academicYearId", filters.academicYearId);
      if (filters?.status) params.set("status", filters.status);

      const res = await apiFetch<{ success: boolean; data: TimetableHeader[] }>(
        `${API_URL}/api/timetables?${params.toString()}`,
        { headers: this.getHeaders() }
      );
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.warn("[TimetableDB] Fallback to cache/mock list:", err);
    }
    return this.getCachedTimetables();
  }

  async getTimetableById(id: string): Promise<TimetableDetail | null> {
    try {
      const res = await apiFetch<{ success: boolean; data: TimetableDetail }>(
        `${API_URL}/api/timetables/${id}`,
        { headers: this.getHeaders() }
      );
      if (res?.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn("[TimetableDB] Fallback to cached timetable detail:", err);
    }
    return this.getCachedTimetableDetail(id);
  }

  async createTimetable(data: {
    title: string;
    gradeId: string;
    sectionId?: string;
    streamId?: string;
    academicYearId?: string;
    termId?: string;
  }): Promise<TimetableHeader> {
    try {
      const res = await apiFetch<{ success: boolean; data: TimetableHeader }>(
        `${API_URL}/api/timetables`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (res?.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn("[TimetableDB] API create error, using local fallback:", err);
    }

    // Local fallback for offline/demo resilience
    const newRecord: TimetableHeader = {
      id: "tt-" + Date.now(),
      title: data.title,
      gradeId: data.gradeId,
      sectionId: data.sectionId || null,
      streamId: data.streamId || null,
      academicYearId: data.academicYearId || null,
      termId: data.termId || null,
      status: "DRAFT",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { slots: 0 },
    };
    this.saveCachedTimetable(newRecord);
    return newRecord;
  }

  async updateTimetable(
    id: string,
    data: {
      title?: string;
      status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      effectiveStartDate?: string;
      effectiveEndDate?: string;
    }
  ): Promise<any> {
    try {
      const res = await apiFetch<{ success: boolean; data: any }>(
        `${API_URL}/api/timetables/${id}`,
        {
          method: "PUT",
          headers: this.getHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (res?.success) return res.data;
    } catch (err) {
      console.warn("[TimetableDB] API update error, updating local state:", err);
    }

    const cached = this.getCachedTimetables();
    const idx = cached.findIndex((t) => t.id === id);
    if (idx !== -1) {
      cached[idx] = { ...cached[idx], ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem("attendance_cached_timetables", JSON.stringify(cached));
    }
    return { success: true };
  }

  async checkConflict(params: {
    timetableId?: string;
    dayOfWeek: string;
    periodNumber: number;
    teacherId?: string | null;
    classroomId?: string | null;
    gradeId?: string;
    sectionId?: string;
    excludeSlotId?: string;
  }): Promise<ConflictCheckResult> {
    try {
      const res = await apiFetch<{ success: boolean; data: ConflictCheckResult }>(
        `${API_URL}/api/timetables/check-conflict`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(params),
        }
      );
      if (res?.success && res.data) return res.data;
    } catch (err) {
      console.warn("[TimetableDB] Conflict check API error:", err);
    }
    return { hasConflict: false, conflicts: [] };
  }

  async upsertSlot(
    timetableId: string,
    data: {
      slotId?: string;
      dayOfWeek: string;
      periodNumber: number;
      periodId?: string;
      startTime: string;
      endTime: string;
      subjectId: string;
      teacherId?: string | null;
      classroomId?: string | null;
      gradeId: string;
      sectionId: string;
      streamId?: string | null;
      notes?: string | null;
      substituteTeacherId?: string | null;
      force?: boolean;
    }
  ): Promise<TimetableSlotData> {
    try {
      const res = await apiFetch<{ success: boolean; data: TimetableSlotData; conflicts?: any[] }>(
        `${API_URL}/api/timetables/${timetableId}/slots`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (res?.success && res.data) return res.data;
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes("conflict")) {
        throw err;
      }
      console.warn("[TimetableDB] Fallback slot upsert:", err);
    }

    return {
      id: data.slotId || "slot-" + Date.now(),
      timetableId,
      dayOfWeek: data.dayOfWeek,
      periodNumber: data.periodNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      subjectId: data.subjectId,
      teacherId: data.teacherId || null,
      classroomId: data.classroomId || null,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      notes: data.notes || null,
      substituteTeacherId: data.substituteTeacherId || null,
    };
  }

  async deleteSlot(timetableId: string, slotId: string): Promise<boolean> {
    try {
      const res = await apiFetch<{ success: boolean }>(
        `${API_URL}/api/timetables/${timetableId}/slots/${slotId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        }
      );
      return res?.success ?? true;
    } catch (err) {
      console.warn("[TimetableDB] Error deleting slot:", err);
      return true;
    }
  }

  async getPeriods(): Promise<TimetablePeriod[]> {
    try {
      const res = await apiFetch<{ success: boolean; data: TimetablePeriod[] }>(
        `${API_URL}/api/timetables/periods`,
        { headers: this.getHeaders() }
      );
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}

    return [
      { id: "p1", name: "Period 1", periodNumber: 1, startTime: "08:30", endTime: "09:15", isBreak: false },
      { id: "p2", name: "Period 2", periodNumber: 2, startTime: "09:20", endTime: "10:05", isBreak: false },
      { id: "b1", name: "Morning Break", periodNumber: 3, startTime: "10:05", endTime: "10:30", isBreak: true },
      { id: "p3", name: "Period 3", periodNumber: 4, startTime: "10:30", endTime: "11:15", isBreak: false },
      { id: "p4", name: "Period 4", periodNumber: 5, startTime: "11:20", endTime: "12:05", isBreak: false },
      { id: "b2", name: "Lunch Break", periodNumber: 6, startTime: "12:05", endTime: "01:05", isBreak: true },
      { id: "p5", name: "Period 5", periodNumber: 7, startTime: "01:10", endTime: "01:55", isBreak: false },
      { id: "p6", name: "Period 6", periodNumber: 8, startTime: "02:00", endTime: "02:45", isBreak: false },
    ];
  }

  async getClassrooms(): Promise<Classroom[]> {
    try {
      const res = await apiFetch<{ success: boolean; data: Classroom[] }>(
        `${API_URL}/api/timetables/classrooms`,
        { headers: this.getHeaders() }
      );
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}

    return [
      { id: "c1", name: "Room 101", code: "R101", building: "Main Hall", capacity: 45, type: "STANDARD" },
      { id: "c2", name: "Room 102", code: "R102", building: "Main Hall", capacity: 45, type: "STANDARD" },
      { id: "c3", name: "Room 103", code: "R103", building: "Main Hall", capacity: 40, type: "STANDARD" },
      { id: "c4", name: "Room 201", code: "R201", building: "East Wing", capacity: 40, type: "STANDARD" },
      { id: "c5", name: "Room 204", code: "R204", building: "East Wing", capacity: 40, type: "STANDARD" },
      { id: "c6", name: "Science Lab 1", code: "LAB-SCI", building: "STEM Block", capacity: 35, type: "LABORATORY" },
      { id: "c7", name: "Computer Lab", code: "LAB-IT", building: "STEM Block", capacity: 35, type: "COMPUTER_LAB" },
    ];
  }

  // ─── Local Storage Cache Helpers ───────────────────────────────────────────
  private getCachedTimetables(): TimetableHeader[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("attendance_cached_timetables");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: "tt-sample-1",
        title: "Grade 12 Natural - Section A (2026/27)",
        gradeId: "g12",
        sectionId: "sec-a",
        streamId: "stream-nat",
        status: "PUBLISHED",
        version: 1,
        publishedAt: "2026-09-15T08:00:00Z",
        createdAt: "2026-09-10T08:00:00Z",
        updatedAt: "2026-09-15T08:00:00Z",
        grade: { id: "g12", name: "Grade 12" },
        section: { id: "sec-a", name: "Section A" },
        stream: { id: "stream-nat", name: "Natural" },
        _count: { slots: 25 },
      },
      {
        id: "tt-sample-2",
        title: "Grade 11 Social - Section B (2026/27)",
        gradeId: "g11",
        sectionId: "sec-b",
        streamId: "stream-soc",
        status: "DRAFT",
        version: 2,
        createdAt: "2026-10-01T08:00:00Z",
        updatedAt: "2026-10-08T08:00:00Z",
        grade: { id: "g11", name: "Grade 11" },
        section: { id: "sec-b", name: "Section B" },
        stream: { id: "stream-soc", name: "Social" },
        _count: { slots: 18 },
      },
    ];
  }

  private saveCachedTimetable(record: TimetableHeader) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getCachedTimetables();
      list.unshift(record);
      localStorage.setItem("attendance_cached_timetables", JSON.stringify(list));
    } catch {}
  }

  private getCachedTimetableDetail(id: string): TimetableDetail | null {
    const list = this.getCachedTimetables();
    const item = list.find((t) => t.id === id) || list[0];
    if (!item) return null;

    return {
      ...item,
      slots: [
        {
          id: "s-1",
          timetableId: item.id,
          dayOfWeek: "MONDAY",
          periodNumber: 1,
          startTime: "08:30",
          endTime: "09:15",
          subjectId: "sub-math",
          subject: { id: "sub-math", name: "Mathematics", code: "MATH12", color: "#f59e0b" },
          teacher: { id: "t-1", name: "W/ro. Sara Yimer" },
          classroom: { id: "c1", name: "Room 102" },
          gradeId: item.gradeId,
          sectionId: item.sectionId || "sec-a",
        },
        {
          id: "s-2",
          timetableId: item.id,
          dayOfWeek: "MONDAY",
          periodNumber: 2,
          startTime: "09:20",
          endTime: "10:05",
          subjectId: "sub-phys",
          subject: { id: "sub-phys", name: "Physics", code: "PHYS12", color: "#3b82f6" },
          teacher: { id: "t-2", name: "Ato Abebe Kebede" },
          classroom: { id: "c1", name: "Room 102" },
          gradeId: item.gradeId,
          sectionId: item.sectionId || "sec-a",
        },
        {
          id: "s-3",
          timetableId: item.id,
          dayOfWeek: "MONDAY",
          periodNumber: 4,
          startTime: "10:30",
          endTime: "11:15",
          subjectId: "sub-eng",
          subject: { id: "sub-eng", name: "English", code: "ENG12", color: "#ef4444" },
          teacher: { id: "t-3", name: "W/ro. Selam Bekele" },
          classroom: { id: "c2", name: "Room 101" },
          gradeId: item.gradeId,
          sectionId: item.sectionId || "sec-a",
        },
        {
          id: "s-4",
          timetableId: item.id,
          dayOfWeek: "MONDAY",
          periodNumber: 5,
          startTime: "11:20",
          endTime: "12:05",
          subjectId: "sub-chem",
          subject: { id: "sub-chem", name: "Chemistry", code: "CHEM12", color: "#06b6d4" },
          teacher: { id: "t-4", name: "W/ro. Mihret Alem" },
          classroom: { id: "c6", name: "Science Lab 1" },
          gradeId: item.gradeId,
          sectionId: item.sectionId || "sec-a",
        },
      ],
    };
  }
}

export const timetableDb = new TimetableDatabase();
