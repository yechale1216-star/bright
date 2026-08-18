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

  async getStudents(forceRefetch = false, status = "ACTIVE", academicYear?: string): Promise<Student[]> {
    return students.getStudents(this.getApiHeaders(), this.getSchoolId(), forceRefetch, status, academicYear)
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

  async saveAttendance(record: Partial<AttendanceRecord>, locationData?: any): Promise<AttendanceRecord> {
    const schoolId = this.getSchoolId()
    if (!schoolId) throw new Error("School ID not found")
    const recDate = record.attendance_date || record.date
    const rawSess = record.session ? record.session.toString().toLowerCase() : null
    const normSess = (rawSess && rawSess !== "none" && rawSess !== "daily") ? rawSess : null

    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/attendance`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          studentId: record.student_id,
          status: record.status,
          session: normSess,
          remarks: record.remarks || record.note || "",
          date: recDate ? new Date(recDate).toISOString() : new Date().toISOString(),
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          locationVerified: locationData?.locationVerified,
          locationDistance: locationData?.locationDistance,
        }),
      }
    )
    queryCache.invalidate(/^attendance_/)
    queryCache.invalidate("attendance_")
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("attendanceDataChanged"))
    }
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
          staff_attendance_mode: settingsData.staffAttendanceMode || "daily",
          staff_sessions: settingsData.staffSessions ?? null,
          staff_working_days: settingsData.staffWorkingDays,
          staff_work_start_time: settingsData.staffWorkStartTime,
          staff_work_end_time: settingsData.staffWorkEndTime,
          staff_late_grace_minutes: settingsData.staffLateGraceMinutes != null ? Number(settingsData.staffLateGraceMinutes) : 15,
          staff_early_checkout_tolerance_minutes: settingsData.staffEarlyCheckoutToleranceMinutes != null ? Number(settingsData.staffEarlyCheckoutToleranceMinutes) : 15,
          staff_earliest_checkin_time: settingsData.staffEarliestCheckinTime,
          staff_latest_checkout_time: settingsData.staffLatestCheckoutTime,
          staff_face_required: settingsData.staffFaceRequired,
          staff_geo_required: settingsData.staffGeoRequired,
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
      staffAttendanceMode: (s?.staff_attendance_mode) || settingsData.staffAttendanceMode || "daily",
      staffSessions: (s?.staff_sessions !== undefined ? s.staff_sessions : settingsData.staffSessions) ?? null,
      staffWorkingDays: (s?.staff_working_days) || settingsData.staffWorkingDays || "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
      staffWorkStartTime: (s?.staff_work_start_time) || settingsData.staffWorkStartTime || "08:00",
      staffWorkEndTime: (s?.staff_work_end_time) || settingsData.staffWorkEndTime || "17:00",
      staffLateGraceMinutes: s ? (s.staff_late_grace_minutes ?? settingsData.staffLateGraceMinutes) : (settingsData.staffLateGraceMinutes ?? 15),
      staffEarlyCheckoutToleranceMinutes: s ? (s.staff_early_checkout_tolerance_minutes ?? settingsData.staffEarlyCheckoutToleranceMinutes) : (settingsData.staffEarlyCheckoutToleranceMinutes ?? 15),
      staffEarliestCheckinTime: (s?.staff_earliest_checkin_time) || settingsData.staffEarliestCheckinTime || "06:00",
      staffLatestCheckoutTime: (s?.staff_latest_checkout_time) || settingsData.staffLatestCheckoutTime || "20:00",
      staffFaceRequired: s ? (s.staff_face_required ?? settingsData.staffFaceRequired) : (settingsData.staffFaceRequired ?? true),
      staffGeoRequired: s ? (s.staff_geo_required ?? settingsData.staffGeoRequired) : (settingsData.staffGeoRequired ?? true),
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

  // ─── HOLIDAYS & WORKING CALENDAR ──────────────────────────────────────────
  async getHolidays(params?: { startDate?: string; endDate?: string; includeInactive?: boolean }): Promise<any[]> {
    return settings.getHolidays(this.getApiHeaders(), params)
  }

  async addHoliday(data: { name: string; description?: string; startDate: string; endDate: string; type?: string; isActive?: boolean }): Promise<any> {
    const result = await settings.addHoliday(this.getApiHeaders(), data)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("holidaysDataChanged"))
    }
    return result
  }

  async updateHoliday(id: string, data: any): Promise<any> {
    const result = await settings.updateHoliday(this.getApiHeaders(), id, data)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("holidaysDataChanged"))
    }
    return result
  }

  async deleteHoliday(id: string): Promise<void> {
    await settings.deleteHoliday(this.getApiHeaders(), id)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("holidaysDataChanged"))
    }
  }

  async isDateWorkingDay(date: string): Promise<{
    isWorkingDay: boolean;
    isHoliday: boolean;
    isWeekend: boolean;
    dayOfWeek: string;
    holidayName?: string;
    holidayType?: string;
    reason?: string;
    workingDaysList: string[];
  }> {
    return settings.isDateWorkingDay(this.getApiHeaders(), date)
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

  // ─── STAFF ATTENDANCE & FACE RECOGNITION ───────────────────────────────────
  async staffCheckIn(payload: {
    date?: string
    session?: string        // 'daily' in daily mode; session id in session_based mode
    faceVerified?: boolean
    faceConfidence?: number | null
    remarks?: string
  }, locationData?: any): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/check-in`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          ...payload,
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          locationVerified: locationData?.locationVerified,
          locationDistance: locationData?.locationDistance,
        }),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }

  async staffCheckOut(payload: {
    date?: string
    session?: string        // 'daily' in daily mode; session id in session_based mode
    faceVerified?: boolean
    faceConfidence?: number | null
    remarks?: string
  }, locationData?: any): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/check-out`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          ...payload,
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          locationVerified: locationData?.locationVerified,
          locationDistance: locationData?.locationDistance,
        }),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }

  async getMyStaffAttendance(filters: { date?: string; startDate?: string; endDate?: string } = {}): Promise<any[]> {
    const params = new URLSearchParams()
    if (filters.date) params.append("date", filters.date)
    if (filters.startDate) params.append("startDate", filters.startDate)
    if (filters.endDate) params.append("endDate", filters.endDate)
    params.append("_t", Date.now().toString())

    const result = await apiFetch<{ success: boolean; data: any[] }>(
      `${API_URL}/api/staff-attendance/my?${params.toString()}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data || []
  }

  async getStaffAttendance(filters: {
    date?: string;
    startDate?: string;
    endDate?: string;
    role?: string;
    status?: string;
    session?: string;      // 'all' | 'daily' | 'morning' | 'afternoon' | custom
    userId?: string;
    search?: string;
    geofenceVerified?: boolean | string;
    faceVerified?: boolean | string;
  } = {}): Promise<any[]> {
    const params = new URLSearchParams()
    if (filters.date) params.append("date", filters.date)
    if (filters.startDate) params.append("startDate", filters.startDate)
    if (filters.endDate) params.append("endDate", filters.endDate)
    if (filters.role) params.append("role", filters.role)
    if (filters.status) params.append("status", filters.status)
    if (filters.session) params.append("session", filters.session)
    if (filters.userId) params.append("userId", filters.userId)
    if (filters.search) params.append("search", filters.search)
    if (filters.geofenceVerified !== undefined) params.append("geofenceVerified", String(filters.geofenceVerified))
    if (filters.faceVerified !== undefined) params.append("faceVerified", String(filters.faceVerified))
    params.append("_t", Date.now().toString())

    const result = await apiFetch<{ success: boolean; data: any[] }>(
      `${API_URL}/api/staff-attendance?${params.toString()}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data || []
  }

  async getStaffAttendanceStats(date?: string, session?: string): Promise<any> {
    const params = new URLSearchParams()
    if (date) params.append("date", date)
    if (session) params.append("session", session)
    params.append("_t", Date.now().toString())

    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/stats?${params.toString()}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data || null
  }

  async getStaffAttendanceReport(filters: {
    startDate: string;
    endDate: string;
    role?: string;
    userId?: string;
  }): Promise<any> {
    const params = new URLSearchParams()
    params.append("startDate", filters.startDate)
    params.append("endDate", filters.endDate)
    if (filters.role) params.append("role", filters.role)
    if (filters.userId) params.append("userId", filters.userId)
    params.append("_t", Date.now().toString())

    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/report?${params.toString()}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data || null
  }

  async correctStaffAttendance(
    id: string,
    data: {
      status?: string;
      checkInTime?: string | null;
      checkOutTime?: string | null;
      remarks?: string;
      reason: string;
    }
  ): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/${id}`,
      {
        method: "PATCH",
        headers: this.getApiHeaders(),
        body: JSON.stringify(data),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }

  async setStaffLeave(
    userId: string,
    date: string,
    status: "LEAVE" | "PERMISSION",
    reason: string
  ): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/leave`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ userId, date, status, reason }),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }

  async enrollStaffFace(userId: string, descriptor: number[]): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/face-enroll`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ userId, descriptor }),
      }
    )
    return result.data
  }

  async getStaffFaceDescriptor(userId?: string): Promise<{ id: string; descriptor: number[] } | null> {
    const url = userId 
      ? `${API_URL}/api/staff-attendance/face-descriptor/${userId}`
      : `${API_URL}/api/staff-attendance/face-descriptor`
    
    const result = await apiFetch<{ success: boolean; data: any }>(
      url,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data || null
  }

  async markAbsentStaff(userIds: string[], date: string, remarks?: string): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/mark-absent`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ userIds, date, remarks }),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }
}

export const db = new Database()
export const database = db

