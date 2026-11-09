# MoveFlow Unified Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented Leaflet/Esri/Google Maps flow with one MapLibre + OpenStreetMap + OSRM system that supports sender A/B selection, two-stage driver navigation, validated GPS updates, authorized live tracking, and opt-in self-hosted map infrastructure.

**Architecture:** Keep the existing vanilla JavaScript frontend, NestJS modular monolith, Prisma/PostgreSQL/PostGIS, transactional outbox, and Docker Compose. One backend `RoutingService` owns all OSRM calls and returns distance, duration, and GeoJSON; frontend feature controllers share one reusable `MapEngine`. The MVP uses lifecycle-aware polling for viewers and throttled GPS writes, while self-hosted TileServer GL, OSRM, and Nominatim run from a separate opt-in Compose file so normal startup never downloads or imports large OSM data.

**Tech Stack:** HTML/CSS/JavaScript, MapLibre GL JS, NestJS 11, TypeScript 5.9, Prisma 7, PostgreSQL 16/PostGIS 3.5, OSRM, Nominatim, TileServer GL, Jest/Supertest, Docker Compose/Nginx.

**Spec:** `C:\Users\Computer\.codex\attachments\fe951cbe-af04-4a35-900b-6342f5a04b76\pasted-text.txt`

## Global Constraints

- Preserve the current HTML/CSS/JavaScript frontend; do not migrate it to React or TypeScript.
- MapLibre GL JS is the only frontend map renderer after migration; remove Leaflet and Esri usage.
- OSRM is the only routing engine; do not keep Google Routes, Google Maps navigation, geodesic fee fallbacks, or parallel distance sources.
- OSRM profile is `driving`; UI and docs must state that it is not guaranteed to model Vietnamese motorbike routing accurately.
- Never silently replace a missing road route with straight-line distance.
- Use `[longitude, latitude]` only at GeoJSON/OSRM boundaries and `{ lat, lng }` in application DTOs; conversion happens in `RoutingService` and `MapEngine` only.
- Preserve authentication, role/ownership checks, fee snapshots, shipment history, assignment constraints, outbox records, and transaction boundaries.
- Keep legacy `IN_TRANSIT` data readable; do not rewrite append-only history rows or destructively remove enum values.
- Do not automatically download/import OSM extracts or start resource-heavy map services. Operators must provide regional files and explicitly opt into `compose.maps.yaml`.
- Do not add a general state framework, frontend build framework, commercial API key, or a second routing abstraction.
- Every non-trivial branch must begin with a failing test. Fix code rather than weakening assertions.
- Do not commit or push unless the user explicitly authorizes commits during execution; the commit labels below are review checkpoints.

## Fixed Runtime Values

- `GPS_MAX_CAPTURE_AGE_SECONDS=120`
- `GPS_MAX_FUTURE_SKEW_SECONDS=30`
- `GPS_MAX_ACCEPTED_ACCURACY_M=200`
- `GPS_GEOFENCE_MAX_ACCURACY_M=50`
- `GPS_MAX_SPEED_MPS=55`
- `GPS_UPDATE_MIN_INTERVAL_MS=5000`
- `GPS_UPDATE_MIN_DISTANCE_M=15`
- `GPS_STATIONARY_HEARTBEAT_MS=60000`
- `ARRIVAL_RADIUS_M=100`
- `REROUTE_MIN_INTERVAL_MS=20000`
- `REROUTE_OFF_ROUTE_M=75`
- `LIVE_TRACKING_POLL_MS=10000`
- `OSRM_ROUTE_TIMEOUT_MS=6000`
- `OSRM_ROUTE_RETRY_COUNT=1`; retry only timeout/network/HTTP 502/503/504, after 150 ms.
- `GEOCODER_TIMEOUT_MS=5000`, search limit 5, query length 3–200, cache TTL 24 hours, max 1,000 entries per process.

## Review Focus

- Concurrent accept/transition requests must create one history/outbox event and must not leave a driver `BUSY` twice; covered in Tasks 3 and 4.
- Old shipments in `RECEIVED`, `IN_TRANSIT`, or `OUT_FOR_DELIVERY` must remain operable after migration; covered in Task 3 integration tests.
- Stale, inaccurate, future-dated, implausibly fast, or unauthorized GPS writes must not affect dispatch/geofencing; covered in Task 4.
- Route/geocoder timeout, invalid JSON, no-route, and browser abort must produce explicit error state without straight-line fallback or stale UI; covered in Tasks 2, 6, and 8.
- Hidden tabs, logout, terminal shipment state, view replacement, and denied GPS permission must stop watchers, polling, and reroute timers; covered in Tasks 9 and 10.

---

