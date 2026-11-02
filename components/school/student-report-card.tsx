'use client';

import React, { useState, useMemo } from 'react';
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
// THEME COLOR UTILITIES
// Harmonizes background & text colors across the entire report card
// ============================================================================
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = (hex || '').replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num) || (c.length !== 6 && c.length !== 8)) {
    return { r: 15, g: 23, b: 42 };
  }
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mixColors(color1: string, color2: string, weight: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const w = Math.max(0, Math.min(1, weight));
  const r = Math.round(rgb1.r * w + rgb2.r * (1 - w));
  const g = Math.round(rgb1.g * w + rgb2.g * (1 - w));
  const b = Math.round(rgb1.b * w + rgb2.b * (1 - w));
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createReportCardTheme(bgColor?: string, textColor?: string) {
  const bg = bgColor || '#ffffff';
  const text = textColor || '#0f172a';

  return {
    bg,
    text,
    textMuted: hexToRgba(text, 0.72),
    textSubtle: hexToRgba(text, 0.55),
    border: hexToRgba(text, 0.28),
    borderLight: hexToRgba(text, 0.16),
    borderStrong: hexToRgba(text, 0.75),
    surface: mixColors(text, bg, 0.04),
    surfaceAlt: mixColors(text, bg, 0.02),
    surfaceStrong: mixColors(text, bg, 0.08),
    surfaceAccent: mixColors(text, bg, 0.12),
  };
}

// ============================================================================
// 1. FRONT PAGE COMPONENT (ገጽ 1: ኦፊሴላዊ የውጤት ካርድ)
// ============================================================================

// ============================================================================
// REPORT CARD PHOTO COMPONENT (With Robust Error Recovery)
// ============================================================================
function ReportCardPhoto({
  photo,
  fullName,
  theme,
}: {
  photo?: string | null;
  fullName: string;
  theme: any;
}) {
  const [hasError, setHasError] = React.useState(false);

  const isValidUrl =
    photo &&
    typeof photo === 'string' &&
    photo.trim() !== '' &&
    photo.trim() !== 'null' &&
    !photo.includes('bright-8uji.onrender.com/uploads/');

  if (!isValidUrl || hasError) {
    return (
      <div
        className="flex flex-col items-center justify-center p-1 text-center select-none w-full h-full"
        style={{ color: theme.text }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center mb-1 shadow-2xs"
          style={{ backgroundColor: theme.surfaceAccent }}
        >
          <span className="text-xs font-black">
            {fullName?.trim()?.charAt(0)?.toUpperCase() || 'S'}
          </span>
        </div>
        <span
          className="text-[9px] font-bold tracking-wider leading-tight"
          style={{ color: theme.textMuted }}
        >
          PHOTO
        </span>
      </div>
    );
  }

  return (
    <img
      src={photo}
      alt={fullName}
      className="w-full h-full object-cover"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

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

  const theme = useMemo(
    () => createReportCardTheme(school?.backgroundColor, school?.textColor),
    [school?.backgroundColor, school?.textColor]
  );
  const borderRadius = typeof school?.borderRadius === 'number' ? school.borderRadius : 4;

  // Compute a live, scan-ready mobile verification URL
  // Target: "https://brightacedemy.vercel.app/verify-report/UNIQUE_REPORT_ID"
  const qrVerificationUrl = useMemo(() => {
    // 1. If backend already encoded a full URL:
    if (qrCodeData && (qrCodeData.startsWith('http://') || qrCodeData.startsWith('https://'))) {
      try {
        const urlObj = new URL(qrCodeData);
        // Replace legacy localhost or old routes with the standard verification domain and route
        const path = urlObj.pathname.includes('/verify/report-card') || urlObj.pathname.includes('/verify-report')
          ? urlObj.pathname
          : `/verify-report/${urlObj.searchParams.get('id') || reportCardId || student?.studentId || 'verified'}`;

        // If it's a query param format, convert to cleaner REST /verify-report/:id format
        const idParam = urlObj.searchParams.get('id');
        if (idParam) {
          return `https://brightacedemy.vercel.app/verify-report/${encodeURIComponent(idParam)}`;
        }
        return `https://brightacedemy.vercel.app${path}`;
      } catch {
        // Fallback
      }
    }

    // 2. Identify unique report identifier
    const targetId = reportCardId || student?.studentId || student?.id || 'verified';
    return `https://brightacedemy.vercel.app/verify-report/${encodeURIComponent(targetId)}`;
  }, [qrCodeData, reportCardId, student]);

  return (
    <div
      className={`report-card-front relative font-sans p-6 sm:p-8 max-w-[210mm] mx-auto shadow-sm print:shadow-none print:p-4 print:max-w-none print:w-full select-text ${className}`}
      style={{
        boxSizing: 'border-box',
        minHeight: '290mm',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        backgroundColor: theme.bg,
        color: theme.text,
        border: `3px solid ${theme.borderStrong}`,
        outline: `1px solid ${theme.borderLight}`,
        outlineOffset: '-6px',
        borderRadius: `${borderRadius}px`, overflow: 'hidden',
        // Centralized CSS variables for nested elements and print
        ['--rc-bg' as any]: theme.bg,
        ['--rc-text' as any]: theme.text,
        ['--rc-text-muted' as any]: theme.textMuted,
        ['--rc-border' as any]: theme.border,
        ['--rc-surface' as any]: theme.surface,
        ['--rc-surface-strong' as any]: theme.surfaceStrong,
      }}
    >
      {/* Background Watermark Crest */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="relative w-80 h-80 opacity-[0.04] grayscale print:opacity-[0.05]">
          <Image
            src={school.logo || '/bright-path-logo.png'}
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
        <div
          className="pb-3"
          style={{ borderBottom: `2px solid ${theme.borderStrong}` }}
        >
          <div className="flex items-start justify-between gap-3">
            {/* Left School Logo Emblem */}
            <div className="flex-shrink-0 pt-0.5">
              <div
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-2xs"
                style={{
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <Image
                  src={school.logo || '/bright-path-logo.png'}
                  alt={school.name}
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>
            </div>

            {/* Center School Titles & Contact */}
            <div className="flex-1 text-center px-2">
              <h1
                className="text-xl sm:text-2xl font-black tracking-tight leading-tight"
                style={{ color: theme.text }}
              >
                {school.amharicName || 'ብራይት ፓዝ ት/ቤት'} ::
              </h1>
              <h2
                className="text-lg sm:text-xl font-bold tracking-wide mt-0.5 font-serif italic"
                style={{ color: theme.text }}
              >
                {school.name || 'Bright Path School'}
              </h2>
              <div
                className="flex items-center justify-center gap-3 text-[11px] sm:text-xs font-medium mt-1"
                style={{ color: theme.textMuted }}
              >
                <span>{school.address || 'Dire Dawa'}</span>
                <span>•</span>
                <span>☎ {school.phone || '0251 - 11 41 87'}</span>
                <span>•</span>
                <span>✉ 1838</span>
              </div>
              <div className="mt-1.5">
                <span
                  className="inline-block text-xs sm:text-sm font-bold tracking-wider pb-0.5 uppercase"
                  style={{
                    color: theme.text,
                    borderBottom: `1.5px solid ${theme.borderStrong}`,
                  }}
                >
                  Student&apos;s Grade Report
                </span>
              </div>
            </div>

            {/* Right Side: QR Code Verification Badge */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-0.5">
              <div
                className="p-1.5 rounded-sm shadow-xs bg-white flex items-center justify-center"
                style={{
                  backgroundColor: '#ffffff',
                  border: `1.5px solid ${theme.borderStrong}`,
                }}
              >
                <QRCodeSVG
                  value={qrVerificationUrl}
                  size={76}
                  level="M"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <span
                className="text-[9px] font-mono mt-0.5 tracking-tighter"
                style={{ color: theme.textSubtle }}
              >
                {reportCardId ? reportCardId.substring(0, 14) : 'BP-VERIFIED'}
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 2. STUDENT & CLASS INFORMATION BAR */}
        {/* ==================================================== */}
        <div
          className="flex items-center justify-between gap-4 py-2 px-3 rounded-sm text-xs sm:text-[13px]"
          style={{
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderLeft: `4px solid ${theme.borderStrong}`,
          }}
        >
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Home-room Teacher&apos;s Name :{' '}
                </span>
                <span
                  style={{
                    color: theme.text,
                    textDecorationColor: theme.border,
                  }}
                  className="font-bold underline decoration-1 underline-offset-2"
                >
                  {academic.homeroomTeacherName || 'Anteeh Addisu Legesse'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Student&apos;s Name :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-black text-sm">
                  {student.fullName}
                </span>
              </div>
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Gender :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-bold">
                  {student.gender || 'M'}
                </span>
              </div>
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Age :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-bold">
                  {student.age || '14'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Grade :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-bold">
                  {academic.gradeName}
                </span>
              </div>
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Section :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-bold">
                  {academic.sectionName}
                </span>
              </div>
              {academic.streamName && (
                <div>
                  <span style={{ color: theme.textMuted }} className="font-semibold">
                    Stream :{' '}
                  </span>
                  <span
                    style={{
                      color: theme.text,
                      backgroundColor: theme.surfaceStrong,
                      border: `1px solid ${theme.border}`,
                    }}
                    className="font-black px-1.5 py-0.5 rounded"
                  >
                    {academic.streamName}
                  </span>
                </div>
              )}
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Year :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-bold">
                  {academic.academicYearName}
                </span>
              </div>
              <div>
                <span style={{ color: theme.textMuted }} className="font-semibold">
                  Student ID :{' '}
                </span>
                <span style={{ color: theme.text }} className="font-mono font-bold">
                  {student.studentId}
                </span>
              </div>
            </div>
          </div>

          {/* Student Photo */}
          <div className="flex-shrink-0">
            <div
              className="w-16 h-20 sm:w-18 sm:h-22 rounded-sm overflow-hidden relative flex items-center justify-center shadow-2xs"
              style={{
                border: `2px solid ${theme.border}`,
                backgroundColor: theme.surfaceStrong,
              }}
            >
              <ReportCardPhoto
                photo={student.photo}
                fullName={student.fullName}
                theme={theme}
              />
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 3. DYNAMIC SUBJECT RESULT TABLE */}
        {/* ==================================================== */}
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs border-collapse"
            style={{
              border: `2px solid ${theme.borderStrong}`,
              color: theme.text,
            }}
          >
            <thead>
              <tr
                className="font-bold text-center text-[11px] sm:text-xs"
                style={{
                  backgroundColor: theme.surfaceStrong,
                  color: theme.text,
                  borderBottom: `2px solid ${theme.borderStrong}`,
                }}
              >
                <th
                  className="py-1.5 px-3 text-left w-36 sm:w-44"
                  style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                >
                  Subject
                </th>
                <th
                  className="py-1.5 px-2 w-16"
                  style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                >
                  Weight
                </th>
                {periods.map((period) => (
                  <th
                    key={period.id}
                    className="py-1.5 px-2 w-20"
                    style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                  >
                    {period.label}
                  </th>
                ))}
                <th
                  className="py-1.5 px-2 w-18"
                  style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                >
                  Total
                </th>
                <th className="py-1.5 px-2 w-24">Average</th>
              </tr>
            </thead>
            <tbody>
              {subjectRows.map((row, idx) => {
                const policyPassingThreshold =
                  summary.passingMinScore ?? card.gradingPolicy?.passingMinScore ?? 50;
                const isRowFailing = row.isPassing === false;
                const rowBg = idx % 2 === 1 ? theme.surfaceAlt : 'transparent';

                return (
                  <tr
                    key={row.subjectId}
                    style={{
                      backgroundColor: rowBg,
                      borderBottom: `1px solid ${theme.border}`,
                    }}
                  >
                    <td
                      className="py-1 px-3 text-left font-semibold whitespace-nowrap"
                      style={{
                        borderRight: `1px solid ${theme.border}`,
                        color: theme.text,
                      }}
                    >
                      {row.subjectName}
                    </td>
                    <td
                      className="py-1 px-2 text-center font-medium"
                      style={{
                        borderRight: `1px solid ${theme.border}`,
                        color: theme.textMuted,
                      }}
                    >
                      {row.weight}%
                    </td>
                    {periods.map((period) => {
                      const score = row.scores[period.id];
                      const hasScore = score !== undefined && score !== null;
                      const isPeriodFailing = hasScore && Number(score) < policyPassingThreshold;
                      return (
                        <td
                          key={period.id}
                          className="py-1 px-2 text-center font-bold"
                          style={{
                            borderRight: `1px solid ${theme.border}`,
                            color: isPeriodFailing ? '#e11d48' : theme.text,
                          }}
                        >
                          {hasScore ? score : '—'}
                        </td>
                      );
                    })}
                    <td
                      className="py-1 px-2 text-center font-extrabold"
                      style={{
                        borderRight: `1px solid ${theme.border}`,
                        backgroundColor: theme.surfaceAlt,
                        color: theme.text,
                      }}
                    >
                      {row.total}
                    </td>
                    <td
                      className="py-1 px-2 text-center font-black"
                      style={{
                        backgroundColor: theme.surfaceAlt,
                        color: isRowFailing ? '#e11d48' : theme.text,
                      }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{row.average}</span>
                        {isRowFailing && (
                          <span className="text-[8.5px] px-1 py-0.2 rounded font-black uppercase bg-rose-100 text-rose-700 border border-rose-300">
                            Fail
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* ==================================================== */}
              {/* SUMMARY ROWS AT BOTTOM */}
              {/* ==================================================== */}
              {/* TOTAL ROW */}
              <tr
                className="font-bold text-center"
                style={{
                  backgroundColor: theme.surfaceStrong,
                  borderTop: `2px solid ${theme.borderStrong}`,
                }}
              >
                <td
                  className="py-1.5 px-3 text-left font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  Total
                </td>
                <td
                  className="py-1.5 px-2 font-bold"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  {summary.totalRow.weight}
                </td>
                {periods.map((period) => {
                  const pSum = summary.totalRow.periodSums[period.id];
                  return (
                    <td
                      key={period.id}
                      className="py-1.5 px-2 font-black"
                      style={{
                        borderRight: `1px solid ${theme.borderStrong}`,
                        color: theme.text,
                      }}
                    >
                      {pSum !== null && pSum !== undefined ? pSum : '—'}
                    </td>
                  );
                })}
                <td
                  className="py-1.5 px-2 font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    backgroundColor: theme.surfaceAccent,
                    color: theme.text,
                  }}
                >
                  {summary.totalRow.total}
                </td>
                <td
                  className="py-1.5 px-2 font-black"
                  style={{
                    backgroundColor: theme.surfaceAccent,
                    color: theme.text,
                  }}
                >
                  {summary.totalRow.average}
                </td>
              </tr>

              {/* AVERAGE ROW */}
              <tr
                className="font-bold text-center"
                style={{
                  backgroundColor: theme.surface,
                  borderTop: `1px solid ${theme.borderStrong}`,
                }}
              >
                <td
                  className="py-1.5 px-3 text-left font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  Average
                </td>
                <td
                  className="py-1.5 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                {periods.map((period) => {
                  const pAvg = summary.averageRow.periodAverages[period.id];
                  return (
                    <td
                      key={period.id}
                      className="py-1.5 px-2 font-black"
                      style={{
                        borderRight: `1px solid ${theme.borderStrong}`,
                        color: theme.text,
                      }}
                    >
                      {pAvg !== null && pAvg !== undefined ? `${pAvg}%` : '—'}
                    </td>
                  );
                })}
                <td
                  className="py-1.5 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                <td
                  className="py-1.5 px-2 font-black"
                  style={{
                    backgroundColor: theme.surfaceAccent,
                    color: theme.text,
                  }}
                >
                  {summary.averageRow.overallAverage}%
                </td>
              </tr>

              {/* RANK ROW */}
              <tr
                className="text-center"
                style={{ borderTop: `1px solid ${theme.borderStrong}` }}
              >
                <td
                  className="py-1.5 px-3 text-left font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  Rank
                </td>
                <td
                  className="py-1.5 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1.5 px-2 font-black"
                    style={{
                      borderRight: `1px solid ${theme.borderStrong}`,
                      color: theme.text,
                    }}
                  >
                    {summary.rank}
                  </td>
                ))}
                <td
                  className="py-1.5 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                <td
                  className="py-1.5 px-2 font-black"
                  style={{
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                  }}
                >
                  {summary.rank}
                </td>
              </tr>

              {/* CONDUCT ROW */}
              <tr
                className="text-center"
                style={{ borderTop: `1px solid ${theme.borderStrong}` }}
              >
                <td
                  className="py-1 px-3 text-left font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  Conduct
                </td>
                <td
                  className="py-1 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1 px-2 font-bold"
                    style={{
                      borderRight: `1px solid ${theme.borderStrong}`,
                      color: theme.text,
                    }}
                  >
                    {summary.conduct || 'A-'}
                  </td>
                ))}
                <td
                  className="py-1 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                <td className="py-1 px-2 font-bold" style={{ color: theme.text }}>
                  {summary.conduct || 'A-'}
                </td>
              </tr>

              {/* ABSENCE ROW */}
              <tr
                className="text-center"
                style={{ borderTop: `1px solid ${theme.borderStrong}` }}
              >
                <td
                  className="py-1 px-3 text-left font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  Absence
                </td>
                <td
                  className="py-1 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                {periods.map((period) => (
                  <td
                    key={period.id}
                    className="py-1 px-2 font-semibold text-[11px]"
                    style={{
                      borderRight: `1px solid ${theme.borderStrong}`,
                      color: theme.textMuted,
                    }}
                  >
                    {summary.absence || '0 Day'}
                  </td>
                ))}
                <td
                  className="py-1 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                <td
                  className="py-1 px-2 font-semibold text-[11px]"
                  style={{ color: theme.textMuted }}
                >
                  {summary.absence || '0 Day'}
                </td>
              </tr>

              {/* REMARK ROW WITH BADGE & PASS/FAIL INDICATORS */}
              <tr
                className="text-center"
                style={{
                  borderTop: `1px solid ${theme.borderStrong}`,
                  backgroundColor: theme.surfaceAlt,
                }}
              >
                <td
                  className="py-2 px-3 text-left font-black"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.text,
                  }}
                >
                  Remark
                </td>
                <td
                  className="py-2 px-2 font-normal"
                  style={{
                    borderRight: `1px solid ${theme.borderStrong}`,
                    color: theme.textSubtle,
                  }}
                >
                  -
                </td>
                <td
                  colSpan={periods.length + 2}
                  className="py-2 px-4 text-left font-bold"
                  style={{ color: theme.text }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="inline-block px-4 py-1 border-2 rounded-sm font-black text-xs uppercase tracking-wider"
                      style={{
                        backgroundColor: theme.surface,
                        borderColor: summary.remarkBadge?.toLowerCase().includes('fail')
                          ? '#e11d48'
                          : summary.remarkBadge?.toLowerCase().includes('incomplete')
                          ? '#d97706'
                          : theme.borderStrong,
                        color: summary.remarkBadge?.toLowerCase().includes('fail')
                          ? '#e11d48'
                          : summary.remarkBadge?.toLowerCase().includes('incomplete')
                          ? '#d97706'
                          : theme.text,
                      }}
                    >
                      {summary.remarkBadge || 'Passed'}
                    </span>
                    {summary.remarkBadge?.toLowerCase().includes('incomplete') && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-300">
                        Incomplete marks: Missing assessment or term evaluation
                      </span>
                    )}
                    {!summary.remarkBadge?.toLowerCase().includes('incomplete') &&
                      summary.failedSubjectsCount !== undefined &&
                      summary.failedSubjectsCount > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {summary.failedSubjectsCount}{' '}
                          {summary.failedSubjectsCount === 1 ? 'subject' : 'subjects'} below 50%
                        </span>
                      )}
                    {summary.teacherComment && (
                      <span
                        className="text-[11px] italic font-normal"
                        style={{ color: theme.textMuted }}
                      >
                        Teacher: &ldquo;{summary.teacherComment}&rdquo;
                      </span>
                    )}
                    {summary.principalComment && (
                      <span
                        className="text-[11px] italic font-normal"
                        style={{ color: theme.textMuted }}
                      >
                        Principal: &ldquo;{summary.principalComment}&rdquo;
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
        <div
          className="pt-4 text-xs"
          style={{
            borderTop: `1px solid ${theme.border}`,
            color: theme.text,
          }}
        >
          <div className="grid grid-cols-3 gap-8 items-end text-center">
            {/* Homeroom Teacher */}
            <div>
              <div
                className="h-10 flex items-end justify-center pb-1"
                style={{ borderBottom: `1px solid ${theme.borderStrong}` }}
              >
                <span
                  className="font-serif italic text-xs"
                  style={{ color: theme.textMuted }}
                >
                  {academic.homeroomTeacherName}
                </span>
              </div>
              <span className="mt-1 block font-bold" style={{ color: theme.text }}>
                Home-room Teacher
              </span>
            </div>

            {/* Principal Signature */}
            <div>
              <div
                className="h-10 flex items-end justify-center pb-1"
                style={{ borderBottom: `1px solid ${theme.borderStrong}` }}
              >
                <span
                  className="font-serif italic text-xs"
                  style={{ color: theme.textMuted }}
                >
                  Official Sign
                </span>
              </div>
              <span className="mt-1 block font-bold" style={{ color: theme.text }}>
                Principal Signature
              </span>
            </div>

            {/* Official School Stamp Seal */}
            <div className="flex flex-col items-center">
              <div
                className="w-18 h-18 rounded-full border-2 flex flex-col items-center justify-center text-center p-1 relative shadow-2xs"
                style={{
                  borderColor: theme.borderStrong,
                  backgroundColor: theme.surface,
                }}
              >
                <div
                  className="w-14 h-14 rounded-full border border-dashed flex flex-col items-center justify-center p-0.5"
                  style={{ borderColor: theme.border }}
                >
                  <span
                    className="text-[7.5px] font-black uppercase tracking-tighter leading-none"
                    style={{ color: theme.text }}
                  >
                    BRIGHT PATH
                  </span>
                  <span
                    className="text-[6.5px] font-bold tracking-tight my-0.5"
                    style={{ color: theme.textMuted }}
                  >
                    ★ SEAL ★
                  </span>
                  <span
                    className="text-[6px] font-mono font-bold leading-none"
                    style={{ color: theme.textSubtle }}
                  >
                    DIRE DAWA
                  </span>
                </div>
              </div>
              <span
                className="mt-1 block font-bold text-[11px]"
                style={{ color: theme.text }}
              >
                Official Seal & Stamp
              </span>
              <span className="text-[10px]" style={{ color: theme.textSubtle }}>
                Date: {issueDate}
              </span>
            </div>
          </div>

          {/* Footer Card Verification Note */}
          <div
            className="mt-4 pt-2 flex items-center justify-between text-[10px]"
            style={{
              borderTop: `1px solid ${theme.borderLight}`,
              color: theme.textSubtle,
            }}
          >
            <span>
              Report Card ID:{' '}
              <strong className="font-mono" style={{ color: theme.text }}>
                {reportCardId}
              </strong>
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
// ============================================================================
export function StudentReportCardBack({
  card,
  className = '',
}: {
  card: ComprehensiveReportCardData;
  className?: string;
}) {
  const { school, student, academic, summary, reportCardId, issueDate } = card;

  const theme = useMemo(
    () => createReportCardTheme(school?.backgroundColor, school?.textColor),
    [school?.backgroundColor, school?.textColor]
  );
  const borderRadius = typeof school?.borderRadius === 'number' ? school.borderRadius : 4;

  // Official School Grading Scale Rubric according to active grading policy
  const gradingScales =
    card.gradingPolicy?.scales && card.gradingPolicy.scales.length > 0
      ? card.gradingPolicy.scales.map((s) => ({
          grade: s.grade,
          range: `${s.minScore} – ${s.maxScore}%`,
          gpa: s.gpaPoint !== null && s.gpaPoint !== undefined ? s.gpaPoint.toFixed(2) : '—',
          descEn: s.description || (s.isPassing ? 'Passing' : 'Failing'),
          descAm: s.isPassing ? 'ማለፊያ' : 'የማያልፍ / ዝቅተኛ',
          remark: s.isPassing ? 'Passing Standard' : 'Retention / Non-Passing',
          isPassing: s.isPassing,
        }))
      : [
          { grade: 'A+', range: '90 – 100%', gpa: '4.00', descEn: 'Outstanding', descAm: 'እጅግ በጣም ከፍተኛ ብልጫ', remark: 'Outstanding Mastery', isPassing: true },
          { grade: 'A', range: '85 – 89.99%', gpa: '4.00', descEn: 'Excellent', descAm: 'ከፍተኛ ብልጫ', remark: 'Superior Competence', isPassing: true },
          { grade: 'B+', range: '80 – 84.99%', gpa: '3.50', descEn: 'Very Good', descAm: 'በጣም ጥሩ', remark: 'Above Average Standard', isPassing: true },
          { grade: 'B', range: '75 – 79.99%', gpa: '3.00', descEn: 'Good', descAm: 'ጥሩ', remark: 'Above Average Standard', isPassing: true },
          { grade: 'C+', range: '65 – 74.99%', gpa: '2.50', descEn: 'Satisfactory', descAm: 'አጥጋቢ', remark: 'Meets Curricular Standards', isPassing: true },
          { grade: 'C', range: '60 – 64.99%', gpa: '2.00', descEn: 'Average', descAm: 'መካከለኛ', remark: 'Meets Curricular Standards', isPassing: true },
          { grade: 'D', range: '50 – 59.99%', gpa: '1.00', descEn: 'Passing', descAm: 'ማለፊያ', remark: 'Passing Benchmark', isPassing: true },
          { grade: 'F', range: '0 – 49.99%', gpa: '0.00', descEn: 'Failing', descAm: 'የማያልፍ / ዝቅተኛ', remark: 'Retention / Non-Passing', isPassing: false },
        ];

  // Conduct Rubrics
  const conductRubrics = [
    {
      code: 'A',
      titleEn: 'Exemplary',
      titleAm: 'እጅግ በጣም ጥሩ',
      description:
        'Demonstrates outstanding self-discipline, respect for school regulations, positive peer cooperation, and active civic participation.',
    },
    {
      code: 'B',
      titleEn: 'Good',
      titleAm: 'ጥሩ',
      description:
        'Consistently abides by school rules, shows respectful conduct to educators and classmates, and maintains steady punctuality.',
    },
    {
      code: 'C',
      titleEn: 'Satisfactory',
      titleAm: 'አጥጋቢ',
      description:
        'Complies with general institutional discipline; occasionally requires guidance or redirection regarding focus and timeliness.',
    },
    {
      code: 'D',
      titleEn: 'Needs Improvement',
      titleAm: 'መሻሻል የሚፈልግ',
      description:
        'Exhibits repeated unexcused tardiness, behavioral concerns, or breach of school guidelines requiring targeted counseling.',
    },
  ];

  return (
    <div
      className={`report-card-back relative font-sans p-6 sm:p-8 max-w-[210mm] mx-auto shadow-sm print:shadow-none print:p-4 print:max-w-none print:w-full select-text ${className}`}
      style={{
        boxSizing: 'border-box',
        minHeight: '290mm',
        backgroundColor: theme.bg,
        color: theme.text,
        border: `3px solid ${theme.borderStrong}`,
        outline: `1px solid ${theme.borderLight}`,
        outlineOffset: '-6px',
        borderRadius: `${borderRadius}px`, overflow: 'hidden',
        ['--rc-bg' as any]: theme.bg,
        ['--rc-text' as any]: theme.text,
        ['--rc-text-muted' as any]: theme.textMuted,
        ['--rc-border' as any]: theme.border,
        ['--rc-surface' as any]: theme.surface,
        ['--rc-surface-strong' as any]: theme.surfaceStrong,
      }}
    >
      {/* Background Watermark Crest */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="relative w-80 h-80 opacity-[0.03] grayscale print:opacity-[0.04]">
          <Image
            src={school.logo || '/bright-path-logo.png'}
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
        <div
          className="pb-2.5"
          style={{ borderBottom: `2px solid ${theme.borderStrong}` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                style={{
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <Image
                  src={school.logo || '/bright-path-logo.png'}
                  alt={school.name}
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div>
                <h2
                  className="text-sm sm:text-base font-black tracking-tight"
                  style={{ color: theme.text }}
                >
                  {school.amharicName || 'ብራይት ፓዝ ት/ቤት'} • {school.name}
                </h2>
                <p className="text-[10px] font-medium" style={{ color: theme.textMuted }}>
                  {school.address} • Tel: {school.phone || '0251 - 11 41 87'} • Official Academic Evaluation System
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className="inline-block text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xs"
                style={{
                  backgroundColor: theme.surfaceStrong,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                }}
              >
                Page 2 • ገጽ 2 (Back)
              </span>
            </div>
          </div>

          <div
            className="mt-2 text-center py-1 px-2 rounded-xs"
            style={{
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              borderLeft: `4px solid ${theme.borderStrong}`,
            }}
          >
            <h1
              className="text-xs sm:text-sm font-black tracking-wide uppercase"
              style={{ color: theme.text }}
            >
              Academic Grading Scale, Conduct Evaluation & Promotion Regulations
            </h1>
            <p className="text-[10px] font-bold" style={{ color: theme.textMuted }}>
              የደረጃ አሰጣጥ መለኪያ፣ የስነ-ምግባር መመዘኛ እና የትምህርት ደንብ
            </p>
          </div>
        </div>

        {/* Quick Student Identification Banner */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-3 rounded-xs text-[11px] sm:text-xs"
          style={{
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            color: theme.text,
          }}
        >
          <div>
            <span style={{ color: theme.textMuted }} className="font-semibold">Student: </span>
            <span style={{ color: theme.text }} className="font-bold">{student.fullName}</span>
          </div>
          <div>
            <span style={{ color: theme.textMuted }} className="font-semibold">ID: </span>
            <span style={{ color: theme.text }} className="font-mono font-bold">{student.studentId}</span>
          </div>
          <div>
            <span style={{ color: theme.textMuted }} className="font-semibold">Grade & Sec: </span>
            <span style={{ color: theme.text }} className="font-bold">
              {academic.gradeName} &ldquo;{academic.sectionName}&rdquo;
            </span>
          </div>
          {academic.streamName && (
            <div>
              <span style={{ color: theme.textMuted }} className="font-semibold">Stream: </span>
              <span style={{ color: theme.text }} className="font-bold">{academic.streamName}</span>
            </div>
          )}
          <div>
            <span style={{ color: theme.textMuted }} className="font-semibold">Academic Year: </span>
            <span style={{ color: theme.text }} className="font-bold">{academic.academicYearName}</span>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 2. SECTION 1: GRADING SYSTEM TABLE */}
        {/* ==================================================== */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3
              className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: theme.text }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: theme.borderStrong }}
              />
              1. Grading Scale & Evaluation Key (የደረጃ አሰጣጥ መለኪያ)
            </h3>
            <span className="text-[10px] font-medium" style={{ color: theme.textMuted }}>
              Secondary Education Standard
            </span>
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-xs border-collapse"
              style={{
                border: `2px solid ${theme.borderStrong}`,
                color: theme.text,
              }}
            >
              <thead>
                <tr
                  className="font-bold text-center text-[10px] sm:text-[11px]"
                  style={{
                    backgroundColor: theme.surfaceStrong,
                    color: theme.text,
                    borderBottom: `2px solid ${theme.borderStrong}`,
                  }}
                >
                  <th
                    className="py-1 px-2 w-14"
                    style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                  >
                    Grade
                  </th>
                  <th
                    className="py-1 px-2 w-24"
                    style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                  >
                    Mark Range (%)
                  </th>
                  <th
                    className="py-1 px-2 w-16"
                    style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                  >
                    GPA Points
                  </th>
                  <th
                    className="py-1 px-3 text-left w-36"
                    style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                  >
                    Description (English)
                  </th>
                  <th
                    className="py-1 px-3 text-left w-44"
                    style={{ borderRight: `1px solid ${theme.borderStrong}` }}
                  >
                    መግለጫ (Amharic)
                  </th>
                  <th className="py-1 px-2 text-left">Academic Status</th>
                </tr>
              </thead>
              <tbody className="text-[10px] sm:text-[11px]">
                {gradingScales.map((scale, idx) => {
                  const rowBg = idx % 2 === 1 ? theme.surfaceAlt : 'transparent';
                  return (
                    <tr
                      key={scale.grade}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: `1px solid ${theme.border}`,
                      }}
                    >
                      <td
                        className="py-1 px-2 text-center font-black"
                        style={{
                          borderRight: `1px solid ${theme.border}`,
                          backgroundColor: theme.surfaceAlt,
                          color: theme.text,
                        }}
                      >
                        {scale.grade}
                      </td>
                      <td
                        className="py-1 px-2 text-center font-bold"
                        style={{
                          borderRight: `1px solid ${theme.border}`,
                          color: theme.text,
                        }}
                      >
                        {scale.range}
                      </td>
                      <td
                        className="py-1 px-2 text-center font-mono font-bold"
                        style={{
                          borderRight: `1px solid ${theme.border}`,
                          color: theme.textMuted,
                        }}
                      >
                        {scale.gpa}
                      </td>
                      <td
                        className="py-1 px-3 text-left font-semibold"
                        style={{
                          borderRight: `1px solid ${theme.border}`,
                          color: theme.text,
                        }}
                      >
                        {scale.descEn}
                      </td>
                      <td
                        className="py-1 px-3 text-left font-medium"
                        style={{
                          borderRight: `1px solid ${theme.border}`,
                          color: theme.text,
                        }}
                      >
                        {scale.descAm}
                      </td>
                      <td
                        className="py-1 px-2 text-left font-medium"
                        style={{
                          color: scale.isPassing ? theme.textMuted : '#e11d48',
                        }}
                      >
                        {scale.remark}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 3. SECTION 2: CONDUCT & BEHAVIORAL SCALE */}
        {/* ==================================================== */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3
              className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: theme.text }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: theme.borderStrong }}
              />
              2. Conduct & Behavioral Evaluation Criteria (የስነ-ምግባር እና ጠባይ መመዘኛ)
            </h3>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-xs"
              style={{
                color: theme.text,
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
              }}
            >
              Student Conduct Record: {summary.conduct || 'A-'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {conductRubrics.map((r) => (
              <div
                key={r.code}
                className="p-2 rounded-xs text-[10px] sm:text-[11px] flex items-start gap-2"
                style={{
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.surfaceAlt,
                }}
              >
                <div
                  className="w-6 h-6 rounded-full font-black flex items-center justify-center flex-shrink-0 text-xs mt-0.5 shadow-2xs"
                  style={{
                    backgroundColor: theme.surfaceStrong,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {r.code}
                </div>
                <div className="flex-1 leading-tight">
                  <div className="flex items-center gap-1.5 font-bold" style={{ color: theme.text }}>
                    <span>{r.titleEn}</span>
                    <span>•</span>
                    <span style={{ color: theme.textMuted }}>{r.titleAm}</span>
                  </div>
                  <p className="mt-0.5 leading-snug" style={{ color: theme.textMuted }}>
                    {r.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 4. SECTION 3: HOMEROOM TEACHER'S GUIDANCE & REMARKS */}
        {/* ==================================================== */}
        <div>
          <h3
            className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 mb-1"
            style={{ color: theme.text }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: theme.borderStrong }}
            />
            3. Homeroom Teacher&apos;s Guidance & Remarks (የክፍል ኃላፊ መምህር አጠቃላይ አስተያየት)
          </h3>

          <div
            className="rounded-xs p-2.5 text-[10px] sm:text-[11px]"
            style={{
              border: `1px solid ${theme.borderStrong}`,
              backgroundColor: theme.surfaceAlt,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-[10px] sm:text-[11px]" style={{ color: theme.text }}>
                Teacher&apos;s Holistic Evaluation (አጠቃላይ ምዘና):
              </span>
              <span className="font-serif italic text-[11px]" style={{ color: theme.textMuted }}>
                {academic.homeroomTeacherName}
              </span>
            </div>
            <div
              className="mt-1.5 p-2 rounded-xs min-h-[46px] flex items-center"
              style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
              }}
            >
              <p className="italic text-[11px] leading-relaxed" style={{ color: theme.text }}>
                {summary.teacherComment ? (
                  `“${summary.teacherComment}”`
                ) : (
                  `Student ${student.fullName} has successfully concluded the academic session with satisfactory discipline and commitment. Continual dedication to rigorous academic review is strongly advised for next term.`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 5. SECTION 4: PROMOTION POLICY & REGULATIONS */}
        {/* ==================================================== */}
        <div>
          <h3
            className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 mb-1"
            style={{ color: theme.text }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: theme.borderStrong }}
            />
            4. Academic Promotion & Attendance Regulations (የክፍል ማለፊያ እና የተማሪዎች ክትትል ደንብ)
          </h3>

          <div
            className="rounded-xs p-2.5 text-[10px] sm:text-[11px] space-y-1 leading-snug"
            style={{
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.surfaceAlt,
              color: theme.text,
            }}
          >
            <div className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">1. Passing Standard (የማለፊያ መስፈርት):</span>
              <span style={{ color: theme.textMuted }}>
                A minimum combined cumulative average of {(summary.passingMinScore ?? card.gradingPolicy?.passingMinScore ?? 50).toFixed(1)}% across both semesters is mandatory for promotion to the subsequent grade level.
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">2. Attendance Requirement (የትምህርት ገበታ ክትትል):</span>
              <span style={{ color: theme.textMuted }}>
                Students must attend a minimum of 85% of official school instruction days. Unexcused absenteeism exceeding 15% results in automatic disqualification or retention.
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">3. Retention Threshold (የማይፈቀድ የወደቀ ውጤት):</span>
              <span style={{ color: theme.textMuted }}>
                A student who receives failing marks in three or more subjects is subject to academic retention pursuant to national curriculum standards.
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">4. Official Credential Integrity (የሰነድ ህጋዊነት):</span>
              <span style={{ color: theme.textMuted }}>
                This grade report is an official institutional record of {school.name}. Any erasure, alteration, or uncertified copying renders this certificate completely null and void.
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* 6. BOTTOM OFFICIAL CERTIFICATION & SEALS */}
        {/* ==================================================== */}
        <div
          className="pt-3 text-xs"
          style={{
            borderTop: `2px solid ${theme.borderStrong}`,
            color: theme.text,
          }}
        >
          <div className="grid grid-cols-3 gap-8 items-end text-center">
            {/* Academic Director / Registrar */}
            <div>
              <div
                className="h-9 flex items-end justify-center pb-1"
                style={{ borderBottom: `1px solid ${theme.borderStrong}` }}
              >
                <span className="font-serif italic text-xs" style={{ color: theme.textMuted }}>
                  Official Sign
                </span>
              </div>
              <span className="mt-1 block font-bold text-[11px]" style={{ color: theme.text }}>
                Academic Registrar / Director
              </span>
            </div>

            {/* School Seal / Stamp */}
            <div className="flex flex-col items-center">
              <div
                className="relative w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center text-center p-1 shadow-xs"
                style={{
                  borderColor: theme.borderStrong,
                  backgroundColor: theme.surface,
                }}
              >
                <div
                  className="absolute inset-1 rounded-full border border-dashed pointer-events-none"
                  style={{ borderColor: theme.border }}
                />
                <span
                  className="text-[7.5px] font-black uppercase tracking-tighter leading-none"
                  style={{ color: theme.text }}
                >
                  BRIGHT PATH
                </span>
                <span
                  className="text-[6.5px] font-bold leading-none my-0.5"
                  style={{ color: theme.textMuted }}
                >
                  ★ SEAL ★
                </span>
                <span
                  className="text-[6px] font-medium leading-none"
                  style={{ color: theme.textSubtle }}
                >
                  DIRE DAWA
                </span>
              </div>
              <span className="mt-1 block font-bold text-[11px]" style={{ color: theme.text }}>
                Date: {issueDate}
              </span>
            </div>

            {/* Academic Year Verification */}
            <div>
              <div
                className="h-9 flex items-end justify-center pb-1"
                style={{ borderBottom: `1px solid ${theme.borderStrong}` }}
              >
                <span className="font-mono font-bold text-xs" style={{ color: theme.text }}>
                  {academic.academicYearName}
                </span>
              </div>
              <span className="mt-1 block font-bold text-[11px]" style={{ color: theme.text }}>
                Curriculum Year Approved
              </span>
            </div>
          </div>

          {/* Footer note */}
          <div
            className="mt-3 pt-1.5 flex items-center justify-between text-[10px]"
            style={{
              borderTop: `1px solid ${theme.borderLight}`,
              color: theme.textSubtle,
            }}
          >
            <span>
              Card ID:{' '}
              <strong className="font-mono" style={{ color: theme.text }}>
                {reportCardId}
              </strong>
            </span>
            <span>Ethiopian Secondary Education Curriculum System • Back Page (ገጽ 2)</span>
            <span>
              Status:{' '}
              <strong>
                {card.status === 'PUBLISHED' ? 'OFFICIAL / AUTHENTICATED' : card.status || 'AUTHENTICATED'}
              </strong>
            </span>
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

  const theme = useMemo(
    () => createReportCardTheme(card.school?.backgroundColor, card.school?.textColor),
    [card.school?.backgroundColor, card.school?.textColor]
  );

  return (
    <div
      className={`report-card-wrapper w-full ${className}`}
      style={{
        ['--rc-bg' as any]: theme.bg,
        ['--rc-text' as any]: theme.text,
      }}
    >
      {/* Interactive Page View Selector (Hidden during printing) */}
      {allowSideToggle && (
        <div className="mb-4 flex items-center justify-center gap-2 print:hidden">
          <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-md flex items-center gap-1 shadow-inner text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSide('both')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeSide === 'both'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Both Pages (Print Ready • 2-Sided)
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('front')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeSide === 'front'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Front Page Only (ገጽ 1)
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('back')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeSide === 'back'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Back Page Only (ገጽ 2)
            </button>
          </div>
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
    background: ${theme.bg} !important;
    color: ${theme.text} !important;
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
    background-color: ${theme.bg} !important;
    color: ${theme.text} !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
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
