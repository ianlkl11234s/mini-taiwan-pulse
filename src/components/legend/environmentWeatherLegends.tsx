// Legend sub-components (environmentWeatherLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { MOVING_POINT } from "../../map/mapStyleScale";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { paramBool, useLayerParams } from "../../layers/layerParamsAccess";
import { TEMPERATURE_GRID_BANDS } from "../../data/temperatureGridTypes";
import { resolveMicroSensorMode, MICRO_SENSOR_NO_DATA_COLOR } from "../../data/microSensorTypes";
import { resolveUrbanHeatMode, urbanHeatLegendGradient, urbanHeatStopPercent } from "../../data/urbanHeatTypes";
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
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";
import type { MessageKey } from "../../i18n/keys";
import { ClimateGradientBar, DenseHeatmapLegendRow, FireCatRows, FlatArrowRow, NoiseLegendNote, NoiseLegendRows, NoiseLegendTitle } from "./legendShared";

type I18n = ReturnType<typeof useLocale>;

/** 標題與圖層名相同時，借 manifest 名稱在目前語系的顯示名 */
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

/**
 * 圖例色票有暗／淡兩套畫法時，保留目前底圖分支給各 entry。
 * 色票仍由各圖層的 data 常數供應；此層只讓 SSR 與嵌入版保有同一個 theme identity。
 */

// ── 環境污染：嚴重度（設施 + 場址共用）──
export function PollutionSeverityLegend({ visibility }: { visibility: LayerVisibility }) {
  const i18n = useLocale();
  const bands = visibility.pollutionSite && !visibility.pollutionFacility
    ? SEVERITY_BANDS.filter((b) => b.sev === 4)
    : SEVERITY_BANDS;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.pollSeverityTitle")} en="Severity" />
      <FireCatRows cats={bands.map((b) => ({ color: b.color, label: enumLabel("pollutionSeverity", b.sev, b.label, i18n) }))} />
      {visibility.pollutionFacility && <DenseHeatmapLegendRow layers={["pollutionFacility"]} />}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.environment.pollSeverityNote")}
      </LegendNote>
    </div>
  );
}

// ── 環境污染：裁處事件介質 ──
export function PollutionPenaltyLegend({ visibility }: { visibility: LayerVisibility }) {
  const i18n = useLocale();
  const severityKeys: PollutionPenaltySeverity[] = [
    ...(visibility.pollutionPenaltyCritical ? ["critical" as const] : []),
    ...(visibility.pollutionPenaltyGeneral ? (["high", "normal"] as const) : []),
    ...(visibility.pollutionPenaltyMobile ? ["mobile" as const] : []),
  ];
  const severityCats = severityKeys.map((k) => ({
    color: PENALTY_SEVERITY_COLORS[k],
    label: enumLabel("pollutionPenaltySeverity", k, PENALTY_SEVERITY_LABELS[k], i18n),
  }));
  const mediumCats = PENALTY_MEDIA.map((m: PollutionMedium) => ({
    color: POLLUTION_MEDIUM_COLORS[m],
    label: enumLabel("pollutionMedium", m, POLLUTION_MEDIUM_LABELS[m], i18n),
  }));
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.penaltyTierTitle")} en="Penalty" />
      {severityCats.map((c, i) => <LegendRow key={c.label} swatch={severityKeys[i] === "mobile" ? <SwatchDot color={c.color} /> : null}>{c.label}</LegendRow>)}
      <LegendTitle zh={i18n.t("legend.environment.mediumTitle")} en="Medium" style={{ marginTop: 8 }} />
      <FireCatRows cats={mediumCats} />
      <DenseHeatmapLegendRow layers={["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.environment.penaltyNote")}
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
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.truckTitle")} en="Truck" />
      <LegendRow swatch={<SwatchDot color={WASTE_STATUS_COLORS.collecting} {...(stereo ? {} : { stroke: t.movingStroke, strokeWidth: MOVING_POINT.stroke.width })} />}>{i18n.t("legend.environment.truckLabel")}</LegendRow>
      {!stereo && <FlatArrowRow />}
      <LegendNote>{i18n.t(stereo ? "legend.environment.truckNote3d" : "legend.environment.truckNoteFlat")}</LegendNote>
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
  const i18n = useLocale();
  if (!frame.validAt) return null;
  return (
    <LegendNote style={{ marginTop: 4 }}>
      {i18n.t(frame.kind === "forecast" ? "legend.environment.kindForecast" : "legend.environment.kindLive")} · {formatClimateFrameTime(frame.validAt)}
    </LegendNote>
  );
}

