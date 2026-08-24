import React from "react";
import { Spinner } from "@/components/ui/spinner";

interface PageLoaderProps {
  className?: string;
}

/**
 * Full-area centered loading indicator using the shared Spinner component.
 * Drop-in replacement for any section that needs a centered loading state.
 */
export function PageLoader({ className }: PageLoaderProps) {
  return (
    <div className={`flex items-center justify-center min-h-[400px] w-full animate-in fade-in duration-300 ${className ?? ""}`}>
      <Spinner size="lg" className="text-primary" />
    </div>
  );
}
