'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Shield, ShieldCheck, ArrowLeft, Plus, Save, Trash2,
  Loader2, Sparkles, Settings2, CheckCircle2, XCircle,
  Edit2, Eye, Power, Lock, Search, Filter, ShieldAlert, Layers
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/utils/fetch-with-timeout'
import { API_URL } from '@/lib/api-config'
import { cn } from '@/lib/utils/utils'
import { notifications } from '@/lib/utils/notifications'

const MODULE_DEFINITIONS: Record<string, { label: string; actions: string[] }> = {
  students:             { label: 'Students Directory',      actions: ['view', 'create', 'edit', 'delete'] },
  teachers:             { label: 'Teacher Management',      actions: ['view', 'create', 'edit', 'delete'] },
  assignments:          { label: 'Teacher Assignments',     actions: ['view', 'assign', 'remove'] },
  promotion:            { label: 'Student Promotion',       actions: ['view', 'promote', 'reverse'] },
  attendance:           { label: 'Attendance Tracking',     actions: ['view', 'mark', 'export'] },
  attendance_analytics: { label: 'Attendance Analytics',   actions: ['view', 'export'] },
  discipline:           { label: 'Discipline & Conduct',    actions: ['view', 'create', 'resolve'] },
  calls:                { label: 'Call Center',             actions: ['view', 'make'] },
  communication:        { label: 'Chat & Messaging',        actions: ['view', 'send'] },
  announcements:        { label: 'School Announcements',    actions: ['view', 'create'] },
  reports:              { label: 'Analytics & Reports',     actions: ['view', 'export'] },
  settings:             { label: 'School Settings',         actions: ['view', 'edit'] },
  profile:              { label: 'Own Profile',             actions: ['view', 'edit'] },
  users:                { label: 'User & Role Admin',       actions: ['view', 'create_user', 'edit_user', 'delete_user', 'manage_roles'] },
}

const DEFAULT_PERMISSIONS_TEMPLATE = {
  students:             { view: true,  create: false, edit: false, delete: false },
  teachers:             { view: false, create: false, edit: false, delete: false },
  assignments:          { view: false, assign: false, remove: false },
  promotion:            { view: false, promote: false, reverse: false },
  attendance:           { view: true,  mark: false, export: false },
  attendance_analytics: { view: false, export: false },
  discipline:           { view: false, create: false, resolve: false },
  calls:                { view: false, make: false },
  communication:        { view: true,  send: false },
  reports:              { view: false, export: false },
  announcements:        { view: true,  create: false },
  settings:             { view: false, edit: false },
  profile:              { view: true,  edit: true },
  users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
}

