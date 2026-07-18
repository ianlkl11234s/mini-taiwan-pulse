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

  // ── 公共設施（Civic Facilities）──
  postOffices: {
    url: "./civic_facilities/post_offices_national.geojson",
    label: "郵局",
    description:
      "全國郵局點位（約 1278）。欄位 name / address / phone / city / district，及 4 個服務旗標（weekday_service 平日 / weekday_extended_service 平日延時 / saturday_service 週六 / sunday_service 週日）。",
  },
  iPostBoxes: {
    url: "./civic_facilities/ibox_national.geojson",
    label: "i郵箱",
    description:
      "全國中華郵政 i郵箱自助取件點（約 2345）。欄位 name / address / relative_location / business_hours / locker_count（格數）/ cabinet_type（櫃型）。",
  },
  communityCenters: {
    url: "./civic_facilities/community_centers_national.geojson",
    label: "社區活動中心",
    description:
      "社區活動中心點位（約 1794，部分縣市：新北/彰化/南投/桃園/臺北/高雄/花蓮/金門）。欄位 name / county / town / address。",
  },
  govServiceOffices: {
    url: "./civic_facilities/gov_service_offices_national.geojson",
    label: "機關便民據點",
    description:
      "全國機關便民據點（約 702）。欄位 type（district_office 公所 / household_registration 戶政事務所 / land_office 地政事務所）、county（縣市）、jurisdiction（轄區）。",
  },
  publicLibraries: {
    url: "./culture/public_libraries_national.geojson",
    label: "公共圖書館",
    description:
      "全國公共圖書館點位（約 634）。欄位 name / county（縣市）/ type（類型）。",
  },
  welfareCenters: {
    url: "./civic_facilities/welfare_centers_national.geojson",
    label: "社福中心",
    description:
      "全國社會福利服務中心點位（約 157，資料時點 2023-04）。欄位 name / county（縣市）/ service_area（服務區）。",
  },
  retailMarkets: {
    url: "./poi/public_retail_markets_national.geojson",
    label: "公有零售市場",
    description:
      "全國公有零售市場點位（約 731）。欄位 name / county（縣市）/ business_hours（營業時間）。",
  },
  publicToilets: {
    url: "./environment/public_toilets_national.geojson",
    label: "公廁",
    description:
      "全國公廁點位（約 13281）。欄位 name / county（縣市）/ grade（清潔評鑑等級：特優級 / 優等級 / 普通級 / 不合格）/ type2（場所類別）。",
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
