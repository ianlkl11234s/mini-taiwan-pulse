import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { JP_RAILWAY_LAYER_COLOR } from "../../data/jpRailwayTypes";

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
