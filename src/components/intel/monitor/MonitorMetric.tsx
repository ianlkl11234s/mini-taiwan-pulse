/**
 * 監看卡數值列（spec §5.35 D3）——只給新版（v2）監看卡用。
 *
 * 由 `HazardCards.tsx` 私有的 `Metric`／`MetaRow`／`Note` 升格；**不是**通用 Card（§11 KEEP OUT）。
 * 一格一個主數字（`MonitorMetric`）＋其餘指標 KPI 列（`MonitorKpis`）＋副資訊（`MonitorSub`），
 * 卡底一行原因用 `MonitorNote`；多指標卡的小倍數列用 `MonitorRows`（§5.35 F3）。字級只用 `MF.*`，顏色只用 token。
 */
import { Fragment, type ReactNode } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { MF } from "./monitorFont";
import { useMonitorTheme } from "./monitorTheme";
import type { IntelPalette } from "../intelTheme";

/**
 * 漲跌／狀態語氣。元件只給顏色，紅綠語意由呼叫端依領域決定
 * （股市紅漲綠跌 → 漲傳 "up"；其他依好壞，例如急診壅塞變多傳 "up"＝紅）。
 */
export type MonitorTone = "up" | "down" | "neutral" | "warn" | "err";

export const toneColor: Record<MonitorTone, string> = {
  up: COLORS.statusErr,
  down: COLORS.statusLive,
  neutral: COLORS.textMuted,
  warn: COLORS.statusWarn,
  err: COLORS.statusErr,
};

/** 依主題的語氣色（P5）；暗色＝`toneColor` */
export function toneColorFor(p: IntelPalette): Record<MonitorTone, string> {
  return { up: p.statusErr, down: p.statusLive, neutral: p.textMuted, warn: p.statusWarn, err: p.statusErr };
}

const NOWRAP = { whiteSpace: "nowrap" } as const;

/** §6.2：符號單位（% × ‰ °）緊貼數字，字母或中文開頭的單位前留一個半形空白 */
function unitGap(unit: string): number | string {
  return /^[%×‰°]/.test(unit) ? 0 : "0.25em";
}

/**
 * 主數字（`MF.main` 24）＋單位＋漲跌。
 * - `tone`：只決定漲跌（delta）顏色。
 * - `color`：主數字的領域色（例如地震規模、供電吃緊），呼叫端傳 token 值；不給＝textStrong。
 * - `muted`：過期／停更（G2），主數字改 textMuted，優先於 `color`。
 */
export function MonitorMetric({
  value, unit, delta, tone = "neutral", color, muted = false,
}: {
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  tone?: MonitorTone;
  color?: string;
  muted?: boolean;
}) {
  const theme = useMonitorTheme();
  const tc = toneColorFor(theme.p);
  return (
    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 8, rowGap: 2, minWidth: 0 }}>
      <span style={NOWRAP}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: MF.main, fontWeight: 700, lineHeight: 1.15,
            fontVariantNumeric: "tabular-nums",
            color: muted ? theme.p.textMuted : color ? theme.text(color) : theme.p.textStrong,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: MF.body, color: theme.p.textMuted, marginLeft: unitGap(unit) }}>{unit}</span>
        )}
      </span>
      {delta != null && (
        <span
          style={{
            ...NOWRAP, fontFamily: FONT_DATA, fontSize: MF.body,
            fontVariantNumeric: "tabular-nums", color: tc[tone],
          }}
        >
          {delta}
        </span>
      )}
    </div>
  );
}

export interface MonitorKpiItem {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
}

