import { useQuery } from "@tanstack/react-query";
import { useFiltersStore } from "../store/filtersStore";
import { fetchPasses, type PassFeatureCollection } from "../services/passesApi";

const EMPTY_PASSES: PassFeatureCollection = { type: "FeatureCollection", features: [] };

export function usePasses() {
  const satellites = useFiltersStore((state) => state.satellites);
  const from = useFiltersStore((state) => state.from);
  const to = useFiltersStore((state) => state.to);

  return useQuery({
    queryKey: ["passes", satellites, from, to],
    // An empty satellite selection means "show nothing" -- if we omitted the
    // satellites param entirely the backend would interpret that as "no
    // filter" and return every satellite, which is the opposite of intent.
    queryFn: () =>
      satellites.length === 0
        ? Promise.resolve(EMPTY_PASSES)
        : fetchPasses({ satellites, from, to }),
    placeholderData: (previousData) => previousData,
  });
}
