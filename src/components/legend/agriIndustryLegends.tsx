// Legend sub-components (agriIndustryLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { FORESTRY_PAINT_COLORS, HIKING_TRAIL_PAINT_COLORS, THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { mapSeamColor } from "../../map/mapStyleScale";
import { usePaletteLabel, usePaletteRamp } from "../../state/layerPalette";
import { LegendNote, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { CROP_SUITABILITY_CROPS } from "../../data/cropSuitabilityCrops";
import { AGRI_POI_TYPES } from "../../data/agriPOITypes";
import { AGRI_COMPANY_TYPES } from "../../data/agriCompanyTypes";
import { FOREST_RESERVE_TYPES } from "../../data/forestReserveTypes";
import { FARM_SPECIES, FARM_COLOR_RAMP, OTHER_SPECIES_COLOR_RAMP, OTHER_SPECIES_LEGEND, SLAUGHTER_CATS, FEED_COLOR, MARKET_COLOR } from "../../data/livestockTypes";
import { COMMON_REGISTRATION_BASE_COLOR, COMMON_REGISTRATION_CAPITAL_BANDS, COMMON_REGISTRATION_LEGEND_COUNTS, commonRegistrationLegendDiameter, COMPANY_CAPITAL_Q_BANDS, COMPANY_GRID_MODES, COMPANY_DENSITY_STOPS, COMPANY_GRID_NULL_COLOR, COMPANY_GRID_SCALES, COMPANY_INDUSTRY_MID_OPTIONS, companyGridStops, companyPointFiltersActive, FACTORY_LOCATION_COLOR, INDUSTRIAL_PARK_COLOR, REGULATED_FACILITY_COLOR, INDUSTRIAL_PARK_COMPARISON_COLORS, INDUSTRIAL_PARK_COMPARISON_MODES, INDUSTRIAL_PARK_COMPARISON_STOPS, INDUSTRIAL_PARK_COMPARISON_ZERO_COLOR } from "../../data/businessRegistryTypes";
import { COMPANY_AGE_MEDIAN_STOPS, COMPANY_AGE_RECENT_STOPS, COMPANY_INDUSTRY_GROUPS, COMPANY_INDUSTRY_TIE_COLOR, COMPANY_INDUSTRY_MISSING_COLOR, COMPANY_INDUSTRY_ZERO_COLOR } from "../../data/businessDemographicsTypes";
import { MOUNTAIN_HUT_TYPES } from "../../data/mountainSafetyTypes";
import { SOIL_FERTILITY_METRICS, SOIL_FERTILITY_METRIC_OPTIONS, type SoilFertilityMetric } from "../../data/agriSoilFertilityMetrics";
import { DenseHeatmapLegendRow, FireCatRows, Swatch } from "./legendShared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";

/** 圖層名（manifest）在目前語系的顯示名，給標題與圖層名相同的圖例借用 */
type I18n = ReturnType<typeof useLocale>;

function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

// ── 作物適栽 4 級 kind ──（與 agricultureLayerFactory.ts CROP_KIND_COLOR_EXPR 對齊）
const CROP_KIND_ITEMS = [
  { kind: 1, color: "#1b5e20", label: "最適 Premium" },
  { kind: 2, color: "#66bb6a", label: "適栽 Suitable" },
  { kind: 3, color: "#fff59d", label: "次適 Marginal" },
  { kind: 4, color: "#ef9a9a", label: "不適 Unsuitable" },
];

export function LivestockFarmLegend() {
  const i18n = useLocale();
  const speciesLabel = (key: string, label: string) => enumLabel("legendAgriSpecies", key, label, i18n);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.agri.livestockFarmTitle")} />
      <FireCatRows cats={FARM_SPECIES.filter((s) => s.key !== "其他").map((s) => ({ ...s, label: speciesLabel(s.key, s.label), color: `linear-gradient(90deg,${FARM_COLOR_RAMP[s.key]!.join(",")})` }))} />
      <LegendNote style={{ marginTop: 4, marginBottom: 2 }}>
        {i18n.t("legend.agri.livestockOtherSpecies")}
      </LegendNote>
      <FireCatRows cats={OTHER_SPECIES_LEGEND.map((s) => ({ ...s, label: speciesLabel(s.key, s.label), color: `linear-gradient(90deg,${OTHER_SPECIES_COLOR_RAMP[s.key]!.join(",")})` }))} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.agri.livestockSizeNote")}
      </LegendNote>
    </div>
  );
}

