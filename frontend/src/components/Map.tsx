import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, LineString, Polygon } from "geojson";
import type { PassProperties } from "../types/passes";
import { usePasses } from "../hooks/usePasses";
import { ALL_SATELLITES, useFiltersStore } from "../store/filtersStore";
import { useSearchStore } from "../store/searchStore";
import { useSearchPasses } from "../hooks/useSearchPasses";
import { createCirclePolygon } from "../utils/geoCircle";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const INITIAL_CENTER: [number, number] = [55, 25];
const INITIAL_ZOOM = 2;

const PASSES_SOURCE_ID = "passes";
const PASSES_LINE_LAYER_ID = "passes-lines";
const SEARCH_RADIUS_SOURCE_ID = "search-radius";
const SEARCH_RADIUS_FILL_LAYER_ID = "search-radius-fill";
const SEARCH_RADIUS_LINE_LAYER_ID = "search-radius-line";
const SEARCH_RESULTS_SOURCE_ID = "search-results";
const SEARCH_RESULTS_LAYER_ID = "search-results-lines";

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

const SEARCH_RESULT_LINE_COLOR = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  "#ec4899",
  "#ffffff",
] as unknown as maplibregl.ExpressionSpecification;

const SEARCH_RESULT_LINE_WIDTH = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  4.5,
  2.5,
] as unknown as maplibregl.ExpressionSpecification;

const EMPTY_PASSES: FeatureCollection<LineString, PassProperties> = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_POLYGONS: FeatureCollection<Polygon> = { type: "FeatureCollection", features: [] };

export default function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const modeRef = useRef<"browse" | "search">("browse");
  const prevSelectedIndexRef = useRef<number | null>(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  const { data } = usePasses();
  const mode = useFiltersStore((state) => state.mode);
  const point = useSearchStore((state) => state.point);
  const radiusKm = useSearchStore((state) => state.radiusKm);
  const setPoint = useSearchStore((state) => state.setPoint);
  const selectedIndex = useSearchStore((state) => state.selectedIndex);
  const { data: searchData } = useSearchPasses();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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

      map.addSource(SEARCH_RADIUS_SOURCE_ID, { type: "geojson", data: EMPTY_POLYGONS });
      map.addLayer({
        id: SEARCH_RADIUS_FILL_LAYER_ID,
        type: "fill",
        source: SEARCH_RADIUS_SOURCE_ID,
        layout: { visibility: "none" },
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: SEARCH_RADIUS_LINE_LAYER_ID,
        type: "line",
        source: SEARCH_RADIUS_SOURCE_ID,
        layout: { visibility: "none" },
        paint: { "line-color": "#38bdf8", "line-width": 1.5, "line-dasharray": [2, 2] },
      });

      map.addSource(SEARCH_RESULTS_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_PASSES,
        generateId: true,
      });
      map.addLayer({
        id: SEARCH_RESULTS_LAYER_ID,
        type: "line",
        source: SEARCH_RESULTS_SOURCE_ID,
        layout: { visibility: "none" },
        paint: {
          "line-color": SEARCH_RESULT_LINE_COLOR,
          "line-width": SEARCH_RESULT_LINE_WIDTH,
          "line-opacity": 0.9,
        },
      });

      setIsStyleLoaded(true);
    });

    map.on("click", (e) => {
      if (modeRef.current !== "search") return;
      setPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
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

  // Toggle Function 1 / Function 2 layer visibility and cursor by mode.
  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const browseVis = mode === "browse" ? "visible" : "none";
    const searchVis = mode === "search" ? "visible" : "none";
    map.setLayoutProperty(PASSES_LINE_LAYER_ID, "visibility", browseVis);
    map.setLayoutProperty(SEARCH_RADIUS_FILL_LAYER_ID, "visibility", searchVis);
    map.setLayoutProperty(SEARCH_RADIUS_LINE_LAYER_ID, "visibility", searchVis);
    map.setLayoutProperty(SEARCH_RESULTS_LAYER_ID, "visibility", searchVis);
    map.getCanvas().style.cursor = mode === "search" ? "crosshair" : "";
  }, [isStyleLoaded, mode]);

  // Marker at the clicked search point.
  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;
    const map = mapRef.current;
    if (mode === "search" && point) {
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ color: "#ffffff" });
      }
      markerRef.current.setLngLat([point.lng, point.lat]).addTo(map);
    } else {
      markerRef.current?.remove();
    }
  }, [isStyleLoaded, mode, point]);

  // Radius circle refresh.
  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource(SEARCH_RADIUS_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(
      point
        ? { type: "FeatureCollection", features: [createCirclePolygon(point, radiusKm)] }
        : EMPTY_POLYGONS,
    );
  }, [isStyleLoaded, point, radiusKm]);

  // Search results refresh — same single-source+setData discipline as Function 1.
  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource(SEARCH_RESULTS_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(searchData ?? EMPTY_PASSES);
  }, [isStyleLoaded, searchData]);

  // Table-row -> map highlight (one-way sync). Relies on generateId indexing
  // matching AccessesTable's raw feature order.
  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const prev = prevSelectedIndexRef.current;
    if (prev !== null) {
      map.setFeatureState({ source: SEARCH_RESULTS_SOURCE_ID, id: prev }, { selected: false });
    }
    if (selectedIndex !== null) {
      map.setFeatureState(
        { source: SEARCH_RESULTS_SOURCE_ID, id: selectedIndex },
        { selected: true },
      );
    }
    prevSelectedIndexRef.current = selectedIndex;
  }, [isStyleLoaded, selectedIndex]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
