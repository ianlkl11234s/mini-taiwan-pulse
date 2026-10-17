// Legend sub-components (hazardLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { useEffect, useState } from "react";
import { timeStore } from "../../state/timeStore";
import { activeAgencyVersions, fetchTyphoonAgencyForecasts, groupAgencyTracks, type AgencyForecastTrack } from "../../data/typhoonAgencyForecastsLoader";
import { TYPHOON_AGENCIES, TYPHOON_AGENCY_COLORS, TYPHOON_AGENCY_LABELS, TYPHOON_GALE_COLOR, TYPHOON_STORM_COLOR } from "../../data/typhoonTypes";
import { useLocale } from "../../state/localeStore";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { enumLabel } from "../../i18n/dataText";
import type { MessageKey } from "../../i18n/keys";
import { localizeLayerName } from "../../i18n/layerText";
import { THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchHatch, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { BRIDGE_RESILIENCE_COLORS, BRIDGE_RESILIENCE_LIMITS_TEXT, BRIDGE_RESILIENCE_UNVALIDATED_OPACITY_FACTOR, BRIDGE_RESILIENCE_UNVALIDATED_TEXT, BRIDGE_WEIGHTINGS, DECAY_RAMP, BRIDGE_RESILIENCE_RAMP, DEST_MEAN_BREAKS, VILLAGE_METRICS, VILLAGE_METRIC_BREAKS } from "../../data/bridgeResilienceTypes";
import { useBridgeResilienceOrigin } from "../../data/bridgeResilienceStore";
import { BSS_BRIDGE_ACCESS_COLORS, BSS_BRIDGE_V5_LINE_COLORS } from "../../data/bssBridgeTypes";
import { LIQUEFACTION_SITE_COLOR, SOIL_POTENTIAL_CLASSES, WEAK_SOIL_CLASS_UPPER_M, WEAK_SOIL_COLORS, WEAK_SOIL_MIN_ZOOM, WEAK_SOIL_SPT_THRESHOLD } from "../../data/soilLiquefactionTypes";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { ALERT_GROUPS, ALERT_GROUP_KEYS } from "../../data/disasterAlertTypes";
import { NEWS_CATEGORIES } from "../../data/newsEventTypes";
import { GLOBAL_EVENT_CATEGORIES, GLOBAL_EVENT_SEVERITIES } from "../../data/globalEventsTypes";
import { CWA_INTENSITY_BANDS } from "../../data/earthquakeReplayTypes";
import { FIRE_STATION_CATS, FIRE_HYDRANT_CATS, FIRE_EVENT_CATS, FIRE_ISOCHRONE_BANDS } from "../../data/fireTypes";
import { MOUNTAIN_RESCUE_CAUSES } from "../../data/mountainSafetyTypes";
import { NUCLEAR_DOSE_THRESHOLDS, NUCLEAR_LEVEL_COLORS, type NuclearDoseLevel } from "../../data/nuclearLoader";
import { ER_LEVEL_COLORS, ER_LEVEL_LABELS, ER_CONGESTION_THRESHOLDS, type ErCongestionLevel } from "../../data/erCongestionTypes";
import { DenseHeatmapLegendRow, FireCatRows } from "./legendShared";

type LabelKeyCat = { color: string; key: MessageKey };

const EQ_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#ff3b30", label: "0" },
  { depth: 30, color: "#ff9500", label: "30" },
  { depth: 70, color: "#ffcc00", label: "70" },
  { depth: 150, color: "#42a5f5", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

// ── 坡度 / 坡向 分級向量（PMTiles polygon）圖例 ──
const SLOPE_VECTOR_CATS: LabelKeyCat[] = [
  { color: "#1a9850", key: "legend.hazard.slope1" },
  { color: "#66bd63", key: "legend.hazard.slope2" },
  { color: "#d9ef8b", key: "legend.hazard.slope3" },
  { color: "#fee08b", key: "legend.hazard.slope4" },
  { color: "#fc8d59", key: "legend.hazard.slope5" },
  { color: "#d73027", key: "legend.hazard.slope6" },
];

export function SlopeVectorLegend() {
  const { t } = useLocale();
  return (
    <div>
      <LegendTitle zh={t("legend.hazard.slopeTitle")} en="Slope" />
      <FireCatRows cats={SLOPE_VECTOR_CATS.map((c) => ({ color: c.color, label: t(c.key) }))} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {t("legend.hazard.slopeNote")}
      </LegendNote>
    </div>
  );
}

const ASPECT_VECTOR_CATS: LabelKeyCat[] = [
  { color: "#e41a1c", key: "legend.hazard.aspectN" },
  { color: "#ff7f00", key: "legend.hazard.aspectNE" },
  { color: "#ffde00", key: "legend.hazard.aspectE" },
  { color: "#a6d854", key: "legend.hazard.aspectSE" },
  { color: "#4daf4a", key: "legend.hazard.aspectS" },
  { color: "#20b2aa", key: "legend.hazard.aspectSW" },
  { color: "#377eb8", key: "legend.hazard.aspectW" },
  { color: "#984ea3", key: "legend.hazard.aspectNW" },
  { color: "#bdbdbd", key: "legend.hazard.aspectFlat" },
];

export function AspectVectorLegend() {
  const { t } = useLocale();
  return (
    <div>
      <LegendTitle zh={t("legend.hazard.aspectTitle")} en="Aspect" />
      <FireCatRows cats={ASPECT_VECTOR_CATS.map((c) => ({ color: c.color, label: t(c.key) }))} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {t("legend.hazard.aspectNote")}
      </LegendNote>
    </div>
  );
}

const FLOOD_SENSOR_CATS: LabelKeyCat[] = [
  { color: "#404040", key: "legend.hazard.flood0" },
  { color: "#fde047", key: "legend.hazard.flood1" },
  { color: "#fb923c", key: "legend.hazard.flood2" },
  { color: "#ef4444", key: "legend.hazard.flood3" },
  { color: "#7f1d1d", key: "legend.hazard.flood4" },
];

export function FloodSensorLegend() {
  const { t } = useLocale();
  return (
    <div>
      <LegendTitle zh={t("legend.hazard.floodTitle")} en="USWG" />
      <FireCatRows cats={FLOOD_SENSOR_CATS.map((c) => ({ color: c.color, label: t(c.key) }))} />
    </div>
  );
}

export function FireEventLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("fireEvents", LAYER_MANIFEST.fireEvents.name, i18n).primary} en="Fire" />
      <FireCatRows cats={FIRE_EVENT_CATS.map((c) => ({ ...c, label: enumLabel("fireEventCasualty", c.cat, c.label, i18n) }))} />
      <DenseHeatmapLegendRow layers={["fireEvents", "fireLatest"]} />
      <LegendNote>{i18n.t("legend.hazard.fireEventNote")}</LegendNote>
    </div>
  );
}

