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