## File Structure

### Backend

- `apps/api/src/modules/pricing/routing.service.ts`: the only OSRM adapter and bounded in-process route cache.
- `apps/api/src/modules/pricing/pricing.service.ts`: calculates fees from `RoutingService` output and returns the quote route.
- `apps/api/src/modules/geocoding/*`: Nominatim proxy, normalization, rate limits, and DTO-safe responses.
- `apps/api/src/modules/shipments/shipments.service.ts`: state transitions, ownership, geofence gates, live tracking, and phase-based navigation.
- `apps/api/src/modules/dispatch/dispatch.service.ts`: assignment lifecycle and validated driver location writes.
- `apps/api/src/common/dto.ts`: request-boundary validation only.
- `apps/api/src/common/geo.ts`: pure distance/freshness helpers shared by dispatch and shipment tests.

### Frontend

- `apps/web/map/map-engine.js`: one MapLibre map instance, markers, route source/layer, camera, resize, and destruction.
- `apps/web/map/map-math.js`: pure distance-to-route and movement calculations.
- `apps/web/map/geolocation.js`: permission-aware one-shot and watched geolocation lifecycle.
- `apps/web/map/api-clients.js`: abortable geocoding/quote/navigation/live-tracking calls.
- `apps/web/map/sender-map-controller.js`: A/B selection, search, reverse geocoding, quote route, and sender tracking.
- `apps/web/map/driver-trip-controller.js`: GPS upload, stage route, geofence UI, reroute policy, and cleanup.
- `apps/web/app.js`: authentication and view orchestration; delegates map work to controllers.
- `apps/web/vendor/maplibre-gl/`: pinned distributable and license synchronized from the installed dependency.

### Infrastructure

- `compose.maps.yaml`: explicit self-hosted map stack overlay.
- `infra/maps/tileserver/`: TileServer GL config, style, sprites/fonts references, and data placeholder.
- `infra/maps/osrm/`: prepared-dataset mount contract and healthcheck.
- `infra/maps/nominatim/`: local PBF mount contract and persistent data config.
- `infra/maps/README.md`: sizing, license, attribution, data preparation/update, and safe startup.

---

### Task 1: Restore a trustworthy baseline

**Files:**
- Modify: `apps/api/test/qa/rbac-matrix.spec.ts`
- Modify: `apps/api/test/qa/shipments-service.spec.ts`
- Modify: `apps/api/test/shipments.spec.ts`
- Modify: `apps/api/test/pricing.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: current production behavior only; no business-code changes.
- Produces: green unit gate and a `test:baseline` script that excludes integration tests and does not write coverage/cache artifacts.

- [x] **Step 1: Record the current failures**

  Run `npm run typecheck`, `npm run lint`, `npm test`, and `node --check apps/web/app.js`. Preserve the failing suite/test names in the implementation log; expected current unit result is 4 failed suites and 7 passed suites.

- [x] **Step 2: Repair stale security and service fixtures**

  Make the RBAC user fixture include `emailVerified: true`; give shipment fixtures a `pricing.quote` mock; give pricing transaction fixtures `$queryRaw`; change the navigation URL assertion to use an assigned `DRIVER` actor and retain the assertion that a `SENDER` receives `navigationUrls: null`.

- [x] **Step 3: Add the read-only baseline script**

  Add `test:baseline` using Jest `--runInBand --no-cache --testPathIgnorePatterns=integration`; do not enable coverage or touch database state.

- [x] **Step 4: Verify the baseline**

  Run `npm run typecheck && npm run lint && npm run test:baseline && node --check apps/web/app.js`. Expected: all commands exit 0.

- [x] **Checkpoint:** `test: restore reliable baseline fixtures`

### Task 2: Replace parallel route code with one OSRM `RoutingService`

**Files:**
- Create: `apps/api/src/modules/pricing/routing.service.ts`
- Create: `apps/api/test/routing.spec.ts`
- Modify: `apps/api/src/modules/pricing/pricing.module.ts`
- Modify: `apps/api/src/modules/pricing/pricing.service.ts`
- Modify: `apps/api/src/common/openapi-responses.ts`
- Delete after callers migrate: `apps/api/src/modules/pricing/osrm-routing.service.ts`
- Delete after callers migrate: `apps/api/src/modules/pricing/google-routes.service.ts`
- Delete after callers migrate: `apps/api/src/common/google-maps.ts`
- Replace tests: `apps/api/test/osrm-routing.spec.ts`, `apps/api/test/google-routes.spec.ts`

**Interfaces:**
- Consumes: `PointDto { lat: number; lng: number }`.
- Produces:

```ts
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

