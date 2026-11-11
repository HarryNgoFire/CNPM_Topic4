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
    this.currentLocation = this.loadSavedMockLocation();

    this.lastUploadedGps = null;
    this.lastUploadTime = 0;
    this.pendingUpload = null;
    this.firstOffRouteTime = null;
    this._visibilityHandler = null;
    this.isMockActive = false;
    this._lastMockSave = 0;
  }

  getMockStorageKey() {
    return `moveflow_mock_loc_${this.shipmentId || "default"}`;
  }

  loadSavedMockLocation() {
    if (!this.isMockMode()) return null;
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(this.getMockStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
        return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
      }
    } catch {}
    return null;
  }

  saveMockLocation(point, immediate = false) {
    if (!this.isMockMode()) return;
    const now = Date.now();
    if (!immediate && this._lastMockSave && now - this._lastMockSave < 800) return;
    this._lastMockSave = now;
    try {
      if (typeof localStorage === "undefined") return;
      if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        localStorage.setItem(this.getMockStorageKey(), JSON.stringify({ lat: point.lat, lng: point.lng }));
      }
    } catch {}
  }

  clearSavedMockLocation() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(this.getMockStorageKey());
      }
    } catch {}
  }

  async mount() {
    this.engine = new this.MapEngineClass({
      container: this.mapElement,
      bottomPadding: 80,
      topPadding: 75,
    });
    await this.engine.ready();

    if (this.engine) {
      this.engine._onAutoFollowChange = (active) => {
        if (typeof document !== "undefined") {
          const btn = document.getElementById("btn-driver-recenter");
          if (btn) {
            btn.classList.toggle("following", Boolean(active));
          }
        }
        if (this.onStateChanged) {
          try {
            this.onStateChanged({ type: "AUTO_FOLLOW_CHANGED", autoFollow: Boolean(active) });
          } catch {}
        }
      };
    }

    if (this.engine?.map) {
      setTimeout(() => {
        try { this.engine.map.resize(); } catch {}
      }, 60);
      setTimeout(() => {
        try { this.engine.map.resize(); } catch {}
      }, 300);
    }

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

  setBottomPadding(bottom) {
    if (this.engine && typeof this.engine.setBottomPadding === "function") {
      this.engine.setBottomPadding(bottom);
      if (this.currentLocation) {
        this.engine.setDriverLocation(this.currentLocation, true);
      }
    }
  }

  isMockMode() {
    if (this.isMockActive) return true;
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem("moveflow_mock_gps_enabled") === "1";
    } catch {
      return false;
    }
  }

  setMockMode(enabled) {
    this.isMockActive = Boolean(enabled);
    if (this.isMockActive) {
      this.stopTracking();
    } else if (this.phase !== "COMPLETE") {
      this.startTracking();
    }
  }

  startTracking() {
    if (this.isMockMode()) return;
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
      // Khi đang giả lập (mock), vị trí cục bộ là nguồn chuẩn để hiển thị:
      // không để vị trí cũ trên server kéo marker xe ngược lại.
      if (nav.currentLocation && !(this.isMockMode() && this.currentLocation)) {
        this.currentLocation = nav.currentLocation;
      }
      if (this.isMockMode() && this.currentLocation && this.destination) {
        const dist = haversineMeters(this.currentLocation, this.destination);
        const eligible = dist <= GPS_THROTTLE.ARRIVAL_RADIUS_M;
        this.arrival = { eligible, distanceM: dist };

        // Nếu server trả về tuyến đường tính từ vị trí cũ trong DB (cách xa vị trí mock hiện tại > 80m),
        // tự động lấy lộ trình OSRM thực tế từ đúng vị trí mock của xe tới đích.
        const firstCoord = this.route?.geometry?.coordinates?.[0];
        const routeStart = Array.isArray(firstCoord)
          ? { lng: Number(firstCoord[0]), lat: Number(firstCoord[1]) }
          : null;
        if (
          typeof window !== "undefined" &&
          window.MoveFlowDemo?.fetchMockOsrmRoute &&
          (!routeStart || haversineMeters(this.currentLocation, routeStart) > 80)
        ) {
          try {
            const customGeo = await window.MoveFlowDemo.fetchMockOsrmRoute(
              this.currentLocation,
              this.destination,
            );
            if (customGeo) {
              this.route = { ...(this.route || {}), geometry: customGeo };
            }
          } catch {
            // keep existing route fallback
          }
        }
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
          currentLocation: this.currentLocation,
        });
      }
    } catch (err) {
      if (this.onStateChanged) {
        this.onStateChanged({ type: "NAV_ERROR", error: err });
      }
    }
  }

  /**
   * Cắt ngắn phần đường màu xanh (polyline) phía sau lưng tài xế
   * để vạch chỉ đường luôn bắt đầu từ mũi xe hiện tại tới điểm đích.
   */
  getTrimmedRouteGeometry(point = this.currentLocation) {
    const geom = this.route?.geometry;
    if (!geom || geom.type !== "LineString" || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      return geom || null;
    }
    if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") {
      return geom;
    }

    const coords = geom.coordinates;
    // Nếu điểm đầu tiên đã trùng với vị trí tài xế (< 3m) thì giữ nguyên
    const firstPt = { lng: Number(coords[0][0]), lat: Number(coords[0][1]) };
    if (haversineMeters(point, firstPt) < 3) {
      return geom;
    }

    // Tìm đoạn thẳng (segment) gần vị trí tài xế nhất trên tuyến đường
    let bestSegIdx = 0;
    let bestDistSq = Infinity;
    let bestProj = [point.lng, point.lat];

    for (let i = 0; i < coords.length - 1; i++) {
      const ax = Number(coords[i][0]);
      const ay = Number(coords[i][1]);
      const bx = Number(coords[i + 1][0]);
      const by = Number(coords[i + 1][1]);
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0) {
        t = ((point.lng - ax) * dx + (point.lat - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const px = ax + t * dx;
      const py = ay + t * dy;
      const dSq = (point.lng - px) ** 2 + (point.lat - py) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestSegIdx = i;
        bestProj = [px, py];
      }
    }

    const remaining = [[point.lng, point.lat], ...coords.slice(bestSegIdx + 1)];
    if (remaining.length < 2) {
      const last = coords[coords.length - 1];
      return {
        type: "LineString",
        coordinates: [[point.lng, point.lat], last],
      };
    }
    // Nếu điểm kế tiếp quá sát vị trí xe (< 2m) và vẫn còn điểm sau đó thì bỏ điểm trùng
    if (remaining.length > 2) {
      const nextPt = { lng: Number(remaining[1][0]), lat: Number(remaining[1][1]) };
      if (haversineMeters(point, nextPt) < 2) {
        remaining.splice(1, 1);
      }
    }
    return {
      type: "LineString",
      coordinates: remaining,
    };
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

    // Route (cắt phần đã đi qua phía sau xe)
    this.engine.setRoute(this.getTrimmedRouteGeometry());

    // Driver location
    if (this.currentLocation) {
      this.engine.setDriverLocation(this.currentLocation);
    }

    this.engine.fitRelevantPoints();
  }

  setMockLocation(point, panTo = false, bearing = null) {
    this.isMockActive = true;
    this.stopTracking();
    if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") return;
    this.currentLocation = point;
    this.saveMockLocation(point);
    if (this.engine) {
      this.engine.setDriverLocation(point, panTo, bearing);
      if (this.route?.geometry) {
        this.engine.setRoute(this.getTrimmedRouteGeometry(point));
      }
    }
    if (this.destination) {
      const dist = haversineMeters(point, this.destination);
      const eligible = dist <= GPS_THROTTLE.ARRIVAL_RADIUS_M;
      this.arrival = { eligible, distanceM: dist };
    }
    if (this.onStateChanged) {
      this.onStateChanged({
        type: "GPS_ACCEPTED",
        arrival: this.arrival,
        currentLocation: point,
        phase: this.phase,
        shipmentStatus: this.shipmentStatus,
      });
    }
  }

  handleDeviceGps(point, now = Date.now()) {
    if (this.isMockMode()) return;
    if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") return;

    this.currentLocation = point;
    if (this.engine) {
      this.engine.setDriverLocation(point);
      if (this.route?.geometry) {
        this.engine.setRoute(this.getTrimmedRouteGeometry(point));
      }
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
    try {
      await this.api.post(`/shipments/${this.shipmentId}/transition`, {
        toStatus: nextStatus,
      });
    } catch (err) {
      if (
        this.isMockMode() &&
        this.arrival?.eligible &&
        typeof window !== "undefined" &&
        window.MoveFlowDemo?.transitionWithInstantFallback
      ) {
        await window.MoveFlowDemo.transitionWithInstantFallback(
          this.shipmentId,
          nextStatus,
        );
      } else {
        throw err;
      }
    }
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
    this.clearSavedMockLocation();
    await this.refreshNavigation();
  }

  async reportDeliveryFailure(reason) {
    await this.api.post(`/shipments/${this.shipmentId}/transition`, {
      toStatus: "DELIVERY_FAILED",
      reason: String(reason || "").trim(),
    });
    this.clearSavedMockLocation();
    await this.refreshNavigation();
  }

  async cancelTrip(reason) {
    const cleanReason = String(reason || "Tài xế báo bận / sự cố phương tiện").trim();
    if (typeof window !== "undefined" && window.MoveFlowDemo?.transitionWithInstantFallback) {
      await window.MoveFlowDemo.transitionWithInstantFallback(
        this.shipmentId,
        "CANCELLED",
        cleanReason,
      );
    } else {
      await this.api.post(`/shipments/${this.shipmentId}/transition`, {
        toStatus: "CANCELLED",
        reason: cleanReason,
      });
    }
    this.clearSavedMockLocation();
    this.stopTracking();
  }

  recenter(opts = {}) {
    if (this.engine && typeof this.engine.recenterOnDriver === "function") {
      this.engine.recenterOnDriver(opts);
    }
  }

  isAutoFollowActive() {
    return Boolean(this.engine?.autoFollow);
  }

  isAutoRecenterEnabled() {
    if (this.engine && typeof this.engine.isAutoRecenterConfigured === "function") {
      return this.engine.isAutoRecenterConfigured();
    }
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem("moveflow_auto_recenter_enabled") !== "0";
      }
    } catch {}
    return true;
  }

  setAutoRecenterEnabled(enabled) {
    if (this.engine) {
      this.engine.autoRecenterEnabled = Boolean(enabled);
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("moveflow_auto_recenter_enabled", enabled ? "1" : "0");
      }
    } catch {}
  }

  destroy() {
    this.stopTracking();
    if (typeof window !== "undefined" && window.MoveFlowDemo?.stopMovementSimulation) {
      window.MoveFlowDemo.stopMovementSimulation();
    }
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
