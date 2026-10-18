import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { configure } from "../../src/bootstrap";
import { PrismaService } from "../../src/database/prisma.service";
import { PricingService } from "../../src/modules/pricing/pricing.service";
import { ShipmentsService } from "../../src/modules/shipments/shipments.service";
import { DispatchService } from "../../src/modules/dispatch/dispatch.service";
import { WebhooksService } from "../../src/modules/webhooks/webhooks.service";

type Role = "SENDER" | "DRIVER" | "DISPATCHER" | "ADMIN";
const ROLES: Role[] = ["SENDER", "DRIVER", "DISPATCHER", "ADMIN"];
const ids: Record<Role, string> = {
  SENDER: "00000000-0000-4000-8000-000000000001",
  DRIVER: "00000000-0000-4000-8000-000000000002",
  ADMIN: "00000000-0000-4000-8000-000000000003",
  DISPATCHER: "00000000-0000-4000-8000-000000000004",
};
const UUID = "00000000-0000-4000-8000-0000000000aa";

// [method, path, roles that are allowed] - taken from the @Roles decorators in the controllers.
const ENDPOINTS: [string, string, Role[]][] = [
  ["post", "/pricing/quote", ["SENDER", "ADMIN"]],
  ["get", "/admin/pricing-rules", ["ADMIN"]],
  ["put", "/admin/pricing-rules/:id", ["ADMIN"]],
  ["post", "/shipments", ["SENDER", "ADMIN"]],
  ["get", "/shipments", ["SENDER", "ADMIN", "DISPATCHER"]],
  ["get", "/shipments/:id", ["SENDER", "ADMIN", "DISPATCHER", "DRIVER"]],
  ["post", "/shipments/:id/transition", ["DRIVER", "ADMIN"]],
  ["post", "/shipments/:id/assign-driver", ["DISPATCHER", "ADMIN"]],
  ["post", "/assignments/:id/respond", ["DRIVER"]],
  ["get", "/dispatch/queue", ["DISPATCHER", "ADMIN"]],
  ["get", "/drivers/me/tasks", ["DRIVER"]],
  ["patch", "/drivers/me/location", ["DRIVER"]],
  ["patch", "/drivers/me/status", ["DRIVER"]],
  ["post", "/webhooks/subscriptions", ["ADMIN"]],
  ["get", "/webhooks/events", ["ADMIN"]],
];

const stub = (...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, jest.fn().mockResolvedValue({})]));

describe("QA: RBAC matrix (15 endpoints x anonymous + 4 roles)", () => {
  let app: INestApplication;
  let jwt: JwtService;
  const db: any = {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-used-only-in-automated-tests";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(PricingService)
      .useValue(stub("quote", "listRules", "revise"))
      .overrideProvider(ShipmentsService)
      .useValue(stub("create", "list", "get", "transition", "tracking"))
      .overrideProvider(DispatchService)
      .useValue(stub("assign", "respond", "queue", "tasks", "location", "status"))
      .overrideProvider(WebhooksService)
      .useValue(stub("subscribe", "events"))
      .compile();
    app = moduleRef.createNestApplication();
    configure(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.user.findUnique.mockImplementation(async ({ where }: any) => {
      const role = ROLES.find((r) => ids[r] === where.id);
      return role ? { id: where.id, role, active: true } : null;
    });
  });

  const token = (role: Role) => jwt.sign({ sub: ids[role], role });
  const call = (method: string, path: string, bearer?: string) => {
    let r = (request(app.getHttpServer()) as any)[method](
      `/api/v1${path.replace(":id", UUID)}`,
    );
    if (bearer) r = r.set("Authorization", `Bearer ${bearer}`);
    return method === "get" ? r : r.send({});
  };

  describe.each(ENDPOINTS)("%s %s", (method, path, allowed) => {
    it("no token -> 401", async () => {
      expect((await call(method, path)).status).toBe(401);
    });

    it.each(ROLES)("role %s", async (role) => {
      const status = (await call(method, path, token(role))).status;
      if (allowed.includes(role)) {
        // Allowed roles may still get 400 (empty body) or 200, but never 401/403.
        expect([401, 403]).not.toContain(status);
      } else {
        expect(status).toBe(403);
      }
    });
  });
});
