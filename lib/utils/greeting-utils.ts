'use client';

import { useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '@/lib/i18n/translations';
import { useLanguage } from '@/lib/context/language-context';
import { useAuth } from '@/lib/context/auth-context';

export const ETHIOPIA_TIMEZONE = 'Africa/Addis_Ababa';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Extracts hour (0-23) and minute (0-59) in Ethiopia local time (Africa/Addis_Ababa).
 * Guaranteed to be correct regardless of device, browser, or server timezone.
 */
export function getAddisAbabaHourAndMinute(date: Date = new Date()): { hour: number; minute: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ETHIOPIA_TIMEZONE,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === 'hour') {
        hour = parseInt(part.value, 10);
        if (hour === 24) hour = 0;
      } else if (part.type === 'minute') {
        minute = parseInt(part.value, 10);
      }
    }
    return { hour, minute };
  } catch {
    // Fallback: UTC+3 (East Africa Time) offset calculation
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const eatHour = (utcHours + 3) % 24;
    return { hour: eatHour, minute: utcMinutes };
  }
}

/**
 * Determines the time period based on Ethiopian local time rules:
 * - 05:00–11:59 → Morning
 * - 12:00–16:59 → Afternoon
 * - 17:00–20:59 → Evening
 * - 21:00–04:59 → Night
 */
export function getTimePeriod(hour: number, minute: number = 0): TimePeriod {
  // Boundary calculations on 24-hour clock:
  // 05:00 <= time <= 11:59
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  // 12:00 <= time <= 16:59
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  // 17:00 <= time <= 20:59
  if (hour >= 17 && hour < 21) {
    return 'evening';
  }
  // 21:00 <= time <= 04:59 (hours 21, 22, 23, 0, 1, 2, 3, 4)
  return 'night';
}

/**
 * Maps time period to corresponding translation key in translations dictionary.
 */
export function getGreetingTranslationKey(period: TimePeriod): TranslationKey {
  switch (period) {
    case 'morning':
      return 'good_morning';
    case 'afternoon':
      return 'good_afternoon';
    case 'evening':
      return 'good_evening';
    case 'night':
      return 'good_night';
  }
}

/**
 * Checks if the role represents a Parent.
 * Only the Parent role is allowed to receive multilingual (Amharic) greetings.
 * School Admin, Discipline Officer, Registrator, and Teacher are English-only.
 */
export function isParentRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'parent';
}

/**
 * Pure function to calculate greeting string for any given context.
 * 
 * Rules:
 * 1. Timezone: Africa/Addis_Ababa
 * 2. If Parent -> Respects language parameter ('en' or 'am')
 * 3. Other Roles (School Admin, Discipline Officer, Registrator, Teacher) -> Strictly 'en'
 */
export function getSystemGreeting(options?: {
  role?: string | null;
  language?: Language;
  date?: Date;
}): string {
  const date = options?.date || new Date();
  const { hour, minute } = getAddisAbabaHourAndMinute(date);
  const period = getTimePeriod(hour, minute);
  const key = getGreetingTranslationKey(period);

  const isParent = isParentRole(options?.role);
  const effectiveLanguage: Language = isParent && options?.language === 'am' ? 'am' : 'en';

  return translations[effectiveLanguage][key] || translations['en'][key] || 'Good morning';
}

/**
 * React hook to get a dynamic, reactive time-based greeting for the current user.
 * Automatically updates if:
 * 1. User switches language (for parents)
 * 2. Time passes into a new period (checked every 60 seconds)
 * 3. User session or role changes
 */
export function useGreeting(customRole?: string | null): string {
  const { language } = useLanguage();
  const { user } = useAuth();

  const role = customRole !== undefined ? customRole : user?.role;

  const [greeting, setGreeting] = useState(() =>
    getSystemGreeting({ role, language })
  );

  useEffect(() => {
    const update = () => {
      setGreeting(getSystemGreeting({ role, language }));
    };

    update();

    // Check every 60 seconds for time period rollover without heavy polling
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [role, language]);

  return greeting;
}
