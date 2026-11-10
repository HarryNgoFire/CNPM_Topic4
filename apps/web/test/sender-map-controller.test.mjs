import test from "node:test";
import assert from "node:assert/strict";
import { SenderMapController } from "../map/sender-map-controller.js";

// Minimal DOM and MapEngine mocks for Node.js unit tests
function createMockElement(tag = "div") {
  const el = {
    tagName: tag.toUpperCase(),
    value: "",
    innerText: "",
    innerHTML: "",
    children: [],
    listeners: {},
    dataset: {},
    addEventListener(evt, fn) {
      this.listeners[evt] = this.listeners[evt] || [];
      this.listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (this.listeners[evt]) {
        this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
      }
    },
    dispatchEvent(evt) {
      const fns = this.listeners[evt.type] || [];
      for (const fn of fns) fn(evt);
    },
    querySelector(sel) {
      return this.children.find(c => c.matches?.(sel)) || null;
    },
    querySelectorAll(sel) {
      return this.children.filter(c => c.matches?.(sel));
    },
  };
  return el;
}

function createMockForm() {
  const fields = {
    pickupLine: "12 Nguyen Trai",
    pickupWard: "Phuong 1",
    pickupDistrict: "Quan 5",
    pickupCity: "TP Ho Chi Minh",
    pickupLat: "10.754",
    pickupLng: "106.663",
    dropoffLine: "88 Le Loi",
    dropoffWard: "Phuong Ben Thanh",
    dropoffDistrict: "Quan 1",
    dropoffCity: "TP Ho Chi Minh",
    dropoffLat: "10.772",
    dropoffLng: "106.698",
    weightKg: "1.5",
    lengthCm: "20",
    widthCm: "15",
    heightCm: "10",
    serviceType: "STANDARD",
  };

  const inputs = {};
  for (const [name, val] of Object.entries(fields)) {
    inputs[name] = {
      name,
      value: val,
      matches(sel) {
        return sel === `[name="${name}"]` || sel === `input[name="${name}"]`;
      },
    };
  }

  const form = {
    listeners: {},
    addEventListener(evt, fn) {
      this.listeners[evt] = this.listeners[evt] || [];
      this.listeners[evt].push(fn);
    },
    querySelector(sel) {
      for (const input of Object.values(inputs)) {
        if (input.matches(sel)) return input;
      }
      return null;
    },
    inputs,
  };
  return form;
}

test("SenderMapController - default geocoding client uses the in-memory access token", async () => {
  const originalFetch = globalThis.fetch;
  let authorization;
  globalThis.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    return { ok: true, json: async () => [] };
  };

  try {
    const controller = new SenderMapController({
      mapElement: {},
      form: createMockForm(),
      api: { post: async () => ({}) },
      tokenGetter: () => "access-token",
    });

    await controller.geocoding.search("Nguyen Trai", 5);
    assert.equal(authorization, "Bearer access-token");
    controller.destroy();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SenderMapController - getBookingPayload extracts valid booking data", () => {
  const form = createMockForm();
  const controller = new SenderMapController({
    mapElement: createMockElement(),
    form,
    api: { post: async () => ({}) },
    MapEngineClass: class MockEngine {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      fitRelevantPoints() {}
      destroy() {}
    },
  });

  const payload = controller.getBookingPayload();
  assert.equal(payload.pickupAddress.line, "12 Nguyen Trai");
  assert.equal(payload.pickupAddress.lat, 10.754);
  assert.equal(payload.pickupAddress.lng, 106.663);
  assert.equal(payload.dropoffAddress.lat, 10.772);
  assert.equal(payload.dropoffAddress.lng, 106.698);
  assert.equal(payload.parcel.weightKg, 1.5);
  assert.equal(payload.serviceType, "STANDARD");
});

test("SenderMapController - coordinate preservation when text unchanged & invalidation on manual edit", () => {
  const form = createMockForm();
  const controller = new SenderMapController({
    mapElement: createMockElement(),
    form,
    api: { post: async () => ({}) },
    MapEngineClass: class MockEngine {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      destroy() {}
    },
  });

  // Unchanged form keeps coordinates
  assert.equal(form.inputs.pickupLat.value, "10.754");
  assert.equal(form.inputs.pickupLng.value, "106.663");

  // Invalidate when pickupLine is edited
  controller.handleFieldInput("pickupLine");
  assert.equal(form.inputs.pickupLat.value, "");
  assert.equal(form.inputs.pickupLng.value, "");

  // Dropoff coordinates remain preserved
  assert.equal(form.inputs.dropoffLat.value, "10.772");
  assert.equal(form.inputs.dropoffLng.value, "106.698");

  // Invalidate dropoff when dropoffCity is edited
  controller.handleFieldInput("dropoffCity");
  assert.equal(form.inputs.dropoffLat.value, "");
  assert.equal(form.inputs.dropoffLng.value, "");
});