RoutingService.getRoute(points: readonly PointDto[]): Promise<RouteResult>
```

- [x] **Step 1: Write failing routing contract tests**

  Cover two and three waypoints, OSRM `lng,lat` ordering, `geometries=geojson`, `overview=full`, distance/duration/LineString parsing, snap distance above 250 m, invalid JSON, `NoRoute`, timeout, retryable 503 followed by success, non-retryable 400, exact-route cache hit, and bounded eviction.

- [x] **Step 2: Run the focused test**

  Run `npm test -w apps/api -- --runTestsByPath test/routing.spec.ts --runInBand --no-cache`. Expected: FAIL because `RoutingService` does not exist.

- [x] **Step 3: Implement the minimum OSRM adapter**

  Validate 2–10 finite WGS84 points; request one OSRM route with no fallback; convert geometry only at the boundary; coalesce concurrent identical cache misses; apply the fixed timeout/retry/cache limits. Do not expose `OSRM_BASE_URL` or upstream bodies to clients.

- [x] **Step 4: Route pricing through the new service**

  Keep the existing fee formula and snapshot fields; add `distanceMeters`, `durationSeconds`, `geometry`, `source`, and `profile` to the quote response. `distanceKm` must equal `distanceMeters / 1000` from the same result.

- [x] **Step 5: Remove old route implementations**

  Grep the whole repo for `OsrmRoutingService`, `GoogleRoutesService`, `buildGoogleMapsDirectionsUrl`, `GOOGLE_MAPS_`, and Google Maps URLs. Delete old code only after zero production callers remain.

- [x] **Step 6: Verify**

  Run focused routing/pricing tests, then `npm run typecheck && npm run lint && npm run test:baseline`. Expected: all pass.

- [x] **Checkpoint:** `refactor(map): unify routing on OSRM`

### Task 3: Add a backward-compatible delivery state machine

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_two_stage_delivery_state/migration.sql`
- Modify: `apps/api/src/common/dto.ts`
- Modify: `apps/api/src/modules/shipments/shipments.service.ts`
- Modify: `apps/api/src/modules/dispatch/dispatch.service.ts`
- Modify: `apps/api/src/modules/dispatch/dispatch.module.ts`
- Modify: `apps/api/test/qa/state-machine-matrix.spec.ts`
- Modify: `apps/api/test/shipments.spec.ts`
- Modify: `apps/api/test/dispatch.spec.ts`
- Modify: `apps/api/test/workflow.integration.spec.ts`

**Interfaces:**
- Consumes: accepted `DriverAssignment`, `WebhooksService.record`, existing shipment transaction/history.
- Produces: new shipment states `EN_ROUTE_PICKUP`, `ARRIVED_PICKUP`, `ARRIVED_DROPOFF`, `CANCELLED`, `DELIVERY_FAILED`; legacy `IN_TRANSIT` remains readable.

```ts
type ShipmentTransitionRequest = {
  toStatus: ShipmentStatus;
  reason?: string; // required for CANCELLED and DELIVERY_FAILED; trim, 1-255 characters
};
```

- [x] **Step 1: Write the failing transition matrix**

  Assert the normal chain `RECEIVED → EN_ROUTE_PICKUP → ARRIVED_PICKUP → OUT_FOR_DELIVERY → ARRIVED_DROPOFF → DELIVERED`; reject all skips. Assert legacy `IN_TRANSIT → OUT_FOR_DELIVERY`, terminal idempotency, sender cancellation only before acceptance, admin cancellation of nonterminal shipments, and driver failure only during delivery. Require and persist a bounded reason for `CANCELLED` and `DELIVERY_FAILED`; reject a reason on ordinary progress transitions.

- [x] **Step 2: Add a non-destructive enum migration**

  Add enum values only. Do not remove `IN_TRANSIT`, update old history, truncate data, or rewrite fee snapshots. Add SQL comments documenting the compatibility rule.

- [x] **Step 3: Move accept into the shipment lifecycle transaction**

  On the first successful assignment acceptance, atomically set driver `BUSY`, assignment `ACCEPTED`, shipment `EN_ROUTE_PICKUP`, history, and outbox. The same request repeated must return idempotently without a second history/event.

- [x] **Step 4: Centralize terminal cleanup**

  `DELIVERED`, `CANCELLED`, and `DELIVERY_FAILED` must resolve the active assignment and release the driver in the same transaction. Preserve the existing row locks and partial unique indexes.

- [x] **Step 5: Verify old and new rows**

  Integration tests create representative legacy states without changing existing history, then prove each has a valid next action or terminal display path.

- [x] **Step 6: Run gates**

  Run state/dispatch/shipment unit tests and, only against an isolated disposable test database, `npm run test:integration`. Expected: all pass and no non-test database is touched.

