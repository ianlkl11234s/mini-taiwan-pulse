// §C placeholder — P7 將實作台灣 15 顆 hero
import { COLORS, FONT_CJK } from "./satelliteConsoleTokens";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuvers: ManeuverRow[];
  onSelectNorad: (n: number) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

export function TWFleetSection(_props: Props) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK, color: COLORS.textMuted, fontSize: 11 }}>
      §C 台灣 15 顆衛星專區（P7 即將實作）
    </div>
  );
}
