"use client"

import { API_URL, getApiUrl } from "@/lib/api-config";
import { apiFetch } from "@/lib/utils/fetch-with-timeout";
import { authStorage } from "@/lib/auth/auth-storage";

// ─── Session Identity Key ─────────────────────────────────────────────────────
// A nonce written to localStorage on every login/signup and cleared on logout.
// AuthContext and SchoolContext compare this to detect user switches and
// perform atomic in-memory state resets before rendering any protected page.
export const SESSION_ID_KEY = "_zt_session_id"

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface User {
  id: string
  email: string
  phone?: string
  name: string
  role: string
  schoolId: string
  customSchoolId?: string
  schoolName: string
  schoolLogo?: string
  teacherId: string
  profile_photo?: string
  onboardingCompleted?: boolean
  isVerified?: boolean
}

export interface AuthResponse {
  success: boolean
  message: string
  user?: User
  error?: string
  availableSchools?: any[]
}

export interface SignupCredentials {
  email: string
  password: string
  confirmPassword: string
  role: "admin" | "teacher"
  name: string
  phone: string
  schoolId?: string
  schoolName?: string
  schoolAddress?: string
}

class AuthService {
  private readonly CURRENT_USER_KEY = "attendance_current_user"

  private isClient(): boolean {
    return typeof window !== "undefined" && typeof localStorage !== "undefined"
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      })
      
      const data = await res.json()

      if (!res.ok || !data.success) {
        return { 
          success: false, 
          message: data.message || "Login failed", 
          error: data.error || data.message || "Invalid credentials" 
        }
      }

      const { user: dbUser, token, availableSchools } = data.data

      // Get school name and logo from settings
      let schoolName = data.data.schoolName || "My School"
      let schoolLogo = data.data.schoolLogo || ""

      const user: User = {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone || "",
        name: dbUser.name || dbUser.full_name,
        role: dbUser.role,
        schoolId: dbUser.schoolId || "single-school",
        customSchoolId: dbUser.customSchoolId || data.data.customSchoolId || "SCH-0001",
        schoolName,
        schoolLogo,
        teacherId: dbUser.teacher_id || "",
        profile_photo: dbUser.profile_photo || "",
        onboardingCompleted: data.data.onboardingCompleted ?? true,
      }

      if (this.isClient()) {
        const sid = generateSessionId()
        localStorage.setItem(SESSION_ID_KEY, sid)
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user))
        if (token) {
          localStorage.setItem("attendance_token", token)
        }
        
        if (availableSchools) {
          localStorage.setItem("available_schools", JSON.stringify(availableSchools))
        }

        localStorage.setItem("x-school-id", user.schoolId || "single-school");

        const activeSchool = {
          id: user.schoolId || "single-school",
          name: user.schoolName || schoolName,
          logo: user.schoolLogo || "",
          customSchoolId: user.customSchoolId || "SCH-0001"
        }
        localStorage.setItem("active_school", JSON.stringify(activeSchool))

        // Persist to native storage as well
        authStorage.setSession(token || null, user, user.schoolId, sid).catch(() => {})
      }

      return { success: true, message: "Login successful", user, availableSchools }
    } catch (error) {
      console.error("[pg] Login error:", error)
      return { success: false, message: "Login failed", error: "An error occurred during login" }
    }
  }

  // ─── PARENT LOGIN & SECURITY ───────────────────────────────────────────────
  async searchParentByPhone(phone: string, signal?: AbortSignal): Promise<any> {
    try {
      console.log(`[ParentLookup] Initiating API request for phone: "${phone}"`);
      const res = await fetch(`${API_URL}/api/parent/search?phone=${encodeURIComponent(phone)}`, {
        headers: this.getAuthHeaders(),
        signal,
      });

      if (res.status === 404) {
        console.log(`[ParentLookup] API returned 404 Not Found for phone: "${phone}"`);
        return { success: false, notFound: true, error: false, message: "No parent account found with this phone number." };
      }

      if (!res.ok) {
        console.warn(`[ParentLookup] API error ${res.status} ${res.statusText} for phone: "${phone}"`);
        return { success: false, notFound: false, error: true, message: `Server error (${res.status}): Unable to verify parent account.` };
      }

      const body = await res.json();
      if (body.success && body.data) {
        console.log(`[ParentLookup] API returned existing parent ID: ${body.data.id} for phone: "${phone}"`);
        return { success: true, data: body.data, notFound: false, error: false };
      } else {
        console.log(`[ParentLookup] API returned non-success response for phone: "${phone}"`, body);
        return { success: false, notFound: true, error: false, message: body.message || "No parent account found." };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[ParentLookup] Request cancelled/aborted for phone: "${phone}"`);
        return { success: false, cancelled: true };
      }
      console.error("[ParentLookup] Network error during parent search:", error);
      return { success: false, notFound: false, error: true, message: "Unable to verify the parent account. Please check your connection and try again." };
    }
  }

  async loginParent(phone: string, password: string, schoolId?: string): Promise<AuthResponse & { availableSchools?: any[] }> {
    try {
      
      const res = await fetch(`${API_URL}/api/parent/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, schoolId }),
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || "Invalid credentials", error: "Login failed" };
      }

      const parentName = data.parentName || "Parent";
      const students = data.students || [];
      const availableSchools = data.availableSchools || [];
      // data.schoolId is now returned directly by the backend login endpoint
      const resolvedSchoolId = data.schoolId || students[0]?.schoolId || "";

      const user: User = {
        id: data.id,
        email: `parent-${phone}@addishiwot.edu.et`,
        phone: phone,
        name: data.parentName || parentName,
        role: "parent",
        schoolId: resolvedSchoolId,
        schoolName: data.schoolName || "My School",
        schoolLogo: data.schoolLogo || "",
        teacherId: "",
        profile_photo: "",
      };

      if (this.isClient()) {
        const sid = generateSessionId()
        localStorage.setItem(SESSION_ID_KEY, sid)
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
        if (data.token) {
          localStorage.setItem("attendance_token", data.token);
        }
        localStorage.setItem("parent_students", JSON.stringify(students));
        localStorage.setItem("available_schools", JSON.stringify(availableSchools));
        localStorage.setItem("zt_parent_login_ts", Date.now().toString());
        
        if (resolvedSchoolId) {
          localStorage.setItem("x-school-id", resolvedSchoolId);
        }

        // Persist to native storage as well
        authStorage.setSession(data.token || null, user, resolvedSchoolId, sid).catch(() => {})
      }

      return { success: true, message: "Login successful", user, availableSchools };
    } catch (error) {
      console.error("[pg] Parent login error:", error);
      return { success: false, message: "Login failed", error: "An error occurred during parent login" };
    }
  }

  async updateParentPassword(phone: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/parent/update-password`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ phone, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || "Failed to update password", error: "Update failed" };
      }
      return { success: true, message: data.message || "Password updated successfully" };
    } catch (error) {
      return { success: false, message: "Server connection failed", error: "Connection error" };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const res = await apiFetch<{ success: boolean; message?: string }>(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res && res.success) {
        return { success: true, message: res.message || "Password updated successfully" };
      }
      return { success: false, message: res?.message || "Failed to update password", error: "Update failed" };
    } catch (error: any) {
      return { success: false, message: error?.message || "Server connection failed", error: "Connection error" };
    }
  }

  async updateParentProfile(phone: string, data: { name: string, email: string, address?: string, profile_photo?: string | null }): Promise<{ success: boolean; message: string; error?: string; user?: User }> {
    try {
      const res = await fetch(`${API_URL}/api/parent/profile/${phone}`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        return { success: false, message: result.message || "Failed to update profile", error: "Update failed" };
      }

      // Update local storage user data
      const currentUser = this.getCurrentUser();
      if (currentUser) {
        const updatedUser = { 
          ...currentUser, 
          name: result.data.name, 
          email: result.data.email,
          phone: result.data.phone,
          ...(result.data.profile_photo !== undefined && { profile_photo: result.data.profile_photo }),
        };
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updatedUser));
        window.dispatchEvent(new Event("userSessionChanged"));
        return { success: true, message: result.message, user: updatedUser };
      }

      return { success: true, message: result.message };
    } catch (error) {
      return { success: false, message: "Server connection failed", error: "Connection error" };
    }
  }

  // ─── SIGNUP ───────────────────────────────────────────────────────────────
  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    try {
      console.log("[pg] Signup attempt for:", credentials.email)

      // Clear any existing session before starting a new signup
      if (this.isClient()) {
        this.logout();
      }

      if (!this.isValidEthiopianPhone(credentials.phone)) {
        return {
          success: false,
          message: "Invalid Phone Number",
          error: "Please enter a valid Ethiopian phone number starting with +251.",
        }
      }

      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          name: credentials.name,
          schoolName: credentials.schoolName,
          schoolAddress: credentials.schoolAddress,
          role: credentials.role,
          phone: credentials.phone
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        return { 
          success: false, 
          message: data.message || "Signup failed", 
          error: data.error || data.message || "An error occurred" 
        }
      }

      const { user: newUser, token } = data.data

      const user: User = {
        id: newUser.id,
        email: newUser.email,
        phone: newUser.phone || "",
        name: newUser.name || newUser.full_name,
        role: newUser.role,
        schoolId: newUser.schoolId || "single-school",
        customSchoolId: newUser.customSchoolId || data.data.customSchoolId || "SCH-0001",
        schoolName: data.data.schoolName || credentials.schoolName || "My School",
        schoolLogo: data.data.schoolLogo || "",
        teacherId: "",
        profile_photo: newUser.profile_photo || "",
        onboardingCompleted: false, // new accounts always start onboarding
        isVerified: newUser.isVerified ?? data.data.user?.isVerified ?? false,
      }

      if (this.isClient()) {
        const sid = generateSessionId()
        localStorage.setItem(SESSION_ID_KEY, sid)
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user))
        if (token) {
          localStorage.setItem("attendance_token", token)
        }
        localStorage.setItem("x-school-id", user.schoolId || "single-school");
        
        const activeSchool = {
          id: user.schoolId || "single-school",
          name: user.schoolName || "My School",
          logo: user.schoolLogo || "",
          customSchoolId: user.customSchoolId || "SCH-0001"
        }
        localStorage.setItem("active_school", JSON.stringify(activeSchool))

        // Persist to native storage as well
        authStorage.setSession(token || null, user, user.schoolId, sid).catch(() => {})
      }

      return { success: true, message: "Account created successfully", user }
    } catch (error) {
      console.error("[pg] Signup error:", error)
      return { success: false, message: "Signup failed", error: "An error occurred during registration" }
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.isClient() ? localStorage.getItem("attendance_token") : null
    const schoolId = this.isClient() ? localStorage.getItem("x-school-id") : null
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    
    if (schoolId) {
      headers["x-school-id"] = schoolId
    }

    // SITUATIONAL ROLE INFERENCE: 
    // Automatically tell the server which context we are in based on the current URL.
    if (this.isClient()) {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/parent')) {
        headers["x-requested-role"] = 'parent';
      } else if (pathname.startsWith('/school/teacher')) {
        headers["x-requested-role"] = 'teacher';
      } else if (pathname.startsWith('/school/staff')) {
        headers["x-requested-role"] = 'staff';
      } else if (pathname.startsWith('/school/registrar')) {
        headers["x-requested-role"] = 'registrar';
      } else if (pathname.startsWith('/school/discipline-officer')) {
        headers["x-requested-role"] = 'discipline_officer';
      } else if (pathname.startsWith('/school/admin')) {
        headers["x-requested-role"] = 'school_admin';
      }
    }
    
    return headers
  }

  // ─── UPDATE SCHOOL INFO ───────────────────────────────────────────────────
  async updateSchoolInfo(name: string, _code: string, _phone?: string, _logo?: string): Promise<AuthResponse> {
    try {
      const user = this.getCurrentUser()
      if (!user) throw new Error("No user logged in")

      let schoolId = user.schoolId

      const payload: any = { school_name: name }
      if (_logo) payload.school_logo = _logo
      if (_phone) payload.school_phone = _phone

      try {
        await apiFetch(`${API_URL}/api/settings`, {
          method: "PUT",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        })
      } catch (settingsErr) {
        console.warn("[auth] settings update warning:", settingsErr)
      }

      if (!schoolId) {
        try {
          const res = await apiFetch<{ success: boolean; data?: any }>(`${API_URL}/api/schools`, {
            method: "POST",
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ name }),
          })
          if (res?.data?.id) schoolId = res.data.id
        } catch {
          schoolId = "single-school"
        }

        if (schoolId) {
          try {
            await apiFetch(`${API_URL}/api/users/${user.id}`, {
              method: "PUT",
              headers: this.getAuthHeaders(),
              body: JSON.stringify({ school_id: schoolId }),
            })
          } catch { /* ignore */ }
        }
      }

      const updatedUser: User = { ...user, schoolId: schoolId || user.schoolId || "single-school", schoolName: name, schoolLogo: _logo || user.schoolLogo }
      if (this.isClient()) {
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updatedUser))
      }

      return { success: true, message: "School setup complete", user: updatedUser }
    } catch (error) {
      console.error("[pg] updateSchoolInfo error:", error)
      return { success: false, message: "Failed to setup school", error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  // ─── UNIQUENESS CHECKS ────────────────────────────────────────────────────
  async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/check-email?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      return { available: data.available ?? true }
    } catch {
      return { available: true } // fail open so user isn't blocked on network errors
    }
  }

  async checkPhoneAvailability(phone: string): Promise<{ available: boolean }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/check-phone?phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      return { available: data.available ?? true }
    } catch {
      return { available: true }
    }
  }

  // ─── EMAIL VERIFICATION ───────────────────────────────────────────────────
  async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const currentUser = this.getCurrentUser()
        if (currentUser && this.isClient()) {
          const updated = { ...currentUser, isVerified: true }
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updated))
          window.dispatchEvent(new Event('userSessionChanged'))
        }
        return { success: true, message: data.message }
      }
      return { success: false, message: data.message || 'Verification failed' }
    } catch {
      return { success: false, message: 'Network error. Please try again.' }
    }
  }

  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      return { success: res.ok && data.success, message: data.message || 'Failed to resend code' }
    } catch {
      return { success: false, message: 'Network error. Please try again.' }
    }
  }

  // ─── ONBOARDING ───────────────────────────────────────────────────────────
  async completeOnboarding(payload: {
    schoolEmail?: string
    address?: string
    logoUrl?: string
    academicYear?: string
    attendanceMode?: string
    attendanceThreshold?: number
    allowLateMark?: boolean
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_URL}/api/schools/onboarding`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // Update local user and ALWAYS sync x-school-id so BaseDatabase.getSchoolId()
        // never falls back to a stale value from a previous session.
        const user = this.getCurrentUser()
        if (user && this.isClient()) {
          const updated = { 
            ...user, 
            onboardingCompleted: true,
            schoolLogo: payload.logoUrl || user.schoolLogo
          }
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updated))
          // Explicitly overwrite x-school-id so the fallback in BaseDatabase
          // is always the correct, authenticated tenant — never stale.
          // Explicitly update the active_school in localStorage so SchoolContext picks it up
          if (updated.schoolId) {
            localStorage.setItem("x-school-id", updated.schoolId)
            
            const schoolData = {
              id: updated.schoolId,
              name: updated.schoolName || "My School", 
              logo: payload.logoUrl || "",
              customSchoolId: updated.customSchoolId || ""
            }
            localStorage.setItem("active_school", JSON.stringify(schoolData))
          }

          // Signal AuthContext and SchoolContext to refresh
          window.dispatchEvent(new CustomEvent("onboardingCompleted", { 
            detail: { 
              schoolId: updated.schoolId,
              logoUrl: payload.logoUrl,
              schoolName: user.schoolName 
            } 
          }))
          window.dispatchEvent(new Event("userSessionChanged"))
          window.dispatchEvent(new Event("schoolSwitched")) // Force SchoolContext to reload from localStorage
        }
        return { success: true, message: data.message }
      }
      return { success: false, message: data.message || "Failed to save onboarding" }
    } catch {
      return { success: false, message: "Network error" }
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  isValidEthiopianPhone(phone: string): boolean {
    return /^\+251[179]\d{8}$/.test(phone.trim())
  }

  async logout(): Promise<void> {
    if (this.isClient()) {
      // 1. Capture credentials/headers first before clearing local storage
      let headers: Record<string, string> = {};
      try {
        headers = this.getAuthHeaders();
      } catch (e) {
        console.warn("Failed to get auth headers for logout:", e);
      }

      // 2. Clear ALL school-scoped and session keys SYNCHRONOUSLY
      await authStorage.clearSession()

      // Also clean up any _settings_backup_ keys
      try {
        const backupKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith("_settings_backup_")) {
            backupKeys.push(k)
          }
        }
        backupKeys.forEach(k => localStorage.removeItem(k))
      } catch {}

      // 3. Clear SWR cache synchronously to avoid data leaks
      try {
        const { queryCache } = require('@/lib/utils/query-cache');
        if (queryCache && typeof queryCache.clear === 'function') {
          queryCache.clear();
        }
      } catch (e) {
        console.error("Failed to clear query cache on logout", e);
      }

      // 4. Perform background API call and Native Bridge cleanup in parallel
      const apiCall = fetch(`${API_URL}/api/auth/logout`, { 
        method: "POST", 
        headers,
        credentials: "include" 
      }).catch(e => {
        console.error("Logout API call failed", e);
      });

      const nativeCall = (async () => {
        try {
          const { NativeBridge } = await import('@/lib/utils/native-bridge');
          await NativeBridge.endNativeCall();
          // Delete the Firebase device token first, then clear the stored auth token.
          // Order matters: deregisterFcmToken also clears auth from SharedPreferences.
          await NativeBridge.deregisterFcmToken();
          await NativeBridge.saveAuthToken(""); // Clears sharedPreferences token (belt + suspenders)
        } catch (e) {
          console.error("Failed to clean up native call state on logout", e);
        }
      })();

      await Promise.allSettled([apiCall, nativeCall]);
    }
  }

  handleUnauthorized(): void {
    if (this.isClient()) {
      window.dispatchEvent(new Event("sessionExpired"))
    }
  }

  getCurrentUser(): User | null {
    if (!this.isClient()) return null
    try {
      const userStr = localStorage.getItem(this.CURRENT_USER_KEY)
      return userStr ? JSON.parse(userStr) : null
    } catch {
      return null
    }
  }
  
  // ─── PASSWORD RESET ───────────────────────────────────────────────────────
  async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      return { 
        success: res.ok && data.success, 
        message: data.message || "Request processed" 
      }
    } catch (error) {
      return { success: false, message: "Network error", error: "Failed to connect to server" }
    }
  }
  
  async verifyResetToken(token: string): Promise<{ success: boolean; valid: boolean; email?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-reset-token?token=${token}`)
      const data = await res.json()
      return { 
        success: res.ok && data.success, 
        valid: data.valid || false, 
        email: data.email 
      }
    } catch (error) {
      return { success: false, valid: false }
    }
  }
  
  async resetPassword(token: string, password: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      return { 
        success: res.ok && data.success, 
        message: data.message || "Password reset successful" 
      }
    } catch (error) {
      return { success: false, message: "Network error", error: "Failed to connect to server" }
    }
  }

  async parentForgotPassword(phone: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_URL}/api/auth/parent-forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      return { 
        success: res.ok && data.success, 
        message: data.message || "Request processed" 
      }
    } catch (error) {
      return { success: false, message: "Network error", error: "Failed to connect to server" }
    }
  }

  async verifyParentOTP(phone: string, code: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/parent-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      return { 
        success: res.ok && data.success, 
        message: data.message 
      }
    } catch (error) {
      return { success: false, message: "Failed to connect to server" }
    }
  }

  async resetParentPassword(phone: string, code: string, newPassword: string): Promise<AuthResponse> {
    try {
      const res = await fetch(`${API_URL}/api/auth/parent-reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, newPassword }),
      })
      const data = await res.json()
      return { 
        success: res.ok && data.success, 
        message: data.message || "Password reset successful" 
      }
    } catch (error) {
      return { success: false, message: "Network error", error: "Failed to connect to server" }
    }
  }

  isAuthenticated(): boolean { return this.getCurrentUser() !== null }
  isAdmin(): boolean { return this.getCurrentUser()?.role === "admin" || false }
  isTeacher(): boolean { return this.getCurrentUser()?.role === "teacher" || false }

  async refreshUserProfile(): Promise<User | null> {
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        headers: this.getAuthHeaders(),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const dbUser = data.data
        const currentUser = this.getCurrentUser()
        if (currentUser) {
          const updatedUser: User = {
            ...currentUser,
            name: dbUser.full_name || dbUser.name,
            email: dbUser.email,
            phone: dbUser.phone || "",
            profile_photo: dbUser.profile_photo || "",
          }
          if (this.isClient()) {
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(updatedUser))
          }
          return updatedUser
        }
      }
      return null
    } catch (error) {
      console.error("[pg] refreshUserProfile error:", error)
      return null
    }
  }
}

export const authService = new AuthService()
