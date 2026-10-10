'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, 
  History, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  GraduationCap, 
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  Users,
  Calendar,
  Undo2,
  ChevronDown,
  ShieldCheck,
  Download,
  ChevronLeft,
  UserCheck,
  UserX,
  Layers,
  User,
  Box,
  Check,
  Play
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { notifications } from '@/lib/utils/notifications'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/utils'
import { useCalendar } from '@/lib/context/calendar-context'
import { AuthGuard } from '@/components/auth/auth-guard'

import { apiUrl, getApiUrl } from '@/lib/api-config'
const API_URL = apiUrl;

interface PromotionCohort {
  id: string
  gradeId: string
  gradeName: string
  sectionId: string
  sectionName: string
  streamId: string | null
  streamName: string | null
  count: number
}

interface GradeStudent {
  id: string
  fullName: string
  student_id: string
  gender: string | null
  sectionId: string
  streamId: string | null
  section: { id: string; name: string }
  stream: { id: string; name: string } | null
}

interface Stream {
  id: string
  name: string
}

interface Grade {
  id: string
  name: string
}

interface PromotionHistory {
  id: string
  student: { fullName: string; student_id: string }
  academicYear: string
  fromGradeId: string
  fromSectionId: string
  toGradeId: string | null
  toSectionId: string | null
  toStreamId: string | null
  promotedAt: string
  promotedByUserId: string
  notes?: string
}

function getNextAcademicYearSuggestion(currentYearName: string): string {
  if (!currentYearName) return ''
  const trimmed = currentYearName.trim()
  // Match Ethiopian Calendar format: e.g. "2018 E.C." or "2018"
  const ecMatch = trimmed.match(/^(\d{4})(\s*E\.?C\.?.*)?$/i)
  if (ecMatch) {
    const nextYearNum = parseInt(ecMatch[1], 10) + 1
    const suffix = ecMatch[2] || ' E.C.'
    return `${nextYearNum}${suffix}`
  }
  // Match range format: e.g. "2025/26" or "2025/2026" or "2025-2026"
  const rangeMatch = trimmed.match(/^(\d{4})([\/\-])(\d{2,4})(.*)$/)
  if (rangeMatch) {
    const y1 = parseInt(rangeMatch[1], 10) + 1
    const separator = rangeMatch[2]
    const y2Str = rangeMatch[3]
    const suffix = rangeMatch[4] || ''
    if (y2Str.length === 2) {
      const nextY2 = (parseInt(y2Str, 10) + 1) % 100
      return `${y1}${separator}${String(nextY2).padStart(2, '0')}${suffix}`
    } else {
      const nextY2 = parseInt(y2Str, 10) + 1
      return `${y1}${separator}${nextY2}${suffix}`
    }
  }
  return ''
}

