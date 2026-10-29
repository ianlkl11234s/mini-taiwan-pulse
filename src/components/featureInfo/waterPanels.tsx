import { useEffect, useState } from "react";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { FONT_DATA, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { fetchFloodSensorTimeseries } from "../../data/floodSensorLoader";
import { FLOOD_HAZARD_SOURCE } from "../../data/floodScenarios";
import { fetchRiverLevelTimeseries } from "../../data/riverLevelLoader";
import { fetchGroundwaterTimeseries } from "../../data/groundwaterLoader";
import { fetchRainGaugeTimeseries } from "../../data/rainGaugeLoader";
import { BRIDGE_TABLE_URL } from "../../data/bridgeRainThresholds";
import type { ReservoirContext } from "../../data/reservoirContextLoader";
import { Row, SourceFooter, formatTaiwanTime, formatTaiwanMinute } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName, placeTown } from "../../i18n/placeText";
import { useFeatureTheme } from "./featureTheme";
import { RESERVOIR_ALERT_LEGEND, reservoirAlertCss, reservoirFlatAlert } from "../../map/r6FlatEncodings";

/** 水利設施類型對應色 / 標籤 */
const WATER_FACILITY_TYPE: Record<string, { color: string; label: string }> = {
  pump_station: { color: "#60a5fa", label: "抽水站 (OSM)" },
  pump_station_official: { color: "#2563eb", label: "官方抽水站 (WRA)" },
  treatment_plant: { color: "#34d399", label: "自來水廠 / 淨水場" },
  water_tower: { color: "#fbbf24", label: "水塔" },
};

/** 監測站類型對應色 / 標籤 */
const WATER_MONITOR_TYPE: Record<string, { color: string; label: string }> = {
  rain_gauge: { color: "#60a5fa", label: "雨量站" },
  river_level: { color: "#22d3ee", label: "河川水位站" },
  groundwater_well: { color: "#f472b6", label: "地下水觀測井" },
};

/** 湖泊/埤塘 water 分類對應色 / 標籤（同 overlayRegistry lakesPondsOsm match 色票）*/
const LAKES_PONDS_TYPE: Record<string, { color: string; label: string }> = {
  pond: { color: "#4fc3f7", label: "埤塘 Pond" },
  lake: { color: "#1e88e5", label: "湖泊 Lake" },
  reservoir: { color: "#00acc1", label: "水塘 Reservoir (OSM 自標)" },
  basin: { color: "#7e57c2", label: "水池 Basin" },
};

