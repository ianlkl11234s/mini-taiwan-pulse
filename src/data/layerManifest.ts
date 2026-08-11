// ══════════════════════════════════════════════════════════════════
//  Layer Manifest — 一個 layer 的「登記資料」單一真實來源（AR-22）
// ══════════════════════════════════════════════════════════════════
//
// 問題：新增一層要碰 14 個檔案約 21 處（完整觸點表見 docs/development-rules.md §4）。
// 其中大約一半是**純登記**——同一份事實（這層叫什麼、什麼顏色、哪顆 icon、
// 資料從哪來、屬於哪個主題）被抄進 5、6 張表，抄漏就漂移，而且多半 tsc 擋不住
// （值錯不是型別錯）。
//
// 本檔把那份事實收成一處，其他表改成從這裡派生。
//
// ── 界線：什麼進 manifest、什麼不進 ────────────────────────────────
//   進：登記簿類觸點 —— LAYER_COLORS(#7) / THEMES 的 LayerDef(#8) /
//       LAYER_ICONS(#17) / UPSTREAM_REGISTRY(#18)，以及 legend(#13) /
//       popup(#15,#16) / params(#11) 的「指向」宣告。
//   不進：loader(#3) / hook(#5) / paint 表達式(#6) / legend 元件(#12) /
//       popup 元件(#14) —— 那些是實質邏輯，塞進 manifest 只會變成一個巨大的
//       什麼都有的檔案，退回原點。
//
// ── Phase 1 現況（5 試點層）────────────────────────────────────────
//   已派生（改這裡畫面就會變）：color / icon / label / labelMobile /
//     expandable / gated / upstream
//   僅宣告（Phase 3 才接線，但已有測試釘住宣告與現況一致）：
//     section / dataClass / source / legend / popup / params
//   等價證明：src/data/__tests__/layerGoldenSnapshot.test.ts 必須全綠
//     —— 搬移零失真才算數。
//
// ⚠️ import 方向：本檔只能 import `../types`、lucide-react，以及**零 import 的純色票
//    常數檔**（religionTypes / funeralTypes 等，見下方色票規約）。
//    layerCatalog / IconRailSidebar / upstreamRegistry 是**下游**，反向 import
//    會造成 cycle（layerVisibilityStore → layerCatalog → layerManifest 這條鏈上
//    任何回頭都會炸）。
//
// ── 色票規約：外部色票常數用「引用」不用「複製字面」──────────────────
//    宗教 / 殯葬 / 教育三組的色票 SSOT 是 `RELIGION_LAYER_COLORS` /
//    `FUNERAL_LAYER_COLORS` / `EDUCATION_LAYER_COLORS` —— 那些檔同時餵
//    LAYER_COLORS 與圖層自己的 paint 表達式，是**三邊共用**的單一真實來源。
//    把 hex 複製進 manifest 等於破壞它們的存在理由（改一邊漂移另一邊，
//    而且 tsc 不會叫）。所以 manifest 的 color 欄寫 `RELIGION_LAYER_COLORS.religionTemples`。

import type { LucideIcon } from "lucide-react";
import {
  Video, Radio, LandPlot, TrainFront, Factory,
  Church, Landmark, HeartHandshake, Sparkles, Camera,
  Cross, Briefcase, Flower, Grid3x3,
  Building2, CalendarDays, Theater, Library,
  Truck, Droplet, Flame, Timer,
  LayoutGrid, ShieldCheck, Trash2, PlaneTakeoff,
  Cable, Store, Mail, PackageCheck, Users, BookOpen, ShoppingBasket, Toilet,
  GraduationCap, Activity, Trees,
  Droplets, ThermometerSun, Mountain, Castle, PartyPopper, FerrisWheel, Tent,
  BedDouble, UtensilsCrossed,
  // 🎓 教育（GraduationCap / Mountain / LandPlot / Grid3x3 / BookOpen / Users /
  //    HeartHandshake 已在上方 import 復用）
  School, University, Accessibility, Map, Shapes, Baby, BarChart3,
  // 🌲 林業（Trees / GraduationCap / Tent / TrainFront 已在上方 import 復用）
  Shield, TreePine, Sprout, Ruler, Hammer, MapPin, Signal, Waves, Route,
  Footprints, PawPrint,
} from "lucide-react";
import type { LayerVisibility, FeatureInfo } from "../types";
import type { UpstreamRef } from "./upstreamRegistry";
import { RELIGION_LAYER_COLORS } from "./religionTypes";
import { FUNERAL_LAYER_COLORS } from "./funeralTypes";
import { EDUCATION_LAYER_COLORS } from "./educationTypes";

/**
 * 資料體質分級 —— 決定這層走哪條上線路徑、要不要進 deploy 腳本清單、
 * 能不能進 /embed 白名單。分級刻意對齊「前端怎麼拿到資料」而非「資料在講什麼」。
 *
 *   A 靜態 GeoJSON —— public/*.geojson 全量 fetch，OVERLAY_REGISTRY 驅動。
 *                     體積上限約 5MB，超過要改切 PMTiles。
 *   B 靜態切片 PMTiles —— HTTP Range 按需載入。⚠️ 必須同步 nginx.conf +
 *                     deploy 腳本清單（觸點 #20，PT-1 曾因漏此步 13 層全站 404）。
 *   C 動態資料 —— Supabase RPC / 即時 API 餵 setData。必須註冊 loadingRegistry
 *                （規則 3），且時間相依一律走 timeStore 訂閱（規則 6）。
 *   D 自行接線 —— **沒有 OVERLAY_REGISTRY entry**：Three.js / WebGL CustomLayer，
 *                 或 hook 自己 addSource/addLayer（fireEvents 走 Supabase RPC、
 *                 worldTrashDebris 走靜態 geojson、fireIsochrone 走 PMTiles factory）。
 *                 分級看的是「派生機制適不適用」不是「資料長什麼樣」——沒有 registry
 *                 entry 就沒得派生，真實來源改記在 source 的 note。
 *                 manifest 的 source 欄位走 kind:"custom"。
 */
export type LayerDataClass = "A" | "B" | "C" | "D";

/** 資料來源描述。形狀跟著 dataClass 走 —— 測試會驗它與 OVERLAY_REGISTRY 對得上。 */
export type LayerSource =
  | { kind: "geojson"; sourceId: string; url: string }
  | {
      kind: "pmtiles";
      sourceId: string;
      url: string;
      sourceLayer?: string;
      minzoom: number;
      maxzoom: number;
    }
  /** dynamicData：source 以空 FeatureCollection 起手，由 loader 按日 setData 餵入 */
  | { kind: "supabase"; sourceId: string; fallbackUrl: string }
  /** 無 OVERLAY_REGISTRY entry（Three.js CustomLayer 等）—— note 說明資料實際從哪來 */
  | { kind: "custom"; note: string };

/** sidebar 座標：THEMES 的主題 title + 子群 title（Phase 1 只宣告，不派生位置） */
export interface LayerSection {
  theme: string;
  group: string;
}

export interface LayerManifestEntry {
  // ── 身分 ──
  /** LayerVisibility 的 key，與 record 的 key 相同（冗餘但讓單筆 entry 可獨立閱讀） */
  key: keyof LayerVisibility;
  /** sidebar 座標（觸點 #8 的位置資訊） */
  section: LayerSection;

  // ── 已派生：改這裡畫面就會變 ──
  /** 桌機 IconRailSidebar 顯示文字。格式慣例 `中文 English` */
  label: string;
  /** 手機 LayerSidebar 顯示文字（多為較長全稱）；未填則沿用 label */
  labelMobile?: string;
  /** sidebar toggle 是否可展開參數面板 */
  expandable?: boolean;
  /** owner-only 私人圖層（非 owner 顯示鎖頭、禁 toggle） */
  gated?: boolean;
  /** 代表色 hex（sidebar 圓點 / 部分 paint 的 fallback） */
  color: string;
  /** lucide icon **元件參照**（不是字串——字串→元件需要一張 name map，
   *  等於把整包 lucide-react 拉進 bundle，或再養一張手寫表，兩者都自我打臉） */
  icon: LucideIcon;
  /** 資料血緣（對應 taipei-gis-analytics catalog dataset），形狀同 UPSTREAM_REGISTRY */
  upstream: UpstreamRef;

  // ── 僅宣告：Phase 3 接線，但已有測試釘住與現況一致 ──
  dataClass: LayerDataClass;
  source: LayerSource;
  /**
   * 圖例群組 id —— 同一組 key 共用一份圖例元件時填同一個 id
   * （例：urbanZoningTaipei / urbanZoningNewTaipei 共用 UrbanZoningLegend）。
   * null = 有意識地不需要圖例（單色 POI / 純線層，鐵則 2 不適用）。
   */
  legend: string | null;
  /**
   * popup 的 FeatureInfo layerType。**不保證與 key 同名**
   * （newsEvents 的 layerType 是 "newsEvent"）—— 這正是要收進 manifest 的漂移點。
   * null = 沒有可點選物件。
   */
  popup: FeatureInfo["layerType"] | null;
  /**
   * 參數控件規格佔位（Phase 4 才把 useTransportParams 的 case 派生掉）。
   * 現在只記「有幾個控件、各是什麼型別」，讓測試能釘住宣告不漂移。
   */
  params: { count: number; kinds: ("slider" | "toggle" | "select")[] } | null;

  // ── 人讀 ──
  /** 一句話說明這層在講什麼（給 sidebar tooltip / 資料源瀏覽器 / BYOK 對話用） */
  description: string;
  /** 主題標籤（跨主題檢索用，非 sidebar 分區） */
  topics: string[];
}

/**
 * Phase 1 試點：5 個**體質各異**的層。刻意不挑 5 個長得像的——
 * 派生機制要先撞過所有形狀（有無 overlay entry / 有無 labelMobile /
 * 圖例獨佔或共用 / popup 同名或異名或沒有），Phase 2 批次搬移才不會每批都返工。
 *
 * ⚠️ `satisfies` 而非型別標註：標註成 Partial<Record<…>> 會把 key 的 literal 型別
 *    丟掉，ManifestKey 就退化成 348 個 key 的全集，下游 Omit 的 tsc 護欄整個失效。
 */
