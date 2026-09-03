// 噪音／聲響六圖層 popup。
// 這些資料分別是觀測、法定區、裁處與設備清單，不共用「噪音分數」語意。
import type { PanelProps } from "./registry";
import { Badge, Row } from "./shared";
import { PENALTY_SEVERITY_LABELS, type PollutionPenaltySeverity } from "../../data/pollutionTypes";

function text(value: unknown, fallback = "未提供"): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return fallback;
  return String(value);
}

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yes(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function db(value: unknown, fallback = "無已驗資料"): string {
  const parsed = number(value);
  return parsed == null ? fallback : `${parsed.toFixed(1)} dB`;
}

function count(value: unknown, unit: string): string {
  const parsed = number(value);
  return parsed == null ? "未提供" : `${parsed.toLocaleString()} ${unit}`;
}

function dateRange(start: unknown, end: unknown, fallback = "無已驗資料"): string {
  if (start == null || start === "" || end == null || end === "") return fallback;
  return `${String(start)} ～ ${String(end)}`;
}

function SourceRows({ props }: PanelProps) {
  const sourceId = text(props.source_dataset_id, "未提供");
  const org = text(props.source_org, "未提供");
  const url = text(props.source_url, "");
  return (
    <>
      <Row label="來源 ID" value={sourceId} />
      <Row label="來源機關" value={org} />
      <Row label="來源更新" value={text(props.source_updated_at, "未提供")} />
      <Row label="授權" value={text(props.source_license, "未提供")} />
      {url && (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
            原始資料頁 ↗
          </a>
        </div>
      )}
    </>
  );
}

const PERIOD_LABELS: Record<string, string> = {
  day: "日間 day",
  evening: "晚間 evening",
  night: "夜間 night",
  unavailable: "無已驗資料",
};

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: "近期 fresh",
  historical: "歷史資料 historical",
  unavailable: "無已驗 dB",
};

const PRECISION_LABELS: Record<string, string> = {
  official_point: "官方測站點位",
  official_polygon: "官方公告 polygon",
  admin_join: "公告名單套疊村里界",
  geocoded_address: "地址定位",
  road_segment: "路段約略位置",
  fuzzy: "模糊位置",
  unlocated: "待補定位",
  facility_join: "設施座標 join",
  address_exact: "地址精確定位",
  address_osm: "地址（OSM）",
  parcel: "地號補點",
  approx: "約略位置",
  unknown: "未知",
};

export function OfficialNoiseMonitoringPanel({ props }: PanelProps) {
  const period = text(props.period_type, "unavailable");
  const freshness = text(props.freshness_status, "unavailable");
  const activeDays = number(props.active_days);
  const windowDays = number(props.window_days);
  const ratio = number(props.active_day_ratio);
  const coverage = activeDays == null || windowDays == null
    ? "未提供"
    : `${activeDays}/${windowDays} 日${ratio == null ? "" : `（${(ratio * 100).toFixed(1)}%）`}`;
  const freshnessDays = number(props.freshness_days);

  return (
    <div>
      <Row label="測站" value={text(props.station_name)} />
      <Row label="測站 ID" value={text(props.station_id)} />
      <Row label="縣市" value={text(props.county)} />
      <Row label="地址" value={text(props.address)} />
      <Row label="站別" value={text(props.station_type)} />
      <Row label="站況" value={text(props.station_status)} />
      <Row label="管制類別" value={text(props.area_type)} />
      <Row label="時段" value={PERIOD_LABELS[period] ?? period} />
      <Row label="樣本 LAeq" value={db(props.laeq_window_db)} color={number(props.laeq_window_db) == null ? "#94a3b8" : undefined} />
      <Row label="觀測視窗" value={dateRange(props.window_start, props.window_end)} />
      <Row label="最近觀測" value={text(props.latest_observation_date, "無已驗資料")} />
      <Row label="有效涵蓋" value={coverage} />
      <Row label="樣本數" value={count(props.sample_count, "筆")} />
      <Row label="代表秒數" value={count(props.represented_seconds, "秒")} />
      <Row label="新鮮度" value={FRESHNESS_LABELS[freshness] ?? freshness} />
      <Row label="距今" value={freshnessDays == null ? "無已驗資料" : `${freshnessDays} 日`} />
      <Row label="空間精度" value={PRECISION_LABELS[text(props.spatial_precision, "unknown")] ?? text(props.spatial_precision)} />
      <Row label="來源 ID" value={text(props.source_dataset_id)} />
      <Row label="來源更新" value={text(props.source_updated_at)} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        此值是最近可用 30 日窗內實際回報樣本的聲能平均；不是完整連續月均值、全國同步月份或法規達標判定。無值測站仍保留，無值不代表 0 dB 或安靜。
      </div>
    </div>
  );
}

