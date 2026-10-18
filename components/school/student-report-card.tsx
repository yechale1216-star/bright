'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { ComprehensiveReportCardData } from '@/lib/gradebook-service';

export type ReportCardSide = 'both' | 'front' | 'back';

interface StudentReportCardProps {
  card: ComprehensiveReportCardData;
  showPrintStyles?: boolean;
  className?: string;
  defaultSide?: ReportCardSide;
  allowSideToggle?: boolean;
}

// ============================================================================
// 1. FRONT PAGE COMPONENT (ገጽ 1: ኦፊሴላዊ የውጤት ካርድ)
// ============================================================================
export function StudentReportCardFront({
  card,
  className = '',
}: {
  card: ComprehensiveReportCardData;
  className?: string;
}) {
  const {
    school,
    student,
    academic,
    periods,
    subjectRows,
    summary,
    reportCardId,
    issueDate,
    qrCodeData,
  } = card;

  // Compute a live, scan-ready mobile verification URL
  const qrVerificationUrl = React.useMemo(() => {
    const fallbackId = student?.studentId || student?.id || reportCardId || 'verified';
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (qrCodeData && (qrCodeData.startsWith('http://') || qrCodeData.startsWith('https://'))) {
        try {
          const urlObj = new URL(qrCodeData);
          return `${origin}${urlObj.pathname}${urlObj.search}`;
        } catch {
          return qrCodeData;
        }
      }
      return `${origin}/verify/report-card?id=${fallbackId}`;
    }
    return qrCodeData || `https://zetime.pro.et/verify/report-card?id=${fallbackId}`;
  }, [qrCodeData, reportCardId, student]);

  return (
    <div
      className={`report-card-front relative bg-white text-slate-900 font-sans p-3.5 sm:p-6 md:p-8 w-full max-w-[210mm] mx-auto shadow-sm print:shadow-none print:p-4 print:max-w-none print:w-full select-text border border-slate-300 print:border-none ${className}`}
      style={{
        boxSizing: 'border-box',
        minHeight: '290mm',
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      {/* Background Watermark Crest */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="relative w-80 h-80 opacity-[0.04] grayscale print:opacity-[0.05]">
          <Image
            src={school.logo || '/addis-hiwot-logo.png'}
            alt="School Crest Watermark"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Main Card Content */}
      <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
        {/* ==================================================== */}
        {/* 1. OFFICIAL HEADER SECTION */}
        {/* ==================================================== */}
        <div className="border-b border-slate-800 pb-3">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 text-center sm:text-left">
            {/* Mobile Top Row / Desktop Left Logo */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3">
              {/* Left School Logo Emblem */}
              <div className="flex-shrink-0 pt-0.5">
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-slate-300 bg-white shadow-2xs">
                  <Image
                    src={school.logo || '/addis-hiwot-logo.png'}
                    alt={school.name}
                    fill
                    className="object-contain p-1"
                    priority
                  />
                </div>
              </div>

              {/* Mobile QR Verification Badge */}
              <div className="flex sm:hidden flex-col items-center justify-center pt-0.5">
                <div className="p-1 bg-white border border-slate-400 rounded-sm shadow-2xs">
                  <QRCodeSVG
                    value={qrVerificationUrl}
                    size={46}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <span className="text-[8px] font-mono text-slate-500 mt-0.5 tracking-tighter">
                  {reportCardId ? reportCardId.substring(0, 10) : 'VERIFIED'}
                </span>
              </div>
            </div>

            {/* Center School Titles & Contact */}
            <div className="flex-1 text-center px-1 sm:px-2">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                {school.amharicName || 'አዲስ ሕይወት ት/ቤት'} ::
              </h1>
              <h2 className="text-base sm:text-xl font-bold tracking-wide text-slate-800 mt-0.5 font-serif italic">
                {school.name || 'Bright Path School'}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] sm:text-xs text-slate-600 font-medium mt-1">
                <span>{school.address || 'Dire Dawa'}</span>
                <span>•</span>
                <span>☎ {school.phone || '0251 - 11 41 87'}</span>
                <span>•</span>
                <span>✉ 1838</span>
              </div>
              <div className="mt-1.5">
                <span className="inline-block text-[11px] sm:text-sm font-bold tracking-wider text-slate-900 border-b border-slate-700 pb-0.5 uppercase">
                  Student&apos;s Grade Report • የውጤት መግለጫ (ገጽ 1)
                </span>
              </div>
            </div>

            {/* Desktop Right Side: QR Code Verification Badge */}
            <div className="hidden sm:flex flex-shrink-0 flex-col items-center justify-center pt-0.5">
              <div className="p-1 bg-white border border-slate-400 rounded-sm shadow-2xs">
                <QRCodeSVG
                  value={qrVerificationUrl}
                  size={58}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <span className="text-[9px] font-mono text-slate-500 mt-0.5 tracking-tighter">
                {reportCardId ? reportCardId.substring(0, 14) : 'AH-VERIFIED'}
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 2. STUDENT & CLASS INFORMATION BAR */}
        {/* ==================================================== */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 py-2 px-2.5 sm:px-3 bg-slate-50 border border-slate-300 rounded-sm text-[11px] sm:text-[13px]">
          <div className="flex-1 space-y-1.5 w-full">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <span className="font-semibold text-slate-600">Home-room Teacher&apos;s Name : </span>
                <span className="font-bold text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-2">
                  {academic.homeroomTeacherName || 'Anteeh Addisu Legesse'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1 text-slate-800">
              <div>
                <span className="font-semibold text-slate-600">Student&apos;s Name : </span>
                <span className="font-black text-slate-900 text-xs sm:text-sm">{student.fullName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Gender : </span>
                <span className="font-bold text-slate-900">{student.gender || 'M'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Age : </span>
                <span className="font-bold text-slate-900">{student.age || '14'}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1 text-slate-800">
              <div>
                <span className="font-semibold text-slate-600">Grade : </span>
                <span className="font-bold text-slate-900">{academic.gradeName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Section : </span>
                <span className="font-bold text-slate-900">{academic.sectionName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Year : </span>
                <span className="font-bold text-slate-900">{academic.academicYearName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Student ID : </span>
                <span className="font-mono font-bold text-slate-900">{student.studentId}</span>
              </div>
            </div>
          </div>

          {/* Student Photo */}
          <div className="flex-shrink-0 self-center sm:self-start">
            <div className="w-14 h-18 sm:w-18 sm:h-22 rounded-sm border-2 border-slate-400 bg-emerald-700 overflow-hidden relative flex items-center justify-center shadow-2xs">
              {student.photo ? (
                <Image
                  src={student.photo}
                  alt={student.fullName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white p-1 text-center">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
                    <span className="text-xs font-bold">{student.fullName?.charAt(0) || 'S'}</span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-semibold leading-tight text-white/90">PHOTO</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 3. DYNAMIC SUBJECT RESULT TABLE */}
        {/* ==================================================== */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 px-0.5 sm:hidden">
            <span className="font-semibold text-slate-700">Official Results</span>
            <span>↔ Scroll to view all terms</span>
          </div>
          <div className="overflow-x-auto w-full border border-slate-900 scrollbar-thin">
            <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[540px] sm:min-w-full">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-center text-[10px] sm:text-xs">
                  <th className="py-1.5 px-2.5 sm:px-3 text-left border-r border-slate-900 w-32 sm:w-44 sticky left-0 bg-slate-100 z-10 shadow-[1px_0_0_0_#0f172a]">
                    Subject
                  </th>
                  <th className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 w-14 sm:w-16">Weight</th>
                  {periods.map((period) => (
                    <th key={period.id} className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 w-16 sm:w-20">
                      {period.label}
                    </th>
                  ))}
                  <th className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 w-16 sm:w-18">Total</th>
                  <th className="py-1.5 px-1.5 sm:px-2 w-16 sm:w-20">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400">
                {subjectRows.map((row) => (
                  <tr key={row.subjectId} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-1 px-2.5 sm:px-3 text-left font-semibold text-slate-900 border-r border-slate-900 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#0f172a]">
                      {row.subjectName}
                    </td>
                    <td className="py-1 px-1.5 sm:px-2 text-center text-slate-800 border-r border-slate-900 font-medium">
                      {row.weight}%
                    </td>
                    {periods.map((period) => {
                      const score = row.scores[period.id];
                      const hasScore = score !== undefined && score !== null;
                      return (
                        <td
                          key={period.id}
                          className="py-1 px-1.5 sm:px-2 text-center font-bold text-slate-900 border-r border-slate-900"
                        >
                          {hasScore ? score : '—'}
                        </td>
                      );
                    })}
                    <td className="py-1 px-1.5 sm:px-2 text-center font-extrabold text-slate-900 border-r border-slate-900 bg-slate-50/50">
                      {row.total}
                    </td>
                    <td className="py-1 px-1.5 sm:px-2 text-center font-black text-slate-900 bg-slate-50/50">
                      {row.average}
                    </td>
                  </tr>
                ))}

                {/* ==================================================== */}
                {/* SUMMARY ROWS AT BOTTOM */}
                {/* ==================================================== */}
                {/* TOTAL ROW */}
                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-900 text-center">
                  <td className="py-1.5 px-2.5 sm:px-3 text-left font-black text-slate-900 border-r border-slate-900 sticky left-0 bg-slate-100 z-10 shadow-[1px_0_0_0_#0f172a]">
                    Total
                  </td>
                  <td className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 font-bold text-slate-900">
                    {summary.totalRow.weight}
                  </td>
                  {periods.map((period) => {
                    const pSum = summary.totalRow.periodSums[period.id];
                    return (
                      <td
                        key={period.id}
                        className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 font-black text-slate-900"
                      >
                        {pSum !== null && pSum !== undefined ? pSum : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 font-black text-slate-900 bg-slate-200/50">
                    {summary.totalRow.total}
                  </td>
                  <td className="py-1.5 px-1.5 sm:px-2 font-black text-slate-900 bg-slate-200/50">
                    {summary.totalRow.average}
                  </td>
                </tr>

                {/* AVERAGE ROW */}
                <tr className="bg-slate-50 font-bold border-t border-slate-900 text-center">
                  <td className="py-1.5 px-2.5 sm:px-3 text-left font-black text-slate-900 border-r border-slate-900 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#0f172a]">
                    Average
                  </td>
                  <td className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  {periods.map((period) => {
                    const pAvg = summary.averageRow.periodAverages[period.id];
                    return (
                      <td
                        key={period.id}
                        className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 font-black text-slate-900"
                      >
                        {pAvg !== null && pAvg !== undefined ? `${pAvg}%` : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  <td className="py-1.5 px-1.5 sm:px-2 font-black text-blue-900 bg-blue-50/40">
                    {summary.averageRow.overallAverage}%
                  </td>
                </tr>

                {/* RANK ROW */}
                <tr className="border-t border-slate-900 text-center">
                  <td className="py-1.5 px-2.5 sm:px-3 text-left font-black text-slate-900 border-r border-slate-900 sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#0f172a]">
                    Rank
                  </td>
                  <td className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  {periods.map((period) => (
                    <td
                      key={period.id}
                      className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 font-black text-slate-900"
                    >
                      {summary.rank}
                    </td>
                  ))}
                  <td className="py-1.5 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  <td className="py-1.5 px-1.5 sm:px-2 font-black text-slate-900 bg-amber-50/40">
                    {summary.rank}
                  </td>
                </tr>

                {/* CONDUCT ROW */}
                <tr className="border-t border-slate-900 text-center">
                  <td className="py-1 px-2.5 sm:px-3 text-left font-black text-slate-900 border-r border-slate-900 sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#0f172a]">
                    Conduct
                  </td>
                  <td className="py-1 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  {periods.map((period) => (
                    <td
                      key={period.id}
                      className="py-1 px-1.5 sm:px-2 border-r border-slate-900 font-bold text-slate-900"
                    >
                      {summary.conduct || 'A-'}
                    </td>
                  ))}
                  <td className="py-1 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  <td className="py-1 px-1.5 sm:px-2 font-bold text-slate-900">{summary.conduct || 'A-'}</td>
                </tr>

                {/* ABSENCE ROW */}
                <tr className="border-t border-slate-900 text-center">
                  <td className="py-1 px-2.5 sm:px-3 text-left font-black text-slate-900 border-r border-slate-900 sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#0f172a]">
                    Absence
                  </td>
                  <td className="py-1 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  {periods.map((period) => (
                    <td
                      key={period.id}
                      className="py-1 px-1.5 sm:px-2 border-r border-slate-900 font-semibold text-slate-800 text-[10px] sm:text-[11px]"
                    >
                      {summary.absence || '0 Day'}
                    </td>
                  ))}
                  <td className="py-1 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  <td className="py-1 px-1.5 sm:px-2 font-semibold text-slate-800 text-[10px] sm:text-[11px]">
                    {summary.absence || '0 Day'}
                  </td>
                </tr>

                {/* REMARK ROW WITH BADGE */}
                <tr className="border-t border-slate-900 text-center bg-slate-50/50">
                  <td className="py-2 px-2.5 sm:px-3 text-left font-black text-slate-900 border-r border-slate-900 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#0f172a]">
                    Remark
                  </td>
                  <td className="py-2 px-1.5 sm:px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                  <td
                    colSpan={periods.length + 2}
                    className="py-2 px-3 sm:px-4 text-left font-bold text-slate-900"
                  >
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      <span className="inline-block px-3 sm:px-5 py-0.5 sm:py-1 border-2 border-slate-900 rounded-sm font-black text-[10px] sm:text-xs uppercase tracking-wider text-slate-900 bg-white">
                        {summary.remarkBadge || 'Passed'}
                      </span>
                      {summary.teacherComment && (
                        <span className="text-[10px] sm:text-[11px] italic text-slate-700 font-normal">
                          &ldquo;{summary.teacherComment}&rdquo;
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 4. OFFICIAL SIGNATURES & INSTITUTIONAL SEALS */}
        {/* ==================================================== */}
        <div className="pt-3 sm:pt-4 border-t border-slate-400 text-[10px] sm:text-xs text-slate-800">
          <div className="grid grid-cols-3 gap-2 sm:gap-6 md:gap-8 items-end text-center">
            {/* Homeroom Teacher */}
            <div>
              <div className="h-8 sm:h-10 border-b border-slate-800 flex items-end justify-center pb-1">
                <span className="font-serif italic text-[10px] sm:text-xs text-slate-700 truncate max-w-full px-1">
                  {academic.homeroomTeacherName}
                </span>
              </div>
              <span className="mt-1 block font-bold text-slate-900 leading-tight">Home-room Teacher</span>
            </div>

            {/* Principal Signature */}
            <div>
              <div className="h-8 sm:h-10 border-b border-slate-800 flex items-end justify-center pb-1">
                <span className="font-serif italic text-[10px] sm:text-xs text-slate-700">Official Sign</span>
              </div>
              <span className="mt-1 block font-bold text-slate-900 leading-tight">Principal Signature</span>
            </div>

            {/* School Stamp Seal */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight text-center p-0.5 sm:p-1">
                School Seal
              </div>
              <span className="mt-1 block font-bold text-slate-900 leading-tight">Date: {issueDate}</span>
            </div>
          </div>

          {/* Footer Card Verification Note */}
          <div className="mt-3 sm:mt-4 pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-slate-500">
            <span>
              Report Card ID: <strong className="font-mono text-slate-700">{reportCardId}</strong>
            </span>
            <span>Bright Path School Management System • Official Academic Record</span>
            <span>Issued: {issueDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. BACK PAGE COMPONENT (ገጽ 2: የደረጃ አሰጣጥ፣ የስነ-ምግባር መመዘኛ እና የትምህርት ደንብ)
// Excludes Parent/Guardian Acknowledgment as requested by the user.
// ============================================================================
export function StudentReportCardBack({
  card,
  className = '',
}: {
  card: ComprehensiveReportCardData;
  className?: string;
}) {
  const { school, student, academic, summary, reportCardId, issueDate } = card;

  // Official Ethiopian Secondary Education Grading Scale Rubric
  const gradingScales = [
    { grade: 'A+', range: '95 – 100%', gpa: '4.00', descEn: 'Excellent', descAm: 'እጅግ በጣም ከፍተኛ ብልጫ', remark: 'Outstanding Mastery' },
    { grade: 'A', range: '85 – 94%', gpa: '4.00', descEn: 'Very Good', descAm: 'ከፍተኛ ብልጫ', remark: 'Superior Competence' },
    { grade: 'B', range: '75 – 84%', gpa: '3.00', descEn: 'Good', descAm: 'ጥሩ', remark: 'Above Average Standard' },
    { grade: 'C', range: '65 – 74%', gpa: '2.00', descEn: 'Satisfactory', descAm: 'መካከለኛ', remark: 'Meets Curricular Standards' },
    { grade: 'D', range: '50 – 64%', gpa: '1.00', descEn: 'Pass / Minimum', descAm: 'አጥጋቢ / ማለፊያ', remark: 'Passing Benchmark' },
    { grade: 'F', range: '0 – 49%', gpa: '0.00', descEn: 'Unsatisfactory / Fail', descAm: 'የማያልፍ / ዝቅተኛ', remark: 'Retention / Non-Passing' },
  ];

  // Conduct Rubrics
  const conductRubrics = [
    {
      code: 'A',
      titleEn: 'Exemplary',
      titleAm: 'እጅግ በጣም ጥሩ',
      description: 'Demonstrates outstanding self-discipline, respect for school regulations, positive peer cooperation, and active civic participation.',
    },
    {
      code: 'B',
      titleEn: 'Good',
      titleAm: 'ጥሩ',
      description: 'Consistently abides by school rules, shows respectful conduct to educators and classmates, and maintains steady punctuality.',
    },
    {
      code: 'C',
      titleEn: 'Satisfactory',
      titleAm: 'አጥጋቢ',
      description: 'Complies with general institutional discipline; occasionally requires guidance or redirection regarding focus and timeliness.',
    },
    {
      code: 'D',
      titleEn: 'Needs Improvement',
      titleAm: 'መሻሻል የሚፈልግ',
      description: 'Exhibits repeated unexcused tardiness, behavioral concerns, or breach of school guidelines requiring targeted counseling.',
    },
  ];

  // Standard Extracurricular / Co-Curricular Clubs
  const coCurricularClubs = [
    { nameEn: 'Mini-Media Club', nameAm: 'ሚኒ ሚዲያ ክበብ', role: 'Active Member / ተሳታፊ' },
    { nameEn: 'Science & STEM Innovation', nameAm: 'ሳይንስ እና ፈጠራ ክበብ', role: 'Participant / ተሳታፊ' },
    { nameEn: 'Red Cross & First Aid', nameAm: 'ቀይ መስቀል እና የመጀመሪያ እርዳታ', role: 'Trained Member / ተሳታፊ' },
    { nameEn: 'Environmental & Green Club', nameAm: 'የአካባቢ ጥበቃ ክበብ', role: 'Active / ተሳታፊ' },
    { nameEn: 'Sports & Athletics', nameAm: 'ስፖርት እና አትሌቲክስ', role: 'Team Member / ተሳታፊ' },
    { nameEn: 'Literature, Art & Culture', nameAm: 'ስነ-ጽሁፍ እና ስነ-ጥበብ', role: 'Participant / ተሳታፊ' },
  ];

  return (
    <div
      className={`report-card-back relative bg-white text-slate-900 font-sans p-3.5 sm:p-6 md:p-8 w-full max-w-[210mm] mx-auto shadow-sm print:shadow-none print:p-4 print:max-w-none print:w-full select-text border border-slate-300 print:border-none ${className}`}
      style={{
        boxSizing: 'border-box',
        minHeight: '290mm',
      }}
    >
      {/* Background Watermark Crest */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="relative w-80 h-80 opacity-[0.03] grayscale print:opacity-[0.04]">
          <Image
            src={school.logo || '/addis-hiwot-logo.png'}
            alt="School Crest Watermark"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
        {/* ==================================================== */}
        {/* 1. BACK HEADER SECTION */}
        {/* ==================================================== */}
        <div className="border-b border-slate-800 pb-2.5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-slate-300 bg-white flex-shrink-0">
                <Image
                  src={school.logo || '/addis-hiwot-logo.png'}
                  alt={school.name}
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div>
                <h2 className="text-xs sm:text-base font-black tracking-tight text-slate-900">
                  {school.amharicName || 'አዲስ ሕይወት ት/ቤት'} • {school.name}
                </h2>
                <p className="text-[9px] sm:text-[10px] text-slate-600 font-medium">
                  {school.address} • Tel: {school.phone || '0251 - 11 41 87'} • Official Evaluation
                </p>
              </div>
            </div>

            <div className="self-end sm:self-center">
              <span className="inline-block text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-900 text-white rounded-xs">
                Page 2 • ገጽ 2 (Back)
              </span>
            </div>
          </div>

          <div className="mt-2 text-center bg-slate-100 py-1 px-2 border border-slate-300 rounded-xs">
            <h1 className="text-xs sm:text-sm font-black tracking-wide text-slate-900 uppercase">
              Academic Grading Scale, Conduct Evaluation & Promotion Regulations
            </h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-700">
              የደረጃ አሰጣጥ መለኪያ፣ የስነ-ምግባር መመዘኛ እና የትምህርት ደንብ
            </p>
          </div>
        </div>

        {/* Quick Student Identification Banner */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 px-2.5 sm:px-3 bg-slate-50 border border-slate-300 rounded-xs text-[10px] sm:text-xs text-slate-800">
          <div>
            <span className="font-semibold text-slate-600">Student: </span>
            <span className="font-bold text-slate-900">{student.fullName}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">ID: </span>
            <span className="font-mono font-bold text-slate-900">{student.studentId}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">Grade & Sec: </span>
            <span className="font-bold text-slate-900">{academic.gradeName} &ldquo;{academic.sectionName}&rdquo;</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600">Academic Year: </span>
            <span className="font-bold text-slate-900">{academic.academicYearName}</span>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 2. SECTION 1: GRADING SYSTEM TABLE */}
        {/* ==================================================== */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-slate-900 rounded-full inline-block" />
              1. Grading Scale & Evaluation Key (የደረጃ አሰጣጥ መለኪያ)
            </h3>
            <span className="text-[10px] text-slate-600 font-medium hidden sm:inline">Secondary Education Standard</span>
          </div>

          <div className="overflow-x-auto w-full border border-slate-900 scrollbar-thin">
            <table className="w-full text-xs border-collapse min-w-[500px] sm:min-w-full">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-center text-[10px] sm:text-[11px]">
                  <th className="py-1 px-2 border-r border-slate-900 w-14 sticky left-0 bg-slate-100 z-10 shadow-[1px_0_0_0_#0f172a]">Grade</th>
                  <th className="py-1 px-2 border-r border-slate-900 w-24">Mark Range (%)</th>
                  <th className="py-1 px-2 border-r border-slate-900 w-16">GPA Points</th>
                  <th className="py-1 px-3 text-left border-r border-slate-900 w-36">Description (English)</th>
                  <th className="py-1 px-3 text-left border-r border-slate-900 w-44">መግለጫ (Amharic)</th>
                  <th className="py-1 px-2 text-left">Academic Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400 text-[10px] sm:text-[11px]">
                {gradingScales.map((scale) => (
                  <tr key={scale.grade} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-1 px-2 text-center font-black text-slate-900 border-r border-slate-900 bg-slate-50/60 sticky left-0 z-10 shadow-[1px_0_0_0_#0f172a]">
                      {scale.grade}
                    </td>
                    <td className="py-1 px-2 text-center font-bold text-slate-900 border-r border-slate-900">
                      {scale.range}
                    </td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-slate-800 border-r border-slate-900">
                      {scale.gpa}
                    </td>
                    <td className="py-1 px-3 text-left font-semibold text-slate-900 border-r border-slate-900">
                      {scale.descEn}
                    </td>
                    <td className="py-1 px-3 text-left font-medium text-slate-900 border-r border-slate-900">
                      {scale.descAm}
                    </td>
                    <td className="py-1 px-2 text-left font-medium text-slate-700">
                      {scale.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 3. SECTION 2: CONDUCT & BEHAVIORAL SCALE */}
        {/* ==================================================== */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-slate-900 rounded-full inline-block" />
              2. Conduct & Behavioral Evaluation Criteria (የስነ-ምግባር እና ጠባይ መመዘኛ)
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 border border-emerald-200 rounded-xs">
              Student Conduct Record: {summary.conduct || 'A-'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {conductRubrics.map((r) => (
              <div
                key={r.code}
                className="p-2 border border-slate-300 rounded-xs bg-slate-50/40 text-[10px] sm:text-[11px] flex items-start gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5">
                  {r.code}
                </div>
                <div className="flex-1 leading-tight">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span>{r.titleEn}</span>
                    <span>•</span>
                    <span className="text-slate-700 font-semibold">{r.titleAm}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5 leading-snug">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 4. SECTION 3: CO-CURRICULAR & CLUB INVOLVEMENT */}
        {/* ==================================================== */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 bg-slate-900 rounded-full inline-block" />
            3. Co-Curricular & Club Participation (የተሳትፎ እና የክበባት እንቅስቃሴዎች)
          </h3>

          <div className="border border-slate-900 rounded-xs p-2.5 bg-white text-[10px] sm:text-[11px] space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {coCurricularClubs.map((club, idx) => (
                <div key={idx} className="flex items-center gap-1.5 border-b border-slate-200 pb-1">
                  <span className="inline-block w-3.5 h-3.5 border border-slate-600 rounded-xs bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-900">
                    ✓
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 block truncate">{club.nameEn}</span>
                    <span className="text-[9px] text-slate-500 block truncate">{club.nameAm}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Homeroom Teacher's Holistic Evaluation Note */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2">
                <span className="font-bold text-slate-800">Homeroom Teacher&apos;s Guidance & Remarks (የክፍል ኃላፊ መምህር አጠቃላይ አስተያየት):</span>
                <span className="font-serif italic text-slate-700 text-[11px]">{academic.homeroomTeacherName}</span>
              </div>
              <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xs min-h-[42px] flex items-center">
                <p className="italic text-slate-800 text-[11px]">
                  {summary.teacherComment ? (
                    `“${summary.teacherComment}”`
                  ) : (
                    `Student ${student.fullName} has successfully concluded the academic session with satisfactory discipline and commitment. Continual dedication to rigorous academic review is strongly advised for next term.`
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 5. SECTION 4: PROMOTION POLICY & REGULATIONS */}
        {/* ==================================================== */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 bg-slate-900 rounded-full inline-block" />
            4. Academic Promotion & Attendance Regulations (የክፍል ማለፊያ እና የተማሪዎች ክትትል ደንብ)
          </h3>

          <div className="border border-slate-300 rounded-xs p-2.5 bg-slate-50/60 text-[10px] sm:text-[11px] text-slate-800 space-y-1 leading-snug">
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-slate-900">1. Passing Standard (የማለፊያ መስፈርት):</span>
              <span>A minimum combined cumulative average of 50.0% across both semesters is mandatory for promotion to the subsequent grade level.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-slate-900">2. Attendance Requirement (የትምህርት ገበታ ክትትል):</span>
              <span>Students must attend a minimum of 85% of official school instruction days. Unexcused absenteeism exceeding 15% results in automatic disqualification or retention.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-slate-900">3. Retention Threshold (የማይፈቀድ የወደቀ ውጤት):</span>
              <span>A student who receives failing marks in three or more subjects is subject to academic retention pursuant to national curriculum standards.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold text-slate-900">4. Official Credential Integrity (የሰነድ ህጋዊነት):</span>
              <span>This grade report is an official institutional record of {school.name}. Any erasure, alteration, or uncertified copying renders this certificate completely null and void.</span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 6. BOTTOM OFFICIAL CERTIFICATION & SEALS */}
        {/* ==================================================== */}
        <div className="pt-3 border-t-2 border-slate-800 text-[10px] sm:text-xs text-slate-800">
          <div className="grid grid-cols-3 gap-2 sm:gap-6 md:gap-8 items-end text-center">
            {/* Academic Director / Registrar */}
            <div>
              <div className="h-8 sm:h-9 border-b border-slate-800 flex items-end justify-center pb-1">
                <span className="font-serif italic text-[10px] sm:text-xs text-slate-700">Official Sign</span>
              </div>
              <span className="mt-1 block font-bold text-slate-900 text-[10px] sm:text-[11px]">Academic Registrar / Director</span>
            </div>

            {/* School Seal / Stamp */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-tight text-center p-0.5 sm:p-1">
                Official Seal
              </div>
              <span className="mt-1 block font-bold text-slate-900 text-[10px] sm:text-[11px]">Date: {issueDate}</span>
            </div>

            {/* Academic Year Verification */}
            <div>
              <div className="h-8 sm:h-9 border-b border-slate-800 flex items-end justify-center pb-1">
                <span className="font-mono font-bold text-[10px] sm:text-xs text-slate-900">{academic.academicYearName}</span>
              </div>
              <span className="mt-1 block font-bold text-slate-900 text-[10px] sm:text-[11px]">Curriculum Approved</span>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-3 pt-1.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-1 text-[9px] sm:text-[10px] text-slate-500">
            <span>
              Card ID: <strong className="font-mono text-slate-700">{reportCardId}</strong>
            </span>
            <span>Ethiopian Secondary Education Curriculum System • Back Page (ገጽ 2)</span>
            <span>Status: <strong>AUTHENTICATED</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MAIN WRAPPER COMPONENT WITH TOGGLE & DUPLEX PRINT SUPPORT
// ============================================================================
export function StudentReportCard({
  card,
  showPrintStyles = true,
  className = '',
  defaultSide = 'both',
  allowSideToggle = true,
}: StudentReportCardProps) {
  const [activeSide, setActiveSide] = useState<ReportCardSide>(defaultSide);

  return (
    <div className={`report-card-wrapper w-full max-w-full overflow-x-auto ${className}`}>
      {/* Interactive Page View Selector (Hidden during printing) */}
      {allowSideToggle && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 p-1 bg-slate-200/90 dark:bg-slate-800/80 rounded-xl max-w-full print:hidden">
          <button
            type="button"
            onClick={() => setActiveSide('both')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${
              activeSide === 'both'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Both Pages (Print Ready • 2-Sided)
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('front')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${
              activeSide === 'front'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Front Page (ገጽ 1)
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('back')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${
              activeSide === 'back'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Back Page (ገጽ 2)
          </button>
        </div>
      )}

      {/* Page 1: Front */}
      {(activeSide === 'both' || activeSide === 'front') && (
        <StudentReportCardFront card={card} />
      )}

      {/* Duplex Page Break Spacer for Multi-Page Printing & Visual Separation */}
      {activeSide === 'both' && (
        <div
          className="my-6 border-b-2 border-dashed border-slate-300 print:my-0 print:border-none"
          style={{
            pageBreakAfter: 'always',
            breakAfter: 'page',
          }}
        />
      )}

      {/* Page 2: Back */}
      {(activeSide === 'both' || activeSide === 'back') && (
        <StudentReportCardBack card={card} />
      )}

      {/* Embedded Print Styles for A4 Paper */}
      {showPrintStyles && (
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  body {
    background: white !important;
    color: black !important;
    margin: 0 !important;
    padding: 0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  nav, header, aside, .print-hidden { display: none !important; }
  .report-card-front,
  .report-card-back {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 4mm !important;
    box-shadow: none !important;
    border: none !important;
  }
  .report-card-front {
    page-break-after: always !important;
    break-after: page !important;
  }
}
`,
          }}
        />
      )}
    </div>
  );
}
