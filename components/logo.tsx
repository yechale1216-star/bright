'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withText?: boolean;
  iconOnly?: boolean;
  href?: string;
}


export const Logo: React.FC<LogoProps> = ({ 
  className, 
  size = 'md', 
  withText = true,
  iconOnly = false,
  href = '/'
}) => {
  const showText = withText && !iconOnly;
  const [imgError, setImgError] = useState(false);

  const dimensions = {
    sm: { px: 28, cls: 'h-7 w-7' },
    md: { px: 40, cls: 'h-10 w-10' },
    lg: { px: 56, cls: 'h-14 w-14' },
    xl: { px: 80, cls: 'h-20 w-20' }
  };

  const content = (
    <div className={cn("flex flex-col items-center text-center gap-2 group", className)}>
      <div className={cn("transition-transform group-hover:scale-105 duration-300 flex-shrink-0 relative overflow-hidden rounded-full shadow-md", dimensions[size].cls)}>
        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full dark:opacity-50 opacity-0 transition-opacity" />
        {imgError ? (
          <div className="rounded-full w-full h-full bg-muted animate-pulse" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/zetime-logo.png"
            alt="Addis Hiwot School Logo"
            width={dimensions[size].px}
            height={dimensions[size].px}
            className="object-cover w-full h-full relative z-10 dark:drop-shadow-[0_0_10px_rgba(147,197,253,0.5)] rounded-full"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      {showText && (
        <div className="flex flex-col items-center text-center space-y-1 min-w-0">
          <span className={cn(
            "font-black tracking-tight text-slate-900 dark:text-white leading-snug",
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-base font-extrabold' : size === 'lg' ? 'text-xl font-black' : 'text-2xl md:text-3xl font-black'
          )}>
            አዲስ ህይወት ት/ቤት
          </span>
          <span className={cn(
            "font-black tracking-tight text-slate-900 dark:text-white leading-snug",
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm md:text-base font-bold' : size === 'lg' ? 'text-lg font-bold' : 'text-xl md:text-2xl font-black'
          )}>
            Addis Hiwot School
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        {content}
      </Link>
    );
  }

  return content;
};
