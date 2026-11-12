import { readFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const PINNED_VERSION = "4.7.1";

const rootPkg = JSON.parse(
  readFileSync(resolve(rootDir, "package.json"), "utf8"),
);
const declaredVersion =
  rootPkg.devDependencies?.["maplibre-gl"] ||
  rootPkg.dependencies?.["maplibre-gl"];

if (declaredVersion !== PINNED_VERSION) {
  console.error(
    `[sync-web-vendor] Declared maplibre-gl version '${declaredVersion}' does not match pinned version '${PINNED_VERSION}'`,
  );
  process.exit(1);
}

const installedPkgPath = resolve(
  rootDir,
  "node_modules/maplibre-gl/package.json",
);
if (!existsSync(installedPkgPath)) {
  console.error(
    "[sync-web-vendor] maplibre-gl is not installed in node_modules",
  );
  process.exit(1);
}

const installedPkg = JSON.parse(readFileSync(installedPkgPath, "utf8"));
if (installedPkg.version !== PINNED_VERSION) {
  console.error(
    `[sync-web-vendor] Installed maplibre-gl version '${installedPkg.version}' does not match pinned version '${PINNED_VERSION}'`,
  );
  process.exit(1);
}

const targetDir = resolve(rootDir, "apps/web/vendor/maplibre-gl");
mkdirSync(targetDir, { recursive: true });

const filesToCopy = [
  {
    src: resolve(rootDir, "node_modules/maplibre-gl/dist/maplibre-gl.js"),
    dest: resolve(targetDir, "maplibre-gl.js"),
  },
  {
    src: resolve(rootDir, "node_modules/maplibre-gl/dist/maplibre-gl.css"),
    dest: resolve(targetDir, "maplibre-gl.css"),
  },
  {
    src: resolve(rootDir, "node_modules/maplibre-gl/dist/LICENSE.txt"),
    dest: resolve(targetDir, "LICENSE.txt"),
  },
];

for (const { src, dest } of filesToCopy) {
  if (!existsSync(src)) {
    console.error(`[sync-web-vendor] Missing source asset: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, dest);
  console.log(`[sync-web-vendor] Copied ${src} -> ${dest}`);
}

console.log("[sync-web-vendor] Vendor assets synced successfully.");
