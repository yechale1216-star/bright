'use client'

import React from 'react'
import { AcademicYearManagementTab } from '@/components/school/academic-year-management-tab'
import { CalendarDays, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AcademicYearsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 border border-primary/30 flex items-center justify-center shrink-0 shadow-xs">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Academic Years & Lifecycle
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Enterprise management of active operating years, preparation of future years, and historical archives.
            </p>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-xl text-xs font-bold gap-1.5 border-border shrink-0"
        >
          <Link href="/school/admin/academic-structure">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Academic Structure</span>
          </Link>
        </Button>
      </div>

      <AcademicYearManagementTab />
    </div>
  )
}