test("SenderMapController - updates address and route after marker drag", async () => {
  const form = createMockForm();
  let latestRoute = null;
  let quoteReceived = null;

  const mockApi = {
    post: async (path, body) => {
      assert.equal(path, "/pricing/quote");
      return {
        fee: 35000,
        distanceKm: 4.8,
        durationSeconds: 540,
        geometry: {
          type: "LineString",
          coordinates: [[106.663, 10.754], [106.698, 10.772]],
        },
      };
    },
  };

  const mockGeocoding = {
    reverse: async (lat, lng) => ({
      label: "456 Tran Hung Dao",
      address: {
        line: "456 Tran Hung Dao",
        ward: "Phuong 2",
        district: "Quan 5",
        city: "TP Ho Chi Minh",
      },
      lat,
      lng,
    }),
  };

  const controller = new SenderMapController({
    mapElement: createMockElement(),
    form,
    api: mockApi,
    geocoding: mockGeocoding,
    onQuoteChanged: (q) => { quoteReceived = q; },
    MapEngineClass: class MockEngine {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute(r) { latestRoute = r; }
      fitRelevantPoints() {}
      destroy() {}
    },
  });

  await controller.mount();

  // Simulate dragging marker A
  await controller.onDragMarker("pickup", { lat: 10.758, lng: 106.669 });

  assert.equal(form.inputs.pickupLine.value, "456 Tran Hung Dao");
  assert.equal(form.inputs.pickupLat.value, "10.758");
  assert.equal(form.inputs.pickupLng.value, "106.669");

  assert.ok(latestRoute);
  assert.equal(quoteReceived.fee, 35000);
  assert.equal(quoteReceived.distanceKm, 4.8);
});

test("SenderMapController - ignores an older quote that resolves after a newer quote", async () => {
  const form = createMockForm();
  const pending = [];
  const routes = [];
  const quotes = [];
  const controller = new SenderMapController({
    mapElement: {},
    form,
    api: {
      post: () => new Promise((resolve) => pending.push(resolve)),
    },
    onQuoteChanged: (quote) => quotes.push(quote),
  });
  controller.engine = {
    setRoute: (route) => routes.push(route),
    fitRelevantPoints() {},
  };

  const older = controller.recalculateRouteAndQuote();
  const newer = controller.recalculateRouteAndQuote();
  pending[1]({ fee: 42000, geometry: { type: "LineString", coordinates: [[2, 2]] } });
  await newer;
  pending[0]({ fee: 31000, geometry: { type: "LineString", coordinates: [[1, 1]] } });
  await older;

  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].fee, 42000);
  assert.deepEqual(routes, [{ type: "LineString", coordinates: [[2, 2]] }]);
});

test("SenderMapController - GPS auto-fills pickup A and handles denial gracefully", async () => {
  const form = createMockForm();
  form.inputs.pickupLine.value = "";
  form.inputs.pickupLat.value = "";
  form.inputs.pickupLng.value = "";

  const mockGeocoding = {
    reverse: async (lat, lng) => ({
      label: "GPS Street 1",
      address: {
        line: "100 GPS Road",
        ward: "Ward X",
        district: "District Y",
        city: "TP Ho Chi Minh",
      },
      lat,
      lng,
    }),
  };

  const controller = new SenderMapController({
    mapElement: createMockElement(),
    form,
    api: { post: async () => ({ fee: 20000, distanceKm: 2, durationSeconds: 200, geometry: { type: "LineString", coordinates: [] } }) },
    geocoding: mockGeocoding,
    geolocation: {
      getCurrentPositionOnce: async () => ({
        lat: 10.76,
        lng: 106.68,
      }),
    },
    MapEngineClass: class MockEngine {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      fitRelevantPoints() {}
      destroy() {}
    },
  });

  await controller.mount();

  // 1. Success GPS
  await controller.fillPickupWithGps();
  assert.equal(form.inputs.pickupLine.value, "100 GPS Road");
  assert.equal(form.inputs.pickupLat.value, "10.76");
  assert.equal(form.inputs.pickupLng.value, "106.68");

  // 2. Denied GPS
  controller.geolocation = {
    getCurrentPositionOnce: async () => {
      throw new Error("Quyền truy cập vị trí bị từ chối");
    },
  };

  let caughtErr = null;
  try {
    await controller.fillPickupWithGps();
  } catch (err) {
    caughtErr = err;
  }
  assert.ok(caughtErr);
  assert.match(caughtErr.message, /bị từ chối/);
});

test("SenderMapController - updateLiveDriver sets location on MapEngine", async () => {
  const form = createMockForm();
  let updatedDriver = null;
  let fitCalled = false;

  const controller = new SenderMapController({
    mapElement: {},
    form,
    api: { post: async () => ({}) },
    MapEngineClass: class MockEngine {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      setDriverLocation(pos) { updatedDriver = pos; }
      fitRelevantPoints() { fitCalled = true; }
      destroy() {}
    },
  });

  await controller.mount();
  controller.updateLiveDriver({ lat: 10.75, lng: 106.67 });
  assert.deepEqual(updatedDriver, { lat: 10.75, lng: 106.67 });
  assert.equal(fitCalled, true);
});
