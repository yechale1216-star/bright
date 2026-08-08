'use client';

import React from 'react';
import { useCalendar } from '@/lib/context/calendar-context';
import { EthiopianDatePicker, EthiopianDatePickerProps } from './ethiopian-date-picker';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/utils';

export interface DualDatePickerProps extends Omit<EthiopianDatePickerProps, 'onChange'> {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (isoDateString: string) => void;
}

/**
 * Smart Dual Calendar Date Picker Component
 * Dynamically switches between Ethiopian Date Picker (EC) and Gregorian Date Picker (GC)
 * based on user's system calendar preference.
 * Always emits and accepts ISO standard YYYY-MM-DD dates for database & API safety.
 */
export function DualDatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  min,
  max,
  className,
  id,
}: DualDatePickerProps) {
  const { calendarPreference } = useCalendar();

  if (calendarPreference === 'ethiopian') {
    return (
      <EthiopianDatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={className}
        id={id}
      />
    );
  }

  // Standard Gregorian date picker input
  return (
    <Input
      id={id}
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      min={min}
      max={max}
      className={cn('h-10 font-semibold focus:ring-primary/20', className)}
    />
  );
}
