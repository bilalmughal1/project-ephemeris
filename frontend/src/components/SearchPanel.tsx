import type { CSSProperties } from "react";
import { useSearchStore } from "../store/searchStore";

// Same naive UTC treatment as FilterPanel's datetime-local handling.
function isoToDatetimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

function datetimeLocalToIso(value: string): string {
  return `${value}:00Z`;
}

export default function SearchPanel() {
  const point = useSearchStore((state) => state.point);
  const radiusKm = useSearchStore((state) => state.radiusKm);
  const from = useSearchStore((state) => state.from);
  const to = useSearchStore((state) => state.to);
  const setRadiusKm = useSearchStore((state) => state.setRadiusKm);
  const setFrom = useSearchStore((state) => state.setFrom);
  const setTo = useSearchStore((state) => state.setTo);

  return (
    <div style={panelStyle}>
      <h2 style={headingStyle}>Search by Location</h2>
      <p style={hintStyle}>Click the map to set a search point.</p>
      <div style={pointStyle}>
        {point ? `${point.lat.toFixed(3)}, ${point.lng.toFixed(3)}` : "No point selected"}
      </div>

      <label style={fieldLabelStyle}>
        Radius (km)
        <input
          type="number"
          min={1}
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
        />
      </label>

      <h2 style={{ ...headingStyle, marginTop: 16 }}>Time range</h2>
      <label style={fieldLabelStyle}>
        From
        <input
          type="datetime-local"
          value={isoToDatetimeLocal(from)}
          onChange={(e) => setFrom(datetimeLocalToIso(e.target.value))}
        />
      </label>
      <label style={{ ...fieldLabelStyle, marginTop: 8 }}>
        To
        <input
          type="datetime-local"
          value={isoToDatetimeLocal(to)}
          onChange={(e) => setTo(datetimeLocalToIso(e.target.value))}
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
  minWidth: 200,
};

const headingStyle: CSSProperties = { margin: "0 0 8px", fontSize: 14 };
const hintStyle: CSSProperties = { margin: "0 0 8px", fontSize: 12, color: "#9ca3af" };
const pointStyle: CSSProperties = { fontSize: 13, marginBottom: 12, fontFamily: "monospace" };
const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 13,
};
