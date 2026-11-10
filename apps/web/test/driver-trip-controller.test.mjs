import test from "node:test";
import assert from "node:assert/strict";
import { DriverTripController } from "../map/driver-trip-controller.js";

function createMockElement() {
  return {
    innerHTML: "",
    innerText: "",
    listeners: {},
    children: [],
    addEventListener(evt, fn) {
      this.listeners[evt] = this.listeners[evt] || [];
      this.listeners[evt].push(fn);
    },
    querySelector() {
      return null;
    },
  };
}

test("DriverTripController - phase transitions: TO_PICKUP draws A only; AT_PICKUP removes route; TO_DROPOFF draws B only", async () => {
  let endpointsSet = null;
  let routeSet = null;
  let driverLocSet = null;

  class MockEngine {
    ready() { return Promise.resolve(); }
    setEndpoints(ep) { endpointsSet = ep; }
    setRoute(r) { routeSet = r; }
    setDriverLocation(loc) { driverLocSet = loc; }
    fitRelevantPoints() {}
    destroy() {}
  }

  let navCallCount = 0;
  const mockApi = {
    get: async (path) => {
      assert.equal(path, "/shipments/ship-1/navigation");
      navCallCount++;
      if (navCallCount === 1) {
        // First state: EN_ROUTE_PICKUP -> TO_PICKUP
        return {
          shipmentId: "ship-1",
          shipmentStatus: "EN_ROUTE_PICKUP",
          phase: "TO_PICKUP",
          currentLocation: { lat: 10.75, lng: 106.66, accuracyM: 10, capturedAt: new Date().toISOString() },
          destination: { kind: "PICKUP", lat: 10.754, lng: 106.663 },
          route: { geometry: { type: "LineString", coordinates: [[106.66, 10.75], [106.663, 10.754]] } },
          arrival: { eligible: false, distanceM: 450 },
        };
      }
      if (navCallCount === 2) {
        // Second state: ARRIVED_PICKUP -> AT_PICKUP
        return {
          shipmentId: "ship-1",
          shipmentStatus: "ARRIVED_PICKUP",
          phase: "AT_PICKUP",
          currentLocation: { lat: 10.754, lng: 106.663, accuracyM: 10, capturedAt: new Date().toISOString() },
          destination: null,
          route: null,
          arrival: { eligible: false, distanceM: null },
        };
      }
      // Third state: OUT_FOR_DELIVERY -> TO_DROPOFF
      return {
        shipmentId: "ship-1",
        shipmentStatus: "OUT_FOR_DELIVERY",
        phase: "TO_DROPOFF",
        currentLocation: { lat: 10.754, lng: 106.663, accuracyM: 10, capturedAt: new Date().toISOString() },
        destination: { kind: "DROPOFF", lat: 10.772, lng: 106.698 },
        route: { geometry: { type: "LineString", coordinates: [[106.663, 10.754], [106.698, 10.772]] } },
        arrival: { eligible: false, distanceM: 5200 },
      };
    },
    post: async (path, body) => {
      assert.equal(path, "/shipments/ship-1/transition");
      // Only server status is sent, never client-crafted destination or distance
      assert.ok(body.toStatus);
      assert.equal(body.destination, undefined);
      assert.equal(body.distanceM, undefined);
      return { status: body.toStatus };
    },
    patch: async () => ({ accepted: true }),
  };

  const controller = new DriverTripController({
    mapElement: createMockElement(),
    shipmentId: "ship-1",
    api: mockApi,
    MapEngineClass: MockEngine,
    geolocation: {
      startLocationWatch: () => () => {},
    },
  });

  await controller.mount();

  // 1. Initial TO_PICKUP
  assert.equal(controller.phase, "TO_PICKUP");
  assert.deepEqual(endpointsSet.pickup, { lat: 10.754, lng: 106.663 });
  assert.equal(endpointsSet.dropoff, null); // Never B in TO_PICKUP!
  assert.ok(routeSet);

  // 2. Transition to ARRIVED_PICKUP -> AT_PICKUP
  await controller.confirmArrival();
  assert.equal(controller.phase, "AT_PICKUP");
  assert.equal(endpointsSet.pickup, null);
  assert.equal(endpointsSet.dropoff, null);
  assert.equal(routeSet, null); // Route removed in AT_PICKUP

  // 3. Confirm pickup -> TO_DROPOFF
  await controller.confirmPickup();
  assert.equal(controller.phase, "TO_DROPOFF");
  assert.equal(endpointsSet.pickup, null); // Never A in TO_DROPOFF!
  assert.deepEqual(endpointsSet.dropoff, { lat: 10.772, lng: 106.698 });
  assert.ok(routeSet);
});

