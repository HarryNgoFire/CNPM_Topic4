import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { LoginDto, RefreshDto, RegisterDto, ResendVerificationDto, VerifyEmailDto } from "../../common/dto";
import { Public } from "../../common/security";
import { AuthService } from "./auth.service";
@ApiTags("Auth")
@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  register(@Body() input: RegisterDto) { return this.service.register(input); }

  @Post("verify-email")
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  verifyEmail(@Body() input: VerifyEmailDto) { return this.service.verifyEmail(input.email, input.code); }

  @Post("resend-verification")
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resend(@Body() input: ResendVerificationDto) { return this.service.resendVerification(input.email); }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  login(@Body() input: LoginDto) { return this.service.login(input); }

  @Post("refresh") @HttpCode(200)
  refresh(@Body() input: RefreshDto) { return this.service.refresh(input.refreshToken); }

  @Post("logout") @HttpCode(200)
  logout(@Body() input: RefreshDto) { return this.service.logout(input.refreshToken); }
}
