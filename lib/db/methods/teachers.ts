import { API_URL } from "@/lib/api-config"
import type { TeacherAssignment } from "../types"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { queryCache } from "@/lib/utils/query-cache"

export async function getTeachers(headers: any, schoolId = "single-school", forceRefetch = false): Promise<any[]> {
  const activeSchoolId = schoolId || headers?.["x-school-id"] || "single-school"
  return queryCache.fetch(
    `teachers_${activeSchoolId}`,
    async () => {
      const url = forceRefetch
        ? `${API_URL}/api/users?role=teacher&_t=${Date.now()}`
        : `${API_URL}/api/users?role=teacher`
      const result = await apiFetch<{ success: boolean; data: any[] }>(
        url,
        { headers, cache: "no-store" }
      )
      return (result.data || []).filter((u: any) => u.role === "teacher")
    },
    { staleTime: 60_000, persist: true, forceRefetch }
  )
}

export async function getTeacherAssignments(headers: any, schoolId = "single-school", teacherId?: string, forceRefetch = false): Promise<TeacherAssignment[]> {
  const activeSchoolId = schoolId || headers?.["x-school-id"] || "single-school"
  const cacheKey = `assignments_${activeSchoolId}_${teacherId || "all"}`
  return queryCache.fetch(
    cacheKey,
    async () => {
      const params = new URLSearchParams()
      if (teacherId) params.append("teacherId", teacherId)
      if (forceRefetch) params.append("_t", Date.now().toString())
      const queryString = params.toString()
      const url = `${API_URL}/api/assignments${queryString ? `?${queryString}` : ""}`
      const result = await apiFetch<{ success: boolean; data: any[] }>(
        url,
        { headers, cache: "no-store" }
      )
      const formatField = (val: any) => {
        if (!val) return ""
        if (typeof val === "string") return val
        if (typeof val === "object" && val !== null && val.name) return String(val.name)
        return ""
      }
      return (result.data || []).map((a: any) => ({
        id: a.id,
        teacher_id: a.teacher_id,
        schoolId: a.schoolId,
        gradeId: a.gradeId || (typeof a.grade === "object" ? a.grade?.id : undefined) || "",
        sectionId: a.sectionId || (typeof a.section === "object" ? a.section?.id : undefined) || "",
        streamId: a.streamId || (typeof a.stream === "object" ? a.stream?.id : undefined) || "",
        subjectId: a.subjectId || (typeof a.subjectRef === "object" ? a.subjectRef?.id : undefined) || "",
        grade: formatField(a.grade),
        section: formatField(a.section),
        subject: formatField(a.subject) || (typeof a.subjectRef === "object" ? a.subjectRef?.name : "") || "",
        stream: formatField(a.stream),
        gradeObj: typeof a.grade === "object" ? a.grade : undefined,
        sectionObj: typeof a.section === "object" ? a.section : undefined,
        streamObj: typeof a.stream === "object" ? a.stream : undefined,
        role: a.role,
        class_id: a.id,
        teacher: a.teacher ? {
          id: a.teacher.id,
          full_name: a.teacher.full_name || a.teacher.name,
          email: a.teacher.email,
          profile_photo: a.teacher.profile_photo,
        } : undefined,
      }))
    },
    { staleTime: 60_000, persist: true, forceRefetch }
  )
}


export async function terminateTeacher(
  headers: any,
  teacherId: string,
  payload: { reason: string; effectiveDate?: string }
): Promise<{ success: boolean; message?: string }> {
  const result = await apiFetch<{ success: boolean; message?: string }>(
    `${API_URL}/api/teachers/${teacherId}/terminate`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  queryCache.invalidate(/^assignments_/);
  return result;
}

export async function reinstateTeacher(
  headers: any,
  teacherId: string,
  payload: { reason?: string } = {}
): Promise<{ success: boolean; message?: string }> {
  const result = await apiFetch<{ success: boolean; message?: string }>(
    `${API_URL}/api/teachers/${teacherId}/reinstate`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  queryCache.invalidate(/^assignments_/);
  return result;
}

export async function getTeacherStatus(
  headers: any,
  teacherId: string
): Promise<{ success: boolean; data: any }> {
  return await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/teachers/${teacherId}/status`,
    { headers, cache: "no-store" }
  );
}
export async function suspendTeacher(
  headers: any,
  teacherId: string,
  payload: { reason: string }
): Promise<{ success: boolean; message?: string; data?: any }> {
  const result = await apiFetch<{ success: boolean; message?: string; data?: any }>(
    `${API_URL}/api/teachers/${teacherId}/suspend`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  return result;
}

export async function reactivateTeacher(
  headers: any,
  teacherId: string,
  payload: { reason?: string } = {}
): Promise<{ success: boolean; message?: string; data?: any }> {
  const result = await apiFetch<{ success: boolean; message?: string; data?: any }>(
    `${API_URL}/api/teachers/${teacherId}/reactivate`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  return result;
}

export async function approveTeacher(
  headers: any,
  teacherId: string,
  payload: { reason?: string } = {}
): Promise<{ success: boolean; message?: string; data?: any }> {
  const result = await apiFetch<{ success: boolean; message?: string; data?: any }>(
    `${API_URL}/api/teachers/${teacherId}/approve`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  return result;
}

export async function deactivateTeacher(
  headers: any,
  teacherId: string,
  payload: { reason: string }
): Promise<{ success: boolean; message?: string; data?: any }> {
  const result = await apiFetch<{ success: boolean; message?: string; data?: any }>(
    `${API_URL}/api/teachers/${teacherId}/deactivate`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  return result;
}

export async function setTeacherPending(
  headers: any,
  teacherId: string,
  payload: { reason?: string } = {}
): Promise<{ success: boolean; message?: string; data?: any }> {
  const result = await apiFetch<{ success: boolean; message?: string; data?: any }>(
    `${API_URL}/api/teachers/${teacherId}/set-pending`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  queryCache.invalidate(/^teachers_/);
  return result;
}

export async function getTeacherAuditHistory(
  headers: any,
  teacherId: string
): Promise<{ success: boolean; data: any[] }> {
  return await apiFetch<{ success: boolean; data: any[] }>(
    `${API_URL}/api/teachers/${teacherId}/audit-history`,
    { headers, cache: "no-store" }
  );
}
