import { Module } from "@nestjs/common";
import { PricingService } from "./pricing.service";
import { PricingController } from "./pricing.controller";
import { OsrmRoutingService } from "./osrm-routing.service";
@Module({
  imports: [],
  providers: [PricingService, OsrmRoutingService],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule {}
