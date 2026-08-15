"use client"

import { API_URL } from "@/lib/api-config"
import { apiFetch, RequestError } from "@/lib/utils/fetch-with-timeout"

export function defaultSettings() {
  return {
    schoolName: "Setup Required",
    schoolPhone: "",
    schoolAddress: "",
    academicYear: new Date().getFullYear().toString(),
    attendanceMode: "session_based",
    attendanceUiType: "card_based",
    attendanceThreshold: 75,
    allowLateMark: true,
    emailNotifications: true,
    smsNotifications: false,
    notificationTime: "16:00",
    allowAttendanceEditing: true,
    restrictLocation: false,
    schoolLatitude: null,
    schoolLongitude: null,
    allowedRadiusMeters: 200,
    allowOutsideAttendance: true,
  }
}

export async function getSettings(headers: any, schoolId: string): Promise<any> {
  if (!schoolId) return defaultSettings()
  try {
    const result = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/settings?_t=${Date.now()}`,
      { 
        headers,
        cache: 'no-store'
      }
    )
    const s = result.data
    const settingsData = {
      schoolName: s.school_name || "Addis Hiwot School",
      schoolPhone: s.school_phone || "",
      schoolAddress: s.school_address || "",
      academicYear: s.academic_year || new Date().getFullYear().toString(),
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
    }

    if (settingsData.schoolLogo && schoolId) {
      import("@/lib/utils/indexeddb-store").then(({ cacheSchoolLogo }) => {
        cacheSchoolLogo(schoolId, settingsData.schoolLogo)
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
