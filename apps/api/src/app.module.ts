import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./database/database.module";
import { SecurityGuard } from "./common/security";
import { PricingModule } from "./modules/pricing/pricing.module";
import { DispatchModule } from "./modules/dispatch/dispatch.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { ShipmentsModule } from "./modules/shipments/shipments.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthController } from "./modules/health/health.controller";
@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    PricingModule,
    DispatchModule,
    WebhooksModule,
    ShipmentsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SecurityGuard },
  ],
})
export class AppModule {}
