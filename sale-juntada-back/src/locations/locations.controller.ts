import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * Cada búsqueda que no esté en caché consume el único request por segundo
   * que la política de Nominatim nos permite para toda la aplicación. Un
   * cliente que dispare de más deja sin buscador a todos los demás, así que
   * el límite acá es más estricto que el global.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("search")
  search(@Query("q") query: string | undefined) {
    return this.locationsService.search(query);
  }
}
