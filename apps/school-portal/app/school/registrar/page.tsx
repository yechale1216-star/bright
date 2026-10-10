'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { db } from '@/lib/db/database'
import {
  Users, UserPlus, Table, CheckCircle2,
  ArrowUpRight, GraduationCap, Sparkles,
  ShieldCheck, ArrowRight, Layers
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/utils'
import Link from 'next/link'
import { useCalendar } from '@/lib/context/calendar-context'
import { useGreeting } from '@/lib/utils/greeting-utils'

export default function RegistrarDashboardPage() {
  const { formatDate } = useCalendar()
  const { user } = useAuth()
  const greeting = useGreeting('registrar')
  const [students, setStudents] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      db.getStudents().catch(() => []),
      db.getGrades().catch(() => []),
      db.getSections().catch(() => [])
    ]).then(([st, gr, sec]) => {
      setStudents(st || [])
      setGrades(gr || [])
      setSections(sec || [])
    }).finally(() => setLoading(false))
  }, [])

  const total = students.length
  const activeCount = students.filter(s => s.status === 'ACTIVE' || !s.status).length
  const maleCount = students.filter(s => s.gender?.toLowerCase() === 'male').length
  const femaleCount = students.filter(s => s.gender?.toLowerCase() === 'female').length

  const todayStr = formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Group students by grade
  const gradeBreakdown = grades.map(g => {
    const count = students.filter(s => s.gradeId === g.id || s.grade?.id === g.id).length
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return { id: g.id, name: g.name, count, pct }
  })

  // Recent 5 registered students
  const recentStudents = [...students].reverse().slice(0, 5)

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Registrar Command Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            {greeting}, {user?.name?.split(' ')[0] || 'Registrar'}
          </h1>
          <p className="text-sm text-indigo-100/80 max-w-xl">
            {todayStr} — Manage student admissions, individual registrations, bulk imports, and official academic records.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Link href="/school/registrar/students">
            <Button className="bg-white text-indigo-950 hover:bg-indigo-50 font-bold rounded-2xl h-11 px-5 gap-2 shadow-lg transition-transform hover:-translate-y-0.5">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              New Student Registration
            </Button>
          </Link>

          <Link href="/school/registrar/students">
            <Button variant="outline" className="border-white/20 hover:bg-white/10 text-white font-bold rounded-2xl h-11 px-5 gap-2 backdrop-blur-md">
              <Table className="w-4 h-4 text-indigo-200" />
              Bulk Import
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar — desktop first: 4 cols always on large screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total Enrolled */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Enrolled</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{total}</p>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> {activeCount} Active
            </p>
          </div>
        </div>

        {/* Gender Demographics */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-teal-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Gender Split</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {maleCount}M / {femaleCount}F
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
              {total > 0 ? Math.round((maleCount / total) * 100) : 0}% Male · {total > 0 ? Math.round((femaleCount / total) * 100) : 0}% Female
            </p>
          </div>
        </div>

        {/* Academic Grades */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Grade Levels</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{grades.length}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
              {sections.length} Section{sections.length !== 1 ? 's' : ''} Configured
            </p>
          </div>
        </div>

        {/* Registration Status */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-5 py-4 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Status</p>
            <p className="text-lg font-black text-emerald-600 leading-tight">Operational</p>
            <p className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Intake Open
            </p>
          </div>
        </div>

      </div>

      {/* Main Grid: Grade Breakdown + Recent Intake Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade Breakdown Progress Bars */}
        <div className="lg:col-span-1 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-500" />
              Enrollment by Grade
            </h2>
            <Link href="/school/registrar/reports" className="text-xs font-bold text-indigo-600 hover:underline">
              Full Analytics →
            </Link>
          </div>

          {gradeBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No grade levels found</p>
          ) : (
            <div className="space-y-4 pt-2">
              {gradeBreakdown.map(gb => (
                <div key={gb.id || gb.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{gb.name}</span>
                    <span className="font-semibold text-slate-500">{gb.count} students ({gb.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(gb.pct, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link href="/school/registrar/students">
              <Button variant="secondary" className="w-full rounded-2xl text-xs font-bold gap-2">
                Open Full Student Directory
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Registered Students */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Recent Student Admissions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest students enrolled into the system</p>
            </div>

            <Link href="/school/registrar/students">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                Register Student
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
            </div>
          ) : recentStudents.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No students enrolled yet</p>
              <p className="text-xs text-slate-400 mt-1">Click below to start student intake</p>
              <Link href="/school/registrar/students" className="inline-block mt-3">
                <Button size="sm" className="rounded-xl text-xs font-bold">Start Intake</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentStudents.map((st: any) => (
                <div
                  key={st.id || st.student_id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {(st.fullName || st.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {st.fullName || st.name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono truncate">
                        ID: {st.student_id || 'N/A'} · Parent: {st.parent_name || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 bg-indigo-500/10 text-[10px] font-bold rounded-xl">
                      {st.grade?.name || 'Enrolled'}
                    </Badge>
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-xl">
                      {st.status || 'ACTIVE'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