- [x] **Checkpoint:** `feat(shipments): add two-stage delivery lifecycle`

### Task 4: Validate and throttle driver GPS at the backend

**Files:**
- Create: `apps/api/src/common/geo.ts`
- Create: `apps/api/test/geo.spec.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_driver_location_metadata/migration.sql`
- Modify: `apps/api/src/common/dto.ts`
- Modify: `apps/api/src/modules/drivers/drivers.controller.ts`
- Modify: `apps/api/src/modules/dispatch/dispatch.service.ts`
- Modify: `apps/api/test/dispatch.spec.ts`
- Modify: `apps/api/test/workflow.integration.spec.ts`

**Interfaces:**
- Consumes:

```ts
export class DriverLocationDto extends PointDto {
  accuracyM: number;
  capturedAt: string;
}
```

- Produces:

```ts
type LocationUpdateResult = {
  accepted: boolean;
  reason?: "TOO_SOON" | "STATIONARY";
  lat: number;
  lng: number;
  capturedAt: string;
  receivedAt: string;
};
```

- [x] **Step 1: Write pure geo tests**

  Pin WGS84 distance around known points, future/stale timestamp limits, maximum accuracy, minimum movement, and speed greater than 55 m/s. Include longitude/latitude reversal as a failing input.

- [x] **Step 2: Write service tests**

  Assert only the authenticated driver can update their row; stale/future/inaccurate/implausibly fast points are rejected; updates inside 5 seconds and under 15 m are ignored; a 60-second stationary heartbeat is accepted; server receipt time and device capture time remain distinct.

- [x] **Step 3: Add location metadata safely**

  Add nullable `locationAccuracyM` and `locationCapturedAt`; retain `lastLocationAt` as server receipt time. Existing drivers remain valid but cannot pass geofence until they submit a fresh accurate point.

- [x] **Step 4: Implement one locked update**

  Lock the driver row, query prior geometry, validate, then update geometry and metadata. A normal client update inside the 5-second/15-metre window returns `200` with `accepted: false`; reserve `429` for repeated requests that exceed the controller's abuse-rate limit. Return `400` for invalid/stale location; do not trust client speed or overwrite a newer capture with an older one.

- [x] **Step 5: Verify**

  Run geo/dispatch tests and the GPS integration cases. Expected: all pass.

- [x] **Checkpoint:** `feat(gps): validate driver location updates`

### Task 5: Make backend navigation phase-aware and geofence-protected

**Files:**
- Modify: `apps/api/src/modules/shipments/shipments.controller.ts`
- Modify: `apps/api/src/modules/shipments/shipments.service.ts`
- Modify: `apps/api/src/modules/pricing/routing.service.ts`
- Modify: `apps/api/src/common/openapi-responses.ts`
- Modify: `apps/api/test/shipments.spec.ts`
- Modify: `apps/api/test/workflow.integration.spec.ts`

**Interfaces:**
- Produces:

```ts
type NavigationPhase = "TO_PICKUP" | "AT_PICKUP" | "TO_DROPOFF" | "AT_DROPOFF" | "COMPLETE";

type NavigationResponse = {
  shipmentId: string;
  shipmentStatus: ShipmentStatus;
  phase: NavigationPhase;
  currentLocation: { lat: number; lng: number; accuracyM: number; capturedAt: string } | null;
  destination: { kind: "PICKUP" | "DROPOFF"; lat: number; lng: number } | null;
  route: RouteResult | null;
  arrival: { eligible: boolean; distanceM: number | null; reason?: string };
};

GET /api/v1/shipments/:id/navigation
```

- [x] **Step 1: Write authorization and phase tests**

  An unrelated driver and unrelated sender receive 403. `EN_ROUTE_PICKUP` returns only A; `ARRIVED_PICKUP` returns no route; `OUT_FOR_DELIVERY` returns only B; terminal states return no route. No response contains both active routes.

- [x] **Step 2: Write geofence transition tests**

  `ARRIVED_PICKUP` and `ARRIVED_DROPOFF` require a location no older than 30 seconds, accuracy at most 50 m, and PostGIS distance at most 100 m. Being inside the radius enables confirmation but never auto-confirms pickup/delivery.

- [x] **Step 3: Implement navigation from persisted truth**

  Load shipment, assigned driver, current location, A/B geometry, and status under existing authorization rules. The backend—not client parameters—selects the destination and calls `RoutingService`.

- [x] **Step 4: Implement guarded transitions**

  Keep the generic transition endpoint but derive whether the requested next state is legal from current server state. Ignore any client-supplied destination/phase/distance.