function areaHa(v: unknown, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${formatNumber(n, { maximumFractionDigits: 2 })} ha` : "";
}

/** 警示燈號顏色（對齊 reservoir_situation_v 的 alert_level 輸出） */
const ALERT_COLORS: Record<string, string> = {
  critical: "#ef4444", // 紅
  warning:  "#f97316", // 橘
  normal:   "#22d3ee", // 青
  high:     "#22c55e", // 綠（滿水）
};

const ALERT_LABELS: Record<string, string> = {
  critical: "嚴重",
  warning:  "偏低",
  normal:   "正常",
  high:     "滿水",
};

export function WaterFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const type = String(props.facility_type ?? "");
  const meta = WATER_FACILITY_TYPE[type] ?? { color: "#9ca3af", label: type };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedFacility"))}
        </div>
      </div>
      <Row field="type" value={enumLabel("waterFacilityType", type, meta.label, i18n)} color={meta.color} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row label={i18n.t("popup.water.operator")} value={String(props.operator ?? "")} />
      <Row field="dataSource" value={String(props.source ?? "")} />
    </>
  );
}

export function WaterMonitorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const type = String(props.station_type ?? "");
  const meta = WATER_MONITOR_TYPE[type] ?? { color: "#9ca3af", label: type };
  const isActive = props.is_active === true || props.is_active === "true";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedStation"))}
        </div>
      </div>
      <Row field="type" value={enumLabel("waterMonitorType", type, meta.label, i18n)} color={meta.color} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="dataSource" value={String(props.source ?? "")} />
      <Row field="status" value={i18n.t(isActive ? "popup.water.enabled" : "popup.water.disabled")} color={isActive ? "#4ade80" : "#9ca3af"} />
    </>
  );
}

export function WaterDetentionBasinPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { formatNumber } = i18n;
  const COUNTY_LABEL: Record<string, string> = {
    tainan: "台南", taoyuan: "桃園", taipei: "台北", kaohsiung: "高雄",
    taichung: "台中", hsinchu_park: "新竹科學園區",
    central_park: "中科園區", south_park: "南科園區",
  };
  const county = String(props.county ?? "");
  const areaHa = props.area_ha != null ? Number(props.area_ha) : null;
  const areaM2 = props.area_m2 != null ? Number(props.area_m2) : null;
  const designed = props.designed_volume_m3 != null ? Number(props.designed_volume_m3) : null;
  const depth = props.max_depth_m != null ? Number(props.max_depth_m) : null;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#0284c7", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedDetention"))}
        </div>
      </div>
      <Row field="county" value={enumLabel("waterDetentionCounty", county, COUNTY_LABEL[county] ?? county, i18n)} />
      {props.township ? <Row field="township" value={placeTown(county, String(props.township), i18n)} /> : null}
      {props.address ? <Row field="address" value={String(props.address)} /> : null}
      {props.agency ? <Row field="managingAgency" value={String(props.agency)} /> : null}
      {areaHa != null && Number.isFinite(areaHa)
        ? <Row field="area" value={`${formatNumber(areaHa)} ha`} />
        : areaM2 != null && Number.isFinite(areaM2)
          ? <Row field="area" value={`${formatNumber(areaM2)} m²`} />
          : null}
      {designed != null && Number.isFinite(designed)
        ? <Row label={i18n.t("popup.water.designedVolume")} value={`${formatNumber(designed)} m³`} />
        : null}
      {depth != null && Number.isFinite(depth)
        ? <Row label={i18n.t("popup.water.maxDepth")} value={`${depth} m`} />
        : null}
      {props.status ? <Row field="status" value={String(props.status)} /> : null}
      <Row field="dataSource" value={String(props.source ?? "")} />
    </>
  );
}

export function WaterDamPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { formatNumber } = i18n;
  const kind = String(props.kind ?? "");
  const isDam = kind === "dam";
  const accentColor = isDam ? "#7dd3fc" : "#22d3ee";
  const label = i18n.t(isDam ? "popup.water.damLabel" : kind === "reservoir" ? "popup.water.reservoirLiveLabel" : "popup.water.reservoirPointLabel");
  const capacity = props.capacity_m3 ?? props.effective_capacity_wan;
  const capacityStr = capacity
    ? isDam
      ? `${formatNumber(Number(capacity))} m³`
      : `${formatNumber(Number(capacity))} ${i18n.t("popup.water.unitWanM3")}`
    : "";
  const nameEn = String(props.name_en ?? "");
  const hintColor = "rgba(255,170,80,0.65)";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamed"))}
        </div>
      </div>
      {nameEn && <Row label="English" value={nameEn} />}
      <Row field="category" value={label} color={accentColor} />
      <Row field="basin" value={String(props.basin_name ?? "")} />
      <Row field="river" value={String(props.river_name ?? "")} />
      <Row label={i18n.t("popup.water.damHeight")} value={props.dam_height_m ? `${props.dam_height_m} m` : ""} />
      <Row field="capacity" value={capacityStr} />
      {/* R6 段 2：即時水情（平面圓點與 3D 水位計共用 reservoirFeatureProps；缺值不顯示該列） */}
      {kind === "reservoir" && <ReservoirLiveRows props={props} />}
      {isDam && (
        <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: hintColor, lineHeight: 1.5 }}>
          {i18n.t("popup.water.damHint")}
        </div>
      )}
    </>
  );
}

/** 水庫即時水情列：蓄水率（警示色）、警示等級、水位、有效蓄水量、資料時間 */
function ReservoirLiveRows({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const pct = typeof props.storage_ratio_pct === "number" ? props.storage_ratio_pct : null;
  const alert = reservoirFlatAlert(pct);
  const label = enumLabel("reservoirFlatAlert", alert, RESERVOIR_ALERT_LEGEND.find((r) => r.key === alert)?.label ?? "", i18n);
  const level = typeof props.water_level_m === "number" ? props.water_level_m : null;
  const storage = typeof props.effective_storage_wan_m3 === "number" ? props.effective_storage_wan_m3 : null;
  return (
    <>
      <Row label={i18n.t("popup.water.storageRatio")} value={pct == null ? i18n.t("popup.common.noData") : `${pct.toFixed(1)}%`} color={reservoirAlertCss(alert)} mono={pct != null} />
      <Row label={i18n.t("popup.water.waterStatus")} value={label} color={reservoirAlertCss(alert)} />
      <Row label={i18n.t("popup.water.waterLevel")} value={level == null ? "" : `${level.toFixed(2)} m`} mono />
      <Row label={i18n.t("popup.water.effectiveStorage")} value={storage == null ? "" : `${i18n.formatNumber(Math.round(storage))} ${i18n.t("popup.water.unitWanM3")}`} mono />
      <Row label={i18n.t("popup.water.dataTime")} value={formatTaiwanTime(typeof props.snapshot_at === "string" ? props.snapshot_at : null)} />
    </>
  );
}

export function RiverLevelPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const stationId = String(props.station_id ?? "");
  const level = Number(props.water_level_m) || 0;
  const check = Number(props.check_result);
  const abnormal = check === 0;
  const color = abnormal ? "#ef4444" : "#22d3ee";
  const obs = String(props.observed_at ?? "");

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stationId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchRiverLevelTimeseries(stationId, 24)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows
          .filter((r) => r.water_level_m != null)
          .map((r) => ({ t: Date.parse(r.observed_at) / 1000, v: Number(r.water_level_m) })));
      })
      .catch((e) => console.warn("[RiverLevel] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stationId]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.station_name ?? i18n.t("popup.water.unnamedStation"))}
        </div>
        {abnormal && (
          <div
            style={{
              marginLeft: "auto",
              fontSize: FONT_SIZE.sm,
              padding: "2px 8px",
              borderRadius: RADIUS.md,
              background: color,
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {i18n.t("popup.water.abnormal")}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: "rgba(34,211,238,0.08)",
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color }}>
          {level.toFixed(2)}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("popup.water.levelUnit")}</span>
      </div>
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <Row field="stationNo" value={String(props.station_id ?? "")} color={t.textDim} />

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {i18n.t("popup.water.trend24h")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          {i18n.t("popup.common.loading")}
        </div>
      ) : (
        <TimeseriesSparkline data={series} unit="m" lineColor={color} height={120} />
      )}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        {i18n.t("popup.water.alertHint")}
      </div>
    </>
  );
}

export function GroundwaterPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const stationId = String(props.station_id ?? "");
  const levelRaw = props.water_level_m;
  const level = levelRaw == null ? null : Number(levelRaw);
  const obs = String(props.observed_at ?? "");

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stationId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchGroundwaterTimeseries(stationId, 24)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows
          .filter((r) => r.water_level_m != null)
          .map((r) => ({ t: Date.parse(r.observed_at) / 1000, v: Number(r.water_level_m) })));
      })
      .catch((e) => console.warn("[Groundwater] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stationId]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#0ea5e9", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.well_name ?? i18n.t("popup.water.unnamedWell"))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: "rgba(14,165,233,0.1)",
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color: "#38bdf8" }}>
          {level != null ? level.toFixed(2) : "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("popup.water.groundwaterUnit")}</span>
      </div>
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <Row label={i18n.t("popup.water.wellNo")} value={String(props.station_id ?? "")} color={t.textDim} />

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {i18n.t("popup.water.trend24h")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          {i18n.t("popup.common.loading")}
        </div>
      ) : (
        <TimeseriesSparkline data={series} unit="m" lineColor="#38bdf8" height={120} />
      )}
    </>
  );
}

export function FloodSensorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const stationId = String(props.iow_station_id ?? "");
  const name = String(props.name ?? i18n.t("popup.water.unnamedStation"));
  const depthCm = Number(props.depth_cm) || 0;
  const unit = String(props.si_unit ?? "cm");
  const obs = String(props.observed_at ?? "");
  const county = String(props.county_name ?? "");
  const town = String(props.town_name ?? "");
  const admin = String(props.admin_name ?? "");

  let color = "#404040";
  let level = i18n.t("popup.water.floodNone");
  if (depthCm >= 30) { color = "#7f1d1d"; level = i18n.t("popup.water.floodExtreme"); }
  else if (depthCm >= 15) { color = "#ef4444"; level = i18n.t("popup.water.floodSevere"); }
  else if (depthCm >= 5)  { color = "#fb923c"; level = i18n.t("popup.water.floodModerate"); }
  else if (depthCm > 0)   { color = "#fde047"; level = i18n.t("popup.water.floodMild"); }

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stationId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchFloodSensorTimeseries(stationId, 24)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows.map((r) => ({ t: Date.parse(r.observed_at) / 1000, v: r.value ?? 0 })));
      })
      .catch((e) => console.warn("[FloodSensor] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stationId]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        {depthCm > 0 && (
          <div style={{
            marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
            background: color, color: "#fff", fontWeight: 600,
          }}>
            {level}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex", alignItems: "baseline", gap: 8, marginTop: 4,
          padding: "6px 8px", background: `${color}1a`, borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color }}>
          {depthCm.toFixed(1)}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{i18n.t("popup.water.floodUnit", { unit })}</span>
      </div>
      {(county || town) && <Row field="region" value={[placeName(county, i18n), placeTown(county, town, i18n)].filter(Boolean).join(" / ")} />}
      {admin && <Row field="managingAgency" value={admin} />}
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {i18n.t("popup.water.trend24h")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          {i18n.t("popup.common.loading")}
        </div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit={unit}
          warningValue={depthCm >= 5 ? 5 : null}
          warningLabel={i18n.t("popup.water.ponding")}
          lineColor={color}
          height={120}
        />
      )}
    </>
  );
}

interface BridgeRainReading {
  id: string; name: string | null; observed_at: string;
  p1: number | null; p3: number | null; p6: number | null; p24: number | null;
}

export function BridgeRainPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  let readings: BridgeRainReading[] = [];
  try { readings = JSON.parse(String(props.readings_json ?? "[]")) as BridgeRainReading[]; } catch { /* unknown data stays empty */ }
  const mm = (value: number | null) => value == null ? i18n.t("popup.water.bridgeMissing") : `${value} mm`;
  const status = String(props.status ?? "unknown");
  const color = status === "triggered" ? "#ef4444" : status === "below" ? "#3b82f6" : "#94a3b8";
  return <div>
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{String(props.bridge_name ?? i18n.t("popup.water.bridgeDefault"))}</div>
    <Row field="roadSection" value={String(props.route ?? "")} />
    <Row label={i18n.t("popup.water.rainJudgement")} value={String(props.status_label ?? i18n.t("popup.common.unknown"))} color={color} />
    <Row field="limits" value={String(props.status_reason ?? "")} />
    <Row label={i18n.t("popup.water.refStations")} value={String(props.station_ids ?? "")} />
    {readings.map((r) => <div key={r.id} style={{ marginTop: 8, padding: 8, border: `1px solid ${t.textMuted}`, borderRadius: 6, color: t.textStrong, fontSize: FONT_SIZE.sm }}>
      <div>{r.name ?? r.id}（{r.id}）</div>
      <div>1h {mm(r.p1)}｜3h {mm(r.p3)}｜6h {mm(r.p6)}｜24h {mm(r.p24)}</div>
      <div>{i18n.t("popup.water.observedColon", { time: formatTaiwanTime(r.observed_at) })}</div>
    </div>)}
    <Row label={i18n.t("popup.water.tableVersion")} value={String(props.table_version ?? "")} />
    <Row label={i18n.t("popup.water.bridgePosition")} value={String(props.location_source ?? "")} />
    <Row field="remarks" value={String(props.note ?? "")} />
    <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm }}>
      <a href={BRIDGE_TABLE_URL} target="_blank" rel="noopener noreferrer">{i18n.t("popup.water.bridgeTableLink")}</a>
      {" · "}<a href={String(props.location_url ?? "#")} target="_blank" rel="noopener noreferrer">{i18n.t("popup.water.osmBridge")}</a>
    </div>
    <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: t.textMuted }}>{i18n.t("popup.water.bridgeDisclaimer")}</div>
  </div>;
}

export function RainGaugePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const stationId = String(props.station_id ?? "");
  const p10 = Number(props.precipitation_10min) || 0;
  const p1 = Number(props.precipitation_1hr) || 0;
  const p3 = Number(props.precipitation_3hr) || 0;
  const p24 = Number(props.precipitation_24hr) || 0;
  const obs = String(props.observed_at ?? "");

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!stationId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchRainGaugeTimeseries(stationId, 24)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows.map((r) => ({
          t: Date.parse(r.observed_at) / 1000,
          v: Number(r.precipitation_1hr ?? 0),
        })));
      })
      .catch((e) => console.warn("[RainGauge] timeseries fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [stationId]);

  // CWA 分級（依 1hr）
  const level =
    p1 >= 200 ? { label: i18n.t("popup.water.rainExtreme"), color: "#ef4444" } :
    p1 >= 80  ? { label: i18n.t("popup.water.rainTorrential"), color: "#f97316" } :
    p1 >= 40  ? { label: i18n.t("popup.water.rainVeryHeavy"), color: "#fbbf24" } :
    p1 >= 15  ? { label: i18n.t("popup.water.rainHeavy"), color: "#22c55e" } :
    p1 >= 2.5 ? { label: i18n.t("popup.water.rainModerate"), color: "#3b82f6" } :
    p1 > 0    ? { label: i18n.t("popup.water.rainLight"), color: "#93c5fd" } :
                { label: i18n.t("popup.water.rainNone"), color: "#6b7280" };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: level.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.station_name ?? i18n.t("popup.water.unnamedStation"))}
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: FONT_SIZE.sm,
            padding: "2px 8px",
            borderRadius: RADIUS.md,
            background: level.color,
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {level.label}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: "rgba(59,130,246,0.08)",
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color: level.color }}>
          {p10.toFixed(1)}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>mm / 10 min</span>
      </div>
      <Row label={i18n.t("popup.water.accum1h")} value={`${p1.toFixed(1)} mm`} />
      <Row label={i18n.t("popup.water.accum3h")} value={`${p3.toFixed(1)} mm`} />
      <Row label={i18n.t("popup.water.accum24h")} value={`${p24.toFixed(1)} mm`} />
      <Row field="county" value={[placeName(String(props.county ?? ""), i18n), placeTown(String(props.county ?? ""), String(props.town ?? ""), i18n)].filter(Boolean).join(" ")} />
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <Row field="stationNo" value={String(props.station_id ?? "")} color={t.textDim} />

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        {i18n.t("popup.water.rainTrend")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          {i18n.t("popup.common.loading")}
        </div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit="mm"
          warningValue={15}
          warningLabel={i18n.t("popup.water.rainHeavy")}
          lineColor={level.color}
          height={120}
        />
      )}
    </>
  );
}

export function WaterReservoirContextPanel({ ctx }: { ctx: ReservoirContext }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { formatNumber } = i18n;
  const r = ctx.reservoir;
  const s = ctx.latest_status;
  const w = ctx.watershed;
  const b = ctx.basin;
  const nr = ctx.nearest_river;

  const storageRatio = s?.storage_ratio_pct ?? null;
  const alert = s?.alert_level ?? "";
  const alertColor = ALERT_COLORS[alert] ?? "#94a3b8";
  const alertLabel = enumLabel("reservoirAlertLevel", alert, ALERT_LABELS[alert] ?? alert, i18n);
  const accent = "#22d3ee";

  const capacityWan = r?.capacity_effective_m3 != null
    ? (r.capacity_effective_m3 / 10000).toFixed(0)
    : null;
  const storageWanM3 = s?.effective_storage_wan_m3 ?? null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {r?.res_name ?? i18n.t("popup.water.unnamedReservoir")}
        </div>
        {r?.compare_id != null && (
          <div
            style={{
              marginLeft: "auto",
              fontSize: FONT_SIZE.xs,
              fontFamily: FONT_DATA,
              color: t.textDim,
            }}
          >
            #{r.compare_id}
          </div>
        )}
      </div>

      {storageRatio != null && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 6,
            padding: "8px 10px",
            background: "rgba(34,211,238,0.08)",
            borderRadius: RADIUS.md,
            border: "1px solid rgba(34,211,238,0.2)",
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>
            {storageRatio.toFixed(1)}
          </span>
          <span style={{ fontSize: FONT_SIZE.base, color: t.textDefault }}>{i18n.t("popup.water.storageRatioUnit")}</span>
          {alert && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: FONT_SIZE.sm,
                padding: "2px 8px",
                borderRadius: RADIUS.md,
                background: alertColor,
                color: "#fff",
                fontWeight: 600,
              }}
            >
              {alertLabel}
            </span>
          )}
        </div>
      )}

      {/* 水情 */}
      {storageWanM3 != null && capacityWan && (
        <Row label={i18n.t("popup.water.storageVolume")} value={`${formatNumber(Number(storageWanM3))} / ${formatNumber(Number(capacityWan))} ${i18n.t("popup.water.unitWanM3")}`} />
      )}
      {s?.water_level_m != null && (
        <Row label={i18n.t("popup.water.waterLevel")} value={`${Number(s.water_level_m).toFixed(2)} m`} />
      )}
      {s?.inflow_cms != null && (
        <Row label={i18n.t("popup.water.inflow")} value={`${Number(s.inflow_cms).toFixed(1)} cms`} />
      )}
      {s?.total_outflow_cms != null && (
        <Row label={i18n.t("popup.water.totalOutflow")} value={`${Number(s.total_outflow_cms).toFixed(1)} cms`} />
      )}
      {s?.basin_rainfall_mm != null && (
        <Row label={i18n.t("popup.water.basinRainfall")} value={`${Number(s.basin_rainfall_mm).toFixed(1)} mm`} />
      )}
      {s?.snapshot_at && (
        <Row label={i18n.t("popup.water.updatedAt")} value={formatTaiwanMinute(s.snapshot_at)} />
      )}

      {/* 淤積 */}
      {r?.silt_ratio_pct != null && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
          <Row
            label={i18n.t("popup.water.siltRatio")}
            value={`${r.silt_ratio_pct.toFixed(1)}% (${r.latest_measured_at ?? "—"})`}
            color={r.silt_ratio_pct > 30 ? "#f97316" : "#94a3b8"}
          />
        </div>
      )}

      {/* 空間關聯 */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
        {w?.area_km2 != null && (
          <Row
            label={i18n.t("popup.water.catchment")}
            value={`${formatNumber(Number(w.area_km2))} km²${w.unit ? ` · ${w.unit}` : ""}`}
            color={accent}
          />
        )}
        {b?.basin_name && (
          <Row label={i18n.t("popup.water.inBasin")} value={b.basin_name} color="#a78bfa" />
        )}
        {nr?.river_name && nr.dist_m != null && (
          <Row
            label={i18n.t("popup.water.nearestRiver")}
            value={`${nr.river_name} (${formatNumber(Number(nr.dist_m))} m)`}
            color="#38bdf8"
          />
        )}
      </div>

      {/* 基本屬性 */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
        {r?.county && <Row field="county" value={placeName(String(r.county), i18n)} />}
        {r?.org_mng && <Row label={i18n.t("popup.water.management")} value={r.org_mng} />}
        {r?.dam_height_m != null && <Row label={i18n.t("popup.water.damHeight")} value={`${r.dam_height_m} m`} />}
        {r?.status && <Row field="status" value={r.status} />}
      </div>
    </>
  );
}

export function WaterReservoirPolyPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const name = String(props.name ?? i18n.t("popup.water.unnamedReservoir"));
  const accent = "#22d3ee";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {name}
        </div>
      </div>
      <Row field="category" value={i18n.t("popup.water.storageSurface")} color={accent} />
      <Row field="dataSource" value="WRA GIC reservoir_storage" />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        {i18n.t("popup.water.polyHint")}
      </div>
    </>
  );
}

export function LakesPondsPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { formatNumber } = i18n;
  const type = String(props.water ?? "");
  const meta = LAKES_PONDS_TYPE[type] ?? { color: "#4fc3f7", label: type || i18n.t("popup.water.lakesDefault") };
  const name = String(props.name ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {name || enumLabel("lakesPondsType", type, meta.label, i18n)}
        </div>
      </div>
      <Row field="category" value={enumLabel("lakesPondsType", type, meta.label, i18n)} color={meta.color} />
      <Row field="area" value={areaHa(props.area_ha, formatNumber)} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        {i18n.t("popup.water.lakesHint")}
      </div>
    </>
  );
}

/**
 * 淹水潛勢（水利署 10 降雨情境，`scripts/export/export-flood-scenarios.sh`）。
 * 色票與 overlayRegistry `waterFloodExtreme` fill-color match 同一張；
 * depth_class 已在匯出時正規化，未知值退回原字串＋預設色。
 */
const FLOOD_DEPTH_COLOR: Record<string, string> = {
  "0.3-0.5": "#fee2e2", "0.5-1.0": "#fca5a5", "1.0-2.0": "#f87171", "2.0-3.0": "#dc2626", ">3.0": "#7f1d1d",
};

export function WaterFloodHazardPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const depth = String(props.depth_class ?? "");
  const color = FLOOD_DEPTH_COLOR[depth] ?? "#fca5a5";
  const depthText = depth.startsWith(">") ? `> ${depth.slice(1)} m` : depth ? `${depth.replace("-", "–")} m` : "";
  const hours = Number(props.duration_hr);
  const mm = Number(props.rainfall_mm);
  const county = String(props.county ?? "");
  const town = String(props.town ?? "");
  const place = [placeName(county, i18n), town ? placeTown(county, town, i18n) : ""].filter(Boolean).join(" ");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {i18n.t("popup.water.floodHazardTitle")}
        </div>
      </div>
      {Number.isFinite(hours) && Number.isFinite(mm) && hours > 0 && (
        <Row label={i18n.t("popup.water.floodHazardScenario")} value={i18n.t("popup.water.floodHazardScenarioValue", { hours, mm })} />
      )}
      <Row label={i18n.t("popup.water.floodHazardDepth")} value={depthText} color={color} mono />
      <Row field="countyTownship" value={place} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: t.textMuted, lineHeight: 1.5 }}>
        {i18n.t("popup.water.floodHazardDisclaimer")}
      </div>
      <SourceFooter props={{ ...props, ...FLOOD_HAZARD_SOURCE }} />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
//  W2 popup 補強：水資源 8 層
//  （no-popup-audit §5 工作包 1 + 2；欄位語意出處逐個標在各 panel 上方）
// ══════════════════════════════════════════════════════════════════

/** IoT 站共用的「讀值 + 變化量」大字區塊（河川水位站 / 水工結構共用）。 */
function IotReadingBlock({
  value, unit, deltaLabel, delta, color,
}: {
  value: number | null;
  unit: string;
  deltaLabel: string;
  delta: number | null;
  color: string;
}) {
  const t = useFeatureTheme();
  return (
    <>
      <div
        style={{
          display: "flex", alignItems: "baseline", gap: 8, marginTop: 4,
          padding: "6px 8px", background: `${color}1a`, borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color, fontFamily: FONT_DATA }}>
          {value != null && Number.isFinite(value) ? value.toFixed(2) : "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{unit}</span>
      </div>
      {delta != null && Number.isFinite(delta) && (
        <Row
          label={deltaLabel}
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(2)} ${unit}`}
          color={delta > 0 ? "#f87171" : delta < 0 ? "#4ade80" : undefined}
        />
      )}
    </>
  );
}

