/**
 * P4 變軌警報／對比彈窗共用小工具（嚴重度 token、清單範圍函式邊界、按鈕樣式）。
 * 色全部取自 COLORS（STATUS token）；變軌類型中文名讀 MANEUVER_TOKEN.zh。
 */
import type { CSSProperties } from "react";
import { COLORS } from "./satelliteConsoleTokens";
import { CONTROL, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import type { ManeuverSeverity } from "../../data/satelliteManeuversLoader";

/** 嚴重度：中文名＋顏色（例行／無法判定走中性灰，不撞狀態色） */
export const SEVERITY_VIEW: Record<ManeuverSeverity, { zh: string; color: string }> = {
  red: { zh: "重大", color: COLORS.statusErr },
  orange: { zh: "注意", color: COLORS.statusWarn },
  grey: { zh: "例行", color: COLORS.textMuted },
  unknown: { zh: "無法判定", color: COLORS.textMuted },
};

export interface ManeuverListScope {
  /** 傳給 RPC 的時間錨點（epoch ms）；null = 以「現在」往前 24 小時 */
  anchorMs: number | null;
  /** 清單範圍與使用者所選時間不一致時的提示；一致時為 null */
  notice: string | null;
}

/**
 * 變軌清單的時間範圍邊界。
 * 目前 gis-platform 沒有可帶時間錨點的 RPC，清單永遠是「現在近 24 小時」；
 * 歷史模式只提示範圍不跟時間軸。RPC 上線後在此回傳 anchorMs，並由 App 的變軌輪詢帶入 p_anchor。
 */
export function resolveManeuverListScope(isHistory: boolean): ManeuverListScope {
  return {
    anchorMs: null,
    notice: isHistory ? "歷史模式：變軌清單仍為現在近 24 小時（時間錨點查詢待上線）" : null,
  };
}

/** 一般控制鈕（§5.7 C2）：24px 高、透明邊框 */
export function ctrlButton(extra?: CSSProperties): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 24,
    padding: "0 8px",
    borderRadius: RADIUS.md,
    border: `1px solid ${CONTROL.border}`,
    background: CONTROL.bg,
    color: COLORS.textDefault,
    fontSize: FONT_SIZE.sm,
    cursor: "pointer",
    ...extra,
  };
}
