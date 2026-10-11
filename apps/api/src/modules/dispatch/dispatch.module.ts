import { Module } from "@nestjs/common";
import { DispatchService } from "./dispatch.service";
import { DispatchController } from "./dispatch.controller";
import { DriversController } from "../drivers/drivers.controller";
@Module({
  imports: [],
  providers: [DispatchService],
  controllers: [DispatchController, DriversController],
  exports: [DispatchService],
})
export class DispatchModule {}
