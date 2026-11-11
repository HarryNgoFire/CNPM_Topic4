/**
 * Reusable MapLibre GL JS Engine for MoveFlow.
 */

export const DEFAULT_STYLE_URL = "/maps/styles/moveflow/style.json";

export const FALLBACK_RASTER_STYLE = {
  version: 8,
  sources: {
    "osm-de-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-de-tiles-layer",
      type: "raster",
      source: "osm-de-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const DEFAULT_STYLE = FALLBACK_RASTER_STYLE;

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function createMarkerElement(label, color) {
  if (typeof document === "undefined") {
    return { style: {}, querySelector: () => null };
  }
  const el = document.createElement("div");
  el.className = `moveflow-marker moveflow-marker-${label.toLowerCase()}`;
  el.style.width = "30px";
  el.style.height = "30px";
  el.style.borderRadius = "50%";
  el.style.backgroundColor = color;
  el.style.color = "#ffffff";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontWeight = "bold";
  el.style.fontSize = "14px";
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
  el.style.cursor = "grab";
  el.style.border = "2px solid #ffffff";
  el.innerText = label;
  return el;
}

function createDriverMarkerElement() {
  if (typeof document === "undefined") {
    return { style: {}, querySelector: () => null };
  }
  const el = document.createElement("div");
  el.className = "moveflow-marker moveflow-marker-driver";
  el.style.width = "40px";
  el.style.height = "40px";
  el.style.borderRadius = "50%";
  el.style.backgroundColor = "#2563eb";
  el.style.color = "#ffffff";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "20px";
  el.style.boxShadow = "0 3px 10px rgba(0,0,0,0.3)";
  el.style.border = "2.5px solid #ffffff";
  el.style.zIndex = "1000";
  el.style.cursor = "pointer";
  el.style.position = "relative";
  el.innerHTML = `
    <div class="driver-marker-icon">🛵</div>
    <div class="driver-heading-pointer"></div>
  `;
  return el;
}

export class MapEngine {
  constructor({
    container,
    styleUrl = null,
    initialCenter = [106.663, 10.754], // HCMC [lng, lat]
    initialZoom = 13,
    onDragPickup = null,
    onDragDropoff = null,
    onClick = null,
    topPadding = 0,
    bottomPadding = 0,
    leftPadding = 0,
    rightPadding = 0,
    isDriver = false,
    autoRecenterEnabled = null,
  }) {
    this.container =
      typeof container === "string"
        ? document.getElementById(container)
        : container;
    if (!this.container) {
      throw new Error("MapEngine: Container element not found");
    }

    const maplibregl =
      (typeof window !== "undefined" ? window.maplibregl : null) ||
      (typeof globalThis !== "undefined" ? globalThis.maplibregl : null);

    if (!maplibregl) {
      throw new Error("MapLibre GL JS library not found on page");
    }

    this.onDragPickup = onDragPickup;
    this.onDragDropoff = onDragDropoff;
    this.onClick = onClick;
    this.topPadding = topPadding;
    this.bottomPadding = bottomPadding;
    this.leftPadding = leftPadding;
    this.rightPadding = rightPadding;
    this.isDriver = Boolean(isDriver);
    this.pickup = null;
    this.dropoff = null;
    this.driverLocation = null;
    this.route = null;

    this.markerA = null;
    this.markerB = null;
    this.markerDriver = null;

    // Auto Recenter & Auto Follow chỉ áp dụng riêng cho tài xế (isDriver: true)
    this.autoRecenterEnabled = autoRecenterEnabled !== null ? Boolean(autoRecenterEnabled) : this.isDriver;
    this.autoFollow = this.isDriver;
    this.cameraMode = "follow"; // "follow" | "overview"
    this.autoRecenterTimeoutMs = 5000;
    this.targetNavigationZoom = 16.2;
    this._recenterTimer = null;
    this._isUserInteracting = false;
    this._onAutoFollowChange = null;
    this._onCameraModeChange = null;
    this._domInteractionCleanups = [];

    const style = styleUrl || (typeof window !== "undefined" && window.__MOVEFLOW_MAP_STYLE__) || DEFAULT_STYLE;

    this.map = new maplibregl.Map({
      container: this.container,
      style,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
      trackResize: true,
    });

    this._resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => {
        if (this.map && typeof this.map.resize === "function") {
          try { this.map.resize(); } catch {}
        }
      });
      this._resizeObserver.observe(this.container);
    }

    if (this.topPadding || this.bottomPadding || this.leftPadding || this.rightPadding) {
      try {
        this.map.setPadding({
          top: this.topPadding,
          bottom: this.bottomPadding,
          left: this.leftPadding,
          right: this.rightPadding,
        });
      } catch {}
    }

    this.map.on("click", (e) => {
      if (typeof this.onClick === "function") {
        this.onClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    this.map.addControl(new maplibregl.NavigationControl(), "top-right");

    this._initInteractionListeners();

    let fallbackAttempted = false;
    this._readyPromise = new Promise((resolve, reject) => {
      const onLoad = () => {
        try {
          this._initLayers();
          if (this.map && typeof this.map.resize === "function") {
            try { this.map.resize(); } catch {}
            setTimeout(() => { try { this.map?.resize(); } catch {} }, 60);
            setTimeout(() => { try { this.map?.resize(); } catch {} }, 250);
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      this.map.once("load", onLoad);
      this.map.on("error", (e) => {
        if (!this.map.loaded() && !fallbackAttempted) {
          fallbackAttempted = true;
          try {
            this.map.setStyle(FALLBACK_RASTER_STYLE);
            this.map.once("styledata", () => onLoad());
          } catch {
            reject(e.error || new Error("Failed to load map style"));
          }
        } else if (!this.map.loaded() && fallbackAttempted) {
          reject(e.error || new Error("Failed to load map style"));
        }
      });
    });
  }

  async ready() {
    return this._readyPromise;
  }

  _initLayers() {
    // Route layer
    if (!this.map.getSource("route")) {
      this.map.addSource("route", {
        type: "geojson",
        data: emptyFeatureCollection(),
      });

      this.map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#1e3a8a",
          "line-width": 8,
          "line-opacity": 0.4,
        },
      });

      this.map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });
    }

    // Endpoints source
    if (!this.map.getSource("endpoints")) {
      this.map.addSource("endpoints", {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
    }

    // Driver source
    if (!this.map.getSource("driver")) {
      this.map.addSource("driver", {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
    }
  }

  setEndpoints({ pickup, dropoff }) {
    this.pickup = pickup || null;
    this.dropoff = dropoff || null;

    const maplibregl =
      (typeof window !== "undefined" ? window.maplibregl : null) ||
      (typeof globalThis !== "undefined" ? globalThis.maplibregl : null);

    // Pickup marker A
    if (this.pickup && typeof this.pickup.lat === "number" && typeof this.pickup.lng === "number") {
      if (!this.markerA) {
        const el = createMarkerElement("A", "#10b981");
        this.markerA = new maplibregl.Marker({
          element: el,
          draggable: typeof this.onDragPickup === "function",
        })
          .setLngLat([this.pickup.lng, this.pickup.lat])
          .addTo(this.map);

        if (typeof this.onDragPickup === "function") {
          this.markerA.on("dragend", () => {
            const { lng, lat } = this.markerA.getLngLat();
            this.pickup = { lat, lng };
            this._updateEndpointsSource();
            this.onDragPickup({ lat, lng });
          });
        }
      } else {
        this.markerA.setLngLat([this.pickup.lng, this.pickup.lat]);
      }
    } else if (this.markerA) {
      this.markerA.remove();
      this.markerA = null;
    }

    // Dropoff marker B
    if (this.dropoff && typeof this.dropoff.lat === "number" && typeof this.dropoff.lng === "number") {
      if (!this.markerB) {
        const el = createMarkerElement("B", "#ef4444");
        this.markerB = new maplibregl.Marker({
          element: el,
          draggable: typeof this.onDragDropoff === "function",
        })
          .setLngLat([this.dropoff.lng, this.dropoff.lat])
          .addTo(this.map);

        if (typeof this.onDragDropoff === "function") {
          this.markerB.on("dragend", () => {
            const { lng, lat } = this.markerB.getLngLat();
            this.dropoff = { lat, lng };
            this._updateEndpointsSource();
            this.onDragDropoff({ lat, lng });
          });
        }
      } else {
        this.markerB.setLngLat([this.dropoff.lng, this.dropoff.lat]);
      }
    } else if (this.markerB) {
      this.markerB.remove();
      this.markerB = null;
    }

    this._updateEndpointsSource();
  }

  _updateEndpointsSource() {
    const source = this.map.getSource("endpoints");
    if (!source) return;

    const features = [];
    if (this.pickup) {
      features.push({
        type: "Feature",
        properties: { role: "pickup", label: "A" },
        geometry: {
          type: "Point",
          coordinates: [this.pickup.lng, this.pickup.lat],
        },
      });
    }
    if (this.dropoff) {
      features.push({
        type: "Feature",
        properties: { role: "dropoff", label: "B" },
        geometry: {
          type: "Point",
          coordinates: [this.dropoff.lng, this.dropoff.lat],
        },
      });
    }

    source.setData({
      type: "FeatureCollection",
      features,
    });
  }

  setDriverLocation(pointOrNull, panTo = false, bearing = null) {
    this.driverLocation = pointOrNull || null;
    const maplibregl =
      (typeof window !== "undefined" && window.maplibregl) ||
      (typeof globalThis !== "undefined" ? globalThis.maplibregl : null);

    if (
      maplibregl &&
      this.driverLocation &&
      typeof this.driverLocation.lat === "number" &&
      typeof this.driverLocation.lng === "number"
    ) {
      if (!this.markerDriver) {
        const el = createDriverMarkerElement();
        this.markerDriver = new maplibregl.Marker({ element: el })
          .setLngLat([this.driverLocation.lng, this.driverLocation.lat])
          .addTo(this.map);
      } else {
        this.markerDriver.setLngLat([
          this.driverLocation.lng,
          this.driverLocation.lat,
        ]);
      }

      if (typeof bearing === "number") {
        const markerEl = this.markerDriver.getElement ? this.markerDriver.getElement() : this.markerDriver._element;
        const iconEl = markerEl?.querySelector(".driver-marker-icon");
        const pointerEl = markerEl?.querySelector(".driver-heading-pointer");
        if (iconEl) {
          iconEl.style.transform = `rotate(${Math.round(bearing + 90)}deg)`;
        }
        if (pointerEl) {
          pointerEl.style.transform = `translate(-50%, -100%) rotate(${Math.round(bearing)}deg)`;
          pointerEl.style.opacity = "1";
        }
      }

      if (panTo && this.autoFollow && this.map && typeof this.map.easeTo === "function") {
        this.map.easeTo({
          center: [this.driverLocation.lng, this.driverLocation.lat],
          padding: {
            top: this.topPadding || 0,
            bottom: this.bottomPadding || 0,
            left: this.leftPadding || 0,
            right: this.rightPadding || 0,
          },
          duration: 120,
        });
      }
    } else if (this.markerDriver) {
      this.markerDriver.remove();
      this.markerDriver = null;
    }

    const source = this.map.getSource("driver");
    if (source) {
      source.setData(
        this.driverLocation
          ? {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: { role: "driver" },
                  geometry: {
                    type: "Point",
                    coordinates: [
                      this.driverLocation.lng,
                      this.driverLocation.lat,
                    ],
                  },
                },
              ],
            }
          : emptyFeatureCollection(),
      );
    }
  }

  setRoute(lineStringOrNull) {
    this.route = lineStringOrNull || null;
    const source = this.map.getSource("route");
    if (!source) return;

    if (
      this.route &&
      this.route.type === "LineString" &&
      Array.isArray(this.route.coordinates) &&
      this.route.coordinates.length > 0
    ) {
      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: this.route,
          },
        ],
      });
    } else {
      source.setData(emptyFeatureCollection());
    }
  }

  fitRelevantPoints({ padding = 50, animate = true, duration = 800 } = {}) {
    const maplibregl =
      (typeof window !== "undefined" ? window.maplibregl : null) ||
      (typeof globalThis !== "undefined" ? globalThis.maplibregl : null);
    if (!maplibregl) return;

    const bounds = new maplibregl.LngLatBounds();
    let pointCount = 0;

    if (this.pickup) {
      bounds.extend([this.pickup.lng, this.pickup.lat]);
      pointCount++;
    }
    if (this.dropoff) {
      bounds.extend([this.dropoff.lng, this.dropoff.lat]);
      pointCount++;
    }
    if (this.driverLocation) {
      bounds.extend([this.driverLocation.lng, this.driverLocation.lat]);
      pointCount++;
    }

    if (
      this.route &&
      this.route.type === "LineString" &&
      Array.isArray(this.route.coordinates)
    ) {
      for (const [lng, lat] of this.route.coordinates) {
        bounds.extend([lng, lat]);
        pointCount++;
      }
    }

    if (pointCount > 0) {
      const basePad = typeof padding === "number" ? padding : 40;
      const resolvedPadding = typeof padding === "object"
        ? padding
        : {
            top: basePad + (this.topPadding || 0),
            bottom: basePad + (this.bottomPadding || 0),
            left: basePad + (this.leftPadding || 0),
            right: basePad + (this.rightPadding || 0),
          };

      this.map.fitBounds(bounds, {
        padding: resolvedPadding,
        maxZoom: 16,
        duration: animate ? duration : 0,
      });
    }
  }

  setBottomPadding(bottom) {
    this.bottomPadding = bottom;
    if (this.map && typeof this.map.setPadding === "function") {
      try {
        this.map.setPadding({
          top: this.topPadding || 0,
          bottom: this.bottomPadding || 0,
          left: this.leftPadding || 0,
          right: this.rightPadding || 0,
        });
      } catch {}
    }
  }

  resize() {
    if (this.map) {
      this.map.resize();
    }
  }

  _initInteractionListeners() {
    if (!this.map || typeof this.map.on !== "function") return;

    const onStart = (e) => {
      // Bỏ qua nếu việc di chuyển bản đồ là do lệnh lập trình tự động kích hoạt (không có gesture người dùng)
      if (e && (e.type === "movestart" || e.type === "zoomstart") && !e.originalEvent) return;
      this._handleUserInteractionStart();
    };

    const onEnd = (e) => {
      if (e && (e.type === "moveend" || e.type === "zoomend") && !e.originalEvent && !this._isUserInteracting) return;
      this._handleUserInteractionEnd();
    };

    this.map.on("dragstart", onStart);
    this.map.on("dragend", onEnd);
    this.map.on("zoomstart", onStart);
    this.map.on("zoomend", onEnd);
    this.map.on("rotatestart", onStart);
    this.map.on("rotateend", onEnd);
    this.map.on("pitchstart", onStart);
    this.map.on("pitchend", onEnd);
    this.map.on("movestart", onStart);
    this.map.on("moveend", onEnd);

    if (this.container && typeof this.container.addEventListener === "function") {
      const handlePointerDown = () => this._handleUserInteractionStart();
      const handlePointerUp = () => this._handleUserInteractionEnd();
      const handleWheel = () => {
        this._handleUserInteractionStart();
        this._handleUserInteractionEnd();
      };

      this.container.addEventListener("pointerdown", handlePointerDown, { passive: true });
      this.container.addEventListener("pointerup", handlePointerUp, { passive: true });
      this.container.addEventListener("touchstart", handlePointerDown, { passive: true });
      this.container.addEventListener("touchend", handlePointerUp, { passive: true });
      this.container.addEventListener("mousedown", handlePointerDown, { passive: true });
      this.container.addEventListener("mouseup", handlePointerUp, { passive: true });
      this.container.addEventListener("wheel", handleWheel, { passive: true });

      this._domInteractionCleanups.push(() => {
        try {
          this.container.removeEventListener("pointerdown", handlePointerDown);
          this.container.removeEventListener("pointerup", handlePointerUp);
          this.container.removeEventListener("touchstart", handlePointerDown);
          this.container.removeEventListener("touchend", handlePointerUp);
          this.container.removeEventListener("mousedown", handlePointerDown);
          this.container.removeEventListener("mouseup", handlePointerUp);
          this.container.removeEventListener("wheel", handleWheel);
        } catch {}
      });
    }
  }

  _handleUserInteractionStart() {
    this._isUserInteracting = true;
    this.pauseAutoFollow();
    if (typeof this._onCameraModeChange === "function") {
      try { this._onCameraModeChange("panned"); } catch {}
    }
  }

  _handleUserInteractionEnd() {
    this._isUserInteracting = false;
    this._scheduleAutoRecenter();
  }

  pauseAutoFollow() {
    this._clearRecenterTimer();
    if (this.autoFollow) {
      this.autoFollow = false;
      if (typeof this._onAutoFollowChange === "function") {
        try { this._onAutoFollowChange(false); } catch {}
      }
    }
  }

  _scheduleAutoRecenter() {
    this._clearRecenterTimer();
    if (!this.isAutoRecenterConfigured()) return;
    if (this.autoFollow) return;
    if (this.cameraMode === "overview") return; // Khi tài xế chủ động xem toàn tuyến, không tự kéo về xe
    if (!this.driverLocation) return;

    this._recenterTimer = setTimeout(() => {
      this._recenterTimer = null;
      if (!this.isAutoRecenterConfigured()) return;
      if (this._isUserInteracting) return;
      this.recenterOnDriver({ smooth: true });
    }, this.autoRecenterTimeoutMs);
  }

  _clearRecenterTimer() {
    if (this._recenterTimer) {
      clearTimeout(this._recenterTimer);
      this._recenterTimer = null;
    }
  }

  isAutoRecenterConfigured() {
    if (!this.isDriver && !this.autoRecenterEnabled) return false;
    if (this.autoRecenterEnabled === false) return false;
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem("moveflow_auto_recenter_enabled") !== "0";
      }
    } catch {}
    return true;
  }

  showRouteOverview({ smooth = true, duration = 800 } = {}) {
    this._clearRecenterTimer();
    this.autoFollow = false;
    this.cameraMode = "overview";

    this.fitRelevantPoints(50, smooth, duration);

    if (typeof this._onCameraModeChange === "function") {
      try { this._onCameraModeChange("overview"); } catch {}
    }
    if (typeof this._onAutoFollowChange === "function") {
      try { this._onAutoFollowChange(false); } catch {}
    }
  }

  toggleCameraMode() {
    // Nếu đang bám sát xe -> chuyển sang xem toàn tuyến lộ trình
    // Nếu đang xem toàn tuyến hoặc đã vuốt lệch -> quay lại bám sát xe
    if (this.cameraMode === "follow" && this.autoFollow) {
      this.showRouteOverview({ smooth: true });
      return "overview";
    } else {
      this.recenterOnDriver({ smooth: true });
      return "follow";
    }
  }

  recenterOnDriver({ smooth = true, duration = 1000, zoom = null } = {}) {
    this._clearRecenterTimer();
    if (
      !this.driverLocation ||
      typeof this.driverLocation.lat !== "number" ||
      typeof this.driverLocation.lng !== "number"
    ) {
      return;
    }
    if (!this.map) return;

    let targetZoom = zoom;
    if (typeof targetZoom !== "number") {
      const curZoom = typeof this.map.getZoom === "function" ? this.map.getZoom() : 16;
      if (curZoom < 14 || curZoom > 18) {
        targetZoom = this.targetNavigationZoom || 16.2;
      } else {
        targetZoom = Math.min(17.2, Math.max(15.2, curZoom));
      }
    }

    const padding = {
      top: this.topPadding || 0,
      bottom: this.bottomPadding || 0,
      left: this.leftPadding || 0,
      right: this.rightPadding || 0,
    };

    if (smooth && typeof this.map.flyTo === "function") {
      this.map.flyTo({
        center: [this.driverLocation.lng, this.driverLocation.lat],
        zoom: targetZoom,
        padding,
        duration,
        essential: true,
      });
    } else if (typeof this.map.easeTo === "function") {
      this.map.easeTo({
        center: [this.driverLocation.lng, this.driverLocation.lat],
        zoom: targetZoom,
        padding,
        duration,
      });
    } else if (typeof this.map.setCenter === "function") {
      this.map.setCenter([this.driverLocation.lng, this.driverLocation.lat]);
      if (typeof this.map.setZoom === "function") {
        this.map.setZoom(targetZoom);
      }
    }

    this.autoFollow = true;
    this.cameraMode = "follow";
    if (typeof this._onCameraModeChange === "function") {
      try { this._onCameraModeChange("follow"); } catch {}
    }
    if (typeof this._onAutoFollowChange === "function") {
      try { this._onAutoFollowChange(true); } catch {}
    }
  }

  destroy() {
    this._clearRecenterTimer();
    if (this._domInteractionCleanups) {
      this._domInteractionCleanups.forEach(fn => { try { fn(); } catch {} });
      this._domInteractionCleanups = [];
    }
    if (this._resizeObserver) {
      try { this._resizeObserver.disconnect(); } catch {}
      this._resizeObserver = null;
    }
    if (this.markerA) {
      this.markerA.remove();
      this.markerA = null;
    }
    if (this.markerB) {
      this.markerB.remove();
      this.markerB = null;
    }
    if (this.markerDriver) {
      this.markerDriver.remove();
      this.markerDriver = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
