'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  GraduationCap,
  TrendingUp,
  FileText,
  Printer,
  ArrowLeft,
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { API_URL } from '@/lib/api-config';

interface VerifiedData {
  verified: boolean;
  status: string;
  isOfficial: boolean;
  reportCardId: string;
  certificateId: string;
  issueDate: string;
  school: {
    name: string;
    amharicName?: string;
    address?: string;
    phone?: string;
    logo?: string;
  };
  student: {
    id: string;
    studentId: string;
    fullName: string;
    gender: string;
    photo?: string | null;
  };
  academic: {
    gradeName: string;
    sectionName: string;
    academicYearName: string;
    termName: string;
  };
  performance: {
    totalScore: number;
    maxPossibleScore: number;
    averageScore: number;
    gpa: number;
    rank: string;
    conduct: string;
    remarkBadge: string;
    teacherComment?: string;
    principalComment?: string;
  };
  subjects: Array<{
    id: string;
    name: string;
    code?: string;
    score: number;
    maxScore: number;
    gradeLetter: string;
    gpaPoint: number;
  }>;
}

function VerificationContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifiedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('No verification identifier provided. Please scan a valid report card QR code.');
      return;
    }

    const fetchVerification = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/gradebook/verify/${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        const json = await res.json();

        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.message || 'Report card record not found or could not be verified.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to connect to verification server. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [id]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Portal
          </Link>
          {data && (
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print Verification Certificate
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Verifying Academic Credential...
              </h2>
              <p className="text-xs text-slate-500">
                Cross-checking digital seal against institutional records
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-8 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Verification Failed
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                Return to School Homepage
              </Link>
            </div>
          </div>
        )}

        {/* Verified Certificate Card */}
        {!loading && data && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl print:shadow-none print:border-none">
            {/* Header Banner */}
            <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 sm:p-8">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2 flex items-center justify-center shrink-0">
                    <Image
                      src={data.school.logo || '/addis-hiwot-logo.png'}
                      alt={data.school.name}
                      width={64}
                      height={64}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/20 backdrop-blur-md text-emerald-100 text-[11px] font-black uppercase tracking-wider mb-1 border border-emerald-400/30">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                      Officially Verified Credential
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                      {data.school.name}
                    </h1>
                    {data.school.amharicName && (
                      <p className="text-xs font-serif text-white/80">{data.school.amharicName}</p>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right text-xs text-white/90 shrink-0 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                  <p className="font-mono font-bold text-white tracking-wider">{data.reportCardId}</p>
                  <p className="text-[11px]">Issued: {data.issueDate}</p>
                  <p className="text-[10px] text-white/70">Verified: Today</p>
                </div>
              </div>
            </div>

            {/* Student & Academic Context */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                <div className="w-16 h-20 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 relative flex items-center justify-center border border-slate-300 dark:border-slate-600">
                  {data.student.photo ? (
                    <Image
                      src={data.student.photo}
                      alt={data.student.fullName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">
                      {data.student.fullName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      ID: {data.student.studentId}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Grade</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        Grade {data.academic.gradeName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Section</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        Section {data.academic.sectionName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Year</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {data.academic.academicYearName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Period</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {data.academic.termName}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Average Score
                  </span>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {data.performance.averageScore}%
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Class Rank
                  </span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {data.performance.rank}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Conduct Rating
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {data.performance.conduct}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Status
                  </span>
                  <div className="inline-block mt-1 px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 uppercase">
                    {data.performance.remarkBadge}
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Verified Subject Breakdown ({data.subjects.length} Subjects)
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-black text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3 text-center">Score</th>
                        <th className="py-2.5 px-3 text-center">Grade</th>
                        <th className="py-2.5 px-3 text-center">GPA</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {data.subjects.map((subj) => (
                        <tr key={subj.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {subj.name}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {subj.score} / {subj.maxScore}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="font-extrabold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                              {subj.gradeLetter}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                            {subj.gpaPoint}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Endorsements / Comments */}
              {(data.performance.teacherComment || data.performance.principalComment) && (
                <div className="space-y-3 pt-2">
                  {data.performance.teacherComment && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Homeroom Teacher Endorsement
                      </span>
                      <p className="italic text-slate-700 dark:text-slate-300">
                        &ldquo;{data.performance.teacherComment}&rdquo;
                      </p>
                    </div>
                  )}
                  {data.performance.principalComment && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        Principal Remark &amp; Approval
                      </span>
                      <p className="italic text-slate-700 dark:text-slate-300">
                        &ldquo;{data.performance.principalComment}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Verification Footer Seal */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Digitally signed &amp; verified by <strong>{data.school.name} Academic Records</strong>
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  REF: {data.certificateId}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportCardVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
        </div>
      }
    >
      <VerificationContent />
    </Suspense>
  );
}
