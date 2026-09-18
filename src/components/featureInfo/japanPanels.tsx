import { JP_POLICE_FACILITY_TYPES, JP_POLICE_LAYER_COLOR, JP_POLICE_ATTRIBUTION } from "../../data/jpPoliceFacilityTypes";
import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import {
  JP_RAILWAY_LAYER_COLOR,
  JP_RAILWAY_TYPES,
  JP_RAILWAY_TYPE_OTHER,
} from "../../data/jpRailwayTypes";
import { JP_SCHOOL_TYPES, JP_SCHOOL_TYPE_OTHER } from "../../data/jpSchoolTypes";
import {
  JP_POPULATION_MESH_MODES, JP_POPULATION_MESH_LAYER_COLOR, JP_POPULATION_MESH_MASK,
} from "../../data/jpPopulationMeshModes";

// 本檔 Title 為極簡本地版（同 religionPanels / urbanPanels 慣例）。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

function list(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map(String).join(" / ");
  if (typeof raw !== "string" || !raw) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => typeof item === "object" && item && "source" in item ? String((item as { source: unknown }).source) : String(item)).join(" / ");
  } catch { /* 原始字串直接顯示 */ }
  return raw;
}

function objectList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [];
  } catch { return []; }
}

/** 日本旅宿／自然保護／世界遺產共用的 source-aware popup。 */
export function JpTourismPanel({ props }: { props: Record<string, unknown> }) {
  const provenance = objectList(props._provenance);
  const title = str(props.name) || str(props.site_name_ja) || str(props.park_name)
    || str(props.designation_name) || str(props.area_name) || str(props.area_name_en)
    || str(props.heritage_name_ja) || str(props.name_zh) || str(props.name_en)
    || str(props.entity_id) || str(props.feature_id) || "旅宿／保護區資料 宿泊・保護地域データ";
  const sources = list(props.sources) || list(props._provenance) || str(props.source_name)
    || str(props.source_dataset) || str(props.source) || "見來源網址";
  const sourceYear = str(props.source_as_of) || str(props.source_year) || str(props.source_fiscal_year)
    || str(props.date_inscribed) || [...new Set(provenance.map((item) => str(item.source_as_of)).filter(Boolean))].join(" / ");
  const license = list(props.license_set) || str(props.license) || str(props.license_status)
    || str(props.license_note);
  const status = [
    props.dedup_version ? "PARTIAL_DEDUP_CONSERVATIVE" : null,
    props.usage_status, props.source_status, props.freshness_status, props.dedup_status,
    props.geom_status, props.boundary_status,
  ].map(str).filter(Boolean).join(" / ");
  const precision = str(props.geom_precision) || str(props.geometry_status) || str(props.geocode_quality)
    || str(props.precision_warning) || str(props.geometry_caveat);
  return (
    <>
      <Title color="#0ea5e9">{title}</Title>
      <Row label="來源" value={sources} />
      <Row label="年份／截至" value={sourceYear || "未提供"} />
      <Row label="授權" value={license || "未驗證"} />
      <Row label="狀態" value={status || "未提供"} />
      <Row label="geometry precision" value={precision || "來源未標示"} />
      <Row label="coverage" value={str(props.coverage_scope)} />
      <Row label="filter_layer_id" value={str(props.filter_layer_id)} />
      <Row label="顯示分類" value={str(props.facility_category)} />
      <Row label="類型" value={str(props.facility_type) || str(props.registered_type) || str(props.park_class_name) || str(props.legal_class_label) || str(props.protection_class) || str(props.category)} />
      <Row label="地址／位置" value={str(props.address) || str(props.location_ja) || str(props.prefecture)} />
      <Row label="來源網址" value={str(props.source_url) || str(props.leaflet_url) || str(props.area_detail_url)} />
    </>
  );
}

