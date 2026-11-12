# MoveFlow Unified Map Architecture

## 1. Overview and Core Principles

MoveFlow features an integrated, independent mapping and routing stack designed for last-mile delivery operations without commercial API vendor lock-in or recurring per-request licensing costs.

```
+-------------------------------------------------------------------------------+
|                                MoveFlow Web SPA                               |
|               (MapLibre GL v4.7.1 + GeoJSON Reactive Sources)                 |
+-------------------------------------------------------------------------------+
        |                                       |                        ^
        | Geocoding Search & Reverse            | Route & State Sync     | Live Driver GPS
        v                                       v                        |
+-------------------------------------------------------------------------------+
|                            MoveFlow API (NestJS)                              |
|  - /api/v1/geocoding/search & /reverse                                        |
|  - /api/v1/pricing/quote (OSRM routing + versioned pricing rules)             |
|  - /api/v1/shipments/:id/navigation (Two-stage route & geofence evaluation)   |
|  - /api/v1/shipments/:id/live (Authorized driver live location)               |
|  - /api/v1/drivers/me/location (Throttled GPS ingestion)                      |
+-------------------------------------------------------------------------------+
        |                         |                         |
        v                         v                         v
+------------------+    +------------------+    +-------------------------------+
|  OSRM Routing    |    |    Nominatim     |    |   PostGIS / PostgreSQL 16     |
| (Driving Engine) |    | (Geocoding API)  |    | - Spatial ST_Distance/ST_DWithin |
+------------------+    +------------------+    | - Row-level locked state machine |
                                                +-------------------------------+
```

---

## 2. Component Architecture

### A. Rendering Engine: MapLibre GL
- Replaced legacy Leaflet with vendored **MapLibre GL (`v4.7.1`)** (`apps/web/vendor/maplibre-gl/`).
- Reactive GeoJSON architecture:
  - Three dedicated sources: `endpoints` (pickup A & dropoff B markers), `driver` (driver GPS puck with accuracy halo), and `route` (OSRM LineString geometry).
  - Map instances are mounted once and updated reactively via `setData()`; maps and layers are never torn down and recreated on position changes.

### B. Single Source of Truth for Routing: OSRM
- All distance calculations, turn-by-turn routing, and fee estimations use **Project OSRM (driving profile)**.
- Eliminates parallel distance calculators (e.g. Euclidean or Haversine differences vs road network).
- Backend caches route geometries and distances to optimize throughput.

### C. Self-Hosted Geocoding Proxy
- `/api/v1/geocoding/search` and `/reverse` wrap Nominatim with:
  - Vietnamese administrative hierarchy normalization (`house_number`, `road`, `ward`/`quarter`, `district`, `city`).
  - Local in-memory caching (24 hours TTL, up to 1,000 items).
  - 5-second timeout with resilient 503 fallback when geocoding is unavailable.

---

## 3. Two-Stage Delivery Lifecycle & Geofence Protection

MoveFlow enforces a strict two-stage state machine:

```
[RECEIVED / EN_ROUTE_PICKUP]
          |
          | Driver within 100m geofence (accuracy <= 50m, age <= 30s)
          v
   [ARRIVED_PICKUP]
          |
          | Driver confirms package receipt
          v
  [OUT_FOR_DELIVERY]
          |
          | Driver within 100m geofence (accuracy <= 50m, age <= 30s)
          v
   [ARRIVED_DROPOFF]
          |
          +---> [DELIVERED] (Success)
          |
          +---> [DELIVERY_FAILED] (Package undeliverable with recorded reason)
```

### Route Isolation & Geofence Enforcement
1. **Pickup-Before-Dropoff Isolation**: While a shipment is in phase `TO_PICKUP`, `/api/v1/shipments/:id/navigation` only provides driver $\to$ pickup A route geometry. Dropoff destination B and dropoff route geometry are never disclosed to the driver until pickup is confirmed.
2. **Backend-Enforced Geofence**: Transitions to `ARRIVED_PICKUP` and `ARRIVED_DROPOFF` are strictly guarded by backend PostGIS spatial evaluation:
   - Distance to destination $\le 100$ meters.
   - GPS fix accuracy $\le 50$ meters.
   - GPS timestamp age $\le 30$ seconds.

---

## 4. GPS Throttling & Rerouting

To prevent server flooding while maintaining responsive navigation, client-side GPS uploads follow adaptive throttling:
- **Minimum Upload Interval**: 5 seconds.
- **Minimum Distance Delta**: 15 meters.
- **Stationary Heartbeat**: Exactly 1 upload every 60 seconds if stationary.
- **Off-Route Detection**: Evaluated against the active route using 75-meter perpendicular distance. If off-route persists for $\ge 20$ seconds, the client automatically requests route recalculation.

---

## 5. Security & Privacy

1. **Live Tracking Authorization (`GET /api/v1/shipments/:id/live`)**:
   - Only the shipment owner (Sender), assigned Driver, Dispatcher, and Admin are authorized. Unrelated accounts receive `403 Forbidden`.
   - Driver location coordinates are wiped and returned as `null` as soon as the shipment enters any terminal state (`DELIVERED`, `DELIVERY_FAILED`, `CANCELLED`).
   - Public tracking (`/api/v1/tracking/:code`) exposes lifecycle timestamps only and never returns driver coordinates.
2. **Content Security Policy (CSP)**:
   - Nginx enforces strict CSP restricting script, style, worker, and map asset loading to same-origin and self-hosted services.
3. **Proxy Trust**:
   - NestJS adapter configures `trust proxy` for client IP rate limiting behind reverse proxies.
