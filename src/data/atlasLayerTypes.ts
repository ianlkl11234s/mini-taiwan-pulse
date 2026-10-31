/**
 * atlas 批次 2026-10 的 26 個點／線／面圖層（原民與農村、道路設施、淹水與災害照片、海洋、地名、水利設施）
 * 分類、色票與 Mapbox filter SSOT —— manifest／overlay／legend／popup 四邊共用。
 * 資料由 scripts/preprocess/build-atlas-public.py 從 taipei-gis-analytics 成品產出；類別文字讀上游中文
 * `<欄>_label` 欄，本檔的 `label` 只給圖例與篩選選單用（與上游 label 同字）。
 * 色票是資料語意色（design-system spec §3.16），刻意不進 designTokens。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step。
 */
import { allMultiSelectBitmask, multiSelectFilter } from "./multiSelectMapbox";
import { ATLAS_LAYER_COLORS } from "./atlasLayerColors";

export { ATLAS_LAYER_COLORS };

export type AtlasLayerKey = keyof typeof ATLAS_LAYER_COLORS;

/** 缺值／其他類別的中性灰 */
export const ATLAS_OTHER_COLOR = "#94a3b8";
/** 座標旗標（疑似縣市不符等）的警示色：點改用此色，popup 顯示旗標說明 */
export const ATLAS_FLAG_COLOR = "#f59e0b";

export interface AtlasOption {
  value: string;
  label: string;
  color: string;
}

export function matchColorExpr(property: string, options: readonly AtlasOption[], fallback = ATLAS_OTHER_COLOR): unknown[] {
  return ["match", ["get", property], ...options.flatMap((option) => [option.value, option.color]), fallback];
}

export function optionColor(options: readonly AtlasOption[], value: unknown, fallback = ATLAS_OTHER_COLOR): string {
  return options.find((option) => option.value === String(value ?? ""))?.color ?? fallback;
}

export function optionValues(options: readonly AtlasOption[]): string[] {
  return options.map((option) => option.value);
}

/** 多選 filter（全選時只要求欄位存在；全關顯示不可能值）。 */
export function atlasMultiSelectFilter(property: string, options: readonly AtlasOption[], mask?: number): unknown[] {
  const values = optionValues(options);
  return multiSelectFilter(property, mask ?? allMultiSelectBitmask(values), values);
}

/** 數值年份多選：year 在檔內是數字，以 to-string 比對選項字串。 */
export function atlasYearFilter(property: string, years: readonly string[], mask?: number): unknown[] {
  const m = mask ?? allMultiSelectBitmask(years);
  const selected = years.filter((_, index) => (Math.trunc(m) & (1 << index)) !== 0);
  return ["in", ["to-string", ["get", property]], ["literal", selected]];
}

/** 座標旗標覆蓋色：coord_status 在 flagged 清單中的點改用警示色。 */
export function flaggedColorExpr(base: unknown, flagged: readonly string[] = ["suspect_county_mismatch"]): unknown[] {
  return ["case", ["in", ["get", "coord_status"], ["literal", [...flagged]]], ATLAS_FLAG_COLOR, base];
}

// ── 原民與農村 ──────────────────────────────────────────────────────────

/** 部落點位依族別分色（原民會 16 族；多族並列「、」的 4 筆與其他落灰）。 */
export const TRIBE_ETHNIC_OPTIONS: readonly AtlasOption[] = [
  { value: "泰雅族", label: "泰雅族", color: "#b45309" },
  { value: "阿美族", label: "阿美族", color: "#dc2626" },
  { value: "排灣族", label: "排灣族", color: "#7c3aed" },
  { value: "布農族", label: "布農族", color: "#2563eb" },
  { value: "太魯閣族", label: "太魯閣族", color: "#0f766e" },
  { value: "賽夏族", label: "賽夏族", color: "#db2777" },
  { value: "魯凱族", label: "魯凱族", color: "#65a30d" },
  { value: "賽德克族", label: "賽德克族", color: "#9333ea" },
  { value: "卑南族", label: "卑南族", color: "#ea580c" },
  { value: "鄒族", label: "鄒族", color: "#0891b2" },
  { value: "雅美族(達悟族)", label: "雅美族（達悟族）", color: "#1d4ed8" },
];
/** 不在現行核定名單的點位（13 點）以灰色區分。 */
export const TRIBE_NOT_APPROVED_COLOR = "#64748b";

export function tribeColorExpr(): unknown[] {
  return ["case", ["==", ["get", "in_current_approved_list"], false], TRIBE_NOT_APPROVED_COLOR, matchColorExpr("ethnic_group", TRIBE_ETHNIC_OPTIONS)];
}

/** 孤島地區成因組合（土石流＋淹水＋道路橋梁中斷，cause_combo 由前處理組出）。 */
export const ISOLATION_CAUSE_OPTIONS: readonly AtlasOption[] = [
  { value: "debris+flood+road", label: "土石流＋淹水＋道路中斷", color: "#7f1d1d" },
  { value: "debris+road", label: "土石流＋道路中斷", color: "#be123c" },
  { value: "flood+road", label: "淹水＋道路中斷", color: "#1d4ed8" },
  { value: "debris+flood", label: "土石流＋淹水", color: "#7c3aed" },
  { value: "road", label: "只有道路中斷", color: "#ea580c" },
  { value: "debris", label: "只有土石流", color: "#a16207" },
  { value: "flood", label: "只有淹水", color: "#0284c7" },
  { value: "none", label: "未勾選成因", color: ATLAS_OTHER_COLOR },
];

export const RURAL_COMMUNITY_OPTIONS: readonly AtlasOption[] = [
  { value: "平地社區", label: "平地社區", color: "#84cc16" },
  { value: "丘陵社區", label: "丘陵社區", color: "#ca8a04" },
  { value: "高山社區", label: "高山社區", color: "#15803d" },
];
/** 切片 z7–12 逐 zoom 4,271 面完整；低於 z7 不顯示。 */
export const RURAL_MIN_ZOOM = 7;

// ── 道路設施 ────────────────────────────────────────────────────────────

