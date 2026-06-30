import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";

export interface PrisonDay {
  observed_date: string;
  total_inmates: number | null;
  male_inmates: number | null;
  female_inmates: number | null;
  approved_capacity: number | null;
  over_capacity_pct: number | null;
  new_in_count: number | null;
  new_out_count: number | null;
}

interface Props { latest: PrisonDay | null }

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("zh-TW");
}

export function PrisonCard({ latest }: Props) {
  const total = latest?.total_inmates ?? null;
  const cap = latest?.approved_capacity ?? null;
  const overPct = latest?.over_capacity_pct ?? null;
  const isOver = overPct != null && Number(overPct) > 0;
  const dotColor = isOver ? "#ef4444" : "#10b981";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={COLORS.accent}>司法矯正 · INMATES</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: "linear-gradient(160deg, rgba(124,58,237,0.06), rgba(255,255,255,0.012))",
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 11, height: 11, borderRadius: RADIUS.full, background: dotColor,
            boxShadow: `0 0 7px ${dotColor}`, flexShrink: 0,
          }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 700, color: COLORS.textStrong }}>
            {latest ? `全國在監 (${latest.observed_date})` : "全國在監（資料載入中）"}
          </span>
        </div>
        {latest && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xxl, fontWeight: 700, color: COLORS.textStrong }}>
                  {fmt(total)}
                </span>
                <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginLeft: 4 }}>人</span>
              </div>
              <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
                男 {fmt(latest.male_inmates)} / 女 {fmt(latest.female_inmates)}
              </div>
            </div>
            <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>核定容額 {fmt(cap)}</span>
              <span style={{ color: isOver ? "#fb7185" : COLORS.textMuted }}>
                超收率 {overPct == null ? "—" : `${Number(overPct).toFixed(2)}%`}
              </span>
              <span>當日入 {fmt(latest.new_in_count)} / 出 {fmt(latest.new_out_count)}</span>
            </div>
          </>
        )}
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
          來源：法務部矯正署 prisonmuseum 每日 XML
        </div>
      </div>
    </div>
  );
}
