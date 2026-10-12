// Legend sub-components (environmentWeatherLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { MOVING_POINT } from "../../map/mapStyleScale";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { paramBool, useLayerParams } from "../../layers/layerParamsAccess";
import { TEMPERATURE_GRID_BANDS } from "../../data/temperatureGridTypes";
import { resolveMicroSensorMode, MICRO_SENSOR_NO_DATA_COLOR } from "../../data/microSensorTypes";
import { resolveUrbanHeatMode, urbanHeatLegendGradient, urbanHeatStopPercent, URBAN_HEAT_CREDIT, URBAN_HEAT_COVERAGE_NOTE } from "../../data/urbanHeatTypes";
import { WASTE_STATUS_COLORS, WASTE_FACILITY_COLORS, WASTE_FACILITY_LABELS } from "../../data/wasteLoader";
import { h3RampGradient } from "../../map/demographicsLayerFactory";
import { DIVERGING_STOPS } from "../../data/temperatureWavePalette";
import { AQI_LEVELS } from "../../map/aqiColorScale";
import { useLoadingTasks } from "../../hooks/useLoadingTasks";
import { WIND_FIELD_RAMP, WIND_SPEED_MAX, OCEAN_CURRENTS_RAMP, OCEAN_SPEED_MAX, DUST_BAKE_STOPS, rampToGradient } from "../../map/climateRamps";
import { useClimateFrameStatus, type ClimateFrameStatusKey } from "../../state/climateFrameStore";
import { LIGHTNING_TYPE_COLORS } from "../../data/lightningLoader";
import { SEVERITY_BANDS, POLLUTION_MEDIUM_COLORS, POLLUTION_MEDIUM_LABELS, PENALTY_MEDIA, PENALTY_SEVERITY_COLORS, PENALTY_SEVERITY_LABELS, type PollutionMedium, type PollutionPenaltySeverity } from "../../data/pollutionTypes";
import { OFFICIAL_NOISE_FRESHNESS, OFFICIAL_NOISE_COLOR_EXPR, NOISE_CONTROL_ZONE_META, AVIATION_NOISE_ZONE_META, SOUND_CAMERA_PRECISION_META, NOISE_CAPTURE_ATTRIBUTION } from "../../data/noiseTypes";
import { ClimateGradientBar, DenseHeatmapLegendRow, FireCatRows, FlatArrowRow, NoiseLegendNote, NoiseLegendRows, NoiseLegendTitle } from "./legendShared";

/**
 * 圖例色票有暗／淡兩套畫法時，保留目前底圖分支給各 entry。
 * 色票仍由各圖層的 data 常數供應；此層只讓 SSR 與嵌入版保有同一個 theme identity。
 */

// ── 環境污染：嚴重度（設施 + 場址共用）──
export function PollutionSeverityLegend({ visibility }: { visibility: LayerVisibility }) {
  const bands = visibility.pollutionSite && !visibility.pollutionFacility
    ? SEVERITY_BANDS.filter((b) => b.sev === 4)
    : SEVERITY_BANDS;
  return (
    <div>
      <LegendTitle zh="污染嚴重度" en="Severity" />
      <FireCatRows cats={bands.map((b) => ({ color: b.color, label: b.label }))} />
      {visibility.pollutionFacility && <DenseHeatmapLegendRow layers={["pollutionFacility"]} />}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        列管 ≠ 污染｜設施色 = 最高嚴重度
      </LegendNote>
    </div>
  );
}

