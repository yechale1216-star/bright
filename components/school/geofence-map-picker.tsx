"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  MapPin,
  Search,
  Navigation,
  Crosshair,
  ShieldCheck,
  Globe,
  Layers,
  Map as MapIcon,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { notifications } from "@/lib/utils/notifications"
import "leaflet/dist/leaflet.css"

interface GeofenceMapPickerProps {
  latitude: number | null | undefined
  longitude: number | null | undefined
  radiusMeters: number | null | undefined
  address?: string | null | undefined
  onChange: (values: {
    latitude: number
    longitude: number
    radiusMeters: number
    address?: string | null
  }) => void
}

// Addis Ababa default center
const DEFAULT_LAT = 9.030000
const DEFAULT_LON = 38.740000
const DEFAULT_RADIUS = 200

// Crisp Map Tile Providers
const TILE_PROVIDERS = {
  satellite: {
    name: "Satellite (Google Earth)",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps / Google Earth",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
  streets: {
    name: "Crisp Streets",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  },
  esri: {
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
}

export function GeofenceMapPicker({
  latitude,
  longitude,
  radiusMeters = DEFAULT_RADIUS,
  address = "",
  onChange,
}: GeofenceMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)

  const [currentLat, setCurrentLat] = useState<number>(latitude != null && !isNaN(Number(latitude)) ? Number(latitude) : DEFAULT_LAT)
  const [currentLon, setCurrentLon] = useState<number>(longitude != null && !isNaN(Number(longitude)) ? Number(longitude) : DEFAULT_LON)
  const [currentRadius, setCurrentRadius] = useState<number>(radiusMeters || DEFAULT_RADIUS)
  const [mapType, setMapType] = useState<"satellite" | "streets">("satellite")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Sync props to state if props change externally
  useEffect(() => {
    if (latitude != null && !isNaN(Number(latitude))) {
      setCurrentLat(Number(latitude))
    }
    if (longitude != null && !isNaN(Number(longitude))) {
      setCurrentLon(Number(longitude))
    }
    if (radiusMeters != null) {
      setCurrentRadius(Number(radiusMeters))
    }
  }, [latitude, longitude, radiusMeters])

  // Reverse geocode lat/lng to get human readable address
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      )
      if (res.ok) {
        const data = await res.json()
        if (data && data.display_name) {
          return data.display_name
        }
      }
    } catch {
      // ignore network errors
    }
    return null
  }, [])

  // Create clean Google Earth style marker pin
  const createSchoolMarkerIcon = (L: any) => {
    return L.divIcon({
      className: "custom-google-earth-marker",
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Outer Pulsing Radar Ring -->
          <div style="
            position: absolute;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.35);
            border: 2px solid #60a5fa;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          "></div>
          
          <!-- Central Pin Badge -->
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), 0 0 12px rgba(59, 130, 246, 0.6);
            z-index: 2;
          ">
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>
        <style>
          @keyframes pulse-ring {
            0% { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(1.4); opacity: 0; }
          }
        </style>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
  }

  // Initialize Leaflet map with high-definition tiles
  useEffect(() => {
    let isCancelled = false

    const initMap = async () => {
      if (typeof window === "undefined" || !mapContainerRef.current) return

      const L = (await import("leaflet")).default

      if (isCancelled || !mapContainerRef.current) return

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const initialLat = latitude != null && !isNaN(Number(latitude)) ? Number(latitude) : DEFAULT_LAT
      const initialLon = longitude != null && !isNaN(Number(longitude)) ? Number(longitude) : DEFAULT_LON
      const initialRad = radiusMeters != null ? Number(radiusMeters) : DEFAULT_RADIUS

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: 17,
        zoomControl: true,
        maxZoom: 20,
      })

      mapInstanceRef.current = map

      // High-definition Satellite Tiles (Google Earth Hybrid layer)
      const provider = TILE_PROVIDERS[mapType]
      const tileLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: provider.maxZoom,
      }).addTo(map)
      tileLayerRef.current = tileLayer

      // Geofence Circle (Google Earth styled neon blue radius)
      const circle = L.circle([initialLat, initialLon], {
        radius: initialRad,
        color: "#38bdf8",
        fillColor: "#0284c7",
        fillOpacity: 0.28,
        weight: 2.5,
        dashArray: "6, 6",
      }).addTo(map)
      circleRef.current = circle

      // School Center Marker
      const marker = L.marker([initialLat, initialLon], {
        icon: createSchoolMarkerIcon(L),
      }).addTo(map)
      markerRef.current = marker

      // Tap on map to relocate school center
      map.on("click", async (e: any) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6))
        const lon = parseFloat(e.latlng.lng.toFixed(6))
        setCurrentLat(lat)
        setCurrentLon(lon)

        marker.setLatLng([lat, lon])
        circle.setLatLng([lat, lon])
        map.panTo([lat, lon], { animate: true, duration: 0.5 })

        const fetchedAddr = await reverseGeocode(lat, lon)
        onChange({
          latitude: lat,
          longitude: lon,
          radiusMeters: currentRadius,
          address: fetchedAddr || address,
        })
      })

      setTimeout(() => {
        if (map) map.invalidateSize()
      }, 250)
    }

    initMap()

    return () => {
      isCancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Switch Map Layer (Satellite vs Streets)
  const switchMapType = async (type: "satellite" | "streets") => {
    setMapType(type)
    if (!mapInstanceRef.current) return
    const L = (await import("leaflet")).default

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current)
    }

    const provider = TILE_PROVIDERS[type]
    tileLayerRef.current = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(mapInstanceRef.current)
  }

  // Update map marker and circle position
  const updateMapPosition = useCallback((lat: number, lon: number, radius: number, zoom = 18) => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return
    markerRef.current.setLatLng([lat, lon])
    circleRef.current.setLatLng([lat, lon])
    circleRef.current.setRadius(radius)
    mapInstanceRef.current.flyTo([lat, lon], zoom, { duration: 1.2 })
  }, [])

  const handleRadiusChange = (newRadius: number) => {
    setCurrentRadius(newRadius)
    if (circleRef.current) {
      circleRef.current.setRadius(newRadius)
    }
    onChange({
      latitude: currentLat,
      longitude: currentLon,
      radiusMeters: newRadius,
      address,
    })
  }

  // Detect Location (Google Earth Style with high accuracy & fly-to animation)
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      notifications.error("GPS Unavailable", "Geolocation is not supported by your browser.")
      return
    }

    setIsDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6))
        const lon = parseFloat(position.coords.longitude.toFixed(6))
        const accuracy = Math.round(position.coords.accuracy || 0)

        setCurrentLat(lat)
        setCurrentLon(lon)
        setGpsAccuracy(accuracy)
        updateMapPosition(lat, lon, currentRadius, 18)

        const fetchedAddr = await reverseGeocode(lat, lon)
        onChange({
          latitude: lat,
          longitude: lon,
          radiusMeters: currentRadius,
          address: fetchedAddr || address,
        })

        notifications.success(
          "Location Locked",
          `School coordinates centered at: ${lat}, ${lon}`
        )
        setIsDetectingLocation(false)
      },
      (error) => {
        notifications.error("Location Failed", error.message || "Failed to detect device location.")
        setIsDetectingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      )
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data || [])
        if (!data || data.length === 0) {
          notifications.info("No Results", "No matching locations found. Try a nearby landmark or address.")
        }
      }
    } catch {
      notifications.error("Search Error", "Could not search location. Please check your network connection.")
    } finally {
      setIsSearching(false)
    }
  }

  const selectSearchResult = (item: any) => {
    const lat = parseFloat(Number(item.lat).toFixed(6))
    const lon = parseFloat(Number(item.lon).toFixed(6))
    const displayName = item.display_name

    setCurrentLat(lat)
    setCurrentLon(lon)
    setSearchResults([])
    setSearchQuery("")
    updateMapPosition(lat, lon, currentRadius, 18)

    onChange({
      latitude: lat,
      longitude: lon,
      radiusMeters: currentRadius,
      address: displayName,
    })

    notifications.success("Location Selected", `Centered at: ${displayName.slice(0, 50)}...`)
  }

  const radiusPresets = [50, 100, 200, 350, 500, 1000]

  return (
    <div className="space-y-4">
      {/* Primary Action Header: Detect Location & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search school name, landmark, or address..."
            className="pl-10 pr-24 h-11 rounded-2xl bg-card border-border/80 text-sm shadow-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3.5 rounded-xl font-bold text-xs gap-1.5"
          >
            {isSearching ? <Spinner size="sm" /> : <span>Search</span>}
          </Button>
        </form>

        {/* Primary Detect Location Button */}
        <Button
          type="button"
          onClick={handleDetectLocation}
          disabled={isDetectingLocation}
          className="h-11 px-5 rounded-2xl font-black text-xs gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 active:scale-95 transition-all shrink-0"
        >
          {isDetectingLocation ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>Locking GPS...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 text-white animate-pulse" />
              <span>Detect My Location</span>
            </>
          )}
        </Button>
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-card border border-primary/30 rounded-2xl p-2 shadow-xl space-y-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95">
          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Search Results ({searchResults.length})
          </div>
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectSearchResult(item)}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors flex items-start gap-2.5 group"
            >
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-1">{item.display_name.split(",")[0]}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{item.display_name}</p>
              </div>
              <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                {parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lon).toFixed(4)}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Clear HD Live Map Canvas */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-border/80 shadow-2xl bg-slate-950">
        <div
          ref={mapContainerRef}
          style={{ height: "440px", width: "100%", zIndex: 1 }}
          className="rounded-3xl"
        />

        {/* Top-Left: Live Status & Map Layer Switcher */}
        <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 pointer-events-none">
          <div className="bg-slate-950/85 backdrop-blur-md border border-white/15 text-white rounded-2xl px-3.5 py-1.5 shadow-xl flex items-center gap-2 pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-cyan-400 -ml-3.5" />
            <span className="text-xs font-bold tracking-wide">Live Geofence Boundary</span>
          </div>

          <div className="bg-slate-950/85 backdrop-blur-md border border-white/15 p-1 rounded-2xl flex items-center gap-1 shadow-xl pointer-events-auto">
            <Button
              type="button"
              size="sm"
              variant={mapType === "satellite" ? "default" : "ghost"}
              onClick={() => switchMapType("satellite")}
              className={`h-7 px-2.5 text-[11px] font-bold rounded-xl gap-1.5 ${
                mapType === "satellite" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Satellite</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mapType === "streets" ? "default" : "ghost"}
              onClick={() => switchMapType("streets")}
              className={`h-7 px-2.5 text-[11px] font-bold rounded-xl gap-1.5 ${
                mapType === "streets" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Streets</span>
            </Button>
          </div>
        </div>

        {/* Top-Right: Re-center / Detect Quick Button */}
        <div className="absolute top-3 right-3 z-[400] pointer-events-none">
          <Button
            type="button"
            size="sm"
            onClick={handleDetectLocation}
            disabled={isDetectingLocation}
            className="h-9 px-3 rounded-2xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-white backdrop-blur-md shadow-xl gap-1.5 text-xs font-bold pointer-events-auto"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Center on GPS</span>
          </Button>
        </div>

        {/* Bottom Floating Coordinates & Radius HUD */}
        <div className="absolute bottom-3 left-3 right-3 z-[400] pointer-events-none">
          <div className="bg-slate-950/90 backdrop-blur-md border border-white/15 text-white rounded-2xl p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">School Coordinates</p>
                <p className="text-xs font-mono font-bold text-white tracking-wide">
                  {currentLat.toFixed(6)}, {currentLon.toFixed(6)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Geofence Radius</p>
                <p className="text-xs font-mono font-bold text-cyan-400">
                  {currentRadius} meters
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 font-medium hidden sm:flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <span>💡 Tap anywhere on map to set school center</span>
            </div>
          </div>
        </div>
      </div>

      {/* Radius Slider & Quick Presets */}
      <div className="bg-muted/40 border border-border/80 rounded-3xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-primary" /> Geofence Boundary Radius
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Staff must be physically located within this radius to submit attendance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="10"
              max="3000"
              value={currentRadius}
              onChange={(e) => handleRadiusChange(Number(e.target.value) || 200)}
              className="w-24 h-9 rounded-xl text-center font-mono font-bold text-sm bg-card"
            />
            <span className="text-xs font-bold text-muted-foreground">meters</span>
          </div>
        </div>

        <div className="pt-2 px-1">
          <Slider
            value={[currentRadius]}
            min={20}
            max={1500}
            step={10}
            onValueChange={(vals) => handleRadiusChange(vals[0])}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
            <span>20m (Strict)</span>
            <span>200m (Recommended)</span>
            <span>500m</span>
            <span>1500m (Wide Campus)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
            Presets:
          </span>
          {radiusPresets.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={currentRadius === preset ? "default" : "outline"}
              size="sm"
              onClick={() => handleRadiusChange(preset)}
              className="h-7 px-3 rounded-lg text-xs font-bold"
            >
              {preset}m
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Geofence Attendance Verification Map (Clear Satellite / Hybrid View)
 * Displays the staff member's live location relative to the school geofence circle.
 */
export function GeofenceAttendanceMap({
  schoolLatitude,
  schoolLongitude,
  allowedRadiusMeters,
  userLatitude,
  userLongitude,
  distanceMeters,
  isInside,
}: {
  schoolLatitude: number
  schoolLongitude: number
  allowedRadiusMeters: number
  userLatitude?: number | null
  userLongitude?: number | null
  distanceMeters?: number | null
  isInside: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    let isCancelled = false

    const initMiniMap = async () => {
      if (typeof window === "undefined" || !containerRef.current) return
      const L = (await import("leaflet")).default
      if (isCancelled || !containerRef.current) return

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const centerLat = userLatitude != null ? (schoolLatitude + userLatitude) / 2 : schoolLatitude
      const centerLon = userLongitude != null ? (schoolLongitude + userLongitude) / 2 : schoolLongitude

      const map = L.map(containerRef.current, {
        center: [centerLat, centerLon],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false,
      })
      mapRef.current = map

      // Clear Satellite / Hybrid Tiles (Google Earth style)
      L.tileLayer(TILE_PROVIDERS.satellite.url, {
        maxZoom: 20,
      }).addTo(map)

      // Geofence Circle (School)
      L.circle([schoolLatitude, schoolLongitude], {
        radius: allowedRadiusMeters,
        color: isInside ? "#10b981" : "#f43f5e",
        fillColor: isInside ? "#34d399" : "#fb7185",
        fillOpacity: 0.28,
        weight: 2.5,
        dashArray: "4, 4",
      }).addTo(map)

      // School Center Marker Pin
      const schoolIcon = L.divIcon({
        className: "mini-school-icon",
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-size: 13px;
          ">
            🏫
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      L.marker([schoolLatitude, schoolLongitude], { icon: schoolIcon }).addTo(map)

      // Staff User Position Marker Pin
      if (userLatitude != null && userLongitude != null) {
        const userIcon = L.divIcon({
          className: "mini-user-icon",
          html: `
            <div style="
              width: 28px;
              height: 28px;
              background: ${isInside ? "#10b981" : "#f43f5e"};
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2.5px solid white;
              box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            ">
              <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        L.marker([userLatitude, userLongitude], { icon: userIcon }).addTo(map)

        L.polyline(
          [
            [schoolLatitude, schoolLongitude],
            [userLatitude, userLongitude],
          ],
          {
            color: isInside ? "#10b981" : "#f43f5e",
            weight: 2.5,
            dashArray: "4, 6",
          }
        ).addTo(map)

        const bounds = L.latLngBounds(
          [schoolLatitude, schoolLongitude],
          [userLatitude, userLongitude]
        )
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 })
      }

      setTimeout(() => {
        if (map) map.invalidateSize()
      }, 200)
    }

    initMiniMap()

    return () => {
      isCancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [schoolLatitude, schoolLongitude, allowedRadiusMeters, userLatitude, userLongitude, isInside])

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-slate-950">
      <div ref={containerRef} style={{ height: "220px", width: "100%" }} />
      <div className="absolute top-2 right-2 z-[400] bg-slate-950/90 text-white px-3 py-1 rounded-xl text-[10px] font-mono font-bold backdrop-blur-md border border-white/15 shadow-xl flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isInside ? "bg-emerald-400" : "bg-rose-400"}`} />
        <span>{distanceMeters != null ? `${Math.round(distanceMeters)}m from school` : "Live Location"}</span>
      </div>
    </div>
  )
}
