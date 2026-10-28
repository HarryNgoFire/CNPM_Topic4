import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Actor, CurrentActor, Roles } from "../../common/security";
import { ChangePasswordDto, CreateManagedUserDto, SetUserActiveDto, UpdateProfileDto } from "../../common/dto";
import { AuthService } from "../auth/auth.service";
import { UsersService } from "./users.service";
@ApiTags("Users")
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly service: UsersService, private readonly auth: AuthService) {}

  @Get("users/me") me(@CurrentActor() actor: Actor) { return this.service.me(actor); }
  @Patch("users/me") updateProfile(@CurrentActor() actor: Actor, @Body() input: UpdateProfileDto) { return this.service.updateProfile(actor, input); }
  @Patch("users/me/password") changePassword(@CurrentActor() actor: Actor, @Body() input: ChangePasswordDto) { return this.service.changePassword(actor, input); }

  @Get("admin/users") @Roles("ADMIN") listUsers() { return this.service.listUsers(); }
  @Post("admin/users") @Roles("ADMIN") createManaged(@Body() input: CreateManagedUserDto) { return this.auth.registerManaged(input); }
  @Patch("admin/users/:id/active") @Roles("ADMIN") setActive(@CurrentActor() actor: Actor, @Param("id", new ParseUUIDPipe()) id: string, @Body() input: SetUserActiveDto) { return this.service.setUserActive(actor, id, input); }
}
