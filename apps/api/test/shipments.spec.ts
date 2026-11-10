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
    driver: { update: jest.fn(), findFirst: jest.fn() },
    shipmentStatusHistory: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  db.$transaction = (fn: any) => fn(db);
  const pricing: any = { quote: jest.fn() };
  const events: any = { record: jest.fn() };
  const routing: any = { getRoute: jest.fn() };
  const service = new ShipmentsService(db, pricing, events, routing);
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
    it("allows idempotent retry of DELIVERED when assignment is already COMPLETED", async () => {
    db.shipment.findUnique.mockResolvedValue({
      ...shipment,
      status: "DELIVERED",
    });
    db.driverAssignment.findFirst.mockResolvedValue({
      id: "a-1",
      shipmentId: "ship",
      driverId: "driver-1",
      status: "COMPLETED",
      driver: { userId: actor.sub },
    });
    const result = await service.transition("ship", "DELIVERED", actor);
    expect(result).toHaveProperty("idempotent", true);
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
  it("keeps navigationUrls null as in-app navigation endpoint is used", async () => {
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
    expect(result.navigationUrls).toBeNull();
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

  describe("navigation endpoint", () => {
    const pickupCoords = { pickupLat: 10.7725, pickupLng: 106.698 }; // Ben Thanh
    const dropoffCoords = { dropoffLat: 10.7495, dropoffLng: 106.6525 }; // Binh Tay
    const driverLoc = {
      lat: 10.7726,
      lng: 106.6981,
      accuracyM: 10,
      capturedAt: new Date(),
    };

    beforeEach(() => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        pickupAddressId: "addr-p",
        dropoffAddressId: "addr-d",
      });
      db.driverAssignment.findFirst.mockResolvedValue({
        id: "assign-1",
        driverId: "driver-1",
        status: "ACCEPTED",
        driver: { userId: "user-driver" },
      });
      routing.getRoute.mockResolvedValue({
        distanceMeters: 5500,
        distanceKm: 5.5,
        durationSeconds: 600,
        geometry: { type: "LineString", coordinates: [[106.698, 10.7725]] },
        source: "OSRM",
        profile: "driving",
      });
    });

    it("rejects unknown shipment with 404", async () => {
      db.shipment.findUnique.mockResolvedValue(null);
      await expect(service.navigation("unknown", actor)).rejects.toThrow("Shipment not found");
    });

    it("rejects unrelated sender with 403", async () => {
      await expect(
        service.navigation("ship", { sub: "other-sender", role: "SENDER" }),
      ).rejects.toThrow();
    });

    it("allows owning sender with 200", async () => {
      const res = await service.navigation("ship", { sub: "sender-1", role: "SENDER" });
      expect(res.shipmentId).toBe("ship");
    });

    it("rejects unassigned driver with 403", async () => {
      db.driverAssignment.findFirst.mockResolvedValue(null);
      await expect(service.navigation("ship", actor)).rejects.toThrow();
    });

    it("rejects a driver whose assignment is no longer accepted", async () => {
      db.driverAssignment.findFirst.mockResolvedValue({
        id: "old-assignment",
        driverId: "driver-1",
        status: "REJECTED",
        driver: { userId: actor.sub },
      });
      await expect(service.navigation("ship", actor)).rejects.toThrow();
    });

    it("allows assigned driver with 200", async () => {
      const res = await service.navigation("ship", actor);
      expect(res.shipmentId).toBe("ship");
    });

    it("allows admin unconditionally with 200", async () => {
      db.driverAssignment.findFirst.mockResolvedValue(null);
      const res = await service.navigation("ship", { sub: "admin-1", role: "ADMIN" });
      expect(res.shipmentId).toBe("ship");
    });

        it("surfaces routingError when routing service fails in navigation", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        status: "EN_ROUTE_PICKUP",
        pickupAddressId: "addr-p",
        dropoffAddressId: "addr-d",
      });
      db.$queryRaw
        .mockResolvedValueOnce([{ ...pickupCoords, ...dropoffCoords }])
        .mockResolvedValueOnce([driverLoc]);

      routing.getRoute.mockRejectedValueOnce(new Error("OSRM unreachable"));

      const res = await service.navigation("ship", actor);
      expect(res.route).toBeNull();
      expect(res.routingError).toBe("OSRM unreachable");
    });
    it("returns TO_PICKUP and pickup route for EN_ROUTE_PICKUP", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        status: "EN_ROUTE_PICKUP",
        pickupAddressId: "addr-p",
        dropoffAddressId: "addr-d",
      });
      db.$queryRaw
        .mockResolvedValueOnce([{ ...pickupCoords, ...dropoffCoords }]) // addresses
        .mockResolvedValueOnce([driverLoc]); // driver coords

      const res = await service.navigation("ship", actor);
      expect(res.phase).toBe("TO_PICKUP");
      expect(res.destination).toEqual({
        kind: "PICKUP",
        lat: pickupCoords.pickupLat,
        lng: pickupCoords.pickupLng,
      });
      expect(res.route).toBeDefined();
      expect(res.arrival.eligible).toBe(true);
    });

    it("returns AT_PICKUP and no route for ARRIVED_PICKUP", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        status: "ARRIVED_PICKUP",
        pickupAddressId: "addr-p",
        dropoffAddressId: "addr-d",
      });
      db.$queryRaw
        .mockResolvedValueOnce([{ ...pickupCoords, ...dropoffCoords }])
        .mockResolvedValueOnce([driverLoc]);

      const res = await service.navigation("ship", actor);
      expect(res.phase).toBe("AT_PICKUP");
      expect(res.destination).toBeNull();
      expect(res.route).toBeNull();
      expect(res.arrival.eligible).toBe(false);
    });

    it("returns TO_DROPOFF and dropoff route for OUT_FOR_DELIVERY", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        status: "OUT_FOR_DELIVERY",
        pickupAddressId: "addr-p",
        dropoffAddressId: "addr-d",
      });
      db.$queryRaw
        .mockResolvedValueOnce([{ ...pickupCoords, ...dropoffCoords }])
        .mockResolvedValueOnce([driverLoc]);

      const res = await service.navigation("ship", actor);
      expect(res.phase).toBe("TO_DROPOFF");
      expect(res.destination).toEqual({
        kind: "DROPOFF",
        lat: dropoffCoords.dropoffLat,
        lng: dropoffCoords.dropoffLng,
      });
      expect(res.route).toBeDefined();
    });

    it("returns AT_DROPOFF and no route for ARRIVED_DROPOFF", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        status: "ARRIVED_DROPOFF",
        pickupAddressId: "addr-p",
        dropoffAddressId: "addr-d",
      });
      db.$queryRaw
        .mockResolvedValueOnce([{ ...pickupCoords, ...dropoffCoords }])
        .mockResolvedValueOnce([driverLoc]);

      const res = await service.navigation("ship", actor);
      expect(res.phase).toBe("AT_DROPOFF");
      expect(res.destination).toBeNull();
      expect(res.route).toBeNull();
    });

    it("returns COMPLETE and no route for terminal states (DELIVERED, CANCELLED, DELIVERY_FAILED)", async () => {
      for (const term of ["DELIVERED", "CANCELLED", "DELIVERY_FAILED"] as ShipmentStatus[]) {
        db.shipment.findUnique.mockResolvedValue({
          ...shipment,
          senderId: "sender-1",
          status: term,
          pickupAddressId: "addr-p",
          dropoffAddressId: "addr-d",
        });
        db.$queryRaw
          .mockResolvedValueOnce([{ ...pickupCoords, ...dropoffCoords }])
          .mockResolvedValueOnce([driverLoc]);

        const res = await service.navigation("ship", actor);
        expect(res.phase).toBe("COMPLETE");
        expect(res.destination).toBeNull();
        expect(res.route).toBeNull();
      }
    });
  });

  describe("live tracking endpoint", () => {
    const driverLoc = {
      lat: 10.7726,
      lng: 106.6981,
      accuracyM: 12,
      capturedAt: new Date("2026-11-10T00:00:00Z"),
    };

    beforeEach(() => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        senderId: "sender-1",
        status: "OUT_FOR_DELIVERY",
      });
      db.driverAssignment.findFirst.mockResolvedValue({
        id: "assignment-1",
        driverId: "driver-1",
        shipmentId: "ship",
        status: "ACCEPTED",
      });
      db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
        const text = strings.join("");
        if (text.includes('FROM "Driver"')) {
          return [driverLoc];
        }
        return [];
      });
    });

    it("rejects unknown shipment with 404", async () => {
      db.shipment.findUnique.mockResolvedValue(null);
      await expect(service.live("unknown", actor)).rejects.toThrow("Shipment not found");
    });

    it("rejects unrelated sender with 403", async () => {
      await expect(
        service.live("ship", { sub: "other-sender", role: "SENDER" }),
      ).rejects.toThrow();
    });

    it("allows owning sender with 200 and returns live driver coords", async () => {
      const res = await service.live("ship", { sub: "sender-1", role: "SENDER" });
      expect(res.shipmentId).toBe("ship");
      expect(res.status).toBe("OUT_FOR_DELIVERY");
      expect(res.driver).toEqual({
        lat: driverLoc.lat,
        lng: driverLoc.lng,
        accuracyM: driverLoc.accuracyM,
        capturedAt: "2026-11-10T00:00:00.000Z",
      });
      expect(res.lastUpdatedAt).toBe("2026-11-10T00:00:00.000Z");
      expect((res as any).email).toBeUndefined();
      expect((res as any).phone).toBeUndefined();
      expect((res as any).driverId).toBeUndefined();
    });

    it("rejects unassigned driver with 403", async () => {
      db.driverAssignment.findFirst.mockResolvedValue(null);
      await expect(
        service.live("ship", { sub: "other-driver", role: "DRIVER" }),
      ).rejects.toThrow();
    });

    it("rejects a driver whose assignment is no longer accepted", async () => {
      db.driverAssignment.findFirst.mockResolvedValue({
        id: "old-assignment",
        driverId: "driver-1",
        status: "EXPIRED",
      });
      await expect(
        service.live("ship", { sub: "driver-user-id", role: "DRIVER" }),
      ).rejects.toThrow();
    });

    it("allows assigned driver, dispatcher, and admin", async () => {
      db.driverAssignment.findFirst.mockResolvedValue({ id: "a1", driverId: "driver-1", status: "ACCEPTED" });
      const r1 = await service.live("ship", { sub: "driver-user-id", role: "DRIVER" });
      expect(r1.driver).toBeDefined();

      const r2 = await service.live("ship", { sub: "dispatcher-1", role: "DISPATCHER" });
      expect(r2.driver).toBeDefined();

      const r3 = await service.live("ship", { sub: "admin-1", role: "ADMIN" });
      expect(r3.driver).toBeDefined();
    });

    it("returns driver: null for terminal states (DELIVERED, CANCELLED, DELIVERY_FAILED)", async () => {
      for (const term of ["DELIVERED", "CANCELLED", "DELIVERY_FAILED"] as ShipmentStatus[]) {
        db.shipment.findUnique.mockResolvedValue({
          ...shipment,
          senderId: "sender-1",
          status: term,
        });
        const res = await service.live("ship", { sub: "sender-1", role: "SENDER" });
        expect(res.status).toBe(term);
        expect(res.driver).toBeNull();
        expect(res.lastUpdatedAt).toBeNull();
      }
    });

    it("returns driver: null when no active assignment exists", async () => {
      db.driverAssignment.findFirst.mockResolvedValue(null);
      const res = await service.live("ship", { sub: "sender-1", role: "SENDER" });
      expect(res.driver).toBeNull();
      expect(res.lastUpdatedAt).toBeNull();
    });
  });

  describe("geofence protected transitions", () => {
    const pickupLoc = { lat: 10.7725, lng: 106.698 };
    const dropoffLoc = { lat: 10.7495, lng: 106.6525 };

    const setupMocks = (driverLoc: any, targetLoc: any = pickupLoc) => {
      db.driverAssignment.findFirst.mockResolvedValue({
        id: "assign",
        driverId: "driver",
        status: "ACCEPTED",
        driver: { userId: actor.sub },
      });
      db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
        const sql = strings.join(" ");
        if (sql.includes('FROM "Driver"')) {
          return [driverLoc];
        }
        if (sql.includes('FROM "Address"')) {
          return [targetLoc];
        }
        return [];
      });
    };

    it("blocks DRIVER transitioning to ARRIVED_PICKUP when location is too far (> 100m)", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        status: "EN_ROUTE_PICKUP",
        pickupAddressId: "addr-p",
      });
      setupMocks({
        lat: pickupLoc.lat + 0.005,
        lng: pickupLoc.lng,
        accuracyM: 10,
        capturedAt: new Date(),
      });

      await expect(
        service.transition("ship", "ARRIVED_PICKUP", actor),
      ).rejects.toThrow("Driver is");
    });

    it("blocks DRIVER transitioning to ARRIVED_PICKUP when accuracy is poor (> 50m)", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        status: "EN_ROUTE_PICKUP",
        pickupAddressId: "addr-p",
      });
      setupMocks({
        lat: pickupLoc.lat,
        lng: pickupLoc.lng,
        accuracyM: 65, // > 50m
        capturedAt: new Date(),
      });

      await expect(
        service.transition("ship", "ARRIVED_PICKUP", actor),
      ).rejects.toThrow("exceeds 50m threshold");
    });

    it("blocks DRIVER transitioning to ARRIVED_PICKUP when timestamp is stale (> 30s)", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        status: "EN_ROUTE_PICKUP",
        pickupAddressId: "addr-p",
      });
      setupMocks({
        lat: pickupLoc.lat,
        lng: pickupLoc.lng,
        accuracyM: 10,
        capturedAt: new Date(Date.now() - 45000), // 45s ago
      });

      await expect(
        service.transition("ship", "ARRIVED_PICKUP", actor),
      ).rejects.toThrow("older than 30 seconds");
    });

    it("allows DRIVER transitioning to ARRIVED_PICKUP when within 100m, accurate and fresh", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        status: "EN_ROUTE_PICKUP",
        pickupAddressId: "addr-p",
      });
      setupMocks({
        lat: pickupLoc.lat + 0.0002,
        lng: pickupLoc.lng,
        accuracyM: 15,
        capturedAt: new Date(Date.now() - 5000),
      });

      const res = await service.transition("ship", "ARRIVED_PICKUP", actor);
      expect(res.status).toBe("ARRIVED_PICKUP");
      expect(events.record).toHaveBeenCalledWith(
        db,
        expect.anything(),
        "EN_ROUTE_PICKUP",
        "ARRIVED_PICKUP",
      );
    });

    it("allows DRIVER transitioning to ARRIVED_DROPOFF when within 100m, accurate and fresh", async () => {
      db.shipment.findUnique.mockResolvedValue({
        ...shipment,
        status: "OUT_FOR_DELIVERY",
        dropoffAddressId: "addr-d",
      });
      setupMocks(
        {
          lat: dropoffLoc.lat + 0.0001,
          lng: dropoffLoc.lng,
          accuracyM: 10,
          capturedAt: new Date(Date.now() - 2000),
        },
        dropoffLoc,
      );

      const res = await service.transition("ship", "ARRIVED_DROPOFF", actor);
      expect(res.status).toBe("ARRIVED_DROPOFF");
    });
  });
});
