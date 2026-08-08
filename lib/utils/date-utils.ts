/**
 * Zetime Centralized Date & Time Localization Utilities
 * Supports Gregorian (GC) and Ethiopian Calendar (EC) formatting with Africa/Addis_Ababa timezone handling.
 */

import { Language } from "../i18n/translations";
import {
  toEthiopianDate,
  getAddisAbabaDateParts,
  gregorianToJDN,
  ET_MONTHS_AM,
  ET_MONTHS_EN,
  formatEthiopianDateDMY,
  formatEthiopianDateTimeDMY,
} from "./ethiopian-calendar";

export { formatEthiopianDateDMY, formatEthiopianDateTimeDMY };

export type CalendarPreference = "ethiopian" | "gregorian";

export interface DateOptions {
  month?: "long" | "short" | "numeric";
  day?: "numeric" | "2-digit";
  year?: "numeric" | "2-digit";
  weekday?: "long" | "short";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
}

const amharicDays = [
  "እሁድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ"
];

const amharicShortDays = [
  "እሁ", "ሰኞ", "ማክ", "ረቡ", "ሐሙ", "ዓር", "ቅዳ"
];

const englishDays = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

const englishShortDays = [
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
];

/**
 * Returns today's date in YYYY-MM-DD format strictly in Africa/Addis_Ababa timezone.
 * ALWAYS returns Gregorian/ISO standard string for reliable database queries and APIs.
 */
export function getAddisTodayISO(): string {
  const parts = getAddisAbabaDateParts(new Date());
  const yearStr = String(parts.year);
  const monthStr = String(parts.month).padStart(2, "0");
  const dayStr = String(parts.day).padStart(2, "0");
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Formats a date string, object, or timestamp into a localized string
 * based on language ('en' | 'am') and calendar preference ('ethiopian' | 'gregorian').
 */
export function formatLocalizedDate(
  dateInput: string | Date | number,
  language: Language = "en",
  options: DateOptions = { month: "short", day: "numeric" },
  calendarPreference: CalendarPreference = "gregorian"
): string {
  try {
    if (!dateInput) return "";

    // Respect calendarPreference setting (ethiopian or gregorian)
    const effectivePreference: CalendarPreference = calendarPreference;

    // Ethiopian Calendar formatting
    if (effectivePreference === "ethiopian") {
      const parts = getAddisAbabaDateParts(dateInput);
      const ec = toEthiopianDate(dateInput);
      const jdn = gregorianToJDN(parts.year, parts.month, parts.day);
      const dayOfWeekIndex = Math.floor(jdn + 1.5) % 7; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      const hours24 = parts.hours;
      const minutes = String(parts.minutes).padStart(2, '0');
      let displayHours = hours24 % 12;
      displayHours = displayHours ? displayHours : 12;

      if (language === "am") {
        const getPeriod = (h: number) => {
          if (h >= 6 && h < 12) return "ጠዋት";
          if (h >= 12 && h < 18) return "ከሰዓት";
          if (h >= 18 && h < 24) return "ማታ";
          return "ሌሊት";
        };
        const period = getPeriod(hours24);

        // Just Time?
        if (options.hour && options.minute && !options.month && !options.day && !options.year && !options.weekday) {
          return `${period} ${displayHours}:${minutes}`;
        }

        let result = "";
        if (options.weekday) {
          result += options.weekday === 'short' ? amharicShortDays[dayOfWeekIndex] : amharicDays[dayOfWeekIndex];
          result += "፣ ";
        }
        if (options.month) {
          result += (options.month === 'numeric' ? (ec.month + 1) : ET_MONTHS_AM[ec.month]) + " ";
        }
        if (options.day) {
          result += ec.day + " ";
        }
        if (options.year) {
          result += options.month ? "" : "፣ ";
          result += ec.year + " ዓ.ም";
        }
        if (options.hour && options.minute) {
          result += ` ${period} ${displayHours}:${minutes}`;
        }

        return result.trim().replace(/፣\s*$/, '');
      } else {
        // English representation of Ethiopian Date
        const ampm = hours24 >= 12 ? 'PM' : 'AM';

        if (options.hour && options.minute && !options.month && !options.day && !options.year && !options.weekday) {
          return `${displayHours}:${minutes} ${ampm}`;
        }

        let result = "";
        if (options.weekday) {
          result += (options.weekday === 'short' ? englishShortDays[dayOfWeekIndex] : englishDays[dayOfWeekIndex]) + ", ";
        }
        if (options.month) {
          result += (options.month === 'numeric' ? String(ec.month + 1).padStart(2, '0') : ET_MONTHS_EN[ec.month]) + " ";
        }
        if (options.day) {
          result += ec.day;
        }
        if (options.year) {
          result += (options.month || options.day ? ", " : "") + ec.year + " EC";
        }
        if (options.hour && options.minute) {
          result += ` ${displayHours}:${minutes} ${ampm}`;
        }

        return result.trim();
      }
    }

    // Standard Gregorian Calendar formatting in Africa/Addis_Ababa timezone
    const dateObj = typeof dateInput === "string" && dateInput.length === 10 && !dateInput.includes("T")
      ? new Date(`${dateInput}T00:00:00.000Z`)
      : new Date(dateInput);

    if (isNaN(dateObj.getTime())) return String(dateInput);

    // When in Gregorian mode, always use en-US so months/days render in Latin script.
    // When in Ethiopian mode AND language is Amharic, use am-ET for Ethiopic script.
    const locale = (calendarPreference === "ethiopian" && language === "am") ? "am-ET" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      ...options as any,
      timeZone: "Africa/Addis_Ababa",
    }).format(dateObj);
  } catch (error) {
    console.error("Error formatting date:", error);
    return String(dateInput);
  }
}

/**
 * Formats time into a localized string
 */
export function formatLocalizedTime(
  dateInput: string | Date | number,
  language: Language = "en"
): string {
  return formatLocalizedDate(dateInput, language, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats full date and time into a localized string with calendar preference support
 */
export function formatLocalizedDateTime(
  dateInput: string | Date | number,
  language: Language = "en",
  calendarPreference: CalendarPreference = "ethiopian"
): string {
  return formatLocalizedDate(dateInput, language, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }, calendarPreference);
}

/**
 * Ethiopian Calendar date string representation
 */
export function toEthiopianDateString(dateInput: string | Date | number): string {
  return formatLocalizedDate(dateInput, "am", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }, "ethiopian");
}

/**
 * Gets a relative time string (e.g., "Just now", "2 mins ago") or localized date
 */
export function getRelativeTimeString(
  dateInput: string | Date | number,
  language: Language = "en",
  t: (key: any) => string,
  calendarPreference: CalendarPreference = "ethiopian"
): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds >= 0 && diffInSeconds < 60) return t("just_now");
  
  return formatLocalizedDate(dateInput, language, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }, calendarPreference);
}