const FALLBACK_SYSTEM_ROLES = [
  {
    id: 'system-registrar',
    key: 'registrar',
    name: 'Student Registration Officer (Registrar)',
    description: 'Responsible for student intake, enrollment processing, and maintaining official student records.',
    color: '#6366f1',
    isSystem: true,
    isActive: true,
    permissions: {
      students:             { view: true,  create: true,  edit: true,  delete: false },
      teachers:             { view: true,  create: false, edit: false, delete: false },
      assignments:          { view: true,  assign: false, remove: false },
      promotion:            { view: true,  promote: false, reverse: false },
      attendance:           { view: true,  mark: false, export: false },
      attendance_analytics: { view: true,  export: false },
      discipline:           { view: false, create: false, resolve: false },
      calls:                { view: false, make: false },
      communication:        { view: true,  send: false },
      reports:              { view: true,  export: true },
      announcements:        { view: true,  create: false },
      settings:             { view: false, edit: false },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
  {
    id: 'system-discipline-officer',
    key: 'discipline_officer',
    name: 'Student Discipline & Conduct Officer',
    description: 'Manages student behavioral incidents, discipline cases, follow-ups, and conduct records.',
    color: '#f59e0b',
    isSystem: true,
    isActive: true,
    permissions: {
      students:             { view: true,  create: false, edit: false, delete: false },
      teachers:             { view: true,  create: false, edit: false, delete: false },
      assignments:          { view: false, assign: false, remove: false },
      promotion:            { view: false, promote: false, reverse: false },
      attendance:           { view: true,  mark: false, export: false },
      attendance_analytics: { view: false, export: false },
      discipline:           { view: true,  create: true,  resolve: true },
      calls:                { view: false, make: false },
      communication:        { view: true,  send: true },
      reports:              { view: true,  export: true },
      announcements:        { view: true,  create: false },
      settings:             { view: false, edit: false },
      profile:              { view: true,  edit: true },
      users:                { view: false, create_user: false, edit_user: false, delete_user: false, manage_roles: false },
    },
  },
]

export default function RoleManagementList() {
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'active' | 'disabled'>('all')

  // Modals state
  const [editingPermissionsRole, setEditingPermissionsRole] = useState<any | null>(null)
  const [editablePermissions, setEditablePermissions] = useState<Record<string, Record<string, boolean>>>({})

  const [editingMetadataRole, setEditingMetadataRole] = useState<any | null>(null)
  const [metadataForm, setMetadataForm] = useState({ name: '', description: '', color: '#6366f1', isActive: true })

  const getHeaders = () => {
    const token = localStorage.getItem('attendance_token')
    const schoolId = localStorage.getItem('x-school-id')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (schoolId) headers['x-school-id'] = schoolId
    return headers
  }

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ success: boolean; data: any[] }>(`${API_URL}/api/roles`, { headers: getHeaders() })
      const fetched = (res.data && res.data.length > 0) ? res.data : FALLBACK_SYSTEM_ROLES
      setRoles(fetched)
    } catch (err: any) {
      setRoles(FALLBACK_SYSTEM_ROLES)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  // Open permissions matrix modal
  const openPermissionsModal = (role: any) => {
    setEditingPermissionsRole(role)
    setEditablePermissions(JSON.parse(JSON.stringify(role.permissions || DEFAULT_PERMISSIONS_TEMPLATE)))
  }

  // Open edit metadata modal
  const openMetadataModal = (role: any) => {
    setEditingMetadataRole(role)
    setMetadataForm({
      name: role.name || '',
      description: role.description || '',
      color: role.color || '#6366f1',
      isActive: role.isActive !== false,
    })
  }

  // Save Permissions Matrix
  const handleSavePermissions = async () => {
    if (!editingPermissionsRole) return
    setSaving(true)
    try {
      if (editingPermissionsRole.id && !editingPermissionsRole.id.startsWith('system-')) {
        await apiFetch(`${API_URL}/api/roles/${editingPermissionsRole.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ permissions: editablePermissions }),
        })
      }
      setRoles(prev => prev.map(r => r.key === editingPermissionsRole.key ? { ...r, permissions: editablePermissions } : r))
      notifications.success('Policy Saved', `Updated permissions matrix for '${editingPermissionsRole.name}'`)
      setEditingPermissionsRole(null)
    } catch (err: any) {
      notifications.error('Save Failed', err.message || 'Could not update role policy.')
    } finally {
      setSaving(false)
    }
  }

  // Save Role Metadata Details
  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMetadataRole) return
    setSaving(true)
    try {
      if (editingMetadataRole.id && !editingMetadataRole.id.startsWith('system-')) {
        await apiFetch(`${API_URL}/api/roles/${editingMetadataRole.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(metadataForm),
        })
      }
      setRoles(prev => prev.map(r => r.key === editingMetadataRole.key ? { ...r, ...metadataForm } : r))
      notifications.success('Role Details Saved', `Updated parameters for '${metadataForm.name}'`)
      setEditingMetadataRole(null)
    } catch (err: any) {
      notifications.error('Save Failed', err.message || 'Could not update role details.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle active status
  const handleToggleStatus = async (role: any) => {
    const newStatus = !role.isActive
    try {
      if (role.id && !role.id.startsWith('system-')) {
        await apiFetch(`${API_URL}/api/roles/${role.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ isActive: newStatus }),
        })
      }
      setRoles(prev => prev.map(r => r.key === role.key ? { ...r, isActive: newStatus } : r))
      notifications.info(newStatus ? 'Role Activated' : 'Role Disabled', `'${role.name}' is now ${newStatus ? 'Active' : 'Disabled'}`)
    } catch (err: any) {
      notifications.error('Toggle Failed', err.message || 'Could not update role status.')
    }
  }

  const togglePermission = (module: string, action: string) => {
    setEditablePermissions(prev => {
      const next = { ...prev }
      if (!next[module]) next[module] = {}
      next[module] = { ...next[module], [action]: !next[module][action] }
      return next
    })
  }

  // Filtered Roles
  const filteredRoles = roles.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.key.toLowerCase().includes(searchQuery.toLowerCase())
    if (filterType === 'active') return matchesSearch && r.isActive
    if (filterType === 'disabled') return matchesSearch && !r.isActive
    return matchesSearch
  })

  // Count active modules for a role
  const countEnabledModules = (permissions: Record<string, Record<string, boolean>> = {}) => {
    let count = 0
    Object.values(permissions).forEach(actions => {
      if (Object.values(actions).some(Boolean)) count++
    })
    return count
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/school/admin/users-and-roles">
            <button className="p-2 rounded-xl border border-border hover:bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-foreground">Role Directory & Policies</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage system default roles with actions and permission matrices</p>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-muted-foreground">Total System Roles</p>
            <Shield className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{roles.length}</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-muted-foreground">Active Roles</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{roles.filter(r => r.isActive).length}</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-muted-foreground">Controlled Modules</p>
            <Layers className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{Object.keys(MODULE_DEFINITIONS).length}</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-muted-foreground">Configured Policies</p>
            <ShieldCheck className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{roles.filter(r => countEnabledModules(r.permissions) > 0).length}</p>
        </div>
      </div>

      {/* Search & Filter controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-border/60 bg-card">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search roles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'active', 'disabled'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all',
                filterType === type
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary'
              )}
            >
              {type === 'all' ? 'All Roles' : type === 'active' ? 'Active Roles' : 'Disabled'}
            </button>
          ))}
        </div>
      </div>

      {/* Roles List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-2xl border border-border animate-pulse" />)}
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border/60">
            <ShieldAlert className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-bold text-foreground">No roles match your search</p>
            <p className="text-xs text-muted-foreground mt-1">Try clearing search or filter options</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoles.map(role => {
              const enabledModules = countEnabledModules(role.permissions)
              return (
                <div
                  key={role.id || role.key}
                  className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 hover:shadow-md transition-all duration-200"
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: role.color || '#6366f1' }}
                      >
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">{role.name}</h3>
                          <Badge variant={role.isSystem ? 'secondary' : 'outline'} className="text-[10px]">
                            {role.isSystem ? 'System Default' : 'Custom'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">key: {role.key}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        role.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/30'
                      )}>
                        {role.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {role.description || 'No description provided.'}
                  </p>

                  {/* Permission badge summary */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      {enabledModules} of 16 Modules Enabled
                    </span>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      {/* Manage Permissions */}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPermissionsModal(role)}
                        className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Permissions Matrix
                      </Button>

                      {/* Edit Role Details */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMetadataModal(role)}
                        className="gap-1.5 text-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Details
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Toggle Active Status */}
                      <button
                        onClick={() => handleToggleStatus(role)}
                        title={role.isActive ? 'Disable Role' : 'Activate Role'}
                        className={cn(
                          'p-2 rounded-xl transition-colors',
                          role.isActive ? 'hover:bg-rose-50 text-emerald-600 dark:hover:bg-rose-950/20' : 'hover:bg-emerald-50 text-muted-foreground'
                        )}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal 1: Permissions Matrix Modal ── */}
      {editingPermissionsRole && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: editingPermissionsRole.color }}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{editingPermissionsRole.name} — Permission Policy</h2>
                  <p className="text-xs text-muted-foreground">Toggle action checkboxes to configure module access</p>
                </div>
              </div>
              <button onClick={() => setEditingPermissionsRole(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-secondary">
                <ArrowLeft className="w-5 h-5 rotate-90" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(MODULE_DEFINITIONS).map(([moduleKey, def]) => {
                const modulePerms = editablePermissions[moduleKey] || {}
                return (
                  <div key={moduleKey} className="p-4 rounded-2xl border border-border/60 bg-secondary/10 space-y-3">
                    <p className="text-xs font-bold uppercase text-foreground tracking-wide flex items-center justify-between">
                      <span>{def.label}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">({moduleKey})</span>
                    </p>
                    <div className="space-y-2 pt-1">
                      {def.actions.map(action => (
                        <div key={action} className="flex items-center justify-between py-1">
                          <span className="text-xs font-medium capitalize text-muted-foreground">{action}</span>
                          <Switch
                            checked={!!modulePerms[action]}
                            onCheckedChange={() => togglePermission(moduleKey, action)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditingPermissionsRole(null)}>
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} disabled={saving} className="bg-primary gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Policy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Role Details / Metadata Modal ── */}
      {editingMetadataRole && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Edit Role Details</h2>
                <p className="text-xs text-muted-foreground">Customize display name, description, color, and status</p>
              </div>
              <button onClick={() => setEditingMetadataRole(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-secondary">
                <ArrowLeft className="w-5 h-5 rotate-90" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Role Display Name</label>
                <Input
                  value={metadataForm.name}
                  onChange={e => setMetadataForm({ ...metadataForm, name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Role Description & Responsibilities</label>
                <Input
                  value={metadataForm.description}
                  onChange={e => setMetadataForm({ ...metadataForm, description: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Role Color Badge</label>
                <div className="flex items-center gap-3 mt-2">
                  {['#6366f1', '#f59e0b', '#14b8a6', '#ec4899', '#8b5cf6', '#10b981', '#ef4444', '#3b82f6'].map(color => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setMetadataForm({ ...metadataForm, color })}
                      className={cn(
                        'w-7 h-7 rounded-full transition-transform',
                        metadataForm.color === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-muted-foreground">Role Active Status</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={metadataForm.isActive}
                    onCheckedChange={checked => setMetadataForm({ ...metadataForm, isActive: checked })}
                  />
                  <span className={cn('text-xs font-bold', metadataForm.isActive ? 'text-emerald-600' : 'text-rose-600')}>
                    {metadataForm.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setEditingMetadataRole(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMetadata} disabled={saving} className="bg-primary gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
