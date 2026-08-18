"use client"

import { useState, useEffect } from "react"
import { Search, Calendar, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { DualDatePicker } from "@/components/ui/dual-date-picker"

interface FiltersProps {
  onFilterChange: (filters: any) => void
  initialFilters?: any
  attendanceMode?: 'daily' | 'session' | 'session_based'
  hideSession?: boolean
}

export function AttendanceFilters({ onFilterChange, initialFilters = {}, attendanceMode = 'session_based', hideSession = false }: FiltersProps) {
  const [grades, setGrades] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [streams, setStreams] = useState<string[]>([])
  const [academicYears, setAcademicYears] = useState<string[]>([])
  
  const [filters, setFilters] = useState({
    grade: initialFilters.grade || "all",
    section: initialFilters.section || "all",
    stream: initialFilters.stream || "all",
    academicYear: initialFilters.academicYear || new Date().getFullYear().toString(),
    startDate: initialFilters.startDate || "",
    endDate: initialFilters.endDate || "",
    session: initialFilters.session || "total",
    search: initialFilters.search || ""
  })

  useEffect(() => {
    loadFilterOptions()
  }, [])

  const loadFilterOptions = async () => {
    try {
      const students = await db.getStudents(false, "ACTIVE")
      const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean).sort()
      const uniqueSections = [...new Set(students.map(s => s.section))].filter(Boolean).sort()
      const uniqueStreams = [...new Set(students.map(s => s.stream))]
        .filter(s => s && !/^general$/i.test(s.toString().trim()))
        .sort() as string[]
      
      setGrades(uniqueGrades as string[])
      setSections(uniqueSections as string[])
      setStreams(uniqueStreams as string[])
      
      const currentYear = new Date().getFullYear()
      setAcademicYears([currentYear.toString(), (currentYear - 1).toString()])
    } catch (error) {
      console.error("Error loading filter options:", error)
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    let newFilters = { ...filters, [key]: value }
    
    // If grade changes, reset section and stream
    if (key === 'grade') {
      newFilters.section = 'all'
      newFilters.stream = 'all'
      
      // If Grade 11 or 12 is selected, pick first stream if mandatory
      if (value === 'Grade 11' || value === 'Grade 12') {
        if (streams.length > 0) {
          newFilters.stream = streams[0]
        }
      }
    }
    
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const resetFilters = () => {
    const reset = {
      grade: "all",
      section: "all",
      stream: "all",
      academicYear: new Date().getFullYear().toString(),
      startDate: "",
      endDate: "",
      session: "total",
      search: ""
    }
    setFilters(reset)
    onFilterChange(reset)
  }

  return (
    <div className="space-y-4 p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px] group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search grade or section..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="pl-10 h-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary/20"
          />
        </div>

        <Select value={filters.grade} onValueChange={(val) => handleFilterChange("grade", val)}>
          <SelectTrigger className="w-[140px] h-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        {(filters.grade === 'all' || filters.grade === 'Grade 11' || filters.grade === 'Grade 12') && (
          <Select 
            value={filters.stream} 
            onValueChange={(val) => handleFilterChange("stream", val)}
          >
            <SelectTrigger className={`w-[140px] h-10 border-slate-200 dark:border-slate-700 rounded-xl ${filters.grade === 'all' ? 'opacity-70 bg-slate-50 dark:bg-slate-800/50' : 'bg-white/95 dark:bg-slate-800/90'}`}>
              <SelectValue placeholder="Stream" />
            </SelectTrigger>
            <SelectContent>
              {filters.grade === 'all' && <SelectItem value="all">All Streams</SelectItem>}
              {streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select 
          value={filters.section} 
          onValueChange={(val) => handleFilterChange("section", val)}
        >
          <SelectTrigger className={`w-[140px] h-10 border-slate-200 dark:border-slate-700 rounded-xl ${filters.grade === 'all' ? 'opacity-70 bg-slate-50 dark:bg-slate-800/50' : 'bg-white/95 dark:bg-slate-800/90'}`}>
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {(attendanceMode === 'session' || attendanceMode === 'session_based') && !hideSession && (
          <Select value={filters.session} onValueChange={(val) => handleFilterChange("session", val)}>
            <SelectTrigger className="w-[140px] h-10 bg-white/95 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 rounded-xl">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Full Day</SelectItem>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-wrap items-center gap-2 bg-white/95 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
          <DualDatePicker
            value={filters.startDate}
            onChange={(val) => handleFilterChange("startDate", val)}
            className="typography-helper h-9 w-36 border-none bg-transparent"
          />
          <span className="typography-helper text-muted-foreground font-semibold px-1">to</span>
          <DualDatePicker
            value={filters.endDate}
            onChange={(val) => handleFilterChange("endDate", val)}
            className="typography-helper h-9 w-36 border-none bg-transparent"
          />
        </div>

        <Button 
          variant="outline" 
          size="icon" 
          onClick={resetFilters}
          className="h-10 w-10 rounded-xl border-slate-200 dark:border-slate-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
