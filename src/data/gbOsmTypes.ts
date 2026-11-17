/**
 * 英國第 13 波 OSM 4 層（2026-11-13 OSM 快照）：主要道路橋梁與隧道 gbBridgesTunnels、道路設施 gbRoadFacilities、
 * 公共設施 gbPublicFacilities、宗教場所 gbPlacesOfWorship。色票、筆數、署名的單一來源（hook／圖例／popup 共用）。
 * 筆數與授權原句見 analytics `docs/data-catalog/{transportation,civic_facilities,religion}/gb_*.md` 與各目錄 `_manifest.json`（2026-11-13）。
 * 類別無外部語意 → 取共用類別色盤 C-5（`MAP_CATEGORICAL`，依底圖）；「未標示」用中性色。
 */
import { categoricalColor, categoricalNeutral } from "../map/mapStyleScale";

export const GB_OSM13_SNAPSHOT = "2026-11-13";
export const GB_OSM13_TIMESTAMP = "2026-11-13T00:54:47Z";
export const GB_OSM13_ATTRIBUTION = "© OpenStreetMap contributors";
export const GB_OSM13_URL = "https://www.openstreetmap.org/copyright";
export const GB_OSM13_ODBL = "ODbL 1.0";
export const GB_NH_ATTRIBUTION =
  "Contains public sector information licensed under the Open Government Licence v3.0: Emergency Areas (National Highways)";
export const GB_NH_URL = "https://services-eu1.arcgis.com/mZXeBXkkZpekxjXT/arcgis/rest/services/National_Highways_Emergency_Areas/FeatureServer/0";
export const GB_NH_OGL_V3 = "OGL v3.0";

/** 類別定義：colorIndex＝C-5 色盤索引（null＝中性色）。宣告順序＝圖例順序＝類別多選 bit 順序。 */
export interface GbOsmKindDef<V extends string = string> { value: V; colorIndex: number | null; count: number }
export const gbOsmKindColor = (k: { colorIndex: number | null }, isDark: boolean) =>
  k.colorIndex == null ? categoricalNeutral(isDark) : categoricalColor(k.colorIndex, isDark);

// ─────────────────────────── 主要道路橋梁與隧道 gbBridgesTunnels（線） ───────────────────────────

export type GbStructure = "bridge" | "tunnel";
export const GB_STRUCTURES: readonly GbOsmKindDef<GbStructure>[] = [
  { value: "bridge", colorIndex: 0, count: 29_009 },
  { value: "tunnel", colorIndex: 1, count: 484 },
];
export const GB_BRIDGES_TUNNELS_COUNT = 29_493;
export const GB_BRIDGES_TUNNELS_BY_NATION = { England: 20_337, Scotland: 5_259, Wales: 2_555, "Northern Ireland": 1_342 } as const;
/** 圖磚 z5–13（analytics 07_export.py `-Z 5`，2026-11-14 由 z6 重切）。 */
export const GB_BRIDGES_TUNNELS_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const gbStructure = (value: unknown) => GB_STRUCTURES.find((s) => s.value === value);

// ─────────────────────────── 道路設施 gbRoadFacilities（點） ───────────────────────────

export type GbRoadFacilityKind = "services" | "rest_area" | "toll_booth" | "emergency_area";
export const GB_ROAD_FACILITY_KINDS: readonly GbOsmKindDef<GbRoadFacilityKind>[] = [
  { value: "services", colorIndex: 0, count: 585 },
  { value: "rest_area", colorIndex: 5, count: 610 },
  { value: "toll_booth", colorIndex: 3, count: 124 },
  { value: "emergency_area", colorIndex: 1, count: 438 },
];
export const GB_ROAD_FACILITIES_COUNT = 1_757;
export const GB_ROAD_FACILITIES_BY_NATION = { England: 1_497, Wales: 119, "Northern Ireland": 75, Scotland: 66 } as const;
export const GB_ROAD_FACILITIES_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const gbRoadFacilityKind = (value: unknown) => GB_ROAD_FACILITY_KINDS.find((k) => k.value === value);

// ─────────────────────────── 公共設施 gbPublicFacilities（點，≥1 萬點熱區） ───────────────────────────

export type GbPublicFacilityKind = "community_centre" | "toilets" | "post_office" | "marketplace";
export const GB_PUBLIC_FACILITY_KINDS: readonly GbOsmKindDef<GbPublicFacilityKind>[] = [
  { value: "community_centre", colorIndex: 0, count: 16_750 },
  { value: "toilets", colorIndex: 2, count: 14_320 },
  { value: "post_office", colorIndex: 1, count: 9_416 },
  { value: "marketplace", colorIndex: 3, count: 847 },
];
export const GB_PUBLIC_FACILITIES_COUNT = 41_333;
export const GB_PUBLIC_FACILITIES_BY_NATION = { England: 32_361, Scotland: 4_452, Wales: 2_644, "Northern Ireland": 1_876 } as const;
/** 圖磚 z5–13（analytics `-Z 5`，2026-11-14 由 z6 重切）。 */
export const GB_PUBLIC_FACILITIES_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const gbPublicFacilityKind = (value: unknown) => GB_PUBLIC_FACILITY_KINDS.find((k) => k.value === value);

// ─────────────────────────── 宗教場所 gbPlacesOfWorship（點，≥1 萬點熱區） ───────────────────────────

/** OSM religion 六大類＋other（其他宗教）＋unknown（religion 未標，不推測）。 */
export type GbWorshipKind = "christian" | "muslim" | "jewish" | "sikh" | "hindu" | "buddhist" | "other" | "unknown";
export const GB_WORSHIP_KINDS: readonly GbOsmKindDef<GbWorshipKind>[] = [
  { value: "christian", colorIndex: 0, count: 38_850 },
  { value: "muslim", colorIndex: 6, count: 1_421 },
  { value: "jewish", colorIndex: 2, count: 229 },
  { value: "sikh", colorIndex: 3, count: 209 },
  { value: "hindu", colorIndex: 1, count: 164 },
  { value: "buddhist", colorIndex: 4, count: 120 },
  { value: "other", colorIndex: 7, count: 258 },
  { value: "unknown", colorIndex: null, count: 862 },
];
export const GB_PLACES_OF_WORSHIP_COUNT = 42_113;
export const GB_PLACES_OF_WORSHIP_BY_NATION = { England: 33_366, Scotland: 3_497, Wales: 3_361, "Northern Ireland": 1_889 } as const;
/** 圖磚 z5–13（analytics `-Z 5`，2026-11-14 由 z7 重切）。 */
export const GB_PLACES_OF_WORSHIP_TILE_ZOOM = { minzoom: 5, maxzoom: 13 } as const;
export const gbWorshipKind = (value: unknown) => GB_WORSHIP_KINDS.find((k) => k.value === value);

/** 圖層代表色（manifest／popup 標題後備色）：取各層第一類的暗底色。 */
export const GB_BRIDGES_TUNNELS_COLOR = categoricalColor(0, true);
export const GB_ROAD_FACILITIES_COLOR = categoricalColor(0, true);
export const GB_PUBLIC_FACILITIES_COLOR = categoricalColor(0, true);
export const GB_PLACES_OF_WORSHIP_COLOR = categoricalColor(6, true);
