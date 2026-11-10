/**
 * Driver Two-Stage Trip Controller:
 * Manages two-stage trip navigation (GPS -> Pickup A -> Dropoff B),
 * throttled device GPS uploads, geofence arrival guards, and rerouting.
 */

import { MapEngine } from "./map-engine.js";
import { startLocationWatch } from "./geolocation.js";
import { haversineMeters, isOffRoute } from "./map-math.js";
import { AbortableRequest } from "./api-clients.js";

const GPS_THROTTLE = {
  MIN_INTERVAL_MS: 5000,
  MIN_DISTANCE_M: 15,
  STATIONARY_HEARTBEAT_MS: 60000,
  OFF_ROUTE_REROUTE_DELAY_MS: 20000,
  ARRIVAL_RADIUS_M: 100,
  GEOFENCE_MAX_ACCURACY_M: 50,
};

export class DriverTripController {
  constructor({
    mapElement,
    shipmentId,
    api,
    onStateChanged = null,
    geolocation = null,
    MapEngineClass = MapEngine,
  }) {
    this.mapElement = mapElement;
    this.shipmentId = shipmentId;
    this.api = api;
    this.onStateChanged = onStateChanged;
    this.MapEngineClass = MapEngineClass;
    this.geolocation = geolocation || { startLocationWatch };

    this.engine = null;
    this.stopWatch = null;
    this.navReq = new AbortableRequest();

    this.phase = "TO_PICKUP";
    this.shipmentStatus = "EN_ROUTE_PICKUP";
    this.destination = null;
    this.route = null;
    this.arrival = { eligible: false, distanceM: null };
    this.currentLocation = null;

    this.lastUploadedGps = null;
    this.lastUploadTime = 0;
    this.pendingUpload = null;
    this.firstOffRouteTime = null;
    this._visibilityHandler = null;
  }

