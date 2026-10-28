import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  TooManyRequestsException,
  ServiceUnavailableException,
  Optional,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { hash, compare } from "bcryptjs";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { CreateManagedUserDto, LoginDto, RegisterDto } from "../../common/dto";
import { EmailDeliveryService } from "./email-delivery.service";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const normaliseEmail = (email: string) => email.trim().toLowerCase();
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    @Optional() private readonly emailDelivery?: EmailDeliveryService,
  ) {}

  private otpHash(email: string, code: string) {
    const pepper = process.env.OTP_SECRET || process.env.JWT_SECRET || "development-only-change-me";
    return createHmac("sha256", pepper).update(`${normaliseEmail(email)}:${code}`).digest("hex");
  }

  private async createAndSendCode(user: { id: string; email: string; name: string }) {
    if (!this.emailDelivery) return; // Unit-test construction only; Nest always injects EmailDeliveryService.
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.db.emailVerificationCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const verification = await this.db.emailVerificationCode.create({
      data: {
        userId: user.id,
        codeHash: this.otpHash(user.email, code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    try {
      await this.emailDelivery.sendVerificationCode(user.email, user.name, code);
    } catch (error) {
      await this.db.emailVerificationCode.delete({ where: { id: verification.id } }).catch(() => undefined);
      throw error;
    }
  }

  async register(input: RegisterDto) {
    if (Buffer.byteLength(input.password) > 72)
      throw new BadRequestException("Password exceeds 72 UTF-8 bytes");
    let user: { id: string; email: string; name: string; role: string; emailVerified: boolean };
    try {
      user = await this.db.user.create({
        data: {
          email: normaliseEmail(input.email),
          name: input.name.trim(),
          passwordHash: await hash(input.password, 12),
          // Public registration is deliberately limited to customers. Driver and
          // management accounts must be provisioned/approved by an administrator.
          role: "SENDER",
        },
        select: { id: true, email: true, name: true, role: true, emailVerified: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Email already registered");
      throw error;
    }
    try {
      await this.createAndSendCode(user);
    } catch (error) {
      // Do not leave a dead, unverified account after a delivery failure.
      await this.db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Could not send verification email");
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false, verificationRequired: true };
  }

  async registerManaged(input: CreateManagedUserDto) {
    if (Buffer.byteLength(input.password) > 72) throw new BadRequestException("Password exceeds 72 UTF-8 bytes");
    let user: { id: string; email: string; name: string; role: string; emailVerified: boolean };
    try {
      user = await this.db.user.create({
        data: {
          email: normaliseEmail(input.email),
          name: input.name.trim(),
          passwordHash: await hash(input.password, 12),
          role: input.role,
          ...(input.role === "DRIVER" ? { driver: { create: {} } } : {}),
        },
        select: { id: true, email: true, name: true, role: true, emailVerified: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Email already registered");
      throw error;
    }
    try {
      await this.createAndSendCode(user);
    } catch (error) {
      await this.db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Could not send verification email");
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false, verificationRequired: true };
  }

  async verifyEmail(emailInput: string, code: string) {
    const email = normaliseEmail(emailInput);
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || user.emailVerified || !user.active)
      throw new BadRequestException("Code is invalid or expired");
    const record = await this.db.emailVerificationCode.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!record || record.expiresAt <= new Date())
      throw new BadRequestException("Code is invalid or expired");
    if (record.attempts >= 5) throw new TooManyRequestsException("Too many incorrect codes. Request a new code.");
    const expected = Buffer.from(record.codeHash, "hex");
    const actual = Buffer.from(this.otpHash(email, code), "hex");
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) {
      await this.db.emailVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("Code is invalid or expired");
    }
    await this.db.$transaction(async (tx) => {
      await tx.emailVerificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
      await tx.emailVerificationCode.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
      await tx.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    });
    return { verified: true, email };
  }

  async resendVerification(emailInput: string) {
    const email = normaliseEmail(emailInput);
    const user = await this.db.user.findUnique({ where: { email } });
    // Same response for unknown, already verified and eligible accounts to reduce account enumeration.
    const response = { ok: true, message: "If your account needs verification, a code will be sent." };
    if (!user || user.emailVerified || !user.active) return response;
    const recent = await this.db.emailVerificationCode.findFirst({
      where: { userId: user.id, consumedAt: null }, orderBy: { createdAt: "desc" },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < 60_000) return response;
    await this.createAndSendCode({ id: user.id, email: user.email, name: user.name });
    return response;
  }

  async login(input: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: normaliseEmail(input.email) } });
    const valid = await compare(input.password, user?.passwordHash ?? "$2b$12$zsuSEYLfeVCF.WBxOEzmveB5nhJEgqYCAsGiNt7yzrTBj9DSqbBLO");
    if (!user?.active || !valid || user.role === "SYSTEM")
      throw new UnauthorizedException("Invalid credentials");
    if (!user.emailVerified) throw new UnauthorizedException("EMAIL_NOT_VERIFIED");
    const refreshToken = randomBytes(48).toString("hex");
    await this.db.refreshSession.create({
      data: { userId: user.id, tokenHash: tokenHash(refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      refreshToken,
      expiresIn: 900,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified },
    };
  }

  async refresh(token: string) {
    return this.db.$transaction(async (tx) => {
      const digest = tokenHash(token);
      await tx.$queryRaw`SELECT id FROM "RefreshSession" WHERE "tokenHash"=${digest} FOR UPDATE`;
      const session = await tx.refreshSession.findUnique({ where: { tokenHash: digest }, include: { user: true } });
      if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active || !session.user.emailVerified || session.user.role === "SYSTEM")
        throw new UnauthorizedException();
      await tx.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      const refreshToken = randomBytes(48).toString("hex");
      await tx.refreshSession.create({ data: { userId: session.userId, tokenHash: tokenHash(refreshToken), expiresAt: new Date(Date.now() + 7 * 86400000) } });
      return {
        accessToken: await this.jwt.signAsync({ sub: session.userId, role: session.user.role }),
        refreshToken,
        expiresIn: 900,
        user: { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role, emailVerified: session.user.emailVerified },
      };
    });
  }
  async logout(token: string) {
    await this.db.refreshSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }
}
