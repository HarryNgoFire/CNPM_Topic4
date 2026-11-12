import test from "node:test";
import assert from "node:assert/strict";
import {
  formatGeolocationError,
  getCurrentPositionOnce,
  startLocationWatch,
} from "../map/geolocation.js";

function replaceNavigator(value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else delete globalThis.navigator;
  };
}

test("formatGeolocationError covers permission, unavailable, timeout, custom, and empty errors", () => {
  assert.match(formatGeolocationError({ code: 1 }), /bị từ chối/);
  assert.match(formatGeolocationError({ code: 2 }), /Không có tín hiệu GPS/);
  assert.match(formatGeolocationError({ code: 3 }), /Hết thời gian/);
  assert.equal(formatGeolocationError({ code: 99, message: "custom" }), "custom");
  assert.equal(formatGeolocationError(null), "Không thể xác định vị trí.");
});

test("getCurrentPositionOnce rejects when browser geolocation is unavailable", async () => {
  const restore = replaceNavigator({});
  try {
    await assert.rejects(getCurrentPositionOnce(), /không hỗ trợ Geolocation/);
  } finally {
    restore();
  }
});

test("getCurrentPositionOnce forwards high-accuracy defaults and caller overrides", async () => {
  let options;
  const timestamp = Date.now();
  const restore = replaceNavigator({
    geolocation: {
      getCurrentPosition(success, _error, receivedOptions) {
        options = receivedOptions;
        success({
          coords: { latitude: 10.754, longitude: 106.663, accuracy: 12 },
          timestamp,
        });
      },
    },
  });

  try {
    const point = await getCurrentPositionOnce({ timeout: 2500, maximumAge: 0 });
    assert.deepEqual(options, {
      enableHighAccuracy: true,
      timeout: 2500,
      maximumAge: 0,
    });
    assert.deepEqual(point, {
      lat: 10.754,
      lng: 106.663,
      accuracyM: 12,
      capturedAt: new Date(timestamp).toISOString(),
    });
  } finally {
    restore();
  }
});

test("getCurrentPositionOnce translates browser errors without returning a fake point", async () => {
  const restore = replaceNavigator({
    geolocation: {
      getCurrentPosition(_success, error) {
        error({ code: 1 });
      },
    },
  });

  try {
    await assert.rejects(getCurrentPositionOnce(), /bị từ chối/);
  } finally {
    restore();
  }
});

test("startLocationWatch ignores backwards timestamps and clears the exact watch", () => {
  let success;
  let receivedOptions;
  let clearedId;
  const points = [];
  const restore = replaceNavigator({
    geolocation: {
      watchPosition(onSuccess, _onError, options) {
        success = onSuccess;
        receivedOptions = options;
        return 42;
      },
      clearWatch(id) {
        clearedId = id;
      },
    },
  });

  try {
    const now = Date.now();
    const stop = startLocationWatch({ onPosition: (point) => points.push(point) });
    success({ coords: { latitude: 10.75, longitude: 106.66, accuracy: 9 }, timestamp: now });
    success({ coords: { latitude: 11, longitude: 107, accuracy: 9 }, timestamp: now - 1 });
    stop();

    assert.equal(points.length, 1);
    assert.equal(points[0].lat, 10.75);
    assert.equal(clearedId, 42);
    assert.deepEqual(receivedOptions, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });
  } finally {
    restore();
  }
});

test("startLocationWatch reports unsupported browsers and returns a safe stop function", () => {
  const restore = replaceNavigator({});
  let error;
  try {
    const stop = startLocationWatch({ onPosition() {}, onError: (value) => { error = value; } });
    assert.match(error.message, /không hỗ trợ Geolocation/);
    assert.doesNotThrow(stop);
  } finally {
    restore();
  }
});
