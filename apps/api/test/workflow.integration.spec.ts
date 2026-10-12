import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { getStorageToken } from "@nestjs/throttler";
import { SchedulerRegistry } from "@nestjs/schedule";
import request from "supertest";
import { createServer, Server } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import { AppModule } from "../src/app.module";
import { configure } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { DispatchService } from "../src/modules/dispatch/dispatch.service";
import { ShipmentsService } from "../src/modules/shipments/shipments.service";
import { WebhooksService } from "../src/modules/webhooks/webhooks.service";
const address = {
  line: "12 Nguyen Trai",
  ward: "1",
  district: "5",
  city: "HCMC",
  lat: 10.754,
  lng: 106.663,
};
const booking = {
  pickupAddress: address,
  dropoffAddress: { ...address, line: "88 Le Loi", lat: 10.772, lng: 106.698 },
  parcel: { weightKg: 5, lengthCm: 30, widthCm: 20, heightCm: 15 },
  serviceType: "EXPRESS" as const,
};
const password = "integration-test-password";
describe("PostgreSQL/PostGIS delivery workflow", () => {
  let app: INestApplication,
    db: PrismaService,
    dispatch: DispatchService,
    shipments: ShipmentsService,
    webhooks: WebhooksService;
  let tokens: Record<string, string>,
    users: Record<string, any>,
    drivers: Record<string, any>;
  let receiver: Server, receiverUrl: string;
  const received: any[] = [];
  let receiverStatus = 200;
  const secret = "integration-webhook-secret-at-least-32-chars";
  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")
    )
      throw new Error(
        "Integration tests require a dedicated DATABASE_URL database ending in _test",
      );
    process.env.JWT_SECRET ??= "integration-jwt-secret-at-least-32-chars";
    process.env.WEBHOOK_ALLOW_HTTP = "true";
    receiver = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const expected =
        "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
      if (req.headers["x-webhook-signature"] !== expected) {
        res.writeHead(401).end();
        return;
      }
      received.push(JSON.parse(body));
      res.writeHead(receiverStatus).end("ok");
    });
    await new Promise<void>((resolve) =>
      receiver.listen(0, "127.0.0.1", resolve),
    );
    const port = (receiver.address() as any).port;
    receiverUrl = `http://127.0.0.1:${port}`;
    process.env.WEBHOOK_ALLOWED_ORIGINS = receiverUrl;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configure(app);
    await app.init();
    const scheduler = app.get(SchedulerRegistry);
    for (const name of scheduler.getIntervals()) scheduler.deleteInterval(name);
    db = app.get(PrismaService);
    dispatch = app.get(DispatchService);
    shipments = app.get(ShipmentsService);
    webhooks = app.get(WebhooksService);
  });
  afterAll(async () => {
    await app?.close();
    if (receiver)
      await new Promise<void>((resolve, reject) =>
        receiver.close((err) => (err ? reject(err) : resolve())),
      );
  });
  it("blocks the retired M2 baseline without changing business data", async () => {
    const script = resolve(__dirname, "../../../scripts/check-migration-history.mjs");
    const check = () => spawnSync(process.execPath, [script], { env: process.env, encoding: "utf8" });
    expect(check().status).toBe(0);
    const userCount = await db.user.count();
    const id = randomUUID();
    await db.$executeRaw`INSERT INTO public._prisma_migrations
      (id, checksum, migration_name, finished_at, applied_steps_count)
      VALUES (${id}, 'integration-test-only', '202610110001_m2_baseline', NOW(), 1)`;
    try {
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("M2_LEGACY_BASELINE");
      expect(await db.user.count()).toBe(userCount);
    } finally {
      await db.$executeRaw`DELETE FROM public._prisma_migrations WHERE id = ${id}`;
    }
    expect(check().status).toBe(0);
  });
  beforeEach(async () => {
    (app.get(getStorageToken()) as any).onApplicationShutdown();
    await db.$executeRawUnsafe(
      'TRUNCATE "WebhookDelivery","WebhookEvent","WebhookSubscription","ShipmentStatusHistory","DriverAssignment","Parcel","Shipment","Address","Driver","RefreshSession","User","PricingRule" CASCADE',
    );
    received.length = 0;
    receiverStatus = 200;
    await db.pricingRule.create({
      data: {
        version: 1,
        baseFee: 15000,
        ratePerKm: 3000,
        freeWeightThreshold: 3,
        ratePerExtraKg: 5000,
        standardMultiplier: 1,
        expressMultiplier: 1.5,
      },
    });
    users = {};
    drivers = {};
    tokens = {};
    const passwordHash = await hash(password, 4);
    for (const [name, role] of [
      ["sender", "SENDER"],
      ["other", "SENDER"],
      ["driverA", "DRIVER"],
      ["driverB", "DRIVER"],
      ["dispatcher", "DISPATCHER"],
      ["admin", "ADMIN"],
    ] as const) {
      users[name] = await db.user.create({
        data: {
          name,
          email: `${name.toLowerCase()}@test.local`,
          passwordHash,
          role,
        },
      });
      if (role === "DRIVER") {
        drivers[name] = await db.driver.create({
          data: { userId: users[name].id, status: "AVAILABLE" },
        });
        const lng = name === "driverA" ? address.lng : address.lng + 0.005;
        await db.$executeRaw`UPDATE "Driver" SET "currentLocation"=ST_SetSRID(ST_MakePoint(${lng},${address.lat}),4326)::geography,"lastLocationAt"=now() WHERE id=${drivers[name].id}::uuid`;
      }
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: users[name].email, password });
      expect(res.status).toBe(200);
      tokens[name] = res.body.accessToken;
    }
  });
  function call(name: string) {
    return {
      post: (path: string) =>
        request(app.getHttpServer())
          .post("/api/v1/" + path)
          .set("Authorization", "Bearer " + tokens[name]),
      get: (path: string) =>
        request(app.getHttpServer())
          .get("/api/v1/" + path)
          .set("Authorization", "Bearer " + tokens[name]),
    };
  }
  async function create() {
    const res = await call("sender").post("shipments").send(booking);
    expect(res.status).toBe(201);
    return res.body;
  }
  async function pending(id: string) {
    return db.driverAssignment.findFirstOrThrow({
      where: { shipmentId: id, status: "PENDING" },
    });
  }
  it("runs booking -> nearest assignment -> delivery -> public timeline -> signed webhook", async () => {
    await call("admin")
      .post("webhooks/subscriptions")
      .send({ url: receiverUrl + "/webhooks", secret })
      .expect(201);
    const shipment = await create();
    expect(Number(shipment.fee)).toBeGreaterThan(15000);
    const assignment = await pending(shipment.id);
    expect(assignment.driverId).toBe(drivers.driverA.id);
    await call("driverA")
      .post(`assignments/${assignment.id}/respond`)
      .send({ action: "ACCEPT" })
      .expect(200);
    for (const toStatus of ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"])
      await call("driverA")
        .post(`shipments/${shipment.id}/transition`)
        .send({ toStatus })
        .expect(200);
    const tracking = await request(app.getHttpServer())
      .get("/api/v1/tracking/" + shipment.trackingCode)
      .expect(200);
    expect(tracking.body.history).toHaveLength(4);
    expect(tracking.body).not.toHaveProperty("senderId");
    expect(tracking.body.pickup).toEqual({ city: "HCMC" });
    expect(
      (await db.driver.findUniqueOrThrow({ where: { id: drivers.driverA.id } }))
        .status,
    ).toBe("AVAILABLE");
    expect(
      await db.driverAssignment.count({
        where: { shipmentId: shipment.id, status: "COMPLETED" },
      }),
    ).toBe(1);
    await webhooks.sendBatch();
    expect(received).toHaveLength(4);
    expect(
      await db.webhookDelivery.count({ where: { status: "DELIVERED" } }),
    ).toBe(4);
  });
  it("calculates zero-distance quote and geography distance in metres", async () => {
    const quote = await call("sender")
      .post("pricing/quote")
      .send({ ...booking, dropoffAddress: address })
      .expect(201);
    expect(quote.body.fee).toBe(37500);
    const result = await db.$queryRaw<
      { meters: number }[]
    >`SELECT ST_Distance(ST_SetSRID(ST_MakePoint(106.663,10.754),4326)::geography,ST_SetSRID(ST_MakePoint(106.698,10.772),4326)::geography) AS meters`;
    expect(result[0].meters).toBeGreaterThan(3000);
    expect(result[0].meters).toBeLessThan(5000);
  });
  it("keeps snapshot after an admin creates a new rule version", async () => {
    const shipment = await create();
    const rule = await db.pricingRule.findFirstOrThrow();
    await request(app.getHttpServer())
      .put("/api/v1/admin/pricing-rules/" + rule.id)
      .set("Authorization", "Bearer " + tokens.admin)
      .send({
        baseFee: 50000,
        ratePerKm: 3000,
        freeWeightThreshold: 3,
        ratePerExtraKg: 5000,
        standardMultiplier: 1,
        expressMultiplier: 1.5,
      })
      .expect(200);
    expect(
      Number(
        (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
          .fee,
      ),
    ).toBe(Number(shipment.fee));
    const next = await call("sender")
      .post("pricing/quote")
      .send(booking)
      .expect(201);
    expect(next.body.fee).toBeGreaterThan(Number(shipment.fee));
    await expect(
      db.shipment.update({ where: { id: shipment.id }, data: { fee: 1 } }),
    ).rejects.toThrow();
  });
  it("reassigns to driver B after driver A rejects", async () => {
    const shipment = await create();
    const assignment = await pending(shipment.id);
    await call("driverA")
      .post(`assignments/${assignment.id}/respond`)
      .send({ action: "REJECT" })
      .expect(200);
    expect((await pending(shipment.id)).driverId).toBe(drivers.driverB.id);
    expect(
      (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
        .status,
    ).toBe("RECEIVED");
  });
  it("expires and reassigns a late response", async () => {
    const shipment = await create();
    const assignment = await pending(shipment.id);
    await db.driverAssignment.update({
      where: { id: assignment.id },
      data: { expiresAt: new Date(0) },
    });
    await call("driverA")
      .post(`assignments/${assignment.id}/respond`)
      .send({ action: "ACCEPT" })
      .expect(409);
    expect((await pending(shipment.id)).driverId).toBe(drivers.driverB.id);
  });
  it("cron expires pending assignments without double creation", async () => {
    const shipment = await create();
    const assignment = await pending(shipment.id);
    await db.driverAssignment.update({
      where: { id: assignment.id },
      data: { expiresAt: new Date(0) },
    });
    await Promise.all([
      dispatch.expireOne(assignment.id),
      dispatch.expireOne(assignment.id),
    ]);
    expect(
      await db.driverAssignment.count({
        where: { shipmentId: shipment.id, status: "PENDING" },
      }),
    ).toBe(1);
  });
  it("permits only one assignment for simultaneous same-shipment requests", async () => {
    const shipment = await shipments.create(booking, {
      sub: users.sender.id,
      role: "SENDER",
    });
    const assignments = await Promise.all([
      dispatch.assign(shipment.id),
      dispatch.assign(shipment.id),
    ]);
    expect((assignments[0] as any).id).toBe((assignments[1] as any).id);
    expect(
      await db.driverAssignment.count({
        where: { shipmentId: shipment.id, status: "PENDING" },
      }),
    ).toBe(1);
  });
  it("reserves one driver at most once across simultaneous shipments", async () => {
    await db.driver.update({
      where: { id: drivers.driverB.id },
      data: { status: "OFFLINE" },
    });
    const first = await shipments.create(booking, {
        sub: users.sender.id,
        role: "SENDER",
      }),
      second = await shipments.create(booking, {
        sub: users.sender.id,
        role: "SENDER",
      });
    await Promise.all([dispatch.assign(first.id), dispatch.assign(second.id)]);
    expect(
      await db.driverAssignment.count({
        where: { driverId: drivers.driverA.id, status: "PENDING" },
      }),
    ).toBe(1);
  });
  it("serializes concurrent transitions without duplicate history/events", async () => {
    const shipment = await create();
    const assignment = await pending(shipment.id);
    await call("driverA")
      .post(`assignments/${assignment.id}/respond`)
      .send({ action: "ACCEPT" })
      .expect(200);
    const actor = { sub: users.driverA.id, role: "DRIVER" as const };
    await Promise.all([
      shipments.transition(shipment.id, "IN_TRANSIT", actor),
      shipments.transition(shipment.id, "IN_TRANSIT", actor),
    ]);
    expect(
      await db.shipmentStatusHistory.count({
        where: { shipmentId: shipment.id, toStatus: "IN_TRANSIT" },
      }),
    ).toBe(1);
    expect(
      await db.webhookEvent.count({ where: { shipmentId: shipment.id } }),
    ).toBe(2);
  });
  it("blocks skipped status and unauthorized driver", async () => {
    const shipment = await create();
    const assignment = await pending(shipment.id);
    await call("driverA")
      .post(`assignments/${assignment.id}/respond`)
      .send({ action: "ACCEPT" })
      .expect(200);
    await call("driverA")
      .post(`shipments/${shipment.id}/transition`)
      .send({ toStatus: "DELIVERED" })
      .expect(409);
    await call("driverB")
      .post(`shipments/${shipment.id}/transition`)
      .send({ toStatus: "IN_TRANSIT" })
      .expect(403);
  });
  it("blocks sender access to another sender shipment", async () => {
    const shipment = await create();
    await call("other")
      .get("shipments/" + shipment.id)
      .expect(403);
  });
  it("refuses driver availability change during pending assignment", async () => {
    await create();
    await request(app.getHttpServer())
      .patch("/api/v1/drivers/me/status")
      .set("Authorization", "Bearer " + tokens.driverA)
      .send({ status: "OFFLINE" })
      .expect(409);
  });
  it("ignores stale or unavailable locations", async () => {
    await db.driver.updateMany({ data: { lastLocationAt: new Date(0) } });
    const shipment = await create();
    expect(
      await db.driverAssignment.count({ where: { shipmentId: shipment.id } }),
    ).toBe(0);
    expect(await dispatch.assign(shipment.id)).toMatchObject({
      reason: "NO_AVAILABLE_DRIVER",
    });
  });
  it("webhook failure retries and leaves shipment committed", async () => {
    receiverStatus = 503;
    await call("admin")
      .post("webhooks/subscriptions")
      .send({ url: receiverUrl + "/webhooks", secret })
      .expect(201);
    const shipment = await create();
    await webhooks.sendBatch();
    const delivery = await db.webhookDelivery.findFirstOrThrow();
    expect(delivery.status).toBe("PENDING");
    expect(delivery.attempts).toBe(1);
    expect(delivery.lastError).toContain("503");
    expect(
      (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
        .status,
    ).toBe("RECEIVED");
    receiverStatus = 200;
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await webhooks.sendBatch();
    expect(
      (
        await db.webhookDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
    ).toBe("DELIVERED");
    expect(received[0].eventId).toBe(received[1].eventId);
  });
  it("two webhook workers claim a delivery only once", async () => {
    await call("admin")
      .post("webhooks/subscriptions")
      .send({ url: receiverUrl + "/webhooks", secret })
      .expect(201);
    await create();
    await Promise.all([webhooks.sendBatch(), webhooks.sendBatch()]);
    expect(received).toHaveLength(1);
  });
  it("rotates refresh token and rejects replay", async () => {
    const logged = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: users.sender.email, password })
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: logged.body.refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: logged.body.refreshToken })
      .expect(401);
  });
  it("DB prevents mutations of audit history", async () => {
    const shipment = await create();
    const history = await db.shipmentStatusHistory.findFirstOrThrow({
      where: { shipmentId: shipment.id },
    });
    await expect(
      db.shipmentStatusHistory.delete({ where: { id: history.id } }),
    ).rejects.toThrow();
  });
  it("dispatcher can choose an available driver explicitly", async () => {
    await db.driver.updateMany({ data: { lastLocationAt: new Date(0) } });
    const shipment = await create();
    await request(app.getHttpServer())
      .patch("/api/v1/drivers/me/location")
      .set("Authorization", "Bearer " + tokens.driverB)
      .send({ lat: 10.754, lng: 106.668 })
      .expect(200);
    const assigned = await call("dispatcher")
      .post(`shipments/${shipment.id}/assign-driver`)
      .send({ driverId: drivers.driverB.id })
      .expect(200);
    expect(assigned.body.driverId).toBe(drivers.driverB.id);
  });
  it("rollback removes booking and addresses when outbox persistence fails", async () => {
    const spy = jest
      .spyOn(webhooks, "record")
      .mockRejectedValueOnce(new Error("simulated outbox failure"));
    try {
      await call("sender").post("shipments").send(booking).expect(500);
      expect(await db.shipment.count()).toBe(0);
      expect(await db.address.count()).toBe(0);
      expect(await db.shipmentStatusHistory.count()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
  it("rollback preserves current shipment status when transition event write fails", async () => {
    const shipment = await create();
    const assignment = await pending(shipment.id);
    await call("driverA")
      .post(`assignments/${assignment.id}/respond`)
      .send({ action: "ACCEPT" })
      .expect(200);
    const spy = jest
      .spyOn(webhooks, "record")
      .mockRejectedValueOnce(new Error("simulated event persistence failure"));
    try {
      await call("driverA")
        .post(`shipments/${shipment.id}/transition`)
        .send({ toStatus: "IN_TRANSIT" })
        .expect(500);
      expect(
        (await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }))
          .status,
      ).toBe("RECEIVED");
      expect(
        await db.shipmentStatusHistory.count({
          where: { shipmentId: shipment.id },
        }),
      ).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
  it("register rejects privileged roles and creates a DRIVER profile", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "privileged@test.local",
        name: "admin",
        password,
        role: "ADMIN",
      })
      .expect(400);
    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "new-driver@test.local",
        name: "New Driver",
        password,
        role: "DRIVER",
      })
      .expect(201);
    expect(
      await db.driver.findUnique({ where: { userId: registered.body.id } }),
    ).not.toBeNull();
    expect(registered.body).not.toHaveProperty("passwordHash");
  });
  it("stops automatic retries and permits dispatcher intervention after the limit", async () => {
    const shipment = await shipments.create(booking, {
      sub: users.sender.id,
      role: "SENDER",
    });
    await db.driverAssignment.createMany({
      data: Array.from({ length: 5 }, () => ({
        shipmentId: shipment.id,
        driverId: drivers.driverA.id,
        status: "REJECTED" as const,
        expiresAt: new Date(0),
        respondedAt: new Date(),
      })),
    });
    expect(await dispatch.assign(shipment.id)).toMatchObject({
      reason: "MAX_ATTEMPTS",
    });
    const manuallyAssigned = await call("dispatcher")
      .post(`shipments/${shipment.id}/assign-driver`)
      .send({ driverId: drivers.driverB.id })
      .expect(200);
    expect(manuallyAssigned.body.driverId).toBe(drivers.driverB.id);
  });
});
