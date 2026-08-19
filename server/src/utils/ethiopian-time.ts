/**
 * Server Ethiopian Time / Clock Utility
 * 
 * Provides conversions between Western 24h canonical time (in Africa/Addis_Ababa timezone)
 * and the traditional 12-hour Ethiopian Clock.
 */

export const ETHIOPIA_TIMEZONE = "Africa/Addis_Ababa";

export function toEthiopianTime(dateInput?: Date | string | number | null) {
  let wHour = 8;
  let wMinute = 0;

  if (typeof dateInput === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateInput.trim())) {
    const [h, m] = dateInput.trim().split(":").map(Number);
    wHour = isNaN(h) ? 8 : Math.max(0, Math.min(23, h));
    wMinute = isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
  } else {
    try {
      const d = dateInput instanceof Date ? dateInput : (dateInput ? new Date(dateInput) : new Date());
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: ETHIOPIA_TIMEZONE,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = formatter.formatToParts(d);
      for (const part of parts) {
        if (part.type === "hour") {
          wHour = parseInt(part.value, 10);
          if (wHour === 24) wHour = 0;
        } else if (part.type === "minute") {
          wMinute = parseInt(part.value, 10);
        }
      }
    } catch {
      const d = new Date();
      wHour = (d.getUTCHours() + 3) % 24;
      wMinute = d.getUTCMinutes();
    }
  }

  let ethHour: number;
  if (wHour >= 6) {
    ethHour = wHour - 6;
  } else {
    ethHour = wHour + 6;
  }
  if (ethHour === 0) {
    ethHour = 12;
  }

  const minuteStr = String(wMinute).padStart(2, "0");
  const timeString = `${ethHour}:${minuteStr} Ethiopian`;

  return {
    ethHour,
    ethMinute: wMinute,
    minuteStr,
    timeString,
    canonicalHHMM: `${String(wHour).padStart(2, "0")}:${minuteStr}`,
  };
}

export function formatEthiopianTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "—";
  try {
    return toEthiopianTime(dateInput).timeString;
  } catch {
    return "—";
  }
}
