import { create } from "zustand";

export const ALL_SATELLITES = [
  "YAM20",
  "YAM21",
  "YAM22",
  "YAM23",
  "YAM24",
  "YAM25",
  "YAM26",
  "YAM27",
  "YAM28",
  "YAM29",
] as const;

export const DATA_RANGE_FROM = "2027-03-01T00:00:00Z";
export const DATA_RANGE_TO = "2027-03-08T00:00:00Z";

// Initial view: 2 satellites over day 1 of the week-long data range —
// showing all 10 over the full week by default renders as one unreadable
// mass. Check more satellites or widen the time inputs (up to
// DATA_RANGE_TO) to load more.
const DEFAULT_SATELLITES = ["YAM20", "YAM21"];
const DEFAULT_FROM = "2027-03-01T00:00:00Z";
const DEFAULT_TO = "2027-03-02T00:00:00Z";

export type AppMode = "browse" | "search";

interface FiltersState {
  mode: AppMode;
  satellites: string[];
  from: string;
  to: string;
  setMode: (mode: AppMode) => void;
  toggleSatellite: (satellite: string) => void;
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  mode: "browse",
  satellites: [...DEFAULT_SATELLITES],
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  setMode: (mode) => set({ mode }),
  toggleSatellite: (satellite) =>
    set((state) => ({
      satellites: state.satellites.includes(satellite)
        ? state.satellites.filter((s) => s !== satellite)
        : [...state.satellites, satellite],
    })),
  setFrom: (from) => set({ from }),
  setTo: (to) => set({ to }),
}));
