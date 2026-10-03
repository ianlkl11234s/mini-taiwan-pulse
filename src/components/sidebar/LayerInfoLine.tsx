import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { FONT_CJK, FONT_SIZE } from "../../styles/designTokens";
import { LAYER_MANIFEST, type ManifestKey } from "../../data/layerManifest";
import type { LayerVisibility } from "../../types";
import { DataSourceCard, dataSourcePalette } from "./DataSourcePanel";
import { useRailTheme } from "./railTheme";

/**
 * 圖層展開區最後一行「說明・來源」（layer-panel-unify P1）。
 * 只放入口與既有內容：manifest 的說明文字＋資料來源面板同一張上游資料卡，不新增資料。
 * 收合為預設，點開才載入上游資料卡（與資料來源面板同一條 lazy 路徑）。
 */
export function LayerInfoLine({ layerKey }: { layerKey: keyof LayerVisibility }) {
  const [open, setOpen] = useState(false);
  const { DIM, INACTIVE_TEXT, COLOR_SCHEME } = useRailTheme();
  const description = (LAYER_MANIFEST as Record<string, { description?: string }>)[layerKey as ManifestKey]?.description;
  return (
    <div style={{ fontFamily: FONT_CJK }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 0 2px", border: 0, background: "transparent", color: INACTIVE_TEXT, cursor: "pointer", fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK }}
      >
        <Info size={11} aria-hidden="true" />
        說明・來源
        <ChevronRight size={10} aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div>
          {description && <p style={{ margin: "2px 0 4px", color: DIM, fontSize: FONT_SIZE.sm, lineHeight: 1.5 }}>{description}</p>}
          <DataSourceCard p={dataSourcePalette(COLOR_SCHEME === "dark")} layerKey={layerKey} locked={false} hideActivate />
        </div>
      )}
    </div>
  );
}