export function FireStationLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("fireStations", LAYER_MANIFEST.fireStations.name, i18n).primary} en="Stations" />
      <FireCatRows cats={FIRE_STATION_CATS.map((c) => ({ ...c, label: enumLabel("fireStationType", c.cat, c.label, i18n) }))} />
    </div>
  );
}

const BSS_BRIDGE_CLASS_LEGEND: readonly { key: keyof typeof BSS_BRIDGE_ACCESS_COLORS; point: MessageKey }[] = [
  { key: "road_bridge_carrier_candidate", point: "legend.hazard.bssPoint1" },
  { key: "road_elevated_or_expressway_review", point: "legend.hazard.bssPoint2" },
  { key: "road_unresolved", point: "legend.hazard.bssPoint3" },
  { key: "foot_or_rail_register_only", point: "legend.hazard.bssPoint4" },
];

const BSS_BRIDGE_V5_LINE_LEGEND: readonly { key: keyof typeof BSS_BRIDGE_V5_LINE_COLORS; label: MessageKey; dash?: number[] }[] = [
  { key: "osm_entity_unique", label: "legend.hazard.bssLine1" },
  { key: "osm_entity_multi_segment", label: "legend.hazard.bssLine2" },
  { key: "official_axis_only", label: "legend.hazard.bssLine3" },
  { key: "network_inferred_only", label: "legend.hazard.bssLine4", dash: [2, 1] },
];

