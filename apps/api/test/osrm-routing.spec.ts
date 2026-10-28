import { ServiceUnavailableException } from "@nestjs/common";
import { OsrmRoutingService } from "../src/modules/pricing/osrm-routing.service";
import { buildGoogleMapsDirectionsUrl } from "../src/common/google-maps";

describe("OsrmRoutingService", () => {
  let service: OsrmRoutingService;
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new OsrmRoutingService();
    process.env.OSRM_BASE_URL = "https://router.project-osrm.org";
    process.env.OSRM_ROUTE_TIMEOUT_MS = "6000";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("requests an OSRM road route and converts meters to kilometers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: "Ok", routes: [{ distance: 8420, duration: 900 }] }),
    });

    await expect(
      service.getDistance(
        { lat: 10.75, lng: 106.66 },
        { lat: 10.78, lng: 106.7 },
      ),
    ).resolves.toEqual({
      distanceKm: 8.42,
      distanceSource: "OSRM_DRIVING",
    });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain(
      "router.project-osrm.org/route/v1/driving/106.66,10.75;106.7,10.78",
    );
    expect(String(url)).toContain("overview=false");
    expect(init.method).toBe("GET");
    expect(init.headers.Accept).toBe("application/json");
  });

  it("fails closed when OSRM cannot reach the coordinates by road", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: "NoRoute", routes: [] }),
    });
    await expect(
      service.getDistance({ lat: 10, lng: 106 }, { lat: 11, lng: 107 }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("does not fall back to straight-line distance when OSRM fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));
    await expect(
      service.getDistance({ lat: 10, lng: 106 }, { lat: 11, lng: 107 }),
    ).rejects.toThrow("refusing to quote using straight-line distance");
  });

  it("caches repeated road-route requests", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: "Ok", routes: [{ distance: 5000, duration: 500 }] }),
    });
    const a = { lat: 10.75, lng: 106.66 };
    const b = { lat: 10.78, lng: 106.7 };
    await service.getDistance(a, b);
    await service.getDistance(a, b);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
