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

export async function getStudents(headers: any, schoolId: string, forceRefetch = false): Promise<Student[]> {
  if (!schoolId) return []
  return queryCache.fetch(
    `students_${schoolId}`,
    async () => {
      const url = forceRefetch
        ? `${API_URL}/api/students?_t=${Date.now()}`
        : `${API_URL}/api/students`
      const result = await apiFetch<{ success: boolean; data: any[] }>(
        url,
        { headers, cache: "no-store" }
      )
      return (result.data || []).map((s: any) => ({
        ...s,
        schoolId: schoolId,
      }))
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
