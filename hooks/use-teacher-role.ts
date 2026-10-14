'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '@/lib/db/database'
import { useAuth } from '@/lib/context/auth-context'

export interface TeacherPortalAssignment {
  id: string
  role?: 'SUBJECT_TEACHER' | 'HOMEROOM_TEACHER' | string
  gradeId: string
  sectionId: string
  streamId?: string | null
  subjectId?: string | null
  academicYearId?: string | null
  grade?: { id: string; name: string }
  section?: { id: string; name: string }
  stream?: { id: string; name: string } | null
  subjectRef?: { id: string; name: string; code: string; color?: string } | null
  subject?: string
}

const CACHE_KEY = 'teacher_portal_classes_cache'

export function useTeacherRole() {
  const { user, sessionReady } = useAuth()
  const [assignments, setAssignments] = useState<TeacherPortalAssignment[]>([])
  const [currentYear, setCurrentYear] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Instant hydration from cache
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.assignments)) {
          setAssignments(parsed.assignments)
          setCurrentYear(parsed.currentYear || null)
          setLoading(false)
        }
      }
    } catch {}
  }, [])

  const fetchClasses = useCallback(async () => {
    if (!user || user.role !== 'teacher') {
      setLoading(false)
      return
    }

    try {
      const res = await db.getTeacherPortalClasses()
      if (res) {
        const list: TeacherPortalAssignment[] = res.assignments || []
        setAssignments(list)
        setCurrentYear(res.currentYear || null)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            assignments: list,
            currentYear: res.currentYear || null,
            timestamp: Date.now()
          }))
        } catch {}
      }
    } catch (err) {
      console.error('[useTeacherRole] Failed to load teacher classes:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (sessionReady) {
      fetchClasses()
    }
  }, [sessionReady, fetchClasses])

  // Listen for assignment or session changes
  useEffect(() => {
    const handleUpdate = () => {
      fetchClasses()
    }
    window.addEventListener('teacherDataChanged', handleUpdate)
    window.addEventListener('userSessionChanged', handleUpdate)
    return () => {
      window.removeEventListener('teacherDataChanged', handleUpdate)
      window.removeEventListener('userSessionChanged', handleUpdate)
    }
  }, [fetchClasses])

  const homeroomAssignments = useMemo(
    () => assignments.filter(a => a.role === 'HOMEROOM_TEACHER'),
    [assignments]
  )

  const subjectAssignments = useMemo(
    () => assignments.filter(a => a.role !== 'HOMEROOM_TEACHER'),
    [assignments]
  )

  const isHomeroomTeacher = useMemo(
    () => homeroomAssignments.length > 0,
    [homeroomAssignments]
  )

  const isSubjectTeacher = useMemo(
    () => subjectAssignments.length > 0,
    [subjectAssignments]
  )

  const isDualRole = useMemo(
    () => isHomeroomTeacher && isSubjectTeacher,
    [isHomeroomTeacher, isSubjectTeacher]
  )

  const isHomeroomOnly = useMemo(
    () => isHomeroomTeacher && !isSubjectTeacher,
    [isHomeroomTeacher, isSubjectTeacher]
  )

  const isSubjectOnly = useMemo(
    () => assignments.length > 0 && homeroomAssignments.length === 0,
    [assignments, homeroomAssignments]
  )

  const roleBadge = useMemo(() => {
    if (isDualRole) return 'Homeroom & Subject Teacher'
    if (isHomeroomOnly) return 'Homeroom Teacher'
    if (isSubjectOnly) return 'Subject Teacher'
    return 'Teacher'
  }, [isDualRole, isHomeroomOnly, isSubjectOnly])

  return {
    assignments,
    homeroomAssignments,
    subjectAssignments,
    isHomeroomTeacher,
    isSubjectTeacher,
    isDualRole,
    isHomeroomOnly,
    isSubjectOnly,
    roleBadge,
    currentYear,
    loading,
    refresh: fetchClasses,
  }
}
