"use client"

import { useState, useEffect, useCallback } from "react"
import { getApiUrl } from "@/lib/api-config"

/**
 * Resolves the effective feature set for the current school.
 * Returns a hasFeature(key) function for conditional rendering.
 *
 * Usage:
 *   const { hasFeature, loading } = useFeatureAccess()
 *   if (hasFeature("messaging")) { ... }
 */
export function useFeatureAccess() {
  const [features, setFeatures] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const schoolId = localStorage.getItem("x-school-id")
        if (!schoolId) {
          setFeatures([])
          setLoading(false)
          return
        }

        const token = localStorage.getItem("attendance_token")
        const res = await fetch(`${getApiUrl()}/api/schools/${schoolId}/features`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        const json = await res.json()
        if (json.success) {
          setFeatures(json.data ?? [])
        } else {
          setError(json.error ?? "Failed to load features")
        }
      } catch (e) {
        setError("Network error loading features")
      } finally {
        setLoading(false)
      }
    }

    fetchFeatures()
  }, [])

  const hasFeature = useCallback(
    (key: string) => features.includes(key),
    [features]
  )

  return { hasFeature, features, loading, error }
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
