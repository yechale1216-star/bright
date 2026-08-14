/**
 * onboarding-isolation.test.ts
 *
 * Verifies that a newly onboarded school admin can never see another school's
 * data — even for a single render frame — after completing the onboarding wizard.
 *
 * Run with:  npx jest __tests__/onboarding-isolation.test.ts --testEnvironment=jsdom
 */

import { authService } from "../lib/auth/auth"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-abc",
    name: "Test Admin",
    email: "admin@school.test",
    role: "admin",
    schoolId: "school-NEW",
    onboardingCompleted: false,
    ...overrides,
  }
}

function setLocalStorage(user: Record<string, unknown>, schoolId?: string) {
  localStorage.setItem("attendance_current_user", JSON.stringify(user))
  localStorage.setItem("attendance_token", "jwt-token-abc")
  if (schoolId) {
    localStorage.setItem("x-school-id", schoolId)
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Single-school session isolation after onboarding", () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    localStorage.clear()
    fetchMock = jest.fn()
    global.fetch = fetchMock
    // Suppress intentional console.warn output in tests
    jest.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  it("completeOnboarding() always overwrites x-school-id with the authenticated user's schoolId", async () => {
    // Simulate stale x-school-id from a previous session (different school)
    setLocalStorage(buildUser({ schoolId: "school-NEW" }), "school-OLD-STALE")

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "Onboarding complete" }),
    })

    await authService.completeOnboarding({
      schoolEmail: "contact@school.test",
      attendanceMode: "daily",
    })

    const writtenSchoolId = localStorage.getItem("x-school-id")
    expect(writtenSchoolId).toBe("school-NEW")
    expect(writtenSchoolId).not.toBe("school-OLD-STALE")
  })

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  it("completeOnboarding() fires the onboardingCompleted CustomEvent", async () => {
    setLocalStorage(buildUser({ schoolId: "school-NEW" }))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "OK" }),
    })

    const eventSpy = jest.fn()
    window.addEventListener("onboardingCompleted", eventSpy)

    await authService.completeOnboarding({})

    window.removeEventListener("onboardingCompleted", eventSpy)
    expect(eventSpy).toHaveBeenCalledTimes(1)
    // Verify the schoolId in the event detail is the authenticated tenant, not stale
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail
    expect(detail.schoolId).toBe("school-NEW")
  })

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  it("completeOnboarding() also fires userSessionChanged to sync other listeners", async () => {
    setLocalStorage(buildUser({ schoolId: "school-NEW" }))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "OK" }),
    })

    const sessionChangeSpy = jest.fn()
    window.addEventListener("userSessionChanged", sessionChangeSpy)

    await authService.completeOnboarding({})

    window.removeEventListener("userSessionChanged", sessionChangeSpy)
    expect(sessionChangeSpy).toHaveBeenCalledTimes(1)
  })

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  it("getCurrentUser() reflects onboardingCompleted=true immediately after completeOnboarding()", async () => {
    setLocalStorage(buildUser({ schoolId: "school-NEW", onboardingCompleted: false }))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "OK" }),
    })

    await authService.completeOnboarding({})

    const user = authService.getCurrentUser()
    expect(user?.onboardingCompleted).toBe(true)
    expect(user?.schoolId).toBe("school-NEW")
  })

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  it("completeOnboarding() does NOT update x-school-id when the server returns an error", async () => {
    setLocalStorage(buildUser({ schoolId: "school-NEW" }), "school-OLD-STALE")

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: "Server error" }),
    })

    const result = await authService.completeOnboarding({})

    expect(result.success).toBe(false)
    // Stale x-school-id must remain untouched — we must not write the wrong value
    expect(localStorage.getItem("x-school-id")).toBe("school-OLD-STALE")
  })

  // ── Test 6 ─────────────────────────────────────────────────────────────────
  it("x-school-id in localStorage is always the authenticated tenant after completeOnboarding()", async () => {
    // Inject stale x-school-id that differs from the authenticated user
    setLocalStorage(buildUser({ schoolId: "school-CORRECT" }), "school-WRONG-STALE")

    // completeOnboarding must overwrite the stale value
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "OK" }),
    })
    await authService.completeOnboarding({})

    // BaseDatabase.getSchoolId() reads this value as the fallback header
    const storedSchoolId = localStorage.getItem("x-school-id")
    expect(storedSchoolId).toBe("school-CORRECT")
    expect(storedSchoolId).not.toBe("school-WRONG-STALE")
  })

  // ── Test 7 ─────────────────────────────────────────────────────────────────
  it("completeOnboarding() preserves logoUrl in the stored user object", async () => {
    setLocalStorage(buildUser({ schoolId: "school-NEW", schoolLogo: "" }))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: "OK" }),
    })

    await authService.completeOnboarding({ logoUrl: "https://cdn.example.com/logo.png" })

    const user = authService.getCurrentUser()
    expect(user?.schoolLogo).toBe("https://cdn.example.com/logo.png")
  })
})
