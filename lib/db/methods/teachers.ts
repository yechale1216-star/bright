import { API_URL } from "@/lib/api-config"
import type { TeacherAssignment } from "../types"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { queryCache } from "@/lib/utils/query-cache"

export async function getTeachers(headers: any, schoolId?: string, forceRefetch = false): Promise<any[]> {
  const activeSchoolId = schoolId || headers["x-school-id"] || ""
  if (!activeSchoolId) return []
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

export async function getTeacherAssignments(headers: any, schoolId?: string, teacherId?: string, forceRefetch = false): Promise<TeacherAssignment[]> {
  if (!schoolId) return []
  const cacheKey = `assignments_${schoolId}_${teacherId || "all"}`
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
        grade: formatField(a.grade),
        section: formatField(a.section),
        subject: formatField(a.subject),
        stream: formatField(a.stream),
        gradeObj: typeof a.grade === "object" ? a.grade : undefined,
        sectionObj: typeof a.section === "object" ? a.section : undefined,
        streamObj: typeof a.stream === "object" ? a.stream : undefined,
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
