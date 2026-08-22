"use client"

import { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/db/database"
import { useAuth } from "@/lib/context/auth-context"
import { queryCache } from "@/lib/utils/query-cache"

export function useSchoolSettings() {
  const { user: authUser, sessionReady } = useAuth()
  
  const getSchoolId = useCallback(() => {
    if (authUser?.schoolId) return authUser.schoolId
    if (typeof window !== "undefined") {
      try {
        const storedUser = localStorage.getItem("attendance_current_user")
        if (storedUser) {
          const parsed = JSON.parse(storedUser)
          if (parsed?.schoolId) return parsed.schoolId
        }
        return localStorage.getItem("x-school-id") || "single-school"
      } catch {
        return "single-school"
      }
    }
    return "single-school"
  }, [authUser?.schoolId])

  const confirmedSchoolId = getSchoolId() || "single-school"

  const [settings, setSettings] = useState<any>(() => {
    return queryCache.get<any>(`settings_${confirmedSchoolId}`) ?? null
  })
  const [isLoading, setIsLoading] = useState(!settings)

  const loadSettings = useCallback(async () => {
    try {
      const currentSettings = await db.getSettings()
      if (currentSettings) {
        setSettings(currentSettings)
      }
    } catch (error) {
      console.error("[useSchoolSettings] Error loading school settings:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const cached = confirmedSchoolId ? queryCache.get<any>(`settings_${confirmedSchoolId}`) : null
    if (cached) {
      setSettings(cached)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    loadSettings()

    const handleSettingsChanged = () => {
      loadSettings()
    }

    if (typeof window !== "undefined") {
      window.addEventListener("settingsDataChanged", handleSettingsChanged)
      window.addEventListener("schoolSettingsUpdated", handleSettingsChanged)
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("settingsDataChanged", handleSettingsChanged)
        window.removeEventListener("schoolSettingsUpdated", handleSettingsChanged)
      }
    }
  }, [confirmedSchoolId, sessionReady, loadSettings])

  return { settings, isLoading, reloadSettings: loadSettings }
}