export const ROAD_SIGN_SERIES_OPTIONS: readonly AtlasOption[] = [
  { value: "speed_limit", label: "速限標誌", color: "#2563eb" },
  { value: "speed_enforcement", label: "測速取締警告標誌", color: "#dc2626" },
  { value: "height_limit", label: "車輛高度限制標誌", color: "#7c3aed" },
  { value: "weight_limit", label: "車輛重量限制標誌", color: "#9333ea" },
  { value: "curve_warning", label: "彎路警告標誌", color: "#ea580c" },
  { value: "steep_slope", label: "險坡警告標誌", color: "#a16207" },
  { value: "pedestrian_warning", label: "當心行人標誌", color: "#db2777" },
  { value: "children_warning", label: "當心兒童標誌", color: "#e11d48" },
  { value: "expressway_interchange_name", label: "快速公路交流道名稱標誌", color: "#16a34a" },
];
/** §3.8 V-1：v2 重切檔 z7 起；點層 z11 起（低於 z11 以熱區顯示密度）。 */
export const ROAD_SIGNS_TILE_MIN_ZOOM = 7;
export const ROAD_SIGNS_POINT_MIN_ZOOM = 11;
export const MILEPOSTS_MIN_ZOOM = 7;
export const FREEWAY_SIGNS_MIN_ZOOM = 7;

export const FREEWAY_SIGN_GROUP_OPTIONS: readonly AtlasOption[] = [
  { value: "milepost", label: "里程牌／匝道里程", color: "#16a34a" },
  { value: "other", label: "其他標誌（速限、出口、告示…）", color: "#2563eb" },
  { value: "unlabeled", label: "來源未給標誌代碼名稱", color: ATLAS_OTHER_COLOR },
];

export const INTERCHANGE_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "system_interchange", label: "系統交流道", color: "#b91c1c" },
  { value: "interchange", label: "交流道", color: "#047857" },
  { value: "connector", label: "轉接道", color: "#7c3aed" },
  { value: "terminus", label: "路線端點", color: "#475569" },
  { value: "other", label: "其他", color: ATLAS_OTHER_COLOR },
];

/** 國道生態敏感路段：sensi_level 1／2／3 只用同色深淺（分級方向來源未說明，不用紅綠語意）。 */
export const ECO_SENSITIVE_LEVEL_OPTIONS: readonly AtlasOption[] = [
  { value: "1", label: "敏感等級 1", color: "#99f6e4" },
  { value: "2", label: "敏感等級 2", color: "#2dd4bf" },
  { value: "3", label: "敏感等級 3", color: "#0f766e" },
];
export function ecoLevelColorExpr(): unknown[] {
  return ["match", ["to-string", ["get", "sensi_level"]], ...ECO_SENSITIVE_LEVEL_OPTIONS.flatMap((o) => [o.value, o.color]), ATLAS_OTHER_COLOR];
}

export const MONITOR_SERIES_OPTIONS: readonly AtlasOption[] = [
  { value: "level1_section", label: "一級監控路段", color: "#dc2626" },
  { value: "level2_section", label: "二級監控路段", color: "#f59e0b" },
  { value: "level1_bridge", label: "一級監控橋梁", color: "#7c3aed" },
  { value: "flood_debris_prone", label: "易淹水／土石流路段", color: "#0284c7" },
];
/** 線段 z5–7 會退化（極短路段）→ 切片與圖層都從 z8 起。 */
export const MONITORED_MIN_ZOOM = 7;

export const EMERGENCY_BAY_OPTIONS: readonly AtlasOption[] = [
  { value: "true", label: "在最新年度清單", color: "#7c3aed" },
  { value: "false", label: "只出現在舊年度清單", color: "#a78bfa" },
];
export function emergencyBayColorExpr(): unknown[] {
  return ["case", ["==", ["get", "in_latest_list"], true], EMERGENCY_BAY_OPTIONS[0]!.color, EMERGENCY_BAY_OPTIONS[1]!.color];
}

// ── 淹水與災害照片 ──────────────────────────────────────────────────────

export const FLOOD_INFO_SOURCE_OPTIONS: readonly AtlasOption[] = [
  { value: "emic_report", label: "EMIC 災情通報", color: "#0284c7" },
  { value: "flood_sensor", label: "淹水感測器", color: "#7c3aed" },
  { value: "social_media", label: "社群媒體", color: "#db2777" },
  { value: "news_media", label: "新聞媒體", color: "#ea580c" },
];
export const FLOOD_YEARS = ["2021", "2022", "2023", "2024", "2025"] as const;
export const FLOOD_YEAR_OPTIONS = FLOOD_YEARS.map((year) => ({ value: year, label: year }));

export const SWCB_PHOTO_CATEGORY_OPTIONS: readonly AtlasOption[] = [
  { value: "event_photo", label: "土砂災害事件影像", color: "#a16207" },
  { value: "media_report", label: "媒體報導", color: "#7c3aed" },
];

// ── 海洋 ────────────────────────────────────────────────────────────────

export const ANIMAL_STATUS_OPTIONS: readonly AtlasOption[] = [
  { value: "死亡", label: "死亡", color: "#475569" },
  { value: "活體", label: "活體", color: "#0284c7" },
];
export const TURTLE_SPECIES_OPTIONS: readonly AtlasOption[] = [
  { value: "綠蠵龜", label: "綠蠵龜", color: "#059669" },
  { value: "欖蠵龜", label: "欖蠵龜", color: "#65a30d" },
  { value: "玳瑁", label: "玳瑁", color: "#b45309" },
  { value: "赤蠵龜", label: "赤蠵龜", color: "#dc2626" },
  { value: "革龜", label: "革龜", color: "#1f2937" },
];
export const STRANDING_YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"] as const;
export const STRANDING_YEAR_OPTIONS = STRANDING_YEARS.map((year) => ({ value: year, label: year === "2026" ? "2026（不完整年度）" : year }));

export const BEACH_LEVEL_OPTIONS: readonly AtlasOption[] = [
  { value: "excellent", label: "優良", color: "#0891b2" },
  { value: "fair", label: "普通", color: "#f59e0b" },
  { value: "unsuitable", label: "不宜親水", color: "#dc2626" },
];

/** 微塑膠：表層平均總濃度（個／m³）分級；step 斷點依 25 站分布手調。 */
export const MICROPLASTIC_STEPS = [
  { min: 0, label: "< 100", color: "#e9d5ff" },
  { min: 100, label: "100–300", color: "#c084fc" },
  { min: 300, label: "300–1,000", color: "#9333ea" },
  { min: 1000, label: "≥ 1,000", color: "#581c87" },
] as const;
export function microplasticColorExpr(): unknown[] {
  return ["case", ["!=", ["typeof", ["get", "surface_mean_total_per_m3"]], "number"], ATLAS_OTHER_COLOR,
    ["step", ["to-number", ["get", "surface_mean_total_per_m3"], 0], MICROPLASTIC_STEPS[0].color,
      ...MICROPLASTIC_STEPS.slice(1).flatMap((step) => [step.min, step.color])]];
}

