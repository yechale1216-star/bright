"use client"

import { API_URL } from "@/lib/api-config"
import type { AttendanceRecord } from "../types"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { queryCache } from "@/lib/utils/query-cache"

export function mapAttendance(r: any, schoolId = "single-school"): AttendanceRecord {
  return {
    ...r,
    attendance_date: (r.date || r.attendance_date || "").split("T")[0],
    student_id: r.studentId || r.student_id,
    schoolId: schoolId || "single-school",
    created_at: r.createdAt || r.created_at || new Date().toISOString(),
  }
}

function notifyAttendanceDataChanged() {
  queryCache.invalidate(/^attendance_/)
  queryCache.invalidate(/^dashboard_summary_/)
  queryCache.invalidate("attendance_")
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("attendanceDataChanged"))
  }
}

export async function getAttendance(headers: any, schoolId = "single-school"): Promise<AttendanceRecord[]> {
  const effectiveSchoolId = schoolId || "single-school"
  return queryCache.fetch(
    `attendance_all_${effectiveSchoolId}`,
    async () => {
      const result = await apiFetch<{ success: boolean; data: any[] }>(
        `${API_URL}/api/attendance`,
        { headers }
      )
      return result.data.map((r: any) => mapAttendance(r, effectiveSchoolId))
    },
    // Do NOT persist attendance data to localStorage (too large & sensitive)
    { staleTime: 0, persist: false }
  )
}

import { isOfflineError } from "@/lib/utils/fetch-with-timeout"
import { queueOfflineAttendance } from "@/lib/utils/attendance-offline-store"

export async function markAttendance(
  headers: any,
  schoolId = "single-school",
  records: Partial<AttendanceRecord>[],
  locationData?: { latitude?: number | null; longitude?: number | null; locationVerified?: boolean; locationDistance?: number | null }
): Promise<void> {
  const effectiveSchoolId = schoolId || "single-school"
  
  const formattedRecords = records.map(record => {
    const rawDate = record.attendance_date || record.date
    const dateStr = rawDate ? (typeof rawDate === 'string' ? rawDate.split("T")[0] : new Date(rawDate).toISOString().split("T")[0]) : new Date().toISOString().split("T")[0]
    const rawSess = record.session ? record.session.toString().toLowerCase().trim() : null
    const normSess = (rawSess && rawSess !== "none" && rawSess !== "daily" && rawSess !== "total") ? rawSess : null
    return {
      studentId: record.student_id,
      status: record.status,
      session: normSess,
      remarks: record.remarks || record.note || "",
      date: `${dateStr}T00:00:00.000Z`,
      latitude: record.latitude ?? locationData?.latitude ?? null,
      longitude: record.longitude ?? locationData?.longitude ?? null,
      locationVerified: record.locationVerified ?? locationData?.locationVerified ?? false,
      locationDistance: record.locationDistance ?? locationData?.locationDistance ?? null,
    }
  })

  const primaryDate = formattedRecords[0]?.date ? formattedRecords[0].date.split("T")[0] : new Date().toISOString().split("T")[0]
  const primarySession = formattedRecords[0]?.session || null

  try {
    await apiFetch(
      `${API_URL}/api/attendance/bulk`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          records: formattedRecords,
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          locationVerified: locationData?.locationVerified,
          locationDistance: locationData?.locationDistance,
        }),
      }
    )
  } catch (err: any) {
    if (isOfflineError(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
      console.warn("[Attendance] Network offline. Safely buffering attendance into IndexedDB outbox...")
      await queueOfflineAttendance(
        effectiveSchoolId,
        formattedRecords as any,
        locationData,
        primaryDate,
        primarySession
      )
      notifyAttendanceDataChanged()
      return
    }
    throw err
  }

  notifyAttendanceDataChanged()
}

