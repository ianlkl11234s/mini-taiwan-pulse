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

// ── 作物適栽 4 級 kind ──（與 agricultureLayerFactory.ts CROP_KIND_COLOR_EXPR 對齊）
const CROP_KIND_ITEMS = [
  { kind: 1, color: "#1b5e20", label: "最適 Premium" },
  { kind: 2, color: "#66bb6a", label: "適栽 Suitable" },
  { kind: 3, color: "#fff59d", label: "次適 Marginal" },
  { kind: 4, color: "#ef9a9a", label: "不適 Unsuitable" },
];

export function LivestockFarmLegend() {
  return (
    <div>
      <LegendTitle zh="畜禽飼養場 主畜種" />
      <FireCatRows cats={FARM_SPECIES.filter((s) => s.key !== "其他").map((s) => ({ ...s, color: `linear-gradient(90deg,${FARM_COLOR_RAMP[s.key]!.join(",")})` }))} />
      <LegendNote style={{ marginTop: 4, marginBottom: 2 }}>
        其他（各物種）
      </LegendNote>
      <FireCatRows cats={OTHER_SPECIES_LEGEND.map((s) => ({ ...s, color: `linear-gradient(90deg,${OTHER_SPECIES_COLOR_RAMP[s.key]!.join(",")})` }))} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        大小＋深淺 = 總隻數（越多越大越深；各畜種層內相對，跨畜種不可比）
      </LegendNote>
    </div>
  );
}

