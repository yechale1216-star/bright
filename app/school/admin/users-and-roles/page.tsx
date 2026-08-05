'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, Plus, Shield, User, Filter, CheckCircle, XCircle, Mail, Phone, Lock,
  Edit, Trash2, Power, Loader2, ArrowLeft, MoreHorizontal, ShieldCheck
} from 'lucide-react'
import { cn } from '@/lib/utils/utils'
import { apiFetch } from '@/lib/utils/fetch-with-timeout'
import { API_URL } from '@/lib/api-config'
import { notifications } from '@/lib/utils/notifications'
import Link from 'next/link'
import { PhoneInput } from '@/components/ui/phone-input'
import { queryCache } from '@/lib/utils/query-cache'

function notifyUserDataChanged() {
  queryCache.invalidate(/^users_/)
  queryCache.invalidate(/^teachers_/)
  queryCache.invalidate(/^assignments_/)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('userDataChanged'))
    window.dispatchEvent(new CustomEvent('teacherDataChanged'))
  }
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin: { label: 'School Admin', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' },
  school_admin: { label: 'School Admin', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' },
  teacher: { label: 'Teacher', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  registrar: { label: 'Registrar', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' },
  discipline_officer: { label: 'Discipline Officer', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  call_center: { label: 'Call Center', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400' },
  staff: { label: 'Staff', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
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
    const token = localStorage.getItem('attendance_token')
    const schoolId = localStorage.getItem('x-school-id')
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
        body: JSON.stringify(createForm),
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

  // Dynamic available role choices (combines standard + custom roles)
  const allRoleChoices = [
    { key: 'school_admin', label: 'School Admin' },
    { key: 'teacher', label: 'Teacher' },
    { key: 'registrar', label: 'Student Registration Officer (Registrar)' },
    { key: 'discipline_officer', label: 'Discipline & Conduct Officer' },
    { key: 'call_center', label: 'School Call Center Officer' },
    { key: 'staff', label: 'General Staff' },
    ...roles.filter(r => !['school_admin', 'admin', 'teacher', 'registrar', 'discipline_officer', 'call_center', 'staff'].includes(r.key)).map(r => ({
      key: r.key,
      label: r.name
    }))
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">User & Role Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage school staff accounts, role assignments, user status, and custom permissions
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link href="/school/admin/users-and-roles/roles">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Manage System Roles
            </Button>
          </Link>
          <Button onClick={() => setShowCreateModal(true)} className="gap-2 w-full sm:w-auto bg-primary">
            <Plus className="w-4 h-4" />
            Add Staff Member
          </Button>
        </div>
      </div>

      {/* ─── DASHBOARD OVERVIEW METRICS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Accounts</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {loading ? <span className="inline-block w-8 h-6 bg-secondary rounded animate-pulse" /> : users.length}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">Total Staff Members</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Policies</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {loading ? <span className="inline-block w-8 h-6 bg-secondary rounded animate-pulse" /> : roles.length}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">Configured System Roles</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Active</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {loading ? <span className="inline-block w-8 h-6 bg-secondary rounded animate-pulse" /> : users.filter(u => u.is_active).length}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">Active Accounts</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-xs font-semibold text-rose-600">Inactive</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {loading ? <span className="inline-block w-8 h-6 bg-secondary rounded animate-pulse" /> : users.filter(u => !u.is_active).length}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">Inactive / Deactivated</p>
        </div>
      </div>

      {/* Role Breakdown Summary */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-muted-foreground uppercase tracking-wider">Staff Role Breakdown:</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
            Registrars: {users.filter(u => u.role === 'registrar').length}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold">
            Discipline Officers: {users.filter(u => u.role === 'discipline_officer').length}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold">
            Call Center: {users.filter(u => u.role === 'call_center').length}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold">
            Teachers: {users.filter(u => u.role === 'teacher').length}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold">
            Admins: {users.filter(u => ['admin', 'school_admin'].includes(u.role)).length}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, email or phone..."
                className="pl-10 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {allRoleChoices.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-foreground">No staff members found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or click "Add Staff Member"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-left text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">User Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.map(u => {
                  const badge = ROLE_BADGES[u.role] || { label: u.role, color: 'bg-secondary text-foreground' }
                  const isBusy = actionLoadingId === u.id
                  return (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                            {u.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold', badge.color)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {u.phone || 'No phone'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-xs font-semibold',
                          u.is_active ? 'text-emerald-600' : 'text-slate-400'
                        )}>
                          {u.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {/* USER ACTIONS COLUMN */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(u)}
                            disabled={isBusy}
                            title="Edit User & Role"
                            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isBusy}
                            title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              u.is_active ? 'hover:bg-amber-50 text-emerald-600 hover:text-amber-600' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                            )}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isBusy}
                            title="Delete User"
                            className="p-2 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
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

      {/* Add User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Add New Staff Member</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
                <Input
                  required
                  placeholder="e.g. Jane Doe"
                  value={createForm.full_name}
                  onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email Address *</label>
                <Input
                  required
                  type="email"
                  placeholder="jane@school.edu"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                <PhoneInput
                  value={createForm.phone}
                  onChange={val => setCreateForm({ ...createForm, phone: val })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Password *</label>
                <Input
                  required
                  type="password"
                  placeholder="Initial password"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">System / Custom Role *</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
                  value={createForm.role}
                  onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  {allRoleChoices.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="bg-primary">
                  {creating ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User & Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground">Edit User & Role Assignment</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
                <Input
                  required
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email Address *</label>
                <Input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                <PhoneInput
                  value={editForm.phone}
                  onChange={val => setEditForm({ ...editForm, phone: val })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Assigned Role *</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none"
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  {allRoleChoices.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Reset Password (Optional)</label>
                <Input
                  type="password"
                  placeholder="Leave empty to keep current password"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editForm.is_active}
                  onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="edit_is_active" className="text-xs font-semibold text-foreground cursor-pointer">
                  Account Status Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updating} className="bg-primary">
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
