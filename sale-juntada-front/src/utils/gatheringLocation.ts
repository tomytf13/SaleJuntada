import type { Gathering } from "../services/gatheringService";

export function gatheringLocation(gathering: Gathering) {
  const address = gathering.finalizedLocation?.trim() || gathering.locationHint?.trim();
  const { locationLatitude: latitude, locationLongitude: longitude } = gathering;
  const hasPoint = latitude != null && longitude != null &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    (!gathering.finalizedLocation?.trim() || gathering.finalizedLocation.trim() === gathering.locationHint?.trim());
  const destination = hasPoint ? `${latitude},${longitude}` : address;
  const query = destination ? encodeURIComponent(destination) : null;
  // Omitting origin lets Google Maps use the device's current location.
  const directionsUrl = query ? `https://www.google.com/maps/dir/?api=1&destination=${query}&dir_action=navigate` : null;
  return { address, hasPoint, query, directionsUrl };
}