  async mount() {
    this.engine = new this.MapEngineClass({
      container: this.mapElement,
    });
    await this.engine.ready();

    await this.refreshNavigation();

    if (this.phase !== "COMPLETE") {
      this.startTracking();
    }

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      this._visibilityHandler = () => {
        if (document.hidden) {
          this.stopTracking();
        } else if (this.phase !== "COMPLETE") {
          this.startTracking();
        }
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);
    }
  }

  startTracking() {
    if (this.stopWatch) return;
    this.stopWatch = this.geolocation.startLocationWatch({
      onPosition: (pos) => this.handleDeviceGps(pos),
      onError: (err) => {
        if (this.onStateChanged) {
          this.onStateChanged({ type: "GPS_ERROR", error: err });
        }
      },
    });
  }

  stopTracking() {
    if (this.stopWatch) {
      try {
        this.stopWatch();
      } catch {
        // ignore
      }
      this.stopWatch = null;
    }
  }

  async refreshNavigation() {
    try {
      const nav = await this.api.get(`/shipments/${this.shipmentId}/navigation`);
      this.phase = nav.phase;
      this.shipmentStatus = nav.shipmentStatus;
      this.destination = nav.destination;
      this.route = nav.route;
      this.arrival = nav.arrival || { eligible: false, distanceM: null };
      if (nav.currentLocation) {
        this.currentLocation = nav.currentLocation;
      }

      this.syncMapState();

      if (this.phase === "COMPLETE") {
        this.stopTracking();
      }

      if (this.onStateChanged) {
        this.onStateChanged({
          type: "NAV_UPDATED",
          phase: this.phase,
          shipmentStatus: this.shipmentStatus,
          arrival: this.arrival,
          route: this.route,
          destination: this.destination,
        });
      }
    } catch (err) {
      if (this.onStateChanged) {
        this.onStateChanged({ type: "NAV_ERROR", error: err });
      }
    }
  }

  syncMapState() {
    if (!this.engine) return;

    // Endpoints
    let pickup = null;
    let dropoff = null;
    if (this.destination?.kind === "PICKUP") {
      pickup = { lat: this.destination.lat, lng: this.destination.lng };
    } else if (this.destination?.kind === "DROPOFF") {
      dropoff = { lat: this.destination.lat, lng: this.destination.lng };
    }
    this.engine.setEndpoints({ pickup, dropoff });

    // Route
    this.engine.setRoute(this.route?.geometry || null);

    // Driver location
    if (this.currentLocation) {
      this.engine.setDriverLocation(this.currentLocation);
    }

    this.engine.fitRelevantPoints();
  }

  handleDeviceGps(point, now = Date.now()) {
    if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") return;

    this.currentLocation = point;
    if (this.engine) {
      this.engine.setDriverLocation(point);
    }

    // Check rerouting if off route
    if (this.route?.geometry?.coordinates && Array.isArray(this.route.geometry.coordinates)) {
      const off = isOffRoute(point, this.route.geometry.coordinates, 75);
      if (off) {
        if (!this.firstOffRouteTime) {
          this.firstOffRouteTime = now;
        } else if (now - this.firstOffRouteTime >= GPS_THROTTLE.OFF_ROUTE_REROUTE_DELAY_MS) {
          this.firstOffRouteTime = null;
          this.refreshNavigation();
        }
      } else {
        this.firstOffRouteTime = null;
      }
    }

    // Throttling logic for backend upload
    const baseline = this.pendingUpload || (this.lastUploadedGps
      ? { point: this.lastUploadedGps, now: this.lastUploadTime }
      : null);

    if (!baseline) {
      // First point uploads immediately
      this.uploadGps(point, now);
      return;
    }

    const timeSinceLast = now - baseline.now;
    const distMoved = haversineMeters(baseline.point, point);

    // Minimum interval 5 seconds
    if (timeSinceLast < GPS_THROTTLE.MIN_INTERVAL_MS) {
      return;
    }

    // Distance < 15m and interval < 60 seconds (stationary)
    if (
      distMoved < GPS_THROTTLE.MIN_DISTANCE_M &&
      timeSinceLast < GPS_THROTTLE.STATIONARY_HEARTBEAT_MS
    ) {
      return;
    }

    this.uploadGps(point, now);
  }

  async uploadGps(point, now) {
    if (this.pendingUpload) return;
    const pendingUpload = { point, now };
    this.pendingUpload = pendingUpload;

    try {
      const result = await this.api.patch("/drivers/me/location", {
        lat: point.lat,
        lng: point.lng,
        accuracyM: point.accuracyM,
        capturedAt: point.capturedAt || new Date(now).toISOString(),
      });
      if (!result?.accepted) return;

      this.lastUploadedGps = point;
      this.lastUploadTime = now;
      if (this.destination) {
        const distanceM = Math.round(haversineMeters(point, this.destination));
        this.arrival = {
          eligible:
            distanceM <= GPS_THROTTLE.ARRIVAL_RADIUS_M &&
            Number(point.accuracyM) > 0 &&
            Number(point.accuracyM) <= GPS_THROTTLE.GEOFENCE_MAX_ACCURACY_M,
          distanceM,
        };
        if (this.onStateChanged) {
          this.onStateChanged({ type: "GPS_UPDATED", arrival: this.arrival });
        }
      }
    } catch {
      // A later GPS callback retries because the successful baseline is unchanged.
    } finally {
      if (this.pendingUpload === pendingUpload) {
        this.pendingUpload = null;
      }
    }
  }

  async confirmArrival() {
    const nextStatus =
      this.phase === "TO_PICKUP" ? "ARRIVED_PICKUP" : "ARRIVED_DROPOFF";
    await this.api.post(`/shipments/${this.shipmentId}/transition`, {
      toStatus: nextStatus,
    });
    await this.refreshNavigation();
  }

  async confirmPickup() {
    await this.api.post(`/shipments/${this.shipmentId}/transition`, {
      toStatus: "OUT_FOR_DELIVERY",
    });
    await this.refreshNavigation();
  }

  async confirmDelivery() {
    await this.api.post(`/shipments/${this.shipmentId}/transition`, {
      toStatus: "DELIVERED",
    });
    await this.refreshNavigation();
  }

  async reportDeliveryFailure(reason) {
    await this.api.post(`/shipments/${this.shipmentId}/transition`, {
      toStatus: "DELIVERY_FAILED",
      reason: String(reason || "").trim(),
    });
    await this.refreshNavigation();
  }

  destroy() {
    this.stopTracking();
    if (this._visibilityHandler && typeof document !== "undefined" && typeof document.removeEventListener === "function") {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = null;
    }
    this.navReq.abort();
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
  }
}
