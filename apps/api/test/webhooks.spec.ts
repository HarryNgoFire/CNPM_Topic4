import {
  WebhooksService,
  signPayload,
  validateDestination,
  RETRY_DELAYS_MS,
} from "../src/modules/webhooks/webhooks.service";
import { PrismaService } from "../src/database/prisma.service";
describe("Webhook dispatch", () => {
  const db: any = {
    webhookEvent: { create: jest.fn(), findMany: jest.fn() },
    webhookSubscription: { findMany: jest.fn(), create: jest.fn() },
    webhookDelivery: {
      createMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const service = new WebhooksService(db as PrismaService);
  const delivery = {
    id: "d1",
    eventId: "event1",
    attempts: 0,
    event: { payload: { eventId: "event1" } },
    subscription: {
      url: "https://partner.example/webhooks",
      secret: "a".repeat(32),
      active: true,
    },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_ALLOWED_ORIGINS = "https://partner.example";
    process.env.WEBHOOK_ALLOW_HTTP = "false";
    db.webhookDelivery.findUniqueOrThrow.mockResolvedValue(delivery);
    db.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => jest.restoreAllMocks());
  it("signs exact serialized bytes", () =>
    expect(signPayload("hello", "secret")).toBe(
      "sha256=88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b",
    ));
  it("permits an explicitly configured HTTPS origin", () =>
    expect(validateDestination(delivery.subscription.url)).toBe(
      delivery.subscription.url,
    ));
  it.each([
    "http://127.0.0.1/admin",
    "https://attacker.example",
    "https://user:pass@partner.example/hook",
    "bad",
    "https://partner.example/hook#fragment",
  ])("rejects unsafe/unlisted URL %s", (url) =>
    expect(() => validateDestination(url)).toThrow(),
  );
  it("allows HTTP only with explicit origin and flag", () => {
    process.env.WEBHOOK_ALLOWED_ORIGINS = "http://receiver:4000";
    process.env.WEBHOOK_ALLOW_HTTP = "true";
    expect(validateDestination("http://receiver:4000/webhooks")).toContain(
      "receiver",
    );
  });
  it("records one event with a delivery per active subscription", async () => {
    db.webhookSubscription.findMany.mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
    ]);
    await service.record(
      db,
      { id: "ship", trackingCode: "TRACK" },
      "RECEIVED",
      "IN_TRANSIT",
    );
    expect(db.webhookEvent.create).toHaveBeenCalledTimes(1);
    expect(db.webhookDelivery.createMany.mock.calls[0][0].data).toHaveLength(2);
  });
  it("records an event even with no subscriptions", async () => {
    db.webhookSubscription.findMany.mockResolvedValue([]);
    await service.record(
      db,
      { id: "ship", trackingCode: "TRACK" },
      null,
      "RECEIVED",
    );
    expect(db.webhookDelivery.createMany).not.toHaveBeenCalled();
  });
  it("marks successful send delivered with a fencing token", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, body: null } as Response);
    await service.sendOne("d1", "lease");
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      method: "POST",
    });
    expect(db.webhookDelivery.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "d1", leaseToken: "lease" },
      data: { status: "DELIVERED", attempts: 1, lastError: null },
    });
  });
  it("retries non-2xx response without touching shipment", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: false, status: 503, body: null } as Response);
    const now = Date.now();
    await service.sendOne("d1", "lease");
    const data = db.webhookDelivery.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.lastError).toContain("503");
    expect(data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(now + 10000);
  });
  it("marks FAILED after initial send plus five retries", async () => {
    db.webhookDelivery.findUniqueOrThrow.mockResolvedValue({
      ...delivery,
      attempts: 5,
    });
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));
    await service.sendOne("d1", "lease");
    expect(db.webhookDelivery.updateMany.mock.calls[0][0].data.status).toBe(
      "FAILED",
    );
  });
  it("does not send to inactive subscriptions", async () => {
    db.webhookDelivery.findUniqueOrThrow.mockResolvedValue({
      ...delivery,
      subscription: { ...delivery.subscription, active: false },
    });
    const spy = jest.spyOn(global, "fetch");
    await service.sendOne("d1", "lease");
    expect(spy).not.toHaveBeenCalled();
  });
  it("claims a bounded batch", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "d1" }]);
    jest.spyOn(service, "sendOne").mockResolvedValue();
    await service.sendBatch();
    expect(service.sendOne).toHaveBeenCalledTimes(1);
  });
  it("runs a tick and logs failures", async () => {
    const spy = jest
      .spyOn(service, "sendBatch")
      .mockRejectedValue(new Error("db down"));
    await service.tick();
    expect(spy).toHaveBeenCalled();
  });
  it("never overlaps ticks", async () => {
    let release!: () => void;
    const spy = jest.spyOn(service, "sendBatch").mockImplementation(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const first = service.tick();
    await service.tick();
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
  it("never returns subscription secret", async () => {
    db.webhookSubscription.create.mockResolvedValue({
      id: "s",
      url: delivery.subscription.url,
      active: true,
      secret: "hidden",
      createdAt: new Date(),
    });
    expect(
      await service.subscribe({
        url: delivery.subscription.url,
        secret: "a".repeat(32),
      }),
    ).not.toHaveProperty("secret");
  });
  it("lists paginated delivery logs", async () => {
    db.webhookEvent.findMany.mockResolvedValue([]);
    expect(await service.events({ page: 2, limit: 10 })).toEqual([]);
    expect(db.webhookEvent.findMany.mock.calls[0][0].skip).toBe(10);
  });
  it("has five retry delays", () =>
    expect(RETRY_DELAYS_MS).toEqual([10000, 60000, 300000, 900000, 1800000]));
});
