import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

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

    console.log("Pricing and demo users seeded with fixed demo accounts.");
  } finally {
    await db.$disconnect();
  }
}

void main();
