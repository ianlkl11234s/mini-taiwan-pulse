// Legend sub-components (waterLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { JP_WATER_FACILITY_CATEGORIES, JP_WATER_LAYER_CONTRACT } from "../../data/jpWaterTypes";
import { RESERVOIR_ALERT_LEGEND, RESERVOIR_CAPACITY_LEGEND_WAN, RESERVOIR_WATER_COLOR, reservoirAlertCss, reservoirCapacityRadius } from "../../map/r6FlatEncodings";
import { DRINKING_WATER_ZONE_TYPES, ENVIRONMENT_LAYER_COLORS, RIVER_RPI_CLASSES, RIVER_RPI_NO_DATA_COLOR, WATER_QUALITY_STATION_TYPES } from "../../data/environmentLayerTypes";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";
import type { MessageKey } from "../../i18n/keys";
import { ClimateGradientBar, DenseHeatmapLegendRow, FireCatRows, NoiseLegendNote, NoiseLegendRows, NoiseLegendTitle } from "./legendShared";

type I18n = ReturnType<typeof useLocale>;

/** 標題與圖層名相同時，借 manifest 名稱在目前語系的顯示名 */
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

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
  { color: "#a855f7", code: "cumulativeflow", label: "累計流量 Cumulative Flow", measure: "m³", measureKey: null },
  { color: "#f97316", code: "watergate", label: "閘門 Watergate", measure: "開度 % / 水位 m", measureKey: "legend.water.measureGate" },
  { color: "#dc2626", code: "damstructure", label: "堤防安全 Dam Structure", measure: "角度 / 應力", measureKey: "legend.water.measureLevee" },
  { color: "#eab308", code: "erosiondepth", label: "河床沖刷 Erosion", measure: "深度 m", measureKey: "legend.water.measureScour" },
  { color: "#92400e", code: "dustemission", label: "揚塵 Dust", measure: "PM10 / 風速 / 溫濕度", measureKey: "legend.water.measureDust" },
] as const;

export function JpWaterLegend({ layerKey }: { layerKey: keyof typeof JP_WATER_LAYER_CONTRACT }) {
  const contract = JP_WATER_LAYER_CONTRACT[layerKey];
  const t = useLegendTheme();
  const i18n = useLocale();
  const colors: Record<keyof typeof JP_WATER_LAYER_CONTRACT, string> = {
    jpWaterDams: "#0369a1", jpWaterLakes: "#0ea5e9", jpWaterSupplyFacilities: "#06b6d4", jpWaterSupplyAreas: "#7dd3fc", jpWaterSewerFacilities: "#1d4ed8", jpWaterRivers: "#0284c7", jpWaterGroundwaterSites: "#8b5cf6", jpWaterNilimDams: "#2563eb", jpWaterAgriculturalPonds: "#65a30d", jpWaterFloodHazard: "#64748b", jpWaterLocalPipes: "#075985", jpWaterLocalFacilities: "#0284c7", jpWaterQualityStations: "#7c3aed", jpWaterLevelStations: "#0369a1",
  };
  const facilityGroup = layerKey === "jpWaterSupplyFacilities" ? "supply" : layerKey === "jpWaterSewerFacilities" ? "sewer" : null;
  const rows = facilityGroup
    ? JP_WATER_FACILITY_CATEGORIES.filter((category) => category.group === facilityGroup).map((category) => ({ color: category.color, label: enumLabel("jpWaterCategory", category.value, category.label, i18n) }))
    : [{ color: colors[layerKey], label: `${contract.geometryRole} · ${contract.sourceYear}` }];
  return <div><LegendTitle zh={contract.sourceLabel} />
    <FireCatRows cats={rows} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t(contract.historical ? "legend.water.jpHistorical" : "legend.water.jpMetadata")}</div>
    {facilityGroup && <LegendNote style={{ marginTop: 4 }}>{i18n.t(facilityGroup === "supply" ? "legend.water.jpSupplyNote" : "legend.water.jpSewerNote")}</LegendNote>}
    {["jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds"].includes(layerKey) && <LegendNote style={{ marginTop: 4 }}>{i18n.t(layerKey === "jpWaterGroundwaterSites" ? "legend.water.jpGroundwaterNote" : layerKey === "jpWaterNilimDams" ? "legend.water.jpNilimNote" : "legend.water.jpPondsNote")}</LegendNote>}
    {layerKey === "jpWaterAgriculturalPonds" && <DenseHeatmapLegendRow layers={["jpWaterAgriculturalPonds"]} />}
  </div>;
}

