// §E placeholder — P9 將實作 UCS 百科卡
import { COLORS, FONT_CJK } from "./satelliteConsoleTokens";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  norad: number;
  onClose: () => void;
  onOpenCompare: (m: ManeuverRow) => void;
}

export function SatelliteDetailCard({ norad, onClose }: Props) {
  return (
    <div style={{
      position: "fixed", left: 64 + 412 + 8, top: 98, width: 360,
      maxHeight: "70vh", background: COLORS.panelBg,
      border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10,
      padding: 14, zIndex: 35, fontFamily: FONT_CJK, color: COLORS.textDefault,
      boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.textStrong }}>NORAD {norad}</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textMuted }}>
        §E 衛星百科卡（P9 即將實作）
      </div>
    </div>
  );
}
