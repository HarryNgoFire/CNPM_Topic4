import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PageDto, SubscriptionDto } from "../../common/dto";
import { Roles } from "../../common/security";
import { WebhooksService } from "./webhooks.service";
@ApiTags("Webhooks")
@ApiBearerAuth()
@Roles("ADMIN")
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}
  @Post("subscriptions") subscribe(@Body() input: SubscriptionDto) {
    return this.service.subscribe(input);
  }
  @Get("events") events(@Query() page: PageDto) {
    return this.service.events(page);
  }
}
