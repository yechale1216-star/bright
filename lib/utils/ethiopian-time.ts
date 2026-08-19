/**
 * Central Ethiopian Time / Clock Utility
 * 
 * Provides bijective, mathematically precise conversions between Western 24h canonical
 * time (in Africa/Addis_Ababa timezone) and the traditional 12-hour Ethiopian Clock.
 * 
 * Ethiopian Day Cycle:
 * - 06:00 Western = 12:00 Ethiopian (ጠዋት / Morning / Day)
 * - 08:00 Western = 2:00 Ethiopian (ጠዋት / Morning / Day)
 * - 12:00 Western = 6:00 Ethiopian (ከሰዓት / Afternoon / Day)
 * - 13:30 Western = 7:30 Ethiopian (ከሰዓት / Afternoon / Day)
 * - 17:00 Western = 11:00 Ethiopian (ከሰዓት / Afternoon / Day)
 * - 18:00 Western = 12:00 Ethiopian (ማታ / Evening / Night)
 * - 20:00 Western = 2:00 Ethiopian (ማታ / Evening / Night)
 * - 00:00 Western = 6:00 Ethiopian (ሌሊት / Midnight / Night)
 */

export const ETHIOPIA_TIMEZONE = "Africa/Addis_Ababa";

export type EthiopianTimePeriod = "morning" | "afternoon" | "evening" | "night";

export interface EthiopianTimeStructure {
  ethHour: number;        // 1 to 12
  ethMinute: number;      // 0 to 59
  minuteStr: string;      // "00" to "59"
  period: EthiopianTimePeriod; // "morning" | "afternoon" | "evening" | "night"
  periodLabelEn: string;  // "Morning" | "Afternoon" | "Evening" | "Night"
  periodLabelAm: string;  // "ጠዋት" | "ከሰዓት" | "ማታ" | "ሌሊት"
  timeString: string;     // "2:00 Ethiopian"
  timeWithPeriod: string; // "2:00 ጠዋት" or "2:00 Morning"
  canonicalHHMM: string;  // "08:00" (Western 24-hour canonical)
}

/**
 * Extracts hour (0-23) and minute (0-59) in Africa/Addis_Ababa timezone from Date or string.
 */
export function getAddisAbabaTimeParts(dateInput?: Date | string | number | null): { hour: number; minute: number } {
  if (!dateInput) {
    const now = new Date();
    return getAddisAbabaTimeParts(now);
  }

  // If input is already HH:MM format string (e.g. "08:00" or "13:30")
  if (typeof dateInput === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateInput.trim())) {
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
        if (hour === 24) hour = 0;
      } else if (part.type === "minute") {
        minute = parseInt(part.value, 10);
      }
    }
    return { hour, minute };
  } catch {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const utcHours = d.getUTCHours();
    const utcMinutes = d.getUTCMinutes();
    const eatHour = (utcHours + 3) % 24;
    return { hour: eatHour, minute: utcMinutes };
  }
}

/**
 * Converts Western 24h HH:MM or Date/ISO timestamp to full Ethiopian Time Structure.
 */
