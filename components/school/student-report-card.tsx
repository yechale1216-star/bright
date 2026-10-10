'use client';

import React from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { ComprehensiveReportCardData } from '@/lib/gradebook-service';

interface StudentReportCardProps {
  card: ComprehensiveReportCardData;
  showPrintStyles?: boolean;
  className?: string;
}

export function StudentReportCard({ card, showPrintStyles = true, className = '' }: StudentReportCardProps) {
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

  return (
    <div
      className={`report-card-container relative bg-white text-slate-900 font-sans p-6 sm:p-8 max-w-[210mm] mx-auto shadow-sm print:shadow-none print:p-4 print:max-w-none print:w-full select-text ${className}`}
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
          <div className="flex items-start justify-between gap-3">
            {/* Left School Logo Emblem */}
            <div className="flex-shrink-0 pt-0.5">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-slate-300 bg-white">
                <Image
                  src={school.logo || '/addis-hiwot-logo.png'}
                  alt={school.name}
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>
            </div>

            {/* Center School Titles & Contact */}
            <div className="flex-1 text-center px-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                {school.amharicName || 'አዲስ ሕይወት ት/ቤት'} ::
              </h1>
              <h2 className="text-lg sm:text-xl font-bold tracking-wide text-slate-800 mt-0.5 font-serif italic">
                {school.name || 'Bright Path School'}
              </h2>
              <div className="flex items-center justify-center gap-3 text-[11px] sm:text-xs text-slate-600 font-medium mt-1">
                <span>{school.address || 'Dire Dawa'}</span>
                <span>•</span>
                <span>☎ {school.phone || '0251 - 11 41 87'}</span>
                <span>•</span>
                <span>✉ 1838</span>
              </div>
              <div className="mt-1.5">
                <span className="inline-block text-xs sm:text-sm font-bold tracking-wider text-slate-900 border-b border-slate-700 pb-0.5 uppercase">
                  Student&apos;s Grade Report
                </span>
              </div>
            </div>

            {/* Right Side: QR Code Verification Badge */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-0.5">
              <div className="p-1 bg-white border border-slate-400 rounded-sm shadow-2xs">
                <QRCodeSVG
                  value={qrCodeData || reportCardId}
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
        <div className="flex items-center justify-between gap-4 py-2 px-3 bg-slate-50 border border-slate-300 rounded-sm text-xs sm:text-[13px]">
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <span className="font-semibold text-slate-600">Home-room Teacher&apos;s Name : </span>
                <span className="font-bold text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-2">
                  {academic.homeroomTeacherName || 'Anteeh Addisu Legesse'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-800">
              <div>
                <span className="font-semibold text-slate-600">Student&apos;s Name : </span>
                <span className="font-black text-slate-900 text-sm">{student.fullName}</span>
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

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-800">
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
          <div className="flex-shrink-0">
            <div className="w-16 h-20 sm:w-18 sm:h-22 rounded-sm border-2 border-slate-400 bg-emerald-700 overflow-hidden relative flex items-center justify-center shadow-2xs">
              {student.photo ? (
                <Image
                  src={student.photo}
                  alt={student.fullName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white p-1 text-center">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
                    <span className="text-xs font-bold">{student.fullName?.charAt(0) || 'S'}</span>
                  </div>
                  <span className="text-[9px] font-semibold leading-tight text-white/90">PHOTO</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 3. DYNAMIC SUBJECT RESULT TABLE */}
        {/* ==================================================== */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-900">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-center text-[11px] sm:text-xs">
                <th className="py-1.5 px-3 text-left border-r border-slate-900 w-36 sm:w-44">Subject</th>
                <th className="py-1.5 px-2 border-r border-slate-900 w-16">Weight</th>
                {periods.map((period) => (
                  <th key={period.id} className="py-1.5 px-2 border-r border-slate-900 w-20">
                    {period.label}
                  </th>
                ))}
                <th className="py-1.5 px-2 border-r border-slate-900 w-18">Total</th>
                <th className="py-1.5 px-2 w-20">Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400">
              {subjectRows.map((row) => (
                <tr key={row.subjectId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-1 px-3 text-left font-semibold text-slate-900 border-r border-slate-900 whitespace-nowrap">
                    {row.subjectName}
                  </td>
                  <td className="py-1 px-2 text-center text-slate-800 border-r border-slate-900 font-medium">
                    {row.weight}%
                  </td>
                  {periods.map((period) => {
                    const score = row.scores[period.id];
                    return (
                      <td
                        key={period.id}
                        className="py-1 px-2 text-center font-bold text-slate-900 border-r border-slate-900"
                      >
                        {score !== undefined && score !== null ? score : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1 px-2 text-center font-extrabold text-slate-900 border-r border-slate-900 bg-slate-50/50">
                    {row.total}
                  </td>
                  <td className="py-1 px-2 text-center font-black text-slate-900 bg-slate-50/50">
                    {row.average}
                  </td>
                </tr>
              ))}

              {/* ==================================================== */}
              {/* SUMMARY ROWS AT BOTTOM */}
              {/* ==================================================== */}
              {/* TOTAL ROW */}
              <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-900 text-center">
                <td className="py-1.5 px-3 text-left font-black text-slate-900 border-r border-slate-900">
                  Total
                </td>
                <td className="py-1.5 px-2 border-r border-slate-900 font-bold text-slate-900">
                  {summary.totalRow.weight}
                </td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1.5 px-2 border-r border-slate-900 font-black text-slate-900"
                  >
                    {summary.totalRow.periodSums[period.id] ?? '—'}
                  </td>
                ))}
                <td className="py-1.5 px-2 border-r border-slate-900 font-black text-slate-900 bg-slate-200/50">
                  {summary.totalRow.total}
                </td>
                <td className="py-1.5 px-2 font-black text-slate-900 bg-slate-200/50">
                  {summary.totalRow.average}
                </td>
              </tr>

              {/* AVERAGE ROW */}
              <tr className="bg-slate-50 font-bold border-t border-slate-900 text-center">
                <td className="py-1.5 px-3 text-left font-black text-slate-900 border-r border-slate-900">
                  Average
                </td>
                <td className="py-1.5 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1.5 px-2 border-r border-slate-900 font-black text-slate-900"
                  >
                    {summary.averageRow.periodAverages[period.id] !== undefined
                      ? `${summary.averageRow.periodAverages[period.id]}%`
                      : '—'}
                  </td>
                ))}
                <td className="py-1.5 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                <td className="py-1.5 px-2 font-black text-blue-900 bg-blue-50/40">
                  {summary.averageRow.overallAverage}%
                </td>
              </tr>

              {/* RANK ROW */}
              <tr className="border-t border-slate-900 text-center">
                <td className="py-1.5 px-3 text-left font-black text-slate-900 border-r border-slate-900">
                  Rank
                </td>
                <td className="py-1.5 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1.5 px-2 border-r border-slate-900 font-black text-slate-900"
                  >
                    {summary.rank}
                  </td>
                ))}
                <td className="py-1.5 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                <td className="py-1.5 px-2 font-black text-slate-900 bg-amber-50/40">
                  {summary.rank}
                </td>
              </tr>

              {/* CONDUCT ROW */}
              <tr className="border-t border-slate-900 text-center">
                <td className="py-1 px-3 text-left font-black text-slate-900 border-r border-slate-900">
                  Conduct
                </td>
                <td className="py-1 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1 px-2 border-r border-slate-900 font-bold text-slate-900"
                  >
                    {summary.conduct || 'A-'}
                  </td>
                ))}
                <td className="py-1 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                <td className="py-1 px-2 font-bold text-slate-900">{summary.conduct || 'A-'}</td>
              </tr>

              {/* ABSENCE ROW */}
              <tr className="border-t border-slate-900 text-center">
                <td className="py-1 px-3 text-left font-black text-slate-900 border-r border-slate-900">
                  Absence
                </td>
                <td className="py-1 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1 px-2 border-r border-slate-900 font-semibold text-slate-800 text-[11px]"
                  >
                    {summary.absence || '0 Day'}
                  </td>
                ))}
                <td className="py-1 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                <td className="py-1 px-2 font-semibold text-slate-800 text-[11px]">
                  {summary.absence || '0 Day'}
                </td>
              </tr>

              {/* REMARK ROW WITH BADGE */}
              <tr className="border-t border-slate-900 text-center bg-slate-50/50">
                <td className="py-2 px-3 text-left font-black text-slate-900 border-r border-slate-900">
                  Remark
                </td>
                <td className="py-2 px-2 border-r border-slate-900 text-slate-400 font-normal">-</td>
                <td
                  colSpan={periods.length + 2}
                  className="py-2 px-4 text-left font-bold text-slate-900"
                >
                  <div className="flex items-center gap-4">
                    <span className="inline-block px-5 py-1 border-2 border-slate-900 rounded-sm font-black text-xs uppercase tracking-wider text-slate-900 bg-white">
                      {summary.remarkBadge || 'Passed'}
                    </span>
                    {summary.teacherComment && (
                      <span className="text-[11px] italic text-slate-700 font-normal">
                        &ldquo;{summary.teacherComment}&rdquo;
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ==================================================== */}
        {/* 4. OFFICIAL SIGNATURES & INSTITUTIONAL SEALS */}
        {/* ==================================================== */}
        <div className="pt-4 border-t border-slate-400 text-xs text-slate-800">
          <div className="grid grid-cols-3 gap-8 items-end text-center">
            {/* Homeroom Teacher */}
            <div>
              <div className="h-10 border-b border-slate-800 flex items-end justify-center pb-1">
                <span className="font-serif italic text-xs text-slate-700">
                  {academic.homeroomTeacherName}
                </span>
              </div>
              <span className="mt-1 block font-bold text-slate-900">Home-room Teacher</span>
            </div>

            {/* Principal Signature */}
            <div>
              <div className="h-10 border-b border-slate-800 flex items-end justify-center pb-1">
                <span className="font-serif italic text-xs text-slate-700">Official Sign</span>
              </div>
              <span className="mt-1 block font-bold text-slate-900">Principal Signature</span>
            </div>

            {/* School Stamp Seal */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase tracking-tight text-center p-1">
                School Seal / Stamp
              </div>
              <span className="mt-1 block font-bold text-slate-900">Date: {issueDate}</span>
            </div>
          </div>

          {/* Footer Card Verification Note */}
          <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              Report Card ID: <strong className="font-mono text-slate-700">{reportCardId}</strong>
            </span>
            <span>Bright Path School Management System • Official Academic Record</span>
            <span>Issued: {issueDate}</span>
          </div>
        </div>
      </div>

      {/* Embedded Print Styles for A4 Paper */}
      {showPrintStyles && (
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print\\:hidden,
            nav,
            header,
            aside,
            button,
            [role='dialog'] > div:first-child:not(.report-card-container) {
              display: none !important;
            }
            .report-card-container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-shadow: none !important;
              border: none !important;
              page-break-after: always;
            }
          }
        `}</style>
      )}
    </div>
  );
}
