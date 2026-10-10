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

/**
 * Espera mínima entre llamadas a Nominatim.
 *
 * La política de uso de la API pública permite como máximo 1 request por
 * segundo **por aplicación**, no por usuario. Por eso la cola de abajo es
 * global y deliberada: no es un cuello de botella accidental que convenga
 * paralelizar, es el cumplimiento de la política. Levantarla nos haría
 * bloquear. Cuando el volumen lo justifique hay que cambiar de proveedor,
 * no de límite.
 */
const MIN_REQUEST_SPACING_MS = 1_100;

/** Cuánto vale una dirección cacheada. Las calles no se mueven seguido. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

/**
 * Tope de entradas. Sin tope, variar la consulta era suficiente para hacer
 * crecer el Map sin fin y agotar la memoria del proceso.
 */
const CACHE_MAX_ENTRIES = 500;

type CacheEntry = {
  results: LocationSearchResult[];
  expiresAt: number;
};

@Injectable()
export class LocationsService {
  private readonly cache = new Map<string, CacheEntry>();
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
    const cached = this.readCache(cacheKey);
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
      this.nextRequestAt = Date.now() + MIN_REQUEST_SPACING_MS;
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
      this.writeCache(cacheKey, results);
      return results;
    } finally {
      releaseQueue();
    }
  }

  private readCache(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    // Reinsertar mueve la clave al final del orden de iteración del Map,
    // que es lo que convierte el desalojo de abajo en un LRU.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.results;
  }

  private writeCache(key: string, results: LocationSearchResult[]) {
    this.cache.delete(key);
    this.cache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });

    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }
}
