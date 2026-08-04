"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { useAuth } from "./auth-context"
import { apiUrl } from "@/lib/api-config"
import { SESSION_ID_KEY } from "@/lib/auth/auth"
const API_URL = apiUrl;

export interface School {
  id: string
  name: string
  role?: string // Contextual role
  logo: string
  customSchoolId: string
}

interface SchoolContextValue {
  activeSchool: School | null
  availableSchools: School[]
  isLoadingSchool: boolean
  switchSchool: (schoolId: string, role?: string) => Promise<boolean>
  setSchoolsFromLogin: (schools: School[], initialSchoolId?: string) => void
  clearSchoolContext: () => void
  refreshSchools: () => Promise<void>
}

const SchoolContext = createContext<SchoolContextValue | null>(null)

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
  const schoolId = typeof window !== "undefined" ? localStorage.getItem("x-school-id") : null
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (schoolId) headers["x-school-id"] = schoolId

  // Situational Role Inference (Frontend)
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
  const [availableSchools, setAvailableSchools] = useState<School[]>([])
  const [isLoadingSchool, setIsLoadingSchool] = useState(false)

  // Synchronous session change reset during render:
  // This prevents any frame of stale school data from showing during user switches/signup.
  const [renderedSessionId, setRenderedSessionId] = useState<string | null | undefined>(undefined)

  if (renderedSessionId === undefined) {
    // Initial mount: record initial sessionId
    setRenderedSessionId(sessionId)
  } else if (renderedSessionId !== sessionId) {
    // Session changed! Try to sync fresh data from localStorage during transition
    // This ensures that if a login just completed, we preserve the fresh school data
    // instead of wiping it for one frame (which causes "No Schools Found" flashes)
    if (typeof window !== "undefined") {
      const storedActive = localStorage.getItem("active_school")
      const storedAvailable = localStorage.getItem("available_schools")
      try {
        setActiveSchool(storedActive ? JSON.parse(storedActive) : null)
        setAvailableSchools(storedAvailable ? JSON.parse(storedAvailable) : [])
      } catch {
        setActiveSchool(null)
        setAvailableSchools([])
      }
    } else {
      setActiveSchool(null)
      setAvailableSchools([])
    }
    setRenderedSessionId(sessionId)
  }

  const clearSchoolContext = useCallback(() => {
    setActiveSchool(null)
    setAvailableSchools([])
    localStorage.removeItem("active_school")
    localStorage.removeItem("available_schools")
    localStorage.removeItem("x-school-id")
    console.log("[SchoolContext] Cleared — session transition")
  }, [])

  // Register clearSchoolContext with AuthContext so AuthContext.logout() can call it
  // without creating a circular context dependency.
  useEffect(() => {
    registerClearSchoolContext(clearSchoolContext)
  }, [registerClearSchoolContext, clearSchoolContext])

  // When the sessionId changes, reload the fresh school data from localStorage.
  // This executes after the synchronous render reset has cleared the old session's data.
  useEffect(() => {
    if (sessionId) {
      const stored = localStorage.getItem("active_school")
      const schoolsStored = localStorage.getItem("available_schools")
      if (stored) {
        try { setActiveSchool(JSON.parse(stored)) } catch {}
      }
      if (schoolsStored) {
        try { setAvailableSchools(JSON.parse(schoolsStored)) } catch {}
      }
    } else {
      // Security: Only clear if there is definitely no session in storage
      // This prevents wiping the context during the initial AuthProvider mount (where sessionId is null for a frame)
      const storedSid = typeof window !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) : null
      if (!storedSid) {
        clearSchoolContext()
      } else {
        // We have a stored session but context doesn't know it yet - try a quiet load
        const schoolsStored = typeof window !== "undefined" ? localStorage.getItem("available_schools") : null
        if (schoolsStored) {
          try { setAvailableSchools(JSON.parse(schoolsStored)) } catch {}
        }
      }
    }
  }, [sessionId, clearSchoolContext])

  // Restore from localStorage on mount and on switch events
  const loadStoredData = useCallback(() => {
    try {
      const stored = localStorage.getItem("active_school")
      const schoolsStored = localStorage.getItem("available_schools")
      if (stored) setActiveSchool(JSON.parse(stored))
      if (schoolsStored) setAvailableSchools(JSON.parse(schoolsStored))
    } catch {}
  }, [])

  // Eager mount-time load: read active_school immediately so the TopNav header
  // shows the correct school logo/name on the very first render, before
  // validateSession()'s useEffect hooks have a chance to run.
  useEffect(() => {
    loadStoredData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  useEffect(() => {
    const handleSessionChange = () => {
      const storedSid = localStorage.getItem(SESSION_ID_KEY)
      console.log(`[SchoolContext] Session ID changed (${sessionId} -> ${storedSid}) — reloading school state...`)
      loadStoredData()
    }
    window.addEventListener("userSessionChanged", handleSessionChange)
    window.addEventListener("storage", loadStoredData)
    window.addEventListener("schoolSwitched", loadStoredData)
    return () => {
      window.removeEventListener("userSessionChanged", handleSessionChange)
      window.removeEventListener("storage", loadStoredData)
      window.removeEventListener("schoolSwitched", loadStoredData)
    }
  }, [sessionId, loadStoredData])


  /** Called immediately after login with the list of schools from the login response */
  const setSchoolsFromLogin = useCallback((schools: School[], initialSchoolId?: string) => {
    setAvailableSchools(schools)
    localStorage.setItem("available_schools", JSON.stringify(schools))

    const initial = schools.find(s => s.id === initialSchoolId) || schools[0]
    if (initial) {
      setActiveSchool(initial)
      localStorage.setItem("active_school", JSON.stringify(initial))
      localStorage.setItem("x-school-id", initial.id)
    }
  }, [])

  /**
   * Switch the active school — validates with the backend first.
   * Returns true on success.
   */
  const switchSchool = useCallback(async (schoolId: string, role?: string): Promise<boolean> => {
    setIsLoadingSchool(true)
    try {
      const res = await fetch(`${API_URL}/api/users/me/active-school`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ schoolId, role }),
      })

      if (!res.ok) {
        return false
      }

      const result = await res.json()
      if (!result.success) return false

      const school: School = result.data
      setActiveSchool(school)
      localStorage.setItem("active_school", JSON.stringify(school))
      localStorage.setItem("x-school-id", school.id)

      // Store the new token if provided — do NOT call validateSession() here.
      // validateSession() detects a session change and calls clearSchoolContext(),
      // which immediately wipes the school we just set. The token will be picked
      // up correctly when the page hard-reloads after the school switch.
      if (result.token) {
        localStorage.setItem("attendance_token", result.token)
      }

      // Fetch the students that belong to THIS school and update the list
      // so the parent layout shows the right children immediately.
      try {
        // Build headers with the NEW school ID explicitly (getAuthHeaders could still be stale)
        const stuHeaders = getAuthHeaders()
        stuHeaders["x-school-id"] = school.id

        const stuRes = await fetch(`${API_URL}/api/parent/me/students?schoolId=${school.id}`, {
          headers: stuHeaders,
        })
        if (stuRes.ok) {
          const stuJson = await stuRes.json()
          if (stuJson.success && Array.isArray(stuJson.data)) {
            // Merge: keep students from other schools, replace those from the new school
            const existingStr = localStorage.getItem("parent_students")
            const existing: any[] = existingStr ? JSON.parse(existingStr) : []
            const otherSchoolStudents = existing.filter((s: any) => s.schoolId !== school.id)
            const merged = [...otherSchoolStudents, ...stuJson.data]
            localStorage.setItem("parent_students", JSON.stringify(merged))
            console.log(`[switchSchool] Refreshed students for school ${school.id}: ${stuJson.data.length} found`)
          }
        }
      } catch (err) {
        console.warn("[switchSchool] Could not refresh students:", err)
      }

      // Set flag so validateSession() on the next page load does NOT call
      // clearSchoolContext() — which would wipe the school we just stored.
      localStorage.setItem("_zt_school_switch", "1")

      // Dispatch event so all components react (layout re-reads localStorage)
      window.dispatchEvent(new CustomEvent("schoolSwitched", { detail: school }))
      return true
    } catch (err) {
      console.error("[switchSchool] Error:", err)
      return false
    } finally {
      setIsLoadingSchool(false)
    }
  }, [])

  /** Fetch fresh school list from backend (used on page refresh) */
  const refreshSchools = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/me/schools`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return
      const result = await res.json()
      if (result.success) {
        setAvailableSchools(result.data)
        localStorage.setItem("available_schools", JSON.stringify(result.data))
      }
    } catch {}
  }, [])

  return (
    <SchoolContext.Provider
      value={{
        activeSchool,
        availableSchools,
        isLoadingSchool,
        switchSchool,
        setSchoolsFromLogin,
        clearSchoolContext,
        refreshSchools
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
