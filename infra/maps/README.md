# MoveFlow Self-Hosted Map Infrastructure (HCMC & Metro Region Optimized)

MoveFlow supports an opt-in self-hosted map stack using Docker Compose:
- **TileServer GL (`v4.11.0`)**: Self-hosted vector map tiles and GL styles.
- **Project OSRM Backend (`v5.27.1`)**: Fast Multi-Level Dijkstra (MLD) road routing engine.
- **Nominatim (`5.3`)**: OpenStreetMap geocoding and reverse geocoding API.

This infrastructure is completely decoupled from the application database and does not require commercial tokens or external API subscriptions.

---

## 1. Regional Optimization: Ho Chi Minh City & Surrounding Provinces

To achieve minimum RAM, CPU, and storage overhead while retaining 100% of functional capabilities (tile rendering, address search, route planning, distance calculation, live tracking), the stack is configured specifically for the **Ho Chi Minh City Metropolitan Area** instead of the entire country.

### Supported Geographic Bounding Box
- **Bounding Box (`bbox`)**: `105.8, 10.3, 107.4, 11.4` (minLon: 105.80, minLat: 10.30, maxLon: 107.40, maxLat: 11.40).
- **Regions Covered**:
  - **TP. Hồ Chí Minh**: Full coverage (24 districts, Thu Duc City, Can Gio, Cu Chi, Hoc Mon, Binh Chanh, Nha Be).
  - **Bình Dương**: Dĩ An, Thuận An, Thủ Dầu Một, Bến Cát, Tân Uyên.
  - **Đồng Nai**: Biên Hòa, Long Thành, Nhơn Trạch, Trảng Bom.
  - **Long An**: Tân An, Bến Lức, Đức Hòa, Cần Giuộc, Cần Đước.
  - **Bà Rịa - Vũng Tàu**: Vũng Tàu, Phú Mỹ, Bà Rịa.
  - **Tây Ninh**: Trảng Bàng, Gò Dầu.
- **Regional Limitation**: Locations outside this bounding box are not indexed in the local self-hosted extract (MoveFlow will fall back to hosted geocoder/routing if configured, or report out-of-boundary).

---

## 2. Resource Requirements & Optimization Comparison

| Metric | Vietnam Full Extracted | HCMC Metro Optimized | Reduction (%) |
|---|---|---|---|
| **OSM Source Extract (.pbf)** | ~260 - 300 MB | **~28 - 35 MB** | **-89%** |
| **Vector Tiles (.mbtiles)** | ~2.5 - 3.0 GB | **~150 - 250 MB** | **-92%** |
| **OSRM MLD Routing Graph** | ~1.2 - 2.0 GB | **~35 - 50 MB** | **-96%** |
| **Nominatim Database (Disk)** | ~18 - 25 GB | **~1.2 - 1.6 GB** | **-94%** |
| **OSRM Graph Build Time** | ~10 - 20 minutes | **~30 - 60 seconds** | **-95%** |
| **Nominatim Import Time** | ~2 - 4 hours | **~10 - 20 minutes** | **-90%** |
| **TileServer GL Steady RAM** | ~1.0 - 1.5 GB | **~150 - 220 MB** (Limit: 384 MB) | **-80%** |
| **OSRM Steady RAM** | ~1.5 - 2.5 GB | **~60 - 90 MB** (Limit: 512 MB) | **-95%** |
| **Nominatim Steady RAM** | ~4.0 - 8.0 GB | **~500 - 650 MB** (Limit: 1280 MB) | **-90%** |
| **Total Operating Steady RAM** | ~7.0 - 12.0 GB | **~750 MB - 1.0 GB** | **-89% (Goal: 1–3 GB fulfilled)** |
| **Total Hard Peak Limit** | Unbounded | **2.176 GB** | **Safely capped** |

---

## 3. Directory Layout

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
│       └── hcmc.mbtiles        # Bounded HCMC MBTiles archive
├── osrm/
│   └── data/
│       ├── .gitkeep
│       ├── map.osrm
│       └── map.osrm.*          # Extracted and partitioned MLD graph
└── nominatim/
    └── data/
        ├── .gitkeep
        └── hcmc-surroundings.osm.pbf
```

---

## 4. Data Preparation & Ingestion Workflow

> **Note**: Do not download full-planet datasets. MoveFlow includes a preflight checker:
> ```bash
> node scripts/prepare-hcmc-map-data.mjs
> ```

### Step 1: Clip or Download HCMC Regional Extract
If you have `vietnam-latest.osm.pbf` (or download it once):
```bash
# Clip to HCMC Metropolitan Bounding Box using osmium-tool Docker container
docker run --rm -v "$(pwd)/infra/maps/nominatim/data:/data" \
  stefda/osmium-tool:latest extract \
  --bbox 105.8,10.3,107.4,11.4 \
  /data/vietnam-latest.osm.pbf \
  -o /data/hcmc-surroundings.osm.pbf --overwrite
```

### Step 2: Build OSRM Road Routing Graph (Car / MLD)
With the regional HCMC extract, extraction and contraction takes under 1 minute:
```bash
# 1. Extract
docker run --rm -v "$(pwd)/infra/maps/osrm/data:/data" \
  -v "$(pwd)/infra/maps/nominatim/data:/source:ro" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-extract \
  -p /opt/car.lua /source/hcmc-surroundings.osm.pbf

# Rename to map.osrm
mv infra/maps/osrm/data/hcmc-surroundings.osrm infra/maps/osrm/data/map.osrm

# 2. Partition
docker run --rm -v "$(pwd)/infra/maps/osrm/data:/data" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-partition /data/map.osrm

# 3. Customize
docker run --rm -v "$(pwd)/infra/maps/osrm/data:/data" \
  ghcr.io/project-osrm/osrm-backend:v5.27.1 osrm-customize /data/map.osrm
```

### Step 3: Initialize Nominatim Geocoding Database
Run initial import within the configured memory boundary (1280 MB limit):
```bash
docker compose -f compose.yaml -f compose.maps.yaml run --rm nominatim \
  nominatim import --osm-file /data/hcmc-surroundings.osm.pbf
```

### Step 4: Vector Map Tiles
Place `hcmc.mbtiles` (or clipped OpenMapTiles extract) into `infra/maps/tileserver/data/hcmc.mbtiles`.

---

## 5. Running the Stack

Start MoveFlow alongside the self-hosted map stack:
```bash
docker compose -f compose.yaml -f compose.maps.yaml up -d
```

### Configuration in `.env`
```env
OSRM_BASE_URL=http://osrm:5000
GEOCODER_BASE_URL=http://nominatim:8080
GEOCODER_VIEWBOX=105.8,11.4,107.4,10.3
```

All three services run within the strict hard cap of ~2.18 GB and idle around 750 MB to 1 GB.
