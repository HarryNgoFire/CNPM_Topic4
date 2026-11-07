import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
const DEMO_TRACKING_CODE = "MOVEFLOWDEMO0001";
// A finished delivery, so the dashboard and public tracking have data before the
// live demo. It stays DELIVERED and COMPLETED to keep both drivers free to assign.
async function seedDeliveredShipment(db: PrismaClient) {
  const existing = await db.shipment.findUnique({
    where: { trackingCode: DEMO_TRACKING_CODE },
  });
  if (existing) return;
  const rule = await db.pricingRule.findUniqueOrThrow({
    where: { version: 1 },
  });
  const sender = await db.user.findUniqueOrThrow({
    where: { email: "sender@demo.local" },
  });
  const driver = await db.driver.findFirstOrThrow({
    where: { user: { email: "driver-a@demo.local" } },
  });
  const start = Date.now() - 2 * 60 * 60 * 1000;
  const at = (minutes: number) => new Date(start + minutes * 60 * 1000);
  await db.$transaction(async (tx) => {
    const pickupAddressId = randomUUID();
    const dropoffAddressId = randomUUID();
    await tx.$executeRaw`INSERT INTO "Address" (id,line,ward,district,city,location) VALUES
      (${pickupAddressId}::uuid,'12 Nguyen Trai','1','5','HCMC',ST_SetSRID(ST_MakePoint(106.663,10.754),4326)::geography),
      (${dropoffAddressId}::uuid,'88 Le Loi','Ben Nghe','1','HCMC',ST_SetSRID(ST_MakePoint(106.698,10.772),4326)::geography)`;
    // 15,000 base + 4.3 km x 3,000 + 2 extra kg x 5,000, STANDARD multiplier 1.
    const shipment = await tx.shipment.create({
      data: {
        trackingCode: DEMO_TRACKING_CODE,
        senderId: sender.id,
        pickupAddressId,
        dropoffAddressId,
        status: "DELIVERED",
        serviceType: "STANDARD",
        fee: 37900,
        feeBreakdown: {
          currency: "VND",
          ruleId: rule.id,
          ruleVersion: rule.version,
          distanceKm: 4.3,
          distanceSource: "POSTGIS_GEODESIC_FALLBACK",
          baseFee: 15000,
          distanceFee: 12900,
          weightSurcharge: 10000,
          serviceMultiplier: 1,
          fee: 37900,
        },
        createdAt: at(0),
        parcel: {
          create: { weightKg: 5, lengthCm: 30, widthCm: 20, heightCm: 15 },
        },
      },
    });
    await tx.driverAssignment.create({
      data: {
        shipmentId: shipment.id,
        driverId: driver.id,
        status: "COMPLETED",
        assignedAt: at(1),
        expiresAt: at(6),
        respondedAt: at(2),
      },
    });
    const steps = [
      [null, "RECEIVED", sender.id, 0],
      ["RECEIVED", "IN_TRANSIT", driver.userId, 15],
      ["IN_TRANSIT", "OUT_FOR_DELIVERY", driver.userId, 40],
      ["OUT_FOR_DELIVERY", "DELIVERED", driver.userId, 65],
    ] as const;
    for (const [fromStatus, toStatus, changedBy, minutes] of steps)
      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: shipment.id,
          fromStatus,
          toStatus,
          changedBy,
          occurredAt: at(minutes),
        },
      });
  });
}
async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await db.pricingRule.upsert({
      where: { version: 1 },
      update: {},
      create: {
        version: 1,
        baseFee: 15000,
        ratePerKm: 3000,
        freeWeightThreshold: 3,
        ratePerExtraKg: 5000,
        standardMultiplier: 1,
        expressMultiplier: 1.5,
      },
    });
    const password = process.env.DEMO_PASSWORD;
    if (!password || password.length < 10 || Buffer.byteLength(password) > 72)
      throw new Error("Set DEMO_PASSWORD (10–72 bytes) to seed demo accounts");
    for (const [email, role] of [
      ["sender@demo.local", "SENDER"],
      ["driver-a@demo.local", "DRIVER"],
      ["driver-b@demo.local", "DRIVER"],
      ["dispatcher@demo.local", "DISPATCHER"],
      ["admin@demo.local", "ADMIN"],
    ] as const) {
      const user = await db.user.upsert({
        where: { email },
        update: { emailVerified: true, active: true },
        create: {
          email,
          name: email.split("@")[0],
          role,
          passwordHash: await hash(password, 12),
          emailVerified: true,
        },
      });
      if (role === "DRIVER") {
        const driver = await db.driver.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id, status: "AVAILABLE" },
        });
        const lng = email.startsWith("driver-a") ? 106.663 : 106.666;
        await db.$executeRaw`UPDATE "Driver" SET "currentLocation"=ST_SetSRID(ST_MakePoint(${lng},10.754),4326)::geography,"lastLocationAt"=now() WHERE id=${driver.id}::uuid`;
      }
    }
    await seedDeliveredShipment(db);
    console.log(
      `Pricing, five demo users and delivered shipment ${DEMO_TRACKING_CODE} seeded. Existing passwords are preserved.`,
    );
  } finally {
    await db.$disconnect();
  }
}
void main();
