import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/security";
import { ShipmentsService } from "../shipments/shipments.service";
@ApiTags("Tracking")
@Controller("tracking")
export class TrackingController {
  constructor(private readonly service: ShipmentsService) {}
  @Get(":trackingCode")
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  tracking(@Param("trackingCode") code: string) {
    if (!/^[A-Z0-9]{12,16}$/.test(code))
      throw new BadRequestException("Invalid tracking code");
    return this.service.tracking(code);
  }
}
