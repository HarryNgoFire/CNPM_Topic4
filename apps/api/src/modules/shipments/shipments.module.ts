import { Module } from "@nestjs/common";
import { ShipmentsService } from "./shipments.service";
import { ShipmentsController } from "./shipments.controller";
import { TrackingController } from "../tracking/tracking.controller";
import { PricingModule } from "../pricing/pricing.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { DispatchModule } from "../dispatch/dispatch.module";
@Module({
  imports: [PricingModule, WebhooksModule, DispatchModule],
  providers: [ShipmentsService],
  controllers: [ShipmentsController, TrackingController],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
