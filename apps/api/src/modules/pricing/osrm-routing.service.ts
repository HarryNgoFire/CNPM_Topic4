import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PointDto } from "../../common/dto";

export type RoadRouteDistance = {
  distanceKm: number;
  distanceSource: "OSRM_DRIVING";
};

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: Array<{ distance?: unknown; duration?: unknown }>;
};

type CachedRoute = { distanceKm: number; expiresAt: number };

/**
 * Uses the OSRM Route API to calculate road distance without a paid API key.
 * The public OSRM demo server uses its `driving` profile (not a dedicated
 * motorbike profile), is best-effort only, and asks callers not to exceed one
 * request per second. We enforce that limit per API process and cache routes
 * briefly so repeated quote/create requests don't unnecessarily hit the demo.
 */
@Injectable()
export class OsrmRoutingService {
  private readonly routeCache = new Map<string, CachedRoute>();
  private queueTail: Promise<void> = Promise.resolve();
  private lastRequestStartedAt = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly cacheMaxEntries = 500;

  async getDistance(
    origin: PointDto,
    destination: PointDto,
  ): Promise<RoadRouteDistance> {
    const baseUrl = (process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org").trim().replace(/\/+$/, "");
    // The public OSRM demo exposes the standard `driving` profile. Keeping the
    // profile fixed also keeps distanceSource truthful in pricing snapshots.
    const profile = "driving";

    let endpoint: URL;
    try {
      const base = new URL(baseUrl);
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
        throw new Error("Unsupported OSRM URL");
      }
      endpoint = new URL(
        `/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false&steps=false`,
        base,
      );
    } catch {
      throw new ServiceUnavailableException(
        "OSRM_BASE_URL must be a valid HTTP(S) URL",
      );
    }

    const cacheKey = `${endpoint.origin}${endpoint.pathname}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { distanceKm: cached.distanceKm, distanceSource: "OSRM_DRIVING" };
    }
    if (cached) this.routeCache.delete(cacheKey);

    await this.waitForRequestSlot();

    // A same-route request may have populated the cache while this one waited.
    const cachedAfterWait = this.routeCache.get(cacheKey);
    if (cachedAfterWait && cachedAfterWait.expiresAt > Date.now()) {
      return {
        distanceKm: cachedAfterWait.distanceKm,
        distanceSource: "OSRM_DRIVING",
      };
    }

    const parsedTimeout = Number(process.env.OSRM_ROUTE_TIMEOUT_MS ?? 6000);
    const timeoutMs = Number.isFinite(parsedTimeout)
      ? Math.min(Math.max(parsedTimeout, 1000), 15000)
      : 6000;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "CNPM-Topic4/0.1 (student project)",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        "OSRM routing service could not be reached; refusing to quote using straight-line distance",
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OSRM routing service returned HTTP ${response.status}; try again later or configure a routing server`,
      );
    }

    let payload: OsrmResponse;
    try {
      payload = (await response.json()) as OsrmResponse;
    } catch {
      throw new ServiceUnavailableException("OSRM returned an invalid response");
    }

    const distanceMeters = payload.routes?.[0]?.distance;
    if (
      payload.code !== "Ok" ||
      typeof distanceMeters !== "number" ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      throw new ServiceUnavailableException(
        "OSRM did not return a valid road route; check the coordinates or routing coverage",
      );
    }

    const distanceKm = distanceMeters / 1000;
    this.cacheRoute(cacheKey, distanceKm);
    return { distanceKm, distanceSource: "OSRM_DRIVING" };
  }

  private async waitForRequestSlot(): Promise<void> {
    let release!: () => void;
    const previous = this.queueTail;
    this.queueTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const waitMs = Math.max(0, 1050 - (Date.now() - this.lastRequestStartedAt));
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastRequestStartedAt = Date.now();
    } finally {
      release();
    }
  }

  private cacheRoute(key: string, distanceKm: number): void {
    if (this.routeCache.size >= this.cacheMaxEntries) {
      const now = Date.now();
      for (const [cachedKey, value] of this.routeCache) {
        if (value.expiresAt <= now || this.routeCache.size >= this.cacheMaxEntries) {
          this.routeCache.delete(cachedKey);
        }
      }
    }
    this.routeCache.set(key, {
      distanceKm,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}
