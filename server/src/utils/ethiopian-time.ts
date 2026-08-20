/**
 * Server Civil Time Utility — Africa/Addis_Ababa
 *
 * This file previously contained a traditional Ethiopian 6-hour clock converter.
 * It has been replaced with standard civil time helpers that use 12-hour AM/PM.
 *
 * NOTE: This file is not imported by any server route or service.
 * It is retained as a stub to prevent compile errors if referenced externally.
 *
 * All server-side business logic (staff-attendance.service.ts, holiday.service.ts, etc.)
 * already uses Africa/Addis_Ababa directly and does not depend on this file.
 */

export const ETHIOPIA_TIMEZONE = "Africa/Addis_Ababa";

/**
 * Extracts hour (0-23) and minute (0-59) in Africa/Addis_Ababa timezone.
 */
export function getAddisAbabaTimeParts(
  dateInput?: Date | string | number | null
): { hour: number; minute: number } {
  if (!dateInput) return getAddisAbabaTimeParts(new Date());

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
    const d = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
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
        if (hour === 24) hour = 0;
      } else if (part.type === "minute") {
        minute = parseInt(part.value, 10);
      }
    }
    return { hour, minute };
  } catch {
    const d = new Date();
    return { hour: (d.getUTCHours() + 3) % 24, minute: d.getUTCMinutes() };
  }
}

/**
 * Formats a Date or time string to 12-hour AM/PM format in Africa/Addis_Ababa timezone.
 * Example: "08:30" → "8:30 AM", "2026-08-20T05:30:00Z" → "8:30 AM"
 */
export function formatCivilTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "—";
  try {
    const { hour, minute } = getAddisAbabaTimeParts(dateInput);
    const period: "AM" | "PM" = hour < 12 ? "AM" : "PM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const minuteStr = String(minute).padStart(2, "0");
    return `${hour12}:${minuteStr} ${period}`;
  } catch {
    return "—";
  }
}

// Backward-compat alias — no longer applies Ethiopian 6-hour offset
export const formatEthiopianTime = formatCivilTime;

// toEthiopianTime stub — kept for any remaining imports
export function toEthiopianTime(dateInput?: Date | string | number | null) {
  const { hour, minute } = getAddisAbabaTimeParts(dateInput);
  const period: "AM" | "PM" = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minuteStr = String(minute).padStart(2, "0");
  const canonicalHHMM = `${String(hour).padStart(2, "0")}:${minuteStr}`;
  const timeString = `${hour12}:${minuteStr} ${period}`;
  return { ethHour: hour12, ethMinute: minute, minuteStr, timeString, canonicalHHMM };
}
