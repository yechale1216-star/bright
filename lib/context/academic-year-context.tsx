"use client"

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import { apiUrl } from "@/lib/api-config"

const API_URL = apiUrl

export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  schoolId: string
}

interface AcademicYearContextValue {
  /** The currently active academic year (isCurrent = true) */
  activeAcademicYear: AcademicYear | null
  /** All academic years for the school, sorted descending by startDate */
  allAcademicYears: AcademicYear[]
  /** True while fetching academic year data */
  isLoadingAcademicYear: boolean
  /** True if the user is viewing a historical (non-active) academic year */
  isHistoricalMode: boolean
  /** The academic year being viewed (may differ from active when in historical mode) */
  viewingAcademicYear: AcademicYear | null
  /** Switch to viewing a different academic year (for historical reports only) */
  setViewingAcademicYear: (year: AcademicYear | null) => void
  /** Reset viewing to the active year */
  resetToActiveYear: () => void
  /** Refresh academic years from the server */
  refreshAcademicYears: () => Promise<void>
}

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null)

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
  const schoolId = typeof window !== "undefined" ? localStorage.getItem("x-school-id") || "single-school" : "single-school"
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (schoolId) headers["x-school-id"] = schoolId
  return headers
}

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const [allAcademicYears, setAllAcademicYears] = useState<AcademicYear[]>([])
  const [isLoadingAcademicYear, setIsLoadingAcademicYear] = useState(false)
  const [viewingAcademicYear, setViewingAcademicYear] = useState<AcademicYear | null>(null)
  const hasFetched = useRef(false)

  const activeAcademicYear = allAcademicYears.find((y) => y.isCurrent) ?? null

  const isHistoricalMode =
    viewingAcademicYear !== null &&
    activeAcademicYear !== null &&
    viewingAcademicYear.id !== activeAcademicYear.id

  const resetToActiveYear = useCallback(() => {
    setViewingAcademicYear(null)
  }, [])

  const refreshAcademicYears = useCallback(async () => {
    setIsLoadingAcademicYear(true)
    try {
      const res = await fetch(`${API_URL}/api/school/academic-years`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return
      const result = await res.json()
      const years: AcademicYear[] = Array.isArray(result)
        ? result
        : Array.isArray(result.data)
        ? result.data
        : []
      // Sort by startDate desc
      years.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )
      setAllAcademicYears(years)
      // Persist to localStorage for instant hydration on next mount
      localStorage.setItem("academic_years_cache", JSON.stringify(years))
    } catch (err) {
      console.error("[AcademicYearContext] Failed to load academic years:", err)
    } finally {
      setIsLoadingAcademicYear(false)
    }
  }, [])

  // Instant hydration from localStorage cache on mount
  useEffect(() => {
    const cached = localStorage.getItem("academic_years_cache")
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AcademicYear[]
        setAllAcademicYears(parsed)
      } catch {}
    }
  }, [])

  // Fetch from server once on mount
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      refreshAcademicYears()
    }
  }, [refreshAcademicYears])

  // Listen for academic year change events (e.g. after admin activates a year)
  useEffect(() => {
    const handleChange = () => refreshAcademicYears()
    window.addEventListener("academicYearChanged", handleChange)
    return () => window.removeEventListener("academicYearChanged", handleChange)
  }, [refreshAcademicYears])

  const effectiveViewingYear = viewingAcademicYear ?? activeAcademicYear

  return (
    <AcademicYearContext.Provider
      value={{
        activeAcademicYear,
        allAcademicYears,
        isLoadingAcademicYear,
        isHistoricalMode,
        viewingAcademicYear: effectiveViewingYear,
        setViewingAcademicYear,
        resetToActiveYear,
        refreshAcademicYears,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  )
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext)
  if (!ctx) throw new Error("useAcademicYear must be used within AcademicYearProvider")
  return ctx
}