export function LivestockFacilityLegend() {
  const i18n = useLocale();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <LegendTitle zh={layerTitle("livestockSlaughter", i18n)} en="Slaughter" />
        <FireCatRows cats={SLAUGHTER_CATS.map((c) => ({ ...c, label: enumLabel("legendAgriSlaughter", c.key, c.label, i18n) }))} />
      </div>
      <FireCatRows
        cats={[
          { color: FEED_COLOR, label: i18n.t("legend.agri.feedFactory") },
          { color: MARKET_COLOR, label: i18n.t("legend.agri.auctionMarket") },
        ]}
      />
    </div>
  );
}

// ── Forestry Legend (15 layer 顏色/圖示) ──

const FORESTRY_LEGEND_ROWS: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "square" | "line" }[] = [
  { key: "forestCompartments", color: FORESTRY_PAINT_COLORS.forestCompartments, label: "林班 Compartments", shape: "square" },
  { key: "forestReserve", color: FORESTRY_PAINT_COLORS.forestReserve, label: "保安林 Reserve", shape: "square" },
  { key: "forestRecreation", color: FORESTRY_PAINT_COLORS.forestRecreation, label: "森林遊樂區 Recreation", shape: "square" },
  { key: "forestRoads", color: FORESTRY_PAINT_COLORS.forestRoads, label: "林道 Forest Roads", shape: "line" },
  { key: "forestTreatmentWorks", color: FORESTRY_PAINT_COLORS.forestTreatmentWorks, label: "治理工程 Treatment", shape: "circle" },
  { key: "forestTrailSigns", color: FORESTRY_PAINT_COLORS.forestTrailSigns, label: "步道路標 Trail Signs", shape: "circle" },
  { key: "forestSignalPoints", color: FORESTRY_PAINT_COLORS.forestSignalPoints, label: "通訊點 Signal Points", shape: "circle" },
  { key: "forestEducationCenters", color: FORESTRY_PAINT_COLORS.forestEducationCenters, label: "自然教育中心 Education", shape: "circle" },
  { key: "forestWildlife", color: FORESTRY_PAINT_COLORS.forestWildlife, label: "野生動物分布 Wildlife", shape: "circle" },
  { key: "forestDamLakes", color: FORESTRY_PAINT_COLORS.forestDamLakes, label: "堰塞湖 Dam Lakes", shape: "circle" },
  { key: "forestFlatParks", color: FORESTRY_PAINT_COLORS.forestFlatParks, label: "平地森林 Flat Parks", shape: "circle" },
  { key: "forestAlishanRail", color: FORESTRY_PAINT_COLORS.forestAlishanRail, label: "阿里山鐵路 Alishan Rail (車站)", shape: "circle" },
  { key: "mountainHuts", color: MOUNTAIN_HUT_TYPES[0]!.color, label: "山屋・高山營地 Mountain Huts", shape: "circle" },
  { key: "hikingTrails", color: HIKING_TRAIL_PAINT_COLORS.A_forest, label: "全台步道 Hiking Trails", shape: "line" },
];

const HIKING_TRAIL_SOURCES: { id: string; color: string; label: string }[] = [
  { id: "A_forest", color: HIKING_TRAIL_PAINT_COLORS.A_forest, label: "A 林業署國家步道" },
  { id: "B_osm", color: HIKING_TRAIL_PAINT_COLORS.B_osm, label: "B OpenStreetMap" },
  { id: "C_np_sheipa", color: HIKING_TRAIL_PAINT_COLORS.C_np_sheipa, label: "C 雪霸國家公園 SHP" },
  { id: "C_np_kinmen", color: HIKING_TRAIL_PAINT_COLORS.C_np_kinmen, label: "C 金門國家公園 KML" },
  { id: "D_taipei_grand", color: HIKING_TRAIL_PAINT_COLORS.D_taipei_grand, label: "D 臺北大縱走" },
  { id: "D_newtaipei", color: HIKING_TRAIL_PAINT_COLORS.D_newtaipei, label: "D 新北市觀光局" },
];

function HikingTrailsSourcesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>{i18n.t("legend.agri.trailSources")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {HIKING_TRAIL_SOURCES.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchLine color={it.color} width={2} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("hikingTrailSource", it.id, it.label, i18n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 山屋 facility_type 4 類子圖例 + ODbL 標示（OSM 126 / 官方玉山 30 trust chain 合併）
function MountainHutTypesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>{i18n.t("legend.agri.hutFacilityType")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {MOUNTAIN_HUT_TYPES.map((it) => (
          <div key={it.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchDot color={it.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("mountainHutType", it.value, it.label, i18n)}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        {i18n.t("legend.agri.hutOsmNote")}
      </LegendNote>
    </div>
  );
}

function ForestReserveTypesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>{i18n.t("legend.agri.reserveTypes")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {FOREST_RESERVE_TYPES.map((it) => (
          <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchSquare color={it.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendAgriReserve", it.key, it.label, i18n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ForestryLegend({ isDark = true, visibility }: { isDark?: boolean; visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows = FORESTRY_LEGEND_ROWS.filter((r) => visibility[r.key]);
  if (rows.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.agri.forestryTitle")} en="Forestry" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {r.shape === "line" ? <SwatchLine color={r.color} /> : r.shape === "circle" ? <SwatchDot color={r.color} /> : <SwatchSquare color={r.color} stroke={r.key === "forestCompartments" ? THEMED_PAINT_COLORS.forestCompartmentsOutline[isDark ? "dark" : "light"] : r.key === "forestRecreation" ? THEMED_PAINT_COLORS.forestRecreationOutline[isDark ? "dark" : "light"] : r.key === "forestReserve" ? THEMED_PAINT_COLORS.forestReserveOutline[isDark ? "dark" : "light"] : undefined} />}
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendAgriForestry", r.key, r.label, i18n)}</span>
          </div>
        ))}
      </div>
      {visibility.forestReserve && <ForestReserveTypesLegend />}
      {visibility.mountainHuts && <MountainHutTypesLegend />}
      {visibility.hikingTrails && <HikingTrailsSourcesLegend />}
    </div>
  );
}

// ── Soil Fertility Legend (6 metric 可切換) ──

export function SoilFertilityLegend({ metricIdx }: { metricIdx: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const metricId = (SOIL_FERTILITY_METRIC_OPTIONS[metricIdx]?.value ?? "health") as SoilFertilityMetric;
  const meta = SOIL_FERTILITY_METRICS[metricId];
  return (
    <div>
      <LegendTitle zh={layerTitle("agriSoilFertility", i18n)} en="Soil Fertility" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {enumLabel("legendAgriSoilMetric", metricId, meta.label, i18n)}{meta.unit ? ` (${meta.unit})` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {meta.legendStops.map((s, i) => (
          <div key={`${s.color}-${s.label}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={s.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendAgriSoilStop", `${metricId}.${i}`, s.label, i18n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agriculture POI Legend (休農場 / 田媽媽 / 特色農旅) ──

export function AgriPOILegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.agri.agriPoiTitle")} en="Agriculture POI" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {AGRI_POI_TYPES.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {enumLabel("agriPoiType", it.id, it.labelZh, i18n)}
              {i18n.active === "zh-TW" && <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 密度色階一格的文字：`a–<b`，最後一格 `a 以上` */
function densityStopText(stop: number, next: number | undefined, i18n: I18n): string {
  return next === undefined
    ? i18n.t("legend.agri.rangeOpen", { n: i18n.formatNumber(stop) })
    : i18n.t("legend.agri.rangeLt", { lo: i18n.formatNumber(stop), hi: i18n.formatNumber(next) });
}

export function CompanyPointsLegend({ manufacturing, overlayParams }: { manufacturing: boolean; overlayParams?: Record<string, number> }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const filtersActive = !manufacturing && companyPointFiltersActive(overlayParams);
  const gridColors = usePaletteRamp("companyPoints", t.isDark, 7);
  const gridPaletteName = usePaletteLabel("companyPoints");
  return (
    <div>
      <LegendTitle zh={manufacturing ? i18n.t("legend.agri.manufacturingTitle") : layerTitle("companyPoints", i18n)} en={manufacturing ? "Manufacturing" : "Company Registry"} style={{ marginBottom: 5 }} />
      {!manufacturing && !filtersActive && <>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.agri.companyOverview", { palette: gridPaletteName })}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", marginBottom: 6 }}>
          {COMPANY_DENSITY_STOPS.map((stop, i) => (
            <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Swatch color={gridColors[i]!} round={false} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{densityStopText(stop, COMPANY_DENSITY_STOPS[i + 1], i18n)}</span>
            </div>
          ))}
        </div>
      </>}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.agri.capitalQuantile")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {COMPANY_CAPITAL_Q_BANDS.map((band) => (
          <div key={band.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={band.color} round />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.value === 0 ? i18n.t("legend.agri.capitalMissing") : band.label}</span>
          </div>
        ))}
      </div>
      {manufacturing && <DenseHeatmapLegendRow layers={["manufacturingCompanyPoints"]} />}
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {manufacturing
          ? i18n.t("legend.agri.manufacturingNote")
          : filtersActive
            ? i18n.t("legend.agri.filtersNote")
            : i18n.t("legend.agri.overviewNote")}
      </LegendNote>
    </div>
  );
}

export function FactoryLocationsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("factoryLocations", i18n)} en="Factory Locations" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color={FACTORY_LOCATION_COLOR} round />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.factoryDot")}</span>
      </div>
      <DenseHeatmapLegendRow layers={["factoryLocations"]} />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {i18n.t("legend.agri.factoryNote")}
      </LegendNote>
    </div>
  );
}

export function RegulatedFacilitiesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("regulatedFacilities", i18n)} en="Regulated Facilities" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color={REGULATED_FACILITY_COLOR} round />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.regulatedDot")}</span>
      </div>
      <DenseHeatmapLegendRow layers={["regulatedFacilities"]} />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {i18n.t("legend.agri.regulatedNote")}
      </LegendNote>
    </div>
  );
}

export function IndustrialDensityGridLegend({ layer, title, titleEn, unit, note }: { layer: string; title: string; titleEn?: string; unit: string; note: string }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const colors = usePaletteRamp(layer, t.isDark, 7);
  const paletteLabel = usePaletteLabel(layer);
  return <div>
    <LegendTitle zh={enumLabel("legendAgriDensity", `${layer}.title`, title, i18n)} en={titleEn} style={{ marginBottom: 5 }} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.agri.densityLabel", { unit: enumLabel("legendAgriDensity", `${layer}.unit`, unit, i18n), palette: paletteLabel })}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
      {COMPANY_DENSITY_STOPS.map((stop, i) => <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={colors[i]!} round={false} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{densityStopText(stop, COMPANY_DENSITY_STOPS[i + 1], i18n)}</span>
      </div>)}
    </div>
    <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
      {enumLabel("legendAgriDensity", `${layer}.note`, note, i18n)} {i18n.t("legend.agri.densityGridNote")}
    </LegendNote>
  </div>;
}

export function IndustrialParkBoundariesLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("industrialParkBoundaries", i18n)} en="Industrial Parks" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color={INDUSTRIAL_PARK_COLOR} round={false} stroke={THEMED_PAINT_COLORS.industrialParkOutline[isDark ? "dark" : "light"]} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.parkPolygon")}</span>
      </div>
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {i18n.t("legend.agri.parkNote")}
      </LegendNote>
    </div>
  );
}

export function IndustrialParkComparisonLegend({ isDark = true, modeIdx }: { isDark?: boolean; modeIdx: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const safeMode = Math.min(Math.max(Math.round(modeIdx), 0), 2);
  const mode = INDUSTRIAL_PARK_COMPARISON_MODES[safeMode]!;
  const stops = INDUSTRIAL_PARK_COMPARISON_STOPS[safeMode]!;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.agri.parkComparisonTitle", { mode: enumLabel("legendAgriParkMode", mode.value, mode.label, i18n) })} style={{ marginBottom: 5 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Swatch color={INDUSTRIAL_PARK_COMPARISON_ZERO_COLOR} round={false} stroke={THEMED_PAINT_COLORS.industrialComparisonOutline[isDark ? "dark" : "light"]} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.observedZero")}</span>
        </div>
        {stops.map((stop, i) => (
          <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={INDUSTRIAL_PARK_COMPARISON_COLORS[i]!} round={false} stroke={THEMED_PAINT_COLORS.industrialComparisonOutline[isDark ? "dark" : "light"]} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              ≥ {formatGridStop(stop, safeMode < 2, i18n)}
            </span>
          </div>
        ))}
      </div>
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {i18n.t("legend.agri.parkComparisonNote")}
      </LegendNote>
    </div>
  );
}

function formatGridStop(value: number, isCount: boolean, i18n: I18n): string {
  // 外文介面：家數只顯示數字（單位已在模式名稱裡），金額用 NT$ 加壓縮記法（1M／100万）
  if (i18n.active !== "zh-TW") return isCount ? i18n.formatNumber(value) : `NT$${i18n.formatNumber(value, { notation: "compact" })}`;
  if (isCount) return `${value.toLocaleString("zh-TW")} 家`;
  if (value >= 100_000_000) return `${value / 100_000_000} 億元`;
  if (value >= 10_000) return `${value / 10_000} 萬元`;
  return `${value.toLocaleString("zh-TW")} 元`;
}

export function CompanyCapitalGridLegend({ isDark = true, modeIdx, scaleIdx }: { isDark?: boolean; modeIdx: number; scaleIdx: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const safeMode = Math.min(Math.max(Math.round(modeIdx), 0), 2);
  const safeScale = Math.min(Math.max(Math.round(scaleIdx), 0), COMPANY_GRID_SCALES.length - 1);
  const mode = COMPANY_GRID_MODES[safeMode]!;
  const scale = COMPANY_GRID_SCALES[safeScale]!;
  const stops = companyGridStops(safeMode, safeScale);
  const colors = usePaletteRamp("companyCapitalGrid", t.isDark, 7);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.agri.gridTitle", { scale: scale.shortLabel, mode: enumLabel("legendAgriGridMode", mode.value, mode.label, i18n) })} en="Company Grid" style={{ marginBottom: 5 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {stops.map((stop, i) => (
          <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={colors[i]!} round={false} stroke={mapSeamColor(isDark)} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{stops[i + 1] === undefined || i >= stops.length - 1
              ? i18n.t("legend.agri.rangeOpen", { n: formatGridStop(stop, safeMode === 1, i18n) })
              : i18n.t("legend.agri.rangeLt", { lo: formatGridStop(stop, safeMode === 1, i18n), hi: formatGridStop(stops[i + 1]!, safeMode === 1, i18n) })}</span>
          </div>
        ))}
        {safeMode === 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={COMPANY_GRID_NULL_COLOR} round={false} stroke={mapSeamColor(isDark)} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.missingValue")}</span>
          </div>
        )}
      </div>
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {i18n.t("legend.agri.gridNote", { scale: scale.label })}
      </LegendNote>
    </div>
  );
}

export function CompanyIndustryDistributionLegend({ mask, midIdx, modeIdx }: { mask: number; midIdx: number; modeIdx: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const groupLabel = (group: { value: string; label: string }) => enumLabel("legendAgriIndustryGroup", group.value, group.label, i18n);
  const midCode = midIdx > 0 ? COMPANY_INDUSTRY_MID_OPTIONS[midIdx - 1]?.value : undefined;
  const midGroup = midCode === undefined ? undefined : COMPANY_INDUSTRY_GROUPS.find((group) => (group.codes as readonly string[]).includes(midCode));
  const selected = COMPANY_INDUSTRY_GROUPS.filter((_, index) => (mask & (1 << index)) !== 0);
  const densityColors = usePaletteRamp("companyIndustryDistribution", t.isDark, 7);
  if (modeIdx === 1) return <div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.indTotalDensity")}</div>
    {COMPANY_DENSITY_STOPS.map((stop, index) => <div key={stop} style={{ display: "flex", gap: 5, fontSize: FONT_SIZE.xs }}>
      <Swatch color={densityColors[index]!} round={false} /><span>≥ {i18n.formatNumber(stop)}</span>
    </div>)}
    <div style={{ display: "flex", gap: 5, fontSize: FONT_SIZE.xs }}><Swatch color={COMPANY_GRID_NULL_COLOR} round={false} />{i18n.t("legend.agri.indRequiredMissing")}</div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{midIdx > 0 ? i18n.t("legend.agri.indTotalNoteFocus") : mask === 0 ? i18n.t("legend.agri.indTotalNoteNone") : i18n.t("legend.agri.indTotalNote")}</div>
  </div>;

  return <div>
    <LegendTitle zh={layerTitle("companyIndustryDistribution", i18n)} en="Company Industry" style={{ marginBottom: 5 }} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
      {midGroup ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={midGroup.color} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.indFocusLabel", { label: groupLabel(midGroup) })}</span>
      </div> : selected.map((group) => <div key={group.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={group.color} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{groupLabel(group)}</span>
      </div>)}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_INDUSTRY_TIE_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.indTie")}</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_INDUSTRY_MISSING_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.indRequiredMissing")}</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_INDUSTRY_ZERO_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.indZero")}</span></div>
    </div>
    <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>{midIdx > 0 ? i18n.t("legend.agri.indNoteFocus") : mask === 0 ? i18n.t("legend.agri.indNoteNone") : i18n.t("legend.agri.indNoteMain")}</LegendNote>
  </div>;
}

/** 公司年齡色階一格：中位數是年，近 5 年占比是 %（stop 為 0–1 小數） */
function ageStopText(stop: number, next: number | undefined, median: boolean, i18n: I18n): string {
  const fmt = (v: number) => (median ? `${v}` : (v * 100).toFixed(0));
  if (next === undefined) return i18n.t(median ? "legend.agri.ageOpenYears" : "legend.agri.ageOpenPct", { lo: fmt(stop) });
  return i18n.t(median ? "legend.agri.ageLtYears" : "legend.agri.ageLtPct", { lo: fmt(stop), hi: fmt(next) });
}

export function CompanyAgeStructureLegend({ modeIdx }: { modeIdx: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const median = modeIdx === 1;
  const stops = median ? COMPANY_AGE_MEDIAN_STOPS : COMPANY_AGE_RECENT_STOPS;
  const colors = usePaletteRamp("companyAgeStructure", t.isDark, 7);
  const paletteLabel = usePaletteLabel("companyAgeStructure");
  return <div>
    <LegendTitle zh={i18n.t("legend.agri.ageTitle", { metric: median ? i18n.t("legend.agri.ageMetricMedian") : i18n.t("legend.agri.ageMetricRecent") })} style={{ marginBottom: 5 }} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 5 }}>{median ? i18n.t("legend.agri.ageHintMedian", { palette: paletteLabel }) : i18n.t("legend.agri.ageHintRecent", { palette: paletteLabel })}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
      {stops.map((stop, index) => <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={colors[index]!} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{ageStopText(stop, stops[index + 1], median, i18n)}</span>
      </div>)}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_GRID_NULL_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.ageMissing")}</span></div>
    </div>
    <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>{median ? i18n.t("legend.agri.ageNoteMedian") : i18n.t("legend.agri.ageNoteRecent")}</LegendNote>
  </div>;
}

export function CommonRegistrationAddressesLegend({ minCompanies }: { minCompanies: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("commonRegistrationAddresses", i18n)} en="Shared Registration" style={{ marginBottom: 5 }} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.agri.commonCapitalMedian")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {COMMON_REGISTRATION_CAPITAL_BANDS.map((band) => (
          <div key={band.min} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchDot color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendAgriCapBand", band.min, band.label, i18n)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 7, marginBottom: 3 }}>
        {i18n.t("legend.agri.commonSize")}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, minHeight: 24 }}>
        {COMMON_REGISTRATION_LEGEND_COUNTS.map((count) => {
          const diameter = commonRegistrationLegendDiameter(count);
          return (
            <div key={count} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: diameter, height: diameter, borderRadius: RADIUS.full,
                background: COMMON_REGISTRATION_BASE_COLOR,
                border: "1px solid rgba(255,255,255,0.7)", flexShrink: 0,
              }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.agri.companyCount", { count })}</span>
            </div>
          );
        })}
      </div>
      <DenseHeatmapLegendRow layers={["commonRegistrationAddresses"]} />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {i18n.t("legend.agri.commonNote", { n: i18n.formatNumber(Math.round(minCompanies)) })}
      </LegendNote>
    </div>
  );
}

export function AgriCompanyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows = AGRI_COMPANY_TYPES.filter((it) => visibility[it.key]);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.agri.agriCompanyTitle")} en="Agri Business" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {enumLabel("agriCompanyType", it.id, it.labelZh, i18n)}
              {i18n.active === "zh-TW" && <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>}
            </span>
          </div>
        ))}
      </div>
      {(visibility.agriRetail || visibility.agriProduceWholesale) && <DenseHeatmapLegendRow layers={["agriRetail", "agriProduceWholesale"]} />}
    </div>
  );
}

// ── Crop Suitability Legend (作物適栽 4 級 kind) ──

export function CropSuitabilityLegend({ cropId }: { cropId: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const crop = CROP_SUITABILITY_CROPS.find((c) => c.id === cropId);
  // 英文介面只顯示資料自帶的英文名；中文、日文維持「中文名 (英文名)」
  const cropLabel = crop ? (i18n.active === "en" ? crop.nameEn : `${crop.nameZh} (${crop.nameEn})`) : `#${cropId}`;
  return (
    <div>
      <LegendTitle zh={layerTitle("agriCropSuitability", i18n)} en="Crop Suitability" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {cropLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CROP_KIND_ITEMS.map((s) => (
          <div key={s.kind} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={s.color} opacity={0.85} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendAgriCropKind", s.kind, s.label, i18n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
