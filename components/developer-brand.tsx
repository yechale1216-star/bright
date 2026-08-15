import React from 'react'
import { cn } from '@/lib/utils/utils'

interface DeveloperBrandProps {
  type?: 'developed' | 'powered'
  className?: string
  align?: 'center' | 'left' | 'right'
  collapsed?: boolean
  size?: 'sm' | 'default'
}

export function DeveloperBrand({
  type = 'powered',
  className,
  align = 'center',
  collapsed = false,
  size = 'default',
}: DeveloperBrandProps) {
  if (collapsed) return null

  const prefix = type === 'developed' ? 'Developed by' : 'Powered by'

  return (
    <div
      className={cn(
        'flex items-center gap-1 select-none transition-all duration-300',
        align === 'center' && 'justify-center text-center',
        align === 'left' && 'justify-start text-left',
        align === 'right' && 'justify-end text-right',
        className
      )}
    >
      <span
        className={cn(
          'font-medium text-slate-500/80 dark:text-slate-400/80',
          size === 'sm' ? 'text-[10px]' : 'text-[11px]'
        )}
      >
        {prefix}
      </span>
      <span
        className={cn(
          'font-bold tracking-wide bg-gradient-to-r from-[#2563EB] via-[#06B6DA] to-[#7C3AED] bg-clip-text text-transparent hover:brightness-110 transition-all',
          size === 'sm' ? 'text-[10px]' : 'text-[11px]'
        )}
      >
        Ethio Nova
      </span>
    </div>
  )
}
