// §A placeholder — P5 將實作完整 maneuver alert section
import { COLORS, FONT_CJK } from "./satelliteConsoleTokens";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  maneuvers: ManeuverRow[];
  onSelectNorad: (n: number) => void;
  onOpenCompare: (m: ManeuverRow) => void;
  onFlyTo?: (lon: number, lat: number) => void;
}

export function ManeuverAlertSection({ maneuvers }: Props) {
  void onSelectNoradStub;
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK, color: COLORS.textMuted, fontSize: 11 }}>
      §A 變軌警報（P5 即將實作）— 目前 {maneuvers.length} 筆載入
    </div>
  );
}
const onSelectNoradStub = (_n: number) => {};