export async function markSingleAttendance(
  headers: any,
  schoolId = "single-school",
  record: { studentId: string; status: string; date: string; session?: string | null; remarks?: string; note?: string },
  locationData?: { latitude?: number | null; longitude?: number | null; locationVerified?: boolean; locationDistance?: number | null }
): Promise<any> {
  const effectiveSchoolId = schoolId || "single-school"
  const rawDate = record.date || new Date().toISOString()
  const dateStr = typeof rawDate === 'string' ? rawDate.split("T")[0] : new Date(rawDate).toISOString().split("T")[0]
  const rawSess = record.session ? record.session.toString().toLowerCase().trim() : null
  const normSess = (rawSess && rawSess !== "none" && rawSess !== "daily" && rawSess !== "total") ? rawSess : null

  const payload = {
    studentId: record.studentId,
    status: record.status,
    session: normSess,
    remarks: record.remarks || record.note || "",
    date: `${dateStr}T00:00:00.000Z`,
    latitude: locationData?.latitude ?? null,
    longitude: locationData?.longitude ?? null,
    locationVerified: locationData?.locationVerified ?? false,
    locationDistance: locationData?.locationDistance ?? null,
  }

  try {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/attendance`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    )

    notifyAttendanceDataChanged()
    return result.data
  } catch (err: any) {
    if (isOfflineError(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
      console.warn("[Attendance] Network offline. Safely buffering single attendance into IndexedDB outbox...")
      await queueOfflineAttendance(
        effectiveSchoolId,
        [payload],
        locationData,
        dateStr,
        normSess
      )
      notifyAttendanceDataChanged()
      return { offlineQueued: true, studentId: record.studentId, status: record.status }
    }
    throw err
  }
}

export async function createEditRequest(
  headers: any,
  payload: {
    studentId?: string;
    gradeId?: string;
    sectionId?: string;
    grade?: string;
    section?: string;
    stream?: string | null;
    date: string;
    session?: string | null;
    reason?: string;
  }
): Promise<any> {
  const { grade, section, stream } = payload;
  const resolvedGrade = grade || payload.gradeId;
  const resolvedSection = section || payload.sectionId;

  let finalReason = (payload.reason || "").trim();
  if (resolvedGrade || resolvedSection || stream) {
    const metaTag = `[META:grade=${resolvedGrade || ""}|section=${resolvedSection || ""}|stream=${stream || ""}]`;
    if (!finalReason.startsWith("[META:")) {
      finalReason = `${metaTag} ${finalReason}`.trim();
    }
  }

  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/attendance/edit-requests`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        gradeId: resolvedGrade,
        sectionId: resolvedSection,
        grade: resolvedGrade,
        section: resolvedSection,
        stream: stream || null,
        reason: finalReason,
      }),
    }
  );
  queryCache.invalidate(/^attendance_edit_requests/)
  queryCache.invalidate("attendance_edit_requests_")
  notifyAttendanceDataChanged();
  return result.data;
}

export async function getEditRequests(headers: any, filters: any = {}): Promise<any[]> {
  const query = new URLSearchParams(filters).toString();
  const cacheKey = `attendance_edit_requests_${query || "all"}`;
  return queryCache.fetch(
    cacheKey,
    async () => {
      const result = await apiFetch<{ success: boolean; data: any[] }>(
        `${API_URL}/api/attendance/edit-requests${query ? `?${query}` : ""}`,
        { headers, cache: "no-store" }
      );
      const list = result.data || [];
      return list.map((req: any) => {
        let grade = req.grade || req.gradeId || null;
        let section = req.section || req.sectionId || null;
        let stream = req.stream || null;
        let reason = req.reason || null;

        if (reason && reason.startsWith("[META:")) {
          const metaEnd = reason.indexOf("]");
          if (metaEnd !== -1) {
            const metaStr = reason.substring(6, metaEnd);
            reason = reason.substring(metaEnd + 1).trim() || null;
            const parts = metaStr.split("|");
            parts.forEach((p: string) => {
              const [k, v] = p.split("=");
              if (k === "grade" && v) grade = v;
              if (k === "section" && v) section = v;
              if (k === "stream" && v) stream = v;
            });
          }
        }

        return {
          ...req,
          grade,
          section,
          stream,
          reason,
        };
      });
    },
    { staleTime: 15_000, persist: false }
  );
}

export async function approveEditRequest(headers: any, requestId: string, adminNote?: string): Promise<any> {
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/attendance/edit-requests/${requestId}/approve`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ adminNote }),
    }
  )
  queryCache.invalidate(/^attendance_edit_requests/)
  queryCache.invalidate("attendance_edit_requests_")
  notifyAttendanceDataChanged()
  return result.data
}

export async function rejectEditRequest(headers: any, requestId: string, adminNote?: string): Promise<any> {
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/attendance/edit-requests/${requestId}/reject`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ adminNote }),
    }
  )
  queryCache.invalidate(/^attendance_edit_requests/)
  queryCache.invalidate("attendance_edit_requests_")
  notifyAttendanceDataChanged()
  return result.data
}

export async function getAttendanceAuditLogs(headers: any): Promise<any[]> {
  const result = await apiFetch<{ success: boolean; data: any[] }>(
    `${API_URL}/api/attendance/audit-logs`,
    { headers, cache: 'no-store' }
  )
  return result.data
}
