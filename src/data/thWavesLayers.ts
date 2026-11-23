/**
 * 泰國第 2–4 波（2026-11-22）圖層規格：12 個向量層（規格驅動，重用菲律賓引擎 `usePhDataLayer`）＋ 2 個地形 raster。
 * 資料、授權原句見 taipei-gis-analytics `docs/topic-research/thailand_opendata/waves/w02/FRONTEND_SPEC.md` 與各 `_manifest.json`。
 * 授權空白的來源（NGIS、GISTDA Hosted、DOH drive、HRDI）照常上線（使用者 2026-11-21），圖例與署名寫「授權未明示」＋機關名。
 * 本檔不 import thDataLayers 的值（thDataLayers 會 spread 本檔）；只 import 型別。
 */
import type { ThRasterKey } from "./thDataKeys";
import type { ThLayerSpec } from "./thDataLayers";
import type { L3, PhCat, PhCatGetter, PhField, PhNote, PhPart } from "./phDataLayers";
import { TH_SOIL_RASTER_SPECS } from "./thWaves8Layers";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const constGetter = (v: string): PhCatGetter => ({ expr: ["literal", v], js: () => v });
const FETCHED = "2026-11-22";
const UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
const ODBL = "ODbL 1.0";
const PROVINCE_FIELDS: readonly PhField[] = [
  { prop: "province_th", label: l3("府（泰文）", "Province (Thai)", "県（タイ語）") },
  { prop: "province_en", label: l3("府（英文）", "Province (English)", "県（英語）") },
];
const point = (id: string, sourceLayer: string, minzoom: number, cat: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat, ...extra });

// ═════════════════════════ 地形 raster（C003，Copernicus DEM GLO-90） ═════════════════════════

export interface ThRasterSpec {
  key: ThRasterKey;
  file: string;
  sourceId: string;
  layerId: string;
  minzoom: number;
  maxzoom: number;
  opacity: number;
  steps?: readonly { color: string; label: string }[];
  notes: readonly L3[];
  sourceShort: string | L3;
  loading: string;
}
const TERRAIN_SOURCE = "© DLR／Airbus，Copernicus DEM GLO-90（ESA／EU，AWS Open Data）";
export const TH_RASTER_SPECS: readonly ThRasterSpec[] = [
  ...TH_SOIL_RASTER_SPECS,
  {
    key: "thTerrainHillshade", file: "th_terrain_hillshade.pmtiles", sourceId: "th-terrain-hillshade", layerId: "th-terrain-hillshade-raster", minzoom: 5, maxzoom: 10, opacity: 0.5,
    notes: [
      l3("Copernicus DEM GLO-90（約 90 m）山體陰影；只保留泰國陸域（海面與鄰國透明），z10 以上放大沿用", "Copernicus DEM GLO-90 (about 90 m) hillshade; Thai land only (sea and neighbours transparent); overzoomed above z10", "Copernicus DEM GLO-90（約 90 m）陰影起伏。タイ陸域のみ（海面・隣国は透明）、z10 以上は拡大表示"),
      l3("DSM（含樹冠與建物）；GLO-30 待主機搬遷後再換", "DSM (includes canopy and buildings); GLO-30 to follow after the host move", "DSM（樹冠・建物を含む）。GLO-30 はホスト移転後に差し替え予定"),
    ],
    sourceShort: TERRAIN_SOURCE, loading: "泰國山體陰影載入中",
  },
  {
    key: "thTerrainRelief", file: "th_terrain_relief.pmtiles", sourceId: "th-terrain-relief", layerId: "th-terrain-relief-raster", minzoom: 5, maxzoom: 10, opacity: 0.6,
    steps: [
      { color: "#4c8c54", label: "0" }, { color: "#78aa60", label: "100" }, { color: "#b0c470", label: "300" }, { color: "#dece84", label: "600" },
      { color: "#caa062", label: "1,000" }, { color: "#a4764a", label: "1,500" }, { color: "#88685c", label: "2,000" }, { color: "#f5f5f5", label: "2,565 m" },
    ],
    notes: [
      l3("色別標高（m，0–2,565）；≤0 m 與海面、鄰國透明（平地不遮底圖）", "Elevation tint (m, 0–2,565); ≤0 m, sea and neighbouring countries transparent (flat land does not hide the basemap)", "段彩標高（m、0–2,565）。0 m 以下・海面・隣国は透明（平地は底図を隠さない）"),
      l3("DSM（含樹冠與建物），GLO-90 最大 z10", "DSM (includes canopy and buildings); GLO-90, max z10", "DSM（樹冠・建物を含む）。GLO-90、最大 z10"),
    ],
    sourceShort: TERRAIN_SOURCE, loading: "泰國色別標高載入中",
  },
];
export const TH_RASTER_BY_KEY = Object.fromEntries(TH_RASTER_SPECS.map((s) => [s.key, s])) as Record<ThRasterKey, ThRasterSpec>;

// ═════════════════════════ 分類 ═════════════════════════