export const POLLUTION_LEVEL_OPTIONS: readonly AtlasOption[] = [
  { value: "1", label: "第 1 級", color: "#64748b" },
  { value: "2", label: "第 2 級", color: "#ea580c" },
  { value: "3", label: "第 3 級", color: "#b91c1c" },
];

// ── 地名 ────────────────────────────────────────────────────────────────

export const PLACE_CATEGORY_OPTIONS: readonly AtlasOption[] = [
  { value: "natural", label: "自然地理實體（z9 起）", color: "#15803d" },
  { value: "admin", label: "行政區域（村里，z12 起）", color: "#7c3aed" },
  { value: "settlement", label: "聚落（z12 起）", color: "#b45309" },
  { value: "landmark", label: "具有地標意義公共設施（z14 起）", color: "#0369a1" },
];
export const PLACE_NAMES_MIN_ZOOM = 7;

export const TRIANGULATION_GRADE_OPTIONS: readonly AtlasOption[] = [
  { value: "1", label: "一等三角點", color: "#7f1d1d" },
  { value: "2", label: "二等三角點", color: "#b45309" },
  { value: "3", label: "三等三角點", color: "#a8a29e" },
];
export function triangulationColorExpr(): unknown[] {
  return ["match", ["to-string", ["get", "grade"]], ...TRIANGULATION_GRADE_OPTIONS.flatMap((o) => [o.value, o.color]), ATLAS_OTHER_COLOR];
}

// ── 水利 ────────────────────────────────────────────────────────────────

export const GATE_KIND_OPTIONS: readonly AtlasOption[] = [
  { value: "floodgate", label: "水門", color: "#1d4ed8" },
  { value: "sluice_gate", label: "閘門", color: "#7c3aed" },
  { value: "evacuation_gate", label: "疏散門", color: "#ea580c" },
  { value: "other", label: "其他", color: ATLAS_OTHER_COLOR },
];
export const STRUCTURE_CATEGORY_OPTIONS: readonly AtlasOption[] = [
  { value: "levee_safety", label: "堤防結構安全", color: "#4338ca" },
  { value: "gate", label: "閘門", color: "#0891b2" },
];
export const DREDGING_STATUS_OPTIONS: readonly AtlasOption[] = [
  { value: "in_progress", label: "執行中", color: "#a16207" },
  { value: "completed", label: "已完工", color: "#15803d" },
  { value: "preparing", label: "準備中", color: "#64748b" },
];
/** 生態調查站：物種數分級 */
export const ECOLOGY_SPECIES_STEPS = [
  { min: 0, label: "< 10 種", color: "#bbf7d0" },
  { min: 10, label: "10–29 種", color: "#4ade80" },
  { min: 30, label: "30–79 種", color: "#16a34a" },
  { min: 80, label: "≥ 80 種", color: "#14532d" },
] as const;
export function ecologyColorExpr(): unknown[] {
  return ["step", ["to-number", ["get", "species_count"], 0], ECOLOGY_SPECIES_STEPS[0].color,
    ...ECOLOGY_SPECIES_STEPS.slice(1).flatMap((step) => [step.min, step.color])];
}

// ── 海域保護與漁業 G08（2026-10-17）─────────────────────────────────────

/** 海岸地區範圍（111 年版）：來源 area_type 為中文字串，直接當 value。 */
export const COASTAL_AREA_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "濱海陸地", label: "濱海陸地", color: "#a8a29e" },
  { value: "近岸海域", label: "近岸海域", color: "#64748b" },
];
/** 海洋保育補接 G33：6 面的法定類別（野保法重要棲息環境 vs 野生動物保護區），分色、不合併。 */
export const MARINE_WILDLIFE_AREA_OPTIONS: readonly AtlasOption[] = [
  { value: "habitat", label: "野生動物重要棲息環境", color: "#2563eb" },
  { value: "protected", label: "野生動物保護區", color: "#0d9488" },
];
/** G37 專用漁業權範圍：「現存／屆期」是來源 SHP 的標記（標記日期不明），不是今天的權利狀態。 */
export const EXCLUSIVE_FISHERY_STATUS_OPTIONS: readonly AtlasOption[] = [
  { value: "active", label: "來源標「現存」", color: "#0e7490" },
  { value: "expired", label: "來源標「屆期」", color: "#a8a29e" },
];
/** G37 全國再生能源施工許可：analytics 依電廠名稱關鍵字與容量密度推估的類型（非官方分類）。 */
export const RENEWABLE_PERMIT_CLASS_OPTIONS: readonly AtlasOption[] = [
  { value: "漁電共生", label: "漁電共生（名稱關鍵字）", color: "#0284c7" },
  { value: "水域光電", label: "水域光電（名稱關鍵字）", color: "#06b6d4" },
  { value: "畜電共生", label: "畜電共生（名稱關鍵字）", color: "#a16207" },
  { value: "屋頂型", label: "屋頂型（名稱關鍵字）", color: "#9333ea" },
  { value: "pure_ground", label: "地面型（容量密度推估）", color: "#f59e0b" },
  { value: "mixed", label: "混合（容量密度推估）", color: "#84cc16" },
  { value: "suspect_symbiotic", label: "疑似共生（容量密度推估）", color: "#14b8a6" },
  { value: "unknown", label: "無法分類", color: "#94a3b8" },
];
/** G37 重大職災：依災害類型分色（上游 severity 是粗推估、會低估死亡，不用來分色）。 */
export const OCCUPATIONAL_ACCIDENT_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "墜落、滾落", label: "墜落、滾落", color: "#dc2626" },
  { value: "物體倒塌、崩塌", label: "物體倒塌、崩塌", color: "#ea580c" },
  { value: "物體飛落", label: "物體飛落", color: "#a16207" },
  { value: "感電", label: "感電", color: "#ca8a04" },
  { value: "被夾、被捲", label: "被夾、被捲", color: "#7c3aed" },
  { value: "被撞", label: "被撞", color: "#2563eb" },
  { value: "公路交通事故", label: "公路交通事故", color: "#0891b2" },
];
/** G37 國家重要濕地等級（國家公園署範圍圖 LEVEL_1）。 */
export const WETLAND_LEVEL_OPTIONS: readonly AtlasOption[] = [
  { value: "國際級", label: "國際級", color: "#34d399" },
  { value: "國家級", label: "國家級", color: "#059669" },
  { value: "地方級", label: "地方級", color: "#65a30d" },
  { value: "暫定地方級", label: "暫定地方級", color: "#a3a3a3" },
];
/** TWL-16 重要濕地保育利用計畫功能分區：依計畫書 zone 欄 5 類上色（細分名稱如「其他分區(水資源涵養區)」在 popup）。 */
export const WETLAND_ZONE_OPTIONS: readonly AtlasOption[] = [
  { value: "核心保育區", label: "核心保育區", color: "#15803d" },
  { value: "生態復育區", label: "生態復育區", color: "#65a30d" },
  { value: "環境教育區", label: "環境教育區", color: "#0891b2" },
  { value: "管理服務區", label: "管理服務區", color: "#ca8a04" },
  { value: "其他分區", label: "其他分區", color: ATLAS_OTHER_COLOR },
];
/** G37 水域遊憩禁止／限制區：依公告名稱分「禁止」「限制」「禁止＋限制」。 */
export const WATER_RECREATION_KIND_OPTIONS: readonly AtlasOption[] = [
  { value: "prohibited", label: "禁止水域遊憩活動", color: "#be123c" },
  { value: "mixed", label: "禁止＋限制（同一公告）", color: "#c2410c" },
  { value: "restricted", label: "限制或活動分區", color: "#d97706" },
];
/** G37 電動機車換電站：中油是營運中的換電加油站；台電是出租作換電站／充電站使用的土地。 */
export const BATTERY_SWAP_OPERATOR_OPTIONS: readonly AtlasOption[] = [
  { value: "cpc", label: "中油加油站（提供換電）", color: "#0d9488" },
  { value: "taipower", label: "台電出租土地（換電站或充電站用）", color: "#7c3aed" },
];
/** G08 圖例來源機關（中文正本；英日文在 enums.atlas.json 的 enum.atlasOrg.*），併入 atlasLegends 的 ORGS。 */
export const MARINE_PROTECTION_ORGS = {
  forestry: "農業部林業及自然保育署", fa: "農業部漁業署", nps: "內政部國家公園署",
} as const;

