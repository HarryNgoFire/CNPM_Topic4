/**
 * Pure map mathematics module for MoveFlow.
 * Works in vanilla JavaScript for browser and Node.js test runners.
 */

const EARTH_RADIUS_METERS = 6371000;
const TO_RAD = Math.PI / 180;

/**
 * Normalizes longitude into [-180, 180] degrees (antimeridian safe).
 */
export function normalizeLng(lng) {
  if (typeof lng !== "number" || !Number.isFinite(lng)) return 0;
  let normalized = ((lng + 180) % 360 + 360) % 360 - 180;
  // Normalize -180 to 180 if needed, or keep standard range [-180, 180]
  if (normalized === -180 && lng > 0) return 180;
  return normalized;
}

/**
 * Calculates Haversine great-circle distance between two points in meters.
 * @param {{ lat: number, lng: number }} p1
 * @param {{ lat: number, lng: number }} p2
 * @returns {number} Distance in meters
 */
export function haversineMeters(p1, p2) {
  if (!p1 || !p2) return Infinity;
  const lat1 = p1.lat * TO_RAD;
  const lat2 = p2.lat * TO_RAD;
  const dLat = (p2.lat - p1.lat) * TO_RAD;
  const dLng = (normalizeLng(p2.lng) - normalizeLng(p1.lng)) * TO_RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Distance in meters from a point { lat, lng } to a line segment [p1, p2] where points are [lng, lat].
 */
export function pointToSegmentDistanceMeters(point, segStart, segEnd) {
  const [lng1, lat1] = segStart;
  const [lng2, lat2] = segEnd;
  const pLat = point.lat;
  const pLng = normalizeLng(point.lng);

  const meanLat = ((lat1 + lat2) / 2) * TO_RAD;
  const cosLat = Math.cos(meanLat);

  // Convert to local Cartesian plane meters centered at segStart
  const dx = (normalizeLng(lng2) - normalizeLng(lng1)) * TO_RAD * EARTH_RADIUS_METERS * cosLat;
  const dy = (lat2 - lat1) * TO_RAD * EARTH_RADIUS_METERS;

  const px = (pLng - normalizeLng(lng1)) * TO_RAD * EARTH_RADIUS_METERS * cosLat;
  const py = (pLat - lat1) * TO_RAD * EARTH_RADIUS_METERS;

  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) {
    return Math.hypot(px, py);
  }

  // Projection parameter t
  let t = (px * dx + py * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = t * dx;
  const projY = t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates distance from point { lat, lng } to a GeoJSON LineString coordinates array [[lng, lat], ...].
 * @param {{ lat: number, lng: number }} point
 * @param {Array<[number, number]>} coordinates Array of [lng, lat]
 * @returns {number} Minimum distance in meters, or Infinity if empty
 */
export function pointToLineStringDistanceMeters(point, coordinates) {
  if (!point || !Array.isArray(coordinates) || coordinates.length === 0) {
    return Infinity;
  }

  if (coordinates.length === 1) {
    const [lng, lat] = coordinates[0];
    return haversineMeters(point, { lat, lng });
  }

  let minDistance = Infinity;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const d = pointToSegmentDistanceMeters(point, coordinates[i], coordinates[i + 1]);
    if (d < minDistance) {
      minDistance = d;
    }
  }

  return minDistance;
}

/**
 * Checks if a point is off-route based on the 75m threshold.
 * @param {{ lat: number, lng: number }} point
 * @param {Array<[number, number]>} routeCoordinates Array of [lng, lat]
 * @param {number} thresholdMeters Default 75 meters
 * @returns {boolean}
 */
export function isOffRoute(point, routeCoordinates, thresholdMeters = 75) {
  const dist = pointToLineStringDistanceMeters(point, routeCoordinates);
  return dist > thresholdMeters;
}
