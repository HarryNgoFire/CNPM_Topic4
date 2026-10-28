import {
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
import { PointDto } from "../../common/dto";
import { buildGoogleMapsDirectionsUrl } from "../../common/google-maps";
function setting(name: string, fallback: number) {
  const v = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`Invalid ${name}`);
  return v;
}
@Injectable()
export class DispatchService {
  private running = false;
  private readonly logger = new Logger(DispatchService.name);
  constructor(private readonly db: PrismaService) {}
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
        await tx.driver.update({
          where: { id: driver.id },
          data: { status: "BUSY" },
        });
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
    if (!tasks.length) return tasks;

    // Prisma cannot materialize the PostGIS geography column, so fetch only the
    // coordinates needed to produce stable Google Maps navigation links.
    const ids = tasks.map((task) => task.shipmentId);
    const points = await this.db.$queryRaw<
      Array<{
        shipmentId: string;
        pickupLat: number;
        pickupLng: number;
        dropoffLat: number;
        dropoffLng: number;
      }>
    >`
      SELECT
        s.id::text AS "shipmentId",
        ST_Y(p.location::geometry)::double precision AS "pickupLat",
        ST_X(p.location::geometry)::double precision AS "pickupLng",
        ST_Y(d.location::geometry)::double precision AS "dropoffLat",
        ST_X(d.location::geometry)::double precision AS "dropoffLng"
      FROM "Shipment" s
      JOIN "Address" p ON p.id = s."pickupAddressId"
      JOIN "Address" d ON d.id = s."dropoffAddressId"
      WHERE s.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    `;
    const byShipment = new Map(points.map((point) => [point.shipmentId, point]));
    return tasks.map((task) => {
      const point = byShipment.get(task.shipmentId);
      return {
        ...task,
        navigationUrls: point
          ? {
              pickup: buildGoogleMapsDirectionsUrl({
                lat: point.pickupLat,
                lng: point.pickupLng,
              }),
              dropoff: buildGoogleMapsDirectionsUrl({
                lat: point.dropoffLat,
                lng: point.dropoffLng,
              }),
            }
          : null,
      };
    });
  }
  async location(actor: Actor, input: PointDto) {
    const driver = await this.driverFor(actor);
    await this.db
      .$executeRaw`UPDATE "Driver" SET "currentLocation"=ST_SetSRID(ST_MakePoint(${input.lng},${input.lat}),4326)::geography,"lastLocationAt"=now() WHERE id=${driver.id}::uuid`;
    return { lat: input.lat, lng: input.lng };
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
        assignments: { none: { status: "ACCEPTED" } },
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
