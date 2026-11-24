/**
 * 泰國第 5–7 波（2026-11-22）19 個向量層規格（規格驅動，重用菲律賓引擎 `usePhDataLayer`）。
 * 資料、授權原句見 taipei-gis-analytics `docs/topic-research/thailand_opendata/waves/w05/FRONTEND_SPEC.md` 與各 `_manifest.json`。
 * 共通規則：官方名冊實心、Overture／OSM 補缺空心（圖例分列）；不輸出電話、email、網站、聯絡人、門牌地址（Overture 的 address 欄不顯示）；
 * 名稱含個人稱謂者整筆遮蔽（name_redacted=true），popup 顯示「（個人名義，已遮蔽）」；授權未明示來源照常上線並標示。
 * 大點層（>1 萬）資料端各 part 有最小縮放（z7–z9 才有點），低縮放用熱區，圖例寫「放大到 zN 顯示個別點」。
 * 本檔只 import 型別（thDataLayers 會 spread 本檔）。
 */
import type { ThLayerSpec } from "./thDataLayers";
import type { L3, PhCat, PhCatGetter, PhField, PhNote, PhPart } from "../../data/intlLayerShared";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const constGetter = (v: string): PhCatGetter => ({ expr: ["literal", v], js: () => v });
const matchGetter = (prop: string, groups: Readonly<Record<string, readonly string[]>>, fallback: string): PhCatGetter => ({
  expr: ["match", ["to-string", ["coalesce", ["get", prop], ""]], ...Object.entries(groups).flatMap(([id, vals]) => [vals.length === 1 ? vals[0]! : [...vals], id]), fallback],
  js: (p) => { const v = str(p[prop]); for (const [id, vals] of Object.entries(groups)) if (vals.includes(v)) return id; return fallback; },
});
const FETCHED = "2026-11-22";
const UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
const OVERTURE_ORG = "Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0；上游 Meta 等）";
const REDACTED_TITLE = { prop: "name_redacted", map: { true: l3("（個人名義，已遮蔽）", "(personal name, redacted)", "（個人名義、秘匿）") } } as const;
const REDACT_NOTE: PhNote = { text: l3("個人名義，名稱已遮蔽", "Personal name, redacted", "個人名義のため名称を秘匿"), when: (p) => p.name_redacted === true || str(p.name_redacted) === "true" };
const NEAREST_NOTE: PhNote = { text: l3("點落在府界外（岸邊、河道），府取最近者", "Point lies outside province polygons (shore, river); nearest province used", "点が県境の外（海岸・河道）にあり、最寄りの県を採用"), when: (p) => str(p.province_method) === "nearest" };
const PROVINCE_FIELDS: readonly PhField[] = [
  { prop: "province_th", label: l3("府（泰文）", "Province (Thai)", "県（タイ語）") },
  { prop: "province_en", label: l3("府（英文）", "Province (English)", "県（英語）") },
];
const NAME_FIELDS: readonly PhField[] = [
  { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
];
const OVERTURE_FIELDS: readonly PhField[] = [
  { prop: "category", label: l3("類別（Overture）", "Category (Overture)", "カテゴリ（Overture）"), kind: "code" },
  { prop: "brand", label: l3("品牌（Overture）", "Brand (Overture)", "ブランド（Overture）") },
  { prop: "locality", label: l3("地區", "Locality", "地域") },
  { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
  { prop: "datasets", label: l3("上游資料集", "Upstream datasets", "上流データセット") },
];
const OVERTURE_NOTE = l3("Overture 補缺（非官方、空心）：完整度未經官方核對，筆數為登記數、可能含歇業", "Overture gap-fill (unofficial, hollow): completeness not officially verified; counts are registrations and may include closed sites", "Overture 補完（非公式・中抜き）：網羅性は公式に未確認で、件数は登録数（閉業を含む可能性）");
const OSM_NOTE = l3("OSM 補缺（空心）：志願者繪製，完整度未經官方核對", "OSM gap-fill (hollow): volunteer-mapped, completeness not officially verified", "OSM 補完（中抜き）：ボランティア作図で、網羅性は公式に未確認");
const HOLLOW = (zh: string, en: string, ja: string) => ({ label: l3(zh, en, ja) });
const ZOOM_NOTE = (z: number, n: string) => l3(`低縮放為熱區，放大到 z${z} 顯示個別點（${n}）`, `Heat at low zoom; individual points from z${z} (${n})`, `低ズームはヒート表示、z${z} 以上で個別点（${n}）`);
const cat = (id: string, values: readonly string[], color: string, zh: string, en: string, ja: string, o: { parts?: readonly string[]; radius?: number } = {}): PhCat => ({ id, values, color, label: l3(zh, en, ja), ...o });
const pt = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat: getter, ...extra });
const fillPart = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, fillOpacity = 0.25): PhPart => ({ id, sourceLayer, geom: "fill", minzoom, cat: getter, fillOpacity });
const linePart = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, widths: Readonly<Record<string, readonly [number, number]>>): PhPart => ({ id, sourceLayer, geom: "line", minzoom, cat: getter, lineWidth: widths });
const loading = (zh: string, en: string, ja: string) => l3(`泰國${zh}載入中`, `Loading Thailand ${en}`, `タイの${ja}を読み込み中`);

