import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BookingDto, ShipmentPageDto, TransitionDto } from "../../common/dto";
import { Actor, CurrentActor, Roles } from "../../common/security";
import { ShipmentsService } from "./shipments.service";
import { DispatchService } from "../dispatch/dispatch.service";
@ApiTags("Shipments")
@ApiBearerAuth()
@Controller("shipments")
export class ShipmentsController {
  private readonly logger = new Logger(ShipmentsController.name);
  constructor(
    private readonly service: ShipmentsService,
    private readonly dispatch: DispatchService,
  ) {}
  @Post() @Roles("SENDER", "ADMIN") async create(
    @Body() input: BookingDto,
    @CurrentActor() actor: Actor,
  ) {
    const shipment = await this.service.create(input, actor);
    try {
      await this.dispatch.assign(shipment.id);
    } catch (error) {
      this.logger.error(
        `Assignment deferred for ${shipment.id}: ${String(error)}`,
      );
    }
    return shipment;
  }
  @Get() @Roles("SENDER", "ADMIN", "DISPATCHER") list(
    @Query() page: ShipmentPageDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.service.list(page, actor);
  }
  @Get(":id") @Roles("SENDER", "ADMIN", "DISPATCHER", "DRIVER") get(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return this.service.get(id, actor);
  }
  @Post(":id/transition") @HttpCode(200) @Roles("DRIVER", "ADMIN") transition(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: TransitionDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.service.transition(id, input.toStatus, actor);
  }
}
