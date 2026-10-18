import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { createHash } from "node:crypto";
import { AuthService } from "../../src/modules/auth/auth.service";

// register() hashes with cost 12 (slow on purpose), so allow more time per test.
jest.setTimeout(20000);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const PASSWORD = "Correct-Horse-1";
const HASH = hashSync(PASSWORD, 4); // low cost only to keep the test fast

describe("QA: AuthService (unit, mocked DB)", () => {
  let db: any;
  let tx: any;
  let jwt: any;
  let service: AuthService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refreshSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    db = {
      user: { create: jest.fn(), findUnique: jest.fn() },
      refreshSession: { create: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(async (fn: (t: any) => unknown) => fn(tx)),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue("signed.jwt.token") };
    service = new AuthService(db, jwt);
  });

  describe("register", () => {
    const input = (over: object = {}) =>
      ({
        email: "New.User@Example.COM",
        name: "New User",
        password: PASSWORD,
        role: "SENDER",
        ...over,
      }) as any;

    it("rejects a password over 72 UTF-8 bytes even when it has fewer than 72 characters", async () => {
      const password = "\u1ec7".repeat(25); // 25 characters, 75 bytes
      await expect(service.register(input({ password }))).rejects.toThrow(
        BadRequestException,
      );
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("accepts a password of exactly 72 bytes", async () => {
      db.user.create.mockResolvedValue({ id: "u1" });
      await expect(
        service.register(input({ password: "a".repeat(72) })),
      ).resolves.toEqual({ id: "u1" });
    });

    it("stores a lower-case email and a bcrypt cost-12 hash, never the plain password", async () => {
      db.user.create.mockResolvedValue({ id: "u1" });
      await service.register(input());
      const data = db.user.create.mock.calls[0][0].data;
      expect(data.email).toBe("new.user@example.com");
      expect(data.passwordHash).not.toBe(PASSWORD);
      expect(data.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    });

    it("creates a driver profile only for the DRIVER role", async () => {
      db.user.create.mockResolvedValue({ id: "u1" });
      await service.register(input({ role: "DRIVER" }));
      expect(db.user.create.mock.calls[0][0].data.driver).toEqual({
        create: {},
      });
      await service.register(input({ role: "SENDER" }));
      expect(db.user.create.mock.calls[1][0].data.driver).toBeUndefined();
    });

    it("maps a unique-email violation to 409 and rethrows other errors", async () => {
      db.user.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "test",
        }),
      );
      await expect(service.register(input())).rejects.toThrow(
        ConflictException,
      );
      const boom = new Error("db down");
      db.user.create.mockRejectedValueOnce(boom);
      await expect(service.register(input())).rejects.toBe(boom);
    });
  });

  describe("login", () => {
    const activeUser = (over: object = {}) => ({
      id: "u1",
      role: "SENDER",
      active: true,
      passwordHash: HASH,
      ...over,
    });

    const failures: [string, any, string][] = [
      ["an unknown email", null, PASSWORD],
      ["an inactive user", activeUser({ active: false }), PASSWORD],
      ["the SYSTEM role", activeUser({ role: "SYSTEM" }), PASSWORD],
      ["a wrong password", activeUser(), "Wrong-Password-9"],
    ];
    it.each(failures)("rejects %s with the same 401 message", async (_label, user, password) => {
      db.user.findUnique.mockResolvedValueOnce(user);
      await expect(
        service.login({ email: "a@b.c", password } as any),
      ).rejects.toThrow(new UnauthorizedException("Invalid credentials"));
      expect(db.refreshSession.create).not.toHaveBeenCalled();
    });

    it("issues tokens and stores only the SHA-256 hash of the refresh token", async () => {
      db.user.findUnique.mockResolvedValueOnce(activeUser());
      const result = await service.login({
        email: "Sender@Demo.Local",
        password: PASSWORD,
      } as any);

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: "sender@demo.local" },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "u1", role: "SENDER" });
      expect(result.accessToken).toBe("signed.jwt.token");
      expect(result.expiresIn).toBe(900);
      expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/);

      const data = db.refreshSession.create.mock.calls[0][0].data;
      expect(data.tokenHash).toBe(sha256(result.refreshToken));
      expect(data.tokenHash).not.toBe(result.refreshToken);
      const ttl = data.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(7 * 86400000 - 10000);
      expect(ttl).toBeLessThanOrEqual(7 * 86400000);
    });
  });

  describe("refresh", () => {
    const session = (over: object = {}) => ({
      id: "s1",
      userId: "u1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: "u1", role: "DRIVER", active: true },
      ...over,
    });

    const failures: [string, any][] = [
      ["an unknown token", null],
      ["a revoked session", session({ revokedAt: new Date() })],
      ["an expired session", session({ expiresAt: new Date(Date.now() - 1000) })],
      ["an inactive user", session({ user: { id: "u1", role: "DRIVER", active: false } })],
      ["the SYSTEM role", session({ user: { id: "u1", role: "SYSTEM", active: true } })],
    ];
    it.each(failures)("rejects %s", async (_label, found) => {
      tx.refreshSession.findUnique.mockResolvedValue(found);
      await expect(service.refresh("raw-token")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tx.refreshSession.update).not.toHaveBeenCalled();
      expect(tx.refreshSession.create).not.toHaveBeenCalled();
    });

    it("rotates: revokes the old session and creates a new one in one transaction", async () => {
      tx.refreshSession.findUnique.mockResolvedValue(session());
      const result = await service.refresh("raw-token");

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.refreshSession.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: sha256("raw-token") } }),
      );
      expect(tx.refreshSession.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { revokedAt: expect.any(Date) },
      });
      const created = tx.refreshSession.create.mock.calls[0][0].data;
      expect(created.userId).toBe("u1");
      expect(created.tokenHash).toBe(sha256(result.refreshToken));
      expect(result.refreshToken).not.toBe("raw-token");
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: "u1", role: "DRIVER" });
    });
  });

  describe("logout", () => {
    it("revokes only the matching, not-yet-revoked session and is idempotent", async () => {
      db.refreshSession.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.logout("raw-token")).resolves.toEqual({ ok: true });
      expect(db.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256("raw-token"), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
