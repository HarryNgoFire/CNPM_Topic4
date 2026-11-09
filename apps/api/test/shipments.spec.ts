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
    db.$queryRaw.mockResolvedValue([]);
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
    ["RECEIVED", "EN_ROUTE_PICKUP"],
    ["EN_ROUTE_PICKUP", "ARRIVED_PICKUP"],
    ["ARRIVED_PICKUP", "OUT_FOR_DELIVERY"],
    ["OUT_FOR_DELIVERY", "ARRIVED_DROPOFF"],
    ["ARRIVED_DROPOFF", "DELIVERED"],
    ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
    ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"],
    ["RECEIVED", "CANCELLED"],
  ])("permits %s -> %s", (a, b) =>
    expect(canTransition(a as ShipmentStatus, b as ShipmentStatus)).toBe(true),
  );
  it.each([
    ["RECEIVED", "DELIVERED"],
    ["RECEIVED", "IN_TRANSIT"],
    ["IN_TRANSIT", "RECEIVED"],
    ["DELIVERED", "RECEIVED"],
    ["RECEIVED", "RECEIVED"],
    ["OUT_FOR_DELIVERY", "DELIVERED"],
  ])("blocks %s -> %s", (a, b) =>
    expect(canTransition(a as ShipmentStatus, b as ShipmentStatus)).toBe(false),
  );
  it("writes history and event on transition", async () => {
    await service.transition("ship", "EN_ROUTE_PICKUP", actor);
    expect(db.shipmentStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(events.record).toHaveBeenCalledWith(
      db,
      expect.anything(),
      "RECEIVED",
      "EN_ROUTE_PICKUP",
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
      service.transition("ship", "EN_ROUTE_PICKUP", actor),
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
      service.transition("ship", "EN_ROUTE_PICKUP", { sub: "admin", role: "ADMIN" }),
    ).rejects.toThrow();
  });
  it("releases driver and completes assignment at DELIVERED", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "ARRIVED_DROPOFF",
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
  it("allows sender cancellation before driver acceptance with valid reason", async () => {
    db.driverAssignment.findFirst.mockResolvedValue(null);
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "RECEIVED",
      senderId: "sender-1",
    });
    await service.transition(
      "ship",
      { toStatus: "CANCELLED", reason: "Customer request" },
      { sub: "sender-1", role: "SENDER" },
    );
    expect(db.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED", reason: "Customer request" }),
      }),
    );
  });
  it("rejects sender cancellation after driver acceptance", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "RECEIVED",
      senderId: "sender-1",
    });
    db.driverAssignment.findFirst.mockResolvedValue({
      id: "assign",
      driverId: "driver",
      status: "ACCEPTED",
      driver: { userId: "some-driver" },
    });
    await expect(
      service.transition(
        "ship",
        { toStatus: "CANCELLED", reason: "Customer request" },
        { sub: "sender-1", role: "SENDER" },
      ),
    ).rejects.toThrow("Sender can only cancel unassigned");
  });
  it("rejects driver cancellation", async () => {
    await expect(
      service.transition(
        "ship",
        { toStatus: "CANCELLED", reason: "Driver giving up" },
        actor,
      ),
    ).rejects.toThrow("Drivers cannot cancel");
  });
  it("allows driver failure during delivery stage with reason and cleans up", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "OUT_FOR_DELIVERY",
    });
    await service.transition(
      "ship",
      { toStatus: "DELIVERY_FAILED", reason: "Recipient unavailable" },
      actor,
    );
    expect(db.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DELIVERY_FAILED",
          reason: "Recipient unavailable",
        }),
      }),
    );
    expect(db.driver.update).toHaveBeenCalledWith({
      where: { id: "driver" },
      data: { status: "AVAILABLE" },
    });
    expect(db.driverAssignment.update).toHaveBeenCalledWith({
      where: { id: "assign" },
      data: { status: "COMPLETED" },
    });
  });
  it("rejects driver failure during pickup stage", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "EN_ROUTE_PICKUP",
    });
    await expect(
      service.transition(
        "ship",
        { toStatus: "DELIVERY_FAILED", reason: "Recipient unavailable" },
        actor,
      ),
    ).rejects.toThrow();
  });
  it("rejects reason on ordinary progress transitions", async () => {
    await expect(
      service.transition(
        "ship",
        { toStatus: "EN_ROUTE_PICKUP", reason: "Not allowed here" },
        actor,
      ),
    ).rejects.toThrow("Reason is not allowed");
  });
  it("requires reason on CANCELLED and DELIVERY_FAILED", async () => {
    await expect(
      service.transition(
        "ship",
        { toStatus: "CANCELLED" },
        { sub: "admin", role: "ADMIN" },
      ),
    ).rejects.toThrow("Reason is required");
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
    ).toMatchObject({ ...shipment, navigationUrls: null }));
  it("adds pickup and dropoff Google Maps navigation URLs", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      pickupAddressId: "pickup-id",
      dropoffAddressId: "dropoff-id",
    });
    db.driverAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    db.$queryRaw.mockResolvedValue([
      {
        pickupLat: 10.754,
        pickupLng: 106.663,
        dropoffLat: 10.772,
        dropoffLng: 106.698,
      },
    ]);

    const result = await service.get("ship", actor);
    const pickupUrl = new URL(result.navigationUrls!.pickup);
    const dropoffUrl = new URL(result.navigationUrls!.dropoff);
    expect(pickupUrl.searchParams.get("destination")).toBe("10.754,106.663");
    expect(dropoffUrl.searchParams.get("destination")).toBe("10.772,106.698");
    expect(pickupUrl.searchParams.get("travelmode")).toBe("two-wheeler");
  });
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
