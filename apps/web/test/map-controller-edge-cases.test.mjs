import test from "node:test";
import assert from "node:assert/strict";
import { SenderMapController } from "../map/sender-map-controller.js";

function createForm(overrides = {}) {
  const defaults = {
    pickupLine: "Điểm A",
    pickupWard: "Phường 1",
    pickupDistrict: "Quận 1",
    pickupCity: "Thành phố Hồ Chí Minh",
    pickupLat: "10.754",
    pickupLng: "106.663",
    dropoffLine: "Điểm B",
    dropoffWard: "Phường 5",
    dropoffDistrict: "Quận 5",
    dropoffCity: "Thành phố Hồ Chí Minh",
    dropoffLat: "10.75",
    dropoffLng: "106.66",
    weightKg: "1",
    lengthCm: "20",
    widthCm: "15",
    heightCm: "10",
    serviceType: "STANDARD",
    ...overrides,
  };
  const inputs = Object.fromEntries(
    Object.entries(defaults).map(([name, value]) => [name, { name, value }]),
  );
  const listeners = new Map();
  return {
    inputs,
    listeners,
    querySelector(selector) {
      const match = selector.match(/^\[name="(.+)"\]$/);
      return match ? inputs[match[1]] || null : null;
    },
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    removeEventListener(name, handler) {
      if (listeners.get(name) === handler) listeners.delete(name);
    },
  };
}

function createController(options = {}) {
  return new SenderMapController({
    mapElement: {},
    form: options.form || createForm(),
    api: options.api || { post: async () => ({}) },
    geocoding: options.geocoding || { reverse: async () => null, abort() {} },
    onQuoteChanged: options.onQuoteChanged,
  });
}

test("SenderMapController rejects booking payload until both A and B coordinates exist", () => {
  const missingPickup = createController({ form: createForm({ pickupLat: "", pickupLng: "" }) });
  assert.throws(() => missingPickup.getBookingPayload(), /điểm lấy hàng/);

  const missingDropoff = createController({ form: createForm({ dropoffLat: "", dropoffLng: "" }) });
  assert.throws(() => missingDropoff.getBookingPayload(), /điểm giao hàng/);
});

test("SenderMapController retains dragged coordinates and creates address fallbacks when reverse geocoding fails", async () => {
  const form = createForm({
    pickupLine: "",
    pickupWard: "",
    pickupDistrict: "",
    pickupCity: "",
    dropoffLat: "",
    dropoffLng: "",
  });
  const controller = createController({
    form,
    geocoding: {
      reverse: async () => { throw new Error("offline"); },
      abort() {},
    },
  });
  controller.engine = {
    setEndpoints() {},
    setRoute() {},
  };

  await controller.onDragMarker("pickup", { lat: 10.75821, lng: 106.66912 });

  assert.equal(form.inputs.pickupLat.value, "10.75821");
  assert.equal(form.inputs.pickupLng.value, "106.66912");
  assert.equal(form.inputs.pickupLine.value, "Vị trí (10.75821, 106.66912)");
  assert.equal(form.inputs.pickupWard.value, "Phường trung tâm");
  assert.equal(form.inputs.pickupDistrict.value, "Phường trung tâm");
  assert.equal(form.inputs.pickupCity.value, "Thành phố Hồ Chí Minh");
});

test("SenderMapController manual address edit invalidates coordinates and an in-flight quote", async () => {
  const form = createForm();
  let resolveQuote;
  const changes = [];
  const routes = [];
  const controller = createController({
    form,
    api: { post: () => new Promise((resolve) => { resolveQuote = resolve; }) },
    onQuoteChanged: (quote) => changes.push(quote),
  });
  controller.engine = {
    setEndpoints() {},
    setRoute: (route) => routes.push(route),
    fitRelevantPoints() {},
  };

  const pending = controller.recalculateRouteAndQuote();
  controller.handleFieldInput("pickupLine");
  resolveQuote({ fee: 99999, geometry: { type: "LineString", coordinates: [[1, 1]] } });
  await pending;

  assert.equal(form.inputs.pickupLat.value, "");
  assert.equal(form.inputs.pickupLng.value, "");
  assert.deepEqual(changes, [null]);
  assert.deepEqual(routes, [null]);
});

test("SenderMapController fills incomplete search results without overwriting supplied address fields", () => {
  const form = createForm({
    pickupLine: "Tên do người dùng nhập",
    pickupWard: "",
    pickupDistrict: "Quận 3",
    pickupCity: "",
  });
  const controller = createController({ form });
  controller.engine = {
    setEndpoints() {},
    fitRelevantPoints() {},
  };

  controller.selectSearchResult("pickup", {
    lat: 10.78,
    lng: 106.69,
    label: "Kết quả upstream, Việt Nam",
    address: {},
  });

  assert.equal(form.inputs.pickupLine.value, "Tên do người dùng nhập");
  assert.equal(form.inputs.pickupWard.value, "Quận 3");
  assert.equal(form.inputs.pickupDistrict.value, "Quận 3");
  assert.equal(form.inputs.pickupCity.value, "Thành phố Hồ Chí Minh");
});

test("SenderMapController destroy aborts geocoding, removes listeners, and destroys the map once", async () => {
  const form = createForm();
  let geocodingAborts = 0;
  let mapDestroys = 0;
  class Engine {
    ready() { return Promise.resolve(); }
    setEndpoints() {}
    setRoute() {}
    fitRelevantPoints() {}
    destroy() { mapDestroys += 1; }
  }
  const controller = new SenderMapController({
    mapElement: {},
    form,
    api: { post: async () => ({}) },
    geocoding: { abort: () => { geocodingAborts += 1; } },
    MapEngineClass: Engine,
  });
  await controller.mount();

  controller.destroy();
  controller.destroy();

  assert.equal(geocodingAborts, 2);
  assert.equal(mapDestroys, 1);
  assert.equal(form.listeners.has("input"), false);
  assert.equal(controller.engine, null);
});
