import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/security";
import { PrismaService } from "../../database/prisma.service";
@ApiTags("Health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
