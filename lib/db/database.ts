import { BaseDatabase } from "./base"
import * as students from "./methods/students"
import * as attendance from "./methods/attendance"
import * as analytics from "./methods/analytics"
import * as teachers from "./methods/teachers"
import * as calls from "./methods/calls"
import * as settings from "./methods/settings"
import type { Student, AttendanceRecord, TeacherAssignment } from "./types"
import { API_URL } from "@/lib/api-config"
import { apiFetch } from "@/lib/utils/fetch-with-timeout"
import { queryCache } from "@/lib/utils/query-cache"

export type { Student, AttendanceRecord, TeacherAssignment }

class Database extends BaseDatabase {
  // ─── STUDENTS ─────────────────────────────────────────────────────────────
  async getNextStudentId(): Promise<string> {
    return students.getNextStudentId(this.getApiHeaders())
  }

  async getStudents(forceRefetch = false): Promise<Student[]> {
    return students.getStudents(this.getApiHeaders(), this.getSchoolId(), forceRefetch)
  }

  async addStudent(student: Partial<Student>): Promise<Student> {
    return students.addStudent(this.getApiHeaders(), this.getSchoolId(), student)
  }

  async bulkAddStudents(studentsData: Partial<Student>[]): Promise<any> {
    const schoolId = this.getSchoolId()
    if (!schoolId) throw new Error("School ID not found")
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/students/bulk`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ students: studentsData }),
      }
    )
    queryCache.invalidate(/^students_/)
    queryCache.invalidate("students_")
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("studentDataChanged"))
    }
    return result
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    return students.updateStudent(this.getApiHeaders(), id, data)
  }

  async deleteStudent(id: string): Promise<void> {
    return students.deleteStudent(this.getApiHeaders(), id)
  }

  async checkParentsBatch(phones: string[]): Promise<boolean[]> {
    const result = await apiFetch<{ success: boolean; data: boolean[] }>(
      `${API_URL}/api/parent/check-batch`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ phones }),
      }
    )
    return result.data
  }

  // ─── ATTENDANCE ───────────────────────────────────────────────────────────
  async getAttendance(): Promise<AttendanceRecord[]> {
    return attendance.getAttendance(this.getApiHeaders(), this.getSchoolId())
  }

  async getAttendanceByDate(date: string): Promise<AttendanceRecord[]> {
    const schoolId = this.getSchoolId()
    if (!schoolId) return []
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
    const isToday = date === today
    // Short stale time for today (real-time marking), longer for past dates (historical)
    const staleTime = isToday ? 20_000 : 300_000
    return queryCache.fetch(
      `attendance_date_${schoolId}_${date}`,
      async () => {
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/attendance?date=${date}`,
          { headers: this.getApiHeaders() }
        )
        return result.data.map((r: any) => attendance.mapAttendance(r, schoolId))
      },
      { staleTime, persist: false }
    )
  }

  async getAttendanceByDateAndMode(date: string, session: "morning" | "afternoon" | null): Promise<AttendanceRecord[]> {
    const schoolId = this.getSchoolId()
    if (!schoolId) return []
    const sessionStr = session || "none"
    return queryCache.fetch(
      `attendance_date_session_${schoolId}_${date}_${sessionStr}`,
      async () => {
        const sessionParam = session ? `&session=${session}` : `&session=none`
        const url = `${API_URL}/api/attendance?date=${date}${sessionParam}`
        const result = await apiFetch<{ success: boolean; data: any[] }>(url, { headers: this.getApiHeaders() })
        return result.data.map((r: any) => attendance.mapAttendance(r, schoolId))
      },
      { staleTime: 20_000, persist: false }
    )
  }

  async getAttendanceByDateRange(startDate: string, endDate: string, session?: string | null): Promise<AttendanceRecord[]> {
    const schoolId = this.getSchoolId()
    if (!schoolId) return []
    const sessionStr = session || "all"
    return queryCache.fetch(
      `attendance_range_${schoolId}_${startDate}_${endDate}_${sessionStr}`,
      async () => {
        const sessionParam = session ? `&session=${session}` : ''
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/attendance?startDate=${startDate}&endDate=${endDate}${sessionParam}`,
          { headers: this.getApiHeaders() }
        )
        return result.data.map((r: any) => attendance.mapAttendance(r, schoolId))
      },
      { staleTime: 60_000, persist: false }
    )
  }

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    return this.getAttendance()
  }

  async markAttendance(records: Partial<AttendanceRecord>[], locationData?: any): Promise<void> {
    return attendance.markAttendance(this.getApiHeaders(), this.getSchoolId(), records, locationData)
  }

  async createAttendanceEditRequest(payload: { studentId?: string; gradeId?: string; sectionId?: string; date: string; session?: string | null; reason?: string }): Promise<any> {
    return attendance.createEditRequest(this.getApiHeaders(), payload)
  }

  async getAttendanceEditRequests(filters?: any): Promise<any[]> {
    return attendance.getEditRequests(this.getApiHeaders(), filters)
  }

  async approveAttendanceEditRequest(requestId: string, adminNote?: string): Promise<any> {
    return attendance.approveEditRequest(this.getApiHeaders(), requestId, adminNote)
  }

  async rejectAttendanceEditRequest(requestId: string, adminNote?: string): Promise<any> {
    return attendance.rejectEditRequest(this.getApiHeaders(), requestId, adminNote)
  }

  async getAttendanceAuditLogs(): Promise<any[]> {
    return attendance.getAttendanceAuditLogs(this.getApiHeaders())
  }

  async saveAttendance(record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const schoolId = this.getSchoolId()
    if (!schoolId) throw new Error("School ID not found")
    const recDate = record.attendance_date || record.date
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/attendance`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          studentId: record.student_id,
          status: record.status,
          session: record.session || null,
          remarks: record.remarks || record.note || "",
          date: recDate ? new Date(recDate).toISOString() : new Date().toISOString(),
        }),
      }
    )
    return attendance.mapAttendance(result.data, schoolId)
  }

  async getAttendanceByStudent(studentId: string, schoolId?: string): Promise<AttendanceRecord[]> {
    const activeSchoolId = schoolId || this.getSchoolId()
    if (!activeSchoolId || !studentId) return []
    return queryCache.fetch(
      `attendance_student_${activeSchoolId}_${studentId}`,
      async () => {
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/attendance/student/${studentId}`,
          { headers: this.getApiHeaders() }
        )
        return result.data.map((r: any) => attendance.mapAttendance(r, activeSchoolId))
      },
      { staleTime: 0, persist: false }
    )
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  async getSettings(): Promise<any> {
    const schoolId = this.getSchoolId()
    // Security: Never cache settings under a missing/default schoolId.
    // This prevents stale settings from a previous school leaking to a new context.
    if (!schoolId) {
      // APK cold-start fallback: auth may not have hydrated yet.
      // Try the direct localStorage backup written by updateSettings() before
      // falling back to network (which requires schoolId in the request).
      if (typeof window !== "undefined") {
        try {
          // Scan for any _settings_backup_ key (we don't know schoolId yet)
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith("_settings_backup_")) {
              const raw = localStorage.getItem(k)
              if (raw) return JSON.parse(raw)
            }
          }
        } catch { /* ignore */ }
      }
      return settings.getSettings(this.getApiHeaders(), "")
    }
    return queryCache.fetch(
      `settings_${schoolId}`,
      async () => {
        const data = await settings.getSettings(this.getApiHeaders(), schoolId)
        // Persist to direct backup whenever a fresh network fetch succeeds
        if (typeof window !== "undefined" && data) {
          try { localStorage.setItem(`_settings_backup_${schoolId}`, JSON.stringify(data)) } catch { /* quota */ }
        }
        return data
      },
      { staleTime: 120_000 }
    )
  }

  async updateSettings(settingsData: any): Promise<any> {
    const schoolId = this.getSchoolId()
    if (!schoolId) {
      throw new Error("School context missing. Please log in again.")
    }
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/settings`,
      {
        method: "PUT",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          school_name: settingsData.schoolName,
          school_phone: settingsData.schoolPhone,
          school_address: settingsData.schoolAddress,
          academic_year: settingsData.academicYear,
          attendance_mode: settingsData.attendanceMode,
          attendance_ui_type: settingsData.attendanceUiType,
          attendance_threshold: settingsData.attendanceThreshold,
          allow_late_mark: settingsData.allowLateMark,
          email_notifications: settingsData.emailNotifications,
          sms_notifications: settingsData.smsNotifications,
          notification_time: settingsData.notificationTime,
          school_logo: settingsData.schoolLogo,
          allow_attendance_editing: settingsData.allowAttendanceEditing,
          restrict_location: settingsData.restrictLocation,
          school_latitude: settingsData.schoolLatitude != null && settingsData.schoolLatitude !== "" ? Number(settingsData.schoolLatitude) : null,
          school_longitude: settingsData.schoolLongitude != null && settingsData.schoolLongitude !== "" ? Number(settingsData.schoolLongitude) : null,
          allowed_radius_meters: settingsData.allowedRadiusMeters != null && settingsData.allowedRadiusMeters !== "" ? Number(settingsData.allowedRadiusMeters) : 200,
          allow_outside_attendance: settingsData.allowOutsideAttendance,
        }),
      }
    )

    // Build the canonical mapped settings object (camelCase) from either the
    // server-confirmed response body OR the caller-supplied data (optimistic).
    const s = (result && result.data) ? result.data : null
    const updatedMapped = {
      schoolName: (s?.school_name) || settingsData.schoolName,
      schoolPhone: (s?.school_phone) || settingsData.schoolPhone,
      schoolAddress: (s?.school_address) || settingsData.schoolAddress,
      academicYear: (s?.academic_year) || settingsData.academicYear,
      attendanceMode: (s?.attendance_mode) || settingsData.attendanceMode,
      attendanceUiType: (s?.attendance_ui_type) || settingsData.attendanceUiType,
      attendanceThreshold: s ? (s.attendance_threshold ?? settingsData.attendanceThreshold) : settingsData.attendanceThreshold,
      allowLateMark: s ? (s.allow_late_mark ?? settingsData.allowLateMark) : settingsData.allowLateMark,
      emailNotifications: s ? (s.email_notifications ?? settingsData.emailNotifications) : settingsData.emailNotifications,
      smsNotifications: s ? (s.sms_notifications ?? settingsData.smsNotifications) : settingsData.smsNotifications,
      notificationTime: (s?.notification_time) || settingsData.notificationTime,
      schoolLogo: (s?.school_logo) || settingsData.schoolLogo,
      allowAttendanceEditing: s ? (s.allow_attendance_editing ?? settingsData.allowAttendanceEditing) : settingsData.allowAttendanceEditing,
      restrictLocation: s ? (s.restrict_location ?? settingsData.restrictLocation) : settingsData.restrictLocation,
      schoolLatitude: s ? (s.school_latitude ?? settingsData.schoolLatitude) : settingsData.schoolLatitude,
      schoolLongitude: s ? (s.school_longitude ?? settingsData.school_longitude) : settingsData.schoolLongitude,
      allowedRadiusMeters: s ? (s.allowed_radius_meters ?? settingsData.allowedRadiusMeters) : settingsData.allowedRadiusMeters,
      allowOutsideAttendance: s ? (s.allow_outside_attendance ?? settingsData.allowOutsideAttendance) : settingsData.allowOutsideAttendance,
    }

    // 1. Update SWR memory+localStorage cache (serves subsequent getSettings() calls)
    queryCache.set(`settings_${schoolId}`, updatedMapped, true)

    // 2. Write a DIRECT localStorage backup that is independent of the SWR cache.
    //    This is the APK safety net: even if the SWR cache is cleared on logout or
    //    the WebView is recreated before auth has hydrated, this key survives and
    //    allows getSettings() to return real saved data instead of hardcoded defaults.
    if (typeof window !== "undefined") {
      try { localStorage.setItem(`_settings_backup_${schoolId}`, JSON.stringify(updatedMapped)) } catch { /* quota */ }
    }

    queryCache.invalidate(/^grades_/)
    queryCache.invalidate(/^sections_/)
    queryCache.invalidate(/^streams_/)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("settingsDataChanged"))
    }

    // Return the canonical mapped object so callers can use it directly
    // without an additional getSettings() round-trip.
    return updatedMapped
  }

  async resetSettings(): Promise<void> {
    const schoolId = this.getSchoolId()
    if (!schoolId) return
    await apiFetch(
      `${API_URL}/api/settings`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify(settings.defaultSettings()),
      }
    )
    queryCache.invalidate(/^settings_/)
    queryCache.invalidate(/^grades_/)
    queryCache.invalidate(/^sections_/)
    queryCache.invalidate(/^streams_/)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("settingsDataChanged"))
    }
  }

  // ─── TEACHERS ─────────────────────────────────────────────────────────────
  private notifyTeacherDataChanged() {
    queryCache.invalidate(/^teachers_/)
    queryCache.invalidate(/^assignments_/)
    queryCache.invalidate("teachers_")
    queryCache.invalidate("assignments_")
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("teacherDataChanged"))
    }
  }

  async getTeachers(forceRefetch = false): Promise<any[]> {
    return teachers.getTeachers(this.getApiHeaders(), this.getSchoolId(), forceRefetch)
  }

  async createTeacher(teacherData: any): Promise<any> {
    const schoolId = this.getSchoolId()
    if (!schoolId) throw new Error("School ID not found")
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/users`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          ...teacherData,
          role: "teacher",
          password_hash: teacherData.password || teacherData.password_hash || "demo123456",
          schoolId: schoolId,
          is_active: true,
        }),
      }
    )
    this.notifyTeacherDataChanged()
    return result.data
  }

  async updateTeacher(teacherId: string, teacherData: any): Promise<void> {
    await apiFetch(
      `${API_URL}/api/users/${teacherId}`,
      {
        method: "PUT",
        headers: this.getApiHeaders(),
        body: JSON.stringify(teacherData),
      }
    )
    this.notifyTeacherDataChanged()
  }

  async deleteTeacher(teacherId: string): Promise<void> {
    await apiFetch(
      `${API_URL}/api/users/${teacherId}`,
      {
        method: "DELETE",
        headers: this.getApiHeaders(),
      }
    )
    this.notifyTeacherDataChanged()
  }

  async restoreTeacher(teacherId: string): Promise<void> {
    await this.updateTeacher(teacherId, { is_active: true })
  }

  // ─── TEACHER ASSIGNMENTS ──────────────────────────────────────────────────
  async getTeacherAssignments(schoolId?: string, teacherId?: string, forceRefetch = false): Promise<TeacherAssignment[]> {
    return teachers.getTeacherAssignments(this.getApiHeaders(), schoolId || this.getSchoolId(), teacherId, forceRefetch)
  }

  async assignTeacherToClass(
    teacherId: string, classId: string, subject?: string,
    grade?: string, section?: string, stream?: string,
  ): Promise<TeacherAssignment | null> {
    const schoolId = this.getSchoolId()
    if (!schoolId) throw new Error("School ID not found")
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/assignments`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ 
          teacher_id: teacherId, 
          gradeId: grade, 
          sectionId: section, 
          streamId: stream,
          subject 
        }),
      }
    )
    queryCache.invalidate(/^assignments_/)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('teacherDataChanged'))
    }
    return result.data
  }

  async removeTeacherAssignment(assignmentId: string): Promise<void> {
    const schoolId = this.getSchoolId()
    await apiFetch(
      `${API_URL}/api/assignments/${assignmentId}`,
      {
        method: "DELETE",
        headers: this.getApiHeaders(),
      }
    )
    queryCache.invalidate(/^assignments_/)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('teacherDataChanged'))
    }
  }

  async updateTeacherAssignment(assignmentId: string, data: any): Promise<void> {
    const schoolId = this.getSchoolId()
    await apiFetch(
      `${API_URL}/api/assignments/${assignmentId}`,
      {
        method: "PUT",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ 
          teacher_id: data.teacher_id, 
          gradeId: data.gradeId, 
          sectionId: data.sectionId, 
          streamId: data.streamId || null,
          subject: data.subject || null 
        }),
      }
    )
    queryCache.invalidate(/^assignments_/)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('teacherDataChanged'))
    }
  }

  // ─── ACADEMIC ENTITIES ────────────────────────────────────────────────────
  async getGrades(): Promise<any[]> {
    const schoolId = this.getSchoolId() || "default"
    return queryCache.fetch(
      `grades_${schoolId}`,
      async () => {
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/schools/me/grades`,
          { headers: this.getApiHeaders() }
        )
        return result.data
      },
      { staleTime: 300_000, persist: true }
    )
  }

  async getSections(): Promise<any[]> {
    const schoolId = this.getSchoolId() || "default"
    return queryCache.fetch(
      `sections_${schoolId}`,
      async () => {
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/schools/me/sections`,
          { headers: this.getApiHeaders() }
        )
        return result.data
      },
      { staleTime: 300_000, persist: true }
    )
  }

  async getStreams(): Promise<any[]> {
    const schoolId = this.getSchoolId() || "default"
    return queryCache.fetch(
      `streams_${schoolId}`,
      async () => {
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/schools/me/streams`,
          { headers: this.getApiHeaders() }
        )
        return result.data
      },
      { staleTime: 300_000, persist: true }
    )
  }

  async getUserByEmail(email: string): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/users/by-email?email=${encodeURIComponent(email)}`
    )
    return result.data || null
  }

  async getSchoolById(schoolId: string): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/schools/${schoolId}`
    )
    return result.data || null
  }

  async updateUserProfile(userId: string, profileData: any): Promise<void> {
    await apiFetch(
      `${API_URL}/api/users/${userId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: profileData.name }),
      }
    )
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    await apiFetch(
      `${API_URL}/api/users/${userId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password_hash: newPassword }),
      }
    )
    return true
  }

  async initializeSchoolData(schoolId: string | number): Promise<void> {
    this.setSchoolId(schoolId)
    console.log("[pg] School session initialized for:", String(schoolId))
  }

  async addSchool(schoolData: any): Promise<string | null> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/schools`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolData),
      }
    )
    return result.data?.id || null
  }

  // ─── ANALYTICS ────────────────────────────────────────────────────────────
  async getAttendanceSummaryStats(filters: any = {}): Promise<any> {
    const settingsData = await this.getSettings()
    return analytics.getAttendanceSummaryStats(this.getApiHeaders(), { ...filters, mode: settingsData.attendanceMode })
  }

  async getAttendanceGradeStats(filters: any = {}): Promise<any[]> {
    const settingsData = await this.getSettings()
    return analytics.getAttendanceGradeStats(this.getApiHeaders(), { ...filters, mode: settingsData.attendanceMode })
  }

  async getAttendanceTrendStats(filters: any = {}): Promise<any[]> {
    const settingsData = await this.getSettings()
    const query = new URLSearchParams({ 
      ...filters, 
      mode: settingsData.attendanceMode,
      _t: Date.now().toString() 
    }).toString()
    const result = await apiFetch<{ success: boolean; data: any[] }>(
      `${API_URL}/api/attendance-analytics/trends?${query}`,
      { 
        headers: this.getApiHeaders(),
        cache: 'no-store'
      }
    )
    return result.data
  }

  async getAttendanceDrillDownStats(gradeId: string, filters: any = {}): Promise<any[]> {
    const settingsData = await this.getSettings()
    const query = new URLSearchParams({ 
      ...filters, 
      mode: settingsData.attendanceMode,
      _t: Date.now().toString() 
    }).toString()
    const result = await apiFetch<{ success: boolean; data: any[] }>(
      `${API_URL}/api/attendance-analytics/drill-down/${gradeId}?${query}`,
      { 
        headers: this.getApiHeaders(),
        cache: 'no-store'
      }
    )
    return result.data
  }

  async exportAttendanceReport(filters: any = {}): Promise<Blob | null> {
    const settingsData = await this.getSettings()
    const query = new URLSearchParams({ 
      ...filters, 
      mode: settingsData.attendanceMode,
      format: 'csv', 
      _t: Date.now().toString() 
    }).toString()
    const response = await this.fetch(
      `${API_URL}/api/attendance-analytics/export?${query}`,
      { 
        headers: this.getApiHeaders(),
        cache: 'no-store'
      }
    )
    if (!response.ok) return null
    return await response.blob()
  }

  // ─── CALLS & CONTACTS ─────────────────────────────────────────────────────
  async getContacts(): Promise<any[]> {
    return calls.getContacts(this.getApiHeaders())
  }

  async logCall(data: { recipientId: string, type: 'VOICE' | 'VIDEO', status: string, duration?: number }): Promise<any> {
    return calls.logCall(this.getApiHeaders(), data)
  }

  async getCallHistoryApi(): Promise<any[]> {
    return calls.getCallHistoryApi(this.getApiHeaders())
  }
}

export const db = new Database()
export const database = db