// ── 環境污染：裁處事件介質 ──
export function PollutionPenaltyLegend({ visibility }: { visibility: LayerVisibility }) {
  const severityKeys: PollutionPenaltySeverity[] = [
    ...(visibility.pollutionPenaltyCritical ? ["critical" as const] : []),
    ...(visibility.pollutionPenaltyGeneral ? (["high", "normal"] as const) : []),
    ...(visibility.pollutionPenaltyMobile ? ["mobile" as const] : []),
  ];
  const severityCats = severityKeys.map((k) => ({
    color: PENALTY_SEVERITY_COLORS[k],
    label: PENALTY_SEVERITY_LABELS[k],
  }));
  const mediumCats = PENALTY_MEDIA.map((m: PollutionMedium) => ({
    color: POLLUTION_MEDIUM_COLORS[m],
    label: POLLUTION_MEDIUM_LABELS[m],
  }));
  return (
    <div>
      <LegendTitle zh="裁處分層" en="Penalty" />
      {severityCats.map((c, i) => <LegendRow key={c.label} swatch={severityKeys[i] === "mobile" ? <SwatchDot color={c.color} /> : null}>{c.label}</LegendRow>)}
      <LegendTitle zh="介質" en="Medium" style={{ marginTop: 8 }} />
      <FireCatRows cats={mediumCats} />
      <DenseHeatmapLegendRow layers={["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        重大點大小 ∝ 罰鍰｜白框 = 連續 / 停工等｜可年份播放
      </LegendNote>
    </div>
  );
}

/**
 * 垃圾車 GPS（R6 段 3 補，LG-1）：所有狀態同一色（WASTE_STATUS_COLORS），只有停車／離線點較小。
 * 立體效果開＝光球＋收運中飄音符；關＝平面點，拉近換方向箭頭、不顯示音符。
 */
export function WasteTruckLegend() {
  const values = useLayerParams("wasteTruck");
  const stereo = paramBool(values, "wasteTruck", "wasteTruck3D");
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="垃圾車" en="Truck" />
      <LegendRow swatch={<SwatchDot color={WASTE_STATUS_COLORS.collecting} {...(stereo ? {} : { stroke: t.movingStroke, strokeWidth: MOVING_POINT.stroke.width })} />}>垃圾車（GPS 即時位置）</LegendRow>
      {!stereo && <FlatArrowRow />}
      <LegendNote>{stereo ? "停車／離線的點較小；收運中的車會飄出音符" : "停車／離線的點較小"}</LegendNote>
    </div>
  );
}

// timeline 當前顯示幀的有效時間 + 種類（實況/預報）；無 manifest 時 hook 不寫入 → 不顯示。
function formatClimateFrameTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(/-/g, "/");
}

function ClimateFrameStamp({ statusKey }: { statusKey: ClimateFrameStatusKey }) {
  const frame = useClimateFrameStatus(statusKey);
  if (!frame.validAt) return null;
  return (
    <LegendNote style={{ marginTop: 4 }}>
      {frame.kind === "forecast" ? "預報" : "實況"} · {formatClimateFrameTime(frame.validAt)}
    </LegendNote>
  );
}

export function WindFieldLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="風場 10m" en="NOAA GFS" />
      <ClimateFrameStamp statusKey="windField" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        風速 Wind speed (m/s)
      </div>
      <ClimateGradientBar
        gradient={rampToGradient(WIND_FIELD_RAMP)}
        labels={["0", "10", "20", `${WIND_SPEED_MAX}+`]}
      />
      <LegendNote style={{ marginTop: 4 }}>
        click 地圖任一點讀風速/風向
      </LegendNote>
    </div>
  );
}

export function OceanCurrentsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="海流" en="CMEMS" />
      <ClimateFrameStamp statusKey="oceanCurrents" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        流速 Current speed (m/s)
      </div>
      <ClimateGradientBar
        gradient={rampToGradient(OCEAN_CURRENTS_RAMP)}
        labels={["0", "0.6", "1.2", `${OCEAN_SPEED_MAX.toFixed(1)}+`]}
      />
      <LegendNote style={{ marginTop: 4 }}>
        click 海面任一點讀流速/流向
      </LegendNote>
    </div>
  );
}

