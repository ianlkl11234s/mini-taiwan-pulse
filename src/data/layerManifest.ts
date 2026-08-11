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
  // 🏢 房地產（Building2 / MapPin 已在上方 import 復用）
  Coins,
  // 🏥 醫療（Accessibility / Activity 已在上方 import 復用）
  Hospital, Stethoscope, Pill, HeartPulse, Clock, AlertCircle,
  // 👮 執法治安（Timer / Sparkles / PlaneTakeoff / AlertCircle 已在上方 import 復用）
  ShieldAlert, AlertTriangle, Crosshair, Hexagon, Gavel, Scale, Lock, MapPinned,
  Search, Anchor,
  // 👥 人口社經（Users / Activity / BarChart3 / Store 已在上方 import 復用）
  Bike,
  // 🌍 全球氣候（Waves / AlertTriangle 已在上方 import 復用）
  Tornado, Wind, Cloud,
  // 📍 底圖（MapPinned / Mountain / Building2 / Map / Sprout / Route 已在上方 import 復用）
  // ⚠️ 災害（Waves / TrainFront / AlertTriangle / Activity / Mountain 已在上方 import 復用）
  Lightbulb, CloudRain, Rewind, CloudLightning, Atom,
  // 🛰️ 太空（16 層共用同一顆 icon）
  Satellite,
  // 🌤️ 環境氣候（Cloud / CloudRain / Grid3x3 / ThermometerSun / Wind / Activity /
  //    AlertTriangle / AlertCircle / TreePine / Sprout / Waves 已在上方 import 復用）
  CloudSun, Thermometer, CircleDot, Car, Biohazard, TreePalm, TreeDeciduous, Flower2,
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

/**
 * 單一 OVERLAY_REGISTRY config 的來源描述。形狀跟著 dataClass 走 ——
 * 測試會驗它與 OVERLAY_REGISTRY 對得上。
 *
 * ⚠️ 少數 key 在 OVERLAY_REGISTRY 有**多筆同 id 的 config**（`propertyValueGrid` 三尺度、
 *    `stationsTRA` / `waterRivers` / `waterReservoirs` 各 2 筆）——那些 entry 的 `source`
 *    寫成 `LayerSource[]`，見 `LayerManifestEntry.source`。
 *    ⚠️ 多筆的 `kind` **不保證同質**（`waterReservoirs` = pmtiles 面 + geojson 壩體點）。
 *    共用 `sourceId`（教育 edu-schools ×7、運動場館 ×5）是**完全不同的事**：
 *    那是多個 key 各自一筆 config 指向同一份資料，仍寫單數形。
 */
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
  /**
   * 單一 config → 寫單數形；**同 key 多 config** → 寫陣列，且**順序必須與
   * OVERLAY_REGISTRY 內的出現順序相同**（測試逐位對齊比對）。
   * 順序是 load-bearing：它決定 layer 疊放，Phase 3 由 manifest 派生 `GIS_LAYERS`
   * 時又是 first-hit-wins，重排會靜默改掉點擊命中的那一層。
   * `kind:"custom"` 無 registry entry 可多配，只能單數形。
   *
   * ⚠️ **陣列各元素的 `kind` 不保證同質**（批 6 `waterReservoirs` 證偽了原本的同質假設：
   * 水庫面是 PMTiles、壩體點是 GeoJSON，同一個 toggle 兩種載入路徑）。
   * `dataClass` 只有一個值，混合時取**上線路徑最重**的那個：
   * `pmtiles → B` ＞ `supabase → C` ＞ `geojson → A`
   * （B 背著 nginx location + deploy 清單的義務，漏了會 404；A 只是一支 fetch）。
   * 用 precedence 而非「首元素的 kind」是因為 precedence 與陣列順序無關 ——
   * 順序服務的是疊放語意，不該連帶決定體質。
   */
  source: LayerSource | LayerSource[];
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
   *
   * **一個 key 對多個 layerType** → 寫陣列，且**順序必須與 GIS_LAYERS 的出現順序相同**
   * （測試逐位對齊比對）。`earthquakeReplay` 是首例：同一個 toggle 建出 5 個 layer，
   * 其中測站點（`eq-replay-station-circle` → `earthquakeReplayStation`）與鄉鎮面
   * （`eq-replay-town-fill` → `earthquakeReplayTown`）**各自有 GIS_LAYERS 條目、
   * 各自有 panel 元件**。只宣告一個 = 已知為假，Phase 3 依 popup 派生 GIS_LAYERS 時
   * 會靜默丟掉另一個的接線。
   *
   * ⚠️ 順序 load-bearing 但**不代表相鄰**：GIS_LAYERS 是 first-hit-wins，
   * 點層排在前段、大面積面層刻意排在末段（earthquakeReplay 兩筆分別在第 90 / 286 列），
   * 陣列只保證兩者的相對先後，Phase 3 派生仍需要 README 已登記的 `clickPriority` 欄位。
   */
  popup: FeatureInfo["layerType"] | FeatureInfo["layerType"][] | null;
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
 * 🛰️ 太空 16 層**共用同一份 source.note**（不是為了省字：它們真的是同一套實作 ——
 * 一個 hook、三個 source、五個 layer，16 個 toggle 只是 `cat` 欄位的 filter）。
 * 各層自己的差異只在 color / label / description，寫在各自 entry。
 */
