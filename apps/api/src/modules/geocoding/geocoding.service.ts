import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

export type GeocodedAddress = {
  label: string;
  lat: number;
  lng: number;
  address: { line: string; ward: string; district: string; city: string };
  attribution: string;
};

type CachedResult<T> = {
  data: T;
  expiresAt: number;
};

export const OSM_ATTRIBUTION =
  "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright";

export function normalizeNominatimResult(item: any): GeocodedAddress {
  if (!item || typeof item !== "object") {
    throw new BadRequestException("Invalid upstream address object");
  }

  const addr = item.address || {};

  // line: house_number + road (or fallback to pedestrian/amenity/suburb/name)
  const lineParts: string[] = [];
  if (addr.house_number) lineParts.push(String(addr.house_number).trim());
  if (addr.road) lineParts.push(String(addr.road).trim());
  else if (addr.pedestrian) lineParts.push(String(addr.pedestrian).trim());
  else if (addr.amenity) lineParts.push(String(addr.amenity).trim());

  const line =
    lineParts.length > 0 ? lineParts.join(" ") : (item.name ? String(item.name).trim() : "");

  // ward: quarter ?? suburb ?? neighbourhood ?? village ?? ""
  const ward = String(
    addr.quarter ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.village ||
      "",
  ).trim();

  // district: city_district ?? district ?? county ?? ""
  const district = String(
    addr.city_district ||
      addr.district ||
      addr.county ||
      "",
  ).trim();

  // city: city ?? town ?? state ?? province ?? ""
  const city = String(
    addr.city ||
      addr.town ||
      addr.state ||
      addr.province ||
      "",
  ).trim();

  const rawLat = typeof item.lat === "number" ? item.lat : parseFloat(item.lat);
  const rawLng =
    typeof item.lon === "number"
      ? item.lon
      : parseFloat(item.lon ?? item.lng);

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    throw new BadRequestException("Invalid coordinates in geocoding result");
  }

  return {
    label: (
      item.display_name ||
      item.label ||
      line ||
      `${rawLat}, ${rawLng}`
    ).trim(),
    lat: rawLat,
    lng: rawLng,
    address: {
      line,
      ward,
      district,
      city,
    },
    attribution: OSM_ATTRIBUTION,
  };
}

@Injectable()
export class GeocodingService {
  private readonly cache = new Map<string, CachedResult<any>>();
  private readonly inFlight = new Map<string, Promise<any>>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxCacheEntries = 1000;

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private setCache(key: string, data: any): void {
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  private getBaseUrl(): string {
    const raw = (process.env.GEOCODER_BASE_URL ?? "").trim().replace(/\/+$/, "");
    if (!raw) {
      throw new ServiceUnavailableException("Geocoding service is not configured");
    }
    try {
      const url = new URL(raw);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Invalid protocol");
      }
      return url.toString().replace(/\/+$/, "");
    } catch {
      throw new ServiceUnavailableException("Invalid GEOCODER_BASE_URL");
    }
  }

  private getTimeoutMs(): number {
    const parsed = parseInt(process.env.GEOCODER_TIMEOUT_MS ?? "5000", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
  }

  async search(q: string, limit = 5): Promise<GeocodedAddress[]> {
    const trimmed = (q ?? "").trim();
    if (trimmed.length < 3 || trimmed.length > 200) {
      throw new BadRequestException("Query must be between 3 and 200 characters");
    }

    const boundLimit = Math.min(Math.max(limit || 5, 1), 5);
    const cacheKey = `search:${trimmed.toLowerCase()}:${boundLimit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const task = (async () => {
      const baseUrl = this.getBaseUrl();
      const endpoint = `${baseUrl}/search?q=${encodeURIComponent(trimmed)}&format=jsonv2&addressdetails=1&limit=${boundLimit}&countrycodes=vn`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.getTimeoutMs());

      try {
        const res = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Accept-Language": "vi",
            "User-Agent": "MoveFlow-UnifiedMap/1.0",
          },
        });

        if (!res.ok) {
          if (res.status === 400) {
            throw new BadRequestException("Invalid upstream request");
          }
          throw new ServiceUnavailableException("Geocoding service temporarily unavailable");
        }

        let json: any;
        try {
          json = await res.json();
        } catch {
          throw new ServiceUnavailableException("Invalid JSON response from geocoding upstream");
        }

        if (!Array.isArray(json)) {
          throw new ServiceUnavailableException("Unexpected response from geocoding upstream");
        }

        const normalized: GeocodedAddress[] = [];
        for (const item of json) {
          try {
            normalized.push(normalizeNominatimResult(item));
          } catch {
            // skip invalid individual entries
          }
        }

        this.setCache(cacheKey, normalized);
        return normalized;
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw new ServiceUnavailableException("Geocoding upstream timeout");
        }
        if (
          err instanceof BadRequestException ||
          err instanceof ServiceUnavailableException
        ) {
          throw err;
        }
        throw new ServiceUnavailableException("Geocoding upstream error");
      } finally {
        clearTimeout(timer);
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, task);
    return task;
  }

  async reverse(lat: number, lng: number): Promise<GeocodedAddress> {
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException("Invalid coordinates for reverse geocoding");
    }

    const cacheKey = `reverse:${lat.toFixed(6)}:${lng.toFixed(6)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const task = (async () => {
      const baseUrl = this.getBaseUrl();
      const endpoint = `${baseUrl}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.getTimeoutMs());

      try {
        const res = await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Accept-Language": "vi",
            "User-Agent": "MoveFlow-UnifiedMap/1.0",
          },
        });

        if (!res.ok) {
          if (res.status === 400) {
            throw new BadRequestException("Invalid upstream reverse geocoding request");
          }
          throw new ServiceUnavailableException("Geocoding service temporarily unavailable");
        }

        let json: any;
        try {
          json = await res.json();
        } catch {
          throw new ServiceUnavailableException("Invalid JSON response from geocoding upstream");
        }

        if (!json || typeof json !== "object" || json.error) {
          throw new NotFoundException("No address found at coordinates");
        }

        const normalized = normalizeNominatimResult(json);
        this.setCache(cacheKey, normalized);
        return normalized;
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw new ServiceUnavailableException("Geocoding upstream timeout");
        }
        if (
          err instanceof BadRequestException ||
          err instanceof NotFoundException ||
          err instanceof ServiceUnavailableException
        ) {
          throw err;
        }
        throw new ServiceUnavailableException("Geocoding upstream error");
      } finally {
        clearTimeout(timer);
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, task);
    return task;
  }
}