// ── 文化幣藝文消費點 G23（2026-10-24）───────────────────────────────────

/** 文化幣店家 7 大類：value＝上游 category 英文代碼（analytics labels.py SSOT），label＝來源中文類名（去數字前綴）。 */
export const CULTURE_COIN_CATEGORY_OPTIONS: readonly AtlasOption[] = [
  { value: "books_publishing", label: "書店及出版業", color: "#2563eb" },
  { value: "cinema", label: "電影院", color: "#dc2626" },
  { value: "performing_arts", label: "表演藝術及文化體驗", color: "#7c3aed" },
  { value: "museum", label: "博物館", color: "#a16207" },
  { value: "heritage_community", label: "文資保存與社區營造場域", color: "#15803d" },
  { value: "pop_music", label: "流行音樂", color: "#db2777" },
  { value: "craft_creative", label: "文創工藝", color: "#0d9488" },
];
/** 地址回補精度（上游 precision 代碼 → 中文；英日文在 enums.atlas.json 的 enum.atlasCoinPrecision.*）。 */
export const CULTURE_COIN_PRECISION_LABELS: Readonly<Record<string, string>> = {
  cached: "地址快取命中（TGOS）", exact: "門牌點", interpolated: "同路段內插", approximate: "概略位置",
};
/** G23 圖例來源機關（中文正本；英日文在 enums.atlas.json 的 enum.atlasOrg.*）。 */
export const CULTURE_COIN_ORGS = { moc: "文化部" } as const;

// ── 文化、觀光、原民補強 G35（2026-10-31）──────────────────────────────

/**
 * 族語方言分布（鄉鎮彙整）依族別分色：沿用部落點位 11 族色，另補 5 族；一鄉鎮有兩族以上＝multiple。
 * 2026-10-31 TWL-16：邵族原 #be185d 與賽夏族粉紅、噶瑪蘭族原 #0d9488 與太魯閣族青綠在圖例難分 →
 * 改用 atlas 已在用的 #16a34a（綠）、#78350f（深褐）；兩色對其餘 15 色的 CIE76 ΔE 最小 27.4／26.0（原本 10.7／12.4）。
 * 邵族（魚池、水里）是地圖上實際塗色的鄉鎮，給綠色避開鄰近泰雅族褐色；噶瑪蘭族目前沒有單族鄉鎮（都併在「兩族以上」），色只出現在圖例。
 */
export const DIALECT_GROUP_OPTIONS: readonly AtlasOption[] = [
  ...TRIBE_ETHNIC_OPTIONS,
  { value: "邵族", label: "邵族", color: "#16a34a" },
  { value: "噶瑪蘭族", label: "噶瑪蘭族", color: "#78350f" },
  { value: "撒奇萊雅族", label: "撒奇萊雅族", color: "#ca8a04" },
  { value: "拉阿魯哇族", label: "拉阿魯哇族", color: "#4d7c0f" },
  { value: "卡那卡那富族", label: "卡那卡那富族", color: "#0369a1" },
  { value: "multiple", label: "兩族以上", color: "#475569" },
];
/** 客家文化重點發展區依客語腔調分色（來源字串，複合腔調照原值）。 */
export const HAKKA_ACCENT_OPTIONS: readonly AtlasOption[] = [
  { value: "四縣腔", label: "四縣腔", color: "#0f766e" },
  { value: "海陸腔", label: "海陸腔", color: "#2563eb" },
  { value: "四縣腔海陸腔", label: "四縣腔＋海陸腔", color: "#7c3aed" },
  { value: "大埔腔", label: "大埔腔", color: "#ca8a04" },
  { value: "四縣腔大埔腔", label: "四縣腔＋大埔腔", color: "#c2410c" },
  { value: "詔安腔", label: "詔安腔", color: "#be185d" },
];
/** 旅遊服務站點類別（TourismServiceSiteClasses 1–5；官方代碼表未取得，名稱依站名歸納）。 */
export const TOUR_SERVICE_SITE_OPTIONS: readonly AtlasOption[] = [
  { value: "1", label: "機場旅客服務中心", color: "#be123c" },
  { value: "2", label: "交通場站旅遊服務中心", color: "#4f46e5" },
  { value: "3", label: "國家風景區遊客中心", color: "#0f766e" },
  { value: "4", label: "地方遊客中心", color: "#0891b2" },
  { value: "5", label: "借問站", color: "#ca8a04" },
];
/** 遊客人數據點：最新年（2024）全年人次分 5 級（固定門檻）；全年不足 12 個月＝灰。 */
export const VISITOR_STEPS: readonly { min: number; label: string; color: string }[] = [
  { min: 0, label: "未滿 10 萬", color: "#fed7aa" },
  { min: 100_000, label: "10 萬–50 萬", color: "#fdba74" },
  { min: 500_000, label: "50 萬–100 萬", color: "#fb923c" },
  { min: 1_000_000, label: "100 萬–500 萬", color: "#ea580c" },
  { min: 5_000_000, label: "500 萬以上", color: "#9a3412" },
];
export function visitorColorExpr(): unknown[] {
  return ["case", ["==", ["typeof", ["get", "latest_annual"]], "number"],
    ["step", ["get", "latest_annual"], ...VISITOR_STEPS.flatMap((s, i) => (i === 0 ? [s.color] : [s.min, s.color]))], ATLAS_OTHER_COLOR];
}
export function visitorColor(value: unknown): string {
  if (typeof value !== "number") return ATLAS_OTHER_COLOR;
  return [...VISITOR_STEPS].reverse().find((s) => value >= s.min)?.color ?? VISITOR_STEPS[0]!.color;
}
export const G35_ORGS = { tourism: "交通部觀光署", hakka: "客家委員會" } as const;

