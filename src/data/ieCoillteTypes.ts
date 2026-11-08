/**
 * 愛爾蘭第 5c 波：Coillte 國有林遊憩點＋森林入口（ieCoillteRecreation）、林道＋遊憩步道（ieCoillteForestRoads）。站主限定。
 *
 * 授權：Coillte ArcGIS item licenseInfo「You agree not to copy, publish or use the data on another website …」、
 * 「not to use the information provided except for research or private study and will not supply a copy of this information
 * to any other person without seeking prior permission from Coillte」→ 使用者 2026-11-07 拍板站主限定（破例）。
 * 🚫 資料只在 Supabase reference.world_ie_coillte_{recreation,forest_roads}，經 owner-only RPC 讀取（gis-platform mig 512）；
 * 不進 public/、S3、R2、PMTiles、分析倉庫或任何公開檔，也不快取到 localStorage。
 *
 * 不放進 IE_DATA_SPECS（那條鏈假設 PMTiles）；圖例與 popup 共用 ieLegends／iePanels 的規格版元件（`IeSpecLegend`、`makeIePanel`），
 * 樣式在 overlayRegistry（dynamicData），資料由 hooks/useIeCoillteLayers.ts setData。
 */
import type { KrCat, L3 } from "./krDataLayers";
import type { IeLayerSpec } from "./ieDataLayers";
import { selectedMultiSelectValues } from "./multiSelectMapbox";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export type IeCoillteKey = "ieCoillteRecreation" | "ieCoillteForestRoads";
export const IE_COILLTE_KEYS: readonly IeCoillteKey[] = ["ieCoillteRecreation", "ieCoillteForestRoads"];

/** 圖例與 popup 用到的規格欄位（同 IE_DATA_SPECS 的寫法，但沒有 PMTiles 檔） */
export type IeCoillteSpec = Pick<IeLayerSpec, "geom" | "color" | "count" | "catProp" | "cats" | "title" | "fields" | "legendNotes" | "popupNotes" | "sourceOrg" | "sourceUrl" | "license" | "fetchedAt"> & {
  key: IeCoillteKey;
  cats: readonly KrCat[];
  catProp: string;
  rpc: string;
  sourceId: string;
  loading: L3;
};

export const IE_COILLTE_FETCHED_AT = "2026-11-08";
/**
 * 林道依畫面分批讀的起點縮放。整包 RPC 約 7.9MB（超過使用者訂的 2MB 門檻）；實測（2026-11-08，站主身分）
 * z10 視窗約 1,300 條／0.75MB／0.15 s、z9 約 3,400 條／1.7MB、z8 約 12,000 條／5.7MB → 取 z10。
 * 低於此縮放不查也不畫，由視野提示卡（spec §5.42.1）提示「放大到 z10」。
 */
export const IE_COILLTE_ROADS_MIN_ZOOM = 10;
const SOURCE_URL = "https://data.gov.ie/organization/coillte";
const LICENSE = "Coillte 使用條款：僅限研究或私人學習、不得轉供他人或用於其他網站（站主限定）";
const LICENSE_NOTE = l3(
  "站主限定：Coillte 條款只允許研究或私人學習、不得轉供他人或用於其他網站，所以只有站主登入看得到",
  "Owner only: Coillte's terms allow research or private study only and forbid supplying the data to others or using it on another website, so only the site owner can see it",
  "サイト管理者限定：Coillte の利用条件は研究・私的学習のみで、第三者への提供や他サイトでの利用を禁じているため、管理者のログイン時のみ表示",
);
const LA = { prop: "la_name", label: l3("地方政府", "Local authority", "地方自治体") } as const;

