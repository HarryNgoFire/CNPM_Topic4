import test from "node:test";
import assert from "node:assert/strict";
import { MapEngine } from "../map/map-engine.js";
import { DriverTripController } from "../map/driver-trip-controller.js";

// Mock minimal DOM and MapLibre for testing
function createMockContainer() {
  const listeners = {};
  return {
    listeners,
    addEventListener(evt, fn) {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (listeners[evt]) {
        listeners[evt] = listeners[evt].filter(f => f !== fn);
      }
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function createMockMapLibre(events = {}) {
  let center = [106.66, 10.75];
  let zoom = 14;
  const calls = {
    flyTo: [],
    easeTo: [],
    setCenter: [],
  };

  class MockMap {
    constructor() {
      this._loaded = true;
    }
    on(event, handler) {
      events[event] = events[event] || [];
      events[event].push(handler);
    }
    once(event, handler) {
      this.on(event, handler);
      if (event === "load") {
        setTimeout(handler, 0);
      }
    }
    loaded() { return true; }
    addControl() {}
    addSource() {}
    addLayer() {}
    getSource() { return null; }
    setPadding() {}
    resize() {}
    getZoom() { return zoom; }
    setZoom(z) { zoom = z; }
    flyTo(opts) {
      calls.flyTo.push(opts);
      if (opts.center) center = opts.center;
      if (opts.zoom) zoom = opts.zoom;
    }
    easeTo(opts) {
      calls.easeTo.push(opts);
      if (opts.center) center = opts.center;
      if (opts.zoom) zoom = opts.zoom;
    }
    setCenter(c) {
      calls.setCenter.push(c);
      center = c;
    }
    remove() {}
  }

  class MockMarker {
    constructor() {}
    setLngLat() { return this; }
    addTo() { return this; }
    remove() {}
    getElement() { return { querySelector: () => null }; }
  }

  return {
    maplibregl: {
      Map: MockMap,
      Marker: MockMarker,
      AttributionControl: class {},
      NavigationControl: class {},
      LngLatBounds: class {
        extend() { return this; }
      },
    },
    calls,
    events,
  };
}

test("Auto Recenter - initial state has autoFollow active and autoRecenter enabled", async () => {
  const container = createMockContainer();
  const mockLib = createMockMapLibre();
  globalThis.maplibregl = mockLib.maplibregl;

  const engine = new MapEngine({ container });
  await engine.ready();

  assert.equal(engine.autoFollow, true);
  assert.equal(engine.isAutoRecenterConfigured(), true);

  engine.destroy();
});

test("Auto Recenter - user interaction pauses autoFollow and suppresses panTo during movement", async () => {
  const container = createMockContainer();
  const mockLib = createMockMapLibre();
  globalThis.maplibregl = mockLib.maplibregl;

  const engine = new MapEngine({ container });
  await engine.ready();

  let autoFollowReported = null;
  engine._onAutoFollowChange = (active) => {
    autoFollowReported = active;
  };

  engine.setDriverLocation({ lat: 10.75, lng: 106.66 });

  // Simulate user dragging the map
  engine._handleUserInteractionStart();

  assert.equal(engine.autoFollow, false);
  assert.equal(autoFollowReported, false);

  // During manual exploration, vehicle movement does not snap camera back
  const easeCountBefore = mockLib.calls.easeTo.length;
  engine.setDriverLocation({ lat: 10.752, lng: 106.662 }, true); // panTo requested
  assert.equal(mockLib.calls.easeTo.length, easeCountBefore, "Camera panTo should be suppressed while autoFollow is paused");

  engine.destroy();
});

test("Auto Recenter - triggers smooth recenter after 5 seconds of inactivity", async () => {
  const container = createMockContainer();
  const mockLib = createMockMapLibre();
  globalThis.maplibregl = mockLib.maplibregl;

  // Set timeout to 50ms for speedy test execution
  const engine = new MapEngine({ container });
  engine.autoRecenterTimeoutMs = 50;
  await engine.ready();

  engine.setDriverLocation({ lat: 10.76, lng: 106.68 });

  // User interacts with map
  engine._handleUserInteractionStart();
  assert.equal(engine.autoFollow, false);

  // User stops interacting
  engine._handleUserInteractionEnd();

  // Wait for the timeout to elapse
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(engine.autoFollow, true, "autoFollow should be restored after timeout");
  assert.ok(mockLib.calls.flyTo.length > 0 || mockLib.calls.easeTo.length > 0, "Camera should recenter on driver");

  const lastFly = mockLib.calls.flyTo[mockLib.calls.flyTo.length - 1];
  assert.deepEqual(lastFly.center, [106.68, 10.76]);
  assert.ok(lastFly.duration >= 900, "Smooth duration should be used");
  assert.ok(lastFly.zoom >= 15 && lastFly.zoom <= 17.5, "Zoom should be adjusted appropriately for navigation");

  engine.destroy();
});

test("Auto Recenter - further user interaction resets the 5-second countdown", async () => {
  const container = createMockContainer();
  const mockLib = createMockMapLibre();
  globalThis.maplibregl = mockLib.maplibregl;

  const engine = new MapEngine({ container });
  engine.autoRecenterTimeoutMs = 60;
  await engine.ready();

  engine.setDriverLocation({ lat: 10.76, lng: 106.68 });

  engine._handleUserInteractionStart();
  engine._handleUserInteractionEnd();

  // User interacts again after 30ms (before 60ms expires)
  await new Promise((resolve) => setTimeout(resolve, 30));
  engine._handleUserInteractionStart();

  // Wait past initial 60ms mark
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(engine.autoFollow, false, "autoFollow should remain paused because interaction restarted");
  assert.equal(mockLib.calls.flyTo.length, 0);

  // User finally releases
  engine._handleUserInteractionEnd();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(engine.autoFollow, true);
  assert.equal(mockLib.calls.flyTo.length, 1);

  engine.destroy();
});

test("Auto Recenter - disabled in mock settings prevents auto recenter", async () => {
  const container = createMockContainer();
  const mockLib = createMockMapLibre();
  globalThis.maplibregl = mockLib.maplibregl;

  const engine = new MapEngine({ container });
  engine.autoRecenterTimeoutMs = 40;
  engine.autoRecenterEnabled = false; // Disabled via settings
  await engine.ready();

  engine.setDriverLocation({ lat: 10.76, lng: 106.68 });

  engine._handleUserInteractionStart();
  engine._handleUserInteractionEnd();

  await new Promise((resolve) => setTimeout(resolve, 70));

  assert.equal(engine.autoFollow, false, "autoFollow should stay paused when autoRecenter is disabled");
  assert.equal(mockLib.calls.flyTo.length, 0, "No automatic recenter should happen");

  engine.destroy();
});

test("Auto Recenter - manual recenter immediately centers and restores autoFollow", async () => {
  const container = createMockContainer();
  const mockLib = createMockMapLibre();
  globalThis.maplibregl = mockLib.maplibregl;

  const engine = new MapEngine({ container });
  await engine.ready();

  engine.setDriverLocation({ lat: 10.77, lng: 106.69 });
  engine._handleUserInteractionStart();
  assert.equal(engine.autoFollow, false);

  // Driver taps Recenter button
  engine.recenterOnDriver({ smooth: true });
  assert.equal(engine.autoFollow, true, "autoFollow should be immediately active upon manual recenter");
  assert.ok(mockLib.calls.flyTo.length > 0);

  engine.destroy();
});
