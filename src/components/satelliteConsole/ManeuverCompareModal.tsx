// §F placeholder — P10 將實作變軌前後對比 modal
import { COLORS, FONT_CJK } from "./satelliteConsoleTokens";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuver: ManeuverRow;
  onClose: () => void;
}

export function ManeuverCompareModal({ maneuver, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: "92vw", padding: 18,
        background: COLORS.panelBg, border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 10, fontFamily: FONT_CJK, color: COLORS.textDefault,
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.textStrong }}>
            {maneuver.name} · {maneuver.maneuver_type}
          </span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textMuted }}>
          §F 變軌前後對比 modal（P10 即將實作）
        </div>
      </div>
    </div>
  );
}
