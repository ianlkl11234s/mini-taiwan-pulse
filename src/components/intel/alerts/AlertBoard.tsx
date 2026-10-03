import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { IntelIcon } from "../IntelIcon";
import {
  FONT_CJK, FONT_DATA, MICON,
  ALERT_GROUPS_DEF, ALERT_GROUP_ORDER, alertSeverity, relTime,
  type AlertGroupShort,
} from "../intelTokens";
import {
  fetchActiveAlerts,
  type AlertTally,
  type ActiveAlert,
  type AlertSeriesMap,
} from "../../../data/alertsLoader";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { useChartTooltip, fmtChartValue } from "../../ChartHoverTooltip";
import { useMonitorV2 } from "../monitor/monitorStyle";
import { fs, MF } from "../monitor/monitorFont";
import { MonitorSub } from "../monitor/MonitorMetric";
import { useMonitorTheme } from "../monitor/monitorTheme";
import { MON_CHART_H } from "../monitor/monitorChart";
import type { IntelQueryStatus } from "../../../hooks/useIntelPollingQuery";

/** 24 桶（hour-of-day 0-23，見 get_alert_series_24h）→ hover 標題用時:分 */
function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

interface Props {
  tally: AlertTally;
  status: IntelQueryStatus;
  lastSuccessAt: number | null;
  series: AlertSeriesMap;
  accent: string;
  nowTs: number;
}

