'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Calendar as CalendarIcon, 
  Plus, 
  CheckCircle2, 
  Pencil, 
  Trash2, 
  CalendarDays,
  ShieldCheck,
  Globe
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Checkbox } from "@/components/ui/checkbox"
import { notifications } from '@/lib/utils/notifications'
import { getApiUrl } from '@/lib/api-config'
import { useCalendar } from '@/lib/context/calendar-context'
import { DualDatePicker } from '@/components/ui/dual-date-picker'
import { toEthiopianDate } from '@/lib/utils/ethiopian-calendar'

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

// Converts a Gregorian YYYY-MM-DD string to Ethiopian Year number
function gcToECYear(isoDate: string): number | null {
  try {
    const ec = toEthiopianDate(isoDate)
    return ec.year
  } catch { return null }
}

export function AcademicYearManagementTab() {
  const { calendarPreference, formatDate } = useCalendar()
  const isEthiopian = calendarPreference === 'ethiopian'

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null)

  // Form State
  const [formName, setFormName] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formIsCurrent, setFormIsCurrent] = useState(false)

  // Live preview: what the name auto-suggestion is based on selected start date + calendar mode
  const autoSuggestName = useMemo(() => {
    if (!formStartDate) return ''
    if (isEthiopian) {
      const ecYear = gcToECYear(formStartDate)
      if (ecYear) return `${ecYear} E.C.`
    } else {
      const gcYear = parseInt(formStartDate.split('-')[0], 10)
      if (gcYear) return `${gcYear}/${gcYear + 1}`
    }
    return ''
  }, [formStartDate, isEthiopian])

  const headers = useMemo(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null
    const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null
    return {
      'Authorization': `Bearer ${token}`,
      'x-school-id': schoolId || '',
      'Content-Type': 'application/json'
    }
  }, [])

  const loadAcademicYears = async () => {
    setIsLoading(true)
    try {
      const endpoint = `${getApiUrl()}/api/academic-years`
      const res = await fetch(endpoint, { headers: headers as any })
      const contentType = res.headers.get('content-type') || ''

      if (res.ok && contentType.includes('application/json')) {
        const result = await res.json()
        setAcademicYears(result.data || [])
      }
    } catch (error: any) {
      console.error("Failed to fetch academic years:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAcademicYears()
  }, [])

  const activeYear = useMemo(() => {
    return academicYears.find(y => y.isCurrent) || null
  }, [academicYears])

  const resetForm = () => {
    setFormName("")
    setFormStartDate("")
    setFormEndDate("")
    setFormIsCurrent(false)
    setSelectedYear(null)
  }

  /**
   * handleOpenCreate — auto-populates form defaults calendar-aware:
   * Ethiopian: Sep 11 → Jul 7 (GC equivalents of Meskerem 1 → Sene 30)
   * Gregorian: Sep 1 → Aug 31
   */
  const handleOpenCreate = () => {
    resetForm()
    const now = new Date()
    const gcYear = now.getFullYear()

    if (isEthiopian) {
      // Ethiopian new year starts Sep 11 (GC) = Meskerem 1 (EC)
      const startGC = `${gcYear}-09-11`
      const endGC = `${gcYear + 1}-07-07`
      const ecYear = gcToECYear(startGC)
      setFormStartDate(startGC)
      setFormEndDate(endGC)
      setFormName(ecYear ? `${ecYear} E.C.` : '')
    } else {
      const startGC = `${gcYear}-09-01`
      const endGC = `${gcYear + 1}-08-31`
      setFormStartDate(startGC)
      setFormEndDate(endGC)
      setFormName(`${gcYear}/${gcYear + 1}`)
    }

    setFormIsCurrent(academicYears.length === 0)
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (year: AcademicYear) => {
    setSelectedYear(year)
    setFormName(year.name)
    setFormStartDate(year.startDate ? year.startDate.split('T')[0] : '')
    setFormEndDate(year.endDate ? year.endDate.split('T')[0] : '')
    setFormIsCurrent(year.isCurrent)
    setIsEditOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formStartDate || !formEndDate) {
      notifications.warning("Missing Fields", "Please complete all required fields.")
      return
    }

    setIsSubmitLoading(true)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years`, {
        method: 'POST',
        headers: headers as any,
        body: JSON.stringify({
          name: formName.trim(),
          startDate: formStartDate,
          endDate: formEndDate,
          isCurrent: formIsCurrent
        })
      })

      if (res.ok) {
        notifications.success("Success", "Academic year created successfully")
        setIsCreateOpen(false)
        resetForm()
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || "Failed to create academic year")
      }
    } catch (error: any) {
      notifications.error("Error", error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedYear) return

    setIsSubmitLoading(true)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/${selectedYear.id}`, {
        method: 'PUT',
        headers: headers as any,
        body: JSON.stringify({
          name: formName.trim(),
          startDate: formStartDate,
          endDate: formEndDate,
          isCurrent: formIsCurrent
        })
      })

      if (res.ok) {
        notifications.success("Success", "Academic year updated successfully")
        setIsEditOpen(false)
        resetForm()
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || "Failed to update academic year")
      }
    } catch (error: any) {
      notifications.error("Error", error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleActivate = async (year: AcademicYear) => {
    if (year.isCurrent) return
    if (!confirm(`Are you sure you want to set "${year.name}" as the ACTIVE academic year for your school? This will deactivate any previously active academic year.`)) return

    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/${year.id}/activate`, {
        method: 'POST',
        headers: headers as any
      })

      if (res.ok) {
        notifications.success("Academic Year Activated", `"${year.name}" is now the active academic year.`)
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || "Activation failed")
      }
    } catch (error: any) {
      notifications.error("Error", error.message)
    }
  }

  const handleDelete = async (year: AcademicYear) => {
    if (year.isCurrent) {
      notifications.warning("Action Blocked", "Cannot delete the active academic year. Activate another academic year first.")
      return
    }

    if (!confirm(`Are you sure you want to delete academic year "${year.name}"?`)) return

    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/${year.id}`, {
        method: 'DELETE',
        headers: headers as any
      })

      if (res.ok) {
        notifications.success("Success", "Academic year deleted successfully")
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || "Delete failed")
      }
    } catch (error: any) {
      notifications.error("Error", error.message)
    }
  }

  /** Calendar-aware date formatter for table cells */
  const displayDate = (isoString: string | null | undefined): string => {
    if (!isoString) return '-'
    try {
      return formatDate(isoString, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString.split('T')[0]
    }
  }

  const calendarLabel = isEthiopian ? 'Ethiopian Calendar (E.C.)' : 'Gregorian Calendar (G.C.)'
  const startDateLabel = isEthiopian ? 'Start Date (Gregorian / GC)' : 'Start Date'
  const endDateLabel = isEthiopian ? 'End Date (Gregorian / GC)' : 'End Date'
  const namePlaceholder = isEthiopian ? 'e.g. 2016 E.C. or 2016/2017 E.C.' : 'e.g. 2025/2026 or 2025'

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-2xl">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" /> Academic Year Setup
              </CardTitle>
              {/* Calendar mode indicator */}
              <Badge variant="outline" className={`font-bold text-[10px] px-2.5 py-1 flex items-center gap-1.5 ${
                isEthiopian
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
              }`}>
                <Globe className="w-3 h-3" />
                {isEthiopian ? 'EC Mode' : 'GC Mode'}
              </Badge>
              {activeYear && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs px-3 py-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active: {activeYear.name}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Configure structured academic years for enrollment, attendance, promotions, and reports.
              {' '}<span className={`font-semibold ${isEthiopian ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                Displaying dates in {calendarLabel}.
              </span>
            </CardDescription>
          </div>

          <Button 
            onClick={handleOpenCreate}
            className="h-10 rounded-xl font-bold text-xs gap-2 px-4 shadow-sm bg-primary hover:bg-primary/90 text-white shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Academic Year
          </Button>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <TableRow className="border-slate-200/80 dark:border-slate-800">
                  <TableHead className="font-semibold">Academic Year Label</TableHead>
                  <TableHead className="font-semibold">
                    Start Date
                    <span className={`ml-1 text-[9px] font-bold ${isEthiopian ? 'text-amber-500' : 'text-blue-500'}`}>
                      ({isEthiopian ? 'EC' : 'GC'})
                    </span>
                  </TableHead>
                  <TableHead className="font-semibold">
                    End Date
                    <span className={`ml-1 text-[9px] font-bold ${isEthiopian ? 'text-amber-500' : 'text-blue-500'}`}>
                      ({isEthiopian ? 'EC' : 'GC'})
                    </span>
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center">
                      <div className="flex items-center justify-center">
                        <Spinner size="md" className="text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : academicYears.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                        <CalendarIcon className="w-9 h-9 opacity-30" />
                        <p className="font-bold text-xs uppercase tracking-wider text-slate-400">No academic years configured</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : academicYears.map((year) => (
                  <TableRow key={year.id} className="border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {year.name}
                        </span>
                        {year.isCurrent && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-[10px] px-2">
                            Current Active
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {displayDate(year.startDate)}
                    </TableCell>

                    <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {displayDate(year.endDate)}
                    </TableCell>

                    <TableCell>
                      {year.isCurrent ? (
                        <Badge variant="default" className="bg-emerald-600 text-white font-bold text-[10px]">
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-bold text-[10px] text-slate-500">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right px-6 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {!year.isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActivate(year)}
                            className="h-8 rounded-lg font-bold text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Activate
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(year)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!year.isCurrent && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(year)}
                            className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg font-bold text-slate-900 dark:text-white">
              <CalendarIcon className="w-5 h-5 text-primary" /> Create Academic Year
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add a new structured academic year record for your school.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Academic Year Label / Name
                </Label>
                {autoSuggestName && formName !== autoSuggestName && (
                  <button
                    type="button"
                    onClick={() => setFormName(autoSuggestName)}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    Use suggestion: {autoSuggestName}
                  </button>
                )}
              </div>
              <Input 
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={namePlaceholder}
                className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {startDateLabel}
                </Label>
                <DualDatePicker
                  id="create-start-date"
                  value={formStartDate}
                  onChange={(val) => {
                    setFormStartDate(val)
                    // Auto-suggest name if it hasn't been manually changed or matches suggestion
                    const suggestion = isEthiopian
                      ? (() => { const y = gcToECYear(val); return y ? `${y} E.C.` : '' })()
                      : (() => { const y = parseInt(val.split('-')[0], 10); return y ? `${y}/${y + 1}` : '' })()
                    if (!formName || formName === autoSuggestName) {
                      setFormName(suggestion)
                    }
                  }}
                  placeholder={isEthiopian ? 'የጀምሮ ቀን' : 'Start date'}
                  className="rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {endDateLabel}
                </Label>
                <DualDatePicker
                  id="create-end-date"
                  value={formEndDate}
                  onChange={setFormEndDate}
                  placeholder={isEthiopian ? 'የሚጠናቀቅ ቀን' : 'End date'}
                  className="rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox 
                id="createIsCurrentTab"
                checked={formIsCurrent}
                onCheckedChange={(checked) => setFormIsCurrent(Boolean(checked))}
              />
              <label htmlFor="createIsCurrentTab" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Set as Active Academic Year
              </label>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-xl text-xs font-bold h-10 px-4 border-slate-200 dark:border-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitLoading}
                className="rounded-xl text-xs font-bold h-10 px-5 bg-primary text-white"
              >
                {isSubmitLoading ? "Saving..." : "Create Academic Year"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg font-bold text-slate-900 dark:text-white">
              <Pencil className="w-5 h-5 text-primary" /> Edit Academic Year
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Update academic year label, start/end dates, or active status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Academic Year Label / Name
              </Label>
              <Input 
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={namePlaceholder}
                className="h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {startDateLabel}
                </Label>
                <DualDatePicker
                  id="edit-start-date"
                  value={formStartDate}
                  onChange={setFormStartDate}
                  placeholder={isEthiopian ? 'የጀምሮ ቀን' : 'Start date'}
                  className="rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {endDateLabel}
                </Label>
                <DualDatePicker
                  id="edit-end-date"
                  value={formEndDate}
                  onChange={setFormEndDate}
                  placeholder={isEthiopian ? 'የሚጠናቀቅ ቀን' : 'End date'}
                  className="rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox 
                id="editIsCurrentTab"
                checked={formIsCurrent}
                onCheckedChange={(checked) => setFormIsCurrent(Boolean(checked))}
              />
              <label htmlFor="editIsCurrentTab" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Set as Active Academic Year
              </label>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl text-xs font-bold h-10 px-4 border-slate-200 dark:border-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitLoading}
                className="rounded-xl text-xs font-bold h-10 px-5 bg-primary text-white"
              >
                {isSubmitLoading ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
