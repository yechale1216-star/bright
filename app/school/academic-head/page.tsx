'use client'

import React from 'react'
import Link from 'next/link'
import {
  GraduationCap, Layers, Award, FileText, ArrowRight,
  Sparkles, CheckCircle2, Clock, Users, BookOpen
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AcademicHeadDashboardPage() {
  const academicPillars = [
    {
      title: 'Academic Structure',
      description: 'Manage grade levels, sections, subjects, and curriculum configurations.',
      href: '/school/academic-head/academic-structure',
      icon: Layers,
      color: 'from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30',
      action: 'Configure Structure',
    },
    {
      title: 'Assessments & Marks',
      description: 'Manage assessment weightings, review mark submissions, and approve terms.',
      href: '/school/academic-head/assessments',
      icon: GraduationCap,
      color: 'from-indigo-500/20 to-blue-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      action: 'Review Assessments',
    },
    {
      title: 'Exams & Grades',
      description: 'Examination calendars, grade scales, and institutional performance records.',
      href: '/school/academic-head/exams',
      icon: Award,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      action: 'Manage Exams',
    },
    {
      title: 'Report Cards',
      description: 'Generate, review, approve, and print term report cards for students.',
      href: '/school/academic-head/report-cards',
      icon: FileText,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      action: 'Generate Reports',
    },
  ]

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Academic Dean Office
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Academic Coordination Console</h1>
          <p className="mt-2 text-violet-100 text-sm leading-relaxed">
            Centralized hub for managing school academic structures, course curricula, assessment approval queues, exam rosters, and student grading.
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {academicPillars.map((pillar) => {
          const Icon = pillar.icon
          return (
            <Card key={pillar.title} className="border border-border/80 shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pillar.color} border flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <Link href={pillar.href}>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-bold text-primary">
                      {pillar.action} <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
                <CardTitle className="text-lg font-bold mt-3 text-foreground">{pillar.title}</CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">{pillar.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={pillar.href}>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors">
                    <span>Open Module Workspace</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
