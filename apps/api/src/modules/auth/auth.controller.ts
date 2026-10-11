import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { LoginDto, RefreshDto, RegisterDto } from "../../common/dto";
import { Public } from "../../common/security";
import { AuthService } from "./auth.service";
@ApiTags("Auth")
@Public()
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Post("register") register(@Body() input: RegisterDto) {
    return this.service.register(input);
  }
  @Post("login") @HttpCode(200) login(@Body() input: LoginDto) {
    return this.service.login(input);
  }
  @Post("refresh") @HttpCode(200) refresh(@Body() input: RefreshDto) {
    return this.service.refresh(input.refreshToken);
  }
  @Post("logout") @HttpCode(200) logout(@Body() input: RefreshDto) {
    return this.service.logout(input.refreshToken);
  }
}
