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
 * 手寫色票殘量 —— **AR-22 Phase 2 完成後為空**（348/348 全部由 layerManifest 派生）。
 *
 * 型別 `Omit<Record<全集>, ManifestKey>` 的 tsc 雙向護欄維持不變：
 *   - 漏掉任一「還沒搬」的 key → TS2739 缺屬性
 *   - 已搬進 manifest 的 key 還留在這裡 → excess property 報錯
 * `ManifestKey` 現在涵蓋全部 348 key，`Omit<…>` 因此退化成 `{}` ——
 * 空物件字面**仍然合法**（實測 tsc 0 error），護欄語意也還在：
 * 從 manifest 刪掉任何 key 會立刻讓下方 LAYER_COLORS 的 Record 缺屬性而報錯。
 *
 * ⚠️ 保留本表而非直接刪掉，是為了 Phase 3-4：新 key 若一時無法進 manifest
 * （例如 section 尚未決定），這裡是唯一的合法暫放處。
 *
 * ⚠️ **唯一沒有機械護欄的漏法**（批 1 起記在案，Phase 3 仍適用）：
 * 若這裡放的是 `...SOME_LAYER_COLORS` 這種 spread，**不觸發 excess property check**
 * —— 搬走 key 後忘了刪 spread 會 tsc 綠、黃金快照綠、契約測試綠，
 * 但登記沒真搬走，留下「改 manifest 畫面沒反應」的暗雷。
 * 驗證只能靠 `grep -nE '^\s*\.\.\.'` 限行首（說明註解裡也會出現該字串）。
 * 目前本表無 spread。
 *
 * 各主題的色票判準（哪個常數該引用、哪些只是撞色）逐批記在
 * docs/features/layer-manifest/changelog.md，不在此重複。
 */
