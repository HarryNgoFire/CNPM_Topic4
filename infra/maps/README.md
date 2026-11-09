# MoveFlow Self-Hosted Map Infrastructure

MoveFlow supports an opt-in self-hosted map stack using Docker Compose:
- **TileServer GL (`v4.11.0`)**: Self-hosted vector map tiles and GL styles.
- **Project OSRM Backend (`v5.27.1`)**: Fast Multi-Level Dijkstra (MLD) road routing engine.
- **Nominatim (`5.3`)**: OpenStreetMap geocoding and reverse geocoding API.

This infrastructure is completely decoupled from the application database and does not require commercial tokens or external API subscriptions.

---

## 1. Prerequisites and Planning

> **Important**: Never attempt a full-planet OSM import on a local development machine or standard single server. Only use regional extracts (e.g. Vietnam from Geofabrik).

### Estimated Resource Requirements (Vietnam Regional Extract)

| Component | Disk Space | RAM Required | Preparation Time |
|-----------|------------|--------------|------------------|
| **OSM PBF Source** | ~200 - 300 MB | - | - |
| **TileServer (MBTiles)** | ~1.5 - 3 GB | ~1 - 2 GB | Immediate (pre-built) |
| **OSRM MLD Dataset** | ~1 - 2 GB | ~2 - 4 GB | ~5 - 15 minutes |
| **Nominatim PostgreSQL** | ~15 - 25 GB | ~4 - 8 GB | ~1 - 3 hours |

---

## 2. Directory Layout

Datasets are mounted into the services via `./infra/maps/`:

```
infra/maps/
├── README.md
├── tileserver/
│   ├── config.json
│   ├── styles/
│   │   └── moveflow.json
│   └── data/
│       ├── .gitkeep
│       └── vietnam.mbtiles     # OpenMapTiles MBTiles archive
├── osrm/
│   └── data/
│       ├── .gitkeep
│       ├── map.osrm
│       └── map.osrm.*          # Extracted and partitioned MLD graph
└── nominatim/
    └── data/
        ├── .gitkeep
        └── vietnam-latest.osm.pbf
```

---

## 3. Data Preparation Steps

### A. Download Regional Extract
Download the latest verified extract for Vietnam:
```bash
# Source: Geofabrik Asia / Vietnam
curl -fL -o infra/maps/nominatim/data/vietnam-latest.osm.pbf \
  https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
```

### B. Prepare OSRM Road Routing (MLD Profile)
Extract and partition the graph using the official OSRM image with the car/driving profile:
```bash
docker run -t -v "$(pwd)/infra/maps/osrm/data:/data" \
  -v "$(pwd)/infra/maps/nominatim/data:/source:ro" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-extract \
  -p /opt/car.lua /source/vietnam-latest.osm.pbf

# Rename to map.osrm if needed
mv infra/maps/osrm/data/vietnam-latest.osrm infra/maps/osrm/data/map.osrm

docker run -t -v "$(pwd)/infra/maps/osrm/data:/data" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-partition /data/map.osrm

docker run -t -v "$(pwd)/infra/maps/osrm/data:/data" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-customize /data/map.osrm
```

### C. Import Nominatim Geocoding Database
Initialize the persistent PostgreSQL schema inside Nominatim:
```bash
docker compose -f compose.yaml -f compose.maps.yaml run --rm nominatim \
  nominatim import --osm-file /data/vietnam-latest.osm.pbf
```

### D. Acquire Vector Map Tiles
Place a compatible `vietnam.mbtiles` archive (OpenMapTiles schema v3) into `infra/maps/tileserver/data/vietnam.mbtiles`.

---

## 4. Running the Stack

To start MoveFlow alongside the self-hosted map stack:

```bash
docker compose -f compose.yaml -f compose.maps.yaml up -d
```

### Environment Configuration
In `.env`:
```env
OSRM_BASE_URL=http://osrm:5000
GEOCODER_BASE_URL=http://nominatim:8080
```

Nginx proxies vector tiles and MapLibre styles:
- Style JSON: `http://localhost:3005/maps/styles/moveflow/style.json`
- Tile endpoint: `http://localhost:3005/maps/data/v3/{z}/{x}/{y}.pbf`
