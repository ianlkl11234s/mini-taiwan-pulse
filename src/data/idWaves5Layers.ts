/**
 * 印尼第 5–9 波（2026-11-24）規格驅動 26 層（重用菲律賓規格引擎 `usePhDataLayer`）。
 * 資料、授權原句見 taipei-gis-analytics `docs/topic-research/indonesia_opendata/waves/REGISTRY_SPEC.md`。
 * OSM／Overture 層一律在「說明・來源」備註寫明「登記資料，非官方名冊，筆數不可當官方統計」；授權空白來源（BNPB、Imigrasi、TransJakarta、BMKG）標「授權未明示」。
 * 本檔只 import 型別與 idWavesLayers 的小工具（idDataLayers 會 spread 本檔）。
 */
import type { IdLayerSpec } from "./idWavesLayers";
import { BNPB_URL, KAB_FIELDS, plain, NEAREST, ODBL, OSM_HOT, OSM_URL, OVERTURE_URL, POLY, PT, REDACT_TITLE, UNSTATED, cat, constGetter, l3, point, propGetter, str } from "./idWavesLayers";
import type { L3, PhCat, PhCatGetter, PhField, PhPart } from "./intlLayerShared";

export const ID_FETCHED_AT_W5 = "2026-11-24";
const F = ID_FETCHED_AT_W5;
const OSM_REG = l3("來自 OpenStreetMap 的登記，非官方名冊，筆數不可當官方統計", "Compiled from OpenStreetMap registrations, not an official register; counts must not be used as official statistics", "OpenStreetMap の登録に基づき、公式名簿ではない。件数を公式統計として使わないこと");
const OVT_REG = l3("來自 Overture Maps（彙整 Meta、Foursquare 等）的登記，非官方名冊，筆數不可當官方統計", "Compiled from Overture Maps (Meta, Foursquare etc.) registrations, not an official register; counts must not be used as official statistics", "Overture Maps（Meta・Foursquare 等）の登録に基づき、公式名簿ではない。件数を公式統計として使わないこと");
const OSM_OVT = l3("© OpenStreetMap contributors（ODbL），via Overture Maps Foundation（release 2026-11-18.0）", "© OpenStreetMap contributors (ODbL), via Overture Maps Foundation (release 2026-11-18.0)", "© OpenStreetMap contributors（ODbL）、Overture Maps Foundation 経由（release 2026-11-18.0）");
const OVT_ORG = l3("Overture Maps Foundation places（release 2026-11-18.0）", "Overture Maps Foundation places (release 2026-11-18.0)", "Overture Maps Foundation places（release 2026-11-18.0）");
const CDLA = l3("CDLA-Permissive-2.0（部分來源 CC0／Apache-2.0）", "CDLA-Permissive-2.0 (some sources CC0 / Apache-2.0)", "CDLA-Permissive-2.0（一部の出典は CC0／Apache-2.0）");
const BNPB_ORG = (what: string) => l3(`BNPB（原資料 ${what}），存取 2026-11-24`, `BNPB (original data ${what}), accessed 2026-11-24`, `BNPB（原データ ${what}）、2026-11-24 取得`);
const loading = (zh: string, en: string, ja: string) => l3(`${zh}載入中`, `Loading ${en}`, `${ja}を読み込み中`);
const nameFields: readonly PhField[] = [{ prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" }];
const kindMap = (cats: readonly PhCat[]) => Object.fromEntries(cats.flatMap((c) => c.values.map((v) => [v, plain(c.label)])));
/** 面積：kind area 依大小換 km²／公頃／m²，0 當缺值不顯示（原本 digits 3 讓小公園、球場顯示成「0 km²」） */
const AREA_FIELD: PhField = { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "area" };
const TITLE_PROPS = ["name", "name_en", "name_id"] as const;

interface PoiOpts {
  /** 子圖層 id（字面值：gisClickRegistry 與 lineFillTiers 的契約測試以字面值比對） */
  pid: string;
  key: IdLayerSpec["key"]; file: string; id: string; layer: string; minzoom: number; maxzoom?: number; color: string; count: number;
  cats: readonly PhCat[]; other?: L3; fallback: L3; legend: readonly L3[]; org: string | L3; url: string; license: string | L3; reg: L3; loadingText: L3;
  heat?: number; small?: boolean; nameProps?: readonly string[]; extra?: Partial<IdLayerSpec>; getter?: PhCatGetter; extraFields?: readonly PhField[]; opacity?: number;
}
/** 單一點層（kind 分類）的共同樣板：標題、類別欄、縣市欄、非官方備註。 */
function poi(o: PoiOpts): IdLayerSpec {
  const km = kindMap(o.cats);
  return {
    key: o.key, file: o.file, sourceId: o.id, srcMinzoom: o.minzoom, srcMaxzoom: o.maxzoom ?? 14, color: o.color, count: o.count,
    parts: [point(o.pid, o.layer, o.minzoom, o.getter ?? propGetter("kind"), { small: o.small ?? false })],
    cats: o.cats, ...(o.other ? { otherColor: "#94a3b8", otherLabel: o.other } : {}),
    ...(o.heat ? { heat: { intensity: o.heat } } : {}),
    ...(o.opacity ? { opacity: o.opacity } : {}),
    title: { props: o.nameProps ?? TITLE_PROPS, fallback: o.fallback, fallbackBy: { prop: "kind", map: km } },
    fields: [...((o.nameProps ?? TITLE_PROPS).includes("name_en") ? nameFields : []), { prop: "kind", label: l3("類別", "Type", "種別"), map: km }, ...(o.extraFields ?? []), ...KAB_FIELDS],
    legendNotes: o.legend, popupNotes: [NEAREST], sourceNotes: [o.reg],
    sourceOrg: o.org, sourceUrl: o.url, license: o.license, fetchedAt: F, loading: o.loadingText,
    ...o.extra,
  };
}
const OSM = { org: OSM_HOT, url: OSM_URL, license: ODBL, reg: OSM_REG };
const OVT = { org: OVT_ORG, url: OVERTURE_URL, license: CDLA as string | L3, reg: OVT_REG };
const OSM_AREA = { org: OSM_OVT, url: OVERTURE_URL, license: ODBL as string | L3, reg: OSM_REG };

/** 面層樣板（運動場、公園、墓區、養殖池、農地）：fill 單部分，kind 分色。 */
function areas(o: Omit<PoiOpts, "heat" | "small" | "getter"> & { fillOpacity?: number }): IdLayerSpec {
  const km = kindMap(o.cats);
  return {
    key: o.key, file: o.file, sourceId: o.id, srcMinzoom: o.minzoom, srcMaxzoom: o.maxzoom ?? 14, color: o.color, count: o.count, opacity: o.opacity ?? 0.6,
    parts: [{ id: o.pid, sourceLayer: o.layer, geom: "fill", minzoom: o.minzoom, cat: propGetter("kind"), ...(o.fillOpacity ? { fillOpacity: o.fillOpacity } : {}) }],
    cats: o.cats,
    title: { props: o.nameProps ?? TITLE_PROPS, fallback: o.fallback, fallbackBy: { prop: "kind", map: km } },
    fields: [...((o.nameProps ?? TITLE_PROPS).includes("name_en") ? nameFields : []), { prop: "kind", label: l3("類別", "Type", "種別"), map: km }, AREA_FIELD, ...KAB_FIELDS],
    legendNotes: o.legend, popupNotes: [NEAREST], sourceNotes: [o.reg],
    sourceOrg: o.org, sourceUrl: o.url, license: o.license, fetchedAt: F, loading: o.loadingText,
  };
}
const mono = (id: string, color: string, zh: string, en: string, ja: string, radius = 3.5): PhCat[] => [cat(id, [id], color, zh, en, ja, { radius })];

// ─────────── 分類 ───────────
const SCHOOL_CATS: PhCat[] = [
  cat("school", ["school"], "#38bdf8", "學校（52,856）", "School (52,856)", "学校（52,856）", { radius: 2.4 }),
  cat("kindergarten", ["kindergarten"], "#f472b6", "幼兒園（6,979）", "Kindergarten (6,979)", "幼稚園（6,979）", { radius: 2.8 }),
  cat("university", ["university"], "#a78bfa", "大學（1,980）", "University (1,980)", "大学（1,980）", { radius: 3.5 }),
  cat("college", ["college"], "#34d399", "學院、專校（1,268）", "College (1,268)", "カレッジ（1,268）", { radius: 3.2 }),
];
const HEALTH_CATS: PhCat[] = [
  cat("hospital", ["hospital"], "#ef4444", "醫院（4,162）", "Hospital (4,162)", "病院（4,162）", { radius: 3.8 }),
  cat("clinic", ["clinic"], "#f97316", "診所（8,548）", "Clinic (8,548)", "診療所（8,548）", { radius: 2.8 }),
  cat("pharmacy", ["pharmacy"], "#22c55e", "藥局（3,649）", "Pharmacy (3,649)", "薬局（3,649）", { radius: 2.6 }),
  cat("doctors", ["doctors"], "#38bdf8", "醫師診間（1,052）", "Doctor's office (1,052)", "医院・診察室（1,052）", { radius: 2.6 }),
  cat("dentist", ["dentist"], "#a78bfa", "牙醫（587）", "Dentist (587)", "歯科（587）", { radius: 2.6 }),
];
const IMM_CATS: PhCat[] = [
  cat("checkpoint", ["checkpoint"], "#38bdf8", "出入境查驗哨（123；名稱前綴歸類）", "Immigration checkpoint (123; grouped by name prefix)", "出入国検査所（123。名称接頭辞で分類）", { radius: 3 }),
  cat("kanim", ["kanim"], "#ef4444", "移民署辦事處 Kanim（7）", "Immigration office Kanim (7)", "入国管理事務所 Kanim（7）", { radius: 4.5 }),
  cat("kanwil", ["kanwil"], "#f59e0b", "區域辦公室 Kanwil（33）", "Regional office Kanwil (33)", "地方事務所 Kanwil（33）", { radius: 4 }),
  cat("ulp", ["ulp"], "#a78bfa", "服務單位 ULP（12）", "Service unit ULP (12)", "サービスユニット ULP（12）", { radius: 3.5 }),
  cat("other", ["other"], "#94a3b8", "其他（43，含收容所 Rudenim）", "Other (43, incl. detention centres)", "その他（43、収容施設含む）", { radius: 3 }),
];
const IMM_MAP = kindMap(IMM_CATS);
const TJ_CATS: PhCat[] = [
  cat("brt", ["BRT"], "#ef4444", "BRT 幹線（162）", "BRT trunk (162)", "BRT 幹線（162）", { parts: ["id-tj-routes-line"] }),
  cat("mikro", ["Mikrotrans"], "#22c55e", "Mikrotrans 小巴（227）", "Mikrotrans minibus (227)", "Mikrotrans ミニバス（227）", { parts: ["id-tj-routes-line"] }),
  cat("integ", ["Angkutan Umum Integrasi"], "#38bdf8", "整合公共運輸（166）", "Integrated public transport (166)", "統合公共交通（166）", { parts: ["id-tj-routes-line"] }),
  cat("tjbd", ["Transjabodetabek"], "#f59e0b", "Transjabodetabek 都會區（80）", "Transjabodetabek metropolitan (80)", "Transjabodetabek 都市圏（80）", { parts: ["id-tj-routes-line"] }),
  cat("tjother", ["Rusun", "Royaltrans", "Bus Wisata"], "#a78bfa", "Rusun、Royaltrans、觀光巴士（59）", "Rusun, Royaltrans, tour bus (59)", "Rusun・Royaltrans・観光バス（59）", { parts: ["id-tj-routes-line"] }),
  cat("station", ["station"], "#f97316", "站（station）", "Station", "駅（station）", { parts: ["id-tj-stops-circle"], radius: 4 }),
  cat("stop", ["stop"], "#fdba74", "站位（stop；z9 起）", "Stop (from z9)", "停留所（stop。z9 以上）", { parts: ["id-tj-stops-circle"], radius: 2.2 }),
];
const WHEEL_MAP = { "0": l3("來源未標", "Not stated", "記載なし"), "1": l3("可輪椅上下", "Wheelchair accessible", "車いす対応"), "2": l3("不可輪椅上下", "Not wheelchair accessible", "車いす非対応") };
const CULT_CATS: PhCat[] = [
  cat("community_centre", ["community_centre"], "#94a3b8", "社區中心（1,495）", "Community centre (1,495)", "コミュニティセンター（1,495）", { radius: 2.6 }),
  cat("library", ["library"], "#38bdf8", "圖書館（849）", "Library (849)", "図書館（849）", { radius: 3 }),
  cat("museum", ["museum"], "#f472b6", "博物館（745）", "Museum (745)", "博物館（745）", { radius: 3.4 }),
  cat("cinema", ["cinema"], "#f59e0b", "電影院（191）", "Cinema (191)", "映画館（191）", { radius: 3 }),
  cat("gallery", ["gallery"], "#a78bfa", "畫廊（162）", "Gallery (162)", "ギャラリー（162）", { radius: 3 }),
  cat("arts_centre", ["arts_centre"], "#34d399", "藝文中心（158）", "Arts centre (158)", "アートセンター（158）", { radius: 3 }),
  cat("theatre", ["theatre"], "#ef4444", "劇場（155）", "Theatre (155)", "劇場（155）", { radius: 3 }),
];
const WORSHIP_CATS: PhCat[] = [
  cat("muslim", ["muslim"], "#22c55e", "伊斯蘭（46,468）", "Muslim (46,468)", "イスラム教（46,468）", { radius: 2.2 }),
  cat("christian", ["christian", "protestant", "pentecostal", "baptist", "anglican_or_episcopal", "jehovahs_witness"], "#38bdf8", "基督教（新教、五旬節、浸信等；約 29,600）", "Christian (Protestant, Pentecostal, Baptist etc.; ~29,600)", "キリスト教（プロテスタント・ペンテコステ・バプテスト等。約 29,600）", { radius: 2.2 }),
  cat("roman_catholic", ["roman_catholic"], "#a78bfa", "天主教（2,063）", "Roman Catholic (2,063)", "カトリック（2,063）", { radius: 2.4 }),
  cat("hindu", ["hindu"], "#f97316", "印度教（3,055）", "Hindu (3,055)", "ヒンドゥー教（3,055）", { radius: 2.4 }),
  cat("buddhist", ["buddhist"], "#facc15", "佛教（937）", "Buddhist (937)", "仏教（937）", { radius: 2.4 }),
];
const WORSHIP_MAP = { ...kindMap(WORSHIP_CATS), sikh: l3("錫克教", "Sikh", "シク教") };
const HERITAGE_CATS: PhCat[] = [
  cat("memorial", ["monument", "memorial", "wayside_shrine", "wayside_cross", "boundary_stone"], "#f472b6", "紀念碑、紀念物、路邊聖龕界石", "Monument, memorial, wayside shrine, boundary stone", "記念碑・祠・境界石", { radius: 2.8 }),
  cat("ruins", ["archaeological_site", "ruins"], "#f59e0b", "考古遺址、廢墟", "Archaeological site, ruins", "考古遺跡・廃墟", { radius: 3 }),
  cat("fort", ["castle", "fort", "city_gate", "manor"], "#ef4444", "城堡、要塞、城門", "Castle, fort, city gate, manor", "城・要塞・城門", { radius: 3.4 }),
  cat("tomb", ["tomb", "cemetery"], "#94a3b8", "古墓", "Tomb", "古墓", { radius: 2.8 }),
];
const HERITAGE_MAP = { monument: l3("紀念碑", "Monument", "記念碑"), memorial: l3("紀念物", "Memorial", "記念物"), archaeological_site: l3("考古遺址", "Archaeological site", "考古遺跡"), ruins: l3("廢墟", "Ruins", "廃墟"), building: l3("歷史建築", "Historic building", "歴史的建造物"), tomb: l3("古墓", "Tomb", "古墓"), wayside_shrine: l3("路邊聖龕", "Wayside shrine", "路傍の祠"), castle: l3("城堡", "Castle", "城"), boundary_stone: l3("界石", "Boundary stone", "境界石"), city_gate: l3("城門", "City gate", "城門"), manor: l3("莊園", "Manor", "邸宅"), fort: l3("要塞", "Fort", "要塞"), wayside_cross: l3("路邊十字架", "Wayside cross", "路傍の十字架"), church: l3("教堂", "Church", "教会"), cemetery: l3("墓地", "Cemetery", "墓地"), yes: l3("歷史地點（未細分）", "Historic site (unspecified)", "史跡（未分類）") };
const EXP_CATS: PhCat[] = [
  cat("amusement_park", ["amusement_park"], "#f472b6", "遊樂園（982）", "Amusement park (982)", "遊園地（982）", { radius: 3.4 }),
  cat("water_park", ["water_park"], "#38bdf8", "水上樂園（837）", "Water park (837)", "ウォーターパーク（837）", { radius: 3.4 }),
  cat("campground", ["campground"], "#f59e0b", "露營地（834）", "Campground (834)", "キャンプ場（834）", { radius: 3 }),
  cat("aquarium", ["aquarium"], "#2dd4bf", "水族館（240）", "Aquarium (240)", "水族館（240）", { radius: 3.4 }),
  cat("zoo", ["zoo"], "#a3e635", "動物園（121）", "Zoo (121)", "動物園（121）", { radius: 3.4 }),
  cat("rv_park", ["rv_park"], "#a78bfa", "露營車營地（26）", "RV park (26)", "RV パーク（26）", { radius: 3 }),
];
const ACCOM_CATS: PhCat[] = [
  cat("hotel", ["hotel"], "#38bdf8", "飯店（39,189）", "Hotel (39,189)", "ホテル（39,189）", { radius: 2.2 }),
  cat("lodging", ["lodging", "lodge", "inn", "motel", "cabin", "cottage", "service_apartment", "bed_and_breakfast"], "#f59e0b", "旅社、小屋、民宿等（約 21,500）", "Lodging, lodge, inn, B&B etc. (~21,500)", "宿泊施設・ロッジ・民宿等（約 21,500）", { radius: 2.2 }),
  cat("resort", ["resort", "beach_resort"], "#f472b6", "度假村（1,785）", "Resort (1,785)", "リゾート（1,785）", { radius: 3 }),
  cat("hostel", ["hostel", "guest_house"], "#34d399", "青旅、招待所（約 1,100）", "Hostel, guest house (~1,100)", "ホステル・ゲストハウス（約 1,100）", { radius: 2.4 }),
  cat("rental", ["holiday_rental_home"], "#a78bfa", "度假出租屋（3,161）", "Holiday rental home (3,161)", "貸別荘（3,161）", { radius: 2.4 }),
];
const WEATHER_CATS: PhCat[] = [
  cat("ARG", ["ARG"], "#38bdf8", "ARG 自動雨量站（709）", "ARG automatic rain gauge (709)", "ARG 自動雨量計（709）", { radius: 2.8 }),
  cat("AWS", ["AWS"], "#22c55e", "AWS 自動氣象站（403）", "AWS automatic weather station (403)", "AWS 自動気象観測所（403）", { radius: 3.2 }),
  cat("AAWS", ["AAWS"], "#a78bfa", "AAWS 農業氣象站（105）", "AAWS agro weather station (105)", "AAWS 農業気象観測所（105）", { radius: 3.4 }),
];
const SPORT_CATS: PhCat[] = [
  cat("pitch", ["pitch"], "#34d399", "球場、場地（17,072）", "Pitch (17,072)", "競技場・コート（17,072）"),
  cat("stadium", ["stadium"], "#ef4444", "體育場（422）", "Stadium (422)", "スタジアム（422）"),
  cat("recreation_ground", ["recreation_ground"], "#facc15", "遊憩地（752）", "Recreation ground (752)", "レクリエーション用地（752）"),
  cat("track", ["track"], "#38bdf8", "跑道（539）", "Track (539)", "トラック（539）"),
];
const FARM_CATS: PhCat[] = [
  cat("farmland", ["farmland"], "#a3e635", "農地（74,684）", "Farmland (74,684)", "農地（74,684）"),
  cat("orchard", ["orchard"], "#f97316", "果園（16,694）", "Orchard (16,694)", "果樹園（16,694）"),
  cat("farmyard", ["farmyard"], "#facc15", "農場院落（3,706）", "Farmyard (3,706)", "農場敷地（3,706）"),
];
const KEK_CAT: PhCat[] = [cat("kek", ["kek"], "#f59e0b", "經濟特區 KEK（12）", "Special economic zone KEK (12)", "経済特区 KEK（12）", { parts: ["id-kek-fill", "id-kek-line"] })];
const IKN_CATS: PhCat[] = [
  cat("delineasi", ["delineasi"], "#e5e7eb", "IKN 範圍（delineasi）", "IKN extent (delineasi)", "IKN 範囲（delineasi）", { parts: ["id-ikn-delineasi-line", "id-ikn-delineasi-fill"] }),
  cat("rdtr", ["rdtr"], "#38bdf8", "RDTR 詳細空間規劃範圍（4；虛線）", "RDTR detailed spatial plan areas (4; dashed)", "RDTR 詳細空間計画区域（4。破線）", { parts: ["id-ikn-rdtr-line", "id-ikn-rdtr-fill"] }),
  cat("utara", ["bwp_utara"], "#f59e0b", "BWP 北部都會區（1）", "BWP northern urban area (1)", "BWP 北部都市区（1）", { parts: ["id-ikn-utara-fill"] }),
  ...(["A", "B", "C", "D", "E", "F"] as const).map((k, i) => cat(`bwp${k}`, [k], ["#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#a78bfa"][i]!, `BWP 分區 ${k}（共 6 區，名稱見 popup）`, `BWP sub-area ${k} (6 in total; names in popup)`, `BWP 区画 ${k}（全 6 区。名称は popup）`, { parts: ["id-ikn-bwp-fill"] })),
];
const IKN_LAYER_MAP = { delineasi: l3("IKN 範圍", "IKN extent", "IKN 範囲"), rdtr: l3("RDTR 詳細規劃範圍", "RDTR detailed plan area", "RDTR 詳細計画区域"), bwp: l3("BWP 分區", "BWP sub-area", "BWP 区画"), bwp_utara: l3("BWP 北部都會區", "BWP northern urban area", "BWP 北部都市区") };
const fill = (id: string, layer: string, cat: PhCatGetter, minzoom: number, fillOpacity: number): PhPart => ({ id, sourceLayer: layer, geom: "fill", minzoom, cat, fillOpacity });
const FACT_CAT = mono("works", "#a78bfa", "工廠、工場（OSM）", "Factory / works (OSM)", "工場（OSM）", 3);
const CEM_CATS: PhCat[] = [cat("cemetery", ["cemetery", "grave_yard"], "#94a3b8", "墓區範圍（8,052；無個別墓位）", "Cemetery area (8,052; no individual graves)", "墓地の範囲（8,052。個別の墓は含まない）")];
const CEM_MAP = { cemetery: l3("墓地", "Cemetery", "墓地"), grave_yard: l3("教堂墓地", "Graveyard", "教会墓地") };
const PARK_CATS: PhCat[] = [cat("park", ["park"], "#22c55e", "公園（9,241）", "Park (9,241)", "公園（9,241）")];
const AQUA_CATS: PhCat[] = [cat("aquaculture", ["aquaculture"], "#2dd4bf", "養殖池（4,642）", "Aquaculture pond (4,642)", "養殖池（4,642）")];

export const ID_WAVE5_SPECS: readonly IdLayerSpec[] = [
  // ───────── 第 5 波：教育、醫療、消防、警政、監所法院、移民 ─────────
  poi({ key: "idSchools", file: "id_schools.pmtiles", id: "id-schools", pid: "id-schools-circle", layer: "points", minzoom: 7, color: "#38bdf8", count: 63_083, cats: SCHOOL_CATS, heat: 3, small: true,
    fallback: l3("學校", "School", "学校"), legend: [l3("放大至 z7 才顯示；OSM（非官方，官方 Dapodik 未納入）；無名 8,880", "Shown from z7; OSM (unofficial, official Dapodik not included); 8,880 unnamed", "z7 以上で表示。OSM（非公式、公式 Dapodik は未収録）。名称なし 8,880")],
    ...OSM, loadingText: loading("印尼學校", "Indonesia schools", "インドネシアの学校") }),
  poi({ key: "idHealthFacilities", file: "id_health_facilities.pmtiles", id: "id-health", pid: "id-health-circle", layer: "points", minzoom: 6, color: "#ef4444", count: 17_998, cats: HEALTH_CATS, heat: 2, small: true,
    fallback: l3("醫療設施", "Health facility", "医療施設"), legend: [l3("OSM（非官方名冊）；17,998 處，涵蓋縣市 462/514", "OSM (not an official register); 17,998 facilities in 462 of 514 regencies", "OSM（公式名簿ではない）。17,998 件、514 県市中 462")],
    ...OSM, loadingText: loading("印尼醫療設施", "Indonesia health facilities", "インドネシアの医療施設") }),
  poi({ key: "idFireStations", file: "id_fire_stations.pmtiles", id: "id-fire", pid: "id-fire-circle", layer: "points", minzoom: 5, color: "#ef4444", count: 425, cats: mono("fire_station", "#ef4444", "消防站（OSM，425）", "Fire station (OSM, 425)", "消防署（OSM、425）", 4),
    fallback: l3("消防站", "Fire station", "消防署"), legend: [l3("OSM（非官方）；涵蓋 32/38 省、縣市 161/514，未涵蓋處不是沒有消防站", "OSM (unofficial); 32 of 38 provinces, 161 of 514 regencies; uncovered areas are not areas without stations", "OSM（非公式）。38 州中 32・514 県市中 161。未収録は消防署がないという意味ではない")],
    ...OSM, loadingText: loading("印尼消防站", "Indonesia fire stations", "インドネシアの消防署") }),
  poi({ key: "idPoliceStations", file: "id_police_stations.pmtiles", id: "id-police", pid: "id-police-circle", layer: "points", minzoom: 5, color: "#3b82f6", count: 3_236, cats: mono("police", "#3b82f6", "警察機關（OSM，3,236）", "Police station (OSM, 3,236)", "警察署（OSM、3,236）", 3.5),
    fallback: l3("警察機關", "Police station", "警察署"), legend: [l3("OSM（非官方）；涵蓋縣市 427/514", "OSM (unofficial); 427 of 514 regencies", "OSM（非公式）。514 県市中 427")],
    ...OSM, loadingText: loading("印尼警察機關", "Indonesia police stations", "インドネシアの警察署") }),
  poi({ key: "idPrisonsCourts", file: "id_prisons_courts.pmtiles", id: "id-prisons", pid: "id-prisons-circle", layer: "points", minzoom: 5, color: "#a78bfa", count: 594,
    cats: [cat("prison", ["prison"], "#a78bfa", "監所（OSM）", "Prison (OSM)", "刑務所（OSM）", { radius: 4 }), cat("courthouse", ["courthouse"], "#f59e0b", "法院（OSM）", "Courthouse (OSM)", "裁判所（OSM）", { radius: 4 })],
    fallback: l3("監所或法院", "Prison or courthouse", "刑務所・裁判所"), legend: [l3("OSM（非官方）；594 處，涵蓋縣市 226/514", "OSM (unofficial); 594 sites in 226 of 514 regencies", "OSM（非公式）。594 件、514 県市中 226")],
    ...OSM, loadingText: loading("印尼監所與法院", "Indonesia prisons and courts", "インドネシアの刑務所・裁判所") }),
  poi({ nameProps: ["name"], key: "idImmigrationOffices", file: "id_immigration_offices.pmtiles", id: "id-immigration", pid: "id-immigration-circle", layer: "offices", minzoom: 4, color: "#38bdf8", count: 218, cats: IMM_CATS,
    fallback: l3("移民署辦公處", "Immigration office", "入国管理局事務所"), legend: [l3("類別由名稱前綴規則歸類，非官方分類；名稱可能因 2026-10 更名過時；境內有座標 218 筆（404 筆中 163 無座標）", "Types grouped by name prefix, not an official classification; names may be outdated after the 2026-10 renaming; 218 with coordinates in Indonesia (163 of 404 have none)", "種別は名称接頭辞による分類で公式分類ではない。2026-10 の改称で名称が古い可能性。国内で座標あり 218 件（404 件中 163 件は座標なし）")],
    org: l3("Direktorat Jenderal Imigrasi（lokasi kami），存取 2026-11-24", "Directorate General of Immigration (lokasi kami), accessed 2026-11-24", "Direktorat Jenderal Imigrasi（lokasi kami）、2026-11-24 取得"), url: "https://www.imigrasi.go.id/", license: UNSTATED, reg: l3("官方網站名冊，類別為本站歸類；名稱可能過時", "From the agency website; types are our grouping; names may be outdated", "公式サイトの名簿。種別は本サイトの分類で、名称は古い可能性"),
    loadingText: loading("印尼移民署辦公處", "Indonesia immigration offices", "インドネシアの入国管理事務所"), extraFields: [] , extra: { fields: [{ prop: "kind", label: l3("類別（依名稱前綴歸類）", "Type (grouped by name prefix)", "種別（名称接頭辞で分類）"), map: IMM_MAP }, ...KAB_FIELDS] } }),
  // ───────── 第 6 波 ─────────
  {
    key: "idTransjakarta", file: "id_transjakarta.pmtiles", sourceId: "id-transjakarta", srcMinzoom: 8, srcMaxzoom: 15, color: "#ef4444", count: 8_843,
    parts: [
      { id: "id-tj-routes-line", sourceLayer: "routes", geom: "line", minzoom: 8, cat: propGetter("route_desc"), lineWidth: { BRT: [1.4, 2.6], Mikrotrans: [0.8, 1.6], "Angkutan Umum Integrasi": [0.8, 1.6], Transjabodetabek: [1, 2], Rusun: [0.8, 1.6], Royaltrans: [0.8, 1.6], "Bus Wisata": [0.8, 1.6] } },
      point("id-tj-stops-circle", "stops", 9, propGetter("location_type"), { small: true }),
    ],
    cats: TJ_CATS,
    title: { props: ["name", "route_short_name"], fallback: l3("TransJakarta 路線或站位", "TransJakarta route or stop", "TransJakarta 路線・停留所") },
    fields: [
      { prop: "route_long_name", label: l3("路線", "Route", "路線") },
      { prop: "route_desc", label: l3("路線類型", "Route type", "路線種別") },
      { prop: "location_type", label: l3("站型", "Stop type", "停留所種別"), map: { station: l3("站（station）", "Station", "駅"), stop: l3("站位（stop）", "Stop", "停留所") } },
      { prop: "wheelchair_boarding", label: l3("輪椅上下（GTFS 值）", "Wheelchair boarding (GTFS value)", "車いす乗降（GTFS 値）"), map: WHEEL_MAP },
      ...KAB_FIELDS,
    ],
    legendNotes: [
      l3("TransJakarta 靜態 GTFS（2026-11-20）：694 條路線形狀、8,149 站位；無即時資料；僅雅加達都會區（Jabodetabek）", "TransJakarta static GTFS (2026-11-20): 694 route shapes, 8,149 stops; no real-time data; Jakarta metropolitan area only", "TransJakarta 静的 GTFS（2026-11-20）：路線形状 694・停留所 8,149。リアルタイムなし。ジャカルタ首都圏のみ"),
      l3("路線依類型分色（不使用 GTFS 路線色）；放大至 z8 顯示路線、z9 顯示站位", "Routes coloured by type (GTFS route colours not used); routes from z8, stops from z9", "路線は種別で色分け（GTFS の路線色は不使用）。z8 から路線、z9 から停留所"),
    ],
    popupNotes: [NEAREST],
    sourceOrg: l3("PT Transportasi Jakarta，GTFS 靜態，存取 2026-11-24", "PT Transportasi Jakarta, static GTFS, accessed 2026-11-24", "PT Transportasi Jakarta、静的 GTFS、2026-11-24 取得"), sourceUrl: "https://transjakarta.co.id/", license: UNSTATED, fetchedAt: F,
    sourceNotes: [l3("靜態 GTFS，無即時；只涵蓋雅加達都會區", "Static GTFS, no real-time; Jakarta metropolitan area only", "静的 GTFS でリアルタイムなし。ジャカルタ首都圏のみ")],
    loading: loading("雅加達 TransJakarta", "TransJakarta", "TransJakarta"),
  },
  {
    key: "idSpecialEconomicZones", file: "id_special_economic_zones.pmtiles", sourceId: "id-kek", srcMinzoom: 4, srcMaxzoom: 13, color: "#f59e0b", count: 12, opacity: 0.7,
    parts: [
      { id: "id-kek-fill", sourceLayer: "kek", geom: "fill", minzoom: 4, cat: constGetter("kek"), fillOpacity: 0.45, lowZoomHalo: { maxzoom: 8 } },
      { id: "id-kek-line", sourceLayer: "kek", geom: "line", minzoom: 4, cat: constGetter("kek"), lineWidth: { kek: [1, 2] } },
    ],
    cats: KEK_CAT,
    title: { props: ["name"], fallback: l3("經濟特區 KEK", "Special economic zone (KEK)", "経済特区（KEK）") },
    fields: [
      { prop: "activity", label: l3("主要活動（原文）", "Main activities (original)", "主な活動（原文）") },
      { prop: "legal_basis", label: l3("法源（原文）", "Legal basis (original)", "根拠法（原文）") },
      { prop: "kabkota_name", label: l3("縣市", "Regency / city", "県・市") },
      { prop: "province_name", label: l3("省", "Province", "州") },
    ],
    legendNotes: [l3("12 個 KEK（非完整名冊）；面積欄單位未標，不顯示；低縮放以光暈標出位置", "12 KEKs (not a complete register); the area field has no stated unit and is not shown; low zoom shows a halo to mark positions", "KEK 12 件（完全な名簿ではない）。面積欄は単位不明のため非表示。低倍率ではハロで位置を示す")],
    popupNotes: [], sourceOrg: BNPB_ORG("Dewan Nasional KEK"), sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: F,
    sourceNotes: [l3("只有 12 個經濟特區，非完整名冊", "Only 12 zones, not a complete register", "経済特区は 12 件のみで、完全な名簿ではない")],
    loading: loading("印尼經濟特區", "Indonesia special economic zones", "インドネシアの経済特区"),
  },
  poi({ key: "idPostOffices", file: "id_post_offices.pmtiles", id: "id-post", pid: "id-post-circle", layer: "points", minzoom: 5, color: "#f59e0b", count: 1_797, cats: mono("post_office", "#f59e0b", "郵局（OSM，1,797）", "Post office (OSM, 1,797)", "郵便局（OSM、1,797）"),
    fallback: l3("郵局", "Post office", "郵便局"), legend: [l3("OSM（非官方）；涵蓋縣市 342/514", "OSM (unofficial); 342 of 514 regencies", "OSM（非公式）。514 県市中 342")], ...OSM, loadingText: loading("印尼郵局", "Indonesia post offices", "インドネシアの郵便局"),
    getter: constGetter("post_office") }),
  poi({ key: "idMarkets", file: "id_markets.pmtiles", id: "id-markets", pid: "id-markets-circle", layer: "points", minzoom: 6, color: "#a3e635", count: 5_754, cats: mono("marketplace", "#a3e635", "市場（OSM，5,754）", "Marketplace (OSM, 5,754)", "市場（OSM、5,754）"),
    fallback: l3("市場", "Marketplace", "市場"), legend: [l3("OSM（非官方）；涵蓋縣市 415/514", "OSM (unofficial); 415 of 514 regencies", "OSM（非公式）。514 県市中 415")], ...OSM, loadingText: loading("印尼市場", "Indonesia marketplaces", "インドネシアの市場") }),
  {
    ...poi({ key: "idBanks", file: "id_banks.pmtiles", id: "id-banks", pid: "id-banks-circle", layer: "points", minzoom: 6, color: "#38bdf8", count: 14_590, heat: 1.5, small: true,
      cats: [cat("bank", ["bank"], "#38bdf8", "銀行（8,984）", "Bank (8,984)", "銀行（8,984）", { radius: 3 }), cat("atm", ["atm"], "#f59e0b", "ATM（5,606；z8 起）", "ATM (5,606; from z8)", "ATM（5,606。z8 以上）", { radius: 2.4 })],
      fallback: l3("銀行或 ATM", "Bank or ATM", "銀行・ATM"), legend: [l3("OSM（非官方）；銀行 z6 起、ATM z8 起；14,590 處", "OSM (unofficial); banks from z6, ATMs from z8; 14,590 sites", "OSM（非公式）。銀行は z6、ATM は z8 から。14,590 件")], ...OSM, loadingText: loading("印尼銀行與 ATM", "Indonesia banks and ATMs", "インドネシアの銀行・ATM") }),
    parts: [
      point("id-banks-bank-circle", "points", 6, propGetter("kind"), { small: true, filter: ["==", ["get", "kind"], "bank"] }),
      point("id-banks-atm-circle", "points", 8, propGetter("kind"), { small: true, filter: ["==", ["get", "kind"], "atm"] }),
    ],
  },
  poi({ key: "idCulturalFacilities", file: "id_cultural_facilities.pmtiles", id: "id-cultural", pid: "id-cultural-circle", layer: "points", minzoom: 6, color: "#f472b6", count: 3_755, cats: CULT_CATS,
    fallback: l3("文化設施", "Cultural facility", "文化施設"), legend: [l3("OSM（非官方）；涵蓋縣市 347/514", "OSM (unofficial); 347 of 514 regencies", "OSM（非公式）。514 県市中 347")], ...OSM, loadingText: loading("印尼文化設施", "Indonesia cultural facilities", "インドネシアの文化施設") }),
  poi({ key: "idHeritageSites", file: "id_heritage_sites.pmtiles", id: "id-heritage", pid: "id-heritage-circle", layer: "points", minzoom: 6, color: "#f59e0b", count: 4_286, cats: HERITAGE_CATS, other: l3("其他歷史地點（歷史建築、教堂等）", "Other historic sites (buildings, churches etc.)", "その他の史跡（歴史的建造物・教会等）"),
    fallback: l3("歷史與紀念地點", "Heritage or memorial site", "史跡・記念物"),
    legend: [l3("OSM historic 標籤（非官方，不是官方文化資產名冊）", "OSM historic tags (unofficial, not an official heritage register)", "OSM の historic タグ（非公式で公式の文化財名簿ではない）")], ...OSM, loadingText: loading("印尼史跡", "Indonesia heritage sites", "インドネシアの史跡"),
    extra: { fields: [...nameFields, { prop: "kind", label: l3("類別", "Type", "種別"), map: HERITAGE_MAP }, ...KAB_FIELDS], title: { props: TITLE_PROPS, fallback: l3("歷史與紀念地點", "Heritage or memorial site", "史跡・記念物"), fallbackBy: { prop: "kind", map: HERITAGE_MAP } } } }),
  poi({ nameProps: ["name"], key: "idCommTowers", file: "id_comm_towers.pmtiles", id: "id-comm-towers", pid: "id-comm-towers-circle", layer: "points", minzoom: 6, color: "#94a3b8", count: 1_026, cats: mono("communications_tower", "#94a3b8", "通訊塔（OSM，1,026）", "Communications tower (OSM, 1,026)", "通信塔（OSM、1,026）"),
    fallback: l3("通訊塔", "Communications tower", "通信塔"), legend: [l3("OSM（非官方）；不是電信業者基地台名冊", "OSM (unofficial); not an operator cell-site register", "OSM（非公式）。通信事業者の基地局名簿ではない")], ...OSM, loadingText: loading("印尼通訊塔", "Indonesia communications towers", "インドネシアの通信塔"), getter: constGetter("communications_tower") }),
  poi({ nameProps: ["name"], key: "idPlacesOfWorship", file: "id_places_of_worship.pmtiles", id: "id-worship", pid: "id-worship-circle", layer: "points", minzoom: 7, color: "#22c55e", count: 82_202, cats: WORSHIP_CATS, other: l3("其他宗教（錫克教等）", "Other religions (Sikh etc.)", "その他の宗教（シク教等）"), heat: 4, small: true,
    fallback: l3("宗教場所", "Place of worship", "宗教施設"),
    legend: [l3("放大至 z7 才顯示；宗教別是場所分類，不是信徒統計；非官方 SIMAS 名冊", "Shown from z7; the religion is a place category, not a count of believers; not the official SIMAS register", "z7 以上で表示。宗教は場所の分類で信者数ではない。公式 SIMAS 名簿ではない")],
    ...OVT, loadingText: loading("印尼宗教場所", "Indonesia places of worship", "インドネシアの宗教施設"),
    extra: { fields: [{ prop: "kind", label: l3("宗教別（場所分類）", "Religion (place category)", "宗教（場所の分類）"), map: WORSHIP_MAP }, { prop: "locality", label: l3("地區", "Locality", "地域") }, ...KAB_FIELDS], title: { props: ["name"], fallback: l3("宗教場所", "Place of worship", "宗教施設"), fallbackBy: REDACT_TITLE } } }),
  poi({ nameProps: ["name"], key: "idExperiences", file: "id_experiences.pmtiles", id: "id-experiences", pid: "id-experiences-circle", layer: "points", minzoom: 6, color: "#f472b6", count: 3_040, cats: EXP_CATS,
    fallback: l3("遊樂與露營", "Amusement or camping", "遊園地・キャンプ"), legend: [l3("Overture（非官方）；露營地與「營地與山屋」（OSM）部分重疊", "Overture (unofficial); campgrounds partly overlap the OSM 'Campsites & Huts' layer", "Overture（非公式）。キャンプ場は OSM「キャンプ場・山小屋」と一部重複")],
    ...OVT, loadingText: loading("印尼遊樂與露營", "Indonesia amusement and camping", "インドネシアの遊園地・キャンプ"),
    extra: { title: { props: ["name"], fallback: l3("遊樂與露營", "Amusement or camping", "遊園地・キャンプ"), fallbackBy: REDACT_TITLE } } }),
  poi({ nameProps: ["name"], key: "idAccommodation", file: "id_accommodation.pmtiles", id: "id-accommodation", pid: "id-accommodation-circle", layer: "points", minzoom: 7, color: "#38bdf8", count: 67_917, cats: ACCOM_CATS, other: l3("其他住宿", "Other accommodation", "その他の宿泊施設"), heat: 3, small: true,
    fallback: l3("住宿", "Accommodation", "宿泊施設"), legend: [l3("放大至 z7 才顯示；Overture（非官方），67,917 處", "Shown from z7; Overture (unofficial), 67,917 sites", "z7 以上で表示。Overture（非公式）、67,917 件")],
    ...OVT, loadingText: loading("印尼住宿", "Indonesia accommodation", "インドネシアの宿泊施設"),
    extra: { title: { props: ["name"], fallback: l3("住宿", "Accommodation", "宿泊施設"), fallbackBy: REDACT_TITLE } } }),
  // ───────── 第 7 波 ─────────
  poi({ key: "idWeatherStations", file: "id_weather_stations.pmtiles", id: "id-weather", pid: "id-weather-circle", layer: "stations", minzoom: 4, color: "#38bdf8", count: 1_315, cats: WEATHER_CATS, other: l3("其他類型（ASRS、微氣候、土壤、船舶…）", "Other types (ASRS, micro-climate, soil, ship…)", "その他（ASRS・微気候・土壌・船舶…）"),
    fallback: l3("氣象站位", "Weather station", "気象観測所"), legend: [l3("只有站位 metadata，沒有觀測值；BMKG 自動氣象站 1,315 站", "Station metadata only, no observations; 1,315 BMKG automatic stations", "観測所のメタデータのみで観測値はない。BMKG 自動観測所 1,315")],
    org: l3("BMKG 自動氣象站 metadata，存取 2026-11-24", "BMKG automatic weather station metadata, accessed 2026-11-24", "BMKG 自動気象観測所メタデータ、2026-11-24 取得"), url: "https://data.bmkg.go.id/", license: l3("授權未明示（BMKG 須署名）", "License not stated (BMKG attribution required)", "ライセンス未明示（BMKG の出典明記が必要）"),
    reg: l3("只有站位，沒有觀測值；站數不可當氣象站總數", "Station positions only, no observations; the count is not the total of weather stations", "観測所の位置のみで観測値はない。件数は観測所の総数ではない"), loadingText: loading("印尼氣象站位", "Indonesia weather stations", "インドネシアの気象観測所"),
    extra: {
      title: { props: ["name"], fallback: l3("氣象站", "Weather station", "気象観測所") },
      fields: [
        // 縮寫 ARG／AWS／AAWS 補上白話（與圖例同名）；其他類型照原值
        { prop: "station_type", label: l3("類型", "Type", "種別"), map: kindMap(WEATHER_CATS) },
        { prop: "status", label: l3("狀態", "Status", "状態"), map: { operasional: l3("營運中", "Operational", "運用中") } },
        { prop: "elevation_m", label: l3("海拔", "Elevation", "標高"), kind: "num", unit: "m", digits: 0 },
        { prop: "installed", label: l3("安裝日期", "Installed", "設置日") },
        ...KAB_FIELDS,
      ],
    }, getter: propGetter("station_type") }),
  // ───────── 第 8–9 波 ─────────
  poi({ key: "idFactories", file: "id_factories.pmtiles", id: "id-factories", pid: "id-factories-circle", layer: "points", minzoom: 6, color: "#a78bfa", count: 3_048, cats: FACT_CAT,
    fallback: l3("工廠、工場", "Factory or works", "工場"), legend: [l3("OSM（非官方），不等於工業登記名冊；3,048 處", "OSM (unofficial), not an industrial register; 3,048 sites", "OSM（非公式）。工業登録名簿ではない。3,048 件")], ...OSM, loadingText: loading("印尼工廠", "Indonesia factories", "インドネシアの工場"), getter: constGetter("works") }),
  areas({ key: "idSportsVenues", file: "id_sports_venues.pmtiles", id: "id-sports", pid: "id-sports-fill", layer: "areas", minzoom: 8, color: "#34d399", count: 18_785, cats: SPORT_CATS,
    fallback: l3("運動場地", "Sports venue", "運動施設"), legend: [l3("OSM 面（簡化約 10 m）；放大至 z8 才顯示；非官方", "OSM polygons (simplified ~10 m); shown from z8; unofficial", "OSM の面（約 10 m に簡略化）。z8 以上で表示。非公式")], ...OSM_AREA, loadingText: loading("印尼運動場地", "Indonesia sports venues", "インドネシアの運動施設") }),
  areas({ key: "idParks", file: "id_parks.pmtiles", id: "id-parks", pid: "id-parks-fill", layer: "areas", minzoom: 7, color: "#22c55e", count: 9_241, cats: PARK_CATS,
    fallback: l3("公園", "Park", "公園"), legend: [l3("OSM 面（非官方）；放大至 z7 才顯示", "OSM polygons (unofficial); shown from z7", "OSM の面（非公式）。z7 以上で表示")], ...OSM_AREA, loadingText: loading("印尼公園", "Indonesia parks", "インドネシアの公園") }),
  {
    ...areas({ key: "idCemeteries", file: "id_cemeteries.pmtiles", id: "id-cemeteries", pid: "id-cemeteries-fill", layer: "areas", minzoom: 8, color: "#94a3b8", count: 8_052, cats: CEM_CATS, opacity: 0.55,
      fallback: l3("墓區", "Cemetery", "墓地"), legend: [l3("只有墓區範圍，無個別墓位；OSM（非官方）；放大至 z8 才顯示", "Cemetery areas only, no individual graves; OSM (unofficial); shown from z8", "墓地の範囲のみで個別の墓はない。OSM（非公式）。z8 以上で表示")], ...OSM_AREA, loadingText: loading("印尼墓區", "Indonesia cemeteries", "インドネシアの墓地") }),
    fields: [...nameFields, { prop: "kind", label: l3("類別", "Type", "種別"), map: CEM_MAP }, AREA_FIELD, ...KAB_FIELDS],
  },
  areas({ nameProps: ["name", "name_en"], key: "idAquaculture", file: "id_aquaculture.pmtiles", id: "id-aquaculture", pid: "id-aquaculture-fill", layer: "areas", minzoom: 6, color: "#2dd4bf", count: 4_642, cats: AQUA_CATS,
    fallback: l3("養殖池", "Aquaculture pond", "養殖池"), legend: [l3("OSM 面（非官方）；4,642 處", "OSM polygons (unofficial); 4,642 sites", "OSM の面（非公式）。4,642 件")], ...OSM_AREA, loadingText: loading("印尼養殖池", "Indonesia aquaculture ponds", "インドネシアの養殖池") }),
  areas({ key: "idFarmland", file: "id_farmland.pmtiles", id: "id-farmland", pid: "id-farmland-fill", layer: "areas", minzoom: 8, color: "#a3e635", count: 95_084, cats: FARM_CATS, opacity: 0.5,
    fallback: l3("農地", "Farmland", "農地"), legend: [l3("OSM 登記的農地，涵蓋不均，非農地普查；放大至 z8 才顯示", "Farmland registered in OSM, uneven coverage, not an agricultural census; shown from z8", "OSM に登録された農地。網羅性にばらつきがあり、農地センサスではない。z8 以上で表示")], ...OSM_AREA, loadingText: loading("印尼農地", "Indonesia farmland", "インドネシアの農地") }),
  poi({ nameProps: ["name"], key: "idVeterinary", file: "id_veterinary.pmtiles", id: "id-veterinary", pid: "id-veterinary-circle", layer: "points", minzoom: 5, color: "#34d399", count: 763, cats: mono("veterinarian", "#34d399", "獸醫院（Overture，763）", "Veterinary clinic (Overture, 763)", "動物病院（Overture、763）", 3.5),
    fallback: l3("獸醫院", "Veterinary clinic", "動物病院"), legend: [l3("Overture 補缺（非官方）", "Overture gap-fill (unofficial)", "Overture 補完（非公式）")], ...OVT, loadingText: loading("印尼獸醫院", "Indonesia veterinary clinics", "インドネシアの動物病院"), getter: constGetter("veterinarian"),
    extra: { title: { props: ["name"], fallback: l3("獸醫院", "Veterinary clinic", "動物病院"), fallbackBy: REDACT_TITLE } } }),
  {
    key: "idIkn", file: "id_ikn.pmtiles", sourceId: "id-ikn", srcMinzoom: 5, srcMaxzoom: 14, color: "#e5e7eb", count: 12, opacity: 0.7,
    // 四個互相重疊的範圍：由大到小疊（delineasi 外框→RDTR 虛線框→BWP 北部→BWP 六分區），小範圍的填色在最上面；
    // 點擊依 gisClickRegistry 順序（BWP 先、delineasi 最後）取最具體者。外框與虛線框的面透明度 0，只當點擊熱區。
    parts: [
      fill("id-ikn-delineasi-fill", "delineasi", constGetter("delineasi"), 5, 0),
      { id: "id-ikn-delineasi-line", sourceLayer: "delineasi", geom: "line", minzoom: 5, cat: constGetter("delineasi"), lineWidth: { delineasi: [1.5, 2.5] } },
      fill("id-ikn-rdtr-fill", "rdtr", constGetter("rdtr"), 5, 0),
      { id: "id-ikn-rdtr-line", sourceLayer: "rdtr", geom: "line", minzoom: 5, cat: constGetter("rdtr"), dashed: true, lineWidth: { rdtr: [1, 2] } },
      fill("id-ikn-utara-fill", "bwp_utara", constGetter("bwp_utara"), 5, 0.4),
      fill("id-ikn-bwp-fill", "bwp", propGetter("code"), 5, 0.45),
    ],
    cats: IKN_CATS,
    title: { props: ["name"], fallback: l3("IKN 範圍與規劃", "IKN extent and planning", "IKN 範囲・計画"), fallbackBy: { prop: "layer", map: IKN_LAYER_MAP } },
    fields: [
      { prop: "layer", label: l3("範圍類別", "Area type", "範囲の種別"), map: IKN_LAYER_MAP },
      { prop: "zone", label: l3("功能分區（原文）", "Zone (original)", "機能区分（原文）") },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
    ],
    dashLabel: l3("虛線：RDTR 詳細規劃範圍", "Dashed: RDTR detailed plan areas", "破線：RDTR 詳細計画区域"),
    legendNotes: [l3("四個範圍互相重疊：IKN 範圍（白框）、RDTR（藍虛線）、BWP 北部（橘）、BWP 六分區（彩色）；點擊取最具體的一個", "Four overlapping areas: IKN extent (white outline), RDTR (blue dashed), BWP north (orange), BWP six sub-areas (colours); a click returns the most specific one", "4 つの範囲が重なる：IKN 範囲（白枠）、RDTR（青破線）、BWP 北部（橙）、BWP 6 区画（色分け）。クリックは最も詳細なものを返す")],
    popupNotes: [], sourceOrg: BNPB_ORG("Dewan Nasional KEK／IKN"), sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: F,
    sourceNotes: [l3("四個範圍互相重疊，面積不可相加", "The four areas overlap, so their areas must not be added", "4 つの範囲は重なっており、面積を合算してはいけない")],
    loading: loading("印尼新首都 IKN", "Indonesia new capital IKN", "インドネシア新首都 IKN"),
  },
];
void POLY; void PT; void str; void UNSTATED;
