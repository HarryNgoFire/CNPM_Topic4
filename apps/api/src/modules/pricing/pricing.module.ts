import { Module } from "@nestjs/common";
import { PricingService } from "./pricing.service";
import { PricingController } from "./pricing.controller";
import { RoutingService } from "./routing.service";

@Module({
  imports: [],
  providers: [PricingService, RoutingService],
  controllers: [PricingController],
  exports: [PricingService, RoutingService],
})
export class PricingModule {}
