"use client"

import { API_URL } from "@/lib/api-config"
import type { AttendanceRecord } from "../types"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { queryCache } from "@/lib/utils/query-cache"

export function mapAttendance(r: any, schoolId: string): AttendanceRecord {
  return {
    ...r,
    attendance_date: (r.date || r.attendance_date || "").split("T")[0],
    student_id: r.studentId || r.student_id,
    schoolId: schoolId,
    created_at: r.createdAt || r.created_at || new Date().toISOString(),
  }
}

function notifyAttendanceDataChanged() {
  queryCache.invalidate(/^attendance_/)
  queryCache.invalidate("attendance_")
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("attendanceDataChanged"))
  }
}

export async function getAttendance(headers: any, schoolId: string): Promise<AttendanceRecord[]> {
  if (!schoolId) return []
  return queryCache.fetch(
    `attendance_all_${schoolId}`,
    async () => {
      const result = await apiFetch<{ success: boolean; data: any[] }>(
        `${API_URL}/api/attendance`,
        { headers }
      )
      return result.data.map((r: any) => mapAttendance(r, schoolId))
    },
    // Do NOT persist attendance data to localStorage (too large & sensitive)
    { staleTime: 0, persist: false }
  )
}

import { isOfflineError } from "@/lib/utils/fetch-with-timeout"
import { queueOfflineAttendance } from "@/lib/utils/attendance-offline-store"

export async function markAttendance(
  headers: any,
  schoolId: string,
  records: Partial<AttendanceRecord>[],
  locationData?: { latitude?: number | null; longitude?: number | null; locationVerified?: boolean; locationDistance?: number | null }
): Promise<void> {
  if (!schoolId) throw new Error("School ID not found")
  
  const formattedRecords = records.map(record => {
    const recDate = record.attendance_date || record.date
    const rawSess = record.session ? record.session.toString().toLowerCase() : null
    const normSess = (rawSess && rawSess !== "none" && rawSess !== "daily") ? rawSess : null
    return {
      studentId: record.student_id,
      status: record.status,
      session: normSess,
      remarks: record.remarks || record.note || "",
      date: recDate ? new Date(recDate).toISOString() : new Date().toISOString(),
      latitude: record.latitude ?? locationData?.latitude ?? null,
      longitude: record.longitude ?? locationData?.longitude ?? null,
      locationVerified: record.locationVerified ?? locationData?.locationVerified ?? false,
      locationDistance: record.locationDistance ?? locationData?.locationDistance ?? null,
    }
  })

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
        schoolId,
        formattedRecords as any,
        locationData,
        records[0]?.attendance_date || records[0]?.date,
        records[0]?.session
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
  schoolId: string,
  record: { studentId: string; status: string; date: string; session?: string | null; remarks?: string; note?: string },
  locationData?: { latitude?: number | null; longitude?: number | null; locationVerified?: boolean; locationDistance?: number | null }
): Promise<any> {
  if (!schoolId) throw new Error("School ID not found")
  const recDate = record.date || new Date().toISOString()
  const rawSess = record.session ? record.session.toString().toLowerCase() : null
  const normSess = (rawSess && rawSess !== "none" && rawSess !== "daily") ? rawSess : null

  const payload = {
    studentId: record.studentId,
    status: record.status,
    session: normSess,
    remarks: record.remarks || record.note || "",
    date: recDate ? new Date(recDate).toISOString() : new Date().toISOString(),
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
        schoolId,
        [payload],
        locationData,
        record.date,
        normSess
      )
      notifyAttendanceDataChanged()
      return { offlineQueued: true, studentId: record.studentId, status: record.status }
    }
    throw err
  }
}

export async function createEditRequest(headers: any, payload: { studentId?: string; gradeId?: string; sectionId?: string; date: string; session?: string | null; reason?: string }): Promise<any> {
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/attendance/edit-requests`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  )
  notifyAttendanceDataChanged()
  return result.data
}

export async function getEditRequests(headers: any, filters: any = {}): Promise<any[]> {
  const query = new URLSearchParams(filters).toString()
  const result = await apiFetch<{ success: boolean; data: any[] }>(
    `${API_URL}/api/attendance/edit-requests${query ? `?${query}` : ''}`,
    { headers, cache: 'no-store' }
  )
  return result.data
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