export function LivestockFacilityLegend() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <LegendTitle zh="屠宰場" en="Slaughter" />
        <FireCatRows cats={SLAUGHTER_CATS} />
      </div>
      <FireCatRows
        cats={[
          { color: FEED_COLOR, label: "飼料廠 Feed Factory" },
          { color: MARKET_COLOR, label: "拍賣/批發市場 Market" },
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

const HIKING_TRAIL_SOURCES: { color: string; label: string }[] = [
  { color: HIKING_TRAIL_PAINT_COLORS.A_forest, label: "A 林業署國家步道" },
  { color: HIKING_TRAIL_PAINT_COLORS.B_osm, label: "B OpenStreetMap" },
  { color: HIKING_TRAIL_PAINT_COLORS.C_np_sheipa, label: "C 雪霸國家公園 SHP" },
  { color: HIKING_TRAIL_PAINT_COLORS.C_np_kinmen, label: "C 金門國家公園 KML" },
  { color: HIKING_TRAIL_PAINT_COLORS.D_taipei_grand, label: "D 臺北大縱走" },
  { color: HIKING_TRAIL_PAINT_COLORS.D_newtaipei, label: "D 新北市觀光局" },
];

function HikingTrailsSourcesLegend() {
  const t = useLegendTheme();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>步道來源 source</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {HIKING_TRAIL_SOURCES.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchLine color={it.color} width={2} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 山屋 facility_type 4 類子圖例 + ODbL 標示（OSM 126 / 官方玉山 30 trust chain 合併）
function MountainHutTypesLegend() {
  const t = useLegendTheme();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>設施類型 facility_type</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {MOUNTAIN_HUT_TYPES.map((it) => (
          <div key={it.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchDot color={it.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        含 OSM 來源 © OpenStreetMap contributors（ODbL）
      </LegendNote>
    </div>
  );
}

function ForestReserveTypesLegend() {
  const t = useLegendTheme();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>保安林種類</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {FOREST_RESERVE_TYPES.map((it) => (
          <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchSquare color={it.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ForestryLegend({ isDark = true, visibility }: { isDark?: boolean; visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows = FORESTRY_LEGEND_ROWS.filter((r) => visibility[r.key]);
  if (rows.length === 0) return null;
  return (
    <div>
      <LegendTitle zh="林業" en="Forestry" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {r.shape === "line" ? <SwatchLine color={r.color} /> : r.shape === "circle" ? <SwatchDot color={r.color} /> : <SwatchSquare color={r.color} stroke={r.key === "forestCompartments" ? THEMED_PAINT_COLORS.forestCompartmentsOutline[isDark ? "dark" : "light"] : r.key === "forestRecreation" ? THEMED_PAINT_COLORS.forestRecreationOutline[isDark ? "dark" : "light"] : r.key === "forestReserve" ? THEMED_PAINT_COLORS.forestReserveOutline[isDark ? "dark" : "light"] : undefined} />}
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
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
  const metricId = (SOIL_FERTILITY_METRIC_OPTIONS[metricIdx]?.value ?? "health") as SoilFertilityMetric;
  const meta = SOIL_FERTILITY_METRICS[metricId];
  return (
    <div>
      <LegendTitle zh="土壤肥力" en="Soil Fertility" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {meta.label}{meta.unit ? ` (${meta.unit})` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {meta.legendStops.map((s) => (
          <div key={`${s.color}-${s.label}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={s.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agriculture POI Legend (休農場 / 田媽媽 / 特色農旅) ──

export function AgriPOILegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="休農場／田媽媽／特色農旅" en="Agriculture POI" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {AGRI_POI_TYPES.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {it.labelZh}
              <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyPointsLegend({ manufacturing, overlayParams }: { manufacturing: boolean; overlayParams?: Record<string, number> }) {
  const t = useLegendTheme();
  const filtersActive = !manufacturing && companyPointFiltersActive(overlayParams);
  const gridColors = usePaletteRamp("companyPoints", t.isDark, 7);
  const gridPaletteName = usePaletteLabel("companyPoints");
  return (
    <div>
      <LegendTitle zh={manufacturing ? "製造業公司登記" : "公司登記分布"} en={manufacturing ? "Manufacturing" : "Company Registry"} style={{ marginBottom: 5 }} />
      {!manufacturing && !filtersActive && <>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>概覽：公司密度（家／km²）· {gridPaletteName}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", marginBottom: 6 }}>
          {COMPANY_DENSITY_STOPS.map((stop, i) => (
            <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Swatch color={gridColors[i]!} round={false} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{stop.toLocaleString("zh-TW")}{i < COMPANY_DENSITY_STOPS.length - 1 ? `–<${COMPANY_DENSITY_STOPS[i + 1]!.toLocaleString("zh-TW")}` : " 以上"}</span>
            </div>
          ))}
        </div>
      </>}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>個別公司：資本額分位</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {COMPANY_CAPITAL_Q_BANDS.map((band) => (
          <div key={band.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={band.color} round />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
      </div>
      {manufacturing && <DenseHeatmapLegendRow layers={["manufacturingCompanyPoints"]} />}
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {manufacturing
          ? "202608 登記快照；全台尺度起顯示完整有座標點位，未抽稀、未 cluster。184,944 筆有座標；點位是公司登記地址，不是工廠實際營運地址。"
          : filtersActive
            ? "已設定篩選條件；未篩選概覽格已隱藏，請放大至 z12 查看篩選後的個別公司。"
            : "202608 登記快照；z4–9 為 1.5km、z10–11 為 450m 網格密度，z12+ 顯示可點擊個別公司。"}
      </LegendNote>
    </div>
  );
}

export function FactoryLocationsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="生產中工廠登記" en="Factory Locations" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color={FACTORY_LOCATION_COLOR} round />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>有可發布座標的工廠登記點位</span>
      </div>
      <DenseHeatmapLegendRow layers={["factoryLocations"]} />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        202606 快照；全台尺度起顯示完整有座標點位，未抽稀、未 cluster。90,652 / 100,624 筆可定位。
      </LegendNote>
    </div>
  );
}

export function RegulatedFacilitiesLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="列管設施" en="Regulated Facilities" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color={REGULATED_FACILITY_COLOR} round />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>環境部 active 列管設施</span>
      </div>
      <DenseHeatmapLegendRow layers={["regulatedFacilities"]} />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        20260818 快照；全台尺度起顯示完整有座標點位，未抽稀、未 cluster。80,732 / 127,795 筆有座標；列管身分不等於事件、裁罰或風險等級。
      </LegendNote>
    </div>
  );
}

export function IndustrialDensityGridLegend({ layer, title, titleEn, unit, note }: { layer: string; title: string; titleEn?: string; unit: string; note: string }) {
  const t = useLegendTheme();
  const colors = usePaletteRamp(layer, t.isDark, 7);
  const paletteName = usePaletteLabel(layer);
  return <div>
    <LegendTitle zh={title} en={titleEn} style={{ marginBottom: 5 }} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>密度（{unit}／km²）· {paletteName}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
      {COMPANY_DENSITY_STOPS.map((stop, i) => <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={colors[i]!} round={false} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{stop.toLocaleString("zh-TW")}{i < COMPANY_DENSITY_STOPS.length - 1 ? `–<${COMPANY_DENSITY_STOPS[i + 1]!.toLocaleString("zh-TW")}` : " 以上"}</span>
      </div>)}
    </div>
    <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
      {note} z4–&lt;10 使用 1,500m、z10+ 使用 450m 網格，隨縮放自動切換。
    </LegendNote>
  </div>;
}

export function IndustrialParkBoundariesLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="產業園區邊界" en="Industrial Parks" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Swatch color={INDUSTRIAL_PARK_COLOR} round={false} stroke={THEMED_PAINT_COLORS.industrialParkOutline[isDark ? "dark" : "light"]} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>215 個產業園區 polygon</span>
      </div>
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        v1 明確不含科學園區；A3 會員名冊不具 geometry，不混入或推測園區邊界。
      </LegendNote>
    </div>
  );
}

export function IndustrialParkComparisonLegend({ isDark = true, modeIdx }: { isDark?: boolean; modeIdx: number }) {
  const t = useLegendTheme();
  const safeMode = Math.min(Math.max(Math.round(modeIdx), 0), 2);
  const mode = INDUSTRIAL_PARK_COMPARISON_MODES[safeMode]!;
  const stops = INDUSTRIAL_PARK_COMPARISON_STOPS[safeMode]!;
  return (
    <div>
      <LegendTitle zh={`園區商工比較 · ${mode.label}`} style={{ marginBottom: 5 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Swatch color={INDUSTRIAL_PARK_COMPARISON_ZERO_COLOR} round={false} stroke={THEMED_PAINT_COLORS.industrialComparisonOutline[isDark ? "dark" : "light"]} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>觀測值 0</span>
        </div>
        {stops.map((stop, i) => (
          <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={INDUSTRIAL_PARK_COMPARISON_COLORS[i]!} round={false} stroke={THEMED_PAINT_COLORS.industrialComparisonOutline[isDark ? "dark" : "light"]} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              ≥ {formatGridStop(stop, safeMode < 2)}
            </span>
          </div>
        ))}
      </div>
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        僅計入具有效座標並被指派至園區 polygon 的觀測實體；A1 為 90,652 / 100,624，製造業公司為 184,944 / 186,054。
        0 不代表實際不存在。科學園區 membership 不混入本比較。
      </LegendNote>
    </div>
  );
}

function formatGridStop(value: number, isCount: boolean): string {
  if (isCount) return `${value.toLocaleString("zh-TW")} 家`;
  if (value >= 100_000_000) return `${value / 100_000_000} 億元`;
  if (value >= 10_000) return `${value / 10_000} 萬元`;
  return `${value.toLocaleString("zh-TW")} 元`;
}

export function CompanyCapitalGridLegend({ isDark = true, modeIdx, scaleIdx }: { isDark?: boolean; modeIdx: number; scaleIdx: number }) {
  const t = useLegendTheme();
  const safeMode = Math.min(Math.max(Math.round(modeIdx), 0), 2);
  const safeScale = Math.min(Math.max(Math.round(scaleIdx), 0), COMPANY_GRID_SCALES.length - 1);
  const mode = COMPANY_GRID_MODES[safeMode]!;
  const scale = COMPANY_GRID_SCALES[safeScale]!;
  const stops = companyGridStops(safeMode, safeScale);
  const colors = usePaletteRamp("companyCapitalGrid", t.isDark, 7);
  return (
    <div>
      <LegendTitle zh={`公司網格 · ${scale.shortLabel} · ${mode.label}`} en="Company Grid" style={{ marginBottom: 5 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {stops.map((stop, i) => (
          <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={colors[i]!} round={false} stroke={mapSeamColor(isDark)} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{formatGridStop(stop, safeMode === 1)}{i < stops.length - 1 ? `–<${formatGridStop(stops[i + 1]!, safeMode === 1)}` : " 以上"}</span>
          </div>
        ))}
        {safeMode === 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={COMPANY_GRID_NULL_COLOR} round={false} stroke={mapSeamColor(isDark)} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>缺值</span>
          </div>
        )}
      </div>
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        {scale.label} 非空網格，202608 登記快照；色階由低階至高階＝數值由低至高；採各尺度固定非線性級距。
      </LegendNote>
    </div>
  );
}

export function CompanyIndustryDistributionLegend({ mask, midIdx, modeIdx }: { mask: number; midIdx: number; modeIdx: number }) {
  const t = useLegendTheme();
  const midCode = midIdx > 0 ? COMPANY_INDUSTRY_MID_OPTIONS[midIdx - 1]?.value : undefined;
  const midGroup = midCode === undefined ? undefined : COMPANY_INDUSTRY_GROUPS.find((group) => (group.codes as readonly string[]).includes(midCode));
  const selected = COMPANY_INDUSTRY_GROUPS.filter((_, index) => (mask & (1 << index)) !== 0);
  const densityColors = usePaletteRamp("companyIndustryDistribution", t.isDark, 7);
  if (modeIdx === 1) return <div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>登記產業合計密度（家／km²）</div>
    {COMPANY_DENSITY_STOPS.map((stop, index) => <div key={stop} style={{ display: "flex", gap: 5, fontSize: FONT_SIZE.xs }}>
      <Swatch color={densityColors[index]!} round={false} /><span>≥ {stop.toLocaleString("zh-TW")}</span>
    </div>)}
    <div style={{ display: "flex", gap: 5, fontSize: FONT_SIZE.xs }}><Swatch color={COMPANY_GRID_NULL_COLOR} round={false} />必要欄位缺失</div>
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>202608；所選產業合計，每家公司計一次。{midIdx > 0 ? "聚焦中類優先於群組。" : mask === 0 ? "未選分類，圖層已隱藏。" : ""}</div>
  </div>;

  return <div>
    <LegendTitle zh="登記產業分布" en="Company Industry" style={{ marginBottom: 5 }} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
      {midGroup ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={midGroup.color} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{midGroup.label}（聚焦中類）</span>
      </div> : selected.map((group) => <div key={group.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={group.color} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{group.label}</span>
      </div>)}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_INDUSTRY_TIE_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>最多筆數同量</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_INDUSTRY_MISSING_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>必要欄位缺失</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_INDUSTRY_ZERO_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>選取群組皆為 0（透明）</span></div>
    </div>
    <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>{midIdx > 0 ? "已聚焦單一行業中類，固定使用其所屬群組色；優先於群組多選。" : mask === 0 ? "未選分類，圖層已隱藏。" : "顏色＝所選群組中家數最多者，最多不一定過半；並列另標示。202608 登記快照，非實際主營產業。"}</LegendNote>
  </div>;
}

export function CompanyAgeStructureLegend({ modeIdx }: { modeIdx: number }) {
  const t = useLegendTheme();
  const median = modeIdx === 1;
  const stops = median ? COMPANY_AGE_MEDIAN_STOPS : COMPANY_AGE_RECENT_STOPS;
  const colors = usePaletteRamp("companyAgeStructure", t.isDark, 7);
  const paletteName = usePaletteLabel("companyAgeStructure");
  return <div>
    <LegendTitle zh={`公司年齡結構 · ${median ? "年齡中位數（年）" : "近 5 年設立占比（%）"}`} style={{ marginBottom: 5 }} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 5 }}>{paletteName} · 越往高階＝{median ? "年齡越高" : "近期設立占比越高"}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
      {stops.map((stop, index) => <div key={stop} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Swatch color={colors[index]!} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{median ? `${stop}` : `${(stop * 100).toFixed(0)}`}{index < stops.length - 1 ? `–<${median ? stops[index + 1] : (stops[index + 1]! * 100).toFixed(0)}` : " 以上"}{median ? " 年" : "%"}</span>
      </div>)}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Swatch color={COMPANY_GRID_NULL_COLOR} round={false} /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>缺值／無已知設立年</span></div>
    </div>
    <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>{median ? "202608 snapshot；設立年齡中位數約為 2026 減設立年。" : "202608 snapshot；近 5 年（2022–2026）設立占比，分母只含已知合法設立年。已知設立年少於 20 家時，占比容易極端。"}</LegendNote>
  </div>;
}

export function CommonRegistrationAddressesLegend({ minCompanies }: { minCompanies: number }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="共同登記地址" en="Shared Registration" style={{ marginBottom: 5 }} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        顏色＝資本額中位數
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px" }}>
        {COMMON_REGISTRATION_CAPITAL_BANDS.map((band) => (
          <div key={band.min} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchDot color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 7, marginBottom: 3 }}>
        大小＝共同登記公司數
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
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{count} 家</span>
            </div>
          );
        })}
      </div>
      <DenseHeatmapLegendRow layers={["commonRegistrationAddresses"]} />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 6 }}>
        目前顯示共同登記 ≥ {Math.round(minCompanies).toLocaleString("zh-TW")} 家的門牌；點擊可查資本額總和與中位數。
      </LegendNote>
    </div>
  );
}

export function AgriCompanyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows = AGRI_COMPANY_TYPES.filter((it) => visibility[it.key]);
  return (
    <div>
      <LegendTitle zh="農企業登記" en="Agri Business" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {it.labelZh}
              <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>
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
  const crop = CROP_SUITABILITY_CROPS.find((c) => c.id === cropId);
  const cropLabel = crop ? `${crop.nameZh} (${crop.nameEn})` : `#${cropId}`;
  return (
    <div>
      <LegendTitle zh="作物適栽" en="Crop Suitability" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {cropLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CROP_KIND_ITEMS.map((s) => (
          <div key={s.kind} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={s.color} opacity={0.85} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
