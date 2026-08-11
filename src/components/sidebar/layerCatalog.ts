// ══════════════════════════════════════════════════════════════════
//  Layer Catalog — Sidebar 圖層目錄「單一真實來源」
// ══════════════════════════════════════════════════════════════════
//
// LayerSidebar（手機版）與 IconRailSidebar（桌機版）共用此檔。
//
// 結構（2026-07 現況，PR #72 後）：
// - 22 主題（Theme） → 多子群（SubGroup） → 多 Layer
// - SECTIONS 為 derived flat list，每筆 SectionDef = 一個 SubGroup，
//   title 格式：`主題中文 English · 子群中文`，視覺上連續行構成主題分組。
//   下一階段 sidebar 升級後可直接消費 THEMES。
//
// 規則：
// - LAYER_COLORS：型別強制 Record<keyof LayerVisibility, string>，
//   缺 key 會 tsc 報錯 → 新增 layer 必補色。
// - THEMES：新 SSOT；新增 layer 把 key 放進對應 theme.groups[].layers。
// - 命名格式：`中文 English`（例：「水資源 Water」「國道 Highway」）。
// - 預設開關由 useLayerVisibility 控制；動態 RPC 原則上預設關閉。
//
// 排序原則：
// 1. BASE 頂置（不算主題、純底圖）
// 2. 主題順序沿七段敘事帶推進：
//    基準/脈動 → 人與城市 → 公共服務 → 安全緊急 → 環境資源 → 產業 → 情報
// 3. 每主題內子群順序：點位 → 線/面 → 即時 → 分析

import type { LayerVisibility, TransportType } from "../../types";

// ── Color Config ──

import {
  LAYER_MANIFEST, manifestColors,
  type ManifestKey, type LayerManifestEntry,
} from "../../data/layerManifest";

/**
 * 尚未搬進 layerManifest 的手寫色票（AR-22 雙軌過渡）。
 *
 * 型別是 `Omit<Record<全集>, ManifestKey>` —— tsc 雙向把關：
 *   - 漏掉任一「還沒搬」的 key → TS2739 缺屬性
 *   - 已搬進 manifest 的 key 還留在這裡 → excess property 報錯
 * 所以「搬走了但手寫值沒刪」這種「改 manifest 畫面沒反應」的暗雷不可能存在。
 */