const SAT_SOURCE_NOTE =
  "useSatellitesLayer 單一實作服務全部 16 個 toggle：Supabase view satellite_classified 取 TLE（localStorage cache 6h）→ satellite.js SGP4 逐秒推算 → 3 個自建 geojson source（sat-footprint-fc / sat-track-fc / sat-point-fc）× 5 個 layer（footprint 內外圈 / 未來軌跡 / 即時點 / 變軌 pulse ring）；分類以 `cat` 欄位走 match 表達式上色、各 toggle 以 layer-level filter 切分 —— 非 OVERLAY_REGISTRY";

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
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 4 —— 房地產 Real Estate 7 層
  //  拍板②（同 key 多 config）的**唯一實例**：`propertyValueGrid` 的 source 是
  //  三筆 pmtiles 陣列（150m / 450m / 1.5km），順序 = OVERLAY_REGISTRY 順序。
  //  租賃／買賣／預售 6 層是「一 key 一 config」的老形狀，別跟上面混為一談：
  //  三張 Grid 共用 sourceId `re-grid`（同一份切片以 type filter 切分），
  //  三張 Point 共用同一個 Three.js CustomLayer。
  //  legend 一個 id `realEstateRentalGrid` 吃掉全部 7 層裡的 6 層＋自己一層。
  // ══════════════════════════════════════════════════════════════
  realEstateRentalGrid: {
    key: "realEstateRentalGrid",
    section: { theme: "房地產 Real Estate", group: "租賃" },
    label: "租賃熱力圖 Rental Grid",
    expandable: true,
    color: "#41919A",
    icon: Building2,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "real_estate", confidence: "LOW" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "re-grid",
      url: "./coverage/real_estate_grid.pmtiles",
      sourceLayer: "real_estate_grid",
      minzoom: 6,
      maxzoom: 14,
    },
    legend: "realEstateRentalGrid",
    popup: null,
    params: { count: 2, kinds: ["slider", "toggle"] },
    description: "實價登錄租賃案件 150m 網格中位單價",
    topics: ["房地產", "租賃", "網格"],
  },

  realEstateRentalPoint: {
    key: "realEstateRentalPoint",
    section: { theme: "房地產 Real Estate", group: "租賃" },
    label: "租賃交易點 Rental Point",
    expandable: true,
    color: "#41919A",
    icon: MapPin,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "real_estate", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "Three.js CustomLayer `re-points-three`（RealEstatePointsScene 讀 ./coverage/real_estate_points_buffer.bin，三種交易型別共用同一份 buffer 與同一個 layer，由 rePointsStore 的型別 filter 切分）—— 非 OVERLAY_REGISTRY",
    },
    legend: "realEstateRentalGrid",
    popup: null,
    params: { count: 2, kinds: ["slider", "toggle"] },
    description: "實價登錄租賃交易點位（時間軸播放，GPU fade）",
    topics: ["房地產", "租賃", "交易點"],
  },

  realEstateSaleGrid: {
    key: "realEstateSaleGrid",
    section: { theme: "房地產 Real Estate", group: "買賣" },
    label: "買賣熱力圖 Sale Grid",
    expandable: true,
    color: "#d73027",
    icon: Building2,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "real_estate", confidence: "LOW" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "re-grid",
      url: "./coverage/real_estate_grid.pmtiles",
      sourceLayer: "real_estate_grid",
      minzoom: 6,
      maxzoom: 14,
    },
    legend: "realEstateRentalGrid",
    popup: null,
    params: { count: 2, kinds: ["slider", "toggle"] },
    description: "實價登錄買賣案件 150m 網格中位單價",
    topics: ["房地產", "買賣", "網格"],
  },

  realEstateSalePoint: {
    key: "realEstateSalePoint",
    section: { theme: "房地產 Real Estate", group: "買賣" },
    label: "買賣交易點 Sale Point",
    expandable: true,
    color: "#d73027",
    icon: MapPin,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "real_estate", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "Three.js CustomLayer `re-points-three`（RealEstatePointsScene 讀 ./coverage/real_estate_points_buffer.bin，三種交易型別共用同一份 buffer 與同一個 layer，由 rePointsStore 的型別 filter 切分）—— 非 OVERLAY_REGISTRY",
    },
    legend: "realEstateRentalGrid",
    popup: null,
    params: { count: 2, kinds: ["slider", "toggle"] },
    description: "實價登錄買賣交易點位（時間軸播放，GPU fade）",
    topics: ["房地產", "買賣", "交易點"],
  },

  realEstatePresaleGrid: {
    key: "realEstatePresaleGrid",
    section: { theme: "房地產 Real Estate", group: "預售" },
    label: "預售熱力圖 Presale Grid",
    expandable: true,
    color: "#fd8d3c",
    icon: Building2,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "real_estate", confidence: "LOW" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "re-grid",
      url: "./coverage/real_estate_grid.pmtiles",
      sourceLayer: "real_estate_grid",
      minzoom: 6,
      maxzoom: 14,
    },
    legend: "realEstateRentalGrid",
    popup: null,
    params: { count: 2, kinds: ["slider", "toggle"] },
    description: "實價登錄預售屋 150m 網格中位單價",
    topics: ["房地產", "預售", "網格"],
  },

  realEstatePresalePoint: {
    key: "realEstatePresalePoint",
    section: { theme: "房地產 Real Estate", group: "預售" },
    label: "預售交易點 Presale Point",
    expandable: true,
    color: "#fd8d3c",
    icon: MapPin,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "real_estate", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "Three.js CustomLayer `re-points-three`（RealEstatePointsScene 讀 ./coverage/real_estate_points_buffer.bin，三種交易型別共用同一份 buffer 與同一個 layer，由 rePointsStore 的型別 filter 切分）—— 非 OVERLAY_REGISTRY",
    },
    legend: "realEstateRentalGrid",
    popup: null,
    params: { count: 2, kinds: ["slider", "toggle"] },
    description: "實價登錄預售屋交易點位（時間軸播放，GPU fade）",
    topics: ["房地產", "預售", "交易點"],
  },

  propertyValueGrid: {
    key: "propertyValueGrid",
    section: { theme: "房地產 Real Estate", group: "總市值" },
    label: "不動產總市值網格 Value Grid",
    labelMobile: "不動產總市值網格",
    expandable: true,
    color: "#ed6925",
    icon: Coins,
    upstream: {
      status: "pulse_only",
      datasets: [],
      derivedFromLayers: ["buildingsGba", "realEstateSaleGrid"],
      derivedFromDatasets: ["property_value"],
      derivationType: "custom",
      processing: "每棟 GBA 建物 footprint × 樓層(h÷3.2) × 所在 150m 網格實價買賣中位單價 × per-county GFA 校正係數 → 聚合回 150m 格（v_mkt 萬元，市場only）；全台 204.1 兆",
      note: "上游 pipeline taipei-gis-analytics/pipelines/urban_composite/property_value/；handoff 見 docs/handoff/property-value.md",
    },
    dataClass: "B",
    source: [
      {
        kind: "pmtiles",
        sourceId: "property-value-grid-150",
        url: "./urban/property_value_grid_150m.pmtiles",
        sourceLayer: "grid_value_150m",
        minzoom: 4,
        maxzoom: 14,
      },
      {
        kind: "pmtiles",
        sourceId: "property-value-grid-450",
        url: "./urban/property_value_grid_450m.pmtiles",
        sourceLayer: "grid_value_450m",
        minzoom: 4,
        maxzoom: 13,
      },
      {
        kind: "pmtiles",
        sourceId: "property-value-grid-1500",
        url: "./urban/property_value_grid_1500m.pmtiles",
        sourceLayer: "grid_value_1500m",
        minzoom: 4,
        maxzoom: 12,
      },
    ],
    legend: "propertyValueGrid",
    popup: "propertyValueGrid",
    params: { count: 4, kinds: ["select", "select", "slider", "toggle"] },
    description: "全台不動產總市值網格，150m / 450m / 1.5km 三尺度（v_mkt 萬元，全台 204.1 兆）",
    topics: ["房地產", "總市值", "網格", "3D"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 4 —— 醫療 Medical 8 層
  //  POI 5 層共用一個 legend id `medHospital` 與一個 popup `medicalPOI`；
  //  分析 2 層（medIsochrone / medDesert）共用**同一個 fill layer**，
  //  是「兩個 toggle 一個 layer」的新形狀 —— 見 medDesert 就地註解。
  //  體質橫跨 A/B/C/D 四種，一個主題撞完全部。
  // ══════════════════════════════════════════════════════════════
  medHospital: {
    key: "medHospital",
    section: { theme: "醫療 Medical", group: "點位" },
    label: "醫院 Hospital",
    expandable: true,
    color: "#d32f2f",
    icon: Hospital,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "medical", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "medical-hospitals", url: "./geo/medical_hospitals.geojson" },
    legend: "medHospital",
    popup: "medicalPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台醫院點位（醫療 POI 四層之首，量體最小走 geojson）",
    topics: ["醫療", "醫院", "POI"],
  },

  medClinic: {
    key: "medClinic",
    section: { theme: "醫療 Medical", group: "點位" },
    label: "診所 / 其他醫療 Clinic",
    expandable: true,
    color: "#1976d2",
    icon: Stethoscope,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "medical", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "medical-clinics",
      url: "./geo/medical_clinics.pmtiles",
      sourceLayer: "medical_clinics",
      minzoom: 0,
      maxzoom: 12,
    },
    legend: "medHospital",
    popup: "medicalPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台診所與其他醫療機構點位",
    topics: ["醫療", "診所", "POI"],
  },

  medPharmacy: {
    key: "medPharmacy",
    section: { theme: "醫療 Medical", group: "點位" },
    label: "藥局 Pharmacy",
    expandable: true,
    color: "#388e3c",
    icon: Pill,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "medical", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "medical-pharmacies",
      url: "./geo/medical_pharmacies.pmtiles",
      sourceLayer: "medical_pharmacies",
      minzoom: 0,
      maxzoom: 12,
    },
    legend: "medHospital",
    popup: "medicalPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台健保特約藥局點位",
    topics: ["醫療", "藥局", "POI"],
  },

  medAED: {
    key: "medAED",
    section: { theme: "醫療 Medical", group: "點位" },
    label: "AED 點位 AED",
    expandable: true,
    color: "#fbc02d",
    icon: HeartPulse,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "aed", confidence: "HIGH" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "medical-aed",
      url: "./geo/medical_aed.pmtiles",
      sourceLayer: "medical_aed",
      minzoom: 0,
      maxzoom: 12,
    },
    legend: "medHospital",
    popup: "medicalPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台公共 AED 設置點位",
    topics: ["醫療", "AED", "急救"],
  },

  medLTC: {
    key: "medLTC",
    section: { theme: "醫療 Medical", group: "點位" },
    label: "長照機構 LTC",
    expandable: true,
    color: "#8e24aa",
    icon: Accessibility,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "long_term_care", confidence: "HIGH" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "medical-ltc",
      url: "./geo/medical_ltc.pmtiles",
      sourceLayer: "medical_ltc",
      minzoom: 0,
      maxzoom: 12,
    },
    legend: "medHospital",
    popup: "medicalPOI",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台長期照顧服務機構點位",
    topics: ["醫療", "長照", "POI"],
  },

  erHospital: {
    key: "erHospital",
    section: { theme: "醫療 Medical", group: "即時 Emergency" },
    label: "急診壅塞 ER",
    expandable: true,
    color: "#ef4444",
    icon: Activity,
    upstream: {
      status: "pulse_only",
      datasets: [],
      note: "即時急診壅塞 RPC（get_er_hospital_latest / 24h，realtime.er_hospital_status）已 apply 到 production；座標 join medical geojson。catalog dataset 條目待補（handoff pending）",
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: "er-hospital",
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "erHospital",
    popup: "erHospital",
    params: { count: 1, kinds: ["slider"] },
    description: "急診壅塞即時狀態（等待推床／滯留人數，座標 join 醫院 POI）",
    topics: ["醫療", "急診", "即時"],
  },

  medIsochrone: {
    key: "medIsochrone",
    section: { theme: "醫療 Medical", group: "分析" },
    label: "醫療等時圈 Isochrone",
    expandable: true,
    color: "#22c55e",
    icon: Clock,
    upstream: {
      status: "pulse_only",
      datasets: [],
      derivedFromLayers: ["medHospital", "medClinic"],
      derivationType: "isochrone",
      processing: "OSRM 路網等時圈計算（駕車時間 5/10/15/30 分鐘）— 從醫療 POI 出發沿實際路網擴散",
      note: "FIX: 派生分析：醫療 POI + 路網等時圈計算結果",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "PMTiles factory medicalIsochroneLayerFactory（./medical/medical_isochrone.pmtiles，source medical-isochrone / layer medical-isochrone-fill）—— medIsochrone 與 medDesert **共用同一個 fill layer**，差別只在 level filter；非 OVERLAY_REGISTRY",
    },
    legend: "medIsochrone",
    popup: "medicalIsochrone",
    params: { count: 1, kinds: ["slider"] },
    description: "醫療設施 OSRM 路網等時圈（駕車 5/10/15/30 分鐘分級）",
    topics: ["醫療", "等時圈", "可達性"],
  },

  // ⚠️ 與 medIsochrone **共用同一個 fill layer**（不是兩層疊在一起）：medIsochrone ON
  //    顯示 4 個 level，medIsochrone OFF 而本層 ON 就把 filter 收成 over15。
  //    因此兩者的 source（custom，同一個 factory）與 popup（medicalIsochrone）必然相同 ——
  //    這是「兩個 toggle 一個 layer」，與批 2 運動場館「多 config 共用 sourceId」不同款。
  // 📌 記一筆現況出入（本次不動，搬移階段零失真）：upstream.processing 寫「> 30 分鐘」，
  //    但 factory 實際 filter 的 level 是 `over15`（> 15 分鐘）。description 記渲染實況。
  medDesert: {
    key: "medDesert",
    section: { theme: "醫療 Medical", group: "分析" },
    label: "醫療沙漠 Desert",
    expandable: true,
    color: "#ef4444",
    icon: AlertCircle,
    upstream: {
      status: "pulse_only",
      datasets: [],
      derivedFromLayers: ["medIsochrone"],
      derivationType: "inverse",
      processing: "等時圈反演 — 距任一醫療設施駕車 > 30 分鐘的村里標為醫療沙漠",
      note: "FIX: 派生分析：等時圈反演的醫療沙漠",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "PMTiles factory medicalIsochroneLayerFactory（./medical/medical_isochrone.pmtiles，source medical-isochrone / layer medical-isochrone-fill）—— medIsochrone 與 medDesert **共用同一個 fill layer**，差別只在 level filter；非 OVERLAY_REGISTRY",
    },
    legend: "medIsochrone",
    popup: "medicalIsochrone",
    params: { count: 1, kinds: ["slider"] },
    description: "醫療沙漠：距任一醫療設施駕車 > 15 分鐘的網格（等時圈同層 filter 收窄）",
    topics: ["醫療", "服務缺口", "可達性"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 4 —— 執法治安 Law & Order 20 層
  //  批 1 立的「legend id 與自身 key 完全無關」規約在這裡是主場：本主題 17 層
  //  共用 `policeStation` 這個 id —— 該 LEGEND_REGISTRY entry 實際涵蓋 18 key
  //  （多出的 `civilDefenseShelter` 屬民防主題、批 1 已搬，它就是當初壓測這條規約的那層）。
  //  另外 3 層覆蓋分析共用 `policeIsoSubstation`。
  //  popup 100% 覆蓋且 **20/20 與 key 同名** —— 前三批沒出現過的整齊度。
  // ══════════════════════════════════════════════════════════════
  policeStation: {
    key: "policeStation",
    section: { theme: "執法治安 Law & Order", group: "警政" },
    label: "警察機關 Police",
    expandable: true,
    color: "#1e40af", // 警察 — 深藍
    icon: ShieldAlert,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "police_stations", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "police-station", url: "./police_justice/police_stations/police_stations_20260626.geojson" },
    legend: "policeStation",
    popup: "policeStation",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "全台警察機關點位（警局／分局／派出所）",
    topics: ["治安", "警政", "POI"],
  },

  womenChildWarning: {
    key: "womenChildWarning",
    section: { theme: "執法治安 Law & Order", group: "警政" },
    label: "婦幼警示點 Women/Child Warning",
    expandable: true,
    color: "#ec4899", // 婦幼 — 粉
    icon: AlertTriangle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "women_child_warning", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "women-child-warning", url: "./police_justice/women_child_warning/women_child_warning_20260626.geojson" },
    legend: "policeStation",
    popup: "womenChildWarning",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "婦幼安全警示點位",
    topics: ["治安", "婦幼", "POI"],
  },

  speedCamera: {
    key: "speedCamera",
    section: { theme: "執法治安 Law & Order", group: "警政" },
    label: "測速照相 Speed Camera",
    expandable: true,
    color: "#dc2626", // 測速 — 紅
    icon: Crosshair,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "speed_cameras", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "speed-camera", url: "./police_justice/speed_cameras/speed_cameras_20260626.geojson" },
    legend: "policeStation",
    popup: "speedCamera",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "固定式測速照相點位",
    topics: ["治安", "交通執法", "POI"],
  },

  speedZoneSegment: {
    key: "speedZoneSegment",
    section: { theme: "執法治安 Law & Order", group: "警政" },
    label: "區間測速 Speed Zone",
    expandable: true,
    color: "#b91c1c", // 區間測速 — 深紅
    icon: Timer,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "speed_zone_segments", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "speed-zone-segment", url: "./police_justice/speed_zone_segments/speed_zone_segments_20260626.geojson" },
    legend: "policeStation",
    popup: "speedZoneSegment",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "區間測速路段起訖點",
    topics: ["治安", "交通執法", "POI"],
  },

  policeIsoSubstation: {
    key: "policeIsoSubstation",
    section: { theme: "執法治安 Law & Order", group: "警察覆蓋分析" },
    label: "派出所 5/10 min",
    expandable: true,
    color: "#1e40af",
    icon: Hexagon,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "police_stations", confidence: "LOW" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "police-iso-substation",
      url: "./police_justice/isochrone/police_iso_substation_combined.pmtiles",
      sourceLayer: "police_iso_substation",
      minzoom: 4,
      maxzoom: 14,
    },
    legend: "policeIsoSubstation",
    popup: "policeIsoSubstation",
    params: { count: 3, kinds: ["select", "select", "slider"] },
    description: "派出所 5／10 分鐘路網等時圈",
    topics: ["治安", "等時圈", "可達性"],
  },

  policeIsoPrecinct: {
    key: "policeIsoPrecinct",
    section: { theme: "執法治安 Law & Order", group: "警察覆蓋分析" },
    label: "分局 15/30 min",
    expandable: true,
    color: "#3b82f6",
    icon: Hexagon,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "police_stations", confidence: "LOW" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "police-iso-precinct",
      url: "./police_justice/isochrone/police_iso_precinct_combined.pmtiles",
      sourceLayer: "police_iso_precinct",
      minzoom: 4,
      maxzoom: 14,
    },
    legend: "policeIsoSubstation",
    popup: "policeIsoPrecinct",
    params: { count: 3, kinds: ["select", "select", "slider"] },
    description: "分局 15／30 分鐘路網等時圈",
    topics: ["治安", "等時圈", "可達性"],
  },

  policeIsoCityDept: {
    key: "policeIsoCityDept",
    section: { theme: "執法治安 Law & Order", group: "警察覆蓋分析" },
    label: "縣市警局 30/60 min",
    expandable: true,
    color: "#60a5fa",
    icon: Hexagon,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "police_stations", confidence: "LOW" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "police-iso-city-dept",
      url: "./police_justice/isochrone/police_iso_police_dept_combined.pmtiles",
      sourceLayer: "police_iso_police_dept",
      minzoom: 4,
      maxzoom: 14,
    },
    legend: "policeIsoSubstation",
    popup: "policeIsoCityDept",
    params: { count: 3, kinds: ["select", "select", "slider"] },
    description: "縣市警察局 30／60 分鐘路網等時圈",
    topics: ["治安", "等時圈", "可達性"],
  },

  court: {
    key: "court",
    section: { theme: "執法治安 Law & Order", group: "司法矯正" },
    label: "法院 Courts",
    expandable: true,
    color: "#7c3aed", // 法院 — 紫
    icon: Gavel,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "courts", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "court", url: "./police_justice/courts/courts_20260626.geojson" },
    legend: "policeStation",
    popup: "court",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "各級法院點位",
    topics: ["治安", "司法", "POI"],
  },

  prosecutorsOffice: {
    key: "prosecutorsOffice",
    section: { theme: "執法治安 Law & Order", group: "司法矯正" },
    label: "檢察署 Prosecutors",
    expandable: true,
    color: "#a855f7", // 檢察署 — 淺紫
    icon: Scale,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "prosecutors_offices", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "prosecutors-office", url: "./police_justice/prosecutors_offices/prosecutors_offices_20260626.geojson" },
    legend: "policeStation",
    popup: "prosecutorsOffice",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "各級檢察署點位",
    topics: ["治安", "司法", "POI"],
  },

  correctionalFacility: {
    key: "correctionalFacility",
    section: { theme: "執法治安 Law & Order", group: "司法矯正" },
    label: "矯正機關 Correctional",
    expandable: true,
    color: "#374151", // 矯正 — 鐵灰
    icon: Lock,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "correctional_facilities", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "correctional-facility", url: "./police_justice/correctional_facilities/correctional_facilities_20260626.geojson" },
    legend: "policeStation",
    popup: "correctionalFacility",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "矯正機關點位（監獄／看守所／技訓所）",
    topics: ["治安", "矯正", "POI"],
  },

  courtJurisdiction: {
    key: "courtJurisdiction",
    section: { theme: "執法治安 Law & Order", group: "司法矯正" },
    label: "法院管轄區 Jurisdiction",
    expandable: true,
    color: "#c4b5fd", // 法院管轄區 — 紫白（polygon fill）
    icon: MapPinned,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "court_jurisdictions", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "court-jurisdiction",
      url: "./police_justice/court_jurisdictions/court_jurisdictions.pmtiles",
      sourceLayer: "court_jurisdictions",
      minzoom: 6,
      maxzoom: 10,
    },
    legend: "policeStation",
    popup: "courtJurisdiction",
    params: { count: 1, kinds: ["slider"] },
    description: "地方法院管轄區範圍面",
    topics: ["治安", "司法", "行政區"],
  },

  crimeAreaMonthly: {
    key: "crimeAreaMonthly",
    section: { theme: "執法治安 Law & Order", group: "治安態勢" },
    label: "鄉鎮犯罪統計 Crime Area",
    expandable: true,
    color: "#991b1b", // 鄉鎮犯罪 choropleth — 暗紅
    icon: Hexagon,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "crime_area_monthly", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "crime-area-monthly",
      url: "./police_justice/crime_area_monthly/crime_area_monthly.pmtiles",
      sourceLayer: "crime_area_monthly",
      minzoom: 8,
      maxzoom: 12,
    },
    legend: "policeStation",
    popup: "crimeAreaMonthly",
    params: { count: 1, kinds: ["slider"] },
    description: "鄉鎮市區月別犯罪案件統計 choropleth",
    topics: ["治安", "犯罪統計", "行政區"],
  },

  theftTaoyuan: {
    key: "theftTaoyuan",
    section: { theme: "執法治安 Law & Order", group: "治安態勢" },
    label: "桃園竊盜 Theft Taoyuan",
    expandable: true,
    color: "#f59e0b", // 竊盜 — 橙
    icon: Search,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "theft_points_taoyuan", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "theft-taoyuan", url: "./police_justice/theft_points_taoyuan/theft_points_taoyuan_20260626.geojson" },
    legend: "policeStation",
    popup: "theftTaoyuan",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "桃園市竊盜案件發生點位",
    topics: ["治安", "竊盜", "桃園"],
  },

  trafficAccidentYearly: {
    key: "trafficAccidentYearly",
    section: { theme: "執法治安 Law & Order", group: "治安態勢" },
    label: "A1 死亡事故 Fatal Accident",
    expandable: true,
    color: "#fb7185", // A1 死亡 — 玫紅
    icon: AlertTriangle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "traffic_accident_yearly", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "traffic-accident-yearly", url: "./police_justice/traffic_accident_yearly/traffic_accident_yearly_20260626.geojson" },
    legend: "policeStation",
    popup: "trafficAccidentYearly",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "A1 類（24 小時內死亡）交通事故年度點位",
    topics: ["治安", "交通事故", "傷亡"],
  },

  accidentTaipei: {
    key: "accidentTaipei",
    section: { theme: "執法治安 Law & Order", group: "治安態勢" },
    label: "北市事故點 Taipei Dots",
    expandable: true,
    color: "#fda4af", // 北市事故 — 淡玫
    icon: AlertCircle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "accident_taipei_dots", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "accident-taipei", url: "./police_justice/accident_taipei_dots/accident_taipei_dots_20260626.geojson" },
    legend: "policeStation",
    popup: "accidentTaipei",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "臺北市交通事故點位",
    topics: ["治安", "交通事故", "臺北"],
  },

  a1AccidentRealtime: {
    key: "a1AccidentRealtime",
    section: { theme: "執法治安 Law & Order", group: "治安態勢" },
    label: "A1 即時事故 A1 Realtime",
    expandable: true,
    color: "#ef4444", // A1 realtime — 鮮紅
    icon: AlertTriangle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "traffic_accident", confidence: "HIGH" }],
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: "a1-accident-realtime",
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "policeStation",
    popup: "a1AccidentRealtime",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "A1 死亡交通事故即時通報",
    topics: ["治安", "交通事故", "即時"],
  },

  investigationBureau: {
    key: "investigationBureau",
    section: { theme: "執法治安 Law & Order", group: "廉政移民海巡" },
    label: "調查局 MJIB",
    expandable: true,
    color: "#0f766e", // 調查局 — 墨綠
    icon: Search,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "investigation_bureau", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "investigation-bureau", url: "./police_justice/investigation_bureau/investigation_bureau_20260626.geojson" },
    legend: "policeStation",
    popup: "investigationBureau",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "法務部調查局各級機關點位",
    topics: ["治安", "廉政", "POI"],
  },

  antiCorruptionOffice: {
    key: "antiCorruptionOffice",
    section: { theme: "執法治安 Law & Order", group: "廉政移民海巡" },
    label: "廉政署 AAC",
    expandable: true,
    color: "#14b8a6", // 廉政 — 青
    icon: Sparkles,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "anti_corruption_offices", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "anti-corruption-office", url: "./police_justice/anti_corruption_offices/anti_corruption_offices_20260626.geojson" },
    legend: "policeStation",
    popup: "antiCorruptionOffice",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "法務部廉政署與各機關政風單位點位",
    topics: ["治安", "廉政", "POI"],
  },

  immigrationOffice: {
    key: "immigrationOffice",
    section: { theme: "執法治安 Law & Order", group: "廉政移民海巡" },
    label: "移民署 Immigration",
    expandable: true,
    color: "#0ea5e9", // 移民 — 天藍
    icon: PlaneTakeoff,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "immigration_offices", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "immigration-office", url: "./police_justice/immigration_offices/immigration_offices_20260626.geojson" },
    legend: "policeStation",
    popup: "immigrationOffice",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "內政部移民署各服務站點位",
    topics: ["治安", "移民", "POI"],
  },

  coastGuardStation: {
    key: "coastGuardStation",
    section: { theme: "執法治安 Law & Order", group: "廉政移民海巡" },
    label: "海巡 Coast Guard",
    expandable: true,
    color: "#0284c7", // 海巡 — 海藍
    icon: Anchor,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "coast_guard_stations", confidence: "MED" }],
    },
    dataClass: "A",
    source: { kind: "geojson", sourceId: "coast-guard-station", url: "./police_justice/coast_guard_stations/coast_guard_stations_20260626.geojson" },
    legend: "policeStation",
    popup: "coastGuardStation",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "海洋委員會海巡署各級單位點位",
    topics: ["治安", "海巡", "POI"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 4 —— 人口社經 People 6 層（**全部 dataClass D**）
  //  六層都走 H3 factory（demographicsLayerFactory / h3LayerFactory /
  //  youbikeLayerFactory）：h3-js 把 H3 cell 現算成多邊形後手動
  //  addSource/addLayer —— 沒有 OVERLAY_REGISTRY entry，所以 source 一律
  //  `kind: "custom"`，真實來源記在 note（同批 1 已澄清的 D 定義）。
  //  ⚠️ 不要因為「它們看起來像 polygon 圖層」就硬套 geojson/pmtiles 形狀。
  //  全部無 popup（H3 格子沒有點擊接線），legend 2 層合法為 null。
  // ══════════════════════════════════════════════════════════════
  popCount: {
    key: "popCount",
    section: { theme: "人口社經 People", group: "人口分布" },
    label: "人口數 Population",
    expandable: true,
    color: "#f9bd31",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "population", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "demographicsLayerFactory 以 h3-js cellToBoundary 把 H3 cell 轉成多邊形後手動 addSource/addLayer（h3-pop-count-src / -fill / -ext）；資料走 h3Loader 的 Supabase RPC ＋本地 JSON fallback —— 非 OVERLAY_REGISTRY",
    },
    legend: "popCount",
    popup: null,
    params: { count: 4, kinds: ["slider", "slider", "toggle", "slider"] },
    description: "H3 網格人口數（日間／夜間，可依年份回放）",
    topics: ["人口", "H3", "統計"],
  },

  h3Population: {
    key: "h3Population",
    section: { theme: "人口社經 People", group: "人口分布" },
    label: "人流模擬 Pop. Flow",
    expandable: true,
    color: "#ff6b6b",
    icon: Activity,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "population", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "h3LayerFactory 手動 addSource/addLayer（h3-population-fill / -ext），同樣是 H3 cell → polygon 現算 —— 非 OVERLAY_REGISTRY",
    },
    legend: null,
    popup: null,
    params: { count: 5, kinds: ["slider", "slider", "toggle", "slider", "select"] },
    description: "H3 人流模擬（日夜人口差推估的移動量）",
    topics: ["人口", "H3", "人流"],
  },

  indicators: {
    key: "indicators",
    section: { theme: "人口社經 People", group: "人口分布" },
    label: "人口指標 Indicators",
    expandable: true,
    color: "#e25822",
    icon: BarChart3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "county_indicators_yearly", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "demographicsLayerFactory（h3-indicators-src / -fill / -ext）—— 非 OVERLAY_REGISTRY",
    },
    legend: "indicators",
    popup: null,
    params: { count: 6, kinds: ["select", "select", "slider", "slider", "toggle", "slider"] },
    description: "縣市年度人口指標（出生／死亡／遷徙等，多指標下拉切換）",
    topics: ["人口", "H3", "指標"],
  },

  socioeconomic: {
    key: "socioeconomic",
    section: { theme: "人口社經 People", group: "社經" },
    label: "社經面貌 Socio-Econ",
    expandable: true,
    color: "#7c4dff",
    icon: BarChart3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "village_comprehensive_extended", confidence: "LOW" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "demographicsLayerFactory（h3-socio-src / -fill / -ext）—— 非 OVERLAY_REGISTRY",
    },
    legend: "socioeconomic",
    popup: null,
    params: { count: 6, kinds: ["select", "select", "slider", "slider", "toggle", "slider"] },
    description: "村里社經面貌綜合指標（所得／教育／年齡結構）",
    topics: ["社經", "H3", "村里"],
  },

  spatialEconomy: {
    key: "spatialEconomy",
    section: { theme: "人口社經 People", group: "社經" },
    label: "空間經濟 Spatial-Econ",
    expandable: true,
    color: "#ff6e40",
    icon: Store,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "village_comprehensive_extended", confidence: "LOW" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "demographicsLayerFactory（h3-spatial-src / -fill / -ext）—— 非 OVERLAY_REGISTRY",
    },
    legend: "spatialEconomy",
    popup: null,
    params: { count: 6, kinds: ["select", "select", "slider", "slider", "toggle", "slider"] },
    description: "村里空間經濟指標（產業家數／營業額分布）",
    topics: ["社經", "H3", "產業"],
  },

  youbikeFullness: {
    key: "youbikeFullness",
    section: { theme: "人口社經 People", group: "共享運具" },
    label: "YouBike 有車率 Fullness",
    expandable: true,
    color: "#f57c00",
    icon: Bike,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "youbike_baselines", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "youbikeLayerFactory 手動 addSource/addLayer（h3-youbike-fill / -ext）—— 非 OVERLAY_REGISTRY",
    },
    legend: null,
    popup: null,
    params: { count: 6, kinds: ["select", "select", "slider", "slider", "toggle", "slider"] },
    description: "YouBike 站點有車率的 H3 聚合（共享運具供給熱區）",
    topics: ["共享運具", "H3", "即時"],
  },
  // ══════════════════════════════════════════════════════════════
  //  Phase 2 批 4 —— 全球氣候 Global Climate 5 層（**全部 dataClass D**）
  //  兩種 popup 陷阱在這裡同時出現，兩個都是「照抽取器填 null 就會是已知為假」：
  //   ① key ≠ layerType：earthquakesGlobal → `earthquakeGlobal`、
  //      typhoonTracks → `typhoonTrack`（都是單數形，肉眼掃過去像同名）
  //   ② **完全不經 GIS_LAYERS**：windField / oceanCurrents → `climateField`，
  //      它是「向量 feature 全部沒命中」時的 fallback（點哪都能讀值），
  //      本來就不對應任何 layer id → 需要 extractNonGisFeatureTypes 才驗得出來。
  //  dustForecast 是 raster image source，真的沒有 popup（同批 3 canopyHeight）。
  // ══════════════════════════════════════════════════════════════
  earthquakesGlobal: {
    key: "earthquakesGlobal",
    section: { theme: "全球氣候 Global Climate", group: "事件" },
    label: "全球地震 USGS Earthquake",
    expandable: true,
    color: "#dc2626",
    icon: AlertTriangle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "usgs_earthquakes_global", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "hook 自建 source/layer（earthquakes-global / earthquakes-global-circle），資料走 earthquakesGlobalLoader 打 USGS feed —— 非 OVERLAY_REGISTRY",
    },
    legend: "earthquakesGlobal",
    popup: "earthquakeGlobal",
    params: { count: 1, kinds: ["slider"] },
    description: "USGS 全球地震（規模分大小、深度分色，最近 2000 筆）",
    topics: ["全球氣候", "地震", "即時"],
  },

  typhoonTracks: {
    key: "typhoonTracks",
    section: { theme: "全球氣候 Global Climate", group: "事件" },
    label: "颱風軌跡 Typhoon Track",
    expandable: true,
    color: "#a855f7",
    icon: Tornado,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "jma_typhoon_positions", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "hook 自建 3 個 source（typhoon-tracks-lines / -points / -current）與線／點 layer，資料走 typhoonTracksLoader —— 非 OVERLAY_REGISTRY",
    },
    legend: "typhoonTracks",
    popup: "typhoonTrack",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "颱風軌跡（實測實線＋預報虛線＋軌跡點）",
    topics: ["全球氣候", "颱風", "即時"],
  },

  windField: {
    key: "windField",
    section: { theme: "全球氣候 Global Climate", group: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）" },
    label: "風場 Wind Field 10m",
    expandable: true,
    color: "#94a3b8",
    icon: Wind,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "noaa_gfs_wind_forecast", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "climateParticleLineLayer（WebGL 粒子線，layer id `climate-windfield`）逐幀讀 climate frame raster（climateFrames + climateFrameStore）—— 沒有 mapbox source，非 OVERLAY_REGISTRY",
    },
    legend: "windField",
    popup: "climateField",
    params: { count: 4, kinds: ["slider", "slider", "slider", "slider"] },
    description: "GFS 10m 風場（粒子流線動畫，點擊讀值）",
    topics: ["全球氣候", "風場", "預報"],
  },

  oceanCurrents: {
    key: "oceanCurrents",
    section: { theme: "全球氣候 Global Climate", group: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）" },
    label: "海流 Ocean Currents",
    expandable: true,
    color: "#0ea5e9",
    icon: Waves,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cmems_ocean_forecast", confidence: "LOW" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "climateParticleLineLayer（WebGL 粒子線，layer id `climate-ocean-currents`）逐幀讀 climate frame raster（climateFrames + climateFrameStore）—— 沒有 mapbox source，非 OVERLAY_REGISTRY",
    },
    legend: "oceanCurrents",
    popup: "climateField",
    params: { count: 4, kinds: ["slider", "slider", "slider", "slider"] },
    description: "CMEMS 表層海流（粒子流線動畫，點擊讀值）",
    topics: ["全球氣候", "海流", "預報"],
  },

  dustForecast: {
    key: "dustForecast",
    section: { theme: "全球氣候 Global Climate", group: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）" },
    label: "沙塵預報 Dust Forecast",
    expandable: true,
    color: "#b45309",
    icon: Cloud,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cams_atmosphere_forecast", confidence: "LOW" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "hook 自建 raster image source（dust-forecast-img / dust-forecast-raster），逐幀 PNG ＋ meta JSON —— 非 OVERLAY_REGISTRY",
    },
    legend: "dustForecast",
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "CAMS 沙塵預報濃度場（raster 疊圖）",
    topics: ["全球氣候", "沙塵", "預報"],
  },

  // ══════════════════════════════════════════════════════════════
  // 📍 底圖 Base Map 12 層（AR-22 Phase 2 批 5）
  // ══════════════════════════════════════════════════════════════
  // 全批 popup 12/12 與 key 同名（本工程搬過的主題裡第二個 100% 同名者，
  // 前一個是批 4 執法治安 20/20）。hillshade 唯一 popup: null ——
  // 它**有 HEADER_LABELS 條目**卻沒有 GIS_LAYERS 條目，見該 entry 就地說明。
  //
  // 色票：12 個在 HANDWRITTEN_LAYER_COLORS 原本就是字面 hex，沒有任何
  // `*_LAYER_COLORS` 常數在餵這張表（`nonUrbanZoningTypes` / `buildingsGbaTypes` /
  // `urbanZoningTypes` 匯出的是 category-keyed 的 match 表達式）→ 照拍板①判準寫字面。
  //
  // ⚠️ dataClass 別照「檔案長相」猜：hillshade / slopeVector / aspectVector 三層
  // **沒有 OVERLAY_REGISTRY entry**（hook 自建 source）→ D，但 slope/aspect 實際上
  // 是不折不扣的 PMTiles，**部署清單照樣要涵蓋**（見 changelog 觸點 #20 核對）。

  countyBoundary: {
    key: "countyBoundary",
    section: { theme: "底圖 Base Map", group: "行政邊界" },
    label: "縣市界 County",
    expandable: true,
    color: "#4b5563",
    icon: MapPinned,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "county_boundary", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "base-county-boundary",
      url: "./base_map/county_boundary.pmtiles",
      sourceLayer: "county_boundary",
      minzoom: 0,
      maxzoom: 14,
    },
    legend: null,
    popup: "countyBoundary",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "內政部縣市行政區界（22 縣市，fill + line 雙層）",
    topics: ["底圖", "行政區", "邊界"],
  },

  townshipBoundary: {
    key: "townshipBoundary",
    section: { theme: "底圖 Base Map", group: "行政邊界" },
    label: "鄉鎮市區界 Township",
    expandable: true,
    color: "#6b7280",
    icon: MapPinned,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "township_boundary", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "base-township-boundary",
      url: "./base_map/township_boundary.pmtiles",
      sourceLayer: "township_boundary",
      minzoom: 6,
      maxzoom: 14,
    },
    legend: null,
    popup: "townshipBoundary",
    params: { count: 2, kinds: ["slider", "slider"] },
    // ⚠️ 同一份切片被 earthquakeReplay 的鄉鎮震度面另建一個 source（`eq-replay-township`，
    //    promoteId + feature-state 染色，通用路徑不支援）——刪這個檔會連帶弄壞地震回放。
    description: "內政部鄉鎮市區界（368 區，fill + line 雙層）",
    topics: ["底圖", "行政區", "邊界"],
  },

  villageBoundary: {
    key: "villageBoundary",
    section: { theme: "底圖 Base Map", group: "行政邊界" },
    label: "村里界 Village",
    expandable: true,
    color: "#9ca3af",
    icon: MapPinned,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "village_boundary", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "base-village-boundary",
      url: "./base_map/village_boundary.pmtiles",
      sourceLayer: "village_boundary",
      minzoom: 8,
      maxzoom: 14,
    },
    legend: null,
    popup: "villageBoundary",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "內政部村里界（最細一級行政區，z8 以上才切片）",
    topics: ["底圖", "行政區", "邊界"],
  },

  contour25k: {
    key: "contour25k",
    section: { theme: "底圖 Base Map", group: "地形" },
    label: "等高線 Contour 25k (10m)",
    labelMobile: "等高線 25k 10m",
    expandable: true,
    color: "#8B4513",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "contour_25k", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "base-contour-25k",
      url: "./base_map/contour_25k.pmtiles",
      sourceLayer: "contour_25k",
      minzoom: 8,
      maxzoom: 14,
    },
    legend: null,
    popup: "contour25k",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "經建版 2.5 萬分之一地形圖等高線（間距 10m）",
    topics: ["底圖", "地形", "等高線"],
  },

  contourDtm20: {
    key: "contourDtm20",
    section: { theme: "底圖 Base Map", group: "地形" },
    label: "等高線 Contour DTM20 (20m)",
    labelMobile: "等高線 DTM 20m",
    expandable: true,
    color: "#a16207",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "contour_dtm20", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "base-contour-dtm20",
      url: "./base_map/contour_dtm20.pmtiles",
      sourceLayer: "contour_dtm20",
      minzoom: 7,
      maxzoom: 14,
    },
    legend: null,
    popup: "contourDtm20",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "DTM 20m 網格推導等高線（比 25k 稀疏、涵蓋較廣）",
    topics: ["底圖", "地形", "等高線"],
  },

  // ⚠️ dataClass D 但**不是自繪**：單張預烤 PNG（App.tsx 直呼 useStaticRasterLayer），
  //    沒有 OVERLAY_REGISTRY entry → 派生機制不適用，真實來源記在 source.note。
  //    popup: null 是**真的沒有點擊接線**（GIS_LAYERS 無條目）—— 它在 HEADER_LABELS
  //    有一條 `hillshade: "山體陰影"`，但那只是 BYOK chat bridge 能標的 layerType 全集，
  //    不構成 popup 接線。批 4 立的是「D 不等於 popup null」，這裡是反向的另一半：
  //    **HEADER_LABELS 有條目也不等於有 popup**（osmExpressway 批 8 同款）。
  hillshade: {
    key: "hillshade",
    section: { theme: "底圖 Base Map", group: "地形" },
    label: "山體陰影 Hillshade",
    expandable: true,
    color: "#6b7280",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "hillshade", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useStaticRasterLayer（App.tsx 直呼；source `base-hillshade-src` / layer `base-hillshade-layer`）把單張預烤 colormap PNG `./base_map/hillshade.png` 貼到 TERRAIN_BBOX —— 非 OVERLAY_REGISTRY",
    },
    legend: null,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "全臺山體陰影灰階圖（單張 PNG 預烤，單色無分類故無圖例）",
    topics: ["底圖", "地形", "陰影"],
  },

  slopeVector: {
    key: "slopeVector",
    section: { theme: "底圖 Base Map", group: "地形" },
    label: "坡度分級 Slope 6級",
    labelMobile: "坡度分級",
    expandable: true,
    color: "#fc8d59",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "slope", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useSlopeVectorLayer 自建 PMTiles source（`slope-vector` ← ./base_map/slope_vector.pmtiles，source-layer `slope`，z5-12）→ layer `slope-vector-fill` —— 非 OVERLAY_REGISTRY，但**檔案照樣要進 nginx /base_map/ 與 deploy 清單**",
    },
    legend: "slopeVector",
    popup: "slopeVector",
    params: { count: 1, kinds: ["slider"] },
    description: "建管六級坡分級面（slope_class 1-6 分色）",
    topics: ["底圖", "地形", "坡度"],
  },

  aspectVector: {
    key: "aspectVector",
    section: { theme: "底圖 Base Map", group: "地形" },
    label: "坡向分級 Aspect 8向",
    labelMobile: "坡向分級",
    expandable: true,
    color: "#ff7f00",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "aspect", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useAspectVectorLayer 自建 PMTiles source（`aspect-vector` ← ./base_map/aspect_vector.pmtiles，source-layer `aspect`，z5-12）→ layer `aspect-vector-fill` —— 非 OVERLAY_REGISTRY，但**檔案照樣要進 nginx /base_map/ 與 deploy 清單**",
    },
    legend: "aspectVector",
    popup: "aspectVector",
    params: { count: 1, kinds: ["slider"] },
    description: "坡向八方位分級面（N/NE/E/…/NW 分色）",
    topics: ["底圖", "地形", "坡向"],
  },

  buildingsGba: {
    key: "buildingsGba",
    section: { theme: "底圖 Base Map", group: "建成環境" },
    label: "建物輪廓 Buildings",
    expandable: true,
    color: "#78909c",
    icon: Building2,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "全台 3D 建物輪廓 152 萬棟（GBA/OSM 融合，public/urban/buildings_3d_taiwan.pmtiles），catalog 待建；上游 handoff 見 taipei-gis-analytics/docs/handoff/gba_canopy_frontend.md",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "buildings-gba",
      url: "./urban/buildings_value_taiwan.pmtiles",
      sourceLayer: "buildings",
      minzoom: 8,
      maxzoom: 16,
    },
    legend: "buildingsGba",
    popup: "buildingsGba",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    // ⚠️ 現況出入（照抄不夾帶修正）：upstream.note 寫的檔名是 `buildings_3d_taiwan.pmtiles`，
    //    OVERLAY_REGISTRY 實際載的是 `buildings_value_taiwan.pmtiles`（含房價欄位的後續版本）。
    //    同批 3 forestAlishanRail / 批 4 medDesert 的處理方式：就地註明，修對應是另一件事。
    description: "全台建物輪廓（高度 / 來源 / 夜光三種著色模式，z14 起 fill-extrusion）",
    topics: ["底圖", "建物", "都市"],
  },

  // legend 填 `"urbanZoning"` 而非 LEGEND_REGISTRY 首個 key `"urbanZoningTaipei"` ——
  // 拍板④的機械規則背後 load-bearing 的性質是「共用元件 ⇔ 共用 id」（Phase 3 依 id
  // 分組派生 LEGEND_REGISTRY，兩個 id 對一個元件會派生出兩筆）。試點
  // urbanZoningTaipei 早於拍板④、已寫 `"urbanZoning"` → **家族已有 manifest 成員時
  // 沿用其既有 id**，不回頭改試點（搬移階段不夾帶）。批 6 的 pollution 家族同款。
  urbanZoningNewTaipei: {
    key: "urbanZoningNewTaipei",
    section: { theme: "底圖 Base Map", group: "土地使用分區 Zoning" },
    label: "新北土地使用分區 New Taipei Zoning",
    labelMobile: "新北土地使用分區",
    expandable: true,
    color: "#eb5757",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "urban_zoning_newtaipei", confidence: "HIGH" }],
      note: "新北市都市計畫土地使用分區 34,190 面（urban.planning.ntpc.gov.tw opendata，docs/data-catalog/urban_composite/urban_zoning_newtaipei.md）",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "urban-zoning-newtaipei",
      url: "./urban/urban_zoning_newtaipei.pmtiles",
      sourceLayer: "urban_zoning_newtaipei",
      minzoom: 6,
      maxzoom: 15,
    },
    legend: "urbanZoning",
    popup: "urbanZoningNewTaipei",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "新北市都市計畫土地使用分區（與北市同一組 zone_category 分色）",
    topics: ["土地使用", "都市計畫", "底圖"],
  },

  nonUrbanZoning: {
    key: "nonUrbanZoning",
    section: { theme: "底圖 Base Map", group: "土地使用分區 Zoning" },
    label: "非都市土地使用分區 Non-Urban Zoning",
    labelMobile: "非都市分區 (68,220)",
    expandable: true,
    color: "#a2c14e",
    icon: Sprout,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "non_urban_zoning", confidence: "HIGH" }],
      processing: "內政部區域計畫法非都市土地使用分區 68,220 面 / 18 縣市（北市・嘉義市全境都市計畫故無），z5-14 PMTiles",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "non-urban-zoning",
      url: "./urban/non_urban_zoning.pmtiles",
      sourceLayer: "non_urban_zoning",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "nonUrbanZoning",
    popup: "nonUrbanZoning",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "非都市土地使用分區（與北市/新北兩層互補，合起來是全國拼圖）",
    topics: ["土地使用", "區域計畫", "底圖"],
  },

  osmRoadDrive: {
    key: "osmRoadDrive",
    section: { theme: "底圖 Base Map", group: "道路底圖" },
    label: "OSM 道路 OSM Roads",
    expandable: true,
    color: "#fb923c",
    icon: Route,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "osm_road_drive", confidence: "MED" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "base-osm-road",
      url: "./base_map/osm_road_drive.pmtiles",
      sourceLayer: "osm_road_drive",
      minzoom: 6,
      maxzoom: 14,
    },
    legend: "osmRoadDrive",
    popup: "osmRoadDrive",
    params: { count: 3, kinds: ["slider", "slider", "slider"] },
    description: "OSM 可行車道路網（依 highway 分級著色，含 z5 揭露門檻）",
    topics: ["底圖", "道路", "OSM"],
  },

  // ══════════════════════════════════════════════════════════════
  // ⚠️ 災害 Hazard 12 層（AR-22 Phase 2 批 5）
  // ══════════════════════════════════════════════════════════════
  // dataClass **7 D / 4 C / 1 A**（backlog 預估「3 C + 7 D」漏數了 A 與 C 各一）。
  // 7 個 D 全部**不是自繪**：NCDR 示警 5 層與地震 2 層都是 hook 自建 source
  // （動態餵 Supabase），只是沒有 OVERLAY_REGISTRY entry → 派生機制不適用。
  //
  // ⚠️ `earthquakes`（CWA 國內）與批 4 已搬的 `earthquakesGlobal`（USGS 全球）
  // **差一個 Global，grep 會互相命中**，且兩者的 popup layerType 一單一複
  // （`earthquakes` / `earthquakeGlobal`）。逐 key 精確錨定，別用前綴。
  //
  // 色票：12 個原本就是字面 hex。`disasterAlertTypes` 的 `ALERT_GROUPS[].types`
  // 是 event_term-keyed 的分色表（餵 paint 與 LegendPanel），**沒有在餵
  // `LAYER_COLORS`** → 照拍板①的批 2 反向判準寫字面，不引用。

  // ── NCDR 災害示警 5 群組：共用單一 source + 單一 popup ──
  // 5 層共用 `disaster-alerts` source（一次載入一整天全部 alert，各層以
  // properties.group filter 切分），layer id 是 `${group}-fill/-line/-point`。
  // 5 層的 popup 全是 `disasterAlert` —— 其 layer id 陣列在 GIS_LAYERS 寫成
  // **常數引用** `DISASTER_ALERT_CLICK_LAYERS`，字面陣列解析器抓不到，
  // 靠批 1 補的 `extractGisConstRefTypes` 才驗得出（同 `plaActivity`）。
  // legend 也是 5 層共用一筆（首個 key `lifelineAlerts`，拍板④）。
  lifelineAlerts: {
    key: "lifelineAlerts",
    section: { theme: "災害 Hazard", group: "即時警示" },
    label: "民生中斷 Lifeline",
    expandable: true,
    color: "#facc15",
    icon: Lightbulb,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ncdr_alerts", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useDisasterAlertLayer 自建 geojson source `disaster-alerts`（Supabase RPC get_disaster_alerts_day 按日載入 + LRU 7 天），5 群組共用，layer id `lifelineAlerts-fill/-line/-point` —— 非 OVERLAY_REGISTRY",
    },
    legend: "lifelineAlerts",
    popup: "disasterAlert",
    params: { count: 1, kinds: ["slider"] },
    description: "NCDR 民生中斷示警（停水停電停氣等，依 event_term 分色）",
    topics: ["災害", "示警", "民生"],
  },

  floodAlerts: {
    key: "floodAlerts",
    section: { theme: "災害 Hazard", group: "即時警示" },
    label: "水文防汛 Flood Alerts",
    expandable: true,
    color: "#2563eb",
    icon: Waves,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ncdr_alerts", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "同 lifelineAlerts 的 `disaster-alerts` source，layer id `floodAlerts-fill/-line/-point` —— 非 OVERLAY_REGISTRY",
    },
    legend: "lifelineAlerts",
    popup: "disasterAlert",
    params: { count: 1, kinds: ["slider"] },
    description: "NCDR 水文防汛示警（淹水/水庫放流/河川高水位）",
    topics: ["災害", "示警", "水文"],
  },

  weatherAlerts: {
    key: "weatherAlerts",
    section: { theme: "災害 Hazard", group: "即時警示" },
    label: "氣象特報 Weather Alerts",
    expandable: true,
    color: "#7c3aed",
    icon: CloudRain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ncdr_alerts", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "同 lifelineAlerts 的 `disaster-alerts` source，layer id `weatherAlerts-fill/-line/-point`（大面積特報，唯一不補 centroid 點的群組）—— 非 OVERLAY_REGISTRY",
    },
    legend: "lifelineAlerts",
    popup: "disasterAlert",
    params: { count: 1, kinds: ["slider"] },
    description: "NCDR 氣象特報（豪雨/強風/低溫等大面積警戒範圍）",
    topics: ["災害", "示警", "氣象"],
  },

  transitAlerts: {
    key: "transitAlerts",
    section: { theme: "災害 Hazard", group: "即時警示" },
    label: "交通阻斷 Transit Alerts",
    expandable: true,
    color: "#f97316",
    icon: TrainFront,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ncdr_alerts", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "同 lifelineAlerts 的 `disaster-alerts` source，layer id `transitAlerts-fill/-line/-point` —— 非 OVERLAY_REGISTRY",
    },
    legend: "lifelineAlerts",
    popup: "disasterAlert",
    params: { count: 1, kinds: ["slider"] },
    description: "NCDR 交通阻斷示警（道路封閉/鐵路中斷/航班異常）",
    topics: ["災害", "示警", "交通"],
  },

  safetyAlerts: {
    key: "safetyAlerts",
    section: { theme: "災害 Hazard", group: "即時警示" },
    label: "安全環境 Safety Alerts",
    expandable: true,
    color: "#ef4444",
    icon: AlertTriangle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ncdr_alerts", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "同 lifelineAlerts 的 `disaster-alerts` source，layer id `safetyAlerts-fill/-line/-point` —— 非 OVERLAY_REGISTRY",
    },
    legend: "lifelineAlerts",
    popup: "disasterAlert",
    params: { count: 1, kinds: ["slider"] },
    description: "NCDR 安全環境示警（毒災/輻射/公共安全事件）",
    topics: ["災害", "示警", "公共安全"],
  },

  // ⚠️ popup `earthquakes` 是**複數形、與 key 同名**；批 4 的 `earthquakesGlobal`
  //    是**單數形 `earthquakeGlobal`**。兩者相鄰又只差一個 Global，別互抄。
  earthquakes: {
    key: "earthquakes",
    section: { theme: "災害 Hazard", group: "地震 / 斷層" },
    label: "地震 Earthquake",
    expandable: true,
    color: "#ff3b30",
    icon: Activity,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "earthquake", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useEarthquakeLayer 自建 geojson source `earthquakes`（Supabase table earthquake_events 按時間窗載入），4 個 layer：earthquake-pre / -post / -ripple-0 / -ripple-1（後兩者是擴散動畫，不可點）—— 非 OVERLAY_REGISTRY",
    },
    legend: "earthquakes",
    popup: "earthquakes",
    params: { count: 2, kinds: ["slider", "select"] },
    description: "CWA 國內地震事件（依 timeline 分 pre/post/ripple 三態，圓徑依規模、色依深度）",
    topics: ["災害", "地震", "即時"],
  },

  // ⚠️ 本工程首例「**一個 key 對兩個 popup layerType**」（batch 5 schema commit
  //    為它把 `popup` 擴成陣列）。5 個 layer 裡兩個各自有 GIS_LAYERS 條目與 panel：
  //    測站點 `eq-replay-station-circle` → `earthquakeReplayStation`（GIS_LAYERS 第 90 列）
  //    鄉鎮面 `eq-replay-town-fill` → `earthquakeReplayTown`（第 286 列，大面積置末）
  //    陣列順序＝GIS_LAYERS 出現順序（first-hit-wins，重排會改掉點擊命中哪一層）。
  earthquakeReplay: {
    key: "earthquakeReplay",
    section: { theme: "災害 Hazard", group: "地震 / 斷層" },
    label: "地震回放 EQ Replay",
    expandable: true,
    color: "#e11d48",
    icon: Rewind,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "earthquake", confidence: "HIGH" }],
      processing: "CWA/NCDR/中研院五件套（事件 / 逐站 PGA / 368 鄉鎮震度 / 2.5km 等震度網格 / 震源機制解）合成單一事件回放動畫",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "earthquakeReplayLayerFactory 自建 4 個 source（eq-replay-epicenter / -stations / -grid / -township）× 5 個 layer；鄉鎮面走 PMTiles `./base_map/township_boundary.pmtiles` + promoteId TOWNCODE + feature-state 染色（通用路徑不支援故不進 OVERLAY_REGISTRY），資料本身走 Supabase RPC earthquake_replay_events + 4 張表",
    },
    legend: "earthquakeReplay",
    popup: ["earthquakeReplayStation", "earthquakeReplayTown"],
    params: { count: 1, kinds: ["slider"] },
    description: "單一地震事件回放（震央→P/S 波前→逐站 PGA→鄉鎮震度面→沙灘球）",
    topics: ["災害", "地震", "回放"],
  },

  // 本批唯一 dataClass A，也是唯一 `params: null`（useTransportParams 寫死
  // `case "activeFaults": return [];`，屬 emptyByDesign 5 key 之一，非抽取器漏掃）。
  // popup `activeFault` 是**去複數 s 的單數形**（同批 2 基礎建設 11/11 的形狀）。
  activeFaults: {
    key: "activeFaults",
    section: { theme: "災害 Hazard", group: "地震 / 斷層" },
    label: "活動斷層 Fault Zone",
    expandable: true,
    color: "#ef5350",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "earthquake", confidence: "LOW" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "active-faults",
      url: "./geo/active_faults.geojson",
    },
    legend: null,
    popup: "activeFault",
    params: null,
    description: "經濟部地調所活動斷層帶（glow + fill + line 三層）",
    topics: ["災害", "地震", "斷層"],
  },

  // 落雷家族 2 → 1：兩層各自一筆 config、各自獨佔一個 legend，
  // 但 **popup 共用 `lightningStrike`**（多對一，同批 1 fireEvents/fireLatest）。
  lightning: {
    key: "lightning",
    section: { theme: "災害 Hazard", group: "雷暴" },
    label: "落雷 Lightning 60min（台電）",
    expandable: true,
    color: "#fb923c",
    icon: CloudLightning,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "lightning_taipower", confidence: "HIGH" }],
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: "hazard-lightning",
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "lightning",
    popup: "lightningStrike",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "台電落雷偵測（滾動 60 分鐘視窗，halo + core 雙層，含電流強度）",
    topics: ["災害", "雷擊", "即時"],
  },

  lightningCwa: {
    key: "lightningCwa",
    section: { theme: "災害 Hazard", group: "雷暴" },
    label: "落雷 Lightning 60min（氣象署）",
    expandable: true,
    color: "#a78bfa",
    icon: CloudLightning,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "lightning_cwa", confidence: "HIGH" }],
      processing: "氣象署閃電落雷即時觀測（KMZ，滾動 1 小時視窗每 5 分更新）；只到分鐘級、無電流強度。台電源自 2026-07-10 起端點活著但永遠回空檔，本源為替代兼交叉驗證",
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: "hazard-lightning-cwa",
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "lightningCwa",
    popup: "lightningStrike",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "氣象署落雷偵測（滾動 60 分鐘視窗，台電源枯竭後的替代兼交叉驗證）",
    topics: ["災害", "雷擊", "即時"],
  },

  mountainRescueIncidents: {
    key: "mountainRescueIncidents",
    section: { theme: "災害 Hazard", group: "山域事故 Mountain Rescue" },
    label: "山域事故 Mountain Rescue",
    labelMobile: "山域事故 (2,465)",
    expandable: true,
    color: "#f2c94c",
    icon: Mountain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "mountain_rescue_incidents", confidence: "HIGH" }],
      processing: "消防署 2019-2024 山域意外事故救援案件 2,465 點（上游 CSV X/Y 欄名對調已修正）",
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "mountain-rescue-incidents",
      url: "./hazards/mountain_rescue_incidents.geojson",
    },
    legend: "mountainRescueIncidents",
    popup: "mountainRescueIncident",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "山域意外事故救援案件點（可依年份篩選，圓徑依受困人數）",
    topics: ["災害", "山域", "救援"],
  },

  // popup `nuclearStation` 與 key **完全無關**（不是單複數差異）——
  // 同批 1 legend 的 `civilDefenseShelter → policeStation`，只有逐 key 反查 layer id
  // （hazard-nuclear-core / -halo）才看得出來。
  nuclearRadiation: {
    key: "nuclearRadiation",
    section: { theme: "災害 Hazard", group: "核安" },
    label: "核安輻射 Radiation",
    expandable: true,
    color: "#22c55e",
    icon: Atom,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "nuclear_radiation_taipower", confidence: "HIGH" }],
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: "hazard-nuclear",
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "nuclearRadiation",
    popup: "nuclearStation",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "核能電廠周界環境輻射監測即時值（halo + core 雙層）",
    topics: ["災害", "核安", "輻射"],
  },

  // ══════════════════════════════════════════════════════════════
  // 🛰️ 太空 Space 16 層（AR-22 Phase 2 批 5）
  // ══════════════════════════════════════════════════════════════
  // **16 個 key 共用一切**：同一個 hook、同一份 upstream dataset、同一顆 icon、
  // 同一筆 legend（首個 key `satellitesYaogan`，拍板④）、同一個 popup layerType
  // （`satellite` ← layer id `sat-current-point`）、同一組 params（1 slider）。
  // 差異只在 color / label / section.group / description。
  //
  // 這是本工程規模最大的共用：**legend 16 → 1** 與 **popup 16 → 1** 同時發生，
  // 雙雙超過批 3 教育的 `school` 1 對 7。
  //
  // ⚠️ `satellites` 家族**沒有**走自己的 picking（本批預期的風險項）——
  // 它就是一條普通的 GIS_LAYERS 字面條目，`extractGisLayers` 直接抓得到，
  // 不需要像批 1/批 4 那樣補解析器。但這是**逐層打開 hook 讀 addLayer id 之後**
  // 才確定的，不是從「D 體質」推出來的。
  //
  // 色票：16 個在 HANDWRITTEN_LAYER_COLORS 原本就是字面 hex。`satelliteTypes.ts`
  // 的 `SATELLITE_COLORS` 是 **category-keyed**（`cat` 欄位值 → 色）且餵的是
  // hook 內的 match 表達式，`LAYER_COLORS` 從未 import 它 → 照批 2 反向判準寫字面。
  // ⚠️ 兩表的 hex 逐一相同（layer key 與 category 一一對應是巧合的整齊），
  // 但「有沒有在餵 LAYER_COLORS」才是判準，撞色不構成引用理由。

  satellitesTaiwan: {
    key: "satellitesTaiwan",
    section: { theme: "太空 Space", group: "台灣" },
    label: "台灣 FORMOSAT / TRITON / IRIS-C",
    expandable: true,
    color: "#4fc3f7",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "台灣自主衛星（福衛系列光學/雷達、獵風者 GNSS-R、IRIS-C 立方衛星）",
    topics: ["太空", "台灣", "遙測"],
  },

  satellitesYaogan: {
    key: "satellitesYaogan",
    section: { theme: "太空 Space", group: "中國" },
    label: "Yaogan 遙感",
    expandable: true,
    color: "#ef5350",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "中國遙感系列（軍用光學/電子偵察，16 層中數量最大的一支）",
    topics: ["太空", "中國", "偵察"],
  },

  satellitesJilin: {
    key: "satellitesJilin",
    section: { theme: "太空 Space", group: "中國" },
    label: "Jilin 吉林",
    expandable: true,
    color: "#ff7043",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "吉林一號商業遙感星座（長光衛星，高重訪率光學）",
    topics: ["太空", "中國", "商業遙感"],
  },

  satellitesGaofen: {
    key: "satellitesGaofen",
    section: { theme: "太空 Space", group: "中國" },
    label: "Gaofen 高分",
    expandable: true,
    color: "#ec407a",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "高分系列（國家高分辨率對地觀測，民用掛名的軍民兩用）",
    topics: ["太空", "中國", "對地觀測"],
  },

  satellitesTJS: {
    key: "satellitesTJS",
    section: { theme: "太空 Space", group: "中國" },
    label: "TJS / TJSW GEO 情報",
    expandable: true,
    color: "#ba68c8",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "通信技術試驗衛星（GEO 靜止軌道，普遍研判為預警/訊號情報）",
    topics: ["太空", "中國", "GEO"],
  },

  satellitesBeidou: {
    key: "satellitesBeidou",
    section: { theme: "太空 Space", group: "中國" },
    label: "北斗 BD-3 PNT",
    expandable: true,
    color: "#5e7ce2",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "北斗三號導航星座（PNT 定位授時，MEO/IGSO/GEO 混合軌道）",
    topics: ["太空", "中國", "導航"],
  },

  satellitesShiyan: {
    key: "satellitesShiyan",
    section: { theme: "太空 Space", group: "中國" },
    label: "Shiyan / Shijian 試驗",
    expandable: true,
    color: "#9e9e9e",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "試驗/實踐系列（技術驗證掛名，含在軌操作與變軌測試）",
    topics: ["太空", "中國", "試驗"],
  },

  satellitesUSA: {
    key: "satellitesUSA",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇺🇸 USA · KH / BlackSky / Planet",
    expandable: true,
    color: "#93c5fd",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "美國偵察與商業遙感（KH 鎖眼系列 + BlackSky / Planet 高重訪）",
    topics: ["太空", "美國", "偵察"],
  },

  satellitesJapan: {
    key: "satellitesJapan",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇯🇵 Japan · IGS / ALOS",
    expandable: true,
    color: "#fb7185",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "日本情報收集衛星 IGS 與陸域觀測 ALOS 系列",
    topics: ["太空", "日本", "偵察"],
  },

  satellitesRussia: {
    key: "satellitesRussia",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇷🇺 Russia · PERSONA / RESURS / COSMOS",
    expandable: true,
    color: "#a8a29e",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "俄羅斯偵察與資源觀測（PERSONA 光學、RESURS、COSMOS 軍用編號）",
    topics: ["太空", "俄羅斯", "偵察"],
  },

  satellitesIndia: {
    key: "satellitesIndia",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇮🇳 India · CARTOSAT / RISAT / EOS",
    expandable: true,
    color: "#f59e0b",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "印度對地觀測（CARTOSAT 製圖、RISAT 雷達、EOS 系列）",
    topics: ["太空", "印度", "對地觀測"],
  },

  satellitesKorea: {
    key: "satellitesKorea",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇰🇷 Korea · KOMPSAT",
    expandable: true,
    color: "#2dd4bf",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "南韓多用途實用衛星 KOMPSAT（阿里郎系列，光學 + SAR）",
    topics: ["太空", "南韓", "遙測"],
  },

  satellitesFrance: {
    key: "satellitesFrance",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇫🇷 France · CSO / PLEIADES / ELISA",
    expandable: true,
    color: "#3b82f6",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "法國軍用光學 CSO、商業 PLEIADES 與電子情報 ELISA",
    topics: ["太空", "法國", "偵察"],
  },

  satellitesGermany: {
    key: "satellitesGermany",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇩🇪 Germany · SAR-Lupe / SARah",
    expandable: true,
    color: "#fde047",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "德國軍用雷達偵察星座 SAR-Lupe 與後繼 SARah",
    topics: ["太空", "德國", "SAR"],
  },

  satellitesItaly: {
    key: "satellitesItaly",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇮🇹 Italy · COSMO-SkyMed",
    expandable: true,
    color: "#34d399",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "義大利 COSMO-SkyMed X 波段 SAR 星座（軍民兩用）",
    topics: ["太空", "義大利", "SAR"],
  },

  satellitesIsrael: {
    key: "satellitesIsrael",
    section: { theme: "太空 Space", group: "國際偵察" },
    label: "🇮🇱 Israel · Ofeq / EROS",
    expandable: true,
    color: "#c4b5fd",
    icon: Satellite,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "celestrak_satellites", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: { kind: "custom", note: SAT_SOURCE_NOTE },
    legend: "satellitesYaogan",
    popup: "satellite",
    params: { count: 1, kinds: ["slider"] },
    description: "以色列偵察衛星 Ofeq 與商業遙感 EROS",
    topics: ["太空", "以色列", "偵察"],
  },

  // ══════════════════════════════════════════════════════════════════
  //  🌤️ 環境氣候 Environment（Phase 2 批 6・19 層）
  // ══════════════════════════════════════════════════════════════════
  //
  // 四個子群體質截然不同：
  //   氣象 6 —— 1 A + 1 B + 4 D（影像/3D/網格全走自建 source）
  //   空品 3 —— 全 D（兩支 Supabase RPC 點層 + 一支 raster image source）
  //   環境污染 4 —— 全 B PMTiles，與試點 pollutionFacility 同主題
  //   都市樹木 6 —— B 4 + A 2
  //
  // ⚠️ 色票拍板①：19 層在 `HANDWRITTEN_LAYER_COLORS` 原本就是字面 hex，
  //    `pollutionTypes` / `temperatureGridTypes` / `microSensorTypes` 匯出的都是
  //    **表達式 / band 分色資料**（severity-keyed、溫度級距、PM2.5 級距），
  //    `LAYER_COLORS` 從未 import 它們 → 一律寫字面 hex，無 spread 可刪。
  //
  // ⚠️ legend 拍板④的例外條款（批 5 精煉）在本批第二次適用：
  //    `pollutionSite` 與試點 `pollutionFacility` **同一筆 LEGEND_REGISTRY entry**
  //    （PollutionSeverityLegend）→ 沿用試點的 freeform id `"pollution"`。
  //    但**裁處 3 層是另一筆 entry、另一個元件** → 不屬於 pollution 家族，
  //    照機械規則取自家 entry 首 key `"pollutionPenaltyCritical"`。
  //    （backlog 批 6 欄寫「環境污染 4 層沿用 pollution」是過度概括，
  //      4 層裡只有 pollutionSite 適用 —— 規則背後 load-bearing 的是
  //      「共用元件 ⇔ 共用 id」，不是「同一個子群」。）

  weatherStations: {
    key: "weatherStations",
    section: { theme: "環境氣候 Environment", group: "氣象" },
    label: "氣象站 Weather Station",
    expandable: true,
    color: "#4dd0e1",
    icon: CloudSun,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "weather", confidence: "HIGH" }],
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "weather-stations",
      url: "./geo/weather_stations.geojson",
    },
    legend: null,
    popup: "weatherStation",
    params: { count: 1, kinds: ["slider"] },
    description: "中央氣象署地面氣象測站點位（點擊看該站即時觀測）",
    topics: ["環境", "氣象", "測站"],
  },

  // 衛星雲圖 / 雷達回波是同一支 hook 的兩個 dataset：Supabase RPC 取 frame 清單 →
  // createCwaImageryLayer 建 Mapbox image source（非 OVERLAY_REGISTRY）→ 依 timeStore 換圖。
  cwaCloudImagery: {
    key: "cwaCloudImagery",
    section: { theme: "環境氣候 Environment", group: "氣象" },
    label: "衛星雲圖 Cloud Imagery",
    expandable: true,
    color: "#b0c4de",
    icon: Cloud,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cwa_satellite", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useCwaImageryLayer：Supabase RPC get_cwa_imagery_list / get_cwa_imagery_frame 取 CWA dataset O-C0042-004 的逐時影像 → createCwaImageryLayer 建 image source + raster layer（cwa-cloud-src / cwa-cloud-layer），依 timeStore 切 frame —— 非 OVERLAY_REGISTRY",
    },
    legend: null,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "中央氣象署真彩色衛星雲圖（逐時影像疊圖，隨時間軸播放）",
    topics: ["環境", "氣象", "衛星影像"],
  },

  cwaRadarImagery: {
    key: "cwaRadarImagery",
    section: { theme: "環境氣候 Environment", group: "氣象" },
    label: "雷達回波 Radar Imagery",
    expandable: true,
    color: "#4fc3f7",
    icon: CloudRain,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cwa_satellite", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "同 cwaCloudImagery 的 useCwaImageryLayer，dataset O-A0058-005，source/layer 為 cwa-radar-src / cwa-radar-layer —— 非 OVERLAY_REGISTRY",
    },
    legend: null,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "中央氣象署雷達回波合成圖（降雨強度，隨時間軸播放）",
    topics: ["環境", "氣象", "雷達"],
  },

  // 溫度波（3D）與溫度網格（2D fill）**共用同一份 RPC 資料**，差別只在呈現方式。
  temperatureWave: {
    key: "temperatureWave",
    section: { theme: "環境氣候 Environment", group: "氣象" },
    label: "溫度波 Temperature Wave",
    expandable: true,
    color: "#ff6b35",
    icon: Thermometer,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "weather", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "Three.js CustomLayer（temperatureWaveCustomLayer + TemperatureWaveScene，layer id temperature-wave-3d）：Supabase RPC get_temperature_grid_info / get_temperature_frames 取 0.03° 網格逐時溫度場 → 頂點高度依溫度起伏 —— 非 OVERLAY_REGISTRY",
    },
    legend: "temperatureWave",
    popup: null,
    params: { count: 5, kinds: ["toggle", "slider", "slider", "slider", "toggle"] },
    description: "全台氣溫場的 3D 起伏波形（高度＝溫度，隨時間軸變形）",
    topics: ["環境", "氣象", "溫度", "3D"],
  },

  temperatureGrid: {
    key: "temperatureGrid",
    section: { theme: "環境氣候 Environment", group: "氣象" },
    label: "溫度網格 Temperature Grid",
    expandable: true,
    color: "#f46d43",
    icon: Grid3x3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "weather", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "temperatureGridLayerFactory 自建 source temperature-grid-src + fill layer temperature-grid-fill：與 temperatureWave 共用同一份 RPC 網格資料，幾何只建一次、時間變化全走 setFeatureState（8k polygon 重建會卡死）—— 非 OVERLAY_REGISTRY",
    },
    legend: "temperatureGrid",
    popup: "temperatureGrid",
    params: { count: 1, kinds: ["slider"] },
    description: "全台氣溫場的 2D 方格色階（11 級 step 分色，點擊讀該格溫度）",
    topics: ["環境", "氣象", "溫度"],
  },

  // ⚠️ raster PMTiles → 無 sourceLayer（同批 3 的 canopyHeight）。
  urbanHeat: {
    key: "urbanHeat",
    section: { theme: "環境氣候 Environment", group: "氣象" },
    label: "都市熱島 Urban Heat",
    expandable: true,
    color: "#b2182b",
    icon: ThermometerSun,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "都市熱島地表溫度 raster PMTiles（Landsat 8/9 C2 L2 ST_B10 2019–2025 暖季合成，經 Microsoft Planetary Computer STAC；public/environment/urban_heat_lst_taiwan.pmtiles），國際衛星資料源非台灣 catalog",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "urban-heat-lst",
      url: "./environment/urban_heat_lst_taiwan.pmtiles",
      minzoom: 6,
      maxzoom: 11,
    },
    legend: "urbanHeat",
    popup: null,
    params: { count: 2, kinds: ["select", "slider"] },
    description: "地表溫度熱島強度（Landsat 熱紅外暖季合成，raster 切片）",
    topics: ["環境", "熱島", "衛星影像"],
  },

  aqiImagery: {
    key: "aqiImagery",
    section: { theme: "環境氣候 Environment", group: "空品" },
    label: "空氣品質色階 AQI Raster",
    expandable: true,
    color: "#8bc34a",
    icon: Wind,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "air_quality", confidence: "MED" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useAqiImageryLayer：Supabase RPC get_aqi_imagery_frames_batch 取 airtw 色階圖 24h frames → 複用 createCwaImageryLayer 建 image source + raster layer（aqi-imagery-src / aqi-imagery-layer）—— 非 OVERLAY_REGISTRY",
    },
    legend: "aqiImagery",
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "環境部空氣品質內插色階圖（全台面狀 AQI，隨時間軸播放）",
    topics: ["環境", "空品", "AQI"],
  },

  // ⚠️ params: null —— useTransportParams 寫死 `case "aqiStations": return []`
  //    （Phase 0 記錄的 emptyByDesign 5 key 之一）。THEMES 仍是 expandable: true，
  //    兩者的不一致是現況，搬移不夾帶修正。
  aqiStations: {
    key: "aqiStations",
    section: { theme: "環境氣候 Environment", group: "空品" },
    label: "空氣品質測站 AQI Station",
    expandable: true,
    color: "#00bcd4",
    icon: CircleDot,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "air_quality", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useAqiStationsLayer：Supabase RPC get_aqi_stations_at / get_aqi_stations_latest → 自建 source aqi-stations-src + 2 layer（aqi-stations-glow / aqi-stations-circle）—— 非 OVERLAY_REGISTRY",
    },
    legend: "aqiImagery",
    popup: "aqiStation",
    params: null,
    description: "環境部空品測站即時 AQI（點擊看該站六項污染物讀值）",
    topics: ["環境", "空品", "測站"],
  },

  aqiMicroSensors: {
    key: "aqiMicroSensors",
    section: { theme: "環境氣候 Environment", group: "空品" },
    label: "LASS 微型感測 Micro Sensor",
    expandable: true,
    color: "#7e57c2",
    icon: Activity,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "air_quality", confidence: "HIGH" }],
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useMicroSensorsLayer：Supabase RPC get_micro_sensors_latest（5 分鐘 refetch，對齊 LASS collector）→ 自建 source aqi-micro-src + 3 layer（cluster / cluster-count / aqi-micro-circle），cluster 開關會重建 source —— 非 OVERLAY_REGISTRY",
    },
    legend: "aqiMicroSensors",
    popup: "microSensor",
    params: { count: 2, kinds: ["select", "toggle"] },
    description: "LASS 民間微型感測器即時 PM2.5 / 溫度 / 濕度（約 500 點，可聚合）",
    topics: ["環境", "空品", "公民科學"],
  },

  // 裁處 3 層共用同一份 PMTiles **同一個 sourceId**（pollution-penalty），
  // 以 severity_event 的 layer-level filter 切分 —— 同批 2 運動場館的形狀。
  // popup 也是 3 → 1（同一筆 GIS_LAYERS 條目列了 3 個 layer id → pollutionPenalty）。
  pollutionPenaltyCritical: {
    key: "pollutionPenaltyCritical",
    section: { theme: "環境氣候 Environment", group: "環境污染" },
    label: "重大裁處 Critical Penalty",
    labelMobile: "重大裁處 Critical",
    expandable: true,
    color: "#ef4444",
    icon: AlertTriangle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "pollution_source", confidence: "HIGH" }],
      processing: "EMS_P_46 裁處事件 geocoded → severity_event=critical 重大裁處 PMTiles filter",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "pollution-penalty",
      url: "./geo/pollution_penalties.pmtiles",
      sourceLayer: "pollution_penalties",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "pollutionPenaltyCritical",
    popup: "pollutionPenalty",
    params: { count: 6, kinds: ["slider", "slider", "select", "select", "select", "toggle"] },
    description: "環境部重大裁處事件點位（罰鍰金額 / 違反法規 / 裁處年份可篩）",
    topics: ["環境", "污染", "裁處"],
  },

  pollutionPenaltyGeneral: {
    key: "pollutionPenaltyGeneral",
    section: { theme: "環境氣候 Environment", group: "環境污染" },
    label: "一般裁處 General Penalty",
    labelMobile: "一般裁處 General",
    expandable: true,
    color: "#94a3b8",
    icon: AlertCircle,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "pollution_source", confidence: "HIGH" }],
      processing: "EMS_P_46 裁處事件 geocoded → severity_event=high/normal 一般裁處 PMTiles filter",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "pollution-penalty",
      url: "./geo/pollution_penalties.pmtiles",
      sourceLayer: "pollution_penalties",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "pollutionPenaltyCritical",
    popup: "pollutionPenalty",
    params: { count: 6, kinds: ["slider", "slider", "select", "select", "select", "toggle"] },
    description: "環境部一般裁處事件點位（severity high / normal）",
    topics: ["環境", "污染", "裁處"],
  },

  pollutionPenaltyMobile: {
    key: "pollutionPenaltyMobile",
    section: { theme: "環境氣候 Environment", group: "環境污染" },
    label: "移動污染 Mobile Penalty",
    labelMobile: "移動污染 Mobile",
    expandable: true,
    color: "#22c55e",
    icon: Car,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "pollution_source", confidence: "HIGH" }],
      processing: "EMS_P_46 裁處事件 geocoded → severity_event=mobile 移動污染 PMTiles filter",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "pollution-penalty",
      url: "./geo/pollution_penalties.pmtiles",
      sourceLayer: "pollution_penalties",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "pollutionPenaltyCritical",
    popup: "pollutionPenalty",
    params: { count: 6, kinds: ["slider", "slider", "select", "select", "select", "toggle"] },
    description: "移動污染源（車輛）裁處事件點位",
    topics: ["環境", "污染", "裁處", "交通"],
  },

  // ⚠️ legend 沿用試點 pollutionFacility 的 `"pollution"`（同一筆 LEGEND_REGISTRY
  //    entry / 同一個 PollutionSeverityLegend 元件）—— 拍板④例外條款第二例。
  pollutionSite: {
    key: "pollutionSite",
    section: { theme: "環境氣候 Environment", group: "環境污染" },
    label: "污染場址 Site",
    labelMobile: "污染場址 Site (8,253)",
    expandable: true,
    color: "#111827",
    icon: Biohazard,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "pollution_source", confidence: "HIGH" }],
      processing: "EMS_S_07 確認污染場址（S4）PMTiles",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "pollution-site",
      url: "./geo/pollution_sites.pmtiles",
      sourceLayer: "pollution_sites",
      minzoom: 0,
      maxzoom: 14,
    },
    legend: "pollution",
    popup: "pollutionSite",
    params: { count: 3, kinds: ["slider", "slider", "toggle"] },
    description: "環境部列管確認污染場址 8,253 處（土壤 / 地下水污染整治場址）",
    topics: ["環境", "污染", "場址"],
  },

  streetTreesTaipeiDiff: {
    key: "streetTreesTaipeiDiff",
    section: { theme: "環境氣候 Environment", group: "都市樹木 Urban Trees" },
    label: "行道樹變化 Street Tree Diff",
    expandable: true,
    color: "#2e7d32",
    icon: TreePine,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "street_trees_taipei_diff", confidence: "HIGH" }],
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "street-trees-taipei-diff",
      url: "./urban/street_trees_taipei_diff.pmtiles",
      sourceLayer: "street_trees_taipei_diff",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "streetTreesTaipeiDiff",
    popup: "streetTreesTaipeiDiff",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "台北行道樹兩時點比對（新植 / 移除 / 存續，逐株軌跡）",
    topics: ["環境", "都市樹木", "台北"],
  },

  streetTreesTaipei3epoch: {
    key: "streetTreesTaipei3epoch",
    section: { theme: "環境氣候 Environment", group: "都市樹木 Urban Trees" },
    label: "行道樹三時點 Street Tree 3-Epoch",
    expandable: true,
    color: "#558b2f",
    icon: Sprout,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "台北行道樹三時點 2022/2024/2026 軌跡（public/urban/street_trees_taipei_3epoch.pmtiles），catalog 待建",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "street-trees-taipei-3epoch",
      url: "./urban/street_trees_taipei_3epoch.pmtiles",
      sourceLayer: "street_trees_taipei_3epoch",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "streetTreesTaipei3epoch",
    popup: "streetTreesTaipei3epoch",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "台北行道樹 2022 / 2024 / 2026 三時點存續軌跡",
    topics: ["環境", "都市樹木", "台北"],
  },

  streetTreesNational: {
    key: "streetTreesNational",
    section: { theme: "環境氣候 Environment", group: "都市樹木 Urban Trees" },
    label: "行道樹全國 Street Trees TW",
    expandable: true,
    color: "#43a047",
    icon: TreePalm,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "行道樹全國分佈 台北+台中 210,436 點（public/urban/street_trees_national.pmtiles），catalog 待建",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "street-trees-national",
      url: "./urban/street_trees_national.pmtiles",
      sourceLayer: "street_trees_national",
      minzoom: 5,
      maxzoom: 14,
    },
    legend: "streetTreesNational",
    popup: "streetTreesNational",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "行道樹全國分佈 210,436 株（目前涵蓋台北 + 台中）",
    topics: ["環境", "都市樹木"],
  },

  protectedTreesNational: {
    key: "protectedTreesNational",
    section: { theme: "環境氣候 Environment", group: "都市樹木 Urban Trees" },
    label: "受保護樹木 Protected Trees",
    expandable: true,
    color: "#00695c",
    icon: TreeDeciduous,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "受保護樹木全國 8 城彙整（public/urban/protected_trees_national.geojson），catalog 待建",
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "protected-trees-national",
      url: "./urban/protected_trees_national.geojson",
    },
    legend: "protectedTreesNational",
    popup: "protectedTreesNational",
    params: { count: 4, kinds: ["select", "select", "slider", "slider"] },
    description: "各縣市列管受保護老樹（8 城彙整，樹種 / 樹齡 / 胸徑）",
    topics: ["環境", "都市樹木", "保護"],
  },

  riversideTreesTaipei: {
    key: "riversideTreesTaipei",
    section: { theme: "環境氣候 Environment", group: "都市樹木 Urban Trees" },
    label: "河濱喬木 Riverside Trees",
    expandable: true,
    color: "#0288d1",
    icon: Waves,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "台北河濱喬木 30 座河濱公園（public/urban/riverside_trees_taipei.geojson），catalog 待建",
    },
    dataClass: "A",
    source: {
      kind: "geojson",
      sourceId: "riverside-trees-taipei",
      url: "./urban/riverside_trees_taipei.geojson",
    },
    legend: "riversideTreesTaipei",
    popup: "riversideTreesTaipei",
    params: { count: 3, kinds: ["select", "slider", "slider"] },
    description: "台北 30 座河濱公園喬木清冊",
    topics: ["環境", "都市樹木", "台北", "河濱"],
  },

  treePitsTaipei: {
    key: "treePitsTaipei",
    section: { theme: "環境氣候 Environment", group: "都市樹木 Urban Trees" },
    label: "人行道樹穴 Tree Pits",
    expandable: true,
    color: "#8d6e63",
    icon: Flower2,
    upstream: {
      status: "catalog_missing",
      datasets: [],
      note: "台北人行道樹穴 56,720 面（public/urban/tree_pits_taipei.pmtiles），catalog 待建",
    },
    dataClass: "B",
    source: {
      kind: "pmtiles",
      sourceId: "tree-pits-taipei",
      url: "./urban/tree_pits_taipei.pmtiles",
      sourceLayer: "tree_pits_taipei",
      minzoom: 11,
      maxzoom: 16,
    },
    legend: "treePitsTaipei",
    popup: "treePitsTaipei",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "台北人行道樹穴 56,720 面（面狀，含空穴 / 已植）",
    topics: ["環境", "都市樹木", "台北"],
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
