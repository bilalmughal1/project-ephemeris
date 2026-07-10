import type { FeatureCollection, LineString } from "geojson";
import type { PassProperties } from "../types/passes";

export type PassFeatureCollection = FeatureCollection<LineString, PassProperties>;

export interface PassesQueryParams {
  satellites: string[];
  from: string;
  to: string;
}

export async function fetchPasses(
  params: PassesQueryParams,
): Promise<PassFeatureCollection> {
  const searchParams = new URLSearchParams();
  if (params.satellites.length > 0) {
    searchParams.set("satellites", params.satellites.join(","));
  }
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  const response = await fetch(`/api/passes?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch passes: ${response.status} ${response.statusText}`,
    );
  }
  return response.json() as Promise<PassFeatureCollection>;
}
