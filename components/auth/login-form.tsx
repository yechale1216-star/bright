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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService, type LoginCredentials } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Mail, Lock, Eye, EyeOff, ArrowRight, Phone } from "lucide-react"
import { Logo } from "@/components/logo"
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
  onShowAdminSignup?: () => void
}

export function LoginForm({ onLoginSuccess, onShowForgotPassword, onShowAdminSignup }: LoginFormProps) {
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

    if (!parentPassword || parentPassword.length < 6) {
      const errorMsg = "Please enter your password (min 6 characters)"
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

    if (credentials.password.length < 6) {
      const errorMsg = "Password must be at least 6 characters long"
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
        // Single-School Architecture: Direct navigation based on confirmedRole
        if (confirmedRole === "super_admin" || confirmedRole === "admin" || confirmedRole === "school_admin") {
          console.log(`[Login][STAFF] Redirecting admin —> /school/admin`)
          router.push("/school/admin")
        } else if (confirmedRole === "teacher") {
          console.log(`[Login][STAFF] Redirecting teacher —> /school/teacher`)
          router.push("/school/teacher")
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
    <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
      <CardHeader className="space-y-3 pb-6 pt-8 px-8 text-center flex flex-col items-center">
        <Logo size="xl" withText={true} href="/" className="mb-2" />
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">{t("welcome_back")}</h1>
        <CardDescription className="typography-label text-slate-600 dark:text-slate-400 max-w-[280px] mx-auto">
          {activeTab === "parent" 
            ? t("login_desc_parent")
            : t("login_desc_staff")}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        {/* Modern Segmented Tab Switcher */}
        <div className="flex p-1 bg-slate-200/50 dark:bg-white/5 rounded-2xl border border-slate-300 dark:border-white/10 mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab("staff"); setLoginError(null); }}
            className={`typography-label flex-1 py-2.5 uppercase rounded-xl transition-all duration-200 ${ activeTab === "staff" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm font-black" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" }`}
          >
            {t("school_staff")}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("parent"); setLoginError(null); }}
            className={`typography-label flex-1 py-2.5 uppercase rounded-xl transition-all duration-200 ${ activeTab === "parent" ? "bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-sm font-black" : "text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400" }`}
          >
            {t("parent_portal_tab")}
          </button>
        </div>

        {searchParams.get("reason") === "expired" && !loginError && (
          <Alert className="mb-6 animate-in slide-in-from-top-2 duration-300 bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertDescription className="typography-label">
              Your session has expired. Please sign in again to continue.
            </AlertDescription>
          </Alert>
        )}

        {loginError && (
          <Alert variant="destructive" className="mb-6 animate-in slide-in-from-top-2 duration-300 bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400">
            <AlertDescription className="typography-label">{loginError}</AlertDescription>
          </Alert>
        )}

        {activeTab === "parent" ? (
          <form onSubmit={handleParentLogin} className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-2">
              <Label htmlFor="parentPhone" className="typography-label text-slate-800 dark:text-slate-300">{t("registered_phone")}</Label>
              <PhoneInput
                id="parentPhone"
                value={parentPhone}
                onChange={(val) => setParentPhone(val)}
                placeholder={t("parent_phone_placeholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="parentPassword" className="text-slate-800 dark:text-slate-300">{t("password")}</Label>
                <Button
                  variant="link"
                  type="button"
                  onClick={onShowForgotPassword}
                  className="typography-helper text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 h-auto p-0 font-bold"
                >
                  {t("forgot_password")}
                </Button>
              </div>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  id="parentPassword"
                  type={showParentPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={parentPassword}
                  onChange={(e) => setParentPassword(e.target.value)}
                  required
                  className="typography-body pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowParentPassword(!showParentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {showParentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="rememberParent" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="rounded-md border-emerald-600 data-[state=checked]:bg-emerald-600 text-white"
              />
              <label htmlFor="rememberParent" className="typography-label cursor-pointer select-none text-slate-600 dark:text-slate-400">
                Remember me on this device
              </label>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]">
              {isLoading ? <Spinner size="sm" className="text-white" /> : <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="email" className="typography-label text-slate-800 dark:text-slate-300">Email Address</Label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-fuchsia-700 dark:group-focus-within:text-fuchsia-400 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@school.com"
                    value={credentials.email}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    className="typography-body pl-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-600 transition-all rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="typography-label text-slate-800 dark:text-slate-300">Password</Label>
                  <Button
                    variant="link"
                    type="button"
                    onClick={onShowForgotPassword}
                    className="typography-label text-fuchsia-700 dark:text-fuchsia-400 hover:text-fuchsia-800 dark:hover:text-fuchsia-300 h-auto p-0 font-bold"
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-fuchsia-700 dark:group-focus-within:text-fuchsia-400 transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={credentials.password}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                    required
                    className="typography-body pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-600 transition-all rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 pb-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="rounded-md border-slate-400 dark:border-white/20 data-[state=checked]:bg-fuchsia-700"
                />
                <label
                  htmlFor="remember"
                  className="typography-label peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  Remember me on this device
                </label>
              </div>
            </div>

            <Button 
              type="submit" 
              className="typography-card-title w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-fuchsia-900/20 transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="text-primary-foreground mr-2" />
                  {t("signing_in")}
                </>
              ) : (
                <>
                  {t("sign_in_staff")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {onShowAdminSignup && (
          <div className="mt-8 pt-6 border-t border-slate-300 dark:border-white/5 text-center">
            <p className="typography-body text-slate-600 dark:text-slate-400 mb-4 font-medium">New to Addis Hiwot? Create a school account</p>
            <Button
              variant="outline"
              onClick={onShowAdminSignup}
              className="w-full h-11 rounded-xl bg-transparent border-slate-400 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-500 dark:hover:border-white/20 transition-all font-bold"
            >
              Get Started for Free
            </Button>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-white/5 p-1.5 px-3 rounded-full border border-slate-300 dark:border-white/10">
               <span className="typography-label text-[10px] text-slate-600 dark:text-slate-500 uppercase font-bold">{t("theme")}</span>
               <div className="scale-75">
                 <ModeToggle />
               </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-white/5 p-1.5 px-3 rounded-full border border-slate-300 dark:border-white/10">
              <button 
                onClick={() => setLanguage('en')}
                className={`typography-label text-[10px] px-2 py-0.5 rounded transition-colors font-bold ${language === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLanguage('am')}
                className={`typography-label text-[10px] px-2 py-0.5 rounded transition-colors font-bold ${language === 'am' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900'}`}
              >
                አማ
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
