import {
  ShipmentsService,
  canTransition,
} from "../src/modules/shipments/shipments.service";
import { ShipmentStatus } from "@prisma/client";
describe("Shipment state machine and ownership", () => {
  const db: any = {
    shipment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    driverAssignment: { findFirst: jest.fn(), update: jest.fn() },
    driver: { update: jest.fn() },
    shipmentStatusHistory: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  db.$transaction = (fn: any) => fn(db);
  const pricing: any = { quote: jest.fn() };
  const events: any = { record: jest.fn() };
  const service = new ShipmentsService(db, pricing, events);
  const actor: any = { sub: "user-driver", role: "DRIVER" };
  const shipment = {
    id: "ship",
    trackingCode: "CODE",
    status: "RECEIVED",
    senderId: "sender",
    fee: 75300,
  };
  beforeEach(() => {
    jest.clearAllMocks();
    db.shipment.findUnique.mockResolvedValue(shipment);
    db.shipment.update.mockImplementation(async ({ data }: any) => ({
      ...shipment,
      ...data,
    }));
    db.driverAssignment.findFirst.mockResolvedValue({
      id: "assign",
      driverId: "driver",
      status: "ACCEPTED",
      driver: { userId: actor.sub },
    });
  });
  it.each([
    ["RECEIVED", "IN_TRANSIT"],
    ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
    ["OUT_FOR_DELIVERY", "DELIVERED"],
  ])("permits %s -> %s", (a, b) =>
    expect(canTransition(a as ShipmentStatus, b as ShipmentStatus)).toBe(true),
  );
  it.each([
    ["RECEIVED", "DELIVERED"],
    ["IN_TRANSIT", "RECEIVED"],
    ["DELIVERED", "RECEIVED"],
    ["RECEIVED", "RECEIVED"],
  ])("blocks %s -> %s", (a, b) =>
    expect(canTransition(a as ShipmentStatus, b as ShipmentStatus)).toBe(false),
  );
  it("writes history and event on transition", async () => {
    await service.transition("ship", "IN_TRANSIT", actor);
    expect(db.shipmentStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(events.record).toHaveBeenCalledWith(
      db,
      expect.anything(),
      "RECEIVED",
      "IN_TRANSIT",
    );
  });
  it("makes a repeated transition idempotent without duplicate event", async () => {
    expect(
      (await service.transition("ship", "RECEIVED", actor)) as any,
    ).toHaveProperty("idempotent", true);
    expect(events.record).not.toHaveBeenCalled();
  });
  it("checks ownership even for repeated requests", async () => {
    await expect(
      service.transition("ship", "RECEIVED", { sub: "other", role: "DRIVER" }),
    ).rejects.toThrow();
  });
  it("blocks a missing shipment", async () => {
    db.shipment.findUnique.mockResolvedValue(null);
    await expect(
      service.transition("ship", "IN_TRANSIT", actor),
    ).rejects.toThrow();
  });
  it("blocks skip ahead", async () => {
    await expect(
      service.transition("ship", "DELIVERED", actor),
    ).rejects.toThrow();
    expect(events.record).not.toHaveBeenCalled();
  });
  it("requires accepted assignment even for an admin", async () => {
    db.driverAssignment.findFirst.mockResolvedValue(null);
    await expect(
      service.transition("ship", "IN_TRANSIT", { sub: "admin", role: "ADMIN" }),
    ).rejects.toThrow();
  });
  it("releases driver and completes assignment at DELIVERED", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "OUT_FOR_DELIVERY",
    });
    await service.transition("ship", "DELIVERED", actor);
    expect(db.driver.update).toHaveBeenCalledWith({
      where: { id: "driver" },
      data: { status: "AVAILABLE" },
    });
    expect(db.driverAssignment.update).toHaveBeenCalledWith({
      where: { id: "assign" },
      data: { status: "COMPLETED" },
    });
  });
  it("does not expose another sender shipment", async () => {
    await expect(
      service.get("ship", { sub: "other", role: "SENDER" }),
    ).rejects.toThrow();
  });
  it("does not expose shipment to an unrelated driver", async () => {
    db.driverAssignment.findFirst.mockResolvedValue(null);
    await expect(service.get("ship", actor)).rejects.toThrow();
  });
  it("returns owned shipment", async () =>
    expect(
      await service.get("ship", { sub: "sender", role: "SENDER" }),
    ).toEqual(shipment));
  it("scopes shipment list by sender", async () => {
    await service.list(
      { page: 2, limit: 10, status: "RECEIVED" },
      { sub: "sender", role: "SENDER" },
    );
    expect(db.shipment.findMany.mock.calls[0][0]).toMatchObject({
      where: { senderId: "sender", status: "RECEIVED" },
      skip: 10,
    });
  });
  it("uses explicit public tracking projection", async () => {
    await service.tracking("CODE");
    const selected = db.shipment.findUnique.mock.calls[0][0].select;
    expect(selected).not.toHaveProperty("senderId");
    expect(selected).not.toHaveProperty("fee");
    expect(selected.pickup.select).toEqual({ city: true });
  });
  it("returns 404 for unknown tracking", async () => {
    db.shipment.findUnique.mockResolvedValue(null);
    await expect(service.tracking("missing")).rejects.toThrow();
  });
  it("computes fee from backend and snapshots breakdown at booking", async () => {
    pricing.quote.mockResolvedValue({ fee: 75300, ruleVersion: 1 });
    db.shipment.create.mockResolvedValue(shipment);
    const address = {
      line: "x",
      ward: "x",
      district: "x",
      city: "x",
      lat: 10,
      lng: 106,
    };
    const input: any = {
      pickupAddress: address,
      dropoffAddress: address,
      parcel: { weightKg: 5, lengthCm: 1, widthCm: 1, heightCm: 1 },
      serviceType: "EXPRESS",
    };
    await service.create(input, { sub: "sender", role: "SENDER" });
    expect(db.shipment.create.mock.calls[0][0].data.fee).toBe(75300);
    expect(events.record).toHaveBeenCalledWith(db, shipment, null, "RECEIVED");
  });
});
