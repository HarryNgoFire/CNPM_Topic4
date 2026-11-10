import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { DriverStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { Actor } from "../../common/security";
import { DriverLocationDto } from "../../common/dto";
import { WebhooksService } from "../webhooks/webhooks.service";
import { evaluateDriverGps } from "../../common/geo";

export type LocationUpdateResult = {
  accepted: boolean;
  reason?: "TOO_SOON" | "STATIONARY";
  lat: number;
  lng: number;
  capturedAt: string;
  receivedAt: string;
};
function setting(name: string, fallback: number) {
  const v = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`Invalid ${name}`);
  return v;
}
@Injectable()
export class DispatchService {
  private running = false;
  private readonly logger = new Logger(DispatchService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly events: WebhooksService,
  ) {}
  async assign(shipmentId: string, preferredDriverId?: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id=${shipmentId}::uuid FOR UPDATE`;
        const shipment = await tx.shipment.findUnique({
          where: { id: shipmentId },
        });
        if (!shipment) throw new NotFoundException();
        if (shipment.status !== "RECEIVED")
          throw new ConflictException(
            "Shipment is no longer awaiting assignment",
          );
        const active = await tx.driverAssignment.findFirst({
          where: { shipmentId, status: { in: ["PENDING", "ACCEPTED"] } },
        });
        if (active) return active;
        const previous = await tx.driverAssignment.findMany({
          where: { shipmentId },
          select: { driverId: true },
        });
        if (
          !preferredDriverId &&
          previous.length >= setting("MAX_ASSIGNMENT_ATTEMPTS", 5)
        )
          return {
            shipmentId,
            assignment: null,
            reason: "MAX_ATTEMPTS",
            requiresDispatcher: true,
          };
        const excluded = preferredDriverId
          ? []
          : previous.map((a) => a.driverId);
        const radius = setting("DISPATCH_RADIUS_M", 10000);
        const fresh = new Date(
          Date.now() - setting("MAX_LOCATION_AGE_SECONDS", 300) * 1000,
        );
        const candidates = await tx.$queryRaw<
          { id: string; distanceM: number }[]
        >`
    SELECT d.id,ST_Distance(d."currentLocation",a.location) AS "distanceM"
    FROM "Driver" d JOIN "Address" a ON a.id=${shipment.pickupAddressId}::uuid
    JOIN "User" u ON u.id=d."userId" AND u.active=true
    WHERE d.status='AVAILABLE' AND d."currentLocation" IS NOT NULL AND d."lastLocationAt">=${fresh}
    AND ${preferredDriverId ? Prisma.sql`d.id=${preferredDriverId}::uuid` : Prisma.sql`ST_DWithin(d."currentLocation",a.location,${radius})`}
    AND NOT EXISTS (SELECT 1 FROM "DriverAssignment" x WHERE x."driverId"=d.id AND x.status IN ('PENDING','ACCEPTED'))
    AND ${excluded.length ? Prisma.sql`d.id NOT IN (${Prisma.join(excluded.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.sql`TRUE`}
    ORDER BY "distanceM",d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED`;
        if (!candidates.length)
          return {
            shipmentId,
            assignment: null,
            reason: "NO_AVAILABLE_DRIVER",
            requiresDispatcher: true,
          };
        return tx.driverAssignment.create({
          data: {
            shipmentId,
            driverId: candidates[0].id,
            expiresAt: new Date(
              Date.now() + setting("ASSIGNMENT_TIMEOUT_SECONDS", 300) * 1000,
            ),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Driver or shipment already assigned");
      throw error;
    }
  }
  async respond(id: string, action: "ACCEPT" | "REJECT", actor: Actor) {
    const initial = await this.db.driverAssignment.findUnique({
      where: { id },
    });
    if (!initial) throw new NotFoundException();
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id=${initial.shipmentId}::uuid FOR UPDATE`;
      const assignment = await tx.driverAssignment.findUniqueOrThrow({
        where: { id },
        include: { driver: true },
      });
      if (assignment.driver.userId !== actor.sub)
        throw new ForbiddenException();
      const desired = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";
      if (assignment.status === desired)
        return { assignment, idempotent: true, expired: false };
      if (assignment.status !== "PENDING")
        throw new ConflictException("Assignment already resolved");
      if (assignment.expiresAt <= new Date()) {
        const expired = await tx.driverAssignment.update({
          where: { id },
          data: { status: "EXPIRED", respondedAt: new Date() },
        });
        return { assignment: expired, idempotent: false, expired: true };
      }
      await tx.$queryRaw`SELECT id FROM "Driver" WHERE id=${assignment.driverId}::uuid FOR UPDATE`;
      if (action === "ACCEPT") {
        const driver = await tx.driver.findUniqueOrThrow({
          where: { id: assignment.driverId },
        });
        if (driver.status !== "AVAILABLE")
          throw new ConflictException("Driver is not available");

        const shipment = await tx.shipment.findUniqueOrThrow({
          where: { id: initial.shipmentId },
        });
        if (shipment.status !== "RECEIVED")
          throw new ConflictException(
            "Shipment is no longer awaiting assignment",
          );

        await tx.driver.update({
          where: { id: driver.id },
          data: { status: "BUSY" },
        });

        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "EN_ROUTE_PICKUP" },
        });

        await tx.shipmentStatusHistory.create({
          data: {
            shipmentId: shipment.id,
            fromStatus: "RECEIVED",
            toStatus: "EN_ROUTE_PICKUP",
            changedBy: actor.sub,
          },
        });

        await this.events.record(
          tx,
          { id: shipment.id, trackingCode: shipment.trackingCode },
          "RECEIVED",
          "EN_ROUTE_PICKUP",
        );
      }
      const updated = await tx.driverAssignment.update({
        where: { id },
        data: { status: desired, respondedAt: new Date() },
      });
      return { assignment: updated, idempotent: false, expired: false };
    });
    if (result.expired || (action === "REJECT" && !result.idempotent))
      await this.assign(initial.shipmentId);
    if (result.expired) throw new ConflictException("Assignment expired");
    return result;
  }
  async driverFor(actor: Actor) {
    const driver = await this.db.driver.findUnique({
      where: { userId: actor.sub },
    });
    if (!driver) throw new NotFoundException("Driver profile not found");
    return driver;
  }
  async tasks(actor: Actor) {
    const driver = await this.driverFor(actor);
    const tasks = await this.db.driverAssignment.findMany({
      where: { driverId: driver.id, status: { in: ["PENDING", "ACCEPTED"] } },
      include: {
        shipment: { include: { pickup: true, dropoff: true, parcel: true } },
      },
      orderBy: { assignedAt: "asc" },
    });
    return tasks;
  }
  async location(
    actor: Actor,
    input: DriverLocationDto,
  ): Promise<LocationUpdateResult> {
    const driver = await this.driverFor(actor);
    const serverNow = new Date();

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Driver" WHERE id=${driver.id}::uuid FOR UPDATE`;

      const priorRows = await tx.$queryRaw<
        Array<{
          lat: number | null;
          lng: number | null;
          locationAccuracyM: number | null;
          locationCapturedAt: Date | null;
        }>
      >`
        SELECT
          ST_Y("currentLocation"::geometry)::double precision AS lat,
          ST_X("currentLocation"::geometry)::double precision AS lng,
          "locationAccuracyM",
          "locationCapturedAt"
        FROM "Driver"
        WHERE id = ${driver.id}::uuid
      `;

      const prior = priorRows[0];
      const priorData =
        prior &&
        prior.lat !== null &&
        prior.lng !== null &&
        prior.locationCapturedAt !== null
          ? {
              lat: prior.lat,
              lng: prior.lng,
              locationCapturedAt: prior.locationCapturedAt,
            }
          : null;

      const evalResult = evaluateDriverGps({
        current: {
          lat: input.lat,
          lng: input.lng,
          accuracyM: input.accuracyM,
          capturedAt: input.capturedAt,
        },
        prior: priorData,
        serverNow,
      });

      if (!evalResult.valid) {
        throw new BadRequestException(evalResult.error);
      }

      const capturedAtIso = input.capturedAt;
      const receivedAtIso = serverNow.toISOString();

      if (!evalResult.accepted) {
        return {
          accepted: false,
          reason: evalResult.reason,
          lat: input.lat,
          lng: input.lng,
          capturedAt: capturedAtIso,
          receivedAt: receivedAtIso,
        };
      }

      const capturedDate = new Date(capturedAtIso);
      await tx.$executeRaw`
        UPDATE "Driver" SET
          "currentLocation" = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          "lastLocationAt" = ${serverNow},
          "locationAccuracyM" = ${input.accuracyM},
          "locationCapturedAt" = ${capturedDate}
        WHERE id = ${driver.id}::uuid
      `;

      return {
        accepted: true,
        lat: input.lat,
        lng: input.lng,
        capturedAt: capturedAtIso,
        receivedAt: receivedAtIso,
      };
    });
  }
  async status(actor: Actor, status: "AVAILABLE" | "OFFLINE") {
    const driver = await this.driverFor(actor);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Driver" WHERE id=${driver.id}::uuid FOR UPDATE`;
      const active = await tx.driverAssignment.findFirst({
        where: { driverId: driver.id, status: { in: ["PENDING", "ACCEPTED"] } },
      });
      if (active)
        throw new ConflictException(
          "Resolve current assignment before changing availability",
        );
      return tx.driver.update({
        where: { id: driver.id },
        data: { status: status as DriverStatus },
      });
    });
  }
  queue() {
    return this.db.shipment.findMany({
      where: {
        status: "RECEIVED",
        assignments: { none: { status: { in: ["PENDING", "ACCEPTED"] } } },
      },
      include: { assignments: { orderBy: { assignedAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }
  async expireOne(id: string) {
    const initial = await this.db.driverAssignment.findUnique({
      where: { id },
    });
    if (!initial) return;
    const expired = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id=${initial.shipmentId}::uuid FOR UPDATE`;
      return tx.driverAssignment.updateMany({
        where: { id, status: "PENDING", expiresAt: { lte: new Date() } },
        data: { status: "EXPIRED", respondedAt: new Date() },
      });
    });
    if (expired.count) await this.assign(initial.shipmentId);
  }
  @Interval(10000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.db.driverAssignment.findMany({
        where: { status: "PENDING", expiresAt: { lte: new Date() } },
        select: { id: true },
        take: 100,
      });
      for (const item of expired) await this.expireOne(item.id);
      const maxAttempts = setting("MAX_ASSIGNMENT_ATTEMPTS", 5);
      const queue = await this.db.$queryRaw<{ id: string }[]>`
    SELECT s.id FROM "Shipment" s WHERE s.status='RECEIVED'
    AND NOT EXISTS (SELECT 1 FROM "DriverAssignment" a WHERE a."shipmentId"=s.id AND a.status IN ('PENDING','ACCEPTED'))
    AND (SELECT count(*) FROM "DriverAssignment" a WHERE a."shipmentId"=s.id)<${maxAttempts}
    ORDER BY s."createdAt" LIMIT 100`;
      for (const item of queue) await this.assign(item.id);
    } catch (error) {
      this.logger.error(String(error));
    } finally {
      this.running = false;
    }
  }
}