function BssBridgeSharedNotes() {
  const { t } = useLocale();
  return <>
    <LegendNote>{t("legend.hazard.bssNote1")}</LegendNote>
    <LegendNote>{t("legend.hazard.bssNote2")}</LegendNote>
    <LegendNote>{t("legend.hazard.bssNote3", { rights: t("legend.hazard.bssRights") })}</LegendNote>
  </>;
}

export function BssBridgeLineLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.hazard.bssLineTitle")} en="Bridge Direction Candidates" />
    {BSS_BRIDGE_V5_LINE_LEGEND.map((item) => (
      <LegendRow key={item.key} swatch={<SwatchLine color={BSS_BRIDGE_V5_LINE_COLORS[item.key]} dash={item.dash} />}>{t(item.label)}</LegendRow>
    ))}
    <LegendNote>{t("legend.hazard.bssLineNote")}</LegendNote>
    <BssBridgeSharedNotes />
  </div>;
}

export function BssBridgePointLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.hazard.bssPointTitle")} en="Bridge Register Points" />
    {BSS_BRIDGE_CLASS_LEGEND.map((item) => (
      <LegendRow key={item.key} swatch={<SwatchDot color={BSS_BRIDGE_ACCESS_COLORS[item.key]} />}>{t(item.point)}</LegendRow>
    ))}
    <DenseHeatmapLegendRow layers={["bssNationalBridgePointsPreview"]} />
    <LegendNote>{t("legend.hazard.bssPointNote")}</LegendNote>
    <BssBridgeSharedNotes />
  </div>;
}

export function BridgeResilienceLegend({ weightingIdx, metricIdx, showVillages, showRoutes }: { weightingIdx: number; metricIdx: number; showVillages: boolean; showRoutes: boolean }) {
  const i18n = useLocale();
  const { t } = i18n;
  const decay = (BRIDGE_WEIGHTINGS[weightingIdx] ?? "decay") === "decay";
  const metric = VILLAGE_METRICS[metricIdx] ?? "p90";
  const breaks = VILLAGE_METRIC_BREAKS[metric];
  const minutes = (b: number) => t("legend.hazard.brMinutes", { n: b / 60 });
  const labels = metric === "p90" ? [...breaks.map(minutes)] : [...breaks.map((b) => `${Math.round(b * 100)}%`)];
  const origin = useBridgeResilienceOrigin();
  const destinationView = showVillages && !!origin;
  return <div>
    <LegendTitle zh={t("legend.hazard.brTitle")} en="Bridge Resilience" />
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.car} width={3} />}>{t("legend.hazard.brCar")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.scooter} width={2} />}>{t("legend.hazard.brScooter")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.car} width={2} dash={[1.5, 1.5]} />}>{t("legend.hazard.brApproach")}</LegendRow>
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.car} width={3} opacity={BRIDGE_RESILIENCE_UNVALIDATED_OPACITY_FACTOR} />}>{t("legend.hazard.brUnvalidated", { text: enumLabel("bridgeResilienceMisc", "unvalidated", BRIDGE_RESILIENCE_UNVALIDATED_TEXT, i18n) })}</LegendRow>
    <LegendNote>{t("legend.hazard.brMix")}</LegendNote>
    {showRoutes && <>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.routeBefore} width={2} dash={[1.5, 1.5]} />}>{t("legend.hazard.brRouteBefore")}</LegendRow>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.routeAfter} width={2.5} />}>{t("legend.hazard.brRouteAfter")}</LegendRow>
      <LegendNote>{t("legend.hazard.brRouteNote")}</LegendNote>
    </>}
    {showVillages && !destinationView && decay && <div style={{ marginTop: 6 }}>
      <LegendTitle zh={t("legend.hazard.brDecayTitle")} />
      <SwatchSteps colors={DECAY_RAMP} breaks={["<1", "1", "5", "15", "30", "60", "≥120"]} />
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.villageNeutral} />}>{t("legend.hazard.brNoWeight")}</LegendRow>
      <LegendNote>{t("legend.hazard.brDecayNote")}</LegendNote>
    </div>}
    {showVillages && !destinationView && !decay && <div style={{ marginTop: 6 }}>
      <LegendTitle zh={t("legend.hazard.brOriginTitle", { metric: t(metric === "p90" ? "legend.hazard.brMetricP90" : "legend.hazard.brMetricShare") })} />
      <SwatchSteps colors={BRIDGE_RESILIENCE_RAMP} breaks={["0", ...labels]} />
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.villageNeutral} />}>{metric === "p90" ? t("legend.hazard.brNoImpactP90") : t("legend.hazard.brMissing")}</LegendRow>
      <LegendNote>{t("legend.hazard.brOriginNote")}</LegendNote>
    </div>}
    {destinationView && <div style={{ marginTop: 6 }}>
      <LegendTitle zh={t("legend.hazard.brDestTitle")} />
      <SwatchSteps colors={BRIDGE_RESILIENCE_RAMP} breaks={["0", ...DEST_MEAN_BREAKS.map(minutes)]} />
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.villageNeutral} />}>{t("legend.hazard.brDestNoImpact")}</LegendRow>
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.destUnreachable} />}>{t("legend.hazard.brDestUnreach")}</LegendRow>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.destOrigin} width={3} />}>{t("legend.hazard.brDestOrigin")}</LegendRow>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.destTop} width={2} />}>{t("legend.hazard.brDestTop")}</LegendRow>
      <LegendNote>{t("legend.hazard.brDestNote")}</LegendNote>
      {decay && <LegendNote>{t("legend.hazard.brDestUniformNote")}</LegendNote>}
    </div>}
    {BRIDGE_RESILIENCE_LIMITS_TEXT.map((text, i) => <LegendNote key={text}>{enumLabel("bridgeResilienceLimit", i, text, i18n)}</LegendNote>)}
    <LegendNote>{t("legend.hazard.brFooter")}</LegendNote>
  </div>;
}

