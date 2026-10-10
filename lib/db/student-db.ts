import { apiUrl } from "@/lib/api-config";
import { apiFetch } from "@/lib/utils/fetch-with-timeout";
import { queryCache } from "@/lib/utils/query-cache";

const API_URL = apiUrl;

export interface StudentUser {
  id: string;
  student_id: string;
  fullName: string;
  name?: string;
  grade?: string;
  section?: string;
  stream?: string | null;
  photo?: string | null;
}

export interface StudentDashboardData {
  student: StudentUser;
  academicYear: string;
  stats: {
    overallAverage: number;
    averageTrend: string;
    attendancePercentage: number;
    attendanceStatus: string;
    presentDays: number;
    absentDays: number;
    lateDays: number;
  };
  todayTimetable: Array<{
    id: string;
    time: string;
    subject: string;
    teacher: string;
    room: string;
    periodNumber?: number;
  }>;
  recentMarks: Array<{
    id: string;
    subject: string;
    assessment: string;
    score: string;
    grade: string;
    date: string | Date;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    message: string;
    date: string | Date;
    category: string;
  }>;
}

class StudentDatabase {
  private getHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  // ─── AUTHENTICATION ──────────────────────────────────────────────────────────

  async login(studentId: string, password: string): Promise<any> {
    const res = await apiFetch<{ success: boolean; token: string; student: any; school: any; message?: string }>(
      `${API_URL}/api/student/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password }),
      }
    );

    if (res.success && res.token && typeof window !== "undefined") {
      localStorage.setItem("attendance_token", res.token);
      localStorage.setItem(
        "attendance_current_user",
        JSON.stringify({
          id: res.student.id,
          studentId: res.student.id,
          studentCode: res.student.student_id,
          name: res.student.fullName,
          role: "student",
          grade: res.student.grade,
          section: res.student.section,
          stream: res.student.stream,
          schoolId: res.school?.id || "single-school",
          schoolName: res.school?.name || "Bright Path",
          schoolLogo: res.school?.logo || "",
          profile_photo: res.student.photo || null,
        })
      );
      window.dispatchEvent(new Event("userSessionChanged"));
    }

    return res;
  }

  async initiateForgotPassword(studentId: string): Promise<any> {
    return apiFetch<{ success: boolean; maskedPhone?: string; message?: string; debugCode?: string }>(
      `${API_URL}/api/student/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      }
    );
  }

  async verifyOtp(studentId: string, code: string): Promise<any> {
    return apiFetch<{ success: boolean; message?: string }>(
      `${API_URL}/api/student/verify-otp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, code }),
      }
    );
  }

  async resetPassword(studentId: string, code: string, newPassword: string): Promise<any> {
    return apiFetch<{ success: boolean; message?: string }>(
      `${API_URL}/api/student/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, code, newPassword }),
      }
    );
  }

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────

  async getDashboard(): Promise<StudentDashboardData> {
    return queryCache.fetch(
      "student_dashboard_overview",
      async () => {
        const res = await apiFetch<{ success: boolean; data: StudentDashboardData }>(
          `${API_URL}/api/student/dashboard`,
          { headers: this.getHeaders() }
        );
        return res.data;
      },
      { staleTime: 30_000, persist: false }
    );
  }

  // ─── PROFILE ─────────────────────────────────────────────────────────────────

  async getProfile(): Promise<any> {
    return queryCache.fetch(
      "student_profile_details",
      async () => {
        const res = await apiFetch<{ success: boolean; data: any }>(
          `${API_URL}/api/student/profile`,
          { headers: this.getHeaders() }
        );
        return res.data;
      },
      { staleTime: 60_000, persist: false }
    );
  }

  // ─── CLASSES ─────────────────────────────────────────────────────────────────

  async getClasses(): Promise<any[]> {
    return queryCache.fetch(
      "student_classes_list",
      async () => {
        const res = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/student/classes`,
          { headers: this.getHeaders() }
        );
        return res.data || [];
      },
      { staleTime: 60_000, persist: false }
    );
  }

  // ─── MARKS ───────────────────────────────────────────────────────────────────

  async getMarks(academicYearId?: string, termId?: string, subjectId?: string): Promise<any> {
    const key = `student_marks_${academicYearId || "all"}_${termId || "all"}_${subjectId || "all"}`;
    return queryCache.fetch(
      key,
      async () => {
        const query = new URLSearchParams();
        if (academicYearId) query.set("academicYearId", academicYearId);
        if (termId) query.set("termId", termId);
        if (subjectId) query.set("subjectId", subjectId);

        const res = await apiFetch<{ success: boolean; data: any }>(
          `${API_URL}/api/student/marks?${query.toString()}`,
          { headers: this.getHeaders() }
        );
        return res.data;
      },
      { staleTime: 30_000, persist: false }
    );
  }

  // ─── ATTENDANCE ──────────────────────────────────────────────────────────────

  async getAttendance(month?: number, year?: number, mode: "daily" | "session" = "daily"): Promise<any> {
    const key = `student_attendance_${month || "curr"}_${year || "curr"}_${mode}`;
    return queryCache.fetch(
      key,
      async () => {
        const query = new URLSearchParams();
        if (month) query.set("month", month.toString());
        if (year) query.set("year", year.toString());
        query.set("mode", mode);

        const res = await apiFetch<{ success: boolean; data: any }>(
          `${API_URL}/api/student/attendance?${query.toString()}`,
          { headers: this.getHeaders() }
        );
        return res.data;
      },
      { staleTime: 30_000, persist: false }
    );
  }

  // ─── TIMETABLE ───────────────────────────────────────────────────────────────

  async getTimetable(): Promise<any> {
    return queryCache.fetch(
      "student_weekly_timetable",
      async () => {
        const res = await apiFetch<{ success: boolean; data: any }>(
          `${API_URL}/api/student/timetable`,
          { headers: this.getHeaders() }
        );
        return res.data;
      },
      { staleTime: 60_000, persist: false }
    );
  }

  // ─── ANNOUNCEMENTS ───────────────────────────────────────────────────────────

  async getAnnouncements(category?: string): Promise<any[]> {
    const key = `student_announcements_${category || "all"}`;
    return queryCache.fetch(
      key,
      async () => {
        const query = new URLSearchParams();
        if (category && category !== "all") query.set("category", category);

        const res = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/student/announcements?${query.toString()}`,
          { headers: this.getHeaders() }
        );
        return res.data || [];
      },
      { staleTime: 30_000, persist: false }
    );
  }

  // ─── DISCIPLINE ──────────────────────────────────────────────────────────────

  async getDiscipline(): Promise<any[]> {
    return queryCache.fetch(
      "student_discipline_records",
      async () => {
        const res = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/student/discipline`,
          { headers: this.getHeaders() }
        );
        return res.data || [];
      },
      { staleTime: 30_000, persist: false }
    );
  }

  // ─── LEARNING MATERIALS ──────────────────────────────────────────────────────

  async getMaterials(subjectId?: string, type?: string): Promise<any[]> {
    const key = `student_learning_materials_${subjectId || "all"}_${type || "all"}`;
    return queryCache.fetch(
      key,
      async () => {
        const query = new URLSearchParams();
        if (subjectId && subjectId !== "all") query.set("subjectId", subjectId);
        if (type && type !== "all") query.set("type", type);

        const res = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/student/materials?${query.toString()}`,
          { headers: this.getHeaders() }
        );
        return res.data || [];
      },
      { staleTime: 30_000, persist: false }
    );
  }
}

export const studentDb = new StudentDatabase();
