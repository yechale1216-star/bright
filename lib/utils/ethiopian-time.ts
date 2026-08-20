/**
 * Civil Time Display Utility — Africa/Addis_Ababa
 *
 * Replaces the old traditional Ethiopian 6-hour clock display layer.
 * All user-facing times are now displayed in standard 12-hour AM/PM format.
 *
 * Architecture:
 *   UTC timestamp (persistence)
 *         ↓
 *   Africa/Addis_Ababa (school local time)
 *         ↓
 *   School business logic (late/early/absent thresholds)
 *         ↓
 *   12-hour AM/PM (user-facing display)
 *
 * IMPORTANT: Do NOT apply any ±6 hour offset.
 * Africa/Addis_Ababa is the standard civil timezone (UTC+3, no DST).
 * 8:00 AM civil = 8:00 AM displayed. Not "2:00 Ethiopian".
 */

export const ETHIOPIA_TIMEZONE = "Africa/Addis_Ababa";

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Extracts hour (0-23) and minute (0-59) in Africa/Addis_Ababa timezone
 * from a Date object, ISO string, epoch number, or "HH:MM" string.
 */
export function getAddisAbabaTimeParts(
  dateInput?: Date | string | number | null
): { hour: number; minute: number } {
  if (!dateInput) {
    return getAddisAbabaTimeParts(new Date());
  }

  // If input is already an HH:MM (or HH:MM:SS) time-only string, parse directly.
  // These values represent local school times — no timezone conversion needed.
  if (
    typeof dateInput === "string" &&
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateInput.trim())
  ) {
    const [h, m] = dateInput.trim().split(":").map(Number);
    return {
      hour: isNaN(h) ? 8 : Math.max(0, Math.min(23, h)),
      minute: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
    };
  }

  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return { hour: 8, minute: 0 };

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: ETHIOPIA_TIMEZONE,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === "hour") {
        hour = parseInt(part.value, 10);
        if (hour === 24) hour = 0; // Intl may return 24 for midnight
      } else if (part.type === "minute") {
        minute = parseInt(part.value, 10);
      }
    }
    return { hour, minute };
  } catch {
    // Fallback: UTC+3 arithmetic (Africa/Addis_Ababa has no DST)
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const eatHour = (d.getUTCHours() + 3) % 24;
    return { hour: eatHour, minute: d.getUTCMinutes() };
  }
}

/**
 * Converts a 24-hour hour + minute to 12-hour AM/PM components.
 *
 * Correct handling of edge cases:
 *   hour=0  → 12 AM  (midnight)
 *   hour=11 → 11 AM
 *   hour=12 → 12 PM  (noon)
 *   hour=13 → 1 PM
 *   hour=23 → 11 PM
 */
export function to12HourParts(
  hour24: number,
  minute: number
): {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
  minuteStr: string;
} {
  const period: "AM" | "PM" = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    hour12,
    minute,
    period,
    minuteStr: String(minute).padStart(2, "0"),
  };
}

// ─── Primary display functions ────────────────────────────────────────────────

/**
 * Formats a Date, ISO timestamp, or "HH:MM" string to 12-hour AM/PM format
 * in Africa/Addis_Ababa timezone.
 *
 * Examples:
 *   "08:00"                    → "8:00 AM"
 *   "13:30"                    → "1:30 PM"
 *   "00:00"                    → "12:00 AM"
 *   "12:00"                    → "12:00 PM"
 *   "2026-08-20T05:30:00.000Z" → "8:30 AM"  (UTC+3)
 *
 * Returns "—" if input is null, undefined, or invalid.
 */
export function formatCivilTime(
  dateInput?: Date | string | number | null
): string {
  if (!dateInput) return "—";
  try {
    const { hour, minute } = getAddisAbabaTimeParts(dateInput);
    const { hour12, minuteStr, period } = to12HourParts(hour, minute);
    return `${hour12}:${minuteStr} ${period}`;
  } catch {
    return "—";
  }
}

/**
 * Formats a canonical "HH:MM" 24-hour string to 12-hour AM/PM display string.
 * Intended for displaying configured school times (start time, end time, cutoffs).
 *
 * Examples:
 *   "08:00" → "8:00 AM"
 *   "12:00" → "12:00 PM"
 *   "13:00" → "1:00 PM"
 *   "17:30" → "5:30 PM"
 */
export function formatHHMMAs12h(hhMM?: string | null): string {
  if (!hhMM || !hhMM.includes(":")) return "—";
  return formatCivilTime(hhMM);
}

