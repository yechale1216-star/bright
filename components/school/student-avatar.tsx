"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils/utils";
import { getApiUrl } from "@/lib/api-config";

export interface StudentAvatarProps {
  name?: string | null;
  studentId?: string | null;
  photo?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}

/**
 * Resolves any student profile photo string into a browser-loadable URL:
 * - Direct Base64 data URLs
 * - Blob preview URLs
 * - Absolute HTTPS / HTTP URLs
 * - Relative backend paths (/uploads/...)
 * - Supabase storage object paths
 */
export function resolveProfilePhotoUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === '""' ||
    trimmed === "none"
  ) {
    return null;
  }

  // 1. Data URLs & Blob URLs are self-contained
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // 2. Absolute HTTP/HTTPS URLs
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // 3. Relative uploads from backend
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("uploads/")) {
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const apiUrl = getApiUrl();
    return `${apiUrl.replace(/\/$/, "")}${cleanPath}`;
  }

  // 4. Supabase Storage relative paths
  if (trimmed.startsWith("student-photos/") || trimmed.startsWith("avatars/")) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://pravlcxceyqrbvexctdx.supabase.co";
    const bucket = trimmed.startsWith("avatars/") ? "avatars" : "student_profile";
    return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${trimmed}`;
  }

  return trimmed;
}

/**
 * Extracts 2 clean capital letters representing student's initials
 */
export function getStudentInitials(
  name?: string | null,
  studentId?: string | null
): string {
  if (name && typeof name === "string") {
    const cleaned = name.trim().replace(/[^a-zA-Z\s]/g, "");
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
  }

  if (studentId && typeof studentId === "string") {
    const cleanId = studentId.trim().replace(/^STU-?/i, "");
    if (cleanId.length >= 2) {
      return cleanId.slice(0, 2).toUpperCase();
    }
  }

  return "ST";
}

const PALETTES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
];

function getPalette(seed?: string | null): string {
  if (!seed) return PALETTES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

const SIZE_CONFIG = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-8 h-8 sm:w-9 sm:h-9 text-xs",
  md: "w-10 h-10 text-xs sm:text-sm",
  lg: "w-12 h-12 sm:w-14 sm:h-14 text-base sm:text-lg",
  xl: "w-16 h-16 text-xl sm:text-2xl",
};

export function StudentAvatar({
  name,
  studentId,
  photo,
  size = "md",
  className,
  fallbackClassName,
  alt,
}: StudentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const resolvedUrl = resolveProfilePhotoUrl(photo);

  // Reset error state if the photo URL changes
  useEffect(() => {
    setImgError(false);
  }, [resolvedUrl]);

  const initials = getStudentInitials(name, studentId);
  const palette = getPalette(studentId || name);
  const sizeClasses = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  const showImage = !!resolvedUrl && !imgError;

  return (
    <div
      data-slot="student-avatar"
      className={cn(
        "relative shrink-0 rounded-full aspect-square overflow-hidden select-none border border-border/40 shadow-2xs flex items-center justify-center font-bold tracking-tight",
        sizeClasses,
        className
      )}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={alt || name || studentId || "Student Photo"}
          className="w-full h-full object-cover rounded-full"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={cn(
            "w-full h-full flex items-center justify-center rounded-full font-black uppercase border",
            palette,
            fallbackClassName
          )}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

