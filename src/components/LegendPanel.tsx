import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COLORS, SURFACE, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import type { LayerVisibility } from "../types";
import { CROP_SUITABILITY_CROPS } from "../data/cropSuitabilityCrops";
import { AGRI_POI_TYPES } from "../data/agriPOITypes";
import { MEDICAL_POI_TYPES } from "../data/medicalPOITypes";
import { AGRI_COMPANY_TYPES } from "../data/agriCompanyTypes";
import { ALERT_GROUPS, ALERT_GROUP_KEYS } from "../data/disasterAlertTypes";
import { NEWS_CATEGORIES } from "../data/newsEventTypes";
import { ECO_NETWORK_ZONE_TYPES } from "../data/ecoNetworkZoneTypes";
import { FOREST_RESERVE_TYPES } from "../data/forestReserveTypes";
import {
  FIRE_STATION_CATS, FIRE_HYDRANT_CATS, FIRE_EVENT_CATS, FIRE_HYDRANT_COVERAGE_NOTE,
  FIRE_ISOCHRONE_BANDS, FIRE_ISOCHRONE_NOTE,
} from "../data/fireTypes";
import { MEDICAL_ISOCHRONE_BANDS, MEDICAL_ISOCHRONE_NOTE } from "../data/medicalIsochroneTypes";
import {
  SOIL_FERTILITY_METRICS,
  SOIL_FERTILITY_METRIC_OPTIONS,
  type SoilFertilityMetric,
} from "../data/agriSoilFertilityMetrics";
import { SATELLITE_COLORS, SATELLITE_LABELS } from "../data/satelliteTypes";
import {
  FUEL_COLORS,
  FUEL_FALLBACK_COLOR,
  RESERVE_INDICATOR_COLORS,
  RESERVE_INDICATOR_LABELS,
  CAPACITY_BREAKS,
  CAPACITY_RADIUS,
} from "../data/energyLoader";
import { LIGHTNING_TYPE_COLORS } from "../data/lightningLoader";
import {
  NUCLEAR_DOSE_THRESHOLDS,
  NUCLEAR_LEVEL_COLORS,
  type NuclearDoseLevel,
} from "../data/nuclearLoader";

/**
 * 右下角圖例面板 — 只顯示目前開啟的圖層對應圖例
 */

