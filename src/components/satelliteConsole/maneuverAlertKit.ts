/**
 * P4 變軌警報／對比彈窗共用小工具（嚴重度 token、清單範圍函式邊界、按鈕樣式）。
 * 暗色值取自 COLORS（STATUS token）；淡色經 `severityColor`／`ctrlButton` 換成主題 palette（P5 SV1）。
 * 變軌類型中文名讀 MANEUVER_TOKEN.zh。
 */
import { createElement, Fragment, type CSSProperties, type ReactNode } from "react";
import { COLORS, MANEUVER_TOKEN } from "./satelliteConsoleTokens";
import { enumLabel } from "../../i18n/dataText";
import type { LocaleSnapshot } from "../../state/localeStore";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { levelColor, type IntelPalette } from "../intel/intelTheme";
import type { ManeuverSeverity } from "../../data/satelliteManeuversLoader";

/** 嚴重度：中文名＋顏色（例行／無法判定走中性灰，不撞狀態色） */
export const SEVERITY_VIEW: Record<ManeuverSeverity, { zh: string; color: string }> = {
  red: { zh: "重大", color: COLORS.statusErr },
  orange: { zh: "注意", color: COLORS.statusWarn },
  grey: { zh: "例行", color: COLORS.textMuted },
  unknown: { zh: "無法判定", color: COLORS.textMuted },
};

/** 嚴重度色跟主題：紅／橘沿用即時情報 `levelColor`（statusErr／statusWarn → palette 同欄位），
 *  例行／無法判定直接取 palette.textMuted（暗色同 COLORS.textMuted） */
export function severityColor(sev: ManeuverSeverity, p: IntelPalette): string {
  if (sev === "grey" || sev === "unknown") return p.textMuted;
  return levelColor(SEVERITY_VIEW[sev].color, p);
}

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
export function ctrlButton(p: IntelPalette, extra?: CSSProperties): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 24,
    padding: "0 8px",
    borderRadius: RADIUS.md,
    border: `1px solid ${p.controlBorder}`,
    background: p.controlBg,
    color: p.textDefault,
    fontSize: FONT_SIZE.sm,
    cursor: "pointer",
    ...extra,
  };
}

// ── 顯示層翻譯（資料層函式與表格仍輸出中文，這裡才換語系；zh-TW 原樣回傳） ──

/** 嚴重度名稱 */
export function severityLabel(sev: ManeuverSeverity, i18n: LocaleSnapshot): string {
  return enumLabel("satelliteSeverity", sev, SEVERITY_VIEW[sev].zh, i18n);
}

/** 變軌類型名稱 */
export function maneuverTypeLabel(type: keyof typeof MANEUVER_TOKEN, i18n: LocaleSnapshot): string {
  return enumLabel("satelliteManeuverType", type, MANEUVER_TOKEN[type].zh, i18n);
}

/** `formatManeuverDetail`／衛星歷史變軌 detail（「傾角 +0.14°」「週期 -0.2 min」「離心率 +1.0e-4」）的欄位名 */
export function localizeManeuverDetail(zh: string, i18n: LocaleSnapshot): string {
  if (i18n.active === "zh-TW") return zh;
  const m = /^(傾角|週期|離心率) (.*)$/.exec(zh);
  if (!m) return zh;
  const { t } = i18n;
  const name = m[1] === "傾角" ? t("satelliteConsole.field.inclination") : m[1] === "週期" ? t("satelliteConsole.field.period") : t("satelliteConsole.field.eccentricity");
  return `${name} ${m[2]}`;
}

/** `formatRelTime` 的輸出（「剛剛」「5 分鐘前」「3 小時前」「2 天前」） */
export function localizeRelTime(zh: string, i18n: LocaleSnapshot): string {
  if (i18n.active === "zh-TW") return zh;
  const { t } = i18n;
  if (zh === "剛剛") return t("satelliteConsole.rel.justNow");
  const m = /^(\d+) (分鐘|小時|天)前$/.exec(zh);
  if (!m) return zh;
  const count = Number(m[1]);
  return m[2] === "分鐘" ? t("satelliteConsole.rel.minutes", { count }) : m[2] === "小時" ? t("satelliteConsole.rel.hours", { count }) : t("satelliteConsole.rel.days", { count });
}

/** `formatOperatingSince` 的輸出（「3 個月」「2 年」「2 年 3 個月」「尚未發射」「—」） */
export function localizeOperatingSince(zh: string, i18n: LocaleSnapshot): string {
  if (i18n.active === "zh-TW") return zh;
  const { t } = i18n;
  if (zh === "尚未發射") return t("satelliteConsole.operating.notLaunched");
  const m = /^(?:(\d+) 年)?(?: ?(\d+) 個月)?$/.exec(zh);
  if (!m || (m[1] == null && m[2] == null)) return zh;
  const years = m[1] != null ? Number(m[1]) : null;
  const months = m[2] != null ? Number(m[2]) : null;
  if (years != null && months != null) return t("satelliteConsole.operating.yearsMonths", { years, months });
  if (years != null) return t("satelliteConsole.operating.years", { count: years });
  return t("satelliteConsole.operating.months", { count: months ?? 0 });
}

/**
 * 把翻譯字串裡的 `{name}` 換成 React 節點（數字要套等寬字型時用）：
 * `rich(t("key", { count: n, n: "{n}" }), { n: <Mono>{n}</Mono> })`。
 * 傳給 `t()` 的變數若要保留成節點位置，值寫成同名 `"{name}"`。
 */
export function rich(template: string, slots: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return name != null && name in slots ? createElement(Fragment, { key: i }, slots[name]) : part;
    }),
  );
}