export function FireHydrantLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("fireHydrants", LAYER_MANIFEST.fireHydrants.name, i18n).primary} en="Hydrants" />
      <FireCatRows cats={FIRE_HYDRANT_CATS.map((c) => ({ ...c, label: enumLabel("fireHydrantType", c.cat, c.label, i18n) }))} />
      <DenseHeatmapLegendRow layers={["fireHydrants"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {i18n.t("legend.hazard.hydrantCoverage")}
      </LegendNote>
    </div>
  );
}

export function FireIsochroneLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("fireIsochrone", LAYER_MANIFEST.fireIsochrone.name, i18n).primary} en="Isochrone" />
      <FireCatRows
        cats={FIRE_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: enumLabel("fireIsochrone", b.minutes, b.label, i18n) }))}
        square
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {i18n.t("legend.hazard.isochroneNote")}
      </LegendNote>
    </div>
  );
}

// ── 山域事故 Legend（cause 9 族 + 點大小/紅描邊語意）──

export function MountainRescueLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.mountainTitle")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {MOUNTAIN_RESCUE_CAUSES.map((c) => (
          <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={c.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("mountainRescueCause", c.value, c.label, i18n)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <SwatchDot color={"transparent"} stroke="#ff2d2d" strokeWidth={1.5} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.hazard.mountainDeath")}</span>
        </div>
        <LegendNote style={{ lineHeight: 1.4 }}>
          {i18n.t("legend.hazard.mountainSize")}
        </LegendNote>
      </div>
    </div>
  );
}

// ── Soil Liquefaction Legend（owner-only 私人 PMTiles；色票與 hook 同一組常數）──

export function SoilLiquefactionPotentialLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("soilLiquefactionPotential", LAYER_MANIFEST.soilLiquefactionPotential.name, i18n).primary} en="Soil Liquefaction" />
    {SOIL_POTENTIAL_CLASSES.map((item) => <LegendRow key={item.value} swatch={<SwatchSquare color={item.color} />}>{enumLabel("soilPotentialClass", item.value, item.label, i18n)}</LegendRow>)}
    <LegendRow swatch={<SwatchHatch />}>{i18n.t("legend.hazard.soilNotInvestigated")}</LegendRow>
    <LegendRow swatch={<SwatchSquare color={t.border} outline />}>{i18n.t("legend.hazard.soilNoData")}</LegendRow>
    <LegendNote>{i18n.t("legend.hazard.soilNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.soilRights")}</LegendNote>
  </div>;
}