/**
 * IoT 河川水位站（1,634 站，與既有 riverLevel 831 站僅重疊 266 對）。
 * 欄位由 useIotWraRiverLayer.buildFC 逐欄烤進 properties：
 *   name / measurement_name / si_unit / value / delta_m / observed_at / iow_station_id
 * `delta_m` = 當下讀值 − 該站基準水位（hook 內的 baseLevel）。
 */
export function IotWraRiverPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const value = props.value == null ? null : Number(props.value);
  const delta = props.delta_m == null ? null : Number(props.delta_m);
  const unit = String(props.si_unit ?? "m");
  const obs = String(props.observed_at ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#22d3ee", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedStation"))}
        </div>
      </div>
      <IotReadingBlock value={value} unit={unit} deltaLabel={i18n.t("popup.water.vsBaseline")} delta={delta} color="#22d3ee" />
      <Row field="measurement" value={String(props.measurement_name ?? "")} />
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <Row field="stationNo" value={String(props.iow_station_id ?? "")} color={t.textDim} />
    </>
  );
}

/**
 * IoT 水工結構（堰壩 / 閘門 / 累計流量 / 河床沖刷 / 揚塵 5 類）。
 * 欄位由 useIotWraStructureLayer.buildFC 烤進 properties；`station_type` 的
 * 5 個值域與色票逐字取自該 hook 的 colorByType()，中文標籤對齊
 * LegendPanel 的 IOT_STRUCTURE_TYPES（不另立第二套說法）。
 */