export function DustForecastLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="沙塵光學厚度 550nm" en="CAMS" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {/* 上游 climate_bake 已從 per-file normalize 改為固定 sqrt 色階（t = √(AOD/1.0)），
            跨幀可比 —— 文案須與上游同時上線，否則會描述錯誤的色階語意。 */}
        沙塵光學厚度 AOD 0–1 固定色階（跨時間可比，透明 = 無沙塵）
      </div>
      <ClimateGradientBar
        gradient={`linear-gradient(to right, ${DUST_BAKE_STOPS.map((s) => `${s.color} ${(s.t * 100).toFixed(0)}%`).join(", ")})`}
        labels={["低 Low", "高 High"]}
      />
    </div>
  );
}

// 溫度網格 2D：10 級 step 色階（色票 SSOT = data/temperatureGridTypes.ts，
// 與 temperatureGridLayerFactory 的 fill-color step 表達式同源）。
export function TemperatureGridLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="溫度網格" en="Temperature Grid" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {TEMPERATURE_GRID_BANDS.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        CWA 0.03° 逐時觀測分析格點
      </LegendNote>
    </div>
  );
}

/**
 * AQI 6 級色階（環境部官方配色，SSOT = map/aqiColorScale.ts 的 AQI_LEVELS，
 * 與 useAqiStationsLayer 的 buildAqiStepExpression 同源）。
 *
 * 2026-08-10：本元件原本是 components/AqiLegend.tsx、由 App.tsx 手動掛在畫面右下角，
 * 繞過 LEGEND_REGISTRY，導致 aqiImagery / aqiStations 被 layerConsistency 當成
 * 「合法無圖例」凍進 baseline。收編進 registry 後刪除該檔；色階與刻度原封不動，
 * 只拔掉自己的面板外殼（背景/模糊/圓角）改用 LegendPanel 的容器。
 * header 的 loading 狀態沿用（aqi-* / micro-sensors 任務）。
 */
