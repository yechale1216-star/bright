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
    const schoolId = this.getSchoolId() || "single-school"
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
    const schoolId = this.getSchoolId() || "single-school"
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
    const schoolId = this.getSchoolId() || "single-school"
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
    const schoolId = this.getSchoolId() || "single-school"
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

  async getDashboardSummary(date?: string, session?: string): Promise<any> {
    const params = new URLSearchParams()
    if (date) params.set("date", date)
    if (session) params.set("session", session)
    const qs = params.toString() ? `?${params.toString()}` : ""
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/attendance/dashboard-summary${qs}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data
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
    const schoolId = this.getSchoolId() || "single-school"
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
    const activeSchoolId = schoolId || this.getSchoolId() || "single-school"
    if (!studentId) return []
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
  async getSettings(forceRefetch = false): Promise<any> {
    const schoolId = this.getSchoolId() || "single-school"
    return queryCache.fetch(
      `settings_${schoolId}`,
      async () => {
        const data = await settings.getSettings(this.getApiHeaders(), schoolId)
        if (typeof window !== "undefined" && data) {
          try { localStorage.setItem(`_settings_backup_${schoolId}`, JSON.stringify(data)) } catch { /* quota */ }
        }
        return data
      },
      { staleTime: 30_000, forceRefetch }
    )
  }

  async updateSettings(settingsData: any): Promise<any> {
    const schoolId = this.getSchoolId() || "single-school"

    const calendarPrefRaw = settingsData.calendarPreference || settingsData.calendarType || settingsData.calendar_type
    let normalizedCalendarType: string | undefined
    if (calendarPrefRaw !== undefined && calendarPrefRaw !== null) {
      normalizedCalendarType = String(calendarPrefRaw).toUpperCase().includes("GREGORIAN") ? "GREGORIAN" : "ETHIOPIAN"
    }

    const payload: any = {
      school_name: settingsData.schoolName ?? settingsData.school_name,
      school_phone: settingsData.schoolPhone ?? settingsData.school_phone,
      school_address: settingsData.schoolAddress ?? settingsData.school_address,
      academic_year: settingsData.academicYear ?? settingsData.academic_year,
      calendar_type: normalizedCalendarType,
      attendance_mode: settingsData.attendanceMode ?? settingsData.attendance_mode,
      attendance_ui_type: settingsData.attendanceUiType ?? settingsData.attendance_ui_type,
      attendance_threshold: settingsData.attendanceThreshold != null && settingsData.attendanceThreshold !== "" ? Number(settingsData.attendanceThreshold) : undefined,
      allow_late_mark: settingsData.allowLateMark ?? settingsData.allow_late_mark,
      email_notifications: settingsData.emailNotifications ?? settingsData.email_notifications,
      sms_notifications: settingsData.smsNotifications ?? settingsData.sms_notifications,
      notification_time: settingsData.notificationTime ?? settingsData.notification_time,
      school_logo: settingsData.schoolLogo ?? settingsData.school_logo,
      allow_attendance_editing: settingsData.allowAttendanceEditing ?? settingsData.allow_attendance_editing,
      restrict_location: settingsData.restrictLocation ?? settingsData.restrict_location,
      school_latitude: settingsData.schoolLatitude != null && settingsData.schoolLatitude !== "" ? Number(settingsData.schoolLatitude) : (settingsData.schoolLatitude === "" ? null : undefined),
      school_longitude: settingsData.schoolLongitude != null && settingsData.schoolLongitude !== "" ? Number(settingsData.schoolLongitude) : (settingsData.schoolLongitude === "" ? null : undefined),
      allowed_radius_meters: settingsData.allowedRadiusMeters != null && settingsData.allowedRadiusMeters !== "" ? Number(settingsData.allowedRadiusMeters) : undefined,
      allow_outside_attendance: settingsData.allowOutsideAttendance ?? settingsData.allow_outside_attendance,
      grade_system: settingsData.gradeSystem ?? settingsData.grade_system,
      email_api_key: settingsData.emailApiKey ?? settingsData.email_api_key,
      email_from_domain: settingsData.emailFromDomain ?? settingsData.email_from_domain,
      staff_attendance_mode: settingsData.staffAttendanceMode ?? settingsData.staff_attendance_mode,
      staff_sessions: settingsData.staffSessions !== undefined ? settingsData.staffSessions : settingsData.staff_sessions,
      staff_working_days: settingsData.staffWorkingDays ?? settingsData.staff_working_days,
      staff_work_start_time: settingsData.staffWorkStartTime ?? settingsData.staff_work_start_time,
      staff_work_end_time: settingsData.staffWorkEndTime ?? settingsData.staff_work_end_time,
      staff_late_grace_minutes: settingsData.staffLateGraceMinutes != null && settingsData.staffLateGraceMinutes !== "" ? Number(settingsData.staffLateGraceMinutes) : undefined,
      staff_early_checkout_tolerance_minutes: settingsData.staffEarlyCheckoutToleranceMinutes != null && settingsData.staffEarlyCheckoutToleranceMinutes !== "" ? Number(settingsData.staffEarlyCheckoutToleranceMinutes) : undefined,
      staff_absence_cutoff_minutes: settingsData.staffAbsenceCutoffMinutes != null && settingsData.staffAbsenceCutoffMinutes !== "" ? Number(settingsData.staffAbsenceCutoffMinutes) : undefined,
      staff_absence_cutoff_time: settingsData.staffAbsenceCutoffTime ?? settingsData.staff_absence_cutoff_time,
      staff_earliest_checkin_time: settingsData.staffEarliestCheckinTime ?? settingsData.staff_earliest_checkin_time,
      staff_latest_checkout_time: settingsData.staffLatestCheckoutTime ?? settingsData.staff_latest_checkout_time,
      staff_face_required: settingsData.staffFaceRequired ?? settingsData.staff_face_required,
      staff_geo_required: settingsData.staffGeoRequired ?? settingsData.staff_geo_required,
      allow_staff_checkin_after_cutoff: settingsData.allowStaffCheckinAfterCutoff ?? settingsData.allow_staff_checkin_after_cutoff,
    }

    // Clean undefined fields
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) delete payload[key]
    })

    const result = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/settings`,
      {
        method: "PUT",
        headers: this.getApiHeaders(),
        body: JSON.stringify(payload),
      }
    )

    const s = result.data || {}
    const calendarTypeUpper = (s.calendar_type || normalizedCalendarType || "ETHIOPIAN").toUpperCase()
    const calendarPreference = calendarTypeUpper.includes("GREGORIAN") ? "gregorian" : "ethiopian"

    const updatedMapped = {
      schoolName: s.school_name || settingsData.schoolName || "Addis Hiwot School",
      schoolPhone: s.school_phone || settingsData.schoolPhone || "",
      schoolAddress: s.school_address || settingsData.schoolAddress || "",
      academicYear: s.academic_year || settingsData.academicYear || "2017/2018 E.C.",
      calendarType: calendarTypeUpper,
      calendar_type: calendarTypeUpper,
      calendarPreference,
      attendanceMode: s.attendance_mode || settingsData.attendanceMode || "session_based",
      attendanceUiType: s.attendance_ui_type || settingsData.attendanceUiType || "card_based",
      attendanceThreshold: s.attendance_threshold ?? settingsData.attendanceThreshold ?? 75,
      allowLateMark: s.allow_late_mark ?? settingsData.allowLateMark ?? true,
      emailNotifications: s.email_notifications ?? settingsData.emailNotifications ?? true,
      smsNotifications: s.sms_notifications ?? settingsData.smsNotifications ?? false,
      notificationTime: s.notification_time || settingsData.notificationTime || "16:00",
      schoolLogo: s.school_logo || settingsData.schoolLogo || "",
      allowAttendanceEditing: s.allow_attendance_editing ?? settingsData.allowAttendanceEditing ?? true,
      restrictLocation: s.restrict_location ?? settingsData.restrictLocation ?? false,
      schoolLatitude: s.school_latitude ?? settingsData.schoolLatitude ?? null,
      schoolLongitude: s.school_longitude ?? settingsData.schoolLongitude ?? null,
      allowedRadiusMeters: s.allowed_radius_meters ?? settingsData.allowedRadiusMeters ?? 200,
      allowOutsideAttendance: s.allow_outside_attendance ?? settingsData.allowOutsideAttendance ?? true,
      gradeSystem: s.grade_system || settingsData.gradeSystem || "standard",
      grade_system: s.grade_system || settingsData.gradeSystem || "standard",
      emailApiKey: s.email_api_key ?? settingsData.emailApiKey ?? "",
      email_api_key: s.email_api_key ?? settingsData.emailApiKey ?? "",
      emailFromDomain: s.email_from_domain || settingsData.emailFromDomain || "smartattenadacetracker.app",
      email_from_domain: s.email_from_domain || settingsData.emailFromDomain || "smartattenadacetracker.app",
      staffAttendanceMode: (s.staff_attendance_mode || settingsData.staffAttendanceMode || "daily") as "daily" | "session_based",
      staffSessions: (s.staff_sessions !== undefined ? s.staff_sessions : settingsData.staffSessions) ?? null,
      staffWorkingDays: s.staff_working_days || settingsData.staffWorkingDays || "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
      staffWorkStartTime: s.staff_work_start_time || settingsData.staffWorkStartTime || "08:00",
      staffWorkEndTime: s.staff_work_end_time || settingsData.staffWorkEndTime || "17:00",
      staffLateGraceMinutes: s.staff_late_grace_minutes ?? settingsData.staffLateGraceMinutes ?? 15,
      staffEarlyCheckoutToleranceMinutes: s.staff_early_checkout_tolerance_minutes ?? settingsData.staffEarlyCheckoutToleranceMinutes ?? 15,
      staffAbsenceCutoffMinutes: s.staff_absence_cutoff_minutes ?? settingsData.staffAbsenceCutoffMinutes ?? 120,
      staffAbsenceCutoffTime: s.staff_absence_cutoff_time || settingsData.staffAbsenceCutoffTime || "10:00",
      staffEarliestCheckinTime: s.staff_earliest_checkin_time || settingsData.staffEarliestCheckinTime || "06:00",
      staffLatestCheckoutTime: s.staff_latest_checkout_time || settingsData.staffLatestCheckoutTime || "20:00",
      staffFaceRequired: s.staff_face_required ?? settingsData.staffFaceRequired ?? true,
      staffGeoRequired: s.staff_geo_required ?? settingsData.staffGeoRequired ?? true,
      allowStaffCheckinAfterCutoff: s.allow_staff_checkin_after_cutoff ?? settingsData.allowStaffCheckinAfterCutoff ?? false,
    }

    // 1. Update SWR cache and localStorage
    queryCache.set(`settings_${schoolId}`, updatedMapped, true)

    if (typeof window !== "undefined") {
      try { localStorage.setItem(`_settings_backup_${schoolId}`, JSON.stringify(updatedMapped)) } catch { /* quota */ }
      
      // Synchronize calendar preference across the app
      try {
        localStorage.setItem('app_calendar_preference', calendarPreference)
        window.dispatchEvent(new CustomEvent('calendarPreferenceChanged', { detail: calendarPreference }))
      } catch {}

      // Synchronize active_school if name or logo changed
      try {
        const storedActive = localStorage.getItem("active_school")
        if (storedActive) {
          const parsed = JSON.parse(storedActive)
          parsed.name = updatedMapped.schoolName
          if (updatedMapped.schoolLogo) parsed.logo = updatedMapped.schoolLogo
          localStorage.setItem("active_school", JSON.stringify(parsed))
        }
      } catch {}
    }

    queryCache.invalidate(/^grades_/)
    queryCache.invalidate(/^sections_/)
    queryCache.invalidate(/^streams_/)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("settingsDataChanged"))
      window.dispatchEvent(new CustomEvent("schoolSettingsUpdated"))
    }

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
    displayReason?: string;
    workingDaysList: string[];
  }> {
    return settings.isDateWorkingDay(this.getApiHeaders(), date)
  }

  async resetSettings(): Promise<void> {
    const schoolId = this.getSchoolId() || "single-school"
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/settings/reset`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
      }
    )
    queryCache.invalidate(/^settings_/)
    queryCache.invalidate(/^grades_/)
    queryCache.invalidate(/^sections_/)
    queryCache.invalidate(/^streams_/)
    if (typeof window !== "undefined") {
      localStorage.removeItem(`_settings_backup_${schoolId}`)
      window.dispatchEvent(new CustomEvent("settingsDataChanged"))
      window.dispatchEvent(new CustomEvent("schoolSettingsUpdated"))
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
    const schoolId = this.getSchoolId() || "single-school"
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
    return teachers.getTeacherAssignments(this.getApiHeaders(), schoolId || this.getSchoolId() || "single-school", teacherId, forceRefetch)
  }

  async assignTeacherToClass(
    teacherId: string, classId: string, subject?: string,
    grade?: string, section?: string, stream?: string,
  ): Promise<TeacherAssignment | null> {
    const schoolId = this.getSchoolId() || "single-school"
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
        headers: this.getApiHeaders(),
        body: JSON.stringify({ full_name: profileData.name }),
      }
    )
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    await apiFetch(
      `${API_URL}/api/users/${userId}`,
      {
        method: "PUT",
        headers: this.getApiHeaders(),
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
    faceDescriptor?: number[] | null
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
    this.notifyStaffAttendanceDataChanged()
    return result.data
  }

  async staffCheckOut(payload: {
    date?: string
    session?: string        // 'daily' in daily mode; session id in session_based mode
    faceVerified?: boolean
    faceConfidence?: number | null
    faceDescriptor?: number[] | null
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
    this.notifyStaffAttendanceDataChanged()
    return result.data
  }

  async getStaffFaceAttemptStatus(params: {
    date?: string;
    session?: string;
    mode?: string;
  } = {}): Promise<{
    userId: string;
    date: string;
    session: string;
    attemptCount: number;
    maxAttempts: number;
    remainingAttempts: number;
    isLocked: boolean;
    lockMessage?: string | null;
  }> {
    const query = new URLSearchParams()
    if (params.date) query.append("date", params.date)
    if (params.session) query.append("session", params.session)
    if (params.mode) query.append("mode", params.mode)
    query.append("_t", Date.now().toString())

    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/attempt-status?${query.toString()}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    return result.data
  }

  async recordStaffFaceFailedAttempt(payload: {
    date?: string;
    session?: string;
    mode?: string;
    reason?: string;
  } = {}): Promise<{
    userId: string;
    date: string;
    session: string;
    attemptCount: number;
    maxAttempts: number;
    remainingAttempts: number;
    isLocked: boolean;
    lockMessage?: string | null;
  }> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/record-failed-attempt`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify(payload),
      }
    )
    return result.data
  }

  private notifyStaffAttendanceDataChanged() {
    queryCache.invalidate(/^staff_attendance/)
    queryCache.invalidate(/^my_staff_attendance/)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
  }

  async getMyStaffAttendance(filters: {
    date?: string;
    startDate?: string;
    endDate?: string;
    mode?: string;     // 'daily' | 'session_based'
    session?: string;  // optional session filter in session_based mode
  } = {}): Promise<any[]> {
    const params = new URLSearchParams()
    if (filters.date) params.append("date", filters.date)
    if (filters.startDate) params.append("startDate", filters.startDate)
    if (filters.endDate) params.append("endDate", filters.endDate)
    if (filters.mode) params.append("mode", filters.mode)
    if (filters.session) params.append("session", filters.session)

    const cacheKey = `my_staff_attendance_${params.toString() || 'all'}`
    return queryCache.fetch(
      cacheKey,
      async () => {
        const result = await apiFetch<{ success: boolean; data: any[] }>(
          `${API_URL}/api/staff-attendance/my?${params.toString()}`,
          { headers: this.getApiHeaders() }
        )
        return result.data || []
      },
      { staleTime: 20_000, persist: false }
    )
  }

  async getStaffAttendance(filters: {
    date?: string;
    startDate?: string;
    endDate?: string;
    role?: string;
    status?: string;
    session?: string;      // 'all' | 'daily' | 'morning' | 'afternoon' | custom
    mode?: string;         // 'daily' | 'session_based' — enforced by backend
    userId?: string;
    search?: string;
    geofenceVerified?: boolean | string;
    faceVerified?: boolean | string;
    page?: number;
    limit?: number;
  } = {}): Promise<any[] & { data: any[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams()
    if (filters.date) params.append("date", filters.date)
    if (filters.startDate) params.append("startDate", filters.startDate)
    if (filters.endDate) params.append("endDate", filters.endDate)
    if (filters.role) params.append("role", filters.role)
    if (filters.status) params.append("status", filters.status)
    if (filters.session) params.append("session", filters.session)
    if (filters.mode) params.append("mode", filters.mode)
    if (filters.userId) params.append("userId", filters.userId)
    if (filters.search) params.append("search", filters.search)
    if (filters.geofenceVerified !== undefined) params.append("geofenceVerified", String(filters.geofenceVerified))
    if (filters.faceVerified !== undefined) params.append("faceVerified", String(filters.faceVerified))
    if (filters.page) params.append("page", String(filters.page))
    if (filters.limit) params.append("limit", String(filters.limit))
    params.append("_t", Date.now().toString())

    const result = await apiFetch<{ success: boolean; data: any[]; total: number; page: number; limit: number }>(
      `${API_URL}/api/staff-attendance?${params.toString()}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    )
    const rawList: any = Array.isArray(result.data) ? result.data : []
    rawList.data = rawList
    rawList.total = result.total ?? rawList.length
    rawList.page = result.page ?? 1
    rawList.limit = result.limit ?? (rawList.length || 50)
    return rawList
  }

  async getStaffAttendanceStats(date?: string, session?: string): Promise<any> {
    const cacheKey = `staff_attendance_stats_${date || 'all'}_${session || 'daily'}`
    return queryCache.fetch(
      cacheKey,
      async () => {
        const params = new URLSearchParams()
        if (date) params.append("date", date)
        if (session) params.append("session", session)

        const result = await apiFetch<{ success: boolean; data: any }>(
          `${API_URL}/api/staff-attendance/stats?${params.toString()}`,
          { headers: this.getApiHeaders() }
        )
        return result.data || null
      },
      { staleTime: 20_000, persist: false }
    )
  }

  async getStaffAttendanceReport(filters: {
    startDate: string;
    endDate: string;
    role?: string;
    userId?: string;
    status?: string;
    mode?: string;     // 'daily' | 'session_based'
    session?: string;  // optional session filter in session_based mode
  }): Promise<any> {
    const params = new URLSearchParams()
    params.append("startDate", filters.startDate)
    params.append("endDate", filters.endDate)
    if (filters.role) params.append("role", filters.role)
    if (filters.userId) params.append("userId", filters.userId)
    if (filters.status && filters.status !== "ALL" && filters.status !== "all") {
      params.append("status", filters.status)
    }
    if (filters.mode) params.append("mode", filters.mode)
    if (filters.session) params.append("session", filters.session)
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
    reason: string,
    session?: string,  // pass for session-based mode
    mode?: string,     // 'daily' | 'session_based'
    endDate?: string   // optional end date for multi-day date range
  ): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/leave`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({
          userId,
          date,
          startDate: date,
          endDate: endDate || date,
          status,
          reason,
          session,
          mode,
        }),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }

  async enrollStaffFace(userId: string, descriptor: number[], replaceExisting = false): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/face-enroll`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify({ userId, descriptor, replaceExisting }),
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

  async processStaffAbsences(options?: { date?: string; session?: string; force?: boolean }): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/staff-attendance/process-absences`,
      {
        method: "POST",
        headers: this.getApiHeaders(),
        body: JSON.stringify(options || {}),
      }
    )
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("staffAttendanceDataChanged"))
    }
    return result.data
  }

  async getSystemRoles(includeInactive = false): Promise<any[]> {
    const result = await apiFetch<{ success: boolean; data: any[] }>(
      `${API_URL}/api/roles?includeInactive=${includeInactive}`,
      { headers: this.getApiHeaders(), cache: "no-store" }
    ).catch(() => ({ success: true, data: [] }))
    return result.data || []
  }
}

export const db = new Database()
export const database = db

