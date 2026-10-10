'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, Plus, Shield, User, Filter, CheckCircle2, XCircle, Mail, Phone, Lock,
  Edit, Trash2, Power, ArrowLeft, MoreHorizontal, ShieldCheck, Sparkles, Users, Activity, X,
  Camera, ShieldAlert, ScanFace, Tag, Check, AlertTriangle, Layers, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { apiFetch } from '@/lib/utils/fetch-with-timeout'
import { API_URL } from '@/lib/api-config'
import { notifications } from '@/lib/utils/notifications'
import { PhoneInput } from '@/components/ui/phone-input'
import { queryCache } from '@/lib/utils/query-cache'
import { validatePassword, PASSWORD_REQUIREMENTS } from '@/lib/utils/password-validator'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useSchoolSettings } from '@/hooks/use-school-settings'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Lazily load the face enroll modal (heavy — loads face-api.js models)
const StaffFaceEnrollModal = dynamic(
  () => import('@/components/school/staff-face-enroll').then(m => m.StaffFaceEnrollModal),
  { ssr: false }
)

function notifyUserDataChanged() {
  queryCache.invalidate(/^users_/)
  queryCache.invalidate(/^teachers_/)
  queryCache.invalidate(/^assignments_/)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('userDataChanged'))
    window.dispatchEvent(new CustomEvent('teacherDataChanged'))
  }
}

// Default system roles to ensure dropdowns always have complete options
const DEFAULT_SYSTEM_ROLES = [
  { key: 'school_admin', name: 'School Administrator', description: 'Full administrative access to manage school operations, staff, students, and settings.', color: '#e11d48', isSystem: true, sortOrder: 1 },
  { key: 'academic_head', name: 'Academic Head / Coordinator', description: 'Oversees curriculum structure, teacher assignments, assessment policies, exams, and report cards.', color: '#8b5cf6', isSystem: true, sortOrder: 2 },
  { key: 'registrar', name: 'Student Registration Officer (Registrar)', description: 'Responsible for student intake, enrollment processing, and maintaining official student records.', color: '#6366f1', isSystem: true, sortOrder: 3 },
  { key: 'discipline_officer', name: 'Student Discipline & Conduct Officer', description: 'Manages student behavioral incidents, discipline cases, follow-ups, and conduct records.', color: '#f59e0b', isSystem: true, sortOrder: 4 },
  { key: 'librarian', name: 'Librarian', description: 'Manages school library catalogue, book borrow/returns, reservations, and inventory.', color: '#06b6d4', isSystem: true, sortOrder: 5 },
  { key: 'transport_manager', name: 'Transport Manager', description: 'Manages vehicle fleet, transit routes, bus stops, and student transportation assignments.', color: '#f97316', isSystem: true, sortOrder: 6 },
  { key: 'staff_attendance_officer', name: 'Staff Attendance & HR Officer', description: 'Monitors staff daily check-ins, biometric facial attempts, leave applications, and time tracking.', color: '#14b8a6', isSystem: true, sortOrder: 7 },
  { key: 'teacher', name: 'Teacher', description: 'Classroom and subject instructor with access to student attendance and teaching tools.', color: '#3b82f6', isSystem: true, sortOrder: 8 },
  { key: 'staff', name: 'General Staff', description: 'School operational and administrative staff member with self-service portal access.', color: '#10b981', isSystem: true, sortOrder: 9 },
]