export function AqiLegend() {
  const t = useLegendTheme();
  const allTasks = useLoadingTasks();
  const aqiTasks = allTasks.filter(
    (task) =>
      task.id.startsWith("aqi-") ||
      task.id.startsWith("micro-sensors") ||
      task.id.startsWith("aqi-imagery-batch"),
  );
  const loadingLabel = aqiTasks[0]?.label ?? null;
  const boundaries = AQI_LEVELS.map((lv) =>
    Number.isFinite(lv.max) ? lv.max.toString() : "301+",
  );
  // 6 級 → 顯示 5 個邊界（0 / 50 / 100 / 150 / 200 / 300 / 301+）
  const ticks = ["0", ...boundaries];

  return (
    <div>
      <style>{`
        @keyframes aqi-spin { to { transform: rotate(360deg); } }
        .aqi-spin {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 2px solid rgba(147, 197, 253, 0.25);
          border-top-color: #93c5fd;
          border-radius: 50%;
          animation: aqi-spin 0.8s linear infinite;
          vertical-align: -1px;
        }
      `}</style>
      <div
        style={{
          marginBottom: 4,
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <LegendTitle zh="空氣品質指標" en="AQI" style={{ marginBottom: 0 }} />
        {loadingLabel && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, color: "#93c5fd" }}>
            <span className="aqi-spin" />
            <span style={{ fontSize: FONT_SIZE.xs }}>載入中…</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", height: 12, borderRadius: RADIUS.sm, overflow: "hidden" }}>
        {AQI_LEVELS.map((lv) => (
          <div
            key={lv.label}
            title={`${lv.label} — ${lv.description}`}
            style={{ flex: 1, background: lv.color }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          fontSize: FONT_SIZE.xs, marginTop: 2, color: t.textDim,
        }}
      >
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}

// LASS 微型感測：三模式共用同一份圖例框，依當前顯示模式換色階列
// （色票 SSOT = data/microSensorTypes.ts，與 loader 預烤進 properties 的顏色同源；
//  溫度模式直接吃 TEMPERATURE_GRID_BANDS，與溫度網格 2D 跨圖層一致）。
export function MicroSensorLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const mode = resolveMicroSensorMode(modeIdx);
  return (
    <div>
      <LegendTitle zh="微型感測" en="LASS AirBox" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{mode.note}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {mode.legend.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchDot color={MICRO_SENSOR_NO_DATA_COLOR} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>無資料</span>
        </div>
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        LASS AirBox / 環境部微感測 · 最新 15 分鐘快照
      </LegendNote>
    </div>
  );
}

// 都市熱島：兩模式共用同一份圖例框，依當前模式換漸層條 + 刻度
// （色票／值域 SSOT = data/urbanHeatTypes.ts，與 overlayRegistry 的 raster-color 同源；
//  刻度位置照物理值等比換算，所以 ΔT 的 0K 白點會落在正確位置而非視覺置中）。
export function UrbanHeatLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const mode = resolveUrbanHeatMode(modeIdx);
  return (
    <div>
      <LegendTitle zh="都市熱島" en="Urban Heat" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {mode.label}（{mode.unit}）
      </div>
      <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(to right, ${urbanHeatLegendGradient(mode)})` }} />
      <div style={{ position: "relative", height: 12, marginTop: 2 }}>
        {mode.ticks.map((tick, i) => {
          const pct = urbanHeatStopPercent(mode, tick.value);
          const isFirst = i === 0;
          const isLast = i === mode.ticks.length - 1;
          return (
            <span
              key={tick.label}
              style={{
                position: "absolute",
                left: `${pct}%`,
                transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                fontSize: FONT_SIZE.xs,
                color: t.textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {tick.label}
            </span>
          );
        })}
      </div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {mode.note}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {URBAN_HEAT_CREDIT}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {URBAN_HEAT_COVERAGE_NOTE}
      </LegendNote>
    </div>
  );
}

// ── 溫度波 3D：RdBu 發散色盤（TemperatureWaveScene 的 DIVERGING_STOPS）──
// ⚠️ 與 2D 溫度網格（TemperatureGridLegend 的 10 級絕對 °C）不同：3D 波的顏色是
//    (temp - tempMin) / (tempMax - tempMin)，**以當日資料範圍拉伸**，
//    所以沒有固定的 °C 刻度，只能標兩端。硬標 -10/35°C 會在多數日子跟地圖對不上。
export function TemperatureWaveLegend({ gridAlsoOn }: { gridAlsoOn: boolean }) {
  const t = useLegendTheme();
  // R6 段 1：立體效果關 → 地圖畫的是溫度網格（同 temperatureGrid），圖例跟著換；
  // 溫度網格本身也開著時它已有同一份圖例，不重複
  const values = useLayerParams("temperatureWave");
  if (!paramBool(values, "temperatureWave", "tempExtruded")) {
    return gridAlsoOn ? null : <TemperatureGridLegend />;
  }
  const gradient = `linear-gradient(to right, ${DIVERGING_STOPS.map(
    (s) => `rgb(${Math.round(s.r * 255)},${Math.round(s.g * 255)},${Math.round(s.b * 255)}) ${(s.t * 100).toFixed(1)}%`,
  ).join(", ")})`;
  return (
    <div>
      <LegendTitle zh="溫度波" en="Temperature Wave" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        氣溫（拉伸至當日觀測範圍）
      </div>
      <ClimateGradientBar gradient={gradient} labels={["當日最低", "當日最高"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        波高同步溫度｜要看絕對 °C 分級請開溫度網格 2D
      </LegendNote>
    </div>
  );
}

// ── H3 網格（人口 / 社經 / 空間經濟）連續色階 ──
// 顏色不寫在 paint 裡：demographicsLayerFactory 以 interpolateColor(色階, norm) 預烤進
// feature.properties.color，paint 只有 ["get","color"]（demographicsLayerFactory.ts:152）。
// 因此圖例直接吃 factory 匯出的同一組色階陣列，不複製 RGB。
// ⚠️ norm 是「相對當前資料最大值」（count 類走 log、其餘線性，再套 contrast gamma），
//    沒有固定的絕對刻度 → 只標低/高兩端，不編造數值。
export function H3RampLegend({
  title, titleEn, ramp, note,
}: { title: string; titleEn?: string; ramp: [number, number, number][]; note: string }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh={title} en={titleEn} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>{note}</div>
      <ClimateGradientBar gradient={h3RampGradient(ramp)} labels={["低 Low", "高 High"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        相對色階（以畫面資料最大值為 100%）｜對比滑桿會改變分布
      </LegendNote>
    </div>
  );
}

/** R6 段 2：五類廢棄物處理設施平面圓點（LG-1，色號＝WASTE_FACILITY_COLORS，與地圖同一常數） */
const WASTE_FACILITY_LEGEND_ROWS: ReadonlyArray<{ key: keyof LayerVisibility; type: string }> = [
  { key: "wfIncinerator", type: "incinerator" },
  { key: "wfLandfill", type: "landfill" },
  { key: "wfLandfillCoastal", type: "landfill_coastal" },
  { key: "wfTransfer", type: "transfer_station" },
  { key: "wfMedical", type: "medical_waste" },
];

export function WasteFacilityLegend({ visibility }: { visibility: LayerVisibility }) {
  const rows = WASTE_FACILITY_LEGEND_ROWS.filter((r) => visibility[r.key]);
  return (
    <div>
      <LegendTitle zh="垃圾處理設施" en="Waste Facilities" />
      {rows.map((r) => (
        <LegendRow key={r.key} swatch={<SwatchDot color={WASTE_FACILITY_COLORS[r.type]!} />}>
          {WASTE_FACILITY_LABELS[r.type] ?? r.type}
        </LegendRow>
      ))}
      <LegendNote>開「立體效果」另疊 3D 造型（煙囪、穹頂、雷達等）。</LegendNote>
    </div>
  );
}

// ── HAZARD: 落雷 / 核安 ──

export function LightningLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="落雷類型" />
      {[
        { label: "雲對地 CG（高傷害）", color: LIGHTNING_TYPE_COLORS[0]! },
        { label: "雲中 IC", color: LIGHTNING_TYPE_COLORS[1]! },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={row.color} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● zoom &lt; 10 自動 cluster<br />
        ● 預設 60 min 視窗
      </LegendNote>
    </div>
  );
}

/** 氣象署源：同樣分雲對地／雲中，但色相與台電源錯開，兩層疊著仍分得出誰是誰。 */
export function LightningCwaLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="落雷類型（氣象署）" />
      {[
        { label: "對地 CG（高傷害）", color: "#a78bfa" },
        { label: "雲間 IC", color: "#4ade80" },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={row.color} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 來源 O-A0039-001，每 5 分更新<br />
        ● 時間僅到分鐘、無電流強度<br />
        ● 與台電源並行，可互相對照
      </LegendNote>
    </div>
  );
}

export function OfficialNoiseMonitoringLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <NoiseLegendTitle>官方測站 · 樣本 LAeq</NoiseLegendTitle>
      <div style={{
        height: 8,
        borderRadius: RADIUS.sm,
        background: `linear-gradient(90deg,${OFFICIAL_NOISE_COLOR_EXPR.filter((v) => typeof v === "string" && v.startsWith("#")).join(",")})`,
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: t.textDim }}>
        <span>40 dB</span><span>90 dB</span>
      </div>
      <div style={{ marginTop: 4 }}>
        {Object.entries(OFFICIAL_NOISE_FRESHNESS).map(([key, row]) => (
          <LegendRow key={key} swatch={<SwatchDot color={key === "unavailable" ? "transparent" : `linear-gradient(90deg,${OFFICIAL_NOISE_COLOR_EXPR.filter((v) => typeof v === "string" && v.startsWith("#")).join(",")})`} opacity={key === "historical" ? 0.45 : 0.9} stroke={key === "unavailable" ? row.color : undefined} />}>{row.label}</LegendRow>
        ))}
      </div>
      <NoiseLegendNote source="環境部資料集 28185 與地方噪音觀測來源">
        各來源最近可用 30 日窗內「實際回報樣本」的聲能平均；請搭配 popup 的 active-day coverage。不是完整連續月均值或法規達標判定。無已驗 dB 的測站仍保留，中空點不代表安靜或 0 dB。
      </NoiseLegendNote>
    </div>
  );
}

export function NoiseCaptureGridLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <NoiseLegendTitle>NoiseCapture · 近 365 天滾動</NoiseLegendTitle>
      <div style={{
        height: 8,
        borderRadius: RADIUS.sm,
        background: "linear-gradient(90deg,#2563eb,#22c55e,#facc15,#f97316,#dc2626)",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: t.textDim }}>
        <span>45 dB</span><span>85 dB</span>
      </div>
      <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: "#f59e0b", fontWeight: 700 }}>
        全部 provisional
      </div>
      <NoiseLegendNote source={NOISE_CAPTURE_ATTRIBUTION}>
        公民科學觀測，非法定噪音量測。z7–10 為 1 km（1 格）、z11–12 為 500 m（1 格）、z13–15 為 250 m（3 格），三尺度互斥且高度稀疏。留白不代表安靜或 0 dB；品質門檻未放寬。
      </NoiseLegendNote>
    </div>
  );
}

export function NoiseControlZonesLegend() {
  return (
    <div>
      <NoiseLegendTitle>法定噪音管制區</NoiseLegendTitle>
      <NoiseLegendRows rows={Object.values(NOISE_CONTROL_ZONE_META)} />
      <NoiseLegendNote source="臺中市政府環境保護局 · 政府資料開放授權條款第 1 版">
        第一類至第四類是法定管制分類，不是實測聲音大小。v1 只有臺中 113 年官方 polygon；臺中以外留白不代表沒有管制區。部分官方幾何經拓樸修復，未改畫或推估法定邊界。
      </NoiseLegendNote>
    </div>
  );
}

export function AviationNoiseZonesLegend() {
  return (
    <div>
      <NoiseLegendTitle>航空噪音法定里別</NoiseLegendTitle>
      <NoiseLegendRows rows={Object.values(AVIATION_NOISE_ZONE_META)} />
      <NoiseLegendNote source="桃園／高雄市政府公告名單 + NLSC 2026-06-26 村里界">
        法定村里 membership 的行政界套疊，不是 DNL 實測等噪音線，也不代表村里內每一處噪音相同。v1 只有桃園／高雄；來源未明載生效日時不自行推估。
      </NoiseLegendNote>
    </div>
  );
}

export function NoiseEnforcementEventsLegend() {
  const rows: { label: string; color: string }[] = (["critical", "high", "normal", "mobile"] as PollutionPenaltySeverity[])
    .map((severity) => ({
      label: PENALTY_SEVERITY_LABELS[severity],
      color: PENALTY_SEVERITY_COLORS[severity],
    }));
  return (
    <div>
      <NoiseLegendTitle>噪音裁處事件／罰鍰</NoiseLegendTitle>
      <NoiseLegendRows rows={rows} dot />
      <DenseHeatmapLegendRow layers={["noiseEnforcementEvents"]} />
      <NoiseLegendNote source="環境部 EMS_P_46 污染裁處資料">
        顏色表示裁處嚴重度，點大小可反映罰鍰；不是 dB 觀測或聲音強度。定位精度混合，資料沿用既有 pollution_penalties PMTiles，不是即時告發流。
      </NoiseLegendNote>
    </div>
  );
}

export function SoundCameraLocationsLegend() {
  return (
    <div>
      <NoiseLegendTitle>聲音照相設備／路段</NoiseLegendTitle>
      <NoiseLegendRows rows={Object.values(SOUND_CAMERA_PRECISION_META)} dot />
      <NoiseLegendNote source="臺南市／彰化縣環保局官方清單 · 政府資料開放授權條款第 1 版">
        333 筆清單中只有 267 筆可畫；66 筆 pending 未以行政區中心補位。位置可能是地址、路段或模糊定位；清單不代表即時運作、違規事件位置或 dB。v1 只涵蓋臺南與彰化。
      </NoiseLegendNote>
    </div>
  );
}