// ── 原民會文化健康站 G20（2026-10-24）───────────────────────────────────

/** 點的兩種精度：site＝離線 geocode 落在來源鄉鎮內（一站一點）；township_group＝只到鄉鎮，同鄉鎮各站併成鄉鎮中心一點（空心圈）。 */
export const CULTURAL_HEALTH_KIND_OPTIONS: readonly AtlasOption[] = [
  { value: "site", label: "站址（依地址定位）", color: "#c2410c" },
  { value: "township_group", label: "僅到鄉鎮（鄉鎮中心，非實際位置）", color: "#c2410c" },
];
// ── 國營事業與國有資產 G16（2026-10-24）─────────────────────────────────

/** 台水廠所類型（上游 unit_type 代碼 → 中文 label；英日文在 enums.atlas.json 的 enum.atlasTwcOfficeType.*）。 */
export const TWC_OFFICE_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "headquarters", label: "總管理處", color: "#1e3a8a" },
  { value: "region_office", label: "區管理處", color: "#2563eb" },
  { value: "operation_office", label: "營運所", color: "#0ea5e9" },
  { value: "service_office", label: "服務所", color: "#14b8a6" },
  { value: "water_plant", label: "給水廠／淨水場", color: "#7c3aed" },
  { value: "reservoir_office", label: "水庫管理所", color: "#0f766e" },
];
/** 台水淨水設施類型（上游 facility_type；英日文 enum.atlasTwcFacilityType.*）。 */
export const TWC_FACILITY_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "water_treatment_plant", label: "淨水場", color: "#0891b2" },
  { value: "well", label: "水井", color: "#65a30d" },
  { value: "desalination_plant", label: "海水淡化廠", color: "#7c3aed" },
  { value: "intake_station", label: "取水站", color: "#ea580c" },
  { value: "other", label: "其他", color: "#78716c" },
];
/** 國產署待標售標的（上游 property_kind；英日文 enum.atlasTenderKind.*）。 */
export const STATE_TENDER_KIND_OPTIONS: readonly AtlasOption[] = [
  { value: "land", label: "土地", color: "#9333ea" },
  { value: "building", label: "房地（建物）", color: "#db2777" },
];
/** G16 圖例來源機關（中文正本；英日文在 enums.atlas.json 的 enum.atlasOrg.*）。 */
/** G37 圖例來源機關（英日文 enum.atlasOrg.*）。 */
export const G37_ORGS = {
  osha: "勞動部職業安全衛生署", moeaea: "經濟部能源署", tourismAdmin: "交通部觀光署", cpcTaipower: "台灣中油、台灣電力公司",
} as const;
export const STATE_ASSET_ORGS = { twc: "台灣自來水公司", taisugar: "台灣糖業股份有限公司", fnp: "財政部國有財產署" } as const;
/** G10 ATM 裝設點的機構類別（上游 institution_category；英日文 enum.atlasAtmInstitution.*）。 */
export const ATM_INSTITUTION_OPTIONS: readonly AtlasOption[] = [
  { value: "domestic_bank", label: "本國銀行", color: "#2563eb" },
  { value: "post_office", label: "中華郵政（郵局）", color: "#16a34a" },
  { value: "farmers_credit", label: "農會信用部", color: "#ca8a04" },
  { value: "fishermen_credit", label: "漁會信用部", color: "#0891b2" },
  { value: "credit_cooperative", label: "信用合作社", color: "#9333ea" },
];
/** G10 總分支機構類別（上游 institution_category；英日文 enum.atlasBranchCategory.*）。 */
export const BRANCH_CATEGORY_OPTIONS: readonly AtlasOption[] = [
  { value: "domestic_bank", label: "本國銀行", color: "#2563eb" },
  { value: "foreign_bank", label: "外國銀行", color: "#db2777" },
  { value: "mainland_bank", label: "陸商銀行", color: "#dc2626" },
  { value: "credit_cooperative", label: "信用合作社", color: "#9333ea" },
  { value: "farmers_credit", label: "農會信用部", color: "#ca8a04" },
  { value: "fishermen_credit", label: "漁會信用部", color: "#0891b2" },
  { value: "post_savings", label: "中華郵政儲匯單位", color: "#16a34a" },
  { value: "bills_finance", label: "票券金融公司", color: "#ea580c" },
  { value: "central_bank", label: "中央銀行", color: "#84cc16" },
  { value: "other", label: "其他（財政部國庫署、關貿網路）", color: "#78716c" },
];
/** G10 圖例來源機關。 */
export const FINANCE_ACCESS_ORGS = {
  fisc: "財金資訊股份有限公司",
  // G10 延伸：一層合併多個名冊，圖例來源寫主要機關＋「等」，逐列出典在 popup footer
  securitiesBodies: "臺灣證券交易所、臺灣期貨交易所、中華民國證券投資信託暨顧問商業同業公會",
  insuranceBodies: "財團法人保險事業發展中心、中華民國保險代理人商業同業公會",
  chunghwaPost: "中華郵政股份有限公司",
} as const;