/**
 * Formats a full datetime (Date or ISO string) to a human-readable string
 * in Africa/Addis_Ababa timezone with 12-hour AM/PM time.
 *
 * Example: "Aug 20, 2026 • 8:30 AM"
 */
export function formatCivilFullDateTime(
  dateInput?: Date | string | number | null
): string {
  if (!dateInput) return "—";
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return "—";

    const datePart = d.toLocaleDateString("en-US", {
      timeZone: ETHIOPIA_TIMEZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timePart = formatCivilTime(d);
    return `${datePart} • ${timePart}`;
  } catch {
    return "—";
  }
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────
// These allow existing callers to keep compiling without any import changes.
// They now produce 12-hour AM/PM output instead of Ethiopian clock output.

/** @deprecated Use formatCivilTime(). Now displays 12-hour AM/PM civil time. */
export const formatEthiopianTime = formatCivilTime;

/** @deprecated Use formatCivilFullDateTime(). Now displays 12-hour AM/PM civil time. */
export const formatEthiopianFullDateTime = formatCivilFullDateTime;

/**
 * Formats a time with a 24h canonical hint in parentheses.
 * Example: "8:00 AM (08:00)"
 * @deprecated Use formatCivilTime() for clean display.
 */
export function formatEthiopianTimeWithSubtitle(
  dateInput?: Date | string | number | null
): string {
  if (!dateInput) return "—";
  try {
    const { hour, minute } = getAddisAbabaTimeParts(dateInput);
    const canonical = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return `${formatCivilTime(dateInput)} (${canonical})`;
  } catch {
    return "—";
  }
}

// ─── Stub types for backward compatibility ────────────────────────────────────
// Kept so that any code importing these types continues to compile.

export type EthiopianTimePeriod = "morning" | "afternoon" | "evening" | "night";

export interface EthiopianTimeStructure {
  /** Now: civil 12-hour value (1-12). Previously: Ethiopian clock hour. */
  ethHour: number;
  ethMinute: number;
  minuteStr: string;
  period: EthiopianTimePeriod;
  periodLabelEn: string;
  periodLabelAm: string;
  /** Now: "8:30 AM". Previously: "2:30 Ethiopian". */
  timeString: string;
  timeWithPeriod: string;
  canonicalHHMM: string;
}

/**
 * Returns a time structure with civil 12-hour AM/PM values.
 * The field names are preserved for backward compatibility but the values
 * now reflect civil time — no 6-hour Ethiopian clock offset is applied.
 *
 * @deprecated Use formatCivilTime() or to12HourParts() directly.
 */
export function toEthiopianTime(
  dateInput?: Date | string | number | null
): EthiopianTimeStructure {
  const { hour, minute } = getAddisAbabaTimeParts(dateInput);
  const { hour12, minuteStr, period: ampm } = to12HourParts(hour, minute);
  const canonicalHHMM = `${String(hour).padStart(2, "0")}:${minuteStr}`;

  // Map civil hour to time-of-day period labels
  let period: EthiopianTimePeriod;
  let periodLabelEn: string;
  let periodLabelAm: string;
  if (hour >= 5 && hour < 12) {
    period = "morning"; periodLabelEn = "Morning"; periodLabelAm = "ጠዋት";
  } else if (hour >= 12 && hour < 17) {
    period = "afternoon"; periodLabelEn = "Afternoon"; periodLabelAm = "ከሰዓት";
  } else if (hour >= 17 && hour < 21) {
    period = "evening"; periodLabelEn = "Evening"; periodLabelAm = "ማታ";
  } else {
    period = "night"; periodLabelEn = "Night"; periodLabelAm = "ሌሊት";
  }

  const timeString = `${hour12}:${minuteStr} ${ampm}`;
  const timeWithPeriod = `${hour12}:${minuteStr} ${periodLabelAm}`;

  return {
    ethHour: hour12,
    ethMinute: minute,
    minuteStr,
    period,
    periodLabelEn,
    periodLabelAm,
    timeString,
    timeWithPeriod,
    canonicalHHMM,
  };
}

/**
 * @deprecated No longer needed. The EthiopianTimeInput component now works
 * directly with AM/PM and canonical HH:MM — no 6-hour conversion required.
 * This stub is kept to prevent compile errors in any remaining imports.
 */
export function ethiopianToWesternHHMM(
  _ethHour: number,
  _ethMinute: number,
  _period: EthiopianTimePeriod = "morning"
): string {
  // This function was part of the old Ethiopian 6-hour clock layer.
  // It is no longer used by the AM/PM time input component.
  return "08:00";
}
