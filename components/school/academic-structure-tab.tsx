"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Pencil, Trash2, BookMarked, Layers, 
  LayoutGrid, GraduationCap, ChevronDown, ChevronRight, 
  Calendar
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
            <strong>Tip:</strong> Each subject needs a unique code (e.g. MATH, ENG, SCI). After adding subjects, assign them to teachers via Teacher Assignments. Inactive subjects are hidden from student portals but retained in gradebook data.
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
