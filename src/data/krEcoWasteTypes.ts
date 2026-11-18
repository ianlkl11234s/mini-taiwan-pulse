/**
 * 南韓 KRH-1（2026-11-17）：生態自然圖（C117 `krEcologyNaturalness`）與生活垃圾排出規則（C086 `krWasteDisposalRules`）。
 * 色票、署名、文案（三語 L3）SSOT；hook、圖例、popup 共用。
 * 契約：taipei-gis-analytics `docs/topic-research/south_korea_opendata/waves/krh1/layer-plan.md`；
 * 授權原句：`docs/data-catalog/forestry/kr_ecology_naturalness.md`、`docs/data-catalog/waste_management/kr_waste_disposal_rules.md`（2026-11-17 讀取）。
 * 站主 2026-11-10 拍板設計稿：C117 選 A（原樣幾何、依 시·도 17 檔、z10 起依視窗載入）、C086 選 B（單一淡色＋未涵蓋斜線＋星期格子 popup）。
 */
import type { L3 } from "./krDataLayers";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export const KR_KRH1_FETCHED_AT = "2026-11-17";

// ─────────────────────────── C117 生態自然圖 ───────────────────────────

/** 依 시·도 分檔的分片索引（public/world/kr_eco_nature_index.json，`files[].bbox`＝[W,S,E,N]）。 */
export const KR_ECO_INDEX_FILE = "kr_eco_nature_index.json";
export const KR_ECO_SOURCE_LAYER = "eco_nature";
/** EcoBank 舊制 17 單位的 2 碼（檔名 kr_eco_nature_<code>.pmtiles）。layer id 是字面契約（點擊登記簿），新增分片要改這裡。 */
export const KR_ECO_CODES = ["11", "26", "27", "28", "29", "30", "31", "36", "41", "43", "44", "46", "47", "48", "50", "51", "52"] as const;
export type KrEcoCode = (typeof KR_ECO_CODES)[number];
/**
 * 顯示起點：z10（契約；圖磚 z10–14）。2026-11-17 本機實測 강원／경북 z10 單 tile 約 2 MB 仍可接受，維持 z10。
 * 低於此縮放不掛分片，由視野提示卡（spec §5.42.1）提示放大（靠常駐的空錨點 layer 判斷可見起點）。
 */
export const KR_ECO_MIN_ZOOM = 10;
export const KR_ECO_SRC_MAXZOOM = 14;
export const krEcoSourceId = (code: string) => `kr-eco-nature-${code}`;
export const krEcoFillId = (code: string) => `kr-eco-nature-${code}-fill`;
/** 常駐空錨點（GeoJSON 空集合）：讓視野提示卡找得到可見起點；不畫任何東西。 */
export const KR_ECO_ANCHOR_SOURCE = "kr-eco-nature-anchor";
export const KR_ECO_ANCHOR_FILL = "kr-eco-nature-anchor-fill";
export const KR_ECO_CLICK_LAYER_IDS: readonly string[] = [...KR_ECO_CODES.map(krEcoFillId), KR_ECO_ANCHOR_FILL];

export const KR_ECO_COLOR = "#3f9d5c";
export const KR_ECO_UNKNOWN_COLOR = "#9ca3af";
export interface KrEcoGrade { value: string; color: string; label: L3 }

/**
 * 1→3 等級配色候選（2026-11-18 站主反映首爾、濟州 1／2 等級幾乎同色；待站主選定，預覽用 `?krEcoPalette=A|B|C`）。
 * 各選項分暗／淡底圖兩套（比照統計 colors／darkColors，map-layers §3.9 C-2）：透明度 0.55 疊暗陸，1 等級對比 ≥ 2.2、彩度 ≥ 0.10；
 * 淡底 3 等級保留彩度，不淡成底色。1 最深（保全最優先），3 最淺。
 * - A：同色相綠，拉大明度差
 * - B：綠 → 黃綠 → 淺黃（靠色相分開，相鄰差最大）
 * - C：深綠 → 青綠 → 淺灰綠
 */
