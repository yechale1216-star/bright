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
        'flex items-center gap-1.5 select-none transition-all duration-300',
        align === 'center' && 'justify-center text-center',
        align === 'left' && 'justify-start text-left',
        align === 'right' && 'justify-end text-right',
        className
      )}
    >
      <span
        className={cn(
          'font-semibold text-slate-700 dark:text-slate-300 tracking-normal',
          size === 'sm' ? 'text-[11px]' : 'text-xs'
        )}
      >
        {prefix}
      </span>
      <span
        className={cn(
          'font-black tracking-wide text-[#FF8000] hover:brightness-110 transition-all drop-shadow-[0_0_12px_rgba(255,128,0,0.35)]',
          size === 'sm' ? 'text-[11px]' : 'text-xs'
        )}
      >
        Yechale
      </span>
    </div>
  )
}