export default function UsersAndRolesPage() {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Global attendance mode setting
  const { settings: schoolSettings } = useSchoolSettings()
  const globalAttendanceMode: "DAILY" | "SESSION" | "BOTH" = (() => {
    const raw = schoolSettings?.attendanceModeSetting ?? schoolSettings?.attendance_mode_setting ?? schoolSettings?.staffAttendanceMode ?? schoolSettings?.staff_attendance_mode ?? "daily"
    const upper = String(raw ?? "DAILY").trim().toUpperCase()
    if (upper === "SESSION" || upper === "SESSION_BASED") return "SESSION"
    if (upper === "BOTH") return "BOTH"
    return "DAILY"
  })()

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff',
    attendanceMode: 'DAILY',
  })

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: '',
    password: '',
    is_active: true,
    attendanceMode: 'DAILY',
  })

  // Centralized Role Types Management Modals
  const [showManageRolesModal, setShowManageRolesModal] = useState(false)
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<any | null>(null)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [roleActionLoadingId, setRoleActionLoadingId] = useState<string | null>(null)
  const [roleForm, setRoleForm] = useState({
    name: '',
    key: '',
    description: '',
    color: '#6366f1',
    isActive: true,
  })

  // Biometric enrollment modal state
  const [enrollTarget, setEnrollTarget] = useState<any | null>(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  // Post-create enroll prompt state
  const [newlyCreatedUser, setNewlyCreatedUser] = useState<any | null>(null)
  const [showPostCreateEnroll, setShowPostCreateEnroll] = useState(false)

  // Action Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null
    const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (schoolId) headers['x-school-id'] = schoolId
    return headers
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/users`, { headers: getHeaders() }),
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/roles?includeInactive=true`, { headers: getHeaders() }).catch(() => ({ success: true, data: [] }))
      ])
      setUsers(usersRes.data ?? [])
      setRoles(rolesRes.data ?? [])
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    const handleUserChanged = () => {
      fetchData()
    }
    window.addEventListener("userDataChanged", handleUserChanged)
    return () => window.removeEventListener("userDataChanged", handleUserChanged)
  }, [])

  // Merge server roles with default system roles ensuring complete options
  const allRoles = useMemo(() => {
    const roleMap = new Map<string, any>()
    DEFAULT_SYSTEM_ROLES.forEach(r => {
      roleMap.set(r.key, { ...r, isActive: true })
    })
    roles.forEach(r => {
      roleMap.set(r.key, { ...roleMap.get(r.key), ...r })
    })
    return Array.from(roleMap.values())
  }, [roles])

  // Active roles available for registration & assignment dropdowns (excluding student and parent)
  const activeStaffRoles = useMemo(() => {
    return allRoles.filter(r => r.isActive !== false && !['parent', 'student'].includes(r.key))
  }, [allRoles])

  // Get dynamic role badge info
  const getRoleBadge = (roleKey: string) => {
    const found = allRoles.find(r => r.key === roleKey)
    if (found) {
      return {
        label: found.name,
        color: found.color || '#6366f1',
        isSystem: found.isSystem,
        isActive: found.isActive !== false,
      }
    }
    const defaultLabels: Record<string, string> = {
      admin: 'School Administrator',
      school_admin: 'School Administrator',
      academic_head: 'Academic Head / Coordinator',
      teacher: 'Teacher',
      registrar: 'Registrar',
      discipline_officer: 'Discipline Officer',
      librarian: 'Librarian',
      transport_manager: 'Transport Manager',
      staff_attendance_officer: 'Staff Attendance & HR Officer',
      hr_officer: 'Staff Attendance & HR Officer',
      staff: 'General Staff',
    }
    return {
      label: defaultLabels[roleKey] || roleKey.replace(/_/g, ' '),
      color: '#64748b',
      isSystem: false,
      isActive: true,
    }
  }

  // Handle Staff Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.full_name || !createForm.email || !createForm.password || !createForm.role) {
      notifications.error('Validation Error', 'Please fill in all required fields.')
      return
    }

    const pv = validatePassword(createForm.password)
    if (!pv.isValid) {
      notifications.error('Password Requirements', pv.message)
      return
    }

    setCreating(true)
    try {
      const res = await apiFetch<{ success: boolean; data: any }>(`${API_URL}/api/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...createForm,
          password_hash: createForm.password,
          attendanceMode: createForm.attendanceMode || 'DAILY',
        }),
      })

      const createdUser = res.data
      const badge = getRoleBadge(createForm.role)
      notifications.success('User Created', `Added ${createForm.full_name} as ${badge.label}`)
      setShowCreateModal(false)
      setCreateForm({ full_name: '', email: '', phone: '', password: '', role: activeStaffRoles[0]?.key || 'staff', attendanceMode: 'DAILY' })
      notifyUserDataChanged()
      await fetchData()

      // Prompt admin to enroll biometrics for the new user
      if (createdUser?.id) {
        setNewlyCreatedUser({ id: createdUser.id, full_name: createForm.full_name, role: createForm.role })
        setShowPostCreateEnroll(true)
      }
    } catch (err: any) {
      notifications.error('Creation Failed', err.message || 'Could not create user.')
    } finally {
      setCreating(false)
    }
  }

  const openEditModal = (u: any) => {
    setEditingUser(u)
    setEditForm({
      full_name: u.full_name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'staff',
      password: '',
      is_active: u.is_active !== false,
      attendanceMode: String(u.attendanceMode || 'DAILY').trim().toUpperCase() === 'SESSION' ? 'SESSION' : 'DAILY',
    })
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setUpdating(true)
    try {
      const payload: any = {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role,
        is_active: editForm.is_active,
        attendanceMode: editForm.attendanceMode || 'DAILY',
      }
      if (editForm.password.trim()) {
        const pv = validatePassword(editForm.password.trim())
        if (!pv.isValid) {
          notifications.error('Password Requirements', pv.message)
          return
        }
        payload.password_hash = editForm.password.trim()
      }

      await apiFetch(`${API_URL}/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      })

      notifications.success('User Updated', `Updated profile for ${editForm.full_name}`)
      setEditingUser(null)
      notifyUserDataChanged()
      fetchData()
    } catch (err: any) {
      notifications.error('Update Failed', err.message || 'Could not update user.')
    } finally {
      setUpdating(false)
    }
  }

  const handleToggleStatus = async (u: any) => {
    setActionLoadingId(u.id)
    try {
      const newStatus = !u.is_active
      await apiFetch(`${API_URL}/api/users/${u.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: newStatus }),
      })

      notifications.success('Status Changed', `${u.full_name} is now ${newStatus ? 'Active' : 'Inactive'}`)
      notifyUserDataChanged()
      fetchData()
    } catch (err: any) {
      notifications.error('Status Toggle Failed', err.message || 'Could not change user status.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteUser = async (u: any) => {
    if (!confirm(`Are you sure you want to delete user '${u.full_name}'? This action cannot be undone.`)) return

    setActionLoadingId(u.id)
    try {
      await apiFetch(`${API_URL}/api/users/${u.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })

      notifications.success('User Deleted', `Removed ${u.full_name} from school staff.`)
      notifyUserDataChanged()
      fetchData()
    } catch (err: any) {
      notifications.error('Delete Failed', err.message || 'Could not delete user.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // ─── ROLE TYPES MANAGEMENT HANDLERS ───
  const openCreateRoleModal = () => {
    setRoleForm({
      name: '',
      key: '',
      description: '',
      color: '#6366f1',
      isActive: true,
    })
    setShowCreateRoleModal(true)
  }

  const openEditRoleModal = (role: any) => {
    setEditingRole(role)
    setRoleForm({
      name: role.name || '',
      key: role.key || '',
      description: role.description || '',
      color: role.color || '#6366f1',
      isActive: role.isActive !== false,
    })
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleForm.name.trim()) {
      notifications.error('Validation Error', 'Role name is required.')
      return
    }

    setIsSavingRole(true)
    try {
      if (editingRole) {
        // Update existing role
        await apiFetch(`${API_URL}/api/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            name: roleForm.name,
            description: roleForm.description,
            color: roleForm.color,
            isActive: roleForm.isActive,
          }),
        })
        notifications.success('Role Updated', `Updated role type '${roleForm.name}'.`)
        setEditingRole(null)
      } else {
        // Create new role
        await apiFetch(`${API_URL}/api/roles`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            name: roleForm.name,
            key: roleForm.key.trim() || undefined,
            description: roleForm.description,
            color: roleForm.color,
          }),
        })
        notifications.success('Role Created', `Created role type '${roleForm.name}'.`)
        setShowCreateRoleModal(false)
      }

      await fetchData()
    } catch (err: any) {
      notifications.error('Role Operation Failed', err.message || 'Could not save role type.')
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleToggleRoleActive = async (role: any) => {
    setRoleActionLoadingId(role.id)
    try {
      const newStatus = !role.isActive
      await apiFetch(`${API_URL}/api/roles/${role.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ isActive: newStatus }),
      })
      notifications.success(
        'Role Status Changed',
        `Role '${role.name}' is now ${newStatus ? 'Active' : 'Inactive'}.`
      )
      await fetchData()
    } catch (err: any) {
      notifications.error('Failed to change role status', err.message || 'Could not toggle role status.')
    } finally {
      setRoleActionLoadingId(null)
    }
  }

  const handleDeleteRole = async (role: any) => {
    if (role.userCount > 0) {
      notifications.error(
        'Cannot Delete Role',
        `Cannot delete '${role.name}' because ${role.userCount} staff member(s) are assigned to it. Deactivate the role instead.`
      )
      return
    }

    if (!confirm(`Are you sure you want to delete custom role '${role.name}'? This cannot be undone.`)) return

    setRoleActionLoadingId(role.id)
    try {
      await apiFetch(`${API_URL}/api/roles/${role.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      notifications.success('Role Deleted', `Removed role '${role.name}'.`)
      await fetchData()
    } catch (err: any) {
      notifications.error('Delete Role Failed', err.message || 'Could not delete role.')
    } finally {
      setRoleActionLoadingId(null)
    }
  }

  const openEnrollModal = (u: any) => {
    setEnrollTarget(u)
    setShowEnrollModal(true)
  }

  const handleEnrollmentDone = () => {
    setShowEnrollModal(false)
    setEnrollTarget(null)
    fetchData()
  }

  const visibleRoles = useMemo(() => {
    return allRoles.filter(r => !['parent', 'student'].includes(r.key))
  }, [allRoles])

  const staffUsers = useMemo(() => {
    return users.filter(u => !['parent', 'student'].includes(u.role))
  }, [users])

  const filteredUsers = useMemo(() => {
    return staffUsers.filter(u => {
      const matchesSearch =
        !search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone?.includes(search)
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [staffUsers, search, roleFilter])

  const enrolledCount = staffUsers.filter(u => !!u.faceEnrollment?.id).length

  return (
    <div className="relative min-h-full p-4 md:p-8 pb-24 space-y-8 max-w-7xl mx-auto w-full">
      {/* ── Ambient Glassmorphic Background Blur Spheres ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-purple-500/15 rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      {/* ── Frosted Glass Top Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 md:p-8 shadow-2xl shadow-indigo-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
      >
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/25">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              User & Staff Management
            </h1>
          </div>
          <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
            Configure school staff accounts, centralized role types, biometric enrollment, and permissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto z-10">
          <Button
            onClick={() => setShowManageRolesModal(true)}
            variant="outline"
            className="h-11 px-4 rounded-2xl gap-2 font-bold text-xs border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
          >
            <Layers className="w-4 h-4" />
            Manage Role Types ({visibleRoles.length})
          </Button>

          <Button
            onClick={openCreateRoleModal}
            variant="outline"
            className="h-11 px-4 rounded-2xl gap-2 font-bold text-xs border-primary/30 text-primary hover:bg-primary/10"
          >
            <Tag className="w-4 h-4" />
            Add Role Type
          </Button>

          <Button
            onClick={() => {
              if (activeStaffRoles.length > 0 && !createForm.role) {
                setCreateForm(prev => ({ ...prev, role: activeStaffRoles[0].key, attendanceMode: 'DAILY' }))
              }
              setShowCreateModal(true)
            }}
            className="h-11 px-5 rounded-2xl gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 active:scale-95 transition-all border border-white/20"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </Button>
        </div>
      </motion.div>

      {/* ── Glassmorphic Dashboard Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Accounts */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 hover:border-indigo-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <User className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Accounts</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : staffUsers.length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Registered Staff</p>
        </motion.div>

        {/* Roles Available */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 hover:border-violet-500/30 transition-all duration-300 cursor-pointer"
          onClick={() => setShowManageRolesModal(true)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role Types</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : visibleRoles.length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {visibleRoles.filter(r => r.isActive !== false).length} Active Types (Click to manage)
          </p>
        </motion.div>

        {/* Active Accounts */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 hover:border-emerald-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : staffUsers.filter(u => u.is_active).length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Enabled & Authorized</p>
        </motion.div>

        {/* Biometric Enrolled */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 hover:border-cyan-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
              <ScanFace className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Biometric</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : enrolledCount}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Face Templates Enrolled</p>
        </motion.div>
      </div>

      {/* ── Glass Role Breakdown Chips ── */}
      <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg shadow-slate-900/5">
        <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" /> Role Distribution:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {visibleRoles.slice(0, 5).map(r => {
            const count = users.filter(u => u.role === r.key).length
            return (
              <span
                key={r.id || r.key}
                style={{ borderColor: `${r.color || '#6366f1'}40`, backgroundColor: `${r.color || '#6366f1'}15`, color: r.color || '#6366f1' }}
                className="px-3.5 py-1.5 rounded-xl border font-bold backdrop-blur-md flex items-center gap-1.5"
              >
                <span style={{ backgroundColor: r.color || '#6366f1' }} className="w-2 h-2 rounded-full" />
                {r.name}: {count}
              </span>
            )
          })}
          {visibleRoles.length > 5 && (
            <button
              onClick={() => setShowManageRolesModal(true)}
              className="text-xs font-bold text-primary hover:underline pl-1"
            >
              +{visibleRoles.length - 5} more...
            </button>
          )}
        </div>
      </div>

      {/* ── Glass Search & Filter Control Bar ── */}
      <div className="sticky top-4 z-10 rounded-[24px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-xl shadow-slate-900/5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search staff members by name, email or phone..."
              className="pl-10 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-4 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-md cursor-pointer"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">All Role Categories</option>
            {visibleRoles.map(r => (
              <option key={r.key} value={r.key}>
                {r.name} {!r.isActive ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Glassmorphic Users Table ── */}
      <div className="rounded-[28px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-slate-900/5 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-white/40 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
              <Users className="w-8 h-8" />
            </div>
            <p className="font-black text-lg text-slate-900 dark:text-white">No staff members found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No users match your query. Clear filters or add a new staff member.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-[0_1px_0_0_rgba(255,255,255,0.2)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                <tr className="border-b border-white/40 dark:border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Assigned Role</th>
                  {globalAttendanceMode === 'BOTH' && (
                    <th className="px-6 py-4">Attendance Mode</th>
                  )}
                  <th className="px-6 py-4 hidden sm:table-cell">Contact Phone</th>
                  <th className="px-6 py-4">Biometric Status</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/30 dark:divide-white/5">
                {filteredUsers.map(u => {
                  const badge = getRoleBadge(u.role)
                  const isBusy = actionLoadingId === u.id
                  const isEnrolled = !!u.faceEnrollment?.id
                  return (
                    <tr key={u.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 border border-primary/20 flex items-center justify-center font-black text-primary flex-shrink-0 shadow-sm">
                            {u.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{u.full_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          style={{
                            backgroundColor: `${badge.color}18`,
                            borderColor: `${badge.color}35`,
                            color: badge.color,
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border backdrop-blur-md"
                        >
                          <span style={{ backgroundColor: badge.color }} className="w-1.5 h-1.5 rounded-full" />
                          {badge.label}
                        </span>
                      </td>
                      {globalAttendanceMode === 'BOTH' && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold border backdrop-blur-md',
                            (u.attendanceMode || 'DAILY').toUpperCase() === 'SESSION'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900'
                          )}>
                            {(u.attendanceMode || 'DAILY').toUpperCase() === 'SESSION' ? 'Session-Based' : 'Daily'}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 hidden sm:table-cell text-xs font-medium text-slate-600 dark:text-slate-400">
                        {u.phone ? (
                          <span className="font-mono text-[13px]">{u.phone}</span>
                        ) : (
                          <span className="text-slate-400 italic">No phone added</span>
                        )}
                      </td>
                      {/* ── Biometric Status Column ── */}
                      <td className="px-6 py-4">
                        {isEnrolled ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-300 backdrop-blur-md w-fit">
                              <ShieldCheck className="w-3 h-3" />
                              Enrolled ✓
                            </span>
                            {u.faceEnrollment?.enrolledAt && (
                              <span className="text-[10px] text-slate-400 pl-0.5">
                                {new Date(u.faceEnrollment.enrolledAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300 backdrop-blur-md">
                            <ShieldAlert className="w-3 h-3" />
                            Not Enrolled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border backdrop-blur-md',
                          u.is_active 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        )}>
                          <span className={cn('w-2 h-2 rounded-full', u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Enroll / Re-enroll Biometrics */}
                          <button
                            onClick={() => openEnrollModal(u)}
                            disabled={isBusy}
                            title={isEnrolled ? 'Re-enroll Face Biometrics' : 'Enroll Face Biometrics'}
                            className={cn(
                              'p-2.5 rounded-xl border border-transparent transition-all active:scale-95 shadow-sm',
                              isEnrolled
                                ? 'hover:bg-cyan-500/10 hover:border-cyan-500/20 text-cyan-600 hover:text-cyan-700'
                                : 'hover:bg-amber-500/10 hover:border-amber-500/20 text-slate-400 hover:text-amber-600'
                            )}
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(u)}
                            disabled={isBusy}
                            title="Edit User"
                            className="p-2.5 rounded-xl border border-transparent hover:border-white/40 dark:hover:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-500 hover:text-primary transition-all active:scale-95 shadow-sm"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isBusy}
                            title={u.is_active ? 'Disable Account' : 'Enable Account'}
                            className={cn(
                              'p-2.5 rounded-xl border border-transparent transition-all active:scale-95 shadow-sm',
                              u.is_active 
                                ? 'hover:bg-amber-500/10 hover:border-amber-500/20 text-emerald-600 hover:text-amber-600' 
                                : 'hover:bg-emerald-500/10 hover:border-emerald-500/20 text-slate-400 hover:text-emerald-600'
                            )}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isBusy}
                            title="Delete User"
                            className="p-2.5 rounded-xl border border-transparent hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-600 transition-all active:scale-95 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL 1: CREATE STAFF MEMBER MODAL (DYNAMIC ROLES) ─── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Add Staff Member</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Create a staff profile with centralized role assignment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 overflow-y-auto flex-1 min-h-0 py-3 pr-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                  <Input
                    required
                    placeholder="e.g. Almaz Bekele"
                    value={createForm.full_name}
                    onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                  <Input
                    required
                    type="email"
                    placeholder="almaz@school.edu"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                  <div className="mt-1">
                    <PhoneInput
                      value={createForm.phone}
                      onChange={val => setCreateForm({ ...createForm, phone: val })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Initial Password *</label>
                  <Input
                    required
                    type="password"
                    placeholder="Min. 8 chars (A-Z, a-z, 0-9)"
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{PASSWORD_REQUIREMENTS}</p>
                </div>

                {/* Live validation feedback for create */}
                {createForm.password && (() => {
                  const pv = validatePassword(createForm.password)
                  return (
                    <div className="grid grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-white/5">
                      {[
                        { label: '8+ characters', ok: pv.hasMinLength },
                        { label: 'Uppercase (A–Z)', ok: pv.hasUppercase },
                        { label: 'Lowercase (a–z)', ok: pv.hasLowercase },
                        { label: 'Number (0–9)', ok: pv.hasNumber },
                      ].map(({ label, ok }) => (
                        <div
                          key={label}
                          className={`flex items-center gap-1.5 text-xs font-medium ${
                            ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                          }`}
                        >
                          {ok ? <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          {label}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* ── Dynamic Database-Backed Role Selection Dropdown ── */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Role Type *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        openCreateRoleModal()
                      }}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Role Type
                    </button>
                  </div>
                  <select
                    required
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={createForm.role}
                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    {activeStaffRoles.map(r => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {/* Show selected role description */}
                  {(() => {
                    const selectedRoleObj = activeStaffRoles.find(r => r.key === createForm.role)
                    if (selectedRoleObj?.description) {
                      return (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-1 italic">
                          {selectedRoleObj.description}
                        </p>
                      )
                    }
                    return null
                  })()}
                </div>

                {/* Attendance Mode — only shown when global setting is BOTH */}
                {globalAttendanceMode === 'BOTH' && (
                  <div className="space-y-1.5 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                    <label htmlFor="create_attendance_mode" className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      Attendance Mode
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Assign the attendance tracking mode for this staff member (global setting is <strong>Both</strong>).
                    </p>
                    <Select
                      value={createForm.attendanceMode}
                      onValueChange={val => setCreateForm(prev => ({ ...prev, attendanceMode: val }))}
                    >
                      <SelectTrigger id="create_attendance_mode" className="rounded-xl border-indigo-200 dark:border-indigo-700 bg-white/80 dark:bg-slate-900/80 focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold h-11 w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily — Single Check-In / Check-Out</SelectItem>
                        <SelectItem value="SESSION">Session-Based — Morning &amp; Afternoon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Biometric note */}
                <div className="flex items-start gap-2.5 rounded-xl bg-cyan-500/8 border border-cyan-500/20 p-3">
                  <ScanFace className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    After creating this account, you can immediately register the staff member's biometric face template.
                  </p>
                </div>
              </form>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl h-11 px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser}
                  disabled={creating} 
                  className="h-11 px-5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-bold shadow-lg shadow-primary/25"
                >
                  {creating ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: EDIT STAFF MEMBER MODAL ─── */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Edit Staff Profile</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Update account details and role assignment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4 overflow-y-auto flex-1 min-h-0 py-3 pr-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                  <Input
                    required
                    value={editForm.full_name}
                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                  <Input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                  <div className="mt-1">
                    <PhoneInput
                      value={editForm.phone}
                      onChange={val => setEditForm({ ...editForm, phone: val })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Role Type *</label>
                  <select
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    {visibleRoles.map(r => (
                      <option key={r.key} value={r.key}>
                        {r.name} {!r.isActive ? '(Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attendance Mode — only shown when global setting is BOTH */}
                {globalAttendanceMode === 'BOTH' && (
                  <div className="space-y-1.5 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                    <label htmlFor="edit_attendance_mode" className="text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      Attendance Mode
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Assign the attendance tracking mode for this staff member (global setting is <strong>Both</strong>).
                    </p>
                    <Select
                      value={editForm.attendanceMode}
                      onValueChange={val => setEditForm(prev => ({ ...prev, attendanceMode: val }))}
                    >
                      <SelectTrigger id="edit_attendance_mode" className="rounded-xl border-indigo-200 dark:border-indigo-700 bg-white/80 dark:bg-slate-900/80 focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold h-11 w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily — Single Check-In / Check-Out</SelectItem>
                        <SelectItem value="SESSION">Session-Based — Morning &amp; Afternoon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reset Password (Optional)</label>
                  <Input
                    type="password"
                    placeholder="Min. 8 chars to change (or leave empty to keep)"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">{PASSWORD_REQUIREMENTS}</p>
                </div>

                {/* Live validation feedback for edit */}
                {editForm.password && (() => {
                  const pv = validatePassword(editForm.password)
                  return (
                    <div className="grid grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-white/5">
                      {[
                        { label: '8+ characters', ok: pv.hasMinLength },
                        { label: 'Uppercase (A–Z)', ok: pv.hasUppercase },
                        { label: 'Lowercase (a–z)', ok: pv.hasLowercase },
                        { label: 'Number (0–9)', ok: pv.hasNumber },
                      ].map(({ label, ok }) => (
                        <div
                          key={label}
                          className={`flex items-center gap-1.5 text-xs font-medium ${
                            ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                          }`}
                        >
                          {ok ? <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          {label}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editForm.is_active}
                    onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="edit_is_active" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Account is Active & Enabled
                  </label>
                </div>

                {/* Biometric Face Data Section in Edit Modal */}
                <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/30 backdrop-blur-sm p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Biometric Face Data</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      {editingUser?.faceEnrollment?.id ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                            <ShieldCheck className="w-3 h-3" />
                            Enrolled ✓
                          </span>
                          {editingUser.faceEnrollment.enrolledAt && (
                            <p className="text-[10px] text-slate-400 mt-1 pl-0.5">
                              Last enrolled: {new Date(editingUser.faceEnrollment.enrolledAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300">
                          <ShieldAlert className="w-3 h-3" />
                          Not Enrolled
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs font-bold rounded-xl border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                      onClick={() => {
                        setEditingUser(null)
                        openEnrollModal(editingUser)
                      }}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {editingUser?.faceEnrollment?.id ? 'Re-enroll Face' : 'Enroll Face'}
                    </Button>
                  </div>
                </div>
              </form>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl h-11 px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateUser}
                  disabled={updating} 
                  className="h-11 px-5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-bold shadow-lg shadow-primary/25"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 3: MANAGE ROLE TYPES MODAL (CENTRALIZED) ─── */}
      <AnimatePresence>
        {showManageRolesModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Centralized Role Types</h2>
                    <p className="text-xs text-slate-500">Manage, activate/deactivate, and create school staff roles</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={openCreateRoleModal}
                    className="gap-1.5 text-xs font-bold rounded-xl bg-primary text-white"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Role Type
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowManageRolesModal(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Roles List Table */}
              <div className="flex-1 overflow-y-auto my-3 border rounded-2xl min-h-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-950/80 sticky top-0 backdrop-blur-sm z-10 border-b">
                    <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">Role Name & Key</th>
                      <th className="px-3 py-3">Description</th>
                      <th className="px-3 py-3 text-center">Staff Count</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRoles.map(r => {
                      const isActionBusy = roleActionLoadingId === r.id
                      return (
                        <tr key={r.id || r.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span style={{ backgroundColor: r.color || '#6366f1' }} className="w-3 h-3 rounded-full shrink-0 shadow-sm" />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white leading-tight">{r.name}</p>
                                <p className="font-mono text-[10px] text-slate-400 mt-0.5">{r.key}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-slate-500 max-w-[200px] truncate" title={r.description}>
                            {r.description || '—'}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                            {r.userCount ?? 0}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <button
                              onClick={() => handleToggleRoleActive(r)}
                              disabled={isActionBusy}
                              title={r.isActive !== false ? 'Click to deactivate' : 'Click to activate'}
                              className={cn(
                                'px-2 py-0.5 rounded-lg font-bold text-[10px] border transition-all',
                                r.isActive !== false
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                  : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                              )}
                            >
                              {r.isActive !== false ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditRoleModal(r)}
                                disabled={isActionBusy}
                                title="Edit Role"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {!r.isSystem && (
                                <button
                                  onClick={() => handleDeleteRole(r)}
                                  disabled={isActionBusy || r.userCount > 0}
                                  title={
                                    r.userCount > 0
                                      ? `Cannot delete: ${r.userCount} staff members are assigned`
                                      : 'Delete Role'
                                  }
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    r.userCount > 0
                                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                      : 'hover:bg-rose-500/10 text-slate-400 hover:text-rose-600'
                                  )}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0 text-xs">
                <p className="text-[11px] text-slate-400">
                  Default system roles cannot be deleted, but can be deactivated if not needed.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => setShowManageRolesModal(false)}
                  className="rounded-xl h-10 px-4 text-xs font-bold"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 4: CREATE / EDIT ROLE TYPE MODAL ─── */}
      <AnimatePresence>
        {(showCreateRoleModal || editingRole) && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full shadow-2xl backdrop-blur-2xl my-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {editingRole ? 'Edit Role Type' : 'Add Role Type'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {editingRole ? 'Update role properties' : 'Create a new staff role in the central registry'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRoleModal(false)
                    setEditingRole(null)
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRole} className="space-y-4 py-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Role Name *</label>
                  <Input
                    required
                    placeholder="e.g. Lab Technician, Accountant, Librarian"
                    value={roleForm.name}
                    onChange={e => {
                      const nameVal = e.target.value
                      setRoleForm(prev => ({
                        ...prev,
                        name: nameVal,
                        // Auto-generate key if creating new role
                        ...(!editingRole ? { key: nameVal.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') } : {})
                      }))
                    }}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

                {!editingRole && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Unique Role Key / Code</label>
                    <Input
                      placeholder="e.g. lab_technician"
                      value={roleForm.key}
                      onChange={e => setRoleForm({ ...roleForm, key: e.target.value })}
                      className="mt-1 h-10 font-mono text-xs rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Lowercase alphanumeric with underscores only.</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Describe duties, responsibilities or purpose of this staff role..."
                    value={roleForm.description}
                    onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                    className="w-full mt-1 p-3 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Badge Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={roleForm.color}
                      onChange={e => setRoleForm({ ...roleForm, color: e.target.value })}
                      className="w-10 h-10 rounded-xl cursor-pointer border border-white/40 bg-transparent p-0.5"
                    />
                    <Input
                      value={roleForm.color}
                      onChange={e => setRoleForm({ ...roleForm, color: e.target.value })}
                      className="h-10 font-mono text-xs rounded-xl bg-white/70 dark:bg-slate-950/70"
                    />
                  </div>
                </div>

                {editingRole && (
                  <div className="flex items-center gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="role_is_active"
                      checked={roleForm.isActive}
                      onChange={e => setRoleForm({ ...roleForm, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="role_is_active" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      Role is Active & Available in Registration Dropdowns
                    </label>
                  </div>
                )}
              </form>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateRoleModal(false)
                    setEditingRole(null)
                  }}
                  className="rounded-xl h-10 px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveRole}
                  disabled={isSavingRole}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-bold shadow-lg shadow-primary/25"
                >
                  {isSavingRole ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role Type'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 5: POST-CREATE ENROLL PROMPT ─── */}
      <AnimatePresence>
        {showPostCreateEnroll && newlyCreatedUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-sm w-full shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <ScanFace className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Enroll Biometrics Now?</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{newlyCreatedUser.full_name}</span> has been registered.
                    Would you like to capture their face template for attendance verification?
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <Button
                    variant="ghost"
                    className="flex-1 rounded-xl h-11 text-xs font-bold"
                    onClick={() => {
                      setShowPostCreateEnroll(false)
                      setNewlyCreatedUser(null)
                    }}
                  >
                    Skip
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 gap-2"
                    onClick={() => {
                      setShowPostCreateEnroll(false)
                      setEnrollTarget(newlyCreatedUser)
                      setShowEnrollModal(true)
                      setNewlyCreatedUser(null)
                    }}
                  >
                    <Camera className="w-4 h-4" />
                    Enroll Face
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 6: BIOMETRIC ENROLLMENT MODAL ─── */}
      {showEnrollModal && enrollTarget && (
        <StaffFaceEnrollModal
          open={showEnrollModal}
          onOpenChange={(open) => {
            if (!open) handleEnrollmentDone()
          }}
          onEnrolled={handleEnrollmentDone}
          preselectedUserId={enrollTarget.id}
          preselectedUserName={enrollTarget.full_name}
        />
      )}
    </div>
  )
}
