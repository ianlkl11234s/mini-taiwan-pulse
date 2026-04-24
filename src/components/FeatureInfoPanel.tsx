import { X } from "lucide-react";
import type { FeatureInfo } from "../types";
import { aqiToColor } from "../map/aqiColorScale";
import type { ReservoirContext } from "../data/reservoirContextLoader";

/** 海纜 cable_type 對應色 */
const CABLE_TYPE_COLORS: Record<string, string> = {
  "國際幹線": "#2196F3",
  "海峽專線": "#F44336",
  "離島連接": "#4CAF50",
  "中國境內": "#FF9800",
  "規劃中": "#9E9E9E",
};

/** 登陸站 station_type 對應色 */
const STATION_TYPE_COLORS: Record<string, string> = {
  "國際樞紐": "#2196F3",
  "區域節點": "#26c6da",
};

/** 學校分級對應色 */
const SCHOOL_LEVEL_COLORS: Record<string, string> = {
  "國民小學": "#66bb6a",
  "附設國民小學": "#66bb6a",
  "國民中學": "#ffa726",
  "附設國民中學": "#ffa726",
  "高級中等學校": "#ef5350",
  "大專校院": "#ab47bc",
  "宗教研修學院": "#ab47bc",
  "空中大學": "#ab47bc",
  "專科學校": "#ab47bc",
  "特殊教育學校": "#78909c",
};

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

/** 超商品牌對應色 */
const BRAND_COLORS: Record<string, string> = {
  "7-ELEVEN": "#00843D",
  "全家": "#00843D",
  "FamilyMart": "#00843D",
  "萊爾富": "#E31937",
  "Hi-Life": "#E31937",
  "OK": "#FF8C00",
  "OKmart": "#FF8C00",
};

interface Props {
  feature: FeatureInfo;
  onClose: () => void;
  /** 點擊水庫時由 useReservoirContextLayer 提供：含水情/集水區/流域/最近河川 */
  reservoirContext?: ReservoirContext | null;
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

function formatTaiwanTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0, minWidth: 56 }}>{label}</span>
      <span style={{ color: color ?? "rgba(255,255,255,0.85)", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function SubmarineCablePanel({ props }: { props: Record<string, unknown> }) {
  const cableType = String(props.cable_type ?? "");
  const accentColor = CABLE_TYPE_COLORS[cableType] ?? "#9E9E9E";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Cable")}
        </div>
      </div>
      <Row label="類型" value={cableType} color={accentColor} />
      <Row label="狀態" value={String(props.status ?? "")} />
      <Row label="啟用年" value={String(props.rfs_year ?? "")} />
      <Row label="長度" value={String(props.length ?? "")} />
      <Row label="擁有者" value={String(props.owners ?? "")} />
      <Row label="供應商" value={String(props.suppliers ?? "")} />
      <Row label="台灣端" value={String(props.tw_landings ?? "")} />
      <Row label="中國端" value={String(props.cn_landings ?? "")} />
    </>
  );
}

function LandingStationPanel({ props }: { props: Record<string, unknown> }) {
  const stationType = String(props.station_type ?? "");
  const accentColor = STATION_TYPE_COLORS[stationType] ?? "#9E9E9E";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="國家" value={String(props.country ?? "")} />
      <Row label="樞紐等級" value={stationType} color={accentColor} />
      <Row label="電纜數" value={String(props.cable_count ?? "")} />
      <Row label="電纜清單" value={String(props.cable_names_str ?? "")} />
    </>
  );
}

function SchoolPanel({ props }: { props: Record<string, unknown> }) {
  const level = String(props.school_level ?? "");
  const accentColor = SCHOOL_LEVEL_COLORS[level] ?? "#42a5f5";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.school_name ?? "Unknown School")}
        </div>
      </div>
      <Row label="分級" value={level} color={accentColor} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="區域" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="網站" value={String(props.website ?? "")} />
    </>
  );
}

function WaterFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const type = String(props.facility_type ?? "");
  const meta = WATER_FACILITY_TYPE[type] ?? { color: "#9ca3af", label: type };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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

function WaterMonitorPanel({ props }: { props: Record<string, unknown> }) {
  const type = String(props.station_type ?? "");
  const meta = WATER_MONITOR_TYPE[type] ?? { color: "#9ca3af", label: type };
  const isActive = props.is_active === true || props.is_active === "true";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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

function WaterDamPanel({ props }: { props: Record<string, unknown> }) {
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
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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
        <div style={{ marginTop: 8, fontSize: 10, color: hintColor, lineHeight: 1.5 }}>
          ⓘ 此為壩體工程位置（壩牆出水口），與水庫水面中心點不重合屬正常
        </div>
      )}
    </>
  );
}

function RiverLevelPanel({ props }: { props: Record<string, unknown> }) {
  const level = Number(props.water_level_m) || 0;
  const check = Number(props.check_result);
  const abnormal = check === 0;
  const color = abnormal ? "#ef4444" : "#22d3ee";
  const obs = String(props.observed_at ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.station_name ?? "(未命名站)")}
        </div>
        {abnormal && (
          <div
            style={{
              marginLeft: "auto",
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 3,
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
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, color }}>
          {level.toFixed(2)}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>m 水位</span>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} />
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="站號" value={String(props.station_id ?? "")} color="rgba(255,255,255,0.35)" />
      <div style={{ marginTop: 8, fontSize: 10, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        ⓘ 警戒水位資料（三級警戒）待上游 seed 補齊後加入
      </div>
    </>
  );
}

function GroundwaterPanel({ props }: { props: Record<string, unknown> }) {
  const levelRaw = props.water_level_m;
  const level = levelRaw == null ? null : Number(levelRaw);
  const obs = String(props.observed_at ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, color: "#38bdf8" }}>
          {level != null ? level.toFixed(2) : "—"}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>m 地下水位（海拔）</span>
      </div>
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="井號" value={String(props.station_id ?? "")} color="rgba(255,255,255,0.35)" />
    </>
  );
}

function RainGaugePanel({ props }: { props: Record<string, unknown> }) {
  const p10 = Number(props.precipitation_10min) || 0;
  const p1 = Number(props.precipitation_1hr) || 0;
  const p3 = Number(props.precipitation_3hr) || 0;
  const p24 = Number(props.precipitation_24hr) || 0;
  const obs = String(props.observed_at ?? "");

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
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: level.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.station_name ?? "(未命名站)")}
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 3,
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
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, color: level.color }}>
          {p10.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>mm / 10 min</span>
      </div>
      <Row label="1 小時累積" value={`${p1.toFixed(1)} mm`} />
      <Row label="3 小時累積" value={`${p3.toFixed(1)} mm`} />
      <Row label="24 小時累積" value={`${p24.toFixed(1)} mm`} />
      <Row label="縣市" value={`${String(props.county ?? "")} ${String(props.town ?? "")}`.trim()} />
      {obs && <Row label="觀測時間" value={formatTaiwanTime(obs).slice(0, 16)} />}
      <Row label="站號" value={String(props.station_id ?? "")} color="rgba(255,255,255,0.35)" />
    </>
  );
}

