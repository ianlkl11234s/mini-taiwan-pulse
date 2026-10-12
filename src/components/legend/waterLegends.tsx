// Legend sub-components (waterLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { JP_WATER_FACILITY_CATEGORIES, JP_WATER_LAYER_CONTRACT } from "../../data/jpWaterTypes";
import { RESERVOIR_ALERT_LEGEND, RESERVOIR_CAPACITY_LEGEND_WAN, RESERVOIR_WATER_COLOR, reservoirAlertCss, reservoirCapacityRadius } from "../../map/r6FlatEncodings";
import { DRINKING_WATER_ZONE_TYPES, ENVIRONMENT_LAYER_COLORS, RIVER_RPI_CLASSES, RIVER_RPI_NO_DATA_COLOR, WATER_QUALITY_STATION_TYPES } from "../../data/environmentLayerTypes";
import { ClimateGradientBar, DenseHeatmapLegendRow, FireCatRows, NoiseLegendNote, NoiseLegendRows, NoiseLegendTitle } from "./legendShared";

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

export function JpWaterLegend({ layerKey }: { layerKey: keyof typeof JP_WATER_LAYER_CONTRACT }) {
  const contract = JP_WATER_LAYER_CONTRACT[layerKey];
  const t = useLegendTheme();
  const colors: Record<keyof typeof JP_WATER_LAYER_CONTRACT, string> = {
    jpWaterDams: "#0369a1", jpWaterLakes: "#0ea5e9", jpWaterSupplyFacilities: "#06b6d4", jpWaterSupplyAreas: "#7dd3fc", jpWaterSewerFacilities: "#1d4ed8", jpWaterRivers: "#0284c7", jpWaterGroundwaterSites: "#8b5cf6", jpWaterNilimDams: "#2563eb", jpWaterAgriculturalPonds: "#65a30d", jpWaterFloodHazard: "#64748b", jpWaterLocalPipes: "#075985", jpWaterLocalFacilities: "#0284c7", jpWaterQualityStations: "#7c3aed", jpWaterLevelStations: "#0369a1",
  };
  const facilityGroup = layerKey === "jpWaterSupplyFacilities" ? "supply" : layerKey === "jpWaterSewerFacilities" ? "sewer" : null;
  const rows = facilityGroup
    ? JP_WATER_FACILITY_CATEGORIES.filter((category) => category.group === facilityGroup)
    : [{ color: colors[layerKey], label: `${contract.geometryRole} · ${contract.sourceYear}` }];
  return <div><LegendTitle zh={contract.sourceLabel} />
    <FireCatRows cats={rows} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{contract.historical ? "歷史快照；不是現況觀測。" : "以來源 metadata 為準；未知不補值。"}</div>
    {facilityGroup && <LegendNote style={{ marginTop: 4 }}>{facilityGroup === "supply" ? "P21 未提供一致細類；依 2010 年設施名稱保守推定，未命中者保留未分類。" : "P22 泵場／處理場依來源子型 P22a／P22b 區分。"}</LegendNote>}
    {["jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds"].includes(layerKey) && <LegendNote style={{ marginTop: 4 }}>{layerKey === "jpWaterGroundwaterSites" ? "已驗證 source 1,293 筆；實際24縣，當前視窗空白不代表全國無資料。" : layerKey === "jpWaterNilimDams" ? "已驗證 source 583 筆；實際46縣、年份未提供，不與KSJ水壩相加。" : "已驗證 source 161,778 筆；datum未知的位置候選，4,284同座標列保留。"}</LegendNote>}
    {layerKey === "jpWaterAgriculturalPonds" && <DenseHeatmapLegendRow layers={["jpWaterAgriculturalPonds"]} />}
  </div>;
}

export function JpWaterFloodHazardLegend() {
  const t = useLegendTheme();
  return <div><LegendTitle zh="國土地理院 GSI 官方 XYZ（z2–17）" />
    <img src="https://disaportaldata.gsi.go.jp/hazardmap/copyright/img/shinsui_legend3.png" alt="國土地理院官方洪水浸水想定深度圖例" style={{ display: "block", maxWidth: "100%", height: "auto", marginBottom: 5 }} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>最大規模浸水想定；空白不等於無風險，非即時災情或預報，覆蓋仍有部分缺口。色階直接使用官方圖例。</div>
  </div>;
}

// ── IoT River Legend (delta 紅↔藍) ──

export function IotRiverLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="IoT 河川（補強）" />
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
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
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>下降</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>持平</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>上升</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>-1m</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>0</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>+1m</span>
        </div>
      </div>
      <LegendNote style={{ lineHeight: 1.4 }}>
        圈大小 = 變化幅度
      </LegendNote>
    </div>
  );
}

// ── IoT Structure Legend (5 類別 + 主要測項) ──

// ── 灌排渠道 3 色圖例 ──