export const LAYER_MANIFEST = {
  // ① 純 registry 靜態 GeoJSON —— 最單純的形狀：legend 獨佔、popup 與 key 同名
  cctv: {
    key: "cctv",
    section: { theme: "交通 Move", group: "路網" },
    label: "道路攝影機 CCTV",
    expandable: true,
    color: "#26c6da",
    icon: Video,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cctv", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "cctv", url: "./geo/cctv.geojson" },
    legend: "cctv",
    popup: "cctv",
    params: { count: 3, kinds: ["slider", "slider", "slider"] },
    description: "全台道路監視器點位（含即時影像連結）",
    topics: ["交通", "監視", "即時影像"],
  },

  // ② Supabase 動態 —— dynamicData: true（空 FeatureCollection 起手，loader 按日餵入）；
  //    popup layerType "newsEvent" 與 key "newsEvents" **不同名**，正是要收編的漂移點
  newsEvents: {
    key: "newsEvents",
    section: { theme: "情勢 Situation", group: "事件" },
    label: "新聞事件 News Events",
    expandable: true,
    color: "#ff9800",
    icon: Radio,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "layer2_polygon", confidence: "LOW" }],
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: "news-events",
      fallbackUrl: "./geo/news_events.geojson",
    },
    legend: "newsEvents",
    popup: "newsEvent",
    params: { count: 6, kinds: ["select", "select", "toggle", "toggle", "toggle", "slider"] },
    description: "新聞事件地理標定（分類著色 + 嚴重度篩選 + 時間漣漪）",
    topics: ["情勢", "新聞", "事件"],
  },

  // ③ PMTiles polygon —— 有 labelMobile、圖例與 urbanZoningNewTaipei **共用**同一元件
  urbanZoningTaipei: {
    key: "urbanZoningTaipei",
    section: { theme: "底圖 Base Map", group: "土地使用分區 Zoning" },
    label: "北市土地使用分區 Taipei Zoning",
    labelMobile: "北市土地使用分區",
    expandable: true,
    color: "#f2c94c",
    icon: LandPlot,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "urban_zoning_taipei", confidence: "HIGH" }],
      note: "臺北市都市計畫土地使用分區 15,518 面（data.taipei SHP，docs/data-catalog/urban_composite/urban_zoning_taipei.md）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "urban-zoning-taipei",
      url: "./urban/urban_zoning_taipei.pmtiles",
      sourceLayer: "urban_zoning_taipei",
      minzoom: 6,
      maxzoom: 15,
    },
    legend: "urbanZoning",
    popup: "urbanZoningTaipei",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "臺北市都市計畫土地使用分區（zone_category 9 類分色）",
    topics: ["土地使用", "都市計畫", "底圖"],
  },

  // ④ Three.js CustomLayer —— **沒有 OVERLAY_REGISTRY entry**、沒有 popup。
  //    逼 source 欄位處理 kind:"custom" 形狀，正是要測的體質差異。
  rail: {
    key: "rail",
    section: { theme: "交通 Move", group: "即時運具" },
    label: "鐵道 Rail",
    expandable: true,
    color: "#ee6c00",
    icon: TrainFront,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "rail", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "Three.js RailScene（軌道 bundle + TRA/THSR/Metro 時刻表推算車位，非 OVERLAY_REGISTRY）",
    },
    legend: "rail",
    popup: null,
    params: { count: 5, kinds: ["toggle", "select", "slider", "slider", "slider"] },
    description: "台鐵／高鐵／捷運列車依時刻表推算的即時位置與軌道",
    topics: ["交通", "鐵道", "即時"],
  },

  // ⑤ 多控件（8 個，slider/select/toggle 三型都有）—— 控件密度最高的 overlay 層，
  //    順帶覆蓋「PMTiles + 圖例共用 + labelMobile + upstream.processing」複合形狀
  pollutionFacility: {
    key: "pollutionFacility",
    section: { theme: "環境氣候 Environment", group: "環境污染" },
    label: "污染潛勢設施 Facility",
    labelMobile: "污染潛勢設施 Facility (152k)",
    expandable: true,
    color: "#f97316",
    icon: Factory,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "pollution_source", confidence: "HIGH" }],
      processing: "EMS_S_01 列管對象 × EMS_P_46 裁處 → 介質×嚴重度 PMTiles（列管≠污染）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "pollution-facility",
      url: "./geo/pollution_facilities.pmtiles",
      sourceLayer: "pollution_facilities",
      minzoom: 0,
      maxzoom: 14,
    },
    legend: "pollution",
    popup: "pollutionFacility",
    params: {
      count: 8,
      kinds: ["slider", "slider", "select", "toggle", "toggle", "toggle", "toggle", "toggle"],
    },
    description: "環境部列管污染潛勢設施 152k 點（介質 × 嚴重度分色，列管≠污染）",
    topics: ["環境", "污染", "列管"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 1 —— 宗教 Religion 6 層
  //  同構家族：一個 legend 元件涵蓋 6 個 key（id 取該 entry 首個 key
  //  "religionTemples"），color 全部引用 RELIGION_LAYER_COLORS。
  //  體質混：temples 量體大走 PMTiles(B)，其餘 5 層 geojson(A)。
  // ══════════════════════════════════════════════════════════════
  religionTemples: {
    key: "religionTemples",
    section: { theme: "宗教 Religion", group: "點位" },
    label: "寺廟 Temples",
    labelMobile: "寺廟 (19,201)",
    expandable: true,
    color: RELIGION_LAYER_COLORS.religionTemples,
    icon: Church,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "temples", confidence: "HIGH" }],
      processing: "內政部宗教資訊系統 XML × 文資 × 百景 × OSM trust chain（religious_site 120m + 名稱 0.85）；deity_family 9 族為上游衍生欄",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "religion-temples",
      url: "./religion/temples.pmtiles",
      sourceLayer: "temples",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "religionTemples",
    popup: "religionTemples",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "全台登記寺廟 19,201 座（主祀神 deity_family 9 族分色）",
    topics: ["宗教", "寺廟", "民俗"],
  },

  religionChurches: {
    key: "religionChurches",
    section: { theme: "宗教 Religion", group: "點位" },
    label: "教會 Churches",
    labelMobile: "教會 (2,116)",
    expandable: true,
    color: RELIGION_LAYER_COLORS.religionChurches,
    icon: Church,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "churches", confidence: "HIGH" }],
      note: "教會 2,116（OSM 補 1,066 聚會點；ODbL）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "religion-churches", url: "./religion/churches.geojson" },
    legend: "religionTemples",
    popup: "religionChurches",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "全台教會 2,116 處（含 OSM 補入的聚會點）",
    topics: ["宗教", "基督宗教"],
  },

  religionAncestralHalls: {
    key: "religionAncestralHalls",
    section: { theme: "宗教 Religion", group: "點位" },
    label: "宗祠 Ancestral Halls",
    labelMobile: "宗祠 (173)",
    expandable: true,
    color: RELIGION_LAYER_COLORS.religionAncestralHalls,
    icon: Landmark,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ancestral_halls", confidence: "HIGH" }],
      note: "宗祠 173（登記宗祠 69 / 基金會 8 / 文資祠堂 96）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "religion-ancestral-halls", url: "./religion/ancestral_halls.geojson" },
    legend: "religionTemples",
    popup: "religionAncestralHalls",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "宗祠家廟 173 處（登記宗祠 / 宗親基金會 / 文資祠堂三類）",
    topics: ["宗教", "宗族", "文資"],
  },

  religionFoundations: {
    key: "religionFoundations",
    section: { theme: "宗教 Religion", group: "點位" },
    label: "宗教基金會 Foundations",
    labelMobile: "宗教基金會 (165)",
    expandable: true,
    color: RELIGION_LAYER_COLORS.religionFoundations,
    icon: HeartHandshake,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "foundations", confidence: "HIGH" }],
      note: "宗教基金會 165（單一源）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "religion-foundations", url: "./religion/foundations.geojson" },
    legend: "religionTemples",
    popup: "religionFoundations",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全國性宗教財團法人 165 處",
    topics: ["宗教", "法人"],
  },

  religionOtherWorship: {
    key: "religionOtherWorship",
    section: { theme: "宗教 Religion", group: "點位" },
    label: "其他宗教場所 Other Worship",
    labelMobile: "其他宗教場所 (1,319)",
    expandable: true,
    color: RELIGION_LAYER_COLORS.religionOtherWorship,
    icon: Sparkles,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "other_worship", confidence: "HIGH" }],
      note: "其他宗教場所 1,319（清真寺/神社遺構/風獅爺…；全 OSM 源 ODbL）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "religion-other-worship", url: "./religion/other_worship.geojson" },
    legend: "religionTemples",
    popup: "religionOtherWorship",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "清真寺／神社遺構／風獅爺等其他信仰場所 1,319 處（全 OSM 源）",
    topics: ["宗教", "民俗", "OSM"],
  },

  religionTop100: {
    key: "religionTop100",
    section: { theme: "宗教 Religion", group: "精選" },
    label: "宗教百景 Top 100",
    labelMobile: "宗教百景",
    expandable: true,
    color: RELIGION_LAYER_COLORS.religionTop100,
    icon: Camera,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "top100", confidence: "HIGH" }],
      note: "宗教百景 100 點（docs/data-catalog/religion/top100.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "religion-top100", url: "./religion/top100.geojson" },
    legend: "religionTemples",
    popup: "religionTop100",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "內政部宗教百景 100 處精選（2026-08 由 tourReligion 更名歸位）",
    topics: ["宗教", "觀光", "精選"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 1 —— 殯葬 Funeral 5 層
  //  同構家族：一個 legend 元件涵蓋 5 個 key（id 取首個 key "funeralFacilities"），
  //  color 全部引用 FUNERAL_LAYER_COLORS。
  //  🔴 A/B/C 三源刻意不整合（2026-08-05 拍板）：A 官方名冊 OGDL、B OSM ODbL、
  //     C 都計 OGDL —— 授權與母體都不同，合併會產生一份誰也無法追溯的東西。
  // ══════════════════════════════════════════════════════════════
  funeralFacilities: {
    key: "funeralFacilities",
    section: { theme: "殯葬 Funeral", group: "點位" },
    label: "殯葬設施 Facilities",
    labelMobile: "殯葬設施 (3,707)",
    expandable: true,
    color: FUNERAL_LAYER_COLORS.funeralFacilities,
    icon: Cross,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "funeral_facilities_moi", confidence: "HIGH" }],
      note: "A 源 設施 3,707 點（母體 4,145，438 筆無座標）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "funeral-facilities", url: "./funeral/funeral_facilities.geojson" },
    legend: "funeralFacilities",
    popup: "funeralFacilities",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "內政部殯葬設施名冊 3,707 點（殯儀館／火化場／納骨塔／公墓分類）",
    topics: ["殯葬", "公共設施"],
  },

  funeralOperators: {
    key: "funeralOperators",
    section: { theme: "殯葬 Funeral", group: "點位" },
    label: "禮儀業者 Operators",
    labelMobile: "禮儀業者 (4,569 營業中)",
    expandable: true,
    color: FUNERAL_LAYER_COLORS.funeralOperators,
    icon: Briefcase,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "funeral_operators_biz", confidence: "HIGH" }],
      note: "A 源 禮儀業者 6,233 點（前端預設只畫 is_active=true 的 4,569）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "funeral-operators", url: "./funeral/funeral_operators.geojson" },
    legend: "funeralFacilities",
    popup: "funeralOperators",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "殯葬禮儀服務業 6,233 家登記地（預設只畫營業中 4,569）",
    topics: ["殯葬", "商業登記"],
  },

  cemeteryOsm: {
    key: "cemeteryOsm",
    section: { theme: "殯葬 Funeral", group: "墓區範圍" },
    label: "墓區範圍 OSM Cemeteries",
    labelMobile: "墓區範圍 OSM (3,229)",
    expandable: true,
    color: FUNERAL_LAYER_COLORS.cemeteryOsm,
    icon: Flower,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cemetery_osm", confidence: "HIGH" }],
      note: "B 源 OSM 墓區 3,229 面（ODbL，僅 34.5% 有 name）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "cemetery-osm",
      url: "./funeral/cemetery_osm.pmtiles",
      sourceLayer: "cemetery_osm",
      minzoom: 6,
      maxzoom: 14,
    },
    legend: "funeralFacilities",
    popup: "cemeteryOsm",
    params: { count: 1, kinds: ["slider"] },
    description: "OSM 實地測繪墓區範圍 3,229 面（ODbL；僅 34.5% 有名稱）",
    topics: ["殯葬", "OSM", "土地使用"],
  },

  cemeteryZoning: {
    key: "cemeteryZoning",
    section: { theme: "殯葬 Funeral", group: "墓區範圍" },
    label: "都計墓葬用地 Zoning（北北）",
    labelMobile: "都計墓葬用地 (114・僅北北)",
    expandable: true,
    color: FUNERAL_LAYER_COLORS.cemeteryZoning,
    icon: LandPlot,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cemetery_zoning_urban", confidence: "HIGH" }],
      note: "C 源 都計墓葬類法定用地 114 面（僅臺北 12＋新北 102）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "cemetery-zoning", url: "./funeral/cemetery_zoning.geojson" },
    legend: "funeralFacilities",
    popup: "cemeteryZoning",
    params: { count: 1, kinds: ["slider"] },
    description: "都市計畫墓葬類法定用地 114 面（僅臺北 12＋新北 102，非全國）",
    topics: ["殯葬", "都市計畫", "土地使用"],
  },

  // 無 OVERLAY_REGISTRY entry → dataClass D：上游刻意不帶幾何（附面 48.9MB → 純數值 5.1KB），
  // 由 hook 自行 join 既有的鄉鎮界 PMTiles。派生機制不適用，真實來源記在 source.note。
  funeralOperatorDensity: {
    key: "funeralOperatorDensity",
    section: { theme: "殯葬 Funeral", group: "分析" },
    label: "業者密度 Operator Density",
    labelMobile: "業者密度 (325 區)",
    expandable: true,
    color: FUNERAL_LAYER_COLORS.funeralOperatorDensity,
    icon: Grid3x3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "funeral_operators_district", confidence: "HIGH" }],
      note: "A 源 區級密度 325 區（無幾何，join base_map/township_boundary.pmtiles）",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useFuneralDensityLayer 自行接線：純數值 JSON（TOWNCODE → 家數）join public/base_map/township_boundary.pmtiles，無自身幾何故無 OVERLAY_REGISTRY entry",
    },
    legend: "funeralFacilities",
    popup: "funeralOperatorDensity",
    params: { count: 1, kinds: ["slider"] },
    description: "禮儀業者區級密度面量圖 325 區（⚠️ 是登記地家數，非服務涵蓋率）",
    topics: ["殯葬", "密度分析"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 1 —— 文化 Culture 5 層
  //  與宗教/殯葬相反的形狀：5 個 key **各自獨佔**一份圖例（legend id = 自己的 key），
  //  color 是 layerCatalog 的字面 hex（沒有外部色票常數）。
  //  批 1 唯一的 dataClass C：librarySeats 走 Supabase RPC 動態餵資料。
  //  上游 handoff: taipei-gis-analytics/docs/handoff/culture-layers.md
  // ══════════════════════════════════════════════════════════════
  culturalFacilities: {
    key: "culturalFacilities",
    section: { theme: "文化 Culture", group: "設施 Facilities" },
    label: "文化設施 Cultural Facilities",
    labelMobile: "文化設施",
    expandable: true,
    color: "#ef8a3c",
    icon: Landmark,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cultural_facilities_moc", confidence: "HIGH" }],
      note: "文化設施全國 787 點（MOC 文化資料開放平台，docs/data-catalog/culture/cultural_facilities_moc.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "culture-facilities", url: "./culture/cultural_facilities_national.geojson" },
    legend: "culturalFacilities",
    popup: "culturalFacilities",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "文化部文化設施全國 787 點（類型分色）",
    topics: ["文化", "公共設施"],
  },

  culturalMuseums: {
    key: "culturalMuseums",
    section: { theme: "文化 Culture", group: "設施 Facilities" },
    label: "地方文化館 Local Museums",
    labelMobile: "地方文化館",
    expandable: true,
    color: "#b5651d",
    icon: Building2,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "local_cultural_museums_moc", confidence: "HIGH" }],
      note: "地方文化館全國 252 點（MOC，docs/data-catalog/culture/local_cultural_museums_moc.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "culture-museums", url: "./culture/local_cultural_museums_national.geojson" },
    legend: "culturalMuseums",
    popup: "culturalMuseums",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "地方文化館全國 252 點（社區型小型館舍，與文化設施分開計）",
    topics: ["文化", "館舍"],
  },

  artsEvents: {
    key: "artsEvents",
    section: { theme: "文化 Culture", group: "藝文活動 Arts & Events" },
    label: "藝文活動 Arts Events",
    labelMobile: "藝文活動",
    expandable: true,
    color: "#4d9de0",
    icon: CalendarDays,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "arts_events_moc", confidence: "HIGH" }],
      note: "藝文活動全國 6,121 點（MOC，docs/data-catalog/culture/arts_events_moc.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "culture-events", url: "./culture/arts_events_national.geojson" },
    legend: "artsEvents",
    popup: "artsEvents",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "文化部藝文活動全國 6,121 場（含展演期間，overlay filter 依當日篩選）",
    topics: ["文化", "活動", "展演"],
  },

  performingVenues: {
    key: "performingVenues",
    section: { theme: "文化 Culture", group: "藝文活動 Arts & Events" },
    label: "表演場館 Performing Venues",
    labelMobile: "表演場館",
    expandable: true,
    color: "#7c4dff",
    icon: Theater,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "performing_venues_moc", confidence: "HIGH" }],
      note: "表演場館全國 857 點（MOC，docs/data-catalog/culture/performing_venues_moc.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "culture-venues", url: "./culture/performing_venues_national.geojson" },
    legend: "performingVenues",
    popup: "performingVenues",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "表演場館全國 857 點（劇場／音樂廳／展演空間）",
    topics: ["文化", "展演", "場館"],
  },

  // 批 1 唯一 dataClass C：dynamicData 空 FeatureCollection 起手，loader 輪詢 RPC 餵入
  librarySeats: {
    key: "librarySeats",
    section: { theme: "文化 Culture", group: "即時 Realtime" },
    label: "圖書館即時座位 Library Seats",
    labelMobile: "圖書館座位",
    expandable: true,
    color: "#22c55e",
    icon: Library,
    upstream: {
      status: "pulse_only",
      datasets: [],
      note: "北市圖 6 分館即時座位 RPC（get_tpml_seat_current / 24h，realtime）已 apply 到 production（gis-platform migration 290/291）；29 閱覽區聚合成 6 marker，10min 資料/5min 輪詢。catalog dataset 條目待補（handoff pending，見 taipei-gis-analytics/docs/handoff/culture-layers.md）",
    },
    dataClass: "C",
    source: { kind: "supabase", sourceId: "library-seats", fallbackUrl: "./geo/_empty.geojson" },
    legend: "librarySeats",
    popup: "librarySeats",
    params: { count: 1, kinds: ["slider"] },
    description: "北市圖 6 分館即時空位率（29 閱覽區聚合，10 分鐘資料／5 分鐘輪詢）",
    topics: ["文化", "圖書館", "即時"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 1 —— 消防 Fire & Rescue 5 層
  //  本批 popup 漂移最密集的一組：**5 層裡 4 層的 layerType 與 key 不同名**
  //  （fireStations→fireStation / fireHydrants→fireHydrant，單複數差一個 s），
  //  而且 fireEvents 與 fireLatest **共用同一個 layerType "fireEvent"**（多對一）——
  //  兩層本來就共用 FireEventPanel。這正是 manifest 要收編的那類漂移。
  //  體質：3 層 D（無 OVERLAY_REGISTRY entry，各自 hook/factory 自行接線）。
  // ══════════════════════════════════════════════════════════════
  fireStations: {
    key: "fireStations",
    section: { theme: "消防 Fire & Rescue", group: "點位" },
    label: "消防分隊 Fire Station",
    expandable: true,
    color: "#e53935",
    icon: Truck,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "fire_stations", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "fire-stations", url: "./geo/fire_stations.geojson" },
    legend: "fireStations",
    popup: "fireStation",
    params: { count: 5, kinds: ["toggle", "toggle", "slider", "slider", "slider"] },
    description: "全台消防分隊據點（fireIsochrone 等時圈的計算起點）",
    topics: ["消防", "緊急應變"],
  },

  fireHydrants: {
    key: "fireHydrants",
    section: { theme: "消防 Fire & Rescue", group: "點位" },
    label: "消防栓 Hydrant",
    expandable: true,
    color: "#2196f3",
    icon: Droplet,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "fire_hydrants", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "fire-hydrants",
      url: "./geo/fire_hydrants.pmtiles",
      sourceLayer: "fire_hydrants",
      minzoom: 0,
      maxzoom: 12,
    },
    legend: "fireHydrants",
    popup: "fireHydrant",
    params: { count: 3, kinds: ["slider", "slider", "slider"] },
    description: "全台消防栓點位（量體大走 PMTiles 按需載入）",
    topics: ["消防", "基礎設施"],
  },

  // ⬇ 以下 3 層皆無 OVERLAY_REGISTRY entry → dataClass D（派生機制不適用），
  //   真實來源（Supabase RPC / PMTiles factory）記在 source.note。
  fireEvents: {
    key: "fireEvents",
    section: { theme: "消防 Fire & Rescue", group: "事件" },
    label: "火災歷史 Fire History",
    expandable: true,
    color: "#ff5722",
    icon: Flame,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "fire_incidents", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useFireEventsLayer 自行接線：Supabase RPC get_fire_events_by_year 按年載入，餵進自建的 fire-events-src geojson source",
    },
    legend: "fireEvents",
    popup: "fireEvent",
    params: { count: 1, kinds: ["slider"] },
    description: "歷史火災點位（需進歷史模式選年／月／日）",
    topics: ["消防", "災害", "歷史"],
  },

  fireLatest: {
    key: "fireLatest",
    section: { theme: "消防 Fire & Rescue", group: "事件" },
    label: "火災 最新年度 Latest",
    expandable: true,
    color: "#ff1744",
    icon: Flame,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "fire_incidents", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useFireLatestLayer 自行接線：與 fireEvents 同源（get_fire_event_years 取最新年再 get_fire_events_by_year），另建 fire-latest-src source 讓它不進歷史模式也常駐",
    },
    legend: "fireEvents",
    popup: "fireEvent",
    params: { count: 1, kinds: ["slider"] },
    description: "資料庫最新年度火災快照（不需切歷史模式，任何模式都可開）",
    topics: ["消防", "災害"],
  },

  fireIsochrone: {
    key: "fireIsochrone",
    section: { theme: "消防 Fire & Rescue", group: "分析" },
    label: "救援等時圈 Isochrone",
    expandable: true,
    color: "#22c55e",
    icon: Timer,
    upstream: {
      status: "pulse_only",
      datasets: [],
      derivedFromLayers: ["fireStations"],
      derivationType: "isochrone",
      processing: "OSRM 路網等時圈計算（救援抵達 ≤ 5/8/10 分鐘）— 從消防分隊出發",
      note: "FIX: 派生分析：消防分隊 + 路網救援等時圈",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "fireIsochroneLayerFactory 自行接線：public/fire/*.pmtiles（sourceLayer coverage，全國聚合 + 各縣市環差 5/10/15 分鐘共 69 features），縣市下拉走 setFilter 而非換 source",
    },
    legend: "fireIsochrone",
    popup: "fireIsochrone",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "消防分隊路網救援等時圈（5／10／15 分鐘環差，21 縣市＋全國聚合）",
    topics: ["消防", "可達性", "派生分析"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 1 —— 微型主題 4 層（都市分析 1 / 民防避難 1 / 世界 1 / 情勢剩 1）
  //  各自是所屬主題的唯一（或最後一個）成員，搬完這 4 層那 4 個主題就 100% manifest 化。
  // ══════════════════════════════════════════════════════════════
  urbanFormGrid: {
    key: "urbanFormGrid",
    section: { theme: "都市分析 Urban Analysis", group: "都市紋理" },
    label: "都市紋理網格 Urban Form",
    expandable: true,
    color: "#8d9c6b",
    icon: LayoutGrid,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "都市紋理網格 500m 145,119 格（GBA+Meta 樹冠合成，public/urban/urban_form_grid_500m.pmtiles），catalog 待建；上游 handoff 見 taipei-gis-analytics/docs/handoff/urban-form-grid.md",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "urban-form-grid",
      url: "./urban/urban_form_grid_500m.pmtiles",
      sourceLayer: "urban_form",
      minzoom: 5,
      maxzoom: 12,
    },
    legend: "urbanFormGrid",
    popup: "urbanFormGrid",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "全台 500m 都市紋理網格 145,119 格（建物密度 × 樹冠覆蓋合成指標）",
    topics: ["都市", "網格", "建物"],
  },

  // legend id 是 "policeStation" 而非自己的 key —— 它掛在警政司法民防 18 key 共用的
  // PoliceJusticeLegend 上，依拍板④取該 entry 的首個 key。批 4 搬執法治安時同一組 id。
  civilDefenseShelter: {
    key: "civilDefenseShelter",
    section: { theme: "民防避難 Civil Defense", group: "避難設施" },
    label: "防空避難 Civil Defense Shelters",
    expandable: true,
    color: "#64748b",
    icon: ShieldCheck,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "civil_defense_shelters", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "civil-defense-shelter",
      url: "./police_justice/civil_defense_shelters/civil_defense_shelters.pmtiles",
      sourceLayer: "civil_defense_shelters",
      minzoom: 10,
      maxzoom: 14,
    },
    legend: "policeStation",
    popup: "civilDefenseShelter",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台防空避難處所（量體大且僅高倍率可見，z10 起載入）",
    topics: ["民防", "避難", "防災"],
  },

  worldTrashDebris: {
    key: "worldTrashDebris",
    section: { theme: "世界 World", group: "環境" },
    label: "全球垃圾殘骸 Trash & Debris",
    labelMobile: "全球垃圾殘骸",
    expandable: true,
    color: "#f59e0b",
    icon: Trash2,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      processing: "Outerview 全球垃圾殘骸 ~25k Point（區域名 + id）；點密度反映 Mapillary 街景覆蓋，非真實垃圾分佈",
      note: "外部資料源 Outerview（CC-BY-4.0）— 非台灣開放資料 catalog，尚無 dataset_id",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useWorldTrashDebrisLayer 自行接線：靜態 public/world/trash_debris.geojson（~25k Point）自建 world-trash-debris source，未走 OVERLAY_REGISTRY",
    },
    legend: "worldTrashDebris",
    popup: "worldTrashDebris",
    params: { count: 1, kinds: ["slider"] },
    description: "Outerview 全球垃圾殘骸 ~25k 點（⚠️ 點密度是街景覆蓋度，不是垃圾分佈）",
    topics: ["世界", "環境", "垃圾"],
  },

  // ⚠️ GIS_LAYERS 裡它的 layer id 陣列是**常數引用**（PLA_ACTIVITY_CLICK_LAYERS），
  //    字面陣列解析器抓不到 → 需 extractGisConstRefTypes 才驗得出 popup 宣告為真。
  plaActivity: {
    key: "plaActivity",
    section: { theme: "情勢 Situation", group: "軍事" },
    label: "共機活動區 PLA Activity",
    expandable: true,
    color: "#38bdf8",
    icon: PlaneTakeoff,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "pla_activity", confidence: "HIGH" }],
      note: "共機活動區多邊形（spatial.pla_tracks，migration 330）。幾何由國防部每日航跡示意圖"
        + "向量化而來 — 依示意圖描繪之活動區域、非精確航跡；方法見 "
        + "taipei-gis-analytics/docs/topic-research/defense_pla/shape-extraction-methodology.md。"
        + "popup 的架次／逾越中線數值另讀 live.pla_activity_daily（同一 catalog dataset）",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "usePlaActivityLayer 自行接線：Supabase RPC get_pla_tracks_range / get_pla_activity_range 餵自建的 pla-activity source（走廊藍為 LAYER_COLORS，不規則活動區另用紫，見 plaTracksLoader.PLA_KIND_COLORS）",
    },
    legend: "plaActivity",
    popup: "plaActivity",
    params: { count: 4, kinds: ["select", "toggle", "slider", "toggle"] },
    description: "國防部每日航跡示意圖向量化的共機活動區（⚠️ 是活動區域非精確航跡）",
    topics: ["情勢", "軍事", "國防"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 2 —— 基礎建設 Infrastructure 11 層
  //  批次搬移的機械化基準線：**11/11 都是 dataClass A**（單一 geojson +
  //  OVERLAY_REGISTRY 驅動，無 pmtiles、無 dynamicData），形狀完全同構。
  //
  //  ⚠️ 兩個容易寫錯的地方：
  //  1. **合法無 legend**：11 層裡 7 層 LEGEND_REGISTRY 根本沒覆蓋（單色 POI，
  //     UX 鐵則 2 的圖例要求不適用）→ legend 照實填 `null`。判準是機械的：
  //     **key 不在 LEGEND_REGISTRY 任何 entry 的 keys 裡就是 null**，不要看圖層
  //     「感覺該有圖例」就發明一個 id —— 那會讓 Phase 3 派生出一個不存在的圖例。
  //     真的有圖例的只有 submarineCables / landingStations / govServiceOffices /
  //     publicToilets 4 層，且各自獨佔（依拍板④ legend id 退化成同名）。
  //  2. **popup 11/11 都是 key 的單數形**（postOffices→postOffice、
  //     iPostBoxes→iPostBox…）。比批 1 消防的 4/5 更整齊，也因此更危險 ——
  //     肉眼掃過去像同名，只有逐 key 反查 GIS_LAYERS 才看得出差一個 s。
  //
  //  submarineCables / landingStations 的 `params: null` 是 Phase 0 記錄的
  //  emptyByDesign（useTransportParams 寫死 `return []`），不是抽取器沒掃到。
  // ══════════════════════════════════════════════════════════════
  submarineCables: {
    key: "submarineCables",
    section: { theme: "基礎建設 Infrastructure", group: "通訊" },
    label: "通訊海纜 Submarine Cable",
    expandable: true,
    color: "#2196F3",
    icon: Cable,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "submarine_cable", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "submarine-cables", url: "./geo/submarine_cables.geojson" },
    legend: "submarineCables",
    popup: "submarineCable",
    params: null,
    description: "台灣周邊國際／國內通訊海纜路由 35 條（線層，含 glow 光暈）",
    topics: ["基礎建設", "通訊", "海纜"],
  },

  landingStations: {
    key: "landingStations",
    section: { theme: "基礎建設 Infrastructure", group: "通訊" },
    label: "海纜登陸站 Landing Station",
    expandable: true,
    color: "#26c6da",
    icon: Radio,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "submarine_cable", confidence: "LOW" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "landing-stations", url: "./geo/landing_stations.geojson" },
    legend: "landingStations",
    popup: "landingStation",
    params: null,
    description: "海纜登陸站 45 處（與海纜同一 catalog dataset，confidence LOW）",
    topics: ["基礎建設", "通訊", "海纜"],
  },

  convenienceStores: {
    key: "convenienceStores",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "超商 Convenience Store",
    expandable: true,
    color: "#26c6da",
    icon: Store,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "convenience_store", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "convenience-stores", url: "./geo/convenience_stores.geojson" },
    legend: null,
    popup: "convenienceStore",
    // ⚠️ 只有 1 個控件（Scale），沒有 Opacity —— 與同群其餘 9 層的「透明度 + 大小」
    //    兩件組不同。是實況，不要照鄰居補齊。
    params: { count: 1, kinds: ["slider"] },
    description: "全台便利商店點位（單色 POI，無圖例）",
    topics: ["基礎建設", "零售", "生活機能"],
  },

  postOffices: {
    key: "postOffices",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "郵局 Post Office",
    expandable: true,
    color: "#d32f2f",
    icon: Mail,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "post_offices", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "post-offices", url: "./civic_facilities/post_offices_national.geojson" },
    legend: null,
    popup: "postOffice",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "中華郵政郵局據點全國 1,278 處",
    topics: ["基礎建設", "郵政", "公共服務"],
  },

  iPostBoxes: {
    key: "iPostBoxes",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "i郵箱 iPost Box",
    expandable: true,
    color: "#ef6c00",
    icon: PackageCheck,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ibox", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "ipost-boxes", url: "./civic_facilities/ibox_national.geojson" },
    legend: null,
    popup: "iPostBox",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "中華郵政 i郵箱智慧包裹櫃全國 2,345 處",
    topics: ["基礎建設", "郵政", "物流"],
  },

  communityCenters: {
    key: "communityCenters",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "活動中心（部分縣市）Community Center",
    expandable: true,
    color: "#26a69a",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "community_centers", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "community-centers", url: "./civic_facilities/community_centers_national.geojson" },
    legend: null,
    popup: "communityCenter",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "村里活動中心 1,794 處（⚠️ 非全國，僅有開放資料的縣市）",
    topics: ["基礎建設", "社區", "公共服務"],
  },

  govServiceOffices: {
    key: "govServiceOffices",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "機關便民據點 Gov Service Office",
    expandable: true,
    color: "#8d6e63",
    icon: Landmark,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "gov_service_offices", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "gov-service-offices", url: "./civic_facilities/gov_service_offices_national.geojson" },
    legend: "govServiceOffices",
    popup: "govServiceOffice",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "各級機關便民服務據點全國 702 處",
    topics: ["基礎建設", "行政", "公共服務"],
  },

  publicLibraries: {
    key: "publicLibraries",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "公共圖書館 Public Library",
    expandable: true,
    color: "#5c6bc0",
    icon: BookOpen,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "public_libraries", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "public-libraries", url: "./culture/public_libraries_national.geojson" },
    legend: null,
    popup: "publicLibrary",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "公共圖書館全國 634 處（含分館；與文化主題的 librarySeats 即時座位不同層）",
    topics: ["基礎建設", "圖書館", "公共服務"],
  },

  welfareCenters: {
    key: "welfareCenters",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "社福中心 Welfare Center",
    expandable: true,
    color: "#ec407a",
    icon: HeartHandshake,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "welfare_centers", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "welfare-centers", url: "./civic_facilities/welfare_centers_national.geojson" },
    legend: null,
    popup: "welfareCenter",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "社會福利服務中心全國 157 處",
    topics: ["基礎建設", "社福", "公共服務"],
  },

  retailMarkets: {
    key: "retailMarkets",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "公有市場 Public Market",
    expandable: true,
    color: "#66bb6a",
    icon: ShoppingBasket,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "public_retail_markets", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "retail-markets", url: "./poi/public_retail_markets_national.geojson" },
    legend: null,
    popup: "retailMarket",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "公有零售市場全國 731 處",
    topics: ["基礎建設", "市場", "民生"],
  },

  publicToilets: {
    key: "publicToilets",
    section: { theme: "基礎建設 Infrastructure", group: "公共設施" },
    label: "公廁 Public Toilet",
    expandable: true,
    color: "#7e57c2",
    icon: Toilet,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "public_toilets", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "public-toilets", url: "./environment/public_toilets_national.geojson" },
    legend: "publicToilets",
    popup: "publicToilet",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "環境部列管公廁全國 13,281 座（本主題量體最大的一層）",
    topics: ["基礎建設", "公廁", "公共服務"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 2 —— 運動休閒 Sports & Leisure 6 層
  //  運動場館 5 層是**批 1 至今最徹底的多對一**（母體：運動部全國場館名冊
  //  約 15,000 點，catalog dataset sports/all_venues）：
  //    - 同一份 `./sports/all_venues.geojson`、同一個 sourceId `sports-venues`
  //      （5 個 OverlayConfig 各自 id 不同、sourceId 相同 → hydrate 只 fetch 一次，
  //      各層以 `場館類別` filter 切分，layer id 後綴見 sportsTypes.SPORTS_LAYERS）
  //    - 同一個 legend entry（id 取首個 key "sportsSchool"，拍板④家族共用形狀）
  //    - 同一個 popup layerType `"sportsVenue"` —— **5 → 1**，比批 1 消防的
  //      fireEvents/fireLatest 2 → 1 更極端。schema 一樣不需要改動。
  //    - 同一個 catalog dataset `all_venues`
  //  parksTaipei 則與這 5 層無關（自己的 source / legend / popup），只是同主題。
  //
  //  ⚠️ 色票：sportsTypes.ts 匯出的是 **category-keyed** 的 SPORTS_CATEGORY_COLOR
  //  （依「場館類別」欄位值分色），不是 layer-key-keyed 的 *_LAYER_COLORS 記錄，
  //  且 LAYER_COLORS 從未 import 它 —— 拍板①的「引用不複製」不適用，寫字面 hex。
  // ══════════════════════════════════════════════════════════════
  sportsSchool: {
    key: "sportsSchool",
    section: { theme: "運動休閒 Sports & Leisure", group: "運動場館" },
    label: "學校場館 School",
    expandable: true,
    color: "#5c6bc0",
    icon: GraduationCap,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "all_venues", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "sports-venues", url: "./sports/all_venues.geojson" },
    legend: "sportsSchool",
    popup: "sportsVenue",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "各級學校運動場館（全國場館名冊中「學校場館」類）",
    topics: ["運動", "場館", "學校"],
  },

  sportsPublicOther: {
    key: "sportsPublicOther",
    section: { theme: "運動休閒 Sports & Leisure", group: "運動場館" },
    label: "其他公共場館 Public",
    expandable: true,
    color: "#26a69a",
    icon: Activity,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "all_venues", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "sports-venues", url: "./sports/all_venues.geojson" },
    legend: "sportsSchool",
    popup: "sportsVenue",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "學校與國民運動中心以外的公共運動場館",
    topics: ["運動", "場館", "公共設施"],
  },

  sportsPrivate: {
    key: "sportsPrivate",
    section: { theme: "運動休閒 Sports & Leisure", group: "運動場館" },
    label: "民營場館 Private",
    expandable: true,
    color: "#ef6c00",
    icon: Activity,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "all_venues", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "sports-venues", url: "./sports/all_venues.geojson" },
    legend: "sportsSchool",
    popup: "sportsVenue",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "民營運動場館（健身房／球館等商業經營場地）",
    topics: ["運動", "場館", "商業"],
  },

  sportsPark: {
    key: "sportsPark",
    section: { theme: "運動休閒 Sports & Leisure", group: "運動場館" },
    label: "運動公園/開放空間 Park",
    expandable: true,
    color: "#66bb6a",
    icon: Trees,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "all_venues", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "sports-venues", url: "./sports/all_venues.geojson" },
    legend: "sportsSchool",
    popup: "sportsVenue",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "運動公園與開放空間型場地（免費開放為主）",
    topics: ["運動", "公園", "開放空間"],
  },

  sportsCenter: {
    key: "sportsCenter",
    section: { theme: "運動休閒 Sports & Leisure", group: "運動場館" },
    label: "國民運動中心 Sports Center",
    expandable: true,
    color: "#ec407a",
    icon: Building2,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "all_venues", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "sports-venues", url: "./sports/all_venues.geojson" },
    legend: "sportsSchool",
    popup: "sportsVenue",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "各縣市國民運動中心（綜合型室內場館）",
    topics: ["運動", "場館", "公共設施"],
  },

  parksTaipei: {
    key: "parksTaipei",
    section: { theme: "運動休閒 Sports & Leisure", group: "公園 Parks" },
    label: "公園 Parks",
    expandable: true,
    color: "#7cb342",
    icon: Trees,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "台北公園點位（public/urban/parks_taipei.geojson），catalog 待建",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "parks-taipei", url: "./urban/parks_taipei.geojson" },
    legend: "parksTaipei",
    popup: "parksTaipei",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "臺北市公園點位 2,917 處（公園／兒童遊戲場／綠地／鄰里公園等 7 類分色）",
    topics: ["運動", "公園", "都市綠地"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 2 —— 觀光 Tourism 11 層
  //  與基礎建設／運動休閒相反的形狀：**11/11 都有 labelMobile**（桌機標籤是
  //  `中文 English` 全稱、手機只留中文），也**11/11 popup 與 key 同名**——
  //  批 2 唯一完全沒有 popup 漂移的主題。體質仍是全 A（單一 geojson）。
  //
  //  legend 7/11 為 null（依然是機械判準：key 不在 LEGEND_REGISTRY 就是 null）。
  //  有圖例的 4 層 —— tourAttractions / tourHeritage / tourEvents / tourHotels ——
  //  恰好就是有 select 控件（分類／狀態／類別下拉）的那幾層，兩者同源：
  //  有分色維度才需要圖例。
  //
  //  ⚠️ 色票：overlayRegistry 確實從 data/tourTypes.ts 取 TOUR_*_COLOR，但那些是
  //  **category-keyed 的 match 表達式**（依 `category` / `class` 欄位值分色），
  //  不是 layer-key-keyed 的 *_LAYER_COLORS 記錄，LAYER_COLORS 也從未 import 它。
  //  hex 撞色（tourHeritage #6d4c41 = 該表「Culture」類色兼 fallback 基底、
  //  tourHotels #1976d2 = 「旅館」類色）是巧合而非同一份 SSOT ——
  //  已逐一核對過，拍板①「引用不複製」不適用，寫字面 hex。
  //
  //  tourHotSpringZones / tourScenicAreas 是本批僅有的**面層**（fill + line +
  //  glow 三個 layer），因此只有 1 個 slider（透明度預設 0.50，其餘點層是 0.85），
  //  沒有「大小」控件 —— 面沒有點半徑可調。
  // ══════════════════════════════════════════════════════════════
  tourAttractions: {
    key: "tourAttractions",
    section: { theme: "觀光 Tourism", group: "玩・自然 Nature" },
    label: "觀光景點 Attractions",
    labelMobile: "觀光景點",
    expandable: true,
    color: "#e65100",
    icon: Camera,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "attraction", confidence: "HIGH" }],
      note: "觀光景點全國 ~6,070 點（docs/data-catalog/tourism/attraction.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-attractions", url: "./tourism/attractions_national.geojson" },
    legend: "tourAttractions",
    popup: "tourAttractions",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "交通部觀光署觀光景點全國 ~6,070 點（可切「分類／熱度」兩種著色模式）",
    topics: ["觀光", "景點", "旅遊"],
  },

  tourHotSprings: {
    key: "tourHotSprings",
    section: { theme: "觀光 Tourism", group: "玩・自然 Nature" },
    label: "溫泉露頭 Hot Springs",
    labelMobile: "溫泉露頭",
    expandable: true,
    color: "#d81b60",
    icon: Droplets,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "hot_spring", confidence: "HIGH" }],
      note: "溫泉露頭全國 150 點（docs/data-catalog/tourism/hot_spring.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-hot-springs", url: "./tourism/hot_springs_national.geojson" },
    legend: null,
    popup: "tourHotSprings",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "溫泉露頭全國 150 點（單色 POI，無圖例）",
    topics: ["觀光", "溫泉", "自然"],
  },

  tourHotSpringZones: {
    key: "tourHotSpringZones",
    section: { theme: "觀光 Tourism", group: "玩・自然 Nature" },
    label: "溫泉露頭區 Hot Spring Zones",
    labelMobile: "溫泉露頭區",
    expandable: true,
    color: "#880e4f",
    icon: ThermometerSun,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "hot_spring_zone", confidence: "HIGH" }],
      note: "溫泉露頭區 16 面（docs/data-catalog/tourism/hot_spring_zone.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-hot-spring-zones", url: "./tourism/hot_spring_zones_national.geojson" },
    legend: null,
    popup: "tourHotSpringZones",
    // 面層：fill + line + glow 三個 layer，只有透明度可調（預設 0.50），無「大小」
    params: { count: 1, kinds: ["slider"] },
    description: "溫泉露頭區 16 面（面層；與點狀的 tourHotSprings 是兩份資料）",
    topics: ["觀光", "溫泉", "土地使用"],
  },

  tourScenicAreas: {
    key: "tourScenicAreas",
    section: { theme: "觀光 Tourism", group: "玩・自然 Nature" },
    label: "國家風景區 Scenic Areas",
    labelMobile: "國家風景區",
    expandable: true,
    color: "#00695c",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "scenic_area", confidence: "HIGH" }],
      note: "國家風景區 12 面（docs/data-catalog/tourism/scenic_area.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-scenic-areas", url: "./tourism/national_scenic_areas_national.geojson" },
    legend: null,
    popup: "tourScenicAreas",
    params: { count: 1, kinds: ["slider"] },
    description: "國家風景區 12 處管理處轄區範圍（面層）",
    topics: ["觀光", "風景區", "土地使用"],
  },

  tourHeritage: {
    key: "tourHeritage",
    section: { theme: "觀光 Tourism", group: "玩・人文 Heritage" },
    label: "文化資產 Heritage",
    labelMobile: "文化資產",
    expandable: true,
    color: "#6d4c41",
    icon: Castle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "heritage", confidence: "HIGH" }],
      note: "文化資產全國 2,894 點（docs/data-catalog/tourism/heritage.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-heritage", url: "./tourism/heritage_national.geojson" },
    legend: "tourHeritage",
    popup: "tourHeritage",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "文化資產全國 2,894 點（category 三類同色系分色，基底 #6d4c41）",
    topics: ["觀光", "文資", "人文"],
  },

  tourEvents: {
    key: "tourEvents",
    section: { theme: "觀光 Tourism", group: "玩・體驗 Experience" },
    label: "觀光活動・節慶 Tourism Events",
    labelMobile: "觀光活動",
    expandable: true,
    color: "#f9a825",
    icon: PartyPopper,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "activity", confidence: "HIGH" }],
      note: "觀光活動・節慶全國 ~828 點（docs/data-catalog/tourism/activity.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-events", url: "./tourism/activities_national.geojson" },
    legend: "tourEvents",
    popup: "tourEvents",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "觀光活動・節慶全國 ~828 場（狀態下拉：全部／進行中／未開始，依當日判定）",
    topics: ["觀光", "活動", "節慶"],
  },

  tourFactories: {
    key: "tourFactories",
    section: { theme: "觀光 Tourism", group: "玩・體驗 Experience" },
    label: "觀光工廠 Tourism Factories",
    labelMobile: "觀光工廠",
    expandable: true,
    color: "#546e7a",
    icon: Factory,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "tourism_factory", confidence: "HIGH" }],
      note: "觀光工廠全國 158 點（docs/data-catalog/tourism/tourism_factory.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-factories", url: "./tourism/tourism_factories_national.geojson" },
    legend: null,
    popup: "tourFactories",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "經濟部認證觀光工廠全國 158 家",
    topics: ["觀光", "工廠", "體驗"],
  },

  tourAmusementParks: {
    key: "tourAmusementParks",
    section: { theme: "觀光 Tourism", group: "玩・體驗 Experience" },
    label: "民營遊樂園 Amusement Parks",
    labelMobile: "民營遊樂園",
    expandable: true,
    color: "#00acc1",
    icon: FerrisWheel,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "amusement_park", confidence: "HIGH" }],
      note: "民營遊樂園全國 26 點（docs/data-catalog/tourism/amusement_park.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-amusement-parks", url: "./tourism/amusement_parks_national.geojson" },
    legend: null,
    popup: "tourAmusementParks",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "民營觀光遊樂業全國 26 家",
    topics: ["觀光", "遊樂園", "體驗"],
  },

  tourCamping: {
    key: "tourCamping",
    section: { theme: "觀光 Tourism", group: "玩・體驗 Experience" },
    label: "露營場 Campgrounds",
    labelMobile: "露營場",
    expandable: true,
    color: "#7cb342",
    icon: Tent,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "camping", confidence: "HIGH" }],
      note: "露營場全國 1,737 點（docs/data-catalog/tourism/camping.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-camping", url: "./tourism/camping_national.geojson" },
    legend: null,
    popup: "tourCamping",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "露營場全國 1,737 處",
    topics: ["觀光", "露營", "戶外"],
  },

  tourHotels: {
    key: "tourHotels",
    section: { theme: "觀光 Tourism", group: "住・食 Stay & Eat" },
    label: "旅宿 Hotels & B&Bs",
    labelMobile: "旅宿",
    expandable: true,
    color: "#1976d2",
    icon: BedDouble,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "hotel", confidence: "HIGH" }],
      note: "旅宿全國 ~15,654 點（docs/data-catalog/tourism/hotel.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-hotels", url: "./tourism/hotels_national.geojson" },
    legend: "tourHotels",
    popup: "tourHotels",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "旅宿全國 ~15,654 家（國際觀光旅館／一般觀光旅館／旅館／民宿 4 類分色）",
    topics: ["觀光", "旅宿", "住宿"],
  },

  tourRestaurants: {
    key: "tourRestaurants",
    section: { theme: "觀光 Tourism", group: "住・食 Stay & Eat" },
    label: "觀光餐飲 Restaurants",
    labelMobile: "觀光餐飲",
    expandable: true,
    color: "#c62828",
    icon: UtensilsCrossed,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "restaurant", confidence: "HIGH" }],
      note: "觀光餐飲全國 ~3,688 點（docs/data-catalog/tourism/restaurant.md）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "tour-restaurants", url: "./tourism/restaurants_national.geojson" },
    legend: null,
    popup: "tourRestaurants",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "觀光署收錄餐飲店家全國 ~3,688 家（非全國餐飲母體）",
    topics: ["觀光", "餐飲", "美食"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 3 —— 教育 Education 17 層
  //  **17/17 都有 labelMobile**（桌機 `中文 English`、手機改成「中文 (筆數)」——
  //  與觀光的「手機只留中文」不同款：這裡手機版反而多帶一個數量）。
  //
  //  ⚠️ 色票走拍板①「引用不複製」：EDUCATION_LAYER_COLORS 是 layer-key-keyed 且
  //  **正在餵 LAYER_COLORS**（layerCatalog 原本是 `...EDUCATION_LAYER_COLORS` 一行
  //  spread），同時也餵 overlayRegistry 的 paint 與 LegendPanel —— 三邊共用的 SSOT。
  //  唯一例外是總覽層 `schools`：它不在該常數裡（色票在 layerCatalog 上方的字面
  //  `#42a5f5`，與 6 個學制層的分色體系無關）→ 寫字面 hex。
  //
  //  popup 是目前最密集的**多對一**：`school` 一個 layerType 對 7 個 layer
  //  （schools + 5 個 eduSchool* + eduRemoteSchools，同一份 schools.geojson 的
  //  filter 切分）、`eduCampus` 對 2、`eduDistrictK12` 對 2。批 1 消防的
  //  fireEvents/fireLatest 已證明 schema 不用改，這裡只是規模更大。
  //
  //  legend **17/17 全部是同一個 id `schools`** —— LEGEND_REGISTRY 只有一筆
  //  entry 覆蓋整個教育主題（首個 key = schools），批 1 拍板④的「家族共用」形狀。
  //
  //  dataClass A 12 / B 5（eduCampusPolygon・eduCampusArea・eduDistrictElementary・
  //  eduDistrictJunior・eduCramSchool）。三組共用 sourceId 只下載一次
  //  （edu-schools ×7、edu-campus ×2、edu-district-k12 ×2）—— 同批 2 運動場館的形狀，
  //  契約測試按 `id` 過濾不受影響。
  // ══════════════════════════════════════════════════════════════
  schools: {
    key: "schools",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "學校總覽 All Schools",
    labelMobile: "學校總覽 (4,315)",
    expandable: true,
    // ⚠️ 不在 EDUCATION_LAYER_COLORS 裡：總覽層沿用搬進教育主題前的舊色
    color: "#42a5f5",
    icon: GraduationCap,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson（4,315 點）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "全國各級學校 4,315 點總覽（依學制上色，可切「分級配色」）",
    topics: ["教育", "學校", "公共設施"],
  },

  eduSchoolElementary: {
    key: "eduSchoolElementary",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "國小 Elementary",
    labelMobile: "國小 (2,656)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduSchoolElementary,
    icon: School,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson — 國小 2,656（含附設國小 42）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "國小 2,656 校（含附設國小 42；schools.geojson 依學制 filter 切出）",
    topics: ["教育", "學校", "國小"],
  },

  eduSchoolJunior: {
    key: "eduSchoolJunior",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "國中 Junior High",
    labelMobile: "國中 (964)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduSchoolJunior,
    icon: School,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson — 國中 964（含附設國中 228）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "國中 964 校（含附設國中 228）",
    topics: ["教育", "學校", "國中"],
  },

  eduSchoolSenior: {
    key: "eduSchoolSenior",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "高中職 Senior High",
    labelMobile: "高中職 (508)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduSchoolSenior,
    icon: School,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson — 高中職 508",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "高中職 508 校",
    topics: ["教育", "學校", "高中職"],
  },

  eduSchoolUniversity: {
    key: "eduSchoolUniversity",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "大專 University",
    labelMobile: "大專 (159)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduSchoolUniversity,
    icon: University,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson — 大專 159（含空大進修 10／宗教研修 9）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "大專校院 159 校（含空大進修 10／宗教研修 9）",
    topics: ["教育", "學校", "大專"],
  },

  eduSchoolSpecial: {
    key: "eduSchoolSpecial",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "特教 Special Education",
    labelMobile: "特教 (28)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduSchoolSpecial,
    icon: Accessibility,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson — 特教 28",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "特殊教育學校 28 校",
    topics: ["教育", "學校", "特教"],
  },

  eduRemoteSchools: {
    key: "eduRemoteSchools",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "偏遠地區學校 Remote Schools",
    labelMobile: "偏遠地區學校 (1,152)",
    expandable: true,
    // 偏遠三級（偏遠／特偏／極偏）的中間色代表整層，見 educationTypes.ts
    color: EDUCATION_LAYER_COLORS.eduRemoteSchools,
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "schools", confidence: "HIGH" }],
      note: "第 38 主題 education；6 個點層共用同一份 schools.geojson — region_type 非 null 的 1,152 校（偏遠 830／特偏 192／極偏 130）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-schools", url: "./education/schools.geojson" },
    legend: "schools",
    popup: "school",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "偏遠地區學校 1,152 校（偏遠 830／特偏 192／極偏 130；非偏遠是 JSON null 不是 0）",
    topics: ["教育", "學校", "偏鄉"],
  },

  eduUniversityStudents: {
    key: "eduUniversityStudents",
    section: { theme: "教育 Education", group: "學校 Schools" },
    label: "大專學生數 University Students",
    labelMobile: "大專學生數 (159)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduUniversityStudents,
    icon: BarChart3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "university_students", confidence: "HIGH" }],
      note: "第 38 主題 education；大專校別學生數 159 點 bubble — ⚠️ **英文欄位**；🔴 21 筆 students_total 為 null（進修學院/空大 10 歸母校、宗教研修 9 不在統計、停辦改名 2），不可當 0",
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "edu-university-students",
      url: "./education/university_students.geojson",
    },
    legend: "schools",
    popup: "eduUniversityStudents",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "大專校別學生數 159 點 bubble（半徑隨學生數；21 筆為 null 不可當 0）",
    topics: ["教育", "大專", "統計"],
  },

  eduCampusPolygon: {
    key: "eduCampusPolygon",
    section: { theme: "教育 Education", group: "校地 Campus" },
    label: "校地範圍 Campus Area",
    labelMobile: "校地範圍 (4,324)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduCampusPolygon,
    icon: LandPlot,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "campus_polygon", confidence: "HIGH" }],
      note: "第 38 主題 education；校地面 4,336 → 前端濾掉 non_school 12 筆後渲染 4,324（PMTiles z8-15）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "edu-campus",
      url: "./education/campus_polygon.pmtiles",
      sourceLayer: "campus_polygon",
      minzoom: 8,
      maxzoom: 15,
    },
    legend: "schools",
    popup: "eduCampus",
    params: { count: 1, kinds: ["slider"] },
    description: "校地範圍面 4,324（依學制分色；與 eduCampusArea 同一份切片的兩種讀法）",
    topics: ["教育", "校地", "土地使用"],
  },

  eduCampusArea: {
    key: "eduCampusArea",
    section: { theme: "教育 Education", group: "校地 Campus" },
    label: "校地面積 Campus Size",
    labelMobile: "校地面積 (4,324)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduCampusArea,
    icon: Grid3x3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "campus_polygon", confidence: "HIGH" }],
      note: "第 38 主題 education；與 eduCampusPolygon **同源同切片**（campus_polygon.pmtiles，同一個 sourceId 只下載一次），按 area_ha 分 5 級的另一種讀法 —— 那層按學制分色，本層是面積面量圖（< 1 / 1~2 / 2~5 / 5~10 / ≥ 10 公頃，合計 4,324）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "edu-campus",
      url: "./education/campus_polygon.pmtiles",
      sourceLayer: "campus_polygon",
      minzoom: 8,
      maxzoom: 15,
    },
    legend: "schools",
    popup: "eduCampus",
    params: { count: 1, kinds: ["slider"] },
    description: "校地面積面量圖（< 1 / 1~2 / 2~5 / 5~10 / ≥ 10 公頃，合計 4,324）",
    topics: ["教育", "校地", "面量圖"],
  },

  eduDistrictElementary: {
    key: "eduDistrictElementary",
    section: { theme: "教育 Education", group: "學區 District" },
    label: "國小學區 Elementary District",
    labelMobile: "國小學區 (621)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduDistrictElementary,
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "school_district_k12", confidence: "HIGH" }],
      note: "第 38 主題 education；國小學區 621 面（PMTiles z6-13）— 僅臺北／新北／臺中／新竹市 4 縣市有公告，另 11 縣市無資料 ≠ 無學區；臺北為 110 學年度",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "edu-district-k12",
      url: "./education/school_district_k12.pmtiles",
      sourceLayer: "school_district_k12",
      minzoom: 6,
      maxzoom: 13,
    },
    legend: "schools",
    // ⚠️ 與 eduDistrictJunior 共用同一個 layerType（一份切片、level filter 切分）
    popup: "eduDistrictK12",
    params: { count: 1, kinds: ["slider"] },
    description: "國小學區 621 面（僅 4 縣市有公告，無資料 ≠ 無學區）",
    topics: ["教育", "學區", "里界"],
  },

  eduDistrictJunior: {
    key: "eduDistrictJunior",
    section: { theme: "教育 Education", group: "學區 District" },
    label: "國中學區 Junior High District",
    labelMobile: "國中學區 (239)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduDistrictJunior,
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "school_district_k12", confidence: "HIGH" }],
      note: "第 38 主題 education；國中學區 239 面，與國小層共用同一份 PMTiles — 僅 4 縣市有公告；precision=village_partial 654 面為整里近似（實際看 popup 的 lin_specs）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "edu-district-k12",
      url: "./education/school_district_k12.pmtiles",
      sourceLayer: "school_district_k12",
      minzoom: 6,
      maxzoom: 13,
    },
    legend: "schools",
    popup: "eduDistrictK12",
    params: { count: 1, kinds: ["slider"] },
    description: "國中學區 239 面（village_partial 654 面為整里近似）",
    topics: ["教育", "學區", "里界"],
  },

  eduDistrictSenior: {
    key: "eduDistrictSenior",
    section: { theme: "教育 Education", group: "學區 District" },
    label: "高中就學區（縣市級）Senior High District",
    labelMobile: "高中就學區・縣市級 (15)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduDistrictSenior,
    icon: Shapes,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "school_district_senior", confidence: "HIGH" }],
      note: "第 38 主題 education；高中就學區 15 面 —— **縣市級**，與國中小學區的**里級**粒度不同，不可互相比較或合併",
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "edu-district-senior",
      url: "./education/school_district_senior.geojson",
    },
    legend: "schools",
    popup: "eduDistrictSenior",
    params: { count: 1, kinds: ["slider"] },
    description: "高中就學區 15 面（縣市級，與國中小學區的里級粒度不可混用）",
    topics: ["教育", "學區", "縣市界"],
  },

  eduKindergarten: {
    key: "eduKindergarten",
    section: { theme: "教育 Education", group: "幼托補習 Childcare & Cram" },
    label: "幼兒園 Kindergarten",
    labelMobile: "幼兒園 (6,689)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduKindergarten,
    icon: Baby,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "kindergartens", confidence: "HIGH" }],
      note: "第 38 主題 education；幼兒園 6,689 點（公立 2,392／私立 4,297）— 原始中文欄位名；`縣市名稱`／`地址` 全數帶 [NN] 代碼前綴（geocode 需要，顯示端才去掉）",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-kindergarten", url: "./education/kindergartens.geojson" },
    legend: "schools",
    popup: "eduKindergarten",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "幼兒園 6,689 點（公立 2,392／私立 4,297，依公私立分色）",
    topics: ["教育", "幼托", "學前"],
  },

  eduCramSchool: {
    key: "eduCramSchool",
    section: { theme: "教育 Education", group: "幼托補習 Childcare & Cram" },
    label: "短期補習班 Cram School",
    labelMobile: "短期補習班 (17,137)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduCramSchool,
    icon: BookOpen,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cram_schools", confidence: "HIGH" }],
      note: "第 38 主題 education；短期補習班 17,137 點（PMTiles z8-15）— ⚠️ 上游 daily 更新，前端是 2026-08-07 快照；🔴 `各地短期補習班數量` 欄是全國總數 17772 不是縣市數，popup 禁顯示",
    },
    // 本主題點數之最（17,137）→ 切 PMTiles，透明度／大小 slider 與其餘幼托三層分開
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "edu-cram",
      url: "./education/cram_schools.pmtiles",
      sourceLayer: "cram_schools",
      minzoom: 8,
      maxzoom: 15,
    },
    legend: "schools",
    popup: "eduCramSchool",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "短期補習班 17,137 點（依類別分色；上游 daily 更新，前端為快照）",
    topics: ["教育", "補習", "幼托"],
  },

  eduAfterschoolCare: {
    key: "eduAfterschoolCare",
    section: { theme: "教育 Education", group: "幼托補習 Childcare & Cram" },
    label: "兒童課後照顧中心 Afterschool Care",
    labelMobile: "兒童課後照顧 (782)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduAfterschoolCare,
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "afterschool_care", confidence: "HIGH" }],
      note: "第 38 主題 education；兒童課後照顧服務中心 782 點 — schema 與幼兒園不同（`名稱`／`縣市`）；`立案時間` 是民國 YYYMMDD",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-afterschool", url: "./education/afterschool_care.geojson" },
    legend: "schools",
    popup: "eduAfterschoolCare",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "兒童課後照顧服務中心 782 點（單色 POI）",
    topics: ["教育", "幼托", "課後照顧"],
  },

  eduMutualCare: {
    key: "eduMutualCare",
    section: { theme: "教育 Education", group: "幼托補習 Childcare & Cram" },
    label: "互助教保服務中心 Mutual Care",
    labelMobile: "互助教保 (148)",
    expandable: true,
    color: EDUCATION_LAYER_COLORS.eduMutualCare,
    icon: HeartHandshake,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "mutual_care", confidence: "HIGH" }],
      note: "第 38 主題 education；職場／社區互助教保服務中心 148 點 — 欄位與幼兒園幾乎相同（代碼欄名為 `學校代碼`），popup 共用同一個 panel",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "edu-mutual-care", url: "./education/mutual_care.geojson" },
    legend: "schools",
    popup: "eduMutualCare",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "職場／社區互助教保服務中心 148 點（全數私立）",
    topics: ["教育", "幼托", "互助教保"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 3 —— 林業 Forestry 16 層
  //  與同批教育**幾乎每個維度都相反**，一批之內就撞完兩極：
  //    labelMobile 教育 17/17，林業只有 mountainHuts / hikingTrails 2/16；
  //    popup 教育是「多個 key 擠進一個 layerType」，林業是**依幾何型別分類**——
  //    `forestryPolygon`(3) / `forestryPOI`(8) / `forestryLine`(1) 三個泛型
  //    layerType 吃掉 12 層，另外 3 層各有專屬（canopyGiants / mountainHut /
  //    hikingTrails），canopyHeight 是 raster **完全沒有 popup**（本批唯一 null）。
  //
  //  legend：14 層共用 `forestCompartments`（LEGEND_REGISTRY 一筆 entry 覆蓋
  //  整個林業主題），canopyHeight / canopyGiants 各自獨佔。本批 0 層 legend: null。
  //
  //  ⚠️ 色票：本主題**沒有**餵 LAYER_COLORS 的 `*_LAYER_COLORS` 常數
  //  （forestReserveTypes 的 FOREST_RESERVE_TYPE_MATCH 依保安林類別、
  //  canopyGiantsTypes 依距離帶，都是 category-keyed 的表達式，LAYER_COLORS
  //  從未 import）→ 照批 2 判準寫字面 hex，不引用。
  //
  //  dataClass A 11 / B 5。B 的 5 層（forestCompartments・forestReserve・
  //  forestRoads・hikingTrails・canopyHeight）已核對 scripts/deploy 的
  //  upload-deploy-assets.sh 清單（觸點 #20）全數在列。canopyHeight 是 raster
  //  PMTiles，**沒有 sourceLayer**（其餘 4 層有）—— source 欄位的 optional
  //  sourceLayer 正是為這種形狀留的。
  // ══════════════════════════════════════════════════════════════
  forestCompartments: {
    key: "forestCompartments",
    section: { theme: "林業 Forestry", group: "分區" },
    label: "林班 Compartments",
    expandable: true,
    color: "#15803D",
    icon: Trees,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "national_forest_compartments", confidence: "HIGH" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "forest-compartments",
      url: "./forestry/national_forest_compartments.pmtiles",
      sourceLayer: "national_forest_compartments",
      minzoom: 0,
      maxzoom: 13,
    },
    legend: "forestCompartments",
    popup: "forestryPolygon",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "國有林事業區林班界（面層切片）",
    topics: ["林業", "林班", "土地使用"],
  },

  forestReserve: {
    key: "forestReserve",
    section: { theme: "林業 Forestry", group: "分區" },
    label: "保安林 Reserve",
    expandable: true,
    color: "#0F766E",
    icon: Shield,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "forest_reserve", confidence: "HIGH" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "forest-reserve",
      url: "./forestry/forest_reserve.pmtiles",
      sourceLayer: "forest_reserve",
      minzoom: 0,
      maxzoom: 13,
    },
    legend: "forestCompartments",
    popup: "forestryPolygon",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "保安林編號區（依保安林種類分色，見 forestReserveTypes.ts）",
    topics: ["林業", "保安林", "土地使用"],
  },

  forestRecreation: {
    key: "forestRecreation",
    section: { theme: "林業 Forestry", group: "分區" },
    label: "森林遊樂區 Recreation",
    expandable: true,
    color: "#65A30D",
    icon: TreePine,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "forest_recreation_areas", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-recreation",
      url: "./forestry/forest_recreation_areas.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPolygon",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "國家森林遊樂區範圍（面層）",
    topics: ["林業", "遊樂區", "觀光"],
  },

  forestFlatParks: {
    key: "forestFlatParks",
    section: { theme: "林業 Forestry", group: "分區" },
    label: "平地森林 Flat Parks",
    expandable: true,
    color: "#A3E635",
    icon: Sprout,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "flat_forest_parks", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-flat-parks",
      url: "./forestry/flat_forest_parks.geojson",
    },
    legend: "forestCompartments",
    // 雖列在「分區」子群，資料實為點位 → popup 走 forestryPOI 而非 forestryPolygon
    popup: "forestryPOI",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "平地森林園區點位",
    topics: ["林業", "平地森林", "公共設施"],
  },

  canopyHeight: {
    key: "canopyHeight",
    section: { theme: "林業 Forestry", group: "分區" },
    label: "樹冠高度 Canopy Height",
    expandable: true,
    color: "#33691e",
    icon: Ruler,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "全台樹冠高度 raster PMTiles（Meta/WRI 2020 10m，public/forestry/canopy_height_taiwan.pmtiles），catalog 待建",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "canopy-height",
      url: "./forestry/canopy_height_rgb_taiwan.pmtiles",
      // raster 切片沒有 vector sourceLayer —— 本批唯一一筆
      minzoom: 6,
      maxzoom: 12,
    },
    legend: "canopyHeight",
    // 本批唯一沒有可點選物件的層（raster，GIS_LAYERS 無條目）
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "全台樹冠高度 raster（Meta/WRI 2020 10m，RGB 編碼切片）",
    topics: ["林業", "樹冠", "遙測"],
  },

  canopyGiants: {
    key: "canopyGiants",
    section: { theme: "林業 Forestry", group: "分區" },
    label: "樹冠巨木 Canopy Giants",
    expandable: true,
    color: "#a50026",
    icon: TreePine,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "樹冠 45m+ 巨木 GeoJSON（Meta/WRI 樹冠高度 10m × 可及性分析衍生，public/forestry/canopy_giants_taiwan.geojson），衍生資料無 catalog 來源",
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "canopy-giants",
      url: "./forestry/canopy_giants_taiwan.geojson",
    },
    legend: "canopyGiants",
    popup: "canopyGiants",
    params: { count: 1, kinds: ["slider"] },
    description: "樹冠 45m 以上巨木點位（依離步道距離帶分色，見 canopyGiantsTypes.ts）",
    topics: ["林業", "巨木", "衍生分析"],
  },

  forestTreatmentWorks: {
    key: "forestTreatmentWorks",
    section: { theme: "林業 Forestry", group: "點位" },
    label: "治理工程 Treatment Works",
    expandable: true,
    color: "#F59E0B",
    icon: Hammer,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "forestry_treatment_works", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-treatment-works",
      url: "./forestry/forestry_treatment_works.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "林業治理工程點位（崩塌地治理／野溪整治等）",
    topics: ["林業", "治理工程", "防災"],
  },

  forestTrailSigns: {
    key: "forestTrailSigns",
    section: { theme: "林業 Forestry", group: "點位" },
    label: "步道路標 Trail Signs",
    expandable: true,
    color: "#84CC16",
    icon: MapPin,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "mountain_trail_signs", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-trail-signs",
      url: "./forestry/mountain_trail_signs.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "山區步道路標點位（與山屋／通訊點疊圖 = 登山安全敘事）",
    topics: ["林業", "步道", "登山"],
  },

  forestSignalPoints: {
    key: "forestSignalPoints",
    section: { theme: "林業 Forestry", group: "點位" },
    label: "通訊點 Signal Points",
    expandable: true,
    color: "#22C55E",
    icon: Signal,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "mountain_signal_points", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-signal-points",
      url: "./forestry/mountain_signal_points.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "山區手機通訊可用點位（登山安全用）",
    topics: ["林業", "通訊", "登山"],
  },

  forestEducationCenters: {
    key: "forestEducationCenters",
    section: { theme: "林業 Forestry", group: "點位" },
    label: "自然教育中心 Education",
    expandable: true,
    color: "#0EA5E9",
    icon: GraduationCap,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "forest_education_centers", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-education-centers",
      url: "./forestry/forest_education_centers.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "林業保育署自然教育中心點位",
    topics: ["林業", "環境教育", "公共設施"],
  },

  mountainHuts: {
    key: "mountainHuts",
    section: { theme: "林業 Forestry", group: "點位" },
    label: "山屋・高山營地 Mountain Huts",
    labelMobile: "山屋・營地 (136)",
    expandable: true,
    color: "#ec4899",
    icon: Tent,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "mountain_huts", confidence: "HIGH" }],
      processing: "官方玉山國家公園 30 × OSM 126 走 trust chain（250m + 名稱 0.55）跨源命中 20，合成 136 實體；OSM 部分 ODbL",
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "mountain-huts", url: "./forestry/mountain_huts.geojson" },
    legend: "forestCompartments",
    popup: "mountainHut",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "山屋・高山營地 136 處（官方 30 × OSM 126 跨源合成）",
    topics: ["林業", "山屋", "登山"],
  },

  forestDamLakes: {
    key: "forestDamLakes",
    section: { theme: "林業 Forestry", group: "點位" },
    label: "堰塞湖 Dam Lakes",
    expandable: true,
    color: "#06B6D4",
    icon: Waves,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "dam_lakes_in_forest", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-dam-lakes",
      url: "./forestry/dam_lakes_in_forest.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "林區內堰塞湖點位（崩塌堵塞形成，土砂災害關聯）",
    topics: ["林業", "堰塞湖", "防災"],
  },

  forestRoads: {
    key: "forestRoads",
    section: { theme: "林業 Forestry", group: "線" },
    label: "林道 Forest Roads",
    expandable: true,
    color: "#A16207",
    icon: Route,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "forest_roads", confidence: "HIGH" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "forest-roads",
      url: "./forestry/forest_roads.pmtiles",
      sourceLayer: "forest_roads",
      minzoom: 0,
      maxzoom: 14,
    },
    legend: "forestCompartments",
    // 本批唯一的 forestryLine（線層專屬 layerType）
    popup: "forestryLine",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台林道線形（切片，z0-14）",
    topics: ["林業", "林道", "路網"],
  },

  forestAlishanRail: {
    key: "forestAlishanRail",
    section: { theme: "林業 Forestry", group: "線" },
    label: "阿里山鐵路 Alishan Rail",
    expandable: true,
    color: "#92400E",
    icon: TrainFront,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "wildlife_distribution_3rd_alt", confidence: "HIGH" }],
    },
    dataClass: "A",
    // ⚠️ 檔名與 datasetId 都是 wildlife_distribution_3rd_alt（與圖層標題不符），
    //    且渲染成 circle 走 forestryPOI —— 照現況登記，上游對應待另案釐清
    source: {
      kind: "geojson",
      sourceId: "forest-alishan-rail",
      url: "./forestry/wildlife_distribution_3rd_alt.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "阿里山林業鐵路相關點位（資料檔為 wildlife_distribution_3rd_alt，上游對應待釐清）",
    topics: ["林業", "鐵道", "文化資產"],
  },

  hikingTrails: {
    key: "hikingTrails",
    section: { theme: "林業 Forestry", group: "線" },
    label: "全台步道 Hiking Trails",
    labelMobile: "全台步道 Hiking Trails (7,339)",
    expandable: true,
    color: "#d62728",
    icon: Footprints,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "mountain_trail_signs", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "hiking-trails",
      url: "./forestry/hiking_trails.pmtiles",
      sourceLayer: "hiking_trails",
      minzoom: 0,
      maxzoom: 13,
    },
    legend: "forestCompartments",
    popup: "hikingTrails",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台步道 7,339 條線形（glow + line 兩個 layer）",
    topics: ["林業", "步道", "登山"],
  },

  forestWildlife: {
    key: "forestWildlife",
    section: { theme: "林業 Forestry", group: "生態" },
    label: "野生動物分布 Wildlife",
    expandable: true,
    color: "#A855F7",
    icon: PawPrint,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "wildlife_distribution_3rd", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "forest-wildlife",
      url: "./forestry/wildlife_distribution_3rd.geojson",
    },
    legend: "forestCompartments",
    popup: "forestryPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "第三次野生動物分布調查點位",
    topics: ["林業", "生態", "野生動物"],
  },
} satisfies Partial<Record<keyof LayerVisibility, LayerManifestEntry>>;

