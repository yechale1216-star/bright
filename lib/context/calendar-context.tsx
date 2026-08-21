'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLanguage } from './language-context';
import {
  CalendarPreference,
  formatLocalizedDate,
  formatLocalizedTime,
  formatLocalizedDateTime,
  DateOptions,
} from '../utils/date-utils';

interface CalendarContextType {
  calendarPreference: CalendarPreference;
  setCalendarPreference: (pref: CalendarPreference) => void;
  formatDate: (dateInput: string | Date | number, options?: DateOptions) => string;
  formatDateTime: (dateInput: string | Date | number) => string;
  formatTime: (dateInput: string | Date | number) => string;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [calendarPreference, setCalendarPreferenceState] = useState<CalendarPreference>('ethiopian');
  const { language } = useLanguage();

  // Load saved calendar preference on client initialization and listen to updates
  useEffect(() => {
    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem('app_calendar_preference') as CalendarPreference;
        if (saved && (saved === 'ethiopian' || saved === 'gregorian')) {
          setCalendarPreferenceState(saved);
        }
      } catch (e) {
        console.warn('LocalStorage error reading app_calendar_preference:', e);
      }
    };

    syncFromStorage();

    const handleCustomChange = (e: any) => {
      const pref = e.detail;
      if (pref && (pref === 'ethiopian' || pref === 'gregorian')) {
        setCalendarPreferenceState(pref);
      } else {
        syncFromStorage();
      }
    };

    window.addEventListener('calendarPreferenceChanged', handleCustomChange);
    window.addEventListener('settingsDataChanged', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);

    return () => {
      window.removeEventListener('calendarPreferenceChanged', handleCustomChange);
      window.removeEventListener('settingsDataChanged', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const setCalendarPreference = (pref: CalendarPreference) => {
    setCalendarPreferenceState(pref);
    try {
      localStorage.setItem('app_calendar_preference', pref);
      window.dispatchEvent(new CustomEvent('calendarPreferenceChanged', { detail: pref }));
    } catch (e) {
      console.warn('LocalStorage error setting app_calendar_preference:', e);
    }
  };

  const formatDate = (dateInput: string | Date | number, options?: DateOptions): string => {
    return formatLocalizedDate(dateInput, language, options, calendarPreference);
  };

  const formatDateTime = (dateInput: string | Date | number): string => {
    return formatLocalizedDateTime(dateInput, language, calendarPreference);
  };

  const formatTime = (dateInput: string | Date | number): string => {
    return formatLocalizedTime(dateInput, language);
  };

  return (
    <CalendarContext.Provider
      value={{
        calendarPreference,
        setCalendarPreference,
        formatDate,
        formatDateTime,
        formatTime,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    // Safe fallback if used outside Provider
    return {
      calendarPreference: 'ethiopian' as CalendarPreference,
      setCalendarPreference: () => {},
      formatDate: (dateInput: string | Date | number, options?: DateOptions) =>
        formatLocalizedDate(dateInput, 'en', options, 'ethiopian'),
      formatDateTime: (dateInput: string | Date | number) =>
        formatLocalizedDateTime(dateInput, 'en', 'ethiopian'),
      formatTime: (dateInput: string | Date | number) =>
        formatLocalizedTime(dateInput, 'en'),
    };
  }
  return context;
}