const WATER_CANAL_ITEMS = [
  { color: THEMED_PAINT_COLORS.canalIrrigation, label: "灌溉專用渠道 Irrigation" },
  { color: THEMED_PAINT_COLORS.canalDownstream, label: "下游具引灌需求 Demand" },
  { color: THEMED_PAINT_COLORS.canalOther, label: "不具引灌需求/宜蘭 Other" },
];

export function WaterCanalLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="灌排渠道" en="Canal" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {WATER_CANAL_ITEMS.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine width={3} color={c.color[isDark ? "dark" : "light"]} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LAKES_PONDS_CATS = [
  { color: "#4fc3f7", label: "埤塘 Pond" },
  { color: "#1e88e5", label: "湖泊 Lake" },
  { color: "#00acc1", label: "水塘 Reservoir (OSM 自標)" },
  { color: "#7e57c2", label: "水池 Basin" },
];

export function LakesPondsLegend() {
  return (
    <div>
      <LegendTitle zh="湖泊 / 埤塘" en="Lakes & Ponds" />
      <FireCatRows cats={LAKES_PONDS_CATS} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        已濾掉與魚塭圖層重疊者（39.1%）｜OSM ODbL
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
  return (
    <div>
      <LegendTitle zh="河川水位" en="River Level" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        當日水位變化 Δ（vs 當日起始）
      </div>
      <ClimateGradientBar
        gradient={deltaStopsToGradient(RIVER_LEVEL_DELTA_STOPS)}
        labels={["-1m 下降", "0", "+1m 上升"]}
      />
      <div style={{ marginTop: 4 }}>
        <FireCatRows cats={[{ color: RIVER_LEVEL_ABNORMAL_COLOR, label: "測值異常 Abnormal" }]} />
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        圈大小 = |Δ| 幅度（跨站可比）
      </LegendNote>
    </div>
  );
}

// ── 北市雨水下水道：ground_far step 分級（useTaipeiSewerLayer.ts depthColorExpression）──
// ground_far = 水面距地面的深度（m），越小越接近溢出，所以色序是「小＝紅、大＝藍」。
const TAIPEI_SEWER_CATS = [
  { color: "#7f1d1d", label: "< 0.5 m 逼近地面" },
  { color: "#ef4444", label: "0.5–1 m" },
  { color: "#fb923c", label: "1–2 m" },
  { color: "#fde047", label: "2–3 m" },
  { color: "#3b82f6", label: "≥ 3 m 安全" },
];

export function TaipeiSewerLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="北市下水道水位" en="Sewer" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        水面距地面深度
      </div>
      <FireCatRows cats={TAIPEI_SEWER_CATS} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        每 60 秒更新（北市水利處）
      </LegendNote>
    </div>
  );
}

// ── 北市抽水站：risk_ratio step 分級（useTaipeiPumbLayer.ts riskColorExpression）──
// risk_ratio = 內池水位 / 最高容許水位；運轉中站點有 2px 外框（pumb_running=true；暗底圖白、淡底圖深灰），其餘為底圖色細縫。
const TAIPEI_PUMB_CATS = [
  { color: "#7f1d1d", label: "≥ 0.9 逼近上限" },
  { color: "#ef4444", label: "0.8–0.9" },
  { color: "#fb923c", label: "0.6–0.8" },
  { color: "#fde047", label: "0.4–0.6" },
  { color: "#06b6d4", label: "< 0.4 正常" },
];

export function TaipeiPumbLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="北市抽水站" en="Pump Station" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        內池水位 / 最高容許水位
      </div>
      <FireCatRows cats={TAIPEI_PUMB_CATS} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <SwatchDot color="transparent" stroke={t.isDark ? "#ffffff" : "#111827"} strokeWidth={2} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>外框 = 運轉中</span>
      </div>
    </div>
  );
}

// ── 北市疏散門：gate_state match（useTaipeiEvacuateLayer.ts stateColorExpression）──
// gate_state 由 fo/fc/flt 三個旗標推導，見該檔頂註解。
const TAIPEI_EVACUATE_CATS = [
  { color: "#22c55e", label: "全開 Open" },
  { color: "#ef4444", label: "關閉 Closed（防護啟動）" },
  { color: "#fbbf24", label: "故障 Faulted" },
  { color: "#6b7280", label: "狀態不明 Unknown" },
];

export function TaipeiEvacuateLegend() {
  return (
    <div>
      <LegendTitle zh="北市疏散門" en="Evacuation Gate" />
      <FireCatRows cats={TAIPEI_EVACUATE_CATS} />
    </div>
  );
}