export function JpWaterFloodHazardLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div><LegendTitle zh={i18n.t("legend.water.jpFloodTitle")} />
    <img src="https://disaportaldata.gsi.go.jp/hazardmap/copyright/img/shinsui_legend3.png" alt={i18n.t("legend.water.jpFloodAlt")} style={{ display: "block", maxWidth: "100%", height: "auto", marginBottom: 5 }} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.water.jpFloodNote")}</div>
  </div>;
}

// ── IoT River Legend (delta 紅↔藍) ──

export function IotRiverLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.water.iotRiverTitle")} />
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          {i18n.t("legend.water.dailyLevelChange")}
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${IOT_RIVER_DELTA_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.water.falling")}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.water.steady")}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{i18n.t("legend.water.rising")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>-1m</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>0</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>+1m</span>
        </div>
      </div>
      <LegendNote style={{ lineHeight: 1.4 }}>
        {i18n.t("legend.water.iotCircleChange")}
      </LegendNote>
    </div>
  );
}

// ── IoT Structure Legend (5 類別 + 主要測項) ──

// ── 灌排渠道 3 色圖例 ──

const WATER_CANAL_ITEMS = [
  { color: THEMED_PAINT_COLORS.canalIrrigation, label: "灌溉專用渠道 Irrigation", code: "灌溉專用渠道" },
  { color: THEMED_PAINT_COLORS.canalDownstream, label: "下游具引灌需求 Demand", code: "下游具引灌需求" },
  { color: THEMED_PAINT_COLORS.canalOther, label: "不具引灌需求/宜蘭 Other", code: null },
];

export function WaterCanalLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("waterCanals", i18n)} en="Canal" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {WATER_CANAL_ITEMS.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine width={3} color={c.color[isDark ? "dark" : "light"]} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.code ? enumLabel("canalAttr", c.code, c.label, i18n) : i18n.t("legend.water.canalOther")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LAKES_PONDS_CATS = [
  { color: "#4fc3f7", code: "pond", label: "埤塘 Pond" },
  { color: "#1e88e5", code: "lake", label: "湖泊 Lake" },
  { color: "#00acc1", code: "reservoir", label: "水塘 Reservoir (OSM 自標)" },
  { color: "#7e57c2", code: "basin", label: "水池 Basin" },
];

export function LakesPondsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("lakesPondsOsm", i18n)} en="Lakes & Ponds" />
      <FireCatRows cats={LAKES_PONDS_CATS.map((c) => ({ color: c.color, label: enumLabel("lakesPondsType", c.code, c.label, i18n) }))} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.lakesNote")}
      </LegendNote>
    </div>
  );
}

/**
 * interpolate 的 stop 清單 → CSS linear-gradient。
 * 把 domain（第一個 ~ 最後一個 stop 值）線性映射到 0~100%，色帶上任一點的顏色
 * 因此與 Mapbox interpolate 在同一個值算出來的顏色一致（等距 stop 會失真，故不用等分）。
 */
function deltaStopsToGradient(stops: { v: number; color: string }[]): string {
  const min = stops[0]!.v;
  const max = stops[stops.length - 1]!.v;
  const span = max - min || 1;
  return `linear-gradient(to right, ${stops
    .map((s) => `${s.color} ${(((s.v - min) / span) * 100).toFixed(1)}%`)
    .join(", ")})`;
}

// ── 河川水位：delta_m 色階（useRiverLevelLayer.ts colorExpression 的 interpolate stops）──
// 紅＝下降 / 灰＝持平 / 藍＝上升；check_result=0 由外層 case 覆寫成橙。
const RIVER_LEVEL_DELTA_STOPS = [
  { v: -1.00, color: "#b91c1c" },
  { v: -0.30, color: "#ef4444" },
  { v: -0.10, color: "#fca5a5" },
  { v: -0.02, color: "#94a3b8" },
  { v: 0.02, color: "#94a3b8" },
  { v: 0.10, color: "#93c5fd" },
  { v: 0.30, color: "#3b82f6" },
  { v: 1.00, color: "#1d4ed8" },
];

