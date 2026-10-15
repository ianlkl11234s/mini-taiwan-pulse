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
import { FONT_CJK, FONT_DATA, PANEL_WIDTH } from "./satelliteConsoleTokens";
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
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeManeuverDetail, localizeOperatingSince, maneuverTypeLabel, rich } from "./maneuverAlertKit";

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

  const i18n = useLocale();
  const { t } = i18n;
  const twLocale = localeForTaiwanSat(norad);
  const peri = catalog?.perigee_km != null ? Math.round(catalog.perigee_km) : null;
  const apo = catalog?.apogee_km != null ? Math.round(catalog.apogee_km) : null;
  // 台灣衛星的中文名只在中文介面當標題；外文介面用 UCS 登錄名（載入前／查無時顯示衛星編號）
  const title = twLocale && i18n.active === "zh-TW" ? twLocale.zh : (catalog?.name || t("satelliteConsole.card.fallbackTitle", { id: norad }));

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
        eyebrow={t("satelliteConsole.card.eyebrow")}
        title={title}
        onClose={onClose}
        borderColor={p.panelBorder}
        mutedColor={p.textDim}
        textColor={p.textStrong}
      />

      <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 14px 14px" }}>
        {loading ? (
          <div style={{ fontSize: FONT_SIZE.base, color: p.textFaint, padding: "20px 0", textAlign: "center" }}>
            {t("satelliteConsole.card.loading")}
          </div>
        ) : (
          <>
            <div style={{ fontSize: FONT_SIZE.sm, color: p.textDim }}>
              <span title={t("satelliteConsole.card.noradTitle")}>{t("satelliteConsole.card.noradLabel")} <Mono>{norad}</Mono></span>
              {catalog?.cospar_number && <> · <span title={t("satelliteConsole.card.cosparTitle")}>{t("satelliteConsole.card.cosparLabel")} <Mono>{catalog.cospar_number}</Mono></span></>}
            </div>

            {/* UCS 目錄讀取失敗／查無此衛星：各自文案，不以整卡「—」帶過 */}
            {catalogRes && catalogRes.status !== "ok" && (
              <Section title={t("satelliteConsole.card.basicInfo")}>
                <div role="status" style={{ fontSize: FONT_SIZE.base, color: catalogRes.status === "error" ? p.statusWarn : p.textFaint, padding: "4px 0" }}>
                  {catalogRes.status === "error"
                    ? t("satelliteConsole.card.ucsError")
                    : t("satelliteConsole.card.ucsMissing")}
                </div>
              </Section>
            )}
            {catalogRes?.status === "ok" && catalog && (
              <>
                <Section title={t("satelliteConsole.card.operatorUse")}>
                  <Row label={t("satelliteConsole.card.country")} value={fmtCountry(catalog.country_operator, i18n)} />
                  <Row label={t("satelliteConsole.card.operator")} value={catalog.operator ?? ""} />
                  <Row label={t("satelliteConsole.card.purpose")} value={twLocale?.use ? enumLabel("satelliteTwUse", twLocale.use, twLocale.use, i18n) : (catalog.purpose || "")} />
                  <Row label={t("satelliteConsole.card.detailedPurpose")} value={catalog.detailed_purpose && catalog.detailed_purpose !== catalog.purpose ? catalog.detailed_purpose : ""} />
                  <Row label={t("satelliteConsole.card.users")} value={catalog.users ?? ""} />
                </Section>

                <Section title={t("satelliteConsole.card.launch")}>
                  <Row label={t("satelliteConsole.card.launchDate")} value={catalog.launch_date || ""} mono />
                  <Row label={t("satelliteConsole.card.launchSite")} value={catalog.launch_site || ""} />
                  <Row label={t("satelliteConsole.card.rocket")} value={catalog.launch_vehicle || ""} />
                  <Row label={t("satelliteConsole.card.manufacturer")} value={catalog.contractor || ""} />
                  <Row label={t("satelliteConsole.card.operating")} value={localizeOperatingSince(formatOperatingSince(catalog.launch_date || null, timelineSec * 1000), i18n)} />
                  <Row label={t("satelliteConsole.card.mass")} value={catalog.launch_mass_kg != null ? `${catalog.launch_mass_kg} kg` : ""} mono />
                  <Row label={t("satelliteConsole.card.designLife")} value={catalog.expected_lifetime_yrs != null ? t("satelliteConsole.card.years", { count: catalog.expected_lifetime_yrs }) : ""} mono />
                </Section>

                <Section title={t("satelliteConsole.card.orbit")}>
                  <Row label={t("satelliteConsole.card.orbitType")} value={catalog.orbit_class || catalog.orbit_type || ""} />
                  <Row label={t("satelliteConsole.card.altitude")} value={peri != null && apo != null ? `${peri} × ${apo} km` : ""} mono />
                  <Row label={t("satelliteConsole.field.inclination")} value={catalog.inclination_deg != null ? `${catalog.inclination_deg.toFixed(1)}°` : ""} mono />
                  <Row label={t("satelliteConsole.field.period")} value={catalog.period_min != null ? t("satelliteConsole.card.minutes", { value: catalog.period_min.toFixed(1) }) : ""} mono />
                  <Row label={t("satelliteConsole.field.eccentricity")} value={catalog.eccentricity != null ? catalog.eccentricity.toExponential(2) : ""} mono />
                </Section>
              </>
            )}

            {/* 變軌歷史 */}
            <Section title={t("satelliteConsole.card.history")} trailing={historyRes?.ok ? t("satelliteConsole.card.historyCount", { count: events.length }) : t("satelliteConsole.card.last30d")}>
              {!historyRes?.ok ? (
                <div role="status" style={{ fontSize: FONT_SIZE.sm, color: p.statusWarn, padding: "4px 0" }}>
                  {t("satelliteConsole.card.historyError")}
                </div>
              ) : historyRes.rows.length === 0 ? (
                <div style={{ fontSize: FONT_SIZE.sm, color: p.textFaint, padding: "4px 0" }}>
                  {t("satelliteConsole.card.historyNone")}
                </div>
              ) : events.length === 0 ? (
                <div style={{ fontSize: FONT_SIZE.sm, color: p.textFaint, padding: "4px 0" }}>
                  {t("satelliteConsole.card.historyQuiet")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {events.slice(0, 8).map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: FONT_SIZE.base, borderTop: i ? `1px solid ${p.borderSoft}` : "none" }}>
                      <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.sm, color: p.textMuted, width: 78, flexShrink: 0 }}>{e.date}</span>
                      <span style={{ fontSize: FONT_SIZE.sm, color: p.textMuted, flexShrink: 0 }}>{maneuverTypeLabel(e.type, i18n)}</span>
                      <span style={{ color: p.textDefault, fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontSize: FONT_SIZE.sm }}>{localizeManeuverDetail(e.detail, i18n)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 啟發式預測（P-D：必須標「依歷史間隔估算」「非精準預測」） */}
            {prediction.muDays != null && prediction.muDays > 0 && (
              <Section title={t("satelliteConsole.card.next")}>
                <div style={{ fontSize: FONT_SIZE.base, color: p.textDefault }}>
                  {rich(t("satelliteConsole.card.nextRange", { range: "{range}" }), {
                    range: <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.lg, fontWeight: 700, color: p.textStrong }}>{prediction.nextLowDays}–{prediction.nextHighDays}</span>,
                  })}
                </div>
                <div style={{ marginTop: 3, fontSize: FONT_SIZE.sm, color: p.textDim, lineHeight: 1.5 }}>
                  {rich(t("satelliteConsole.card.nextBasis", { count: prediction.sampleSize, n: "{n}", mu: "{mu}" }), {
                    n: <Mono>{prediction.sampleSize}</Mono>,
                    mu: <Mono>{prediction.muDays.toFixed(1)}</Mono>,
                  })}
                </div>
              </Section>
            )}

            <SourceFooter
              props={{
                source_org: t("satelliteConsole.card.sourceOrg"),
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

function fmtCountry(c: string | null | undefined, i18n: LocaleSnapshot): string {
  if (!c) return "";
  const zh = c === "China" ? "中國" : c === "Taiwan" ? "台灣" : c === "USA" ? "美國" : null;
  return zh ? enumLabel("satelliteCountry", c, zh, i18n) : c;
}