const IOT_STRUCTURE_TYPE: Record<string, { color: string; label: string }> = {
  cumulativeflow: { color: "#a855f7", label: "累計流量" },
  watergate: { color: "#f97316", label: "閘門" },
  damstructure: { color: "#dc2626", label: "堤防安全" },
  erosiondepth: { color: "#eab308", label: "河床沖刷" },
  dustemission: { color: "#92400e", label: "揚塵" },
};

export function IotWraStructurePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const type = String(props.station_type ?? "");
  const info = IOT_STRUCTURE_TYPE[type];
  const color = info?.color ?? "#94a3b8";
  const value = props.value == null ? null : Number(props.value);
  const delta = props.delta_since_day_start == null ? null : Number(props.delta_since_day_start);
  const unit = String(props.si_unit ?? "");
  const obs = String(props.observed_at ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedStation"))}
        </div>
      </div>
      <Row field="type" value={enumLabel("iotStructureType", type, info?.label ?? type, i18n)} color={color} />
      <IotReadingBlock value={value} unit={unit} deltaLabel={i18n.t("popup.water.dailyChange")} delta={delta} color={color} />
      <Row field="measurement" value={String(props.measurement_name ?? "")} />
      <Row field="county" value={placeName(String(props.county_name ?? ""), i18n)} />
      {obs && <Row field="observedAt" value={formatTaiwanMinute(obs)} />}
      <Row field="stationNo" value={String(props.iow_station_id ?? "")} color={t.textDim} />
    </>
  );
}

