// 靜態 GeoJSON 資料集白名單 — query_dataset / rank_by_population 只能查這裡列的資料集。
// url 沿用 overlayRegistry.ts 的 sourceUrl（同一份生產路徑；相對路徑會相對於站台 base）。
// description 給 LLM 看：說明有哪些欄位可 groupBy / filterEq（county 幾乎每個都有，適合縣市統計）。
//
// 只收「點狀 + 有分類欄位 + 常被問」的資料集。動態資料（加油站 / 充電站 / 火災事件…走 RPC）
// 與 PMTiles（醫療 5 類 medical_poi、消防栓…無法當 GeoJSON fetch）不在此。

export interface DatasetMeta {
  url: string;
  label: string;
  /** 給 LLM 的欄位提示：可 groupBy / filterEq 的欄位與大致取值 */
  description: string;
}

export const DATASET_WHITELIST: Record<string, DatasetMeta> = {
  // ── 治安 / 司法（police_justice，全國）──
  policeStations: {
    url: "./police_justice/police_stations/police_stations_20260626.geojson",
    label: "警察機關",
    description:
      "全國警察機關點位（約 2000+）。欄位 facility_subtype（substation 派出所 / precinct 分局 / police_dept 警察局 / headquarters 總部 / specialized 專業警察 / security 保安 / other）、county（縣市）。",
  },
  courts: {
    url: "./police_justice/courts/courts_20260626.geojson",
    label: "法院",
    description: "全國各級法院點位。欄位 court_type（法院層級）、county（縣市）。",
  },
  prosecutorsOffices: {
    url: "./police_justice/prosecutors_offices/prosecutors_offices_20260626.geojson",
    label: "檢察署",
    description: "全國各級檢察署點位。欄位 pros_type（檢察署層級）、county（縣市）。",
  },
  correctionalFacilities: {
    url: "./police_justice/correctional_facilities/correctional_facilities_20260626.geojson",
    label: "矯正機關",
    description:
      "全國矯正機關點位（監獄 / 看守所 / 少年觀護所等）。欄位 facility_type（機關類型）、county（縣市）。",
  },
  coastGuardStations: {
    url: "./police_justice/coast_guard_stations/coast_guard_stations_20260626.geojson",
    label: "海巡機關",
    description: "全國海巡機關點位。欄位 facility_subtype（機關類型）、county（縣市）。",
  },
  speedCameras: {
    url: "./police_justice/speed_cameras/speed_cameras_20260626.geojson",
    label: "測速照相",
    description:
      "全國固定式測速照相點位。欄位 facility_subtype（種類）、limit_kph（速限）、county（縣市）。",
  },

  // ── 消防 / 救護（全國 22 縣市）──
  fireStations: {
    url: "./geo/fire_stations.geojson",
    label: "消防分隊",
    description:
      "全國消防機關點位（約 700+）。欄位 cat（大隊 / 分隊 / 分駐所）、county（縣市）、township（鄉鎮）。",
  },

  // ── 教育 ──
  schools: {
    url: "./geo/schools.geojson",
    label: "學校",
    description:
      "全國各級學校點位。欄位 school_level（國民小學 / 國民中學 / 高級中等學校 / 大專校院 / 特殊教育學校 等）。",
  },

  // ── 醫療 ──
  medHospitals: {
    url: "./geo/medical_hospitals.geojson",
    label: "醫院",
    description: "全國醫院點位（健保特約）。欄位 county（縣市），適合依縣市統計醫院數。",
  },

  // ── 交通 / 監視 ──
  cctv: {
    url: "./geo/cctv.geojson",
    label: "道路 CCTV",
    description: "全國道路監視器（約 6000+）。欄位 source（freeway 國道 / highway 省道 / city 市區）。",
  },

  // ── 基礎設施 ──
  landingStations: {
    url: "./geo/landing_stations.geojson",
    label: "海纜登陸站",
    description: "海底電纜登陸站。欄位 station_type（國際樞紐 / 區域節點 / 端點）。",
  },
  waterMonitorStations: {
    url: "./geo/water_monitor_stations.geojson",
    label: "水文監測站",
    description: "全國水文監測站。欄位 station_type（測站類型）、county（縣市）。",
  },
  convenienceStores: {
    url: "./geo/convenience_stores.geojson",
    label: "超商",
    description:
      "全國連鎖超商點位。欄位 brand（7-ELEVEN / 全家 FamilyMart / 萊爾富 Hi-Life / OK）、county（縣市）。",
  },

  // ── 廢棄物 / 清運（Waste，全國 22 縣市）──
  wasteStopsStatic: {
    url: "./geo/waste_stops_static.geojson",
    label: "全台垃圾車清運點位",
    description:
      "全台垃圾車 / 廚餘車清運停靠點（約 7.3 萬筆，檔案較大）。欄位 city（縣市，涵蓋全 22 縣市）、district（行政區）、vehicle_type（garbage 一般垃圾 / kitchen 廚餘）、routes_count（該點經過的清運路線數）。問「XX 市有幾個清運點 / 各縣市清運點分佈」用 groupBy city。注意：掩埋場 / 焚化爐 / 資收廠等『處理設施』與衣物回收箱等『投放點』不在此靜態檔，其數量請改用 call_rpc 的 get_waste_facility_counts / get_waste_disposal_point_counts。",
  },
};

export type DatasetId = keyof typeof DATASET_WHITELIST;
