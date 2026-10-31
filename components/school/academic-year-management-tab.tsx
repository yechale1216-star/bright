'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  CalendarDays,
  ShieldCheck,
  Globe,
  Lock,
  Clock3,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Layers,
  History,
  Archive,
  Eye,
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
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notifications } from '@/lib/utils/notifications'
import { db } from '@/lib/db/database'
import { getApiUrl } from '@/lib/api-config'
import { useCalendar } from '@/lib/context/calendar-context'
import { DualDatePicker } from '@/components/ui/dual-date-picker'
import { toEthiopianDate } from '@/lib/utils/ethiopian-calendar'
import { cn } from '@/lib/utils/utils'

export type AcademicYearStatus = 'FUTURE' | 'ACTIVE' | 'CLOSED'

export interface AcademicTerm {
  id: string
  academicYearId: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  status: AcademicYearStatus
  createdAt: string
  updatedAt: string
  terms?: AcademicTerm[]
}

function gcToECYear(isoDate: string): number | null {
  try {
    const ec = toEthiopianDate(isoDate)
    return ec.year
  } catch { return null }
}

function StatusBadge({ status, isCurrent }: { status?: AcademicYearStatus; isCurrent: boolean }) {
  const effective: AcademicYearStatus = status || (isCurrent ? 'ACTIVE' : 'FUTURE')
  switch (effective) {
    case 'ACTIVE':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-extrabold text-[10px] px-2.5 py-0.5 flex items-center gap-1.5 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ACTIVE
        </Badge>
      )
    case 'CLOSED':
      return (
        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-bold text-[10px] px-2.5 py-0.5 flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          CLOSED
        </Badge>
      )
    default:
      return (
        <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-[10px] px-2.5 py-0.5 flex items-center gap-1.5">
          <Clock3 className="w-3 h-3 text-blue-500" />
          FUTURE
        </Badge>
      )
  }
}

// ─── Academic Terms Management (Dedicated Tab) ────────────────────────────────

