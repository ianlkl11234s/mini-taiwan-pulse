/**
 * 英國 C003 地形兩層（OS Terrain 50 山體陰影／色別標高，raster PNG PMTiles）與 C028 公有地標售（Cabinet Office
 * Government Property Estate — Disposal，420 點）：色票、類別、署名 SSOT。圖例、popup 與 hook paint 共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/base_map/gb_terrain50_relief.md`、
 * `docs/data-catalog/real_estate/gb_surplus_land.md`，以及 `waves/w1/layer-plan.md`（C003）、`waves/w2/layer-plan.md`（C028）。
 *
 * 色別標高的色階烘在圖磚裡（上游產製），設計規範沒有「標高色階」token：圖例只列上游烘焙停點，前端不另上色。
 * 標售進度沿用台灣「國有財產待標售」單一色相（ATLAS_LAYER_COLORS.statePropertyTenderListings），
 * 依進度用填色強度區分（尚未上市空心最淡 → 洽談中半實心 → 上市標售中實心），不新增色。
 */
import { ATLAS_LAYER_COLORS } from "./atlasLayerColors";

export const GB_OS_TERRAIN_ATTRIBUTION = "Contains OS data © Crown copyright and database right 2026";
export const GB_OS_TERRAIN_URL = "https://www.ordnancesurvey.co.uk/products/os-terrain-50";
/** 檔 z5–11（各 3,161 個 PNG 圖磚）；z11 以上 overzoom。 */
export const GB_TERRAIN_TILE_ZOOM = { minzoom: 5, maxzoom: 11 } as const;
export const GB_TERRAIN_LEGEND_COLOR = "#6b7280";

/** 色別標高烘焙停點（m → hex，停點間線性內插；-3 m 以下用最低色、海面透明）＝ layer-plan C003 色票表。 */
export const GB_TERRAIN_RELIEF_STOPS: readonly { m: number; color: string }[] = [
  { m: -3, color: "#4C8C54" },
  { m: 50, color: "#78AA60" },
  { m: 150, color: "#B0C470" },
  { m: 300, color: "#DECE84" },
  { m: 500, color: "#CAA062" },
  { m: 700, color: "#A4764A" },
  { m: 900, color: "#88685C" },
  { m: 1_100, color: "#BEBAB6" },
  { m: 1_345, color: "#F5F5F5" },
];
export const GB_TERRAIN_RELIEF_COLOR = GB_TERRAIN_RELIEF_STOPS[3]!.color;

// ─────────────────────────── C028 公有地標售 gbSurplusLand ───────────────────────────

export const GB_SURPLUS_FETCHED_AT = "2026-10-29";
export const GB_SURPLUS_SOURCE_DATE = "2026-06-29";
export const GB_SURPLUS_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0 (Cabinet Office, The Government Property Estate — Disposal)";
export const GB_SURPLUS_SOURCE_URL = "https://www.data.gov.uk/dataset/a3ad62cf-d8a2-4d3b-b3c6-24c35c5e0f71/the-government-property-estate-including-buildings-and-land";
export const GB_SURPLUS_LICENSE = "Open Government Licence v3.0";
export const GB_SURPLUS_COUNT = 420;
export const GB_SURPLUS_TILE_ZOOM = { minzoom: 4, maxzoom: 12 } as const;
export const GB_SURPLUS_MINZOOM = 5;
export const GB_SURPLUS_COLOR = ATLAS_LAYER_COLORS.statePropertyTenderListings;

export type GbSurplusStatus = "not_on_market" | "under_offer" | "on_market";
/** 宣告順序＝圖例順序（進度由淡到強）；fill＝填色強度倍率（乘透明度），count＝2026-10-29 成品筆數。 */
export const GB_SURPLUS_STATUSES: readonly { value: GbSurplusStatus; fill: number; count: number }[] = [
  { value: "not_on_market", fill: 0.15, count: 334 },
  { value: "under_offer", fill: 0.55, count: 44 },
  { value: "on_market", fill: 1, count: 42 },
];
/** 空心／半實心的描邊寬（同色）。 */
export const GB_SURPLUS_STROKE_WIDTH = 1.5;
export function gbSurplusStatus(value: unknown) {
  return GB_SURPLUS_STATUSES.find((s) => s.value === value);
}

export type GbSurplusSector = "nhs" | "wales_public" | "central_civil" | "mod" | "scottish_gov";
export const GB_SURPLUS_SECTORS: readonly GbSurplusSector[] = ["nhs", "wales_public", "central_civil", "mod", "scottish_gov"];
/** 郵遞區號已停用、以郵遞區號中心定位的 2 筆。 */
export const GB_SURPLUS_POSTCODE_PRECISION = "postcode_centroid_terminated";
