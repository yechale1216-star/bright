"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { notifications } from "@/lib/utils/notifications"
import { db } from "@/lib/db/database"
import { ShieldCheck, UserCheck, AlertTriangle, UserX, ArrowRightLeft, GraduationCap, Archive, Save, RefreshCw, Info } from "lucide-react"

interface StatusPolicy {
  portalAccess: 'FULL' | 'HISTORICAL_ONLY' | 'DENIED'
  canViewReportCards: boolean
  canViewAttendanceHistory: boolean
  affectsActiveCount: boolean
  canMarkAttendance?: boolean
}

interface LifecyclePolicy {
  activePolicy: StatusPolicy
  withdrawnPolicy: StatusPolicy
  transferredPolicy: StatusPolicy
  graduatedPolicy: StatusPolicy
  suspendedPolicy: StatusPolicy
  archivedPolicy: StatusPolicy
  sessionRevocationOnChange: boolean
  autoRestoreOnSuspensionEnd: boolean
}

const DEFAULT_POLICY: LifecyclePolicy = {
  activePolicy: {
    portalAccess: 'FULL',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: true,
  },
  withdrawnPolicy: {
    portalAccess: 'HISTORICAL_ONLY',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: false,
  },
  transferredPolicy: {
    portalAccess: 'HISTORICAL_ONLY',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: false,
  },
  graduatedPolicy: {
    portalAccess: 'HISTORICAL_ONLY',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: false,
  },
  suspendedPolicy: {
    portalAccess: 'FULL',
    canViewReportCards: true,
    canViewAttendanceHistory: true,
    affectsActiveCount: true,
    canMarkAttendance: false,
  },
  archivedPolicy: {
    portalAccess: 'DENIED',
    canViewReportCards: false,
    canViewAttendanceHistory: false,
    affectsActiveCount: false,
  },
  sessionRevocationOnChange: false,
  autoRestoreOnSuspensionEnd: true,
}

