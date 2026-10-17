"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus, Pencil, Trash2, BookMarked, Layers, 
  LayoutGrid, GraduationCap, ChevronDown, ChevronRight, 
  Calendar, CheckSquare, Square, BookOpen, AlertCircle, 
  X, Check, Search, Filter
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { cn } from "@/lib/utils/utils"
import { getApiUrl } from "@/lib/api-config"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface AcademicTerm {
  id: string
  academicYearId: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface Grade {
  id: string
  name: string
}

interface Section {
  id: string
  name: string
}

interface Stream {
  id: string
  name: string
}

interface Subject {
  id: string
  name: string
  code: string
  department?: string | null
  color?: string
  description?: string | null
  isActive: boolean
}

interface GradeSubjectItem {
  id: string
  gradeId: string
  streamId?: string | null
  sectionId?: string | null
  subjectId: string
  grade?: Grade
  stream?: Stream | null
  section?: Section | null
  subject?: Subject
}


// ─── Helper ───────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
  const schoolId = typeof window !== "undefined" ? localStorage.getItem("x-school-id") : null
  let userRole: string | null = null
  try {
    const userStr = typeof window !== "undefined" ? localStorage.getItem("attendance_current_user") : null
    if (userStr) {
      const u = JSON.parse(userStr)
      userRole = u?.role || null
    }
  } catch {}
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (schoolId) headers["x-school-id"] = schoolId
  if (userRole) headers["x-requested-role"] = userRole
  return headers
}

const SUBJECT_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
]

// ─── Simple Item Row ──────────────────────────────────────────────────────────

function SimpleItemRow({
  name, onEdit, onDelete, badge, badgeColor,
}: {
  name: string
  onEdit: () => void
  onDelete: () => void
  badge?: string
  badgeColor?: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/40 border border-border/40 hover:bg-muted/70 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        {badgeColor && (
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: badgeColor }} />
        )}
        <span className="font-semibold text-sm text-foreground truncate">{name}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px] font-semibold rounded-md px-2 hidden sm:inline-flex">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="w-8 h-8 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Grades Section ───────────────────────────────────────────────────────────