export function WindFieldLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.windTitle")} en="NOAA GFS" />
      <ClimateFrameStamp statusKey="windField" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {i18n.t("legend.environment.windSub")}
      </div>
      <ClimateGradientBar
        gradient={rampToGradient(WIND_FIELD_RAMP)}
        labels={["0", "10", "20", `${WIND_SPEED_MAX}+`]}
      />
      <LegendNote style={{ marginTop: 4 }}>
        {i18n.t("legend.environment.windClick")}
      </LegendNote>
    </div>
  );
}

export function OceanCurrentsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("oceanCurrents", i18n)} en="CMEMS" />
      <ClimateFrameStamp statusKey="oceanCurrents" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {i18n.t("legend.environment.oceanSub")}
      </div>
      <ClimateGradientBar
        gradient={rampToGradient(OCEAN_CURRENTS_RAMP)}
        labels={["0", "0.6", "1.2", `${OCEAN_SPEED_MAX.toFixed(1)}+`]}
      />
      <LegendNote style={{ marginTop: 4 }}>
        {i18n.t("legend.environment.oceanClick")}
      </LegendNote>
    </div>
  );
}

export function DustForecastLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.dustTitle")} en="CAMS" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {/* 上游 climate_bake 已從 per-file normalize 改為固定 sqrt 色階（t = √(AOD/1.0)），
            跨幀可比 —— 文案須與上游同時上線，否則會描述錯誤的色階語意。 */}
        {i18n.t("legend.environment.dustSub")}
      </div>
      <ClimateGradientBar
        gradient={`linear-gradient(to right, ${DUST_BAKE_STOPS.map((s) => `${s.color} ${(s.t * 100).toFixed(0)}%`).join(", ")})`}
        labels={[i18n.t("legend.environment.lowEn"), i18n.t("legend.environment.highEn")]}
      />
    </div>
  );
}

// 溫度網格 2D：10 級 step 色階（色票 SSOT = data/temperatureGridTypes.ts，
// 與 temperatureGridLayerFactory 的 fill-color step 表達式同源）。
export function TemperatureGridLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={layerTitle("temperatureGrid", i18n)} en="Temperature Grid" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {TEMPERATURE_GRID_BANDS.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        {i18n.t("legend.environment.gridNote")}
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
const AQI_DESC_KEYS: MessageKey[] = [
  "legend.environment.aqiDesc0", "legend.environment.aqiDesc1", "legend.environment.aqiDesc2",
  "legend.environment.aqiDesc3", "legend.environment.aqiDesc4", "legend.environment.aqiDesc5",
];

export function AqiLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
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
        <LegendTitle zh={i18n.t("legend.environment.aqiTitle")} en="AQI" style={{ marginBottom: 0 }} />
        {loadingLabel && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, color: "#93c5fd" }}>
            <span className="aqi-spin" />
            <span style={{ fontSize: FONT_SIZE.xs }}>{i18n.t("legend.environment.loading")}</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", height: 12, borderRadius: RADIUS.sm, overflow: "hidden" }}>
        {AQI_LEVELS.map((lv, i) => (
          <div
            key={lv.label}
            title={`${enumLabel("airAqiStatus", lv.label, lv.label, i18n)} — ${i18n.t(AQI_DESC_KEYS[i]!)}`}
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
const MICRO_HUMIDITY_KEYS: Record<string, MessageKey> = {
  "< 40%（極乾）": "legend.environment.humDry",
  "40–50%（乾燥）": "legend.environment.humArid",
  "50–60%（稍乾）": "legend.environment.humSlightlyDry",
  "60–70%（舒適）": "legend.environment.humComfort",
  "70–80%（濕潤）": "legend.environment.humMoist",
  "80–90%（潮濕）": "legend.environment.humDamp",
  "≥ 90%（極濕）": "legend.environment.humVeryDamp",
};
const MICRO_NOTE_KEYS: Record<string, MessageKey> = {
  "0": "legend.environment.microNote0", "1": "legend.environment.microNote1", "2": "legend.environment.microNote2",
};

export function MicroSensorLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const mode = resolveMicroSensorMode(modeIdx);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.microTitle")} en="LASS AirBox" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{MICRO_NOTE_KEYS[mode.value] ? i18n.t(MICRO_NOTE_KEYS[mode.value]!) : mode.note}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {mode.legend.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{MICRO_HUMIDITY_KEYS[band.label] ? i18n.t(MICRO_HUMIDITY_KEYS[band.label]!) : band.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchDot color={MICRO_SENSOR_NO_DATA_COLOR} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.common.noData")}</span>
        </div>
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        {i18n.t("legend.environment.microFoot")}
      </LegendNote>
    </div>
  );
}

