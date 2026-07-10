import { create } from "zustand";
import { ALL_SATELLITES } from "./filtersStore";

export interface SearchPoint {
  lat: number;
  lng: number;
}

const DEFAULT_RADIUS_KM = 500;
const DEFAULT_FROM = "2027-03-01T00:00:00Z";
const DEFAULT_TO = "2027-03-02T00:00:00Z";

interface SearchState {
  point: SearchPoint | null;
  radiusKm: number;
  from: string;
  to: string;
  satellites: string[];
  selectedIndex: number | null;
  setPoint: (point: SearchPoint) => void;
  setRadiusKm: (radiusKm: number) => void;
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
  setSelectedIndex: (index: number | null) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  point: null,
  radiusKm: DEFAULT_RADIUS_KM,
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  satellites: [...ALL_SATELLITES],
  selectedIndex: null,
  setPoint: (point) => set({ point, selectedIndex: null }),
  setRadiusKm: (radiusKm) => set({ radiusKm, selectedIndex: null }),
  setFrom: (from) => set({ from, selectedIndex: null }),
  setTo: (to) => set({ to, selectedIndex: null }),
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
}));