// 地名（C007）：place 分級，低縮放刻意只有城市（per-feature minzoom：city z4、town z6、village z8、hamlet z10）
const PLACE_CATS: readonly PhCat[] = [
  { id: "city", values: ["city"], color: "#f472b6", radius: 5.5, label: l3("城市（city）", "City", "市（city）") },
  { id: "town", values: ["town"], color: "#fbbf24", radius: 4, label: l3("鎮（town）", "Town", "町（town）") },
  { id: "village", values: ["village"], color: "#e5e7eb", radius: 2.3, label: l3("村（village）", "Village", "村（village）") },
  { id: "hamlet", values: ["hamlet"], color: "#94a3b8", radius: 1.8, label: l3("小聚落（hamlet）", "Hamlet", "集落（hamlet）") },
];
// 高地村（C020）：族群前 7 名各色，其餘併「其他」
const ETHNIC_CATS: readonly PhCat[] = [
  { id: "karen", values: ["กะเหรี่ยง"], color: "#22c55e", label: l3("กะเหรี่ยง（Karen）", "Karen", "カレン（Karen）") },
  { id: "plains", values: ["ไทยพื้นราบ"], color: "#facc15", label: l3("ไทยพื้นราบ（平地泰人）", "Lowland Thai", "平地タイ人（ไทยพื้นราบ）") },
  { id: "lahu", values: ["ลาหู่"], color: "#f97316", label: l3("ลาหู่（Lahu）", "Lahu", "ラフ（Lahu）") },
  { id: "hmong", values: ["ม้ง"], color: "#ef4444", label: l3("ม้ง（Hmong）", "Hmong", "モン（Hmong）") },
  { id: "akha", values: ["อาข่า"], color: "#a78bfa", label: l3("อาข่า（Akha）", "Akha", "アカ（Akha）") },
  { id: "lua", values: ["ลั้วะ"], color: "#38bdf8", label: l3("ลั้วะ（Lua）", "Lua", "ルア（Lua）") },
  { id: "mien", values: ["เมี่ยน"], color: "#2dd4bf", label: l3("เมี่ยน（Mien）", "Mien (Yao)", "ミエン（Mien）") },
];
// 府級社經（C024）：Gini（2023）與收入變動（2025）兩指標，各 6 級＋缺值灰；預設只顯示 Gini
const GINI_BREAKS = [0.3, 0.34, 0.37, 0.39, 0.42] as const;
const GINI_COLORS = ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#b45309", "#78350f"] as const;
const GINI_LABELS = ["<0.30", "0.30–0.34", "0.34–0.37", "0.37–0.39", "0.39–0.42", "≥0.42"] as const;
const CHANGE_BREAKS = [-10, -5, 0, 5, 10] as const;
const CHANGE_COLORS = ["#b2182b", "#ef8a62", "#fddbc7", "#d1e5f0", "#67a9cf", "#2166ac"] as const;
const CHANGE_LABELS = ["<−10%", "−10～−5%", "−5～0%", "0～5%", "5～10%", "≥10%"] as const;
const stepGetter = (prop: string, ncId: string, ids: readonly string[], breaks: readonly number[]): PhCatGetter => ({
  expr: ["case", ["!", ["has", prop]], ncId, ["step", ["to-number", ["get", prop], 0], ids[0], ...breaks.flatMap((b, i) => [b, ids[i + 1]])]],
  js: (p) => {
    if (p[prop] == null || p[prop] === "") return ncId;
    const n = Number(p[prop]);
    let k = 0;
    breaks.forEach((b, i) => { if (n >= b) k = i + 1; });
    return ids[k]!;
  },
});
const GINI_IDS = ["g0", "g1", "g2", "g3", "g4", "g5"] as const;
const CHANGE_IDS = ["c0", "c1", "c2", "c3", "c4", "c5"] as const;
const SOCIO_CATS: readonly PhCat[] = [
  ...GINI_IDS.map((id, i) => ({ id, values: [id], color: GINI_COLORS[i]!, parts: ["th-socio-gini-fill"], label: l3(`Gini（2023）${GINI_LABELS[i]}`, `Gini (2023) ${GINI_LABELS[i]}`, `ジニ係数（2023）${GINI_LABELS[i]}`) })),
  { id: "gnc", values: ["gnc"], color: "#6b7280", parts: ["th-socio-gini-fill"], label: l3("Gini 未涵蓋（不是 0）", "Gini not covered (not zero)", "ジニ係数 未収録（0 ではない）") },
  ...CHANGE_IDS.map((id, i) => ({ id, values: [id], color: CHANGE_COLORS[i]!, parts: ["th-socio-change-fill"], label: l3(`收入變動（2025）${CHANGE_LABELS[i]}`, `Income change (2025) ${CHANGE_LABELS[i]}`, `所得変動（2025）${CHANGE_LABELS[i]}`) })),
  { id: "cnc", values: ["cnc"], color: "#6b7280", parts: ["th-socio-change-fill"], label: l3("收入變動 未涵蓋（不是 0）", "Income change not covered (not zero)", "所得変動 未収録（0 ではない）") },
];
// 流域（C110）：25 主流域各色（黃金角色相，避免相鄰同色）
const BASINS: readonly (readonly [string, string, string])[] = [
  ["01", "ลุ่มน้ำสาละวิน", "MAE NAM SALAWIN"], ["02", "ลุ่มน้ำโขง", "MAE NAM KHONG"], ["03", "ลุ่มน้ำกก", "MAE NAM KOK"], ["04", "ลุ่มน้ำชี", "MAE NAM CHI"],
  ["05", "ลุ่มน้ำมูล", "MAE NAM MUN"], ["06", "ลุ่มน้ำปิง", "MAE NAM PING"], ["07", "ลุ่มน้ำวัง", "MAE NAM WANG"], ["08", "ลุ่มน้ำยม", "MAE NAM YOM"],
  ["09", "ลุ่มน้ำน่าน", "MAE NAM NAN"], ["10", "ลุ่มน้ำเจ้าพระยา", "MAE NAM CHAO PHRAYA"], ["11", "ลุ่มน้ำสะแกกรัง", "MAE NAM SAKAE KRANG"], ["12", "ลุ่มน้ำป่าสัก", "MAE NAM PASAK"],
  ["13", "ลุ่มน้ำท่าจีน", "MAE NAM THA CHIN"], ["14", "ลุ่มน้ำแม่กลอง", "MAE NAM MAE KLONG"], ["15", "ลุ่มน้ำปราจีนบุรี", "MAE NAM PRACHINBURI"], ["16", "ลุ่มน้ำบางปะกง", "MAE NAM BANG PAKONG"],
  ["17", "ลุ่มน้ำโตนเลสาป", "TONLE SAP"], ["18", "ลุ่มน้ำชายฝั่งทะเลตะวันออก", "EAST COAST GULF"], ["19", "ลุ่มน้ำเพชรบุรี", "MAE NAM PHETCHABURI"], ["20", "ลุ่มน้ำชายฝั่งทะเลประจวบคีรีขันธ์", "PRACHUAPKHIRI - KHAN COAST"],
  ["21", "ลุ่มน้ำภาคใต้ฝั่งตะวันออก", "PENINSULA - EAST COAST"], ["22", "ลุ่มน้ำตาปี", "MAE NAM TAPI"], ["23", "ลุ่มน้ำทะเลสาบสงขลา", "THALE SAP SONGKHLA"], ["24", "ลุ่มน้ำปัตตานี", "MAE NAM PATTANI"],
  ["25", "ลุ่มน้ำภาคใต้ฝั่งตะวันตก", "PENINSULA - WEST COAST"],
];
const hslHex = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const BASIN_CATS: readonly PhCat[] = [
  ...BASINS.map(([code, th, en], i) => ({ id: `b${code}`, values: [code], color: hslHex((i * 137.508) % 360, 0.6, 0.58), parts: ["th-basin-main-fill"], label: l3(`${th}（${en}）`, `${en}`, `${th}（${en}）`) })),
  { id: "sub", values: ["sub"], color: "#e5e7eb", parts: ["th-basin-sub-line", "th-basin-sub-fill"], label: l3("子流域邊界（254）", "Sub-basin boundary (254)", "支流域境界（254）") },
];
// 歷史淹水（C076）：淹水頻率 1–7 年（淺→深）
const FLOOD_COLORS = ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8", "#1e3a8a"] as const;
const FLOOD_CATS: readonly PhCat[] = FLOOD_COLORS.map((color, i) => ({
  id: `f${i + 1}`, values: [String(i + 1)], color, label: l3(`頻率 ${i + 1} 年`, `Frequency ${i + 1} yr`, `頻度 ${i + 1} 年`),
}));
// 灌溉專案（C112）：facility_type 由名稱推導
const IRRIGATION_CATS: readonly PhCat[] = [
  { id: "reservoir", values: ["reservoir"], color: "#38bdf8", radius: 3.5, label: l3("水庫、蓄水池（409）", "Reservoir (409)", "貯水池（409）") },
  { id: "weir", values: ["weir"], color: "#2dd4bf", radius: 3.5, label: l3("堰（143）", "Weir (143)", "堰（143）") },
  { id: "sluice_gate", values: ["sluice_gate"], color: "#a78bfa", radius: 3.5, label: l3("水門（88）", "Sluice gate (88)", "水門（88）") },
  { id: "pump_station", values: ["pump_station"], color: "#f59e0b", radius: 3.5, label: l3("抽水站（33）", "Pumping station (33)", "揚水場（33）") },
  { id: "flood_retention", values: ["flood_retention"], color: "#60a5fa", radius: 3.5, label: l3("滯洪設施（17）", "Flood retention (17)", "遊水地（17）") },
  { id: "embankment", values: ["embankment"], color: "#a16207", radius: 3.5, label: l3("堤防（7）", "Embankment (7)", "堤防（7）") },
  { id: "dam", values: ["dam"], color: "#ef4444", radius: 5.5, label: l3("壩（4）", "Dam (4)", "ダム（4）") },
  { id: "other", values: ["other"], color: "#94a3b8", radius: 3, label: l3("其他（95，無法由名稱判定）", "Other (95, not inferable from name)", "その他（95、名称から判定不能）") },
];
// 垃圾場址（C097）：兩份調查分開不相加；site_type 正規化
const siteType: PhCatGetter = {
  expr: ["match", ["to-string", ["coalesce", ["get", "site_type"], ""]], "Open dump", "open_dump", "Control dump", "control_dump",
    ["Sanitary landfill", "Engineering landfill"], "landfill", ["เตาเผา", "Incinerater", "Incinerator"], "incinerator", "other_site"],
  js: (p) => {
    const v = str(p.site_type);
    return v === "Open dump" ? "open_dump" : v === "Control dump" ? "control_dump" : v === "Sanitary landfill" || v === "Engineering landfill" ? "landfill"
      : v === "เตาเผา" || v === "Incinerater" || v === "Incinerator" ? "incinerator" : "other_site";
  },
};
const LANDFILL_CATS: readonly PhCat[] = [
  { id: "open_dump", values: ["open_dump"], color: "#ef4444", radius: 3, parts: ["th-landfill-survey-circle"], label: l3("開放傾倒場（Open dump，2,893）", "Open dump (2,893)", "オープンダンプ（2,893）") },
  { id: "control_dump", values: ["control_dump"], color: "#f59e0b", radius: 3.5, parts: ["th-landfill-survey-circle"], label: l3("控制傾倒場（Control dump，65）", "Controlled dump (65)", "管理型ダンプ（65）") },
  { id: "landfill", values: ["landfill"], color: "#22c55e", radius: 4, parts: ["th-landfill-survey-circle"], label: l3("衛生／工程掩埋場（71）", "Sanitary / engineered landfill (71)", "衛生・エンジニアード埋立地（71）") },
  { id: "incinerator", values: ["incinerator"], color: "#a78bfa", radius: 4, parts: ["th-landfill-survey-circle"], label: l3("焚化爐（90）", "Incinerator (90)", "焼却炉（90）") },
  { id: "other_site", values: ["other_site"], color: "#94a3b8", radius: 3, parts: ["th-landfill-survey-circle"], label: l3("其他、未標示類型", "Other / type not stated", "その他・種別不明") },
  { id: "pcd", values: ["pcd"], color: "#38bdf8", radius: 3, parts: ["th-landfill-pcd-circle"], label: l3("PCD 設施（空心，2,609；與上列調查不可相加）", "PCD facility (hollow, 2,609; do not add to the survey above)", "PCD 施設（中抜き、2,609。上記調査と合算しない）") },
];
// 事故（C085）：severity 四級
const ACCIDENT_CATS: readonly PhCat[] = [
  { id: "fatal", values: ["fatal"], color: "#ef4444", radius: 4.5, label: l3("死亡（2,382）", "Fatal (2,382)", "死亡（2,382）") },
  { id: "serious", values: ["serious"], color: "#f97316", radius: 3.5, label: l3("重傷（1,624）", "Serious injury (1,624)", "重傷（1,624）") },
  { id: "minor", values: ["minor"], color: "#facc15", radius: 3, label: l3("輕傷（8,865）", "Minor injury (8,865)", "軽傷（8,865）") },
  { id: "damage_only", values: ["damage_only"], color: "#94a3b8", radius: 2.5, label: l3("僅財損（10,672）", "Damage only (10,672)", "物損のみ（10,672）") },
];

