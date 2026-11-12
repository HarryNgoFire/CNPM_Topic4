import test from "node:test";
import assert from "node:assert/strict";
import { DriverTripController } from "../map/driver-trip-controller.js";

function createController(api = {}) {
  return new DriverTripController({
    mapElement: {},
    shipmentId: "ship-1",
    api: {
      patch: async () => ({ accepted: true }),
      ...api,
    },
  });
}

test("DriverTripController ignores malformed GPS callbacks without changing location or uploading", () => {
  let uploads = 0;
  const controller = createController({ patch: async () => { uploads += 1; } });

  controller.handleDeviceGps(null);
  controller.handleDeviceGps({ lat: "10.75", lng: 106.66 });
  controller.handleDeviceGps({ lat: 10.75 });

  assert.equal(controller.currentLocation, null);
  assert.equal(uploads, 0);
});

test("DriverTripController reroutes only after 20 seconds continuously beyond 75 metres", () => {
  const controller = createController();
  controller.route = {
    geometry: {
      type: "LineString",
      coordinates: [[106.66, 10.75], [106.67, 10.75]],
    },
  };
  controller.uploadGps = () => {};
  let reroutes = 0;
  controller.refreshNavigation = () => { reroutes += 1; };
  const far = { lat: 10.76, lng: 106.665, accuracyM: 10 };

  controller.handleDeviceGps(far, 100000);
  controller.handleDeviceGps(far, 119999);
  assert.equal(reroutes, 0);
  controller.handleDeviceGps(far, 120000);
  assert.equal(reroutes, 1);
});

test("DriverTripController resets the reroute timer after returning to the route", () => {
  const controller = createController();
  controller.route = {
    geometry: {
      type: "LineString",
      coordinates: [[106.66, 10.75], [106.67, 10.75]],
    },
  };
  controller.uploadGps = () => {};
  let reroutes = 0;
  controller.refreshNavigation = () => { reroutes += 1; };
  const far = { lat: 10.76, lng: 106.665, accuracyM: 10 };
  const onRoute = { lat: 10.75, lng: 106.665, accuracyM: 10 };

  controller.handleDeviceGps(far, 100000);
  controller.handleDeviceGps(onRoute, 119000);
  controller.handleDeviceGps(far, 120000);
  controller.handleDeviceGps(far, 139999);

  assert.equal(reroutes, 0);
  controller.handleDeviceGps(far, 140000);
  assert.equal(reroutes, 1);
});

test("DriverTripController does not promote a server-throttled GPS point", async () => {
  const controller = createController({
    patch: async () => ({ accepted: false, reason: "TOO_SOON" }),
  });

  await controller.uploadGps({ lat: 10.75, lng: 106.66, accuracyM: 10 }, 100000);

  assert.equal(controller.lastUploadedGps, null);
  assert.equal(controller.lastUploadTime, 0);
  assert.equal(controller.pendingUpload, null);
});

test("DriverTripController coalesces GPS callbacks while an upload is in flight", async () => {
  let resolveUpload;
  let calls = 0;
  const controller = createController({
    patch: () => {
      calls += 1;
      return new Promise((resolve) => { resolveUpload = resolve; });
    },
  });
  const first = controller.uploadGps({ lat: 10.75, lng: 106.66, accuracyM: 10 }, 100000);
  await controller.uploadGps({ lat: 10.751, lng: 106.661, accuracyM: 10 }, 110000);

  assert.equal(calls, 1);
  resolveUpload({ accepted: true });
  await first;
  assert.equal(controller.lastUploadedGps.lat, 10.75);
});

test("DriverTripController keeps poor-accuracy GPS ineligible even inside 100 metres", async () => {
  let event;
  const controller = new DriverTripController({
    mapElement: {},
    shipmentId: "ship-1",
    api: { patch: async () => ({ accepted: true }) },
    onStateChanged: (value) => { event = value; },
  });
  controller.destination = { kind: "PICKUP", lat: 10.75, lng: 106.66 };

  await controller.uploadGps({ lat: 10.7501, lng: 106.6601, accuracyM: 80 }, 100000);

  assert.equal(controller.arrival.eligible, false);
  assert.equal(event.type, "GPS_UPDATED");
});