- [x] **Step 5: Verify**

  Run shipment/navigation unit and integration tests, including two simultaneous arrival requests. Expected: one history/event row.

- [x] **Checkpoint:** `feat(navigation): enforce pickup-before-dropoff`

### Task 6: Add a bounded Nominatim geocoding proxy

**Files:**
- Create: `apps/api/src/modules/geocoding/geocoding.module.ts`
- Create: `apps/api/src/modules/geocoding/geocoding.controller.ts`
- Create: `apps/api/src/modules/geocoding/geocoding.service.ts`
- Create: `apps/api/test/geocoding.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/common/dto.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:

```ts
type GeocodedAddress = {
  label: string;
  lat: number;
  lng: number;
  address: { line: string; ward: string; district: string; city: string };
  attribution: string;
};

GET /api/v1/geocoding/search?q=<3..200 chars>&limit=<1..5>
GET /api/v1/geocoding/reverse?lat=<lat>&lng=<lng>
```

- [x] **Step 1: Write normalization tests**

  Cover Vietnamese `house_number + road`, ward from `quarter/suburb/neighbourhood`, district from `city_district/county`, city from `city/town/state`, missing optional components, malformed coordinates, and Nominatim no-result responses.

- [x] **Step 2: Write upstream failure/cache tests**

  Cover 5-second timeout, invalid JSON, 429/5xx, 24-hour exact-query cache, max 1,000 entries, URL encoding, result limit 5, `countrycodes=vn`, and `Accept-Language=vi`.

- [x] **Step 3: Implement the proxy**

  Use `GEOCODER_BASE_URL` with no public default in production; never expose upstream debug output. Apply auth plus endpoint throttle. Return explicit 503 when unconfigured/unavailable; manual map pinning remains usable.

- [x] **Step 4: Verify**

  Run geocoding tests, typecheck, lint, and baseline tests. Expected: all pass.

- [x] **Checkpoint:** `feat(map): add self-hosted geocoding API`

### Task 7: Introduce the reusable MapLibre engine

**Files:**
- Create: `apps/web/map/map-engine.js`
- Create: `apps/web/map/map-math.js`
- Create: `apps/web/map/geolocation.js`
- Create: `apps/web/map/api-clients.js`
- Create: `apps/web/test/map-math.test.mjs`
- Create: `scripts/sync-web-vendor.mjs`
- Create/generated: `apps/web/vendor/maplibre-gl/maplibre-gl.js`
- Create/generated: `apps/web/vendor/maplibre-gl/maplibre-gl.css`
- Create: `apps/web/vendor/maplibre-gl/LICENSE.txt`
- Modify: `apps/web/index.html`
- Modify: `apps/web/styles.css`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces:

```js
new MapEngine({ container, styleUrl, initialCenter, initialZoom })
await engine.ready()
engine.setEndpoints({ pickup, dropoff })
engine.setDriverLocation(pointOrNull)
engine.setRoute(lineStringOrNull)
engine.fitRelevantPoints({ padding })
engine.resize()
engine.destroy()
```

- [x] **Step 1: Add MapLibre as the one necessary dependency**

  Pin an exact compatible version in the lockfile. `sync-web-vendor.mjs` copies only the distributable JS/CSS/license; it must fail if the installed version differs from the pinned version.

- [x] **Step 2: Test pure map math**

  Using `node:test`, cover haversine movement, point-to-LineString distance, empty/one-point geometry, antimeridian-safe longitude normalization, and 75 m off-route threshold.

- [x] **Step 3: Implement `MapEngine`**

  Create one map per controller lifetime. Add stable GeoJSON sources `endpoints`, `driver`, and `route` once; subsequent changes call `setData()` rather than recreating map/layers. Draggable A/B markers update the endpoints source and invoke callbacks.

- [x] **Step 4: Implement geolocation lifecycle**

  Export `getCurrentPositionOnce(options)` and `startLocationWatch({ onPosition, onError }) -> stop()`. Permission denial, timeout, unavailable GPS, and stale browser callbacks have distinct messages; never return fake coordinates.

- [x] **Step 5: Remove Leaflet bootstrap**

  Replace Leaflet tags in `index.html` with self-hosted MapLibre vendor assets. Do not yet delete old picker code until Task 8 is green.

- [x] **Step 6: Verify**

  Run `npm run test:web`, `node --check` on every new JS module, and open a minimal map harness at desktop/mobile widths. Record WebGL initialization failure as an explicit error state.

- [x] **Checkpoint:** `feat(map): add reusable MapLibre engine`

### Task 8: Replace sender A/B selection and quote flow

**Files:**
- Create: `apps/web/map/sender-map-controller.js`
- Create: `apps/web/test/sender-map-controller.test.mjs`
- Modify: `apps/web/app.js`
- Modify: `apps/web/styles.css`
- Modify: `apps/web/index.html`
- Modify: `apps/api/test/http.spec.ts`

**Interfaces:**
- Consumes: `MapEngine`, geocoding endpoints, `POST /pricing/quote` with route result.
- Produces:

```js
new SenderMapController({ mapElement, form, api, onQuoteChanged })
await controller.mount()
controller.getBookingPayload()
controller.destroy()
```

- [x] **Step 1: Write controller behavior tests**

  Cover GPS permission granted/denied, GPS auto-fills A once, manual A override, search result selection, reverse geocode after drag, A/B route rendering, quote distance/ETA/fee, coordinate preservation when text is unchanged, and coordinate invalidation only when the corresponding address is manually edited.

- [x] **Step 2: Add abortable search and quote clients**

  Search waits 350 ms and aborts the prior request. Quote aborts the prior request when A/B changes. An aborted response must never overwrite a newer route or address.

- [x] **Step 3: Replace the modal picker with one responsive map**

  Mount one map in the shipment form; show draggable A/B markers, separate search controls, GPS-for-A action, route layer, km, ETA, fee, loading/error/empty states, and OSM attribution. Reuse valid coordinates when submitting.

- [x] **Step 4: Delete the Leaflet picker**

  Remove `pickerMap`, `openAddressPicker`, Leaflet checks, Esri URLs, and old Google navigation copy only after sender tests and manual flow pass. Grep must find no `Leaflet`, `window.L`, `arcgisonline`, or Esri runtime reference.

- [x] **Step 5: Verify sender acceptance**

  In a browser: select/search/drag A/B, see one A→B route, km, ETA and fee, submit without repinning, reload detail, and confirm persisted coordinates. Test 360×800 and 1440×900.

- [x] **Checkpoint:** `feat(sender-map): add A/B route and geocoding`

### Task 9: Implement the driver two-stage trip controller

**Files:**
- Create: `apps/web/map/driver-trip-controller.js`
- Create: `apps/web/test/driver-trip-controller.test.mjs`
- Modify: `apps/web/app.js`
- Modify: `apps/web/styles.css`
- Modify: `apps/api/test/http.spec.ts`

**Interfaces:**
- Consumes: GPS watch, location PATCH, navigation GET, guarded transition POST.
- Produces:

```js
new DriverTripController({ mapElement, shipmentId, api, clock })
await controller.mount()
controller.destroy()
```

- [x] **Step 1: Write phase UI tests**

  `TO_PICKUP` draws driver→A and never B; `AT_PICKUP` removes route and offers pickup confirmation; `TO_DROPOFF` draws driver→B; `AT_DROPOFF` offers delivery confirmation; terminal states stop tracking. A client-crafted phase/destination is never sent to transition endpoints.

- [x] **Step 2: Write GPS throttle/reroute tests**

  Upload at most every 5 seconds and 15 m, plus one 60-second stationary heartbeat. Re-fetch route only on destination/state change, first route, or more than 75 m off route after 20 seconds. Network loss queues only the latest unsent point; reconnect never replays stale points.

- [x] **Step 3: Implement lifecycle-aware tracking**

  Start `watchPosition` only for an accepted active task. Stop it on controller destroy, logout, hidden/terminated task, permission loss, or terminal response. Show accuracy and last successful server update time.

- [x] **Step 4: Bind backend-controlled transitions**

  Arrival buttons stay disabled until backend `arrival.eligible` is true. Confirmation calls the requested next state, refreshes server navigation, swaps route sources, and never locally advances the phase before success.

- [x] **Step 5: Avoid whole-view rerenders**

  GPS and route changes update MapLibre sources and specific text/button nodes only. The existing 15-second `renderView()` task replacement must not run while a mounted trip controller owns the view.

- [x] **Step 6: Verify driver acceptance**

  Browser test: accept → GPS→A only → arrive A → confirm pickup → GPS→B only → arrive B → deliver → watch stops and driver becomes available. Confirm route B cannot be obtained before pickup by calling APIs directly.

- [x] **Checkpoint:** `feat(driver-map): add guarded two-stage navigation`

### Task 10: Add authorized sender live tracking and synchronize related views

**Files:**
- Modify: `apps/api/src/modules/shipments/shipments.controller.ts`
- Modify: `apps/api/src/modules/shipments/shipments.service.ts`
- Modify: `apps/api/test/shipments.spec.ts`
- Modify: `apps/api/test/workflow.integration.spec.ts`
- Modify: `apps/web/map/sender-map-controller.js`
- Modify: `apps/web/app.js`
- Modify: `apps/web/test/sender-map-controller.test.mjs`

**Interfaces:**
- Produces:

```ts
type LiveTrackingResponse = {
  shipmentId: string;
  status: ShipmentStatus;
  driver: { lat: number; lng: number; accuracyM: number; capturedAt: string } | null;
  lastUpdatedAt: string | null;
};

