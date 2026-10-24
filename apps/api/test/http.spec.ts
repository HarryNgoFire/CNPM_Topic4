import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { AppModule } from "../src/app.module";
import { configure } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { PricingService } from "../src/modules/pricing/pricing.service";
import { ShipmentsService } from "../src/modules/shipments/shipments.service";
import { DispatchService } from "../src/modules/dispatch/dispatch.service";
import { WebhooksService } from "../src/modules/webhooks/webhooks.service";
const ids = {
  SENDER: "00000000-0000-4000-8000-000000000001",
  DRIVER: "00000000-0000-4000-8000-000000000002",
  ADMIN: "00000000-0000-4000-8000-000000000003",
};
describe("HTTP contract with real JWT guard and validation", () => {
  let app: INestApplication;
  let jwt: JwtService;
  const db: any = {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const pricing = {
    quote: jest.fn().mockResolvedValue({ fee: 75300 }),
    listRules: jest.fn(),
    revise: jest.fn(),
  };
  const shipments = {
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    transition: jest.fn(),
    tracking: jest.fn().mockResolvedValue({
      trackingCode: "ABCDEF1234567890",
      status: "RECEIVED",
      history: [],
    }),
  };
  const address = {
    line: "12 Nguyen Trai",
    ward: "1",
    district: "5",
    city: "HCMC",
    lat: 10.754,
    lng: 106.663,
  };
  const booking = {
    pickupAddress: address,
    dropoffAddress: address,
    parcel: { weightKg: 5, lengthCm: 30, widthCm: 20, heightCm: 15 },
    serviceType: "EXPRESS",
  };
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-used-only-in-automated-tests";
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(PricingService)
      .useValue(pricing)
      .overrideProvider(ShipmentsService)
      .useValue(shipments)
      .overrideProvider(DispatchService)
      .useValue({})
      .overrideProvider(WebhooksService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configure(app);
    await app.init();
    jwt = app.get(JwtService);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    db.user.findUnique.mockImplementation(async ({ where }: any) => {
      const role = Object.entries(ids).find(([, id]) => where.id === id)?.[0];
      return role ? { id: where.id, role, active: true } : null;
    });
  });
  const token = (role: keyof typeof ids) => jwt.sign({ sub: ids[role], role });
  it("rejects missing bearer token", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .send(booking)
      .expect(401));
  it("rejects invalid bearer token", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer forged")
      .send(booking)
      .expect(401));
  it("permits Sender quote", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send(booking)
      .expect(201)
      .expect(({ body }) => expect(body.fee).toBe(75300)));
  it("blocks Driver pricing access", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("DRIVER"))
      .send(booking)
      .expect(403));
  it("rejects client-supplied fee", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send({ ...booking, fee: 1 })
      .expect(400));
  it("requires nested booking fields", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send({ serviceType: "EXPRESS" })
      .expect(400));
  it("rejects zero weight", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send({ ...booking, parcel: { ...booking.parcel, weightKg: 0 } })
      .expect(400));
  it("rejects invalid coordinates", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send({ ...booking, pickupAddress: { ...address, lat: 91 } })
      .expect(400));
  it("rejects unknown service", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send({ ...booking, serviceType: "FAST" })
      .expect(400));
  it("public tracking needs no JWT", () =>
    request(app.getHttpServer())
      .get("/api/v1/tracking/ABCDEF1234567890")
      .expect(200));
  it("rejects malformed tracking", () =>
    request(app.getHttpServer()).get("/api/v1/tracking/bad").expect(400));
  it("rejects non-UUID assignment IDs", () =>
    request(app.getHttpServer())
      .post("/api/v1/assignments/not-a-uuid/respond")
      .set("Authorization", "Bearer " + token("DRIVER"))
      .send({ action: "ACCEPT" })
      .expect(400));
  it("rejects disabled account even with valid JWT", () => {
    db.user.findUnique.mockResolvedValue({
      id: ids.SENDER,
      role: "SENDER",
      active: false,
    });
    return request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send(booking)
      .expect(401);
  });
  it("rejects signed token with malformed subject", () =>
    request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set(
        "Authorization",
        "Bearer " + jwt.sign({ sub: "invalid", role: "SENDER" }),
      )
      .send(booking)
      .expect(401));
  it("uses current role instead of trusting JWT role", () => {
    db.user.findUnique.mockResolvedValue({
      id: ids.SENDER,
      role: "DRIVER",
      active: true,
    });
    return request(app.getHttpServer())
      .post("/api/v1/pricing/quote")
      .set("Authorization", "Bearer " + token("SENDER"))
      .send(booking)
      .expect(403);
  });
});