/**
 * 流域（116 面）。欄位：basin_name / basin_no / area_km2。
 * ⚠️ `area_km2` 的**實際單位是平方公尺**，不是欄名寫的 km²：高屏溪 3,320,411,198
 *    ÷ 1e6 = 3,320 km²（實際 3,257 km²）、淡水河 2,734 km²（實際 2,726 km²）、
 *    濁水溪 3,167 km²（實際 3,157 km²）三個獨立對照都落在 2% 內 → 顯示前先 ÷ 1e6。
 *    上游欄名待修（docs/data-catalog/water_resources/river_basins_wra.md）。
 */
export function WaterBasinsPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { formatNumber } = i18n;
  const areaM2 = Number(props.area_km2);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#0891b2", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.basin_name ?? i18n.t("popup.water.unnamedBasin"))}
        </div>
      </div>
      {Number.isFinite(areaM2) && areaM2 > 0 && (
        <Row label={i18n.t("popup.water.catchmentArea")} value={`${formatNumber(areaM2 / 1e6, { maximumFractionDigits: 1 })} km²`} />
      )}
      <Row label={i18n.t("popup.water.basinCode")} value={String(props.basin_no ?? "")} color={t.textDim} />
    </>
  );
}

/**
 * 河川（河道面 13,262 筆）。欄位：river_name / river_type。
 * ⚠️ 只接**面層** `water-river-polygons-fill`：同 layer key 的線層
 *    `water_rivers.geojson`（2,015 筆）三個欄位 100% 是空字串（實測），
 *    接了只會開出空白面板。面層則有 12,210 / 13,262（92%）帶河名。
 * ⚠️ `river_type` 上游只註明「類型（1-5）」，沒有給 1-5 的中文對照
 *    → 原樣顯示代碼，不臆測分級名稱。
 */
