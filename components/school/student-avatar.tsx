import React from 'react'
import { cn } from '@/lib/utils/utils'

interface StudentAvatarProps {
  name?: string | null
  studentId?: string | null
  photo?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<StudentAvatarProps['size']>, string> = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
}

/** Deterministic background colour from a string (student ID or name). */
function getGradient(seed: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return gradients[hash % gradients.length]
}

function getInitials(name?: string | null): string {
  if (!name) return 'S'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function StudentAvatar({ name, studentId, photo, size = 'md', className }: StudentAvatarProps) {
  const sizeClass = SIZE_CLASSES[size]
  const seed = studentId || name || 'student'
  const gradient = getGradient(seed)
  const initials = getInitials(name)

  if (photo) {
    return (
      <img
        src={photo}
        alt={name || 'Student'}
        className={cn(
          sizeClass,
          'rounded-full object-cover shrink-0 border-2 border-white dark:border-slate-700 shadow-sm',
          className
        )}
        onError={(e) => {
          // On broken image, hide and show initials fallback
          const target = e.currentTarget
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            const fallback = parent.querySelector('[data-fallback]') as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }
        }}
      />
    )
  }

  return (
    <div
      data-fallback
      className={cn(
        sizeClass,
        'rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br shadow-sm',
        gradient,
        className
      )}
      title={name || 'Student'}
    >
      {initials}
    </div>
  )
}

