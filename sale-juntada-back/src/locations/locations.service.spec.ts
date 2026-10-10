import { LocationsService } from "./locations.service";

const nominatimResult = (id: number) => ({
  place_id: id,
  display_name: `Lugar ${id}`,
  lat: "-26.8",
  lon: "-65.2",
});

function mockFetchOnce(results: number[]) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(results.map(nominatimResult)),
  });
}

describe("LocationsService caché", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("responde desde caché sin volver a llamar a Nominatim", async () => {
    const fetchMock = mockFetchOnce([1]);
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new LocationsService();

    const first = await service.search("yerba buena");
    const second = await service.search("Yerba  Buena");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("vuelve a consultar cuando la entrada expiró", async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetchOnce([1]);
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new LocationsService();

    await service.search("yerba buena");
    // Un día y monedas: pasada la TTL, la dirección se vuelve a pedir.
    jest.setSystemTime(Date.now() + 25 * 60 * 60 * 1_000);
    await service.search("yerba buena");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no crece sin límite: desaloja las entradas más viejas", async () => {
    jest.useFakeTimers();
    let nextId = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      nextId += 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([nominatimResult(nextId)]),
      });
    }) as unknown as typeof fetch;
    const service = new LocationsService();

    // La cola espacia las llamadas 1,1s para respetar la política de
    // Nominatim; con timers falsos hay que avanzar el reloj a la par.
    const searches = [];
    for (let index = 0; index < 520; index += 1) {
      searches.push(service.search(`consulta numero ${index}`));
    }
    for (let index = 0; index < 520; index += 1) {
      await jest.advanceTimersByTimeAsync(1_200);
    }
    await Promise.all(searches);

    const cache = (service as unknown as { cache: Map<string, unknown> }).cache;
    expect(cache.size).toBeLessThanOrEqual(500);
    // La primera consulta ya no está: fue desalojada por las nuevas.
    expect(cache.has("consulta numero 0")).toBe(false);
    expect(cache.has("consulta numero 519")).toBe(true);
  });

  it("rechaza consultas demasiado cortas sin llamar a Nominatim", async () => {
    const fetchMock = mockFetchOnce([1]);
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new LocationsService();

    await expect(service.search("ab")).rejects.toThrow(
      "Escribí al menos 3 caracteres",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