export function WaterRiversPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const type = String(props.river_type ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#0284c7", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.river_name ?? i18n.t("popup.water.unnamedRiver"))}
        </div>
      </div>
      <Row label={i18n.t("popup.water.classCode")} value={type} color={t.textDim} />
      <Row label={i18n.t("popup.water.riverCode")} value={String(props.river_code ?? "")} color={t.textDim} />
    </>
  );
}

/**
 * 堤防 / 護岸（4,222 筆）。欄位：name / river / basin / county / levee_type / side / status。
 * `status` 的「待建」已被 overlayRegistry 用 case expression 淡化成虛線，popup 補上文字。
 * ⚠️ `length_m` **不顯示**：欄名與 catalog（river_levees_wra.md L27「長度（公尺）」）都寫公尺，
 *    但實測值域 0.0038 ~ 12.17（平均 0.84）不可能是公尺，匯出腳本
 *    （export-water-static.sh L121）也沒做任何換算 → 單位有疑義，寧可不顯示也不猜。
 */
const LEVEE_STATUS_COLOR: Record<string, string> = {
  已建: "#4ade80",
  待建: "#fbbf24",
};

export function WaterLeveesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const status = String(props.status ?? "");
  const side = String(props.side ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#f59e0b", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedLevee"))}
        </div>
      </div>
      <Row label={i18n.t("popup.water.leveeType")} value={String(props.levee_type ?? "")} />
      <Row field="status" value={enumLabel("leveeStatus", status, status, i18n)} color={LEVEE_STATUS_COLOR[status]} />
      <Row field="river" value={String(props.river ?? "")} />
      <Row field="basin" value={String(props.basin ?? "")} />
      <Row label={i18n.t("popup.water.side")} value={side ? i18n.t("popup.water.sideBank", { side: enumLabel("leveeSide", side, side, i18n) }) : ""} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} color={t.textDim} />
    </>
  );
}

