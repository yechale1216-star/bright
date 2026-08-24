import React from 'react'
import { cn } from '@/lib/utils/utils'

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
}

const BLADES = [
  { angle: 0, opacity: 1.0 },
  { angle: 30, opacity: 0.92 },
  { angle: 60, opacity: 0.83 },
  { angle: 90, opacity: 0.74 },
  { angle: 120, opacity: 0.65 },
  { angle: 150, opacity: 0.55 },
  { angle: 180, opacity: 0.45 },
  { angle: 210, opacity: 0.35 },
  { angle: 240, opacity: 0.25 },
  { angle: 270, opacity: 0.18 },
  { angle: 300, opacity: 0.12 },
  { angle: 330, opacity: 0.07 },
]

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('relative inline-flex items-center justify-center text-primary', sizeMap[size], className)}
      {...props}
    >
      <svg
        className="w-full h-full animate-[spin_1.2s_steps(12,end)_infinite]"
        viewBox="0 0 48 48"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {BLADES.map(({ angle, opacity }) => (
          <rect
            key={angle}
            x="21.5"
            y="4"
            width="5"
            height="11"
            rx="2.5"
            transform={`rotate(${angle} 24 24)`}
            style={{ opacity }}
          />
        ))}
      </svg>
    </div>
  )
}




