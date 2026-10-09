/**
 * §E 衛星百科卡（點任一衛星觸發）
 *
 * 顯示 UCS catalog 完整 28 欄 + 變軌歷史（30d）+ 啟發式預測（μ±σ）
 *
 * 所有時間預測必須標：「依歷史間隔估算」「非精準預測」；不顯示信心百分比（公式值不是統計量），
 * 歷史變軌間隔少於 MIN_PREDICTION_INTERVALS 個時不顯示預測
 *
 * 資料：
 * - UCS ← get_satellite_catalog RPC
 * - 變軌歷史 ← get_satellite_tle_history RPC → deriveManeuverEvents
 * - 預測 ← computePrediction(events)
 */
import { useEffect, useMemo, useState } from "react";
import { FONT_CJK, FONT_DATA, MANEUVER_TOKEN, PANEL_WIDTH } from "./satelliteConsoleTokens";
import { ELEVATION, RADIUS, FONT_SIZE, LAYOUT, LIGHT } from "../../styles/designTokens";
import { useIntelTheme } from "../intel/intelTheme";
import { PanelHeader } from "../sidebar/PanelHeader";
import { SubGroupLabel } from "../sidebar/ThemeBanner";
import { Row, SourceFooter } from "../featureInfo/shared";
import { fetchCatalog, formatOperatingSince, type CatalogResult } from "../../data/satelliteCatalogLoader";
import {
  fetchTleHistory,
  deriveManeuverEvents,
  computePrediction,
  type TleHistoryResult,
  type DerivedManeuverEvent,
  type PredictionStats,
} from "../../data/satelliteHistoryLoader";
import { localeForTaiwanSat } from "../../data/satelliteTaiwanLocale";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import { useTimeStoreTime } from "../../hooks/useTimeStoreTime";
import { SATELLITE_SOURCE_URLS } from "../../data/satelliteDataState";

interface Props {
  norad: number;
  /** 衛星情報面板是否開著：開著時貼在面板右側，關著時貼在 rail 右側 */
  docked?: boolean;
  onClose: () => void;
  onOpenCompare: (m: ManeuverRow) => void;
}

/** 面板左緣（與 SatelliteConsole 一致）；卡片貼在面板右側留 8px */
const PANEL_LEFT = 64;
const CARD_GAP = 8;