test("DriverTripController - GPS throttle: skips < 5s or < 15m unless stationary 60s heartbeat", async () => {
  const uploads = [];
  const mockApi = {
    get: async () => ({
      shipmentId: "ship-1",
      shipmentStatus: "EN_ROUTE_PICKUP",
      phase: "TO_PICKUP",
      currentLocation: null,
      destination: { kind: "PICKUP", lat: 10.754, lng: 106.663 },
      route: null,
      arrival: { eligible: false, distanceM: 500 },
    }),
    patch: async (path, body) => {
      uploads.push(body);
      return { accepted: true };
    },
  };

  const controller = new DriverTripController({
    mapElement: createMockElement(),
    shipmentId: "ship-1",
    api: mockApi,
    MapEngineClass: class {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      setDriverLocation() {}
      fitRelevantPoints() {}
      destroy() {}
    },
    geolocation: { startLocationWatch: () => () => {} },
  });

  const t0 = 100000;
  // Point 1: First point uploads immediately
  controller.handleDeviceGps({ lat: 10.75, lng: 106.66, accuracyM: 10, capturedAt: new Date(t0).toISOString() }, t0);
  await Promise.resolve();
  assert.equal(uploads.length, 1);

  // Point 2: 3 seconds later (< 5s) -> skipped
  controller.handleDeviceGps({ lat: 10.7505, lng: 106.6605, accuracyM: 10, capturedAt: new Date(t0 + 3000).toISOString() }, t0 + 3000);
  assert.equal(uploads.length, 1);

  // Point 3: 10s later, but only moved 2m (< 15m) -> skipped
  controller.handleDeviceGps({ lat: 10.75001, lng: 106.66, accuracyM: 10, capturedAt: new Date(t0 + 10000).toISOString() }, t0 + 10000);
  assert.equal(uploads.length, 1);

  // Point 4: 10s later, moved 50m (> 15m, > 5s) -> uploaded
  controller.handleDeviceGps({ lat: 10.75045, lng: 106.66, accuracyM: 10, capturedAt: new Date(t0 + 10000).toISOString() }, t0 + 10000);
  await Promise.resolve();
  assert.equal(uploads.length, 2);

  // Point 5: Stationary heartbeat 65s later even with 0m movement -> uploaded
  controller.handleDeviceGps({ lat: 10.75045, lng: 106.66, accuracyM: 10, capturedAt: new Date(t0 + 75000).toISOString() }, t0 + 75000);
  await Promise.resolve();
  assert.equal(uploads.length, 3);
});

test("DriverTripController - failed GPS upload is retried instead of advancing the throttle baseline", async () => {
  const point = { lat: 10.75, lng: 106.66, accuracyM: 10, capturedAt: "2026-11-10T02:00:00.000Z" };
  const controller = new DriverTripController({
    mapElement: createMockElement(),
    shipmentId: "ship-1",
    api: { patch: async () => { throw new Error("offline"); } },
  });

  await controller.uploadGps(point, 100000);

  assert.equal(controller.lastUploadedGps, null);
  assert.equal(controller.lastUploadTime, 0);
});

