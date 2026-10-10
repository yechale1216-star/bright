/**
 * Centralized configuration for API, Socket, and App URLs.
 * Uses environment variables with sensible defaults for development.
 */

export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const isCapacitor =
      (window as any)?.Capacitor?.isNativePlatform?.() ||
      (window as any)?.Capacitor?.platform === "android" ||
      (window as any)?.Capacitor?.platform === "ios";
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.endsWith(".local");

    if (isLocal && !isCapacitor) {
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
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
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