const weakSoilBreaks = (uppers: readonly number[]) => uppers.map((upper) => `≤${upper}`);

export function WeakSoilLegend({ type }: { type: 'clay' | 'sand' }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const colors = WEAK_SOIL_COLORS[type];
  const zeroMarker = "\u0001";
  const [zeroBefore, zeroAfter] = i18n.t("legend.hazard.weakZeroRow", { zero: zeroMarker }).split(zeroMarker);
  return <div>
    <LegendTitle zh={i18n.t(type === 'clay' ? "legend.hazard.weakClayTitle" : "legend.hazard.weakSandTitle")} en={type === 'clay' ? 'Soft Clay' : 'Loose Sand'} />
    <LegendRow swatch={null}>{i18n.t("legend.hazard.weakBand1")}</LegendRow>
    <SwatchSteps colors={colors} breaks={weakSoilBreaks(WEAK_SOIL_CLASS_UPPER_M['0_5m'])} />
    <LegendRow swatch={null}>{i18n.t("legend.hazard.weakBand2")}</LegendRow>
    <SwatchSteps colors={colors} breaks={weakSoilBreaks(WEAK_SOIL_CLASS_UPPER_M['10_20m'])} />
    <LegendRow swatch={<SwatchSquare color={t.border} outline />}>{zeroBefore}<LegendNum>0 m</LegendNum>{zeroAfter}</LegendRow>
    <LegendRow swatch={<SwatchHatch />}>{i18n.t("legend.hazard.weakMissing")}</LegendRow>
    <LegendNote>{i18n.t("legend.hazard.weakNote", { threshold: WEAK_SOIL_SPT_THRESHOLD[type], zoom: WEAK_SOIL_MIN_ZOOM })}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.soilRights")}</LegendNote>
  </div>;
}

export function LiquefactionMonitoringLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={localizeLayerName("liquefactionMonitoringSites", LAYER_MANIFEST.liquefactionMonitoringSites.name, i18n).primary} en="Liquefaction Monitoring" />
    <LegendRow swatch={<SwatchDot color={LIQUEFACTION_SITE_COLOR} />}>{i18n.t("legend.hazard.monitorRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.hazard.monitorNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.hazard.soilRights")}</LegendNote>
  </div>;
}

// ── Earthquake Legend ──

export function EarthquakeLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("earthquakes", LAYER_MANIFEST.earthquakes.name, i18n).primary} en="Earthquake" />

      {/* Depth color bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          {i18n.t("legend.hazard.eqDepth")}
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${EQ_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Magnitude size reference */}
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          {i18n.t("legend.hazard.eqMagnitude")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[3, 5, 7].map((m) => {
            const r = m === 3 ? 4 : m === 5 ? 10 : 24;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 16),
                    height: Math.min(r, 16),
                    borderRadius: RADIUS.full,
                    background: "rgba(255, 59, 48, 0.4)",
                    border: "1px solid rgba(255, 59, 48, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 地震回放：CWA 震度色階（測站 circle / 等震度網格 / 鄉鎮面量圖三處同色）──

export function EarthquakeReplayLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.eqReplayTitle")} en="CWA Intensity" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {CWA_INTENSITY_BANDS.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("cwaIntensity", band.value, band.label, i18n)}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        {i18n.t("legend.hazard.eqReplayNote1")}
        <br />
        {i18n.t("legend.hazard.eqReplayNote2")}
      </LegendNote>
    </div>
  );
}

// ── USGS Global Earthquake Legend ──

