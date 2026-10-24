import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ShipmentsService } from "../../src/modules/shipments/shipments.service";

const uniqueViolation = (target: string) =>
  new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [target] },
  });

describe("QA: ShipmentsService.create - tracking code collisions", () => {
  let db: any;
  let service: ShipmentsService;
  const actor = { sub: "sender-1", role: "SENDER" } as any;

  beforeEach(() => {
    db = { $transaction: jest.fn() };
    service = new ShipmentsService(db, {} as any, {} as any);
  });

  it("retries after trackingCode collisions and returns the shipment", async () => {
    db.$transaction
      .mockRejectedValueOnce(uniqueViolation("trackingCode"))
      .mockRejectedValueOnce(uniqueViolation("trackingCode"))
      .mockResolvedValueOnce({ id: "ship-1" });
    await expect(service.create({} as any, actor)).resolves.toEqual({
      id: "ship-1",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("gives up with 409 after 3 collisions", async () => {
    db.$transaction.mockRejectedValue(uniqueViolation("trackingCode"));
    await expect(service.create({} as any, actor)).rejects.toThrow(
      ConflictException,
    );
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry on a unique violation of another column", async () => {
    const error = uniqueViolation("senderId");
    db.$transaction.mockRejectedValue(error);
    await expect(service.create({} as any, actor)).rejects.toBe(error);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not retry on unexpected errors", async () => {
    db.$transaction.mockRejectedValue(new Error("db down"));
    await expect(service.create({} as any, actor)).rejects.toThrow("db down");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("QA: ShipmentsService.list - data isolation and pagination", () => {
  let db: any;
  let service: ShipmentsService;

  beforeEach(() => {
    db = { shipment: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new ShipmentsService(db, {} as any, {} as any);
  });

  const where = () => db.shipment.findMany.mock.calls[0][0].where;

  it("restricts a SENDER to their own shipments", async () => {
    await service.list({ page: 1, limit: 10 } as any, {
      sub: "s1",
      role: "SENDER",
    } as any);
    expect(where()).toEqual({ senderId: "s1" });
  });

  it("does not restrict a DISPATCHER by sender", async () => {
    await service.list({ page: 1, limit: 10 } as any, {
      sub: "d1",
      role: "DISPATCHER",
    } as any);
    expect(where()).toEqual({});
  });

  it("combines the sender restriction with the status filter", async () => {
    await service.list({ page: 1, limit: 10, status: "DELIVERED" } as any, {
      sub: "s1",
      role: "SENDER",
    } as any);
    expect(where()).toEqual({ senderId: "s1", status: "DELIVERED" });
  });

  it("computes skip/take from page and limit, newest first", async () => {
    await service.list({ page: 3, limit: 20 } as any, {
      sub: "s1",
      role: "SENDER",
    } as any);
    expect(db.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
