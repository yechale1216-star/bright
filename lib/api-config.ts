/**
 * Centralized configuration for API, Socket, and App URLs.
 * Uses environment variables with sensible defaults for development.
 */

export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocal) {
      const envUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!envUrl || envUrl.includes("onrender.com")) {
        return "http://localhost:5000";
      }
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "https://zetime-backend-dmlv.onrender.com";
};

export const API_URL = getApiUrl();
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

export const apiUrl = getApiUrl();
export const socketUrl = SOCKET_URL;
export const appUrl = APP_URL;