export type KrEcoPaletteId = "A" | "B" | "C";
export const KR_ECO_PALETTES: Record<KrEcoPaletteId, { dark: readonly [string, string, string]; light: readonly [string, string, string] }> = {
  // 暗底 0.55 疊暗陸對比（1／2／3）：A 2.23／3.56／4.99、B 2.22／3.86／4.94、C 2.24／3.33／4.65；舊色 1.92／2.82／4.00
  // 相鄰 OKLab ΔE（合成後，暗／淡）：A 11.4・11.1／10.8・9.0、B 16.1・10.0／14.3・12.0、C 11.7・11.2／10.6・11.5；舊色 9.2・9.7／8.4・9.1
  A: { dark: ["#00a240", "#6fda75", "#cefcd6"], light: ["#00672d", "#2caa4e", "#75d78d"] },
  B: { dark: ["#00a05b", "#c1da1d", "#fff0a6"], light: ["#006732", "#79ab1a", "#f7d644"] },
  C: { dark: ["#20a04e", "#1ad1d1", "#caefdd"], light: ["#006738", "#00a59e", "#9acbb4"] },
};
export const KR_ECO_PALETTE_DEFAULT: KrEcoPaletteId = "B";
/** 預覽切換：網址 `krEcoPalette=A|B|C`；其他值或沒給用預設。 */
export function krEcoPaletteId(search: string = typeof location === "undefined" ? "" : location.search): KrEcoPaletteId {
  const v = new URLSearchParams(search).get("krEcoPalette")?.toUpperCase();
  return v === "A" || v === "B" || v === "C" ? v : KR_ECO_PALETTE_DEFAULT;
}
/** 開站時讀一次（App 同步網址會拿掉不認得的參數，之後再讀會退回預設）。 */
const KR_ECO_PALETTE_ACTIVE: KrEcoPaletteId = krEcoPaletteId();
/** 9＝별도관리지역（另依其他法律管理的保護區，不是第 4 級）用獨立紫，兩種底圖共用。 */
export const KR_ECO_NINE_COLOR = "#9b7ae8";
const KR_ECO_GRADE_LABELS: readonly { value: string; label: L3 }[] = [
  { value: "1", label: l3("1 等級（保全最優先）", "Grade 1 (top conservation priority)", "1 等級（保全最優先）") },
  { value: "2", label: l3("2 等級", "Grade 2", "2 等級") },
  { value: "3", label: l3("3 等級", "Grade 3", "3 等級") },
  { value: "9", label: l3("별도관리지역（另依法律管理的保護區）", "별도관리지역 (protected areas managed under other laws)", "별도관리지역（他の法律で管理される保護区域）") },
];
export function krEcoGrades(isDark: boolean, palette: KrEcoPaletteId = KR_ECO_PALETTE_ACTIVE): readonly KrEcoGrade[] {
  const ramp = KR_ECO_PALETTES[palette][isDark ? "dark" : "light"];
  return KR_ECO_GRADE_LABELS.map((g, i) => ({ ...g, color: i < 3 ? ramp[i]! : KR_ECO_NINE_COLOR }));
}
export const krEcoGrade = (value: unknown, isDark = true) => krEcoGrades(isDark).find((g) => g.value === String(value ?? "").trim());
export const KR_ECO_OPACITY = 0.55;

export const KR_ECO_ATTRIBUTION = "출처: 국립생태원 생태자연도 (EcoBank／공공데이터포털 15050229, 공공누리 제3유형, 원본 변경 없음)";
export const KR_ECO_SOURCE_ORG = "국립생태원 생태자연도（EcoBank／공공데이터포털）";
export const KR_ECO_SOURCE_URL = "https://www.data.go.kr/data/15050229/fileData.do";
export const KR_ECO_LICENSE = "공공누리 제3유형（출처표시＋변경금지）";

/** popup 依序顯示的評價項目（空值不顯示）。 */
export const KR_ECO_EVAL_FIELDS: readonly { prop: string; label: L3 }[] = [
  { prop: "vtnEvlGr", label: l3("植生評價", "Vegetation", "植生評価") },
  { prop: "smldEvlGr", label: l3("濕地評價", "Wetland", "湿地評価") },
  { prop: "tpgEvlGr", label: l3("地形評價", "Landform", "地形評価") },
  { prop: "ampltEvlGr", label: l3("瀕危野生生物評價", "Endangered wildlife", "絶滅危惧野生生物評価") },
];
export const KR_ECO_TEXT = {
  title: l3("生態自然圖", "Ecological Naturalness Map", "生態自然図"),
  grade: l3("等級", "Grade", "等級"),
  gradeSuffix: l3(" 等級", "", " 等級"),
  plant: l3("植物群落", "Plant community", "植物群落"),
  wetland: l3("精密濕地", "Detailed wetland", "精密湿地"),
  landform: l3("地形", "Landform", "地形"),
  forestAge: l3("林齡", "Forest age class", "林齢"),
  region: l3("시·도 檔", "Province file", "시·도 ファイル"),
  notice: l3("告示", "Notice", "告示"),
  legendKogl: l3("公共누리第 3 類（出處標示＋禁止變更）：幾何與屬性原樣、未改作",
    "KOGL Type 3 (attribution + no derivatives): geometry and attributes shown as published, unmodified",
    "公共누리第 3 類（出典表示＋改変禁止）：形状と属性は原本のまま、改変なし"),
  legendBlank: l3("空白＝未評價，不是低等級（資料只收已評價的面）",
    "Blank = not assessed, not a low grade (only assessed areas are in the data)",
    "空白＝未評価で、低い等級ではない（評価済みの面のみ収録）"),
  legendNine: l3("별도관리지역＝國立公園、保護區等另依其他法律管理的區域，不是第 4 等級",
    "별도관리지역 = areas such as national parks and reserves managed under other laws; not a 4th grade",
    "별도관리지역＝国立公園や保護区など他の法律で管理される区域で、第 4 等級ではない"),
  legendZoom: l3("放大到 z10 才依畫面範圍載入（依 시·도 分 17 檔）",
    "Loads for the visible area from z10 (17 files by province)",
    "z10 以上で表示範囲に応じて読み込み（시·도 別 17 ファイル）"),
  popupUnmodified: l3("原樣未改作", "Shown as published, unmodified", "原本のまま・改変なし"),
  loading: l3("南韓生態自然圖載入中", "Loading South Korea ecological naturalness map", "韓国生態自然図を読み込み中"),
};

