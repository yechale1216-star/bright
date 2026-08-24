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

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('relative inline-flex items-center justify-center', sizeMap[size], className)}
      {...props}
    >
      <svg
        className="w-full h-full animate-spin [animation-duration:0.85s]"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle background track */}
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-15"
        />
        {/* Smooth active arc with rounded end caps */}
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="113"
          strokeDashoffset="75"
        />
      </svg>
    </div>
  )
}



