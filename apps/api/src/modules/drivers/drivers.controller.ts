import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DriverStatusDto, PointDto } from "../../common/dto";
import { Actor, CurrentActor, Roles } from "../../common/security";
import { DispatchService } from "../dispatch/dispatch.service";
@ApiTags("Drivers")
@ApiBearerAuth()
@Roles("DRIVER")
@Controller("drivers/me")
export class DriversController {
  constructor(private readonly service: DispatchService) {}
  @Get("tasks") tasks(@CurrentActor() actor: Actor) {
    return this.service.tasks(actor);
  }
  @Patch("location") location(
    @CurrentActor() actor: Actor,
    @Body() input: PointDto,
  ) {
    return this.service.location(actor, input);
  }
  @Patch("status") status(
    @CurrentActor() actor: Actor,
    @Body() input: DriverStatusDto,
  ) {
    return this.service.status(actor, input.status);
  }
}
