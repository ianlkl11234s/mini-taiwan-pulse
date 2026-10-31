/**
 * 熱區預設色盤：依主題（map-layers.md §3.4 G-2、§3.8 V-6；2026-10-31 使用者拍板取代「一律 magma」）。
 *
 * 解析順序：逐層覆寫 `HEATMAP_PALETTE_OVERRIDES` > 主題表 `THEME_HEATMAP_PALETTE` > `FALLBACK_HEATMAP_PALETTE`。
 * - 主題鍵＝manifest `section.theme` 的第一段（「醫療 Medical」→「醫療」），四國同名主題共用一色。
 * - 同一國同一主題有好幾層熱區時，主題色給第一層，其餘在覆寫表錯開（`layerPalette.test.ts` 擋撞色）；
 *   新圖層不寫就自動套主題色，撞色測試會紅 → 在覆寫表補一筆。
 * - 色盤只能是 `palettes.ts` 的 17 組（`ramp-validation.md` 已驗證）；這裡只改「預設」，
 *   使用者在色盤選單選過的值照舊。
 */
import { LAYER_MANIFEST } from "../data/layerManifest";
import type { PaletteId } from "./palettes";

/** 主題表查不到時（例：統計主題、沒有 section 的舊 key） */
export const FALLBACK_HEATMAP_PALETTE: PaletteId = "magma";

/** 主題 → 預設熱區色盤（語意：水藍、能源黃褐、綠地自然綠、災害紅、宗教文化 batlow／acton…） */
export const THEME_HEATMAP_PALETTE: Readonly<Record<string, PaletteId>> = {
  交通: "BuPu",
  醫療: "PuBu",
  社福長照: "PuBuGn",
  運動休閒: "PuBuGn",
  宗教: "batlow",
  殯葬: "turku",
  文化: "acton",
  觀光: "Burg",
  教育: "cividis",
  水資源: "YlGnBu",
  海洋: "oslo",
  全球海事: "oslo",
  能源: "YlOrBr",
  環境氣候: "viridis",
  林業: "speed",
  農業: "tokyo",
  原民與農村: "tokyo",
  災害: "rocket",
  民防避難: "YlGnBu",
  消防: "magma",
  執法治安: "BuPu",
  基礎建設: "cividis",
  都市分析: "cividis",
  工商登記: "Burg",
  房地產: "YlOrBr",
  住宅存量與使用: "Burg",
  人口社經: "YlOrBr",
  工作與所得: "Burg",
  廢棄物: "turku",
  動物福利: "acton",
  通訊: "BuPu",
  全球通訊: "BuPu",
  太空: "oslo",
  全球環境: "turku",
  全球氣候: "YlOrBr",
  情勢: "rocket",
  全球情勢: "rocket",
  // 英國綠地與開放空間掛在「底圖」主題；四層都有使用者點名的覆寫，這裡只是兜底
  底圖: "viridis",
};

/**
 * 逐層覆寫：同主題相鄰圖層錯開，以及使用者點名的層（2026-10-31：英國公園綠地 viridis、
 * 運動場地 PuBuGn、墓園與宗教場地 batlow、照護之家／長照服務 PuBuGn、棕地登記冊 bilbao）。
 */
