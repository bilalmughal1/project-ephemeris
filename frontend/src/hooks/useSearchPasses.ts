import { useQuery } from "@tanstack/react-query";
import { useSearchStore } from "../store/searchStore";
import { searchPasses } from "../services/searchApi";
import type { PassFeatureCollection } from "../services/passesApi";

const EMPTY_PASSES: PassFeatureCollection = { type: "FeatureCollection", features: [] };

export function useSearchPasses() {
  const point = useSearchStore((state) => state.point);
  const radiusKm = useSearchStore((state) => state.radiusKm);
  const from = useSearchStore((state) => state.from);
  const to = useSearchStore((state) => state.to);
  const satellites = useSearchStore((state) => state.satellites);

  return useQuery({
    queryKey: ["passes-search", point, radiusKm, from, to, satellites],
    queryFn: () =>
      point
        ? searchPasses({ lat: point.lat, lng: point.lng, radiusKm, from, to, satellites })
        : Promise.resolve(EMPTY_PASSES),
    enabled: point !== null,
    placeholderData: (previousData) => previousData,
  });
}
