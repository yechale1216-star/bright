/**
 * Zetime Date & Time Localization Utilities
 * Supports Gregorian and Ethiopian Calendar (EC) formatting
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

/**
 * Formats a date string or object into a localized string
 */
export function formatLocalizedDate(
  dateInput: string | Date | number,
  language: Language = "en",
  options: DateOptions = { month: "short", day: "numeric" }
): string {
  try {
    if (!dateInput) return "";

    // Ethiopian Calendar for Amharic
    if (language === "am") {
      const parts = getAddisAbabaDateParts(dateInput);
      const ec = toEthiopianDate(dateInput);
      const jdn = gregorianToJDN(parts.year, parts.month, parts.day);
      const dayOfWeekIndex = Math.floor(jdn + 1.5) % 7; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      let result = "";
      
      const getPeriod = (h: number) => {
        if (h >= 6 && h < 12) return "ጠዋት";
        if (h >= 12 && h < 18) return "ከሰዓት";
        if (h >= 18 && h < 24) return "ማታ";
        return "ሌሊት";
      };

      const hours24 = parts.hours;
      const period = getPeriod(hours24);
      let displayHours = hours24 % 12;
      displayHours = displayHours ? displayHours : 12;
      const minutes = String(parts.minutes).padStart(2, '0');

      // Just Time?
      if (options.hour && options.minute && !options.month && !options.day && !options.year && !options.weekday) {
        return `${period} ${displayHours}:${minutes}`;
      }

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
    }

    // Default English localization (Gregorian calendar in Africa/Addis_Ababa timezone)
    const dateObj = typeof dateInput === "string" && dateInput.length === 10 && !dateInput.includes("T")
      ? new Date(`${dateInput}T00:00:00.000Z`)
      : new Date(dateInput);

    if (isNaN(dateObj.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat("en-US", {
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
 * Formats full date and time into a localized string
 */
export function formatLocalizedDateTime(
  dateInput: string | Date | number,
  language: Language = "en"
): string {
  return formatLocalizedDate(dateInput, language, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Ethiopian Calendar date string representation
 */
export function toEthiopianDateString(dateInput: string | Date | number): string {
  return formatLocalizedDate(dateInput, "am", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Gets a relative time string (e.g., "Just now", "2 mins ago") or localized date
 */
export function getRelativeTimeString(
  dateInput: string | Date | number,
  language: Language = "en",
  t: (key: any) => string
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
  });
}

