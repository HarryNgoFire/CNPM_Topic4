import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { AssignmentStatus, Prisma, ShipmentStatus } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { Actor } from "../../common/security";
import { AddressDto, BookingDto, ShipmentPageDto } from "../../common/dto";
import { PricingService } from "../pricing/pricing.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { evaluateGeofenceArrival } from "../../common/geo";
import { RoutingService, RouteResult } from "../pricing/routing.service";

export type NavigationPhase =
  | "TO_PICKUP"
  | "AT_PICKUP"
  | "TO_DROPOFF"
  | "AT_DROPOFF"
  | "COMPLETE";

export type LiveTrackingResponse = {
  shipmentId: string;
  status: ShipmentStatus;
  driver: {
    lat: number;
    lng: number;
    accuracyM: number;
    capturedAt: string;
  } | null;
  lastUpdatedAt: string | null;
};

export type NavigationResponse = {
  shipmentId: string;
  shipmentStatus: ShipmentStatus;
  phase: NavigationPhase;
  currentLocation: {
    lat: number;
    lng: number;
    accuracyM: number;
    capturedAt: string;
  } | null;
  destination: { kind: "PICKUP" | "DROPOFF"; lat: number; lng: number } | null;
  route: RouteResult | null;
  arrival: { eligible: boolean; distanceM: number | null; reason?: string };
  routingError?: string | null;
};

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
    @Optional() private readonly routing?: RoutingService,
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
    if (
      shipment.pickupAddressId &&
      shipment.dropoffAddressId &&
      typeof this.db.$queryRaw === "function"
    ) {
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
      const coords = locations && locations.length > 0 ? locations[0] : null;
      if (coords) {
        return {
          ...shipment,
          pickup: shipment.pickup
            ? { ...shipment.pickup, lat: coords.pickupLat, lng: coords.pickupLng }
            : { lat: coords.pickupLat, lng: coords.pickupLng },
          dropoff: shipment.dropoff
            ? { ...shipment.dropoff, lat: coords.dropoffLat, lng: coords.dropoffLng }
            : { lat: coords.dropoffLat, lng: coords.dropoffLng },
        };
      }
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

      // Early idempotency: verify actor ownership and return immediately
      if (shipment.status === toStatus) {
        if (actor.role === "SENDER") {
          if (shipment.senderId !== actor.sub) throw new ForbiddenException();
        } else if (actor.role === "DRIVER") {
          const assignment = await tx.driverAssignment.findFirst({
            where: {
              shipmentId: id,
              driver: { userId: actor.sub },
            },
            include: { driver: true },
          });
          if (!assignment || assignment.driver?.userId !== actor.sub) {
            throw new ForbiddenException();
          }
        } else if (actor.role !== "ADMIN") {
          throw new ForbiddenException();
        }
        return { ...shipment, idempotent: true };
      }

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

      if (!canTransition(shipment.status, toStatus)) {
        throw new ConflictException("Invalid status transition");
      }

      if (
        actor.role === "DRIVER" &&
        (toStatus === "ARRIVED_PICKUP" || toStatus === "ARRIVED_DROPOFF")
      ) {
        if (!acceptedAssignment) {
          throw new ConflictException("No accepted driver assignment found");
        }

        const driverCoords = await tx.$queryRaw<
          Array<{
            lat: number;
            lng: number;
            accuracyM: number | null;
            capturedAt: Date | string | null;
          }>
        >`
          SELECT
            ST_Y(d."currentLocation"::geometry)::double precision AS lat,
            ST_X(d."currentLocation"::geometry)::double precision AS lng,
            d."locationAccuracyM" AS "accuracyM",
            d."locationCapturedAt" AS "capturedAt"
          FROM "Driver" d
          WHERE d.id = ${acceptedAssignment.driverId}::uuid
        `;

        const targetAddressId =
          toStatus === "ARRIVED_PICKUP"
            ? shipment.pickupAddressId
            : shipment.dropoffAddressId;

        const targetCoords = await tx.$queryRaw<
          Array<{ lat: number; lng: number }>
        >`
          SELECT
            ST_Y(a.location::geometry)::double precision AS lat,
            ST_X(a.location::geometry)::double precision AS lng
          FROM "Address" a
          WHERE a.id = ${targetAddressId}::uuid
        `;

        const driverLoc = driverCoords[0];
        const targetLoc = targetCoords[0];

        if (
          !driverLoc ||
          !targetLoc ||
          driverLoc.lat == null ||
          driverLoc.lng == null ||
          !driverLoc.capturedAt
        ) {
          throw new ConflictException(
            "Driver location not available for geofence verification",
          );
        }

        const arrival = evaluateGeofenceArrival({
          currentLocation: {
            lat: driverLoc.lat,
            lng: driverLoc.lng,
            accuracyM: driverLoc.accuracyM ?? 999,
            capturedAt: driverLoc.capturedAt,
          },
          targetLocation: {
            lat: targetLoc.lat,
            lng: targetLoc.lng,
          },
        });

        if (!arrival.eligible) {
          throw new ConflictException(
            arrival.reason ?? "Driver has not arrived at destination geofence",
          );
        }
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

  async navigation(id: string, actor: Actor): Promise<NavigationResponse> {
    const shipment = await this.db.shipment.findUnique({
      where: { id },
    });
    if (!shipment) throw new NotFoundException("Shipment not found");

    if (actor.role === "SENDER") {
      if (shipment.senderId !== actor.sub) {
        throw new ForbiddenException();
      }
    } else if (actor.role === "DRIVER") {
      const allowedStatuses: AssignmentStatus[] = [
        AssignmentStatus.ACCEPTED,
        ...(["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(shipment.status)
          ? [AssignmentStatus.COMPLETED]
          : []),
      ];
      const assignment = await this.db.driverAssignment.findFirst({
        where: {
          shipmentId: id,
          driver: { userId: actor.sub },
          status: { in: allowedStatuses },
        },
      });
      if (!assignment || !allowedStatuses.includes(assignment.status)) {
        throw new ForbiddenException();
      }
    } else if (actor.role !== "ADMIN" && actor.role !== "DISPATCHER") {
      throw new ForbiddenException();
    }

    let phase: NavigationPhase;
    let targetKind: "PICKUP" | "DROPOFF" | null = null;

    switch (shipment.status) {
      case "RECEIVED":
        phase = "TO_PICKUP";
        targetKind = null;
        break;
      case "EN_ROUTE_PICKUP":
        phase = "TO_PICKUP";
        targetKind = "PICKUP";
        break;
      case "ARRIVED_PICKUP":
        phase = "AT_PICKUP";
        targetKind = null;
        break;
      case "OUT_FOR_DELIVERY":
      case "IN_TRANSIT":
        phase = "TO_DROPOFF";
        targetKind = "DROPOFF";
        break;
      case "ARRIVED_DROPOFF":
        phase = "AT_DROPOFF";
        targetKind = null;
        break;
      case "DELIVERED":
      case "CANCELLED":
      case "DELIVERY_FAILED":
      default:
        phase = "COMPLETE";
        targetKind = null;
        break;
    }

    // Load A/B geometry
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
    const coords = locations && locations.length > 0 ? locations[0] : null;

    let destination: { kind: "PICKUP" | "DROPOFF"; lat: number; lng: number } | null = null;
    if (targetKind === "PICKUP" && coords) {
      destination = { kind: "PICKUP", lat: coords.pickupLat, lng: coords.pickupLng };
    } else if (targetKind === "DROPOFF" && coords) {
      destination = { kind: "DROPOFF", lat: coords.dropoffLat, lng: coords.dropoffLng };
    }

    // Load active driver current location
    const assignment = await this.db.driverAssignment.findFirst({
      where: {
        shipmentId: id,
        status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] },
      },
      orderBy: { assignedAt: "desc" },
    });

    let currentLocation: {
      lat: number;
      lng: number;
      accuracyM: number;
      capturedAt: string;
    } | null = null;

    if (assignment?.driverId) {
      const driverCoords = await this.db.$queryRaw<
        Array<{
          lat: number;
          lng: number;
          accuracyM: number | null;
          capturedAt: Date | string | null;
        }>
      >`
        SELECT
          ST_Y(d."currentLocation"::geometry)::double precision AS lat,
          ST_X(d."currentLocation"::geometry)::double precision AS lng,
          d."locationAccuracyM" AS "accuracyM",
          d."locationCapturedAt" AS "capturedAt"
        FROM "Driver" d
        WHERE d.id = ${assignment.driverId}::uuid
      `;
      const dLoc = driverCoords && driverCoords.length > 0 ? driverCoords[0] : null;
      if (dLoc && dLoc.lat != null && dLoc.lng != null && dLoc.capturedAt) {
        currentLocation = {
          lat: dLoc.lat,
          lng: dLoc.lng,
          accuracyM: dLoc.accuracyM ?? 0,
          capturedAt:
            dLoc.capturedAt instanceof Date
              ? dLoc.capturedAt.toISOString()
              : new Date(dLoc.capturedAt).toISOString(),
        };
      }
    }

    // Calculate route and arrival
    let route: RouteResult | null = null;
    let routingError: string | null = null;
    let arrival: { eligible: boolean; distanceM: number | null; reason?: string } = {
      eligible: false,
      distanceM: null,
    };

    if (destination) {
      if (currentLocation && this.routing) {
        try {
          route = await this.routing.getRoute([
            { lat: currentLocation.lat, lng: currentLocation.lng },
            { lat: destination.lat, lng: destination.lng },
          ]);
        } catch (err: any) {
          route = null;
          routingError = err?.message || "Routing service unavailable";
        }
      }

      if (currentLocation) {
        arrival = evaluateGeofenceArrival({
          currentLocation,
          targetLocation: { lat: destination.lat, lng: destination.lng },
        });
      } else {
        arrival = {
          eligible: false,
          distanceM: null,
          reason: "Driver location not available",
        };
      }
    }

    return {
      shipmentId: shipment.id,
      shipmentStatus: shipment.status,
      phase,
      currentLocation,
      destination,
      route,
      arrival,
      routingError,
    };
  }

  async live(id: string, actor: Actor): Promise<LiveTrackingResponse> {
    const shipment = await this.db.shipment.findUnique({
      where: { id },
    });
    if (!shipment) throw new NotFoundException("Shipment not found");

    if (actor.role === "SENDER") {
      if (shipment.senderId !== actor.sub) {
        throw new ForbiddenException();
      }
    } else if (actor.role === "DRIVER") {
      const allowedStatuses: AssignmentStatus[] = [
        AssignmentStatus.ACCEPTED,
        ...(["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(shipment.status)
          ? [AssignmentStatus.COMPLETED]
          : []),
      ];
      const assignment = await this.db.driverAssignment.findFirst({
        where: {
          shipmentId: id,
          driver: { userId: actor.sub },
          status: { in: allowedStatuses },
        },
      });
      if (!assignment || !allowedStatuses.includes(assignment.status)) {
        throw new ForbiddenException();
      }
    } else if (actor.role !== "ADMIN" && actor.role !== "DISPATCHER") {
      throw new ForbiddenException();
    }

    const isTerminal = ["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(
      shipment.status,
    );
    if (isTerminal) {
      return {
        shipmentId: shipment.id,
        status: shipment.status,
        driver: null,
        lastUpdatedAt: null,
      };
    }

    const assignment = await this.db.driverAssignment.findFirst({
      where: {
        shipmentId: id,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      orderBy: { assignedAt: "desc" },
    });

    if (!assignment?.driverId) {
      return {
        shipmentId: shipment.id,
        status: shipment.status,
        driver: null,
        lastUpdatedAt: null,
      };
    }

    const driverCoords = await this.db.$queryRaw<
      Array<{
        lat: number;
        lng: number;
        accuracyM: number | null;
        capturedAt: Date | string | null;
      }>
    >`
      SELECT
        ST_Y(d."currentLocation"::geometry)::double precision AS lat,
        ST_X(d."currentLocation"::geometry)::double precision AS lng,
        d."locationAccuracyM" AS "accuracyM",
        d."locationCapturedAt" AS "capturedAt"
      FROM "Driver" d
      WHERE d.id = ${assignment.driverId}::uuid
    `;

    const dLoc = driverCoords && driverCoords.length > 0 ? driverCoords[0] : null;
    if (!dLoc || dLoc.lat == null || dLoc.lng == null || !dLoc.capturedAt) {
      return {
        shipmentId: shipment.id,
        status: shipment.status,
        driver: null,
        lastUpdatedAt: null,
      };
    }

    const capturedAtIso = new Date(dLoc.capturedAt).toISOString();
    return {
      shipmentId: shipment.id,
      status: shipment.status,
      driver: {
        lat: dLoc.lat,
        lng: dLoc.lng,
        accuracyM: dLoc.accuracyM ?? 0,
        capturedAt: capturedAtIso,
      },
      lastUpdatedAt: capturedAtIso,
    };
  }
}