function GradesSection() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [formName, setFormName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await db.getGrades()
      setGrades(data || [])
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditingGrade(null); setFormName(""); setIsOpen(true) }
  const openEdit = (g: Grade) => { setEditingGrade(g); setFormName(g.name); setIsOpen(true) }

  const handleSave = async () => {
    if (!formName.trim()) { notifications.error("Validation", "Grade name is required"); return }
    try {
      setIsSaving(true)
      if (editingGrade) {
        await db.updateGrade(editingGrade.id, { name: formName.trim() })
        notifications.success("Updated", `Grade "${formName.trim()}" updated.`)
      } else {
        await db.createGrade({ name: formName.trim() })
        notifications.success("Created", `Grade "${formName.trim()}" added.`)
      }
      setIsOpen(false)
      await load()
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete grade "${name}"? This cannot be undone.`)) return
    try {
      setDeletingId(id)
      await db.deleteGrade(id)
      notifications.success("Deleted", `Grade "${name}" removed.`)
      await load()
    } catch (e: any) {
      notifications.error("Cannot Delete", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">Grades</div>
            <div className="text-[11px] text-muted-foreground">{grades.length} grade{grades.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="rounded-xl h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white">
          <Plus className="w-3.5 h-3.5" /> Add Grade
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Spinner className="w-5 h-5 text-blue-500" /></div>
      ) : grades.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
          No grades defined yet. Add your first grade.
        </div>
      ) : (
        <div className="space-y-2">
          {grades.map((g) => (
            <div key={g.id} className={cn(deletingId === g.id ? "opacity-40 pointer-events-none" : "")}>
              <SimpleItemRow
                name={g.name}
                onEdit={() => openEdit(g)}
                onDelete={() => handleDelete(g.id, g.name)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-bold">{editingGrade ? "Edit Grade" : "Add Grade"}</DialogTitle>
            <DialogDescription className="text-xs">Enter a grade name (e.g. Grade 1, Grade 9, Nursery)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Grade Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Grade 1, Grade 12, Nursery"
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button disabled={isSaving} onClick={handleSave} className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white">
              {isSaving ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
              {editingGrade ? "Save Changes" : "Add Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Sections Section ─────────────────────────────────────────────────────────

function SectionsSection() {
  const [sections, setSections] = useState<Section[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [formName, setFormName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await db.getSections()
      setSections(data || [])
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditingSection(null); setFormName(""); setIsOpen(true) }
  const openEdit = (s: Section) => { setEditingSection(s); setFormName(s.name); setIsOpen(true) }

  const handleSave = async () => {
    if (!formName.trim()) { notifications.error("Validation", "Section name is required"); return }
    try {
      setIsSaving(true)
      if (editingSection) {
        await db.updateSection(editingSection.id, { name: formName.trim() })
        notifications.success("Updated", `Section "${formName.trim()}" updated.`)
      } else {
        await db.createSection({ name: formName.trim() })
        notifications.success("Created", `Section "${formName.trim()}" added.`)
      }
      setIsOpen(false)
      await load()
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete section "${name}"? This cannot be undone.`)) return
    try {
      setDeletingId(id)
      await db.deleteSection(id)
      notifications.success("Deleted", `Section "${name}" removed.`)
      await load()
    } catch (e: any) {
      notifications.error("Cannot Delete", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">Sections</div>
            <div className="text-[11px] text-muted-foreground">{sections.length} section{sections.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="rounded-xl h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="w-3.5 h-3.5" /> Add Section
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Spinner className="w-5 h-5 text-emerald-500" /></div>
      ) : sections.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
          No sections defined yet. Sections are shared across all grades (e.g. A, B, C).
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((s) => (
            <div key={s.id} className={cn(deletingId === s.id ? "opacity-40 pointer-events-none" : "")}>
              <SimpleItemRow
                name={s.name}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s.id, s.name)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-bold">{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
            <DialogDescription className="text-xs">Sections are shared across all grades.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Section Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. A, B, C, Red, Blue"
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button disabled={isSaving} onClick={handleSave} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white">
              {isSaving ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
              {editingSection ? "Save Changes" : "Add Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Streams Section ──────────────────────────────────────────────────────────

function StreamsSection() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingStream, setEditingStream] = useState<Stream | null>(null)
  const [formName, setFormName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await db.getStreams()
      setStreams(data || [])
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditingStream(null); setFormName(""); setIsOpen(true) }
  const openEdit = (s: Stream) => { setEditingStream(s); setFormName(s.name); setIsOpen(true) }

  const handleSave = async () => {
    if (!formName.trim()) { notifications.error("Validation", "Stream name is required"); return }
    try {
      setIsSaving(true)
      if (editingStream) {
        await db.updateStream(editingStream.id, { name: formName.trim() })
        notifications.success("Updated", `Stream "${formName.trim()}" updated.`)
      } else {
        await db.createStream({ name: formName.trim() })
        notifications.success("Created", `Stream "${formName.trim()}" added.`)
      }
      setIsOpen(false)
      await load()
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete stream "${name}"? This cannot be undone.`)) return
    try {
      setDeletingId(id)
      await db.deleteStream(id)
      notifications.success("Deleted", `Stream "${name}" removed.`)
      await load()
    } catch (e: any) {
      notifications.error("Cannot Delete", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">Streams / Tracks</div>
            <div className="text-[11px] text-muted-foreground">{streams.length} stream{streams.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="rounded-xl h-8 gap-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white">
          <Plus className="w-3.5 h-3.5" /> Add Stream
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Spinner className="w-5 h-5 text-amber-500" /></div>
      ) : streams.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
          No streams defined. Streams are optional (e.g. Natural, Social, Technical).
        </div>
      ) : (
        <div className="space-y-2">
          {streams.map((s) => (
            <div key={s.id} className={cn(deletingId === s.id ? "opacity-40 pointer-events-none" : "")}>
              <SimpleItemRow
                name={s.name}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s.id, s.name)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-bold">{editingStream ? "Edit Stream" : "Add Stream"}</DialogTitle>
            <DialogDescription className="text-xs">Streams group students within a grade by academic track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Stream Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Natural Science, Technical"
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button disabled={isSaving} onClick={handleSave} className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white">
              {isSaving ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
              {editingStream ? "Save Changes" : "Add Stream"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Subjects Section ─────────────────────────────────────────────────────────

function SubjectsSection() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [formName, setFormName] = useState("")
  const [formCode, setFormCode] = useState("")
  const [formDepartment, setFormDepartment] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formColor, setFormColor] = useState("#3b82f6")
  const [formIsActive, setFormIsActive] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await db.getSubjects()
      setSubjects(data || [])
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditingSubject(null)
    setFormName(""); setFormCode(""); setFormDepartment("")
    setFormDescription(""); setFormColor("#3b82f6"); setFormIsActive(true)
    setIsOpen(true)
  }

  const openEdit = (s: Subject) => {
    setEditingSubject(s)
    setFormName(s.name); setFormCode(s.code)
    setFormDepartment(s.department || ""); setFormDescription(s.description || "")
    setFormColor(s.color || "#3b82f6"); setFormIsActive(s.isActive)
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) { notifications.error("Validation", "Subject name is required"); return }
    if (!formCode.trim()) { notifications.error("Validation", "Subject code is required"); return }
    try {
      setIsSaving(true)
      const payload = {
        name: formName.trim(),
        code: formCode.trim(),
        department: formDepartment.trim() || undefined,
        description: formDescription.trim() || undefined,
        color: formColor,
        isActive: formIsActive,
      }
      if (editingSubject) {
        await db.updateSubject(editingSubject.id, payload)
        notifications.success("Updated", `Subject "${formName.trim()}" updated.`)
      } else {
        await db.createSubject(payload)
        notifications.success("Created", `Subject "${formName.trim()}" added.`)
      }
      setIsOpen(false)
      await load()
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"? Teacher assignments linked to this subject will also be removed.`)) return
    try {
      setDeletingId(id)
      await db.deleteSubject(id)
      notifications.success("Deleted", `Subject "${name}" removed.`)
      await load()
    } catch (e: any) {
      notifications.error("Cannot Delete", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <BookMarked className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">Subjects</div>
            <div className="text-[11px] text-muted-foreground">
              {subjects.filter(s => s.isActive).length} active • {subjects.filter(s => !s.isActive).length} inactive
            </div>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" className="rounded-xl h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white">
          <Plus className="w-3.5 h-3.5" /> Add Subject
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Spinner className="w-5 h-5 text-violet-500" /></div>
      ) : subjects.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
          No subjects defined yet. Add your curriculum subjects.
        </div>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className={cn(deletingId === s.id ? "opacity-40 pointer-events-none" : "")}>
              <SimpleItemRow
                name={s.isActive ? s.name : `${s.name} (Inactive)`}
                badge={s.code}
                badgeColor={s.color}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s.id, s.name)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-bold">{editingSubject ? "Edit Subject" : "Add Subject"}</DialogTitle>
            <DialogDescription className="text-xs">Configure subject details for the curriculum</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subject Name *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Mathematics" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subject Code *</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} placeholder="e.g. MATH" className="rounded-xl font-mono" maxLength={10} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department / Faculty</Label>
              <Input value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} placeholder="e.g. Sciences, Humanities" className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional subject description..."
                rows={2}
                className="rounded-xl resize-none text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Subject Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all",
                      formColor === c ? "border-foreground scale-110" : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/40">
              <div>
                <div className="text-sm font-semibold">Active Status</div>
                <div className="text-[11px] text-muted-foreground">Inactive subjects are hidden from student portals</div>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button disabled={isSaving} onClick={handleSave} className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white">
              {isSaving ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
              {editingSubject ? "Save Changes" : "Add Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Grade Subjects Section (Curriculum Assignment) ──────────────────────────

function GradeSubjectsSection() {
  const [gradeSubjects, setGradeSubjects] = useState<GradeSubjectItem[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form states
  const [selectedGradeId, setSelectedGradeId] = useState("")
  const [selectedStreamId, setSelectedStreamId] = useState("")
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [subjectSearch, setSubjectSearch] = useState("")
  const [filterGrade, setFilterGrade] = useState<string>("ALL")

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [gsData, gData, sData, subData] = await Promise.all([
        db.getGradeSubjects(),
        db.getGrades(),
        db.getStreams(),
        db.getSubjects(),
      ])
      setGradeSubjects(gsData || [])
      setGrades(gData || [])
      setStreams(sData || [])
      setSubjects(subData || [])
    } catch (e: any) {
      notifications.error("Error", e?.message || "Failed to load grade subjects data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    const handleChanged = () => loadAll()
    window.addEventListener("gradeSubjectsChanged", handleChanged)
    return () => window.removeEventListener("gradeSubjectsChanged", handleChanged)
  }, [loadAll])

  const selectedGradeObj = grades.find((g) => g.id === selectedGradeId)
  const isGrade11or12 = selectedGradeObj
    ? /\b(11|12)\b/.test(selectedGradeObj.name) ||
      selectedGradeObj.name.includes("11") ||
      selectedGradeObj.name.includes("12")
    : false

  // Determine which subjects are already assigned to the selected Grade + Stream
  const alreadyAssignedSubjectIds = new Set(
    gradeSubjects
      .filter((gs) => {
        if (gs.gradeId !== selectedGradeId) return false
        if (isGrade11or12) {
          return gs.streamId === selectedStreamId
        }
        return true
      })
      .map((gs) => gs.subjectId)
  )

  const openAssignModal = (prefillGradeId?: string, prefillStreamId?: string) => {
    const targetGradeId = prefillGradeId || (grades.length > 0 ? grades[0].id : "")
    setSelectedGradeId(targetGradeId)
    setSelectedStreamId(prefillStreamId || "")
    setSelectedSubjectIds([])
    setSubjectSearch("")
    setIsOpen(true)
  }

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    )
  }

  const selectAllActiveSubjects = () => {
    const unassigned = subjects
      .filter((s) => s.isActive && !alreadyAssignedSubjectIds.has(s.id))
      .map((s) => s.id)
    setSelectedSubjectIds(unassigned)
  }

  const clearSubjectSelection = () => {
    setSelectedSubjectIds([])
  }

  const handleSaveAssignment = async () => {
    if (!selectedGradeId) {
      notifications.error("Validation Error", "Please select a grade")
      return
    }
    if (isGrade11or12 && !selectedStreamId) {
      notifications.error(
        "Validation Error",
        "Stream selection (Natural Science or Social Science) is required for Grades 11 and 12"
      )
      return
    }
    if (selectedSubjectIds.length === 0) {
      notifications.error("Validation Error", "Please select at least one subject to assign")
      return
    }

    setIsSaving(true)
    try {
      await db.assignSubjectsToGrade({
        gradeId: selectedGradeId,
        streamId: isGrade11or12 ? selectedStreamId : null,
        subjectIds: selectedSubjectIds,
      })
      notifications.success(
        "Subjects Assigned",
        `Successfully assigned ${selectedSubjectIds.length} subject(s) to Grade ${selectedGradeObj?.name}${
          selectedStreamId ? ` (${streams.find((s) => s.id === selectedStreamId)?.name})` : ""
        }`
      )
      setIsOpen(false)
      setSelectedSubjectIds([])
      await loadAll()
    } catch (e: any) {
      notifications.error("Error", e?.message || "Failed to assign subjects")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAssignment = async (id: string, subjectName: string, gradeName: string, streamName?: string | null) => {
    const label = `${gradeName}${streamName ? ` (${streamName})` : ""}`
    if (!confirm(`Remove "${subjectName}" from Grade ${label} curriculum?`)) return
    setDeletingId(id)
    try {
      await db.deleteGradeSubject(id)
      notifications.success("Removed", `"${subjectName}" unassigned from Grade ${label}`)
      await loadAll()
    } catch (e: any) {
      notifications.error("Error", e?.message || "Failed to remove assignment")
    } finally {
      setDeletingId(null)
    }
  }

  // Filter subjects for modal
  const filteredModalSubjects = subjects.filter((s) => {
    if (!subjectSearch.trim()) return true
    const q = subjectSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  })

  // Group gradeSubjects by Grade & Stream
  const groupedCurriculum = useMemo(() => {
    const groups: {
      key: string
      gradeId: string
      gradeName: string
      streamId?: string | null
      streamName?: string | null
      items: GradeSubjectItem[]
    }[] = []

    const list =
      filterGrade === "ALL" ? gradeSubjects : gradeSubjects.filter((gs) => gs.gradeId === filterGrade)

    for (const item of list) {
      const gName = item.grade?.name || "Unknown Grade"
      const sName = item.stream?.name || null
      const key = `${item.gradeId}_${item.streamId || "none"}`

      let group = groups.find((g) => g.key === key)
      if (!group) {
        group = {
          key,
          gradeId: item.gradeId,
          gradeName: gName,
          streamId: item.streamId,
          streamName: sName,
          items: [],
        }
        groups.push(group)
      }
      group.items.push(item)
    }

    return groups.sort((a, b) => a.gradeName.localeCompare(b.gradeName, undefined, { numeric: true }))
  }, [gradeSubjects, filterGrade])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-base text-foreground flex items-center gap-2">
              Subject Assignment by Grade &amp; Stream
              <Badge variant="outline" className="text-[10px] font-bold rounded-full py-0 h-4 border-blue-500/30 text-blue-600 dark:text-blue-400">
                {gradeSubjects.length} Allocations
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Assign curriculum subjects to grades. Grades 11 and 12 require selecting a stream (Natural or Social Science).
            </div>
          </div>
        </div>

        <Button
          onClick={() => openAssignModal()}
          className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 shadow-md shadow-blue-500/20 h-10 px-4 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Assign Subjects to Grade
        </Button>
      </div>

      {/* Grade Quick Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant={filterGrade === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterGrade("ALL")}
          className={cn(
            "rounded-xl text-xs font-bold h-8 px-3 shrink-0",
            filterGrade === "ALL" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "border-border/60"
          )}
        >
          All Grades ({gradeSubjects.length})
        </Button>
        {grades.map((g) => {
          const count = gradeSubjects.filter((gs) => gs.gradeId === g.id).length
          const isSelected = filterGrade === g.id
          return (
            <Button
              key={g.id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterGrade(g.id)}
              className={cn(
                "rounded-xl text-xs font-bold h-8 px-3 shrink-0",
                isSelected ? "bg-blue-600 text-white" : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              Grade {g.name}
              <span className="ml-1.5 text-[10px] opacity-75">({count})</span>
            </Button>
          )
        })}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-6 h-6 text-blue-500" />
          <p className="text-xs text-muted-foreground font-medium">Loading curriculum allocations...</p>
        </div>
      ) : groupedCurriculum.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-border/60 rounded-3xl p-8 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No subjects assigned to classes yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Assign subjects to grades and stream tracks so teachers can be allocated and mark submissions are scoped to each class.
          </p>
          <Button
            onClick={() => openAssignModal()}
            className="mt-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2"
          >
            <Plus className="w-4 h-4" />
            Assign First Subjects
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedCurriculum.map((group) => {
            const is11or12 =
              /\b(11|12)\b/.test(group.gradeName) ||
              group.gradeName.includes("11") ||
              group.gradeName.includes("12")

            return (
              <div
                key={group.key}
                className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-sm p-5 space-y-4 hover:border-blue-500/40 transition-all shadow-sm"
              >
                {/* Group Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-foreground">
                        Grade {group.gradeName}
                      </span>
                      {group.streamName ? (
                        <Badge
                          className={cn(
                            "text-[10px] font-extrabold uppercase tracking-wide rounded-lg px-2 py-0.5",
                            group.streamName.toLowerCase().includes("nat")
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          )}
                          variant="outline"
                        >
                          {group.streamName} Stream
                        </Badge>
                      ) : is11or12 ? (
                        <Badge variant="outline" className="text-[10px] font-bold rounded-lg px-2 py-0.5 border-rose-500/30 text-rose-500 bg-rose-500/5">
                          Stream Missing
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-medium rounded-lg px-2 py-0.5 border-border/60 text-muted-foreground">
                          Standard Track
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {group.items.length} subject{group.items.length !== 1 ? "s" : ""} assigned
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAssignModal(group.gradeId, group.streamId || undefined)}
                    className="rounded-xl text-[11px] font-bold h-7 px-2.5 gap-1 border-border/60 hover:bg-muted"
                  >
                    <Plus className="w-3 h-3" />
                    Add More
                  </Button>
                </div>

                {/* Assigned Subjects Badges / Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => {
                    const sub = item.subject
                    if (!sub) return null
                    const isDeleting = deletingId === item.id

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl text-xs font-semibold border transition-all",
                          "bg-muted/40 hover:bg-muted/70 border-border/60 text-foreground"
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color || "#3b82f6" }}
                        />
                        <span>{sub.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground/80 px-1 py-0.2 rounded bg-background/50 border border-border/30">
                          {sub.code}
                        </span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() =>
                            handleDeleteAssignment(
                              item.id,
                              sub.name,
                              group.gradeName,
                              group.streamName
                            )
                          }
                          title={`Remove ${sub.name}`}
                          className="p-0.5 rounded-md text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assignment Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-6 bg-card border border-border/70 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Assign Subjects to Class / Grade
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select grade, stream (if Grade 11 or 12), and check all curriculum subjects to assign.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Grade & Stream Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
              {/* Grade */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Grade <span className="text-red-500">*</span>
                </Label>
                <select
                  value={selectedGradeId}
                  onChange={(e) => {
                    setSelectedGradeId(e.target.value)
                    setSelectedStreamId("")
                    setSelectedSubjectIds([])
                  }}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                >
                  <option value="">-- Choose Grade --</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      Grade {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stream */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    Stream {isGrade11or12 && <span className="text-red-500">*</span>}
                  </Label>
                  {isGrade11or12 ? (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Required for Gr 11/12
                    </span>
                  ) : null}
                </div>

                <select
                  value={selectedStreamId}
                  onChange={(e) => {
                    setSelectedStreamId(e.target.value)
                    setSelectedSubjectIds([])
                  }}
                  disabled={!isGrade11or12}
                  className={cn(
                    "w-full text-xs px-3 py-2 rounded-xl border bg-background focus:outline-none focus:ring-2 transition-all font-medium",
                    isGrade11or12 && !selectedStreamId
                      ? "border-amber-400 focus:ring-amber-500/20"
                      : "border-border focus:ring-blue-500/20",
                    !isGrade11or12 && "opacity-60 bg-muted/40 cursor-not-allowed"
                  )}
                >
                  {!isGrade11or12 ? (
                    <option value="">Not Applicable (Standard Curriculum)</option>
                  ) : (
                    <>
                      <option value="">-- Select Stream Track --</option>
                      {streams.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} Stream
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Subject Selection Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-bold text-foreground">
                  Select Subjects to Assign ({selectedSubjectIds.length} selected)
                </Label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllActiveSubjects}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Select All Unassigned
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={clearSubjectSelection}
                    className="text-muted-foreground font-medium hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Filter subjects by name or code..."
                  className="pl-8 text-xs h-8 rounded-xl"
                />
              </div>

              {/* Subject Checkboxes Grid */}
              <div className="max-h-56 overflow-y-auto p-2 rounded-2xl border border-border/70 bg-muted/20 space-y-1">
                {filteredModalSubjects.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No subjects found.
                  </div>
                ) : (
                  filteredModalSubjects.map((s) => {
                    const isAlready = alreadyAssignedSubjectIds.has(s.id)
                    const isChecked = selectedSubjectIds.includes(s.id)

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (!isAlready) toggleSubjectSelection(s.id)
                        }}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none",
                          isAlready
                            ? "bg-muted/40 opacity-70 cursor-not-allowed text-muted-foreground"
                            : isChecked
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900"
                            : "hover:bg-muted/60 text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked || isAlready}
                            disabled={isAlready}
                            onChange={() => {}}
                            className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color || "#3b82f6" }}
                          />
                          <span className="truncate">{s.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({s.code})
                          </span>
                        </div>

                        {isAlready ? (
                          <Badge variant="outline" className="text-[10px] font-semibold py-0 h-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                            Already Assigned
                          </Badge>
                        ) : isChecked ? (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                            Selected
                          </span>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              disabled={isSaving || !selectedGradeId || (isGrade11or12 && !selectedStreamId) || selectedSubjectIds.length === 0}
              onClick={handleSaveAssignment}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5"
            >
              {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <Check className="w-4 h-4" />}
              Save Assignment ({selectedSubjectIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


// ─── Academic Terms Section ───────────────────────────────────────────────────

function AcademicTermsSection({ year }: { year: AcademicYear }) {
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formIsCurrent, setFormIsCurrent] = useState(false)

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
    setEditingTerm(null)
    setFormName(""); setFormStartDate(""); setFormEndDate(""); setFormIsCurrent(false)
    setIsOpen(true)
  }

  const openEdit = (t: AcademicTerm) => {
    setEditingTerm(t)
    setFormName(t.name)
    setFormStartDate(t.startDate?.split("T")[0] || "")
    setFormEndDate(t.endDate?.split("T")[0] || "")
    setFormIsCurrent(t.isCurrent)
    setIsOpen(true)
  }

  const handleSave = async () => {
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
    } catch (e: any) {
      notifications.error("Error", e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete term "${name}"?`)) return
    try {
      setDeletingId(id)
      await db.deleteTerm(id)
      notifications.success("Deleted", `Term "${name}" removed.`)
      await load()
    } catch (e: any) {
      notifications.error("Cannot Delete", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="pl-4 border-l-2 border-border/50 mt-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Terms / Semesters ({terms.length})
        </span>
        <Button onClick={openCreate} size="sm" variant="outline" className="rounded-xl h-7 gap-1 text-[11px]">
          <Plus className="w-3 h-3" /> Add Term
        </Button>
      </div>

      {isLoading ? (
        <div className="py-4 flex justify-center"><Spinner className="w-4 h-4 text-indigo-500" /></div>
      ) : terms.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
          No terms yet. Add semesters or quarters for this academic year.
        </div>
      ) : (
        <div className="space-y-2">
          {terms.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors group",
                t.isCurrent
                  ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800"
                  : "bg-muted/30 border-border/40 hover:bg-muted/60",
                deletingId === t.id ? "opacity-40 pointer-events-none" : ""
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{t.name}</span>
                  {t.isCurrent && (
                    <Badge className="text-[10px] font-semibold rounded-full bg-indigo-600 text-white px-2 py-0 h-4">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id, t.name)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-bold">{editingTerm ? "Edit Term" : "Add Term"}</DialogTitle>
            <DialogDescription className="text-xs">Add a semester, quarter, or term to "{year.name}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Term Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Semester 1, Term 1, Q1" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Date *</Label>
                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Date *</Label>
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/40">
              <div>
                <div className="text-sm font-semibold">Set as Active Term</div>
                <div className="text-[11px] text-muted-foreground">Marks this as the currently active term</div>
              </div>
              <Switch checked={formIsCurrent} onCheckedChange={setFormIsCurrent} />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button disabled={isSaving} onClick={handleSave} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white">
              {isSaving ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : null}
              {editingTerm ? "Save Changes" : "Add Term"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Academic Years + Terms Section ──────────────────────────────────────────

function AcademicYearsWithTermsSection() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedYearId, setExpandedYearId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const API_URL = getApiUrl()
      const headers = getAuthHeaders()
      const res = await fetch(`${API_URL}/api/academic-years`, { headers: headers as any })
      if (res.ok) {
        const data = await res.json()
        const yearsList: AcademicYear[] = data.data || []
        setYears(yearsList)
        const current = yearsList.find((y) => y.isCurrent)
        if (current) setExpandedYearId(current.id)
      }
    } catch (e: any) {
      console.error("Failed to load academic years:", e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <div className="font-bold text-sm text-foreground">Academic Years & Terms</div>
          <div className="text-[11px] text-muted-foreground">Expand a year to manage its terms / semesters</div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Spinner className="w-5 h-5 text-indigo-500" /></div>
      ) : years.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl">
          No academic years found. Configure academic years in the "Academic Year" settings tab first.
        </div>
      ) : (
        <div className="space-y-2">
          {years.map((y) => {
            const isExpanded = expandedYearId === y.id
            return (
              <div
                key={y.id}
                className={cn(
                  "rounded-2xl border overflow-hidden transition-all",
                  y.isCurrent
                    ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20"
                    : "border-border/60 bg-card/60"
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedYearId(isExpanded ? null : y.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-bold text-sm text-foreground">{y.name}</span>
                    {y.isCurrent && (
                      <Badge className="text-[10px] font-semibold rounded-full bg-indigo-600 text-white px-2 py-0 h-4">
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(y.startDate).toLocaleDateString()} – {new Date(y.endDate).toLocaleDateString()}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <AcademicTermsSection year={y} />
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

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AcademicStructureTab() {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white p-6 shadow-xl">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-white border border-white/20 mb-3">
            <Layers className="w-3.5 h-3.5 text-violet-200" />
            <span>Academic Structure</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">School Structure Management</h2>
          <p className="text-indigo-100 text-sm mt-1 max-w-xl">
            Configure grades, sections, streams, subjects, and academic terms — the building blocks of your school.
          </p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <Tabs defaultValue="grades_sections" className="space-y-6">
        <TabsList className="bg-muted/70 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 border border-border/50">
          <TabsTrigger value="grades_sections" className="rounded-xl text-xs font-semibold gap-1.5 py-2">
            <GraduationCap className="w-3.5 h-3.5" />
            Grades &amp; Sections
          </TabsTrigger>
          <TabsTrigger value="streams" className="rounded-xl text-xs font-semibold gap-1.5 py-2">
            <Layers className="w-3.5 h-3.5" />
            Streams / Tracks
          </TabsTrigger>
          <TabsTrigger value="subjects" className="rounded-xl text-xs font-semibold gap-1.5 py-2">
            <BookMarked className="w-3.5 h-3.5" />
            Subjects
          </TabsTrigger>
          <TabsTrigger value="subject_assignments" className="rounded-xl text-xs font-semibold gap-1.5 py-2">
            <BookOpen className="w-3.5 h-3.5" />
            Subject Assignment
          </TabsTrigger>
          <TabsTrigger value="terms" className="rounded-xl text-xs font-semibold gap-1.5 py-2">
            <Calendar className="w-3.5 h-3.5" />
            Academic Terms
          </TabsTrigger>
        </TabsList>

        {/* Grades & Sections */}
        <TabsContent value="grades_sections" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-6">
              <GradesSection />
            </Card>
            <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-6">
              <SectionsSection />
            </Card>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
            <strong>How it works:</strong> Grades (e.g. Grade 1, Grade 9) and Sections (e.g. A, B, C) combine to form classes. "Grade 9 – Section A" is a unique class. Sections are shared across all grades.
          </div>
        </TabsContent>

        {/* Streams */}
        <TabsContent value="streams">
          <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-6 max-w-xl">
            <StreamsSection />
          </Card>
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            <strong>Optional:</strong> Streams group students in higher grades by academic track (e.g. Natural Science, Social Science, Technical). Only define these if your school uses academic tracks.
          </div>
        </TabsContent>

        {/* Subjects */}
        <TabsContent value="subjects">
          <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-6">
            <SubjectsSection />
          </Card>
          <div className="mt-4 p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 text-xs text-violet-800 dark:text-violet-300">
            <strong>Tip:</strong> Each subject needs a unique code (e.g. MATH, ENG, SCI). After adding subjects, assign them to classes in the "Subject Assignment" tab. Inactive subjects are hidden from student portals but retained in gradebook data.
          </div>
        </TabsContent>

        {/* Subject Assignment by Grade & Stream */}
        <TabsContent value="subject_assignments">
          <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-6">
            <GradeSubjectsSection />
          </Card>
          <div className="mt-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
            <strong>Curriculum Allocation:</strong> Assign subjects to classes based on Grade and Stream. For Grades 11 and 12, selecting the stream (Natural Science or Social Science) is mandatory. Teacher assignments and mark submissions are automatically constrained to these assigned subjects.
          </div>
        </TabsContent>

        {/* Academic Terms */}
        <TabsContent value="terms">
          <Card className="rounded-3xl border border-border/70 bg-card/80 backdrop-blur-sm p-6">
            <AcademicYearsWithTermsSection />
          </Card>
          <div className="mt-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-800 dark:text-indigo-300">
            <strong>Tip:</strong> Terms belong to a specific academic year. Expand a year to add its semesters/quarters. Mark one term as "Active" to use it in gradebook reports and attendance tracking.
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}