const HANDWRITTEN_LAYER_COLORS: Omit<Record<keyof LayerVisibility, string>, ManifestKey> = {
  // 🎓 教育總覽層 schools 已搬進 layerManifest（AR-22 Phase 2 批 3）——
  //    它不在 EDUCATION_LAYER_COLORS 裡，色票是本表自己的字面值，隨 entry 一起搬走
  // ⚠️ 災害 Hazard 12 層已搬進 layerManifest（AR-22 Phase 2 批 5）——
  //    本處原有 9 層（斷層/地震 3 + 山域 1 + NCDR 示警 5），另 3 層在下方雷暴/核安處。
  //    12 個色票原本就是字面 hex（disasterAlertTypes 的 ALERT_GROUPS 是 event_term-keyed
  //    分色表、從未餵本表），照拍板①判準寫字面。
  //    ⚠️ 「全球氣候 GLOBAL CLIMATE」註解原本夾在中間，其 5 層已於批 4 搬走
  medICUBeds: "#ff1744",
  // 🌾 農業 Agriculture 29 層已搬進 layerManifest（AR-22 Phase 2 批 7）——
  //    agriPOITypes.ts 的 AGRI_POI_TYPES[].color 是 poi_type-keyed（餵
  //    agricultureLayerFactory 的 circle-color match 表達式），不是 layer-key-keyed
  //    的色票記錄，本表從未 import 它 → manifest 寫字面 hex。
  //    ⚠️ 本主題的 farmRoads / ecoNetworkZones **不在這一段**，落在本表下方教育註解之後
  //    （歷史位置）—— 按區塊整段刪會漏掉，逐 key grep 定位才對（同批 3 schools）。
  // 📍 底圖 buildingsGba / urbanZoningNewTaipei / nonUrbanZoning 已搬進 layerManifest
  //    （AR-22 Phase 2 批 5，與下方 Base map 區塊的 9 層同批）
  // 🧳 觀光 Tourism 11 層已搬進 layerManifest（AR-22 Phase 2 批 2）——
  //    tourTypes.ts 的 TOUR_*_COLOR 是 category-keyed 的 match 表達式、不是
  //    layer-key-keyed 的色票記錄，本表從未 import 它 → manifest 寫字面 hex。
  // 🛕 宗教 Religion 6 層 / ⚰️ 殯葬 Funeral 5 層已搬進 layerManifest
  //    （AR-22 Phase 2 批 1）—— 色票 SSOT 仍是 religionTypes.ts / funeralTypes.ts
  //    的 *_LAYER_COLORS，manifest 的 color 欄直接引用它們。
  //    ⚠️ spread **不觸發 excess property check**，所以這裡若留著
  //    `...RELIGION_LAYER_COLORS` / `...FUNERAL_LAYER_COLORS`，tsc / 黃金快照 /
  //    契約測試會全綠但登記沒真搬走（manifest 後蓋、值又相同）→ 必須整行刪掉。
  //    這是雙軌護欄唯一擋不到的漏法。
  // 🎓 教育 Education 17 層已搬進 layerManifest（AR-22 Phase 2 批 3）——
  //    `...EDUCATION_LAYER_COLORS` spread 已依上述理由整行刪除（連同本檔的 import）；
  //    色票 SSOT 仍是 educationTypes.ts，manifest 的 color 欄逐 key 引用它。
  // 🌾 農業的 farmRoads / ecoNetworkZones 原本落在此處（不在上方農業區塊），
  //    已隨農業 29 層搬進 layerManifest（AR-22 Phase 2 批 7）
  // 🌲 林業 Forestry 16 層已搬進 layerManifest（AR-22 Phase 2 批 3）——
  //    forestReserveTypes / canopyGiantsTypes 匯出的是 category-keyed 的分色表達式
  //    （保安林種類／離步道距離帶），不是 layer-key-keyed 的色票記錄，本表從未
  //    import 它們 → manifest 寫字面 hex（同批 2 觀光的判準）。
  // 🗑️ 廢棄物 Waste 18 層已搬進 layerManifest（AR-22 Phase 2 批 7）——
  //    wasteLoader 的 WASTE_FACILITY_COLORS / WASTE_DISPOSAL_COLORS 是
  //    facility_type / point_type-keyed（餵 wasteMapboxLayers 的 circle-color），
  //    不是 layer-key-keyed 的色票記錄，本表從未 import 它們 → manifest 寫字面 hex
  //    （hex 逐一相同是巧合，同批 5 SATELLITE_COLORS 的判準）。
  //    ⚠️ 下面兩個 orphan **不屬本批**：不在 THEMES（由 wasteTruck 子 UI 控制），
  //    section 欄位要先允許 null 才搬得動 → 批 8。
  wasteRoute: "#84cc16",
  wasteStop: "#65a30d",
  // 🛰️ 太空 Space 16 層已搬進 layerManifest（AR-22 Phase 2 批 5）——
  //    satelliteTypes 的 SATELLITE_COLORS 是 category-keyed（`cat` 欄位值 → 色，
  //    餵 hook 內的 match 表達式），本表從未 import 它 → 照拍板①判準寫字面 hex
  //    （兩表 hex 逐一相同是巧合，不構成引用理由）
  powerPlants: "#facc15",
  powerStatusHud: "#22c55e",
  powerRegionDemand: "#3b82f6",
  osmSolarFarms: "#fbbf24",
  osmPowerPlantsStatic: "#9ca3af",
  islandPowerGrid: "#a78bfa",
  facOffshore: "#1F4373",
  // ⚠️ 災害 lightning / lightningCwa / nuclearRadiation 已搬進 layerManifest
  //    （AR-22 Phase 2 批 5，與上方災害 9 層同批）
  // 🏢 房地產 Real Estate 7 層已搬進 layerManifest（AR-22 Phase 2 批 4）——
  //    7 個色票原本就是字面 hex（沒有 *_LAYER_COLORS 常數在餵這張表），照拍板①判準寫字面
  // 📍 底圖 Base Map 12 層已搬進 layerManifest（AR-22 Phase 2 批 5）——
  //    12 個色票原本就是字面 hex（沒有 *_LAYER_COLORS 常數在餵這張表），照拍板①判準寫字面。
  //    ⚠️ 夾在中間的 osmExpressway **不屬底圖**（THEMES 位置是「交通 Move / 路網」），
  //    已隨交通主題搬進 layerManifest（AR-22 Phase 2 批 8）
  // 👮 執法治安 20 層（含警察覆蓋分析 isochrone 3 層）已搬進 layerManifest
  //    （AR-22 Phase 2 批 4）—— 20 個色票原本就是字面 hex，無 spread 可刪
  // 環境污染 POLLUTION
};

/**
 * 色票全集 —— 手寫殘量 + manifest 派生。
 * 型別維持 `Record<keyof LayerVisibility, string>`（tsc 護欄不因引入 manifest 而弱化）。
 */
export const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  ...HANDWRITTEN_LAYER_COLORS,
  ...manifestColors(),
};

// ── Transport Labels ──

/**
 * ⚠️ **第五張手寫表，不在 AR-22 派生的四張裡**（同 `GATED_LAYERS`，批 7 已有前例）。
 * 這 6 個值與 manifest 的 `label` 逐字重複（`rail` 自 Phase 1 試點起就是如此、
 * 其餘 5 個自批 8 起），是真的漂移風險 —— 但它的 key 空間是 `TransportType`
 * 不是 `keyof LayerVisibility`，硬套 `Omit<…, ManifestKey>` 會把型別意義弄壞。
 * 留給 Phase 3 連同 `LEGEND_REGISTRY` / `GIS_LAYERS` 一起派生化，**本批不動**。
 */
export const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: "航班 Flight",
  ships: "船舶 Ship",
  rail: "鐵道 Rail",
  busLive: "公車 Bus",
  busIntercityLive: "公路客運 InterCity",
  touristShuttleLive: "台灣好行 Tourist Shuttle",
};

// ── Type Defs ──

export interface LayerDef {
  key: keyof LayerVisibility;
  /** 桌機 IconRailSidebar 顯示文字（預設） */
  label: string;
  /** 手機 LayerSidebar 顯示文字（多為較長全稱）；未填則沿用 label */
  labelMobile?: string;
  expandable?: boolean;
  /**
   * owner-only 私人圖層：非 owner 帳號顯示鎖頭、禁 toggle。
   * runtime SSOT 為下方 GATED_LAYERS（兩個 sidebar + App toggle gate 共用）。
   */
  gated?: boolean;
}