const NEAREST_NOTE: PhNote = { text: l3("點落在府界外（岸邊、河道），府取最近者", "Point lies outside province polygons (shore, river); nearest province used", "点が県境の外（海岸・河道）にあり、最寄りの県を採用"), when: (p) => str(p.province_method) === "nearest" };
const GISTDA_ORG = l3("GISTDA Hosted（來源機關 DOH／DRR／高速公路局；授權未明示，存取 2026-11-22）", "GISTDA Hosted (source agencies DOH / DRR / Expressway Authority; license not stated, accessed 2026-11-22)", "GISTDA Hosted（出典機関 DOH／DRR／高速道路公社、ライセンス未明示、2026-11-22 取得）");

export const TH_WAVE_SPECS: readonly ThLayerSpec[] = [
  {
    key: "thPlaceNames", file: "th_place_names.pmtiles", sourceId: "th-place-names", srcMinzoom: 4, srcMaxzoom: 14, color: "#e5e7eb", count: 32_514,
    parts: [point("th-place-names-circle", "places", 4, propGetter("place"))],
    cats: PLACE_CATS, otherColor: "#64748b", otherLabel: l3("其他（未分類、街區、島等）", "Other (unclassified, neighbourhood, island…)", "その他（未分類・街区・島など）"),
    title: { props: ["name_th", "name", "name_en"], fallback: l3("地名", "Place name", "地名"), fallbackBy: { prop: "name_redacted", map: { true: l3("（個人名義，已遮蔽）", "(personal name, redacted)", "（個人名義、秘匿）") } } },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "name_latin", label: l3("拉丁字母拼寫", "Latin name", "ラテン文字表記") },
      { prop: "place", label: l3("聚落等級（OSM place）", "Place class (OSM place)", "集落区分（OSM place）"), kind: "code" },
      { prop: "population", label: l3("人口（OSM 標註，僅 209 筆）", "Population (OSM tag, only 209 records)", "人口（OSM タグ、209 件のみ）"), kind: "num" },
      { prop: "is_in", label: l3("所屬（OSM is_in）", "Located in (OSM is_in)", "所属（OSM is_in）") },
      { prop: "osm_id", label: l3("OSM id", "OSM id", "OSM id"), kind: "code" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("OSM 聚落名稱 32,514 筆，非官方村里名冊；依等級逐級出現：城市 z4、鎮 z6、村 z8、小聚落 z10（低縮放刻意只有城市）", "32,514 OSM place names, not an official village register; shown by class: city z4, town z6, village z8, hamlet z10 (low zooms deliberately show cities only)", "OSM 集落名 32,514 件、公式の村名簿ではない。区分ごとに表示：city z4・town z6・village z8・hamlet z10（低ズームは意図的に都市のみ）"),
      l3("只畫點，名稱在彈窗；三角點未涵蓋；77/77 府", "Points only, names in the popup; trig points not covered; 77/77 provinces", "点のみで名称はポップアップ。三角点は未収録。77/77 県"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: "© OpenStreetMap contributors（ODbL），via HOT／HDX", sourceUrl: "https://www.openstreetmap.org/copyright", license: ODBL, fetchedAt: FETCHED,
    loading: l3("泰國地名載入中", "Loading Thailand place names", "タイの地名を読み込み中"),
  },
  {
    key: "thElectionConstituencies", file: "th_election_constituencies.pmtiles", sourceId: "th-election-constituencies", srcMinzoom: 4, srcMaxzoom: 12, color: "#a78bfa", count: 800, opacity: 0.6,
    parts: [
      { id: "th-election-2569-fill", sourceLayer: "constituency_2569", geom: "fill", minzoom: 4, cat: constGetter("v2569"), fillOpacity: 0.18 },
      { id: "th-election-2569-line", sourceLayer: "constituency_2569", geom: "line", minzoom: 4, cat: constGetter("v2569"), lineWidth: { v2569: [1, 2] } },
      { id: "th-election-2566-fill", sourceLayer: "constituency_2566", geom: "fill", minzoom: 4, cat: constGetter("v2566"), fillOpacity: 0.18 },
      { id: "th-election-2566-line", sourceLayer: "constituency_2566", geom: "line", minzoom: 4, cat: constGetter("v2566"), lineWidth: { v2566: [1, 2] } },
    ],
    cats: [
      { id: "v2569", values: ["v2569"], color: "#a78bfa", parts: ["th-election-2569-fill", "th-election-2569-line"], label: l3("2569 佛曆（2026）選區 400", "BE 2569 (2026) constituencies (400)", "仏暦 2569（2026）選挙区（400）") },
      { id: "v2566", values: ["v2566"], color: "#38bdf8", parts: ["th-election-2566-fill", "th-election-2566-line"], label: l3("2566 佛曆（2023）選區 400", "BE 2566 (2023) constituencies (400)", "仏暦 2566（2023）選挙区（400）") },
    ],
    defaultCats: ["v2569"],
    title: { props: ["province_th"], fallback: l3("選區", "Constituency", "選挙区") },
    fields: [
      { prop: "cons_id", label: l3("選區代碼（府碼-序號）", "Constituency id (province-no.)", "選挙区コード（県コード-番号）"), kind: "code" },
      { prop: "cons_no", label: l3("選區序號", "Constituency no.", "選挙区番号"), kind: "num" },
      { prop: "election_ce", label: l3("選舉年（西元）", "Election year (CE)", "選挙年（西暦）"), kind: "year" },
      { prop: "election_be", label: l3("選舉年（佛曆）", "Election year (BE)", "選挙年（仏暦）"), kind: "year" },
      { prop: "amphoe_names_in_table", label: l3("所含 amphoe 名（來源表原文）", "Amphoe names (source table)", "含まれる amphoe 名（出典表の原文）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("兩版選區（2023、2026）可在類別篩選切換，預設只顯示 2026；只有邊界，得票、投票所未涵蓋", "Two editions (2023, 2026) switchable in the category filter, 2026 only by default; boundaries only — votes and polling stations not covered", "2 版（2023・2026）をカテゴリ絞り込みで切替（既定は 2026 のみ）。境界のみで、得票・投票所は未収録"),
      l3("第三方彙整（Thai-ECT-election-map，MIT 授權；底層 กกต. 選區公告，上游條款未明示）", "Third-party compilation (Thai-ECT-election-map, MIT; underlying ECT announcements, upstream terms not stated)", "第三者による集成（Thai-ECT-election-map、MIT。基の กกต. 公示は上流条件が未明示）"),
    ],
    popupNotes: [],
    sourceOrg: l3("Thai-ECT-election-map by Kittapat Ratanaphupha（MIT，第三方彙整）；底層 กกต. 選區公告（上游條款未明示）", "Thai-ECT-election-map by Kittapat Ratanaphupha (MIT, third-party compilation); underlying ECT constituency announcements (upstream terms not stated)", "Thai-ECT-election-map by Kittapat Ratanaphupha（MIT、第三者集成）。基の กกต. 選挙区公示（上流条件は未明示）"),
    sourceUrl: "https://github.com/kittapat1920/Thai-ECT-election-map", license: l3("MIT（第三方鏡像）；上游 ECT 條款未明示", "MIT (third-party mirror); upstream ECT terms not stated", "MIT（第三者ミラー）。上流 ECT の条件は未明示"), fetchedAt: FETCHED,
    loading: l3("泰國選區載入中", "Loading Thailand constituencies", "タイの選挙区を読み込み中"),
  },
  {
    key: "thHighlandVillages", file: "th_highland_villages.pmtiles", sourceId: "th-highland-villages", srcMinzoom: 5, srcMaxzoom: 14, color: "#22c55e", count: 4_212,
    parts: [point("th-highland-villages-circle", "villages", 5, propGetter("ethnic_group_th"), { small: true })],
    cats: ETHNIC_CATS, otherColor: "#94a3b8", otherLabel: l3("其他族群（約 30 種）、未標示", "Other groups (about 30), unspecified", "その他の民族（約 30）・不明"),
    title: { props: ["village_th"], fallback: l3("高地村", "Highland village", "高地村") },
    fields: [
      { prop: "moo", label: l3("村號（moo）", "Village no. (moo)", "ムー番号"), kind: "code" },
      { prop: "ethnic_group_th", label: l3("族群（泰文原文）", "Ethnic group (Thai)", "民族（タイ語）") },
      { prop: "population", label: l3("人口", "Population", "人口"), kind: "num" },
      { prop: "houses", label: l3("戶數", "Houses", "世帯数"), kind: "num" },
      { prop: "families", label: l3("家庭數", "Families", "家族数"), kind: "num" },
      { prop: "male", label: l3("男", "Male", "男"), kind: "num" },
      { prop: "female", label: l3("女", "Female", "女"), kind: "num" },
      { prop: "forest_type_th", label: l3("所在保護林類型", "Forest/protected-area type", "所在する保護林の種別") },
      { prop: "forest_name_th", label: l3("保護林名稱", "Forest/protected-area name", "保護林名") },
      { prop: "basin_th", label: l3("流域", "Basin", "流域") },
      { prop: "watershed_class", label: l3("集水區等級", "Watershed class", "集水域区分"), kind: "code" },
      { prop: "soil_loss_th", label: l3("土壤流失（泰文原文）", "Soil loss (Thai)", "土壌流出（タイ語）") },
      { prop: "tambon_th_src", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("HRDI 高地村 4,212 點，只涵蓋 21 個高地府；沒點的 56 府是未涵蓋，不代表沒有高地村", "4,212 HRDI highland villages in 21 highland provinces only; the other 56 provinces are not covered, not empty", "HRDI 高地村 4,212 件、高地 21 県のみ。残り 56 県は未収録で、高地村がないという意味ではない"),
      l3("族群前 7 名各色（กะเหรี่ยง 1,899、ไทยพื้นราบ 689、ลาหู่ 360…）；調查年未標；人口欄授權未明示", "Top 7 groups colored (Karen 1,899, Lowland Thai 689, Lahu 360…); survey year not stated; population fields license not stated", "民族上位 7 つを色分け（カレン 1,899・平地タイ 689・ラフ 360…）。調査年は不明。人口欄はライセンス未明示"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("Highland Research and Development Institute（HRDI）高地村調查（授權未明示，存取 2026-11-22）", "Highland Research and Development Institute (HRDI) highland village survey (license not stated, accessed 2026-11-22)", "Highland Research and Development Institute（HRDI）高地村調査（ライセンス未明示、2026-11-22 取得）"),
    sourceUrl: "https://www.hrdi.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國高地村載入中", "Loading Thailand highland villages", "タイの高地村を読み込み中"),
  },
  {
    key: "thProvinceSocioeconomic", file: "th_province_socioeconomic.pmtiles", sourceId: "th-province-socioeconomic", srcMinzoom: 3, srcMaxzoom: 10, color: "#d97706", count: 77, opacity: 0.75,
    parts: [
      { id: "th-socio-gini-fill", sourceLayer: "province", geom: "fill", minzoom: 3, cat: stepGetter("gini_2023", "gnc", GINI_IDS, GINI_BREAKS) },
      { id: "th-socio-change-fill", sourceLayer: "province", geom: "fill", minzoom: 3, cat: stepGetter("income_change_pct_2025", "cnc", CHANGE_IDS, CHANGE_BREAKS) },
    ],
    cats: SOCIO_CATS,
    defaultCats: [...GINI_IDS, "gnc"],
    title: { props: ["province_th"], fallback: l3("府", "Province", "県") },
    fields: [
      { prop: "province_en", label: l3("英文名稱", "English name", "英語名") },
      ...[2023, 2021, 2019, 2017, 2015, 2013].map((y): PhField => ({ prop: `gini_${y}`, label: l3(`Gini 係數 ${y}`, `Gini coefficient ${y}`, `ジニ係数 ${y}`), kind: "num", digits: 3 })),
      ...[2025, 2023, 2021, 2019, 2017, 2015, 2013, 2011].map((y): PhField => ({ prop: `income_change_pct_${y}`, label: l3(`收入變動 ${y}（%，來源未附定義）`, `Income change ${y} (%, definition not supplied)`, `所得変動 ${y}（%、定義は出典に記載なし）`), kind: "num", unit: "%", digits: 1 })),
    ],
    legendNotes: [
      l3("府級：圖例顯示 Gini（2023）與收入變動（2025）兩指標，預設只顯示 Gini，可在類別篩選切換；popup 列全部年份", "Province level: Gini (2023) and income change (2025); Gini only by default, switch in the category filter; popup lists all years", "県レベル：ジニ係数（2023）と所得変動（2025）。既定はジニのみ、カテゴリ絞り込みで切替。ポップアップに全年を表示"),
      l3("收入變動「來源未附定義」（基準與指標未說明），只可比較府間相對高低；Gini 分級為分位數（0.1／0.25／0.5／0.75／0.9）湊整", "Income change: the source supplies no definition, compare provinces relatively only; Gini classes are rounded quantiles (0.1/0.25/0.5/0.75/0.9)", "所得変動は出典に定義の記載なし（県間の相対比較のみ）。ジニの区分は分位数（0.1／0.25／0.5／0.75／0.9）の丸め"),
      l3("只有府級；tambon／村級貧窮與 GPP 未找到；灰色＝未涵蓋（不是 0）", "Province level only; tambon/village poverty and GPP not found; grey = not covered (not zero)", "県レベルのみ。tambon／村レベルの貧困・GPP は未発見。灰色＝未収録（0 ではない）"),
    ],
    popupNotes: [],
    sourceOrg: "National Statistical Office of Thailand（NSO），Creative Commons Attributions；邊界 OCHA COD-AB（CC BY-IGO）", sourceUrl: "https://gdcatalog.go.th/", license: l3("Creative Commons Attributions（版本號未見）", "Creative Commons Attributions (version not stated)", "Creative Commons Attributions（バージョン不明）"), fetchedAt: FETCHED,
    loading: l3("泰國府級社經載入中", "Loading Thailand province socio-economics", "タイの県別社会経済を読み込み中"),
  },
  {
    key: "thFootbridges", file: "th_footbridges.pmtiles", sourceId: "th-footbridges", srcMinzoom: 6, srcMaxzoom: 14, color: "#22c55e", count: 2_147,
    parts: [point("th-footbridges-circle", "footbridges", 6, propGetter("material_th"))],
    cats: [
      { id: "concrete", values: ["คอนกรีตเสริมเหล็ก"], color: "#22c55e", label: l3("人行天橋：鋼筋混凝土（2,055）", "Footbridge: reinforced concrete (2,055)", "歩道橋：鉄筋コンクリート（2,055）") },
      { id: "steel", values: ["เหล็กทั้งหมด"], color: "#facc15", label: l3("人行天橋：全鋼（92）", "Footbridge: all steel (92)", "歩道橋：全鋼（92）") },
    ],
    title: { props: ["location_th", "road_name_th"], fallback: l3("人行天橋", "Footbridge", "歩道橋") },
    fields: [
      { prop: "highway_name_th", label: l3("國道名稱（泰文）", "Highway name (Thai)", "国道名（タイ語）") },
      { prop: "road_name_th", label: l3("路名（泰文）", "Road name (Thai)", "道路名（タイ語）") },
      { prop: "km", label: l3("里程", "Km marker", "キロ程"), kind: "num", digits: 1 },
      { prop: "material_th", label: l3("材質（泰文原文）", "Material (Thai)", "材質（タイ語）") },
      { prop: "length_m", label: l3("長度", "Length", "長さ"), kind: "num", unit: "m", digits: 1 },
      { prop: "width_m", label: l3("寬度", "Width", "幅"), kind: "num", unit: "m", digits: 1 },
      { prop: "height_m", label: l3("高度", "Height", "高さ"), kind: "num", unit: "m", digits: 1 },
      { prop: "span_num", label: l3("跨數", "Spans", "径間数"), kind: "num" },
      { prop: "district_th", label: l3("轄區（泰文）", "District (Thai)", "管轄（タイ語）") },
      { prop: "update_date", label: l3("資料更新日", "Data updated", "データ更新日"), kind: "code" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("人行天橋，不是公路橋：DOH 國道上的 2,147 座（76/77 府）；公路橋（DRR）境外連不上，未涵蓋", "Pedestrian footbridges, not road bridges: 2,147 on DOH national highways (76/77 provinces); road bridges (DRR) unreachable from abroad, not covered", "歩道橋であり道路橋ではない：DOH 国道上 2,147 基（76/77 県）。道路橋（DRR）は海外から接続できず未収録"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("กรมทางหลวง（Department of Highways，DOH）（授權未明示，存取 2026-11-22）", "Department of Highways (DOH) (license not stated, accessed 2026-11-22)", "Department of Highways（DOH）（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://www.doh.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國人行天橋載入中", "Loading Thailand footbridges", "タイの歩道橋を読み込み中"),
  },
  {
    key: "thRailCrossings", file: "th_rail_crossings.pmtiles", sourceId: "th-rail-crossings", srcMinzoom: 6, srcMaxzoom: 14, color: "#f97316", count: 290,
    parts: [point("th-rail-crossings-circle", "rail_crossings", 6, propGetter("cross_type_th"))],
    cats: [
      { id: "level", values: ["ระดับเดียวกัน"], color: "#f97316", radius: 4.5, label: l3("同平面平交道（171）", "Level crossing (171)", "平面交差（171）") },
      { id: "grade_sep", values: ["ต่างระดับสะพานข้ามทางรถไฟ (รถไฟลอดใต้ทางหลวง)", "ต่างระดับรถไฟข้ามทางหลวง"], color: "#38bdf8", radius: 4.5, label: l3("立體交叉（119）", "Grade-separated (119)", "立体交差（119）") },
    ],
    title: { props: ["location_th", "road_name_th"], fallback: l3("鐵公路交會處", "Rail–road crossing", "鉄道と道路の交差") },
    fields: [
      { prop: "highway_name_th", label: l3("國道名稱（泰文）", "Highway name (Thai)", "国道名（タイ語）") },
      { prop: "road_name_th", label: l3("路名（泰文）", "Road name (Thai)", "道路名（タイ語）") },
      { prop: "km", label: l3("里程", "Km marker", "キロ程"), kind: "num", digits: 1 },
      { prop: "cross_type_th", label: l3("交會型式（泰文原文）", "Crossing type (Thai)", "交差形式（タイ語）") },
      { prop: "junction_type_th", label: l3("交會類別（泰文原文）", "Junction type (Thai)", "交差の種別（タイ語）") },
      { prop: "district_th", label: l3("轄區（泰文）", "District (Thai)", "管轄（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("只含國道與鐵路的交會處 290 處（45/77 府），不是全國平交道清單", "Only DOH national highway × railway crossings, 290 (45/77 provinces); not a national list of level crossings", "国道と鉄道の交差のみ 290 件（45/77 県）。全国の踏切一覧ではない"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("กรมทางหลวง（Department of Highways，DOH）（授權未明示，存取 2026-11-22）", "Department of Highways (DOH) (license not stated, accessed 2026-11-22)", "Department of Highways（DOH）（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://www.doh.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國鐵公路交會處載入中", "Loading Thailand rail crossings", "タイの鉄道交差を読み込み中"),
  },
  {
    key: "thRoadAccidents", file: "th_road_accidents.pmtiles", sourceId: "th-road-accidents", srcMinzoom: 6, srcMaxzoom: 14, color: "#ef4444", count: 23_543,
    parts: [point("th-road-accidents-circle", "accidents", 6, propGetter("severity"), { small: true })],
    cats: ACCIDENT_CATS,
    heat: { intensity: 0.8 },
    title: { props: ["route_th"], fallback: l3("交通事故", "Traffic accident", "交通事故") },
    fields: [
      { prop: "date", label: l3("日期", "Date", "日付"), kind: "code" },
      { prop: "time_local", label: l3("時間（當地）", "Time (local)", "時刻（現地）"), kind: "code" },
      { prop: "severity", label: l3("嚴重度（本層分級）", "Severity (this layer's class)", "重大度（本レイヤーの区分）"), map: { fatal: l3("死亡", "Fatal", "死亡"), serious: l3("重傷", "Serious injury", "重傷"), minor: l3("輕傷", "Minor injury", "軽傷"), damage_only: l3("僅財損", "Damage only", "物損のみ") } },
      { prop: "route_code", label: l3("路線代碼", "Route code", "路線コード"), kind: "code" },
      { prop: "km", label: l3("里程", "Km marker", "キロ程"), kind: "num", digits: 1 },
      { prop: "accident_type_th", label: l3("事故型態（泰文原文）", "Accident type (Thai)", "事故形態（タイ語）") },
      { prop: "cause_th", label: l3("肇因（泰文原文）", "Cause (Thai)", "原因（タイ語）") },
      { prop: "weather_th", label: l3("天氣（泰文原文）", "Weather (Thai)", "天候（タイ語）") },
      { prop: "first_vehicle_th", label: l3("第一碰撞車種（泰文原文）", "First vehicle (Thai)", "第一当事車両（タイ語）") },
      { prop: "vehicles", label: l3("涉及車輛數", "Vehicles involved", "関与車両数"), kind: "num" },
      { prop: "deaths", label: l3("死亡", "Deaths", "死者"), kind: "num" },
      { prop: "serious_injuries", label: l3("重傷", "Serious injuries", "重傷者"), kind: "num" },
      { prop: "minor_injuries", label: l3("輕傷", "Minor injuries", "軽傷者"), kind: "num" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("2025-01-01～12-12 的事故 23,543 件（非全年）；嚴重度為本層依死傷數分級，不是 A1／A2 分級", "23,543 accidents from 2025-01-01 to 12-12 (not a full year); severity is this layer's own class by casualties, not the A1/A2 classification", "2025-01-01～12-12 の事故 23,543 件（通年ではない）。重大度は死傷者数による本レイヤー独自の区分で、A1／A2 ではない"),
      l3("低縮放為密度熱區，放大到 z8 起顯示逐點；彈窗不含個人可識別欄位（無姓名、車牌、年齡）", "Density heat at low zoom, individual points from z8; the popup has no personally identifiable fields (no names, plates, ages)", "低ズームは密度ヒート、z8 以上で個別点。ポップアップに個人識別項目（氏名・ナンバー・年齢）はない"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: GISTDA_ORG, sourceUrl: "https://gistdaportal.gistda.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國交通事故載入中", "Loading Thailand road accidents", "タイの交通事故を読み込み中"),
  },
  {
    key: "thEec", file: "th_eec.pmtiles", sourceId: "th-eec", srcMinzoom: 4, srcMaxzoom: 13, color: "#f59e0b", count: 293, opacity: 0.7,
    parts: [
      { id: "th-eec-boundary-fill", sourceLayer: "eec_boundary", geom: "fill", minzoom: 4, cat: constGetter("boundary"), fillOpacity: 0 },
      { id: "th-eec-tambon-fill", sourceLayer: "eec_tambon", geom: "fill", minzoom: 6, cat: constGetter("tambon"), fillOpacity: 0.25 },
      { id: "th-eec-boundary-line", sourceLayer: "eec_boundary", geom: "line", minzoom: 4, cat: constGetter("boundary"), lineWidth: { boundary: [1.5, 3] } },
    ],
    cats: [
      { id: "tambon", values: ["tambon"], color: "#f59e0b", parts: ["th-eec-tambon-fill"], label: l3("EEC 鄉（tambon，290）淡填色", "EEC sub-districts (tambon, 290), light fill", "EEC の tambon（290）淡い塗り") },
      { id: "boundary", values: ["boundary"], color: "#fb923c", parts: ["th-eec-boundary-fill", "th-eec-boundary-line"], label: l3("EEC 3 府邊界（Chon Buri、Rayong、Chachoengsao）", "EEC 3-province boundary (Chon Buri, Rayong, Chachoengsao)", "EEC 3 県の境界（Chon Buri・Rayong・Chachoengsao）") },
    ],
    title: { props: ["tambon_th_src", "name_th", "name_en"], fallback: l3("東部經濟走廊 EEC", "Eastern Economic Corridor", "東部経済回廊 EEC") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "tambon_th_src", label: l3("區（泰文，來源表）", "Sub-district (Thai, source)", "区（タイ語、出典表）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文，來源表）", "District (Thai, source)", "郡（タイ語、出典表）") },
      { prop: "province_th_src", label: l3("府（泰文，來源表）", "Province (Thai, source)", "県（タイ語、出典表）") },
      { prop: "households", label: l3("戶數", "Households", "世帯数"), kind: "num" },
      { prop: "persons", label: l3("人數", "Persons", "人数"), kind: "num" },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
    ],
    legendNotes: [
      l3("只涵蓋 EEC 3 府（3/77）；其餘 74 府是未涵蓋；經濟特區（SEZ）邊界無開放來源，未涵蓋", "Only the 3 EEC provinces (3/77); the other 74 are not covered; special economic zone (SEZ) boundaries have no open source, not covered", "EEC の 3 県のみ（3/77）。他の 74 県は未収録。経済特区（SEZ）境界は公開出典なしで未収録"),
      l3("鄉層另有衛生、收入等統計欄，欄名被截斷、語意未驗，popup 不顯示", "Tambon records carry health and income statistic columns whose names are truncated and unverified; not shown in the popup", "tambon には保健・所得などの統計列があるが、列名が切れており意味が未確認のためポップアップには表示しない"),
    ],
    popupNotes: [],
    sourceOrg: l3("GISTDA Hosted（授權未明示，存取 2026-11-22）；EEC 3 府邊界取自 OCHA COD-AB（CC BY-IGO）", "GISTDA Hosted (license not stated, accessed 2026-11-22); the 3-province boundary derived from OCHA COD-AB (CC BY-IGO)", "GISTDA Hosted（ライセンス未明示、2026-11-22 取得）。3 県境界は OCHA COD-AB（CC BY-IGO）由来"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: l3("授權未明示（鄉）；CC BY-IGO 3.0（3 府邊界）", "License not stated (tambon); CC BY-IGO 3.0 (3-province boundary)", "ライセンス未明示（tambon）。CC BY-IGO 3.0（3 県境界）"), fetchedAt: FETCHED,
    loading: l3("泰國東部經濟走廊載入中", "Loading Thailand EEC", "タイの東部経済回廊を読み込み中"),
  },
  {
    key: "thFloodHistory", file: "th_flood_history.pmtiles", sourceId: "th-flood-history", srcMinzoom: 6, srcMaxzoom: 12, color: "#3b82f6", count: 118_727, opacity: 0.6,
    parts: [{ id: "th-flood-history-fill", sourceLayer: "flood", geom: "fill", minzoom: 6, cat: propGetter("freq") }],
    cats: FLOOD_CATS,
    title: { props: [], fallback: l3("歷史淹水範圍（2005–2012）", "Historical flood extent (2005–2012)", "過去の浸水範囲（2005–2012）") },
    fields: [
      { prop: "freq", label: l3("淹水頻率（1–7，圖例分級依此）", "Flood frequency (1–7, used for the legend classes)", "浸水頻度（1–7、凡例の区分）"), kind: "num" },
      { prop: "years_flooded", label: l3("淹水年份（逐年旗標，泰國曆西元年）", "Flooded years (per-year flags, CE)", "浸水年（年次フラグ、西暦）"), kind: "code" },
      { prop: "first_year", label: l3("最早年", "First year", "最初の年"), kind: "year" },
      { prop: "last_year", label: l3("最近年", "Last year", "最後の年"), kind: "year" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("2005–2012 歷史淹水範圍（衛星判釋、一般化）；只涵蓋 16/77 府，其餘是未涵蓋，不是沒淹過；近年重複淹水未涵蓋", "Historical flood extent 2005–2012 (satellite-derived, generalized); only 16 of 77 provinces covered — the rest are not covered, not flood-free; recent repeat flooding not covered", "2005–2012 の浸水履歴範囲（衛星判読・一般化）。77 県中 16 県のみで、他は未収録（浸水がなかったという意味ではない）。近年の繰り返し浸水は未収録"),
      l3("「淹水頻率」與「逐年旗標」來源計法不同，兩者可能不一致；popup 並列、不擇一", "'Frequency' and the per-year flags are counted differently in the source and may disagree; the popup shows both without choosing", "「浸水頻度」と「年次フラグ」は出典で数え方が異なり一致しないことがある。ポップアップは両方を並記し、どちらも採らない"),
      l3("z6 起顯示（11.9 萬塊面）", "Shown from z6 (118,727 polygons)", "z6 以上で表示（118,727 面）"),
    ],
    popupNotes: [{ text: l3("淹水頻率與逐年旗標加總可能不一致，兩者並列、不擇一", "Frequency and the sum of per-year flags may disagree; both shown, neither preferred", "浸水頻度と年次フラグの合計は一致しないことがあり、両方を並記"), when: () => true }],
    sourceOrg: GISTDA_ORG, sourceUrl: "https://gistdaportal.gistda.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國歷史淹水載入中", "Loading Thailand flood history", "タイの浸水履歴を読み込み中"),
  },
  {
    key: "thBasins", file: "th_basins.pmtiles", sourceId: "th-basins", srcMinzoom: 3, srcMaxzoom: 12, color: "#38bdf8", count: 279, opacity: 0.45,
    parts: [
      { id: "th-basin-main-fill", sourceLayer: "main_basin", geom: "fill", minzoom: 3, cat: propGetter("mbasin_code") },
      { id: "th-basin-sub-fill", sourceLayer: "sub_basin", geom: "fill", minzoom: 5, cat: constGetter("sub"), fillOpacity: 0 },
      { id: "th-basin-sub-line", sourceLayer: "sub_basin", geom: "line", minzoom: 5, cat: constGetter("sub"), lineWidth: { sub: [0.5, 1.2] } },
    ],
    cats: BASIN_CATS,
    title: { props: ["sbasin_th", "mbasin_th"], fallback: l3("流域", "Basin", "流域") },
    fields: [
      { prop: "sbasin_en", label: l3("子流域（英文）", "Sub-basin (English)", "支流域（英語）") },
      { prop: "sbasin_code", label: l3("子流域代碼", "Sub-basin code", "支流域コード"), kind: "code" },
      { prop: "mbasin_th", label: l3("主流域（泰文）", "Main basin (Thai)", "主流域（タイ語）") },
      { prop: "mbasin_en", label: l3("主流域（英文）", "Main basin (English)", "主流域（英語）") },
      { prop: "mbasin_code", label: l3("主流域代碼", "Main basin code", "主流域コード"), kind: "code" },
      { prop: "sub_basins", label: l3("所含子流域數", "Sub-basins", "支流域数"), kind: "num" },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
    ],
    legendNotes: [
      l3("DWR 25 主流域（z3 起）各色＋254 子流域邊界（z5 起）；與 ONWR 22 流域是不同分法", "DWR 25 main basins (from z3, one color each) plus 254 sub-basin boundaries (from z5); not the same split as ONWR's 22 basins", "DWR の 25 主流域（z3 以上、各色）＋254 支流域境界（z5 以上）。ONWR の 22 流域とは別の区分"),
      l3("河線與水體面未涵蓋（資料量過大，本輪不做）", "River lines and water-body polygons not covered (too large, not in this round)", "河川線と水域ポリゴンは未収録（データ量が大きく今回は対象外）"),
    ],
    popupNotes: [],
    sourceOrg: l3("NGIS／กรมทรัพยากรน้ำ（Department of Water Resources，DWR）流域（授權未明示，存取 2026-11-22）", "NGIS / Department of Water Resources (DWR) basins (license not stated, accessed 2026-11-22)", "NGIS／Department of Water Resources（DWR）流域（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://ngis.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國流域載入中", "Loading Thailand basins", "タイの流域を読み込み中"),
  },
  {
    key: "thIrrigationProjects", file: "th_irrigation_projects.pmtiles", sourceId: "th-irrigation-projects", srcMinzoom: 5, srcMaxzoom: 14, color: "#38bdf8", count: 796,
    parts: [point("th-irrigation-projects-circle", "projects", 5, propGetter("facility_type"))],
    cats: IRRIGATION_CATS,
    title: { props: ["name_th"], fallback: l3("灌溉專案", "Irrigation project", "灌漑プロジェクト") },
    fields: [
      { prop: "facility_type", label: l3("設施類型（由名稱推導）", "Facility type (inferred from name)", "施設種別（名称から推定）"), map: Object.fromEntries(IRRIGATION_CATS.map((c) => [c.id, c.label])) },
      { prop: "owner_th", label: l3("主管（泰文）", "Owner (Thai)", "管理者（タイ語）") },
      { prop: "tambon_th_src", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      { prop: "province_th_src", label: l3("府（來源表）", "Province (source)", "県（出典表）") },
      { prop: "landuse_year_ce", label: l3("土地利用調查年（西元）", "Land-use survey year (CE)", "土地利用調査年（西暦）"), kind: "year" },
      { prop: "area_project_src", label: l3("專案面積（單位來源未標）", "Project area (unit not stated)", "プロジェクト面積（単位は出典に記載なし）"), kind: "num" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("RID 灌溉專案 796 處（71/77 府）；設施類型由專案名稱推導，不是官方分類", "796 RID irrigation projects (71/77 provinces); facility type is inferred from the project name, not an official class", "RID 灌漑プロジェクト 796 件（71/77 県）。施設種別はプロジェクト名から推定で、公式分類ではない"),
      l3("專案面積欄單位來源未標", "Project area unit not stated by the source", "プロジェクト面積の単位は出典に記載なし"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("NGIS／กรมชลประทาน（Royal Irrigation Department，RID）灌溉專案（授權未明示，存取 2026-11-22）", "NGIS / Royal Irrigation Department (RID) irrigation projects (license not stated, accessed 2026-11-22)", "NGIS／Royal Irrigation Department（RID）灌漑プロジェクト（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://ngis.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國灌溉專案載入中", "Loading Thailand irrigation projects", "タイの灌漑プロジェクトを読み込み中"),
  },
  {
    key: "thLandslideSafePoints", file: "th_landslide_safe_points.pmtiles", sourceId: "th-landslide-safe-points", srcMinzoom: 6, srcMaxzoom: 14, color: "#22c55e", count: 8_286,
    parts: [point("th-landslide-safe-points-circle", "safe_points", 6, constGetter("safe"), { small: true })],
    cats: [{ id: "safe", values: ["safe"], color: "#22c55e", radius: 3, label: l3("臨時安全點（避難場所）", "Temporary safe point (shelter)", "一時避難場所") }],
    title: { props: ["place_th", "village_th"], fallback: l3("臨時安全點", "Temporary safe point", "一時避難場所") },
    fields: [
      { prop: "village_th", label: l3("村（泰文）", "Village (Thai)", "村（タイ語）") },
      { prop: "moo", label: l3("村號（moo）", "Village no. (moo)", "ムー番号"), kind: "code" },
      { prop: "tambon_th_src", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      { prop: "year_ce", label: l3("設置年（西元）", "Year (CE)", "設置年（西暦）"), kind: "year" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("DMR 坍方臨時安全點 8,286 處（46/77 府）；崩塌潛勢面圖無可用幾何，未涵蓋", "8,286 DMR landslide temporary safe points (46/77 provinces); landslide susceptibility polygons have no usable geometry, not covered", "DMR の土砂災害一時避難場所 8,286 件（46/77 県）。土砂災害危険度のポリゴンは使える形状がなく未収録"),
      l3("沒有點的府是未涵蓋，不代表沒有避難場所", "Provinces without points are not covered, not empty", "点のない県は未収録で、避難場所がないという意味ではない"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: "กรมทรัพยากรธรณี（Department of Mineral Resources，DMR），Creative Commons Attributions", sourceUrl: "https://www.dmr.go.th/", license: l3("Creative Commons Attributions（版本未標）", "Creative Commons Attributions (version not stated)", "Creative Commons Attributions（バージョン不明）"), fetchedAt: FETCHED,
    loading: l3("泰國坍方安全點載入中", "Loading Thailand landslide safe points", "タイの土砂災害一時避難場所を読み込み中"),
  },
  {
    key: "thLandfills", file: "th_landfills.pmtiles", sourceId: "th-landfills", srcMinzoom: 5, srcMaxzoom: 14, color: "#ef4444", count: 5_738,
    parts: [
      point("th-landfill-survey-circle", "landfill_survey", 6, siteType, { small: true }),
      point("th-landfill-pcd-circle", "pcd_facilities", 7, constGetter("pcd"), { small: true, hollow: { label: l3("空心：PCD 設施", "Hollow: PCD facility", "中抜き：PCD 施設") } }),
    ],
    cats: LANDFILL_CATS,
    title: { props: ["name_th", "location_th"], fallback: l3("垃圾場址", "Waste site", "廃棄物処分場") },
    fields: [
      { prop: "site_type", label: l3("場址類型（調查）", "Site type (survey)", "処分場種別（調査）"), kind: "code" },
      { prop: "manage", label: l3("處理方式（PCD，英文原文）", "Management (PCD)", "処理方法（PCD）"), kind: "code" },
      { prop: "manage_th", label: l3("處理方式（調查，泰文原文）", "Management (survey, Thai)", "処理方法（調査、タイ語）") },
      { prop: "owner_th", label: l3("管理單位（泰文）", "Owner (Thai)", "管理者（タイ語）") },
      { prop: "location_th", label: l3("位置（泰文）", "Location (Thai)", "所在地（タイ語）") },
      { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²" },
      { prop: "start_year_ce", label: l3("啟用年（西元）", "Start year (CE)", "開始年（西暦）"), kind: "year" },
      { prop: "impact_th", label: l3("影響（泰文原文）", "Impact (Thai)", "影響（タイ語）") },
      { prop: "survey_date", label: l3("調查日期", "Survey date", "調査日"), kind: "code" },
      { prop: "waste_in_src", label: l3("進場廢棄物量（單位來源未標）", "Waste received (unit not stated)", "搬入廃棄物量（単位は出典に記載なし）"), kind: "num" },
      { prop: "tambon_th_src", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("兩份調查分開畫、不可相加：垃圾場址調查 3,129 處（實心）、PCD 設施 2,609 處（空心）；調查年約 2010–2014", "Two surveys drawn separately and not additive: 3,129 landfill-survey sites (solid) and 2,609 PCD facilities (hollow); survey years about 2010–2014", "2 つの調査は別々に描画し合算しない：処分場調査 3,129（塗り）・PCD 施設 2,609（中抜き）。調査年は 2010–2014 年頃"),
      l3("調查從 z6、PCD 設施從 z7 起顯示（低縮放兩者合計 5,700 點會糊成一片）；涵蓋 76/77 府；PCD 2566 年新版連線失敗，未涵蓋", "Survey shown from z6, PCD facilities from z7 (5,700 points would blur at lower zooms); 76/77 provinces covered; the newer PCD 2566 list could not be fetched, not covered", "調査は z6、PCD 施設は z7 以上で表示（低ズームでは 5,700 点が潰れる）。76/77 県。PCD 2566 年版は取得に失敗し未収録"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("GISTDA Hosted（垃圾場址調查）與 กรมควบคุมมลพิษ（Pollution Control Department，PCD）設施（授權未明示，存取 2026-11-22）", "GISTDA Hosted (landfill survey) and Pollution Control Department (PCD) facilities (license not stated, accessed 2026-11-22)", "GISTDA Hosted（処分場調査）と Pollution Control Department（PCD）施設（ライセンス未明示、2026-11-22 取得）"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: l3("泰國垃圾場址載入中", "Loading Thailand waste sites", "タイの廃棄物処分場を読み込み中"),
  },
];
