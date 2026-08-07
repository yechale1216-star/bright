/**
 * Ethiopian Calendar Utility
 * Provides conversion from Gregorian to Ethiopian (EC) with Africa/Addis_Ababa timezone support
 */

export interface ECDate {
  year: number;
  month: number; // 0-indexed (0=Meskerem, ..., 12=Pagume)
  day: number;
}

export const ET_MONTHS_EN = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
  "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
];

export const ET_MONTHS_AM = [
  "መስከረም", "ጥቅምት", "ህዳር", "ታህሳስ", "ጥር", "የካቲት",
  "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ"
];

/**
 * Safely extracts year, month (1-12), day, hours, and minutes from any date input
 * in the Africa/Addis_Ababa (UTC+3) timezone.
 */
export function getAddisAbabaDateParts(dateInput: Date | string | number): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
} {
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    // If it's a date-only string "YYYY-MM-DD", extract directly to avoid UTC midnight shift
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return {
        year: parseInt(dateOnlyMatch[1], 10),
        month: parseInt(dateOnlyMatch[2], 10),
        day: parseInt(dateOnlyMatch[3], 10),
        hours: 0,
        minutes: 0,
      };
    }
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    const now = new Date();
    return getAddisAbabaDateParts(now);
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Addis_Ababa",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const result: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") {
        result[p.type] = parseInt(p.value, 10);
      }
    }

    return {
      year: result.year,
      month: result.month,
      day: result.day,
      hours: result.hour === 24 ? 0 : (result.hour ?? 0),
      minutes: result.minute ?? 0,
    };
  } catch (err) {
    // Fallback if Intl timeZone isn't supported in environment
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
    };
  }
}

/**
 * Calculates Julian Day Number (integer) from Gregorian year, month (1-indexed), day
 */
export function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/**
 * Converts JDN to Ethiopic {year, month, day} (month is 0-indexed)
 */
export function jdnToEthiopic(jdn: number): ECDate {
  const ERA = 1723856; // Ethiopic Epoch
  const jdnInt = Math.floor(jdn + 0.5);
  const r = (jdnInt - ERA) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);

  const year = 4 * Math.floor((jdnInt - ERA) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30); // 0-indexed (0=Meskerem)
  const day = (n % 30) + 1;

  return { year, month, day };
}

/**
 * Converts Ethiopic date (month 0-indexed) to Julian Day Number
 */
export function ethiopicToJDN(year: number, month0: number, day: number): number {
  const ERA = 1723856;
  const cycle = Math.floor(year / 4);
  const remYear = year % 4;
  return ERA + cycle * 1461 + remYear * 365 + 30 * month0 + day - 1;
}

/**
 * Converts Julian Day Number to Gregorian Date (UTC)
 */
export function jdnToGregorian(jdn: number): Date {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);

  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Converts any Gregorian date input to Ethiopian Date in Africa/Addis_Ababa timezone
 */
export function toEthiopianDate(dateInput: Date | string | number): ECDate {
  const { year, month, day } = getAddisAbabaDateParts(dateInput);
  const jdn = gregorianToJDN(year, month, day);
  return jdnToEthiopic(jdn);
}

/**
 * Formats Ethiopian Date
 */
export function formatEthiopianDate(dateInput: Date | string | number, lang: 'en' | 'am' = 'am'): string {
  const ec = toEthiopianDate(dateInput);
  const monthName = lang === 'am' ? ET_MONTHS_AM[ec.month] : ET_MONTHS_EN[ec.month];
  return `${monthName} ${ec.day} ቀን ${ec.year} ዓ.ም`;
}

/**
 * Formats Ethiopian Date in numerical day/month/year format (DD/MM/YYYY)
 */
export function formatEthiopianDateDMY(dateInput: Date | string | number): string {
  const ec = toEthiopianDate(dateInput);
  const dayStr = String(ec.day).padStart(2, '0');
  const monthStr = String(ec.month + 1).padStart(2, '0'); // 1-indexed string
  return `${dayStr}/${monthStr}/${ec.year}`;
}

/**
 * Formats Ethiopian Date and Time in numerical format (DD/MM/YYYY hh:mm AM/PM)
 */
export function formatEthiopianDateTimeDMY(dateInput: Date | string | number): string {
  const parts = getAddisAbabaDateParts(dateInput);
  const dmy = formatEthiopianDateDMY(dateInput);
  
  let hours = parts.hours;
  const minutes = String(parts.minutes).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hourStr = String(hours).padStart(2, '0');
  
  return `${dmy} ${hourStr}:${minutes} ${ampm}`;
}


