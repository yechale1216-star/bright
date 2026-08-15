'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, Plus, Shield, User, Filter, CheckCircle2, XCircle, Mail, Phone, Lock,
  Edit, Trash2, Power, Loader2, ArrowLeft, MoreHorizontal, ShieldCheck, Sparkles, Users, Activity
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { apiFetch } from '@/lib/utils/fetch-with-timeout'
import { API_URL } from '@/lib/api-config'
import { notifications } from '@/lib/utils/notifications'
import { PhoneInput } from '@/components/ui/phone-input'
import { queryCache } from '@/lib/utils/query-cache'
import { motion, AnimatePresence } from 'framer-motion'

function notifyUserDataChanged() {
  queryCache.invalidate(/^users_/)
  queryCache.invalidate(/^teachers_/)
  queryCache.invalidate(/^assignments_/)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('userDataChanged'))
    window.dispatchEvent(new CustomEvent('teacherDataChanged'))
  }
}

const ROLE_BADGES: Record<string, { label: string; color: string; dotColor: string }> = {
  admin: { 
    label: 'School Admin', 
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/10',
    dotColor: 'bg-rose-500'
  },
  school_admin: { 
    label: 'School Admin', 
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/10',
    dotColor: 'bg-rose-500'
  },
  teacher: { 
    label: 'Teacher', 
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm shadow-blue-500/10',
    dotColor: 'bg-blue-500'
  },
  registrar: { 
    label: 'Registrar', 
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shadow-sm shadow-indigo-500/10',
    dotColor: 'bg-indigo-500'
  },
  discipline_officer: { 
    label: 'Discipline Officer', 
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-sm shadow-amber-500/10',
    dotColor: 'bg-amber-500'
  },
  staff: { 
    label: 'Staff', 
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shadow-sm shadow-emerald-500/10',
    dotColor: 'bg-emerald-500'
  },
}

export default function UsersAndRolesPage() {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'registrar',
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
  })

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
        apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/roles`, { headers: getHeaders() }).catch(() => ({ success: true, data: [] }))
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.full_name || !createForm.email || !createForm.password) {
      notifications.error('Validation Error', 'Please fill in all required fields.')
      return
    }

    setCreating(true)
    try {
      await apiFetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...createForm,
          password_hash: createForm.password,
        }),
      })

      notifications.success('User Created', `Added ${createForm.full_name} as ${ROLE_BADGES[createForm.role]?.label || createForm.role}`)
      setShowCreateModal(false)
      setCreateForm({ full_name: '', email: '', phone: '', password: '', role: 'registrar' })
      notifyUserDataChanged()
      fetchData()
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
      }
      if (editForm.password.trim()) {
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

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search)
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  // Dynamic available role choices (combines standard staff roles, excluding teacher and admin)
  const allRoleChoices = [
    { key: 'registrar', label: 'Student Registration Officer (Registrar)' },
    { key: 'discipline_officer', label: 'Discipline & Conduct Officer' },
    { key: 'staff', label: 'General Staff' },
    ...roles.filter(r => !['school_admin', 'admin', 'teacher', 'registrar', 'discipline_officer', 'staff', 'call_center', 'call_officer', 'school_call_officer', 'caller'].includes(r.key)).map(r => ({
      key: r.key,
      label: r.name
    }))
  ]

  return (
    <div className="relative min-h-screen p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full overflow-hidden">
      {/* ── Ambient Glassmorphic Background Blur Spheres ── */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 -right-24 w-96 h-96 bg-purple-500/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

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
            Configure school accounts, role permissions, and active operational status
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto z-10">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-11 px-5 rounded-2xl gap-2 w-full sm:w-auto bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 active:scale-95 transition-all border border-white/20"
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
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : users.length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Registered Staff</p>
        </motion.div>

        {/* Roles Available */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 hover:border-violet-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Positions</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : allRoleChoices.length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Active Staff Role Types</p>
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
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : users.filter(u => u.is_active).length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Enabled & Authorized</p>
        </motion.div>

        {/* Inactive Accounts */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="group rounded-[24px] border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-5 shadow-xl shadow-slate-900/5 hover:-translate-y-1 hover:border-rose-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
              <XCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Suspended</span>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" /> : users.filter(u => !u.is_active).length}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Inactive Staff Accounts</p>
        </motion.div>
      </div>

      {/* ── Glass Role Breakdown Chips ── */}
      <div className="rounded-[22px] border border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg shadow-slate-900/5">
        <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" /> Active Distribution:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold backdrop-blur-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Registrars: {users.filter(u => u.role === 'registrar').length}
          </span>
          <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold backdrop-blur-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Discipline Officers: {users.filter(u => u.role === 'discipline_officer').length}
          </span>
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold backdrop-blur-md flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            General Staff: {users.filter(u => u.role === 'staff').length}
          </span>
        </div>
      </div>

      {/* ── Glass Search & Filter Control Bar ── */}
      <div className="rounded-[24px] border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-xl shadow-slate-900/5">
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
            {allRoleChoices.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/40 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold backdrop-blur-sm">
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Assigned Role</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Contact Phone</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/30 dark:divide-white/5">
                {filteredUsers.map(u => {
                  const badge = ROLE_BADGES[u.role] || { 
                    label: u.role, 
                    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
                    dotColor: 'bg-slate-400'
                  }
                  const isBusy = actionLoadingId === u.id
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
                        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold backdrop-blur-md', badge.color)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', badge.dotColor)} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell text-xs font-medium text-slate-600 dark:text-slate-400">
                        {u.phone ? (
                          <span className="font-mono text-[13px]">{u.phone}</span>
                        ) : (
                          <span className="text-slate-400 italic">No phone added</span>
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

      {/* ── Glassmorphic Create Staff Member Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Add Staff Member</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Create a staff profile with system access</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
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
                    placeholder="Set account password"
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Staff Role *</label>
                  <select
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={createForm.role}
                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    {allRoleChoices.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl h-11 px-4 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={creating} 
                    className="h-11 px-5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-bold shadow-lg shadow-primary/25"
                  >
                    {creating ? 'Creating...' : 'Create Account'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Glassmorphic Edit Staff Member Modal ── */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white/90 dark:bg-slate-900/90 border border-white/40 dark:border-white/10 rounded-[28px] p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Edit Staff Profile</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update account details and role assignment</p>
                </div>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4">
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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Staff Role *</label>
                  <select
                    className="w-full mt-1 px-3.5 h-11 rounded-xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    {allRoleChoices.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reset Password (Optional)</label>
                  <Input
                    type="password"
                    placeholder="Leave empty to keep current password"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    className="mt-1 h-11 rounded-xl bg-white/70 dark:bg-slate-950/70 border-white/40 dark:border-white/10"
                  />
                </div>

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

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setEditingUser(null)}
                    className="rounded-xl h-11 px-4 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updating} 
                    className="h-11 px-5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white text-xs font-bold shadow-lg shadow-primary/25"
                  >
                    {updating ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
