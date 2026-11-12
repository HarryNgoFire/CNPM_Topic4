/**
 * MoveFlow - HCMC Regional Map Preflight & Dataset Helper
 * Validates bounding box, directory fixtures, and calculates resource estimates.
 * DOES NOT download remote files without explicit user action.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const HCMC_BBOX = {
  name: "TP. Hồ Chí Minh & Khu vực giáp ranh (Đông Nam Bộ)",
  provinces: [
    "TP. Hồ Chí Minh (24 quận/huyện & TP. Thủ Đức)",
    "Bình Dương (Dĩ An, Thuận An, Thủ Dầu Một, Bến Cát...)",
    "Đồng Nai (Biên Hòa, Long Thành, Nhơn Trạch...)",
    "Long An (Tân An, Bến Lức, Đức Hòa, Cần Giuộc...)",
    "Bà Rịa - Vũng Tàu (Vũng Tàu, Phú Mỹ, Bà Rịa)",
    "Tây Ninh (Trảng Bàng, Gò Dầu)",
  ],
  minLon: 105.8,
  minLat: 10.3,
  maxLon: 107.4,
  maxLat: 11.4,
  bboxString: "105.8,10.3,107.4,11.4",
  center: [106.663, 10.754],
};

export const RESOURCE_ESTIMATES = {
  vietnamFull: {
    sourcePbfMb: 260,
    mbtilesMb: 2500,
    osrmGraphMb: 1200,
    nominatimDbMb: 24000,
    steadyRamMb: 8500,
    peakRamMb: 12000,
    osrmBuildTimeSec: 900,
    nominatimImportTimeSec: 7200,
  },
  hcmcRegional: {
    sourcePbfMb: 30,
    mbtilesMb: 200,
    osrmGraphMb: 45,
    nominatimDbMb: 1400,
    steadyRamMb: 850,
    peakRamMb: 2100,
    osrmBuildTimeSec: 45,
    nominatimImportTimeSec: 900,
  },
};

export function runPreflightCheck() {
  console.log("===============================================================");
  console.log("MoveFlow Map Preflight: Khu vực TP.HCM & Giáp ranh");
  console.log("===============================================================");
  console.log(`Vùng địa lý: ${HCMC_BBOX.name}`);
  console.log(`Tọa độ Bounding Box: [${HCMC_BBOX.bboxString}]`);
  console.log(`Tâm bản đồ: [${HCMC_BBOX.center.join(", ")}]`);
  console.log("Các tỉnh/thành bao phủ:");
  for (const p of HCMC_BBOX.provinces) {
    console.log(`  - ${p}`);
  }
  console.log("---------------------------------------------------------------");

  const files = {
    nominatimPbf: path.join(rootDir, "infra/maps/nominatim/data/vietnam-latest.osm.pbf"),
    hcmcPbf: path.join(rootDir, "infra/maps/nominatim/data/hcmc-surroundings.osm.pbf"),
    osrmMap: path.join(rootDir, "infra/maps/osrm/data/map.osrm"),
    tileserverMbtiles: path.join(rootDir, "infra/maps/tileserver/data/hcmc.mbtiles"),
    tileserverConfig: path.join(rootDir, "infra/maps/tileserver/config.json"),
    composeMaps: path.join(rootDir, "compose.maps.yaml"),
  };

  console.log("Kiểm tra trạng thái file dữ liệu nội bộ:");
  for (const filePath of Object.values(files)) {
    const rel = path.relative(rootDir, filePath);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
      console.log(`  [OK] ${rel} (${sizeMb} MB)`);
    } else {
      console.log(`  [CHƯA CÓ] ${rel}`);
    }
  }

  console.log("---------------------------------------------------------------");
  console.log("So sánh tài nguyên (Toàn Việt Nam vs TP.HCM & Giáp ranh):");
  const full = RESOURCE_ESTIMATES.vietnamFull;
  const hcm = RESOURCE_ESTIMATES.hcmcRegional;

  console.log(
    `  * Dung lượng PBF:      ${full.sourcePbfMb} MB  -->  ${hcm.sourcePbfMb} MB (-${Math.round((1 - hcm.sourcePbfMb / full.sourcePbfMb) * 100)}%)`,
  );
  console.log(
    `  * Dung lượng MBTiles:  ${full.mbtilesMb} MB -->  ${hcm.mbtilesMb} MB (-${Math.round((1 - hcm.mbtilesMb / full.mbtilesMb) * 100)}%)`,
  );
  console.log(
    `  * OSRM Graph:          ${full.osrmGraphMb} MB -->  ${hcm.osrmGraphMb} MB (-${Math.round((1 - hcm.osrmGraphMb / full.osrmGraphMb) * 100)}%)`,
  );
  console.log(
    `  * Nominatim DB:        ${(full.nominatimDbMb / 1024).toFixed(1)} GB  -->  ${(hcm.nominatimDbMb / 1024).toFixed(1)} GB (-${Math.round((1 - hcm.nominatimDbMb / full.nominatimDbMb) * 100)}%)`,
  );
  console.log(
    `  * RAM vận hành (idle): ${(full.steadyRamMb / 1024).toFixed(1)} GB  -->  ${(hcm.steadyRamMb / 1024).toFixed(1)} GB (-${Math.round((1 - hcm.steadyRamMb / full.steadyRamMb) * 100)}%)`,
  );
  console.log(
    `  * RAM giới hạn (peak): ${(full.peakRamMb / 1024).toFixed(1)} GB  -->  ${(hcm.peakRamMb / 1024).toFixed(1)} GB [Đạt mục tiêu 1–3 GB]`,
  );
  console.log(
    `  * Thời gian build OSRM: ~${full.osrmBuildTimeSec / 60} phút  -->  ~${hcm.osrmBuildTimeSec} giây`,
  );
  console.log("===============================================================");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPreflightCheck();
}
