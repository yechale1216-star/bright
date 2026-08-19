"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Clock, Sun, Sunset, Moon, Sunrise, Check } from "lucide-react"
import {
  toEthiopianTime,
  ethiopianToWesternHHMM,
  EthiopianTimePeriod,
} from "@/lib/utils/ethiopian-time"
import { Badge } from "@/components/ui/badge"

interface EthiopianTimeInputProps {
  id?: string
  value?: string // Canonical 24-hour "HH:MM" (e.g. "08:00", "13:30")
  onChange?: (canonicalHHMM: string) => void
  disabled?: boolean
  className?: string
  allowedPeriods?: EthiopianTimePeriod[]
  helperText?: string
}

const PERIOD_CONFIG: Record<
  EthiopianTimePeriod,
  { labelEn: string; labelAm: string; icon: any; color: string; bg: string }
> = {
  morning: {
    labelEn: "Morning",
    labelAm: "ጠዋት",
    icon: Sun,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  afternoon: {
    labelEn: "Afternoon",
    labelAm: "ከሰዓት",
    icon: Sunset,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
  },
  evening: {
    labelEn: "Evening",
    labelAm: "ማታ",
    icon: Moon,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/30",
  },
  night: {
    labelEn: "Night",
    labelAm: "ሌሊት",
    icon: Sunrise,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
}

const MINUTE_PRESETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export function EthiopianTimeInput({
  id,
  value = "08:00",
  onChange,
  disabled = false,
  className = "",
  allowedPeriods = ["morning", "afternoon", "evening", "night"],
  helperText,
}: EthiopianTimeInputProps) {
  // Parse incoming canonical HH:MM to Ethiopian structure
  const parsed = useMemo(() => toEthiopianTime(value), [value])

  const [ethHour, setEthHour] = useState<number>(parsed.ethHour)
  const [ethMinute, setEthMinute] = useState<number>(parsed.ethMinute)
  const [period, setPeriod] = useState<EthiopianTimePeriod>(parsed.period)

  // Keep local state in sync when value changes from outside
  useEffect(() => {
    setEthHour(parsed.ethHour)
    setEthMinute(parsed.ethMinute)
    setPeriod(parsed.period)
  }, [parsed])

  const handleHourChange = (newHour: number) => {
    setEthHour(newHour)
    const newCanonical = ethiopianToWesternHHMM(newHour, ethMinute, period)
    onChange?.(newCanonical)
  }

  const handleMinuteChange = (newMin: number) => {
    const validMin = Math.max(0, Math.min(59, newMin))
    setEthMinute(validMin)
    const newCanonical = ethiopianToWesternHHMM(ethHour, validMin, period)
    onChange?.(newCanonical)
  }

  const handlePeriodChange = (newPeriod: EthiopianTimePeriod) => {
    setPeriod(newPeriod)
    const newCanonical = ethiopianToWesternHHMM(ethHour, ethMinute, newPeriod)
    onChange?.(newCanonical)
  }

  const currentPeriodConfig = PERIOD_CONFIG[period] || PERIOD_CONFIG.morning
  const PeriodIcon = currentPeriodConfig.icon

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="p-2.5 rounded-xl border border-border bg-card/60 hover:bg-card transition-all shadow-sm">
        {/* Top Header: Live Ethiopian Clock Value & Canonical Hint */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">
              {ethHour}:{String(ethMinute).padStart(2, "0")} Ethiopian
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 font-semibold ${currentPeriodConfig.bg} ${currentPeriodConfig.color}`}
            >
              <PeriodIcon className="w-2.5 h-2.5 mr-1 inline" />
              {currentPeriodConfig.labelAm}
            </Badge>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground font-medium">
            {parsed.canonicalHHMM} (24h)
          </span>
        </div>

        {/* Control Grid: Hour Dropdown, Minute Dropdown, Period Selectors */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          {/* Hour (1 to 12) */}
          <div className="col-span-4">
            <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              Hour (ሰዓት)
            </label>
            <select
              id={id ? `${id}-hour` : undefined}
              disabled={disabled}
              value={ethHour}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h}:00 ({h} ሰዓት)
                </option>
              ))}
            </select>
          </div>

          {/* Minute (00 to 59) */}
          <div className="col-span-3">
            <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              Min (ደቂቃ)
            </label>
            <select
              disabled={disabled}
              value={ethMinute}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  :{String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector (Morning, Afternoon, Evening, Night) */}
          <div className="col-span-5">
            <label className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-0.5">
              Period (ክፍለ ጊዜ)
            </label>
            <select
              disabled={disabled}
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as EthiopianTimePeriod)}
              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {allowedPeriods.map((pKey) => {
                const conf = PERIOD_CONFIG[pKey]
                return (
                  <option key={pKey} value={pKey}>
                    {conf.labelAm} ({conf.labelEn})
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        {/* Quick Minute Preset Chips */}
        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/40 overflow-x-auto no-scrollbar">
          <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap mr-1">
            Quick min:
          </span>
          {[0, 15, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => handleMinuteChange(m)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                ethMinute === m
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
