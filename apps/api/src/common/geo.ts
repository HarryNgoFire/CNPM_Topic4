export const GPS_CONSTANTS = {
  MAX_FUTURE_SKEW_SECONDS: 30,
  MAX_ACCEPTED_ACCURACY_M: 200,
  GEOFENCE_MAX_ACCURACY_M: 50,
  MAX_SPEED_MPS: 55, // ~198 km/h
  UPDATE_MIN_INTERVAL_MS: 5000,
  UPDATE_MIN_DISTANCE_M: 15,
  STATIONARY_HEARTBEAT_MS: 60000,
  MAX_STALE_SECONDS: 300, // 5 minutes
  ARRIVAL_RADIUS_M: 100,
} as const;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function isValidWgs84(point: GeoPoint): boolean {
  if (typeof point.lat !== "number" || typeof point.lng !== "number") {
    return false;
  }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return false;
  }
  if (point.lat < -90 || point.lat > 90) {
    return false;
  }
  if (point.lng < -180 || point.lng > 180) {
    return false;
  }
  return true;
}

/**
 * Calculates Haversine great-circle distance between two WGS84 points in meters.
 */
export function haversineDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  if (!isValidWgs84(p1) || !isValidWgs84(p2)) {
    throw new Error("Invalid WGS84 coordinates");
  }

  const R = 6371000; // Earth's mean radius in meters
  const toRad = Math.PI / 180;
  const dLat = (p2.lat - p1.lat) * toRad;
  const dLng = (p2.lng - p1.lng) * toRad;
  const lat1 = p1.lat * toRad;
  const lat2 = p2.lat * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface GpsValidationInput {
  current: {
    lat: number;
    lng: number;
    accuracyM: number;
    capturedAt: string | Date;
  };
  prior?: {
    lat: number;
    lng: number;
    locationCapturedAt: string | Date;
  } | null;
  serverNow?: Date;
}

export type GpsEvaluationResult =
  | { valid: false; error: string }
  | { valid: true; accepted: false; reason: "TOO_SOON" | "STATIONARY" }
  | { valid: true; accepted: true; distanceM: number; durationMs: number };

export function evaluateDriverGps(input: GpsValidationInput): GpsEvaluationResult {
  const { current, prior, serverNow = new Date() } = input;

  // 1. Validate coordinates
  if (!isValidWgs84(current)) {
    return { valid: false, error: "Invalid WGS84 coordinates (latitude must be between -90 and 90, longitude between -180 and 180)" };
  }

  // 2. Validate accuracy
  if (
    typeof current.accuracyM !== "number" ||
    !Number.isFinite(current.accuracyM) ||
    current.accuracyM <= 0 ||
    current.accuracyM > GPS_CONSTANTS.MAX_ACCEPTED_ACCURACY_M
  ) {
    return {
      valid: false,
      error: `Accuracy must be positive and at most ${GPS_CONSTANTS.MAX_ACCEPTED_ACCURACY_M}m`,
    };
  }

  // 3. Validate timestamp
  const capturedDate =
    current.capturedAt instanceof Date
      ? current.capturedAt
      : new Date(current.capturedAt);
  const capturedMs = capturedDate.getTime();
  if (Number.isNaN(capturedMs)) {
    return { valid: false, error: "Invalid capture timestamp" };
  }

  const serverMs = serverNow.getTime();
  const futureSkewSeconds = (capturedMs - serverMs) / 1000;
  if (futureSkewSeconds > GPS_CONSTANTS.MAX_FUTURE_SKEW_SECONDS) {
    return {
      valid: false,
      error: `Timestamp is too far in the future (exceeds ${GPS_CONSTANTS.MAX_FUTURE_SKEW_SECONDS}s skew)`,
    };
  }

  const staleSeconds = (serverMs - capturedMs) / 1000;
  if (staleSeconds > GPS_CONSTANTS.MAX_STALE_SECONDS) {
    return {
      valid: false,
      error: `Timestamp is stale (exceeds ${GPS_CONSTANTS.MAX_STALE_SECONDS}s)`,
    };
  }

  // 4. Compare with prior location if present
  if (prior && prior.locationCapturedAt) {
    const priorDate =
      prior.locationCapturedAt instanceof Date
        ? prior.locationCapturedAt
        : new Date(prior.locationCapturedAt);
    const priorMs = priorDate.getTime();

    // Do not overwrite a newer capture with an older or equal one
    if (capturedMs <= priorMs) {
      return {
        valid: false,
        error: "Capture timestamp must be strictly newer than prior capture",
      };
    }

    const durationMs = capturedMs - priorMs;
    const durationSeconds = durationMs / 1000;
    const distanceM = haversineDistanceMeters(prior, current);

    // Speed check
    const speedMps = distanceM / durationSeconds;
    if (speedMps > GPS_CONSTANTS.MAX_SPEED_MPS) {
      return {
        valid: false,
        error: `Implausible speed detected (${Math.round(speedMps)} m/s > ${GPS_CONSTANTS.MAX_SPEED_MPS} m/s)`,
      };
    }

    // Throttling logic:
    // Update interval < 5 seconds
    if (durationMs < GPS_CONSTANTS.UPDATE_MIN_INTERVAL_MS) {
      return { valid: true, accepted: false, reason: "TOO_SOON" };
    }

    // Distance < 15m and interval < 60 seconds (stationary)
    if (
      distanceM < GPS_CONSTANTS.UPDATE_MIN_DISTANCE_M &&
      durationMs < GPS_CONSTANTS.STATIONARY_HEARTBEAT_MS
    ) {
      return { valid: true, accepted: false, reason: "STATIONARY" };
    }

    return { valid: true, accepted: true, distanceM, durationMs };
  }

  return { valid: true, accepted: true, distanceM: 0, durationMs: 0 };
}

