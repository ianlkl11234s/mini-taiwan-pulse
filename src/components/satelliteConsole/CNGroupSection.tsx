// §B placeholder — P6 將實作 6 群 accordion
import { COLORS, FONT_CJK } from "./satelliteConsoleTokens";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import type { LayerVisibility } from "../../types";

interface Props {
  maneuvers: ManeuverRow[];
  layerVisibility: LayerVisibility;
  setLayerVisibility: (next: Partial<LayerVisibility>) => void;
  onSelectNorad: (n: number) => void;
}

export function CNGroupSection(_props: Props) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT_CJK, color: COLORS.textMuted, fontSize: 11 }}>
      §B 中國衛星 6 群分流（P6 即將實作）
    </div>
  );
}
