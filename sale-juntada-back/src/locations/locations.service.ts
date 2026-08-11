import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";

export type LocationSearchResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

@Injectable()
export class LocationsService {
  private readonly cache = new Map<string, LocationSearchResult[]>();
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  async search(rawQuery: string | undefined) {
    const query = rawQuery?.trim().replace(/\s+/g, " ");
    if (!query || query.length < 3 || query.length > 160) {
      throw new BadRequestException(
        "Escribí al menos 3 caracteres para buscar una dirección",
      );
    }

    const cacheKey = query.toLocaleLowerCase("es");
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let releaseQueue: () => void = () => undefined;
    const previousRequest = this.requestQueue;
    this.requestQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    await previousRequest;

    try {
      const waitMs = Math.max(0, this.nextRequestAt - Date.now());
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "ar");

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "SaleJuntada/0.1 (https://sale-juntada-front.vercel.app)",
        },
      });
      this.nextRequestAt = Date.now() + 1100;
      if (!response.ok) {
        throw new BadGatewayException(
          "El buscador de direcciones no está disponible",
        );
      }

      const body = (await response.json()) as NominatimResult[];
      const results = body.map((item) => ({
        id: String(item.place_id),
        label: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }));
      this.cache.set(cacheKey, results);
      return results;
    } finally {
      releaseQueue();
    }
  }
}
