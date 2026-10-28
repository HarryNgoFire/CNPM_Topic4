import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { Actor } from "../../common/security";
import {
  ChangePasswordDto,
  SetUserActiveDto,
  UpdateProfileDto,
} from "../../common/dto";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  async me(actor: Actor) {
    const user = await this.db.user.findUnique({
      where: { id: actor.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        emailVerified: true,
        createdAt: true,
        driver: { select: { status: true, vehicleType: true } },
      },
    });
    if (!user) throw new NotFoundException("Account not found");
    return user;
  }

  async updateProfile(actor: Actor, input: UpdateProfileDto) {
    return this.db.user.update({
      where: { id: actor.sub },
      data: { name: input.name.trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  async changePassword(actor: Actor, input: ChangePasswordDto) {
    if (Buffer.byteLength(input.newPassword) > 72)
      throw new BadRequestException("Password exceeds 72 UTF-8 bytes");
    if (input.currentPassword === input.newPassword)
      throw new BadRequestException("New password must be different");
    const user = await this.db.user.findUnique({ where: { id: actor.sub } });
    if (!user) throw new NotFoundException("Account not found");
    if (!(await compare(input.currentPassword, user.passwordHash)))
      throw new UnauthorizedException("Current password is incorrect");

    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(input.newPassword, 12) },
      });
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return {
      ok: true,
      message: "Password changed. Sign in again on other devices.",
    };
  }

  async listUsers() {
    return this.db.user.findMany({
      where: { role: { not: "SYSTEM" } },
      orderBy: [{ createdAt: "desc" }, { email: "asc" }],
      take: 250,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        emailVerified: true,
        createdAt: true,
        driver: { select: { status: true } },
      },
    });
  }

  async setUserActive(actor: Actor, id: string, input: SetUserActiveDto) {
    if (actor.sub === id && input.active === false)
      throw new ConflictException("You cannot deactivate your own account");

    try {
      return await this.db.$transaction(async (tx) => {
        // Serialize admin account-state changes so two parallel requests cannot
        // deactivate the final active administrator at the same time.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(84002)`;
        const target = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true },
        });
        if (!target || target.role === "SYSTEM")
          throw new NotFoundException("Account not found");
        if (target.role === "ADMIN" && !input.active) {
          const activeAdmins = await tx.user.count({
            where: { role: "ADMIN", active: true },
          });
          if (activeAdmins <= 1)
            throw new ConflictException(
              "Cannot deactivate the last active administrator",
            );
        }
        const user = await tx.user.update({
          where: { id },
          data: { active: input.active },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            emailVerified: true,
          },
        });
        if (!input.active) {
          await tx.refreshSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Account not found");
      }
      throw error;
    }
  }
}
