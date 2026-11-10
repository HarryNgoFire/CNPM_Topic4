/**
 * Sender Map Controller: Coordinates A/B map selection, geocoding search,
 * draggable markers, and live OSRM route & fee quoting.
 */

import { MapEngine } from "./map-engine.js";
import { AbortableRequest, GeocodingClient } from "./api-clients.js";
import { getCurrentPositionOnce } from "./geolocation.js";

export class SenderMapController {
  constructor({
    mapElement,
    form,
    api,
    onQuoteChanged = null,
    geocoding = null,
    tokenGetter = () => null,
    geolocation = null,
    MapEngineClass = MapEngine,
  }) {
    this.mapElement = mapElement;
    this.form = form;
    this.api = api;
    this.onQuoteChanged = onQuoteChanged;
    this.MapEngineClass = MapEngineClass;

    this.geocoding =
      geocoding ||
      new GeocodingClient("/api/v1", tokenGetter);

    this.geolocation = geolocation || { getCurrentPositionOnce };
    this.quoteGeneration = 0;
    this.quoteReq = new AbortableRequest();
    this.engine = null;
    this._inputHandler = null;
    this.activePinTarget = "pickup";
    this.onActivePinChanged = null;
  }

  async mount() {
    this.engine = new this.MapEngineClass({
      container: this.mapElement,
      onDragPickup: (coords) => this.onDragMarker("pickup", coords),
      onDragDropoff: (coords) => this.onDragMarker("dropoff", coords),
      onClick: (coords) => this.handleMapClick(coords),
    });

    await this.engine.ready();

    if (this.engine?.map?.getCanvas) {
      try {
        const canvas = this.engine.map.getCanvas();
        if (canvas && canvas.style) {
          canvas.style.cursor = "crosshair";
        }
      } catch {}
    }

    // Initialize markers from form inputs if coordinates exist
    const pLat = this.getNumericInput("pickupLat");
    const pLng = this.getNumericInput("pickupLng");
    const dLat = this.getNumericInput("dropoffLat");
    const dLng = this.getNumericInput("dropoffLng");

    const pickup = pLat != null && pLng != null ? { lat: pLat, lng: pLng } : null;
    const dropoff = dLat != null && dLng != null ? { lat: dLat, lng: dLng } : null;

    this.engine.setEndpoints({ pickup, dropoff });
    if (pickup || dropoff) {
      this.engine.fitRelevantPoints();
      if (pickup && dropoff) {
        this.recalculateRouteAndQuote();
      }
    }

    // Bind form text input listener to invalidate coordinates when text is edited
    if (this.form && typeof this.form.addEventListener === "function") {
      this._inputHandler = (e) => {
        const name = e.target?.name;
        if (name) this.handleFieldInput(name);
      };
      this.form.addEventListener("input", this._inputHandler);
    }
  }

  getNumericInput(name) {
    const input = this.form?.querySelector?.(`[name="${name}"]`);
    if (!input || !input.value) return null;
    const val = Number(input.value);
    return Number.isFinite(val) ? val : null;
  }

  setInput(name, val) {
    const input = this.form?.querySelector?.(`[name="${name}"]`);
    if (input) {
      input.value = val != null ? String(val) : "";
    }
  }

  handleFieldInput(fieldName) {
    const match = fieldName.match(/^(pickup|dropoff)(Line|Ward|District|City)$/);
    if (!match) return;

    const prefix = match[1];
    this.quoteGeneration += 1;
    this.quoteReq.abort();
    // Invalidate coordinates only when the corresponding address fields change
    this.setInput(`${prefix}Lat`, "");
    this.setInput(`${prefix}Lng`, "");

    // Clear route and update markers
    this.updateMapEndpoints();
    if (this.engine) {
      this.engine.setRoute(null);
    }
    if (this.onQuoteChanged) {
      this.onQuoteChanged(null);
    }
  }

  updateMapEndpoints() {
    if (!this.engine) return;
    const pLat = this.getNumericInput("pickupLat");
    const pLng = this.getNumericInput("pickupLng");
    const dLat = this.getNumericInput("dropoffLat");
    const dLng = this.getNumericInput("dropoffLng");

    const pickup = pLat != null && pLng != null ? { lat: pLat, lng: pLng } : null;
    const dropoff = dLat != null && dLng != null ? { lat: dLat, lng: dLng } : null;

    this.engine.setEndpoints({ pickup, dropoff });
  }

  async onDragMarker(prefix, { lat, lng }) {
    this.setInput(`${prefix}Lat`, lat);
    this.setInput(`${prefix}Lng`, lng);

    try {
      const geo = await this.geocoding.reverse(lat, lng);
      if (geo && geo.address) {
        if (geo.address.line) this.setInput(`${prefix}Line`, geo.address.line);
        if (geo.address.ward) this.setInput(`${prefix}Ward`, geo.address.ward);
        if (geo.address.district) this.setInput(`${prefix}District`, geo.address.district);
        if (geo.address.city) this.setInput(`${prefix}City`, geo.address.city);
      }
    } catch {
      // reverse geocoding error: retain coordinates, do not clear form
    }

    this.updateMapEndpoints();
    await this.recalculateRouteAndQuote();
  }

  setActivePinTarget(target) {
    if (target === "pickup" || target === "dropoff") {
      this.activePinTarget = target;
      if (typeof this.onActivePinChanged === "function") {
        this.onActivePinChanged(target);
      }
    }
  }