// ── 即時雨量：precipitation_1hr step 分級（useRainGaugeLayer.ts rainColorExpression）──
// 級距數字逐字取自 step 的 stop；中文級名沿用同檔 heatmapColorExpression 註解裡
// 對同一組色碼的稱呼（小雨/中雨/大雨/豪雨/大豪雨/超大豪雨），遠景熱區與近景圓點同色系。
// coalesce(…, 0)：缺值會落進最低級 → 灰色列註明「無雨 / 無資料」。
const RAIN_GAUGE_CATS = [
  { color: "#6b7280", label: "< 0.1 mm 無雨 / 無資料" },
  { color: "#93c5fd", label: "0.1–2.5 mm 小雨" },
  { color: "#3b82f6", label: "2.5–15 mm 中雨" },
  { color: "#22c55e", label: "15–40 mm 大雨" },
  { color: "#fbbf24", label: "40–80 mm 豪雨" },
  { color: "#f97316", label: "80–200 mm 大豪雨" },
  { color: "#ef4444", label: "≥ 200 mm 超大豪雨" },
];

export function RainGaugeLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="即時雨量" en="Rain Gauge" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        時雨量 1hr (mm)
      </div>
      <FireCatRows cats={RAIN_GAUGE_CATS} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        圈大小 = 10 分鐘雨量｜z&lt;12 改用同色系熱區
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
  return (
    <div>
      <LegendTitle zh="地下水井" en="Groundwater" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        當日水位變化 Δ（vs 當日起始）
      </div>
      <ClimateGradientBar
        gradient={deltaStopsToGradient(GROUNDWATER_DELTA_STOPS)}
        labels={["-30cm 下降", "0", "+30cm 上升"]}
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        圈大小 = |Δ| 幅度（±30cm 封頂）
      </LegendNote>
    </div>
  );
}

// ── 💧 水資源管制區 zone_kind 4 類（明暗雙主題）──
// 色票逐字取自 overlayRegistry.ts `waterProtectionZones` 的 **fill-color** match
// （outline 用的是更亮的一組，圖例以面色為準，因為使用者看到的主要是面）。
const WATER_PROTECTION_ZONE_CATS: { dark: string; light: string; label: string }[] = [
  { dark: "#10b981", light: "#047857", label: "飲用水水源保護區 Protection" },
  { dark: "#ef4444", light: "#b91c1c", label: "地下水禁止超抽 Ban" },
  { dark: "#f97316", light: "#c2410c", label: "地下水限制超抽 Restricted" },
  { dark: "#94a3b8", light: "#64748b", label: "地下水分區 Region" },
];

export function WaterProtectionZoneLegend({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <LegendTitle zh="水資源管制區" en="Protection Zone" />
      <FireCatRows
        square
        cats={WATER_PROTECTION_ZONE_CATS.map((c) => ({
          color: isDark ? c.dark : c.light,
          label: c.label,
        }))}
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        地下水分區面只畫薄輪廓（fill 8%）
      </LegendNote>
    </div>
  );
}

// ── 💧 監測站 station_type（overlayRegistry `waterMonitorStations` 的 glow circle-color match）──
// paint 只分 3 種 + default 灰（core 圈是同色系亮版 #93c5fd / #67e8f9 / #f9a8d4，
// 圖例以外暈的飽和版為準，與 featureInfo/waterPanels.tsx 的 WATER_MONITOR_TYPE 同色）。
const WATER_MONITOR_STATION_CATS = [
  { color: "#60a5fa", label: "雨量站 Rain gauge" },
  { color: "#22d3ee", label: "河川水位站 River level" },
  { color: "#f472b6", label: "地下水觀測井 Groundwater well" },
  { color: "#9ca3af", label: "其他 / 未分類 Other" },
];

