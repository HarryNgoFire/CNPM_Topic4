import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RespondDto, AssignDto } from "../../common/dto";
import { Actor, CurrentActor, Roles } from "../../common/security";
import { DispatchService } from "./dispatch.service";
@ApiTags("Dispatch")
@ApiBearerAuth()
@Controller()
export class DispatchController {
  constructor(private readonly service: DispatchService) {}
  @Post("shipments/:id/assign-driver")
  @HttpCode(200)
  @Roles("DISPATCHER", "ADMIN")
  assign(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: AssignDto,
  ) {
    return this.service.assign(id, input?.driverId);
  }
  @Post("assignments/:id/respond") @HttpCode(200) @Roles("DRIVER") respond(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: RespondDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.service.respond(id, input.action, actor);
  }
  @Get("dispatch/queue") @Roles("DISPATCHER", "ADMIN") queue() {
    return this.service.queue();
  }
}
