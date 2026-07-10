import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, LineString } from "geojson";
import type { PassProperties } from "../types/passes";
import { usePasses } from "../hooks/usePasses";
import { ALL_SATELLITES } from "../store/filtersStore";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const INITIAL_CENTER: [number, number] = [55, 25];
const INITIAL_ZOOM = 2;

const PASSES_SOURCE_ID = "passes";
const PASSES_LINE_LAYER_ID = "passes-lines";

const SATELLITE_COLORS: Record<(typeof ALL_SATELLITES)[number], string> = {
  YAM20: "#f87171",
  YAM21: "#fb923c",
  YAM22: "#facc15",
  YAM23: "#a3e635",
  YAM24: "#4ade80",
  YAM25: "#2dd4bf",
  YAM26: "#22d3ee",
  YAM27: "#60a5fa",
  YAM28: "#a78bfa",
  YAM29: "#f472b6",
};

const SATELLITE_LINE_COLOR = [
  "match",
  ["get", "satellite"],
  ...ALL_SATELLITES.flatMap((satellite) => [satellite, SATELLITE_COLORS[satellite]]),
  "#94a3b8",
] as unknown as maplibregl.ExpressionSpecification;

const EMPTY_PASSES: FeatureCollection<LineString, PassProperties> = {
  type: "FeatureCollection",
  features: [],
};

export default function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  const { data } = usePasses();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl());

    map.on("load", () => {
      map.addSource(PASSES_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_PASSES,
      });

      map.addLayer({
        id: PASSES_LINE_LAYER_ID,
        type: "line",
        source: PASSES_SOURCE_ID,
        paint: {
          "line-color": SATELLITE_LINE_COLOR,
          "line-width": 1.5,
          "line-opacity": 0.7,
        },
      });

      setIsStyleLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsStyleLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;

    const source = mapRef.current.getSource(PASSES_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(data ?? EMPTY_PASSES);
  }, [isStyleLoaded, data]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
