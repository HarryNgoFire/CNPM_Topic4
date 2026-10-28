import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { addResponseContracts } from "./common/openapi-responses";
import { DecimalInterceptor } from "./common/serialization";
import { ErrorFilter } from "./common/errors";
export function configure(app: INestApplication) {
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  app.useGlobalInterceptors(new DecimalInterceptor());
  app.enableShutdownHooks();
}
export function openapi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Topic 4 M2 API")
    .setDescription(
      "MoveFlow last-mile delivery API with email verification, pricing, booking, dispatch, tracking, account security and webhooks.",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  doc.openapi = "3.1.0";
  // Decorated DTOs supply request schemas. Response/error contracts are added centrally.
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [verb, operation] of Object.entries(item ?? {})) {
      if (
        !["get", "post", "put", "patch", "delete"].includes(verb) ||
        !operation ||
        typeof operation !== "object" ||
        !("responses" in operation)
      )
        continue;
      const op = operation as any;
      const publicRoute =
        path.includes("/auth/") ||
        path.includes("/tracking/") ||
        path.endsWith("/health");
      if (publicRoute) op.security = [];
      for (const code of ["400", "401", "403", "404", "409", "429", "500"])
        op.responses[code] = {
          description: {
            400: "Input validation failed",
            401: "Authentication failed",
            403: "Insufficient role or ownership",
            404: "Resource not found",
            409: "Business rule conflict",
            429: "Rate limit exceeded",
            500: "Unexpected server failure",
          }[code as "400"],
        };
    }
  }
  return addResponseContracts(doc);
}
