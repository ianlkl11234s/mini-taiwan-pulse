import { useEffect, useState } from "react";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { FONT_DATA, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { fetchFloodSensorTimeseries } from "../../data/floodSensorLoader";
import { fetchRiverLevelTimeseries } from "../../data/riverLevelLoader";
import { fetchGroundwaterTimeseries } from "../../data/groundwaterLoader";
import { fetchRainGaugeTimeseries } from "../../data/rainGaugeLoader";
import type { ReservoirContext } from "../../data/reservoirContextLoader";
import { Row, formatTaiwanTime } from "./shared";
import { useFeatureTheme } from "./featureTheme";

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

function areaHa(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha` : "";
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
  const type = String(props.facility_type ?? "");
  const meta = WATER_FACILITY_TYPE[type] ?? { color: "#9ca3af", label: type };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "(未命名設施)")}
        </div>
      </div>
      <Row label="類型" value={meta.label} color={meta.color} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="管理者" value={String(props.operator ?? "")} />
      <Row label="資料源" value={String(props.source ?? "")} />
    </>
  );
}

export function WaterMonitorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const type = String(props.station_type ?? "");
  const meta = WATER_MONITOR_TYPE[type] ?? { color: "#9ca3af", label: type };
  const isActive = props.is_active === true || props.is_active === "true";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "(未命名站)")}
        </div>
      </div>
      <Row label="類型" value={meta.label} color={meta.color} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="資料源" value={String(props.source ?? "")} />
      <Row label="狀態" value={isActive ? "啟用" : "停用"} color={isActive ? "#4ade80" : "#9ca3af"} />
    </>
  );
}

export function WaterDetentionBasinPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
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
          {String(props.name ?? "(未命名滯洪池)")}
        </div>
      </div>
      <Row label="縣市" value={COUNTY_LABEL[county] ?? county} />
      {props.township ? <Row label="鄉鎮" value={String(props.township)} /> : null}
      {props.address ? <Row label="地址" value={String(props.address)} /> : null}
      {props.agency ? <Row label="管理單位" value={String(props.agency)} /> : null}
      {areaHa != null && Number.isFinite(areaHa)
        ? <Row label="面積" value={`${areaHa.toLocaleString()} ha`} />
        : areaM2 != null && Number.isFinite(areaM2)
          ? <Row label="面積" value={`${areaM2.toLocaleString()} m²`} />
          : null}
      {designed != null && Number.isFinite(designed)
        ? <Row label="設計容量" value={`${designed.toLocaleString()} m³`} />
        : null}
      {depth != null && Number.isFinite(depth)
        ? <Row label="最大深度" value={`${depth} m`} />
        : null}
      {props.status ? <Row label="狀態" value={String(props.status)} /> : null}
      <Row label="資料源" value={String(props.source ?? "")} />
    </>
  );
}

export function WaterDamPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const kind = String(props.kind ?? "");
  const isDam = kind === "dam";
  const accentColor = isDam ? "#7dd3fc" : "#22d3ee";
  const label = isDam ? "壩體工程位置（WRA 官方）" : "水庫代表點（基本資料）";
  const capacity = props.capacity_m3 ?? props.effective_capacity_wan;
  const capacityStr = capacity
    ? isDam
      ? `${Number(capacity).toLocaleString()} m³`
      : `${Number(capacity).toLocaleString()} 萬 m³`
    : "";
  const nameEn = String(props.name_en ?? "");
  const hintColor = "rgba(255,170,80,0.65)";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "(未命名)")}
        </div>
      </div>
      {nameEn && <Row label="English" value={nameEn} />}
      <Row label="類別" value={label} color={accentColor} />
      <Row label="流域" value={String(props.basin_name ?? "")} />
      <Row label="河川" value={String(props.river_name ?? "")} />
      <Row label="壩高" value={props.dam_height_m ? `${props.dam_height_m} m` : ""} />
      <Row label="容量" value={capacityStr} />
      {isDam && (
        <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: hintColor, lineHeight: 1.5 }}>
          ⓘ 此為壩體工程位置（壩牆出水口），與水庫水面中心點不重合屬正常
        </div>
      )}
    </>
  );
}

export function RiverLevelPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
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
          {String(props.station_name ?? "(未命名站)")}
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
            異常
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
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>m 水位</span>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} />
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="站號" value={String(props.station_id ?? "")} color={t.textDim} />

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        24h 趨勢
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          載入中…
        </div>
      ) : (
        <TimeseriesSparkline data={series} unit="m" lineColor={color} height={120} />
      )}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        ⓘ 警戒水位資料（三級警戒）待上游 seed 補齊後加入
      </div>
    </>
  );
}

export function GroundwaterPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
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
          {String(props.well_name ?? "(未命名井)")}
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
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>m 地下水位（海拔）</span>
      </div>
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="井號" value={String(props.station_id ?? "")} color={t.textDim} />

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        24h 趨勢
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          載入中…
        </div>
      ) : (
        <TimeseriesSparkline data={series} unit="m" lineColor="#38bdf8" height={120} />
      )}
    </>
  );
}

export function FloodSensorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const stationId = String(props.iow_station_id ?? "");
  const name = String(props.name ?? "(未命名站)");
  const depthCm = Number(props.depth_cm) || 0;
  const unit = String(props.si_unit ?? "cm");
  const obs = String(props.observed_at ?? "");
  const county = String(props.county_name ?? "");
  const town = String(props.town_name ?? "");
  const admin = String(props.admin_name ?? "");

  let color = "#404040";
  let level = "無淹水";
  if (depthCm >= 30) { color = "#7f1d1d"; level = "極嚴重 ≥30cm"; }
  else if (depthCm >= 15) { color = "#ef4444"; level = "嚴重 ≥15cm"; }
  else if (depthCm >= 5)  { color = "#fb923c"; level = "中度 ≥5cm"; }
  else if (depthCm > 0)   { color = "#fde047"; level = "輕度 <5cm"; }

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
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{unit} 淹水深度</span>
      </div>
      {(county || town) && <Row label="區域" value={[county, town].filter(Boolean).join(" / ")} />}
      {admin && <Row label="管理單位" value={admin} />}
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        24h 趨勢
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          載入中…
        </div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit={unit}
          warningValue={depthCm >= 5 ? 5 : null}
          warningLabel="積水"
          lineColor={color}
          height={120}
        />
      )}
    </>
  );
}

export function RainGaugePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
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
    p1 >= 200 ? { label: "超大豪雨", color: "#ef4444" } :
    p1 >= 80  ? { label: "大豪雨", color: "#f97316" } :
    p1 >= 40  ? { label: "豪雨", color: "#fbbf24" } :
    p1 >= 15  ? { label: "大雨", color: "#22c55e" } :
    p1 >= 2.5 ? { label: "中雨", color: "#3b82f6" } :
    p1 > 0    ? { label: "小雨", color: "#93c5fd" } :
                { label: "無雨", color: "#6b7280" };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: level.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.station_name ?? "(未命名站)")}
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
      <Row label="1 小時累積" value={`${p1.toFixed(1)} mm`} />
      <Row label="3 小時累積" value={`${p3.toFixed(1)} mm`} />
      <Row label="24 小時累積" value={`${p24.toFixed(1)} mm`} />
      <Row label="縣市" value={`${String(props.county ?? "")} ${String(props.town ?? "")}`.trim()} />
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="站號" value={String(props.station_id ?? "")} color={t.textDim} />

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        24h 1 小時累積雨量
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
          載入中…
        </div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit="mm"
          warningValue={15}
          warningLabel="大雨"
          lineColor={level.color}
          height={120}
        />
      )}
    </>
  );
}

export function WaterReservoirContextPanel({ ctx }: { ctx: ReservoirContext }) {
  const t = useFeatureTheme();
  const r = ctx.reservoir;
  const s = ctx.latest_status;
  const w = ctx.watershed;
  const b = ctx.basin;
  const nr = ctx.nearest_river;

  const storageRatio = s?.storage_ratio_pct ?? null;
  const alert = s?.alert_level ?? "";
  const alertColor = ALERT_COLORS[alert] ?? "#94a3b8";
  const alertLabel = ALERT_LABELS[alert] ?? alert;
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
          {r?.res_name ?? "(未命名水庫)"}
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
          <span style={{ fontSize: FONT_SIZE.base, color: t.textDefault }}>% 蓄水率</span>
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
        <Row label="蓄水量" value={`${Number(storageWanM3).toLocaleString()} / ${Number(capacityWan).toLocaleString()} 萬 m³`} />
      )}
      {s?.water_level_m != null && (
        <Row label="水位" value={`${Number(s.water_level_m).toFixed(2)} m`} />
      )}
      {s?.inflow_cms != null && (
        <Row label="入流" value={`${Number(s.inflow_cms).toFixed(1)} cms`} />
      )}
      {s?.total_outflow_cms != null && (
        <Row label="總出流" value={`${Number(s.total_outflow_cms).toFixed(1)} cms`} />
      )}
      {s?.basin_rainfall_mm != null && (
        <Row label="集水區雨量" value={`${Number(s.basin_rainfall_mm).toFixed(1)} mm`} />
      )}
      {s?.snapshot_at && (
        <Row label="更新時間" value={formatTaiwanTime(s.snapshot_at).slice(0, 16)} />
      )}

      {/* 淤積 */}
      {r?.silt_ratio_pct != null && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
          <Row
            label="淤積率"
            value={`${r.silt_ratio_pct.toFixed(1)}% (${r.latest_measured_at ?? "—"})`}
            color={r.silt_ratio_pct > 30 ? "#f97316" : "#94a3b8"}
          />
        </div>
      )}

      {/* 空間關聯 */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
        {w?.area_km2 != null && (
          <Row
            label="集水區"
            value={`${Number(w.area_km2).toLocaleString()} km²${w.unit ? ` · ${w.unit}` : ""}`}
            color={accent}
          />
        )}
        {b?.basin_name && (
          <Row label="所在流域" value={b.basin_name} color="#a78bfa" />
        )}
        {nr?.river_name && nr.dist_m != null && (
          <Row
            label="最近河川"
            value={`${nr.river_name} (${Number(nr.dist_m).toLocaleString()} m)`}
            color="#38bdf8"
          />
        )}
      </div>

      {/* 基本屬性 */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
        {r?.county && <Row label="縣市" value={r.county} />}
        {r?.org_mng && <Row label="管理" value={r.org_mng} />}
        {r?.dam_height_m != null && <Row label="壩高" value={`${r.dam_height_m} m`} />}
        {r?.status && <Row label="狀態" value={r.status} />}
      </div>
    </>
  );
}

export function WaterReservoirPolyPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const name = String(props.name ?? "(未命名水庫)");
  const accent = "#22d3ee";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {name}
        </div>
      </div>
      <Row label="類別" value="蓄水水面範圍" color={accent} />
      <Row label="資料源" value="WRA GIC reservoir_storage" />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        ⓘ 此為水庫實際水面輪廓，部分水庫（如台電管的明潭、明湖下池）僅有面、無單獨點位
      </div>
    </>
  );
}

export function LakesPondsPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const type = String(props.water ?? "");
  const meta = LAKES_PONDS_TYPE[type] ?? { color: "#4fc3f7", label: type || "湖泊/埤塘" };
  const name = String(props.name ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {name || meta.label}
        </div>
      </div>
      <Row label="類別" value={meta.label} color={meta.color} />
      <Row label="面積" value={areaHa(props.area_ha)} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        ⓘ OpenStreetMap 群眾標註，© OpenStreetMap contributors（ODbL）；已濾掉與魚塭圖層重疊者
      </div>
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
  const value = props.value == null ? null : Number(props.value);
  const delta = props.delta_m == null ? null : Number(props.delta_m);
  const unit = String(props.si_unit ?? "m");
  const obs = String(props.observed_at ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#22d3ee", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "(未命名站)")}
        </div>
      </div>
      <IotReadingBlock value={value} unit={unit} deltaLabel="較基準" delta={delta} color="#22d3ee" />
      <Row label="測項" value={String(props.measurement_name ?? "")} />
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="站號" value={String(props.iow_station_id ?? "")} color={t.textDim} />
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
          {String(props.name ?? "(未命名站)")}
        </div>
      </div>
      <Row label="類型" value={info?.label ?? type} color={color} />
      <IotReadingBlock value={value} unit={unit} deltaLabel="今日累計變化" delta={delta} color={color} />
      <Row label="測項" value={String(props.measurement_name ?? "")} />
      <Row label="縣市" value={String(props.county_name ?? "")} />
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="站號" value={String(props.iow_station_id ?? "")} color={t.textDim} />
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
  const areaM2 = Number(props.area_km2);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#0891b2", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.basin_name ?? "(未命名流域)")}
        </div>
      </div>
      {Number.isFinite(areaM2) && areaM2 > 0 && (
        <Row label="集水面積" value={`${(areaM2 / 1e6).toLocaleString("zh-TW", { maximumFractionDigits: 1 })} km²`} />
      )}
      <Row label="流域代號" value={String(props.basin_no ?? "")} color={t.textDim} />
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
  const type = String(props.river_type ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#0284c7", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.river_name ?? "(未命名河段)")}
        </div>
      </div>
      <Row label="分類代碼" value={type} color={t.textDim} />
      <Row label="河川代碼" value={String(props.river_code ?? "")} color={t.textDim} />
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
  const status = String(props.status ?? "");
  const side = String(props.side ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#f59e0b", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "(未命名堤防)")}
        </div>
      </div>
      <Row label="型式" value={String(props.levee_type ?? "")} />
      <Row label="狀態" value={status} color={LEVEE_STATUS_COLOR[status]} />
      <Row label="河川" value={String(props.river ?? "")} />
      <Row label="流域" value={String(props.basin ?? "")} />
      <Row label="岸別" value={side ? `${side}岸` : ""} />
      <Row label="縣市" value={String(props.county ?? "")} color={t.textDim} />
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
          {name || (office ? `${office}（渠道名從缺）` : "(未命名渠道)")}
        </div>
      </div>
      <Row label="管理處" value={office ? `${office}管理處` : ""} />
      <Row label="屬性" value={attr} color={CANAL_ATTR_COLOR[attr]} />
      <Row label="資料來源" value={CANAL_SRC_LABELS[src] ?? src} color={t.textDim} />
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
  protection: { color: "#10b981", label: "飲用水水源保護區" },
  groundwater_control_2: { color: "#ef4444", label: "地下水禁止超抽" },
  groundwater_control_1: { color: "#f97316", label: "地下水限制超抽" },
  groundwater_region: { color: "#94a3b8", label: "地下水分區" },
};

export function WaterProtectionZonesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const kind = String(props.zone_kind ?? "");
  const info = PROTECTION_ZONE_KIND[kind];
  const color = info?.color ?? "#94a3b8";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "(未命名管制區)")}
        </div>
      </div>
      <Row label="類別" value={info?.label ?? kind} color={color} />
      <Row label="分區" value={String(props.zone ?? "")} />
      <Row label="公告文號" value={String(props.law_ref ?? "")} />
      <Row label="編號" value={String(props.zone_no ?? "")} color={t.textDim} />
    </>
  );
}
