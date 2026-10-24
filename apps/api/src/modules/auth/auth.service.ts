import {
  ConflictException,
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { hash, compare } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { LoginDto, RegisterDto } from "../../common/dto";
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  async register(input: RegisterDto) {
    // bcrypt accepts up to 72 bytes, not 72 Unicode characters.
    if (Buffer.byteLength(input.password) > 72)
      throw new BadRequestException("Password exceeds 72 UTF-8 bytes");
    try {
      const user = await this.db.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash: await hash(input.password, 12),
          role: input.role,
          ...(input.role === "DRIVER" ? { driver: { create: {} } } : {}),
        },
        select: { id: true, email: true, name: true, role: true },
      });
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Email already registered");
      throw error;
    }
  }
  async login(input: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    const valid = await compare(
      input.password,
      user?.passwordHash ??
        "$2b$12$zsuSEYLfeVCF.WBxOEzmveB5nhJEgqYCAsGiNt7yzrTBj9DSqbBLO",
    );
    if (!user?.active || !valid || user.role === "SYSTEM")
      throw new UnauthorizedException("Invalid credentials");
    const refreshToken = randomBytes(48).toString("hex");
    await this.db.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      refreshToken,
      expiresIn: 900,
    };
  }
  async refresh(token: string) {
    return this.db.$transaction(async (tx) => {
      const digest = tokenHash(token);
      await tx.$queryRaw`SELECT id FROM "RefreshSession" WHERE "tokenHash"=${digest} FOR UPDATE`;
      const session = await tx.refreshSession.findUnique({
        where: { tokenHash: digest },
        include: { user: true },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.active ||
        session.user.role === "SYSTEM"
      )
        throw new UnauthorizedException();
      await tx.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      const refreshToken = randomBytes(48).toString("hex");
      await tx.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: tokenHash(refreshToken),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      return {
        accessToken: await this.jwt.signAsync({
          sub: session.userId,
          role: session.user.role,
        }),
        refreshToken,
        expiresIn: 900,
      };
    });
  }
  async logout(token: string) {
    await this.db.refreshSession.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