export const HEATMAP_PALETTE_OVERRIDES: Readonly<Record<string, PaletteId>> = {
  // 英國（使用者點名）
  gbGreenspace: "viridis",
  gbSportsFacilities: "PuBuGn",
  gbCemeteries: "batlow",
  gbCareHomes: "PuBuGn",
  gbCareServices: "PuBuGn",
  gbBrownfield: "bilbao",
  // 英國 §3.8 新增熱區（C 軌 2026-10-31）：底圖主題錯開點名的四色；林業三層錯開
  gbPlanningConstraints: "Burg",
  gbForestRecreation: "tokyo",
  gbOpenAccessLand: "YlGnBu",
  // 英國災害：海岸侵蝕錯開滑坡（rocket）
  gbCoastalErosionRisk: "YlOrBr",
  // 台灣 交通（§3.8 V-1 台灣重切檔新增熱區）：錯開市區公車站（BuPu）
  provincialRoadMileposts: "tokyo",
  freewayTrafficSigns: "Burg",
  // 台灣 醫療
  medAED: "rocket",
  medLTC: "PuBuGn",
  // 台灣 環境氣候：樹木綠系、污染紅褐系、噪音紫
  streetTreesTaipei3epoch: "speed",
  streetTreesTaipeiDiff: "tokyo",
  riversideTreesTaipei: "YlGnBu",
  pollutionFacility: "bilbao",
  pollutionPenaltyGeneral: "Burg",
  pollutionPenaltyCritical: "rocket",
  pollutionPenaltyMobile: "magma",
  noiseEnforcementEvents: "BuPu",
  // 台灣 消防：消防栓是水
  fireLatest: "rocket",
  fireHydrants: "oslo",
  // 台灣 工商登記
  manufacturingCompanyPoints: "YlOrBr",
  factoryLocations: "bilbao",
  regulatedFacilities: "rocket",
  // 台灣 交通
  busStationsIntercity: "PuBu",
  bicycleSupport: "speed",
  bssNationalBridgePointsPreview: "turku",
  // 台灣 基礎建設
  publicToilets: "PuBu",
  accessibleParkFacilities: "YlGnBu",
  // 台灣 農業
  agriProduceWholesale: "speed",
  // 南韓 交通：公車站拿主題色 BuPu，其餘 5 層錯開（橋梁暖紅褐、停車場青灰、攝影機紅、兒童保護區紫、自行車綠）
  krPublicBicycleStations: "speed",
  krBridges: "bilbao",
  krParkingLots: "cividis",
  krSpeedCameras: "rocket",
  krChildProtectionZones: "acton",
  // 日本 宗教（三個來源）、觀光、社福
  jpReligionOsm: "acton",
  jpReligionWikidata: "turku",
  jpAccommodationOsm: "acton",
  jpWelfareChild: "acton",
  // §3.8 V-5 台日面層代表點熱區（H2 軌 2026-10-31）：同主題錯開
  agriSoil: "YlOrBr",
  agriculture: "viridis",
  agriCropSuitability: "Burg",
  aquacultureIntegrated: "oslo",
  aquacultureWaterSatellite: "YlGnBu",
  aquacultureWaterSatelliteMoa: "PuBu",
  treePitsTaipei: "oslo",
  urbanZoningTaipei: "BuPu",
  urbanZoningNewTaipei: "cividis",
  nonUrbanZoning: "YlOrBr",
  jpLandslideWarningAreas: "bilbao",
};

/**
 * 同國同主題但刻意同色（使用者點名）：撞色測試放行這些組合。
 * 照護之家與長照服務同一支 PMTiles、分屬「住宿照顧」「長照與托育」兩群。
 */
export const HEATMAP_SAME_PALETTE_ALLOWED: readonly (readonly [string, string])[] = [
  ["gbCareHomes", "gbCareServices"],
];

/** manifest `section.theme` 的主題鍵（第一段，去掉英文副名） */
export function heatmapThemeKey(theme: string | undefined): string | undefined {
  const head = theme?.trim().split(/\s+/)[0];
  return head || undefined;
}

type ManifestLike = { section?: { theme?: string } | null };

/** 這一層的主題鍵（manifest 沒有這個 key 或沒有 section → undefined） */
export function layerHeatmapTheme(key: string): string | undefined {
  return heatmapThemeKey((LAYER_MANIFEST as Record<string, ManifestLike | undefined>)[key]?.section?.theme);
}

/** 這一層熱區的預設色盤：覆寫 > 主題表 > magma */
export function defaultHeatmapPalette(key: string): PaletteId {
  const override = HEATMAP_PALETTE_OVERRIDES[key];
  if (override) return override;
  const theme = layerHeatmapTheme(key);
  return (theme ? THEME_HEATMAP_PALETTE[theme] : undefined) ?? FALLBACK_HEATMAP_PALETTE;
}
