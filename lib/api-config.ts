/**
 * Centralized configuration for API, Socket, and App URLs.
 * Uses environment variables with sensible defaults for development.
 */

// Backend API URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://zetime-backend-dmlv.onrender.com";

// Real-time Socket URL (often same as API URL)
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;

// Frontend App URL
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

// Helper exports for easier importing
export const apiUrl = API_URL;
export const socketUrl = SOCKET_URL;
export const appUrl = APP_URL;

export const getApiUrl = () => API_URL;