function WaterReservoirContextPanel({ ctx }: { ctx: ReservoirContext }) {
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
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {r?.res_name ?? "(未命名水庫)"}
        </div>
        {r?.compare_id != null && (
          <div
            style={{
              marginLeft: "auto",
              fontSize: 9,
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.3)",
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
            borderRadius: 4,
            border: "1px solid rgba(34,211,238,0.2)",
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>
            {storageRatio.toFixed(1)}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>% 蓄水率</span>
          {alert && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 3,
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
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
          <Row
            label="淤積率"
            value={`${r.silt_ratio_pct.toFixed(1)}% (${r.latest_measured_at ?? "—"})`}
            color={r.silt_ratio_pct > 30 ? "#f97316" : "#94a3b8"}
          />
        </div>
      )}

      {/* 空間關聯 */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
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
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
        {r?.county && <Row label="縣市" value={r.county} />}
        {r?.org_mng && <Row label="管理" value={r.org_mng} />}
        {r?.dam_height_m != null && <Row label="壩高" value={`${r.dam_height_m} m`} />}
        {r?.status && <Row label="狀態" value={r.status} />}
      </div>
    </>
  );
}

function WaterReservoirPolyPanel({ props }: { props: Record<string, unknown> }) {
  const name = String(props.name ?? "(未命名水庫)");
  const accent = "#22d3ee";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {name}
        </div>
      </div>
      <Row label="類別" value="蓄水水面範圍" color={accent} />
      <Row label="資料源" value="WRA GIC reservoir_storage" />
      <div style={{ marginTop: 8, fontSize: 10, color: "rgba(150,200,255,0.6)", lineHeight: 1.5 }}>
        ⓘ 此為水庫實際水面輪廓，部分水庫（如台電管的明潭、明湖下池）僅有面、無單獨點位
      </div>
    </>
  );
}

function ConvenienceStorePanel({ props }: { props: Record<string, unknown> }) {
  const brand = String(props.brand ?? "");
  const accentColor = BRAND_COLORS[brand] ?? "#26c6da";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Store")}
        </div>
      </div>
      <Row label="品牌" value={brand} color={accentColor} />
      <Row label="地址" value={String(props.addr ?? props.address ?? "")} />
    </>
  );
}

/** 氣象站類型對應色 */
const WEATHER_TYPE_COLORS: Record<string, string> = {
  "署屬有人站": "#4dd0e1",
  "署屬無人站": "#80deea",
  "自動雨量站": "#26c6da",
  "農業站": "#66bb6a",
};

/** 自行車服務類型對應色 */
const BIKE_SERVICE_COLORS: Record<string, string> = {
  "YouBike2.0": "#a1d344",
  "YouBike1.0": "#f5a623",
  "T-Bike": "#00bcd4",
  "iBike": "#ff7043",
  "PBIKE": "#ab47bc",
};

/** 鐵路系統對應色與名稱 */
const RAIL_SYSTEM_INFO: Record<string, { name: string; color: string }> = {
  tra: { name: "台鐵", color: "#b8a080" },
  trtc: { name: "台北捷運", color: "#00bcd4" },
  krtc: { name: "高雄捷運", color: "#f57f17" },
  klrt: { name: "高雄輕軌", color: "#66bb6a" },
  tmrt: { name: "桃園捷運", color: "#ab47bc" },
};

function WeatherStationPanel({ props }: { props: Record<string, unknown> }) {
  const stationType = String(props.station_type ?? "");
  const accentColor = WEATHER_TYPE_COLORS[stationType] ?? "#4dd0e1";
  const isActive = props.is_active;
  const activeLabel = isActive === true || isActive === 1 || isActive === "true" ? "運作中" : isActive === false || isActive === 0 || isActive === "false" ? "已停用" : "";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.station_name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="類型" value={stationType} color={accentColor} />
      <Row label="海拔" value={props.elevation_m != null ? `${props.elevation_m} m` : ""} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="啟用日" value={String(props.start_date ?? "")} />
      <Row label="狀態" value={activeLabel} color={activeLabel === "運作中" ? "#66bb6a" : "#ef5350"} />
      <Row label="備註" value={String(props.note ?? "")} />
    </>
  );
}

function BikeStationPanel({ props }: { props: Record<string, unknown> }) {
  const serviceType = String(props.ServiceTypeName ?? "");
  const accentColor = BIKE_SERVICE_COLORS[serviceType] ?? "#ffca28";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.StationName ?? "Unknown Station")}
        </div>
      </div>
      <Row label="系統" value={serviceType} color={accentColor} />
      <Row label="車柱數" value={String(props.BikesCapacity ?? "")} />
      <Row label="城市" value={String(props.City ?? "")} />
      <Row label="地址" value={String(props.StationAddress ?? "")} />
    </>
  );
}