/** 已收進 manifest 的 key（literal union）—— 下游手寫表用它 Omit 出「還沒搬的」 */
export type ManifestKey = keyof typeof LAYER_MANIFEST;

/** runtime 用的 key 清單（測試與派生 helper 共用） */
export const MANIFEST_KEYS = Object.keys(LAYER_MANIFEST) as ManifestKey[];

// ── 派生 helper：下游表用這些函式取值，不要各自 reach into LAYER_MANIFEST ──

/** LAYER_COLORS 的 manifest 分片 */
export function manifestColors(): Record<ManifestKey, string> {
  return Object.fromEntries(
    MANIFEST_KEYS.map((k) => [k, LAYER_MANIFEST[k].color]),
  ) as Record<ManifestKey, string>;
}

/** LAYER_ICONS 的 manifest 分片 */
export function manifestIcons(): Record<ManifestKey, LucideIcon> {
  return Object.fromEntries(
    MANIFEST_KEYS.map((k) => [k, LAYER_MANIFEST[k].icon]),
  ) as Record<ManifestKey, LucideIcon>;
}

/** UPSTREAM_REGISTRY 的 manifest 分片 */
export function manifestUpstream(): Record<ManifestKey, UpstreamRef> {
  return Object.fromEntries(
    MANIFEST_KEYS.map((k) => [k, LAYER_MANIFEST[k].upstream]),
  ) as Record<ManifestKey, UpstreamRef>;
}
