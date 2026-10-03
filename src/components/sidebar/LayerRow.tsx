import { memo, type ReactNode } from "react";
import { ChevronRight, Lock, type LucideIcon } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE } from "../../styles/designTokens";
import type { LayerVisibility } from "../../types";
import { isStatisticsRenderLayer } from "../../data/regionalStatisticsRecipes";
import { useLayerLiveCount } from "../../state/liveCountStore";
import { useLayerLoading } from "../../lib/layerLoading";
import { LayerToggleSwitch } from "./LayerToggleSwitch";
import { useRailTheme } from "./railTheme";
import "./layerRow.css";

/** 列開關（spec §5.10 列開關）：顏色跟 rail palette，暗／淡自動切換。 */
export function RailToggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  const { ACCENT_TOGGLE, TOGGLE_OFF, TOGGLE_KNOB_ON, TOGGLE_KNOB_OFF } = useRailTheme();
  return <LayerToggleSwitch on={on} onChange={onChange} label={label} ACCENT_TOGGLE={ACCENT_TOGGLE} TOGGLE_OFF={TOGGLE_OFF} TOGGLE_KNOB_ON={TOGGLE_KNOB_ON} TOGGLE_KNOB_OFF={TOGGLE_KNOB_OFF} />;
}

export interface ListRowProps {
  /** 主名稱（中文）；英文／外文小字放 `meta` */
  label: ReactNode;
  /** 主按鈕的無障礙名稱 */
  ariaLabel: string;
  /** 已上色的圖示元素（14px） */
  icon?: ReactNode;
  /** 名稱後的小字或徽章（例 S／A 等級、外文名） */
  meta?: ReactNode;
  /** 名稱下的第二行小字（例「12 筆 · Point」） */
  sub?: ReactNode;
  /** 計數格：數字；`loading` 時改顯示小轉圈（P1） */
  count?: number | null;
  /** 計數單位（中文），與數字分開排，避免中文落到等寬字 */
  countUnit?: string;
  /** 計數格兼當載入狀態 */
  loading?: boolean;
  /** 圖層色：開啟時畫在列左緣 2px */
  accent?: string;
  active?: boolean;
  locked?: boolean;
  lockedTitle?: string;
  /** 有展開區 → 顯示 chevron、`aria-expanded` */
  expandable?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  /** chevron 之後、開關之前（例 資料來源狀態圖示、收藏星號） */
  trailing?: ReactNode;
  /** 列開關；沒有開關的清單（資料來源）不給 */
  toggle?: { on: boolean; onChange: () => void; label?: string } | null;
  title?: string;
}

/**
 * 共用圖層列（layer-panel-unify P1／P8）：icon・名稱・計數（兼載入轉圈）・chevron・開關。
 * 桌機四入口、手機、資料來源、Agent 分析結果、衛星群組、我的都用這一個元件。
 */
export function ListRow({
  label, ariaLabel, icon, meta, sub, count, countUnit, loading, accent, active = false, locked = false, lockedTitle,
  expandable = false, expanded = false, onClick, trailing, toggle, title,
}: ListRowProps) {
  const { DIM, INACTIVE_TEXT, TEXT_STRONG, ROW_HOVER, COLOR_SCHEME } = useRailTheme();
  const showCount = !locked && !loading && count != null && count > 0;
  return (
    <div
      className={COLOR_SCHEME === "light" ? "lr-row lr-light" : "lr-row"}
      style={{
        display: "flex",
        alignItems: "center",
        borderLeft: active && accent ? `2px solid ${accent}` : "2px solid transparent",
        opacity: locked ? 0.5 : 1,
        transition: "background 0.1s",
        fontFamily: FONT_CJK,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = ROW_HOVER; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={expandable ? expanded : undefined}
        aria-pressed={!expandable && toggle ? toggle.on : undefined}
        onClick={onClick}
        title={locked ? lockedTitle ?? "此圖層目前不可用" : title}
        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, padding: "5px 8px 5px 10px", border: 0, background: "transparent", cursor: onClick ? "pointer" : "default", color: "inherit", textAlign: "left", fontFamily: FONT_CJK }}
      >
        {icon}
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: FONT_SIZE.md, color: TEXT_STRONG, transition: "color 0.15s" }}>
            {label}{meta}
          </span>
          {sub && <span style={{ fontSize: FONT_SIZE.sm, color: DIM, marginTop: 1 }}>{sub}</span>}
        </span>
        {loading && !locked && <span className="lr-spin" role="status" aria-label="載入中" title="載入中" />}
        {showCount && (
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2, marginRight: 4, color: active && accent ? accent : INACTIVE_TEXT }}>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString("zh-TW")}</span>
            {countUnit && <span style={{ fontSize: FONT_SIZE.sm }}>{countUnit}</span>}
          </span>
        )}
        {expandable && !locked && (
          <span style={{ color: DIM, flexShrink: 0, display: "flex" }}>
            <ChevronRight size={12} aria-hidden="true" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </span>
        )}
        {locked && <Lock size={13} color={DIM} style={{ flexShrink: 0 }} />}
      </button>
      {trailing}
      {toggle && !locked
        ? <span style={{ paddingRight: 12, display: "flex" }}><RailToggle on={toggle.on} onChange={toggle.onChange} label={toggle.label} /></span>
        : null}
    </div>
  );
}

// 單一圖層列 — memo 後只在該 row 的 props 真變動時才 re-render。
// LayersPanel 每次被動 re-render（例如 count 變動）時，大多數 row 跳過，只有 count 變化的少數 row 重繪；
// 即時計數（useLayerLiveCount）與載入狀態（useLayerLoading）也都是 per-key 訂閱。
export interface LayerRowProps {
  layerKey: keyof LayerVisibility;
  label: string;
  expandable: boolean;
  active: boolean;
  /** owner-only 私人圖層且當前 viewer 非 owner → 顯示鎖頭、禁 toggle */
  locked: boolean;
  color: string;
  count: number | undefined;
  isExpanded: boolean;
  Icon: LucideIcon;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  /** 搜尋結果等需要在開關前加按鈕（收藏星號）時用 */
  trailing?: ReactNode;
}

export const LayerRow = memo(function LayerRow({
  layerKey, label, expandable, active, locked, color, count: staticCount, isExpanded, Icon,
  onLayerClick, onToggleVisibility, trailing,
}: LayerRowProps) {
  // 列車／公車／客運：只有該 row 訂閱 liveCountStore（播放中 2Hz），其他 row 不重渲
  const count = useLayerLiveCount(layerKey) ?? staticCount;
  const loading = useLayerLoading(layerKey, active);
  const { DIM } = useRailTheme();
  // locked：點整列一律走 onToggleVisibility → App 端 gate（未登入導登入 / 已登入顯示提示）
  const handleClick = () =>
    locked ? onToggleVisibility(layerKey)
      : expandable ? onLayerClick(layerKey) : onToggleVisibility(layerKey);
  return (
    <ListRow
      ariaLabel={label}
      label={label}
      icon={<Icon size={14} color={active || isStatisticsRenderLayer(layerKey) || layerKey === "crimeAreaMonthly" ? color : DIM} style={{ flexShrink: 0 }} />}
      count={count}
      loading={loading}
      accent={color}
      active={active}
      locked={locked}
      expandable={expandable}
      expanded={isExpanded}
      onClick={handleClick}
      trailing={trailing}
      toggle={{ on: active, onChange: () => onToggleVisibility(layerKey), label: `${label} 顯示` }}
    />
  );
});