/** 其餘指標：標籤（`MF.label`）在上、數值（`MF.kpi` 19）在下；每格最小 110px 自動折行 */
/** muted：來源過期／停更時數值降灰（G2） */
export function MonitorKpis({ items, muted = false }: { items: MonitorKpiItem[]; muted?: boolean }) {
  const theme = useMonitorTheme();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "6px 10px" }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: MF.label, color: theme.p.textMuted }}>{it.label}</span>
          <span style={NOWRAP}>
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: MF.kpi, fontWeight: 700,
                fontVariantNumeric: "tabular-nums", color: muted ? theme.p.textMuted : theme.p.textStrong,
              }}
            >
              {it.value}
            </span>
            {it.unit && (
              <span style={{ fontSize: MF.body, color: theme.p.textMuted, marginLeft: unitGap(it.unit) }}>{it.unit}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 副資訊列（`MF.label`）：每一項不可拆，項與項之間才換行 */
export function MonitorSub({ items }: { items: ReactNode[] }) {
  const theme = useMonitorTheme();
  const shown = items.filter((it) => it != null && it !== false && it !== "");
  if (!shown.length) return null;
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", justifyContent: "space-between", columnGap: 10, rowGap: 2,
        fontSize: MF.label, color: theme.p.textDim,
      }}
    >
      {shown.map((it, i) => (
        <span key={i} style={NOWRAP}>{it}</span>
      ))}
    </div>
  );
}

/** 卡底一行原因（`MF.label`），例如「查詢失敗」「停更 139 天：上游未更新」 */
export function MonitorNote({ tone = "neutral", children }: { tone?: MonitorTone; children: ReactNode }) {
  const tc = toneColorFor(useMonitorTheme().p);
  return <div style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: tc[tone] }}>{children}</div>;
}

export interface MonitorRowItem {
  /** 指標名稱（`MF.label` textMuted） */
  label: ReactNode;
  /** 走勢圖：建議 `TimeseriesSparkline bare heightTier="mini"` 或 `HazardTrendBars bare`；同卡各列由呼叫端給同一時間軸 */
  chart: ReactNode;
  /** 最新值（`MF.body` FONT_DATA 700，不斷行） */
  value: ReactNode;
  unit?: string;
  /** 滑鼠提示（例如完整名稱、資料時間） */
  title?: string;
}

/**
 * 多指標卡小倍數列（§5.35 F3）：每列「名稱｜走勢（1fr）｜最新值」，列間 1px `theme.p.borderSoft` 細線。
 * 三欄共用一個 grid，所以每列的圖欄同寬；比例尺各自、不另放圖例。
 * 欄距用 padding 而非 column-gap，細線才會整列連續。
 */
export function MonitorRows({ rows }: { rows: MonitorRowItem[] }) {
  const theme = useMonitorTheme();
  if (!rows.length) return null;
  return (
    <div
      data-testid="monitor-rows"
      style={{ display: "grid", gridTemplateColumns: "minmax(64px, auto) minmax(0,1fr) auto", alignItems: "center" }}
    >
      {rows.map((r, i) => {
        const cell = {
          padding: "4px 0",
          borderTop: i > 0 ? `1px solid ${theme.p.borderSoft}` : undefined,
          minWidth: 0,
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
        } as const;
        return (
          <Fragment key={i}>
            <div title={r.title} style={{ ...cell, paddingRight: 8, fontSize: MF.label, color: theme.p.textMuted }}>
              {r.label}
            </div>
            <div title={r.title} style={cell}>
              <div style={{ width: "100%", minWidth: 0 }}>{r.chart}</div>
            </div>
            <div title={r.title} style={{ ...cell, paddingLeft: 8, justifyContent: "flex-end" }}>
              <span data-testid="monitor-row-value" style={NOWRAP}>
                <span
                  style={{
                    fontFamily: FONT_DATA, fontSize: MF.body, fontWeight: 700,
                    fontVariantNumeric: "tabular-nums", color: theme.p.textStrong,
                  }}
                >
                  {r.value}
                </span>
                {r.unit && (
                  <span style={{ fontSize: MF.label, color: theme.p.textMuted, marginLeft: unitGap(r.unit) }}>{r.unit}</span>
                )}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
