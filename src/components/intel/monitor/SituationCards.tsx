import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { Sparkline } from "./PressureRing";
import type { PublicHealthWeek, CdcDisease } from "../../../data/intelLoaders";

function DiseaseCard({ d, week }: { d: CdcDisease; week: number }) {
  // 疾病：升 = 警示 → 紅；降 = 改善 → 綠
  const worse = d.yoy >= 0;
  const yc = worse ? COLORS.statusWarn : COLORS.statusLive;
  return (
    <div
      style={{
        borderRadius: RADIUS.xl, border: `1px solid ${COLORS.panelBorder}`,
        background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        padding: "12px 13px", display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: RADIUS.full, background: d.color, flexShrink: 0,
          }}
        />
        <span
          style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 700, color: COLORS.textStrong }}
        >
          {d.label}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textFaint,
            padding: "1px 6px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)",
          }}
        >
          W{week}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 26, fontWeight: 700, lineHeight: 1, color: "#fff",
          }}
        >
          {d.value}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.textMuted }}>{d.unit}</span>
      </div>

      <div
        style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700, color: yc }}>
            {worse ? "↑" : "↓"}
            {worse ? "+" : ""}
            {d.yoy}%
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
            vs 去年同期
          </span>
        </span>
        <Sparkline
          data={d.spark}
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
          marginTop: "auto", fontFamily: FONT_CJK, fontSize: 9.5,
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
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 3, height: 12, borderRadius: RADIUS.sm, background: COLORS.accent }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, letterSpacing: "1.5px", color: COLORS.textDefault,
          }}
        >
          公衛 · HEALTH BOARD
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
          CDC 截至 ISO 第 W{health.week} 週
        </span>
      </div>
      {/* auto-fit + minmax：只有一種疾病時（目前 RPC 只回登革熱）整張卡撐滿欄寬，
          不再固定切三格讓單卡縮成 1/3；三種都回來時窄欄自動折成兩排，
          每格仍有 200px 以上讀得到 sparkline（固定 3 格在 split 的 w6 只剩 ~130px）。 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {health.diseases.map((d) => (
          <DiseaseCard key={d.id} d={d} week={health.week} />
        ))}
        {health.diseases.length === 0 && (
          <>
            <div style={emptyCardStyle}>等待 CDC 週報資料…</div>
            <div style={emptyCardStyle}>等待 CDC 週報資料…</div>
            <div style={emptyCardStyle}>等待 CDC 週報資料…</div>
          </>
        )}
      </div>
    </div>
  );
}

const emptyCardStyle: React.CSSProperties = {
  borderRadius: RADIUS.xl, border: `1px dashed ${COLORS.borderSoft}`,
  background: "rgba(255,255,255,0.01)", padding: "12px 13px",
  fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint,
  display: "flex", alignItems: "center", justifyContent: "center",
};
