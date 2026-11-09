import {
  haversineDistanceMeters,
  isValidWgs84,
  evaluateDriverGps,
} from "../src/common/geo";

describe("GPS and Geo pure functions", () => {
  // Known coordinates in Ho Chi Minh City
  // D1: Ben Thanh Market (10.7725, 106.6980)
  // D5: Cho Lon / Binh Tay (10.7495, 106.6525)
  const d1 = { lat: 10.7725, lng: 106.698 };
  const d5 = { lat: 10.7495, lng: 106.6525 };

  describe("haversineDistanceMeters", () => {
    it("calculates 0 distance for identical points", () => {
      expect(haversineDistanceMeters(d1, d1)).toBe(0);
    });

    it("calculates accurate distance between known HCMC landmarks (~5.5km)", () => {
      const distance = haversineDistanceMeters(d1, d5);
      expect(distance).toBeGreaterThan(5400);
      expect(distance).toBeLessThan(5700);
    });

    it("throws on invalid coordinates", () => {
      expect(() =>
        haversineDistanceMeters({ lat: 95, lng: 106 }, d1),
      ).toThrow();
      expect(() =>
        haversineDistanceMeters(d1, { lat: 10, lng: 200 }),
      ).toThrow();
    });
  });

  describe("isValidWgs84", () => {
    it("accepts valid coordinates", () => {
      expect(isValidWgs84({ lat: 10.75, lng: 106.66 })).toBe(true);
      expect(isValidWgs84({ lat: -90, lng: -180 })).toBe(true);
      expect(isValidWgs84({ lat: 90, lng: 180 })).toBe(true);
    });

    it("rejects reversed longitude/latitude where latitude exceeds 90", () => {
      // Swapping lat and lng: lat = 106.66 (> 90), lng = 10.75
      expect(isValidWgs84({ lat: 106.66, lng: 10.75 })).toBe(false);
    });

    it("rejects non-numeric and infinite values", () => {
      expect(isValidWgs84({ lat: NaN, lng: 106.66 })).toBe(false);
      expect(isValidWgs84({ lat: Infinity, lng: 106.66 })).toBe(false);
      expect(isValidWgs84({ lat: 10.75, lng: -181 })).toBe(false);
    });
  });

  describe("evaluateDriverGps", () => {
    const baseTime = new Date("2026-11-10T02:00:00.000Z");

    it("accepts first valid point without prior history", () => {
      const result = evaluateDriverGps({
        current: {
          lat: d1.lat,
          lng: d1.lng,
          accuracyM: 10,
          capturedAt: baseTime,
        },
        serverNow: baseTime,
      });

      expect(result).toMatchObject({ accepted: true, distanceM: 0, durationMs: 0 });
    });

    it("rejects reversed longitude/latitude", () => {
      const result = evaluateDriverGps({
        current: {
          lat: 106.698, // reversed
          lng: 10.7725,
          accuracyM: 10,
          capturedAt: baseTime,
        },
        serverNow: baseTime,
      });

      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Invalid WGS84 coordinates"),
      });
    });

    it("rejects accuracy exceeding maximum limit (200m)", () => {
      const result = evaluateDriverGps({
        current: {
          lat: d1.lat,
          lng: d1.lng,
          accuracyM: 201,
          capturedAt: baseTime,
        },
        serverNow: baseTime,
      });

      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Accuracy must be positive and at most 200m"),
      });
    });

    it("rejects zero or negative accuracy", () => {
      expect(
        evaluateDriverGps({
          current: { lat: d1.lat, lng: d1.lng, accuracyM: 0, capturedAt: baseTime },
          serverNow: baseTime,
        }),
      ).toMatchObject({ valid: false });
    });

    it("rejects timestamp exceeding future skew (>30s)", () => {
      const futureTime = new Date(baseTime.getTime() + 31000);
      const result = evaluateDriverGps({
        current: {
          lat: d1.lat,
          lng: d1.lng,
          accuracyM: 15,
          capturedAt: futureTime,
        },
        serverNow: baseTime,
      });

      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Timestamp is too far in the future"),
      });
    });

    it("allows timestamp within acceptable future skew (<=30s)", () => {
      const futureTime = new Date(baseTime.getTime() + 15000);
      const result = evaluateDriverGps({
        current: {
          lat: d1.lat,
          lng: d1.lng,
          accuracyM: 15,
          capturedAt: futureTime,
        },
        serverNow: baseTime,
      });

      expect(result).toMatchObject({ accepted: true, distanceM: 0, durationMs: 0 });
    });

    it("rejects stale timestamp (>300s)", () => {
      const staleTime = new Date(baseTime.getTime() - 301000);
      const result = evaluateDriverGps({
        current: {
          lat: d1.lat,
          lng: d1.lng,
          accuracyM: 15,
          capturedAt: staleTime,
        },
        serverNow: baseTime,
      });

      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Timestamp is stale"),
      });
    });

    it("rejects older or identical capture timestamps", () => {
      const result = evaluateDriverGps({
        current: {
          lat: d1.lat,
          lng: d1.lng,
          accuracyM: 15,
          capturedAt: baseTime,
        },
        prior: {
          lat: d1.lat,
          lng: d1.lng,
          locationCapturedAt: baseTime, // identical
        },
        serverNow: baseTime,
      });

      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("strictly newer"),
      });
    });

    it("rejects implausible speed (> 55 m/s)", () => {
      // Moving 5.5 km in 10 seconds = 550 m/s >> 55 m/s
      const after10s = new Date(baseTime.getTime() + 10000);
      const result = evaluateDriverGps({
        current: {
          lat: d5.lat,
          lng: d5.lng,
          accuracyM: 15,
          capturedAt: after10s,
        },
        prior: {
          lat: d1.lat,
          lng: d1.lng,
          locationCapturedAt: baseTime,
        },
        serverNow: after10s,
      });

      expect(result).toEqual({
        valid: false,
        error: expect.stringContaining("Implausible speed detected"),
      });
    });

    it("throttles updates inside 5 seconds as TOO_SOON", () => {
      // 3 seconds later, moved 50 meters
      const after3s = new Date(baseTime.getTime() + 3000);
      const moved50m = { lat: d1.lat + 0.00045, lng: d1.lng };
      const result = evaluateDriverGps({
        current: {
          lat: moved50m.lat,
          lng: moved50m.lng,
          accuracyM: 15,
          capturedAt: after3s,
        },
        prior: {
          lat: d1.lat,
          lng: d1.lng,
          locationCapturedAt: baseTime,
        },
        serverNow: after3s,
      });

      expect(result).toMatchObject({ accepted: false, reason: "TOO_SOON" });
    });

    it("throttles stationary updates (< 15m movement) inside 60 seconds as STATIONARY", () => {
      // 10 seconds later, moved 2 meters
      const after10s = new Date(baseTime.getTime() + 10000);
      const moved2m = { lat: d1.lat + 0.00001, lng: d1.lng };
      const result = evaluateDriverGps({
        current: {
          lat: moved2m.lat,
          lng: moved2m.lng,
          accuracyM: 15,
          capturedAt: after10s,
        },
        prior: {
          lat: d1.lat,
          lng: d1.lng,
          locationCapturedAt: baseTime,
        },
        serverNow: after10s,
      });

      expect(result).toMatchObject({ accepted: false, reason: "STATIONARY" });
    });

    it("accepts stationary heartbeat after 60 seconds even with < 15m movement", () => {
      const after65s = new Date(baseTime.getTime() + 65000);
      const moved2m = { lat: d1.lat + 0.00001, lng: d1.lng };
      const result = evaluateDriverGps({
        current: {
          lat: moved2m.lat,
          lng: moved2m.lng,
          accuracyM: 15,
          capturedAt: after65s,
        },
        prior: {
          lat: d1.lat,
          lng: d1.lng,
          locationCapturedAt: baseTime,
        },
        serverNow: after65s,
      });

      expect(result).toMatchObject({ accepted: true });
    });

    it("accepts valid movement >= 15m after >= 5 seconds", () => {
      const after6s = new Date(baseTime.getTime() + 6000);
      // ~50m movement
      const moved50m = { lat: d1.lat + 0.00045, lng: d1.lng };
      const result = evaluateDriverGps({
        current: {
          lat: moved50m.lat,
          lng: moved50m.lng,
          accuracyM: 15,
          capturedAt: after6s,
        },
        prior: {
          lat: d1.lat,
          lng: d1.lng,
          locationCapturedAt: baseTime,
        },
        serverNow: after6s,
      });

      expect(result).toMatchObject({ accepted: true });
    });
  });
});