  async handleMapClick({ lat, lng }) {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const pLat = this.getNumericInput("pickupLat");
    const dLat = this.getNumericInput("dropoffLat");

    let target = this.activePinTarget;
    if (!target) {
      target = pLat == null ? "pickup" : (dLat == null ? "dropoff" : "dropoff");
    }

    await this.onDragMarker(target, { lat, lng });

    // If pickup was placed and dropoff has no coordinates yet, auto-advance target to dropoff
    if (target === "pickup" && this.getNumericInput("dropoffLat") == null) {
      this.setActivePinTarget("dropoff");
    }
  }

  selectSearchResult(prefix, geocodedItem) {
    if (!geocodedItem) return;
    this.setInput(`${prefix}Lat`, geocodedItem.lat);
    this.setInput(`${prefix}Lng`, geocodedItem.lng);

    const addr = geocodedItem.address || {};
    if (addr.line) this.setInput(`${prefix}Line`, addr.line);
    if (addr.ward) this.setInput(`${prefix}Ward`, addr.ward);
    if (addr.district) this.setInput(`${prefix}District`, addr.district);
    if (addr.city) this.setInput(`${prefix}City`, addr.city);

    this.updateMapEndpoints();
    if (this.engine) {
      this.engine.fitRelevantPoints();
    }
    this.recalculateRouteAndQuote();
  }

  async fillPickupWithGps() {
    const pos = await this.geolocation.getCurrentPositionOnce();
    const { lat, lng } = pos;

    this.setInput("pickupLat", lat);
    this.setInput("pickupLng", lng);

    try {
      const geo = await this.geocoding.reverse(lat, lng);
      if (geo && geo.address) {
        if (geo.address.line) this.setInput("pickupLine", geo.address.line);
        if (geo.address.ward) this.setInput("pickupWard", geo.address.ward);
        if (geo.address.district) this.setInput("pickupDistrict", geo.address.district);
        if (geo.address.city) this.setInput("pickupCity", geo.address.city);
      }
    } catch {
      // retain coordinates
    }

    this.updateMapEndpoints();
    if (this.engine) {
      this.engine.fitRelevantPoints();
    }
    await this.recalculateRouteAndQuote();
  }

  async recalculateRouteAndQuote() {
    this.quoteReq.abort();
    const quoteGeneration = ++this.quoteGeneration;
    const pLat = this.getNumericInput("pickupLat");
    const pLng = this.getNumericInput("pickupLng");
    const dLat = this.getNumericInput("dropoffLat");
    const dLng = this.getNumericInput("dropoffLng");

    if (pLat == null || pLng == null || dLat == null || dLng == null) {
      if (this.engine) this.engine.setRoute(null);
      if (this.onQuoteChanged) this.onQuoteChanged(null);
      return;
    }

    try {
      const payload = this.getBookingPayload();
      const quote = await this.api.post("/pricing/quote", payload);
      if (quoteGeneration !== this.quoteGeneration) return;

      if (this.engine && quote.geometry) {
        this.engine.setRoute(quote.geometry);
        this.engine.fitRelevantPoints();
      }

      if (this.onQuoteChanged) {
        this.onQuoteChanged(quote);
      }
    } catch {
      // In flight abort or network error: do not overwrite newer route
    }
  }

  getBookingPayload() {
    const text = (name) => {
      const el = this.form?.querySelector?.(`[name="${name}"]`);
      return String(el?.value || "").trim();
    };

    const num = (name) => {
      const el = this.form?.querySelector?.(`[name="${name}"]`);
      return Number(el?.value || 0);
    };

    const pLat = this.getNumericInput("pickupLat");
    const pLng = this.getNumericInput("pickupLng");
    const dLat = this.getNumericInput("dropoffLat");
    const dLng = this.getNumericInput("dropoffLng");

    if (pLat == null || pLng == null) {
      throw new Error("Chưa chọn vị trí hợp lệ trên bản đồ cho điểm lấy hàng.");
    }
    if (dLat == null || dLng == null) {
      throw new Error("Chưa chọn vị trí hợp lệ trên bản đồ cho điểm giao hàng.");
    }

    return {
      pickupAddress: {
        line: text("pickupLine"),
        ward: text("pickupWard"),
        district: text("pickupDistrict"),
        city: text("pickupCity") || "Thành phố Hồ Chí Minh",
        lat: pLat,
        lng: pLng,
      },
      dropoffAddress: {
        line: text("dropoffLine"),
        ward: text("dropoffWard"),
        district: text("dropoffDistrict"),
        city: text("dropoffCity") || "Thành phố Hồ Chí Minh",
        lat: dLat,
        lng: dLng,
      },
      parcel: {
        weightKg: num("weightKg") || 1,
        lengthCm: num("lengthCm") || 20,
        widthCm: num("widthCm") || 15,
        heightCm: num("heightCm") || 10,
      },
      serviceType: text("serviceType") || "STANDARD",
    };
  }

  updateLiveDriver(driverPoint) {
    if (this.engine) {
      this.engine.setDriverLocation(driverPoint);
      this.engine.fitRelevantPoints();
    }
  }

  destroy() {
    this.quoteGeneration += 1;
    if (this.geocoding?.abort) {
      this.geocoding.abort();
    }
    if (this.form && this._inputHandler) {
      this.form.removeEventListener("input", this._inputHandler);
      this._inputHandler = null;
    }
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
  }
}