function BusStationPanel({ props }: { props: Record<string, unknown> }) {
  const busType = String(props.bus_type ?? props.BusType ?? "");
  const isIntercity = busType === "intercity";
  const accentColor = isIntercity ? "#ab47bc" : "#66bb6a";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.StationName ?? "Unknown Station")}
        </div>
      </div>
      <Row label="類型" value={isIntercity ? "客運" : "市區公車"} color={accentColor} />
      <Row label="路線數" value={String(props.Stops ?? "")} />
      <Row label="城市" value={String(props.City ?? "")} />
      <Row label="地址" value={String(props.StationAddress ?? "")} />
    </>
  );
}

function LighthousePanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffd700", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.Name ?? "Unknown Lighthouse")}
        </div>
      </div>
      <Row label="緯度" value={String(props.Lat ?? "")} />
      <Row label="經度" value={String(props.Lon ?? "")} />
    </>
  );
}

function RailStationPanel({ props }: { props: Record<string, unknown> }) {
  const systemId = String(props.system_id ?? "");
  const info = RAIL_SYSTEM_INFO[systemId];
  const accentColor = String(props.color ?? info?.color ?? "#b8a080");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="系統" value={info?.name ?? systemId} color={accentColor} />
      <Row label="站代碼" value={String(props.station_id ?? "")} />
    </>
  );
}

/** 港口分類對應色 */
const PORT_CLASS_COLORS: Record<string, string> = {
  "國際商港": "#42a5f5",
  "國內商港": "#64b5f6",
  "第一類漁港": "#26c6da",
  "第二類漁港": "#4dd0e1",
  "工業專用港": "#ffa726",
  "軍港": "#78909c",
};

function PortPanel({ props }: { props: Record<string, unknown> }) {
  const portClass = String(props.port_class ?? "");
  const accentColor = PORT_CLASS_COLORS[portClass] ?? "#88bbff";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Port")}
        </div>
      </div>
      <Row label="分類" value={portClass} color={accentColor} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="資料源" value={String(props.source ?? "")} />
    </>
  );
}

function AirportPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#daa520", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Airport")}
        </div>
      </div>
      <Row label="英文" value={String(props.name_en ?? "")} />
      <Row label="ICAO" value={String(props.icao ?? "")} />
      <Row label="IATA" value={String(props.iata ?? "")} />
    </>
  );
}

function NewsEventPanel({ props }: { props: Record<string, unknown> }) {
  const link = String(props.link ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff9800", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5, lineHeight: 1.4 }}>
          {String(props.title ?? "Unknown Event")}
        </div>
      </div>
      <Row label="摘要" value={String(props.summary ?? "")} />
      <Row label="地點" value={String(props.location_name ?? "")} />
      <Row label="分類" value={String(props.category ?? "")} color="#ff9800" />
      <Row label="時間" value={String(props.published ?? "")} />
      {link && (
        <div style={{ marginTop: 6 }}>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#ff9800", fontSize: 11, fontFamily: "monospace", textDecoration: "underline" }}
          >
            CNA 原文
          </a>
        </div>
      )}
    </>
  );
}

