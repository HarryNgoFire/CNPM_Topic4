import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, PricingRule, ServiceType } from "@prisma/client";
import Decimal from "decimal.js";
import { PrismaService } from "../../database/prisma.service";
import { BookingDto, PricingRuleDto } from "../../common/dto";
export type DbTx = Prisma.TransactionClient;
export function calculateFee(
  rule: PricingRule,
  distanceKm: number,
  weightKg: number,
  serviceType: ServiceType,
) {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Object.values(ServiceType).includes(serviceType)
  )
    throw new BadRequestException("Invalid pricing input");
  const distanceFee = new Decimal(distanceKm).mul(rule.ratePerKm.toString());
  const weightFee = Decimal.max(
    0,
    new Decimal(weightKg).minus(rule.freeWeightThreshold.toString()),
  ).mul(rule.ratePerExtraKg.toString());
  const multiplier =
    serviceType === ServiceType.EXPRESS
      ? rule.expressMultiplier
      : rule.standardMultiplier;
  const fee = new Decimal(rule.baseFee.toString())
    .plus(distanceFee)
    .plus(weightFee)
    .mul(multiplier.toString())
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (fee.greaterThan("9999999999.99"))
    throw new BadRequestException("Fee exceeds supported range");
  return {
    currency: "VND",
    ruleId: rule.id,
    ruleVersion: rule.version,
    distanceKm,
    baseFee: Number(rule.baseFee),
    distanceFee: distanceFee.toNumber(),
    weightSurcharge: weightFee.toNumber(),
    serviceMultiplier: Number(multiplier),
    fee: fee.toNumber(),
  };
}
@Injectable()
export class PricingService {
  constructor(private readonly db: PrismaService) {}
  async quote(input: BookingDto, tx: DbTx = this.db) {
    const rule = await tx.pricingRule.findFirst({
      where: { active: true, effectiveFrom: { lte: new Date() } },
      orderBy: { version: "desc" },
    });
    if (!rule)
      throw new ServiceUnavailableException("No effective pricing rule");
    const rows = await tx.$queryRaw<{ distanceKm: number }[]>`
   SELECT ST_Distance(ST_SetSRID(ST_MakePoint(${input.pickupAddress.lng},${input.pickupAddress.lat}),4326)::geography,
   ST_SetSRID(ST_MakePoint(${input.dropoffAddress.lng},${input.dropoffAddress.lat}),4326)::geography)/1000.0 AS "distanceKm"`;
    return calculateFee(
      rule,
      rows[0].distanceKm,
      input.parcel.weightKg,
      input.serviceType,
    );
  }
  listRules() {
    return this.db.pricingRule.findMany({ orderBy: { version: "desc" } });
  }
  async revise(id: string, input: PricingRuleDto) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(84001)`;
      const previous = await tx.pricingRule.findUnique({ where: { id } });
      if (!previous) throw new BadRequestException("Unknown pricing rule");
      const latest = await tx.pricingRule.findFirst({
        orderBy: { version: "desc" },
      });
      if (latest?.id !== id)
        throw new ConflictException("Revise the latest rule version");
      return tx.pricingRule.create({
        data: { ...input, version: previous.version + 1 },
      });
    });
  }
}