const RIVER_LEVEL_ABNORMAL_COLOR = "#f97316";

export function RiverLevelLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("riverLevel", i18n)} en="River Level" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {i18n.t("legend.water.deltaSub")}
      </div>
      <ClimateGradientBar
        gradient={deltaStopsToGradient(RIVER_LEVEL_DELTA_STOPS)}
        labels={[i18n.t("legend.water.deltaFall", { value: "-1m" }), "0", i18n.t("legend.water.deltaRise", { value: "+1m" })]}
      />
      <div style={{ marginTop: 4 }}>
        <FireCatRows cats={[{ color: RIVER_LEVEL_ABNORMAL_COLOR, label: i18n.t("legend.water.abnormal") }]} />
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.riverCircle")}
      </LegendNote>
    </div>
  );
}

// ── 北市雨水下水道：ground_far step 分級（useTaipeiSewerLayer.ts depthColorExpression）──
// ground_far = 水面距地面的深度（m），越小越接近溢出，所以色序是「小＝紅、大＝藍」。
const TAIPEI_SEWER_CATS: { color: string; label: string; key?: MessageKey }[] = [
  { color: "#7f1d1d", label: "< 0.5 m 逼近地面", key: "legend.water.sewerNear" },
  { color: "#ef4444", label: "0.5–1 m" },
  { color: "#fb923c", label: "1–2 m" },
  { color: "#fde047", label: "2–3 m" },
  { color: "#3b82f6", label: "≥ 3 m 安全", key: "legend.water.sewerSafe" },
];

export function TaipeiSewerLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("taipeiSewer", i18n)} en="Sewer" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.water.sewerSub")}
      </div>
      <FireCatRows cats={TAIPEI_SEWER_CATS.map((c) => ({ color: c.color, label: c.key ? i18n.t(c.key) : c.label }))} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.sewerNote")}
      </LegendNote>
    </div>
  );
}

// ── 北市抽水站：risk_ratio step 分級（useTaipeiPumbLayer.ts riskColorExpression）──
// risk_ratio = 內池水位 / 最高容許水位；運轉中站點有 2px 外框（pumb_running=true；暗底圖白、淡底圖深灰），其餘為底圖色細縫。
const TAIPEI_PUMB_CATS: { color: string; label: string; key?: MessageKey }[] = [
  { color: "#7f1d1d", label: "≥ 0.9 逼近上限", key: "legend.water.pumbNear" },
  { color: "#ef4444", label: "0.8–0.9" },
  { color: "#fb923c", label: "0.6–0.8" },
  { color: "#fde047", label: "0.4–0.6" },
  { color: "#06b6d4", label: "< 0.4 正常", key: "legend.water.pumbNormal" },
];

export function TaipeiPumbLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("taipeiPumb", i18n)} en="Pump Station" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.water.pumbSub")}
      </div>
      <FireCatRows cats={TAIPEI_PUMB_CATS.map((c) => ({ color: c.color, label: c.key ? i18n.t(c.key) : c.label }))} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <SwatchDot color="transparent" stroke={t.isDark ? "#ffffff" : "#111827"} strokeWidth={2} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.water.pumbRunning")}</span>
      </div>
    </div>
  );
}

// ── 北市疏散門：gate_state match（useTaipeiEvacuateLayer.ts stateColorExpression）──
// gate_state 由 fo/fc/flt 三個旗標推導，見該檔頂註解。
const TAIPEI_EVACUATE_CATS: { color: string; label: string; key: MessageKey }[] = [
  { color: "#22c55e", label: "全開 Open", key: "legend.water.evacOpen" },
  { color: "#ef4444", label: "關閉 Closed（防護啟動）", key: "legend.water.evacClosed" },
  { color: "#fbbf24", label: "故障 Faulted", key: "legend.water.evacFaulted" },
  { color: "#6b7280", label: "狀態不明 Unknown", key: "legend.water.evacUnknown" },
];

export function TaipeiEvacuateLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("taipeiEvacuate", i18n)} en="Evacuation Gate" />
      <FireCatRows cats={TAIPEI_EVACUATE_CATS.map((c) => ({ color: c.color, label: i18n.t(c.key) }))} />
    </div>
  );
}

