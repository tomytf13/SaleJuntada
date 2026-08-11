import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get("search")
  search(@Query("q") query: string | undefined) {
    return this.locationsService.search(query);
  }
}
