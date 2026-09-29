import type { CardPayloadV1 } from "../cardPayload";

/** 形狀對照 mcp buildCardPayload 的縣市 choropleth 輸出（假資料，不連任何遠端）。 */
export function areaPayload(): CardPayloadV1 {
  return {
    schema_version: 1,
    kind: "area",
    title: "臺北市的公園密度最高",
    generated_at: "2026-09-28T10:00:00+08:00",
    data_period: { start: "2025-01-01", end: null, label: "2025 年" },
    stats: [
      { label: "最高：臺北市", value: 12.5, unit: "處/km²", value_kind: "ratio" },
      { label: "最低：臺東縣", value: 0.2, unit: "處/km²", value_kind: "ratio" },
      { label: "有資料的區域", value: 3, unit: "區", value_kind: "count" },
    ],
    top: [
      { name: "臺北市", value: 12.5, class_index: 2 },
      { name: "新北市", value: 4.1, class_index: 1 },
      { name: "臺東縣", value: 0.2, class_index: 0 },
    ],
    map: {
      geometry: {
        level: "county", boundary_version: "COUNTY_MOI_1140318", code_scheme: "TW_MOI_COUNTY",
        resource_url: "https://data.itsmigu.com/statistics/v1/geometries/3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c.geojson",
        sha256: "3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c", code_property: null,
      },
      areas: [["63000", 2], ["65000", 1], ["10014", 0], ["09020", null]],
      ramp: "viridis",
      scheme: "sequential",
      breaks: [1, 5],
      class_labels: ["< 1", "1–5", "≥ 5"],
    },
    points: null,
    query_scope: null,
    legend: { title: "公園密度", unit: "處/km²", method: "quantile", missing_count: 1 },
    sources: [
      { dataset_label: "都市計畫公園", publisher: "內政部", data_time: "2025-12", license: "OGDL-Taiwan-1.0", attribution: null },
      { dataset_label: "直轄市、縣市界線", publisher: null, data_time: null, license: "OGDL-Taiwan-1.0", attribution: "內政部國土測繪中心" },
    ],
    caveats: ["金門縣沒有資料，地圖以斜線表示。"],
  };
}

export function pointsPayload(): CardPayloadV1 {
  return {
    schema_version: 1,
    kind: "points",
    title: "車站 500 公尺內有 3 處公園",
    generated_at: "2026-09-28T10:00:00+08:00",
    data_period: null,
    stats: [{ label: "點位數", value: 3, unit: "處", value_kind: "count" }],
    top: [],
    map: null,
    points: { items: [{ name: "二二八公園", lnglat: [121.51534, 25.04083], class_index: null }, { name: null, lnglat: [121.518, 25.045], class_index: null }], ramp: null, breaks: [] },
    query_scope: { center: [121.5, 25.04], radius_m: 500 },
    legend: { title: "公園", unit: null, method: "category", missing_count: 0 },
    sources: [{ dataset_label: "公園", publisher: "臺北市政府", data_time: null, license: "OGDL-Taiwan-1.0", attribution: null }],
    caveats: [],
  };
}
