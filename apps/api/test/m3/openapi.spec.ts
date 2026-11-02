import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { configure, openapi } from "../../src/bootstrap";
import { PrismaService } from "../../src/database/prisma.service";

const VERBS = ["get", "post", "put", "patch", "delete"];

describe("OpenAPI contract", () => {
  let app: INestApplication;
  let doc: any;
  const operations = () =>
    Object.entries<any>(doc.paths).flatMap(([path, item]) =>
      Object.entries<any>(item)
        .filter(([verb]) => VERBS.includes(verb))
        .map(([verb, operation]) => ({ path, verb, operation })),
    );

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret-used-only-in-automated-tests";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $disconnect: jest.fn(), $queryRaw: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    configure(app);
    await app.init();
    doc = openapi(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("is exported as OpenAPI 3.1", () => {
    expect(doc.openapi).toBe("3.1.0");
  });

  it("gives every operation a schema for its success response", () => {
    const missing = operations().filter(({ operation }) =>
      Object.entries<any>(operation.responses).some(
        ([code, response]) =>
          code.startsWith("2") && !response.content?.["application/json"]?.schema,
      ),
    );
    expect(missing.map(({ verb, path }) => `${verb} ${path}`)).toEqual([]);
  });

  it("points every $ref at a schema that exists", () => {
    const refs = JSON.stringify(doc).match(/#\/components\/schemas\/\w+/g) ?? [];
    const broken = refs.filter(
      (ref) => !doc.components.schemas[ref.split("/").pop() as string],
    );
    expect(broken).toEqual([]);
  });

  it("requires a bearer token everywhere except auth, tracking and health", () => {
    const open = operations()
      .filter(({ operation }) => !operation.security?.length)
      .map(({ path }) => path.replace("/api/v1/", "").split("/")[0]);
    expect([...new Set(open)].sort()).toEqual(["auth", "health", "tracking"]);
  });
});
