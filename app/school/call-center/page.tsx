'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { db } from '@/lib/db/database'
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock,
  Users, ArrowUpRight, Headphones, CheckCircle2, AlertCircle, Phone
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/utils'
import { useCalendar } from '@/lib/context/calendar-context'

export default function CallCenterDashboard() {
  const { formatDate, formatDateTime } = useCalendar()
  const { user } = useAuth()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.getCallHistoryApi()
      .then(res => setHistory(res ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [])

  const totalCalls = history.length
  const completedCalls = history.filter(c => c.status === 'COMPLETED' || c.status === 'ENDED').length
  const missedCalls = history.filter(c => c.status === 'MISSED' || c.status === 'DECLINED').length
  const today = formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const recentCalls = history.slice(0, 5)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-widest">Call Center Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground">
            Welcome, {user?.name?.split(' ')[0] ?? 'Officer'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <Link href="/school/call-center/contacts">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5">
            <Phone className="w-4 h-4" />
            Make a Call
          </button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls Logged', value: totalCalls, icon: PhoneCall, color: 'from-teal-500 to-teal-600', href: '/school/call-center/history' },
          { label: 'Completed Calls', value: completedCalls, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Missed / Declined', value: missedCalls, icon: PhoneMissed, color: 'from-rose-500 to-rose-600' },
          { label: 'Pending Callbacks', value: Math.max(0, missedCalls), icon: Clock, color: 'from-amber-500 to-amber-600', href: '/school/call-center/queue' },
        ].map(s => (
          <Link key={s.label} href={s.href ?? '#'}>
            <div className="group rounded-2xl border border-border/60 bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br', s.color)}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-black text-foreground">
                {loading ? <span className="inline-block w-8 h-6 bg-secondary rounded animate-pulse" /> : s.value}
              </p>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5">{s.label}</p>
              {s.href && <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary mt-1 transition-colors" />}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Action & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-1">Quick Actions</h2>
          <Link href="/school/call-center/contacts">
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm transition-all hover:shadow-md hover:-translate-y-0.5">
              <Users className="w-5 h-5 flex-shrink-0" />
              Browse Parent Contacts
              <ArrowUpRight className="w-4 h-4 ml-auto opacity-60" />
            </div>
          </Link>
          <Link href="/school/call-center/queue">
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-sm transition-all hover:shadow-md hover:-translate-y-0.5 mt-2">
              <Clock className="w-5 h-5 flex-shrink-0" />
              View Call Queue
              <ArrowUpRight className="w-4 h-4 ml-auto opacity-60" />
            </div>
          </Link>
        </div>

        {/* Recent Calls */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-teal-500" />
              <h2 className="font-bold text-foreground">Recent Activity</h2>
            </div>
            <Link href="/school/call-center/history" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-secondary/50 animate-pulse" />)}
            </div>
          ) : recentCalls.length === 0 ? (
            <div className="text-center py-12">
              <Headphones className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No recent calls recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCalls.map((c, idx) => (
                <div key={c.id || idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
                      <PhoneCall className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.recipientName || c.recipientId || 'Parent Contact'}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(c.createdAt || Date.now())}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold px-2.5 py-1 rounded-full',
                    c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30'
                  )}>
                    {c.status || 'LOGGED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Permissions Info */}
      <div className="rounded-2xl border border-teal-200/50 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-800/30 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-teal-800 dark:text-teal-200 text-sm">Role Permissions Summary</p>
            <p className="text-xs text-teal-700/70 dark:text-teal-300/70 mt-1 leading-relaxed">
              As a <strong>School Call Center Officer</strong>, you can: search and view parent contacts, initiate and log voice/video calls, view call queue & callback requests, access attendance data (read-only), and send direct messages to parents.
              You do not have access to student registration forms, discipline case actions, or platform settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
