import type { CSSProperties } from "react";
import { ALL_SATELLITES, DEFAULT_FROM, DEFAULT_TO, useFiltersStore } from "../store/filtersStore";

// datetime-local inputs give/expect naive "YYYY-MM-DDTHH:mm" values with no
// timezone. Treated here as UTC directly (not converted from the browser's
// local timezone) to match the ISO UTC timestamps the API expects.
function isoToDatetimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

// Guards against empty/partial datetime-local values (e.g. the user clears
// the field) producing a malformed timestamp like ":00Z" -- always returns
// a complete ISO-8601 string DuckDB can parse.
function datetimeLocalToIso(value: string, fallback: string): string {
  if (!value) return fallback;
  // datetime-local yields "YYYY-MM-DDTHH:mm" (16 chars, no seconds) unless
  // second-granularity is enabled, which yields "YYYY-MM-DDTHH:mm:ss" (19
  // chars) -- append only what's missing so seconds never get doubled.
  return value.length > 16 ? `${value}Z` : `${value}:00Z`;
}

export default function FilterPanel() {
  const satellites = useFiltersStore((state) => state.satellites);
  const from = useFiltersStore((state) => state.from);
  const to = useFiltersStore((state) => state.to);
  const toggleSatellite = useFiltersStore((state) => state.toggleSatellite);
  const setFrom = useFiltersStore((state) => state.setFrom);
  const setTo = useFiltersStore((state) => state.setTo);

  return (
    <div style={panelStyle}>
      <h2 style={headingStyle}>Satellites</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ALL_SATELLITES.map((satellite) => (
          <label key={satellite} style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={satellites.includes(satellite)}
              onChange={() => toggleSatellite(satellite)}
            />
            {satellite}
          </label>
        ))}
      </div>

      <h2 style={{ ...headingStyle, marginTop: 16 }}>Time range</h2>
      <label style={fieldLabelStyle}>
        From
        <input
          type="datetime-local"
          value={isoToDatetimeLocal(from)}
          onChange={(e) => setFrom(datetimeLocalToIso(e.target.value, DEFAULT_FROM))}
        />
      </label>
      <label style={{ ...fieldLabelStyle, marginTop: 8 }}>
        To
        <input
          type="datetime-local"
          value={isoToDatetimeLocal(to)}
          onChange={(e) => setTo(datetimeLocalToIso(e.target.value, DEFAULT_TO))}
        />
      </label>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  zIndex: 1,
  background: "rgba(20, 20, 24, 0.85)",
  color: "#e5e7eb",
  padding: 16,
  borderRadius: 8,
  fontFamily: "system-ui, sans-serif",
  minWidth: 160,
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
};

const headingStyle: CSSProperties = { margin: "0 0 8px", fontSize: 14 };
const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
};
const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 13,
};
