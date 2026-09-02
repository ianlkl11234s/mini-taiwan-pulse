import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { JP_RAILWAY_LAYER_COLOR } from "../../data/jpRailwayTypes";
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
  return (
    <>
      <Title color={JP_RAILWAY_LAYER_COLOR}>{str(props.line_name) || "鉄道路線"}</Title>
      <Row label="路線名" value={str(props.line_name)} />
      <Row label="運営会社" value={str(props.operator)} />
      <Row label="事業者種別" value={str(props.operator_type)} />
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
