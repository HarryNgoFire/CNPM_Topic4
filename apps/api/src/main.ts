import "reflect-metadata";
import "./common/environment";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { configure, openapi } from "./bootstrap";
async function main() {
  const app = await NestFactory.create(AppModule);
  configure(app);
  SwaggerModule.setup("api/docs", app, openapi(app));
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}
void main();
