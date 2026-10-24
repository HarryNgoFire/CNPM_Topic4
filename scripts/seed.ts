import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
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
        update: {},
        create: {
          email,
          name: email.split("@")[0],
          role,
          passwordHash: await hash(password, 12),
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
    console.log(
      "Pricing and five demo users seeded. Existing passwords are preserved.",
    );
  } finally {
    await db.$disconnect();
  }
}
void main();
