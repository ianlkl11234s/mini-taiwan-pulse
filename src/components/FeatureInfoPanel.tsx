// Feature 點擊資訊 popup — registry dispatch 外殼。
//
// 各 layer 的 panel 元件在 src/components/featureInfo/*Panels.tsx（按 domain 分檔），
// layerType → 元件對應在 featureInfo/registry.tsx。新增 layer popup 只要：
// 1) 對應 domain 檔寫 panel 元件  2) registry.tsx 加 PANEL_REGISTRY + HEADER_LABELS 各一行。
import { X } from "lucide-react";
import type { FeatureInfo } from "../types";
import type { ReservoirContext } from "../data/reservoirContextLoader";
import { PANEL_REGISTRY, HEADER_LABELS } from "./featureInfo/registry";
import { WaterReservoirContextPanel } from "./featureInfo/waterPanels";

interface Props {
  feature: FeatureInfo;
  onClose: () => void;
  /** 點擊水庫時由 useReservoirContextLayer 提供：含水情/集水區/流域/最近河川 */
  reservoirContext?: ReservoirContext | null;
}

export function FeatureInfoPanel({ feature, onClose, reservoirContext }: Props) {
  // 水庫類：若點到的水庫有 compare_id 且 context 已載入，改顯示完整 context panel
  const isReservoir =
    feature.layerType === "waterDam" || feature.layerType === "waterReservoirPoly";
  const compareId = feature.properties.compare_id;
  const hasCompareId = typeof compareId === "number" && compareId > 0;

  let content: React.ReactNode;
  if (isReservoir && hasCompareId && reservoirContext?.reservoir) {
    content = <WaterReservoirContextPanel ctx={reservoirContext} />;
  } else {
    const Panel = PANEL_REGISTRY[feature.layerType];
    content = Panel ? <Panel props={feature.properties} /> : null;
  }

  // CCTV 內嵌即時影像需要較大空間，只加寬此類 popup（影像框 width:100% 會跟著放大）
  const isCctv = feature.layerType === "cctv";
  return (
    <div
      style={{
        width: isCctv ? 460 : 280,
        maxWidth: "92vw",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(10, 10, 20, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(100, 170, 255, 0.25)",
        borderRadius: 10,
        padding: "12px 14px",
        fontFamily: "monospace",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          padding: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={14} />
      </button>

      {/* Header label */}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, flexShrink: 0 }}>
        {HEADER_LABELS[feature.layerType]}
      </div>

      <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
        {content}
      </div>
    </div>
  );
}