export function SatelliteDetailCard({ norad, docked = true, onClose }: Props) {
  const p = useIntelTheme();
  const [catalogRes, setCatalogRes] = useState<CatalogResult | null>(null);
  const [historyRes, setHistoryRes] = useState<TleHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  // 訂閱時間軸 — 「已運作」欄會隨拉軸更新；變軌歷史也以時間軸當下為基準
  const timelineSec = useTimeStoreTime(1000);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchCatalog(norad),
      fetchTleHistory(norad, 30),
    ]).then(([cat, hist]) => {
      if (!alive) return;
      setCatalogRes(cat);
      setHistoryRes(hist);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [norad]);

  const catalog = catalogRes?.status === "ok" ? catalogRes.row : null;
  const events: DerivedManeuverEvent[] = useMemo(
    () => (historyRes?.ok ? deriveManeuverEvents(historyRes.rows) : []),
    [historyRes],
  );
  const prediction: PredictionStats = useMemo(() => computePrediction(events), [events]);

  const twLocale = localeForTaiwanSat(norad);
  const peri = catalog?.perigee_km != null ? Math.round(catalog.perigee_km) : null;
  const apo = catalog?.apogee_km != null ? Math.round(catalog.apogee_km) : null;
  const title = twLocale ? twLocale.zh : (catalog?.name || `衛星編號 ${norad}`);

  const cardLeft = docked ? PANEL_LEFT + PANEL_WIDTH + CARD_GAP : PANEL_LEFT;

  return (
    <div
      style={{
        position: "fixed",
        left: cardLeft,
        top: LAYOUT.leftDockTop,
        width: 380,
        // 扣掉左緣偏移：窄螢幕（390px）卡片不會從右側溢出
        maxWidth: `calc(100vw - ${cardLeft}px - 8px)`,
        maxHeight: "calc(100vh - 112px)",
        background: p.panelBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${p.panelBorder}`,
        borderRadius: RADIUS.xl,
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONT_CJK,
        color: p.textDefault,
        boxShadow: p.isDark ? ELEVATION.lg : LIGHT.elevationLg,
        animation: "satConsoleFadeIn .25s ease-out",
      }}
    >
      <PanelHeader
        eyebrow="衛星百科"
        title={title}
        onClose={onClose}
        borderColor={p.panelBorder}
        mutedColor={p.textDim}
        textColor={p.textStrong}
      />

      <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 14px 14px" }}>
        {loading ? (
          <div style={{ fontSize: FONT_SIZE.base, color: p.textFaint, padding: "20px 0", textAlign: "center" }}>
            載入中…
          </div>
        ) : (
          <>
            <div style={{ fontSize: FONT_SIZE.sm, color: p.textDim }}>
              <span title="NORAD 編號">衛星編號 <Mono>{norad}</Mono></span>
              {catalog?.cospar_number && <> · <span title="COSPAR 編號">國際編號 <Mono>{catalog.cospar_number}</Mono></span></>}
            </div>

            {/* UCS 目錄讀取失敗／查無此衛星：各自文案，不以整卡「—」帶過 */}
            {catalogRes && catalogRes.status !== "ok" && (
              <Section title="衛星基本資料">
                <div role="status" style={{ fontSize: FONT_SIZE.base, color: catalogRes.status === "error" ? p.statusWarn : p.textFaint, padding: "4px 0" }}>
                  {catalogRes.status === "error"
                    ? "UCS 衛星資料庫讀取失敗"
                    : "UCS 衛星資料庫沒有這顆衛星的紀錄"}
                </div>
              </Section>
            )}
            {catalogRes?.status === "ok" && catalog && (
              <>
                <Section title="操作方與用途">
                  <Row label="國家" value={fmtCountry(catalog.country_operator)} />
                  <Row label="運營商" value={catalog.operator ?? ""} />
                  <Row label="用途" value={twLocale?.use || catalog.purpose || ""} />
                  <Row label="細項" value={catalog.detailed_purpose && catalog.detailed_purpose !== catalog.purpose ? catalog.detailed_purpose : ""} />
                  <Row label="用戶" value={catalog.users ?? ""} />
                </Section>

                <Section title="發射">
                  <Row label="日期" value={catalog.launch_date || ""} mono />
                  <Row label="場地" value={catalog.launch_site || ""} />
                  <Row label="火箭" value={catalog.launch_vehicle || ""} />
                  <Row label="製造" value={catalog.contractor || ""} />
                  <Row label="已運作" value={formatOperatingSince(catalog.launch_date || null, timelineSec * 1000)} />
                  <Row label="質量" value={catalog.launch_mass_kg != null ? `${catalog.launch_mass_kg} kg` : ""} mono />
                  <Row label="設計壽命" value={catalog.expected_lifetime_yrs != null ? `${catalog.expected_lifetime_yrs} 年` : ""} mono />
                </Section>

                <Section title="軌道">
                  <Row label="類型" value={catalog.orbit_class || catalog.orbit_type || ""} />
                  <Row label="高度" value={peri != null && apo != null ? `${peri} × ${apo} km` : ""} mono />
                  <Row label="傾角" value={catalog.inclination_deg != null ? `${catalog.inclination_deg.toFixed(1)}°` : ""} mono />
                  <Row label="週期" value={catalog.period_min != null ? `${catalog.period_min.toFixed(1)} 分鐘` : ""} mono />
                  <Row label="離心率" value={catalog.eccentricity != null ? catalog.eccentricity.toExponential(2) : ""} mono />
                </Section>
              </>
            )}

            {/* 變軌歷史 */}
            <Section title="變軌歷史" trailing={historyRes?.ok ? `近 30 天 ${events.length} 筆` : "近 30 天"}>
              {!historyRes?.ok ? (
                <div role="status" style={{ fontSize: FONT_SIZE.sm, color: p.statusWarn, padding: "4px 0" }}>
                  歷史軌道資料讀取失敗，無法判斷近 30 天變軌
                </div>
              ) : historyRes.rows.length === 0 ? (
                <div style={{ fontSize: FONT_SIZE.sm, color: p.textFaint, padding: "4px 0" }}>
                  近 30 天沒有歷史軌道資料
                </div>
              ) : events.length === 0 ? (
                <div style={{ fontSize: FONT_SIZE.sm, color: p.textFaint, padding: "4px 0" }}>
                  近 30 天軌道參數變化未達閾值，無顯著機動
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {events.slice(0, 8).map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: FONT_SIZE.base, borderTop: i ? `1px solid ${p.borderSoft}` : "none" }}>
                      <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.sm, color: p.textMuted, width: 78, flexShrink: 0 }}>{e.date}</span>
                      <span style={{ fontSize: FONT_SIZE.sm, color: p.textMuted, flexShrink: 0 }}>{MANEUVER_TOKEN[e.type].zh}</span>
                      <span style={{ color: p.textDefault, fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.sm }}>{e.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 啟發式預測（P-D：必須標「依歷史間隔估算」「非精準預測」） */}
            {prediction.muDays != null && prediction.muDays > 0 && (
              <Section title="下次變軌">
                <div style={{ fontSize: FONT_SIZE.base, color: p.textDefault }}>
                  約 <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.lg, fontWeight: 700, color: p.textStrong }}>{prediction.nextLowDays}–{prediction.nextHighDays}</span> 天內
                </div>
                <div style={{ marginTop: 3, fontSize: FONT_SIZE.sm, color: p.textDim, lineHeight: 1.5 }}>
                  依歷史間隔估算：近 30 天 <Mono>{prediction.sampleSize}</Mono> 次變軌、平均間隔 <Mono>{prediction.muDays.toFixed(1)}</Mono> 天 · 非精準預測
                </div>
              </Section>
            )}

            <SourceFooter
              props={{
                source_org: "UCS 衛星資料庫 · 歷史軌道資料（Space-Track）",
                source_url: SATELLITE_SOURCE_URLS.ucs,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{children}</span>;
}

function Section({ title, trailing, children }: { title: string; trailing?: string; children: React.ReactNode }) {
  const p = useIntelTheme();
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ margin: "0 -12px" }}><SubGroupLabel>{title}</SubGroupLabel></div>
      {trailing && <div style={{ fontSize: FONT_SIZE.sm, color: p.textDim, paddingBottom: 2 }}>{trailing}</div>}
      {children}
    </div>
  );
}

function fmtCountry(c?: string | null): string {
  if (!c) return "";
  if (c === "China") return "中國";
  if (c === "Taiwan") return "台灣";
  if (c === "USA") return "美國";
  return c;
}