/**
 * 灌排渠道（29,469 條）。PMTiles 欄位是縮寫，語意由上游 pipeline 的白名單確認：
 *   taipei-gis-analytics/pipelines/infrastructure/irrigation_canal/01_fetch_wfs.py
 *   `if tag in ("管理處", "渠道名", "屬性")` → o = 管理處、n = 渠道名、t = 屬性
 *   （docs/data-catalog/infrastructure/irrigation_canal.md L54 列出 t 的三分類）
 * ⚠️ `t` 是「引灌需求屬性」三分類，**不是等級**（manifest description 的「渠道等級」措辭有誤）。
 * ⚠️ src='arcgis' 的 9,918 條（全宜蘭）`n` 與 `t` 恆為空 → 名稱走 fallback，
 *    只剩管理處可顯示，這是資料本身的缺口不是接線問題。
 */
const CANAL_ATTR_COLOR: Record<string, string> = {
  灌溉專用渠道: "#0d9488",
  下游具引灌需求: "#7c3aed",
  下游不具引灌需求: "#64748b",
};

const CANAL_SRC_LABELS: Record<string, string> = {
  wfs: "農田水利署 WFS",
  arcgis: "宜蘭管理處 ArcGIS",
};

export function WaterCanalsPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const name = String(props.n ?? "");
  const office = String(props.o ?? "");
  const attr = String(props.t ?? "");
  const src = String(props.src ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div
          style={{
            width: 10, height: 10, borderRadius: RADIUS.full,
            background: CANAL_ATTR_COLOR[attr] ?? "#64748b", flexShrink: 0,
          }}
        />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {name || (office ? i18n.t("popup.water.canalMissingName", { office }) : i18n.t("popup.water.unnamedCanal"))}
        </div>
      </div>
      <Row label={i18n.t("popup.water.managementOffice")} value={office ? i18n.t("popup.water.officeValue", { office }) : ""} />
      <Row label={i18n.t("popup.water.attribute")} value={attr ? enumLabel("canalAttr", attr, attr, i18n) : ""} color={CANAL_ATTR_COLOR[attr]} />
      <Row label={i18n.t("popup.common.sourceLabel")} value={enumLabel("canalSource", src, CANAL_SRC_LABELS[src] ?? src, i18n)} color={t.textDim} />
    </>
  );
}

