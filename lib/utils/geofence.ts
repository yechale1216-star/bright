"use client"

import { NativeBridge } from "@/lib/utils/native-bridge"
import { notifications } from "@/lib/utils/notifications"

export interface GeofenceLocationData {
  latitude: number
  longitude: number
  locationVerified: boolean
  locationDistance: number | null
}

export interface GeofenceSettings {
  /** @deprecated for staff - GPS is always required. Kept for student attendance path. */
  restrictLocation?: boolean
  /** @deprecated for staff - bypass not allowed. Kept for student attendance path. */
  allowOutsideAttendance?: boolean
  schoolLatitude?: number | string | null
  schoolLongitude?: number | string | null
  allowedRadiusMeters?: number | string | null
  schoolAddress?: string | null
  staffGeoRequired?: boolean
}

/**
 * Calculates distance in meters between two lat/lon points using the Haversine formula
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const Dphi = ((lat2 - lat1) * Math.PI) / 180
  const Dlambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Dphi / 2) * Math.sin(Dphi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(Dlambda / 2) * Math.sin(Dlambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

export class GeofenceValidationError extends Error {
  code: 'OUTSIDE_BOUNDARY' | 'GPS_DISABLED' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNSUPPORTED' | 'FAILED'
  distance?: number
  allowedRadius?: number
  userLatitude?: number
  userLongitude?: number

  constructor(
    message: string,
    options: {
      code: 'OUTSIDE_BOUNDARY' | 'GPS_DISABLED' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNSUPPORTED' | 'FAILED'
      distance?: number
      allowedRadius?: number
      userLatitude?: number
      userLongitude?: number
    }
  ) {
    super(message)
    this.name = 'GeofenceValidationError'
    this.code = options.code
    this.distance = options.distance
    this.allowedRadius = options.allowedRadius
    this.userLatitude = options.userLatitude
    this.userLongitude = options.userLongitude
  }
}

/**
 * Staff attendance GPS resolver - GPS is ALWAYS required, no opt-out.
 * Acquires location, validates boundary if school coordinates are set.
 * Throws GeofenceValidationError on any GPS/permission/boundary failure.
 */
async function resolveStaffLocation(
  settings: GeofenceSettings | null | undefined,
  options: { suppressSuccessToast?: boolean; timeoutMs?: number }
): Promise<GeofenceLocationData> {
  const GPS_REQUIRED_MSG =
    "Location access is required for attendance. Please enable GPS and grant location permission."

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    notifications.error("GPS Required", "Geolocation is not supported by your device/browser.")
    throw new GeofenceValidationError("Geolocation not supported", { code: 'UNSUPPORTED' })
  }

  // Native Android Pre-flight: Check System GPS & Request Runtime Permissions
  if (NativeBridge.isNative()) {
    const gpsActive = await NativeBridge.isLocationServicesEnabled()
    if (!gpsActive) {
      notifications.error("GPS Required", GPS_REQUIRED_MSG)
      throw new GeofenceValidationError("GPS turned off", { code: 'GPS_DISABLED' })
    }

    const permResult = await NativeBridge.requestLocationPermission()
    if (permResult === 'denied' || permResult === 'prompt-with-rationale') {
      notifications.error("GPS Required", GPS_REQUIRED_MSG)
      throw new GeofenceValidationError("Location permission required", { code: 'PERMISSION_DENIED' })
    }
  }

  let position: GeolocationPosition
  try {
    position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: options.timeoutMs || 12000,
        maximumAge: 0,
      })
    })
  } catch (geoError: any) {
    let msg = GPS_REQUIRED_MSG
    let code: 'PERMISSION_DENIED' | 'GPS_DISABLED' | 'TIMEOUT' | 'FAILED' = 'FAILED'
    if (geoError.code === 1) {
      msg = GPS_REQUIRED_MSG
      code = 'PERMISSION_DENIED'
    } else if (geoError.code === 2) {
      msg = GPS_REQUIRED_MSG
      code = 'GPS_DISABLED'
    } else if (geoError.code === 3) {
      msg = "Location request timed out. Please move to an open area and try again."
      code = 'TIMEOUT'
    }
    notifications.error("GPS Required", msg)
    throw new GeofenceValidationError(msg, { code })
  }

  const userLat = position.coords.latitude
  const userLon = position.coords.longitude

  // Boundary validation - only if school coordinates have been configured by admin
  if (settings?.schoolLatitude != null && settings?.schoolLongitude != null) {
    const distance = calculateDistanceMeters(
      userLat,
      userLon,
      Number(settings.schoolLatitude),
      Number(settings.schoolLongitude)
    )
    const allowedRadius = Number(settings.allowedRadiusMeters) || 200

    if (distance > allowedRadius) {
      notifications.error(
        "Outside School Boundary",
        `You are ${distance}m away from school (Allowed: ${allowedRadius}m). Attendance blocked.`
      )
      throw new GeofenceValidationError(
        `Outside school boundary! You are ${distance}m away (Allowed: ${allowedRadius}m).`,
        { code: 'OUTSIDE_BOUNDARY', distance, allowedRadius, userLatitude: userLat, userLongitude: userLon }
      )
    }

    if (!options.suppressSuccessToast) {
      notifications.success("Location Verified", `GPS verified: ${distance}m from school.`)
    }

    return {
      latitude: userLat,
      longitude: userLon,
      locationVerified: true,
      locationDistance: distance,
    }
  }

  // No school coordinates configured yet - capture location but do not block
  return {
    latitude: userLat,
    longitude: userLon,
    locationVerified: false,
    locationDistance: null,
  }
}

