import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { EmailDeliveryService } from "./email-delivery.service";
@Module({
  providers: [AuthService, EmailDeliveryService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
