import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ShipmentStatus } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { Actor } from "../../common/security";
import { AddressDto, BookingDto, ShipmentPageDto } from "../../common/dto";
import { PricingService } from "../pricing/pricing.service";
import { WebhooksService } from "../webhooks/webhooks.service";
export function canTransition(current: ShipmentStatus, next: ShipmentStatus) {
  const states: ShipmentStatus[] = [
    "RECEIVED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  const from = states.indexOf(current);
  return from >= 0 && states.indexOf(next) === from + 1;
}
@Injectable()
export class ShipmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly pricing: PricingService,
    private readonly events: WebhooksService,
  ) {}
  private async address(tx: Prisma.TransactionClient, a: AddressDto) {
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "Address" (id,line,ward,district,city,location) VALUES (${id}::uuid,${a.line},${a.ward},${a.district},${a.city},ST_SetSRID(ST_MakePoint(${a.lng},${a.lat}),4326)::geography)`;
    return id;
  }
  async create(input: BookingDto, actor: Actor) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
          const breakdown = await this.pricing.quote(input, tx);
          const pickupAddressId = await this.address(tx, input.pickupAddress);
          const dropoffAddressId = await this.address(tx, input.dropoffAddress);
          const shipment = await tx.shipment.create({
            data: {
              senderId: actor.sub,
              pickupAddressId,
              dropoffAddressId,
              trackingCode: randomBytes(9)
                .toString("hex")
                .slice(0, 16)
                .toUpperCase(),
              serviceType: input.serviceType,
              fee: breakdown.fee,
              feeBreakdown: breakdown,
              parcel: { create: input.parcel },
            },
          });
          await tx.shipmentStatusHistory.create({
            data: {
              shipmentId: shipment.id,
              fromStatus: null,
              toStatus: "RECEIVED",
              changedBy: actor.sub,
            },
          });
          await this.events.record(tx, shipment, null, "RECEIVED");
          return shipment;
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          String(error.meta?.target).includes("trackingCode")
        )
          continue;
        throw error;
      }
    }
    throw new ConflictException("Unable to generate tracking code");
  }
  list(page: ShipmentPageDto, actor: Actor) {
    return this.db.shipment.findMany({
      where: {
        ...(actor.role === "SENDER" ? { senderId: actor.sub } : {}),
        ...(page.status ? { status: page.status } : {}),
      },
      skip: (page.page - 1) * page.limit,
      take: page.limit,
      orderBy: { createdAt: "desc" },
    });
  }
  async get(id: string, actor: Actor) {
    const shipment = await this.db.shipment.findUnique({
      where: { id },
      include: {
        parcel: true,
        pickup: true,
        dropoff: true,
        history: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!shipment) throw new NotFoundException("Shipment not found");
    if (actor.role === "SENDER" && shipment.senderId !== actor.sub)
      throw new ForbiddenException();
    if (actor.role === "DRIVER") {
      const assignment = await this.db.driverAssignment.findFirst({
        where: {
          shipmentId: id,
          status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] },
          driver: { userId: actor.sub },
        },
      });
      if (!assignment) throw new ForbiddenException();
    }
    return shipment;
  }
  async tracking(code: string) {
    const shipment = await this.db.shipment.findUnique({
      where: { trackingCode: code },
      select: {
        trackingCode: true,
        status: true,
        createdAt: true,
        pickup: { select: { city: true } },
        dropoff: { select: { city: true } },
        history: {
          select: { toStatus: true, occurredAt: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    if (!shipment) throw new NotFoundException("Tracking code not found");
    return shipment;
  }
  async transition(id: string, next: ShipmentStatus, actor: Actor) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id=${id}::uuid FOR UPDATE`;
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) throw new NotFoundException();
      const assignment = await tx.driverAssignment.findFirst({
        where: { shipmentId: id, status: { in: ["ACCEPTED", "COMPLETED"] } },
        include: { driver: true },
      });
      if (
        actor.role !== "ADMIN" &&
        (!assignment || assignment.driver.userId !== actor.sub)
      )
        throw new ForbiddenException();
      if (shipment.status === next) return { ...shipment, idempotent: true };
      if (!canTransition(shipment.status, next))
        throw new ConflictException("Invalid status transition");
      if (!assignment || assignment.status !== "ACCEPTED")
        throw new ConflictException("No accepted driver");
      const updated = await tx.shipment.update({
        where: { id },
        data: { status: next },
      });
      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: id,
          fromStatus: shipment.status,
          toStatus: next,
          changedBy: actor.sub,
        },
      });
      await this.events.record(tx, updated, shipment.status, next);
      if (next === "DELIVERED") {
        await tx.driverAssignment.update({
          where: { id: assignment.id },
          data: { status: "COMPLETED" },
        });
        await tx.driver.update({
          where: { id: assignment.driverId },
          data: { status: "AVAILABLE" },
        });
      }
      return updated;
    });
  }
}