// ── 即時雨量：precipitation_1hr step 分級（useRainGaugeLayer.ts rainColorExpression）──
// 級距數字逐字取自 step 的 stop；中文級名沿用同檔 heatmapColorExpression 註解裡
// 對同一組色碼的稱呼（小雨/中雨/大雨/豪雨/大豪雨/超大豪雨），遠景熱區與近景圓點同色系。
// coalesce(…, 0)：缺值會落進最低級 → 灰色列註明「無雨 / 無資料」。
const RAIN_GAUGE_CATS: { color: string; label: string; key: MessageKey }[] = [
  { color: "#6b7280", label: "< 0.1 mm 無雨 / 無資料", key: "legend.water.rainNone" },
  { color: "#93c5fd", label: "0.1–2.5 mm 小雨", key: "legend.water.rainLight" },
  { color: "#3b82f6", label: "2.5–15 mm 中雨", key: "legend.water.rainModerate" },
  { color: "#22c55e", label: "15–40 mm 大雨", key: "legend.water.rainHeavy" },
  { color: "#fbbf24", label: "40–80 mm 豪雨", key: "legend.water.rainExtreme" },
  { color: "#f97316", label: "80–200 mm 大豪雨", key: "legend.water.rainTorrential" },
  { color: "#ef4444", label: "≥ 200 mm 超大豪雨", key: "legend.water.rainExtraTorrential" },
];

export function RainGaugeLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("rainGauge", i18n)} en="Rain Gauge" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.water.rainSub")}
      </div>
      <FireCatRows cats={RAIN_GAUGE_CATS.map((c) => ({ color: c.color, label: i18n.t(c.key) }))} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.rainNote")}
      </LegendNote>
    </div>
  );
}

// ── 地下水井：delta_m 色階（useGroundwaterLayer.ts colorExpression 的 interpolate stops）──
// 值域比河川窄（覆蓋 p10~p90 的 ±30cm），色序同樣是 紅(-) → 灰(0) → 藍(+)。
const GROUNDWATER_DELTA_STOPS = [
  { v: -0.30, color: "#b91c1c" },
  { v: -0.10, color: "#ef4444" },
  { v: -0.02, color: "#fca5a5" },
  { v: 0.00, color: "#94a3b8" },
  { v: 0.02, color: "#93c5fd" },
  { v: 0.10, color: "#3b82f6" },
  { v: 0.30, color: "#1d4ed8" },
];

export function GroundwaterLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("groundwater", i18n)} en="Groundwater" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {i18n.t("legend.water.deltaSub")}
      </div>
      <ClimateGradientBar
        gradient={deltaStopsToGradient(GROUNDWATER_DELTA_STOPS)}
        labels={[i18n.t("legend.water.deltaFall", { value: "-30cm" }), "0", i18n.t("legend.water.deltaRise", { value: "+30cm" })]}
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.groundwaterCircle")}
      </LegendNote>
    </div>
  );
}

// ── 💧 水資源管制區 zone_kind 4 類（明暗雙主題）──
// 色票逐字取自 overlayRegistry.ts `waterProtectionZones` 的 **fill-color** match
// （outline 用的是更亮的一組，圖例以面色為準，因為使用者看到的主要是面）。
const WATER_PROTECTION_ZONE_CATS: { dark: string; light: string; label: string; code: string }[] = [
  { dark: "#10b981", light: "#047857", label: "飲用水水源保護區 Protection", code: "protection" },
  { dark: "#ef4444", light: "#b91c1c", label: "地下水禁止超抽 Ban", code: "groundwater_control_2" },
  { dark: "#f97316", light: "#c2410c", label: "地下水限制超抽 Restricted", code: "groundwater_control_1" },
  { dark: "#94a3b8", light: "#64748b", label: "地下水分區 Region", code: "groundwater_region" },
];

export function WaterProtectionZoneLegend({ isDark }: { isDark: boolean }) {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.water.zoneTitle")} en="Protection Zone" />
      <FireCatRows
        square
        cats={WATER_PROTECTION_ZONE_CATS.map((c) => ({
          color: isDark ? c.dark : c.light,
          label: enumLabel("waterProtectionZone", c.code, c.label, i18n),
        }))}
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.zoneNote")}
      </LegendNote>
    </div>
  );
}

