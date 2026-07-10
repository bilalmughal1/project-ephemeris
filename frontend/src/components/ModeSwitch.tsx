import type { CSSProperties } from "react";
import { useFiltersStore } from "../store/filtersStore";

export default function ModeSwitch() {
  const mode = useFiltersStore((state) => state.mode);
  const setMode = useFiltersStore((state) => state.setMode);

  return (
    <div style={wrapStyle}>
      <button
        style={mode === "browse" ? activeButtonStyle : buttonStyle}
        onClick={() => setMode("browse")}
      >
        Browse Tracks
      </button>
      <button
        style={mode === "search" ? activeButtonStyle : buttonStyle}
        onClick={() => setMode("search")}
      >
        Search by Location
      </button>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 2,
  display: "flex",
  gap: 4,
  background: "rgba(20, 20, 24, 0.85)",
  padding: 4,
  borderRadius: 8,
  fontFamily: "system-ui, sans-serif",
};

const buttonStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "#e5e7eb",
  cursor: "pointer",
};

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#38bdf8",
  color: "#0f172a",
  fontWeight: 600,
};
