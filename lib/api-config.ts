/**
 * Centralized configuration for API, Socket, and App URLs.
 * Dynamic for web (uses current origin / local network host),
 * configured specifically for Android Capacitor native builds.
 */

const ANDROID_BACKEND_URL = "https://bright-8uji.onrender.com";

export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const isCapacitor =
      (window as any)?.Capacitor?.isNativePlatform?.() ||
      (window as any)?.Capacitor?.platform === "android" ||
      (window as any)?.Capacitor?.platform === "ios";

    // 1. Android / iOS Capacitor Native App: uses the dedicated Render backend
    if (isCapacitor) {
      return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || ANDROID_BACKEND_URL;
    }

    // 2. Web Browser: Fully dynamic
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.endsWith(".local");

    if (isLocal) {
      if (
        process.env.NEXT_PUBLIC_API_URL &&
        (process.env.NEXT_PUBLIC_API_URL.includes("localhost") ||
          process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1") ||
          process.env.NEXT_PUBLIC_API_URL.includes(hostname))
      ) {
        return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
      }
      return `http://${hostname}:5000`;
    }

    // Production Web: If NEXT_PUBLIC_API_URL is set in web environment, use it; otherwise dynamically resolve from window.location.origin
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
    }
    return window.location.origin;
  }

  // Server-side / Build-time
  if (process.env.CAPACITOR_BUILD === "1") {
    return ANDROID_BACKEND_URL;
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  return "";
};

export const API_URL = getApiUrl();
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== "undefined" &&
  ((window as any)?.Capacitor?.isNativePlatform?.() ||
    (window as any)?.Capacitor?.platform === "android" ||
    (window as any)?.Capacitor?.platform === "ios")
    ? ANDROID_BACKEND_URL
    : API_URL);

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" &&
  !(window as any)?.Capacitor?.isNativePlatform?.() &&
  window.location.origin &&
  window.location.origin !== "http://localhost" &&
  window.location.origin !== "https://localhost"
    ? window.location.origin
    : ANDROID_BACKEND_URL);

export const apiUrl = getApiUrl();
export const socketUrl = SOCKET_URL;
export const appUrl = APP_URL;
