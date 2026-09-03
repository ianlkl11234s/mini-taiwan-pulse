// Feature 點擊資訊 popup — registry dispatch 外殼。
//
// 各 layer 的 panel 元件在 src/components/featureInfo/*Panels.tsx（按 domain 分檔），
// layerType → 元件對應在 featureInfo/registry.tsx。新增 layer popup 只要：
// 1) 對應 domain 檔寫 panel 元件  2) registry.tsx 加 PANEL_REGISTRY + HEADER_LABELS 各一行。
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { COLORS, SURFACE, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import type { FeatureInfo } from "../types";
import type { ReservoirContext } from "../data/reservoirContextLoader";
import { PANEL_REGISTRY, HEADER_LABELS } from "./featureInfo/registry";
import { WaterReservoirContextPanel } from "./featureInfo/waterPanels";
import { DARK_FEATURE, LIGHT_FEATURE, FeatureThemeProvider } from "./featureInfo/featureTheme";

interface Props {
  feature: FeatureInfo;
  onClose: () => void;
  /** 點擊水庫時由 useReservoirContextLayer 提供：含水情/集水區/流域/最近河川 */
  reservoirContext?: ReservoirContext | null;
  /** 主題：深色（預設）/ 淺色。白底地圖時傳 false 讓 chrome 中性化 */
  isDarkTheme?: boolean;
}

export function FeatureInfoPanel({ feature, onClose, reservoirContext, isDarkTheme = true }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, [feature]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isEditable = target?.isContentEditable || target?.tagName === "INPUT"
        || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if (isEditable || !panelRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  // 主題化 chrome 色票（僅中性面板/邊框/次要文字；accent 藍、狀態色、資料色兩主題共用）
  const c = isDarkTheme
    ? {
        panelBg: SURFACE.strong, // rgba(10,10,20,0.88) 半透浮層
        border: "rgba(100, 170, 255, 0.25)",
        textDim: COLORS.textDim,
      }
    : {
        panelBg: "rgba(255,255,255,0.95)",
        border: "rgba(0,0,0,0.10)",
        textDim: "#6B7280",
      };
  // 內容子面板（各 domain *Panels）走 context 讀主題色
  const featurePalette = isDarkTheme ? DARK_FEATURE : LIGHT_FEATURE;

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
    <FeatureThemeProvider palette={featurePalette}>
    <div
      ref={panelRef}
      tabIndex={-1}
      style={{
        width: isCctv ? 460 : 280,
        maxWidth: "92vw",
        maxHeight: "100%",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: c.panelBg,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${c.border}`,
        borderRadius: RADIUS.xl,
        padding: "12px 14px",
        fontFamily: FONT_DATA,
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
          color: c.textDim,
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
      <div style={{ fontSize: FONT_SIZE.xs, color: c.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, flexShrink: 0 }}>
        {HEADER_LABELS[feature.layerType]}
      </div>

      <div className="mtp-scroll" style={{ overflowY: "auto", minHeight: 0, flex: "1 1 auto", overscrollBehavior: "contain" }}>
        {content}
      </div>
    </div>
    </FeatureThemeProvider>
  );
}
