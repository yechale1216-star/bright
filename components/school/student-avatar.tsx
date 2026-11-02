'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/utils';

export interface StudentAvatarProps {
  name?: string | null;
  studentId?: string | null;
  photo?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  fallbackClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<StudentAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
  '2xl': 'w-24 h-24 text-2xl',
};

const GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-purple-600 to-indigo-700',
  'from-amber-600 to-orange-700',
  'from-rose-600 to-pink-700',
  'from-cyan-600 to-blue-700',
  'from-violet-600 to-purple-800',
];

/**
 * Deterministic gradient color based on student ID or name.
 * Ensures the student has the same recognizable badge color across all views.
 */
function getGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * Extracts initials from student name.
 */
function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'ST';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Reliable, high-performance Student Avatar component.
 * Uses Radix UI Avatar (the same proven architecture as admin & teacher profiles),
 * with deterministic colored gradient fallback and smooth error recovery.
 */
export function StudentAvatar({
  name,
  studentId,
  photo,
  size = 'md',
  className,
  fallbackClassName,
}: StudentAvatarProps) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const seed = studentId || name || 'student';
  const gradient = getGradient(seed);
  const initials = getInitials(name);

  // Validate photo URL (reject null, empty string, or whitespace)
  const validPhoto = photo && typeof photo === 'string' && photo.trim() ? photo.trim() : null;

  return (
    <Avatar
      className={cn(
        sizeClass,
        'shrink-0 rounded-full border border-slate-200/60 dark:border-slate-800/80 shadow-2xs',
        className
      )}
    >
      {validPhoto && (
        <AvatarImage
          src={validPhoto}
          alt={name || 'Student'}
          className="object-cover size-full"
          loading="lazy"
        />
      )}
      <AvatarFallback
        className={cn(
          'font-black text-white bg-gradient-to-br shadow-inner uppercase tracking-wider',
          gradient,
          fallbackClassName
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
