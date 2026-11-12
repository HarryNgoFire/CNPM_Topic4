import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLng,
  haversineMeters,
  pointToSegmentDistanceMeters,
  pointToLineStringDistanceMeters,
  isOffRoute,
} from "../map/map-math.js";

test("normalizeLng - normalizes degrees to [-180, 180] antimeridian safe", () => {
  assert.equal(normalizeLng(0), 0);
  assert.equal(normalizeLng(180), 180);
  assert.equal(normalizeLng(-180), -180);
  assert.equal(normalizeLng(190), -170);
  assert.equal(normalizeLng(-190), 170);
  assert.equal(normalizeLng(540), 180);
  assert.equal(normalizeLng(-540), -180);
  assert.equal(normalizeLng(NaN), 0);
});

test("haversineMeters - calculates movement and distances accurately", () => {
  const d1 = { lat: 10.7725, lng: 106.698 }; // Ben Thanh
  const d5 = { lat: 10.7495, lng: 106.6525 }; // Binh Tay

  assert.equal(haversineMeters(d1, d1), 0);

  const dist = haversineMeters(d1, d5);
  assert.ok(dist > 5400 && dist < 5700, `Expected ~5.5km, got ${dist}`);

  assert.equal(haversineMeters(null, d1), Infinity);
});

test("pointToSegmentDistanceMeters - perpendicular and endpoint projections", () => {
  // Horizontal line along equator from lng 0 to 1
  const segStart = [0, 0];
  const segEnd = [1, 0];

  // Point at (0.5, 0.001) is ~111m north of midpoint
  const midNorth = { lat: 0.001, lng: 0.5 };
  const dMid = pointToSegmentDistanceMeters(midNorth, segStart, segEnd);
  assert.ok(Math.abs(dMid - 111.2) < 5, `Expected ~111m, got ${dMid}`);

  // Point before start (lng -0.1, lat 0) projects onto start
  const beforeStart = { lat: 0, lng: -0.1 };
  const dBefore = pointToSegmentDistanceMeters(beforeStart, segStart, segEnd);
  assert.ok(dBefore > 11000 && dBefore < 11200);
});

test("pointToLineStringDistanceMeters - empty and single-point geometries", () => {
  const p = { lat: 10.7725, lng: 106.698 };

  // Empty
  assert.equal(pointToLineStringDistanceMeters(p, []), Infinity);
  assert.equal(pointToLineStringDistanceMeters(p, null), Infinity);

  // Single point
  const single = [[106.698, 10.7725]];
  assert.equal(pointToLineStringDistanceMeters(p, single), 0);

  const singleOffset = [[106.698, 10.7735]]; // ~111m north
  const dist = pointToLineStringDistanceMeters(p, singleOffset);
  assert.ok(dist > 105 && dist < 115);
});

test("isOffRoute - 75m threshold", () => {
  // Route from (10.7720, 106.6980) to (10.7730, 106.6980) along longitude 106.6980
  const route = [
    [106.698, 10.772],
    [106.698, 10.773],
  ];

  // 1. Point right on route
  const onRoute = { lat: 10.7725, lng: 106.698 };
  assert.equal(isOffRoute(onRoute, route, 75), false);

  // 2. Point 40m east (~0.00036 deg lng at 10.77 lat is ~40m)
  const nearPoint = { lat: 10.7725, lng: 106.69836 };
  assert.equal(isOffRoute(nearPoint, route, 75), false);

  // 3. Point 100m east (~0.00091 deg lng is ~100m)
  const farPoint = { lat: 10.7725, lng: 106.69891 };
  assert.equal(isOffRoute(farPoint, route, 75), true);

  // 4. Empty route is always off route
  assert.equal(isOffRoute(onRoute, [], 75), true);
});
