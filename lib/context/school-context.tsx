"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { useAuth } from "./auth-context"
import { apiUrl } from "@/lib/api-config"
import { SESSION_ID_KEY } from "@/lib/auth/auth"
const API_URL = apiUrl;

export interface School {
  id: string
  name: string
  role?: string
  logo: string
  customSchoolId: string
}

interface SchoolContextValue {
  activeSchool: School | null
  isLoadingSchool: boolean
  clearSchoolContext: () => void
  refreshSchool: () => Promise<void>
  /** @deprecated Single-school edition — always the same school. Use activeSchool directly. */
  availableSchools: School[]
}

const SchoolContext = createContext<SchoolContextValue | null>(null)

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
  const schoolId = typeof window !== "undefined" ? localStorage.getItem("x-school-id") : null
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (schoolId) headers["x-school-id"] = schoolId

  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/parent')) headers["x-requested-role"] = 'parent';
    else if (pathname.startsWith('/school/teacher')) headers["x-requested-role"] = 'teacher';
    else if (pathname.startsWith('/school/admin')) headers["x-requested-role"] = 'school_admin';
  }
  
  return headers
}

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const { sessionId, registerClearSchoolContext } = useAuth()
  const [activeSchool, setActiveSchool] = useState<School | null>(null)
  const [isLoadingSchool, setIsLoadingSchool] = useState(false)

  // Synchronous session change reset during render to prevent stale school data flashes
  const [renderedSessionId, setRenderedSessionId] = useState<string | null | undefined>(undefined)

  if (renderedSessionId === undefined) {
    setRenderedSessionId(sessionId)
  } else if (renderedSessionId !== sessionId) {
    if (typeof window !== "undefined") {
      const storedActive = localStorage.getItem("active_school")
      try {
        setActiveSchool(storedActive ? JSON.parse(storedActive) : null)
      } catch {
        setActiveSchool(null)
      }
    } else {
      setActiveSchool(null)
    }
    setRenderedSessionId(sessionId)
  }

  const clearSchoolContext = useCallback(() => {
    setActiveSchool(null)
    localStorage.removeItem("active_school")
    localStorage.removeItem("available_schools")
    localStorage.removeItem("x-school-id")
  }, [])

  // Register clearSchoolContext with AuthContext so AuthContext.logout() can call it
  // without creating a circular context dependency.
  useEffect(() => {
    registerClearSchoolContext(clearSchoolContext)
  }, [registerClearSchoolContext, clearSchoolContext])

  // When the sessionId changes, reload the fresh school data from localStorage.
  useEffect(() => {
    if (sessionId) {
      const stored = localStorage.getItem("active_school")
      if (stored) {
        try { setActiveSchool(JSON.parse(stored)) } catch {}
      }
    } else {
      const storedSid = typeof window !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) : null
      if (!storedSid) {
        clearSchoolContext()
      }
    }
  }, [sessionId, clearSchoolContext])

  // Restore from localStorage on mount and on session/switch events
  const loadStoredData = useCallback(() => {
    try {
      const stored = localStorage.getItem("active_school")
      if (stored) setActiveSchool(JSON.parse(stored))
    } catch {}
  }, [])

  // Eager mount-time load so the TopNav shows the correct school logo/name on first render
  useEffect(() => {
    loadStoredData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  useEffect(() => {
    const handleSessionChange = () => loadStoredData()
    window.addEventListener("userSessionChanged", handleSessionChange)
    window.addEventListener("storage", loadStoredData)
    window.addEventListener("schoolSwitched", loadStoredData)
    return () => {
      window.removeEventListener("userSessionChanged", handleSessionChange)
      window.removeEventListener("storage", loadStoredData)
      window.removeEventListener("schoolSwitched", loadStoredData)
    }
  }, [loadStoredData])

  /** Fetch fresh school profile from the backend */
  const refreshSchool = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/me/schools`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return
      const result = await res.json()
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const single = result.data[0]
        setActiveSchool(single)
        localStorage.setItem("active_school", JSON.stringify(single))
        localStorage.setItem("available_schools", JSON.stringify([single]))
      }
    } catch {}
  }, [])

  // Kept for backwards compatibility — single school edition always has at most one school
  const availableSchools = activeSchool ? [activeSchool] : []

  return (
    <SchoolContext.Provider
      value={{
        activeSchool,
        availableSchools,
        isLoadingSchool,
        clearSchoolContext,
        refreshSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error("useSchool must be used within SchoolProvider")
  return ctx
}
