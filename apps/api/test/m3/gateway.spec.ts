import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configure } from "../../src/bootstrap";
import { PrismaService } from "../../src/database/prisma.service";
import { AuthService } from "../../src/modules/auth/auth.service";
import { DispatchService } from "../../src/modules/dispatch/dispatch.service";
import { PricingService } from "../../src/modules/pricing/pricing.service";
import { ShipmentsService } from "../../src/modules/shipments/shipments.service";
import { WebhooksService } from "../../src/modules/webhooks/webhooks.service";

const credentials = { email: "user@test.local", password: "any-password" };

async function start(env: Record<string, string> = {}) {
  process.env.JWT_SECRET = "test-secret-used-only-in-automated-tests";
  delete process.env.TRUST_PROXY_HOPS;
  Object.assign(process.env, env);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ $disconnect: jest.fn(), $queryRaw: jest.fn() })
    .overrideProvider(AuthService)
    .useValue({ login: async () => ({ ok: true }) })
    .overrideProvider(PricingService)
    .useValue({})
    .overrideProvider(ShipmentsService)
    .useValue({ tracking: async () => ({ status: "RECEIVED" }) })
    .overrideProvider(DispatchService)
    .useValue({})
    .overrideProvider(WebhooksService)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication();
  configure(app);
  await app.init();
  return app;
}

describe("API gateway", () => {
  let app: INestApplication;
  const login = (forwardedFor?: string) => {
    const call = request(app.getHttpServer()).post("/api/v1/auth/login");
    if (forwardedFor) void call.set("X-Forwarded-For", forwardedFor);
    return call.send(credentials);
  };
  const exhaustLoginLimit = async (forwardedFor?: string) => {
    for (let attempt = 0; attempt < 8; attempt++)
      await login(forwardedFor).expect(200);
  };

  afterEach(async () => {
    await app.close();
    delete process.env.TRUST_PROXY_HOPS;
  });

  describe("behind one trusted proxy", () => {
    beforeEach(async () => {
      app = await start({ TRUST_PROXY_HOPS: "1" });
    });

    it("limits each client on its own", async () => {
      await exhaustLoginLimit("203.0.113.1");
      await login("203.0.113.1").expect(429);
      await login("203.0.113.2").expect(200);
    });

    it("keys on the address nginx appended, not one the client forged", async () => {
      await exhaustLoginLimit("198.51.100.1, 203.0.113.1");
      await login("198.51.100.99, 203.0.113.1").expect(429);
    });
  });

  describe("reached directly", () => {
    beforeEach(async () => {
      app = await start();
    });

    it("ignores X-Forwarded-For so a client cannot dodge the limit", async () => {
      await exhaustLoginLimit("203.0.113.1");
      await login("203.0.113.2").expect(429);
    });

    it("limits public tracking to 30 requests a minute", async () => {
      const lookup = () =>
        request(app.getHttpServer()).get("/api/v1/tracking/ABCDEF1234567890");
      for (let attempt = 0; attempt < 30; attempt++) await lookup().expect(200);
      await lookup().expect(429);
    });

    it("sets security headers and only allows the declared origin", async () => {
      const lookup = (origin: string) =>
        request(app.getHttpServer())
          .get("/api/v1/tracking/ABCDEF1234567890")
          .set("Origin", origin);
      const allowed = await lookup("http://localhost:3000");
      expect(allowed.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
      const other = await lookup("http://evil.example");
      expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  it("refuses to start with an invalid proxy setting", async () => {
    await expect(start({ TRUST_PROXY_HOPS: "many" })).rejects.toThrow(
      "TRUST_PROXY_HOPS",
    );
    app = await start();
  });
});
