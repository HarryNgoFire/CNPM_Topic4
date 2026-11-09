# MoveFlow Map Operations Guide

## 1. Operating Modes

MoveFlow can operate in two primary deployment topologies:

### Mode A: Lightweight / Hosted Backend Mode (Default)
In this mode, MoveFlow uses public/shared OSRM and Nominatim endpoints, which is suitable for local development, testing, and low-volume staging.
- `OSRM_BASE_URL=https://router.project-osrm.org`
- `GEOCODER_BASE_URL=https://nominatim.openstreetmap.org`

### Mode B: Fully Self-Hosted Air-Gapped Mode
In this mode, all routing, geocoding, and map tile serving run within the local Docker network via `compose.maps.yaml`:
- `OSRM_BASE_URL=http://osrm:5000`
- `GEOCODER_BASE_URL=http://nominatim:8080`
- Nginx proxies vector tiles via `http://localhost:3005/maps/`

---

## 2. Docker Compose Management

### Starting Services
```bash
# Standard application services only
docker compose up -d

# Application + Self-Hosted Map Stack
docker compose -f compose.yaml -f compose.maps.yaml up -d
```

### Checking Configuration & Health
```bash
# Validate Compose files
docker compose -f compose.yaml -f compose.maps.yaml config

# Check container health status
docker compose ps
```

Healthcheck endpoints:
- **API**: `http://localhost:3001/api/v1/health`
- **TileServer GL**: `http://localhost:8080/health` (internal)
- **OSRM**: Port 5000 (TCP probe)
- **Nominatim**: `http://localhost:8080/status` (internal)

---

## 3. Dataset Maintenance & Ingestion

### Updating Regional OSM Data (Quarterly / Monthly Cadence)

1. **Download Extract**:
   ```bash
   curl -fL -o infra/maps/nominatim/data/vietnam-latest.osm.pbf \
     https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
   ```

2. **Rebuild OSRM MLD Graph**:
   ```bash
   docker run -t -v "$(pwd)/infra/maps/osrm/data:/data" \
     -v "$(pwd)/infra/maps/nominatim/data:/source:ro" \
     ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-extract \
     -p /opt/car.lua /source/vietnam-latest.osm.pbf

   mv infra/maps/osrm/data/vietnam-latest.osrm infra/maps/osrm/data/map.osrm

   docker run -t -v "$(pwd)/infra/maps/osrm/data:/data" \
     ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-partition /data/map.osrm

   docker run -t -v "$(pwd)/infra/maps/osrm/data:/data" \
     ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-customize /data/map.osrm
   ```

3. **Restart OSRM Container**:
   ```bash
   docker compose -f compose.yaml -f compose.maps.yaml restart osrm
   ```

---

## 4. Troubleshooting & Common Operational Errors

### Geocoding Service Unavailable (503)
- **Symptom**: Client receives `503 Service Unavailable` on `/api/v1/geocoding/search`.
- **Cause**: `GEOCODER_BASE_URL` is empty, or the upstream Nominatim service timed out (>5 seconds).
- **Remediation**: Check Nominatim logs with `docker compose logs nominatim`. The system gracefully falls back to direct manual coordinate selection on the map.

### Geofence Arrival Rejection (409)
- **Symptom**: Driver transitions to `ARRIVED_PICKUP` or `ARRIVED_DROPOFF` fail with `409 Conflict`.
- **Cause**: Driver GPS coordinates are $>100$ meters from destination, accuracy is $>50$ meters, or GPS timestamp is $>30$ seconds old.
- **Remediation**: In the driver app UI, verify device GPS signal. Ensure high-accuracy location mode is enabled in the mobile browser.

### Map Tile 404 / Grey Background
- **Symptom**: MapLibre initializes with a solid background and tiles fail to render.
- **Cause**: `vietnam.mbtiles` is missing in `infra/maps/tileserver/data/`, or Nginx `/maps/` location block is not properly proxying to `tileserver:8080`.
- **Remediation**: Verify `infra/maps/tileserver/config.json` paths and ensure `compose.maps.yaml` is included when running Docker Compose.
