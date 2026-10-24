import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { isUUID } from "class-validator";
import { Role } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
export interface Actor {
  sub: string;
  role: Role;
}
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const Public = () => SetMetadata("public", true);
export const CurrentActor = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Actor =>
    ctx.switchToHttp().getRequest().user,
);
@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>("public", [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = String(req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException();
    let claims: Actor;
    try {
      claims = await this.jwt.verifyAsync<Actor>(token);
    } catch {
      throw new UnauthorizedException();
    }
    // Use current DB role, never a stale JWT role. SYSTEM is reserved for internal jobs.
    if (!isUUID(claims.sub)) throw new UnauthorizedException();
    const user = await this.db.user.findUnique({ where: { id: claims.sub } });
    if (!user?.active || user.role === Role.SYSTEM)
      throw new UnauthorizedException();
    req.user = { sub: user.id, role: user.role };
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
