import type { ExpressionSpecification } from "mapbox-gl";

/**
 * 全臺橋梁清冊點位／方向候選（進行中）站主限定私人 PMTiles 契約。
 *
 * 一個檔、一個 source-layer；只經同源 Range API（每個請求帶 Bearer token，sidecar 驗 owner）讀取。
 * 授權為 HOLD_BSS_BULK_REUSE_RIGHTS_UNCONFIRMED：不得進公開 CDN／static／release allowlist。
 *
 * 語意（必守）：
 * - 26,188 筆是「來源紀錄」，不是去重後橋座數；23,772 條方向線是「無向局部走向候選」，
 *   不是橋長、橋頭尾或路網邊；2,416 筆只有點。
 * - 影像正式抽驗 300 筆：103 支持、2 負向、195 未定；整體錯誤率 < 3% 尚未證明。
 * 分析專題：taipei-gis-analytics/pipelines/analysis/bridge_resilience/
 */

export const BSS_BRIDGE_PRIVATE_ENDPOINT = "/api/private-research/bss-bridge/tiles";
export const BSS_BRIDGE_PMTILES_FILE = "bss_bridge_location_direction_preview_20260927_v4.pmtiles";
export const BSS_BRIDGE_ACCESS_DENIED_EVENT = "bss-bridge-access-denied";
export const BSS_BRIDGE_SELECTION_CLEAR_EVENT = "bss-bridge-selection-clear";
export const BSS_BRIDGE_SOURCE_LAYER = "bss_bridge_national_preview";
export const BSS_BRIDGE_MIN_ZOOM = 6;
export const BSS_BRIDGE_MAX_ZOOM = 15;
/** 打包時 point 只在 z10 以上才顯示（26k 點在低縮放過密）。 */
export const BSS_BRIDGE_POINT_MIN_ZOOM = 10;
export const BSS_BRIDGE_RIGHTS_TEXT = "BSS 批次重用權利待確認（HOLD；僅站主研究用，不公開散布）";
export const BSS_BRIDGE_ATTRIBUTION = "BSS 公開查詢（授權 HOLD，僅站主研究）；新北市政府橋梁清冊；© OpenStreetMap contributors (ODbL)；進行中：非實橋身份、分類或路網驗證";

export const BSS_BRIDGE_PRIVATE_LAYER_KEYS = ["bssNationalBridgePreview", "bssNationalBridgePointsPreview"] as const;
export type BssBridgeLayerKey = typeof BSS_BRIDGE_PRIVATE_LAYER_KEYS[number];

export function isBssBridgePrivateLayer(key: string): key is BssBridgeLayerKey {
  return (BSS_BRIDGE_PRIVATE_LAYER_KEYS as readonly string[]).includes(key);
}

export const BSS_BRIDGE_ACCESS_COLORS = {
  road_bridge_carrier_candidate: "#22c55e",
  road_elevated_or_expressway_review: "#f97316",
  road_unresolved: "#94a3b8",
  foot_or_rail_register_only: "#a78bfa",
} as const;
/** 圖例與地圖共用的中性說明色（灰）與新增局部方向候選線色（藍）。 */
export const BSS_BRIDGE_NOTE_COLOR = "#94a3b8";
export const BSS_BRIDGE_STAGE1_LINE_COLOR = "#38bdf8";

export const bssBridgeAccessColorExpression: ExpressionSpecification = [
  "match", ["get", "facility_class_candidate"],
  ...Object.entries(BSS_BRIDGE_ACCESS_COLORS).flatMap(([value, color]) => [value, color]),
  BSS_BRIDGE_ACCESS_COLORS.road_unresolved,
];

/** 線層 role → Mapbox layer id（字面值，供點擊接線 ratchet 比對）與線型；實線／虛線／點線保留方向來源層級。 */
export const BSS_BRIDGE_LINE_ROLES = [
  { id: "bss-national-bridge-preview-original-direction-line", role: "original_direction_line", dash: null, wide: false },
  { id: "bss-national-bridge-preview-offset-direction-line", role: "offset_direction_line", dash: [1.5, 1], wide: false },
  { id: "bss-national-bridge-preview-ordinary-route-context", role: "ordinary_route_direction_context", dash: [2, 1], wide: true },
  { id: "bss-national-bridge-preview-near-curved-carrier-local-context", role: "near_curved_carrier_local_direction_context", dash: [2, 1], wide: true },
  { id: "bss-national-bridge-preview-waterway-crossing-context", role: "waterway_crossing_direction_context", dash: [2, 1], wide: true },
  { id: "bss-national-bridge-preview-multi-near-carrier-waterway-context", role: "multi_near_carrier_waterway_direction_context", dash: [2, 1], wide: true },
  { id: "bss-national-bridge-preview-tied-route-consensus-context", role: "tied_route_consensus_direction_context", dash: [1, 2], wide: true },
  { id: "bss-national-bridge-preview-no-waterway-carrier-consensus-context", role: "no_waterway_carrier_consensus_direction_context", dash: [1, 2], wide: true },
  { id: "bss-national-bridge-preview-no-crossing-nearest-route-context", role: "no_crossing_nearest_route_direction_context", dash: [1, 2], wide: true },
  { id: "bss-national-bridge-preview-stage1-local-direction-candidate", role: "stage1_local_direction_candidate", dash: [1, 1], wide: false },
] as const;

export const BSS_BRIDGE_POINT_LAYER_ID = "bss-national-bridge-preview-point";
export const BSS_BRIDGE_SOURCE_ID = "bss-national-bridge-preview";

export const BSS_BRIDGE_CLASS_VALUES = ["", "road_bridge_carrier_candidate", "road_elevated_or_expressway_review", "road_unresolved", "foot_or_rail_register_only"] as const;

const STAGE1_SUPPORTED_FILTER: unknown[] = ["all",
  ["==", ["get", "stage1_status"], "supported"],
  ["==", ["typeof", ["get", "stage1_release_id"]], "string"],
  ["!=", ["get", "stage1_release_id"], ""],
];

/** 品質篩選：0 全部、1 影像有支持（綁第一階段 release）、2 待確認。第一階段只支持位置＋無向局部方向，不是身份、分類或路網。 */
export function bssBridgeQualityFilter(qualityIndex = 0): unknown[] {
  if (qualityIndex === 1) return STAGE1_SUPPORTED_FILTER;
  if (qualityIndex === 2) return ["!", STAGE1_SUPPORTED_FILTER];
  return ["has", "feature_id"];
}

export function bssBridgeLineFilter(role: string, classIndex = 0, qualityIndex = 0): unknown[] {
  const filters: unknown[] = [["==", ["get", "geometry_role"], role]];
  const selected = BSS_BRIDGE_CLASS_VALUES[classIndex];
  if (selected) filters.push(["==", ["get", "facility_class_candidate"], selected]);
  if (qualityIndex !== 0) filters.push(bssBridgeQualityFilter(qualityIndex));
  return filters.length === 1 ? filters[0] as unknown[] : ["all", ...filters];
}

export function bssBridgePointFilter(qualityIndex = 0): unknown[] {
  const roleFilter = ["==", ["get", "geometry_role"], "point"];
  return qualityIndex === 0 ? roleFilter : ["all", roleFilter, bssBridgeQualityFilter(qualityIndex)];
}
