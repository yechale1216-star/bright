import { apiUrl } from "@/lib/api-config";
import { apiFetch } from "@/lib/utils/fetch-with-timeout";
import { queryCache } from "@/lib/utils/query-cache";

const API_URL = apiUrl;

export interface ParentNotification {
  id: string;
  schoolId: string;
  studentId: string | null;
  type: "absent" | "late" | "excused" | "announcement" | "emergency" | "warning" | "info" | string;
  category?: string;
  priority?: string;
  targetRole?: string;
  targetAudience?: "GENERAL" | "PARENTS" | "STAFF" | string;
  metadata?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  student?: {
    id: string;
    fullName: string;
    gender?: string | null;
  } | null;
}

export interface ParentPreferences {
  id?: string;
  parentPhone?: string;
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushAlerts: boolean;
}

class ParentDatabase {
  private getHeaders(schoolId?: string): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
    // Prefer explicit schoolId param, then fall back to localStorage (set by layout on student switch)
    const resolvedSchoolId = schoolId || (typeof window !== "undefined" ? localStorage.getItem("x-school-id") : null)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    if (resolvedSchoolId) {
      headers["x-school-id"] = resolvedSchoolId
    }
    return headers
  }

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  async getNotifications(phone: string, schoolId?: string): Promise<ParentNotification[]> {
    if (!phone) return [];
    const resolvedSchoolId = schoolId || (typeof window !== "undefined" ? localStorage.getItem("x-school-id") || "single-school" : "single-school")
    return queryCache.fetch(
      `parent_notifications_${phone}_${resolvedSchoolId}`,
      async () => {
        const result = await apiFetch<{ success: boolean; data: ParentNotification[] }>(
          `${API_URL}/api/parent/notifications/${encodeURIComponent(phone)}`,
          {
            headers: this.getHeaders(schoolId),
          }
        );
        return result.data || [];
      },
      { staleTime: 15_000, persist: false }
    );
  }

  async markNotificationAsRead(id: string, schoolId?: string): Promise<boolean> {
    await apiFetch(
      `${API_URL}/api/parent/notifications/${id}/read`,
      {
        method: "PATCH",
        headers: this.getHeaders(schoolId),
      }
    );
    queryCache.invalidate("parent_notifications_");
    return true;
  }

  async deleteNotification(id: string, schoolId?: string): Promise<boolean> {
    await apiFetch(
      `${API_URL}/api/parent/notifications/${id}`,
      {
        method: "DELETE",
        headers: this.getHeaders(schoolId),
      }
    );
    queryCache.invalidate("parent_notifications_");
    return true;
  }

  async markAllNotificationsAsRead(phone: string, schoolId?: string): Promise<boolean> {
    await apiFetch(
      `${API_URL}/api/parent/notifications/read-all/${encodeURIComponent(phone)}`,
      {
        method: "PATCH",
        headers: this.getHeaders(schoolId),
      }
    );
    queryCache.invalidate("parent_notifications_");
    return true;
  }

  // ─── PREFERENCES ──────────────────────────────────────────────────────────
  async getPreferences(phone: string, schoolId?: string): Promise<ParentPreferences | null> {
    const result = await apiFetch<{ success: boolean; data: ParentPreferences }>(
      `${API_URL}/api/parent/preferences/${encodeURIComponent(phone)}`,
      {
        headers: this.getHeaders(schoolId),
      }
    );
    return result.data || null;
  }

  async updatePreferences(phone: string, data: Partial<ParentPreferences>, schoolId?: string): Promise<ParentPreferences | null> {
    const result = await apiFetch<{ success: boolean; data: ParentPreferences }>(
      `${API_URL}/api/parent/preferences/${encodeURIComponent(phone)}`,
      {
        method: "PUT",
        headers: this.getHeaders(schoolId),
        body: JSON.stringify(data),
      }
    );
    return result.data || null;
  }

  // ─── ANNOUNCEMENTS / TEST GENERATOR ───────────────────────────────────────
  async postAnnouncement(schoolId: string, data: { studentId?: string; type?: string; title: string; message: string }): Promise<boolean> {
    await apiFetch(
      `${API_URL}/api/parent/announcements`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return true;
  }
}

export const parentDb = new ParentDatabase();
export const parentDatabase = parentDb;
