import { Prisma, PricingRule, ServiceType } from "@prisma/client";
import {
  calculateFee,
  PricingService,
} from "../src/modules/pricing/pricing.service";
import { PrismaService } from "../src/database/prisma.service";
const dec = (n: number) => new Prisma.Decimal(n);
export const rule: PricingRule = {
  id: "rule-1",
  version: 1,
  active: true,
  effectiveFrom: new Date(0),
  baseFee: dec(15000),
  ratePerKm: dec(3000),
  freeWeightThreshold: dec(3),
  ratePerExtraKg: dec(5000),
  standardMultiplier: dec(1),
  expressMultiplier: dec(1.5),
};
describe("Pricing engine", () => {
  it("multiplies the entire EXPRESS subtotal", () =>
    expect(calculateFee(rule, 8.4, 5, ServiceType.EXPRESS).fee).toBe(75300));
  it("uses STANDARD multiplier", () =>
    expect(calculateFee(rule, 8.4, 5, ServiceType.STANDARD).fee).toBe(50200));
  it("does not charge extra weight at threshold", () =>
    expect(calculateFee(rule, 0, 3, ServiceType.STANDARD).fee).toBe(15000));
  it("charges extra weight at zero distance", () =>
    expect(calculateFee(rule, 0, 5, ServiceType.STANDARD).fee).toBe(25000));
  it("rounds half up to a whole VND", () =>
    expect(calculateFee(rule, 0.0005, 3, ServiceType.STANDARD).fee).toBe(
      15002,
    ));
  it.each([0, -1, NaN, Infinity])("rejects weight %s", (weight) =>
    expect(() => calculateFee(rule, 1, weight, ServiceType.STANDARD)).toThrow(),
  );
  it.each([-1, NaN, Infinity])("rejects distance %s", (distance) =>
    expect(() =>
      calculateFee(rule, distance, 1, ServiceType.STANDARD),
    ).toThrow(),
  );
  it("rejects unknown service", () =>
    expect(() => calculateFee(rule, 1, 1, "FAST" as ServiceType)).toThrow());
  it("rejects fee overflow", () =>
    expect(() => calculateFee(rule, 1e12, 1, ServiceType.STANDARD)).toThrow());
  it("does not mutate rules", () => {
    calculateFee(rule, 8, 4, ServiceType.EXPRESS);
    expect(rule.baseFee.toNumber()).toBe(15000);
  });
});
describe("Pricing API service", () => {
  const db: any = {
    pricingRule: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  db.$transaction = (fn: any) => fn(db);
  const routing = { getDistance: jest.fn() };
  const service = new PricingService(db as PrismaService, routing as any);
  beforeEach(() => {
    jest.clearAllMocks();
    routing.getDistance.mockResolvedValue({
      distanceKm: 8.4,
      distanceSource: "OSRM_DRIVING",
    });
  });
  it("uses OSRM road distance to calculate the quote", async () => {
    db.pricingRule.findFirst.mockResolvedValue(rule);
    const quote = await service.quote({
      pickupAddress: { lat: 10, lng: 106 },
      dropoffAddress: { lat: 11, lng: 106 },
      parcel: { weightKg: 5 },
      serviceType: "EXPRESS",
    } as any);
    expect(quote.fee).toBe(75300);
    expect(quote.distanceSource).toBe("OSRM_DRIVING");
  });
  it("uses the road route result returned by the routing service", async () => {
    db.pricingRule.findFirst.mockResolvedValue(rule);
    routing.getDistance.mockResolvedValue({
      distanceKm: 9.25,
      distanceSource: "OSRM_DRIVING",
    });
    const quote = await service.quote({
      pickupAddress: { lat: 10, lng: 106 },
      dropoffAddress: { lat: 11, lng: 106 },
      parcel: { weightKg: 5 },
      serviceType: "EXPRESS",
    } as any);
    expect(quote.fee).toBe(79125);
    expect(quote.distanceKm).toBe(9.25);
    expect(quote.distanceSource).toBe("OSRM_DRIVING");
    expect(routing.getDistance).toHaveBeenCalled();
  });
  it("does not create a quote if road routing fails", async () => {
    db.pricingRule.findFirst.mockResolvedValue(rule);
    routing.getDistance.mockRejectedValue(new Error("OSRM unavailable"));
    await expect(
      service.quote({
        pickupAddress: { lat: 10, lng: 106 },
        dropoffAddress: { lat: 11, lng: 106 },
        parcel: { weightKg: 5 },
        serviceType: "EXPRESS",
      } as any),
    ).rejects.toThrow("OSRM unavailable");
  });
  it("fails when no rule is effective", async () => {
    db.pricingRule.findFirst.mockResolvedValue(null);
    await expect(service.quote({} as any)).rejects.toThrow("No effective");
  });
  it("lists rule versions", async () => {
    db.pricingRule.findMany.mockResolvedValue([rule]);
    expect(await service.listRules()).toEqual([rule]);
  });
  it("creates a new version, preserving old rule", async () => {
    db.pricingRule.findUnique.mockResolvedValue(rule);
    db.pricingRule.findFirst.mockResolvedValue(rule);
    db.pricingRule.create.mockResolvedValue({ ...rule, version: 2 });
    expect(
      (await service.revise(rule.id, { baseFee: 20000 } as any)).version,
    ).toBe(2);
    expect(db.pricingRule.create).toHaveBeenCalledWith({
      data: { baseFee: 20000, version: 2 },
    });
  });
  it("rejects unknown rule", async () => {
    db.pricingRule.findUnique.mockResolvedValue(null);
    await expect(service.revise("bad", {} as any)).rejects.toThrow();
  });
  it("rejects revision of an old version", async () => {
    db.pricingRule.findUnique.mockResolvedValue(rule);
    db.pricingRule.findFirst.mockResolvedValue({ ...rule, id: "new" });
    await expect(service.revise(rule.id, {} as any)).rejects.toThrow("latest");
  });
});