export function WaterMonitorStationLegend() {
  return (
    <div>
      <LegendTitle zh="監測站" en="Monitor Station" />
      <FireCatRows cats={WATER_MONITOR_STATION_CATS} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        站位分布（不含讀值）｜讀值看即時雨量／河川水位／地下水井
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
  const cats = WATER_FLOOD_DEPTH_CATS.filter((c) => c.classMin >= minDepth);
  return (
    <div>
      <LegendTitle zh="淹水潛勢" en="Flood Depth" />
      <FireCatRows cats={cats} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        情境：日雨量 650mm / 24hr
        {minDepth > 0 && `｜已篩 ≥ ${minDepth} m`}
      </LegendNote>
    </div>
  );
}

// ── 💧 水利設施 facility_type 4 類 + default（overlayRegistry `waterFacilities` circle-color match）──
// 標籤與 featureInfo/waterPanels.tsx 的 WATER_FACILITY_TYPE 同字串（popup ↔ 圖例一致）。
const WATER_FACILITY_CATS = [
  { color: "#60a5fa", label: "抽水站 (OSM)" },
  { color: "#2563eb", label: "官方抽水站 (WRA)" },
  { color: "#34d399", label: "自來水廠 / 淨水場" },
  { color: "#fbbf24", label: "水塔" },
  { color: "#9ca3af", label: "其他 / 未分類" },
];

export function WaterFacilityLegend() {
  return (
    <div>
      <LegendTitle zh="水利設施" en="Facility" />
      <FireCatRows cats={WATER_FACILITY_CATS} />
    </div>
  );
}

export function IotStructureLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="IoT 水工結構" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IOT_STRUCTURE_TYPES.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <SwatchDot color={s.color} opacity={0.9} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{s.label}</span>
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{s.measure}</span>
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
  return (
    <div>
      <LegendTitle zh="水庫即時水情" en="Reservoir Status" />
      {RESERVOIR_ALERT_LEGEND.map((row) => (
        <LegendRow key={row.key} swatch={<SwatchDot color={reservoirAlertCss(row.key)} />}>{row.label}</LegendRow>
      ))}
      <LegendSizeRow
        ring={t.isDark ? RESERVOIR_WATER_COLOR.dark : RESERVOIR_WATER_COLOR.light}
        title="有效容量（圓點大小）"
        items={RESERVOIR_CAPACITY_LEGEND_WAN.map((wan) => ({ r: reservoirCapacityRadius(wan), label: `${(wan / 10_000).toLocaleString()} 億 m³` }))}
      />
      <LegendNote>圓點下方數字＝蓄水率；隨時間軸更新。開「立體效果」另疊 3D 水位計（水柱高＝蓄水率）。</LegendNote>
    </div>
  );
}

export function RiverRpiStationsLegend() {
  return (
    <div>
      <NoiseLegendTitle>河川污染指數 RPI（最新一次）</NoiseLegendTitle>
      <NoiseLegendRows rows={RIVER_RPI_CLASSES} dot />
      <LegendRow swatch={<SwatchDot color="transparent" stroke={RIVER_RPI_NO_DATA_COLOR} strokeWidth={2} />}>無 RPI 資料（不代表乾淨）</LegendRow>
      <NoiseLegendNote source="環境部河川水質監測（WQX_P_01）· 政府資料開放授權條款第 1 版">
        官方四級：RPI ≤2 未（稍）受污染、≤3 輕度、≤6 中度、&gt;6 嚴重。每月更新、約延遲 2 個月；顏色只代表該站最新一次採樣，不是長期平均。
      </NoiseLegendNote>
    </div>
  );
}

export function WaterQualityStationsLegend() {
  return (
    <div>
      <NoiseLegendTitle>水質監測站</NoiseLegendTitle>
      <NoiseLegendRows rows={WATER_QUALITY_STATION_TYPES} dot />
      <LegendRow swatch={<SwatchDot color="transparent" stroke={WATER_QUALITY_STATION_TYPES[0].color} strokeWidth={2} />}>中空：無讀值（不代表乾淨）</LegendRow>
      <NoiseLegendNote source="環境部、經濟部水利署、臺北翡翠水庫管理局 · 政府資料開放授權條款第 1 版">
        只標示測站位置與最新採樣日，不代表水質好壞；無座標或座標在臺灣外的 607 站未畫出。
      </NoiseLegendNote>
    </div>
  );
}

export function SewageTreatmentPlantsLegend() {
  return (
    <div>
      <NoiseLegendTitle>公共污水處理廠</NoiseLegendTitle>
      <LegendRow swatch={<SwatchDot color={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants} />}>地址精確／路段定位</LegendRow>
      <LegendRow swatch={<SwatchDot color={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants} opacity={0.35} stroke={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants} strokeWidth={2} />}>位置不確定（區域中心／約略位置）</LegendRow>
      <NoiseLegendNote source="內政部 data.gov.tw 26496 · 地址經 Google 定位">
        82 廠中 14 處只定位到區域中心或約略位置，點位不等於廠址。
      </NoiseLegendNote>
    </div>
  );
}

export function DrinkingWaterProtectionZonesLegend() {
  return (
    <div>
      <NoiseLegendTitle>飲用水水源水質保護區（環境部）</NoiseLegendTitle>
      <LegendRow swatch={<SwatchSquare color={DRINKING_WATER_ZONE_TYPES[0].color} />}>{DRINKING_WATER_ZONE_TYPES[0].label}</LegendRow>
      <LegendRow swatch={<SwatchLine color={DRINKING_WATER_ZONE_TYPES[1].color} dash={[2, 2]} />}>{DRINKING_WATER_ZONE_TYPES[1].label}（虛線）</LegendRow>
      <NoiseLegendNote source="環境部 GISEPA_P_13（2026-07-20 版）· 政府資料開放授權條款第 1 版">
        依飲用水管理條例公告；與水資源「管制區」（水利署依自來水法劃設的自來水水質水量保護區）法源與範圍不同，不可視為同一圖層。
      </NoiseLegendNote>
    </div>
  );
}
