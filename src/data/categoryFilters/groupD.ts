import type { CategoryFilterDef } from "../categoryFilters";

/** 旅宿類別（facility_category）：canonical 8 類＋未知；OSM 無旅館／簡易宿所，6 類＋未知。 */
const ACCOMMODATION_COMMON = [
  { value: "hotel", zh: "飯店" },
  { value: "guest_house", zh: "民宿／Guest house" },
  { value: "hostel", zh: "青年旅館" },
  { value: "apartment", zh: "公寓式住宿" },
  { value: "motel", zh: "汽車旅館" },
  { value: "resort", zh: "度假村" },
] as const;

const RELIGION_OPTIONS = [
  { value: "shinto", zh: "神道 Shinto" },
  { value: "buddhist", zh: "佛教 Buddhist" },
  { value: "christian", zh: "基督宗教 Christian" },
] as const;

export const CATEGORY_FILTERS_D: Record<string, CategoryFilterDef | readonly CategoryFilterDef[]> = {
  // 位元順序＝圖例順序；canonical 的 8 類 value 順序（hotel, ryokan, simple_lodging, guest_house …）
  jpAccommodationCanonical: {
    property: "facility_category",
    options: [
      { value: "hotel", zh: "飯店" },
      { value: "ryokan", zh: "日式旅館 Ryokan" },
      { value: "simple_lodging", zh: "簡易宿所" },
      ...ACCOMMODATION_COMMON.slice(1),
    ],
    other: "未知／缺值",
  },
  jpAccommodationOsm: {
    property: "facility_category",
    options: [...ACCOMMODATION_COMMON],
    other: "未知／缺值",
  },
  jpReligionGsi: { property: "religion", options: [...RELIGION_OPTIONS] },
  jpReligionOsm: { property: "religion", options: [...RELIGION_OPTIONS] },
  jpReligionWikidata: { property: "religion", options: [...RELIGION_OPTIONS] },
  jpStations: {
    property: "jp_type",
    options: [
      { value: "新幹線", zh: "新幹線" },
      { value: "JR在来線", zh: "JR 在来線" },
      { value: "民営鉄道", zh: "民営鉄道" },
      { value: "第三セクター", zh: "第三セクター" },
      { value: "公営鉄道", zh: "公営鉄道" },
    ],
    other: "その他",
  },
  jpRailways: {
    property: "operator_type",
    options: [
      { value: "新幹線", zh: "新幹線" },
      { value: "JR在来線", zh: "JR 在来線" },
      { value: "民営鉄道", zh: "民営鉄道" },
      { value: "第三セクター", zh: "第三セクター" },
      { value: "公営鉄道", zh: "公営鉄道" },
    ],
  },
  jpEvacuationSites: {
    property: "site_type",
    options: [
      { value: "emergency_site", zh: "指定緊急避難場所" },
      { value: "shelter", zh: "指定避難所" },
    ],
  },
  jpBusStops: {
    property: "bus_class",
    options: [
      { value: "route_private", zh: "民營路線" },
      { value: "community", zh: "社區巴士" },
      { value: "route_public", zh: "公營路線" },
      { value: "other", zh: "其他" },
      { value: "mixed", zh: "公營＋社區共站" },
    ],
  },
  jpSchools: {
    property: "school_class",
    options: [
      { value: "幼稚園", zh: "幼稚園" },
      { value: "幼保連携型認定こども園", zh: "幼保連携型認定こども園" },
      { value: "小学校", zh: "小学校" },
      { value: "義務教育学校", zh: "義務教育学校" },
      { value: "中学校", zh: "中学校" },
      { value: "高等学校", zh: "高等学校" },
      { value: "中等教育学校", zh: "中等教育学校" },
      { value: "大学", zh: "大学" },
      { value: "短期大学", zh: "短期大学" },
      { value: "高等専門学校", zh: "高等専門学校" },
      { value: "特別支援学校", zh: "特別支援学校" },
      { value: "専修学校", zh: "専修学校" },
      { value: "各種学校", zh: "各種学校" },
    ],
  },
  jpWaterSupplyFacilities: {
    property: "facility_category",
    options: [
      { value: "water_treatment_plant", zh: "淨水場" },
      { value: "water_pump_station", zh: "泵場" },
      { value: "chlorination_facility", zh: "滅菌／消毒設施" },
      { value: "management_facility", zh: "管理設施" },
      { value: "distribution_reservoir", zh: "配水池／配水場" },
      { value: "intake_or_source_facility", zh: "取水／水源設施" },
      { value: "unclassified_supply_facility", zh: "上水道設施（未分類）" },
    ],
  },
  jpWaterSewerFacilities: {
    property: "facility_category",
    options: [
      { value: "sewer_pump_station", zh: "下水道泵場" },
      { value: "sewage_treatment_plant", zh: "下水處理場／淨化中心" },
      { value: "unclassified_sewer_facility", zh: "下水道設施（未分類）" },
    ],
  },
  // 落雷：資料走 overlayRegistry（withCategoryFilter 自動接線），strike_type 為數字 0／1
  jmaLightning: {
    property: "strike_type",
    options: [
      { value: "0", zh: "對地雷" },
      { value: "1", zh: "雲放電" },
    ],
  },
  jpNationalForests: {
    property: "function_type_en",
    options: [
      { value: "water_conservation", zh: "水源涵養" },
      { value: "disaster_prevention_sediment", zh: "山地災害防止（土砂流出崩壞防備）" },
      { value: "disaster_prevention_weather", zh: "山地災害防止（氣象害防備）" },
      { value: "forest_recreation", zh: "森林空間利用" },
      { value: "nature_preservation", zh: "自然維持" },
      { value: "amenity_environment", zh: "快適環境形成" },
    ],
    other: "空白",
  },
  // 日本第二輪（2026-11-06）自然保育三層：registry 圖層，withCategoryFilter 自動接線；選項順序＝圖例
  jpNaturalParkAreas2015: {
    property: "level",
    label: "地域區分",
    options: [
      { value: "1", zh: "自然公園地域（外圍）" },
      { value: "2", zh: "特別地域" },
      { value: "3", zh: "特別保護地區" },
    ],
  },
  jpNationalParksMoe: {
    property: "zone",
    label: "地種區分",
    options: [
      { value: "特別保護地区", zh: "特別保護地區" },
      { value: "第1種特別地域", zh: "第 1 種特別地域" },
      { value: "第2種特別地域", zh: "第 2 種特別地域" },
      { value: "第3種特別地域", zh: "第 3 種特別地域" },
      { value: "普通地域", zh: "普通地域" },
      { value: "海域公園地区", zh: "海域公園地區" },
      { value: "区分未定", zh: "區分未定" },
    ],
  },
  jpWildlifeProtectionMoe: [
    {
      property: "category",
      label: "指定區分",
      options: [
        { value: "集団渡来地", zh: "集團渡來地" },
        { value: "集団繁殖地", zh: "集團繁殖地" },
        { value: "希少鳥獣生息地", zh: "稀少鳥獸棲息地" },
        { value: "大規模生息地", zh: "大規模棲息地" },
      ],
    },
    {
      property: "protection_class",
      id: "Class",
      label: "保護區分",
      options: [
        { value: "鳥獣保護区", zh: "鳥獸保護區" },
        { value: "特別保護地区", zh: "特別保護地區" },
        { value: "特別保護指定地域", zh: "特別保護指定區域" },
      ],
    },
  ],
};
