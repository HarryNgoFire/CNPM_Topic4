import {
  Controller,
  Get,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { GeocodingSearchDto, GeocodingReverseDto } from "../../common/dto";
import { GeocodingService, GeocodedAddress } from "./geocoding.service";

@ApiTags("Geocoding")
@ApiBearerAuth()
@Controller("geocoding")
export class GeocodingController {
  constructor(private readonly service: GeocodingService) {}

  @Get("search")
  search(@Query() query: GeocodingSearchDto): Promise<GeocodedAddress[]> {
    return this.service.search(query.q, query.limit);
  }

  @Get("reverse")
  reverse(@Query() query: GeocodingReverseDto): Promise<GeocodedAddress> {
    return this.service.reverse(query.lat, query.lng);
  }
}