export const IE_COILLTE_RECREATION_CATS: readonly KrCat[] = [
  { id: "site", values: ["site"], color: "#4ade80", label: l3("遊憩點（森林公園、步道起點等）", "Recreation site (forest parks, trailheads…)", "レクリエーション地点（森林公園・トレイル起点など）") },
  { id: "entrance", values: ["entrance"], color: "#a78bfa", label: l3("森林入口", "Forest entrance", "森林の入口") },
];
export const IE_COILLTE_ROAD_CATS: readonly KrCat[] = [
  { id: "forest_road", values: ["forest_road"], color: "#f59e0b", label: l3("林道", "Forest road", "林道") },
  { id: "recreation_trail", values: ["recreation_trail"], color: "#4ade80", label: l3("遊憩步道", "Recreation trail", "レクリエーション・トレイル") },
];
const catMap = (cats: readonly KrCat[]) => Object.fromEntries(cats.map((c) => [c.id, c.label]));

export const IE_COILLTE_RECREATION: IeCoillteSpec = {
  key: "ieCoillteRecreation", geom: "point", color: "#4ade80", count: 13_041,
  catProp: "kind", cats: IE_COILLTE_RECREATION_CATS,
  rpc: "get_ie_coillte_recreation", sourceId: "ie-coillte-recreation",
  title: { props: ["name", "property"], fallback: l3("Coillte 國有林", "Coillte forest", "Coillte 国有林") },
  fields: [
    { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(IE_COILLTE_RECREATION_CATS) },
    { prop: "forest_name", label: l3("林區", "Forest", "林区") },
    { prop: "property", label: l3("林地名", "Property", "林地名") },
    { prop: "forest_code", label: l3("林區代碼", "Forest code", "林区コード"), kind: "code" },
    { prop: "entrance_no", label: l3("入口編號", "Entrance no.", "入口番号"), kind: "code" },
    { prop: "refreshed", label: l3("來源更新", "Source refreshed", "出典の更新") },
    { prop: "web_url", label: l3("介紹頁", "Web page", "紹介ページ") },
    LA,
  ],
  legendNotes: [
    l3("Coillte（愛爾蘭國營林業公司）遊憩點 153 處、森林入口 12,888 處；拉遠時入口畫成熱區、遊憩點仍畫點",
      "Coillte (Ireland's state forestry company): 153 recreation sites and 12,888 forest entrances; zoomed out, entrances show as a heatmap while recreation sites stay as points",
      "Coillte（アイルランド国営林業会社）のレクリエーション地点153か所・森林の入口12,888か所。縮小時は入口をヒートマップ、レクリエーション地点は点で表示"),
    l3("森林入口只是林地出入口，來源沒有是否開放遊憩的欄位；停車場、登山車柱、森林公園範圍未收",
      "Forest entrances are access points to the estate; the source does not say whether they are open for recreation. Car parks, MTB poles and forest park boundaries are not included",
      "森林の入口は林地への出入口で、レクリエーション利用の可否は出典にない。駐車場・MTB ポール・森林公園の範囲は未収録"),
    LICENSE_NOTE,
  ],
  popupNotes: [],
  sourceOrg: "Coillte Teoranta — Recreation Information; Forest Entrances", sourceUrl: SOURCE_URL, license: LICENSE, fetchedAt: IE_COILLTE_FETCHED_AT,
  loading: l3("Coillte 遊憩點與森林入口載入中", "Loading Coillte recreation sites and forest entrances", "Coillte のレクリエーション地点・森林の入口を読み込み中"),
};

