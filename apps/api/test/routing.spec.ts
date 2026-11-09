import { ServiceUnavailableException, BadRequestException } from "@nestjs/common";
import { RoutingService } from "../src/modules/pricing/routing.service";

describe("RoutingService contract", () => {
  let service: RoutingService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new RoutingService();
    process.env.OSRM_BASE_URL = "https://router.project-osrm.org";
    process.env.OSRM_ROUTE_TIMEOUT_MS = "2000";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const validOsrmResponse = {
    code: "Ok",
    routes: [
      {
        distance: 12500,
        duration: 900,
        geometry: {
          type: "LineString",
          coordinates: [
            [106.663, 10.754],
            [106.680, 10.760],
            [106.698, 10.772],
          ],
        },
      },
    ],
    waypoints: [
      { distance: 10, location: [106.663, 10.754] },
      { distance: 15, location: [106.698, 10.772] },
    ],
  };

  it("handles two waypoints with correct lng,lat ordering and query params", async () => {
    let requestedUrl = "";
    global.fetch = jest.fn().mockImplementation(async (url: string | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify(validOsrmResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const points = [
      { lat: 10.754, lng: 106.663 },
      { lat: 10.772, lng: 106.698 },
    ];

    const result = await service.getRoute(points);

    expect(requestedUrl).toContain(
      "/route/v1/driving/106.663,10.754;106.698,10.772",
    );
    expect(requestedUrl).toContain("geometries=geojson");
    expect(requestedUrl).toContain("overview=full");
    expect(result).toEqual({
      distanceMeters: 12500,
      distanceKm: 12.5,
      durationSeconds: 900,
      geometry: {
        type: "LineString",
        coordinates: [
          [106.663, 10.754],
          [106.680, 10.760],
          [106.698, 10.772],
        ],
      },
      source: "OSRM",
      profile: "driving",
    });
  });

  it("handles three waypoints correctly", async () => {
    let requestedUrl = "";
    global.fetch = jest.fn().mockImplementation(async (url: string | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify(validOsrmResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const points = [
      { lat: 10.1, lng: 106.1 },
      { lat: 10.2, lng: 106.2 },
      { lat: 10.3, lng: 106.3 },
    ];

    await service.getRoute(points);
    expect(requestedUrl).toContain(
      "/route/v1/driving/106.1,10.1;106.2,10.2;106.3,10.3",
    );
  });

  it("rejects invalid points (fewer than 2, more than 10, or out of range)", async () => {
    await expect(service.getRoute([{ lat: 10, lng: 106 }])).rejects.toThrow(
      BadRequestException,
    );

    const elevenPoints = Array.from({ length: 11 }, (_, i) => ({
      lat: 10 + i * 0.01,
      lng: 106 + i * 0.01,
    }));
    await expect(service.getRoute(elevenPoints)).rejects.toThrow(
      BadRequestException,
    );

    await expect(
      service.getRoute([
        { lat: 95, lng: 106 },
        { lat: 10, lng: 106 },
      ]),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.getRoute([
        { lat: 10, lng: 106 },
        { lat: 10, lng: 200 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects snap distance above 250 m", async () => {
    const farSnapResponse = {
      ...validOsrmResponse,
      waypoints: [
        { distance: 260, location: [106.663, 10.754] },
        { distance: 15, location: [106.698, 10.772] },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(farSnapResponse), { status: 200 }),
    );

    await expect(
      service.getRoute([
        { lat: 10.754, lng: 106.663 },
        { lat: 10.772, lng: 106.698 },
      ]),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("handles invalid JSON from OSRM", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("not a valid json", { status: 200 }),
    );

    await expect(
      service.getRoute([
        { lat: 10.754, lng: 106.663 },
        { lat: 10.772, lng: 106.698 },
      ]),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("handles NoRoute response", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "NoRoute", message: "No route found" }), {
        status: 200,
      }),
    );

    await expect(
      service.getRoute([
        { lat: 10.754, lng: 106.663 },
        { lat: 10.772, lng: 106.698 },
      ]),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("retries once on 503 and succeeds on retry", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(JSON.stringify(validOsrmResponse), { status: 200 });
    });

    const result = await service.getRoute([
      { lat: 10.754, lng: 106.663 },
      { lat: 10.772, lng: 106.698 },
    ]);

    expect(callCount).toBe(2);
    expect(result.distanceMeters).toBe(12500);
  });

  it("does not retry non-retryable 400 error", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      return new Response("Bad Request", { status: 400 });
    });

    await expect(
      service.getRoute([
        { lat: 10.754, lng: 106.663 },
        { lat: 10.772, lng: 106.698 },
      ]),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(callCount).toBe(1);
  });

  it("handles timeout error with single retry", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      throw new DOMException("The operation was aborted", "TimeoutError");
    });

    await expect(
      service.getRoute([
        { lat: 10.754, lng: 106.663 },
        { lat: 10.772, lng: 106.698 },
      ]),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(callCount).toBe(2);
  });

  it("hits in-memory cache for exact same route", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify(validOsrmResponse), { status: 200 });
    });

    const points = [
      { lat: 10.754, lng: 106.663 },
      { lat: 10.772, lng: 106.698 },
    ];

    const result1 = await service.getRoute(points);
    const result2 = await service.getRoute(points);

    expect(callCount).toBe(1);
    expect(result1).toEqual(result2);
  });

  it("coalesces concurrent identical in-flight requests", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(JSON.stringify(validOsrmResponse), { status: 200 });
    });

    const points = [
      { lat: 10.754, lng: 106.663 },
      { lat: 10.772, lng: 106.698 },
    ];

    const [res1, res2] = await Promise.all([
      service.getRoute(points),
      service.getRoute(points),
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(res2);
  });

  it("enforces bounded eviction on route cache", async () => {
    global.fetch = jest.fn().mockImplementation(async () => {
      return new Response(JSON.stringify(validOsrmResponse), { status: 200 });
    });

    // Populate cache with multiple distinct routes
    for (let i = 0; i < 505; i++) {
      await service.getRoute([
        { lat: 10.0 + i * 0.0001, lng: 106.0 },
        { lat: 10.1 + i * 0.0001, lng: 106.1 },
      ]);
    }

    expect(service.getCacheSize()).toBeLessThanOrEqual(500);
  });
});
