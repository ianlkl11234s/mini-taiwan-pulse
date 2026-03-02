import { useEffect, useRef, useState } from "react";
import { ALL_PRESETS } from "../map/cameraPresets";
import type { CameraPreset } from "../types";

interface Props {
  isDarkTheme?: boolean;
  onJump: (presetId: string) => void;
  currentId?: string;
}

const overviewPresets = ALL_PRESETS.filter((p) => p.category === "overview");
const cityPresets = ALL_PRESETS.filter((p) => p.category === "city");
const airportPresets = ALL_PRESETS.filter((p) => p.category === "airport");

export function LocationJump({ isDarkTheme = true, onJump, currentId }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 面板外 click 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = (id: string) => {
    onJump(id);
    setOpen(false);
  };

  const btnStyle: React.CSSProperties = {
    background: isDarkTheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
    color: isDarkTheme ? "#fff" : "#333",
    border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 14,
    fontFamily: "monospace",
    backdropFilter: "blur(8px)",
    cursor: "pointer",
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={btnStyle}>
        地點跳轉 ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 320,
            zIndex: 100,
            background: "rgba(14,14,22,0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "12px 14px",
            fontFamily: "monospace",
          }}
        >
          {/* Overview */}
          {overviewPresets.map((p) => (
            <Item key={p.id} preset={p} active={currentId === p.id} onSelect={handleSelect} />
          ))}

          <Divider />
          <SectionTitle>CITY</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
            {cityPresets.map((p) => (
              <Item key={p.id} preset={p} active={currentId === p.id} onSelect={handleSelect} compact />
            ))}
          </div>

          <Divider />
          <SectionTitle>AIRPORT</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {airportPresets.map((p) => (
              <Item key={p.id} preset={p} active={currentId === p.id} onSelect={handleSelect} airport />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "rgba(255,255,255,0.4)",
        fontSize: 11,
        letterSpacing: 2,
        marginBottom: 6,
        fontFamily: "monospace",
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "8px 0" }} />;
}

function Item({
  preset,
  active,
  onSelect,
  compact,
  airport,
}: {
  preset: CameraPreset;
  active: boolean;
  onSelect: (id: string) => void;
  compact?: boolean;
  airport?: boolean;
}) {
  const [hover, setHover] = useState(false);

  const iata = airport
    ? (() => {
        const IATA_MAP: Record<string, string> = {
          RCTP: "TPE", RCSS: "TSA", RCKH: "KHH", RCMQ: "RMQ",
          RCYU: "HUN", RCBS: "KNH", RCFG: "LZN", RCFN: "TTT",
          RCKU: "CYI", RCNN: "TNN", RCQC: "MZG", RCCM: "CMJ",
          RCGI: "GNI", RCMT: "MFK",
        };
        return IATA_MAP[preset.id] ?? "";
      })()
    : "";

  return (
    <button
      onClick={() => onSelect(preset.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "5px 6px" : "5px 8px",
        borderRadius: 4,
        border: "none",
        background: active
          ? "rgba(100,170,255,0.15)"
          : hover
            ? "rgba(255,255,255,0.08)"
            : "transparent",
        color: active ? "#64aaff" : "#fff",
        fontSize: compact ? 12 : 13,
        fontFamily: "monospace",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      {active && <span style={{ fontSize: 8, lineHeight: 1 }}>●</span>}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {preset.name}
      </span>
      {airport && iata && (
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{iata}</span>
      )}
    </button>
  );
}

export { LocationJump as AirportSelector };