// ── 💧 監測站 station_type（overlayRegistry `waterMonitorStations` 的 glow circle-color match）──
// paint 只分 3 種 + default 灰（core 圈是同色系亮版 #93c5fd / #67e8f9 / #f9a8d4，
// 圖例以外暈的飽和版為準，與 featureInfo/waterPanels.tsx 的 WATER_MONITOR_TYPE 同色）。
const WATER_MONITOR_STATION_CATS = [
  { color: "#60a5fa", label: "雨量站 Rain gauge", code: "rain_gauge" },
  { color: "#22d3ee", label: "河川水位站 River level", code: "river_level" },
  { color: "#f472b6", label: "地下水觀測井 Groundwater well", code: "groundwater_well" },
  { color: "#9ca3af", label: "其他 / 未分類 Other", code: null },
];

export function WaterMonitorStationLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("waterMonitorStations", i18n)} en="Monitor Station" />
      <FireCatRows cats={WATER_MONITOR_STATION_CATS.map((c) => ({ color: c.color, label: c.code ? enumLabel("waterMonitorType", c.code, c.label, i18n) : i18n.t("legend.water.otherUnclassifiedEn") }))} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.monitorNote")}
      </LegendNote>
    </div>
  );
}

// ── 💧 淹水潛勢 depth_class 5 級（overlayRegistry `waterFloodExtreme` 的 fill-color match）──
// classMin 與該處 CLASS_MIN 同表：paint 用 floodMinDepth 把低於門檻的級距 fill-opacity 打成 0，
// 圖例照同一條件過濾，才不會列出地圖上根本看不到的級距。
// （match 的 default #fca5a5 永遠不會顯示 —— opacity 的 ["in", depth_class, visible]
//   對未列舉的值一律 0，所以圖例不列 default。）
const WATER_FLOOD_DEPTH_CATS = [
  { classMin: 0.3, color: "#fee2e2", label: "0.3–0.5 m" },
  { classMin: 0.5, color: "#fca5a5", label: "0.5–1.0 m" },
  { classMin: 1.0, color: "#f87171", label: "1.0–2.0 m" },
  { classMin: 2.0, color: "#dc2626", label: "2.0–3.0 m" },
  { classMin: 3.0, color: "#7f1d1d", label: "> 3.0 m" },
];

export function WaterFloodExtremeLegend({ minDepth = 0 }: { minDepth?: number }) {
  const i18n = useLocale();
  const cats = WATER_FLOOD_DEPTH_CATS.filter((c) => c.classMin >= minDepth);
  return (
    <div>
      <LegendTitle zh={layerTitle("waterFloodExtreme", i18n)} en="Flood Depth" />
      <FireCatRows cats={cats} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.water.floodScenario")}
        {minDepth > 0 && i18n.t("legend.water.floodFiltered", { depth: minDepth })}
      </LegendNote>
    </div>
  );
}

// ── 💧 水利設施 facility_type 4 類 + default（overlayRegistry `waterFacilities` circle-color match）──
// 標籤與 featureInfo/waterPanels.tsx 的 WATER_FACILITY_TYPE 同字串（popup ↔ 圖例一致）。
const WATER_FACILITY_CATS = [
  { color: "#60a5fa", label: "抽水站 (OSM)", code: "pump_station" },
  { color: "#2563eb", label: "官方抽水站 (WRA)", code: "pump_station_official" },
  { color: "#34d399", label: "自來水廠 / 淨水場", code: "treatment_plant" },
  { color: "#fbbf24", label: "水塔", code: "water_tower" },
  { color: "#9ca3af", label: "其他 / 未分類", code: null },
];

export function WaterFacilityLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("waterFacilities", i18n)} en="Facility" />
      <FireCatRows cats={WATER_FACILITY_CATS.map((c) => ({ color: c.color, label: c.code ? enumLabel("waterFacilityType", c.code, c.label, i18n) : i18n.t("legend.water.otherUnclassified") }))} />
    </div>
  );
}