export interface SubGroupDef {
  /** 子群顯示名（中文） */
  title: string;
  layers: LayerDef[];
}

export interface ThemeDef {
  /** 主題名 `中文 English` 格式 */
  title: string;
  /** 預設是否摺疊（僅環境氣候 Environment = false，其餘全部 true） */
  defaultCollapsed?: boolean;
  groups: SubGroupDef[];
}

// 舊型別保留 — 用於 SECTIONS derived flat 結構（兩個 sidebar 元件目前消費此型）
export interface SectionDef {
  title: string;
  layers: LayerDef[];
}

/**
 * 從 layerManifest 取出一筆 LayerDef（AR-22 雙軌過渡）。
 *
 * ⚠️ 用法是**就地替換**：把原本 `{ key: "cctv", label: "…", expandable: true }`
 * 這一行換成 `fromManifest("cctv")`，**位置不動**。THEMES 是有序巢狀結構，
 * 順序就是 UI 顯示順序 —— 若改成「派生的 append 在最後」，圖層會整批換位置，
 * 黃金快照的 themes/sidebarSections section 立刻紅。
 *
 * 選填欄位用條件展開而非 `labelMobile: m.labelMobile`：後者會產生一個值為
 * undefined 的**存在的 key**，跟「這個 key 不存在」在序列化/比對上是兩回事。
 */
function fromManifest(key: ManifestKey): LayerDef {
  // 顯式標成 LayerManifestEntry：LAYER_MANIFEST 走 `satisfies`，逐筆型別只含
  // 該筆真的寫了的欄位 —— 直接讀 m.gated 會被 TS 判成不存在。這裡要的是
  // 「介面上宣告過的選填欄位」語意，widen 到介面才對。
  const m: LayerManifestEntry = LAYER_MANIFEST[key];
  // orphan（section: null）沒有 LayerDef 可派生 —— 連 label 都不存在（型別是 never）。
  // 走到這裡代表有人把 orphan key 寫進了 THEMES，那是接線錯誤不是資料錯誤，
  // 早炸勝過渲染出一顆沒有文字的 toggle。同時也把 union 收斂成 themed 變體。
  if (m.section === null) {
    throw new Error(`[layerManifest] ${key} 是 orphan（不在 THEMES），不該被 fromManifest 引用`);
  }
  const def: LayerDef = { key: m.key, label: m.label };
  if (m.labelMobile !== undefined) def.labelMobile = m.labelMobile;
  if (m.expandable !== undefined) def.expandable = m.expandable;
  if (m.gated !== undefined) def.gated = m.gated;
  return def;
}

// ── THEMES（新 SSOT）──

/**
 * 「世界 World」主題 title —— 獨立 rail tab「世界」的唯一來源。
 * 桌機主 Layers panel 用 WORLD_TAB_THEME_TITLES 把世界 tab 的主題濾掉（只在世界 tab 出現），
 * 世界 tab 則只渲染這批主題（陣列順序＝世界 tab 內的顯示順序）。
 */
export const WORLD_THEME_TITLE = "世界 World";

/** 劃入「世界」rail tab 的主題清單（2026-07-19 全球氣候自主 Layers panel 搬入）。 */
export const WORLD_TAB_THEME_TITLES: string[] = [WORLD_THEME_TITLE, "全球氣候 Global Climate"];