const HANDWRITTEN_LAYER_COLORS: Omit<Record<keyof LayerVisibility, string>, ManifestKey> = {
  // （空 —— Phase 2 全數搬完）
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
 * 運具 6 層的顯示文字 —— **值自 P3-3 起直讀 manifest，字串字面已消滅**。
 *
 * 收編前這 6 個值與 manifest 的 `label` 逐字重複（`rail` 自 Phase 1 試點起、
 * 其餘 5 個自批 8 起），改一邊忘另一邊 sidebar 文字就靜默分岔。
 * 動手前機械比對過 6/6 一位元相同（見 P3-3 changelog）。
 *
 * ⚠️ **只收編值、不改 key 空間**：兩個 sidebar 用 `key in TRANSPORT_LABELS`
 * 當**集合測試**（`isTransport`），key 空間是 `TransportType` 而非
 * `keyof LayerVisibility` —— 硬套 `Omit<…, ManifestKey>` 會把型別意義弄壞，
 * 也會讓那個集合測試多出 340 個成員。這張表因此不是「第五張待派生的手寫表」，
 * 而是 `TransportType → manifest` 的**最小 keyed 對照**。
 *
 * 兩道 tsc 護欄（不需要額外測試）：
 * - 漏掉任一 `TransportType` → `Record<TransportType, string>` 缺屬性（TS2739）
 * - 某 key 從 THEMES 掉出去、退化成沒有 `label` 的 orphan entry → 該行立刻紅
 */
export const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: LAYER_MANIFEST.flights.label,
  ships: LAYER_MANIFEST.ships.label,
  rail: LAYER_MANIFEST.rail.label,
  busLive: LAYER_MANIFEST.busLive.label,
  busIntercityLive: LAYER_MANIFEST.busIntercityLive.label,
  touristShuttleLive: LAYER_MANIFEST.touristShuttleLive.label,
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
        // 陸域行政界之外的**海域法定界線**（內政部 98 年公告），故不併進「行政邊界」
        title: "海域界線",
        layers: [
          fromManifest("maritimeBoundary"),
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
  // 🏢 BUSINESS REGISTRY 工商登記
  // ───────────────────────────────────────────────────────────────
  {
    title: "工商登記 Business Registry",
    defaultCollapsed: true,
    groups: [
      {
        title: "整體公司",
        layers: [
          fromManifest("companyPoints"),
          fromManifest("companyCapitalGrid"),
          fromManifest("commonRegistrationAddresses"),
        ],
      },
      {
        title: "製造業",
        layers: [
          fromManifest("factoryLocations"),
          fromManifest("manufacturingCompanyPoints"),
          fromManifest("regulatedFacilities"),
        ],
      },
      {
        title: "園區",
        layers: [
          fromManifest("industrialParkBoundaries"),
          fromManifest("industrialParkComparison"),
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
      //    透明度／大小 slider 與其餘三層分開（見 useLayerParamsRuntime 的 eduCramSchool* param）。
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
  // 🤝 WELFARE 社福長照（2026-08-13 第 40 主題；上游 welfare 批次 9 檔 10,004 點）
  //
  // 全開 10,004 點會很擠 —— 群內順序刻意把上游建議的三層（都有可做泡泡／分色的
  // 數值欄位）放最前面：護理機構床數、老人機構床數、身障機構使用率。
  // ⚠️ **沒有**把它們加進 layerVisibilityStore 的 DEFAULT_ON —— 本站 2026-08-10
  //    起「預設全關：訪客一進站不打任何 RPC、不載任何圖層」，加了會讓社福變成
  //    全站唯一預設開啟的內容（一進站多載 ~1.9MB）。要改是一行的事，但要 owner 拍板。
  //
  // 🔴 長照有兩套登記體系：本群的 welfareLtcInstitutions 是**立案機構**（3,117），
  //    醫療主題的 medLTC 是長照 2.0 **特約單位**（23,894），名稱交集僅 2,365。
  //    刻意**不放同一群、不合併** —— 兩者量的是不同東西，併起來會重複計算又漏算。
  // 🔴 基礎建設群的 welfareCenters（社福中心 162）不是本群成員；本群 welfareGovOffices
  //    已排除 T0103 正是為了不跟它重複 → 兩層零重疊，可同時開。
  // ───────────────────────────────────────────────────────────────
  {
    title: "社福長照 Welfare",
    defaultCollapsed: true,
    groups: [
      {
        title: "住宿照顧",
        layers: [
          fromManifest("welfareNursingHomes"),
          fromManifest("welfareElderlyHomes"),
          fromManifest("welfareDisability"),
        ],
      },
      {
        title: "長照與托育",
        layers: [
          fromManifest("welfareLtcInstitutions"),
          fromManifest("welfareChildcare"),
          fromManifest("welfareChildServices"),
        ],
      },
      {
        title: "公部門與民間",
        layers: [
          fromManifest("welfareGovOffices"),
          fromManifest("welfareMentalHealth"),
          fromManifest("welfareSocialWorkOrgs"),
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
          fromManifest("vesselWatch"),
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
//
// ⚠️ **P3-3 評估過收編進 manifest，結論是不收**（與 TRANSPORT_LABELS 不同類），
//    三條硬理由（機械查證，非目測）：
//    1. **沒有值重複可消滅**：manifest 裡 `gated: true` 的 entry 是 **0 個**，
//       本表 35 個 key 全部只存在於這裡。收編＝**新增** 35 筆宣告，不是去重。
//    2. **型別上表達不了**：`gated` 只存在於 `LayerManifestThemedEntry`，而本表有
//       3 個 key（facOffshore / osmPowerPlantsStatic / powerPlants）是 orphan entry
//       ——「已從 sidebar 下架但 API 敏感」正是它們要被鎖的理由，卻沒有 LayerDef 可載。
//    3. **這是安全清單不是登記簿**：embedWhitelist / urlState / layerGates 三套測試
//       以本表為錨（gated 外流＝私人資料洩漏）。搬 SSOT 是安全變更，要獨立驗收標準，
//       不該搭在一次去重重構裡。
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