/** kr_eco_nature_index.json 的一列（只列前端用到的欄位）。 */
export interface KrEcoIndexFile {
  file: string;
  code: string;
  sido_ecobank: string;
  current_sido_name: string;
  bbox: [number, number, number, number];
  notice_no?: string;
  notice_date?: string;
}

// ─────────────────────────── C086 生活垃圾排出規則 ───────────────────────────

export const KR_WASTE_RULES_FILE = "kr_waste_disposal_rules.json";
/** 掛既有 kr_admin_boundaries.pmtiles 的 sgg 層（與行政界共用 source id，layer id 用自己的字首）。 */
export const KR_WASTE_ADMIN_SOURCE = "kr-admin-boundaries";
export const KR_WASTE_ADMIN_FILE = "kr_admin_boundaries.pmtiles";
export const KR_WASTE_FILL = "kr-waste-rules-fill";
export const KR_WASTE_HATCH = "kr-waste-rules-uncovered-hatch";
export const KR_WASTE_LINE = "kr-waste-rules-line";
export const KR_WASTE_CLICK_LAYER_IDS: readonly string[] = [KR_WASTE_FILL, KR_WASTE_HATCH];
export const KR_WASTE_COLOR = "#60a5fa";
export const KR_WASTE_OPACITY = 0.3;
/** sgg 層 minzoom（kr_admin_boundaries：sgg z4–12）。 */
export const KR_WASTE_MIN_ZOOM = 4;

export type KrWasteItem = "general" | "food" | "recycle" | "bulky";
export const KR_WASTE_ITEMS: readonly { id: KrWasteItem; color: string; label: L3 }[] = [
  { id: "general", color: "#cbd5e1", label: l3("一般垃圾", "General waste", "一般ごみ") },
  { id: "food", color: "#f59e0b", label: l3("廚餘", "Food waste", "生ごみ") },
  { id: "recycle", color: "#34d399", label: l3("資源回收", "Recyclables", "資源ごみ") },
  { id: "bulky", color: "#a78bfa", label: l3("大型廢棄物", "Bulky waste", "粗大ごみ") },
];
export const KR_WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type KrWeekday = (typeof KR_WEEKDAYS)[number];
export const KR_WEEKDAY_SHORT: Record<KrWeekday, L3> = {
  sun: l3("日", "S", "日"), mon: l3("一", "M", "月"), tue: l3("二", "T", "火"), wed: l3("三", "W", "水"),
  thu: l3("四", "T", "木"), fri: l3("五", "F", "金"), sat: l3("六", "S", "土"),
};
export const KR_WEEKDAY_LONG: Record<KrWeekday, L3> = {
  sun: l3("週日", "Sunday", "日曜"), mon: l3("週一", "Monday", "月曜"), tue: l3("週二", "Tuesday", "火曜"), wed: l3("週三", "Wednesday", "水曜"),
  thu: l3("週四", "Thursday", "木曜"), fri: l3("週五", "Friday", "金曜"), sat: l3("週六", "Saturday", "土曜"),
};
export const KR_WASTE_PLACE_TYPES: Record<string, L3> = {
  "문전수거": l3("門前收運（문전수거）", "Kerbside (문전수거)", "戸別収集（문전수거）"),
  "거점수거": l3("定點收運（거점수거）", "Collection points (거점수거)", "拠点収集（거점수거）"),
  "기타": l3("其他（기타）", "Other (기타)", "その他（기타）"),
};

