/**
 * PropertyValuePanel — 台灣房地產總市值面板（縣市長條圖）
 *
 * 左 docked 面板，幾何 / token 沿用 SatelliteConsole（left:64 top:98 bottom:130），
 * 長條圖用既有 inline「track div + width% span」慣例（本 repo 不引入 chart library，
 * 見 HotspotsWidget / SituationOverview）。
 *
 * 資料 = `public/urban/property_value_admin.json`（上游 admin_value.json）：
 * headline total_trillion + 19 縣市 value_market_corrected 降冪 + meta.limitations 摺疊。
 *
 * ⚠️ 誠實度硬要求（上游 handoff §已知限制）：limitations 三條必須在面板內可讀，
 *    不可只放 tooltip；GBA CC BY-NC 4.0 禁商用的 license_note 同樣必須露出。
 */
import { useEffect, useState } from "react";
import { PiggyBank, X } from "lucide-react";
import { COLORS, FONT_CJK, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { PROPERTY_VALUE_ATTRIBUTION, PROPERTY_VALUE_GRID_BANDS } from "../data/propertyValueTypes";
import { loadPropertyValueAdmin, type PropertyValueAdmin } from "../data/propertyValueAdminLoader";

const PANEL_WIDTH = 330;

// 長條圖色帶沿用地圖層 inferno 的中高段（index 3→7，視覺上跟總市值網格是同一件事）；
// 刻意不取兩端：#1b0c41 在深色 panel 上等於隱形、#fcffa4 太淡看不出長度邊界。
const BAR_GRADIENT = `linear-gradient(to right, ${PROPERTY_VALUE_GRID_BANDS[3]!.color}, ${PROPERTY_VALUE_GRID_BANDS[7]!.color})`;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PropertyValuePanel({ open, onClose }: Props) {
  const [data, setData] = useState<PropertyValueAdmin | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    let alive = true;
    loadPropertyValueAdmin()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        console.warn("[propertyValue] admin json 載入失敗:", e);
        if (alive) setFailed(true);
      });
    return () => { alive = false; };
  }, [open, data]);

  if (!open) return null;

  const counties = data
    ? [...data.county].sort((a, b) => b.value_market_corrected - a.value_market_corrected)
    : [];
  const maxValue = counties.length ? counties[0]!.value_market_corrected : 1;

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 64,
          top: 98,
          bottom: 130,
          width: PANEL_WIDTH,
          background: COLORS.panelBg,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.panelBorder}`,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          borderRadius: RADIUS.xl,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pointerEvents: "auto",
          animation: "propertyValueFadeIn .25s ease-out",
          color: COLORS.textDefault,
          fontFamily: FONT_CJK,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "13px 14px 11px",
            borderBottom: `1px solid ${COLORS.panelBorder}`,
            flexShrink: 0,
          }}
        >
          <PiggyBank size={17} color={COLORS.accent} strokeWidth={1.6} style={{ flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.textStrong }}>
              房地產總市值
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "2.5px", color: COLORS.textDim }}>
              PROPERTY VALUE
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 24, height: 24, borderRadius: RADIUS.md, border: "none",
              background: "transparent", color: COLORS.textDim,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="layer-sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 14px 14px" }}>
          {failed && (
            <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textFaint, padding: "10px 2px" }}>
              ⚠ 總市值統計載入失敗（property_value_admin.json）
            </div>
          )}
          {!failed && !data && (
            <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textFaint, padding: "10px 2px" }}>
              載入中…
            </div>
          )}

          {data && (
            <>
              {/* ── Headline ── */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
                  台灣房地產總市值 TOTAL
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: FONT_DATA, fontSize: 32, fontWeight: 700, color: COLORS.textStrong, lineHeight: 1 }}>
                    ≈ {data.meta.total_trillion.toFixed(0)}
                  </span>
                  <span style={{ fontSize: FONT_SIZE.lg, color: COLORS.textMuted }}>兆元</span>
                </div>
                <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, marginTop: 5, lineHeight: 1.5 }}>
                  {data.meta.buildings_total.toLocaleString()} 棟本島建物（房+地合計）·
                  錨定 {data.meta.anchor.verdict === "PASS" ? "✅ PASS" : `⚠ ${String(data.meta.anchor.verdict)}`}
                  （vs 國富統計 230 兆）
                </div>
              </div>

              {/* ── 縣市長條圖 ── */}
              <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 6 }}>
                縣市排名 BY COUNTY（{counties.length} 縣市）
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {counties.map((c, i) => (
                  <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textDim, width: 14, textAlign: "right", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: FONT_SIZE.base, color: COLORS.textStrong, width: 52, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                    <div style={{ flex: 1, height: 7, borderRadius: RADIUS.md, background: "rgba(255,255,255,0.05)", overflow: "hidden", minWidth: 20 }}>
                      <span
                        style={{
                          display: "block", height: "100%",
                          width: `${(c.value_market_corrected / maxValue) * 100}%`,
                          background: BAR_GRADIENT,
                        }}
                      />
                    </div>
                    <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700, color: COLORS.textDefault, width: 40, textAlign: "right", flexShrink: 0 }}>
                      {(c.value_market_corrected / 1e12).toFixed(1)}
                    </span>
                    <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, flexShrink: 0 }}>兆</span>
                  </div>
                ))}
              </div>

              {/* ── 已知限制（誠實聲明，摺疊）── */}
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: "pointer", fontSize: FONT_SIZE.base, color: COLORS.textMuted }}>
                  已知限制與方法（{data.meta.limitations.length} 條）
                </summary>
                <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, lineHeight: 1.6, marginTop: 6 }}>
                  <div style={{ marginBottom: 6 }}>{data.meta.method}</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {data.meta.limitations.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
                  </ul>
                  <div style={{ marginTop: 6, color: COLORS.statusWarn }}>⚠ {data.meta.license_note}</div>
                </div>
              </details>

              <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 10, lineHeight: 1.5 }}>
                {PROPERTY_VALUE_ATTRIBUTION}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes propertyValueFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
