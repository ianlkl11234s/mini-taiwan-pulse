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
} from "lucide-react";
import type { LayerVisibility, FeatureInfo } from "../types";
import type { UpstreamRef } from "./upstreamRegistry";
import { RELIGION_LAYER_COLORS } from "./religionTypes";
import { FUNERAL_LAYER_COLORS } from "./funeralTypes";

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