/** G10 延伸 證券期貨據點類型（上游 institution_type；英日文 enum.atlasSecuritiesType.*）。 */
export const SECURITIES_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "securities_branch", label: "證券商分公司", color: "#4f46e5" },
  { value: "futures_head_office", label: "期貨商總公司", color: "#dc2626" },
  { value: "futures_branch", label: "期貨商分公司", color: "#f97316" },
  { value: "investment_trust", label: "證券投資信託公司（投信）", color: "#9333ea" },
  { value: "investment_advisory", label: "證券投資顧問公司（投顧）", color: "#0891b2" },
];
/** G10 延伸 保險機構類型（上游 institution_type；英日文 enum.atlasInsuranceType.*）。 */
export const INSURANCE_TYPE_OPTIONS: readonly AtlasOption[] = [
  { value: "life_insurer", label: "人壽保險公司", color: "#16a34a" },
  { value: "non_life_insurer", label: "產物保險公司", color: "#2563eb" },
  { value: "reinsurer", label: "再保險公司", color: "#7c3aed" },
  { value: "insurance_agency", label: "保險代理人公司", color: "#ea580c" },
  { value: "bank_insurance_agency", label: "銀行兼營保險代理人", color: "#db2777" },
];

/** G10 延伸名冊的來源資料日類型（build-atlas-public.py finance_source_date；英日文 enum.atlasFinanceSourceDate.*）；download＝只有下載日，popup 不另列。 */
export const FINANCE_SOURCE_DATE_LABELS: Readonly<Record<string, string>> = {
  file_date: "名冊檔內資料日期", announced: "名冊檔內公告日期", metadata: "data.gov.tw 更新日（檔內無日期）", association_update: "公會更新日",
};

/** 證券期貨據點：類型多選＋「隱藏證券自營部門」（proprietary_desk＝1 的點不畫；缺值照畫）。 */
export function securitiesFuturesFilter(mask?: number, hideProprietary = 0): unknown[] {
  return ["all", atlasMultiSelectFilter("institution_type", SECURITIES_TYPE_OPTIONS, mask),
    ...(hideProprietary === 1 ? [["!=", ["get", "proprietary_desk"], 1]] : [])];
}

/** ATM 裝設點：機構類別多選＋「只看輪椅可用／只看語音服務」；旗標缺值（null）不算符合。 */
export function atmSiteFilter(mask?: number, onlyWheelchair = 0, onlyVoice = 0): unknown[] {
  return ["all", atlasMultiSelectFilter("institution_category", ATM_INSTITUTION_OPTIONS, mask),
    ...(onlyWheelchair === 1 ? [["==", ["get", "wheelchair_accessible"], 1]] : []),
    ...(onlyVoice === 1 ? [["==", ["get", "voice_guidance"], 1]] : [])];
}

/** 站址定位精度（上游 precision 代碼 → 中文；英日文在 enums.atlas.json 的 enum.atlasChsPrecision.*）。 */
export const CULTURAL_HEALTH_PRECISION_LABELS: Readonly<Record<string, string>> = {
  exact: "門牌點", interpolated: "同路段內插", cached: "地址快取命中（TGOS）", township_centroid: "鄉鎮中心（非實際位置）",
};

// ── 圖例／popup 共用說明 ────────────────────────────────────────────────

