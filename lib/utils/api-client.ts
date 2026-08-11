import { parseJsonResponse } from "@/lib/utils/parse-json-response"

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: any
  headers?: Record<string, string>
}

async function apiCall(endpoint: string, options: RequestOptions = {}) {
  const { method = "GET", body, headers = {} } = options

  const url = `/api${endpoint}`
  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  try {
    console.log(`Making ${method} request to ${endpoint}`)
    const response = await fetch(url, config)

    if (!response.ok) {
      const contentType = response.headers.get("content-type")
      let errorData: any = {}

      if (contentType?.includes("application/json")) {
        try {
          errorData = await parseJsonResponse(response)
        } catch (e) {
          errorData = { text: String(e) }
        }
      } else {
        errorData = { text: await response.text() }
      }

      console.error(`API Error on ${method} ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      })
      throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`)
    }

    const responseData = await parseJsonResponse(response)
    console.log(`${method} ${endpoint} successful`)
    return responseData
  } catch (error: any) {
    console.error(`Fetch failed for ${method} ${endpoint}:`, error.message)
    throw error
  }
}

export const apiClient = {
  // Auth endpoints
  login: (email: string, password: string) => apiCall("/auth/login", { method: "POST", body: { email, password } }),
  register: (data: any) => apiCall("/auth/register", { method: "POST", body: data }),

  // Schools endpoints
  getSchool: (schoolId: string | number) => apiCall(`/schools?schoolId=${schoolId}`),
  updateSchool: (data: any) => apiCall("/schools", { method: "PUT", body: data }),
  createSchool: (data: any) => apiCall("/schools", { method: "POST", body: data }),

  // Students endpoints
  getStudents: (schoolId: string, classId?: string) => {
    const params = new URLSearchParams({ schoolId })
    if (classId) params.append("classId", classId)
    return apiCall(`/students?${params.toString()}`)
  },
  createStudent: (data: any) => apiCall("/students", { method: "POST", body: data }),
  updateStudent: (data: any) => apiCall("/students", { method: "PUT", body: data }),
  deleteStudent: (studentId: string) => apiCall(`/students?studentId=${studentId}`, { method: "DELETE" }),

  // Classes endpoints
  getClasses: (schoolId: string) => apiCall(`/classes?schoolId=${schoolId}`),
  createClass: (data: any) => apiCall("/classes", { method: "POST", body: data }),

  // Attendance endpoints
  getAttendance: (schoolId: string, studentId?: string, date?: string) => {
    const params = new URLSearchParams({ schoolId })
    if (studentId) params.append("studentId", studentId)
    if (date) params.append("date", date)
    return apiCall(`/attendance?${params.toString()}`)
  },
  recordAttendance: (data: any) => apiCall("/attendance", { method: "POST", body: data }),
  updateAttendance: (data: any) => apiCall("/attendance", { method: "PUT", body: data }),

  // Attendance reports endpoints
  getReports: (schoolId: string, classId?: string, studentId?: string) => {
    const params = new URLSearchParams({ schoolId })
    if (classId) params.append("classId", classId)
    if (studentId) params.append("studentId", studentId)
    return apiCall(`/attendance-reports?${params.toString()}`)
  },
  createReport: (data: any) => apiCall("/attendance-reports", { method: "POST", body: data }),
}

