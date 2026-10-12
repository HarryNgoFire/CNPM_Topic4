import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BookingDto, PricingRuleDto } from "../../common/dto";
import { Roles } from "../../common/security";
import { PricingService } from "./pricing.service";
@ApiTags("Pricing")
@ApiBearerAuth()
@Controller()
export class PricingController {
  constructor(private readonly service: PricingService) {}
  @Post("pricing/quote") @Roles("SENDER", "ADMIN") quote(
    @Body() input: BookingDto,
  ) {
    return this.service.quote(input);
  }
  @Get("admin/pricing-rules") @Roles("ADMIN") list() {
    return this.service.listRules();
  }
  @Put("admin/pricing-rules/:id") @Roles("ADMIN") revise(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: PricingRuleDto,
  ) {
    return this.service.revise(id, input);
  }
}
