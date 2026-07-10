import type { PassFeatureCollection } from "./passesApi";

export interface SearchPassesParams {
  lat: number;
  lng: number;
  radiusKm: number;
  from?: string;
  to?: string;
  satellites?: string[];
}

export async function searchPasses(
  params: SearchPassesParams,
): Promise<PassFeatureCollection> {
  const searchParams = new URLSearchParams();
  searchParams.set("lat", String(params.lat));
  searchParams.set("lng", String(params.lng));
  searchParams.set("radius_km", String(params.radiusKm));
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.satellites && params.satellites.length > 0) {
    searchParams.set("satellites", params.satellites.join(","));
  }

  const response = await fetch(`/api/passes/search?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(
      `Failed to search passes: ${response.status} ${response.statusText}`,
    );
  }
  return response.json() as Promise<PassFeatureCollection>;
}
