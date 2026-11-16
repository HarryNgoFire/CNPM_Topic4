import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";

const DEMO_TRACKING_CODE = "MOVEFLOWDEMO0001";

// A finished two-stage delivery, so the dashboard, driver history and public
// tracking have data before the live demo. It stays DELIVERED with a COMPLETED
// assignment, which keeps both drivers free to be invited. Re-running the seed
// leaves it untouched.
async function seedDeliveredShipment(db: PrismaClient) {
  const existing = await db.shipment.findUnique({
    where: { trackingCode: DEMO_TRACKING_CODE },
  });
  if (existing) return;
  const rule = await db.pricingRule.findUniqueOrThrow({ where: { version: 1 } });
  const sender = await db.user.findUniqueOrThrow({
    where: { email: "sender@gmail.com" },
  });
  const driver = await db.driver.findFirstOrThrow({
    where: { user: { email: "driver-a@gmail.com" } },
  });
  const start = Date.now() - 2 * 60 * 60 * 1000;
  const at = (minutes: number) => new Date(start + minutes * 60 * 1000);
  await db.$transaction(async (tx) => {
    const pickupAddressId = randomUUID();
    const dropoffAddressId = randomUUID();
    await tx.$executeRaw`INSERT INTO "Address" (id,line,ward,district,city,location) VALUES
      (${pickupAddressId}::uuid,'12 Nguyen Trai','1','5','HCMC',ST_SetSRID(ST_MakePoint(106.663,10.754),4326)::geography),
      (${dropoffAddressId}::uuid,'88 Le Loi','Ben Nghe','1','HCMC',ST_SetSRID(ST_MakePoint(106.698,10.772),4326)::geography)`;
    // Rule version 1: 15,000 base + 4.2 km x 3,000 + 2 extra kg x 5,000,
    // STANDARD multiplier 1. The distance is fixed because the seed must not
    // depend on OSRM being reachable.
    const shipment = await tx.shipment.create({
      data: {
        trackingCode: DEMO_TRACKING_CODE,
        senderId: sender.id,
        pickupAddressId,
        dropoffAddressId,
        status: "DELIVERED",
        serviceType: "STANDARD",
        fee: 37600,
        feeBreakdown: {
          currency: "VND",
          ruleId: rule.id,
          ruleVersion: rule.version,
          distanceKm: 4.2,
          distanceSource: "SEED_FIXED_DISTANCE",
          baseFee: 15000,
          distanceFee: 12600,
          weightSurcharge: 10000,
          serviceMultiplier: 1,
          fee: 37600,
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
      ["RECEIVED", "EN_ROUTE_PICKUP", driver.userId, 2],
      ["EN_ROUTE_PICKUP", "ARRIVED_PICKUP", driver.userId, 12],
      ["ARRIVED_PICKUP", "OUT_FOR_DELIVERY", driver.userId, 15],
      ["OUT_FOR_DELIVERY", "ARRIVED_DROPOFF", driver.userId, 38],
      ["ARRIVED_DROPOFF", "DELIVERED", driver.userId, 40],
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

const DEMO_USERS = [
  ["sender@gmail.com", "sender@demo.local", "SENDER"],
  ["driver-a@gmail.com", "driver-a@demo.local", "DRIVER"],
  ["driver-b@gmail.com", "driver-b@demo.local", "DRIVER"],
  ["dispatcher@gmail.com", "dispatcher@demo.local", "DISPATCHER"],
  ["admin@gmail.com", "admin@demo.local", "ADMIN"],
] as const;

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

    const configuredPassword = process.env.DEMO_PASSWORD ?? "admin";
    const passwordBytes = Buffer.byteLength(configuredPassword);
    if (configuredPassword !== "admin" && (passwordBytes < 10 || passwordBytes > 72))
      throw new Error("Set DEMO_PASSWORD to 'admin' or a strong 10–72 byte password");

    const demoPasswordHash = await hash(configuredPassword, 12);

    for (const [email, legacyEmail, role] of DEMO_USERS) {
      const legacyUser = await db.user.findUnique({ where: { email: legacyEmail } });
      const existingUser = await db.user.findUnique({ where: { email } });

      if (legacyUser && existingUser && legacyUser.id !== existingUser.id)
        throw new Error(`Cannot migrate ${legacyEmail}: ${email} is already in use`);

      const targetUser = legacyUser ?? existingUser;
      const baseData = {
        name: email.split("@")[0],
        role,
        emailVerified: true,
        active: true,
      } as const;

      const user = targetUser
        ? await db.user.update({
            where: { id: targetUser.id },
            data: {
              ...baseData,
              ...(targetUser.email !== email ? { email } : {}),
              ...(targetUser.email === email ? {} : { passwordHash: demoPasswordHash }),
              ...(targetUser.email === email && !legacyUser ? {} : { passwordHash: demoPasswordHash }),
            },
          })
        : await db.user.create({
            data: {
              email,
              ...baseData,
              passwordHash: demoPasswordHash,
            },
          });

      if (role === "DRIVER") {
        const driver = await db.driver.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id, status: "AVAILABLE" },
        });
        const lng = email === "driver-a@gmail.com" ? 106.663 : 106.666;
        await db.$executeRaw`UPDATE "Driver" SET "currentLocation"=ST_SetSRID(ST_MakePoint(${lng},10.754),4326)::geography,"lastLocationAt"=now() WHERE id=${driver.id}::uuid`;
      }
    }

    await seedDeliveredShipment(db);
    console.log(
      `Pricing, demo users and delivered shipment ${DEMO_TRACKING_CODE} seeded.`,
    );
  } finally {
    await db.$disconnect();
  }
}

void main();
