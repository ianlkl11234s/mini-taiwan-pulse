import { IntelIcon } from "../IntelIcon";
import { COLORS, FONT_CJK, FONT_DATA, MICON } from "../intelTokens";
import { Sparkline } from "./PressureRing";
import type { PlaActivity, PublicHealthWeek, CdcDisease } from "../../../data/intelLoaders";

function PlaCard({ data }: { data: PlaActivity }) {
  const adizActive = data.adiz.some((z) => z.active);
  return (
    <div
      style={{
        borderRadius: 9,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "linear-gradient(160deg, rgba(239,68,68,0.06), rgba(255,255,255,0.012))",
        padding: "12px 13px",
        display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <IntelIcon d={MICON.plane!} size={13} color="#ff6b6b" />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "1.2px", color: COLORS.textDim,
          }}
        >
          PLA ACTIVITY
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint,
            padding: "1px 6px", borderRadius: 3, background: "rgba(255,255,255,0.05)",
            whiteSpace: "nowrap",
          }}
        >
          {data.as_of ?? "—"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{ fontFamily: FONT_DATA, fontSize: 32, fontWeight: 700, lineHeight: 1, color: "#fff" }}
        >
          {data.sorties}
        </span>
        <span style={{ fontFamily: FONT_CJK, fontSize: 11, color: COLORS.textMuted }}>架次</span>
        <div style={{ flex: 1 }} />
        {data.crossed_median > 0 && (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
              borderRadius: 5,
              background: "rgba(239,68,68,0.16)",
              border: "1px solid rgba(239,68,68,0.5)",
            }}
          >
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: 14, fontWeight: 700, color: "#ff5a5a", lineHeight: 1,
              }}
            >
              {data.crossed_median}
            </span>
            <span style={{ fontFamily: FONT_CJK, fontSize: 9.5, color: "#ff8080" }}>越中線</span>
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {data.adiz.map((z) => (
          <span
            key={z.key}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "3px 0", borderRadius: 4,
              background: z.active ? "rgba(255,152,0,0.12)" : "rgba(255,255,255,0.03)",
              border: z.active ? "1px solid rgba(255,152,0,0.4)" : `1px solid ${COLORS.borderSoft}`,
            }}
          >
            <span
              style={{
                width: 5, height: 5, borderRadius: "50%",
                background: z.active ? COLORS.statusWarn : COLORS.textGhost,
                boxShadow: z.active ? `0 0 5px ${COLORS.statusWarn}` : "none",
              }}
            />
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: 9.5,
                color: z.active ? COLORS.textDefault : COLORS.textFaint,
              }}
            >
              {z.label}
            </span>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textDim }}>
        <span>
          海軍 <b style={{ color: COLORS.textDefault }}>{data.plan_vessels}</b> 艦
        </span>
        <span>
          公務船 <b style={{ color: COLORS.textDefault }}>{data.official_ships}</b>
        </span>
        {!adizActive && data.sorties === 0 && (
          <span style={{ color: COLORS.textFaint }}>· 等待今日上午 8 點前更新</span>
        )}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 7, borderTop: `1px solid ${COLORS.borderSoft}` }}>
        <div style={{ fontFamily: FONT_CJK, fontSize: 9.5, color: COLORS.textMuted, lineHeight: 1.4 }}>
          {data.title}
        </div>
        <div style={{ fontFamily: FONT_CJK, fontSize: 8, color: COLORS.textFaint, marginTop: 3, lineHeight: 1.4 }}>
          {data.source}
        </div>
      </div>
    </div>
  );
}

function DiseaseCard({ d, week }: { d: CdcDisease; week: number }) {
  // 疾病：升 = 警示 → 紅；降 = 改善 → 綠
  const worse = d.yoy >= 0;
  const yc = worse ? COLORS.statusWarn : COLORS.statusLive;
  return (
    <div
      style={{
        borderRadius: 9, border: `1px solid ${COLORS.panelBorder}`,
        background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        padding: "12px 13px", display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0,
          }}
        />
        <span
          style={{ fontFamily: FONT_CJK, fontSize: 12, fontWeight: 700, color: COLORS.textStrong }}
        >
          {d.label}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 8.5, color: COLORS.textFaint,
            padding: "1px 6px", borderRadius: 3, background: "rgba(255,255,255,0.05)",
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
          <span style={{ fontFamily: FONT_DATA, fontSize: 11, fontWeight: 700, color: yc }}>
            {worse ? "↑" : "↓"}
            {worse ? "+" : ""}
            {d.yoy}%
          </span>
          <span style={{ fontFamily: FONT_CJK, fontSize: 9, color: COLORS.textFaint }}>
            vs 去年同期
          </span>
        </span>
        <Sparkline data={d.spark} color={d.color} w={62} h={20} />
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
  pla: PlaActivity;
  health: PublicHealthWeek;
}

export function SituationCards({ pla, health }: Props) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 3, height: 12, borderRadius: 2, background: COLORS.accent }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 10, letterSpacing: "1.5px", color: COLORS.textDefault,
          }}
        >
          情勢 · SITUATION BOARD
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_CJK, fontSize: 9, color: COLORS.textFaint }}>
          共機每日 06:00 · CDC 截至 ISO 第 W{health.week} 週
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <PlaCard data={pla} />
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
  borderRadius: 9, border: `1px dashed ${COLORS.borderSoft}`,
  background: "rgba(255,255,255,0.01)", padding: "12px 13px",
  fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint,
  display: "flex", alignItems: "center", justifyContent: "center",
};
