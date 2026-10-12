import { useMemo } from "react";
import { aqiToColor } from "../../map/aqiColorScale";
import { getTemperatureGridFrameTime } from "../../map/temperatureGridLayerFactory";
import { temperatureGridColor } from "../../data/temperatureGridTypes";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row, numOrNull, formatNum } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

/** 允許負值的數值解析（shared 的 numOrNull 把負數當無效，溫度不適用） */
function finiteOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AqiStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const aqi = numOrNull(props.aqi);
  const color = aqi != null ? aqiToColor(aqi) : "#707070";
  const observedAt = String(props.observedAt ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.stationName ?? "Unknown")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: t.bgSubtle,
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 700, color }}>
          {aqi ?? "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.base, color: t.textDefault }}>
          AQI {enumLabel("airAqiStatus", String(props.status ?? ""), String(props.status ?? ""), i18n)}
        </span>
      </div>
      <Row field="county" value={String(props.county ?? "")} />
      <Row label={tr("popup.air.mainPollutant")} value={String(props.pollutant ?? "")} />
      <Row label="PM2.5" value={formatNum(numOrNull(props.pm25), "µg/m³")} mono />
      <Row label="PM10" value={formatNum(numOrNull(props.pm10), "µg/m³")} mono />
      <Row label="O₃" value={formatNum(numOrNull(props.o3), "ppb", 1)} />
      <Row label="NO₂" value={formatNum(numOrNull(props.no2), "ppb", 1)} />
      <Row label="SO₂" value={formatNum(numOrNull(props.so2), "ppb", 2)} />
      <Row label="CO" value={formatNum(numOrNull(props.co), "ppm", 2)} />
      <Row label={tr("popup.air.windSpeed")} value={formatNum(numOrNull(props.windSpeed), "m/s", 1)} />
      <Row field="observedAt" value={observedAt ? observedAt.slice(0, 16).replace("T", " ") : ""} />
    </>
  );
}

export function MicroSensorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const pm25 = numOrNull(props.pm25);
  // 標題色點對齊面板主數值（PM2.5），故固定用 colorPm25，不隨圖層顯示模式跑
  const color = String(props.colorPm25 ?? "#707070");
  const temperature = Number(props.temperature);
  const tempStr = Number.isFinite(temperature) && temperature > -100 ? `${temperature.toFixed(1)} °C` : "";
  const observedAt = String(props.observedAt ?? "");
  // site_name 是 RPC 升級後才有的欄位 → 空字串/未定義時 fallback deviceId
  const siteName = String(props.siteName ?? "").trim();
  const title = siteName || String(props.deviceId ?? "LASS Device");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: t.bgSubtle,
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color }}>
          {pm25 != null ? pm25.toFixed(1) : "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>PM2.5 µg/m³</span>
      </div>
      {/* 標題被站名佔走時，device_id 改用一列補回，避免資訊遺失 */}
      {siteName && <Row label={tr("popup.air.deviceId")} value={String(props.deviceId ?? "")} />}
      <Row field="source" value={String(props.source ?? "")} />
      <Row label={tr("popup.air.device")} value={String(props.app ?? "")} />
      <Row label={tr("popup.air.area")} value={String(props.area ?? "")} />
      <Row label="PM10" value={formatNum(numOrNull(props.pm10), "µg/m³")} mono />
      <Row label="PM1" value={formatNum(numOrNull(props.pm1), "µg/m³")} />
      <Row label={tr("popup.air.temperature")} value={tempStr} />
      <Row label={tr("popup.air.humidity")} value={formatNum(numOrNull(props.humidity), "%")} />
      <Row field="observedAt" value={observedAt ? observedAt.slice(0, 16).replace("T", " ") : ""} />
    </>
  );
}

/**
 * 溫度網格 2D — 溫度值來自 feature-state（useMapInteraction 會把 state 併進 properties），
 * 對應時間讀 factory 記的「最近一次 flush 時間」（feature-state 只寫差異，時間不能塞每格）。
 */