export function IotStructureLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("iotWraStructure", i18n)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IOT_STRUCTURE_TYPES.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <SwatchDot color={s.color} opacity={0.9} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("iotStructureType", s.code, s.label, i18n)}</span>
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{s.measureKey ? i18n.t(s.measureKey) : s.measure}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** R6 段 2：水庫即時水情平面圓點（色＝警示等級，同 3D 水位計水柱色；大小＝有效容量，圖例用水庫水系色空心圈，2026-10-09） */
export function ReservoirStatusLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.water.reservoirTitle")} en="Reservoir Status" />
      {RESERVOIR_ALERT_LEGEND.map((row) => (
        <LegendRow key={row.key} swatch={<SwatchDot color={reservoirAlertCss(row.key)} />}>{enumLabel("reservoirFlatAlert", row.key, row.label, i18n)}</LegendRow>
      ))}
      <LegendSizeRow
        ring={t.isDark ? RESERVOIR_WATER_COLOR.dark : RESERVOIR_WATER_COLOR.light}
        title={i18n.t("legend.water.reservoirSizeTitle")}
        items={RESERVOIR_CAPACITY_LEGEND_WAN.map((wan) => ({ r: reservoirCapacityRadius(wan), label: i18n.t("legend.water.reservoirCapacity", { n: i18n.formatNumber(wan / 10_000) }) }))}
      />
      <LegendNote>{i18n.t("legend.water.reservoirNote")}</LegendNote>
    </div>
  );
}

export function RiverRpiStationsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.water.rpiTitle")}</NoiseLegendTitle>
      <NoiseLegendRows rows={RIVER_RPI_CLASSES.map((row) => ({ color: row.color, label: enumLabel("envRpiClass", row.value, row.label, i18n) }))} dot />
      <LegendRow swatch={<SwatchDot color="transparent" stroke={RIVER_RPI_NO_DATA_COLOR} strokeWidth={2} />}>{i18n.t("legend.water.rpiNoData")}</LegendRow>
      <NoiseLegendNote source={i18n.t("legend.water.rpiSource")}>
        {i18n.t("legend.water.rpiNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function WaterQualityStationsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{layerTitle("waterQualityStations", i18n)}</NoiseLegendTitle>
      <NoiseLegendRows rows={WATER_QUALITY_STATION_TYPES.map((row) => ({ color: row.color, label: enumLabel("envWaterStationType", row.value, row.label, i18n) }))} dot />
      <LegendRow swatch={<SwatchDot color="transparent" stroke={WATER_QUALITY_STATION_TYPES[0].color} strokeWidth={2} />}>{i18n.t("legend.water.wqHollow")}</LegendRow>
      <NoiseLegendNote source={i18n.t("legend.water.wqSource")}>
        {i18n.t("legend.water.wqNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function SewageTreatmentPlantsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{layerTitle("sewageTreatmentPlants", i18n)}</NoiseLegendTitle>
      <LegendRow swatch={<SwatchDot color={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants} />}>{i18n.t("legend.water.sewageExact")}</LegendRow>
      <LegendRow swatch={<SwatchDot color={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants} opacity={0.35} stroke={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants} strokeWidth={2} />}>{i18n.t("legend.water.sewageUncertain")}</LegendRow>
      <NoiseLegendNote source={i18n.t("legend.water.sewageSource")}>
        {i18n.t("legend.water.sewageNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function DrinkingWaterProtectionZonesLegend() {
  const i18n = useLocale();
  const zoneLabel = (i: 0 | 1) => enumLabel("envDrinkingZone", DRINKING_WATER_ZONE_TYPES[i].value, DRINKING_WATER_ZONE_TYPES[i].label, i18n);
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.water.dzTitle")}</NoiseLegendTitle>
      <LegendRow swatch={<SwatchSquare color={DRINKING_WATER_ZONE_TYPES[0].color} />}>{zoneLabel(0)}</LegendRow>
      <LegendRow swatch={<SwatchLine color={DRINKING_WATER_ZONE_TYPES[1].color} dash={[2, 2]} />}>{i18n.t("legend.water.dzDashed", { label: zoneLabel(1) })}</LegendRow>
      <NoiseLegendNote source={i18n.t("legend.water.dzSource")}>
        {i18n.t("legend.water.dzNote")}
      </NoiseLegendNote>
    </div>
  );
}
