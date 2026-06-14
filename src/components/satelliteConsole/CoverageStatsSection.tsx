// §D placeholder — P8 將實作即時覆蓋統計
import { COLORS, FONT_CJK } from "./satelliteConsoleTokens";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuvers: ManeuverRow[];
}

export function CoverageStatsSection(_props: Props) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK, color: COLORS.textMuted, fontSize: 11 }}>
      §D 即時統計（P8 即將實作）
    </div>
  );
}