function AcademicTermsSection({ year, onTermsChanged }: { year: AcademicYear; onTermsChanged?: () => void }) {
  const isClosed = year.status === 'CLOSED'
  const isFuture = year.status === 'FUTURE'
  const isActive = year.status === 'ACTIVE' || year.isCurrent

  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formIsCurrent, setFormIsCurrent] = useState(false)
  const { formatDate } = useCalendar()

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await db.getTerms(year.id)
      setTerms(data || [])
    } catch (e: any) {
      console.error("Failed to load terms:", e)
    } finally {
      setIsLoading(false)
    }
  }, [year.id])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    if (isClosed) {
      notifications.warning("Read-Only", "Cannot add terms to a closed academic year. Historical records are locked.")
      return
    }
    setEditingTerm(null)
    setFormName("")
    setFormStartDate(year.startDate ? year.startDate.split("T")[0] : "")
    setFormEndDate(year.endDate ? year.endDate.split("T")[0] : "")
    setFormIsCurrent(false)
    setIsOpen(true)
  }

  const openEdit = (t: AcademicTerm) => {
    if (isClosed) {
      notifications.warning("Read-Only", "Cannot edit terms of a closed academic year. Historical records are locked.")
      return
    }
    setEditingTerm(t)
    setFormName(t.name)
    setFormStartDate(t.startDate ? t.startDate.split("T")[0] : "")
    setFormEndDate(t.endDate ? t.endDate.split("T")[0] : "")
    setFormIsCurrent(t.isCurrent)
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (isClosed) {
      notifications.warning("Read-Only", "Closed academic years cannot be modified.")
      return
    }
    if (!formName.trim() || !formStartDate || !formEndDate) {
      notifications.error("Validation", "Name, Start Date, and End Date are required.")
      return
    }
    try {
      setIsSaving(true)
      if (editingTerm) {
        await db.updateTerm(editingTerm.id, {
          name: formName.trim(), startDate: formStartDate, endDate: formEndDate, isCurrent: formIsCurrent,
        })
        notifications.success("Updated", `Term "${formName.trim()}" updated.`)
      } else {
        await db.createTerm(year.id, {
          name: formName.trim(), startDate: formStartDate, endDate: formEndDate, isCurrent: formIsCurrent,
        })
        notifications.success("Created", `Term "${formName.trim()}" added.`)
      }
      setIsOpen(false)
      await load()
      onTermsChanged?.()
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (isClosed) {
      notifications.warning("Read-Only", "Closed academic year terms cannot be deleted.")
      return
    }
    if (!confirm(`Are you sure you want to delete term "${name}"?`)) return
    try {
      setDeletingId(id)
      await db.deleteTerm(id)
      notifications.success("Deleted", `Term "${name}" removed.`)
      await load()
      onTermsChanged?.()
    } catch (e: any) {
      notifications.error("Cannot Delete", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetCurrentTerm = async (t: AcademicTerm) => {
    if (isClosed) {
      notifications.warning("Read-Only", "Cannot change active term in a closed academic year.")
      return
    }
    try {
      setSettingActiveId(t.id)
      await db.updateTerm(t.id, { isCurrent: true })
      notifications.success("Active Term Set", `"${t.name}" is now the active term for mark entry.`)
      await load()
      onTermsChanged?.()
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setSettingActiveId(null)
    }
  }

  const displayDate = (isoString: string | null | undefined): string => {
    if (!isoString) return '-'
    try {
      return formatDate(isoString, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString.split('T')[0]
    }
  }

  return (
    <div className="pl-4 border-l-2 border-border/50 mt-3 space-y-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          Terms / Semesters ({terms.length})
          {isClosed && (
            <Badge variant="outline" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 normal-case px-2 py-0">
              <Lock className="w-2.5 h-2.5 mr-1" /> Read-only archive
            </Badge>
          )}
          {isActive && !isClosed && (
            <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 normal-case px-2 py-0">
              Live Operating Year
            </Badge>
          )}
          {isFuture && !isClosed && (
            <Badge variant="outline" className="text-[10px] font-bold text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 normal-case px-2 py-0">
              Future Preparation
            </Badge>
          )}
        </span>
        {!isClosed && (
          <Button onClick={openCreate} size="sm" variant="outline" className="rounded-xl h-7 gap-1 text-[11px] font-bold border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="w-3 h-3" /> Add Term
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-4 flex justify-center"><Spinner className="w-4 h-4 text-primary" /></div>
      ) : terms.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-muted/20">
          {isClosed
            ? "No terms were recorded for this closed academic year."
            : 'No terms configured yet. Click "Add Term" to set up semesters or quarters for this academic year.'}
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-200 group",
                t.isCurrent
                  ? "bg-primary/10 border-primary/30 text-primary font-bold shadow-2xs"
                  : "bg-card border-border/60 hover:bg-muted/40 text-foreground",
                (deletingId === t.id || settingActiveId === t.id) && "opacity-40 pointer-events-none"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs truncate">{t.name}</span>
                  {t.isCurrent && (
                    <Badge className="text-[9px] font-black uppercase tracking-wider rounded-full bg-primary text-white px-2 py-0 h-4 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                  {displayDate(t.startDate)} – {displayDate(t.endDate)}
                </div>
              </div>

              {!isClosed ? (
                <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  {!t.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetCurrentTerm(t)}
                      className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                      title="Set as currently active term for mark entry"
                    >
                      Set Active
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" title="Edit term">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id, t.name)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10" title="Delete term">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  <Lock className="w-3 h-3" /> Locked
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-card border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-base flex items-center gap-2">
              {editingTerm ? <Pencil className="w-4 h-4 text-primary" /> : <Layers className="w-4 h-4 text-primary" />}
              {editingTerm ? "Edit Term" : "Add Term"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingTerm ? `Modify details for "${editingTerm.name}" in "${year.name}"` : `Add a semester, quarter, or term to "${year.name}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Term Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Semester 1, Term 1, Q1" className="rounded-xl font-bold text-sm h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Start Date *</Label>
                <DualDatePicker
                  id="academic-terms-start"
                  value={formStartDate}
                  onChange={setFormStartDate}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">End Date *</Label>
                <DualDatePicker
                  id="academic-terms-end"
                  value={formEndDate}
                  onChange={setFormEndDate}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/40">
              <div>
                <div className="text-xs font-bold text-foreground">Set as Active Term</div>
                <div className="text-[11px] text-muted-foreground">Marks this as the currently active term for mark entry</div>
              </div>
              <Switch checked={formIsCurrent} onCheckedChange={setFormIsCurrent} />
            </div>
          </div>
          <DialogFooter className="pt-4 flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">Cancel</Button>
            <Button disabled={isSaving} onClick={handleSave} className="rounded-xl bg-primary text-white text-xs font-bold h-10 px-5">
              {isSaving ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
              {editingTerm ? "Save Changes" : "Add Term"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AcademicYearsWithTermsSection({ years, onTermsChanged }: { years: AcademicYear[]; onTermsChanged?: () => void }) {
  const [expandedYearId, setExpandedYearId] = useState<string | null>(null)

  useEffect(() => {
    const current = years.find((y) => y.isCurrent)
    if (current && !expandedYearId) {
      setExpandedYearId(current.id)
    }
  }, [years, expandedYearId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div>
          <div className="font-black text-base text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Terms & Semesters Management
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Select an academic year below to configure its semesters, trimesters, or quarters.
          </div>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-muted/10">
          No academic years found. Configure an academic year first in the Academic Years tab.
        </div>
      ) : (
        <div className="space-y-3">
          {years.map((y) => {
            const isExpanded = expandedYearId === y.id
            const effectiveStatus = y.status || (y.isCurrent ? 'ACTIVE' : 'FUTURE')
            const isClosed = effectiveStatus === 'CLOSED'
            const isActive = effectiveStatus === 'ACTIVE'
            const isFuture = effectiveStatus === 'FUTURE'

            return (
              <div
                key={y.id}
                className={cn(
                  "rounded-2xl border transition-all duration-200 overflow-hidden",
                  isActive
                    ? "border-emerald-500/40 bg-card shadow-xs ring-1 ring-emerald-500/20"
                    : isClosed
                    ? "border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 opacity-90"
                    : "border-border/60 bg-card/60 hover:border-border"
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedYearId(isExpanded ? null : y.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : isClosed
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    )}>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-foreground">{y.name}</span>
                        {isActive && (
                          <Badge className="text-[10px] font-black uppercase tracking-wider rounded-full bg-emerald-600 text-white px-2 py-0 h-4 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Active
                          </Badge>
                        )}
                        {isClosed && (
                          <Badge variant="outline" className="text-[10px] font-bold rounded-full text-slate-500 border-slate-300 dark:border-slate-700 px-2 py-0 h-4 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            Closed (Read-Only)
                          </Badge>
                        )}
                        {isFuture && (
                          <Badge variant="outline" className="text-[10px] font-bold rounded-full text-blue-600 border-blue-200 dark:border-blue-800 px-2 py-0 h-4 flex items-center gap-1">
                            <Clock3 className="w-2.5 h-2.5" />
                            Future Preparation
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {displayDate(y.startDate)} – {displayDate(y.endDate)}
                        {isClosed && <span className="ml-1 text-slate-400 dark:text-slate-500">• Historical archive locked</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {isClosed ? 'View Terms' : isExpanded ? 'Hide Terms' : 'Manage Terms'}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-extrabold px-1.5 py-0 h-4 rounded-md">
                      {y.terms?.length ?? 0}
                    </Badge>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/40 bg-muted/10">
                    <AcademicTermsSection year={{ ...y, status: effectiveStatus }} onTermsChanged={onTermsChanged} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AcademicYearManagementTab() {
  const { calendarPreference, formatDate } = useCalendar()
  const isEthiopian = calendarPreference === 'ethiopian'

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'ACTIVE' | 'FUTURE' | 'CLOSED'>('ALL')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isActivateOpen, setIsActivateOpen] = useState(false)
  const [isCloseOpen, setIsCloseOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null)
  const [closeConfirmName, setCloseConfirmName] = useState('')

  // Term Modal state
  const [isCreateTermOpen, setIsCreateTermOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null)
  const [termFormYearId, setTermFormYearId] = useState('')
  const [termFormYearName, setTermFormYearName] = useState('')
  const [termFormName, setTermFormName] = useState('')
  const [termFormStartDate, setTermFormStartDate] = useState('')
  const [termFormEndDate, setTermFormEndDate] = useState('')
  const [termFormIsCurrent, setTermFormIsCurrent] = useState(false)
  const [deletingTermId, setDeletingTermId] = useState<string | null>(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')

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
      'Content-Type': 'application/json',
    }
  }, [])

  const loadAcademicYears = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years`, { headers: headers as any })
      if (res.ok) {
        const result = await res.json()
        const rawList = Array.isArray(result) ? result : result.data || []
        const years: AcademicYear[] = rawList.map((y: any) => ({
          ...y,
          status: y.status || (y.isCurrent ? 'ACTIVE' : 'FUTURE'),
        }))
        setAcademicYears(years)
      }
    } catch (error) {
      console.error('Failed to fetch academic years:', error)
    } finally {
      setIsLoading(false)
    }
  }, [headers])

  useEffect(() => {
    loadAcademicYears()
  }, [loadAcademicYears])

  const activeYear = useMemo(() => academicYears.find(y => (y.status === 'ACTIVE' || y.isCurrent) && y.status !== 'CLOSED') || null, [academicYears])
  const futureYears = useMemo(() => academicYears.filter(y => (y.status || 'FUTURE') === 'FUTURE' && !y.isCurrent), [academicYears])
  const closedYears = useMemo(() => academicYears.filter(y => y.status === 'CLOSED'), [academicYears])

  const filteredYears = useMemo(() => {
    if (activeTabFilter === 'ACTIVE') return activeYear ? [activeYear] : []
    if (activeTabFilter === 'FUTURE') return futureYears
    if (activeTabFilter === 'CLOSED') return closedYears
    return academicYears
  }, [activeTabFilter, activeYear, futureYears, closedYears, academicYears])

  const resetForm = () => {
    setFormName('')
    setFormStartDate('')
    setFormEndDate('')
    setSelectedYear(null)
    setCloseConfirmName('')
  }

  const handleOpenCreate = () => {
    resetForm()
    const now = new Date()
    const gcYear = now.getFullYear()
    if (isEthiopian) {
      const startGC = `${gcYear}-09-11`
      const endGC = `${gcYear + 1}-07-07`
      const ecYear = gcToECYear(startGC)
      setFormStartDate(startGC)
      setFormEndDate(endGC)
      setFormName(ecYear ? `${ecYear} E.C.` : '')
    } else {
      setFormStartDate(`${gcYear}-09-01`)
      setFormEndDate(`${gcYear + 1}-08-31`)
      setFormName(`${gcYear}/${gcYear + 1}`)
    }
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (year: AcademicYear) => {
    if (year.status === 'CLOSED') {
      notifications.warning('Read-Only', 'Closed academic years cannot be edited. Historical records are preserved.')
      return
    }
    setSelectedYear(year)
    setFormName(year.name)
    setFormStartDate(year.startDate ? year.startDate.split('T')[0] : '')
    setFormEndDate(year.endDate ? year.endDate.split('T')[0] : '')
    setIsEditOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formStartDate || !formEndDate) {
      notifications.warning('Missing Fields', 'Please complete all required fields.')
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
          isCurrent: false,
          status: 'FUTURE',
        }),
      })
      if (res.ok) {
        notifications.success('Created', 'New academic year created in FUTURE status. You can now prepare terms and structure.')
        setIsCreateOpen(false)
        resetForm()
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Failed to create academic year')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
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
        }),
      })
      if (res.ok) {
        notifications.success('Updated', 'Academic year updated successfully.')
        setIsEditOpen(false)
        resetForm()
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Failed to update academic year')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleConfirmActivate = async () => {
    if (!selectedYear) return
    setIsSubmitLoading(true)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/${selectedYear.id}/activate`, {
        method: 'POST',
        headers: headers as any,
      })
      if (res.ok) {
        notifications.success('Academic Year Activated', `"${selectedYear.name}" is now the ACTIVE academic year. All active workflows are now operating under this year.`)
        setIsActivateOpen(false)
        resetForm()
        loadAcademicYears()
        window.dispatchEvent(new Event('academicYearChanged'))
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Activation failed')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleConfirmClose = async () => {
    if (!selectedYear) return
    if (closeConfirmName.trim() !== selectedYear.name.trim()) {
      notifications.warning('Confirmation Mismatch', 'Please type the exact name of the academic year to confirm closure.')
      return
    }
    setIsSubmitLoading(true)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/${selectedYear.id}/close`, {
        method: 'POST',
        headers: headers as any,
      })
      if (res.ok) {
        notifications.success('Academic Year Finalized', `"${selectedYear.name}" has been permanently closed. All historical records are locked as read-only.`)
        setIsCloseOpen(false)
        resetForm()
        loadAcademicYears()
        window.dispatchEvent(new Event('academicYearChanged'))
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Close failed')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedYear) return
    setIsSubmitLoading(true)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/${selectedYear.id}`, {
        method: 'DELETE',
        headers: headers as any,
      })
      if (res.ok) {
        notifications.success('Deleted', 'Academic year deleted successfully.')
        setIsDeleteOpen(false)
        resetForm()
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Delete failed')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const openCreateTerm = (year: AcademicYear) => {
    setEditingTerm(null)
    setTermFormYearId(year.id)
    setTermFormYearName(year.name)
    setTermFormName('')
    setTermFormStartDate(year.startDate ? year.startDate.split('T')[0] : '')
    setTermFormEndDate(year.endDate ? year.endDate.split('T')[0] : '')
    setTermFormIsCurrent(false)
    setIsCreateTermOpen(true)
  }

  const openEditTerm = (year: AcademicYear, term: AcademicTerm) => {
    setEditingTerm(term)
    setTermFormYearId(year.id)
    setTermFormYearName(year.name)
    setTermFormName(term.name)
    setTermFormStartDate(term.startDate ? term.startDate.split('T')[0] : '')
    setTermFormEndDate(term.endDate ? term.endDate.split('T')[0] : '')
    setTermFormIsCurrent(term.isCurrent)
    setIsCreateTermOpen(true)
  }

  const handleTermSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!termFormYearId || !termFormName.trim() || !termFormStartDate || !termFormEndDate) {
      notifications.warning('Missing Fields', 'Please complete all term details.')
      return
    }
    setIsSubmitLoading(true)
    try {
      const isEditing = Boolean(editingTerm)
      const url = isEditing
        ? `${getApiUrl()}/api/academic-years/terms/${editingTerm!.id}`
        : `${getApiUrl()}/api/academic-years/${termFormYearId}/terms`
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: headers as any,
        body: JSON.stringify({
          name: termFormName.trim(),
          startDate: termFormStartDate,
          endDate: termFormEndDate,
          isCurrent: termFormIsCurrent,
        }),
      })

      if (res.ok) {
        notifications.success(
          isEditing ? 'Term Updated' : 'Term Created',
          isEditing ? `Term "${termFormName.trim()}" updated.` : `New term "${termFormName.trim()}" added.`
        )
        setIsCreateTermOpen(false)
        setEditingTerm(null)
        setTermFormName('')
        setTermFormStartDate('')
        setTermFormEndDate('')
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save term')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
    } finally {
      setIsSubmitLoading(false)
    }
  }

  const handleDeleteTerm = async (term: AcademicTerm) => {
    if (!confirm(`Are you sure you want to delete term "${term.name}"?`)) return
    setDeletingTermId(term.id)
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/terms/${term.id}`, {
        method: 'DELETE',
        headers: headers as any,
      })
      if (res.ok) {
        notifications.success('Deleted', `Term "${term.name}" removed.`)
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Failed to delete term')
      }
    } catch (error: any) {
      notifications.error('Cannot Delete', error.message)
    } finally {
      setDeletingTermId(null)
    }
  }

  const handleSetCurrentTerm = async (term: AcademicTerm) => {
    try {
      const res = await fetch(`${getApiUrl()}/api/academic-years/terms/${term.id}`, {
        method: 'PUT',
        headers: headers as any,
        body: JSON.stringify({ isCurrent: true }),
      })
      if (res.ok) {
        notifications.success('Active Term Set', `"${term.name}" is now the active term for mark entry.`)
        loadAcademicYears()
      } else {
        const err = await res.json()
        throw new Error(err.message || 'Failed to set active term')
      }
    } catch (error: any) {
      notifications.error('Error', error.message)
    }
  }

  const displayDate = (isoString: string | null | undefined): string => {
    if (!isoString) return '-'
    try {
      return formatDate(isoString, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString.split('T')[0]
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const calendarLabel = isEthiopian ? 'Ethiopian Calendar (E.C.)' : 'Gregorian Calendar (G.C.)'
  const startDateLabel = isEthiopian ? 'Start Date (Gregorian / GC)' : 'Start Date'
  const endDateLabel = isEthiopian ? 'End Date (Gregorian / GC)' : 'End Date'
  const namePlaceholder = isEthiopian ? 'e.g. 2016 E.C. or 2017 E.C.' : 'e.g. 2025/2026 or 2025'

  const renderYearRow = (year: AcademicYear) => {
    const status: AcademicYearStatus = year.status || (year.isCurrent ? 'ACTIVE' : 'FUTURE')
    const isExpanded = expandedYears.has(year.id)
    const isClosed = status === 'CLOSED'
    const isFuture = status === 'FUTURE'
    const isActive = status === 'ACTIVE'

    return (
      <React.Fragment key={year.id}>
        <TableRow className={cn(
          "border-slate-100 dark:border-slate-800/60 transition-colors group",
          isActive && "bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30",
          isFuture && "hover:bg-slate-50/60 dark:hover:bg-slate-900/40",
          isClosed && "opacity-80 bg-slate-50/30 dark:bg-slate-900/20 hover:bg-slate-50/50 dark:hover:bg-slate-900/30",
        )}>
          <TableCell className="py-3.5">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleExpand(year.id)}
                className="mt-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title={isExpanded ? 'Hide terms' : 'Show terms'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "font-extrabold text-sm tracking-tight",
                    isActive ? "text-emerald-950 dark:text-emerald-200" : isClosed ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                  )}>
                    {year.name}
                  </span>
                  <StatusBadge status={status} isCurrent={year.isCurrent} />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{(year.terms?.length ?? 0)} {(year.terms?.length === 1 ? 'Term' : 'Terms')}</span>
                  {isActive && <span className="font-semibold text-emerald-600 dark:text-emerald-400">• Current Operating Year</span>}
                  {isClosed && <span className="font-medium text-slate-400 flex items-center gap-1">• Finalized Historical</span>}
                </div>
              </div>
            </div>
          </TableCell>

          <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {displayDate(year.startDate)}
          </TableCell>

          <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {displayDate(year.endDate)}
          </TableCell>

          <TableCell className="text-right px-4 whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              {/* Activate action (FUTURE only) */}
              {isFuture && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedYear(year); setIsActivateOpen(true) }}
                  className="h-8 rounded-xl font-bold text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5 shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Activate
                </Button>
              )}

              {/* Edit action (FUTURE & ACTIVE) */}
              {!isClosed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(year)}
                  className="h-8 w-8 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Edit year"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}

              {/* Add Term (FUTURE & ACTIVE) */}
              {!isClosed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openCreateTerm(year)}
                  className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
                  title="Add term to this year"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}

              {/* Close action (ACTIVE only) */}
              {isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedYear(year); setCloseConfirmName(''); setIsCloseOpen(true) }}
                  className="h-8 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5"
                  title="Finalize and close academic year"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Close Year
                </Button>
              )}

              {/* Delete action (FUTURE only, never active or closed) */}
              {isFuture && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSelectedYear(year); setIsDeleteOpen(true) }}
                  className="h-8 w-8 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Delete academic year"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}

              {/* Read-Only badge (CLOSED) */}
              {isClosed && (
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Lock className="w-3 h-3" /> Read-only archive
                </span>
              )}
            </div>
          </TableCell>
        </TableRow>

        {/* Expanded Terms list */}
        {isExpanded && (
          <TableRow className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800">
            <TableCell colSpan={4} className="px-6 sm:px-8 py-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Terms & Semesters ({year.terms?.length ?? 0})
                    {isClosed && <span className="text-slate-500 dark:text-slate-400 font-bold normal-case text-xs">(Read-only: Year Closed)</span>}
                  </span>
                  {!isClosed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCreateTerm(year)}
                      className="h-7 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl px-2.5 gap-1.5 border-primary/30"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Term
                    </Button>
                  )}
                </div>

                {year.terms && year.terms.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {year.terms.map(term => (
                      <div
                        key={term.id}
                        className={cn(
                          "group relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-200",
                          term.isCurrent
                            ? "bg-primary/10 border-primary/40 text-primary shadow-xs ring-1 ring-primary/20"
                            : "bg-card border-border/80 text-foreground hover:border-border hover:shadow-2xs",
                          deletingTermId === term.id && "opacity-40 pointer-events-none"
                        )}
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs truncate">{term.name}</span>
                            {term.isCurrent && (
                              <Badge className="text-[9px] font-black uppercase tracking-wider bg-primary text-white border-none px-2 py-0 h-4 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">
                            {displayDate(term.startDate)} – {displayDate(term.endDate)}
                          </p>
                        </div>

                        {!isClosed && (
                          <div className="flex items-center gap-1 shrink-0">
                            {!term.isCurrent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetCurrentTerm(term)}
                                title="Set as currently active term for mark entry"
                                className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg hidden group-hover:inline-flex"
                              >
                                Set Active
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditTerm(year, term)}
                              title="Edit term"
                              className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTerm(term)}
                              title="Delete term"
                              className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-muted/20">
                    No terms configured yet. Click <strong>"Add Term"</strong> to set up semesters or quarters for this academic year.
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="years" className="space-y-6">
        <TabsList className="bg-muted/70 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 border border-border/50">
          <TabsTrigger value="years" className="rounded-xl text-xs font-bold gap-2 py-2.5 px-4 data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <CalendarDays className="w-4 h-4 text-primary" />
            Academic Years & Lifecycle
          </TabsTrigger>
          <TabsTrigger value="terms" className="rounded-xl text-xs font-bold gap-2 py-2.5 px-4 data-[state=active]:bg-card data-[state=active]:shadow-xs">
            <Layers className="w-4 h-4 text-primary" />
            Terms & Semesters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="years" className="space-y-6 mt-0">
          {/* ── Header Summary Card ── */}
          <Card className="border border-border/80 shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 sm:p-6 pb-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2 tracking-tight">
                    <CalendarDays className="w-5 h-5 text-primary" /> Academic Year Lifecycle
                  </CardTitle>
                  <Badge variant="outline" className={cn(
                    "font-bold text-[10px] px-2.5 py-1 flex items-center gap-1.5 rounded-lg border",
                    isEthiopian
                      ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25"
                  )}>
                    <Globe className="w-3 h-3" />
                    {isEthiopian ? 'Ethiopian Calendar' : 'Gregorian Calendar'}
                  </Badge>
                  {activeYear && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-extrabold text-xs px-3 py-1 flex items-center gap-1.5 rounded-lg shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active: {activeYear.name}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs font-medium text-muted-foreground">
                  Lifecycle: <strong>Future</strong> (preparation) → <strong>Active</strong> (single operating year) → <strong>Closed</strong> (read-only archive).{' '}
                  <span className="font-semibold text-foreground/80 dark:text-foreground/90">
                    Dates formatted in {calendarLabel}.
                  </span>
                </CardDescription>
              </div>

              <Button
                onClick={handleOpenCreate}
                className="h-10 rounded-2xl font-bold text-xs gap-2 px-5 shadow-sm bg-primary hover:bg-primary/90 text-white shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Academic Year
              </Button>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 pt-0">
              {/* Lifecycle Status Overview Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock3 className="w-3.5 h-3.5" /> Future Years
                    </span>
                    <span className="font-black text-sm text-blue-800 dark:text-blue-200">{futureYears.length}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-tight">
                    Preparation allowed. Teaching operations & mark entry blocked until activated.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Operating Active Year
                    </span>
                    <span className="font-black text-sm text-emerald-800 dark:text-emerald-200">{activeYear ? 1 : 0} / 1</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-tight">
                    {activeYear ? `"${activeYear.name}" actively running` : 'No active year configured. Activate one below.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Closed Years
                    </span>
                    <span className="font-black text-sm text-slate-700 dark:text-slate-300">{closedYears.length}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-tight">
                    Archived historical records. Permanently locked as read-only.
                  </p>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto no-scrollbar pt-2">
                {(['ALL', 'ACTIVE', 'FUTURE', 'CLOSED'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTabFilter(tab)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
                      activeTabFilter === tab
                        ? "bg-primary text-white shadow-xs"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {tab === 'ALL' && `All Years (${academicYears.length})`}
                    {tab === 'ACTIVE' && `Active (${activeYear ? 1 : 0})`}
                    {tab === 'FUTURE' && `Future (${futureYears.length})`}
                    {tab === 'CLOSED' && `Closed (${closedYears.length})`}
                  </button>
                ))}
              </div>

              {/* Academic Years Table */}
              <div className="rounded-2xl border border-border/80 overflow-hidden bg-card shadow-xs">
                <Table>
                  <TableHeader className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <TableRow className="border-border/80">
                      <TableHead className="font-bold">Academic Year & Status</TableHead>
                      <TableHead className="font-bold">
                        Start Date <span className="ml-1 text-[9px] text-muted-foreground font-semibold">({isEthiopian ? 'EC' : 'GC'})</span>
                      </TableHead>
                      <TableHead className="font-bold">
                        End Date <span className="ml-1 text-[9px] text-muted-foreground font-semibold">({isEthiopian ? 'EC' : 'GC'})</span>
                      </TableHead>
                      <TableHead className="text-right font-bold px-4">Lifecycle Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center">
                          <div className="flex items-center justify-center">
                            <Spinner size="md" className="text-primary" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredYears.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center">
                          <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <CalendarIcon className="w-10 h-10 opacity-30" />
                            <p className="font-bold text-xs uppercase tracking-wider">No academic years found</p>
                            <p className="text-xs">Create an academic year to initiate the school management lifecycle.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredYears.map(year => renderYearRow(year))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="mt-0">
          <Card className="border border-border/80 shadow-sm bg-card rounded-3xl p-6">
            <AcademicYearsWithTermsSection years={academicYears} onTermsChanged={loadAcademicYears} />
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── CREATE YEAR MODAL ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <CalendarIcon className="w-5 h-5 text-primary" /> Create Academic Year
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              New academic years are initialized in <strong>FUTURE</strong> status so you can safely prepare terms, grades, and teacher assignments.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Academic Year Label / Name</Label>
                {autoSuggestName && formName !== autoSuggestName && (
                  <button type="button" onClick={() => setFormName(autoSuggestName)} className="text-[10px] font-bold text-primary hover:underline">
                    Suggest: {autoSuggestName}
                  </button>
                )}
              </div>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder={namePlaceholder}
                className="h-10 rounded-xl font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{startDateLabel}</Label>
                <DualDatePicker
                  id="create-start"
                  value={formStartDate}
                  onChange={val => {
                    setFormStartDate(val)
                    const suggestion = isEthiopian
                      ? (() => { const y = gcToECYear(val); return y ? `${y} E.C.` : '' })()
                      : (() => { const y = parseInt(val.split('-')[0], 10); return y ? `${y}/${y + 1}` : '' })()
                    if (!formName || formName === autoSuggestName) setFormName(suggestion)
                  }}
                  placeholder={isEthiopian ? 'የጀምሮ ቀን' : 'Start date'}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{endDateLabel}</Label>
                <DualDatePicker
                  id="create-end"
                  value={formEndDate}
                  onChange={setFormEndDate}
                  placeholder={isEthiopian ? 'የሚጠናቀቅ ቀን' : 'End date'}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 p-3.5 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
              <Clock3 className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-0.5">
                <p className="font-bold">Initial Status: Future</p>
                <p className="text-[11px] opacity-90">Terms (Semester 1 & 2) will be scaffolded automatically. Teaching staff will not have access until you activate this year.</p>
              </div>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitLoading} className="rounded-xl text-xs font-bold h-10 px-5 bg-primary text-white">
                {isSubmitLoading ? 'Saving...' : 'Create Academic Year'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT YEAR MODAL ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Pencil className="w-5 h-5 text-primary" /> Edit Academic Year
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Update year label or date boundaries.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Academic Year Label / Name</Label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder={namePlaceholder}
                className="h-10 rounded-xl font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{startDateLabel}</Label>
                <DualDatePicker
                  id="edit-start"
                  value={formStartDate}
                  onChange={setFormStartDate}
                  placeholder={isEthiopian ? 'የጀምሮ ቀን' : 'Start date'}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{endDateLabel}</Label>
                <DualDatePicker
                  id="edit-end"
                  value={formEndDate}
                  onChange={setFormEndDate}
                  placeholder={isEthiopian ? 'የሚጠናቀቅ ቀን' : 'End date'}
                  className="rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitLoading} className="rounded-xl text-xs font-bold h-10 px-5 bg-primary text-white">
                {isSubmitLoading ? 'Updating...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ACTIVATE CONFIRMATION MODAL ── */}
      <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Activate Academic Year
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 p-4 text-emerald-900 dark:text-emerald-200 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75">Target Operating Year</span>
              <p className="text-lg font-black">{selectedYear?.name}</p>
              <p className="text-xs opacity-90">
                {displayDate(selectedYear?.startDate)} – {displayDate(selectedYear?.endDate)}
              </p>
            </div>

            {activeYear && activeYear.id !== selectedYear?.id && (
              <div className="rounded-2xl bg-muted/60 border border-border p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-foreground/70" />
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground">Transition from "{activeYear.name}"</p>
                  <p className="text-[11px] leading-relaxed">
                    The currently active year will revert to <strong>FUTURE</strong> status (not closed). You can close it separately when all marks are finalized.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              Activating this year enables valid teacher assignments, gradebook mark entry, attendance logging, and assessment workflows for the new school term.
            </p>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsActivateOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmActivate}
              disabled={isSubmitLoading}
              className="rounded-xl text-xs font-bold h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitLoading ? 'Activating...' : 'Yes, Activate Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CLOSE YEAR CONFIRMATION MODAL ── */}
      <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5" /> Close Academic Year
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 p-4 space-y-2">
              <p className="text-sm font-black text-rose-900 dark:text-rose-200">
                ⚠ All academic records will be locked as read-only.
              </p>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                Closing <strong>"{selectedYear?.name}"</strong> finalizes all student marks, term grades, attendance logs, and report cards. Future edits and deletions are permanently blocked.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Type <span className="text-rose-600 dark:text-rose-400 font-black">{selectedYear?.name}</span> to confirm closure:
              </Label>
              <Input
                value={closeConfirmName}
                onChange={e => setCloseConfirmName(e.target.value)}
                placeholder="Type the exact academic year name"
                className="h-10 rounded-xl text-sm font-bold"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsCloseOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmClose}
              disabled={isSubmitLoading || closeConfirmName.trim() !== selectedYear?.name.trim()}
              className="rounded-xl text-xs font-bold h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {isSubmitLoading ? 'Closing...' : 'Confirm & Close Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE YEAR CONFIRMATION MODAL ── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-rose-600">
              <Trash2 className="w-5 h-5" /> Delete Academic Year
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <strong>"{selectedYear?.name}"</strong>?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This action can only be performed on prepared FUTURE years with no operational data. It cannot be undone.
            </p>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isSubmitLoading}
              className="rounded-xl text-xs font-bold h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmitLoading ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE / EDIT TERM MODAL ── */}
      <Dialog open={isCreateTermOpen} onOpenChange={setIsCreateTermOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              {editingTerm ? (
                <>
                  <Pencil className="w-5 h-5 text-primary" /> Edit Academic Term
                </>
              ) : (
                <>
                  <Layers className="w-5 h-5 text-primary" /> Add Academic Term
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {editingTerm
                ? `Modify details and dates for "${editingTerm.name}" in ${termFormYearName || 'this academic year'}.`
                : `Add a semester, trimester, or term window to ${termFormYearName || 'this academic year'}.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTermSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Term Name</Label>
              <Input
                value={termFormName}
                onChange={e => setTermFormName(e.target.value)}
                placeholder="e.g. Semester 1, Term 2, Quarter 3"
                className="h-10 rounded-xl font-bold text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{startDateLabel}</Label>
                <DualDatePicker
                  id="create-term-start"
                  value={termFormStartDate}
                  onChange={setTermFormStartDate}
                  placeholder={isEthiopian ? 'የጀምሮ ቀን' : 'Start date'}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{endDateLabel}</Label>
                <DualDatePicker
                  id="create-term-end"
                  value={termFormEndDate}
                  onChange={setTermFormEndDate}
                  placeholder={isEthiopian ? 'የሚጠናቀቅ ቀን' : 'End date'}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="createTermIsCurrent"
                checked={termFormIsCurrent}
                onCheckedChange={checked => setTermFormIsCurrent(Boolean(checked))}
              />
              <label htmlFor="createTermIsCurrent" className="text-xs font-bold text-foreground cursor-pointer">
                Set as Active Term for mark entry
              </label>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateTermOpen(false)} className="rounded-xl text-xs font-bold h-10 px-4">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitLoading} className="rounded-xl text-xs font-bold h-10 px-5 bg-primary text-white">
                {isSubmitLoading ? 'Saving...' : editingTerm ? 'Save Changes' : 'Add Term'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
