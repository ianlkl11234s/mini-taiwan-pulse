import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { Sparkline, FluidSparkline } from "./PressureRing";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { MON_CHART_H } from "./monitorChart";
import { MonitorMetric, MonitorNote } from "./MonitorMetric";
import { useMonitorTheme, type MonitorTheme } from "./monitorTheme";
import { useMonitorFreshness } from "./monitorFreshness";
import { isoWeekThursdayMs, type PublicHealthWeek, type CdcDisease } from "../../../data/intelLoaders";

function DiseaseCard({ d, week, muted = false }: { d: CdcDisease; week: number; muted?: boolean }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  // 缺值（null）：v2 顯示「—」；舊版維持原本補 0 的畫面
  const yoy = v2 ? d.yoy : d.yoy ?? 0;
  // 疾病：升 = 警示 → 紅；降 = 改善 → 綠（缺值不判斷）
  const worse = yoy != null && yoy >= 0;
  const yc = worse ? COLORS.statusWarn : COLORS.statusLive;
  if (v2) {
    // 新版：兩種疾病是並列的同等指標，各一個主數字＋年增；走勢用列內迷你高度（mini）。
    // spark 只有序列沒有時間戳，所以保留 Sparkline（FluidSparkline 寬 100%），首尾標週次。
    const n = d.spark.length;
    const wk = (i: number) => {
      const w = week - (n - 1 - i);
      return `W${w > 0 ? w : w + 52}`;
    };
    return (
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: theme.fill(d.color), flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: MF.body, fontWeight: 700, color: theme.p.textStrong }}>{d.label}</span>
        </div>
        <MonitorMetric
          value={d.value}
          unit={d.unit}
          muted={muted}
          delta={yoy == null ? "年增 —" : `${worse ? "↑ +" : "↓ "}${yoy}% 年增`}
          tone={yoy == null ? "neutral" : worse ? "up" : "down"}
        />
        {n > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FluidSparkline
              fallbackW={140}
              data={d.spark}
              color={theme.fill(d.color)}
              h={MON_CHART_H.mini}
              showTooltip
              labelAt={wk}
              unit={d.unit}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_DATA, fontSize: MF.cap, color: theme.p.textFaint }}>
              <span>{wk(0)}</span>
              <span>{wk(n - 1)}</span>
            </div>
          </div>
        )}
        {d.note && <MonitorNote>{d.note}</MonitorNote>}
      </div>
    );
  }
  return (
    <div
      style={{
        ...(v2 ? { minWidth: 0 } : {
          borderRadius: RADIUS.xl, border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
          padding: "12px 13px",
        }),
        display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: RADIUS.full, background: d.color, flexShrink: 0,
          }}
        />
        <span
          style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.md), fontWeight: 700, color: COLORS.textStrong }}
        >
          {d.label}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), color: COLORS.textFaint,
            padding: "1px 6px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)",
          }}
        >
          W{week}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, 26), fontWeight: 700, lineHeight: 1, color: "#fff",
          }}
        >
          {d.value}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 9.5), color: COLORS.textMuted }}>{d.unit}</span>
      </div>

      <div
        style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.base), fontWeight: 700, color: yc }}>
            {worse ? "↑" : "↓"}
            {worse ? "+" : ""}
            {yoy}%
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textFaint }}>
            vs 去年同期
          </span>
        </span>
        <Sparkline
          data={d.spark.map((v) => v ?? 0)}
          color={d.color}
          // 62→88（2026-08-20 卡片改成撐滿欄寬後）：單一疾病時整張卡有 350px 以上，
          // 62px 的走勢圖會孤零零縮在右上角。88 是「三張並排的最窄情況」還放得下的上限
          // ——最窄欄 200px（auto-fit 的 minmax 下限）扣掉左邊「↓-88% vs 去年同期」
          // 約 90px 與 gap 8px，剩 102px。
          w={88}
          h={24}
          showTooltip
          labelAt={(i) => {
            const w = week - (d.spark.length - 1 - i);
            return `W${w > 0 ? w : w + 52}`;
          }}
          unit={d.unit}
        />
      </div>

      <div
        style={{
          marginTop: "auto", fontFamily: FONT_CJK, fontSize: fs(v2, 9.5),
          color: COLORS.textDim, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {d.note}
      </div>
    </div>
  );
}

interface Props {
  health: PublicHealthWeek;
}

// 共機已於 2026-08-03 拆成獨立的 plaBoard widget（PlaBoard.tsx）——
// 這裡只剩 CDC 健康卡，標題與 grid 欄數同步縮減
export function SituationCards({ health }: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  // 資料期別 W{n}；RPC 不回年份 → 由週次推該週週四當資料日期（週批次，>14 天過期、>35 天停更）
  const fresh = useMonitorFreshness("situationCards", {
    timeText: health.week > 0 ? `W${health.week}` : null,
    dataMs: health.week > 0 ? isoWeekThursdayMs(health.week) : null,
  });
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 3, height: 12, borderRadius: RADIUS.sm, background: COLORS.accent }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), letterSpacing: "1.5px", color: COLORS.textDefault,
          }}
        >
          公衛 · HEALTH BOARD
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: COLORS.textFaint }}>
          CDC 截至 ISO 第 W{health.week > 0 ? health.week : "—"} 週
        </span>
      </div>}
      {/* auto-fit + minmax：只有一種疾病時（目前 RPC 只回登革熱）整張卡撐滿欄寬，
          不再固定切三格讓單卡縮成 1/3；三種都回來時窄欄自動折成兩排，
          每格仍有 200px 以上讀得到 sparkline（固定 3 格在 split 的 w6 只剩 ~130px）。 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {health.diseases.map((d) => (
          <DiseaseCard key={d.id} d={d} week={health.week} muted={fresh.muted} />
        ))}
        {health.diseases.length === 0 && (
          <>
            <div style={emptyCardStyle(v2, theme)}>等待 CDC 週報資料…</div>
            <div style={emptyCardStyle(v2, theme)}>等待 CDC 週報資料…</div>
            <div style={emptyCardStyle(v2, theme)}>等待 CDC 週報資料…</div>
          </>
        )}
      </div>
      {v2 && fresh.reason && health.diseases.length > 0 && (
        <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
      )}
    </div>
  );
}

const emptyCardStyle = (v2: boolean, theme: MonitorTheme): React.CSSProperties => ({
  borderRadius: RADIUS.xl, border: `1px dashed ${theme.p.borderSoft}`,
  background: theme.neutral(0.01), padding: "12px 13px",
  fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textFaint,
  display: "flex", alignItems: "center", justifyContent: "center",
});
