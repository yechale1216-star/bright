"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Clock } from "lucide-react"

/**
 * AM/PM Time Input Component
 *
 * Replaced the old traditional Ethiopian 6-hour clock picker.
 * Allows administrators to configure school times (start, end, cutoffs)
 * using standard 12-hour AM/PM format.
 *
 * Props API is unchanged:
 *   value    — canonical 24-hour "HH:MM" string (e.g. "08:00", "13:30")
 *   onChange — emits canonical 24-hour "HH:MM" string
 *
 * Examples displayed to user:
 *   "08:00" → "8:00 AM"
 *   "12:00" → "12:00 PM"
 *   "13:00" → "1:00 PM"
 *   "17:00" → "5:00 PM"
 */

// Keep for import compatibility — the period concept is no longer used internally
// but callers may still pass it as a prop.
export type EthiopianTimePeriod = "morning" | "afternoon" | "evening" | "night"

interface EthiopianTimeInputProps {
  id?: string
  /** Canonical 24-hour "HH:MM" value (e.g. "08:00", "13:30") */
  value?: string
  onChange?: (canonicalHHMM: string) => void
  disabled?: boolean
  className?: string
  /**
   * Kept for API compatibility. No longer restricts the available periods
   * since the component now uses AM/PM instead of the Ethiopian clock.
   */
  allowedPeriods?: EthiopianTimePeriod[]
  helperText?: string
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * Parse a canonical "HH:MM" 24-hour string into 12-hour AM/PM components.
 * Handles midnight (00:xx → 12 AM) and noon (12:xx → 12 PM) correctly.
 */
function parseHHMM(hhMM: string): { hour12: number; minute: number; period: "AM" | "PM" } {
  const parts = (hhMM || "08:00").split(":").map(Number)
  const h = isNaN(parts[0]) ? 8 : Math.max(0, Math.min(23, parts[0]))
  const m = isNaN(parts[1]) ? 0 : Math.max(0, Math.min(59, parts[1]))
  const period: "AM" | "PM" = h < 12 ? "AM" : "PM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return { hour12, minute: m, period }
}

/**
 * Convert 12-hour AM/PM components to canonical "HH:MM" 24-hour string.
 * Handles midnight (12 AM → 00:xx) and noon (12 PM → 12:xx) correctly.
 */
function toCanonicalHHMM(hour12: number, minute: number, period: "AM" | "PM"): string {
  let hour24: number
  if (period === "AM") {
    hour24 = hour12 === 12 ? 0 : hour12  // 12 AM = midnight = 00:00
  } else {
    hour24 = hour12 === 12 ? 12 : hour12 + 12  // 12 PM = noon = 12:00; 1 PM = 13:00
  }
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EthiopianTimeInput({
  id,
  value = "08:00",
  onChange,
  disabled = false,
  className = "",
  allowedPeriods: _allowedPeriods, // accepted for API compat, unused
  helperText,
}: EthiopianTimeInputProps) {
  const parsed = useMemo(() => parseHHMM(value), [value])

  const [hour12, setHour12] = useState<number>(parsed.hour12)
  const [minute, setMinute] = useState<number>(parsed.minute)
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period)

  // Sync internal state when the value prop changes from outside
  useEffect(() => {
    setHour12(parsed.hour12)
    setMinute(parsed.minute)
    setPeriod(parsed.period)
  }, [parsed.hour12, parsed.minute, parsed.period])

  const handleHourChange = (newHour: number) => {
    setHour12(newHour)
    onChange?.(toCanonicalHHMM(newHour, minute, period))
  }

  const handleMinuteChange = (newMin: number) => {
    const valid = Math.max(0, Math.min(59, newMin))
    setMinute(valid)
    onChange?.(toCanonicalHHMM(hour12, valid, period))
  }

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setPeriod(newPeriod)
    onChange?.(toCanonicalHHMM(hour12, minute, newPeriod))
  }

  const displayTime = `${hour12}:${String(minute).padStart(2, "0")} ${period}`
  const canonical24h = toCanonicalHHMM(hour12, minute, period)

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="p-2.5 rounded-xl border border-border bg-card/60 hover:bg-card transition-all shadow-sm">

        {/* Header: live preview and 24h hint */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">{displayTime}</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground font-medium">
            {canonical24h} (24h)
          </span>
        </div>

        {/* Controls: Hour | Minute | AM/PM */}
        <div className="grid grid-cols-12 gap-1.5 items-center">

          {/* Hour selector (1 – 12) */}
          <div className="col-span-4">
            <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              Hour
            </label>
            <select
              id={id ? `${id}-hour` : undefined}
              disabled={disabled}
              value={hour12}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          {/* Minute selector (00 – 59) */}
          <div className="col-span-4">
            <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              Min
            </label>
            <select
              disabled={disabled}
              value={minute}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>:{String(m).padStart(2, "0")}</option>
              ))}
            </select>
          </div>

          {/* AM / PM toggle */}
          <div className="col-span-4">
            <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              AM / PM
            </label>
            <div className="flex h-8 rounded-lg border border-border overflow-hidden">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePeriodChange(p)}
                  className={`flex-1 text-xs font-bold transition-colors focus:outline-none ${
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick minute presets */}
        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/40 overflow-x-auto no-scrollbar">
          <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap mr-1">
            Quick:
          </span>
          {[0, 15, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => handleMinuteChange(m)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                minute === m
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              :{String(m).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>

      {helperText && (
        <p className="text-[11px] text-muted-foreground leading-tight">{helperText}</p>
      )}
    </div>
  )
}
