/**
 * 愛爾蘭第 1 波規格驅動資料層（6 層）SSOT：hook paint、圖例、popup 三邊共用。
 * 畫法沿用南韓規格驅動 hook（`hooks/useKrDataLayers.ts`），規格型別同 `KrLayerSpec`，只把 key 換成 `IeDataKey`；
 * 海床地形是 raster，另在 `hooks/useIeBathymetryLayer.ts`。
 * 資料、處理與授權見 taipei-gis-analytics `docs/data-catalog/{base_map,sports,funeral,urban_open_space}/ie_*.md`
 * 與 `docs/topic-research/ireland_opendata/waves/PLAN.md` 第 1 波（2026-11-07 重開授權頁）。
 * 北愛屬英國：所有點位以第 0 波 31 個地方政府面判定，落在北愛者剔除。
 */
import type { IeDataKey } from "./ieDataKeys";
import type { KrCat, KrFieldKind, KrLayerSpec, L3 } from "./krDataLayers";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

/** popup 欄位：南韓欄位種類再加 `pct`（0–1 比例 → 百分比）。 */
export interface IeField { prop: string; label: L3; kind?: KrFieldKind | "pct"; unit?: string; digits?: number; map?: Readonly<Record<string, L3>> }
export type IeLayerSpec = Omit<KrLayerSpec, "key" | "fields"> & { key: IeDataKey; fields: readonly IeField[] };

export const IE_W1_FETCHED_AT = "2026-11-07";
const CC_BY = "CC BY 4.0";
const AGOL_TAILTE = "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services";

const LA = { prop: "la_name", label: l3("地方政府", "Local authority", "地方自治体") } as const;

