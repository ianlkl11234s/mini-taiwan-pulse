/**
 * §E 衛星百科卡（點任一衛星觸發）
 *
 * 顯示 UCS catalog 完整 28 欄 + 變軌歷史（30d）+ 啟發式預測（μ±σ）
 *
 * 所有時間預測必須標：「估算」「信心區間 NN%」「*基於歷史變軌間隔，非精準預測」
 *
 * 資料：
 * - UCS ← get_satellite_catalog RPC
 * - 變軌歷史 ← get_satellite_tle_history RPC → deriveManeuverEvents
 * - 預測 ← computePrediction(events)
 */
import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, MANEUVER_TOKEN } from "./satelliteConsoleTokens";
import { fetchCatalog, formatOperatingSince, type CatalogRow } from "../../data/satelliteCatalogLoader";
import {
  fetchTleHistory,
  deriveManeuverEvents,
  computePrediction,
  type TleHistoryRow,
  type DerivedManeuverEvent,
  type PredictionStats,
} from "../../data/satelliteHistoryLoader";
import { localeForTaiwanSat } from "../../data/satelliteTaiwanLocale";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";

interface Props {
  norad: number;
  onClose: () => void;
  onOpenCompare: (m: ManeuverRow) => void;
}

export function SatelliteDetailCard({ norad, onClose }: Props) {
  const [catalog, setCatalog] = useState<CatalogRow | null>(null);
  const [history, setHistory] = useState<TleHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchCatalog(norad),
      fetchTleHistory(norad, 30),
    ]).then(([cat, hist]) => {
      if (!alive) return;
      setCatalog(cat);
      setHistory(hist);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [norad]);

  const events: DerivedManeuverEvent[] = useMemo(() => deriveManeuverEvents(history), [history]);
  const prediction: PredictionStats = useMemo(() => computePrediction(events), [events]);

  const twLocale = localeForTaiwanSat(norad);
  const orbitStr = useMemo(() => {
    if (!catalog) return "—";
    const peri = catalog.perigee_km != null ? Math.round(catalog.perigee_km) : null;
    const apo = catalog.apogee_km != null ? Math.round(catalog.apogee_km) : null;
    const inc = catalog.inclination_deg != null ? catalog.inclination_deg.toFixed(1) : null;
    const per = catalog.period_min != null ? catalog.period_min.toFixed(1) : null;
    const orbitClass = catalog.orbit_class || catalog.orbit_type;
    const parts = [
      orbitClass,
      peri != null && apo != null ? `${peri} × ${apo} km` : null,
      inc != null ? `${inc}°` : null,
      per != null ? `${per} min` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "—";
  }, [catalog]);

  return (
    <div
      style={{
        position: "fixed",
        left: 64 + 412 + 8,
        top: 98,
        width: 380,
        maxHeight: "calc(100vh - 112px)",
        background: COLORS.panelBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 10,
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONT_CJK,
        color: COLORS.textDefault,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        animation: "satConsoleFadeIn .25s ease-out",
      }}
    >
      {/* header */}
      <div style={{
        padding: "11px 14px 9px",
        borderBottom: `1px solid ${COLORS.panelBorder}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {twLocale ? twLocale.zh : (catalog?.name || `NORAD ${norad}`)}
          </div>
          <div style={{ fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>
            NORAD {norad}{catalog?.cospar_number ? ` · COSPAR ${catalog.cospar_number}` : ""}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            width: 24, height: 24, borderRadius: 4, border: "none",
            background: "transparent", color: COLORS.textDim, cursor: "pointer",
            fontSize: 18, lineHeight: 1,
          }}
        >×</button>
      </div>

      <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: "11px 14px 14px" }}>
        {loading ? (
          <div style={{ fontSize: 11, color: COLORS.textFaint, padding: "20px 0", textAlign: "center" }}>
            載入中…
          </div>
        ) : (
          <>
            {/* 操作方／用途 */}
            <Section title="操作方／用途">
              <Row label="國家" value={fmtCountry(catalog?.country_operator)} />
              {catalog?.operator && <Row label="運營商" value={catalog.operator} />}
              <Row label="用途" value={twLocale?.use || catalog?.purpose || "—"} />
              {catalog?.detailed_purpose && catalog.detailed_purpose !== catalog.purpose && (
                <Row label="細項" value={catalog.detailed_purpose} />
              )}
              {catalog?.users && <Row label="用戶" value={catalog.users} />}
            </Section>

            {/* 發射 */}
            <Section title="發射">
              <Row label="日期" value={catalog?.launch_date || "—"} />
              <Row label="場地" value={catalog?.launch_site || "—"} />
              <Row label="火箭" value={catalog?.launch_vehicle || "—"} />
              <Row label="製造" value={catalog?.contractor || "—"} />
              <Row label="已運作" value={formatOperatingSince(catalog?.launch_date || null)} />
              {catalog?.launch_mass_kg != null && (
                <Row label="質量" value={`${catalog.launch_mass_kg} kg`} />
              )}
              {catalog?.expected_lifetime_yrs != null && (
                <Row label="設計壽命" value={`${catalog.expected_lifetime_yrs} 年`} />
              )}
            </Section>

            {/* 軌道 */}
            <Section title="軌道">
              <Row label="參數" value={orbitStr} />
              {catalog?.eccentricity != null && (
                <Row label="離心率" value={catalog.eccentricity.toExponential(2)} />
              )}
            </Section>

            {/* 變軌歷史 */}
            <Section title={`變軌歷史 · 近 30 天（${events.length} 筆）`}>
              {events.length === 0 ? (
                <div style={{ fontSize: 10.5, color: COLORS.textFaint, padding: "4px 0" }}>
                  近 30 天 TLE 變化未達閾值，無顯著機動
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {events.slice(0, 8).map((e, i) => {
                    const token = MANEUVER_TOKEN[e.type];
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                        <span style={{ color: token.color, fontFamily: FONT_DATA, width: 16 }}>{token.icon}</span>
                        <span style={{ fontFamily: FONT_DATA, fontSize: 10.5, color: COLORS.textMuted, width: 78 }}>
                          {e.date}
                        </span>
                        <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: token.color, width: 50 }}>
                          {e.type === "PLANE_CHANGE" ? "PLANE" : e.type === "ALTITUDE_CHANGE" ? "ALT" : "SHAPE"}
                        </span>
                        <span style={{ color: COLORS.textDefault, fontFamily: FONT_DATA, fontSize: 10 }}>{e.detail}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* 啟發式預測 */}
            {prediction.muDays != null && prediction.muDays > 0 && (
              <Section title="啟發式預測">
                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(100,170,255,0.08)", border: "1px solid rgba(100,170,255,0.25)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 10, color: COLORS.textMuted }}>下次變軌約</span>
                    <span style={{ fontFamily: FONT_DATA, fontSize: 16, fontWeight: 700, color: "#cfe4ff" }}>
                      {prediction.nextLowDays}–{prediction.nextHighDays}
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.textMuted }}>天內</span>
                    <span style={{ marginLeft: "auto", fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted }}>
                      信心 {prediction.confidencePercent}%
                    </span>
                  </div>
                  <div style={{ marginTop: 5, fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textFaint }}>
                    μ = {prediction.muDays.toFixed(1)}d · σ = {prediction.sigmaDays?.toFixed(1)}d · n = {prediction.sampleSize}
                  </div>
                  {/* mini bar visualization */}
                  <div style={{ marginTop: 6, position: "relative", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{
                      position: "absolute",
                      left: `${Math.min(100, (prediction.nextLowDays! / 30) * 100)}%`,
                      width: `${Math.min(100, ((prediction.nextHighDays! - prediction.nextLowDays!) / 30) * 100)}%`,
                      height: "100%",
                      borderRadius: 3,
                      background: "rgba(100,170,255,0.5)",
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9.5, color: COLORS.textFaint }}>
                    ⚠ 估算 · 非精準預測 · 基於 satellite_tle_history 推算的歷史變軌間隔
                  </div>
                </div>
              </Section>
            )}

            {/* footnote */}
            <div style={{ marginTop: 10, fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, lineHeight: 1.5 }}>
              來源：UCS Satellite Database (reference.satellite_catalog) · TLE history (realtime.satellite_tle_history)
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: FONT_DATA,
        fontSize: 9,
        letterSpacing: "1.5px",
        color: COLORS.textFaint,
        marginBottom: 4,
        paddingBottom: 3,
        borderBottom: `1px solid ${COLORS.borderSoft}`,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 11, padding: "2px 0" }}>
      <span style={{ width: 70, color: COLORS.textDim, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.textDefault, flex: 1, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function fmtCountry(c?: string | null): string {
  if (!c) return "—";
  if (c === "China") return "🇨🇳 中國";
  if (c === "Taiwan") return "🇹🇼 台灣";
  if (c === "USA") return "🇺🇸 美國";
  return c;
}
