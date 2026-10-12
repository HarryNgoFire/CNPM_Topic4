import { DispatchService } from "../src/modules/dispatch/dispatch.service";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "@prisma/client";
describe("Driver dispatch", () => {
  const actor: any = { sub: "driver-user", role: "DRIVER" };
  const assignment = {
    id: "assignment",
    shipmentId: "shipment",
    driverId: "driver",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60000),
    driver: { userId: actor.sub, status: "AVAILABLE" },
  };
  const db: any = {
    shipment: { findUnique: jest.fn(), findMany: jest.fn() },
    driverAssignment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    driver: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  db.$transaction = (fn: any) => fn(db);
  const service = new DispatchService(db as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    db.shipment.findUnique.mockResolvedValue({
      id: "shipment",
      status: "RECEIVED",
      pickupAddressId: "address",
    });
    db.driverAssignment.findFirst.mockResolvedValue(null);
    db.driverAssignment.findMany.mockResolvedValue([]);
    db.$queryRaw.mockResolvedValue([{ id: "driver", distanceM: 15 }]);
    db.driverAssignment.create.mockResolvedValue(assignment);
    db.driverAssignment.findUnique.mockResolvedValue(assignment);
    db.driverAssignment.findUniqueOrThrow.mockResolvedValue(assignment);
    db.driver.findUnique.mockResolvedValue({ id: "driver" });
    db.driver.findUniqueOrThrow.mockResolvedValue({
      id: "driver",
      status: "AVAILABLE",
    });
    db.driverAssignment.update.mockImplementation(async ({ data }: any) => ({
      ...assignment,
      ...data,
    }));
    db.driverAssignment.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => jest.restoreAllMocks());
  it("creates a pending invitation for the nearest candidate", async () => {
    expect(((await service.assign("shipment")) as any).driverId).toBe("driver");
    expect(
      db.driverAssignment.create.mock.calls[0][0].data.expiresAt.getTime(),
    ).toBeGreaterThan(Date.now());
  });
  it("returns existing active assignment idempotently", async () => {
    db.driverAssignment.findFirst.mockResolvedValue(assignment);
    expect(await service.assign("shipment")).toBe(assignment);
    expect(db.driverAssignment.create).not.toHaveBeenCalled();
  });
  it("returns a queue reason when no candidates exist", async () => {
    db.$queryRaw.mockResolvedValue([]);
    expect(await service.assign("shipment")).toMatchObject({
      reason: "NO_AVAILABLE_DRIVER",
    });
  });
  it("stops at configured retry limit", async () => {
    db.driverAssignment.findMany.mockResolvedValue(
      Array(5).fill({ driverId: "x" }),
    );
    expect(await service.assign("shipment")).toMatchObject({
      reason: "MAX_ATTEMPTS",
    });
  });
  it("excludes earlier rejected candidates in SQL", async () => {
    db.driverAssignment.findMany.mockResolvedValue([
      { driverId: "00000000-0000-4000-8000-000000000001" },
    ]);
    await service.assign("shipment");
    expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it("rejects missing shipment", async () => {
    db.shipment.findUnique.mockResolvedValue(null);
    await expect(service.assign("x")).rejects.toThrow();
  });
  it("rejects dispatch after pickup", async () => {
    db.shipment.findUnique.mockResolvedValue({ status: "IN_TRANSIT" });
    await expect(service.assign("x")).rejects.toThrow();
  });
  it("maps DB uniqueness conflicts to HTTP conflict", async () => {
    db.driverAssignment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "7.10.0",
      }),
    );
    await expect(service.assign("shipment")).rejects.toThrow(
      "already assigned",
    );
  });
  it("accepts and sets driver BUSY without changing shipment status", async () => {
    const result = await service.respond("assignment", "ACCEPT", actor);
    expect(result.assignment.status).toBe("ACCEPTED");
    expect(db.driver.update).toHaveBeenCalledWith({
      where: { id: "driver" },
      data: { status: "BUSY" },
    });
  });
  it("rejects and finds a new driver", async () => {
    const spy = jest.spyOn(service, "assign").mockResolvedValue({} as any);
    expect(
      (await service.respond("assignment", "REJECT", actor)).assignment.status,
    ).toBe("REJECTED");
    expect(spy).toHaveBeenCalledWith("shipment");
  });
  it("only permits assignment owner", async () => {
    await expect(
      service.respond("assignment", "ACCEPT", { sub: "other", role: "DRIVER" }),
    ).rejects.toThrow();
  });
  it("requires driver availability on accept", async () => {
    db.driver.findUniqueOrThrow.mockResolvedValue({
      id: "driver",
      status: "BUSY",
    });
    await expect(
      service.respond("assignment", "ACCEPT", actor),
    ).rejects.toThrow();
  });
  it("handles repeated accept idempotently", async () => {
    db.driverAssignment.findUniqueOrThrow.mockResolvedValue({
      ...assignment,
      status: "ACCEPTED",
    });
    expect(
      (await service.respond("assignment", "ACCEPT", actor)).idempotent,
    ).toBe(true);
    expect(db.driver.update).not.toHaveBeenCalled();
  });
  it("rejects conflicting second response", async () => {
    db.driverAssignment.findUniqueOrThrow.mockResolvedValue({
      ...assignment,
      status: "REJECTED",
    });
    await expect(
      service.respond("assignment", "ACCEPT", actor),
    ).rejects.toThrow();
  });
  it("expires a late response and reassigns", async () => {
    db.driverAssignment.findUniqueOrThrow.mockResolvedValue({
      ...assignment,
      expiresAt: new Date(0),
    });
    const spy = jest.spyOn(service, "assign").mockResolvedValue({} as any);
    await expect(
      service.respond("assignment", "ACCEPT", actor),
    ).rejects.toThrow("expired");
    expect(spy).toHaveBeenCalled();
  });
  it("requires an existing assignment", async () => {
    db.driverAssignment.findUnique.mockResolvedValue(null);
    await expect(service.respond("bad", "ACCEPT", actor)).rejects.toThrow();
  });
  it("updates location through parameterized geography query", async () => {
    expect(await service.location(actor, { lat: 10, lng: 106 })).toEqual({
      lat: 10,
      lng: 106,
    });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it("lists only pending and accepted tasks", async () => {
    db.driverAssignment.findMany.mockResolvedValue([]);
    await service.tasks(actor);
    expect(
      db.driverAssignment.findMany.mock.calls[0][0].where.status.in,
    ).toEqual(["PENDING", "ACCEPTED"]);
  });
  it("requires a driver profile", async () => {
    db.driver.findUnique.mockResolvedValue(null);
    await expect(service.tasks(actor)).rejects.toThrow();
  });
  it("blocks changing availability during an active assignment", async () => {
    db.driverAssignment.findFirst.mockResolvedValue(assignment);
    await expect(service.status(actor, "OFFLINE")).rejects.toThrow();
  });
  it("sets availability for a free driver", async () => {
    db.driver.update.mockResolvedValue({ id: "driver", status: "AVAILABLE" });
    expect((await service.status(actor, "AVAILABLE")).status).toBe("AVAILABLE");
  });
  it("expires and reassigns only a still pending invitation", async () => {
    const spy = jest.spyOn(service, "assign").mockResolvedValue({} as any);
    await service.expireOne("assignment");
    expect(spy).toHaveBeenCalled();
  });
  it("does not reassign if another worker resolved it", async () => {
    db.driverAssignment.updateMany.mockResolvedValue({ count: 0 });
    const spy = jest.spyOn(service, "assign");
    await service.expireOne("assignment");
    expect(spy).not.toHaveBeenCalled();
  });
  it("ignores removed assignments in expiration job", async () => {
    db.driverAssignment.findUnique.mockResolvedValue(null);
    await service.expireOne("bad");
    expect(db.driverAssignment.updateMany).not.toHaveBeenCalled();
  });
  it("lists dispatcher queue", async () => {
    db.shipment.findMany.mockResolvedValue([]);
    expect(await service.queue()).toEqual([]);
  });
  it("runs expiration and queue assignment jobs", async () => {
    db.driverAssignment.findMany.mockResolvedValue([{ id: "assignment" }]);
    db.$queryRaw.mockResolvedValue([{ id: "shipment" }]);
    const expire = jest.spyOn(service, "expireOne").mockResolvedValue();
    const assign = jest.spyOn(service, "assign").mockResolvedValue({} as any);
    await service.tick();
    expect(expire).toHaveBeenCalled();
    expect(assign).toHaveBeenCalled();
  });
  it("catches job failures", async () => {
    db.driverAssignment.findMany.mockRejectedValue(new Error("unavailable"));
    await expect(service.tick()).resolves.toBeUndefined();
  });
  it("does not overlap cron ticks", async () => {
    let release!: (v: any) => void;
    db.driverAssignment.findMany.mockImplementation(
      () => new Promise((r) => (release = r)),
    );
    db.$queryRaw.mockResolvedValue([]);
    const first = service.tick();
    await service.tick();
    expect(db.driverAssignment.findMany).toHaveBeenCalledTimes(1);
    release([]);
    await first;
  });
});
