// 中國國家包：sourceInfo.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CnLayerKey } from "./keys";
import type { LayerSourceInfo } from "../../data/layerSourceInfo";

export const CN_PACK_SOURCE_INFO = {
  cnActiveFaults: { org: "GEM Global Active Faults Database（Styron & Pagani 2020）", license: "CC BY-SA 4.0", url: "https://github.com/GEMScienceTools/gem-global-active-faults", asOf: "2026-11-16", from: "popup" },
  cnAdminBoundaries: { org: "OCHA COD-AB China 2020（unofficial）（經 HDX）；代碼：民政部 2024 行政區劃代碼", license: "CC BY-IGO 3.0（幾何）；民政部代碼表未標示授權", url: "https://data.humdata.org/dataset/cod-ab-chn", asOf: "2026-11-13", attribution: ["© OCHA COD-AB China（HDX，CC BY-IGO）"], from: "popup" },
  cnAquaculture: { org: "Zenodo 19418704（Annual Spatial Distribution Dataset of Aquaculture Areas in the Coastal Zone of China, 1986–2024）", license: "Apache-2.0", from: "legend" },
  cnBridgesTunnels: { org: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright", asOf: "2026-11-16", from: "popup" },
  cnBusStops: { org: "Wang et al. (2024), A Comprehensive Vector Dataset of Bus Networks Across China for the Year 2024, figshare（上游高德、百度地圖 API）", license: "CC BY 4.0（figshare）；上游為高德／百度地圖 API，條款未查證", url: "https://doi.org/10.6084/m9.figshare.28323971", asOf: "2026-11-13", from: "popup" },
  cnDams: { org: "Global Dam Watch v1.0（Lehner et al. 2024, Scientific Data）", license: "CC BY 4.0", url: "https://www.globaldamwatch.org/", asOf: "2026-11-16", from: "popup" },
  cnEez: { org: "Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12（Marine Regions）", license: "CC BY 4.0（請勿轉載原始檔）", url: "https://www.marineregions.org/gazetteer.php?p=details&id=8486", asOf: "2026-11-16", from: "popup" },
  cnEthnicAutonomy: { org: "民政部 2024 行政區劃代碼（名冊）；OCHA COD-AB China；geoBoundaries CHN ADM3", license: "CC BY-IGO 3.0（省、地級面）＋ODbL 1.0（縣級面）；名冊未標示授權", url: "https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html", asOf: "2026-11-16", from: "popup" },
  cnMajorRoads: { org: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright", asOf: "2026-11-13", from: "popup" },
  cnMedical: { org: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright", asOf: "2026-11-16", from: "popup" },
  cnNatureReserves: { org: "Jia, X. List of National Nature Reserves in China（Zenodo 18226534）", license: "CC BY 4.0", url: "https://zenodo.org/records/18226534", asOf: "2026-11-16", from: "popup" },
  cnNuclearPlants: { org: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright", asOf: "2026-11-16", from: "popup" },
  cnPipelines: { org: "Global Energy Monitor（Global Gas Infrastructure Tracker、Global Oil Infrastructure Tracker）", license: "CC BY 4.0", url: "https://globalenergymonitor.org/projects/", asOf: "2026-11-13", from: "popup" },
  cnPlaceNames: { org: "GeoNames（geonames.org）", license: "CC BY 4.0", url: "https://download.geonames.org/export/dump/", asOf: "2026-11-16", from: "popup" },
  cnPopulation: { org: "国家统计局（第七次人口普查）；European Union（JRC，GHS-POP R2023A）", license: "普查：國家統計局網站服務條款（註明出處）；網格：CC BY 4.0", url: "https://www.stats.gov.cn/sj/pcsj/rkpc/7rp/zk/html/A0101.xls", asOf: "2026-11-13", from: "popup" },
  cnPopulationGrid: { org: "European Union（JRC，GHS-POP R2023A）", license: "CC BY 4.0", attribution: ["GHS-POP R2023A E2025（30 arc-sec）© European Union（JRC）（CC BY 4.0）"], from: "legend" },
  cnPowerGrid: { org: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright", asOf: "2026-11-13", from: "popup" },
  cnPowerPlants: { org: "Global Energy Monitor；部分光電 TransitionZero Solar Asset Mapper", license: "CC BY 4.0（GEM）；63 筆 CC BY-NC 4.0（非商用）", url: "https://globalenergymonitor.org/projects/", asOf: "2026-11-13", attribution: ["Global Energy Monitor（CC BY 4.0）；部分光電 © TransitionZero Solar Asset Mapper（CC BY-NC 4.0）（CC BY 4.0（GEM）；63 筆 CC BY-NC 4.0（非商用））"], restrictions: [{ kind: "nonCommercial", text: { "zh-TW": "63 筆 TransitionZero 光電為 CC BY-NC 4.0（非商用），彈窗逐筆標示", en: "63 TransitionZero solar records are CC BY-NC 4.0 (non-commercial), shown per record", ja: "TransitionZero の太陽光 63 件は CC BY-NC 4.0（非商用）でレコードごとに表示" } }], from: "popup" },
  cnRivers: { org: "HydroRIVERS v1.0（Lehner & Grill 2013），www.hydrosheds.org", license: "HydroSHEDS License Agreement（只准以衍生作品散布）", url: "https://www.hydrosheds.org/products/hydrorivers", asOf: "2026-11-16", restrictions: [{ kind: "noRedistribution", text: { "zh-TW": "HydroSHEDS 授權：只可放在衍生作品中散布，不可單獨轉發原始資料", en: "HydroSHEDS licence: may be distributed only within derived works, not as stand-alone data", ja: "HydroSHEDS ライセンス：派生物に組み込んだ形でのみ配布可、単体での再配布は不可" } }], from: "popup" },
  cnSchools: { org: "OpenStreetMap contributors", license: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright", asOf: "2026-11-16", from: "popup" },
  cnSoil: { org: "ISRIC – World Soil Information（SoilGrids 2.0）", license: "CC BY 4.0", from: "legend" },
  cnTransportHubs: { org: "OurAirports（機場，Public Domain）；港口 OpenStreetMap contributors", license: "Public Domain（機場）、ODbL 1.0（港口）", url: "https://ourairports.com/data/", asOf: "2026-11-13", from: "popup" },
  cnWdpa: { org: "UNEP-WCMC and IUCN, Protected Planet：World Database on Protected Areas（Nov 2026）", license: "WDPA Terms of Use（非商用，含衍生品）", url: "https://www.protectedplanet.net/", asOf: "2026-11-16", restrictions: [{ kind: "nonCommercial", text: { "zh-TW": "WDPA 使用條款：禁止商業使用（含衍生品）", en: "WDPA terms: no commercial use (including derived works)", ja: "WDPA 利用規約：商用禁止（派生物を含む）" } }], from: "popup" },
  // <codemod:append CN_PACK_SOURCE_INFO>
} satisfies Partial<Record<CnLayerKey, LayerSourceInfo>>;
