import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard, RolesGuard } from "../../src/common/security";

const id = "00000000-0000-4000-8000-000000000001";
const secret = "test-secret-used-only-in-automated-tests";
const options = { issuer: "topic4", audience: "topic4-api" };
const jwt = new JwtService({
  secret,
  signOptions: { ...options, algorithm: "HS256", expiresIn: "15m" },
  verifyOptions: { ...options, algorithms: ["HS256"] },
});
const context = (request: object) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as any;
const reflectorFor = (metadata: Record<string, unknown>) =>
  ({ getAllAndOverride: (key: string) => metadata[key] }) as unknown as Reflector;
const account = { id, role: "SENDER", active: true, emailVerified: true };

describe("AuthGuard", () => {
  const db = { user: { findUnique: jest.fn() } };
  const guard = new AuthGuard(reflectorFor({}), jwt, db as any);
  const bearer = (token: string) => ({
    headers: { authorization: `Bearer ${token}` },
  });
  const sign = (claims: object, extra: object = {}) =>
    jwt.signAsync(claims, extra);

  beforeEach(() => {
    db.user.findUnique.mockReset().mockResolvedValue(account);
  });

  it("lets public routes through without touching the database", async () => {
    const open = new AuthGuard(
      reflectorFor({ public: true }),
      jwt,
      db as any,
    );
    await expect(open.canActivate(context({ headers: {} }))).resolves.toBe(true);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("attaches the database role, not the role claimed by the token", async () => {
    db.user.findUnique.mockResolvedValue({ ...account, role: "DRIVER" });
    const request: any = bearer(await sign({ sub: id, role: "ADMIN" }));
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toEqual({ sub: id, role: "DRIVER" });
  });

  it.each([
    ["no header", {}],
    ["another scheme", { authorization: "Basic abc" }],
    ["a bearer without token", { authorization: "Bearer" }],
    ["a forged token", { authorization: "Bearer not.a.jwt" }],
  ])("rejects %s", async (_, headers) => {
    await expect(guard.canActivate(context({ headers }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const token = await sign({ sub: id, role: "SENDER" }, { expiresIn: -1 });
    await expect(guard.canActivate(context(bearer(token)))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a token signed for another audience", async () => {
    const token = await sign(
      { sub: id, role: "SENDER" },
      { audience: "another-api" },
    );
    await expect(guard.canActivate(context(bearer(token)))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects a subject that is not a UUID before querying", async () => {
    const token = await sign({ sub: "1 OR 1=1", role: "ADMIN" });
    await expect(guard.canActivate(context(bearer(token)))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["deleted", null],
    ["locked", { ...account, active: false }],
    ["unverified", { ...account, emailVerified: false }],
    ["internal SYSTEM", { ...account, role: "SYSTEM" }],
  ])("rejects a %s account", async (_, user) => {
    db.user.findUnique.mockResolvedValue(user);
    const token = await sign({ sub: id, role: "SENDER" });
    await expect(guard.canActivate(context(bearer(token)))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe("RolesGuard", () => {
  const actor = { user: { sub: id, role: "SENDER" } };

  it("allows any authenticated role when the route lists none", () => {
    expect(new RolesGuard(reflectorFor({})).canActivate(context(actor))).toBe(
      true,
    );
  });

  it("allows a listed role", () => {
    const guard = new RolesGuard(reflectorFor({ roles: ["SENDER", "ADMIN"] }));
    expect(guard.canActivate(context(actor))).toBe(true);
  });

  it("forbids a role that is not listed", () => {
    const guard = new RolesGuard(reflectorFor({ roles: ["ADMIN"] }));
    expect(() => guard.canActivate(context(actor))).toThrow(ForbiddenException);
  });

  it("forbids a role-restricted route when no actor was established", () => {
    const guard = new RolesGuard(reflectorFor({ roles: ["ADMIN"] }));
    expect(() => guard.canActivate(context({}))).toThrow(ForbiddenException);
  });

  it("skips public routes", () => {
    const guard = new RolesGuard(
      reflectorFor({ public: true, roles: ["ADMIN"] }),
    );
    expect(guard.canActivate(context({}))).toBe(true);
  });
});