test("DriverTripController - accepted GPS upload updates arrival without requesting a new route", async () => {
  let navigationCalls = 0;
  let stateEvent = null;
  const controller = new DriverTripController({
    mapElement: createMockElement(),
    shipmentId: "ship-1",
    api: { patch: async () => ({ accepted: true }) },
    onStateChanged: (event) => { stateEvent = event; },
  });
  controller.destination = { kind: "PICKUP", lat: 10.75, lng: 106.66 };
  controller.refreshNavigation = async () => { navigationCalls += 1; };

  await controller.uploadGps({
    lat: 10.7501,
    lng: 106.6601,
    accuracyM: 10,
    capturedAt: "2026-11-10T02:00:00.000Z",
  }, 100000);

  assert.equal(navigationCalls, 0);
  assert.equal(controller.arrival.eligible, true);
  assert.equal(stateEvent.type, "GPS_UPDATED");
});

test("DriverTripController - terminal state stops tracking and releases resources", async () => {
  let watchStarted = false;
  let watchStopped = false;

  let currentPhase = "TO_DROPOFF";
  const mockApi = {
    get: async () => ({
      shipmentId: "ship-1",
      shipmentStatus: currentPhase === "TO_DROPOFF" ? "OUT_FOR_DELIVERY" : "DELIVERED",
      phase: currentPhase,
      currentLocation: null,
      destination: null,
      route: null,
      arrival: { eligible: false, distanceM: null },
    }),
    post: async () => {
      currentPhase = "COMPLETE";
      return { status: "DELIVERED" };
    },
  };

  const controller = new DriverTripController({
    mapElement: createMockElement(),
    shipmentId: "ship-1",
    api: mockApi,
    MapEngineClass: class {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      setDriverLocation() {}
      fitRelevantPoints() {}
      destroy() {}
    },
    geolocation: {
      startLocationWatch: () => {
        watchStarted = true;
        return () => { watchStopped = true; };
      },
    },
  });

  await controller.mount();
  assert.equal(watchStarted, true);
  assert.equal(watchStopped, false);

  // Transition to DELIVERED -> terminal state stops tracking
  await controller.confirmDelivery();
  assert.equal(controller.phase, "COMPLETE");
  assert.equal(watchStopped, true);
});

test("DriverTripController - pauses tracking when document is hidden and resumes when visible", async () => {
  let watchStarts = 0;
  let watchStops = 0;

  const listeners = {};
  const mockDoc = {
    hidden: false,
    addEventListener: (event, handler) => { listeners[event] = handler; },
    removeEventListener: (event) => { delete listeners[event]; },
  };
  global.document = mockDoc;

  const controller = new DriverTripController({
    mapElement: createMockElement(),
    shipmentId: "ship-1",
    api: {
      get: async () => ({
        phase: "TO_PICKUP",
        shipmentStatus: "EN_ROUTE_PICKUP",
        destination: { kind: "PICKUP", lat: 10.75, lng: 106.66 },
        route: null,
      }),
    },
    MapEngineClass: class {
      ready() { return Promise.resolve(); }
      setEndpoints() {}
      setRoute() {}
      setDriverLocation() {}
      fitRelevantPoints() {}
      destroy() {}
    },
    geolocation: {
      startLocationWatch: () => {
        watchStarts++;
        return () => { watchStops++; };
      },
    },
  });

  await controller.mount();
  assert.equal(watchStarts, 1);
  assert.equal(watchStops, 0);

  // Tab hidden -> pauses tracking
  mockDoc.hidden = true;
  listeners.visibilitychange();
  assert.equal(watchStops, 1);

  // Tab visible again -> resumes tracking
  mockDoc.hidden = false;
  listeners.visibilitychange();
  assert.equal(watchStarts, 2);

  controller.destroy();
  assert.equal(listeners.visibilitychange, undefined);
  delete global.document;
});
