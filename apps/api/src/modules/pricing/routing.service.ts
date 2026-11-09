import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PointDto } from "../../common/dto";

export type RouteGeometry = {
  type: "LineString";
  coordinates: Array<[longitude: number, latitude: number]>;
};

export type RouteResult = {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  geometry: RouteGeometry;
  source: "OSRM";
  profile: "driving";
};

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: unknown;
    duration?: unknown;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
  waypoints?: Array<{ distance?: number }>;
};

type CachedRoute = {
  result: RouteResult;
  expiresAt: number;
};

@Injectable()
export class RoutingService {
  private readonly routeCache = new Map<string, CachedRoute>();
  private readonly inFlight = new Map<string, Promise<RouteResult>>();
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly cacheMaxEntries = 500;

  getCacheSize(): number {
    return this.routeCache.size;
  }

  async getRoute(points: readonly PointDto[]): Promise<RouteResult> {
    if (!Array.isArray(points) || points.length < 2 || points.length > 10) {
      throw new BadRequestException("Route requires 2 to 10 points");
    }

    for (const p of points) {
      if (
        !p ||
        typeof p.lat !== "number" ||
        typeof p.lng !== "number" ||
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng) ||
        p.lat < -90 ||
        p.lat > 90 ||
        p.lng < -180 ||
        p.lng > 180
      ) {
        throw new BadRequestException("Invalid WGS84 coordinates in route");
      }
    }

    const baseUrl = (process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org")
      .trim()
      .replace(/\/+$/, "");
    const profile = "driving";

    let endpoint: URL;
    try {
      const base = new URL(baseUrl);
      if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
        throw new Error("Unsupported OSRM URL");
      }
      const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
      endpoint = new URL(
        `/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`,
        base,
      );
    } catch {
      throw new ServiceUnavailableException("OSRM_BASE_URL must be a valid HTTP(S) URL");
    }

    const cacheKey = `${endpoint.origin}${endpoint.pathname}?${endpoint.searchParams.toString()}`;

    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    if (cached) {
      this.routeCache.delete(cacheKey);
    }

    const pending = this.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const promise = this.fetchWithRetry(endpoint, cacheKey);
    this.inFlight.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async fetchWithRetry(endpoint: URL, cacheKey: string): Promise<RouteResult> {
    const parsedTimeout = Number(process.env.OSRM_ROUTE_TIMEOUT_MS ?? 6000);
    const timeoutMs = Number.isFinite(parsedTimeout)
      ? Math.min(Math.max(parsedTimeout, 1000), 15000)
      : 6000;

    let response: Response | undefined;

    for (let attempt = 0; attempt <= 1; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      try {
        response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "CNPM-Topic4/0.1 (student project)",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
          break;
        }

        const retryable = [502, 503, 504].includes(response.status);
        if (!retryable || attempt >= 1) {
          throw new ServiceUnavailableException(
            `OSRM routing service returned HTTP ${response.status}; try again later or configure a routing server`,
          );
        }
      } catch (err) {
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
        if (attempt >= 1) {
          throw new ServiceUnavailableException(
            "OSRM routing service could not be reached; refusing to quote using straight-line distance",
          );
        }
      }
    }

    if (!response || !response.ok) {
      throw new ServiceUnavailableException(
        "OSRM routing service could not be reached; refusing to quote using straight-line distance",
      );
    }

    let payload: OsrmResponse;
    try {
      payload = (await response.json()) as OsrmResponse;
    } catch {
      throw new ServiceUnavailableException("OSRM returned an invalid response");
    }

    const firstRoute = payload.routes?.[0];
    const distanceMeters = firstRoute?.distance;
    const durationSeconds = firstRoute?.duration;
    const geometry = firstRoute?.geometry;

    if (
      payload.code !== "Ok" ||
      typeof distanceMeters !== "number" ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0 ||
      typeof durationSeconds !== "number" ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 0 ||
      !geometry ||
      geometry.type !== "LineString" ||
      !Array.isArray(geometry.coordinates)
    ) {
      throw new ServiceUnavailableException(
        "OSRM did not return a valid road route; check the coordinates or routing coverage",
      );
    }

    if (
      payload.waypoints?.some(
        (point) => typeof point.distance === "number" && point.distance > 250,
      )
    ) {
      throw new ServiceUnavailableException(
        "Selected pin is too far from a routable road (>250 m). Reposition the pin to the correct road entrance.",
      );
    }

    const result: RouteResult = {
      distanceMeters,
      distanceKm: distanceMeters / 1000,
      durationSeconds: Math.round(durationSeconds),
      geometry: {
        type: "LineString",
        coordinates: geometry.coordinates as Array<[number, number]>,
      },
      source: "OSRM",
      profile: "driving",
    };

    this.cacheRoute(cacheKey, result);
    return result;
  }

  private cacheRoute(key: string, result: RouteResult): void {
    if (this.routeCache.size >= this.cacheMaxEntries) {
      const now = Date.now();
      for (const [cachedKey, value] of this.routeCache) {
        if (value.expiresAt <= now || this.routeCache.size >= this.cacheMaxEntries) {
          this.routeCache.delete(cachedKey);
        }
      }
    }
    this.routeCache.set(key, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}