// 都市熱島：兩模式共用同一份圖例框，依當前模式換漸層條 + 刻度
// （色票／值域 SSOT = data/urbanHeatTypes.ts，與 overlayRegistry 的 raster-color 同源；
//  刻度位置照物理值等比換算，所以 ΔT 的 0K 白點會落在正確位置而非視覺置中）。
export function UrbanHeatLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const mode = resolveUrbanHeatMode(modeIdx);
  return (
    <div>
      <LegendTitle zh={layerTitle("urbanHeat", i18n)} en="Urban Heat" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.environment.urbanHeatHeader", { label: mode.value === "0" ? i18n.t("legend.environment.urbanLabel0") : mode.value === "1" ? i18n.t("legend.environment.urbanLabel1") : mode.label, unit: mode.unit })}
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
        {mode.value === "0" ? i18n.t("legend.environment.urbanNote0") : mode.value === "1" ? i18n.t("legend.environment.urbanNote1") : mode.note}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.environment.urbanCredit")}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.environment.urbanCoverage")}
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
  const i18n = useLocale();
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
      <LegendTitle zh={layerTitle("temperatureWave", i18n)} en="Temperature Wave" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        {i18n.t("legend.environment.waveSub")}
      </div>
      <ClimateGradientBar gradient={gradient} labels={[i18n.t("legend.environment.waveMin"), i18n.t("legend.environment.waveMax")]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.environment.waveNote")}
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
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={title} en={titleEn} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>{note}</div>
      <ClimateGradientBar gradient={h3RampGradient(ramp)} labels={[i18n.t("legend.environment.lowEn"), i18n.t("legend.environment.highEn")]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.environment.h3Note")}
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
  const i18n = useLocale();
  const rows = WASTE_FACILITY_LEGEND_ROWS.filter((r) => visibility[r.key]);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.wasteFacTitle")} en="Waste Facilities" />
      {rows.map((r) => (
        <LegendRow key={r.key} swatch={<SwatchDot color={WASTE_FACILITY_COLORS[r.type]!} />}>
          {enumLabel("wasteFacility", r.type, WASTE_FACILITY_LABELS[r.type] ?? r.type, i18n)}
        </LegendRow>
      ))}
      <LegendNote>{i18n.t("legend.environment.wasteFacNote")}</LegendNote>
    </div>
  );
}

// ── HAZARD: 落雷 / 核安 ──

export function LightningLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.lightningTitle")} />
      {[
        { label: i18n.t("legend.environment.lightningCg"), color: LIGHTNING_TYPE_COLORS[0]! },
        { label: i18n.t("legend.environment.lightningIc"), color: LIGHTNING_TYPE_COLORS[1]! },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={row.color} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● {i18n.t("legend.environment.lightningNote1")}<br />
        ● {i18n.t("legend.environment.lightningNote2")}
      </LegendNote>
    </div>
  );
}

/** 氣象署源：同樣分雲對地／雲中，但色相與台電源錯開，兩層疊著仍分得出誰是誰。 */
export function LightningCwaLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.environment.lightningCwaTitle")} />
      {[
        { label: i18n.t("legend.environment.lightningCwaCg"), color: "#a78bfa" },
        { label: i18n.t("legend.environment.lightningCwaIc"), color: "#4ade80" },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={row.color} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● {i18n.t("legend.environment.lightningCwaNote1")}<br />
        ● {i18n.t("legend.environment.lightningCwaNote2")}<br />
        ● {i18n.t("legend.environment.lightningCwaNote3")}
      </LegendNote>
    </div>
  );
}

export function OfficialNoiseMonitoringLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.environment.noiseOfficialTitle")}</NoiseLegendTitle>
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
          <LegendRow key={key} swatch={<SwatchDot color={key === "unavailable" ? "transparent" : `linear-gradient(90deg,${OFFICIAL_NOISE_COLOR_EXPR.filter((v) => typeof v === "string" && v.startsWith("#")).join(",")})`} opacity={key === "historical" ? 0.45 : 0.9} stroke={key === "unavailable" ? row.color : undefined} />}>{enumLabel("noiseFreshness", key, row.label, i18n)}</LegendRow>
        ))}
      </div>
      <NoiseLegendNote source={i18n.t("legend.environment.noiseOfficialSource")}>
        {i18n.t("legend.environment.noiseOfficialNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function NoiseCaptureGridLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.environment.noiseCaptureTitle")}</NoiseLegendTitle>
      <div style={{
        height: 8,
        borderRadius: RADIUS.sm,
        background: "linear-gradient(90deg,#2563eb,#22c55e,#facc15,#f97316,#dc2626)",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: t.textDim }}>
        <span>45 dB</span><span>85 dB</span>
      </div>
      <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: "#f59e0b", fontWeight: 700 }}>
        {i18n.t("legend.environment.provisional")}
      </div>
      <NoiseLegendNote source={NOISE_CAPTURE_ATTRIBUTION}>
        {i18n.t("legend.environment.noiseCaptureNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function NoiseControlZonesLegend() {
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.environment.noiseControlTitle")}</NoiseLegendTitle>
      <NoiseLegendRows rows={Object.entries(NOISE_CONTROL_ZONE_META).map(([code, row]) => ({ color: row.color, label: enumLabel("noiseZoneClass", code, row.label, i18n) }))} />
      <NoiseLegendNote source={i18n.t("legend.environment.noiseControlSource")}>
        {i18n.t("legend.environment.noiseControlNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function AviationNoiseZonesLegend() {
  const i18n = useLocale();
  return (
    <div>
      <NoiseLegendTitle>{layerTitle("aviationNoiseZones", i18n)}</NoiseLegendTitle>
      <NoiseLegendRows rows={Object.entries(AVIATION_NOISE_ZONE_META).map(([code, row]) => ({ color: row.color, label: enumLabel("aviationNoiseZone", code, row.label, i18n) }))} />
      <NoiseLegendNote source={i18n.t("legend.environment.aviationSource")}>
        {i18n.t("legend.environment.aviationNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function NoiseEnforcementEventsLegend() {
  const i18n = useLocale();
  const rows: { label: string; color: string }[] = (["critical", "high", "normal", "mobile"] as PollutionPenaltySeverity[])
    .map((severity) => ({
      label: enumLabel("pollutionPenaltySeverity", severity, PENALTY_SEVERITY_LABELS[severity], i18n),
      color: PENALTY_SEVERITY_COLORS[severity],
    }));
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.environment.enforceTitle")}</NoiseLegendTitle>
      <NoiseLegendRows rows={rows} dot />
      <DenseHeatmapLegendRow layers={["noiseEnforcementEvents"]} />
      <NoiseLegendNote source={i18n.t("legend.environment.enforceSource")}>
        {i18n.t("legend.environment.enforceNote")}
      </NoiseLegendNote>
    </div>
  );
}

export function SoundCameraLocationsLegend() {
  const i18n = useLocale();
  const cameraRows = Object.entries(SOUND_CAMERA_PRECISION_META).map(([code, row]) => ({ color: row.color, label: enumLabel("noisePrecision", code, row.label, i18n) }));
  return (
    <div>
      <NoiseLegendTitle>{i18n.t("legend.environment.cameraTitle")}</NoiseLegendTitle>
      <NoiseLegendRows rows={cameraRows} dot />
      <NoiseLegendNote source={i18n.t("legend.environment.cameraSource")}>
        {i18n.t("legend.environment.cameraNote")}
      </NoiseLegendNote>
    </div>
  );
}