export function JpAccommodationDensityPanel({ props }: { props: Record<string, unknown> }) {
  const count = Number(props.n_records);
  const gridSize = Number(props.grid_size_m);
  const density = Number(props.density_per_km2);
  return (
    <>
      <Title color="#ea580c">旅宿密度網格 宿泊施設密度グリッド</Title>
      <Row label="網格尺度" value={Number.isFinite(gridSize) ? `${gridSize.toLocaleString("zh-TW")} m` : ""} />
      <Row label="格內旅宿" value={Number.isFinite(count) ? `${count.toLocaleString("zh-TW")} 間` : ""} />
      <Row label="每平方公里" value={Number.isFinite(density) ? density.toLocaleString("zh-TW", { maximumFractionDigits: 1 }) : ""} />
      <Row label="網格 ID" value={str(props.grid_id)} />
      <Row label="計數契約" value="只計可繪 canonical 實體；不叠加 OSM coverage，不補無 geometry 資料。" />
    </>
  );
}

/** Source-aware Japan water popup. Never derives a status, capacity, or observation from a missing value. */
export function JpWaterPanel({ props }: { props: Record<string, unknown> }) {
  const title = str(props.name) || str(props.facility_name) || str(props.station_name) || str(props.lake_name) || str(props.entity_id) || "日本水資源資料";
  const rawRole = str(props.entity_role) || str(props.facility_category) || str(props.observation_kind);
  const role = {
    water_quality_station: "水質測站",
    water_level_station: "水位測站",
    lake_or_reservoir_water_surface: "湖泊或水庫水面",
    water_supply_related_facility: "供水相關設施",
    sewer_facility: "下水道設施",
  }[rawRole] || rawRole;
  const sourceYear = str(props.source_year);
  const isQualityRegistry = /quality|水質/i.test(rawRole) || /quality|水質/i.test(str(props.source));
  return <>
    <Title color="#0ea5e9">{title}</Title>
    <Row label="類型" value={role} />
    <Row label="來源年份" value={!sourceYear || /^unknown\b/i.test(sourceYear) ? "來源未註" : sourceYear} />
    <Row label="來源" value={str(props.source) || str(props.attribution)} />
    <Row label="授權" value={str(props.license)} />
    <Row label="涵蓋範圍" value={str(props.coverage)} />
    <Row label="營運者" value={str(props.operator)} />
    <Row label="容量" value={str(props.capacity)} />
    <Row label="來源網址" value={str(props.source_url)} />
    {isQualityRegistry && <Row label="資料限制" value="此圖層是測定站名錄，不含水質濃度或趨勢。" />}
  </>;
}

/**
 * `lines` / `operators` / `railway_categories` 等陣列欄位：queryRenderedFeatures()
 * 拿到的 properties 是 vector tile 編碼後的結果，mapbox-gl-js 的 vt-pbf
 * writeProperties() 對陣列一律 JSON.stringify()（見 shared.tsx 同類註解）。
 * 兩種來源都要接得住：真陣列（測試環境／未來直讀）與 JSON 字串（實際瀏覽器）。
 */
function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // 非 JSON 字串（理論上不會發生，防禦性 fallback）
      return [raw];
    }
  }
  return [];
}

const ADMIN_COLOR = { prefecture: "#f59e0b", municipality: "#fbbf24" };
const STATION_COLOR = "#38bdf8";
const AIRPORT_COLOR = "#a78bfa";

/** 日本都道府県界（47 筆，單色） */
export function JpAdminPrefecturePanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={ADMIN_COLOR.prefecture}>{str(props.pref_name) || "都道府県"}</Title>
      <Row label="都道府県コード" value={str(props.pref_code)} />
    </>
  );
}

/** 日本市区町村界（1,905 筆，單色） */
export function JpAdminBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={ADMIN_COLOR.municipality}>{str(props.city_name) || str(props.ward_name) || "市区町村"}</Title>
      <Row label="都道府県" value={str(props.pref_name)} />
      <Row label="郡" value={str(props.county_name)} />
      <Row label="市区町村" value={str(props.city_name)} />
      <Row label="行政区" value={str(props.ward_name)} />
      <Row label="行政コード" value={str(props.admin_code)} />
    </>
  );
}

