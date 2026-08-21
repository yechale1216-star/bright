"use client"

import { API_URL } from "@/lib/api-config"
import { apiFetch, RequestError } from "@/lib/utils/fetch-with-timeout"

export function defaultSettings() {
  return {
    schoolName: "Addis Hiwot School",
    schoolPhone: "",
    schoolAddress: "",
    academicYear: "2017/2018 E.C.",
    calendarType: "ETHIOPIAN",
    calendar_type: "ETHIOPIAN",
    calendarPreference: "ethiopian" as "ethiopian" | "gregorian",
    attendanceMode: "session_based",
    attendanceUiType: "card_based",
    attendanceThreshold: 75,
    allowLateMark: true,
    emailNotifications: true,
    smsNotifications: false,
    notificationTime: "16:00",
    schoolLogo: "",
    allowAttendanceEditing: true,
    restrictLocation: false,
    schoolLatitude: null,
    schoolLongitude: null,
    allowedRadiusMeters: 200,
    allowOutsideAttendance: true,
    gradeSystem: "standard",
    grade_system: "standard",
    emailApiKey: "",
    email_api_key: "",
    emailFromDomain: "smartattenadacetracker.app",
    email_from_domain: "smartattenadacetracker.app",
    // Staff working schedule
    staffAttendanceMode: "daily" as "daily" | "session_based",
    staffSessions: null as any,
    staffWorkingDays: "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
    staffWorkStartTime: "08:00",
    staffWorkEndTime: "17:00",
    staffLateGraceMinutes: 15,
    staffEarlyCheckoutToleranceMinutes: 15,
    staffAbsenceCutoffMinutes: 120,
    staffAbsenceCutoffTime: "10:00",
    staffEarliestCheckinTime: "06:00",
    staffLatestCheckoutTime: "20:00",
    staffFaceRequired: true,
    staffGeoRequired: true,
    allowStaffCheckinAfterCutoff: false,
  }
}

export async function getSettings(headers: any, schoolId?: string): Promise<any> {
  try {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/settings?_t=${Date.now()}`,
      { 
        headers,
        cache: 'no-store'
      }
    )
    const s = result.data || {}
    const calendarTypeUpper = (s.calendar_type || "ETHIOPIAN").toUpperCase()
    const calendarPreference = calendarTypeUpper.includes("GREGORIAN") ? "gregorian" : "ethiopian"

    const settingsData = {
      schoolName: s.school_name || "Addis Hiwot School",
      schoolPhone: s.school_phone || "",
      schoolAddress: s.school_address || "",
      academicYear: s.academic_year || "2017/2018 E.C.",
      calendarType: calendarTypeUpper,
      calendar_type: calendarTypeUpper,
      calendarPreference,
      attendanceMode: s.attendance_mode || "session_based",
      attendanceUiType: s.attendance_ui_type || "card_based",
      attendanceThreshold: s.attendance_threshold ?? 75,
      allowLateMark: s.allow_late_mark ?? true,
      emailNotifications: s.email_notifications ?? true,
      smsNotifications: s.sms_notifications ?? false,
      notificationTime: s.notification_time || "16:00",
      schoolLogo: s.school_logo || "",
      allowAttendanceEditing: s.allow_attendance_editing ?? true,
      restrictLocation: s.restrict_location ?? false,
      schoolLatitude: s.school_latitude ?? null,
      schoolLongitude: s.school_longitude ?? null,
      allowedRadiusMeters: s.allowed_radius_meters ?? 200,
      allowOutsideAttendance: s.allow_outside_attendance ?? true,
      gradeSystem: s.grade_system || "standard",
      grade_system: s.grade_system || "standard",
      emailApiKey: s.email_api_key || "",
      email_api_key: s.email_api_key || "",
      emailFromDomain: s.email_from_domain || "smartattenadacetracker.app",
      email_from_domain: s.email_from_domain || "smartattenadacetracker.app",
      staffAttendanceMode: (s.staff_attendance_mode || "daily") as "daily" | "session_based",
      staffSessions: s.staff_sessions ?? null,
      staffWorkingDays: s.staff_working_days || "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
      staffWorkStartTime: s.staff_work_start_time || "08:00",
      staffWorkEndTime: s.staff_work_end_time || "17:00",
      staffLateGraceMinutes: s.staff_late_grace_minutes ?? 15,
      staffEarlyCheckoutToleranceMinutes: s.staff_early_checkout_tolerance_minutes ?? 15,
      staffAbsenceCutoffMinutes: s.staff_absence_cutoff_minutes ?? 120,
      staffAbsenceCutoffTime: s.staff_absence_cutoff_time || "10:00",
      staffEarliestCheckinTime: s.staff_earliest_checkin_time || "06:00",
      staffLatestCheckoutTime: s.staff_latest_checkout_time || "20:00",
      staffFaceRequired: s.staff_face_required ?? true,
      staffGeoRequired: s.staff_geo_required ?? true,
      allowStaffCheckinAfterCutoff: s.allow_staff_checkin_after_cutoff ?? false,
    }

    const effectiveSchoolId = schoolId || "single-school"
    if (settingsData.schoolLogo && effectiveSchoolId) {
      import("@/lib/utils/indexeddb-store").then(({ cacheSchoolLogo }) => {
        cacheSchoolLogo(effectiveSchoolId, settingsData.schoolLogo)
      }).catch(() => {})
    }

    return settingsData
  } catch (error) {
    // If settings are not found (404), return default settings. Otherwise, propagate the error.
    if (error instanceof RequestError && error.type === "not_found") {
      return defaultSettings()
    }
    console.error("[pg] getSettings error:", error)
    throw error
  }
}

export async function getHolidays(headers: any, params?: { startDate?: string; endDate?: string; includeInactive?: boolean }): Promise<any[]> {
  const query = new URLSearchParams()
  if (params?.startDate) query.append("startDate", params.startDate)
  if (params?.endDate) query.append("endDate", params.endDate)
  if (params?.includeInactive) query.append("includeInactive", "true")
  query.append("_t", Date.now().toString())

  const result = await apiFetch<{ success: boolean; data: any[] }>(
    `${API_URL}/api/settings/holidays?${query.toString()}`,
    { headers, cache: "no-store" }
  )
  return result.data || []
}

export async function addHoliday(headers: any, data: any): Promise<any> {
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/settings/holidays`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  )
  return result.data
}

export async function updateHoliday(headers: any, id: string, data: any): Promise<any> {
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/settings/holidays/${id}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    }
  )
  return result.data
}

export async function deleteHoliday(headers: any, id: string): Promise<void> {
  await apiFetch(
    `${API_URL}/api/settings/holidays/${id}`,
    {
      method: "DELETE",
      headers,
    }
  )
}

export async function isDateWorkingDay(headers: any, date: string): Promise<{
  isWorkingDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  dayOfWeek: string;
  holidayName?: string;
  holidayType?: string;
  reason?: string;
  workingDaysList: string[];
}> {
  const result = await apiFetch<{ success: boolean; data: any }>(
    `${API_URL}/api/settings/is-working-day?date=${encodeURIComponent(date)}&_t=${Date.now()}`,
    { headers, cache: "no-store" }
  )
  return result.data
}