const EQ_GLOBAL_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#dc2626", label: "0" },
  { depth: 30, color: "#f97316", label: "30" },
  { depth: 70, color: "#facc15", label: "70" },
  { depth: 150, color: "#38bdf8", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

export function EarthquakeGlobalLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.eqGlobalTitle")} en="USGS" />
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          {i18n.t("legend.hazard.eqDepth")}
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${EQ_GLOBAL_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_GLOBAL_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          {i18n.t("legend.hazard.eqMagnitudeM")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[2, 4, 6, 8].map((m) => {
            const r = m === 2 ? 4 : m === 4 ? 8 : m === 6 ? 14 : 20;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 18),
                    height: Math.min(r, 18),
                    borderRadius: RADIUS.full,
                    background: "rgba(220, 38, 38, 0.4)",
                    border: "1px solid rgba(220, 38, 38, 0.85)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Typhoon Track Legend ──

export function TyphoonTrackLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("typhoonTracks", LAYER_MANIFEST.typhoonTracks.name, i18n).primary} en="JMA / JTWC / CWA" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchLine color="#a855f7" width={3} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.hazard.typObserved")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 0,
              borderTop: "2px dashed #38bdf8",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.hazard.typForecast")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchDot color={"transparent"} stroke="#fde047" strokeWidth={1.5} glow="#f0abfc" />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.hazard.typCurrent")}</span>
        </div>
        <LegendRow swatch={<SwatchSquare color={TYPHOON_GALE_COLOR} opacity={0.45} stroke={TYPHOON_GALE_COLOR} />}>{i18n.t("legend.hazard.typGale")}</LegendRow>
        <LegendRow swatch={<SwatchSquare color={TYPHOON_STORM_COLOR} opacity={0.6} stroke={TYPHOON_STORM_COLOR} />}>{i18n.t("legend.hazard.typStorm")}</LegendRow>
        <LegendRow swatch={<SwatchLine color="#38bdf8" width={1.5} dash={[3, 3]} />}>{i18n.t("legend.hazard.typProb70")}</LegendRow>
      </div>
      <LegendNote>{i18n.t("legend.hazard.typAllNote")}</LegendNote>
    </div>
  );
}

// ── 各國颱風預報（NCDR 五家）Legend：每家一色＋目前時間軸上顯示的那一版發佈時間 ──

export function TyphoonAgencyForecastLegend() {
  const i18n = useLocale();
  const [tracks, setTracks] = useState<AgencyForecastTrack[] | null>(null);
  const [nowTs, setNowTs] = useState(() => timeStore.getTime());
  useEffect(() => {
    let cancelled = false;
    fetchTyphoonAgencyForecasts()
      .then((rows) => { if (!cancelled) setTracks(groupAgencyTracks(rows)); })
      .catch(() => { if (!cancelled) setTracks([]); });
    const unsub = timeStore.subscribeThrottled(1000, (tm) => setNowTs(tm));
    return () => { cancelled = true; unsub(); };
  }, []);
  const active = tracks ? activeAgencyVersions(tracks, nowTs) : [];
  const issuedBy = new Map(active.map((tr) => [tr.agency, tr.issued_label]));
  return (
    <div>
      <LegendTitle zh={localizeLayerName("typhoonAgencyForecasts", LAYER_MANIFEST.typhoonAgencyForecasts.name, i18n).primary} en="NCDR" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {TYPHOON_AGENCIES.map((a) => {
          const label = issuedBy.get(a);
          return (
            <LegendRow key={a} swatch={<SwatchLine color={TYPHOON_AGENCY_COLORS[a]} width={2.5} />}>
              {enumLabel("typhoonAgency", a, TYPHOON_AGENCY_LABELS[a], i18n)}
              {" · "}
              {label ? i18n.t("legend.hazard.typAgencyIssued", { label }) : i18n.t("legend.hazard.typAgencyNone")}
            </LegendRow>
          );
        })}
      </div>
      {tracks !== null && active.length === 0 && <LegendNote>{i18n.t("legend.hazard.typAgencyEmpty")}</LegendNote>}
      <LegendNote>{i18n.t("legend.hazard.typAgencyNote")}</LegendNote>
    </div>
  );
}

export function DisasterAlertLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const groups = ALERT_GROUP_KEYS.filter((k) => visibility[k]);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.alertTitle")} en="Alerts" />
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>
            {enumLabel("alertGroup", g, ALERT_GROUPS[g].label, i18n)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(ALERT_GROUPS[g].types).map(([term, color]) => (
              <div key={term} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <SwatchSquare color={color} opacity={0.8} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("alertTerm", term, term, i18n)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: RADIUS.full,
            border: "2px solid #dc2626",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
          {i18n.t("legend.hazard.alertPulse")}
        </span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        {i18n.t("legend.hazard.alertFill")}
      </div>
    </div>
  );
}

// ── News Events Legend (7 類分色) ──

export function NewsEventsLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={localizeLayerName("newsEvents", LAYER_MANIFEST.newsEvents.name, i18n).primary} en="News Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NEWS_CATEGORIES.map((cat) => (
          <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot glow={THEMED_PAINT_COLORS.newsGlow[isDark ? "dark" : "light"]} color={cat.color} opacity={cat.key === "other" ? 0.4 : 0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("eventNewsCategory", cat.key, cat.label, i18n)}</span>
          </div>
        ))}
      </div>
      <LegendNote>
        {i18n.t("legend.hazard.newsNote")}
      </LegendNote>
    </div>
  );
}