function DisasterAlertPanel({ props }: { props: Record<string, unknown> }) {
  const severity = String(props.severity ?? "Unknown");
  const color = String(props.color ?? "#dc2626");
  const event = String(props.event ?? props.event_term ?? "災害示警");
  const headline = String(props.headline ?? "");
  const areaDesc = String(props.area_desc ?? "");
  const sender = String(props.sender_name ?? "");
  const startTs = Number(props.start_ts ?? 0);
  const endTs = Number(props.end_ts ?? 0);
  const fmt = (ts: number) =>
    ts > 0 && ts < Number.MAX_SAFE_INTEGER
      ? new Date(ts * 1000).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })
      : "—";
  const sevLabel: Record<string, string> = {
    Extreme: "極端", Severe: "嚴重", Moderate: "中度", Minor: "輕度", Unknown: "未分類",
  };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {event}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: 10, padding: "1px 6px", borderRadius: 3,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {sevLabel[severity] ?? severity}
        </div>
      </div>
      {headline && <Row label="標題" value={headline} />}
      {areaDesc && <Row label="影響區域" value={areaDesc} />}
      <Row label="生效" value={fmt(startTs)} />
      <Row label="失效" value={fmt(endTs)} />
      {sender && <Row label="發布單位" value={sender} />}
    </>
  );
}

function ActiveFaultPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef5350", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.fault_name ?? "Unknown Fault")}
        </div>
      </div>
      <Row label="編號" value={String(props.fault_id ?? "")} />
      <Row label="全稱" value={String(props.name ?? "")} />
    </>
  );
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatNum(v: number | null, unit: string, digits = 1): string {
  if (v == null) return "";
  return `${v.toFixed(digits)} ${unit}`;
}

function AqiStationPanel({ props }: { props: Record<string, unknown> }) {
  const aqi = numOrNull(props.aqi);
  const color = aqi != null ? aqiToColor(aqi) : "#707070";
  const observedAt = String(props.observedAt ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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
          background: "rgba(255,255,255,0.04)",
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 700, color }}>
          {aqi ?? "—"}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
          AQI {String(props.status ?? "")}
        </span>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="主污染物" value={String(props.pollutant ?? "")} />
      <Row label="PM2.5" value={formatNum(numOrNull(props.pm25), "µg/m³")} />
      <Row label="PM10" value={formatNum(numOrNull(props.pm10), "µg/m³")} />
      <Row label="O₃" value={formatNum(numOrNull(props.o3), "ppb", 1)} />
      <Row label="NO₂" value={formatNum(numOrNull(props.no2), "ppb", 1)} />
      <Row label="SO₂" value={formatNum(numOrNull(props.so2), "ppb", 2)} />
      <Row label="CO" value={formatNum(numOrNull(props.co), "ppm", 2)} />
      <Row label="風速" value={formatNum(numOrNull(props.windSpeed), "m/s", 1)} />
      <Row label="觀測時間" value={observedAt ? observedAt.slice(0, 16).replace("T", " ") : ""} />
    </>
  );
}

function MicroSensorPanel({ props }: { props: Record<string, unknown> }) {
  const pm25 = numOrNull(props.pm25);
  const color = String(props.color ?? "#707070");
  const temperature = Number(props.temperature);
  const tempStr = Number.isFinite(temperature) && temperature > -100 ? `${temperature.toFixed(1)} °C` : "";
  const observedAt = String(props.observedAt ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.deviceId ?? "LASS Device")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, color }}>
          {pm25 != null ? pm25.toFixed(1) : "—"}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>PM2.5 µg/m³</span>
      </div>
      <Row label="來源" value={String(props.source ?? "")} />
      <Row label="裝置" value={String(props.app ?? "")} />
      <Row label="地區" value={String(props.area ?? "")} />
      <Row label="PM10" value={formatNum(numOrNull(props.pm10), "µg/m³")} />
      <Row label="PM1" value={formatNum(numOrNull(props.pm1), "µg/m³")} />
      <Row label="溫度" value={tempStr} />
      <Row label="濕度" value={formatNum(numOrNull(props.humidity), "%")} />
      <Row label="觀測時間" value={observedAt ? observedAt.slice(0, 16).replace("T", " ") : ""} />
    </>
  );
}