export const TH_WAVE5_SPECS: readonly ThLayerSpec[] = [
  // ───────────── 教育 ─────────────
  {
    key: "thSchools", file: "th_schools.pmtiles", sourceId: "th-schools", srcMinzoom: 7, srcMaxzoom: 14, color: "#38bdf8", count: 41_443,
    parts: [pt("th-schools-obec-circle", "obec", 7, propGetter("level"), { small: true }), pt("th-schools-other-circle", "other_departments", 8, constGetter("other_dept"), { small: true })],
    cats: [
      cat("primary", ["primary"], "#38bdf8", "OBEC 小學（20,029）", "OBEC primary (20,029)", "OBEC 小学校（20,029）", { parts: ["th-schools-obec-circle"] }),
      cat("lower_secondary", ["lower_secondary"], "#22c55e", "OBEC 初中（6,877）", "OBEC lower secondary (6,877)", "OBEC 前期中等（6,877）", { parts: ["th-schools-obec-circle"] }),
      cat("upper_secondary", ["upper_secondary"], "#a78bfa", "OBEC 高中（2,511）", "OBEC upper secondary (2,511)", "OBEC 後期中等（2,511）", { parts: ["th-schools-obec-circle"] }),
      cat("other_level", ["other", ""], "#94a3b8", "OBEC 其他、未分級", "OBEC other / unclassified", "OBEC その他・区分なし", { parts: ["th-schools-obec-circle"] }),
      cat("other_dept", ["other_dept"], "#f59e0b", "非 OBEC 學校（GISTDA，11,802）", "Non-OBEC schools (GISTDA, 11,802)", "非 OBEC 学校（GISTDA、11,802）", { parts: ["th-schools-other-circle"] }),
    ],
    heat: { intensity: 5 },
    title: { props: ["name_th"], fallback: l3("學校", "School", "学校"), fallbackBy: REDACTED_TITLE },
    fields: [
      { prop: "school_type_th", label: l3("主管單位（泰文原文）", "Authority (Thai)", "所管（タイ語）") },
      { prop: "department_th", label: l3("主管部門（泰文原文）", "Department (Thai)", "所管部門（タイ語）") },
      { prop: "level", label: l3("學制", "Level", "学制"), map: { primary: l3("小學", "Primary", "小学校"), lower_secondary: l3("初中", "Lower secondary", "前期中等"), upper_secondary: l3("高中", "Upper secondary", "後期中等"), other: l3("其他", "Other", "その他") } },
      { prop: "students", label: l3("學生數", "Students", "児童生徒数"), kind: "num" },
      { prop: "rooms", label: l3("教室數", "Classrooms", "教室数"), kind: "num" },
      { prop: "school_size", label: l3("規模（泰文原文）", "Size class (Thai)", "規模（タイ語）") },
      { prop: "class_min", label: l3("最低班級", "Lowest class", "最低学年") }, { prop: "class_max", label: l3("最高班級", "Highest class", "最高学年") },
      { prop: "geo_class", label: l3("地理分類", "Geographic class", "地理区分"), map: { plain: l3("平地", "Plain", "平地"), highland: l3("高地", "Highland", "高地"), island: l3("島嶼", "Island", "島嶼"), mountain_hard: l3("山區（困難）", "Hard mountain", "山岳（困難）"), other: l3("其他", "Other", "その他") } },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("OBEC 2563 學年名冊 29,641 校（座標只有 3 位小數，約 100 m）＋GISTDA 非 OBEC 學校 11,802", "29,641 OBEC schools (BE 2563 register; coordinates to 3 decimals, ~100 m) + 11,802 non-OBEC schools from GISTDA ", "OBEC 2563 年度名簿 29,641 校（座標は小数 3 桁、約 100 m）＋GISTDA 非 OBEC 学校 11,802"),
      ZOOM_NOTE(7, "OBEC z7、非 OBEC z8"),
      l3("大專學生數、補習班未涵蓋；電話、網站、地址不輸出", "University enrolment and cram schools not covered; no phone, website or address output", "大学の学生数・塾は未収録。電話・Web・住所は出力しない"),
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("OBEC（สพฐ.）學校名冊 API（Open Data Common）；GISTDA Hosted School_new2（授權未明示，存取 2026-11-22）", "OBEC school register API (Open Data Common); GISTDA Hosted School_new2 (license not stated, accessed 2026-11-22)", "OBEC 学校名簿 API（Open Data Common）、GISTDA Hosted School_new2（ライセンス未明示、2026-11-22 取得）"),
    sourceUrl: "https://data.bopp-obec.info/", license: l3("Open Data Common（OBEC）；GISTDA 部分授權未明示", "Open Data Common (OBEC); GISTDA part license not stated", "Open Data Common（OBEC）。GISTDA 部分はライセンス未明示"), fetchedAt: FETCHED,
    loading: loading("學校", "schools", "学校"),
  },
  {
    key: "thKindergartens", file: "th_kindergartens.pmtiles", sourceId: "th-kindergartens", srcMinzoom: 6, srcMaxzoom: 14, color: "#f472b6", count: 31_403,
    parts: [pt("th-kindergartens-obec-circle", "obec_attached", 7, constGetter("attached"), { small: true }), pt("th-kindergartens-overture-circle", "overture", 6, constGetter("overture"), { small: true, hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") })],
    cats: [
      cat("attached", ["attached"], "#f472b6", "學校附設幼兒班（OBEC，26,418）", "Kindergarten class attached to a school (OBEC, 26,418)", "学校併設の幼児クラス（OBEC、26,418）", { parts: ["th-kindergartens-obec-circle"] }),
      cat("overture", ["overture"], "#fb7185", "幼兒園、托育（Overture 補缺，空心，4,985）", "Preschool / day care (Overture gap-fill, hollow, 4,985)", "幼稚園・保育（Overture 補完、中抜き、4,985）", { parts: ["th-kindergartens-overture-circle"] }),
    ],
    heat: { intensity: 5 },
    title: { props: ["name_th", "name"], fallback: l3("幼兒班、幼兒園", "Kindergarten", "幼稚園"), fallbackBy: REDACTED_TITLE },
    fields: [
      { prop: "class_min", label: l3("開設最低班（อ.1／อ.2／อ.3）", "Lowest class (อ.1/อ.2/อ.3)", "最低クラス（อ.1／อ.2／อ.3）") },
      { prop: "class_max", label: l3("最高班", "Highest class", "最高クラス") },
      { prop: "students_total", label: l3("學生總數（學校整體）", "Total students (whole school)", "児童生徒総数（学校全体）"), kind: "num" },
      { prop: "attached_to_school", label: l3("學校附設（點位＝學校位置）", "Attached to a school (point = school location)", "学校併設（点＝学校の位置）"), map: { true: l3("是", "Yes", "はい") } },
      ...OVERTURE_FIELDS, ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("OBEC 學校附設幼兒班 26,418（點位＝學校位置，非獨立園所）＋Overture 補缺 4,985（空心）", "26,418 OBEC attached classes (point = school location, not stand-alone centres) + 4,985 Overture gap-fill (hollow)", "OBEC 学校併設クラス 26,418（点＝学校の位置、独立園ではない）＋Overture 補完 4,985（中抜き）"),
      ZOOM_NOTE(7, "學校附設 z7、Overture z6"),
      l3("ศพด.（約 2 萬，無座標）、私立幼兒園名冊未涵蓋", "Child development centres (ศพด., ~20,000, no coordinates) and private kindergarten registers not covered", "ศพด.（約 2 万、座標なし）・私立幼稚園名簿は未収録"),
      OVERTURE_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("OBEC（สพฐ.）學校名冊（OGL）；Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）補缺", "OBEC school register (OGL); Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0) gap-fill", "OBEC 学校名簿（OGL）、Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）補完"),
    sourceUrl: "https://data.bopp-obec.info/", license: l3("OGL（OBEC）；CDLA-Permissive-2.0（Overture）", "OGL (OBEC); CDLA-Permissive-2.0 (Overture)", "OGL（OBEC）、CDLA-Permissive-2.0（Overture）"), fetchedAt: FETCHED,
    loading: loading("幼兒班", "kindergartens", "幼児教育"),
  },
  // ───────────── 社福、醫療 ─────────────
  {
    key: "thElderlyHousing", file: "th_elderly_housing.pmtiles", sourceId: "th-elderly-housing", srcMinzoom: 5, srcMaxzoom: 14, color: "#c084fc", count: 733,
    parts: [pt("th-elderly-housing-circle", "retirement_homes", 5, constGetter("retirement_home"), { hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") })],
    cats: [cat("retirement_home", ["retirement_home"], "#c084fc", "養老院、長者住宿（Overture 補缺，空心）", "Retirement / elderly homes (Overture gap-fill, hollow)", "老人ホーム（Overture 補完、中抜き）", { radius: 4.5 })],
    title: { props: ["name"], fallback: l3("長者住宿", "Elderly home", "高齢者施設"), fallbackBy: REDACTED_TITLE },
    fields: [...OVERTURE_FIELDS, ...PROVINCE_FIELDS],
    legendNotes: [
      l3("Overture 補缺 733 處（69/77 府）；完整度不明，非官方名冊；DOP 官方名冊、護理機構、身障機構未涵蓋", "733 Overture gap-fill sites (69/77 provinces); completeness unknown, not an official register; official DOP register, nursing and disability facilities not covered", "Overture 補完 733 件（69/77 県）。網羅性は不明で公式名簿ではない。DOP 公式名簿・介護・障害施設は未収録"),
      OVERTURE_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: OVERTURE_ORG, sourceUrl: "https://overturemaps.org/", license: "CDLA-Permissive-2.0", fetchedAt: FETCHED,
    loading: loading("長者住宿", "elderly housing", "高齢者施設"),
  },
  {
    key: "thHealthFacilities", file: "th_health_facilities.pmtiles", sourceId: "th-health-facilities", srcMinzoom: 6, srcMaxzoom: 14, color: "#ef4444", count: 13_481,
    parts: [
      pt("th-health-gistda-circle", "gistda_poi", 6, propGetter("kind"), { small: true }),
      pt("th-health-osm-circle", "osm_health", 6, matchGetter("amenity", { osm_hospital: ["hospital"], osm_clinic: ["clinic", "doctors", "dentist"], osm_pharmacy: ["pharmacy"] }, "osm_other"), { small: true, hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") }),
    ],
    cats: [
      cat("hospital", ["hospital"], "#ef4444", "醫院（GISTDA 名稱推導，1,478）", "Hospital (GISTDA, inferred from name, 1,478)", "病院（GISTDA、名称から推定、1,478）", { parts: ["th-health-gistda-circle"], radius: 4.5 }),
      cat("gistda_other", ["other"], "#fb923c", "其他醫療點（GISTDA，含 รพ.สต. 等，5,256）", "Other health points (GISTDA, incl. sub-district health centres, 5,256)", "その他の医療点（GISTDA、รพ.สต. など、5,256）", { parts: ["th-health-gistda-circle"], radius: 3 }),
      cat("osm_hospital", ["osm_hospital"], "#ef4444", "醫院（OSM 補缺，空心）", "Hospital (OSM gap-fill, hollow)", "病院（OSM 補完、中抜き）", { parts: ["th-health-osm-circle"], radius: 4 }),
      cat("osm_clinic", ["osm_clinic"], "#f97316", "診所、牙科（OSM 補缺，空心）", "Clinic / dentist (OSM gap-fill, hollow)", "診療所・歯科（OSM 補完、中抜き）", { parts: ["th-health-osm-circle"], radius: 3 }),
      cat("osm_pharmacy", ["osm_pharmacy"], "#22c55e", "藥局（OSM 補缺，空心）", "Pharmacy (OSM gap-fill, hollow)", "薬局（OSM 補完、中抜き）", { parts: ["th-health-osm-circle"], radius: 3 }),
      cat("osm_other", ["osm_other"], "#94a3b8", "其他（OSM 補缺，空心）", "Other (OSM gap-fill, hollow)", "その他（OSM 補完、中抜き）", { parts: ["th-health-osm-circle"], radius: 3 }),
    ],
    heat: { intensity: 2 },
    title: { props: ["name_th", "name", "name_en"], fallback: l3("醫療院所", "Health facility", "医療機関"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "kind", label: l3("類型（GISTDA，名稱前綴推導）", "Kind (GISTDA, inferred from name prefix)", "種別（GISTDA、名称の接頭辞から推定）"), map: { hospital: l3("醫院", "Hospital", "病院"), other: l3("其他", "Other", "その他") } },
      { prop: "amenity", label: l3("設施類別（OSM）", "Amenity (OSM)", "施設区分（OSM）"), kind: "code" },
      { prop: "healthcare", label: l3("醫療類別（OSM）", "Healthcare (OSM)", "医療区分（OSM）"), kind: "code" },
      { prop: "speciality", label: l3("專科（OSM）", "Speciality (OSM)", "専門（OSM）"), kind: "code" },
      { prop: "operator_type", label: l3("營運型態（OSM）", "Operator type (OSM)", "運営形態（OSM）"), kind: "code" },
      { prop: "tambon_th_src", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("GISTDA 醫療 POI 6,734（無等級欄、類型由名稱推導）＋OSM 補缺 6,747（空心）；兩來源不去重，可能重複計", "6,734 GISTDA health POIs (no tier column, kind inferred from name) + 6,747 OSM gap-fill (hollow); the two sources are not de-duplicated, so points may repeat", "GISTDA 医療 POI 6,734（等級欄なし・種別は名称から推定）＋OSM 補完 6,747（中抜き）。両者は重複排除しておらず重複あり"),
      ZOOM_NOTE(6, "兩來源皆 z6"),
      l3("官方 hcode 名冊未取；รพ.สต. 在 OSM 缺漏；OSM 完整度不均", "Official hcode register not obtained; sub-district health centres are missing in OSM; OSM completeness uneven", "公式 hcode 名簿は未取得。OSM では รพ.สต. が欠落。OSM の網羅性は不均一"),
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("GISTDA Hosted Hospital_POI（授權未明示，存取 2026-11-22）；OSM 補缺 © OpenStreetMap contributors（ODbL），via HOT／HDX", "GISTDA Hosted Hospital_POI (license not stated, accessed 2026-11-22); OSM gap-fill © OpenStreetMap contributors (ODbL), via HOT/HDX", "GISTDA Hosted Hospital_POI（ライセンス未明示、2026-11-22 取得）。OSM 補完 © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: l3("GISTDA 授權未明示；OSM ODbL 1.0", "GISTDA license not stated; OSM ODbL 1.0", "GISTDA ライセンス未明示、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("醫療院所", "health facilities", "医療機関"),
  },
  // ───────────── 執法、司法 ─────────────
  {
    key: "thPoliceStations", file: "th_police_stations.pmtiles", sourceId: "th-police-stations", srcMinzoom: 5, srcMaxzoom: 14, color: "#3b82f6", count: 4_707,
    parts: [pt("th-police-gistda-circle", "gistda", 5, propGetter("unit_kind")), pt("th-police-overture-circle", "overture", 5, propGetter("unit_kind"), { hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") })],
    cats: [
      cat("station", ["station"], "#3b82f6", "警察局（station；GISTDA 實心 731／Overture 空心 2,249）", "Police station (GISTDA solid 731 / Overture hollow 2,249)", "警察署（GISTDA 塗り 731／Overture 中抜き 2,249）", { radius: 4.5 }),
      cat("post", ["post"], "#60a5fa", "派出所、哨所（post；79／92）", "Police post (79 / 92)", "派出所（post、79／92）", { radius: 3.5 }),
      cat("police_other", ["other"], "#94a3b8", "其他警察單位（589／967）", "Other police units (589 / 967)", "その他の警察組織（589／967）", { radius: 3 }),
    ],
    defaultCats: ["station"],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("警察據點", "Police unit", "警察施設"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "unit_kind", label: l3("單位類型", "Unit kind", "組織種別"), map: { station: l3("警察局", "Station", "警察署"), post: l3("派出所、哨所", "Post", "派出所"), other: l3("其他", "Other", "その他") } },
      { prop: "branch_th", label: l3("所屬（泰文）", "Branch (Thai)", "所属（タイ語）") },
      { prop: "location_th", label: l3("位置（泰文，GISTDA）", "Location (Thai, GISTDA)", "所在（タイ語、GISTDA）") },
      ...OVERTURE_FIELDS.filter((f) => f.prop !== "category"), ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("GISTDA 警察據點 1,399（22/77 府）＋Overture 補缺 3,308（77/77 府，空心）；預設只顯示警察局（station），其餘在類別篩選", "1,399 GISTDA police units (22/77 provinces) + 3,308 Overture gap-fill (77/77, hollow); stations only by default, others in the category filter", "GISTDA 警察施設 1,399（22/77 県）＋Overture 補完 3,308（77/77 県、中抜き）。既定は警察署のみ、他はカテゴリ絞り込み"),
      l3("RTP 全國名冊未涵蓋；兩來源不去重", "The RTP national register is not covered; the two sources are not de-duplicated", "RTP 全国名簿は未収録。両者は重複排除していない"),
      OVERTURE_NOTE,
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("GISTDA Hosted 12_police（授權未明示，存取 2026-11-22）；Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）補缺", "GISTDA Hosted 12_police (license not stated, accessed 2026-11-22); Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0) gap-fill", "GISTDA Hosted 12_police（ライセンス未明示、2026-11-22 取得）、Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）補完"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: l3("GISTDA 授權未明示；Overture CDLA-Permissive-2.0", "GISTDA license not stated; Overture CDLA-Permissive-2.0", "GISTDA ライセンス未明示、Overture CDLA-Permissive-2.0"), fetchedAt: FETCHED,
    loading: loading("警察據點", "police stations", "警察施設"),
  },
  {
    key: "thJailsCourts", file: "th_jails_courts.pmtiles", sourceId: "th-jails-courts", srcMinzoom: 5, srcMaxzoom: 14, color: "#ef4444", count: 433,
    parts: [pt("th-prisons-circle", "doc_prisons", 5, constGetter("prison")), pt("th-courthouses-circle", "overture_courthouse", 5, constGetter("courthouse"), { hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") })],
    cats: [
      cat("prison", ["prison"], "#ef4444", "監所（DOC，142）", "Prison (DOC, 142)", "刑事施設（DOC、142）", { parts: ["th-prisons-circle"], radius: 5 }),
      cat("courthouse", ["courthouse"], "#a78bfa", "法院（Overture 補缺，空心，291）", "Courthouse (Overture gap-fill, hollow, 291)", "裁判所（Overture 補完、中抜き、291）", { parts: ["th-courthouses-circle"], radius: 4.5 }),
    ],
    title: { props: ["name_th", "name"], fallback: l3("監所、法院", "Prison / courthouse", "刑事施設・裁判所") },
    fields: [{ prop: "name_en", label: l3("英文名稱", "English name", "英語名") }, { prop: "postcode", label: l3("郵遞區號", "Postcode", "郵便番号"), kind: "code" }, ...OVERTURE_FIELDS.filter((f) => ["locality", "confidence", "datasets"].includes(f.prop)), ...PROVINCE_FIELDS],
    legendNotes: [
      l3("DOC 監所 142 處；法院為 Overture 補缺 291（非 COJ 官方名冊）", "142 DOC prisons; courthouses are 291 Overture gap-fill (not the official COJ register)", "DOC 刑事施設 142。裁判所は Overture 補完 291（COJ 公式名簿ではない）"),
      l3("COJ 277 名單無座標、檢察署未做", "COJ's 277-court list has no coordinates; prosecution offices not done", "COJ の 277 件の一覧は座標なし、検察庁は未対応"),
      OVERTURE_NOTE,
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("กรมราชทัณฑ์（DOC）監所（授權未明示，存取 2026-11-22）；Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）法院補缺", "Department of Corrections (DOC) prisons (license not stated, accessed 2026-11-22); Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0) courthouses", "矯正局（DOC）刑事施設（ライセンス未明示、2026-11-22 取得）、Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）裁判所"),
    sourceUrl: "https://www.correct.go.th/", license: l3("DOC 授權未明示；Overture CDLA-Permissive-2.0", "DOC license not stated; Overture CDLA-Permissive-2.0", "DOC ライセンス未明示、Overture CDLA-Permissive-2.0"), fetchedAt: FETCHED,
    loading: loading("監所與法院", "prisons and courthouses", "刑事施設と裁判所"),
  },
  // ───────────── 觀光、自然 ─────────────
  {
    key: "thNatureSpots", file: "th_nature_spots.pmtiles", sourceId: "th-nature-spots", srcMinzoom: 5, srcMaxzoom: 14, color: "#22c55e", count: 11_477,
    parts: [
      pt("th-nature-moc-circle", "moc_natural", 5, constGetter("moc"), { small: true }),
      pt("th-nature-osm-circle", "osm_attractions", 7, propGetter("tourism"), { small: true, hollow: HOLLOW("空心：OSM／Overture 補缺", "Hollow: OSM / Overture gap-fill", "中抜き：OSM／Overture 補完") }),
      pt("th-nature-overture-circle", "overture_nature", 9, propGetter("category"), { small: true, hollow: HOLLOW("空心：OSM／Overture 補缺", "Hollow: OSM / Overture gap-fill", "中抜き：OSM／Overture 補完") }),
    ],
    cats: [
      cat("moc", ["moc"], "#22c55e", "自然景點（MOC 官方，573）", "Natural attractions (MOC official, 573)", "自然観光地（MOC 公式、573）", { parts: ["th-nature-moc-circle"], radius: 4.5 }),
      cat("attraction", ["attraction"], "#4ade80", "景點（OSM 補缺，空心，3,648；z7 起）", "Attraction (OSM gap-fill, hollow, 3,648; from z7)", "観光地（OSM 補完、中抜き、3,648、z7 以上）", { parts: ["th-nature-osm-circle"], radius: 3 }),
      cat("viewpoint", ["viewpoint"], "#facc15", "觀景點（OSM 補缺，空心，2,247）", "Viewpoint (OSM gap-fill, hollow, 2,247)", "展望地（OSM 補完、中抜き、2,247）", { parts: ["th-nature-osm-circle"], radius: 3 }),
      cat("waterfall", ["waterfall"], "#38bdf8", "瀑布（Overture 補缺，空心，874；z9 起）", "Waterfall (Overture gap-fill, hollow, 874; from z9)", "滝（Overture 補完、中抜き、874、z9 以上）", { parts: ["th-nature-overture-circle"], radius: 3 }),
      cat("cave", ["cave"], "#a78bfa", "洞穴（Overture 補缺，空心，183）", "Cave (Overture gap-fill, hollow, 183)", "洞窟（Overture 補完、中抜き、183）", { parts: ["th-nature-overture-circle"], radius: 3 }),
      cat("beach", ["beach"], "#fbbf24", "海灘（Overture 補缺，空心，3,952）", "Beach (Overture gap-fill, hollow, 3,952)", "ビーチ（Overture 補完、中抜き、3,952）", { parts: ["th-nature-overture-circle"], radius: 3 }),
    ],
    defaultCats: ["moc", "attraction", "viewpoint", "waterfall", "cave"],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("自然景點", "Nature spot", "自然スポット"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "main_category_th", label: l3("大類（泰文，MOC）", "Main category (Thai, MOC)", "大分類（タイ語、MOC）") },
      { prop: "sub_category_th", label: l3("小類（泰文，MOC）", "Sub-category (Thai, MOC)", "小分類（タイ語、MOC）") },
      { prop: "tag_th", label: l3("標籤（泰文，MOC）", "Tags (Thai, MOC)", "タグ（タイ語、MOC）") },
      { prop: "tourism", label: l3("類型（OSM tourism）", "Type (OSM tourism)", "種別（OSM tourism）"), kind: "code" },
      { prop: "opening_hours", label: l3("營業時間（OSM 原文）", "Opening hours (OSM tag)", "営業時間（OSM 原文）"), kind: "code" },
      { prop: "category", label: l3("類別（Overture）", "Category (Overture)", "カテゴリ（Overture）"), kind: "code" },
      { prop: "location_th", label: l3("位置（泰文）", "Location (Thai)", "所在（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("MOC 自然景點 573（官方）實心；OSM 景點、觀景點與 Overture 瀑布、洞穴、海灘（空心）為補缺，海灘預設不開（z9 起）", "573 MOC natural attractions solid; OSM attractions/viewpoints and Overture waterfalls/caves/beaches are hollow gap-fill; beaches off by default (from z9)", "MOC 自然観光地 573は塗り。OSM の観光地・展望地と Overture の滝・洞窟・ビーチは中抜きの補完で、ビーチは既定で非表示（z9 以上）"),
      l3("TAT 官方景點需登入，未取；OSM 與 Overture 完整度不均、不去重", "The TAT official list needs a login and was not obtained; OSM and Overture completeness uneven and not de-duplicated", "TAT 公式一覧はログイン必須で未取得。OSM・Overture の網羅性は不均一で重複排除なし"),
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("กระทรวงวัฒนธรรม（MOC）文化入口（CC BY，版本未標）；OSM © OpenStreetMap contributors（ODbL）；Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）", "Ministry of Culture (MOC) portal (CC BY, version not stated); OSM © OpenStreetMap contributors (ODbL); Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0)", "文化省（MOC）ポータル（CC BY、バージョン不明）、OSM © OpenStreetMap contributors（ODbL）、Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）"),
    sourceUrl: "https://gdcatalog.m-culture.go.th/", license: l3("逐來源：MOC CC BY（版本未標）／OSM ODbL／Overture CDLA-Permissive-2.0", "Per source: MOC CC BY (version not stated) / OSM ODbL / Overture CDLA-Permissive-2.0", "出典別：MOC CC BY（バージョン不明）／OSM ODbL／Overture CDLA-Permissive-2.0"), fetchedAt: FETCHED,
    loading: loading("自然景點", "nature spots", "自然スポット"),
  },
  {
    key: "thNationalReservedForests", file: "th_national_reserved_forests.pmtiles", sourceId: "th-national-reserved-forests", srcMinzoom: 4, srcMaxzoom: 12, color: "#16a34a", count: 1_221, opacity: 0.6,
    parts: [fillPart("th-nrf-fill", "nrf", 4, constGetter("nrf"), 0.22), linePart("th-nrf-line", "nrf", 4, constGetter("nrf"), { nrf: [0.6, 1.2] })],
    cats: [cat("nrf", ["nrf"], "#16a34a", "國有保留林（NRF）範圍", "National reserved forest (NRF) extent", "国有保留林（NRF）の範囲")],
    title: { props: ["name_th", "nrf_code"], fallback: l3("國有保留林", "National reserved forest", "国有保留林") },
    fields: [
      { prop: "nrf_code", label: l3("保留林代碼", "NRF code", "保留林コード"), kind: "code" },
      { prop: "area_km2", label: l3("面積（GIS）", "Area (GIS)", "面積（GIS）"), kind: "num", unit: "km²", digits: 1 },
      { prop: "province_th_src", label: l3("府（來源表）", "Province (source)", "県（出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("RFD 國有保留林 1,221 塊（68/77 府）：保留林地，不全是水源保護；只有邊界，林型、林班向量無", "1,221 RFD national reserved forests (68/77 provinces): reserved land, not all watershed protection; boundaries only, no forest-type or compartment vectors", "RFD 国有保留林 1,221 区画（68/77 県）：保留林地で、すべてが水源保護ではない。境界のみで林型・林班のベクターなし"),
      l3("名稱欄多為空；與森林公園、國家公園可能重疊", "The name field is mostly empty; may overlap forest parks and national parks", "名称欄は空が多い。森林公園・国立公園と重なる可能性"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("NGIS／กรมป่าไม้（Royal Forest Department，RFD）國有保留林（授權未明示，存取 2026-11-22）", "NGIS / Royal Forest Department (RFD) national reserved forests (license not stated, accessed 2026-11-22)", "NGIS／Royal Forest Department（RFD）国有保留林（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://ngis.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("國有保留林", "national reserved forests", "国有保留林"),
  },
  {
    key: "thNationalParks", file: "th_national_parks.pmtiles", sourceId: "th-national-parks", srcMinzoom: 4, srcMaxzoom: 12, color: "#15803d", count: 184, opacity: 0.6,
    parts: [
      fillPart("th-parks-fill", "national_park", 4, constGetter("park"), 0.25), linePart("th-parks-line", "national_park", 4, constGetter("park"), { park: [0.8, 1.6] }),
      fillPart("th-sanctuary-fill", "wildlife_sanctuary", 4, constGetter("sanctuary"), 0.25), linePart("th-sanctuary-line", "wildlife_sanctuary", 4, constGetter("sanctuary"), { sanctuary: [0.8, 1.6] }),
    ],
    cats: [
      cat("park", ["park"], "#15803d", "國家公園（126）", "National park (126)", "国立公園（126）", { parts: ["th-parks-fill", "th-parks-line"] }),
      cat("sanctuary", ["sanctuary"], "#ca8a04", "野生動物保護區（58）", "Wildlife sanctuary (58)", "野生生物保護区（58）", { parts: ["th-sanctuary-fill", "th-sanctuary-line"] }),
    ],
    title: { props: ["name_th", "name_en"], fallback: l3("國家公園、保護區", "National park / sanctuary", "国立公園・保護区"), fallbackBy: REDACTED_TITLE },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名") },
      { prop: "type_th", label: l3("類型（泰文原文）", "Type (Thai)", "種別（タイ語）") },
      { prop: "announce_date", label: l3("公告日期", "Announcement date", "告示日"), kind: "code" },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("DNP 國家公園 126、野生動物保護區 58（62/77 府）；含海域部分；非狩獵區與海洋保護區（MPA）未涵蓋", "126 DNP national parks and 58 wildlife sanctuaries (62/77 provinces); includes marine parts; non-hunting areas and marine protected areas (MPA) not covered", "DNP 国立公園 126・野生生物保護区 58（62/77 県）。海域部分を含む。禁猟区・海洋保護区（MPA）は未収録"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("NGIS／กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช（DNP）（授權未明示，存取 2026-11-22）", "NGIS / Department of National Parks, Wildlife and Plant Conservation (DNP) (license not stated, accessed 2026-11-22)", "NGIS／国立公園・野生動植物局（DNP）（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://ngis.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("國家公園與保護區", "national parks and sanctuaries", "国立公園と保護区"),
  },
  {
    key: "thRamsarSites", file: "th_ramsar_sites.pmtiles", sourceId: "th-ramsar-sites", srcMinzoom: 3, srcMaxzoom: 14, color: "#38bdf8", count: 15,
    parts: [pt("th-ramsar-circle", "ramsar", 3, constGetter("ramsar"))],
    cats: [cat("ramsar", ["ramsar"], "#38bdf8", "拉姆薩濕地（代表點，15）", "Ramsar site (representative point, 15)", "ラムサール湿地（代表点、15）", { radius: 6 })],
    title: { props: ["name_th"], fallback: l3("拉姆薩濕地", "Ramsar site", "ラムサール湿地") },
    fields: [
      { prop: "ramsar_no", label: l3("拉姆薩編號", "Ramsar no.", "ラムサール番号"), kind: "code" },
      { prop: "registered_date", label: l3("登錄日", "Registered", "登録日"), kind: "code" },
      { prop: "location_th", label: l3("位置（泰文）", "Location (Thai)", "所在（タイ語）") },
      { prop: "province_th_src", label: l3("府（來源表）", "Province (source)", "県（出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("只有 15 個代表點，沒有邊界（邊界來源 WDPA 為非商用，不取）；涵蓋 12/77 府；Ko Kra 離岸、無府碼", "Only 15 representative points, no boundaries (WDPA boundaries are non-commercial, not used); 12/77 provinces; Ko Kra is offshore with no province code", "代表点 15 のみで境界なし（WDPA 境界は非商用のため不使用）。12/77 県。Ko Kra は沖合で県コードなし"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: "สำนักงานนโยบายและแผนทรัพยากรธรรมชาติและสิ่งแวดล้อม（ONEP）Ramsar 名冊（CC BY，版本未標）", sourceUrl: "https://www.onep.go.th/", license: l3("CC BY（版本未標）", "CC BY (version not stated)", "CC BY（バージョン不明）"), fetchedAt: FETCHED,
    loading: loading("拉姆薩濕地", "Ramsar sites", "ラムサール湿地"),
  },
  {
    key: "thForestParks", file: "th_forest_parks.pmtiles", sourceId: "th-forest-parks", srcMinzoom: 5, srcMaxzoom: 13, color: "#65a30d", count: 109, opacity: 0.6,
    parts: [fillPart("th-forest-parks-fill", "forest_parks", 5, constGetter("forest_park"), 0.3), linePart("th-forest-parks-line", "forest_parks", 5, constGetter("forest_park"), { forest_park: [0.8, 1.6] })],
    cats: [cat("forest_park", ["forest_park"], "#65a30d", "森林公園（109）", "Forest park (109)", "森林公園（109）")],
    title: { props: ["name_th"], fallback: l3("森林公園", "Forest park", "森林公園") },
    fields: [
      { prop: "type_th", label: l3("類型（泰文原文）", "Type (Thai)", "種別（タイ語）") },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("RFD 森林公園 109 處（40/77 府）；與國有保留林可能重疊（未做重疊檢查）", "109 RFD forest parks (40/77 provinces); may overlap national reserved forests (overlap not checked)", "RFD 森林公園 109（40/77 県）。国有保留林と重なる可能性（重複チェック未実施）"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("NGIS／กรมป่าไม้（RFD）森林公園（授權未明示，存取 2026-11-22）", "NGIS / Royal Forest Department (RFD) forest parks (license not stated, accessed 2026-11-22)", "NGIS／Royal Forest Department（RFD）森林公園（ライセンス未明示、2026-11-22 取得）"), sourceUrl: "https://ngis.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("森林公園", "forest parks", "森林公園"),
  },
  // ───────────── 文化 ─────────────
  {
    key: "thMuseumsLibraries", file: "th_museums_libraries.pmtiles", sourceId: "th-museums-libraries", srcMinzoom: 5, srcMaxzoom: 14, color: "#e879f9", count: 1_734,
    parts: [
      pt("th-moc-museums-circle", "moc_museums", 5, constGetter("moc_museum")), pt("th-moc-libraries-circle", "moc_libraries", 6, constGetter("moc_library")),
      pt("th-osm-museums-circle", "osm_museums", 6, constGetter("osm_museum"), { hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") }),
      pt("th-osm-libraries-circle", "osm_libraries", 7, constGetter("osm_library"), { hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") }),
    ],
    cats: [
      cat("moc_museum", ["moc_museum"], "#e879f9", "博物館（MOC 官方，503）", "Museum (MOC official, 503)", "博物館（MOC 公式、503）", { parts: ["th-moc-museums-circle"], radius: 4.5 }),
      cat("moc_library", ["moc_library"], "#38bdf8", "圖書館（MOC 官方，319）", "Library (MOC official, 319)", "図書館（MOC 公式、319）", { parts: ["th-moc-libraries-circle"], radius: 4 }),
      cat("osm_museum", ["osm_museum"], "#e879f9", "博物館（OSM 補缺，空心，606）", "Museum (OSM gap-fill, hollow, 606)", "博物館（OSM 補完、中抜き、606）", { parts: ["th-osm-museums-circle"], radius: 3.5 }),
      cat("osm_library", ["osm_library"], "#38bdf8", "圖書館（OSM 補缺，空心，306）", "Library (OSM gap-fill, hollow, 306)", "図書館（OSM 補完、中抜き、306）", { parts: ["th-osm-libraries-circle"], radius: 3.5 }),
    ],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("博物館、圖書館", "Museum / library", "博物館・図書館"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "kind", label: l3("類型", "Kind", "種別"), map: { museum: l3("博物館", "Museum", "博物館"), library: l3("圖書館", "Library", "図書館") } },
      { prop: "sub_category_th", label: l3("小類（泰文，MOC）", "Sub-category (Thai, MOC)", "小分類（タイ語、MOC）") },
      { prop: "tag_th", label: l3("標籤（泰文，MOC）", "Tags (Thai, MOC)", "タグ（タイ語、MOC）") },
      { prop: "operator", label: l3("營運者（OSM）", "Operator (OSM)", "運営者（OSM）") },
      { prop: "location_th", label: l3("位置（泰文）", "Location (Thai)", "所在（タイ語）") },
      { prop: "province_th_src", label: l3("府（來源表）", "Province (source)", "県（出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("MOC 博物館 503、圖書館 319（已去除 319 筆完全重複列；官方）實心＋OSM 補缺 博物館 606、圖書館 306（空心）", "503 MOC museums and 319 libraries (319 exact duplicate rows removed) solid + 606 OSM museums and 306 libraries (hollow gap-fill)", "MOC 博物館 503・図書館 319（完全重複行 319 を除去）は塗り＋OSM 補完 博物館 606・図書館 306（中抜き）"),
      l3("FAD 國立館所、SAC 私人館（無座標）未涵蓋；官方與 OSM 不去重", "FAD national museums and SAC private museums (no coordinates) not covered; official and OSM points are not de-duplicated", "FAD 国立館・SAC 私立館（座標なし）は未収録。公式と OSM は重複排除なし"),
      OSM_NOTE,
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("กระทรวงวัฒนธรรม（MOC）文化入口 vw_*（CC BY，版本未標）；OSM 補缺 © OpenStreetMap contributors（ODbL），via HOT／HDX", "Ministry of Culture (MOC) portal vw_* (CC BY, version not stated); OSM gap-fill © OpenStreetMap contributors (ODbL), via HOT/HDX", "文化省（MOC）ポータル vw_*（CC BY、バージョン不明）、OSM 補完 © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://gdcatalog.m-culture.go.th/", license: l3("MOC CC BY（版本未標）；OSM ODbL 1.0", "MOC CC BY (version not stated); OSM ODbL 1.0", "MOC CC BY（バージョン不明）、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("博物館與圖書館", "museums and libraries", "博物館と図書館"),
  },
  {
    key: "thArtsEvents", file: "th_arts_events.pmtiles", sourceId: "th-arts-events", srcMinzoom: 5, srcMaxzoom: 14, color: "#fbbf24", count: 1_368,
    parts: [pt("th-arts-events-circle", "events", 5, constGetter("event")), pt("th-arts-venues-circle", "venues", 6, propGetter("venue_kind"), { hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") })],
    cats: [
      cat("event", ["event"], "#fbbf24", "歷史活動（MOC，2020–2022，1,114）", "Historical events (MOC, 2020–2022, 1,114)", "過去の催し（MOC、2020–2022、1,114）", { parts: ["th-arts-events-circle"], radius: 3.5 }),
      cat("theatre", ["theatre"], "#f472b6", "劇場（OSM 補缺，空心，97）", "Theatre (OSM gap-fill, hollow, 97)", "劇場（OSM 補完、中抜き、97）", { parts: ["th-arts-venues-circle"], radius: 4 }),
      cat("cinema", ["cinema"], "#a78bfa", "電影院（OSM 補缺，空心，114）", "Cinema (OSM gap-fill, hollow, 114)", "映画館（OSM 補完、中抜き、114）", { parts: ["th-arts-venues-circle"], radius: 4 }),
      cat("arts_centre", ["arts_centre"], "#38bdf8", "藝文中心（OSM 補缺，空心，43）", "Arts centre (OSM gap-fill, hollow, 43)", "アートセンター（OSM 補完、中抜き、43）", { parts: ["th-arts-venues-circle"], radius: 4 }),
    ],
    defaultCats: ["theatre", "cinema", "arts_centre"],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("藝文場館、歷史活動", "Arts venue / past event", "芸術施設・過去の催し") },
    fields: [
      ...NAME_FIELDS,
      { prop: "year", label: l3("活動年份（西元）", "Event year (CE)", "開催年（西暦）"), kind: "year" },
      { prop: "start", label: l3("開始", "Start", "開始"), kind: "code" }, { prop: "end", label: l3("結束", "End", "終了"), kind: "code" },
      { prop: "tags_th", label: l3("標籤（泰文）", "Tags (Thai)", "タグ（タイ語）") },
      { prop: "venue_kind", label: l3("場館類型（OSM）", "Venue kind (OSM)", "施設種別（OSM）"), map: { theatre: l3("劇場", "Theatre", "劇場"), cinema: l3("電影院", "Cinema", "映画館"), arts_centre: l3("藝文中心", "Arts centre", "アートセンター") } },
      { prop: "operator", label: l3("營運者（OSM）", "Operator (OSM)", "運営者（OSM）") },
      { prop: "province_th_src", label: l3("府（來源表）", "Province (source)", "県（出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("活動為 2020–2022 的歷史活動（非當前活動）：預設隱藏，可在類別篩選打開；場館（劇場、電影院、藝文中心）為 OSM 補缺（空心）", "Events are historical, 2020–2022 (not current): hidden by default, enable in the category filter; venues (theatres, cinemas, arts centres) are OSM gap-fill (hollow)", "催しは 2020–2022 年の過去のもの（現在の催しではない）：既定は非表示、カテゴリ絞り込みで表示。施設（劇場・映画館・アートセンター）は OSM 補完（中抜き）"),
      l3("活動表只有 2020–2022；涵蓋 76/77 府", "The event table covers 2020–2022 only; 76/77 provinces", "催し表は 2020–2022 のみ。76/77 県"),
      OSM_NOTE,
    ],
    popupNotes: [{ text: l3("歷史活動（2020–2022），不是當前活動", "Historical event (2020–2022), not a current event", "過去の催し（2020–2022）で、現在の催しではない"), when: (p) => str(p.is_past) === "true" || p.is_past === true }, NEAREST_NOTE],
    sourceOrg: l3("กระทรวงวัฒนธรรม（MOC）藝文活動表（CC BY，版本未標）；場館 © OpenStreetMap contributors（ODbL），via HOT／HDX", "Ministry of Culture (MOC) events table (CC BY, version not stated); venues © OpenStreetMap contributors (ODbL), via HOT/HDX", "文化省（MOC）催し表（CC BY、バージョン不明）、施設 © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://gdcatalog.m-culture.go.th/", license: l3("MOC CC BY（版本未標）；OSM ODbL 1.0", "MOC CC BY (version not stated); OSM ODbL 1.0", "MOC CC BY（バージョン不明）、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("藝文場館與歷史活動", "arts venues and past events", "芸術施設と過去の催し"),
  },
  {
    key: "thHistoricSites", file: "th_historic_sites.pmtiles", sourceId: "th-historic-sites", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 6_306,
    parts: [
      pt("th-historic-parks-circle", "moc_parks", 4, constGetter("moc_park")), pt("th-historic-moc-circle", "moc_sites", 6, constGetter("moc_site"), { small: true }),
      pt("th-historic-osm-circle", "osm_historic", 8, constGetter("osm_historic"), { small: true, hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") }),
    ],
    cats: [
      cat("moc_park", ["moc_park"], "#ef4444", "歷史公園（MOC，9）", "Historical park (MOC, 9)", "歴史公園（MOC、9）", { parts: ["th-historic-parks-circle"], radius: 6.5 }),
      cat("moc_site", ["moc_site"], "#f59e0b", "古蹟（MOC，1,855）", "Historic site (MOC, 1,855)", "史跡（MOC、1,855）", { parts: ["th-historic-moc-circle"], radius: 3.5 }),
      cat("osm_historic", ["osm_historic"], "#fbbf24", "歷史遺跡（OSM 補缺，空心，4,442；z8 起）", "Historic feature (OSM gap-fill, hollow, 4,442; from z8)", "歴史的遺構（OSM 補完、中抜き、4,442、z8 以上）", { parts: ["th-historic-osm-circle"], radius: 3 }),
    ],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("古蹟", "Historic site", "史跡"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "sub_category_th", label: l3("小類（泰文，MOC）", "Sub-category (Thai, MOC)", "小分類（タイ語、MOC）") },
      { prop: "tag_th", label: l3("標籤（泰文，MOC）", "Tags (Thai, MOC)", "タグ（タイ語、MOC）") },
      { prop: "historic", label: l3("遺跡類型（OSM historic）", "Historic type (OSM)", "遺構種別（OSM historic）"), kind: "code" },
      { prop: "heritage", label: l3("遺產等級（OSM）", "Heritage (OSM)", "遺産区分（OSM）"), kind: "code" },
      { prop: "location_th", label: l3("位置（泰文）", "Location (Thai)", "所在（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("MOC 古蹟 1,855＋歷史公園 9（官方）實心；OSM 歷史遺跡 4,442（空心，已排除路旁祠與界石，z8 起）", "1,855 MOC historic sites + 9 historical parks solid; 4,442 OSM historic features (hollow, roadside shrines and boundary stones excluded, from z8)", "MOC 史跡 1,855＋歴史公園 9は塗り。OSM 歴史的遺構 4,442（中抜き、路傍の祠・境界石を除外、z8 以上）"),
      l3("FAD 名冊未取（MOC 古蹟 1,855，盤點估 2,470）", "FAD register not obtained (MOC has 1,855 sites vs an estimated 2,470)", "FAD 名簿は未取得（MOC 史跡 1,855、見積 2,470）"),
      OSM_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("กระทรวงวัฒนธรรม（MOC）文化入口（CC BY，版本未標）；OSM 補缺 © OpenStreetMap contributors（ODbL），via HOT／HDX", "Ministry of Culture (MOC) portal (CC BY, version not stated); OSM gap-fill © OpenStreetMap contributors (ODbL), via HOT/HDX", "文化省（MOC）ポータル（CC BY、バージョン不明）、OSM 補完 © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://gdcatalog.m-culture.go.th/", license: l3("MOC CC BY（版本未標）；OSM ODbL 1.0", "MOC CC BY (version not stated); OSM ODbL 1.0", "MOC CC BY（バージョン不明）、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("古蹟", "historic sites", "史跡"),
  },
  {
    key: "thExperiences", file: "th_experiences.pmtiles", sourceId: "th-experiences", srcMinzoom: 6, srcMaxzoom: 14, color: "#f472b6", count: 1_696,
    parts: [
      pt("th-camps-circle", "osm_camps", 6, constGetter("camp"), { hollow: HOLLOW("空心：OSM／Overture 補缺", "Hollow: OSM / Overture gap-fill", "中抜き：OSM／Overture 補完") }),
      pt("th-attractions-circle", "overture_attractions", 6, propGetter("category"), { hollow: HOLLOW("空心：OSM／Overture 補缺", "Hollow: OSM / Overture gap-fill", "中抜き：OSM／Overture 補完") }),
    ],
    cats: [
      cat("camp", ["camp"], "#22c55e", "露營地（OSM 補缺，空心，569）", "Camp site (OSM gap-fill, hollow, 569)", "キャンプ場（OSM 補完、中抜き、569）", { parts: ["th-camps-circle"], radius: 3.5 }),
      cat("amusement_park", ["amusement_park"], "#f472b6", "遊樂園（Overture 補缺，空心，363）", "Amusement park (Overture gap-fill, hollow, 363)", "遊園地（Overture 補完、中抜き、363）", { parts: ["th-attractions-circle"], radius: 3.5 }),
      cat("water_park", ["water_park"], "#38bdf8", "水上樂園（空心，335）", "Water park (hollow, 335)", "ウォーターパーク（中抜き、335）", { parts: ["th-attractions-circle"], radius: 3.5 }),
      cat("zoo", ["zoo"], "#f59e0b", "動物園（空心，318）", "Zoo (hollow, 318)", "動物園（中抜き、318）", { parts: ["th-attractions-circle"], radius: 3.5 }),
      cat("aquarium", ["aquarium"], "#2dd4bf", "水族館（空心，111）", "Aquarium (hollow, 111)", "水族館（中抜き、111）", { parts: ["th-attractions-circle"], radius: 3.5 }),
    ],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("體驗景點", "Experience", "体験スポット") },
    fields: [
      ...NAME_FIELDS,
      { prop: "category", label: l3("類別（Overture）", "Category (Overture)", "カテゴリ（Overture）"), kind: "code" },
      { prop: "opening_hours", label: l3("營業時間（OSM 原文）", "Opening hours (OSM tag)", "営業時間（OSM 原文）"), kind: "code" },
      { prop: "locality", label: l3("地區", "Locality", "地域") },
      { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("全部為補缺（空心）：OSM 露營地 569＋Overture 遊樂園、水上樂園、動物園、水族館 1,127；無官方名冊；76/77 府", "All gap-fill (hollow): 569 OSM camp sites + 1,127 Overture amusement/water parks, zoos and aquariums; no official register; 76/77 provinces", "すべて補完（中抜き）：OSM キャンプ場 569＋Overture の遊園地・ウォーターパーク・動物園・水族館 1,127。公式名簿なし。76/77 県"),
      l3("Overture campground 不取；筆數為登記數、可能含歇業", "Overture campgrounds not used; counts are registrations and may include closed sites", "Overture の campground は不使用。件数は登録数で閉業を含む可能性"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("OSM © OpenStreetMap contributors（ODbL），via HOT／HDX；Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）", "OSM © OpenStreetMap contributors (ODbL), via HOT/HDX; Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0)", "OSM © OpenStreetMap contributors（ODbL）、HOT／HDX 経由。Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）"),
    sourceUrl: "https://www.openstreetmap.org/copyright", license: l3("OSM ODbL 1.0／Overture CDLA-Permissive-2.0", "OSM ODbL 1.0 / Overture CDLA-Permissive-2.0", "OSM ODbL 1.0／Overture CDLA-Permissive-2.0"), fetchedAt: FETCHED,
    loading: loading("體驗景點", "experiences", "体験スポット"),
  },
  {
    key: "thAccommodation", file: "th_accommodation.pmtiles", sourceId: "th-accommodation", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 26_417,
    parts: [pt("th-accommodation-tat-circle", "tat", 4, constGetter("tat"), { small: true }), pt("th-accommodation-osm-circle", "osm", 4, constGetter("osm"), { small: true, hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") })],
    cats: [
      cat("tat", ["tat"], "#f59e0b", "住宿（TAT 官方名冊，僅含有座標者，9,309）", "Accommodation (TAT official register, only records with coordinates, 9,309)", "宿泊（TAT 公式名簿、座標ありのみ、9,309）", { parts: ["th-accommodation-tat-circle"] }),
      cat("osm", ["osm"], "#fbbf24", "住宿（OSM 補缺，空心，17,108）", "Accommodation (OSM gap-fill, hollow, 17,108)", "宿泊（OSM 補完、中抜き、17,108）", { parts: ["th-accommodation-osm-circle"] }),
    ],
    title: { props: ["name_th", "name_en", "name"], fallback: l3("住宿", "Accommodation", "宿泊施設"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "type_th", label: l3("類型（泰文原文，TAT）", "Type (Thai, TAT)", "種別（タイ語、TAT）") },
      { prop: "tourism", label: l3("類型（OSM tourism）", "Type (OSM tourism)", "種別（OSM tourism）"), kind: "code" },
      { prop: "rooms", label: l3("房數", "Rooms", "客室数"), kind: "num" },
      { prop: "beds", label: l3("床數（OSM）", "Beds (OSM)", "ベッド数（OSM）"), kind: "num" },
      { prop: "star_standard", label: l3("星級／標準（TAT）", "Star / standard (TAT)", "星・基準（TAT）"), kind: "code" },
      { prop: "price_group_th", label: l3("價格帶（泰文，TAT）", "Price group (Thai, TAT)", "価格帯（タイ語、TAT）") },
      { prop: "rate_low_thb", label: l3("最低房價（THB，TAT）", "Lowest rate (THB, TAT)", "最低料金（THB、TAT）"), kind: "num" },
      { prop: "rate_high_thb", label: l3("最高房價（THB，TAT）", "Highest rate (THB, TAT)", "最高料金（THB、TAT）"), kind: "num" },
      { prop: "sha_level", label: l3("SHA 認證等級", "SHA level", "SHA レベル"), kind: "code" },
      { prop: "opening_year_ce", label: l3("開業年（西元）", "Opening year (CE)", "開業年（西暦）"), kind: "year" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("只含有座標者：TAT 名冊 9,309（約 1/3 有座標，17,919 列無座標未 geocode；Open Data Common）＋OSM 補缺 17,108（空心）；聯絡資訊全不輸出", "Only records with coordinates: 9,309 TAT register rows (about one third have coordinates; 17,919 rows without coordinates were not geocoded; Open Data Common) + 17,108 OSM gap-fill (hollow); no contact details output", "座標のあるもののみ：TAT 名簿 9,309（約 1/3 が座標あり、座標なし 17,919 行は未ジオコード、Open Data Common）＋OSM 補完 17,108（中抜き）。連絡先は出力しない"),
      l3("依規模分級出現：5 星或 ≥300 房的大型旅館 z4 起、4 星或 ≥150 房 z5、3 星或 ≥60 房 z6，其餘 TAT z7、OSM z8；低縮放直接畫分級點、不用熱區", "Shown by tier: 5-star or ≥300-room hotels from z4, 4-star or ≥150 rooms z5, 3-star or ≥60 rooms z6, the rest TAT z7 / OSM z8; points are drawn directly at low zoom, no heat", "規模別に表示：5 つ星または 300 室以上は z4 以上、4 つ星または 150 室以上は z5、3 つ星または 60 室以上は z6、他は TAT z7・OSM z8。低ズームでは分級した点を直接表示（ヒートなし）"),
      l3("Overture hotel／resort（6 萬＋）不取；官方與 OSM 不去重", "Overture hotels/resorts (60,000+) not used; official and OSM points not de-duplicated", "Overture の hotel／resort（6 万超）は不使用。公式と OSM は重複排除なし"),
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("TAT（การท่องเที่ยวแห่งประเทศไทย）住宿名冊（Open Data Common）；OSM 補缺 © OpenStreetMap contributors（ODbL），via HOT／HDX", "Tourism Authority of Thailand (TAT) accommodation register (Open Data Common); OSM gap-fill © OpenStreetMap contributors (ODbL), via HOT/HDX", "タイ国政府観光庁（TAT）宿泊名簿（Open Data Common）、OSM 補完 © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://datacatalog.tat.or.th/", license: l3("TAT Open Data Common；OSM ODbL 1.0", "TAT Open Data Common; OSM ODbL 1.0", "TAT Open Data Common、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("住宿", "accommodation", "宿泊施設"),
  },
  // ───────────── 基礎建設、宗教 ─────────────
  {
    key: "thBanks", file: "th_banks.pmtiles", sourceId: "th-banks", srcMinzoom: 7, srcMaxzoom: 14, color: "#3b82f6", count: 14_652,
    parts: [
      pt("th-banks-overture-circle", "overture_banks", 7, constGetter("bank_overture"), { small: true }),
      pt("th-banks-osm-circle", "osm_banks", 7, constGetter("bank_osm"), { small: true, hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") }),
      pt("th-atms-osm-circle", "osm_atms", 8, constGetter("atm"), { small: true, hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") }),
    ],
    cats: [
      cat("bank_overture", ["bank_overture"], "#3b82f6", "銀行分行（Overture，非官方，8,637）", "Bank branch (Overture, unofficial, 8,637)", "銀行支店（Overture、非公式、8,637）", { parts: ["th-banks-overture-circle"] }),
      cat("bank_osm", ["bank_osm"], "#60a5fa", "銀行（OSM 補缺，空心，2,644）", "Bank (OSM gap-fill, hollow, 2,644)", "銀行（OSM 補完、中抜き、2,644）", { parts: ["th-banks-osm-circle"] }),
      cat("atm", ["atm"], "#22c55e", "ATM（OSM 補缺，空心，3,371；z8 起，完整度不均）", "ATM (OSM gap-fill, hollow, 3,371; from z8, uneven completeness)", "ATM（OSM 補完、中抜き、3,371、z8 以上、網羅性は不均一）", { parts: ["th-atms-osm-circle"] }),
    ],
    defaultCats: ["bank_overture", "bank_osm"],
    heat: { intensity: 2.5 },
    title: { props: ["name_th", "name", "name_en"], fallback: l3("銀行、ATM", "Bank / ATM", "銀行・ATM") },
    fields: [
      ...NAME_FIELDS,
      { prop: "brand", label: l3("品牌（Overture）", "Brand (Overture)", "ブランド（Overture）") },
      { prop: "operator", label: l3("營運者（OSM）", "Operator (OSM)", "運営者（OSM）") },
      { prop: "network", label: l3("ATM 網路（OSM）", "ATM network (OSM)", "ATM ネットワーク（OSM）") },
      { prop: "locality", label: l3("地區", "Locality", "地域") },
      { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("無官方名冊：Overture 補缺銀行分行 8,637 ＋ OSM 銀行 2,644（空心）；ATM（OSM，3,371）預設不開；證券期貨、保險、外幣經辦局未涵蓋", "No official register: 8,637 Overture gap-fill bank branches + 2,644 OSM banks (hollow); ATMs (OSM, 3,371) off by default; securities, insurance and FX offices not covered", "公式名簿なし：Overture 補完の銀行支店 8,637＋OSM 銀行 2,644（中抜き）。ATM（OSM、3,371）は既定で非表示。証券・保険・両替は未収録"),
      ZOOM_NOTE(7, "銀行 z7、ATM z8"),
      OVERTURE_NOTE,
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）；OSM © OpenStreetMap contributors（ODbL），via HOT／HDX", "Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0); OSM © OpenStreetMap contributors (ODbL), via HOT/HDX", "Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）、OSM © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://overturemaps.org/", license: l3("Overture CDLA-Permissive-2.0；OSM ODbL 1.0", "Overture CDLA-Permissive-2.0; OSM ODbL 1.0", "Overture CDLA-Permissive-2.0、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("銀行與 ATM", "banks and ATMs", "銀行と ATM"),
  },
  {
    key: "thPlacesOfWorship", file: "th_places_of_worship.pmtiles", sourceId: "th-places-of-worship", srcMinzoom: 7, srcMaxzoom: 14, color: "#fbbf24", count: 109_360,
    parts: [
      pt("th-worship-moc-circle", "moc_official", 7, matchGetter("religion_guess", { buddhist: ["buddhist"], muslim: ["muslim"], christian: ["christian"], chinese_shrine: ["chinese_shrine"] }, "worship_other"), { small: true }),
      pt("th-worship-osm-circle", "osm_hot", 8, constGetter("osm"), { small: true, hollow: HOLLOW("空心：OSM／Overture 補缺（非官方）", "Hollow: OSM / Overture gap-fill (unofficial)", "中抜き：OSM／Overture 補完（非公式）") }),
      pt("th-worship-overture-circle", "overture", 9, constGetter("overture"), { small: true, hollow: HOLLOW("空心：OSM／Overture 補缺（非官方）", "Hollow: OSM / Overture gap-fill (unofficial)", "中抜き：OSM／Overture 補完（非公式）") }),
    ],
    cats: [
      cat("buddhist", ["buddhist"], "#fbbf24", "佛寺（MOC 名稱推導，10,337）", "Buddhist temple (MOC, inferred from name, 10,337)", "仏教寺院（MOC、名称から推定、10,337）", { parts: ["th-worship-moc-circle"] }),
      cat("muslim", ["muslim"], "#22c55e", "清真寺（名稱推導，836）", "Mosque (inferred from name, 836)", "モスク（名称から推定、836）", { parts: ["th-worship-moc-circle"] }),
      cat("christian", ["christian"], "#38bdf8", "教堂（名稱推導，130）", "Church (inferred from name, 130)", "教会（名称から推定、130）", { parts: ["th-worship-moc-circle"] }),
      cat("chinese_shrine", ["chinese_shrine"], "#ef4444", "中式神祠（名稱推導，254）", "Chinese shrine (inferred from name, 254)", "中国式祠（名称から推定、254）", { parts: ["th-worship-moc-circle"] }),
      cat("worship_other", ["worship_other"], "#94a3b8", "其他、未判定（名稱推導，705）", "Other / undetermined (inferred from name, 705)", "その他・判定不能（名称から推定、705）", { parts: ["th-worship-moc-circle"] }),
      cat("osm", ["osm"], "#fcd34d", "OSM 補缺宗教場所（空心，26,657；z8 起）", "OSM gap-fill places of worship (hollow, 26,657; from z8)", "OSM 補完の宗教施設（中抜き、26,657、z8 以上）", { parts: ["th-worship-osm-circle"] }),
      cat("overture", ["overture"], "#fde68a", "Overture 補缺宗教場所（空心，70,441；z9 起）", "Overture gap-fill places of worship (hollow, 70,441; from z9)", "Overture 補完の宗教施設（中抜き、70,441、z9 以上）", { parts: ["th-worship-overture-circle"] }),
    ],
    defaultCats: ["buddhist", "muslim", "christian", "chinese_shrine", "worship_other"],
    heat: { intensity: 4 },
    title: { props: ["name_th", "name", "name_en"], fallback: l3("宗教場所", "Place of worship", "宗教施設"), fallbackBy: REDACTED_TITLE },
    fields: [
      ...NAME_FIELDS,
      { prop: "religion_guess", label: l3("宗教別（由名稱推導，MOC）", "Religion (inferred from name, MOC)", "宗教（名称から推定、MOC）"), map: { buddhist: l3("佛教", "Buddhist", "仏教"), muslim: l3("伊斯蘭", "Muslim", "イスラム"), chinese_shrine: l3("中式神祠", "Chinese shrine", "中国式祠"), christian: l3("基督教", "Christian", "キリスト教"), hindu: l3("印度教", "Hindu", "ヒンドゥー"), sikh: l3("錫克教", "Sikh", "シク"), other: l3("其他", "Other", "その他") } },
      { prop: "religion", label: l3("宗教別（Overture taxonomy）", "Religion (Overture taxonomy)", "宗教（Overture 分類）"), map: { buddhist: l3("佛教", "Buddhist", "仏教"), christian: l3("基督教", "Christian", "キリスト教"), muslim: l3("伊斯蘭", "Muslim", "イスラム"), hindu: l3("印度教", "Hindu", "ヒンドゥー"), sikh: l3("錫克教", "Sikh", "シク") } },
      { prop: "tag_th", label: l3("標籤（泰文，MOC）", "Tags (Thai, MOC)", "タグ（タイ語、MOC）") },
      { prop: "operator", label: l3("營運者（OSM）", "Operator (OSM)", "運営者（OSM）") },
      { prop: "category", label: l3("類別（Overture）", "Category (Overture)", "カテゴリ（Overture）"), kind: "code" },
      { prop: "locality", label: l3("地區", "Locality", "地域") },
      { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
      { prop: "location_th", label: l3("位置（泰文，MOC）", "Location (Thai, MOC)", "所在（タイ語、MOC）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("Overture／OSM 補缺，不是官方寺院名冊（官方僧寺約 4.4 萬）：MOC 宗教場所 12,262（實心）預設顯示；OSM 26,657、Overture 70,441（空心）預設不開", "Overture/OSM gap-fill, NOT an official temple register (official monasteries about 44,000): 12,262 MOC places (solid) shown by default; 26,657 OSM and 70,441 Overture (hollow) off by default", "Overture／OSM 補完で、公式の寺院名簿ではない（公式の僧院は約 4.4 万）：MOC 宗教施設 12,262（塗り）を既定表示。OSM 26,657・Overture 70,441（中抜き）は既定で非表示"),
      l3("MOC 宗教別由名稱推導（佛教 10,337、伊斯蘭 836、中式神祠 254…），不是官方登記", "MOC religion is inferred from names (Buddhist 10,337, Muslim 836, Chinese shrine 254…), not an official registration", "MOC の宗教は名称からの推定（仏教 10,337・イスラム 836・中国式祠 254…）で、公式登録ではない"),
      ZOOM_NOTE(7, "MOC z7、OSM z8、Overture z9"),
      l3("DRA 清真寺名冊被擋，未取", "The DRA mosque register was blocked and not obtained", "DRA モスク名簿はアクセス不可で未取得"),
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("กระทรวงวัฒนธรรม（MOC）religious_place（CC BY，版本未標）；OSM © OpenStreetMap contributors（ODbL）；Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）補缺", "Ministry of Culture (MOC) religious_place (CC BY, version not stated); OSM © OpenStreetMap contributors (ODbL); Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0) gap-fill", "文化省（MOC）religious_place（CC BY、バージョン不明）、OSM © OpenStreetMap contributors（ODbL）、Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）補完"),
    sourceUrl: "https://gdcatalog.m-culture.go.th/", license: l3("逐來源：MOC CC BY（版本未標）／OSM ODbL／Overture CDLA-Permissive-2.0", "Per source: MOC CC BY (version not stated) / OSM ODbL / Overture CDLA-Permissive-2.0", "出典別：MOC CC BY（バージョン不明）／OSM ODbL／Overture CDLA-Permissive-2.0"), fetchedAt: FETCHED,
    loading: loading("宗教場所", "places of worship", "宗教施設"),
  },
  {
    key: "thPostOffices", file: "th_post_offices.pmtiles", sourceId: "th-post-offices", srcMinzoom: 6, srcMaxzoom: 14, color: "#ef4444", count: 2_874,
    parts: [pt("th-post-overture-circle", "overture", 6, constGetter("post_overture")), pt("th-post-osm-circle", "osm", 6, constGetter("post_osm"), { hollow: HOLLOW("空心：OSM 補缺", "Hollow: OSM gap-fill", "中抜き：OSM 補完") })],
    cats: [
      cat("post_overture", ["post_overture"], "#ef4444", "郵局（Overture，非官方，2,116）", "Post office (Overture, unofficial, 2,116)", "郵便局（Overture、非公式、2,116）", { parts: ["th-post-overture-circle"], radius: 4 }),
      cat("post_osm", ["post_osm"], "#fb923c", "郵局（OSM 補缺，空心，758）", "Post office (OSM gap-fill, hollow, 758)", "郵便局（OSM 補完、中抜き、758）", { parts: ["th-post-osm-circle"], radius: 3.5 }),
    ],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("郵局", "Post office", "郵便局") },
    fields: [...NAME_FIELDS, { prop: "brand", label: l3("品牌（Overture）", "Brand (Overture)", "ブランド（Overture）") }, { prop: "operator", label: l3("營運者（OSM）", "Operator (OSM)", "運営者（OSM）") }, { prop: "locality", label: l3("地區", "Locality", "地域") }, { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 }, ...PROVINCE_FIELDS],
    legendNotes: [
      l3("Overture 補缺 2,116＋OSM 補缺 758（空心；OSM 74/77 府）；可能含代辦所；MDES 官方 CSV 境外不通，未取", "2,116 Overture gap-fill + 758 OSM gap-fill (hollow; OSM covers 74/77 provinces); may include agency counters; the official MDES CSV is unreachable from abroad and was not obtained", "Overture 補完 2,116＋OSM 補完 758（中抜き、OSM は 74/77 県）。代理店窓口を含む可能性。MDES 公式 CSV は海外から接続できず未取得"),
      OVERTURE_NOTE,
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）；OSM © OpenStreetMap contributors（ODbL），via HOT／HDX", "Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0); OSM © OpenStreetMap contributors (ODbL), via HOT/HDX", "Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）、OSM © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: "https://overturemaps.org/", license: l3("Overture CDLA-Permissive-2.0；OSM ODbL 1.0", "Overture CDLA-Permissive-2.0; OSM ODbL 1.0", "Overture CDLA-Permissive-2.0、OSM ODbL 1.0"), fetchedAt: FETCHED,
    loading: loading("郵局", "post offices", "郵便局"),
  },
];