/**
 * Common geofence resolver for both Student and Staff attendance.
 * For staff (isStaff: true): GPS is unconditionally required.
 * For students: uses restrictLocation / allowOutsideAttendance settings (configurable).
 */
export async function resolveLocationData(
  settings: GeofenceSettings | null | undefined,
  options: {
    isStaff?: boolean
    suppressSuccessToast?: boolean
    timeoutMs?: number
  } = {}
): Promise<GeofenceLocationData | null> {

  // STAFF PATH: GPS always required
  if (options.isStaff) {
    return resolveStaffLocation(settings, options)
  }

  // STUDENT PATH: legacy configurable logic
  const isRestricted = settings?.restrictLocation && !settings?.allowOutsideAttendance

  if (isRestricted) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      notifications.error(
        "GPS Required",
        "Geolocation is not supported by your device/browser. Cannot verify school location."
      )
      throw new GeofenceValidationError("Geolocation not supported", { code: 'UNSUPPORTED' })
    }

    // Native Android Pre-flight: Check System GPS & Request Runtime Permissions
    if (NativeBridge.isNative()) {
      const gpsActive = await NativeBridge.isLocationServicesEnabled()
      if (!gpsActive) {
        notifications.error(
          "GPS Turned Off",
          "Device Location Services (GPS) are turned off. Please turn on Location in Settings to submit attendance."
        )
        throw new GeofenceValidationError("GPS turned off", { code: 'GPS_DISABLED' })
      }

      const permResult = await NativeBridge.requestLocationPermission()
      if (permResult === 'denied' || permResult === 'prompt-with-rationale') {
        notifications.error(
          "Location Permission Required",
          "Location permission is required to verify school proximity. Please enable location access in App Settings."
        )
        throw new GeofenceValidationError("Location permission required", { code: 'PERMISSION_DENIED' })
      }
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: options.timeoutMs || 12000,
          maximumAge: 0,
        })
      })

      const userLat = position.coords.latitude
      const userLon = position.coords.longitude

      if (settings?.schoolLatitude != null && settings?.schoolLongitude != null) {
        const distance = calculateDistanceMeters(
          userLat,
          userLon,
          Number(settings.schoolLatitude),
          Number(settings.schoolLongitude)
        )

        const allowedRadius = Number(settings.allowedRadiusMeters) || 200

        if (distance > allowedRadius) {
          notifications.error(
            "Submission Blocked",
            `Outside school boundary! You are ${distance}m away (Allowed: ${allowedRadius}m). Attendance submission blocked.`
          )
          throw new GeofenceValidationError(
            `Outside school boundary! You are ${distance}m away (Allowed: ${allowedRadius}m). Attendance submission blocked.`,
            { code: 'OUTSIDE_BOUNDARY', distance, allowedRadius }
          )
        }

        const locationData: GeofenceLocationData = {
          latitude: userLat,
          longitude: userLon,
          locationVerified: true,
          locationDistance: distance,
        }
        if (!options.suppressSuccessToast) {
          notifications.success("Location Verified", `GPS verified: ${distance}m from school.`)
        }
        return locationData
      }
    } catch (geoError: any) {
      if (geoError instanceof GeofenceValidationError || geoError.code === 'OUTSIDE_BOUNDARY' || geoError.message?.includes("Outside school boundary")) {
        throw geoError
      }
      let msg = "Failed to obtain GPS coordinates."
      let code: 'PERMISSION_DENIED' | 'GPS_DISABLED' | 'TIMEOUT' | 'FAILED' = 'FAILED'
      if (geoError.code === 1) {
        msg = "Location permission denied. Please grant location permission in Settings to submit attendance."
        code = 'PERMISSION_DENIED'
      } else if (geoError.code === 2) {
        msg = "GPS location unavailable. Please verify your device location services are enabled."
        code = 'GPS_DISABLED'
      } else if (geoError.code === 3) {
        msg = "Location request timed out. Please try again."
        code = 'TIMEOUT'
      }
      notifications.error("GPS Verification Failed", msg)
      throw new GeofenceValidationError(msg, { code })
    }
  } else if (typeof navigator !== "undefined" && navigator.geolocation) {
    // Optional location capture when geofence restriction is OFF or bypass is ON
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
      }).catch(() => null)

      if (position) {
        const userLat = position.coords.latitude
        const userLon = position.coords.longitude
        let dist: number | null = null
        if (settings?.schoolLatitude != null && settings?.schoolLongitude != null) {
          dist = calculateDistanceMeters(
            userLat,
            userLon,
            Number(settings.schoolLatitude),
            Number(settings.schoolLongitude)
          )
        }
        return {
          latitude: userLat,
          longitude: userLon,
          locationVerified: dist != null ? dist <= (Number(settings?.allowedRadiusMeters) || 200) : false,
          locationDistance: dist,
        }
      }
    } catch {
      // Ignore fallback errors
    }
  }

  return null
}
