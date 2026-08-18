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
  restrictLocation?: boolean
  allowOutsideAttendance?: boolean
  schoolLatitude?: number | string | null
  schoolLongitude?: number | string | null
  allowedRadiusMeters?: number | string | null
  staffGeoRequired?: boolean
}

/**
 * Calculates distance in meters between two lat/lon points using the Haversine formula
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

/**
 * Common geofence resolver for both Student and Staff attendance.
 * Performs Android native checks, GPS acquisition, and boundary validation.
 */
export async function resolveLocationData(
  settings: GeofenceSettings | null | undefined,
  options: {
    isStaff?: boolean
    suppressSuccessToast?: boolean
    timeoutMs?: number
  } = {}
): Promise<GeofenceLocationData | null> {
  let locationData: GeofenceLocationData | null = null

  const isRestricted = options.isStaff
    ? (settings?.staffGeoRequired !== false && settings?.restrictLocation && !settings?.allowOutsideAttendance)
    : (settings?.restrictLocation && !settings?.allowOutsideAttendance)

  if (isRestricted) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      notifications.error(
        "GPS Required",
        "Geolocation is not supported by your device/browser. Cannot verify school location."
      )
      throw new Error("Geolocation not supported")
    }

    // Native Android Pre-flight: Check System GPS & Request Runtime Permissions
    if (NativeBridge.isNative()) {
      const gpsActive = await NativeBridge.isLocationServicesEnabled()
      if (!gpsActive) {
        notifications.error(
          "GPS Turned Off",
          "Device Location Services (GPS) are turned off. Please turn on Location in Settings to submit attendance."
        )
        throw new Error("GPS turned off")
      }

      const permResult = await NativeBridge.requestLocationPermission()
      if (permResult === 'denied' || permResult === 'prompt-with-rationale') {
        notifications.error(
          "Location Permission Required",
          "Location permission is required to verify school proximity. Please enable location access in App Settings."
        )
        throw new Error("Location permission required")
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
          throw new Error("Outside school boundary")
        }

        locationData = {
          latitude: userLat,
          longitude: userLon,
          locationVerified: true,
          locationDistance: distance,
        }
        if (!options.suppressSuccessToast) {
          notifications.success("Location Verified", `GPS verified: ${distance}m from school.`)
        }
      }
    } catch (geoError: any) {
      if (geoError.message === "Outside school boundary") throw geoError
      let msg = "Failed to obtain GPS coordinates."
      if (geoError.code === 1) {
        msg = "Location permission denied. Please grant location permission in Settings to submit attendance."
      } else if (geoError.code === 2) {
        msg = "GPS location unavailable. Please verify your device location services are enabled."
      } else if (geoError.code === 3) {
        msg = "Location request timed out. Please try again."
      }
      notifications.error("GPS Verification Failed", msg)
      throw new Error(msg)
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
        locationData = {
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

  return locationData
}
