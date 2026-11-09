import {
  BadRequestException,
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
import { buildGoogleMapsDirectionsUrl } from "../../common/google-maps";

const VALID_TRANSITIONS = new Set<string>([
  "RECEIVED>EN_ROUTE_PICKUP",
  "EN_ROUTE_PICKUP>ARRIVED_PICKUP",
  "ARRIVED_PICKUP>OUT_FOR_DELIVERY",
  "OUT_FOR_DELIVERY>ARRIVED_DROPOFF",
  "ARRIVED_DROPOFF>DELIVERED",
  "IN_TRANSIT>OUT_FOR_DELIVERY",
  "OUT_FOR_DELIVERY>DELIVERY_FAILED",
  "ARRIVED_DROPOFF>DELIVERY_FAILED",
  "IN_TRANSIT>DELIVERY_FAILED",
  "RECEIVED>CANCELLED",
  "EN_ROUTE_PICKUP>CANCELLED",
  "ARRIVED_PICKUP>CANCELLED",
  "IN_TRANSIT>CANCELLED",
  "OUT_FOR_DELIVERY>CANCELLED",
  "ARRIVED_DROPOFF>CANCELLED",
]);

export function canTransition(current: ShipmentStatus, next: ShipmentStatus): boolean {
  return VALID_TRANSITIONS.has(`${current}>${next}`);
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
    // Route lookup is an external HTTP call, so compute the quote before opening
    // the database transaction to avoid holding locks during network latency.
    const breakdown = await this.pricing.quote(input);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
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
    const locations = await this.db.$queryRaw<
      Array<{
        pickupLat: number;
        pickupLng: number;
        dropoffLat: number;
        dropoffLng: number;
      }>
    >`
      SELECT
        ST_Y(p.location::geometry)::double precision AS "pickupLat",
        ST_X(p.location::geometry)::double precision AS "pickupLng",
        ST_Y(d.location::geometry)::double precision AS "dropoffLat",
        ST_X(d.location::geometry)::double precision AS "dropoffLng"
      FROM "Address" p
      JOIN "Address" d ON d.id = ${shipment.dropoffAddressId}::uuid
      WHERE p.id = ${shipment.pickupAddressId}::uuid
    `;
    const coordinates = locations[0];
    return {
      ...shipment,
      navigationUrls: actor.role === "DRIVER" && coordinates
        ? {
            pickup: buildGoogleMapsDirectionsUrl({
              lat: coordinates.pickupLat,
              lng: coordinates.pickupLng,
            }),
            dropoff: buildGoogleMapsDirectionsUrl({
              lat: coordinates.dropoffLat,
              lng: coordinates.dropoffLng,
            }),
          }
        : null,
    };
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
  async transition(
    id: string,
    requestOrNext: ShipmentStatus | { toStatus: ShipmentStatus; reason?: string },
    actor: Actor,
  ) {
    const toStatus: ShipmentStatus =
      typeof requestOrNext === "string" ? requestOrNext : requestOrNext.toStatus;
    const rawReason =
      typeof requestOrNext === "object" && requestOrNext !== null
        ? requestOrNext.reason
        : undefined;
    const trimmedReason =
      typeof rawReason === "string" ? rawReason.trim() : undefined;

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id=${id}::uuid FOR UPDATE`;
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) throw new NotFoundException();

      const activeAssignment = await tx.driverAssignment.findFirst({
        where: {
          shipmentId: id,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        include: { driver: true },
      });

      const acceptedAssignment =
        activeAssignment?.status === "ACCEPTED" ? activeAssignment : null;

      // Ownership and role checks
      if (actor.role === "SENDER") {
        if (shipment.senderId !== actor.sub) {
          throw new ForbiddenException();
        }
        if (toStatus !== "CANCELLED") {
          throw new ForbiddenException("Senders can only cancel shipments");
        }
        if (shipment.status !== "RECEIVED" || acceptedAssignment) {
          throw new ConflictException(
            "Sender can only cancel unassigned shipments awaiting pickup",
          );
        }
      } else if (actor.role === "DRIVER") {
        if (toStatus === "CANCELLED") {
          throw new ForbiddenException("Drivers cannot cancel shipments");
        }
        if (
          !acceptedAssignment ||
          acceptedAssignment.driver.userId !== actor.sub
        ) {
          throw new ForbiddenException();
        }
        if (toStatus === "DELIVERY_FAILED") {
          if (
            !["OUT_FOR_DELIVERY", "ARRIVED_DROPOFF", "IN_TRANSIT"].includes(
              shipment.status,
            )
          ) {
            throw new ConflictException(
              "Delivery failure only permitted during delivery stages",
            );
          }
        }
      } else if (actor.role === "ADMIN") {
        if (toStatus !== "CANCELLED" && !acceptedAssignment) {
          throw new ConflictException("No accepted driver");
        }
      } else {
        throw new ForbiddenException();
      }

      // Idempotency: if already in the target status, return immediately
      if (shipment.status === toStatus) return { ...shipment, idempotent: true };

      if (!canTransition(shipment.status, toStatus)) {
        throw new ConflictException("Invalid status transition");
      }

      // Validate reason presence and bounds
      if (toStatus === "CANCELLED" || toStatus === "DELIVERY_FAILED") {
        if (
          !trimmedReason ||
          trimmedReason.length < 1 ||
          trimmedReason.length > 255
        ) {
          throw new BadRequestException(
            `Reason is required for ${toStatus} (1-255 characters)`,
          );
        }
      } else {
        if (trimmedReason !== undefined && trimmedReason.length > 0) {
          throw new BadRequestException(
            `Reason is not allowed for status ${toStatus}`,
          );
        }
      }

      const updated = await tx.shipment.update({
        where: { id },
        data: {
          status: toStatus,
          reason:
            toStatus === "CANCELLED" || toStatus === "DELIVERY_FAILED"
              ? trimmedReason
              : null,
        },
      });

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: id,
          fromStatus: shipment.status,
          toStatus,
          changedBy: actor.sub,
          reason:
            toStatus === "CANCELLED" || toStatus === "DELIVERY_FAILED"
              ? trimmedReason
              : null,
        },
      });

      await this.events.record(tx, updated, shipment.status, toStatus);

      // Centralized terminal cleanup: DELIVERED, CANCELLED, DELIVERY_FAILED
      if (
        toStatus === "DELIVERED" ||
        toStatus === "CANCELLED" ||
        toStatus === "DELIVERY_FAILED"
      ) {
        if (activeAssignment) {
          await tx.driverAssignment.update({
            where: { id: activeAssignment.id },
            data: { status: "COMPLETED" },
          });
          await tx.$queryRaw`SELECT id FROM "Driver" WHERE id=${activeAssignment.driverId}::uuid FOR UPDATE`;
          await tx.driver.update({
            where: { id: activeAssignment.driverId },
            data: { status: "AVAILABLE" },
          });
        }
      }

      return updated;
    });
  }
}