export function NoiseCaptureGridPanel({ props }: PanelProps) {
  const provisional = yes(props.is_provisional);
  const scale = number(props.scale_m);
  const freshnessDays = number(props.freshness_days);
  const gpsAccuracy = number(props.gps_accuracy_p50);
  return (
    <div>
      <Row label="格網 ID" value={text(props.grid_id)} />
      <Row label="樣本 LAeq" value={db(props.laeq_energy_db)} />
      <Row label="典型軌跡" value={db(props.typical_track_laeq_db)} />
      <Row label="LA50" value={db(props.la50_db)} />
      <Row label="尺度" value={scale == null ? "未提供" : `${scale.toLocaleString()} m`} />
      <Row label="量測時間" value={count(props.measure_seconds, "秒")} />
      <Row label="軌跡數" value={count(props.track_count, "條")} />
      <Row label="有效日" value={count(props.active_days, "日")} />
      <Row label="日時段數" value={count(props.daypart_count, "種")} />
      <Row label="量測範圍" value={dateRange(props.measurement_start_date, props.measurement_end_date, "未提供")} />
      <Row label="新鮮度" value={text(props.freshness_class)} />
      <Row label="距今" value={freshnessDays == null ? "未提供" : `${freshnessDays} 日`} />
      <Row label="品質層級" value={text(props.quality_tier)} />
      <Row label="GPS P50" value={gpsAccuracy == null ? "未提供" : `${gpsAccuracy.toFixed(1)} m`} />
      <Row label="來源型態" value={text(props.source_kind)} />
      <Row label="快照日期" value={text(props.source_snapshot_at)} />
      <div style={{ marginTop: 7 }}>
        <Badge label={provisional ? "暫定 provisional" : "通過正式門檻"} on={provisional} color="#f59e0b" />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        NoiseCapture／Noise-Planet 公民科學觀測，非法定噪音量測。格網為 rolling 365 天且高度稀疏；地圖留白不代表安靜或 0 dB。
      </div>
      <div style={{ marginTop: 5, fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
        NoiseCapture / Noise-Planet contributors · ODbL-1.0 / DbCL-1.0
      </div>
    </div>
  );
}

export function NoiseControlZonesPanel({ props }: PanelProps) {
  const repaired = yes(props.geometry_repaired);
  const area = number(props.area_km2);
  const zoneClass = number(props.zone_class);
  const zoneClassLabel = zoneClass != null && zoneClass >= 1 && zoneClass <= 4
    ? (["第一類", "第二類", "第三類", "第四類"][zoneClass - 1] ?? text(props.zone_class))
    : text(props.zone_class);
  return (
    <div>
      <Row label="管制區" value={text(props.zone_name)} />
      <Row label="類別" value={zoneClassLabel} />
      <Row label="縣市" value={text(props.county)} />
      <Row label="公告版本" value={text(props.legal_version)} />
      <Row label="公告年度" value={text(props.effective_year_roc, "來源未明載")} />
      <Row label="西元年度" value={text(props.effective_year, "來源未明載")} />
      <Row label="公告文號" value={text(props.announcement_no, "來源未明載")} />
      <Row label="空間精度" value={text(props.spatial_precision)} />
      <Row label="面積" value={area == null ? "未提供" : `${area.toFixed(2)} km²`} />
      <Row label="幾何修復" value={repaired ? "是（原始官方幾何拓樸修復）" : "否"} />
      <SourceRows props={props} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        第一類至第四類是法定噪音管制分類，不是實測聲音大小。v1 只有臺中；拓樸修復不表示改畫或推估法定邊界。
      </div>
    </div>
  );
}

export function AviationNoiseZonesPanel({ props }: PanelProps) {
  const area = number(props.area_km2);
  const measured = yes(props.is_measured_contour);
  return (
    <div>
      <Row label="村里" value={`${text(props.county)} ${text(props.town)} ${text(props.village)}`} />
      <Row label="村里代碼" value={text(props.village_code)} />
      <Row label="顯示級別" value={`第 ${text(props.display_zone_level)} 級`} />
      <Row label="全部級別" value={text(props.zone_levels)} />
      <Row label="名單筆數" value={count(props.membership_count, "筆")} />
      <Row label="法定單元" value={text(props.legal_unit)} />
      <Row label="公告版本" value={text(props.legal_version)} />
      <Row label="生效日期" value={text(props.effective_date, "來源未明載")} />
      <Row label="邊界版本" value={text(props.boundary_version)} />
      <Row label="空間精度" value={PRECISION_LABELS[text(props.spatial_precision)] ?? text(props.spatial_precision)} />
      <Row label="實測等值線" value={measured ? "是" : "否"} />
      <Row label="面積" value={area == null ? "未提供" : `${area.toFixed(2)} km²`} />
      <SourceRows props={props} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        此圖是公告村里名單套疊行政界，不是 DNL 實測等噪音線，也不代表村里內每一處都有相同航空噪音。v1 只有桃園與高雄。
      </div>
    </div>
  );
}

export function NoiseEnforcementEventsPanel({ props }: PanelProps) {
  const money = number(props.penalty_money);
  const precision = text(props.geocode_precision, "unknown");
  const severity = text(props.severity_event, "normal") as PollutionPenaltySeverity;
  return (
    <div>
      <Row label="受處分對象" value={text(props.fac_name)} />
      <Row label="縣市" value={text(props.county)} />
      <Row label="裁處日期" value={text(props.penalty_date)} />
      <Row label="裁處類型" value={text(props.transgress_type)} />
      <Row label="違反法規" value={text(props.transgress_law)} />
      <Row label="違反事實" value={text(props.violation_fact)} />
      <Row label="罰鍰" value={money == null ? "未提供" : money > 0 ? `NT$ ${money.toLocaleString()}` : "未裁罰金額／0 元"} />
      <Row label="事件分層" value={PENALTY_SEVERITY_LABELS[severity] ?? severity} />
      <Row label="分層原因" value={text(props.severity_reason)} />
      <Row label="定位精度" value={PRECISION_LABELS[precision] ?? precision} />
      <Row label="公文號" value={text(props.document_no)} />
      <Row label="事件 ID" value={text(props.event_id)} />
      <Row label="資料型態" value={text(props.source_kind)} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        此點表示官方噪音裁處事件與罰鍰，不是 dB 觀測、聲音強度或即時告發位置。
      </div>
    </div>
  );
}

export function SoundCameraLocationsPanel({ props }: PanelProps) {
  const precision = text(props.spatial_precision, "unknown");
  const renderable = yes(props.is_renderable);
  const equipmentStatus = text(props.equipment_status, "not_provided");
  return (
    <div>
      <Row label="名稱" value={text(props.location_name)} />
      <Row label="縣市" value={text(props.county)} />
      <Row label="預期鄉鎮" value={text(props.expected_town, "未提供")} />
      <Row label="原始地址/路段" value={text(props.raw_location)} />
      <Row label="完整地址" value={text(props.full_address)} />
      <Row label="定位精度" value={PRECISION_LABELS[precision] ?? precision} />
      <Row label="定位方法" value={text(props.geocode_method, "未提供")} />
      <Row label="定位參照" value={text(props.geocode_reference, "未提供")} />
      <Row label="定位驗證" value={text(props.spatial_validation_status)} />
      <Row label="邊界位置" value={[props.boundary_county, props.boundary_town, props.boundary_village].filter((v) => v != null && v !== "").join(" ") || "未提供"} />
      <Row label="設備狀態" value={equipmentStatus === "not_provided" ? "來源未提供（非即時狀態）" : equipmentStatus} />
      <Row label="可繪製" value={renderable ? "是" : "否（待補定位）"} />
      <Row label="清單語意" value={props.represents ? "官方清單設備／執法路段（非裁處事件或 dB）" : "未提供"} />
      <SourceRows props={props} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        這是官方清單中的設備／執法路段，不代表即時啟用狀態、違規事件位置或 dB。路段與 fuzzy 定位不可解讀為精確設備點。
      </div>
    </div>
  );
}