export function GlobalEventsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.globalTitle")} en="Global Events" />
      <FireCatRows cats={GLOBAL_EVENT_CATEGORIES.map(({ value, color, label }) => ({ color, label: enumLabel("globalEventCategory", value, label, i18n) }))} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
        {GLOBAL_EVENT_SEVERITIES.map((item) => (
          <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{
              width: item.radius * 2,
              height: item.radius * 2,
              borderRadius: RADIUS.full,
              background: "#94a3b8",
              border: "1px solid rgba(15,23,42,0.8)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{item.value}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4 }}>
        {i18n.t("legend.hazard.globalSize")}
        <br />{i18n.t("legend.hazard.globalOutline")}
      </LegendNote>
      <div style={{ display: "flex", gap: 9, marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim }}>
        <span><span style={{ color: "#facc15" }}>○</span> {i18n.t("legend.hazard.globalNew")}</span>
        <span><span style={{ color: "#38bdf8" }}>○</span> {i18n.t("legend.hazard.globalUpdated")}</span>
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        {i18n.t("legend.hazard.globalNote")}
      </LegendNote>
    </div>
  );
}

export function NuclearLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows: { key: NuclearDoseLevel; label: string }[] = [
    { key: "normal", label: i18n.t("legend.hazard.nuclearNormal", { n: NUCLEAR_DOSE_THRESHOLDS.normal }) },
    { key: "watch", label: i18n.t("legend.hazard.nuclearWatch", { n: NUCLEAR_DOSE_THRESHOLDS.watch }) },
    { key: "warning", label: i18n.t("legend.hazard.nuclearWarning", { n: NUCLEAR_DOSE_THRESHOLDS.warning }) },
    { key: "alarm", label: i18n.t("legend.hazard.nuclearAlarm", { n: NUCLEAR_DOSE_THRESHOLDS.warning }) },
    { key: "stale", label: i18n.t("legend.hazard.nuclearStale") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.nuclearTitle")} />
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={NUCLEAR_LEVEL_COLORS[row.key]} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.hazard.nuclearNote1")}<br />
        {i18n.t("legend.hazard.nuclearNote2")}
      </LegendNote>
    </div>
  );
}

export function ErCongestionLegend() {
  const i18n = useLocale();
  const rows: { key: ErCongestionLevel; label: string }[] = [
    { key: "smooth", label: i18n.t("legend.hazard.erSmooth", { n: ER_CONGESTION_THRESHOLDS.smooth }) },
    { key: "light", label: i18n.t("legend.hazard.erLight", { from: ER_CONGESTION_THRESHOLDS.smooth + 1, to: ER_CONGESTION_THRESHOLDS.light }) },
    { key: "congested", label: i18n.t("legend.hazard.erCongested", { from: ER_CONGESTION_THRESHOLDS.light + 1, to: ER_CONGESTION_THRESHOLDS.congested }) },
    { key: "severe", label: i18n.t("legend.hazard.erSevere", { n: ER_CONGESTION_THRESHOLDS.congested }) },
    { key: "nodata", label: i18n.t("legend.hazard.erNoData") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.hazard.erTitle")} />
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={ER_LEVEL_COLORS[row.key]} />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>
            {enumLabel("erLevel", row.key, ER_LEVEL_LABELS[row.key], i18n)} · {row.label}
          </span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.hazard.erIcu")}<br />
        {i18n.t("legend.hazard.erCalib")}
      </LegendNote>
    </div>
  );
}