GET /api/v1/shipments/:id/live
```

- [ ] **Step 1: Write privacy tests**

  Owner sender, assigned driver, dispatcher, and admin may read live state; unrelated sender/driver receive 403; public tracking never includes driver coordinates; terminal shipments return `driver: null`.

- [ ] **Step 2: Implement bounded live response**

  Return only the assigned active driver's last accepted point and accuracy/timestamp. Do not return user email, phone, driver identity, location history, or coordinates after terminal state.

- [ ] **Step 3: Add lifecycle-aware polling**

  Poll every 10 seconds only on an active authorized shipment detail view and only while `document.visibilityState === "visible"`. Abort on navigation, logout, terminal state, or controller destroy; update only the driver GeoJSON source and last-updated label.

- [ ] **Step 4: Audit every coordinate/map surface**

  Sender create/quote/detail, driver tasks/detail, tracking, dispatcher/admin shipment detail must use shared formatting and MapLibre where a map is actually shown. Public tracking remains timeline-only unless product requirements explicitly authorize a coarse map.

- [ ] **Step 5: Verify**

  Run privacy tests and manually open owner/unrelated sessions. Expected: owner moves, unrelated account never receives coordinates, and no poll remains after leaving the view.

- [ ] **Checkpoint:** `feat(tracking): add authorized live driver location`

### Task 11: Add opt-in self-hosted map infrastructure

**Files:**
- Create: `compose.maps.yaml`
- Create: `infra/maps/tileserver/config.json`
- Create: `infra/maps/tileserver/styles/moveflow.json`
- Create: `infra/maps/tileserver/data/.gitkeep`
- Create: `infra/maps/osrm/data/.gitkeep`
- Create: `infra/maps/nominatim/data/.gitkeep`
- Create: `infra/maps/README.md`
- Modify: `apps/web/nginx.conf`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- `GET /maps/styles/moveflow/style.json` proxies to TileServer GL.
- Backend-only `OSRM_BASE_URL=http://osrm:5000`.
- Backend-only `GEOCODER_BASE_URL=http://nominatim:8080`.
- Operators provide `MAP_TILE_ARCHIVE`, `OSRM_DATASET_BASE`, and `NOMINATIM_PBF_PATH`; no default remote download URL exists.

