import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PointDto } from "../../common/dto";

export type GoogleRouteDistance = {
  distanceKm: number;
  distanceSource: "GOOGLE_ROUTES_TWO_WHEELER" | "GOOGLE_ROUTES_DRIVE";
};

/**
 * Calls Google Routes API from the backend so the API key is never exposed to
 * the browser. A null result means the key is not configured and the pricing
 * service may use its explicitly labelled local-development fallback.
 */
@Injectable()
export class GoogleRoutesService {
  async getDistance(
    origin: PointDto,
    destination: PointDto,
  ): Promise<GoogleRouteDistance | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      const fallbackSetting =
        process.env.GOOGLE_MAPS_ALLOW_GEODESIC_FALLBACK?.toLowerCase();
      const fallbackAllowed =
        fallbackSetting === "true" ||
        (fallbackSetting !== "false" && process.env.NODE_ENV !== "production");
      if (!fallbackAllowed) {
        throw new ServiceUnavailableException(
          "Google Routes API is required but GOOGLE_MAPS_API_KEY is not configured",
        );
      }
      return null;
    }

    const travelMode = (
      process.env.GOOGLE_MAPS_TRAVEL_MODE ?? "TWO_WHEELER"
    ).toUpperCase();
    if (travelMode !== "TWO_WHEELER" && travelMode !== "DRIVE") {
      throw new ServiceUnavailableException(
        "GOOGLE_MAPS_TRAVEL_MODE must be TWO_WHEELER or DRIVE",
      );
    }

    const parsedTimeout = Number(process.env.GOOGLE_MAPS_ROUTE_TIMEOUT_MS ?? 6000);
    const timeoutMs = Number.isFinite(parsedTimeout)
      ? Math.min(Math.max(parsedTimeout, 1000), 15000)
      : 6000;

    let response: Response;
    try {
      response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: origin.lat,
                  longitude: origin.lng,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.lat,
                  longitude: destination.lng,
                },
              },
            },
            travelMode,
            routingPreference: "TRAFFIC_UNAWARE",
            computeAlternativeRoutes: false,
            units: "METRIC",
            languageCode: "vi",
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        "Google Routes API could not be reached; refusing to quote using an inaccurate fallback",
      );
    }

    if (!response.ok) {
      // Do not expose Google's response body or the API key to callers/logs.
      throw new ServiceUnavailableException(
        `Google Routes API returned HTTP ${response.status}; check API enablement, key restrictions and billing`,
      );
    }

    let payload: { routes?: Array<{ distanceMeters?: unknown }> };
    try {
      payload = (await response.json()) as {
        routes?: Array<{ distanceMeters?: unknown }>;
      };
    } catch {
      throw new ServiceUnavailableException(
        "Google Routes API returned an invalid response",
      );
    }

    const distanceMeters = payload.routes?.[0]?.distanceMeters;
    if (
      typeof distanceMeters !== "number" ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      throw new ServiceUnavailableException(
        "Google Routes API did not return a valid route distance",
      );
    }

    return {
      distanceKm: distanceMeters / 1000,
      distanceSource:
        travelMode === "TWO_WHEELER"
          ? "GOOGLE_ROUTES_TWO_WHEELER"
          : "GOOGLE_ROUTES_DRIVE",
    };
  }
}