export const KR_WASTE_ATTRIBUTION = "출처: 행정안전부 생활쓰레기배출정보 (공공데이터포털／LOCALDATA)";
export const KR_WASTE_SOURCE_URL = "https://www.data.go.kr/data/15075534/fileData.do";
export const KR_WASTE_LICENSE = "이용허락범위 제한 없음（data.go.kr 平台標籤）";

export const KR_WASTE_TEXT = {
  title: l3("垃圾排出規則", "Household Waste Disposal Rules", "ごみ排出ルール"),
  hasData: l3("有排出規則（245 個 시군구）", "Rules published (245 시군구)", "排出ルールあり（245 시군구）"),
  uncovered: l3("未涵蓋（來源沒有這個區）", "Not covered (no record for this area)", "未収録（この区域の記録なし）"),
  uncoveredPopup: l3("來源沒有這個 시군구 的排出規則（未涵蓋，不代表不收）",
    "The source has no rules for this 시군구 (not covered; does not mean no collection)",
    "この 시군구 の排出ルールは出典に未収録（収集しないという意味ではない）"),
  legendNoColor: l3("單一顏色只表示有資料，不依時段或星期上色（同一區常有多個分區規則）",
    "One colour only marks areas with data; not coloured by day or time (many areas have several zone rules)",
    "単色はデータの有無のみで、曜日・時間帯では塗り分けない（1 区域に複数の分区ルールがあることが多い）"),
  legendClick: l3("點選各區看依排出日分組的規則", "Click an area to see rules grouped by collection day", "区域をクリックすると排出日別のルールを表示"),
  scope: l3("適用範圍", "Scope", "適用範囲"),
  placeType: l3("排出方式", "Collection method", "排出方式"),
  dept: l3("負責部門", "Department", "担当部署"),
  noCollection: l3("不收日", "No collection", "収集なし"),
  dataDate: l3("資料基準日", "Data as of", "データ基準日"),
  cityScope: l3("全市公告規則（{city}），適用分區請看分區欄", "City-wide rules ({city}); see the zone field for where each applies", "市全体の告示ルール（{city}）。適用分区は分区欄を参照"),
  groups: l3("{n} 組", "{n} sets", "{n} 組"),
  daysMissing: l3("來源未填星期", "Days not given in source", "曜日は出典に記載なし"),
  daysOther: l3("其他（來源寫「기타」）", "Other (source says 기타)", "その他（出典は「기타」）"),
  timeMissing: l3("時段來源未填", "Time not given in source", "時間帯は出典に記載なし"),
  zones: l3("分區", "Zones", "分区"),
  moreZones: l3("還有 {n} 組", "{n} more", "ほか {n} 組"),
  sites: l3("排出地點 {n} 處", "Disposal sites ({n})", "排出場所 {n} か所"),
  moreSites: l3("還有 {n} 處", "{n} more", "ほか {n} か所"),
  methods: l3("方法", "Method", "方法"),
  noItem: l3("來源沒有這一類的規則", "No rules for this category in the source", "この分類のルールは出典になし"),
  loading: l3("南韓垃圾排出規則載入中", "Loading South Korea waste disposal rules", "韓国ごみ排出ルールを読み込み中"),
  rulesLoading: l3("規則載入中…", "Loading rules…", "ルールを読み込み中…"),
};

export interface KrWasteGroup {
  days?: KrWeekday[] | null;
  days_other?: boolean;
  start?: string | null;
  end?: string | null;
  rows?: number;
  zones?: string[];
  sites?: [string | null, string | null][];
  methods?: string[];
}
export interface KrWasteSgg {
  sgg_name: string;
  sido_code: string;
  scope: "sgg" | "city";
  applies_from?: string;
  dept?: string[];
  data_date?: [string, string];
  no_collection?: string[];
  place_types?: Record<string, number>;
  items?: Partial<Record<KrWasteItem, KrWasteGroup[]>>;
}
export interface KrWasteRulesFile {
  meta: { data_date_range?: [string, string]; source_modified?: string };
  sgg: Record<string, KrWasteSgg>;
}

/** 星期顯示狀態：有值、來源寫其他、來源未填（null／欄位不存在／空陣列且沒寫其他）。不可當成「不收」。 */
export function krWasteDaysState(g: KrWasteGroup): { days: KrWeekday[]; other: boolean; missing: boolean } {
  const days = Array.isArray(g.days) ? g.days.filter((d): d is KrWeekday => (KR_WEEKDAYS as readonly string[]).includes(d)) : [];
  const other = !!g.days_other;
  return { days, other, missing: days.length === 0 && !other };
}
