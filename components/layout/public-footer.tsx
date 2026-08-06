'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import {
  ShieldCheck,
  Globe,
  Lock,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Smartphone,
  MessageSquare,
  Sparkles,
  Send,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Check,
  Heart,
  Radio,
  FileText,
  UserCheck,
  GraduationCap,
  Users,
} from 'lucide-react';

export function PublicFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 4000);
      setEmail('');
    }
  };

  return (
    <footer className="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-2xl transition-colors duration-300">
      {/* Decorative top accent gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

      {/* Top CTA Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 p-8 md:p-12 shadow-2xl shadow-blue-500/20 text-white">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-md text-xs font-semibold text-white">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                Empowering Next-Gen Schools
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Transform Your School Operations Today
              </h3>
              <p className="text-blue-100 text-sm max-w-xl leading-relaxed">
                Join modern educational institutions using Zetime for real-time session attendance, discipline management, and instant parent engagement.
              </p>
            </div>

            <div className="lg:col-span-5 flex flex-col sm:flex-row gap-3 items-stretch lg:justify-end">
              <Link
                href="/school/admin/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-blue-700 font-bold text-sm shadow-lg hover:bg-blue-50 transition-all hover:scale-105 active:scale-95"
              >
                Start 30-Day Free Trial
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/proposal"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 border border-white/25 text-white font-semibold text-sm backdrop-blur-md hover:bg-white/20 transition-all"
              >
                <FileText className="w-4 h-4" />
                View Proposal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-2 space-y-5">
            <Logo size="md" withText={true} href="/" />
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed font-normal">
              Zetime is an enterprise multi-tenant educational SaaS ecosystem providing attendance analytics, student discipline tracking, and real-time WebRTC communication.
            </p>

            {/* Newsletter Input */}
            <div className="space-y-2 pt-1 max-w-sm">
              <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                Subscribe to Product Updates
              </p>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter school email..."
                  required
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 shrink-0"
                >
                  {subscribed ? <Check className="w-4 h-4" /> : <Send className="w-3.5 h-3.5" />}
                  {subscribed ? 'Subscribed!' : 'Join'}
                </button>
              </form>
            </div>

            {/* Live Operational Status Badge */}
            <div className="flex items-center gap-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Systems Normal &bull; 99.99% Uptime
              </div>
            </div>
          </div>

          {/* Column 2: Platform Features */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Core Modules
            </h4>
            <ul className="space-y-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Dual Attendance Modes
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  Discipline Management
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-violet-500" />
                  Real-time Messaging & Calls
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                  Android PWA & Native App
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                  Guardian Verification
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Solutions by Role */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              For Institutions
            </h4>
            <ul className="space-y-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/school/admin/signup" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                  School Administrators
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-cyan-500" />
                  Teachers & Faculty
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  Parents & Guardians
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Subscription Plans
                </Link>
              </li>
              <li>
                <Link href="/proposal" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Institutional Proposal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Security & Support */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              Security & Legal
            </h4>
            <ul className="space-y-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li>
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  AES-256 Data Encryption
                </span>
              </li>
              <li>
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  Multi-Region Hosting
                </span>
              </li>
            </ul>

            {/* Social Links */}
            <div className="pt-2">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Connect With Us
              </p>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <a href="#" className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-all" aria-label="Github">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </a>
                <a href="#" className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-all" aria-label="LinkedIn">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.74a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z"/></svg>
                </a>
                <a href="#" className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-all" aria-label="Twitter">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="#" className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-all" aria-label="YouTube">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright & status row */}
        <div className="mt-14 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <p>&copy; {new Date().getFullYear()} Zetime Educational SaaS Platform. All rights reserved.</p>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