/**
 * 水資源管制區（128 面）。欄位：name / zone / law_ref / zone_kind / zone_no。
 * `zone_kind` 的 4 個值域與中文標籤逐字對齊 LegendPanel 的 WATER_PROTECTION_ZONE_CATS
 * （同一份 overlayRegistry match 表，不另立第二套說法）。
 * `law_ref`（公告文號）是這層別處拿不到的資訊 —— 管制區的重點就是「這裡受什麼法規管」。
 */
const PROTECTION_ZONE_KIND: Record<string, { color: string; label: string }> = {
  protection: { color: "#10b981", label: "自來水水質水量保護區" },
  groundwater_control_2: { color: "#ef4444", label: "地下水禁止超抽" },
  groundwater_control_1: { color: "#f97316", label: "地下水限制超抽" },
  groundwater_region: { color: "#94a3b8", label: "地下水分區" },
};

export function WaterProtectionZonesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const kind = String(props.zone_kind ?? "");
  const info = PROTECTION_ZONE_KIND[kind];
  const color = info?.color ?? "#94a3b8";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? i18n.t("popup.water.unnamedZone"))}
        </div>
      </div>
      <Row field="category" value={enumLabel("waterProtectionZone", kind, info?.label ?? kind, i18n)} color={color} />
      <Row label={i18n.t("popup.water.zoneDivision")} value={String(props.zone ?? "")} />
      <Row label={i18n.t("popup.water.lawRef")} value={String(props.law_ref ?? "")} />
      <Row field="number" value={String(props.zone_no ?? "")} color={t.textDim} />
    </>
  );
}
