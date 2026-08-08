'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/lib/context/language-context';
import {
  toEthiopianDate,
  ethiopicToJDN,
  jdnToGregorian,
  getAddisAbabaDateParts,
  ET_MONTHS_AM,
  ET_MONTHS_EN,
  ECDate,
} from '@/lib/utils/ethiopian-calendar';
import { cn } from '@/lib/utils/utils';

export interface EthiopianDatePickerProps {
  value?: string; // YYYY-MM-DD (ISO format in Gregorian)
  onChange: (isoDateString: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
}

const AM_DAYS = ['እሁ', 'ሰኞ', 'ማክ', 'ረቡ', 'ሐሙ', 'ዓር', 'ቅዳ'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Converts Ethiopian year, month0 (0-12), and day (1-30) to Gregorian YYYY-MM-DD ISO string
 */
export function ethiopicToGregorianISO(year: number, month0: number, day: number): string {
  const jdn = ethiopicToJDN(year, month0, day);
  const gDate = jdnToGregorian(jdn);
  const y = gDate.getUTCFullYear();
  const m = String(gDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(gDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function EthiopianDatePicker({
  value,
  onChange,
  placeholder = 'ቀን ይምረጡ',
  disabled = false,
  min,
  max,
  className,
  id,
}: EthiopianDatePickerProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Active viewing Ethiopian month & year in picker popover
  const initialEC = value ? toEthiopianDate(value) : toEthiopianDate(new Date());
  const [viewYear, setViewYear] = useState<number>(initialEC.year);
  const [viewMonth0, setViewMonth0] = useState<number>(initialEC.month);

  // Selected Ethiopian Date
  const selectedEC: ECDate | null = value ? toEthiopianDate(value) : null;

  // Sync viewing month/year when value prop changes externally
  useEffect(() => {
    if (value) {
      const ec = toEthiopianDate(value);
      setViewYear(ec.year);
      setViewMonth0(ec.month);
    }
  }, [value]);

  const monthNames = language === 'am' ? ET_MONTHS_AM : ET_MONTHS_EN;
  const dayHeaders = language === 'am' ? AM_DAYS : EN_DAYS;

  // Calculate days count for view month
  const isLeapYear = viewYear % 4 === 3;
  const daysInMonth = viewMonth0 === 12 ? (isLeapYear ? 6 : 5) : 30;

  // Calculate day of week index for 1st day of view month
  const firstJdn = ethiopicToJDN(viewYear, viewMonth0, 1);
  const startDayOfWeek = Math.floor(firstJdn + 1.5) % 7; // 0 = Sunday

  const handlePrevMonth = () => {
    if (viewMonth0 === 0) {
      setViewMonth0(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth0((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth0 === 12) {
      setViewMonth0(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth0((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const isoString = ethiopicToGregorianISO(viewYear, viewMonth0, day);
    onChange(isoString);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const todayEC = toEthiopianDate(new Date());
    setViewYear(todayEC.year);
    setViewMonth0(todayEC.month);
    const isoToday = ethiopicToGregorianISO(todayEC.year, todayEC.month, todayEC.day);
    onChange(isoToday);
    setIsOpen(false);
  };

  // Formatted display text for the input trigger
  const displayString = selectedEC
    ? `${monthNames[selectedEC.month]} ${selectedEC.day}፣ ${selectedEC.year} ${language === 'am' ? 'ዓ.ም' : 'EC'}`
    : placeholder;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
            <span className={cn('truncate', !selectedEC && 'text-muted-foreground')}>
              {displayString}
            </span>
          </div>
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl border-border/80" align="start">
        {/* Picker Header: Month & Year Selector */}
        <div className="flex items-center justify-between gap-1 mb-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePrevMonth}
            className="h-8 w-8 rounded-lg hover:bg-primary/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5">
            {/* Month Select */}
            <select
              value={viewMonth0}
              onChange={(e) => setViewMonth0(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer py-1 px-1.5 rounded-md hover:bg-secondary"
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx} className="bg-background text-foreground font-semibold">
                  {name}
                </option>
              ))}
            </select>

            {/* Year Input / Select */}
            <select
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer py-1 px-1.5 rounded-md hover:bg-secondary"
            >
              {Array.from({ length: 30 }, (_, i) => viewYear - 15 + i).map((y) => (
                <option key={y} value={y} className="bg-background text-foreground font-semibold">
                  {y} {language === 'am' ? 'ዓ.ም' : 'EC'}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8 rounded-lg hover:bg-primary/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {dayHeaders.map((dh, idx) => (
            <span key={idx} className="text-[10px] font-bold text-muted-foreground uppercase py-1">
              {dh}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Padding empty cells for month start weekday */}
          {Array.from({ length: startDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-8 w-8" />
          ))}

          {/* Month Day Buttons */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const isSelected =
              selectedEC &&
              selectedEC.year === viewYear &&
              selectedEC.month === viewMonth0 &&
              selectedEC.day === dayNum;

            const todayEC = toEthiopianDate(new Date());
            const isToday =
              todayEC.year === viewYear &&
              todayEC.month === viewMonth0 &&
              todayEC.day === dayNum;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => handleSelectDay(dayNum)}
                className={cn(
                  'h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-md scale-105'
                    : isToday
                    ? 'border-2 border-primary text-primary font-black bg-primary/5'
                    : 'hover:bg-secondary text-foreground'
                )}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Footer Quick Actions */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border text-xs">
          <button
            type="button"
            onClick={handleSelectToday}
            className="text-xs font-bold text-primary hover:underline"
          >
            {language === 'am' ? 'ዛሬ' : 'Today'}
          </button>

          {selectedEC && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {value}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
