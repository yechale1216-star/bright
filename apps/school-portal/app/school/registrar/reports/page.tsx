'use client'

import React, { useEffect, useState } from 'react'
import { db } from '@/lib/db/database'
import {
  BarChart2, Users, Download, GraduationCap, CheckCircle2,
  PieChart, Filter, ShieldCheck, ArrowUpRight
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/utils'
import { toast } from 'sonner'
import Link from 'next/link'

export default function RegistrarReportsPage() {
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

  // Grade Breakdown
  const gradeBreakdown = grades.map(g => {
    const gradeStudents = students.filter(s => s.gradeId === g.id || s.grade?.id === g.id)
    const count = gradeStudents.length
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return { name: g.name, count, pct }
  })

  const exportCSV = () => {
    if (students.length === 0) {
      toast.error('No student records to export')
      return
    }

    const headers = ['Student ID', 'Full Name', 'Gender', 'Grade', 'Section', 'Parent Name', 'Parent Phone', 'Parent Email', 'Status']
    const rows = students.map(s => [
      `"${s.student_id || ''}"`,
      `"${(s.fullName || s.name || '').replace(/"/g, '""')}"`,
      `"${s.gender || ''}"`,
      `"${s.grade?.name || ''}"`,
      `"${s.section?.name || ''}"`,
      `"${(s.parent_name || '').replace(/"/g, '""')}"`,
      `"${s.parent_phone || ''}"`,
      `"${s.parent_email || ''}"`,
      `"${s.status || 'ACTIVE'}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Zetime_Student_Registration_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Registration report exported to CSV')
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-500" />
            Student Enrollment Reports & Analytics
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Demographic breakdowns, intake statistics, and official CSV exports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={exportCSV}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl h-11 px-5 gap-2 shadow-md"
          >
            <Download className="w-4 h-4" />
            Export Full Roster (CSV)
          </Button>

          <Link href="/school/registrar/students">
            <Button variant="outline" className="rounded-2xl font-bold text-xs h-11 px-5">
              Open Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5">
          <CardContent className="p-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Registrations</p>
            <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{total}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Enrolled Students</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5">
          <CardContent className="p-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Enrollment</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              {total > 0 ? Math.round((activeCount / total) * 100) : 0}% Active Rate
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5">
          <CardContent className="p-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Male Students</p>
            <p className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">{maleCount}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              {total > 0 ? Math.round((maleCount / total) * 100) : 0}% of Total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5">
          <CardContent className="p-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Female Students</p>
            <p className="text-3xl font-black text-pink-600 dark:text-pink-400 mt-1">{femaleCount}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              {total > 0 ? Math.round((femaleCount / total) * 100) : 0}% of Total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Level Distribution Chart Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-500" />
              Enrollment by Grade Level
            </h2>
          </div>

          {gradeBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No grade statistics available</p>
          ) : (
            <div className="space-y-4">
              {gradeBreakdown.map(g => (
                <div key={g.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{g.name}</span>
                    <span className="font-semibold text-slate-500">{g.count} Students ({g.pct}%)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                      style={{ width: `${Math.max(g.pct, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demographics Overview */}
        <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              Demographic Summary
            </h2>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Active Students</span>
              </div>
              <span className="text-base font-black text-indigo-600">{activeCount}</span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Male Students</span>
              </div>
              <span className="text-base font-black text-blue-600">{maleCount}</span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-pink-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Female Students</span>
              </div>
              <span className="text-base font-black text-pink-600">{femaleCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