export function LifecyclePolicySettings() {
  const [policy, setPolicy] = useState<LifecyclePolicy>(DEFAULT_POLICY)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadPolicy()
  }, [])

  const loadPolicy = async () => {
    setIsLoading(true)
    try {
      const data = await db.getLifecyclePolicy()
      if (data) {
        setPolicy(data)
      }
    } catch (err: any) {
      console.error("Failed to load lifecycle policy:", err)
      notifications.error("Error", "Could not load lifecycle policy settings.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Validate ACTIVE has FULL portal access
      if (policy.activePolicy.portalAccess !== 'FULL') {
        notifications.error("Invalid Configuration", "Active students must always have FULL portal access.")
        setIsSaving(false)
        return
      }

      const updated = await db.updateLifecyclePolicy(policy)
      if (updated) {
        setPolicy(updated)
      }
      notifications.success("Settings Saved", "Student lifecycle policies have been updated successfully.")
    } catch (err: any) {
      notifications.error("Error Saving", err.message || "Failed to update lifecycle policies.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm("Reset all lifecycle and portal policies to safe system defaults?")) {
      setPolicy(DEFAULT_POLICY)
      notifications.info("Defaults Loaded", "Click 'Save Lifecycle Policies' to apply default settings.")
    }
  }

  const updateStatusField = (
    key: keyof Omit<LifecyclePolicy, 'sessionRevocationOnChange' | 'autoRestoreOnSuspensionEnd'>,
    field: keyof StatusPolicy,
    value: any
  ) => {
    setPolicy((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" className="text-primary" />
        <span className="ml-3 text-sm font-semibold text-muted-foreground">Loading lifecycle policies...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Student Lifecycle & Portal Access Policies
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Configure how each of the six student statuses governs portal permissions, historical report card access, attendance eligibility, and session management.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="rounded-xl font-bold text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl font-black text-xs uppercase tracking-wider gap-2 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSaving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
            Save Lifecycle Policies
          </Button>
        </div>
      </div>

      {/* Global Automation & Session Policies */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wider">Account & Session Enforcement</CardTitle>
          <CardDescription className="text-xs">System-wide behaviors for status changes and expiration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Session Revocation on Status Change
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Instantly revoke cached JWT credentials and active portal sessions when a student is suspended, withdrawn, or archived.
              </p>
            </div>
            <Switch
              checked={policy.sessionRevocationOnChange}
              onCheckedChange={(val) => setPolicy({ ...policy, sessionRevocationOnChange: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Automatic Suspension Expiry & Restoration
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Automatically restore suspended students to ACTIVE status when their suspension end date has passed.
              </p>
            </div>
            <Switch
              checked={policy.autoRestoreOnSuspensionEnd}
              onCheckedChange={(val) => setPolicy({ ...policy, autoRestoreOnSuspensionEnd: val })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Grid of the 6 Student Statuses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. ACTIVE */}
        <Card className="rounded-2xl border-emerald-200 dark:border-emerald-950/50 bg-emerald-50/20 dark:bg-emerald-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-black text-emerald-900 dark:text-emerald-300">1. Active Status</CardTitle>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-none text-[10px] font-black uppercase">
                Normal Operations
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Enrolled students eligible for all standard school activities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-emerald-100 dark:border-emerald-900/30">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Portal Access:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">FULL (Standard)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-emerald-100 dark:border-emerald-900/30">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Included in Active Count:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">Yes</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Academic Operations:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">Attendance, Marks, Exams</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. SUSPENDED */}
        <Card className="rounded-2xl border-amber-200 dark:border-amber-950/50 bg-amber-50/20 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-black text-amber-900 dark:text-amber-300">2. Suspended Status</CardTitle>
              </div>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-none text-[10px] font-black uppercase">
                Temporary
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Temporary restriction under authorized disciplinary decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Portal Access Policy</Label>
              <Select
                value={policy.suspendedPolicy.portalAccess}
                onValueChange={(val: any) => updateStatusField('suspendedPolicy', 'portalAccess', val)}
              >
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">FULL — Normal Portal Access</SelectItem>
                  <SelectItem value="HISTORICAL_ONLY">HISTORICAL_ONLY — View Past Records</SelectItem>
                  <SelectItem value="DENIED">DENIED — Block Portal Access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Allow Attendance Marking
              </Label>
              <Switch
                checked={policy.suspendedPolicy.canMarkAttendance ?? false}
                onCheckedChange={(val) => updateStatusField('suspendedPolicy', 'canMarkAttendance', val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. WITHDRAWN */}
        <Card className="rounded-2xl border-rose-200 dark:border-rose-950/50 bg-rose-50/20 dark:bg-rose-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <CardTitle className="text-sm font-black text-rose-900 dark:text-rose-300">3. Withdrawn Status</CardTitle>
              </div>
              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border-none text-[10px] font-black uppercase">
                Departed
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Student has officially left the school without a recorded transfer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Portal Access Policy</Label>
              <Select
                value={policy.withdrawnPolicy.portalAccess}
                onValueChange={(val: any) => updateStatusField('withdrawnPolicy', 'portalAccess', val)}
              >
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HISTORICAL_ONLY">HISTORICAL_ONLY — View Past Records</SelectItem>
                  <SelectItem value="DENIED">DENIED — Deny Portal Access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Allow Historical Report Card Access
              </Label>
              <Switch
                checked={policy.withdrawnPolicy.canViewReportCards}
                onCheckedChange={(val) => updateStatusField('withdrawnPolicy', 'canViewReportCards', val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. TRANSFERRED */}
        <Card className="rounded-2xl border-blue-200 dark:border-blue-950/50 bg-blue-50/20 dark:bg-blue-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-sm font-black text-blue-900 dark:text-blue-300">4. Transferred Status</CardTitle>
              </div>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border-none text-[10px] font-black uppercase">
                Transferred Out
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Student has transferred to another institution with destination recorded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Portal Access Policy</Label>
              <Select
                value={policy.transferredPolicy.portalAccess}
                onValueChange={(val: any) => updateStatusField('transferredPolicy', 'portalAccess', val)}
              >
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HISTORICAL_ONLY">HISTORICAL_ONLY — View Past Records</SelectItem>
                  <SelectItem value="DENIED">DENIED — Deny Portal Access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Allow Historical Report Card Access
              </Label>
              <Switch
                checked={policy.transferredPolicy.canViewReportCards}
                onCheckedChange={(val) => updateStatusField('transferredPolicy', 'canViewReportCards', val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. GRADUATED */}
        <Card className="rounded-2xl border-purple-200 dark:border-purple-950/50 bg-purple-50/20 dark:bg-purple-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <CardTitle className="text-sm font-black text-purple-900 dark:text-purple-300">5. Graduated Status</CardTitle>
              </div>
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border-none text-[10px] font-black uppercase">
                Alumni
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Student completed final grade & graduation requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div>
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Alumni Portal Access</Label>
              <Select
                value={policy.graduatedPolicy.portalAccess}
                onValueChange={(val: any) => updateStatusField('graduatedPolicy', 'portalAccess', val)}
              >
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs bg-white dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HISTORICAL_ONLY">HISTORICAL_ONLY — Alumni Records Access</SelectItem>
                  <SelectItem value="DENIED">DENIED — Close Portal Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Allow Alumni Report Cards & Transcripts
              </Label>
              <Switch
                checked={policy.graduatedPolicy.canViewReportCards}
                onCheckedChange={(val) => updateStatusField('graduatedPolicy', 'canViewReportCards', val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 6. ARCHIVED */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <CardTitle className="text-sm font-black text-slate-800 dark:text-slate-300">6. Archived Status</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-black uppercase">
                Historical Archive
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Permanent administrative retention. Operational editing blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Portal Access:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">DENIED (Locked)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Data Deletion Policy:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Preserved permanently</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>Official records remain accessible to authorized school administrators.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