export const IE_COILLTE_FOREST_ROADS: IeCoillteSpec = {
  key: "ieCoillteForestRoads", geom: "line", color: "#f59e0b", count: 17_076,
  catProp: "kind", cats: IE_COILLTE_ROAD_CATS,
  rpc: "get_ie_coillte_forest_roads", sourceId: "ie-coillte-forest-roads",
  title: { props: ["name", "road_ref"], fallback: l3("Coillte 林道", "Coillte forest road", "Coillte 林道") },
  fields: [
    { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(IE_COILLTE_ROAD_CATS) },
    { prop: "trail_type", label: l3("步道類型（原文）", "Trail type", "トレイル種別（原文）") },
    { prop: "activity", label: l3("活動（原文）", "Activity", "アクティビティ（原文）") },
    { prop: "road_ref", label: l3("林道編號", "Road ref.", "林道番号"), kind: "code" },
    { prop: "length_m", label: l3("長度", "Length", "長さ"), kind: "num", unit: "m" },
    LA,
  ],
  legendNotes: [
    l3("Coillte 林道 15,877 條（約 8,900 km）、遊憩步道 1,199 條（約 6,400 km）；步道與「國家步道登錄」有部分重疊",
      "Coillte forest roads: 15,877 (about 8,900 km); recreation trails: 1,199 (about 6,400 km). Trails partly overlap the National Trails Register layer",
      "Coillte の林道15,877本（約8,900 km）・レクリエーション・トレイル1,199本（約6,400 km）。トレイルは「全国トレイル登録」と一部重なる"),
    l3("只有 Coillte 國有林地；私有林林道未涵蓋。線形約以 5 m 簡化，長度為來源值",
      "Coillte estate only; roads in private forests are not covered. Lines simplified to about 5 m; lengths are source values",
      "Coillte の国有林のみで、私有林の林道は未収録。線形は約5 m で簡略化、長さは出典の値"),
    l3("放大到 z10 才依畫面範圍載入並顯示",
      "Zoom in to z10 or closer to load and show the visible area",
      "z10 以上に拡大すると表示範囲を読み込んで表示"),
    LICENSE_NOTE,
  ],
  popupNotes: [],
  sourceOrg: "Coillte Teoranta — Forest Road Dataset; Recreation Trails", sourceUrl: SOURCE_URL, license: LICENSE, fetchedAt: IE_COILLTE_FETCHED_AT,
  loading: l3("Coillte 林道與遊憩步道載入中", "Loading Coillte forest roads and recreation trails", "Coillte の林道・トレイルを読み込み中"),
};

export const IE_COILLTE_SPEC_BY_KEY: Readonly<Record<IeCoillteKey, IeCoillteSpec>> = {
  ieCoillteRecreation: IE_COILLTE_RECREATION,
  ieCoillteForestRoads: IE_COILLTE_FOREST_ROADS,
};

export const IE_COILLTE_ATTRIBUTION = "© Coillte Teoranta（僅限私人研究，不得轉供）";

/** 類別多選（`${key}CategoryMask`，順序＝cats）→ Mapbox filter；全選＝["all"]，全不選＝擋光。 */
export function ieCoillteKindFilter(spec: IeCoillteSpec, mask: number | undefined): unknown[] {
  if (mask === undefined || !Number.isFinite(mask)) return ["all"];
  const ids = spec.cats.map((c) => c.id);
  const selected = selectedMultiSelectValues(mask, ids);
  if (selected.length === ids.length) return ["all"];
  if (selected.length === 0) return ["==", ["get", spec.catProp], "__multi_select_none__"];
  return ["in", ["coalesce", ["get", spec.catProp], ""], ["literal", selected]];
}

/** 類別色：match(kind) */
export function ieCoillteColorExpr(spec: IeCoillteSpec): unknown[] {
  const expr: unknown[] = ["match", ["coalesce", ["get", spec.catProp], ""]];
  for (const c of spec.cats) expr.push([...c.values], c.color);
  expr.push(spec.color);
  return expr;
}

/** RPC 原始回應 → 只留指定幾何型別的 features（純函式，測試用） */
export function normalizeIeCoillte(raw: unknown, geomTypes: readonly string[]): GeoJSON.FeatureCollection {
  const obj = (raw ?? {}) as { features?: unknown };
  const rawFeatures = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const features = rawFeatures
    .filter((f) => !!f?.geometry && geomTypes.includes(f.geometry.type))
    .map((f): GeoJSON.Feature => ({ type: "Feature", geometry: f.geometry, properties: { ...(f.properties ?? {}) } }));
  return { type: "FeatureCollection", features };
}
