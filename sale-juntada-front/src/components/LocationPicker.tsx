import { useEffect, useRef, useState } from "react";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import {
  gatheringService,
  LocationSearchResult,
} from "../services/gatheringService";

export type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

type LocationPickerProps = {
  value: SelectedLocation | null;
  onChange(value: SelectedLocation): void;
};

const defaultCenter: [number, number] = [-65.2176, -26.8083];

/**
 * Fuente de tiles del mapa.
 *
 * La Tile Usage Policy de OpenStreetMap prohíbe usar `tile.openstreetmap.org`
 * desde una aplicación: bloquean por Referer y user-agent, sin aviso. Sirve
 * para desarrollo, pero en producción hay que apuntar `VITE_MAP_TILES_URL` a
 * un proveedor propio (MapTiler, Protomaps y similares tienen plan gratuito).
 */
const tilesUrl =
  import.meta.env.VITE_MAP_TILES_URL?.trim() ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const tilesAttribution =
  import.meta.env.VITE_MAP_TILES_ATTRIBUTION?.trim() ||
  "© OpenStreetMap contributors";

if (import.meta.env.PROD && !import.meta.env.VITE_MAP_TILES_URL) {
  console.warn(
    "[Sale Juntada] VITE_MAP_TILES_URL no está configurada: el mapa usa los tiles de OpenStreetMap, que no permiten este uso en producción.",
  );
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const queryRef = useRef("");
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let disposed = false;

    const setupMap = async () => {
      const [{ default: maplibregl }] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (disposed || !mapContainerRef.current) return;
      const initialValue = valueRef.current;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        center: initialValue
          ? [initialValue.longitude, initialValue.latitude]
          : defaultCenter,
        zoom: initialValue ? 15 : 11,
        style: {
          version: 8,
          sources: {
            openStreetMap: {
              type: "raster",
              tiles: [tilesUrl],
              tileSize: 256,
              attribution: tilesAttribution,
            },
          },
          layers: [
            {
              id: "openStreetMap",
              type: "raster",
              source: "openStreetMap",
            },
          ],
        },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));

      const marker = new maplibregl.Marker({
        color: "#132f29",
        draggable: true,
      })
        .setLngLat(initialValue
          ? [initialValue.longitude, initialValue.latitude]
          : defaultCenter)
        .addTo(map);

      const updateFromCoordinates = (longitude: number, latitude: number) => {
        onChangeRef.current({
          label: queryRef.current.trim() || "Ubicación marcada en el mapa",
          latitude,
          longitude,
        });
      };

      marker.on("dragend", () => {
        const point = marker.getLngLat();
        updateFromCoordinates(point.lng, point.lat);
      });
      map.on("click", (event) => {
        marker.setLngLat(event.lngLat);
        updateFromCoordinates(event.lngLat.lng, event.lngLat.lat);
      });

      mapRef.current = map;
      markerRef.current = marker;
    };

    void setupMap();
    return () => {
      disposed = true;
      markerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const selectResult = (result: LocationSearchResult) => {
    const selected = {
      label: result.label,
      latitude: result.latitude,
      longitude: result.longitude,
    };
    valueRef.current = selected;
    setQuery(result.label);
    setResults([]);
    setLocationStatus("Dirección encontrada y marcada.");
    onChange(selected);
    markerRef.current?.setLngLat([result.longitude, result.latitude]);
    mapRef.current?.flyTo({
      center: [result.longitude, result.latitude],
      zoom: 16,
    });
  };

  const search = async () => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 3) {
      setError("Escribí al menos 3 caracteres.");
      return;
    }
    setIsSearching(true);
    setError("");
    try {
      const matches = await gatheringService.searchLocations(cleanQuery);
      setResults(matches);
      if (matches.length === 0) {
        setError("No encontramos esa dirección. Probá agregando la ciudad.");
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "No pudimos buscar esa dirección.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite obtener la ubicación.");
      return;
    }
    setIsLocating(true);
    setLocationStatus("Buscando tu ubicación…");
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const selected = {
          label: query.trim() || "Mi ubicación actual",
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        valueRef.current = selected;
        onChange(selected);
        markerRef.current?.setLngLat([coords.longitude, coords.latitude]);
        mapRef.current?.flyTo({
          center: [coords.longitude, coords.latitude],
          zoom: 16,
        });
        setLocationStatus("Ubicación encontrada. Podés ajustar el pin.");
        setIsLocating(false);
      },
      (locationError) => {
        setIsLocating(false);
        setLocationStatus("");
        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError(
            "El permiso de ubicación está bloqueado. Tocá el candado junto a la dirección web, habilitá Ubicación y volvé a intentar.",
          );
          return;
        }
        if (locationError.code === locationError.TIMEOUT) {
          setError(
            "La ubicación tardó demasiado. Activá la ubicación del dispositivo y probá otra vez.",
          );
          return;
        }
        setError(
          "El dispositivo no pudo determinar tu ubicación. Revisá que la ubicación esté activada.",
        );
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="location-picker">
      <div className="location-search">
        <label>
          Dirección o lugar
          <div className="location-search-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void search();
                }
              }}
              placeholder="Ej. Av. Aconquija 1200, Yerba Buena"
            />
            <button
              type="button"
              disabled={isSearching}
              onClick={() => void search()}
            >
              {isSearching ? "Buscando…" : "Buscar"}
            </button>
          </div>
        </label>
      </div>
      {results.length > 0 && (
        <div className="location-results" role="listbox">
          {results.map((result) => (
            <button
              type="button"
              role="option"
              onClick={() => selectResult(result)}
              key={result.id}
            >
              <span>📍</span>
              {result.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <small className="location-error" role="alert">
          {error}
        </small>
      )}
      <div className="location-map" ref={mapContainerRef} />
      <div className="map-actions">
        <small>
          Tocá el mapa o arrastrá el pin para ajustar el punto exacto.
        </small>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? "⌖ Ubicando…" : "◎ Mi ubicación"}
        </button>
      </div>
      {locationStatus && (
        <small className="location-status" role="status">
          {locationStatus}
        </small>
      )}
      {value && (
        <div className="selected-location">
          <span>✓</span>
          <div>
            <strong>Punto marcado</strong>
            <small>{value.label}</small>
          </div>
        </div>
      )}
    </div>
  );
}
