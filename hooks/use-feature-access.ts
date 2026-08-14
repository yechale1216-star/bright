"use client"

import { useState, useEffect, useCallback } from "react"
import { getApiUrl } from "@/lib/api-config"

const ALL_FEATURES: string[] = [
  "attendance_tracking",
  "student_management",
  "teacher_management",
  "grade_section_management",
  "basic_reports",
  "advanced_analytics",
  "export_csv",
  "parent_reports",
  "parent_portal",
  "messaging",
  "sms_notifications",
  "video_calls",
  "multi_session_attendance",
  "student_promotion",
  "audit_logs",
  "custom_branding",
  "api_access",
  "priority_support",
  "discipline_management",
]

/**
 * Single-school edition: All features are permanently active for Addis Hiwot School.
 */
export function useFeatureAccess() {
  const hasFeature = useCallback((_key: string) => true, [])
  return { hasFeature, features: ALL_FEATURES, loading: false, error: null }
}

/**
 * Server-side utility to check if a school has a feature.
 * Used in API route handlers or server components.
 */
export type FeatureKey =
  | "attendance_tracking"
  | "student_management"
  | "teacher_management"
  | "grade_section_management"
  | "basic_reports"
  | "advanced_analytics"
  | "export_csv"
  | "parent_reports"
  | "parent_portal"
  | "messaging"
  | "sms_notifications"
  | "video_calls"
  | "multi_session_attendance"
  | "student_promotion"
  | "audit_logs"
  | "custom_branding"
  | "api_access"
  | "priority_support"
  | "discipline_management"