export function toEthiopianTime(dateInput?: Date | string | number | null): EthiopianTimeStructure {
  const { hour: wHour, minute: wMinute } = getAddisAbabaTimeParts(dateInput);

  // Determine Ethiopian 12-hour clock value
  let ethHour: number;
  if (wHour >= 6) {
    ethHour = wHour - 6;
  } else {
    ethHour = wHour + 6;
  }
  if (ethHour === 0) {
    ethHour = 12;
  }

  // Determine Ethiopian period
  let period: EthiopianTimePeriod;
  let periodLabelEn: string;
  let periodLabelAm: string;

  if (wHour >= 6 && wHour < 12) {
    period = "morning";
    periodLabelEn = "Morning";
    periodLabelAm = "ጠዋት";
  } else if (wHour >= 12 && wHour < 18) {
    period = "afternoon";
    periodLabelEn = "Afternoon";
    periodLabelAm = "ከሰዓት";
  } else if (wHour >= 18 && wHour < 24) {
    period = "evening";
    periodLabelEn = "Evening";
    periodLabelAm = "ማታ";
  } else {
    period = "night";
    periodLabelEn = "Night";
    periodLabelAm = "ሌሊት";
  }

  const minuteStr = String(wMinute).padStart(2, "0");
  const timeString = `${ethHour}:${minuteStr} Ethiopian`;
  const timeWithPeriod = `${ethHour}:${minuteStr} ${periodLabelAm}`;
  const canonicalHHMM = `${String(wHour).padStart(2, "0")}:${minuteStr}`;

  return {
    ethHour,
    ethMinute: wMinute,
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
 * Converts Ethiopian Clock structure back to Western 24h "HH:MM" format.
 * Guarantees mathematical precision for saving to settings / database.
 */
export function ethiopianToWesternHHMM(
  ethHour: number,
  ethMinute: number,
  period: EthiopianTimePeriod = "morning"
): string {
  const validHour = Math.max(1, Math.min(12, Number(ethHour) || 12));
  const validMinute = Math.max(0, Math.min(59, Number(ethMinute) || 0));

  let wHour: number;

  switch (period) {
    case "morning": // 06:00 to 11:59 W (Ethiopian 12:00 to 5:59)
      wHour = validHour === 12 ? 6 : validHour + 6;
      break;

    case "afternoon": // 12:00 to 17:59 W (Ethiopian 6:00 to 11:59)
      if (validHour >= 6 && validHour <= 11) {
        wHour = validHour + 6;
      } else if (validHour === 12) {
        wHour = 12; // 12:00 noon
      } else {
        wHour = validHour + 12; // e.g. 1 -> 13, 2 -> 14, etc.
      }
      break;

    case "evening": // 18:00 to 23:59 W (Ethiopian 12:00 to 5:59)
      wHour = validHour === 12 ? 18 : validHour + 18;
      break;

    case "night": // 00:00 to 05:59 W (Ethiopian 6:00 to 11:59)
      if (validHour >= 6 && validHour <= 11) {
        wHour = validHour - 6; // 6 -> 0 (midnight), 7 -> 1, 11 -> 5
      } else if (validHour === 12) {
        wHour = 0; // midnight
      } else {
        wHour = validHour; // 1 -> 1, 2 -> 2, etc.
      }
      break;

    default:
      wHour = validHour === 12 ? 6 : validHour + 6;
  }

  // Ensure wHour is strictly 0..23
  wHour = (wHour + 24) % 24;

  return `${String(wHour).padStart(2, "0")}:${String(validMinute).padStart(2, "0")}`;
}

/**
 * Format a Date, timestamp, or HH:MM string to "H:MM Ethiopian" format.
 * Returns "—" if input is null or empty.
 */
export function formatEthiopianTime(
  dateInput?: Date | string | number | null,
  options?: { showPeriod?: boolean; lang?: "en" | "am" }
): string {
  if (!dateInput) return "—";
  try {
    const et = toEthiopianTime(dateInput);
    if (options?.showPeriod) {
      return options.lang === "am" ? et.timeWithPeriod : `${et.ethHour}:${et.minuteStr} ${et.periodLabelEn}`;
    }
    return et.timeString;
  } catch {
    return "—";
  }
}

/**
 * Formats a canonical HH:MM or timestamp with Ethiopian time and subtle Western indicator.
 * Example: "2:00 Ethiopian (08:00)"
 */
export function formatEthiopianTimeWithSubtitle(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "—";
  try {
    const et = toEthiopianTime(dateInput);
    return `${et.timeString} (${et.canonicalHHMM})`;
  } catch {
    return "—";
  }
}

/**
 * Formats full datetime combining Ethiopian Calendar Date and Ethiopian Clock Time.
 * Example: "መስከረም 15 ቀን 2017 ዓ.ም 2:15 ጠዋት"
 */
export function formatEthiopianFullDateTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "—";
  try {
    const et = toEthiopianTime(dateInput);
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: ETHIOPIA_TIMEZONE });
    return `${dateStr} ${et.timeWithPeriod}`;
  } catch {
    return "—";
  }
}