const MARITIME_KIND: Record<string, L3> = {
  territorial_sea: l3("領海外界（12 浬）", "Territorial sea limit (12 nm)", "領海の外側線（12海里）"),
  contiguous_zone: l3("鄰接區外界（24 浬）", "Contiguous zone limit (24 nm)", "接続水域の外側線（24海里）"),
  eez: l3("專屬經濟區外界", "Exclusive economic zone limit", "排他的経済水域の外側線"),
};
const PLACE_KIND: Record<string, L3> = {
  centre: l3("人口中心", "Centre of population", "人口集中地"),
  townland: l3("Townland（最小地籍單位）", "Townland", "タウンランド（最小の地名単位）"),
  island: l3("島嶼", "Island", "島"),
};
const YES_NO: Record<string, L3> = { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ"), Yes: l3("是", "Yes", "はい"), No: l3("否", "No", "いいえ") };
const GRAVE_CATS: readonly KrCat[] = [
  { id: "smr_graveyard", values: ["smr_graveyard"], color: "#a78bfa", label: l3("墓地（SMR 考古登錄）", "Graveyard (SMR)", "墓地（SMR 遺跡登録）") },
  { id: "smr_burial_ground", values: ["smr_burial_ground"], color: "#f59e0b", label: l3("埋葬地（SMR 考古登錄）", "Burial ground (SMR)", "埋葬地（SMR 遺跡登録）") },
  { id: "smr_childrens_burial_ground", values: ["smr_childrens_burial_ground"], color: "#f472b6", label: l3("兒童埋葬地（SMR 考古登錄）", "Children's burial ground (SMR)", "子どもの埋葬地（SMR 遺跡登録）") },
  { id: "council_historic_graveyard", values: ["council_historic_graveyard"], color: "#4ade80", label: l3("歷史墓地（Galway、Fingal 議會名冊）", "Historic graveyard (Galway, Fingal councils)", "歴史的墓地（Galway・Fingal 議会の名簿）") },
  { id: "council_burial_ground", values: ["council_burial_ground"], color: "#38bdf8", label: l3("現行公墓（Fingal 議會）", "Burial ground in use (Fingal council)", "現行の墓地（Fingal 議会）") },
];

export const IE_DATA_SPECS: readonly IeLayerSpec[] = [
  // ───────────── 底圖：海域界線、地名 ─────────────
  {
    key: "ieMaritimeBoundaries", file: "ie_maritime_boundaries.pmtiles", sourceLayer: "ie_maritime_boundaries", geom: "line", layerId: "ie-maritime-boundaries-line",
    srcMinzoom: 0, srcMaxzoom: 10, minzoom: 0, color: "#38bdf8", count: 17,
    catProp: "kind",
    cats: [
      { id: "territorial_sea", values: ["territorial_sea"], color: "#38bdf8", label: MARITIME_KIND.territorial_sea! },
      { id: "contiguous_zone", values: ["contiguous_zone"], color: "#a78bfa", label: MARITIME_KIND.contiguous_zone! },
      { id: "eez", values: ["eez"], color: "#f59e0b", label: MARITIME_KIND.eez! },
    ],
    title: { props: [], fallback: l3("海域界線", "Maritime boundary", "海域境界") },
    fields: [{ prop: "kind", label: l3("界線", "Boundary", "境界"), map: MARITIME_KIND }, { prop: "segment", label: l3("段落（原文）", "Segment", "区間（原文）") },
             { prop: "version", label: l3("資料版本", "Version", "データ版"), kind: "year" }],
    legendNotes: [l3("領海自正常基線與直線基線起算 12 浬；專屬經濟區含 200 浬線與依 S.I. No. 86 of 2014 劃定的段落", "Territorial sea measured 12 nm from normal and straight baselines; EEZ includes the 200 nm line and the segments set by S.I. No. 86 of 2014", "領海は通常基線・直線基線から12海里。EEZは200海里線と S.I. No. 86 of 2014 で定めた区間を含む"),
                  l3("海洋研究所 2016 版資料，不可用於航海", "Marine Institute 2016 dataset; not for navigation", "Marine Institute 2016年版。航海用ではない")],
    popupNotes: [],
    sourceOrg: "Marine Institute / Department of the Environment, Climate and Communications", sourceUrl: "https://atlas.marine.ie/", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭海域界線載入中", "Loading Ireland maritime boundaries", "アイルランドの海域境界を読み込み中"),
  },
  {
    key: "iePlaceNames", file: "ie_place_names.pmtiles", sourceLayer: "ie_place_names", geom: "point", layerId: "ie-place-names-circle",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#f59e0b", tier: "S", count: 52402,
    catProp: "kind",
    cats: [
      { id: "centre", values: ["centre"], color: "#f59e0b", label: l3("人口中心（城鎮、村落）2,022", "Centres of population 2,022", "人口集中地 2,022") },
      { id: "townland", values: ["townland"], color: "#94a3b8", label: l3("Townland 50,046（z9 起）", "Townlands 50,046 (from z9)", "タウンランド 50,046（z9 から）") },
      { id: "island", values: ["island"], color: "#38bdf8", label: l3("島嶼 334（z9 起）", "Islands 334 (from z9)", "島 334（z9 から）") },
    ],
    title: { props: ["name_en", "name_ga"], fallback: l3("地名", "Place name", "地名") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: PLACE_KIND }, { prop: "name_ga", label: l3("愛爾蘭語名", "Irish name", "アイルランド語名") },
             { prop: "county", label: l3("郡", "County", "県") }, LA,
             { prop: "gaeltacht", label: l3("位於 Gaeltacht", "In the Gaeltacht", "ゲールタハト内"), map: YES_NO },
             { prop: "legislation", label: l3("愛爾蘭語名法定依據", "Irish name legislation", "アイルランド語名の法的根拠") },
             { prop: "logainm_id", label: l3("logainm.ie 編號", "logainm.ie ID", "logainm.ie ID"), kind: "code" }],
    legendNotes: [l3("拉遠只顯示人口中心；放大到 z9 才出現 townland 與島嶼", "Zoomed out only centres of population are shown; townlands and islands appear from z9", "縮小時は人口集中地のみ。タウンランドと島は z9 から表示"),
                  l3("只畫點、名稱放 popup（不畫文字標籤）；英文名由官方大寫轉為字首大寫", "Points only, names in the popup (no text labels); English names converted from upper case to title case", "点のみで名称はポップアップ（文字ラベルなし）。英語名は大文字表記を語頭大文字に変換")],
    popupNotes: [],
    sourceOrg: "Tailte Éireann, National Placenames Gazetteer", sourceUrl: `${AGOL_TAILTE}/Townlands___OSi_National_Placenames_Gazetteer/FeatureServer/0`, license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭地名載入中", "Loading Ireland place names", "アイルランドの地名を読み込み中"),
  },
  // ───────────── 原民與農村：Gaeltacht 語言規劃區 ─────────────
  {
    key: "ieGaeltacht", file: "ie_gaeltacht_lpa.pmtiles", sourceLayer: "ie_gaeltacht_lpa", geom: "polygon", layerId: "ie-gaeltacht-fill", outlineId: "ie-gaeltacht-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#fea332", count: 26,
    ramp: { prop: "daily_share", palette: "YlOrBr", breaks: [0.05, 0.15, 0.3, 0.5], labels: ["< 5%", "5–15%", "15–30%", "30–50%", "≥ 50%"],
            unit: l3("每天在教育體系外說愛爾蘭語的人口比例（3 歲以上，2022 普查）", "Share speaking Irish daily outside education (aged 3+, Census 2022)", "教育の場以外で毎日アイルランド語を話す人の割合（3歳以上、2022年国勢調査）") },
    title: { props: ["name_en", "name_ga"], fallback: l3("Gaeltacht 語言規劃區", "Gaeltacht language planning area", "ゲールタハト言語計画区域") },
    fields: [{ prop: "name_ga", label: l3("愛爾蘭語名", "Irish name", "アイルランド語名") }, { prop: "county", label: l3("郡", "County", "県") },
             { prop: "daily_share", label: l3("每天在教育體系外說愛爾蘭語", "Speak Irish daily outside education", "教育の場以外で毎日話す"), kind: "pct" },
             { prop: "speaker_share", label: l3("會說愛爾蘭語", "Can speak Irish", "アイルランド語を話せる"), kind: "pct" },
             { prop: "pop_3plus", label: l3("3 歲以上人口", "Population aged 3+", "3歳以上人口"), kind: "num" },
             { prop: "irish_speakers", label: l3("會說愛爾蘭語人數", "Irish speakers", "アイルランド語話者数"), kind: "num" },
             { prop: "daily_outside_edu", label: l3("每天在教育體系外說的人數", "Daily speakers outside education", "教育の場以外で毎日話す人数"), kind: "num" },
             { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 }],
    legendNotes: [l3("26 個 Gaeltacht 語言規劃區（法定 Gaeltacht 範圍與其聯集只差約 3.7 km²，不另畫）", "26 Gaeltacht language planning areas (their union differs from the statutory Gaeltacht by only about 3.7 km², so that layer is not drawn separately)", "ゲールタハト言語計画区域26区（法定ゲールタハト範囲との差は約3.7km²のため別表示しない）"),
                  l3("語言統計為 CSO 2022 普查，26 區合計 3 歲以上 102,973 人、會說 65,156 人、每天在教育體系外說 20,261 人", "Language figures from CSO Census 2022: 102,973 aged 3+, 65,156 Irish speakers and 20,261 daily speakers outside education across the 26 areas", "言語統計は CSO 2022年国勢調査。26区合計で3歳以上102,973人、話者65,156人、教育の場以外で毎日話す人20,261人")],
    popupNotes: [l3("語言統計為 2022 年普查（3 歲以上）", "Language statistics: Census 2022 (aged 3+)", "言語統計は2022年国勢調査（3歳以上）")],
    sourceOrg: "Tailte Éireann (Gaeltacht language planning areas 2026); Central Statistics Office (Census 2022 SAP2022T3T1LPT／T3T2LPT)", sourceUrl: "https://data.cso.ie/table/SAP2022T3T2LPT", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭 Gaeltacht 載入中", "Loading Ireland Gaeltacht areas", "アイルランドのゲールタハトを読み込み中"),
  },
  // ───────────── 運動休閒：活動地點、公園 ─────────────
  {
    key: "ieActivityLocations", file: "ie_activity_locations.pmtiles", sourceLayer: "ie_activity_locations", geom: "point", layerId: "ie-activity-locations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#ef6c00", tier: "M", count: 5318,
    catProp: "location_type",
    cats: [
      { id: "outdoor", values: ["Outdoor Facility"], color: "#ef6c00", label: l3("戶外場地", "Outdoor facility", "屋外施設") },
      { id: "indoor", values: ["Indoor Facility"], color: "#a78bfa", label: l3("室內場館", "Indoor facility", "屋内施設") },
      { id: "both", values: ["Indoor & Outdoor Facility"], color: "#f472b6", label: l3("室內外兼具", "Indoor & outdoor facility", "屋内外施設") },
      { id: "beach", values: ["Beach/Seashore"], color: "#facc15", label: l3("海灘、海岸", "Beach / seashore", "海浜・海岸") },
      { id: "inland_water", values: ["Inland Water"], color: "#38bdf8", label: l3("內陸水域", "Inland water", "内水面") },
      { id: "park", values: ["Park/Garden", "Green/Open Space"], color: "#7cb342", label: l3("公園、綠地", "Park, garden, green space", "公園・緑地") },
      { id: "nature", values: ["Forest/Woodland", "National Park/Nature Reserve"], color: "#2dd4bf", label: l3("森林、國家公園與自然保留區", "Forest, national park, nature reserve", "森林・国立公園・自然保護区") },
    ],
    title: { props: ["name"], fallback: l3("運動活動地點", "Activity location", "スポーツ活動地点") },
    fields: [{ prop: "location_type", label: l3("地點類型", "Location type", "地点種別") }, { prop: "activity", label: l3("活動項目", "Activities", "活動") },
             { prop: "owned_by_type", label: l3("所有者類型", "Owner type", "所有者種別") }, { prop: "managed_by_type", label: l3("管理者類型", "Manager type", "管理者種別") },
             { prop: "open_to_public", label: l3("開放大眾", "Open to the public", "一般開放"), map: YES_NO }, { prop: "amenities", label: l3("設施", "Amenities", "設備") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "eircode", label: l3("Eircode", "Eircode", "Eircode"), kind: "code" }, LA,
             { prop: "data_owner", label: l3("資料提供單位", "Data owner", "データ提供者") }],
    legendNotes: [l3("Sport Ireland「Get Ireland Active」名冊：各運動總會與地方政府登錄的活動地點，非完整場館普查", "Sport Ireland 'Get Ireland Active' roster of activity locations submitted by sports bodies and councils; not a complete facility census", "Sport Ireland「Get Ireland Active」の名簿（競技団体と自治体が登録した活動地点）。施設の全数調査ではない"),
                  l3("原資料含北愛 186 筆，已剔除；所有者空白歸「Unspecified」", "186 Northern Ireland records in the source were removed; blank owner type shown as 'Unspecified'", "原資料の北アイルランド186件は除外。所有者が空欄のものは「Unspecified」")],
    popupNotes: [],
    sourceOrg: "Sport Ireland, Get Ireland Active", sourceUrl: "https://data.gov.ie/dataset/getirelandactive_activitylocations", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭運動活動地點載入中", "Loading Ireland activity locations", "アイルランドのスポーツ活動地点を読み込み中"),
  },
  {
    // V-5：面＋代表點（`ie_parks_points.pmtiles`，登記在 repPointLayers，預設點）
    key: "ieParks", file: "ie_parks.pmtiles", sourceLayer: "ie_parks", geom: "polygon", layerId: "ie-parks-fill", outlineId: "ie-parks-line",
    srcMinzoom: 6, srcMaxzoom: 13, minzoom: 6, color: "#7cb342", count: 3221,
    catProp: "category",
    cats: [
      { id: "council_park", values: ["council_park"], color: "#7cb342", label: l3("議會公園（Dublin City、South Dublin 官方）", "Council parks (Dublin City, South Dublin official)", "議会の公園（Dublin City・South Dublin 公式）") },
      { id: "osm_park", values: ["osm_park"], color: "#a3e635", label: l3("公園（OSM leisure=park）", "Park (OSM leisure=park)", "公園（OSM leisure=park）") },
      { id: "osm_garden", values: ["osm_garden"], color: "#f472b6", label: l3("公共花園（OSM leisure=garden）", "Public garden (OSM leisure=garden)", "公共庭園（OSM leisure=garden）") },
    ],
    title: { props: ["name", "name_ga"], fallback: l3("公園", "Park", "公園") },
    fields: [{ prop: "category", label: l3("來源類別", "Source category", "出典区分"), map: {
                council_park: l3("議會官方公園", "Council park (official)", "議会の公園（公式）"), osm_park: l3("OSM 公園", "OSM park", "OSM 公園"), osm_garden: l3("OSM 公共花園", "OSM public garden", "OSM 公共庭園") } },
             { prop: "kind", label: l3("議會分類", "Council classification", "議会の分類") }, { prop: "name_ga", label: l3("愛爾蘭語名", "Irish name", "アイルランド語名") },
             { prop: "operator", label: l3("經營者", "Operator", "運営者") }, { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²" }, LA,
             { prop: "osm_id", label: l3("OSM 編號", "OSM ID", "OSM ID"), kind: "code" }],
    legendNotes: [l3("官方公園面只有 Dublin City、South Dublin 兩個地方政府；其餘 29 個用 OpenStreetMap，完整度未驗", "Official park polygons exist only for Dublin City and South Dublin; the other 29 local authorities use OpenStreetMap (completeness unverified)", "公式の公園ポリゴンは Dublin City と South Dublin のみ。他の29自治体は OpenStreetMap（網羅性は未検証）"),
                  l3("私人花園已排除；無名花園只留標示開放者", "Private gardens excluded; unnamed gardens kept only when tagged as open to the public", "私有庭園は除外。名称のない庭園は一般開放のタグがあるもののみ")],
    popupNotes: [],
    sourceOrg: "Dublin City Council, South Dublin County Council (CC BY 4.0); © OpenStreetMap contributors (ODbL 1.0)", sourceUrl: "https://data.gov.ie/dataset/parks-and-open-spaces-dcc", license: "CC BY 4.0＋ODbL 1.0", fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭公園載入中", "Loading Ireland parks", "アイルランドの公園を読み込み中"),
  },
  // ───────────── 殯葬：墓地 ─────────────
  {
    key: "ieGraveyards", file: "ie_graveyards.pmtiles", sourceLayer: "ie_graveyards", geom: "point", layerId: "ie-graveyards-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#a78bfa", tier: "S", count: 6449,
    catProp: "category", cats: GRAVE_CATS,
    title: { props: ["name", "townland"], fallback: l3("墓地", "Graveyard", "墓地") },
    fields: [{ prop: "monument_class", label: l3("SMR 類別", "SMR class", "SMR 区分") }, { prop: "townland", label: l3("Townland", "Townland", "タウンランド") },
             { prop: "county", label: l3("郡", "County", "県") }, LA, { prop: "smr_no", label: l3("SMR 編號", "SMR no.", "SMR 番号"), kind: "code" }],
    legendNotes: [l3("SMR 是國家考古登錄（Sites and Monuments Record），收的是有考古或歷史價值的墓地，不是現行公墓名冊", "SMR is the national archaeological Sites and Monuments Record: graveyards of archaeological or historic interest, not a register of cemeteries in use", "SMR は国の遺跡登録（Sites and Monuments Record）。考古・歴史的価値のある墓地で、現行墓地の名簿ではない"),
                  l3("現行公墓只有 Fingal 議會名冊；其他地方政府的現行公墓未涵蓋", "Cemeteries in use come only from Fingal County Council; other local authorities' current cemeteries are not covered", "現行墓地は Fingal 議会の名簿のみ。他の自治体の現行墓地は未収録")],
    popupNotes: [],
    sourceOrg: "National Monuments Service (DHLGH) Sites and Monuments Record; Galway County Council; Fingal County Council", sourceUrl: "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services/SMROpenData/FeatureServer/0", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭墓地載入中", "Loading Ireland graveyards", "アイルランドの墓地を読み込み中"),
  },
];

export const IE_SPEC_BY_KEY: Readonly<Record<IeDataKey, IeLayerSpec>> = Object.fromEntries(IE_DATA_SPECS.map((s) => [s.key, s])) as Record<IeDataKey, IeLayerSpec>;

/** 南韓規格驅動 hook／篩選共用同一套畫法：IE 規格只差 key 型別與 popup 欄位種類（hook 不讀 fields）。 */
export const asKrSpec = (spec: IeLayerSpec): KrLayerSpec => spec as unknown as KrLayerSpec;

export const IE_BATHY_STOPS: readonly { depth: number; color: string }[] = [
  { depth: 0, color: "#cdeef8" }, { depth: -20, color: "#97d7ef" }, { depth: -50, color: "#63bde3" }, { depth: -100, color: "#3d9bd0" }, { depth: -200, color: "#2c7ab8" },
  { depth: -500, color: "#215f9f" }, { depth: -1000, color: "#1a4b86" }, { depth: -2000, color: "#143a6c" }, { depth: -3000, color: "#102e57" }, { depth: -5000, color: "#0a2040" },
];

/** 海床地形（raster；hook 在 useIeBathymetryLayer）的署名與色階說明，圖例共用。 */
export const IE_BATHYMETRY = {
  file: "ie_bathymetry.pmtiles",
  sourceOrg: "Geological Survey Ireland & Marine Institute, INFOMAR",
  sourceUrl: "https://gsi.geodata.gov.ie/imagehost/rest/services/Marine/IE_GSI_MI_Bathymetry_25m_IE_Waters_WGS84_LAT_GRID/ImageServer",
  license: CC_BY,
  /** 色階斷點：與 analytics `pipelines/base_map/ie/bathymetry/07_export.py` STOPS 一致（改那邊要同步），圖例逐格列出 */
  stops: IE_BATHY_STOPS,
  notes: [
    l3("INFOMAR 測深網格重新取樣到約 300 m（0.003°）著色，疊山體陰影；z4–10", "INFOMAR bathymetry resampled to about 300 m (0.003°), colour ramp with hillshade; z4–10", "INFOMAR 測深グリッドを約300m（0.003°）に再サンプリングし段彩＋陰影；z4–10"),
    l3("只涵蓋愛爾蘭指定水域；陸地與英國水域為空白（未涵蓋）", "Irish designated waters only; land and UK waters are blank (not covered)", "アイルランド指定水域のみ。陸地と英国水域は空白（未収録）"),
  ] as readonly L3[],
};