export const THEMES: ThemeDef[] = [
  // ───────────────────────────────────────────────────────────────
  // 📍 BASE 底圖（頂置・預設摺疊）
  // ───────────────────────────────────────────────────────────────
  {
    title: "底圖 Base Map",
    defaultCollapsed: true,
    groups: [
      {
        title: "行政邊界",
        layers: [
          fromManifest("countyBoundary"),
          fromManifest("townshipBoundary"),
          fromManifest("villageBoundary"),
        ],
      },
      {
        title: "地形",
        layers: [
          fromManifest("contour25k"),
          fromManifest("contourDtm20"),
          fromManifest("hillshade"),
          fromManifest("slopeVector"),
          fromManifest("aspectVector"),
        ],
      },
      {
        title: "建成環境",
        layers: [
          fromManifest("buildingsGba"),
        ],
      },
      {
        // 官方參考底圖（非分析產物）——上游 topic-research 原始目標即「pulse 底圖層」
        title: "土地使用分區 Zoning",
        layers: [
          fromManifest("urbanZoningTaipei"),
          fromManifest("urbanZoningNewTaipei"),
          // 與上面兩層互補：那兩層是「都市計畫區內」，本層是「非都市土地」，合起來是全國拼圖
          fromManifest("nonUrbanZoning"),
        ],
      },
      {
        title: "道路底圖",
        layers: [
          fromManifest("osmRoadDrive"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚦 MOVE 交通
  // ───────────────────────────────────────────────────────────────
  {
    title: "交通 Move",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時運具",
        layers: [
          fromManifest("flights"),
          fromManifest("ships"),
          fromManifest("rail"),
          fromManifest("busLive"),
          fromManifest("busIntercityLive"),
          fromManifest("touristShuttleLive"),
        ],
      },
      {
        title: "場站",
        layers: [
          fromManifest("stationsTHSR"),
          fromManifest("stationsTRA"),
          fromManifest("stationsMetro"),
          fromManifest("busStationsCity"),
          fromManifest("busStationsIntercity"),
          fromManifest("bikeStations"),
        ],
      },
      {
        title: "路網",
        layers: [
          fromManifest("highways"),
          fromManifest("osmExpressway"),
          fromManifest("provincialRoads"),
          fromManifest("cyclingRoutes"),
          fromManifest("cctv"),
          fromManifest("etcGantry"),
          fromManifest("serviceArea"),
          fromManifest("serviceAreaPolygon"),
          fromManifest("taxiStand"),
        ],
      },
      {
        title: "樞紐節點",
        layers: [
          fromManifest("ports"),
          fromManifest("airports"),
          fromManifest("lighthouses"),
          fromManifest("aviationControl"),
          fromManifest("aviationRestricted"),
          fromManifest("droneNoFlyZone"),
          fromManifest("droneRestrictedZone"),
        ],
      },
      {
        title: "即時監控",
        layers: [
          fromManifest("freewayCongestion"),
          fromManifest("roadCongestion"),
          fromManifest("roadEvents"),
        ],
      },
      {
        title: "停車 Parking",
        layers: [
          fromManifest("parkingOnstreet"),
          fromManifest("parkingOffstreet"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 👥 PEOPLE 人口社經
  // ───────────────────────────────────────────────────────────────
  {
    title: "人口社經 People",
    defaultCollapsed: true,
    groups: [
      {
        title: "人口分布",
        layers: [
          fromManifest("popCount"),
          fromManifest("h3Population"),
          fromManifest("indicators"),
        ],
      },
      {
        title: "社經",
        layers: [
          fromManifest("socioeconomic"),
          fromManifest("spatialEconomy"),
        ],
      },
      {
        title: "共享運具",
        layers: [
          fromManifest("youbikeFullness"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏙️ URBAN ANALYSIS 都市分析（都市 × 環境交叉分析；未來熱島效應、風廊等進此區）
  // ───────────────────────────────────────────────────────────────
  {
    title: "都市分析 Urban Analysis",
    defaultCollapsed: true,
    groups: [
      {
        title: "都市紋理",
        layers: [
          fromManifest("urbanFormGrid"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏠 ESTATE 房地產
  // ───────────────────────────────────────────────────────────────
  {
    title: "房地產 Real Estate",
    defaultCollapsed: true,
    groups: [
      {
        title: "租賃",
        layers: [
          fromManifest("realEstateRentalGrid"),
          fromManifest("realEstateRentalPoint"),
        ],
      },
      {
        title: "買賣",
        layers: [
          fromManifest("realEstateSaleGrid"),
          fromManifest("realEstateSalePoint"),
        ],
      },
      {
        title: "預售",
        layers: [
          fromManifest("realEstatePresaleGrid"),
          fromManifest("realEstatePresalePoint"),
        ],
      },
      {
        // 上三組是「單價」（每 m² 多貴），本組是「總量」（這格壓了多少錢）——語意不同，見圖例
        title: "總市值",
        layers: [
          fromManifest("propertyValueGrid"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏗️ INFRA 基礎建設
  // ───────────────────────────────────────────────────────────────
  {
    title: "基礎建設 Infrastructure",
    defaultCollapsed: true,
    groups: [
      {
        title: "通訊",
        layers: [
          fromManifest("submarineCables"),
          fromManifest("landingStations"),
        ],
      },
      {
        title: "公共設施",
        layers: [
          // 2026-08-08：schools 搬到「教育 Education」主題（第 38 主題），此處不再列出
          fromManifest("convenienceStores"),
          fromManifest("postOffices"),
          fromManifest("iPostBoxes"),
          fromManifest("communityCenters"),
          fromManifest("govServiceOffices"),
          fromManifest("publicLibraries"),
          fromManifest("welfareCenters"),
          fromManifest("retailMarkets"),
          fromManifest("publicToilets"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚡ ENERGY 能源
  // ───────────────────────────────────────────────────────────────
  {
    title: "能源 Energy",
    defaultCollapsed: true,
    groups: [
      {
        title: "電力 · 廠",
        layers: [
          fromManifest("facPrimary"),
          fromManifest("facPlanned"),
          fromManifest("facHistorical"),
          fromManifest("facSecondary"),
          fromManifest("facOsmSupplement"),
          fromManifest("powerGenerationUnit"),
          fromManifest("powerPlantGlow"),
          fromManifest("aviationRestrictedGlow"),
        ],
      },
      {
        title: "電力 · 電網",
        layers: [
          fromManifest("osmSubstationsEhv"),
          fromManifest("substationEhvGlow"),
          fromManifest("osmSubstations"),
          fromManifest("osmPowerLines"),
          fromManifest("powerLinesGlow"),
          fromManifest("osmPowerTowers"),
          fromManifest("powerPoles"),
        ],
      },
      {
        title: "再生能源",
        layers: [
          fromManifest("offshoreWindZones"),
          fromManifest("osmWindTurbines"),
          fromManifest("windPlan"),
          fromManifest("geothermalWells"),
          fromManifest("renewablePermitsTaipei"),
          fromManifest("evChargingStations"),
        ],
      },
      {
        title: "石化 · 加油站",
        layers: [
          fromManifest("gasStationCpc"),
          fromManifest("gasStationFpcc"),
          fromManifest("gasStationTaisugar"),
          fromManifest("gasStationOther"),
          fromManifest("gasStationCanonical"),
        ],
      },
      {
        title: "石化 · 油氣",
        layers: [
          fromManifest("lpgSubpackaging"),
          fromManifest("lpgRetailers"),
          fromManifest("lngTerminal"),
          fromManifest("pipelineGas"),
          fromManifest("pipelineOilGas"),
          fromManifest("industrialRefinery"),
          fromManifest("industrialStorageTank"),
          fromManifest("industrialPowerPlant"),
          fromManifest("coalTerminal"),
          fromManifest("fossilFuelInfra"),
        ],
      },
      {
        title: "覆蓋分析",
        layers: [
          fromManifest("gasCoverageAll"),
          fromManifest("gasCoverageCpc"),
          fromManifest("gasCoverageFpcc"),
          fromManifest("gasCoverageTaisugar"),
          fromManifest("evIsland"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🎓 EDUCATION 教育（2026-08-08 第 38 主題；上游 education 批次）
  // 🔴 6 個學校點層共用同一份 schools.geojson（4,315 點）：
  //    schools 為總覽（依學制上色），5 個 eduSchool* 為分級篩選，
  //    eduRemoteSchools 走 region_type 標記（非偏遠是 JSON null，見 educationTypes.ts）。
  //    schools 於本日自「基礎建設 → 公共設施」搬入本主題。
  //    eduUniversityStudents 雖在「學校」群，但讀自己的 university_students.geojson（159 筆，英文欄位）。
  // ───────────────────────────────────────────────────────────────
  {
    title: "教育 Education",
    defaultCollapsed: true,
    groups: [
      {
        title: "學校 Schools",
        layers: [
          fromManifest("schools"),
          fromManifest("eduSchoolElementary"),
          fromManifest("eduSchoolJunior"),
          fromManifest("eduSchoolSenior"),
          fromManifest("eduSchoolUniversity"),
          fromManifest("eduSchoolSpecial"),
          fromManifest("eduRemoteSchools"),
          fromManifest("eduUniversityStudents"),
        ],
      },
      {
        title: "校地 Campus",
        layers: [
          fromManifest("eduCampusPolygon"),
          // 與上一層同一份切片、同一個 sourceId（只下載一次），差別只在讀法：
          // 上層按學制分色，本層按 area_ha 分 5 級 —— 兩者可獨立開關也可疊看。
          fromManifest("eduCampusArea"),
        ],
      },
      // 🔴 高中就學區是**縣市級**，與前兩者的里級完全不同粒度 —— 三者各自獨立 toggle，
      //    且標籤直接寫明「（縣市級）」，避免使用者誤以為三層是同一套邊界的三個學制。
      {
        title: "學區 District",
        layers: [
          fromManifest("eduDistrictElementary"),
          fromManifest("eduDistrictJunior"),
          fromManifest("eduDistrictSenior"),
        ],
      },
      // 🔴 補習班是**每日更新**的資料源（此為快照），且點數 17,137 為四層之最 → 切片走 PMTiles，
      //    透明度／大小 slider 與其餘三層分開（見 useTransportParams 的 eduCramSchool* param）。
      {
        title: "幼托補習 Childcare & Cram",
        layers: [
          fromManifest("eduKindergarten"),
          fromManifest("eduCramSchool"),
          fromManifest("eduAfterschoolCare"),
          fromManifest("eduMutualCare"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏟️ SPORTS & LEISURE 運動休閒
  // ───────────────────────────────────────────────────────────────
  {
    title: "運動休閒 Sports & Leisure",
    defaultCollapsed: true,
    groups: [
      {
        title: "運動場館",
        layers: [
          fromManifest("sportsSchool"),
          fromManifest("sportsPublicOther"),
          fromManifest("sportsPrivate"),
          fromManifest("sportsPark"),
          fromManifest("sportsCenter"),
        ],
      },
      {
        title: "公園 Parks",
        layers: [
          fromManifest("parksTaipei"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🎭 CULTURE 文化
  // ───────────────────────────────────────────────────────────────
  {
    title: "文化 Culture",
    defaultCollapsed: true,
    groups: [
      {
        title: "設施 Facilities",
        layers: [
          fromManifest("culturalFacilities"),
          fromManifest("culturalMuseums"),
        ],
      },
      {
        title: "藝文活動 Arts & Events",
        layers: [
          fromManifest("artsEvents"),
          fromManifest("performingVenues"),
        ],
      },
      {
        title: "即時 Realtime",
        layers: [
          fromManifest("librarySeats"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛕 RELIGION 宗教（2026-08-02 第 36 主題；上游 religion 批次 23,074 點）
  // ───────────────────────────────────────────────────────────────
  {
    title: "宗教 Religion",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("religionTemples"),
          fromManifest("religionChurches"),
          fromManifest("religionAncestralHalls"),
          fromManifest("religionFoundations"),
          fromManifest("religionOtherWorship"),
        ],
      },
      {
        title: "精選",
        layers: [
          // 2026-08-02 自「觀光 → 玩・人文」搬來並更名（原 key tourReligion），
          // 對應上游 religion.top100（自 tourism.religion 搬移歸位）
          fromManifest("religionTop100"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚰️ FUNERAL 殯葬（2026-08-05 第 37 主題；上游 funeral 批次）
  // 🔴 A／B／C 三源分開不整合 —— 點位（A 官方名冊）／墓區範圍（B OSM 實際使用
  //    + C 都計法定劃設）／密度分析（A 區級）三個子群，讓使用者自行疊圖比對。
  // ───────────────────────────────────────────────────────────────
  {
    title: "殯葬 Funeral",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("funeralFacilities"),
          fromManifest("funeralOperators"),
        ],
      },
      {
        title: "墓區範圍",
        layers: [
          fromManifest("cemeteryOsm"),
          fromManifest("cemeteryZoning"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("funeralOperatorDensity"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🧳 TOURISM 觀光
  // ───────────────────────────────────────────────────────────────
  {
    title: "觀光 Tourism",
    defaultCollapsed: true,
    groups: [
      {
        title: "玩・自然 Nature",
        layers: [
          fromManifest("tourAttractions"),
          fromManifest("tourHotSprings"),
          fromManifest("tourHotSpringZones"),
          fromManifest("tourScenicAreas"),
        ],
      },
      {
        title: "玩・人文 Heritage",
        layers: [
          fromManifest("tourHeritage"),
        ],
      },
      {
        title: "玩・體驗 Experience",
        layers: [
          fromManifest("tourEvents"),
          fromManifest("tourFactories"),
          fromManifest("tourAmusementParks"),
          fromManifest("tourCamping"),
        ],
      },
      {
        title: "住・食 Stay & Eat",
        layers: [
          fromManifest("tourHotels"),
          fromManifest("tourRestaurants"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ♻️ WASTE 廢棄物
  // ───────────────────────────────────────────────────────────────
  {
    title: "廢棄物 Waste",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時",
        layers: [
          fromManifest("wasteTruck"),
          fromManifest("wasteSchedule"),
          fromManifest("wasteScheduleNote"),
          fromManifest("wasteCleaningSquads"),
        ],
      },
      {
        title: "投放點",
        layers: [
          fromManifest("wasteStopsStatic"),
          fromManifest("wdClothes"),
          fromManifest("wdMixed"),
          fromManifest("wdRecyclingContainer"),
          fromManifest("wdBattery"),
        ],
      },
      {
        title: "處理設施",
        layers: [
          fromManifest("wfIncinerator"),
          fromManifest("wfLandfill"),
          fromManifest("wfLandfillCoastal"),
          fromManifest("wfTransfer"),
          fromManifest("wfMedical"),
          fromManifest("wfMonitoring"),
          fromManifest("wfRecycling"),
          fromManifest("wfScrapYard"),
          fromManifest("wfOther"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🏥 MEDICAL 醫療
  // ───────────────────────────────────────────────────────────────
  {
    title: "醫療 Medical",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("medHospital"),
          fromManifest("medClinic"),
          fromManifest("medPharmacy"),
          fromManifest("medAED"),
          fromManifest("medLTC"),
        ],
      },
      {
        title: "即時 Emergency",
        layers: [
          fromManifest("erHospital"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("medIsochrone"),
          fromManifest("medDesert"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚒 FIRE 消防
  // ───────────────────────────────────────────────────────────────
  {
    title: "消防 Fire & Rescue",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("fireStations"),
          fromManifest("fireHydrants"),
        ],
      },
      {
        title: "事件",
        layers: [
          fromManifest("fireEvents"),
          fromManifest("fireLatest"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("fireIsochrone"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // ⚠️ HAZARD 災害
  // ───────────────────────────────────────────────────────────────
  {
    title: "災害 Hazard",
    defaultCollapsed: true,
    groups: [
      {
        title: "即時警示",
        layers: [
          fromManifest("lifelineAlerts"),
          fromManifest("floodAlerts"),
          fromManifest("weatherAlerts"),
          fromManifest("transitAlerts"),
          fromManifest("safetyAlerts"),
        ],
      },
      {
        title: "地震 / 斷層",
        layers: [
          fromManifest("earthquakes"),
          fromManifest("earthquakeReplay"),
          fromManifest("activeFaults"),
        ],
      },
      {
        title: "雷暴",
        layers: [
          fromManifest("lightning"),
          fromManifest("lightningCwa"),
        ],
      },
      {
        // 山域事故：與「🌲 林業」的步道 / 通訊點 / 山屋 疊圖 = 登山安全敘事
        title: "山域事故 Mountain Rescue",
        layers: [
          fromManifest("mountainRescueIncidents"),
        ],
      },
      {
        title: "核安",
        layers: [
          fromManifest("nuclearRadiation"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛡️ CIVIL DEFENSE 民防避難
  // ───────────────────────────────────────────────────────────────
  {
    title: "民防避難 Civil Defense",
    defaultCollapsed: true,
    groups: [
      {
        title: "避難設施",
        layers: [
          fromManifest("civilDefenseShelter"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🚓 LAW & ORDER 執法治安（4 子群、16 個 layer）
  // ───────────────────────────────────────────────────────────────
  {
    title: "執法治安 Law & Order",
    defaultCollapsed: true,
    groups: [
      {
        title: "警政",
        layers: [
          fromManifest("policeStation"),
          fromManifest("womenChildWarning"),
          fromManifest("speedCamera"),
          fromManifest("speedZoneSegment"),
        ],
      },
      {
        title: "警察覆蓋分析",
        layers: [
          fromManifest("policeIsoSubstation"),
          fromManifest("policeIsoPrecinct"),
          fromManifest("policeIsoCityDept"),
        ],
      },
      {
        title: "司法矯正",
        layers: [
          fromManifest("court"),
          fromManifest("prosecutorsOffice"),
          fromManifest("correctionalFacility"),
          fromManifest("courtJurisdiction"),
        ],
      },
      {
        title: "治安態勢",
        layers: [
          fromManifest("crimeAreaMonthly"),
          fromManifest("theftTaoyuan"),
          fromManifest("trafficAccidentYearly"),
          fromManifest("accidentTaipei"),
          fromManifest("a1AccidentRealtime"),
        ],
      },
      {
        title: "廉政移民海巡",
        layers: [
          fromManifest("investigationBureau"),
          fromManifest("antiCorruptionOffice"),
          fromManifest("immigrationOffice"),
          fromManifest("coastGuardStation"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌤️ ENV 環境氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "環境氣候 Environment",
    groups: [
      {
        title: "氣象",
        layers: [
          fromManifest("weatherStations"),
          fromManifest("cwaCloudImagery"),
          fromManifest("cwaRadarImagery"),
          fromManifest("temperatureWave"),
          fromManifest("temperatureGrid"),
          fromManifest("urbanHeat"),
        ],
      },
      {
        title: "空品",
        layers: [
          fromManifest("aqiImagery"),
          fromManifest("aqiStations"),
          fromManifest("aqiMicroSensors"),
        ],
      },
      {
        title: "環境污染",
        layers: [
          fromManifest("pollutionFacility"),
          fromManifest("pollutionPenaltyCritical"),
          fromManifest("pollutionPenaltyGeneral"),
          fromManifest("pollutionPenaltyMobile"),
          fromManifest("pollutionSite"),
        ],
      },
      {
        title: "都市樹木 Urban Trees",
        layers: [
          fromManifest("streetTreesTaipeiDiff"),
          fromManifest("streetTreesTaipei3epoch"),
          fromManifest("streetTreesNational"),
          fromManifest("protectedTreesNational"),
          fromManifest("riversideTreesTaipei"),
          fromManifest("treePitsTaipei"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 💧 WATER 水資源
  // ───────────────────────────────────────────────────────────────
  {
    title: "水資源 Water",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("waterFacilities"),
          fromManifest("waterMonitorStations"),
          fromManifest("waterReservoirs"),
          fromManifest("groundwaterWells"),
          fromManifest("rainGauge"),
          fromManifest("riverLevel"),
          fromManifest("floodSensor"),
          fromManifest("iotWraRiver"),
          fromManifest("iotWraStructure"),
          fromManifest("taipeiSewer"),
          fromManifest("taipeiEvacuate"),
          fromManifest("taipeiPumb"),
        ],
      },
      {
        title: "面 / 線",
        layers: [
          fromManifest("waterBasins"),
          fromManifest("waterRivers"),
          fromManifest("waterLevees"),
          fromManifest("waterCanals"),
          fromManifest("waterProtectionZones"),
          fromManifest("waterDetentionBasins"),
          fromManifest("groundwater"),
          fromManifest("lakesPondsOsm"),
        ],
      },
      {
        title: "分析",
        layers: [
          fromManifest("waterFloodExtreme"),
          fromManifest("floodSensorIsochrone"),
          fromManifest("precipRaster"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 GLOBAL CLIMATE 全球氣候
  // ───────────────────────────────────────────────────────────────
  {
    title: "全球氣候 Global Climate",
    defaultCollapsed: true,
    groups: [
      {
        title: "事件",
        layers: [
          fromManifest("earthquakesGlobal"),
          fromManifest("typhoonTracks"),
        ],
      },
      {
        title: "預報場（GFS 風場 / CMEMS 海流 / CAMS 沙塵）",
        layers: [
          fromManifest("windField"),
          fromManifest("oceanCurrents"),
          fromManifest("dustForecast"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌾 AGRICULTURE 農業
  // ───────────────────────────────────────────────────────────────
  {
    title: "農業 Agriculture",
    defaultCollapsed: true,
    groups: [
      {
        title: "點位",
        layers: [
          fromManifest("agriPOI"),
          fromManifest("agriRetail"),
          fromManifest("agriProduceWholesale"),
          fromManifest("agriWholesaleMarket"),
        ],
      },
      {
        title: "畜牧 Livestock",
        layers: [
          fromManifest("livestockFarmPig"),
          fromManifest("livestockFarmChicken"),
          fromManifest("livestockFarmCattle"),
          fromManifest("livestockFarmDuck"),
          fromManifest("livestockFarmGoose"),
          fromManifest("livestockFarmSheep"),
          fromManifest("livestockFarmOther"),
          fromManifest("livestockSlaughter"),
          fromManifest("livestockFeed"),
          fromManifest("livestockMarket"),
        ],
      },
      {
        title: "養殖漁業 Aquaculture",
        layers: [
          fromManifest("aquaculturePonds"),
          fromManifest("aquacultureZone"),
          fromManifest("aquacultureCageNet"),
          fromManifest("aquacultureWaterSatellite"),
          fromManifest("aquacultureWaterSatelliteMoa"),
          fromManifest("aquacultureWaterUnion"),
          fromManifest("aquacultureIntegrated"),
        ],
      },
      {
        title: "面 / 分區",
        layers: [
          fromManifest("agriculture"),
          fromManifest("agriLeisureFarmZones"),
          fromManifest("agriRuralRegen"),
          fromManifest("ecoNetworkZones"),
        ],
      },
      {
        title: "土壤",
        layers: [
          fromManifest("agriSoil"),
          fromManifest("agriSoilFertility"),
          fromManifest("agriCropSuitability"),
        ],
      },
      {
        title: "線",
        layers: [
          fromManifest("farmRoads"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌲 FORESTRY 林業
  // ───────────────────────────────────────────────────────────────
  {
    title: "林業 Forestry",
    defaultCollapsed: true,
    groups: [
      {
        title: "分區",
        layers: [
          fromManifest("forestCompartments"),
          fromManifest("forestReserve"),
          fromManifest("forestRecreation"),
          fromManifest("forestFlatParks"),
          fromManifest("canopyHeight"),
          fromManifest("canopyGiants"),
        ],
      },
      {
        title: "點位",
        layers: [
          fromManifest("forestTreatmentWorks"),
          fromManifest("forestTrailSigns"),
          fromManifest("forestSignalPoints"),
          fromManifest("forestEducationCenters"),
          fromManifest("mountainHuts"),
          fromManifest("forestDamLakes"),
        ],
      },
      {
        title: "線",
        layers: [
          fromManifest("forestRoads"),
          fromManifest("forestAlishanRail"),
          fromManifest("hikingTrails"),
        ],
      },
      {
        title: "生態",
        layers: [
          fromManifest("forestWildlife"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰️ SPACE 太空
  // ───────────────────────────────────────────────────────────────
  {
    title: "太空 Space",
    defaultCollapsed: true,
    groups: [
      {
        title: "台灣",
        layers: [
          fromManifest("satellitesTaiwan"),
        ],
      },
      {
        title: "中國",
        layers: [
          fromManifest("satellitesYaogan"),
          fromManifest("satellitesJilin"),
          fromManifest("satellitesGaofen"),
          fromManifest("satellitesTJS"),
          fromManifest("satellitesBeidou"),
          fromManifest("satellitesShiyan"),
        ],
      },
      {
        title: "國際偵察",
        layers: [
          fromManifest("satellitesUSA"),
          fromManifest("satellitesJapan"),
          fromManifest("satellitesRussia"),
          fromManifest("satellitesIndia"),
          fromManifest("satellitesKorea"),
          fromManifest("satellitesFrance"),
          fromManifest("satellitesGermany"),
          fromManifest("satellitesItaly"),
          fromManifest("satellitesIsrael"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🛰 SITUATION 情勢 — 每日回顧型的情勢內容（非秒級即時）
  // ───────────────────────────────────────────────────────────────
  {
    title: "情勢 Situation",
    defaultCollapsed: true,
    groups: [
      {
        title: "事件",
        layers: [
          fromManifest("newsEvents"),
        ],
      },
      {
        title: "軍事",
        layers: [
          fromManifest("plaActivity"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────
  // 🌍 WORLD 世界（獨立 rail tab「世界」專屬；桌機主 Layers panel 排除此主題）
  // ───────────────────────────────────────────────────────────────
  {
    title: WORLD_THEME_TITLE,
    groups: [
      {
        title: "環境",
        layers: [
          fromManifest("worldTrashDebris"),
        ],
      },
    ],
  },

];

// ── SECTIONS（derived flat — backward compat for 兩個 sidebar 元件）──
// 每個 SubGroup 攤平為一筆 SectionDef，title = `主題 English · 子群中文`，
// 視覺上連續行構成主題分組。下一階段 sidebar 升級後可直接消費 THEMES。

export const SECTIONS: SectionDef[] = THEMES.flatMap((theme) =>
  theme.groups.map((group) => ({
    title: `${theme.title} · ${group.title}`,
    layers: group.layers,
  })),
);

// SECTIONS 派生 → 給 overlayManager hydrate 等需要 user-facing label 的場景查表
export const LAYER_LABELS: Partial<Record<keyof LayerVisibility, string>> = (() => {
  const out: Partial<Record<keyof LayerVisibility, string>> = {};
  for (const section of SECTIONS) {
    for (const def of section.layers) out[def.key] = def.label;
  }
  return out;
})();

// ── owner-only 私人圖層 SSOT（見 docs/features/owner-gated-layers）──
// 只有登入且 profiles.tier='owner' 的帳號能開啟。非 owner：sidebar 顯示鎖頭 + toggle no-op。
// DB 端由 migration 275 同步：對應 RPC 加 owner 檢查 + REVOKE anon。
// ⚠️ 明確排除（保持公開）：waterCanals（灌排渠道）、powerPoles（電桿 2.96M）。
export const GATED_LAYERS: ReadonlySet<keyof LayerVisibility> = new Set<keyof LayerVisibility>([
  // 畜牧 Livestock（改走 owner-only RPC；不含 livestockFeed / livestockMarket）
  "livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle", "livestockFarmDuck",
  "livestockFarmGoose", "livestockFarmSheep", "livestockFarmOther", "livestockSlaughter",
  // 石化 · 油氣
  "lpgSubpackaging", "lpgRetailers", "lngTerminal", "pipelineGas", "pipelineOilGas",
  "industrialRefinery", "industrialStorageTank", "industrialPowerPlant", "coalTerminal",
  "fossilFuelInfra",
  // 電力 · 電網
  "osmSubstationsEhv", "osmSubstations", "osmPowerLines", "osmPowerTowers",
  "substationEhvGlow", "powerLinesGlow",
  // 電力 · 廠
  "facPrimary", "facPlanned", "facHistorical", "facSecondary", "facOsmSupplement",
  "powerGenerationUnit", "powerPlantGlow",
  // 僅做 UI 鎖（資料載入路徑不動）
  "aviationRestrictedGlow",
  // 已從 sidebar 下架但 API 敏感（無鎖頭 UI；仍 gate 掉 bulk/chat 等程式化開啟路徑）
  "facOffshore", "osmPowerPlantsStatic", "powerPlants",
]);

/** 對某使用者而言此 key 是否上鎖（gated 且非 owner）。 */
export function isLayerLockedFor(key: keyof LayerVisibility, isOwner: boolean): boolean {
  return !isOwner && GATED_LAYERS.has(key);
}