// ── Earthquake depth color stops ──
const EQ_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#ff3b30", label: "0" },
  { depth: 30, color: "#ff9500", label: "30" },
  { depth: 70, color: "#ffcc00", label: "70" },
  { depth: 150, color: "#42a5f5", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

// ── Road Events event_type ──
const ROAD_EVENT_TYPE_ITEMS = [
  { type: 3, color: "#ef4444", label: "事故 Accident" },
  { type: 1, color: "#eab308", label: "壅塞/事故 Congestion" },
  { type: 2, color: "#f97316", label: "施工 Construction" },
  { type: 7, color: "#a855f7", label: "活動/管制 Controlled" },
  { type: 5, color: "#dc2626", label: "災害/障礙 Disaster" },
];


// ── IoT 河川 delta 紅↔藍 ──
const IOT_RIVER_DELTA_STOPS = [
  { color: "#7e22ce", label: "-1m" },
  { color: "#a855f7", label: "-30cm" },
  { color: "#d8b4fe", label: "-10cm" },
  { color: "#94a3b8", label: "0" },
  { color: "#67e8f9", label: "+10cm" },
  { color: "#06b6d4", label: "+30cm" },
  { color: "#0e7490", label: "+1m" },
];

// ── IoT 水工結構 5 類別 ──
const IOT_STRUCTURE_TYPES = [
  { color: "#a855f7", label: "累計流量 Cumulative Flow", measure: "m³" },
  { color: "#f97316", label: "閘門 Watergate", measure: "開度 % / 水位 m" },
  { color: "#dc2626", label: "堤防安全 Dam Structure", measure: "角度 / 應力" },
  { color: "#eab308", label: "河床沖刷 Erosion", measure: "深度 m" },
  { color: "#92400e", label: "揚塵 Dust", measure: "PM10 / 風速 / 溫濕度" },
];

// ── 作物適栽 4 級 kind ──（與 agricultureLayerFactory.ts CROP_KIND_COLOR_EXPR 對齊）
const CROP_KIND_ITEMS = [
  { kind: 1, color: "#1b5e20", label: "最適 Premium" },
  { kind: 2, color: "#66bb6a", label: "適栽 Suitable" },
  { kind: 3, color: "#fff59d", label: "次適 Marginal" },
  { kind: 4, color: "#ef9a9a", label: "不適 Unsuitable" },
];

interface LegendPanelProps {
  visibility: LayerVisibility;
  overlayParams: Record<string, number>;
}

export interface LegendContext {
  visibility: LayerVisibility;
  overlayParams: Record<string, number>;
}

export interface LegendEntry {
  /** 任一 key 開啟即顯示此圖例（多 key = 共用同一份圖例的圖層群） */
  keys: (keyof LayerVisibility)[];
  render: (ctx: LegendContext) => React.ReactNode;
}

/**
 * Legend registry — 單一接線點：新 layer 要圖例就在這裡加一行
 * （元件寫在本檔下方）。layerConsistency 測試以本表為覆蓋依據。
 * 順序 = 面板顯示順序。
 */
export const LEGEND_REGISTRY: LegendEntry[] = [
  { keys: ["earthquakes"], render: () => <EarthquakeLegend /> },
  { keys: ["lifelineAlerts", "floodAlerts", "weatherAlerts", "transitAlerts", "safetyAlerts"], render: ({ visibility }) => <DisasterAlertLegend visibility={visibility} /> },
  { keys: ["roadEvents"], render: () => <RoadEventsLegend /> },
  { keys: ["newsEvents"], render: () => <NewsEventsLegend /> },
  { keys: ["iotWraRiver"], render: () => <IotRiverLegend /> },
  { keys: ["iotWraStructure"], render: () => <IotStructureLegend /> },
  { keys: ["agriCropSuitability"], render: ({ overlayParams }) => <CropSuitabilityLegend cropId={overlayParams.agriCropSuitabilityCropId ?? 0} /> },
  { keys: ["agriPOI"], render: () => <AgriPOILegend /> },
  { keys: ["agriRetail", "agriProduceWholesale", "agriWholesaleMarket"], render: ({ visibility }) => <AgriCompanyLegend visibility={visibility} /> },
  { keys: ["agriSoilFertility"], render: ({ overlayParams }) => <SoilFertilityLegend metricIdx={overlayParams.agriSoilFertilityMetricIdx ?? 0} /> },
  { keys: ["fireEvents", "fireLatest"], render: () => <FireEventLegend /> },
  { keys: ["fireStations"], render: () => <FireStationLegend /> },
  { keys: ["fireHydrants"], render: () => <FireHydrantLegend /> },
  { keys: ["fireIsochrone"], render: () => <FireIsochroneLegend /> },
  { keys: ["ecoNetworkZones"], render: () => <EcoNetworkZonesLegend /> },
  {
    keys: [
      "forestCompartments", "forestReserve", "forestRecreation", "forestRoads",
      "forestTreatmentWorks", "forestTrailSigns", "forestSignalPoints",
      "forestEducationCenters", "forestWildlife", "forestDamLakes",
      "forestFlatParks", "forestAlishanRail", "hikingTrails",
    ],
    render: ({ visibility }) => <ForestryLegend visibility={visibility} />,
  },
  { keys: ["satellitesYaogan", "satellitesJilin", "satellitesGaofen", "satellitesTJS", "satellitesBeidou", "satellitesShiyan", "satellitesTaiwan", "satellitesUSA", "satellitesJapan", "satellitesRussia", "satellitesIndia", "satellitesKorea", "satellitesFrance", "satellitesGermany", "satellitesItaly", "satellitesIsrael"], render: ({ visibility }) => <SatelliteLegend visibility={visibility} /> },
  { keys: ["waterCanals"], render: () => <WaterCanalLegend /> },
  { keys: ["medIsochrone", "medDesert"], render: () => <MedicalIsochroneLegend /> },
  { keys: ["medHospital", "medClinic", "medPharmacy", "medAED", "medLTC"], render: ({ visibility }) => <MedicalLegend visibility={visibility} /> },
  { keys: ["floodSensor", "floodSensorIsochrone"], render: () => <FloodSensorLegend /> },
  { keys: ["powerPlants", "powerGenerationUnit"], render: () => <EnergyFuelLegend /> },
  { keys: ["powerRegionDemand", "powerStatusHud"], render: () => <EnergyReserveLegend /> },
  { keys: ["osmPowerLines", "osmPowerTowers"], render: () => <PowerGridLegend /> },
  { keys: ["osmWindTurbines", "osmSolarFarms", "osmPowerPlantsStatic"], render: ({ visibility }) => <RenewablePoiLegend visibility={visibility} /> },
  { keys: ["offshoreWindZones", "islandPowerGrid", "fossilFuelInfra", "geothermalWells", "renewablePermitsTaipei"], render: ({ visibility }) => <EnergySpecialtyLegend visibility={visibility} /> },
  { keys: ["lightning"], render: () => <LightningLegend /> },
  { keys: ["nuclearRadiation"], render: () => <NuclearLegend /> },
];

export function LegendPanel({ visibility, overlayParams }: LegendPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const active = LEGEND_REGISTRY.filter((e) => e.keys.some((k) => visibility[k]));
  if (active.length === 0) return null;

  return (
    <div
      style={{
        width: 200,
        background: SURFACE.strong,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(100, 170, 255, 0.15)",
        borderRadius: RADIUS.xl,
        fontFamily: FONT_DATA,
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: COLORS.textMuted,
          fontSize: FONT_SIZE.sm,
          fontFamily: FONT_DATA,
          letterSpacing: 1,
        }}
      >
        {expanded
          ? <ChevronDown size={12} style={{ flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
        <span>LEGEND</span>
      </button>

      {/* Content — registry 驅動，順序即 LEGEND_REGISTRY 順序 */}
      {expanded && (
        <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {active.map((entry, i) => (
            <Fragment key={entry.keys[0] ?? i}>
              {entry.render({ visibility, overlayParams })}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 消防圖例（火災 / 分隊 / 消防栓）──

function FireCatRows({ cats, square }: { cats: { color: string; label: string }[]; square?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {cats.map((c) => (
        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: square ? RADIUS.sm : RADIUS.full,
              background: c.color, opacity: 0.9, flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

const FLOOD_SENSOR_CATS = [
  { color: "#404040", label: "0 cm 無淹水" },
  { color: "#fde047", label: "<5 cm 輕度" },
  { color: "#fb923c", label: "≥5 cm 中度" },
  { color: "#ef4444", label: "≥15 cm 嚴重" },
  { color: "#7f1d1d", label: "≥30 cm 極嚴重" },
];

function FloodSensorLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        都市淹水 USWG
      </div>
      <FireCatRows cats={FLOOD_SENSOR_CATS} />
    </div>
  );
}

function FireEventLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        FIRE 火災歷史
      </div>
      <FireCatRows cats={FIRE_EVENT_CATS} />
    </div>
  );
}

function FireStationLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        消防分隊 STATIONS
      </div>
      <FireCatRows cats={FIRE_STATION_CATS} />
    </div>
  );
}

function FireHydrantLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        消防栓 HYDRANTS
      </div>
      <FireCatRows cats={FIRE_HYDRANT_CATS} square />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_HYDRANT_COVERAGE_NOTE}
      </div>
    </div>
  );
}

function FireIsochroneLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        救援等時圈 ISOCHRONE
      </div>
      <FireCatRows
        cats={FIRE_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_ISOCHRONE_NOTE}
      </div>
    </div>
  );
}

function EcoNetworkZonesLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        國土綠網分區 ECO NETWORK
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ECO_NETWORK_ZONE_TYPES.map((z) => (
          <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 9, height: 9, borderRadius: RADIUS.sm, background: z.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDefault }}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Forestry Legend (15 layer 顏色/圖示) ──

const FORESTRY_LEGEND_ROWS: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "square" | "line" }[] = [
  { key: "forestCompartments", color: "#15803D", label: "林班 Compartments", shape: "square" },
  { key: "forestReserve", color: "#0F766E", label: "保安林 Reserve", shape: "square" },
  { key: "forestRecreation", color: "#65A30D", label: "森林遊樂區 Recreation", shape: "square" },
  { key: "forestRoads", color: "#A16207", label: "林道 Forest Roads", shape: "line" },
  { key: "forestTreatmentWorks", color: "#F59E0B", label: "治理工程 Treatment", shape: "circle" },
  { key: "forestTrailSigns", color: "#84CC16", label: "步道路標 Trail Signs", shape: "circle" },
  { key: "forestSignalPoints", color: "#22C55E", label: "通訊點 Signal Points", shape: "circle" },
  { key: "forestEducationCenters", color: "#0EA5E9", label: "自然教育中心 Education", shape: "circle" },
  { key: "forestWildlife", color: "#A855F7", label: "野生動物分布 Wildlife", shape: "circle" },
  { key: "forestDamLakes", color: "#06B6D4", label: "堰塞湖 Dam Lakes", shape: "circle" },
  { key: "forestFlatParks", color: "#A3E635", label: "平地森林 Flat Parks", shape: "circle" },
  { key: "forestAlishanRail", color: "#92400E", label: "阿里山鐵路 Alishan Rail (車站)", shape: "circle" },
  { key: "hikingTrails", color: "#d62728", label: "全台步道 Hiking Trails", shape: "line" },
];

const HIKING_TRAIL_SOURCES: { color: string; label: string }[] = [
  { color: "#d62728", label: "A 林業署國家步道" },
  { color: "#1f77b4", label: "B OpenStreetMap" },
  { color: "#2ca02c", label: "C 雪霸國家公園 SHP" },
  { color: "#9467bd", label: "C 金門國家公園 KML" },
  { color: "#ff7f0e", label: "D 臺北大縱走" },
  { color: "#e377c2", label: "D 新北市觀光局" },
];

function HikingTrailsSourcesLegend() {
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginBottom: 2 }}>步道來源 source</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {HIKING_TRAIL_SOURCES.map((t) => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 2, background: t.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForestReserveTypesLegend() {
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginBottom: 2 }}>保安林種類</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {FOREST_RESERVE_TYPES.map((t) => (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: RADIUS.sm, background: t.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForestryLegend({ visibility }: { visibility: LayerVisibility }) {
  const rows = FORESTRY_LEGEND_ROWS.filter((r) => visibility[r.key]);
  if (rows.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        FORESTRY 林業
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: r.shape === "line" ? 14 : 10,
                height: r.shape === "line" ? 2 : 10,
                borderRadius: r.shape === "circle" ? RADIUS.full : RADIUS.sm,
                background: r.color,
                opacity: 0.9,
                flexShrink: 0,
                border: r.shape === "line" ? "none" : "1px solid rgba(255,255,255,0.4)",
                boxSizing: "border-box",
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{r.label}</span>
          </div>
        ))}
      </div>
      {visibility.forestReserve && <ForestReserveTypesLegend />}
      {visibility.hikingTrails && <HikingTrailsSourcesLegend />}
    </div>
  );
}

// ── Soil Fertility Legend (6 metric 可切換) ──

function SoilFertilityLegend({ metricIdx }: { metricIdx: number }) {
  const metricId = (SOIL_FERTILITY_METRIC_OPTIONS[metricIdx]?.value ?? "health") as SoilFertilityMetric;
  const meta = SOIL_FERTILITY_METRICS[metricId];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        SOIL FERTILITY
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 4 }}>
        {meta.label}{meta.unit ? ` (${meta.unit})` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {meta.legendStops.map((s) => (
          <div key={`${s.color}-${s.label}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: RADIUS.sm,
                background: s.color, opacity: 0.9, flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agriculture POI Legend (休農場 / 田媽媽 / 特色農旅) ──

function AgriPOILegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        AGRICULTURE POI
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {AGRI_POI_TYPES.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: t.color,
                opacity: 0.9,
                border: "1px solid #fff",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
              {t.labelZh}
              <span style={{ color: COLORS.textDim, marginLeft: 4 }}>{t.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicalIsochroneLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        醫療等時圈 MEDICAL ISOCHRONE
      </div>
      <FireCatRows
        cats={MEDICAL_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {MEDICAL_ISOCHRONE_NOTE}
      </div>
    </div>
  );
}

function MedicalLegend({ visibility }: { visibility: LayerVisibility }) {
  // 只列出目前開啟的醫療 layer
  const shown = MEDICAL_POI_TYPES.filter((t) => visibility[t.visKey]);
  if (shown.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        MEDICAL 醫療據點
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: t.color,
                opacity: 0.9,
                border: "1px solid #fff",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
              {t.labelZh}
              <span style={{ color: COLORS.textDim, marginLeft: 4 }}>{t.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgriCompanyLegend({ visibility }: { visibility: LayerVisibility }) {
  const rows = AGRI_COMPANY_TYPES.filter((t) => visibility[t.key]);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        農企業登記 AGRI BUSINESS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: t.color,
                opacity: 0.9,
                border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
              {t.labelZh}
              <span style={{ color: COLORS.textDim, marginLeft: 4 }}>{t.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Crop Suitability Legend (作物適栽 4 級 kind) ──

function CropSuitabilityLegend({ cropId }: { cropId: number }) {
  const crop = CROP_SUITABILITY_CROPS.find((c) => c.id === cropId);
  const cropLabel = crop ? `${crop.nameZh} (${crop.nameEn})` : `#${cropId}`;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        CROP SUITABILITY
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 4 }}>
        {cropLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CROP_KIND_ITEMS.map((s) => (
          <div key={s.kind} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.sm,
                background: s.color,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Earthquake Legend ──

function EarthquakeLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        EARTHQUAKE
      </div>

      {/* Depth color bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>
          Depth (km)
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
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Magnitude size reference */}
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 3 }}>
          Magnitude
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
                <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Disaster Alert Legend ──

function RoadEventsLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ROAD EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ROAD_EVENT_TYPE_ITEMS.map((item) => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: item.color,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        ⚠ live_city 偏基隆；高雄缺 TDX 來源
      </div>
    </div>
  );
}

function DisasterAlertLegend({ visibility }: { visibility: LayerVisibility }) {
  const groups = ALERT_GROUP_KEYS.filter((k) => visibility[k]);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        NCDR 示警 ALERTS
      </div>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, marginBottom: 2 }}>
            {ALERT_GROUPS[g].label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(ALERT_GROUPS[g].types).map(([term, color]) => (
              <div key={term} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: RADIUS.sm,
                    background: color,
                    opacity: 0.8,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{term}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        填色深淺 = 嚴重度（Extreme→Minor）
      </div>
    </div>
  );
}

// ── News Events Legend (7 類分色) ──

function NewsEventsLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        NEWS EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NEWS_CATEGORIES.map((cat) => (
          <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: cat.color,
                opacity: cat.key === "other" ? 0.4 : 0.9,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{cat.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        座標 = 鄉鎮代表點（非事件位置）
      </div>
    </div>
  );
}

// ── IoT River Legend (delta 紅↔藍) ──

function IotRiverLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        IOT 河川（補強）
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>
          當日水位變化
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${IOT_RIVER_DELTA_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>下降</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>持平</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>上升</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>-1m</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>0</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>+1m</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.4 }}>
        圈大小 = 變化幅度
      </div>
    </div>
  );
}

// ── IoT Structure Legend (5 類別 + 主要測項) ──

// ── 灌排渠道 3 色圖例 ──

const WATER_CANAL_ITEMS = [
  { color: "#2dd4bf", label: "灌溉專用渠道 Irrigation" },
  { color: "#a78bfa", label: "下游具引灌需求 Demand" },
  { color: "#94a3b8", label: "不具引灌需求/宜蘭 Other" },
];

function WaterCanalLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        灌排渠道 CANAL
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {WATER_CANAL_ITEMS.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 16, height: 3, borderRadius: RADIUS.sm,
                background: c.color, opacity: 0.9, flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IotStructureLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        IOT 水工結構
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IOT_STRUCTURE_TYPES.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: RADIUS.full,
                background: s.color,
                opacity: 0.9,
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{s.label}</span>
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{s.measure}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SatelliteLegend({ visibility }: { visibility: LayerVisibility }) {
  const items: { key: keyof LayerVisibility; cat: keyof typeof SATELLITE_COLORS }[] = [
    { key: "satellitesYaogan", cat: "china_yaogan" },
    { key: "satellitesJilin", cat: "china_jilin" },
    { key: "satellitesGaofen", cat: "china_gaofen" },
    { key: "satellitesTJS", cat: "china_tjs" },
    { key: "satellitesBeidou", cat: "china_beidou" },
    { key: "satellitesShiyan", cat: "china_shiyan" },
    { key: "satellitesTaiwan", cat: "taiwan" },
    { key: "satellitesUSA", cat: "usa" },
    { key: "satellitesJapan", cat: "japan" },
    { key: "satellitesRussia", cat: "russia" },
    { key: "satellitesIndia", cat: "india" },
    { key: "satellitesKorea", cat: "korea" },
    { key: "satellitesFrance", cat: "france" },
    { key: "satellitesGermany", cat: "germany" },
    { key: "satellitesItaly", cat: "italy" },
    { key: "satellitesIsrael", cat: "israel" },
  ];
  const active = items.filter((i) => visibility[i.key]);
  if (!active.length) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        衛星 SATELLITES
      </div>
      {active.map((i) => (
        <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 12, height: 12, borderRadius: RADIUS.full, background: SATELLITE_COLORS[i.cat], display: "inline-block" }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{SATELLITE_LABELS[i.cat]}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ● 即時點 = 子衛星正下方<br />
        ● 內圓 50 km swath（成像範圍示意）<br />
        ● 虛線外圓 1,500 km（仰角 ≥ 10° 可見 cone）<br />
        ● 軌跡 = 未來 30 分鐘地面航跡
      </div>
    </div>
  );
}

// ── Energy: fuel_type 分色 + capacity 半徑 ──

const FUEL_LEGEND_ROWS: { label: string; key: string }[] = [
  { label: "核能 Nuclear", key: "nuclear" },
  { label: "燃煤 Coal", key: "coal" },
  { label: "燃油 Oil", key: "oil" },
  { label: "天然氣 Gas", key: "natural_gas" },
  { label: "水力 Hydro", key: "hydro" },
  { label: "太陽 Solar", key: "solar" },
  { label: "風力 Wind", key: "wind" },
  { label: "地熱 Geothermal", key: "geothermal" },
  { label: "生質 Biomass/Biogas", key: "biomass" },
];

function EnergyFuelLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · FUEL
      </div>
      {FUEL_LEGEND_ROWS.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: RADIUS.full,
              background: FUEL_COLORS[row.key] ?? FUEL_FALLBACK_COLOR,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{row.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 3 }}>
          Capacity (MW)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {[
            { label: `<${CAPACITY_BREAKS.small}`, r: CAPACITY_RADIUS.tiny },
            { label: `<${CAPACITY_BREAKS.medium}`, r: CAPACITY_RADIUS.small },
            { label: `<${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.medium },
            { label: `≥${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.large },
          ].map((x) => (
            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div
                style={{
                  width: x.r * 2,
                  height: x.r * 2,
                  borderRadius: RADIUS.full,
                  background: FUEL_FALLBACK_COLOR,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{x.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ● 光柱（Layer 4）= 機組即時出力 / 裝置容量<br />
        ● 14 台電廠有 output；OSM/IPP 等暫無
      </div>
    </div>
  );
}

// ── Energy: 高壓電網 voltage tier + line_type ──

function PowerGridLegend() {
  const voltageRows = [
    { kv: "345 kV", color: "#67e8f9" },
    { kv: "161 kV", color: "#22d3ee" },
    { kv: "69 kV",  color: "#0ea5e9" },
    { kv: "未標／混合", color: "#475569" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 高壓電網
      </div>
      {voltageRows.map((r) => (
        <div key={r.kv} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 16, height: 3, background: r.color, display: "inline-block", borderRadius: 1 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{r.kv}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 3 }}>
        線型
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 3, background: "#22d3ee", display: "inline-block" }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>輸電（粗）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 1.5, background: "#22d3ee", display: "inline-block", opacity: 0.55 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>配電（細）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 20,
              height: 2,
              backgroundImage: "linear-gradient(to right, #22d3ee 50%, transparent 0%)",
              backgroundSize: "6px 2px",
              backgroundRepeat: "repeat-x",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>地下電纜（虛線）</span>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ● 鐵塔需 zoom ≥ 13<br />
        ● 來源：OSM（同 openinframap），約 60% 線未標電壓
      </div>
    </div>
  );
}

// ── Energy: OSM 風光電 POI（風機 offshore/onshore + 光電 + OSM 電廠 fuel） ──

function RenewablePoiLegend({ visibility }: { visibility: LayerVisibility }) {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · OSM 風光電
      </div>
      {visibility.osmWindTurbines && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 }}>風機 (812)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#67e8f9", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>離岸 466</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#2dd4bf", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>陸域 / 未標 346</span>
          </div>
        </>
      )}
      {visibility.osmSolarFarms && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 }}>光電廠 (734)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#fbbf24", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>POI 中心</span>
          </div>
        </>
      )}
      {visibility.osmPowerPlantsStatic && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 }}>OSM 電廠 (513) by fuel</div>
          {[
            { k: "solar", c: "#fbbf24", l: "太陽" },
            { k: "wind", c: "#22d3ee", l: "風力" },
            { k: "hydro", c: "#3b82f6", l: "水力" },
            { k: "coal", c: "#374151", l: "煤" },
            { k: "gas", c: "#94a3b8", l: "天然氣" },
            { k: "nuclear", c: "#facc15", l: "核能" },
            { k: "waste", c: "#a3a300", l: "廢棄物" },
            { k: "other", c: "#9ca3af", l: "其他/未標" },
          ].map((x) => (
            <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{x.l}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
            ⚠ 與「電廠」(all_power_plants_v) 可能重疊
          </div>
        </>
      )}
    </div>
  );
}

// ── Energy: 特殊能源 5 layer 共用（offshore / island / fossil / geothermal / 北市再生） ──

function EnergySpecialtyLegend({ visibility }: { visibility: LayerVisibility }) {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 特殊
      </div>
      {visibility.offshoreWindZones && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 }}>離岸風電場址 (36)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 14, height: 10, background: "#22d3ee", opacity: 0.4, border: "1px solid #67e8f9" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>潛力場址（fill polygon）</span>
          </div>
        </>
      )}
      {visibility.islandPowerGrid && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 }}>離島電網 (14) by fuel</div>
          {[
            { c: "#f97316", l: "柴油" },
            { c: "#94a3b8", l: "天然氣" },
            { c: "#fbbf24", l: "太陽" },
            { c: "#22d3ee", l: "風力" },
            { c: "#3b82f6", l: "水力" },
            { c: "#a78bfa", l: "其他" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.fossilFuelInfra && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 }}>化石燃料 (9)</div>
          {[
            { c: "#22d3ee", l: "LNG 接收站" },
            { c: "#1f2937", l: "煉油廠" },
            { c: "#94a3b8", l: "燃氣電廠" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block", border: "1px solid #475569" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.geothermalWells && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 }}>地熱井 (36)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#ef4444", boxShadow: "0 0 6px #ef444466", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>井位 + 報告外連</span>
          </div>
        </>
      )}
      {visibility.renewablePermitsTaipei && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 6 }}>北市再生 (438) by 類別</div>
          {[
            { c: "#fbbf24", l: "學校 164" },
            { c: "#94a3b8", l: "國有房地 149" },
            { c: "#a78bfa", l: "機關 119" },
            { c: "#ef4444", l: "焚化發電 3" },
            { c: "#a3a300", l: "沼氣發電 2" },
            { c: "#3b82f6", l: "水力發電 1" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Energy: 燈號 G/Y/O/R ──

function EnergyReserveLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 備轉燈號
      </div>
      {(["G", "Y", "O", "R"] as const).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: RADIUS.full,
              background: RESERVE_INDICATOR_COLORS[k],
              boxShadow: `0 0 6px ${RESERVE_INDICATOR_COLORS[k]}99`,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>
            {k} · {RESERVE_INDICATOR_LABELS[k]}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ● 4 區用電柱（Layer 3）柱高 ∝ consumption_mw<br />
        ● 柱色 = 全國燈號（共用一個值）
      </div>
    </div>
  );
}

// ── HAZARD: 落雷 / 核安 ──

function LightningLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        HAZARD · 落雷類型
      </div>
      {[
        { label: "雲對地 CG（高傷害）", color: LIGHTNING_TYPE_COLORS[0]! },
        { label: "雲中 IC", color: LIGHTNING_TYPE_COLORS[1]! },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: RADIUS.full,
              background: row.color, display: "inline-block",
              boxShadow: `0 0 5px ${row.color}aa`,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{row.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ● zoom &lt; 10 自動 cluster<br />
        ● 預設 60 min 視窗
      </div>
    </div>
  );
}

function NuclearLegend() {
  const rows: { key: NuclearDoseLevel; label: string }[] = [
    { key: "normal", label: `正常 ≤ ${NUCLEAR_DOSE_THRESHOLDS.normal} µSv/h` },
    { key: "watch", label: `略高 ≤ ${NUCLEAR_DOSE_THRESHOLDS.watch}` },
    { key: "warning", label: `觀察 ≤ ${NUCLEAR_DOSE_THRESHOLDS.warning}` },
    { key: "alarm", label: `警戒 > ${NUCLEAR_DOSE_THRESHOLDS.warning}` },
    { key: "stale", label: "離線 stale（劑量不可信）" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        HAZARD · 核安劑量
      </div>
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: RADIUS.full,
              background: NUCLEAR_LEVEL_COLORS[row.key], display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{row.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ⚠️ 高劑量 + stale = 感測器離線 ≠ 真實核災<br />
        背景值 0.039 ~ 0.072 µSv/h（自然輻射）
      </div>
    </div>
  );
}