const HEADER_LABELS: Record<FeatureInfo["layerType"], string> = {
  submarineCable: "通訊海纜",
  landingStation: "海纜登陸站",
  school: "學校",
  convenienceStore: "超商",
  weatherStation: "氣象站",
  bikeStation: "公共自行車站",
  busStation: "公車站",
  lighthouse: "燈塔",
  railStation: "車站",
  port: "港口",
  airport: "機場",
  activeFault: "活動斷層",
  newsEvent: "新聞事件",
  disasterAlert: "災害示警",
  aqiStation: "空氣品質測站",
  microSensor: "微型感測器",
  waterFacility: "水利設施",
  waterMonitor: "水資源監測站",
  waterDam: "水庫 / 壩體",
  waterReservoirPoly: "水庫蓄水範圍",
  rainGauge: "即時雨量站",
  riverLevel: "河川水位站",
  groundwater: "地下水井",
};

export function FeatureInfoPanel({ feature, onClose, reservoirContext }: Props) {
  let content: React.ReactNode;

  // 水庫類：若點到的水庫有 compare_id 且 context 已載入，改顯示完整 context panel
  const isReservoir =
    feature.layerType === "waterDam" || feature.layerType === "waterReservoirPoly";
  const compareId = feature.properties.compare_id;
  const hasCompareId = typeof compareId === "number" && compareId > 0;
  if (isReservoir && hasCompareId && reservoirContext?.reservoir) {
    content = <WaterReservoirContextPanel ctx={reservoirContext} />;
  } else switch (feature.layerType) {
    case "submarineCable":
      content = <SubmarineCablePanel props={feature.properties} />;
      break;
    case "landingStation":
      content = <LandingStationPanel props={feature.properties} />;
      break;
    case "school":
      content = <SchoolPanel props={feature.properties} />;
      break;
    case "convenienceStore":
      content = <ConvenienceStorePanel props={feature.properties} />;
      break;
    case "weatherStation":
      content = <WeatherStationPanel props={feature.properties} />;
      break;
    case "bikeStation":
      content = <BikeStationPanel props={feature.properties} />;
      break;
    case "busStation":
      content = <BusStationPanel props={feature.properties} />;
      break;
    case "lighthouse":
      content = <LighthousePanel props={feature.properties} />;
      break;
    case "railStation":
      content = <RailStationPanel props={feature.properties} />;
      break;
    case "port":
      content = <PortPanel props={feature.properties} />;
      break;
    case "airport":
      content = <AirportPanel props={feature.properties} />;
      break;
    case "activeFault":
      content = <ActiveFaultPanel props={feature.properties} />;
      break;
    case "newsEvent":
      content = <NewsEventPanel props={feature.properties} />;
      break;
    case "disasterAlert":
      content = <DisasterAlertPanel props={feature.properties} />;
      break;
    case "aqiStation":
      content = <AqiStationPanel props={feature.properties} />;
      break;
    case "microSensor":
      content = <MicroSensorPanel props={feature.properties} />;
      break;
    case "waterFacility":
      content = <WaterFacilityPanel props={feature.properties} />;
      break;
    case "waterMonitor":
      content = <WaterMonitorPanel props={feature.properties} />;
      break;
    case "waterDam":
      content = <WaterDamPanel props={feature.properties} />;
      break;
    case "waterReservoirPoly":
      content = <WaterReservoirPolyPanel props={feature.properties} />;
      break;
    case "rainGauge":
      content = <RainGaugePanel props={feature.properties} />;
      break;
    case "riverLevel":
      content = <RiverLevelPanel props={feature.properties} />;
      break;
    case "groundwater":
      content = <GroundwaterPanel props={feature.properties} />;
      break;
  }

  return (
    <div
      style={{
        width: 280,
        background: "rgba(10, 10, 20, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(100, 170, 255, 0.25)",
        borderRadius: 10,
        padding: "12px 14px",
        fontFamily: "monospace",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          padding: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={14} />
      </button>

      {/* Header label */}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
        {HEADER_LABELS[feature.layerType]}
      </div>

      {content}
    </div>
  );
}
