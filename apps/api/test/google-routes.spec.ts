import { ServiceUnavailableException } from "@nestjs/common";
import { GoogleRoutesService } from "../src/modules/pricing/google-routes.service";
import { buildGoogleMapsDirectionsUrl } from "../src/common/google-maps";

describe("GoogleRoutesService", () => {
  const service = new GoogleRoutesService();
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-only-key";
    process.env.GOOGLE_MAPS_TRAVEL_MODE = "TWO_WHEELER";
    process.env.GOOGLE_MAPS_ROUTE_TIMEOUT_MS = "6000";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("requests a two-wheeler route and converts meters to kilometers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ routes: [{ distanceMeters: 8420, duration: "900s" }] }),
    });

    await expect(
      service.getDistance(
        { lat: 10.75, lng: 106.66 },
        { lat: 10.78, lng: 106.7 },
      ),
    ).resolves.toEqual({
      distanceKm: 8.42,
      distanceSource: "GOOGLE_ROUTES_TWO_WHEELER",
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("routes.googleapis.com/directions/v2:computeRoutes");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-only-key");
    expect(init.headers["X-Goog-FieldMask"]).toBe(
      "routes.distanceMeters,routes.duration",
    );
    expect(JSON.parse(init.body).travelMode).toBe("TWO_WHEELER");
  });

  it("returns null if the key is missing and fallback is allowed", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    process.env.GOOGLE_MAPS_ALLOW_GEODESIC_FALLBACK = "true";
    await expect(
      service.getDistance({ lat: 10, lng: 106 }, { lat: 11, lng: 107 }),
    ).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when fallback is disabled and key is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    process.env.GOOGLE_MAPS_ALLOW_GEODESIC_FALLBACK = "false";
    await expect(
      service.getDistance({ lat: 10, lng: 106 }, { lat: 11, lng: 107 }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("does not silently fall back when Google returns an error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
    await expect(
      service.getDistance({ lat: 10, lng: 106 }, { lat: 11, lng: 107 }),
    ).rejects.toThrow("Google Routes API returned HTTP 403");
  });
});

describe("Google Maps directions URL", () => {
  const previousMode = process.env.GOOGLE_MAPS_TRAVEL_MODE;
  beforeEach(() => {
    process.env.GOOGLE_MAPS_TRAVEL_MODE = "TWO_WHEELER";
  });
  afterEach(() => {
    if (previousMode === undefined) delete process.env.GOOGLE_MAPS_TRAVEL_MODE;
    else process.env.GOOGLE_MAPS_TRAVEL_MODE = previousMode;
  });

  it("creates a keyless motorbike navigation URL using destination coordinates", () => {
    const url = new URL(
      buildGoogleMapsDirectionsUrl({ lat: 10.754, lng: 106.663 }),
    );
    expect(url.hostname).toBe("www.google.com");
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("10.754,106.663");
    expect(url.searchParams.get("travelmode")).toBe("two-wheeler");
    expect(url.searchParams.get("dir_action")).toBe("navigate");
  });
});