export const ATLAS_NOTES = {
  indigenousTribes: "原民會部落位置點表（2022-07）× 現行核定部落（2026-09）；灰點＝不在現行核定名單。另有 13 個現行核定部落沒有點位，未上圖。",
  indigenousIsolationRisk: "點是地區代表中心點，不是範圍；3 筆來源無座標，以村里代表點代替。",
  agriRuralCommunityVillages: "農村社區分類以村里為單位（農業部農村發展及水土保持署）；放大到 7 級以上顯示。",
  indigenousRegions: "原民會公告的 55 個原住民族地區（鄉鎮市區）。範圍套內政部鄉鎮界（TOWN_MOI_1140318，簡化約 40 公尺），不是地籍或法定邊界判定；來源沒有山地／平地別。",
  indigenousLanguageDialects: "原民會族語方言分布參考表（2023-07）：16 族 42 方言、59 個鄉鎮。來源到村里，這裡併成鄉鎮面，村里名單在彈窗；同一鄉鎮有兩族以上方言時塗灰色。是語言推廣用的參考表，不是使用人口調查。",
  hakkaCulturalZones: "客委會公告的 70 個客家文化重點發展區（客家人口比率達三分之一以上的鄉鎮市區），依客語腔調分色；客家人口比率在彈窗。範圍套內政部鄉鎮界。",
  provincialRoadSigns: "交通部公路局省道標誌清查；放大到 11 級以上顯示點位，較低縮放以熱區顯示。調查日期逐筆不同，非即時現況。",
  provincialRoadMileposts: "放大到 11 級以上顯示。調查日期逐筆不同。",
  freewayTrafficSigns: "交通部高速公路局交通標誌；放大到 10 級以上顯示。約 1／4 標誌來源未給代碼名稱（灰點）。",
  freewayInterchanges: "交通部高速公路局國道交流道（207 處）。",
  freewayEcoSensitive: "敏感等級為來源分級，來源未說明數字大小的方向，只用同色深淺區分。",
  provincialRoadMonitored: "省道防救災監控路段；只顯示一般門檻文字，即時封路狀態不在本層。放大到 8 級以上顯示。",
  provincialRoadEmergencyBays: "省道緊急避車彎（112–113 年清單）；淡紫＝只出現在舊年度清單。",
  floodDisasterPointsNcdr: "國家災害防救科技中心淹水災點，只到「年」；2023 年覆蓋不足，筆數是通報列數，不等於淹水次數。",
  taipeiWaterloggingHistory: "臺北市歷年積水範圍；深度單位來源未標，依值域推定為公分。",
  swcbDisasterPhotoPoints: "水保署土砂災害照片拍攝點（34,419 張）；只放照片連結，不嵌入影像。低縮放以熱區顯示。",
  cetaceanStrandings: "鯨豚擱淺事件；83 筆無座標未上圖。橘點＝座標與通報縣市不一致（疑誤，未修正）。",
  seaTurtleStrandings: "海龜擱淺事件；543 筆（約 24%）無座標未上圖。橘點＝座標與通報縣市不一致（疑誤，未修正）。",
  beachWaterQuality: "海水浴場水質，只在游泳季採樣；顏色是最近一次採樣等級。",
  marineMicroplastics: "海洋微塑膠調查站（2021–2023）；顏色是表層平均總濃度。站位是各航次座標平均。",
  marinePollutionIncidents: "海洋污染事件（2003 起）；62 筆無座標（含 2 筆來源為 (0,0)）未上圖；60 筆座標在臺灣周邊範圍外，照來源畫出。",
  namrEdnaSurveySites: "國家海洋研究院環境 DNA 調查站位（度分秒換算）。",
  placeNames: "內政部臺灣地區地名資料：同一實體只畫一點，精度 >1.2 km 的 105 點不上圖；依類別分級顯示（自然 z9、村里與聚落 z12、地標 z14）。",
  triangulationPoints: "內政部三角點（TWD67 度分秒換算 WGS84，約 ±10 m）。",
  wraFloodgatesCentral: "1999–2000 年測量成果，非現況，沒有啟閉狀態。",
  wraCentralDrainage: "中央管區域排水設施範圍（33 條）。",
  iowStructureMonitoring: "水利署 IoT 堤防與閘門結構安全監測站（站點基底，非即時數值）。",
  wraDredgingPoints: "河川疏濬工程點位（快照）；多數座標只到小數 2 位（約 ±1 km），點開看精度。數量單位來源未註明。",
  wraEcologySurveySites: "水利署河川生態調查站（1995–2019，2019 後停更）；顏色是物種數。",
  natureReserves: "全國自然保留區（含陸域，不限海域）；日期為法定公告日，不是資料新鮮度。僅供參考，不構成法規適用判斷。",
  wildlifeProtectedAreas: "全國野生動物保護區（含陸域，不限海域）；同名多面為不同分區。僅供參考，不構成法規適用判斷。",
  openFishingLocations: "海洋保育署公布的開放捕魚點位；點位不是範圍，不代表可進入或安全。僅供參考，不構成法規適用判斷。",
  coastalAreaExtents: "111 年版（2022-09-13）海岸地區範圍，非現行海岸線或管制；7 筆來源面積不到 1 m² 的退化面（金門）未上圖，小島礁放大後才出現。僅供參考，不構成法規適用判斷。",
  marineWildlifeAreas: "海保署公布的 6 個海域野生動物範圍：中華白海豚重要棲息環境與貓嶼、望安、棉花嶼花瓶嶼、觀新藻礁、馬祖燕鷗 5 個野生動物保護區；兩者是不同法定類別，分色顯示。這 5 個保護區不在「野生動物保護區」圖層（只含林保署 16 區）。僅供參考，不構成法規適用判斷。",
  exclusiveFisheryRightAreas: "各區漁會的專用漁業權水域 19 面（來源標現存 11、屆期 8）；與「定置漁業權區」（定置網許可，65 面）是不同的漁業權類別，分開成層。「現存／屆期」是來源圖資的標記，標記日期不明（analytics 2026-02-28 轉檔），不代表今天的權利狀態。僅供參考，不構成法規適用判斷。",
  toxicChemicalFacilities: "環境部毒性及關注化學物質運作場所 7,045 個地址點（6,744 個管制編號；同一編號有多個地址時各畫一點；資料整理 2026-07-12）。97% 由地址定位，點開看精度；179 個地址無法定位未上圖。點開可查運作的化學物質與許可（依管制編號查環境部 EMS_S_05）。列管只代表有運作許可，不代表外洩、污染或風險等級。",
  majorOccupationalAccidents: "勞動部職安署重大職業災害公開網 2018-01～2026-04：事件 2,480 起，只有 1,238 起（49.9%）能由地址定位上圖，地圖上的點約只有一半，不可當成全部事件或拿來比各地多寡。自然人雇主的姓名與地址不顯示。",
  renewablePermitsNational: "經濟部能源署太陽光電電業施工許可（申請年度民國 108–113）：一點是案場的一筆土地地號（8,038／8,195 筆有地號代表點，共 419 座案場）。點位是地號查詢的代表點，不是案場範圍；容量是整座案場的值，同案場每個點重複，不可逐點加總。類型是依電廠名稱關鍵字與容量密度推估，非官方分類。臺北市的屋頂型設置見「北市再生能源許可」。",
  importantWetlandZones: "內政部國家公園署重要濕地保育利用計畫功能分區 578 面（功能分區圖 2026-02-12 版）。只有已公告保育利用計畫的 48 處重要濕地有功能分區，其餘重要濕地範圍沒有分區圖；計畫公告日 2017–2026，各濕地不同。分區細項名稱（例：其他分區(水資源涵養區)）在彈窗。面積由圖形計算。開發限制以公告計畫為準，僅供參考，不構成法規適用判斷。",
  importantWetlands: "內政部國家公園署公告的重要濕地範圍 89 處（範圍圖 2026-01-09 版，含國際級 2、國家級 68、地方級 17、暫定地方級 2）。範圍不等於保育利用計畫的功能分區；開發限制以公告計畫為準。僅供參考，不構成法規適用判斷。",
  waterRecreationRestrictedAreas: "交通部觀光署各國家風景區管理處公告的禁止或限制水域遊憩活動區域（21 則公告、33 區）。範圍是依公告頂點座標連線的示意：部分頂點順序無法成面時改畫外框，兩點的公告畫成界線；以公告附圖為準。1 則（澎湖嵵裡沙灘）座標無法對到地名，未上圖。只含國家風景區，縣市政府公告的區域不在內。",
  batterySwapStations: "台灣中油提供電動機車換電服務的加油站 400 站（2025-08-21 版）＋台電出租作電動機車電池交換站使用的土地 12 筆（2024-07-22 版，用途寫「換電站或充電站」，不保證是營運中的換電站）。業者自建的換電站（多數換電站）不是政府開放資料，不在本層。",
  marineEcologicalMonitoringSites: "國家海洋研究院「全海域生態系調查點位」54 個站位清單（來源資源日 2025-07-21）；是站位清單，不是監測結果，也不是即時監測或目前生態狀況；沒有點不代表沒有資料。",
  artificialReefCenters: "中心位置，非範圍：依公告座標文字解析的人工魚礁禁漁區中心點，範圍規則見彈窗文字；部分點是所列頂點平均（非官方中心）。僅供參考，不構成法規適用判斷。",
  protectedReefCenters: "中心位置，非範圍：依公告座標文字解析的保護礁禁漁區中心點（多為 A、B 兩點連線中點）；1 筆來源僅有地名描述，未上圖。僅供參考，不構成法規適用判斷。",
  setNetFishingAreas: "定置漁業權區（114-08-05 版），來源座標系統已轉為經緯度；不代表現行許可、可否進入或航行安全。僅供參考，不構成法規適用判斷。",
  landSubsidenceStations: "涵蓋期：GNSS 2011-01～2025-12、磁環 1995-07～2026-03、深層樁 2016-05～2025-04。單站量測不代表整個地區；三類量測方式不同，數值不可互比。點開看趨勢。",
  landSubsidenceCumulative: "累積下陷量等值線（mm），負值＝下陷；預設各縣市最新期，可切期別。低縮放（< 9 級）少數短線不顯示。",
  landSubsidenceRate: "平均下陷速率等值線（cm/年），負值＝下陷；預設各縣市最新期，可切期別。缺期：2015–2017 全台圖（只有 SHP 未取得）、2018–2019 全台圖上游無值。",
  seawallZones: "一般性海堤區域（上游建置 2024-06-12）；管理單位已統一為「第N河川分署」。放大到 8 級以上才顯示。",
  cultureCoinVenues: "可使用文化幣的藝文店家與場館 4,264 處（資料下載日 2026-10-24，來源檔無日期）；342 處來源座標為 (0,0)，依地址回補位置。不含街頭藝人（登記人數見「統計」分頁「文化與藝文」的街頭藝人登記人數）。",
  twcServiceOffices: "台灣自來水公司總管理處、區管理處、營運所、服務所、給水廠等 137 個單位的地址點（data.gov.tw 更新日 2024-11-22）。16 個單位與其他單位同址，點會疊在一起。「給水廠／淨水場」是辦公處所，淨水設施本身見「台水淨水設施」。",
  twcWaterFacilities: "台水淨水場、水井、海水淡化廠等 486 處（data.gov.tw 更新日 2024-08-22；1 筆來源缺座標未上圖）。其中 19 列就是台水「大型淨水場」名單的 17 座（設計出水 >20 萬 CMD；鳳山淨水場一期、二期分兩列同一點），已依名稱連結並附設計出水量，不是另外的設施；「水利設施」（OSM）圖層也可能畫到同一座淨水場。12 列名稱有上游編碼缺字（?）。",
  taisugarSugarMills: "台糖各糖廠據點 14 處（data.gov.tw 更新日 2024-08-14）；南靖糖廠來源座標與地址縣市不符，改用地址定位。只是據點，不是台糖土地範圍（台糖可供出租與標租土地統計見「統計」分頁「住宅與不動產」）。",
  statePropertyTenderListings: "國有財產署公告待標售（未標脫）的國有土地 759 筆、房地 188 筆（2026-10-24 下載快照，上游約每週～雙週更新；8 筆無法定位未上圖）。土地點是地號宗地中心、房地點是門牌定位，點開看定位精度；7 筆落點鄉鎮與標示不一致。公告現值是每平方公尺單價，不是標售底價。",
  atmSitesFisc: "財金公司名冊的 ATM 裝設點 27,412 處（名冊快照 2026-10-24；22 處無法定位未上圖）。一點是一個裝設地點，不是一台機器：同一地點可能有多台；財金公司 115 年 9 月跨行 ATM 共 33,712 台。座標來源混合（數位發展部、中華郵政、地址定位、Google），點開看定位精度；222 處只到約略位置；865 處名冊標「不對外開放」。輪椅、語音旗標是名冊自報。低縮放（< 10 級）以熱區顯示。",
  financialBranchesFisc: "財金公司名冊的金融總分支機構 4,989 處（名冊快照 2026-10-24；1 處無法定位未上圖），含本國／外國／陸商銀行、信用合作社、農漁會信用部、郵局儲匯單位與票券公司。座標來源混合，點開看定位精度；160 處只到約略位置。名冊只含 2 個中華郵政儲匯單位，各地郵局不在內（郵局見「郵局」圖層）。",
  securitiesFuturesInstitutions: "證券商分公司 817、期貨商總公司 39 與分公司 90、投信 36、投顧 89，共 1,071 處（名冊 2026-10-24 下載；33 處名冊未列營業地址〔自營部門、免設營業廳等〕未上圖）。是名冊上的營業據點，不是營業員或開戶數；證券商兼營期貨的據點在證券與期貨名冊各列一次，同址點會重疊；不含證券商總公司。座標部分沿用同址 ATM／金融機構分支（G10），部分為地址定位，點開看定位精度；8 處只到約略位置。",
  insuranceInstitutions: "保險公司總分公司 392 處（人壽 233、產物 156、再保 3）與保險代理人公司 263 家（含銀行兼營 31），共 655 處（名冊 2026-10-24 下載）。不含保險通訊處（約 3,358 個，無地址開放資料）與業務員；保代地址為公司登記或聯絡地址，銀行兼營保代為銀行總行地址。座標部分沿用同址 ATM／金融機構分支（G10），部分為地址定位，點開看定位精度；5 處只到約略位置。",
  postOfficeFxCounters: "中華郵政可買賣外幣現鈔及旅行支票的郵局 290 局（網頁名冊 2026-10-25 下載）。這不是外幣收兌處：央行委託臺灣銀行核准的外幣收兌處（飯店、商店等）名單未公開，本層只有郵局；銀行、信合社、農漁會的外幣現鈔據點也沒有公開逐點名冊，不在本層。央行統計（115/09/30）郵局 288 家，與本層差 2，兩邊日期不同，原因未查證。座標取自中華郵政全國營業據點（同電腦局號）。",
  tourServiceSites: "觀光署旅遊服務站點 797 處（借問站、旅遊服務中心、遊客中心），2026-10-31 下載。類別名稱依站名歸納（官方代碼表未取得），「國家風景區遊客中心」類另含 5 間店家借問站。與 OSM「遊客中心」層並列、不取代。",
  tourVisitorStats: "觀光署主要觀光遊憩據點遊客人數（2012–2024 月別）：2024 年 368 個據點中，名稱配得到景點點位的 270 個上圖，98 個配不到未上圖。顏色是 2024 全年人次；名稱比對方式非完全相同者可能配錯，彈窗會標示。人次是各據點自行統計，計算方式不一，不宜跨據點直接比較。",
  culturalHealthStations: "原住民族文化健康站 525 站（通訊錄 2025-07-22）。實心點 191 站依地址定位；空心圈是只定位到鄉鎮的 334 站，同鄉鎮併成鄉鎮中心一圈、圈內數字＝站數，不是實際站址，不可用來量距離。不含電話。",
} as const satisfies Record<AtlasLayerKey, string>;
