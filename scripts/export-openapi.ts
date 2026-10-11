import "reflect-metadata";
import { writeFileSync, mkdirSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../apps/api/src/app.module";
import { configure, openapi } from "../apps/api/src/bootstrap";
async function main() {
  // Export performs no network calls. This value is confined to the export process.
  process.env.JWT_SECRET ??= "openapi-export-only-not-a-runtime-secret";
  const app = await NestFactory.create(AppModule, { logger: false });
  configure(app);
  mkdirSync("docs/api", { recursive: true });
  writeFileSync(
    "docs/api/openapi.json",
    JSON.stringify(openapi(app), null, 2) + "\n",
  );
  await app.close();
}
void main();