- [ ] **Step 1: Define the opt-in Compose overlay**

  Pin image versions/digests for TileServer GL, `ghcr.io/project-osrm/osrm-backend`, and `mediagis/nominatim:5.3`. Add healthchecks, read-only dataset mounts where supported, persistent Nominatim data, CPU/memory examples, no public ports by default, and no `PBF_URL`.

- [ ] **Step 2: Configure same-origin tile access**

  Nginx proxies `/maps/` to TileServer GL with immutable cache for versioned PBF/font/sprite assets and short cache for style JSON. Preserve OSM/OpenMapTiles attribution in the style and UI.

- [ ] **Step 3: Document safe data preparation**

  Require a regional extract, record source URL/date/checksum/license, explain OSRM MLD extract/partition/customize, Nominatim address import, tile archive generation/acquisition, update cadence, rollback, and disk/RAM/time estimates. Full-planet import is explicitly unsupported by the local guide.

- [ ] **Step 4: Add preflight-only verification**

  Document commands that check file existence/size/free disk and print planned resource use before any import. They must not download, import, delete, or replace data without an explicit operator command.

- [ ] **Step 5: Verify infrastructure without large imports**

  Run `docker compose -f compose.yaml -f compose.maps.yaml config`. With a deliberately tiny licensed fixture dataset, verify health endpoints, style JSON, one vector tile, one OSRM route, and one geocoder query. Do not claim Vietnam production readiness from the fixture.

- [ ] **Checkpoint:** `feat(infra): add opt-in self-hosted map stack`

### Task 12: Performance, security, contract, and final acceptance gates

**Files:**
- Modify: `apps/web/nginx.conf`
- Modify: `apps/api/src/bootstrap.ts`
- Modify: `docs/api/openapi.json`
- Modify: `docs/USER_GUIDE.md`
- Modify: `docs/DEVELOPER_REVIEW_AND_REMEDIATION.md`
- Create: `docs/maps/architecture.md`
- Create: `docs/maps/operations.md`
- Create: `docs/maps/verification.md`
- Modify: `README.md`
- Modify: `CHANGELOG_MOVEFLOW_UPDATE.md`

