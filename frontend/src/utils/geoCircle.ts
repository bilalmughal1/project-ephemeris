import type { Feature, Polygon } from "geojson";

const EARTH_RADIUS_KM = 6371;

// Approximates a geodesic circle as a polygon of equally-spaced bearings
// around the center. This is a visual overlay only (the backend already
// does the real great-circle proximity math) and, like the rest of the
// current geometry handling, does not special-case the antimeridian —
// a circle whose radius crosses ±180° longitude will draw a streak across
// the map. Deferred, matching the other known limitations in decisions.md.
export function createCirclePolygon(
  center: { lat: number; lng: number },
  radiusKm: number,
  points = 64,
): Feature<Polygon> {
  const coordinates: [number, number][] = [];
  const latRad = (center.lat * Math.PI) / 180;
  const lngRad = (center.lng * Math.PI) / 180;
  const angularDistance = radiusKm / EARTH_RADIUS_KM;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLat),
      );
    coordinates.push([(destLng * 180) / Math.PI, (destLat * 180) / Math.PI]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}
