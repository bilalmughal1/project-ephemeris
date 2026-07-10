import type { CSSProperties } from "react";
import { useSearchStore } from "../store/searchStore";
import { useSearchPasses } from "../hooks/useSearchPasses";

function formatTimestamp(iso: string): string {
  return iso.slice(0, 19).replace("T", " ") + " UTC";
}

export default function AccessesTable() {
  const { data } = useSearchPasses();
  const selectedIndex = useSearchStore((state) => state.selectedIndex);
  const setSelectedIndex = useSearchStore((state) => state.setSelectedIndex);

  // Rendered in raw `data.features` order — this order is what the map's
  // generateId-based feature-state indexing relies on to stay in sync.
  const features = data?.features ?? [];

  return (
    <div style={panelStyle}>
      <h2 style={headingStyle}>Accesses ({features.length})</h2>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Satellite</th>
              <th style={thStyle}>Start</th>
              <th style={thStyle}>End</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, index) => (
              <tr
                key={`${feature.properties.satellite}-${feature.properties.ts_start}-${index}`}
                onClick={() => setSelectedIndex(index)}
                style={{
                  ...rowStyle,
                  background: index === selectedIndex ? "rgba(236, 72, 153, 0.25)" : undefined,
                }}
              >
                <td style={tdStyle}>{feature.properties.satellite}</td>
                <td style={tdStyle}>{formatTimestamp(feature.properties.ts_start)}</td>
                <td style={tdStyle}>{formatTimestamp(feature.properties.ts_end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {features.length === 0 && <div style={emptyStyle}>No accesses in range.</div>}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  zIndex: 1,
  background: "rgba(20, 20, 24, 0.85)",
  color: "#e5e7eb",
  padding: 16,
  borderRadius: 8,
  fontFamily: "system-ui, sans-serif",
  width: 340,
  maxHeight: "calc(100vh - 32px)",
  display: "flex",
  flexDirection: "column",
};

const headingStyle: CSSProperties = { margin: "0 0 8px", fontSize: 14 };
const tableWrapStyle: CSSProperties = { overflowY: "auto" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "4px 6px",
  borderBottom: "1px solid #374151",
  position: "sticky",
  top: 0,
  background: "rgba(20, 20, 24, 0.95)",
};
const tdStyle: CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #27272a" };
const rowStyle: CSSProperties = { cursor: "pointer" };
const emptyStyle: CSSProperties = { fontSize: 12, color: "#9ca3af", padding: 8 };