**Interfaces:**
- Consumes: all completed map, routing, GPS, state, geocoding, and infrastructure tasks.
- Produces: current OpenAPI, operator/user guides, measured verification evidence, and zero legacy commercial map runtime dependencies.

- [ ] **Step 1: Add security headers and proxy correctness**

  Configure a CSP that permits self-hosted scripts/styles/Web Workers/WebGL assets and same-origin API/maps only. Configure Nest proxy trust for the known Nginx hop so throttling uses the client IP; test direct and proxied behavior.

- [ ] **Step 2: Add browser acceptance tests**

  Cover sender A/B/search/drag/quote/create; driver GPS→A→B; sender authorized live tracking; denied GPS; stale GPS; no route; OSRM/geocoder timeout; logout cleanup; mobile/desktop layouts; and direct API attempts to skip states.

- [ ] **Step 3: Measure request/render/memory behavior**

  Record before/after browser performance evidence: map initialization time, route request count during 5 minutes stationary and moving, tile requests after marker updates, detached map/DOM nodes after 20 mount/destroy cycles, and heap trend. Pass criteria: marker/GPS updates do not reload base tiles, stationary driver sends at most the 60-second heartbeat, reroutes respect 20 seconds, and no active watcher/poll survives destruction.

- [ ] **Step 4: Regenerate and diff OpenAPI**

  Export `docs/api/openapi.json`; assert geocoding, navigation, live tracking, GPS metadata, new states, route geometry, distance, and duration are present. Add a CI check that fails when generated contract differs.

- [ ] **Step 5: Run full gates**

  Run `node --check` for frontend modules, `npm run test:web`, `npm run typecheck`, `npm run lint`, unit tests, integration tests on an isolated test database, `npm run build`, `npm audit`, Docker image build, Compose config, and the small-fixture map smoke flow. Record exact PASS/FAIL/NOT TESTED; do not hide pre-existing or environment failures.

- [ ] **Step 6: Run removal audit**

  Whole-repo grep must find no runtime Leaflet, Esri, Google Maps navigation, Google Routes, public OSRM demo default, dead map button, parallel distance calculator, or commercial API key requirement. Documentation may mention removed behavior only in migration notes.

- [ ] **Step 7: Final documentation and handoff**

  Document changed files, verified behaviors, profile limitations, map data date/region, ODbL/attribution duties, hardware costs as measured/unknown rather than guessed, operational update steps, and every remaining NOT TESTED item.

- [ ] **Checkpoint:** `docs(map): publish verified unified map operations`

---

## Phase Gates

1. **Gate A — Safe backend foundation:** Tasks 1–5 green; no frontend map migration begins while state/routing/GPS contracts are unstable.
2. **Gate B — Sender complete:** Tasks 6–8 green; sender can search/select/drag A/B and receives route, km, ETA, and fee from one OSRM result.
3. **Gate C — Driver complete:** Tasks 9–10 green; API and UI both prevent route B before pickup and stop tracking at terminal state.
4. **Gate D — Self-hostable:** Task 11 passes Compose config and small-fixture smoke without automatic large downloads.
5. **Gate E — Release candidate:** Task 12 full gates pass or each unavailable gate is explicitly `NOT TESTED` with cause.

## Rollback Boundaries

- Task 2 can roll back by restoring the old OSRM adapter before database changes.
- Task 3 migration is additive; rollback code can continue reading new enum strings only if the previous binary understands them, so deploy migration and compatible code together and roll forward rather than removing enum values.
- Task 4 columns are nullable; old code ignores them.
- Frontend Tasks 7–10 should be deployed only after backend endpoints are live; retain no runtime toggle after acceptance because the spec forbids parallel map systems.
- `compose.maps.yaml` is independent of business database volumes; never use `docker compose down -v` as a rollback step.

## Architecture References

- MapLibre supports updating an existing GeoJSON source through `setData`, which is the required route/marker update mechanism: https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/
- OSRM Route API returns route distance, duration, and GeoJSON geometry and fixes profile behavior at dataset preparation time: https://project-osrm.org/docs/v5.24.0/api/
- TileServer GL can serve local MBTiles/PMTiles plus styles, sprites, fonts, and health endpoints: https://github.com/maptiler/tileserver-gl/blob/master/docs/installation.rst
- Nominatim provides search/reverse APIs; reverse output is nearest suitable OSM object and can differ from the clicked parcel entrance: https://nominatim.org/release-docs/latest/api/Reverse/
- Public OSM tiles have no SLA and are not a production/offline dependency; self-hosted regional data is required here: https://operations.osmfoundation.org/policies/tiles/
