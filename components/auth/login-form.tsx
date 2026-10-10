"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { authService, type LoginCredentials } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Mail, Lock, Eye, EyeOff, ArrowRight, Phone } from "lucide-react"
import { useLanguage } from "@/lib/context/language-context"
import { useSchool } from "@/lib/context/school-context"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/context/auth-context"
import { clearMessageCache } from "@/lib/utils/message-cache"

import { PhoneInput } from "@/components/ui/phone-input"
import { Spinner } from "@/components/ui/spinner"

interface LoginFormProps {
  onLoginSuccess: (user?: any) => void
  onShowForgotPassword: () => void
  onShowParentForgotPassword?: () => void
  onShowAdminSignup?: () => void
}

export function LoginForm({ onLoginSuccess, onShowForgotPassword, onShowParentForgotPassword, onShowAdminSignup }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language, setLanguage } = useLanguage()
  const { validateSession } = useAuth()
  const [activeTab, setActiveTab] = useState<"staff" | "parent">("staff")
  const [parentPhone, setParentPhone] = useState("+251")
  const [parentPassword, setParentPassword] = useState("")
  const [associatedSchools, setAssociatedSchools] = useState<any[]>([])
  const [selectedSchool, setSelectedSchool] = useState<any>(null)
  
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showParentPassword, setShowParentPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    const phone = searchParams.get("phone")
    if (activeTab === "parent") {
      if (phone) {
        setParentPhone(phone)
      }
    }
  }, [searchParams, activeTab])

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    const cleanPhone = parentPhone.replace(/\s+/g, "")
    
    if (!parentPhone || parentPhone === "+251") {
      const errorMsg = "Please enter your registered parent phone number"
      setLoginError(errorMsg)
      notifications.error("Validation Error", errorMsg)
      return
    }

    // Accept any +251 number (9 digits after country code = 13 chars total)
    const phoneRegex = /^\+251\d{9}$/
    if (!phoneRegex.test(cleanPhone)) {
      const errorMsg = "Phone number must be in format: +251XXXXXXXXX (9 digits)"
      setLoginError(errorMsg)
      notifications.error("Validation Error", errorMsg)
      return
    }

    if (!parentPassword) {
      const errorMsg = "Please enter your password"
      setLoginError(errorMsg)
      notifications.error("Validation Error", errorMsg)
      return
    }

    setIsLoading(true)
    try {
      // SECURITY: Clear previous user's IndexedDB message cache before starting new session
      await clearMessageCache().catch(() => {})

      const result = await authService.loginParent(cleanPhone, parentPassword)
      if (result.success) {
        setLoginError(null)
        
        console.log(`[Login][PARENT] Success | userId: ${result.user?.id} | schools: ${result.availableSchools?.length}`)

        // Mark as fresh login so validateSession preserves the parent role
        localStorage.setItem("_zt_fresh_login", "1")
        localStorage.setItem("_zt_login_role", "parent")

        notifications.success(t("welcome_back_parent"), t("login_success_parent"))
        await validateSession()
        console.log(`[Login][PARENT] Single-school architecture — redirecting to /parent/dashboard`)
        router.push("/parent/dashboard")
      } else {
        const errorMessage = result.message || t("invalid_credentials")
        setLoginError(errorMessage)
        notifications.error(t("login_failed"), errorMessage)
      }
    } catch (error) {
      const errorMsg = t("unexpected_error")
      setLoginError(errorMsg)
      notifications.error(t("login_failed"), errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    if (activeTab === "parent") {
      handleParentLogin(e)
      return
    }

    if (!credentials.email || !credentials.password) {
      const errorMsg = t("enter_password_error")
      setLoginError(errorMsg)
      notifications.error(t("validation_error"), errorMsg)
      return
    }

    if (!credentials.email.includes("@")) {
      const errorMsg = "Please enter a valid email address"
      setLoginError(errorMsg)
      notifications.error("Validation Error", errorMsg)
      return
    }

    setIsLoading(true)
    try {
      // SECURITY: Clear previous user's IndexedDB message cache before starting new session
      await clearMessageCache().catch(() => {})

      const result = await authService.login({
        email: credentials.email,
        password: credentials.password,
      })

      if (result.success) {
        setLoginError(null)
        notifications.success("Welcome Back!", `${result.user?.name || "User"}, you've successfully logged in.`)

        const confirmedRole = result.user?.role || ""
        console.log(`[Login][STAFF] Success | userId: ${result.user?.id} | role: ${confirmedRole} | email: ${result.user?.email}`)

        // Set FRESH_LOGIN_KEY so validateSession preserves this confirmed role
        // and does NOT overwrite it with stale path-inferred data from the old URL.
        localStorage.setItem("_zt_fresh_login", "1")
        localStorage.setItem("_zt_login_role", confirmedRole)
        
        // Run validateSession AFTER marking fresh login so the role is preserved
        await validateSession()

        // STAFF PORTAL FIX: When logging in via the school (email/password) portal,
        // only consider staff-type memberships (admin, teacher, etc.) — NOT parent roles.
        // This prevents showing the role selection screen when a user is both admin and parent
        // at the same school, since they explicitly chose the school staff portal.
        if (confirmedRole === "super_admin" || confirmedRole === "admin" || confirmedRole === "school_admin") {
          console.log(`[Login][STAFF] Redirecting admin —> /school/admin`)
          router.push("/school/admin")
        } else if (confirmedRole === "academic_head") {
          router.push("/school/academic-head")
        } else if (confirmedRole === "teacher") {
          console.log(`[Login][STAFF] Redirecting teacher —> /school/teacher`)
          router.push("/school/teacher")
        } else if (confirmedRole === "librarian") {
          router.push("/school/library")
        } else if (confirmedRole === "transport_manager") {
          router.push("/school/transport")
        } else if (confirmedRole === "staff_attendance_officer" || confirmedRole === "hr_officer") {
          router.push("/school/staff-hr")
        } else if (confirmedRole === "registrar") {
          router.push("/school/registrar")
        } else if (confirmedRole === "discipline_officer") {
          router.push("/school/discipline-officer")
        } else {
          console.warn(`[Login][STAFF] Navigating with role '${confirmedRole}'`)
          onLoginSuccess(result.user)
        }
      } else {
        const errorMessage = result.error || "Invalid email or password"
        setLoginError(errorMessage)
        notifications.error("Login Failed", errorMessage)
      }
    } catch (error) {
      const errorMsg = "An unexpected error occurred. Please try again."
      setLoginError(errorMsg)
      notifications.error("Login Error", errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-card">
      {/* Card Header */}
      <div className="login-card-header">
        <h2 className="login-card-title">{t("welcome_back")}</h2>
        <p className="login-card-subtitle">
          {activeTab === "parent" 
            ? t("login_desc_parent")
            : t("login_desc_staff")}
        </p>
      </div>

      {/* Card Body */}
      <div className="login-card-body">
        {loginError && (
          <Alert variant="destructive" className="mb-5 animate-in slide-in-from-top-2 duration-300 bg-red-50 border-red-200 text-red-600">
            <AlertDescription className="text-sm">{loginError}</AlertDescription>
          </Alert>
        )}

        {activeTab === "parent" ? (
          <form onSubmit={handleParentLogin} className="login-form-fields">
            <div className="login-input-group">
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Phone className="w-[18px] h-[18px]" />
                </div>
                <PhoneInput
                  id="parentPhone"
                  value={parentPhone}
                  onChange={(val) => setParentPhone(val)}
                  placeholder={t("parent_phone_placeholder")}
                  required
                />
              </div>
            </div>

            <div className="login-input-group">
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Lock className="w-[18px] h-[18px]" />
                </div>
                <Input
                  id="parentPassword"
                  type={showParentPassword ? "text" : "password"}
                  placeholder="Password"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  required
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowParentPassword(!showParentPassword)}
                  className="login-input-toggle"
                >
                  {showParentPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="rememberParent" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="login-checkbox"
                />
                <label htmlFor="rememberParent" className="login-remember-label">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={onShowParentForgotPassword}
                className="login-forgot-link"
              >
                {t("forgot_password")}
              </button>
            </div>

            <button type="submit" disabled={isLoading} className="login-submit-btn">
              {isLoading ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <>
                  <ArrowRight className="w-5 h-5" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="login-form-fields">
            <div className="login-input-group">
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Phone className="w-[18px] h-[18px]" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="Phone number or Email"
                  value={credentials.email}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="login-input"
                />
              </div>
            </div>

            <div className="login-input-group">
              <div className="login-input-wrapper">
                <div className="login-input-icon">
                  <Lock className="w-[18px] h-[18px]" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={credentials.password}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-input-toggle"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="login-checkbox"
                />
                <label htmlFor="remember" className="login-remember-label">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={onShowForgotPassword}
                className="login-forgot-link"
              >
                Forgot password?
              </button>
            </div>

            <button 
              type="submit" 
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="text-white mr-2" />
                  <span>{t("signing_in")}</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>
        )}

        {onShowAdminSignup && (
          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500 mb-3 font-medium">New to Bright Path? Create a school account</p>
            <Button
              variant="outline"
              onClick={onShowAdminSignup}
              className="w-full h-11 rounded-xl bg-transparent border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all font-bold"
            >
              Get Started for Free
            </Button>
          </div>
        )}

        {/* Secure · Trusted · Bright Path Divider */}
        <div className="flex items-center gap-3 mt-6 pt-1">
          <div className="h-[1px] bg-slate-200 dark:bg-slate-700 flex-1" />
          <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
            Secure &nbsp;·&nbsp; Trusted &nbsp;·&nbsp; Bright Path
          </span>
          <div className="h-[1px] bg-slate-200 dark:bg-slate-700 flex-1" />
        </div>

        {/* Language & Theme Controls */}
        <div className="login-controls-row">
          <div className="login-control-pill">
             <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t("theme")}</span>
             <div className="scale-75">
               <ModeToggle />
             </div>
          </div>

          <div className="login-control-pill">
            <button 
              onClick={() => setLanguage('en')}
              className={`text-[10px] px-2.5 py-0.5 rounded-md transition-colors font-bold ${language === 'en' ? 'bg-[#1a3a5c] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('am')}
              className={`text-[10px] px-2.5 py-0.5 rounded-md transition-colors font-bold ${language === 'am' ? 'bg-[#1a3a5c] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              አማ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
