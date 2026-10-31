import type { CategoryFilterDef, CategoryOption } from "../categoryFilters";

// 運動場館：5 個子圖層共用同一份 all_venues.geojson 的 category（27 類，照圖例順序）
const SPORTS_CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: "籃球場", zh: "籃球場" },
  { value: "田徑場", zh: "田徑場" },
  { value: "羽球場", zh: "羽球場" },
  { value: "排球場", zh: "排球場" },
  { value: "游泳池", zh: "游泳池" },
  { value: "健身房", zh: "健身房" },
  { value: "足球場", zh: "足球場" },
  { value: "躲避球場", zh: "躲避球場" },
  { value: "網球場", zh: "網球場" },
  { value: "桌球場", zh: "桌球場" },
  { value: "綜合體育館", zh: "綜合體育館" },
  { value: "舞蹈教室", zh: "舞蹈教室" },
  { value: "棒球場", zh: "棒球場" },
  { value: "棒壘打擊練習場", zh: "棒壘打擊練習場" },
  { value: "直排輪/滑輪場", zh: "直排輪/滑輪場" },
  { value: "壘球場", zh: "壘球場" },
  { value: "武術/技擊場", zh: "武術/技擊場" },
  { value: "高爾夫球場", zh: "高爾夫球場" },
  { value: "撞球場", zh: "撞球場" },
  { value: "攀岩場", zh: "攀岩場" },
  { value: "射箭/射擊場", zh: "射箭/射擊場" },
  { value: "體操館", zh: "體操館" },
  { value: "慢跑道", zh: "慢跑道" },
  { value: "運動公園/廣場", zh: "運動公園/廣場" },
  { value: "自由車場", zh: "自由車場" },
  { value: "保齡球館", zh: "保齡球館" },
  { value: "其他/未分類", zh: "其他/未分類" },
];
const SPORTS_CATEGORY: CategoryFilterDef = { property: "category", options: SPORTS_CATEGORY_OPTIONS };