// ─── AlertTrend — 24h 全 group 加總 area-line ──────────────────
function AlertTrend({
  series, accent,
}: { series: AlertSeriesMap; accent: string }) {
  // 失敗＝全 null：不畫面積線、高峰顯示「—」（不是 24 格 0）
  const noData = ALERT_GROUP_ORDER.every((g) => series[g].every((v) => v == null));
  const totals = Array.from({ length: 24 }, (_, h) =>
    ALERT_GROUP_ORDER.reduce((sum, g) => sum + (series[g][h] ?? 0), 0),
  );
  const peak = Math.max(1, ...totals);
  const W = 100;
  const tip = useChartTooltip();
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  // v2：圖區高照 mini 階（24），固定高格子內容只能等高或更矮
  const H = v2 ? MON_CHART_H.mini : 28;

  const points = totals
    .map((v, i) => {
      const x = (i / 23) * W;
      const y = H - (v / peak) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,${H} ${points} ${W},${H}`;

  function handleMove(e: ReactMouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const xRatio = (e.clientX - rect.left) / rect.width;
    const h = Math.max(0, Math.min(Math.round(xRatio * 23), 23));
    tip.show(e.clientX, e.clientY, {
      title: hourLabel(h),
      rows: noData ? [] : [{ dot: theme.fill(accent), value: fmtChartValue(totals[h]!, "則") }],
      ...(noData ? { note: "無資料" } : null),
    });
  }

  return (
    <div
      style={v2 ? { padding: "2px 0", marginBottom: 10 } : {
        padding: "8px 10px",
        borderRadius: RADIUS.lg,
        background: theme.neutral(0.025),
        border: `1px solid ${theme.p.borderMid}`,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5,
        }}
      >
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.5px",
            color: theme.p.textFaint,
          }}
        >
          {v2 ? "近 24 小時" : "24H TREND"}
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm),
            color: theme.p.textMuted,
          }}
        >
          {v2 ? "高峰" : "Peak"} {noData ? "—" : peak}
        </span>
      </div>
      <svg
        width="100%"
        height={H + 6}
        viewBox={`0 0 ${W} ${H + 6}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
        onMouseMove={handleMove}
        onMouseLeave={tip.hide}
      >
        {!noData && <polygon points={area} fill={`${theme.fill(accent)}33`} />}
        {!noData && (
          <polyline
            points={points}
            fill="none"
            stroke={theme.fill(accent)}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {tip.node}
    </div>
  );
}

// ─── Sparkline (per-group) ──────────────────
function Sparkline({ data: raw, color }: { data: (number | null)[]; color: string }) {
  const noData = raw.every((v) => v == null);
  const data = raw.map((v) => v ?? 0);
  const peak = Math.max(1, ...data);
  const W = 100;
  const H = 16;
  const tip = useChartTooltip();
  const theme = useMonitorTheme();
  const pts = data
    .map((v, i) => {
      const x = (i / 23) * W;
      const y = H - (v / peak) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  function handleMove(e: ReactMouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const xRatio = (e.clientX - rect.left) / rect.width;
    const h = Math.max(0, Math.min(Math.round(xRatio * 23), 23));
    tip.show(e.clientX, e.clientY, {
      title: hourLabel(h),
      rows: noData ? [] : [{ dot: theme.fill(color), value: fmtChartValue(data[h] ?? 0, "則") }],
      ...(noData ? { note: "無資料" } : null),
    });
  }

  return (
    <>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", opacity: 0.85 }}
        onMouseMove={handleMove}
        onMouseLeave={tip.hide}
      >
        {!noData && (
          <polyline
            points={pts}
            fill="none"
            stroke={theme.fill(color)}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {tip.node}
    </>
  );
}

// ─── GroupCard ───────────────────────────────
function GroupCard({
  group, count, severe, topTerm, spark, hot, onClick,
}: {
  group: AlertGroupShort;
  count: number;
  severe: number;
  topTerm: string | null;
  spark: (number | null)[];
  hot: boolean;
  onClick: () => void;
}) {
  const def = ALERT_GROUPS_DEF[group];
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const dim = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={dim}
      style={{
        textAlign: "left",
        padding: "9px 10px",
        borderRadius: RADIUS.lg,
        background: dim
          ? theme.neutral(0.015)
          : hot
            ? `${theme.fill(def.color)}10`
            : theme.neutral(0.04),
        border: `1px solid ${hot ? `${theme.fill(def.color)}55` : theme.p.borderMid}`,
        opacity: dim ? 0.38 : 1,
        cursor: dim ? "default" : "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4,
        animation: hot ? "alertEdge 2s ease-in-out infinite" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <IntelIcon d={MICON[def.iconKey]!} size={11} color={theme.fill(def.color)} />
        {/* nowrap：六宮格是固定高（monitorSplitLayout.ts 註記 h5 就會讓數字溢出卡外），
            中文組名一旦折成兩行就會把數字推出格子。split 的窄欄 + 內容縮放後
            「民生」實測會折行，兩個標籤都鎖不折 */}
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base), fontWeight: 600,
            color: theme.p.textDefault, whiteSpace: "nowrap",
          }}
        >
          {def.label}
        </span>
        <div style={{ flex: 1 }} />
        {/* v2：最熱警報詞移到組名同一行右側（字級 S13 下獨立一行放不進固定高格子） */}
        {v2 ? (
          <span
            title={topTerm ?? undefined}
            style={{
              fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted,
              minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {topTerm ?? ""}
          </span>
        ) : (
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: def.color,
              letterSpacing: "0.5px", whiteSpace: "nowrap",
            }}
          >
            {def.en}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: v2 ? "wrap" : undefined, rowGap: v2 ? 2 : undefined }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: v2 ? MF.main : FONT_SIZE.xxl, fontWeight: 700,
            color: hot ? theme.text(def.color) : theme.p.textStrong,
            lineHeight: 1,
          }}
        >
          {count}
        </span>
        {severe > 0 && (
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: fs(v2, 9.5), fontWeight: 700,
              color: v2 ? theme.p.statusErr : "#ef4444",
              whiteSpace: v2 ? "nowrap" : undefined,
            }}
          >
            ⚠ {severe} 嚴重
          </span>
        )}
      </div>
      {!v2 && (
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textFaint,
            height: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {topTerm ?? "—"}
        </span>
      )}
      <Sparkline data={spark} color={def.color} />
    </button>
  );
}

// ─── AlertDrawer — 點開後展明細 ──────────────
function AlertDrawer({
  group, nowTs,
}: { group: AlertGroupShort; nowTs: number }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const def = ALERT_GROUPS_DEF[group];
  const [rows, setRows] = useState<ActiveAlert[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchActiveAlerts(group, 1).then((data) => {
      if (alive) setRows(data);
    });
    return () => { alive = false; };
  }, [group]);

  if (rows === null) {
    return (
      <div
        style={{
          padding: "10px 12px", fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base),
          color: theme.p.textFaint,
        }}
      >
        載入中…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "10px 12px", fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base),
          color: theme.p.textFaint,
        }}
      >
        無 {def.label} 警報
      </div>
    );
  }

  return (
    <div
      className="mtp-scroll"
      style={{
        maxHeight: 220, overflowY: "auto",
        padding: "6px 10px 10px",
        animation: "drawerOpen .25s ease-out",
      }}
    >
      {rows.slice(0, 12).map((r) => {
        const sev = alertSeverity(r.severity);
        return (
          <div
            key={r.id}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 0",
              borderBottom: `1px solid ${theme.p.borderSoft}`,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: RADIUS.full,
                background: theme.fill(sev.color), flexShrink: 0,
                boxShadow: r.severity >= 3 ? `0 0 5px ${sev.color}` : "none",
              }}
            />
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base),
                color: theme.p.textDefault, flex: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              title={r.headline}
            >
              <span style={{ color: theme.p.textMuted, fontSize: fs(v2, FONT_SIZE.sm) }}>{r.county} · </span>
              {r.headline || r.term}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, 9.5), color: theme.p.textFaint }}>
              {relTime(r.sent_ts, nowTs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── AlertBoard 主元件 ───────────────────────
export function AlertBoard({ tally, status, lastSuccessAt, series, accent, nowTs }: Props) {
  const [openGroup, setOpenGroup] = useState<AlertGroupShort | null>(null);
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();

  if (status !== "ready") {
    const label = status === "denied" ? "警報摘要無權限讀取" : status === "error" ? "警報摘要更新中斷" : "警報摘要讀取中";
    const at = lastSuccessAt ? ` · 最後成功 ${new Date(lastSuccessAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}` : "";
    return (
      <div style={{ ...(v2 ? {} : { padding: "12px 14px", borderRadius: RADIUS.xl, border: `1px solid ${theme.p.borderMid}` }), color: theme.p.textMuted, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm) }}>
        {label}{at}
      </div>
    );
  }

  // 0-state — 單條綠訊息
  if (tally.total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
        <div
          style={{
            padding: "9px 12px",
            borderRadius: RADIUS.lg,
            background: theme.isDark ? "rgba(34,197,94,0.06)" : theme.p.statusLiveSoft,
            border: `1px solid ${theme.p.statusLiveBorder}`,
            display: "flex", alignItems: "center", gap: 7,
          }}
        >
          <IntelIcon d={MICON.check!} size={12} color={theme.p.statusLive} />
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: fs(v2, 11.5), color: theme.p.statusLive, fontWeight: 600,
            }}
          >
            {v2 ? "目前全國無生效中警報" : "目前全國無 active 警報"}
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.5px",
              color: theme.p.textFaint,
            }}
          >
            {v2 ? "全部解除" : "ALL CLEAR"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* section label（v2：標題與來源已由外框畫，只留總數與嚴重數，用 MonitorSub 小字） */}
      {v2 ? (
        <div style={{ padding: "0 2px 6px", flexShrink: 0 }}>
          <MonitorSub
            items={[
              "災防科技中心＋氣象署",
              `${tally.total} 則`,
              tally.severe > 0 ? (
                <span style={{ color: theme.p.statusErr, fontWeight: 700 }}>{tally.severe} 嚴重</span>
              ) : null,
            ]}
          />
        </div>
      ) : (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 2px 6px",
          flexShrink: 0,
        }}
      >
        {!v2 && <IntelIcon d={MICON.warn!} size={12} color="#ef4444" />}
        {!v2 && (
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.base), fontWeight: 700,
              color: theme.p.textStrong, letterSpacing: "0.5px",
            }}
          >
            警訊整合
          </span>
        )}
        <span
          style={{
            fontFamily: v2 ? FONT_CJK : FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: v2 ? "0.5px" : "1.5px",
            color: theme.p.textDim,
          }}
        >
          {v2 ? "災防科技中心＋氣象署" : "NCDR + CWA"}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted }}>
          {tally.total} 則
        </span>
        {tally.severe > 0 && (
          <span
            style={{
              padding: "1px 6px", borderRadius: RADIUS.md,
              background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.45)",
              fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), fontWeight: 700,
              color: "#ef4444",
              animation: "alertBreathe 2s ease-in-out infinite",
            }}
          >
            {tally.severe} 嚴重
          </span>
        )}
      </div>
      )}

      <div
        style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          flex: "1 1 auto", minHeight: 0, maxHeight: 120,
        }}
      >
        <AlertTrend series={series} accent={accent} />
      </div>

      <div
        style={{
          // 固定 3×2（2026-08-16）：原本 auto-fit minmax(82px) 會依容器寬自己決定欄數，
          // split dock 的 413px 容器排成 5+1、stack 模式的寬容器更排成一長排 —— 六個分類
          // 是固定的一組，維持 3×2 才讀得出「兩排各三類」的結構。
          // 最窄的使用情境是手機 stack（容器約 360px → 每欄 116px），仍大於原本 82px 下限。
          display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridAutoRows: "minmax(0, 1fr)", gap: 6,
          flex: 1, minHeight: 0,
        }}
      >
        {ALERT_GROUP_ORDER.map((g) => {
          const s = tally.byGroup.get(g);
          return (
            <GroupCard
              key={g}
              group={g}
              count={s?.count ?? 0}
              severe={s?.severe ?? 0}
              topTerm={s?.top_term ?? null}
              spark={series[g] ?? Array.from({ length: 24 }, () => 0)}
              hot={(s?.severe ?? 0) > 0}
              onClick={() => setOpenGroup((p) => (p === g ? null : g))}
            />
          );
        })}
      </div>

      {openGroup && (
        <div
          style={{
            marginTop: 8,
            borderRadius: RADIUS.lg,
            background: theme.isDark ? "rgba(0,0,0,0.32)" : theme.neutral(0.04),
            border: `1px solid ${theme.p.borderMid}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 10px",
              borderBottom: `1px solid ${theme.p.borderSoft}`,
            }}
          >
            <IntelIcon
              d={MICON[ALERT_GROUPS_DEF[openGroup].iconKey]!}
              size={11}
              color={theme.fill(ALERT_GROUPS_DEF[openGroup].color)}
            />
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: fs(v2, 11.5), fontWeight: 700,
                color: theme.p.textStrong,
              }}
            >
              {ALERT_GROUPS_DEF[openGroup].label}明細
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setOpenGroup(null)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: theme.p.textMuted, padding: 2,
              }}
            >
              <IntelIcon d={MICON.chevUp!} size={11} />
            </button>
          </div>
          <AlertDrawer group={openGroup} nowTs={nowTs} />
        </div>
      )}
    </div>
  );
}