export interface GeofenceArrivalInput {
  currentLocation: {
    lat: number;
    lng: number;
    accuracyM: number;
    capturedAt: string | Date;
  } | null;
  targetLocation: GeoPoint;
  serverNow?: Date;
}

export type GeofenceArrivalResult = {
  eligible: boolean;
  distanceM: number | null;
  reason?: string;
};

export function evaluateGeofenceArrival(input: GeofenceArrivalInput): GeofenceArrivalResult {
  const { currentLocation, targetLocation, serverNow = new Date() } = input;
  if (!currentLocation) {
    return { eligible: false, distanceM: null, reason: "No driver location recorded" };
  }
  if (!isValidWgs84(targetLocation) || !isValidWgs84(currentLocation)) {
    return { eligible: false, distanceM: null, reason: "Invalid coordinates" };
  }
  const captured =
    currentLocation.capturedAt instanceof Date
      ? currentLocation.capturedAt
      : new Date(currentLocation.capturedAt);
  if (isNaN(captured.getTime())) {
    return { eligible: false, distanceM: null, reason: "Invalid capture timestamp" };
  }

  const ageMs = serverNow.getTime() - captured.getTime();
  if (ageMs < -30000 || ageMs > 30000) {
    return {
      eligible: false,
      distanceM: null,
      reason: ageMs > 30000 ? "Location is older than 30 seconds" : "Location timestamp is in the future",
    };
  }

  if (currentLocation.accuracyM > GPS_CONSTANTS.GEOFENCE_MAX_ACCURACY_M) {
    return {
      eligible: false,
      distanceM: null,
      reason: `Location accuracy (${currentLocation.accuracyM}m) exceeds ${GPS_CONSTANTS.GEOFENCE_MAX_ACCURACY_M}m threshold`,
    };
  }

  const distanceM = Math.round(haversineDistanceMeters(currentLocation, targetLocation));
  if (distanceM > GPS_CONSTANTS.ARRIVAL_RADIUS_M) {
    return {
      eligible: false,
      distanceM,
      reason: `Driver is ${distanceM}m away from target (arrival radius is ${GPS_CONSTANTS.ARRIVAL_RADIUS_M}m)`,
    };
  }

  return { eligible: true, distanceM };
}
