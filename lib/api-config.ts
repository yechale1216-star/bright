/**
 * Centralized configuration for API, Socket, and App URLs.
 * Uses environment variables with sensible defaults for development.
 */

export const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const isCapacitor =
      (window as any)?.Capacitor?.isNativePlatform?.() ||
      (window as any)?.Capacitor?.platform === "android" ||
      (window as any)?.Capacitor?.platform === "ios";
    const isLocal =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if (isLocal && !isCapacitor && process.env.NODE_ENV === "development") {
      return "http://localhost:5000";
    }
  }

  return "https://zetime-backend-dmlv.onrender.com";
};

export const API_URL = getApiUrl();
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" && window.location.origin !== "http://localhost" && window.location.origin !== "https://localhost"
    ? window.location.origin
    : "https://zetime-backend-dmlv.onrender.com");

export const apiUrl = getApiUrl();
export const socketUrl = SOCKET_URL;
export const appUrl = APP_URL;