/** 日本車站（9,046 點，單色；運量取 2022-2024 最新一筆） */
export function JpStationsPanel({ props }: { props: Record<string, unknown> }) {
  const lines = parseStringArray(props.lines);
  const operators = parseStringArray(props.operators);
  const railwayCategories = parseStringArray(props.railway_categories);
  // 運量：passengers_latest 可能為 null（該 latest_year 當年無資料，例：稚内
  // latest_year=2024 無值但 2023=114）→ 逐年 fallback 2024→2023→2022 取最新有值者。
  // ⚠️ 兩個坑：(1) null 經 vt-pbf writeProperties() 會變字串 "null"（非
  // string/boolean/number 一律 JSON.stringify）；(2) Number(null)===0（finite）。
  // 兩者都要先擋 null/""/"null" 再 Number，否則顯示「0 人/日」或「NaN」。
  const passengerCount = (v: unknown): number | null => {
    if (v == null || v === "" || v === "null") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const explicitCount = passengerCount(props.passengers_latest);
  const explicitYear = str(props.passengers_latest_year);
  let passenger: { count: number; year: string } | null =
    explicitCount != null && explicitYear && explicitYear !== "null"
      ? { count: explicitCount, year: explicitYear }
      : null;
  if (!passenger) {
    for (const y of ["2024", "2023", "2022"]) {
      const c = passengerCount(props[`passengers_${y}`]);
      if (c != null) { passenger = { count: c, year: y }; break; }
    }
  }
  const passengerLabel = passenger
    ? `${passenger.count.toLocaleString("ja-JP")} 人/日（${passenger.year}）`
    : "無資料";

  return (
    <>
      <Title color={STATION_COLOR}>{str(props.name) || "無名車站"}</Title>
      <Row label="路線" value={lines.join(" / ")} />
      <Row label="營運者" value={operators.join(" / ")} />
      <Row label="種別" value={railwayCategories.join(" / ")} />
      <Row label="運量" value={passengerLabel} />
    </>
  );
}

/** 日本機場（108 面，單色） */
export function JpAirportsPanel({ props }: { props: Record<string, unknown> }) {
  const runwayLength = props.runway_length_m;
  const runwayWidth = props.runway_width_m;
  const runwayLabel = runwayLength != null && runwayWidth != null
    ? `${runwayLength} × ${runwayWidth} m`
    : "";

  return (
    <>
      <Title color={AIRPORT_COLOR}>{str(props.name) || "機場"}</Title>
      <Row label="種別" value={str(props.category)} />
      <Row label="供用状況" value={str(props.status)} />
      <Row label="定期便" value={str(props.regular_flight)} />
      <Row label="滑走路" value={runwayLabel} />
    </>
  );
}

/**
 * 日本鐵道路線（21,933 段，事業者種別 5 色）。
 * PMTiles 屬性全為 String 純量（非車站那種陣列），直接 str() 即可。
 */
export function JpRailwaysPanel({ props }: { props: Record<string, unknown> }) {
  const operatorType = str(props.operator_type);
  const color =
    JP_RAILWAY_TYPES.find((t) => t.value === operatorType)?.color ?? JP_RAILWAY_TYPE_OTHER.color;
  return (
    <>
      {/* 標題已是路線名，故不再重複一列「路線名」（比照 JpSchoolsPanel 以校名為標題）。 */}
      <Title color={color || JP_RAILWAY_LAYER_COLOR}>{str(props.line_name) || "鉄道路線"}</Title>
      <Row label="運営会社" value={str(props.operator)} />
      <Row label="事業者種別" value={operatorType} />
      <Row label="鉄道区分" value={str(props.railway_category)} />
    </>
  );
}

/**
 * 日本學校（56,807 點，学校分類 13 色）。
 * PMTiles 只保留 6 個 String 屬性（*_code 冗餘欄已在轉檔剔除），直接 str() 即可。
 * 標題色跟著該校的分類走，與地圖上的點同色。
 */
export function JpSchoolsPanel({ props }: { props: Record<string, unknown> }) {
  const schoolClass = str(props.school_class);
  const color =
    JP_SCHOOL_TYPES.find((t) => t.value === schoolClass)?.color ?? JP_SCHOOL_TYPE_OTHER.color;
  return (
    <>
      <Title color={color}>{str(props.name) || "学校"}</Title>
      <Row label="学校分類" value={schoolClass} />
      <Row label="設置者" value={str(props.administrator)} />
      <Row label="休校区分" value={str(props.closed_status)} />
      <Row label="所在地" value={str(props.address)} />
    </>
  );
}

// ⚠️ 兩個坑（同 JpStationsPanel 的 passengerCount）：(1) null 經 vt-pbf
// writeProperties() 會變字串 "null"；(2) Number(null)===0（finite）。
// 兩者都要先擋 null/""/"null" 再 Number，否則顯示「0 人」或「NaN」。
const meshNum = (v: unknown): number | null => {
  if (v == null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const meshPopText = (v: unknown): string => {
  const n = meshNum(v);
  return n == null ? "" : `${n.toLocaleString()} 人`;
};
// ratio65 是 0~1 比例 → ×100 顯示成 %；**0 是官方對極小人口 mesh 的隱私遮罩，
// 不是真的 0%**（見 jpPopulationMeshModes.ts），故顯示「未公開」而非 0.0%。
const meshRatioText = (v: unknown): string => {
  const n = meshNum(v);
  if (n == null) return "";
  if (n === 0) return JP_POPULATION_MESH_MASK.label;
  return `${(n * 100).toFixed(1)}%`;
};

/**
 * 日本 1km 人口網格（176,896 格，JIS X0410 3次メッシュ）。
 * 一次列出 5 個年份的總人口與 4 個年份的高齡比 —— popup 本身就是一條時間序列，
 * 不必反覆切 select 才看得到同一格的世代變化。
 */
export function JpPopulationMeshPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={JP_POPULATION_MESH_LAYER_COLOR}>{`網格 ${str(props.id) || "—"}`}</Title>
      {JP_POPULATION_MESH_MODES.filter((m) => m.metric === "pop").map((m) => (
        <Row key={m.field} label={m.label} value={meshPopText(props[m.field])} />
      ))}
      {JP_POPULATION_MESH_MODES.filter((m) => m.metric === "ratio65").map((m) => (
        <Row key={m.field} label={m.label} value={meshRatioText(props[m.field])} />
      ))}
    </>
  );
}

/** MVT null may be serialized as the string "null". */
const policeText = (v: unknown): string => v == null || v === "null" || v === "undefined" ? "" : String(v).trim();
export function JpPoliceFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const facilityType = JP_POLICE_FACILITY_TYPES.find(t => t.value === props.facility_type);
  const precision: Record<string, string> = { mapped_poi: "地圖設施點", mapped_label: "地圖注記", address: "地址", block: "街區", chome: "丁目", town: "町域" };
  return <>
    <Title color={facilityType?.color ?? JP_POLICE_LAYER_COLOR}>{policeText(props.name) || "警察設施 警察施設"}</Title>
    <Row label="設施類型" value={facilityType?.label ?? "未提供"} />
    <Row label="都道府縣" value={policeText(props.prefecture) || "未提供"} />
    <Row label="地址" value={policeText(props.address) || "未提供"} />
    <Row label="電話" value={policeText(props.phone) || "未提供"} />
    <Row label="資料時點" value={policeText(props.source_as_of) || "未提供"} />
    {props.geom_status === "degraded" && <Row label="約略位置" value="地址僅解析到丁目／町域，非精確設施位置" />}
    <Row label="座標精度" value={precision[policeText(props.geom_precision)] ?? "未提供"} />
    <Row label="位置來源" value={props.geometry_source === "gsi_address" ? "国土地理院 AddressSearch" : props.geometry_source === "gsi_optimal_bvmap" ? "国土地理院最適化ベクトルタイル" : "未提供"} />
    <Row label="出典" value={JP_POLICE_ATTRIBUTION} />
  </>;
}
