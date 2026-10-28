/**
 * Google Maps URLs do not require a Maps Platform API key. The destination is
 * supplied as coordinates to avoid ambiguous address matching. Google Maps
 * opens the app when available, otherwise its web version.
 */
export function buildGoogleMapsDirectionsUrl(destination: {
  lat: number;
  lng: number;
}): string {
  const configuredMode = (
    process.env.GOOGLE_MAPS_TRAVEL_MODE ?? "TWO_WHEELER"
  ).toUpperCase();
  const travelMode = configuredMode === "DRIVE" ? "driving" : "two-wheeler";
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode,
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