export default function StudentPromotionPage() {
  const { formatDateTime } = useCalendar()
  const [activeTab, setActiveTab] = useState("promote")
  const [cohorts, setCohorts] = useState<PromotionCohort[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [history, setHistory] = useState<PromotionHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [configuredAcademicYears, setConfiguredAcademicYears] = useState<{ id: string; name: string; isCurrent: boolean }[]>([])
  const [fromAcademicYear, setFromAcademicYear] = useState("")
  const [toAcademicYear, setToAcademicYear] = useState("")
  const [calendarType, setCalendarType] = useState<'ETHIOPIAN' | 'GREGORIAN'>('ETHIOPIAN')
  const [isFutureConfirmOpen, setIsFutureConfirmOpen] = useState(false)
  
  // Wizard Steps: 1 = Setup, 2 = Selection, 3 = Targets, 4 = Review
  const [currentStep, setCurrentStep] = useState(1)
  
  // Promotion Mode
  const [promotionMode, setPromotionMode] = useState<'bulk' | 'selective'>('bulk')
  
  // Selection State
  const [selectedCohortIds, setSelectedCohortIds] = useState<Set<string>>(new Set())
  const [expandedCohortId, setExpandedCohortId] = useState<string | null>(null)
  const [cohortStudents, setCohortStudents] = useState<Record<string, GradeStudent[]>>({})
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, Set<string>>>({})
  const [studentSearchTerm, setStudentSearchTerm] = useState("")
  const [loadingStudents, setLoadingStudents] = useState(false)
  
  // Rules state
  const [promotionRules, setPromotionRules] = useState<Record<string, { 
    gradeId: string | 'GRADUATE', 
    sectionName: string, 
    streamId?: string 
  }>>({})
  
  const headers = useMemo(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null
    const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null
    return {
      'Authorization': `Bearer ${token}`,
      'x-school-id': schoolId || '',
      'Content-Type': 'application/json'
    }
  }, [])

  const loadData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true)
    try {
      const baseUrl = getApiUrl()
      const [prevRes, histRes, streamRes, settingsRes, gradesRes, ayRes] = await Promise.all([
        fetch(`${baseUrl}/api/promotions/preview`, { headers: headers as any }),
        fetch(`${baseUrl}/api/promotions/history`, { headers: headers as any }),
        fetch(`${baseUrl}/api/schools/me/streams`, { headers: headers as any }),
        fetch(`${baseUrl}/api/settings`, { headers: headers as any }),
        fetch(`${baseUrl}/api/schools/me/grades`, { headers: headers as any }),
        fetch(`${baseUrl}/api/academic-years`, { headers: headers as any })
      ])
      
      let cohortData: PromotionCohort[] = []
      if (prevRes.ok && (prevRes.headers.get('content-type') || '').includes('application/json')) {
        const result = await prevRes.json()
        cohortData = result.data || []
        setCohorts(cohortData)
      }

      if (settingsRes.ok && (settingsRes.headers.get('content-type') || '').includes('application/json')) {
        const result = await settingsRes.json()
        if (result.data?.calendar_type) {
          setCalendarType(result.data.calendar_type)
        }
      }

      if (ayRes.ok && (ayRes.headers.get('content-type') || '').includes('application/json')) {
        const result = await ayRes.json()
        const ayList: { id: string; name: string; isCurrent: boolean }[] = result.data || []
        setConfiguredAcademicYears(ayList)
        if (ayList.length > 0) {
          const currentAY = ayList.find(y => y.isCurrent) || ayList[0]
          // From Academic Year MUST be the current active academic year
          setFromAcademicYear(prev => prev || currentAY.name)

          // To Academic Year: pick configured future year or compute smart suggestion
          const otherAY = ayList.find(y => !y.isCurrent)
          const suggested = getNextAcademicYearSuggestion(currentAY.name)
          setToAcademicYear(prev => prev || (otherAY ? otherAY.name : suggested))
        }
      }

      let loadedStreams: Stream[] = []
      if (streamRes.ok) {
        const result = await streamRes.json()
        loadedStreams = result.data || []
        setStreams(loadedStreams)
      }

      let latestGrades: Grade[] = []
      if (gradesRes.ok) {
        const result = await gradesRes.json()
        latestGrades = result.data || []
        setGrades(latestGrades)
      }
      
      if (cohortData.length > 0) {
        setPromotionRules(prev => {
          const updatedRules: Record<string, { gradeId: string | 'GRADUATE', sectionName: string, streamId?: string }> = { ...prev }
          
          // Auto-configure rules based on grade progression for new cohorts only
          cohortData.forEach(cohort => {
            if (!updatedRules[cohort.id]) {
              const cohortGradeNum = parseInt(cohort.gradeName?.replace(/[^\d]/g, '') || '0') || 0
              const targetGrade = latestGrades.find((g: any) => (parseInt(g.name?.replace(/[^\d]/g, '') || '0') || 0) === cohortGradeNum + 1)
              const targetGradeNum = targetGrade ? parseInt(targetGrade.name?.replace(/[^\d]/g, '') || '0') || 0 : 0
              
              const rule: { gradeId: string | 'GRADUATE', sectionName: string, streamId?: string } = {
                gradeId: targetGrade ? targetGrade.id : 'GRADUATE',
                sectionName: cohort.sectionName || ''
              }

              // If target grade is 11+ and current cohort already has a stream, carry it forward
              if (targetGradeNum >= 11 && cohort.streamId) {
                rule.streamId = cohort.streamId
              }
              
              updatedRules[cohort.id] = rule
            }
          })
          
          return updatedRules
        })

        // If school has no dedicated stream records but cohorts DO have stream data, 
        // reconstruct the streams list from cohort data so the dropdown is populated
        if (loadedStreams.length === 0) {
          const cohortStreams: Stream[] = []
          const seen = new Set<string>()
          cohortData.forEach(c => {
            if (c.streamId && c.streamName && !seen.has(c.streamId)) {
              seen.add(c.streamId)
              cohortStreams.push({ id: c.streamId, name: c.streamName })
            }
          })
          
          // Pre-populate standard Ethiopian secondary school streams if empty
          if (!seen.has('natural-science')) {
            cohortStreams.push({ id: 'Natural Science', name: 'Natural Science' })
          }
          if (!seen.has('social-science')) {
            cohortStreams.push({ id: 'Social Science', name: 'Social Science' })
          }
          setStreams(cohortStreams)
        }
      }
      
      if (histRes.ok) {
        const result = await histRes.json()
        setHistory(result.data || [])
      }
    } catch (error) {
      console.error("Failed to load promotion data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const pollInterval = setInterval(() => {
      loadData(true)
    }, 10000)

    return () => clearInterval(pollInterval)
  }, [])

  // Fetch students for a specific cohort
  const loadStudentsForCohort = async (cohort: PromotionCohort) => {
    if (cohortStudents[cohort.id]) return
    setLoadingStudents(true)
    try {
      const query = new URLSearchParams({
        sectionId: cohort.sectionId,
        streamId: cohort.streamId || 'none'
      })
      const res = await fetch(`${API_URL}/api/promotions/preview/${cohort.gradeId}/students?${query.toString()}`, { headers: headers as any })
      if (res.ok) {
        const result = await res.json()
        const students: GradeStudent[] = result.data || []
        setCohortStudents(prev => ({ ...prev, [cohort.id]: students }))
        // Auto-select all students
        setSelectedStudentIds(prev => ({
          ...prev,
          [cohort.id]: new Set(students.map(s => s.id))
        }))
      }
    } catch (error) {
      console.error("Failed to load students:", error)
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleCohortClick = async (cohort: PromotionCohort) => {
    if (promotionMode === 'bulk') {
      setSelectedCohortIds(prev => {
        const next = new Set(prev)
        if (next.has(cohort.id)) {
          next.delete(cohort.id)
        } else {
          next.add(cohort.id)
        }
        return next
      })
    } else {
      setExpandedCohortId(cohort.id)
      setStudentSearchTerm("")
      await loadStudentsForCohort(cohort)
    }
  }

  const toggleStudentSelection = (cohortId: string, studentId: string) => {
    setSelectedStudentIds(prev => {
      const current = new Set(prev[cohortId] || [])
      if (current.has(studentId)) {
        current.delete(studentId)
      } else {
        current.add(studentId)
      }
      return { ...prev, [cohortId]: current }
    })
  }

  const toggleSelectAll = (cohortId: string) => {
    const students = cohortStudents[cohortId] || []
    const currentSelected = selectedStudentIds[cohortId] || new Set()
    
    if (currentSelected.size === students.length) {
      setSelectedStudentIds(prev => ({ ...prev, [cohortId]: new Set() }))
    } else {
      setSelectedStudentIds(prev => ({
        ...prev,
        [cohortId]: new Set(students.map(s => s.id))
      }))
    }
  }

  // Selections summary
  const totalSelectedInSelective = useMemo(() => {
    let total = 0
    for (const id in selectedStudentIds) {
      total += selectedStudentIds[id].size
    }
    return total
  }, [selectedStudentIds])

  const totalSelectedInBulk = useMemo(() => {
    let total = 0
    selectedCohortIds.forEach(id => {
      const cohort = cohorts.find(c => c.id === id)
      if (cohort) total += cohort.count
    })
    return total
  }, [selectedCohortIds, cohorts])

  const activeCohortIds = useMemo(() => {
    if (promotionMode === 'bulk') {
      return Array.from(selectedCohortIds)
    } else {
      return Object.keys(selectedStudentIds).filter(id => selectedStudentIds[id].size > 0)
    }
  }, [promotionMode, selectedCohortIds, selectedStudentIds])

  const isConfigurationComplete = useMemo(() => {
    if (activeCohortIds.length === 0) return false
    
    for (const cohortId of activeCohortIds) {
      const rule = promotionRules[cohortId]
      if (!rule) return false
      
      if (rule.gradeId !== 'GRADUATE') {
        const targetGrade = grades.find(g => g.id === rule.gradeId)
        const targetGradeNum = parseInt((targetGrade?.name || '').replace(/[^\d]/g, '')) || 0
        if (targetGradeNum >= 11 && !rule.streamId) {
          return false
        }
      }
    }
    return true
  }, [activeCohortIds, promotionRules, grades])

  const executePromotion = async () => {
    if (activeCohortIds.length === 0) return
    if (!isConfigurationComplete) return
    
    setIsSubmitLoading(true)
    try {
      // Sort active cohort IDs by grade number DESCENDING so higher grades (e.g. Gr 12 -> Grad, Gr 11 -> 12) run before lower grades (Gr 10 -> 11)
      const sortedCohortIds = [...activeCohortIds].sort((a, b) => {
        const cohortA = cohorts.find(c => c.id === a)
        const cohortB = cohorts.find(c => c.id === b)
        const gradeA = parseInt(cohortA?.gradeName?.replace(/[^\d]/g, '') || '0') || 0
        const gradeB = parseInt(cohortB?.gradeName?.replace(/[^\d]/g, '') || '0') || 0
        return gradeB - gradeA
      })

      for (const cohortId of sortedCohortIds) {
        const rule = promotionRules[cohortId]
        if (!rule) continue

        const cohort = cohorts.find(c => c.id === cohortId)
        if (!cohort) continue

        const payload: any = {
          academicYear: toAcademicYear,
          fromAcademicYear: fromAcademicYear,
          toGradeId: rule.gradeId === 'GRADUATE' ? 'GRADUATE' : rule.gradeId,
          toSectionName: rule.sectionName || null,
          toStreamId: rule.streamId || null,
        }

        if (promotionMode === 'bulk') {
          payload.gradeId = cohort.gradeId
          payload.sectionId = cohort.sectionId
          payload.streamId = cohort.streamId || 'none'
          payload.notes = `Bulk promotion: Grade ${cohort.gradeName} ${cohort.streamName ? cohort.streamName + ' ' : ''}Section ${cohort.sectionName}`
        } else {
          const studentIds = Array.from(selectedStudentIds[cohortId] || [])
          if (studentIds.length === 0) continue
          payload.studentIds = studentIds
          payload.notes = `Selective promotion: ${studentIds.length} students from cohort ${cohort.gradeName} ${cohort.streamName ? cohort.streamName + ' ' : ''}Section ${cohort.sectionName}`
        }

        const res = await fetch(`${API_URL}/api/promotions/promote`, {
          method: 'POST',
          headers: headers as any,
          body: JSON.stringify(payload)
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || `Failed to promote cohort ${cohortId}`)
        }
      }
      
      notifications.success("Success", "Students promoted successfully")
      
      // Reset Wizard
      setCurrentStep(1)
      setExpandedCohortId(null)
      setSelectedStudentIds({})
      setSelectedCohortIds(new Set())
      setCohortStudents({})
      loadData()
    } catch (error: any) {
      notifications.error("Promotion Failed", error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleRollback = async (id: string) => {
    if (!confirm("Are you sure you want to rollback this promotion? The student will be returned to their previous grade/section.")) return

    try {
      const res = await fetch(`${API_URL}/api/promotions/rollback/${id}`, {
        method: 'POST',
        headers: headers as any
      })
      if (res.ok) {
        notifications.success("Success", "Promotion rolled back successfully")
        loadData()
      } else {
        const err = await res.json()
        throw new Error(err.error || "Rollback failed")
      }
    } catch (error: any) {
      notifications.error("Error", error.message)
    }
  }

  const filteredCohorts = cohorts.filter(c => 
    (c.gradeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.sectionName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.streamName && c.streamName.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const expandedCohort = expandedCohortId ? cohorts.find(c => c.id === expandedCohortId) : null
  const expandedStudents = expandedCohortId ? (cohortStudents[expandedCohortId] || []) : []
  
  const filteredStudents = expandedStudents.filter(s =>
    s.fullName.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    s.student_id.toLowerCase().includes(studentSearchTerm.toLowerCase())
  )
  const selectedCountForExpanded = expandedCohortId ? (selectedStudentIds[expandedCohortId]?.size || 0) : 0

  const isValidAcademicYear = (year: string): boolean => {
    if (!year || typeof year !== 'string') return false
    const cleaned = year.trim().replace(/\s*E\.?C\.?$/i, '').trim()
    const rangeMatch = cleaned.match(/^(\d{4})[\/\-](\d{2,4})$/)
    if (rangeMatch) {
      const y1 = parseInt(rangeMatch[1], 10)
      let y2 = parseInt(rangeMatch[2], 10)
      if (y2 < 100) {
        const century = Math.floor(y1 / 100) * 100
        y2 = century + y2
      }
      return y2 === y1 + 1
    }
    const singleMatch = cleaned.match(/^(\d{4})$/)
    if (singleMatch) {
      const y = parseInt(singleMatch[1], 10)
      return y >= 1900 && y <= 2100
    }
    return false
  }

  // Stepper steps configuration
  const steps = [
    { number: 1, label: "Setup" },
    { number: 2, label: "Selection" },
    { number: 3, label: "Targets" },
    { number: 4, label: "Review" }
  ]

  // Wizard Navigation Handlers
  const handleNext = () => {
    if (currentStep === 1) {
      if (!fromAcademicYear || !toAcademicYear) {
        notifications.warning("Selection Required", "Please select both From Academic Year and To Academic Year.")
        return
      }
      if (fromAcademicYear === toAcademicYear) {
        notifications.warning("Invalid Transition", "Target 'To Academic Year' must be different from 'From Academic Year'.")
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      const selectionsCount = promotionMode === 'bulk' ? selectedCohortIds.size : totalSelectedInSelective
      if (selectionsCount === 0) {
        notifications.warning("Selection Required", "Please select at least one cohort or student before proceeding.")
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      if (!isConfigurationComplete) {
        notifications.warning("Configuration Incomplete", "Please complete all target rule configurations, including mandatory streams where applicable.")
        return
      }
      setCurrentStep(4)
    }
  }

  const handleBack = () => {
    if (currentStep === 2 && expandedCohortId !== null) {
      setExpandedCohortId(null)
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Calculate if the "Next" button should be disabled
  const isNextDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !fromAcademicYear || !toAcademicYear || fromAcademicYear === toAcademicYear
    }
    if (currentStep === 2) {
      return promotionMode === 'bulk' ? selectedCohortIds.size === 0 : totalSelectedInSelective === 0
    }
    if (currentStep === 3) {
      return !isConfigurationComplete
    }
    return false
  }, [currentStep, fromAcademicYear, toAcademicYear, promotionMode, selectedCohortIds, totalSelectedInSelective, isConfigurationComplete])

  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'registrar']}>
      <div className="space-y-6 pt-4 md:pt-6 pb-24 md:pb-12 max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <TrendingUp className="w-6 h-6 text-primary" /> Student Promotion
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-[10px] uppercase tracking-wide px-2.5 py-0.5">
              {calendarType === 'ETHIOPIAN' ? 'Ethiopian Calendar (E.C.)' : 'Gregorian Calendar (G.C.)'}
            </Badge>
          </div>
          <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Batch promote cohorts or selectively advance individual students for the new academic year
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-2 w-full md:w-[220px] bg-slate-100 dark:bg-slate-800 rounded-xl h-10 p-1">
            <TabsTrigger value="promote" className="rounded-lg font-bold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
              Promote
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg font-bold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
              History
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "promote" ? (
          <motion.div
            key="promote"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* STEP PROGRESS INDICATOR */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              {/* Desktop & Tablet Stepper */}
              <div className="hidden sm:flex justify-between items-center relative max-w-3xl mx-auto">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
                <div 
                  className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
                  style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                />
                
                {steps.map((s) => {
                  const isActive = currentStep >= s.number
                  const isCurrent = currentStep === s.number
                  return (
                    <div key={s.number} className="flex flex-col items-center z-10 relative">
                      <div 
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border-2",
                          isCurrent 
                            ? "bg-primary border-primary text-white shadow-md shadow-primary/20 scale-105" 
                            : isActive 
                              ? "bg-primary/10 border-primary text-primary" 
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400"
                        )}
                      >
                        {isActive && !isCurrent ? <Check className="w-4 h-4" /> : s.number}
                      </div>
                      <span 
                        className={cn(
                          "text-xs font-semibold mt-2 transition-all duration-300",
                          isCurrent ? "text-primary font-bold" : "text-slate-400"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Mobile Stepper */}
              <div className="sm:hidden space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-primary">
                    Step {currentStep} of {steps.length}: {steps[currentStep - 1].label}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {Math.round(((currentStep) / steps.length) * 100)}% Complete
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(currentStep / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* STEP VIEWS */}
            <div className="min-h-[350px]">
              <AnimatePresence mode="wait">
                {/* STEP 1: SETUP */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl">
                      <CardHeader>
                        <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                          <Play className="w-5 h-5 text-primary" /> Setup Promotion Parameters
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Choose the target academic year and the advancement scope mode for your school.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        {/* Target Academic Year Dropdowns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-emerald-600" /> From Academic Year (Current Source)
                            </Label>
                            <Select value={fromAcademicYear} onValueChange={setFromAcademicYear}>
                              <SelectTrigger className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 rounded-xl font-bold text-sm">
                                <SelectValue placeholder="Select From Academic Year" />
                              </SelectTrigger>
                              <SelectContent>
                                {configuredAcademicYears.map(ay => (
                                  <SelectItem key={ay.id} value={ay.name}>
                                    {ay.name} {ay.isCurrent ? '🟢 (Current Active)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[11px] text-slate-400 font-medium">Source academic year where students are currently enrolled.</p>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-primary" /> To Academic Year (Target Advancement)
                            </Label>
                            <Select value={toAcademicYear} onValueChange={setToAcademicYear}>
                              <SelectTrigger className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 rounded-xl font-bold text-sm text-primary">
                                <SelectValue placeholder="Select To Academic Year" />
                              </SelectTrigger>
                              <SelectContent>
                                {configuredAcademicYears.map(ay => (
                                  <SelectItem key={ay.id} value={ay.name}>
                                    {ay.name} {ay.isCurrent ? '(Current Active)' : ''}
                                  </SelectItem>
                                ))}
                                {/* Render smart suggestion if not already in configured list */}
                                {(() => {
                                  const currentAY = configuredAcademicYears.find(y => y.isCurrent) || configuredAcademicYears[0]
                                  const suggested = currentAY ? getNextAcademicYearSuggestion(currentAY.name) : ''
                                  if (suggested && !configuredAcademicYears.some(y => y.name.toLowerCase() === suggested.toLowerCase())) {
                                    return (
                                      <SelectItem key="suggested-next" value={suggested}>
                                        ✨ {suggested} (Suggested Next Year)
                                      </SelectItem>
                                    )
                                  }
                                  return null
                                })()}
                              </SelectContent>
                            </Select>
                            <p className="text-[11px] text-slate-400 font-medium">Upcoming academic year where promoted students will be enrolled.</p>
                          </div>
                        </div>

                        {fromAcademicYear === toAcademicYear && fromAcademicYear && (
                          <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                            <span><strong>Note:</strong> Promotion advances students into a <strong>new upcoming academic year</strong>. Please select a different Target Academic Year (e.g. {getNextAcademicYearSuggestion(fromAcademicYear) || 'next year'}).</span>
                          </div>
                        )}

                        {/* Mode Select options */}
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            Promotion Scope Mode
                          </Label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Bulk Mode Option */}
                            <div 
                              onClick={() => setPromotionMode('bulk')}
                              className={cn(
                                "p-6 rounded-2xl border-2 cursor-pointer transition-all flex gap-4 items-start active:scale-[0.99]",
                                promotionMode === 'bulk' 
                                  ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md shadow-primary/5" 
                                  : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                              )}
                            >
                              <div className={cn(
                                "p-3 rounded-xl shrink-0 mt-0.5",
                                promotionMode === 'bulk' ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                              )}>
                                <Layers className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                                  Bulk Promotion
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                  Promote entire cohorts (Grade, Stream, and Section combinations) altogether. Fast and efficient for normal end-of-year rollings.
                                </p>
                              </div>
                            </div>

                            {/* Selective Mode Option */}
                            <div 
                              onClick={() => setPromotionMode('selective')}
                              className={cn(
                                "p-6 rounded-2xl border-2 cursor-pointer transition-all flex gap-4 items-start active:scale-[0.99]",
                                promotionMode === 'selective' 
                                  ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md shadow-primary/5" 
                                  : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                              )}
                            >
                              <div className={cn(
                                "p-3 rounded-xl shrink-0 mt-0.5",
                                promotionMode === 'selective' ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                              )}>
                                <UserCheck className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                                  Selective Promotion
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                  Select specific students from sections to promote while retaining others. Ideal when handling retentions, individual transfers, or custom filters.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* STEP 2: SELECTION */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <AnimatePresence mode="wait">
                      {/* Drilldown Sub-view for student selection */}
                      {promotionMode === 'selective' && expandedCohortId !== null ? (
                        <motion.div
                          key="student-checklist"
                          initial={{ opacity: 0, scale: 0.99 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.99 }}
                        >
                          <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl overflow-hidden">
                            <CardHeader className="pb-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="rounded-xl h-10 w-10 shrink-0 border-slate-200 dark:border-slate-800" 
                                    onClick={() => setExpandedCohortId(null)}
                                  >
                                    <ChevronLeft className="w-5 h-5" />
                                  </Button>
                                  <div>
                                    <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                      {expandedCohort?.gradeName} {expandedCohort?.streamName ? '- ' + expandedCohort.streamName : ''} (Sec {expandedCohort?.sectionName})
                                    </CardTitle>
                                    <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                      Select students to promote ({selectedCountForExpanded} of {expandedStudents.length} selected)
                                    </CardDescription>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 rounded-xl font-bold text-xs gap-1.5 border-slate-200 dark:border-slate-800 px-4"
                                    onClick={() => toggleSelectAll(expandedCohortId!)}
                                  >
                                    {selectedCountForExpanded === expandedStudents.length ? (
                                      <><UserX className="w-4 h-4" /> Clear All</>
                                    ) : (
                                      <><UserCheck className="w-4 h-4" /> Select All</>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <div className="relative mt-4">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                  placeholder="Search students by name or ID..." 
                                  className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 rounded-xl text-sm"
                                  value={studentSearchTerm}
                                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                                />
                              </div>
                            </CardHeader>
                            
                            <CardContent className="p-4">
                              {loadingStudents ? (
                                <div className="flex items-center justify-center py-20">
                                  <Spinner size="md" className="text-primary" />
                                </div>
                              ) : filteredStudents.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 font-medium">
                                  No students found matching your search.
                                </div>
                              ) : (
                                <ScrollArea className="h-[480px]">
                                  {/* Grid representation on Tablet/Desktop (2-3 cols), vertical stack on mobile */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-3 pb-2">
                                    {filteredStudents.map((student) => {
                                      const isSelected = selectedStudentIds[expandedCohortId!]?.has(student.id) || false
                                      return (
                                        <div 
                                          key={student.id} 
                                          className={cn(
                                            "flex items-center justify-between p-3.5 cursor-pointer border rounded-xl transition-all hover:border-primary/50",
                                            isSelected 
                                              ? "bg-primary/5 border-primary/40 dark:bg-primary/10 shadow-sm" 
                                              : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800/80"
                                          )}
                                          onClick={() => toggleStudentSelection(expandedCohortId!, student.id)}
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleStudentSelection(expandedCohortId!, student.id)}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
                                              />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                              <span className={cn("font-bold text-xs md:text-sm text-slate-900 dark:text-white truncate leading-tight", isSelected && "text-primary")}>
                                                {student.fullName}
                                              </span>
                                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                ID: {student.student_id} {student.gender ? `• ${student.gender}` : ''}
                                              </span>
                                            </div>
                                          </div>

                                          <Badge variant="outline" className="text-[9px] font-bold shrink-0">
                                            {student.section?.name || 'Sec'}
                                          </Badge>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </ScrollArea>
                              )}
                              
                              <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase">
                                  Cohort Total: {expandedStudents.length} Students
                                </span>
                                <Button 
                                  variant="default" 
                                  className="h-10 rounded-xl font-bold text-xs px-6"
                                  onClick={() => setExpandedCohortId(null)}
                                >
                                  Done Selection
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ) : (
                        /* Cohort Grid Selection */
                        <motion.div
                          key="cohort-grid"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                                {promotionMode === 'bulk' ? "Select Cohorts for Promotion" : "Select Cohorts to Drilldown"}
                              </h2>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {promotionMode === 'bulk' 
                                  ? "Toggle class cards to select entire sections you want to advance."
                                  : "Choose a class card to select individual students inside."}
                              </p>
                            </div>
                            
                            <div className="relative w-full sm:w-72">
                              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input 
                                placeholder="Filter by grade or section..." 
                                className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 rounded-xl text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Grid lists: 1 col on mobile, 2 on sm, 3 on md, 4 on lg/desktop */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {isLoading ? (
                              Array(8).fill(0).map((_, i) => (
                                <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl border border-slate-200/60 dark:border-slate-800" />
                              ))
                            ) : filteredCohorts.length === 0 ? (
                              <div className="col-span-full py-16 text-center text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 font-medium text-xs">
                                No active cohorts found.
                              </div>
                            ) : filteredCohorts.map((cohort) => {
                              const isSelected = promotionMode === 'bulk' 
                                ? selectedCohortIds.has(cohort.id)
                                : (selectedStudentIds[cohort.id]?.size || 0) > 0
                              
                              const countSelected = selectedStudentIds[cohort.id]?.size || 0
                              
                              return (
                                <div 
                                  key={cohort.id} 
                                  className={cn(
                                    "relative p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer group flex flex-col justify-between h-36 select-none shadow-sm hover:shadow-md",
                                    isSelected 
                                      ? "border-primary ring-1 ring-primary shadow-md shadow-primary/5 bg-primary/[0.02]" 
                                      : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                  )}
                                  onClick={() => handleCohortClick(cohort)}
                                >
                                  <div>
                                    <div className="flex items-start justify-between">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-primary tracking-wide mb-0.5">
                                          {cohort.gradeName}
                                        </span>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                          Section {cohort.sectionName}
                                        </h3>
                                        {cohort.streamName && (
                                          <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 mt-0.5">
                                            {cohort.streamName}
                                          </span>
                                        )}
                                      </div>

                                      {/* Indicator */}
                                      <div className={cn(
                                        "w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                                        isSelected 
                                          ? "bg-primary text-white" 
                                          : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600"
                                      )}>
                                        {promotionMode === 'bulk' ? (
                                          isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Box className="w-4 h-4" />
                                        ) : (
                                          <ChevronRight className="w-5 h-5" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-slate-400" /> {cohort.count} Students
                                    </span>
                                    
                                    {promotionMode === 'selective' && isSelected && (
                                      <Badge variant="default" className="text-[10px] font-bold h-5 px-2">
                                        {countSelected} Selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          
                          {/* Selection summary statistics banner */}
                          <div className="p-4 bg-primary/5 rounded-xl border border-primary/15 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs font-bold text-primary">
                            <span>
                              {promotionMode === 'bulk' 
                                ? `${selectedCohortIds.size} Cohorts Marked for Promotion` 
                                : `${Object.keys(selectedStudentIds).filter(k => selectedStudentIds[k].size > 0).length} Cohorts Configured`
                              }
                            </span>
                            <span>
                              Total Ready: {promotionMode === 'bulk' ? totalSelectedInBulk : totalSelectedInSelective} Students
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* STEP 3: DESTINATION RULES */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                        <Filter className="w-5 h-5 text-primary" /> Destination Rules Mapping
                      </h2>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Configure target grades, mandatory streams, and target section names for advanced students.
                      </p>
                    </div>

                    <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl">
                      <CardContent className="p-6 divide-y divide-slate-100 dark:divide-slate-800">
                        {cohorts
                          .filter(c => activeCohortIds.includes(c.id))
                          .map((cohort) => {
                            const currentRule = promotionRules[cohort.id] || { gradeId: '', sectionName: '' }
                            const targetGrade = grades.find(g => g.id === currentRule.gradeId)
                            const targetGradeNum = targetGrade ? (parseInt((targetGrade.name || '').replace(/[^\d]/g, '')) || 0) : 0
                            
                            // Mandatory Stream is required if Target Grade is 11 or 12
                            const isStreamRequired = targetGradeNum >= 11
                            
                            return (
                              <div key={cohort.id} className="py-6 first:pt-0 last:pb-0 flex flex-col gap-4">
                                {/* Cohort Origin Detail */}
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                  <div>
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source Cohort</span>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2 leading-tight mt-0.5">
                                      {cohort.gradeName} - Sec {cohort.sectionName}
                                      {cohort.streamName && (
                                        <Badge variant="outline" className="text-[10px] font-bold text-violet-600 dark:text-violet-400 border-violet-500/25">
                                          {cohort.streamName}
                                        </Badge>
                                      )}
                                    </h4>
                                  </div>
                                  
                                  <Badge variant="secondary" className="self-start sm:self-center text-xs font-bold px-3 py-1">
                                    {promotionMode === 'bulk' ? cohort.count : selectedStudentIds[cohort.id]?.size} Students
                                  </Badge>
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {/* Destination Grade */}
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-0.5">Destination Grade</Label>
                                    <Select 
                                      value={currentRule.gradeId} 
                                      onValueChange={(val) => setPromotionRules(prev => ({ 
                                        ...prev, 
                                        [cohort.id]: { ...prev[cohort.id]!, gradeId: val } 
                                      }))}
                                    >
                                      <SelectTrigger className="w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 rounded-xl font-bold text-sm focus:ring-1 focus:ring-primary">
                                        <SelectValue placeholder="Select Grade" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {grades.map(g => (
                                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                        <SelectItem value="GRADUATE">🎓 Graduation / Complete</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Destination Stream (if target is Gr 11 or 12) */}
                                  {currentRule.gradeId !== 'GRADUATE' && isStreamRequired ? (
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold text-violet-600 dark:text-violet-400 ml-0.5">Stream (Preserved)</Label>
                                      {cohort.streamName ? (
                                        <div className="h-11 px-3 rounded-xl bg-violet-50/70 dark:bg-violet-900/20 border border-violet-200/80 dark:border-violet-800 flex items-center justify-between">
                                          <span className="font-bold text-sm text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                                            <ShieldCheck className="w-4 h-4 text-violet-600" />
                                            {cohort.streamName}
                                          </span>
                                          <Badge variant="outline" className="text-[9px] font-bold text-violet-600 border-violet-300">
                                            Locked
                                          </Badge>
                                        </div>
                                      ) : streams.length === 0 ? (
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">No streams configured</p>
                                          <p className="text-[10px] text-amber-700/70 dark:text-amber-300/60 mt-0.5">Type the stream name to assign for Grade 11:</p>
                                          <input
                                            className="mt-2 w-full h-9 px-3 text-xs font-bold rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-950 text-violet-700 dark:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            placeholder="e.g. Natural, Social Science..."
                                            value={currentRule.streamId || ''}
                                            onChange={(e) => {
                                              const typedVal = e.target.value
                                              setPromotionRules(prev => ({
                                                ...prev,
                                                [cohort.id]: { ...prev[cohort.id]!, streamId: typedVal }
                                              }))
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <Select 
                                          value={currentRule.streamId} 
                                          onValueChange={(val) => setPromotionRules(prev => ({ 
                                            ...prev, 
                                            [cohort.id]: { ...prev[cohort.id]!, streamId: val } 
                                          }))}
                                        >
                                          <SelectTrigger className="w-full bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/80 h-11 rounded-xl text-violet-750 dark:text-violet-400 font-bold shadow-sm text-sm">
                                            <SelectValue placeholder="Choose Stream" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {streams.map(s => (
                                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="hidden lg:block" />
                                  )}

                                  {/* Destination Section */}
                                  {currentRule.gradeId !== 'GRADUATE' && (
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-0.5">Target Section Name</Label>
                                      <Input 
                                        placeholder="e.g. A"
                                        className="h-11 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-bold"
                                        value={currentRule.sectionName}
                                        onChange={(e) => setPromotionRules(prev => ({
                                          ...prev,
                                          [cohort.id]: { ...prev[cohort.id]!, sectionName: e.target.value }
                                        }))}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* STEP 4: REVIEW & EXECUTE */}
                {currentStep === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 rounded-2xl border border-primary/15 flex items-start gap-4">
                      <div className="p-3 bg-primary text-white rounded-xl shadow-md shadow-primary/10 shrink-0">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                          Review Promotion Parameters
                        </h2>
                        <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                          Transition: <span className="text-slate-700 dark:text-slate-300 font-bold">{fromAcademicYear || 'Current'}</span> → <span className="text-primary font-bold">{toAcademicYear}</span> • Mode: <span className="text-primary font-bold uppercase">{promotionMode}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Left: Summary cards list */}
                      <div className="md:col-span-2 space-y-4">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                           <Box className="w-4 h-4" /> Target Cohort Breakdown
                        </h3>
                        
                        <div className="space-y-3">
                          {cohorts
                            .filter(c => activeCohortIds.includes(c.id))
                            .map(cohort => {
                              const rule = promotionRules[cohort.id]
                              const targetGrade = grades.find(g => g.id === rule?.gradeId)
                              const targetStream = streams.find(s => s.id === rule?.streamId)
                              const count = promotionMode === 'bulk' ? cohort.count : selectedStudentIds[cohort.id]?.size
                              
                              return (
                                <div key={cohort.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 gap-3">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                      {cohort.gradeName} - Sec {cohort.sectionName}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <span className="text-xs text-slate-400 font-medium">Destination:</span>
                                      <span className="text-xs font-bold text-primary">
                                        {rule?.gradeId === 'GRADUATE' ? '🎓 Graduation' : `${targetGrade?.name} (Sec ${rule?.sectionName || cohort.sectionName})`}
                                      </span>
                                      {rule?.gradeId !== 'GRADUATE' && targetStream && (
                                        <Badge variant="outline" className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 border-violet-500/20 px-2">
                                          {targetStream.name}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="default" className="text-xs font-bold h-7 px-3.5 self-start sm:self-center">
                                    {count} students
                                  </Badge>
                                </div>
                              )
                            })}
                        </div>
                      </div>

                      {/* Right: Warnings and Stats summary */}
                      <div className="space-y-6">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                           Summary Figures
                        </h3>

                        {/* Student Count Panel */}
                        <div className="p-6 bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-2xl text-center shadow-sm flex flex-col justify-center items-center">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Selected Students</span>
                          <span className="text-4xl font-bold text-white tracking-tight leading-none mb-1">
                            {promotionMode === 'bulk' ? totalSelectedInBulk : totalSelectedInSelective}
                          </span>
                          <span className="text-xs font-semibold text-primary">Ready for advancement</span>
                        </div>

                        {/* Attention warning banner */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl flex gap-3 items-start">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-sm text-amber-900 dark:text-amber-400 leading-tight">Attention</p>
                            <p className="text-xs text-amber-800/80 dark:text-amber-300/70 leading-relaxed font-medium">
                              This action will update student grade and section records immediately. Individual promotions can be rolled back in the Audit Trail if needed.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* WIZARD ACTION BAR */}
            <div className="pt-6 mt-6 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-center gap-4">
              {currentStep > 1 ? (
                <Button 
                  variant="outline" 
                  onClick={handleBack} 
                  className="h-11 md:h-12 rounded-xl font-bold px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-sm"
                >
                  Back
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button 
                  onClick={handleNext} 
                  disabled={isNextDisabled}
                  className="h-11 md:h-12 rounded-xl text-sm font-bold px-8 shadow-sm transition-all"
                >
                  Next Step <ChevronRight className="w-4 h-4 ml-1.5" />
                </Button>
              ) : (
                <Button 
                  onClick={executePromotion} 
                  disabled={isSubmitLoading || !isConfigurationComplete}
                  className="h-11 md:h-12 rounded-xl text-sm font-bold px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                >
                  {isSubmitLoading ? "Advancing Students..." : "Confirm & Execute"}
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          /* AUDIT TRAIL LOGS VIEW */
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">Audit Trail</CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">Historical promotion records for the academic year.</CardDescription>
                </div>
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" className="gap-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs">
                      <Download className="w-4 h-4" /> Export logs
                   </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <TableRow className="border-slate-200/80 dark:border-slate-800">
                        <TableHead className="font-semibold">Student Record</TableHead>
                        <TableHead className="font-semibold">Academic Year</TableHead>
                        <TableHead className="font-semibold">Transition</TableHead>
                        <TableHead className="font-semibold">Timestamp</TableHead>
                        <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-64 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                              <History className="w-10 h-10 opacity-30" />
                              <p className="font-bold text-xs uppercase tracking-wider text-slate-400">No promotion records found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : history.map((h) => (
                        <TableRow key={h.id} className="border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                          <TableCell className="py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">{h.student?.fullName || 'Unknown Student'}</span>
                              <span className="text-xs text-slate-400 font-mono">ID: {h.student?.student_id || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50/50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-500/20 font-bold text-[10px]">
                              {h.academicYear}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-slate-500">{cohorts.find(c => c.gradeId === h.fromGradeId)?.gradeName || 'Prev'}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-primary" />
                              {h.toGradeId ? (
                                <span className="font-bold text-primary">{cohorts.find(c => c.gradeId === h.toGradeId)?.gradeName || 'Next'}</span>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold text-[10px]">Graduated</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-400 whitespace-nowrap">
                            {formatDateTime(h.promotedAt)}
                          </TableCell>
                          <TableCell className="text-right px-6 whitespace-nowrap">
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                className="rounded-xl font-bold text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={() => handleRollback(h.id)}
                             >
                                <Undo2 className="w-4 h-4 mr-1" /> Rollback
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog for Target Academic Year */}
      <Dialog open={isFutureConfirmOpen} onOpenChange={setIsFutureConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg font-bold text-slate-900 dark:text-white">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              Confirm Academic Year: {toAcademicYear}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-medium">
              You are setting <span className="font-bold text-primary">{toAcademicYear}</span> as the target academic year. Please confirm to proceed with student promotion for this academic year.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsFutureConfirmOpen(false)}
              className="rounded-xl text-xs font-bold h-10 px-4 border-slate-200 dark:border-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsFutureConfirmOpen(false)
                setCurrentStep(2)
              }}
              className="rounded-xl text-xs font-bold h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Confirm & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  )
}