export function TemperatureGridPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr, formatDateTime } = useLocale();
  // ⚠️ 不能用 numOrNull：它把負數視為無效，山區可能低於 0°C
  const temp = finiteOrNull(props.temp);
  const color = temp != null ? temperatureGridColor(temp) : "#707070";
  // 溫度是點擊當下的 snapshot（props 每次點擊換新物件），時間也凍結在同一刻，
  // 否則面板開著拖時間軸會出現「時間走了、溫度沒走」的錯配
  const frameTime = useMemo(() => getTemperatureGridFrameTime(), [props]);
  const timeStr = frameTime > 0
    ? formatDateTime(new Date(frameTime * 1000), {
        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    : "";
  const lng = finiteOrNull(props.lng);
  const lat = finiteOrNull(props.lat);
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 2,
          padding: "6px 8px",
          background: t.bgSubtle,
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color }}>
          {temp != null ? temp.toFixed(1) : "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>°C</span>
      </div>
      <Row field="time" value={timeStr} />
      <Row
        label={tr("popup.air.gridPoint")}
        value={lng != null && lat != null ? `${lng.toFixed(3)}, ${lat.toFixed(3)}` : ""}
      />
      <Row field="source" value={tr("popup.air.gridSource")} />
    </>
  );
}

// ── raster 值探針（W2）────────────────────────────────────────────
/**
 * 值編碼 raster 的點擊讀值 popup。`urbanHeat`（熱島）與 `canopyHeight`（樹冠高度）
 * **共用同一個 layerType `rasterProbe`**，理由與 `climateField`（風場／海流共用一個
 * panel）完全相同：兩層可能同時開啟，一次點擊就該同時得到兩個讀數；硬拆成兩個
 * layerType 會被迫訂一個任意優先序，讓另一層在同開時永遠讀不到。
 *（一個 popup type 被多個 manifest key 宣告是既有形狀，如 railStation 之於
 *  stationsTRA / stationsMetro / stationsTHSR。）
 *
 * 取樣與解碼在 `src/data/rasterProbeSampler.ts`，常數取自 urbanHeatTypes.ts 與
 * overlayRegistry 的 canopyHeight 註解兩個既有 SSOT；本檔只負責呈現。
 */
export function RasterProbePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const heat = props.urbanHeat as { delta_t: number; lst_c: number } | null | undefined;
  const canopy = props.canopyHeight as { height_m: number } | null | undefined;
  const jpCanopy = props.jpCanopyHeight as { height_m: number; source: string; coverage: string; resolution: string } | null | undefined;
  return (
    <div>
      {heat && (
        <>
          {/* ΔT =「比同期背景熱幾度」，正負號本身就是訊息 → 正值明確帶 + 號 */}
          <Row
            label={tr("popup.air.heatIntensity")}
            value={`${heat.delta_t > 0 ? "+" : ""}${heat.delta_t.toFixed(1)} K`}
            color={heat.delta_t > 0 ? "#ef4444" : "#38bdf8"}
          />
          <Row label={tr("popup.air.surfaceTemp")} value={`${heat.lst_c.toFixed(1)} °C`} />
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, marginBottom: 6 }}>
            {tr("popup.air.landsatNote")}
          </div>
        </>
      )}
      {canopy && (
        <>
          <Row label={tr("popup.air.canopyHeight")} value={tr("popup.air.meters", { value: canopy.height_m.toFixed(0) })} color="#238b45" />
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2 }}>
            {tr("popup.air.canopyNote")}
          </div>
        </>
      )}
      {jpCanopy && (
        <>
          <Row label={tr("popup.air.jpCanopyHeight")} value={tr("popup.air.meters", { value: jpCanopy.height_m.toFixed(0) })} color="#238b45" />
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2 }}>
            {tr("popup.air.jpCanopyNote", { source: jpCanopy.source, coverage: jpCanopy.coverage, resolution: jpCanopy.resolution })}
          </div>
        </>
      )}
    </div>
  );
}
