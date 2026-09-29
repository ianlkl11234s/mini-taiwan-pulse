// Feature 點擊資訊 popup — registry dispatch 外殼。
//
// 各 layer 的 panel 元件在 src/components/featureInfo/*Panels.tsx（按 domain 分檔），
// layerType → 元件對應在 featureInfo/registry.tsx。新增 layer popup 只要：
// 1) 對應 domain 檔寫 panel 元件  2) registry.tsx 加 PANEL_REGISTRY + HEADER_LABELS 各一行。
import { useEffect, useRef, type CSSProperties } from "react";
import { X } from "lucide-react";
import { COLORS, SURFACE, LIGHT, FONT_CJK, RADIUS, FONT_SIZE } from "../styles/designTokens";
import type { FeatureInfo } from "../types";
import type { ReservoirContext } from "../data/reservoirContextLoader";
import { PANEL_REGISTRY, HEADER_LABELS } from "./featureInfo/registry";
import { WaterReservoirContextPanel } from "./featureInfo/waterPanels";
import { DARK_FEATURE, LIGHT_FEATURE, FeatureThemeProvider } from "./featureInfo/featureTheme";
import { SourceFooter } from "./featureInfo/shared";
import { THEMES } from "./sidebar/layerCatalog";
import "./featureInfo/featureInfo.css";

// layerType 白名單：這些 panel 已經有自己的溯源 UI，不需要（也不該疊加）中央 SourceFooter。
// - chatHighlight：AI 助手標記點，非資料圖層，不顯示來源。
// - publicToilet / disasterShelters / nationalParks：panel 內把常數 source_org/license/url
//   併進 props（上游 feature 本身沒有這些欄位，是 panel 端補的產品知識），中央版讀不到這些
//   enrich 後的值，硬套會錯誤顯示「來源資訊待補」。
// - networkStructuresPanels 9 個 layerType：整份檔案走自訂 SourceRows（欄位命名慣例是
//   source_name/source_date/retrieved_at，不是中央版讀的 source_org/license/fetched_at），
//   兩種 schema 對不上，中央版一樣會誤判成「無來源」。
const FOOTER_SELF_MANAGED_LAYER_TYPES = new Set<string>([
  "chatHighlight",
  "analysisResult", // Agent 暫時分析結果：面板自帶「暫時分析結果 · 非完整來源圖層」footer
  "publicToilet",
  "disasterShelters",
  "nationalParks",
  "osmBridgeCarriers",
  "osmBridgeFootprints",
  "officialBridgesNewTaipei",
  "bridgeComparisonNewTaipei",
  "tainanBridgeInspections",
  "officialBridgesHsinchu",
  "taipeiRoadTunnels",
  "tainanRoadTunnels",
  "changhuaTrafficSignals",
  // 全臺橋梁研究 2 層（站主限定）：panel 自帶 BSS 來源／擷取時間／授權狀態列。
  "bssNationalBridgePreview", "bssNationalBridgePointsPreview",
  // 土壤液化 owner-only 8 層：tile 沒有來源欄位，panel 補官方機關常數並自掛 SourceFooter。
  "soilLiquefactionPotential", "weakSoilClay0To5", "weakSoilSand0To5", "weakSoilClay5To10",
  "weakSoilSand5To10", "weakSoilClay10To20", "weakSoilSand10To20", "liquefactionMonitoringSites",
]);

// layerKey → 主題中文名對照（供 header eyebrow「圖層群組 · 圖層名」使用）。
// 來源：Layers 側欄的 THEMES（sidebar/layerCatalog.ts），本檔唯讀引用、不改該檔。
// 多數圖層 layerType 與側欄 layer key 同名；統計/衍生/子類 layerType 對不到時，
// eyebrow 會 fallback 回單純的 HEADER_LABELS（維持既有行為）。
const LAYER_GROUP_TITLES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const theme of THEMES) {
    for (const group of theme.groups) {
      for (const layer of group.layers) {
        // 用主題名（「宗教 Religion」→「宗教」）：子群組標題多半是「點位」「面」這類幾何分類，不適合當 eyebrow
        map[layer.key] = theme.title.replace(/\s+[A-Za-z].*$/, "");
      }
    }
  }
  return map;
})();

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
        panelBg: LIGHT.surfacePanel,
        border: LIGHT.border,
        textDim: LIGHT.textDim,
      };
  // 內容子面板（各 domain *Panels）走 context 讀主題色
  const featurePalette = isDarkTheme ? DARK_FEATURE : LIGHT_FEATURE;
  const groupTitle = LAYER_GROUP_TITLES[feature.layerType];
  const headerLabel = HEADER_LABELS[feature.layerType];

  // 水庫類：若點到的水庫有 compare_id 且 context 已載入，改顯示完整 context panel
  const isReservoir =
    feature.layerType === "waterDam" || feature.layerType === "waterReservoirPoly";
  const compareId = feature.properties.compare_id;
  const hasCompareId = typeof compareId === "number" && compareId > 0;

  // 水庫 context 面板彙整水情/集水區/流域/最近河川等多個資料源，不是單一 feature.properties
  // 能代表的溯源對象，central footer 在這個分支略過（沿用 panel 各自）。
  const isReservoirContextView = Boolean(isReservoir && hasCompareId && reservoirContext?.reservoir);

  let content: React.ReactNode;
  if (isReservoirContextView) {
    content = <WaterReservoirContextPanel ctx={reservoirContext!} />;
  } else {
    const Panel = PANEL_REGISTRY[feature.layerType];
    content = Panel ? <Panel props={feature.properties} /> : null;
  }

  // content 為 null（BASELINE_NO_PANEL：無對應 panel，只顯示 header）時不掛 footer——
  // 目標是「PANEL_REGISTRY 會渲染的 panel 都有 footer」，不是空白內容也硬掛一行待補。
  const showCentralFooter = content != null && !isReservoirContextView && !FOOTER_SELF_MANAGED_LAYER_TYPES.has(feature.layerType);

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
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        background: c.panelBg,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${c.border}`,
        borderRadius: RADIUS.xl,
        padding: "12px 14px",
        fontFamily: FONT_CJK,
        "--fi-border-soft": featurePalette.borderSoft,
      } as CSSProperties}
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

      {/* Header eyebrow：圖層群組 · 圖層名（對不到群組時 fallback 回單純標籤） */}
      <div style={{ fontSize: FONT_SIZE.xs, color: c.textDim, letterSpacing: 1.2, marginBottom: 6, flexShrink: 0 }}>
        {groupTitle ? `${groupTitle} · ${headerLabel}` : headerLabel}
      </div>

      <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
        {content}
        {showCentralFooter && <SourceFooter props={feature.properties} />}
      </div>
    </div>
    </FeatureThemeProvider>
  );
}
