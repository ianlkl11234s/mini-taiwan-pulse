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
// ⚠️ import 方向：本檔只能 import `../types` 與 lucide-react（純常數可）。
//    layerCatalog / IconRailSidebar / upstreamRegistry 是**下游**，反向 import
//    會造成 cycle（layerVisibilityStore → layerCatalog → layerManifest 這條鏈上
//    任何回頭都會炸）。

import type { LucideIcon } from "lucide-react";
import { Video, Radio, LandPlot, TrainFront, Factory } from "lucide-react";
import type { LayerVisibility, FeatureInfo } from "../types";
import type { UpstreamRef } from "./upstreamRegistry";

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
 *   D 前端自繪 —— Three.js / WebGL CustomLayer，**沒有 OVERLAY_REGISTRY entry**。
 *                 paint/legend 的派生機制對它不適用，manifest 的 source 欄位
 *                 走 kind:"custom"。
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
