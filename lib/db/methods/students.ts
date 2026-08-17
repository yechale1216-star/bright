import { API_URL } from "@/lib/api-config"
import type { Student } from "../types"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { queryCache } from "@/lib/utils/query-cache"

export async function getNextStudentId(headers: any): Promise<string> {
  const result = await apiFetch<{ success: boolean; data: string }>(
    `${API_URL}/api/students/auto/next-id`,
    {
      headers,
    }
  )
  return result.data
}

import { cacheRosterOffline, getCachedRosterOffline } from "@/lib/utils/attendance-offline-store"
import { isOfflineError } from "@/lib/utils/fetch-with-timeout"

export async function getStudents(
  headers: any,
  schoolId: string,
  forceRefetch = false,
  status = "ACTIVE",
  academicYear?: string
): Promise<Student[]> {
  if (!schoolId) return []
  const cacheKey = `students_${schoolId}_${status}_${academicYear || 'active'}`
  return queryCache.fetch(
    cacheKey,
    async () => {
      try {
        const params = new URLSearchParams()
        if (status) params.set("status", status)
        if (academicYear) params.set("academicYear", academicYear)
        if (forceRefetch) params.set("_t", String(Date.now()))
        const queryString = params.toString() ? `?${params.toString()}` : ""
        const url = `${API_URL}/api/students${queryString}`
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          url,
          { headers, cache: "no-store" }
        )
        const mappedStudents = (result.data || []).map((s: any) => ({
          ...s,
          schoolId: schoolId,
        }))
        // Persist to IndexedDB for offline roll-call support
        cacheRosterOffline(schoolId, mappedStudents).catch(() => {})
        return mappedStudents
      } catch (err: any) {
        if (isOfflineError(err) || (typeof navigator !== "undefined" && !navigator.onLine)) {
          const cachedRoster = await getCachedRosterOffline(schoolId)
          if (cachedRoster && cachedRoster.length > 0) {
            console.log(`[Students] Offline mode: loaded ${cachedRoster.length} students from IndexedDB cache`)
            return cachedRoster
          }
        }
        throw err
      }
    },
    { staleTime: 60_000, forceRefetch }
  )
}

function notifyStudentDataChanged() {
  queryCache.invalidate(/^students_/)
  queryCache.invalidate("students_")
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("studentDataChanged"))
  }
}

export async function addStudent(headers: any, schoolId: string, student: Partial<Student>): Promise<Student> {
  if (!schoolId) throw new Error("School ID not found")
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/students`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(student),
    }
  )
  notifyStudentDataChanged()
  return {
    ...result.data,
    schoolId: schoolId,
  }
}

export async function updateStudent(headers: any, id: string, data: Partial<Student>): Promise<void> {
  await apiFetch(
    `${API_URL}/api/students/${id}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    }
  )
  notifyStudentDataChanged()
}

export async function deleteStudent(headers: any, id: string): Promise<void> {
  await apiFetch(
    `${API_URL}/api/students/${id}`,
    {
      method: "DELETE",
      headers,
    }
  )
  notifyStudentDataChanged()
}