export const CATEGORY_FILTERS_C: Record<string, CategoryFilterDef | readonly CategoryFilterDef[]> = {
  osmPowerPlantsStatic: {
    property: "plant_source",
    options: [
      { value: "solar", zh: "太陽" },
      { value: "wind", zh: "風力" },
      { value: "hydro", zh: "水力" },
      { value: "coal", zh: "煤" },
      { value: "gas", zh: "天然氣" },
      { value: "nuclear", zh: "核能" },
      { value: "waste", zh: "廢棄物" },
    ],
    other: "其他/未標",
  },
  osmRoadDrive: {
    property: "highway",
    options: [
      { value: ["motorway", "motorway_link"], zh: "高速公路" },
      { value: ["trunk", "trunk_link"], zh: "快速道路" },
      { value: ["primary", "primary_link"], zh: "主要道路" },
      { value: ["secondary", "secondary_link"], zh: "次要道路" },
      { value: ["tertiary", "tertiary_link"], zh: "聯絡道路" },
    ],
    other: "其餘",
  },
  osmSubstations: {
    property: "class",
    options: [
      { value: "PS", zh: "一次變電所" },
      { value: "DPS", zh: "一次配電變電所" },
      { value: "SS", zh: "二次變電所" },
      { value: "TRACTION", zh: "鐵路牽引變電所" },
    ],
    other: "未分類",
  },
  osmSubstationsEhv: {
    property: "class",
    options: [
      { value: "EHV_SWITCH", zh: "超高壓開閉所" },
      { value: "EHV", zh: "超高壓變電所" },
    ],
  },
  policeStation: {
    property: "facility_subtype",
    options: [
      { value: "headquarters", zh: "警政署（總部）" },
      { value: "police_dept", zh: "縣市警察局" },
      { value: "precinct", zh: "分局" },
      { value: "substation", zh: "派出所" },
      { value: "specialized", zh: "專業警隊" },
      { value: "other", zh: "其他" },
    ],
  },
  ports: {
    property: "port_class",
    label: "港口類別",
    options: [
      { value: "國際商港", zh: "國際商港" },
      { value: "國內商港", zh: "國內商港" },
      { value: "客運港", zh: "客運港" },
      { value: "渡輪/觀光碼頭", zh: "渡輪／觀光碼頭" },
      { value: "離島渡輪港", zh: "離島渡輪港" },
      { value: "第一類漁港", zh: "第一類漁港" },
      { value: "第二類漁港", zh: "第二類漁港" },
      { value: "廢止漁港", zh: "廢止漁港" },
      { value: "對岸港口", zh: "對岸港口" },
    ],
    other: "其他／未分類",
  },
  prosecutorsOffice: {
    property: "pros_type",
    options: [
      { value: "supreme", zh: "最高檢察署" },
      { value: "high", zh: "高等檢察署" },
      { value: "district", zh: "地方檢察署" },
    ],
  },
  renewablePermitsNational: {
    property: "symbiotic_class",
    options: [
      { value: "漁電共生", zh: "漁電共生（名稱關鍵字）" },
      { value: "水域光電", zh: "水域光電（名稱關鍵字）" },
      { value: "畜電共生", zh: "畜電共生（名稱關鍵字）" },
      { value: "屋頂型", zh: "屋頂型（名稱關鍵字）" },
      { value: "pure_ground", zh: "地面型（容量密度推估）" },
      { value: "mixed", zh: "混合（容量密度推估）" },
      { value: "suspect_symbiotic", zh: "疑似共生（容量密度推估）" },
      { value: "unknown", zh: "無法分類" },
    ],
  },
  renewablePermitsTaipei: {
    property: "category",
    options: [
      { value: "學校", zh: "學校" },
      { value: "國有房地", zh: "國有房地" },
      { value: "機關", zh: "機關" },
      { value: "焚化發電", zh: "焚化發電" },
      { value: "沼氣發電", zh: "沼氣發電" },
      { value: "水力發電", zh: "水力發電" },
    ],
  },
  sportsCenter: SPORTS_CATEGORY,
  sportsPark: SPORTS_CATEGORY,
  sportsPrivate: SPORTS_CATEGORY,
  sportsPublicOther: SPORTS_CATEGORY,
  sportsSchool: SPORTS_CATEGORY,
  tourAttractions: {
    property: "category",
    options: [
      { value: "Nature", zh: "自然" },
      { value: "Culture", zh: "文化" },
      { value: "Leisure_Arts", zh: "休閒藝術" },
      { value: "Urban_Comm", zh: "都會社區" },
    ],
    other: "其他",
  },
  tourHeritage: {
    property: "category",
    options: [
      { value: "古蹟", zh: "古蹟" },
      { value: "歷史建築", zh: "歷史建築" },
      { value: "文化景觀", zh: "文化景觀" },
      { value: "考古遺址", zh: "考古遺址" },
      { value: "聚落建築群", zh: "聚落建築群" },
      { value: "紀念建築", zh: "紀念建築" },
      { value: "史蹟", zh: "史蹟" },
    ],
  },
  waterCanals: {
    property: "t",
    options: [
      { value: "灌溉專用渠道", zh: "灌溉專用渠道" },
      { value: "下游具引灌需求", zh: "下游具引灌需求" },
    ],
    other: "不具引灌需求/宜蘭",
  },
  waterFacilities: {
    property: "facility_type",
    options: [
      { value: "pump_station", zh: "抽水站 (OSM)" },
      { value: "pump_station_official", zh: "官方抽水站 (WRA)" },
      { value: "treatment_plant", zh: "自來水廠 / 淨水場" },
      { value: "water_tower", zh: "水塔" },
    ],
    other: "其他 / 未分類",
  },
  waterMonitorStations: {
    property: "station_type",
    options: [
      { value: "rain_gauge", zh: "雨量站" },
      { value: "river_level", zh: "河川水位站" },
      { value: "groundwater_well", zh: "地下水觀測井" },
    ],
    other: "其他 / 未分類",
  },
  waterProtectionZones: {
    property: "zone_kind",
    options: [
      { value: "protection", zh: "自來水水質水量保護區" },
      { value: "groundwater_control_2", zh: "地下水禁止超抽" },
      { value: "groundwater_control_1", zh: "地下水限制超抽" },
      { value: "groundwater_region", zh: "地下水分區" },
    ],
  },
  waterRecreationRestrictedAreas: {
    property: "kind",
    options: [
      { value: "prohibited", zh: "禁止水域遊憩活動" },
      { value: "mixed", zh: "禁止＋限制（同一公告）" },
      { value: "restricted", zh: "限制或活動分區" },
    ],
  },
  wraDredgingPoints: {
    property: "status",
    label: "辦理狀態",
    options: [
      { value: "in_progress", zh: "執行中" },
      { value: "completed", zh: "已完工" },
      { value: "preparing", zh: "準備中" },
    ],
  },
};
