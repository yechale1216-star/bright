'use client';

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Returns true only when running inside the Capacitor Native App (e.g. Android APK).
 * Always returns false in web browsers (desktop, tablet, mobile web).
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState<boolean>(false);

  useEffect(() => {
    try {
      const native =
        Capacitor.isNativePlatform() ||
        (typeof window !== 'undefined' &&
          (Boolean((window as any)?.Capacitor?.isNativePlatform?.()) ||
            (window as any)?.Capacitor?.platform === 'android' ||
            (window as any)?.Capacitor?.platform === 'ios'));
      setIsNative(Boolean(native));
    } catch {
      setIsNative(false);
    }
  }, []);

  return isNative;
}
