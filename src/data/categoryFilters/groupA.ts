import type { CategoryFilterDef } from "../categoryFilters";

export const CATEGORY_FILTERS_A: Record<string, CategoryFilterDef | readonly CategoryFilterDef[]> = {
  antiCorruptionOffice: {
    property: "level",
    options: [
      { value: "central", zh: "中央" },
      { value: "local", zh: "地方" },
    ],
  },
  aquacultureIntegrated: {
    property: "source",
    options: [
      { value: "ponds", zh: "逐口魚塭（OSM）" },
      { value: "satellite", zh: "衛星偵測補充" },
      { value: "production", zh: "生產區" },
    ],
  },
  batterySwapStations: {
    property: "operator",
    options: [
      { value: "cpc", zh: "中油加油站（提供換電）" },
      { value: "taipower", zh: "台電出租土地（換電站或充電站用）" },
    ],
  },
  cctv: {
    property: "source",
    options: [
      { value: "freeway", zh: "國道" },
      { value: "highway", zh: "省道快速道路" },
      { value: "city", zh: "市區道路" },
    ],
  },
  cemeteryZoning: {
    property: "zone_label",
    options: [
      { value: ["公墓用地", "墓地", "墓地用地", "墳墓用地", "軍人公墓用地"], zh: "公墓／墓地用地" },
      { value: ["殯葬設施用地", "殯葬設施專用區", "殯葬用地"], zh: "殯葬設施用地" },
      { value: "殯儀館用地", zh: "殯儀館用地" },
    ],
  },
  cemsStackLive: {
    property: "status",
    label: "運轉狀態",
    options: [
      { value: "exceed", zh: "數值逾限" },
      { value: "running", zh: "正常運轉（N）" },
      { value: "startStop", zh: "起火／停車期間（C／E）" },
      { value: "maintenance", zh: "歲（檢）修（G）" },
      { value: "halted", zh: "暫停運轉／停工（F／P）" },
    ],
  },
  coastGuardStation: {
    property: "facility_subtype",
    options: [
      { value: "ocean_pier", zh: "海洋分署" },
      { value: "patrol_station", zh: "巡防隊" },
    ],
  },
  correctionalFacility: {
    property: "facility_type",
    options: [
      { value: "prison", zh: "監獄" },
      { value: "detention", zh: "看守所" },
      { value: "drug_rehab", zh: "戒治所" },
      { value: "correction_school", zh: "矯正學校" },
      { value: "juvenile_obs", zh: "少年觀護所" },
    ],
  },
  court: {
    property: "court_type",
    options: [
      { value: "supreme", zh: "最高法院" },
      { value: "high", zh: "高等法院" },
      { value: "admin", zh: "高等行政" },
      { value: ["ipc", "juvenile_family"], zh: "智財商業／少家事" },
      { value: "district", zh: "地方法院" },
    ],
  },
  drinkingWaterProtectionZones: {
    property: "zone_type",
    options: [
      { value: "保護區", zh: "水源水質保護區" },
      { value: "一定距離", zh: "取水口一定距離" },
    ],
  },
  ecoNetworkZones: {
    property: "Zone",
    label: "分區",
    options: [
      { value: "北部", zh: "北部" },
      { value: "西北部", zh: "西北部" },
      { value: "東北部", zh: "東北部" },
      { value: "西部", zh: "西部" },
      { value: "西南部", zh: "西南部" },
      { value: "南部及恆春半島", zh: "南部及恆春半島" },
      { value: "東部", zh: "東部" },
      { value: "澎湖", zh: "澎湖" },
      { value: "金門", zh: "金門" },
      { value: "馬祖", zh: "馬祖" },
      { value: "綠島", zh: "綠島" },
      { value: "蘭嶼", zh: "蘭嶼" },
    ],
  },
  eduCampusPolygon: {
    property: "school_level",
    label: "學制",
    options: [
      { value: "elementary", zh: "國小" },
      { value: ["junior", "combined_k9"], zh: "國中" },
      { value: "senior", zh: "高中職" },
      { value: "university", zh: "大專" },
      { value: "special", zh: "特教" },
      { value: ["international", "experimental"], zh: "實驗／國際" },
    ],
  },
  eduCramSchool: {
    property: "短期補習班類別",
    options: [
      { value: ["文理類"], zh: "文理" },
      { value: ["外語類"], zh: "外語" },
      { value: ["音樂、舞蹈類", "美術、書法、攝影、美工設計、圍棋類"], zh: "藝術" },
      {
        value: ["商類：珠算、心算、會計", "資訊類", "美容、美髮理髮類", "電機、汽車修護、建築、工藝、製圖類", "家政、插花、烹飪類", "縫紉類"],
        zh: "技職",
      },
      { value: ["法政類", "其他類", "瑜珈類", "速讀類"], zh: "其他" },
    ],
  },
  eduDistrictElementary: {
    property: "precision",
    label: "面的精確度",
    options: [
      { value: "village_full", zh: "整里皆屬" },
      { value: "village_partial", zh: "部分鄰屬" },
    ],
  },
  eduDistrictJunior: {
    property: "precision",
    label: "面的精確度",
    options: [
      { value: "village_full", zh: "整里皆屬" },
      { value: "village_partial", zh: "部分鄰屬" },
    ],
  },
  eduKindergarten: {
    property: "公/私立",
    label: "公私立",
    options: [
      { value: "公立", zh: "公立" },
      { value: "私立", zh: "私立" },
    ],
  },
  exclusiveFisheryRightAreas: {
    property: "status",
    options: [
      { value: "active", zh: "來源標「現存」" },
      { value: "expired", zh: "來源標「屆期」" },
    ],
  },
  facOffshore: {
    property: "status",
    label: "階段",
    options: [
      { value: "operating", zh: "運轉中" },
      { value: "construction", zh: "興建中" },
      { value: "pre-construction", zh: "規劃中" },
      { value: "announced", zh: "公告中" },
    ],
  },
  fireHydrants: {
    property: "cat",
    label: "型式",
    options: [
      { value: "地上式", zh: "地上式" },
      { value: "地下式", zh: "地下式" },
      { value: "台水", zh: "台水（型式代碼未公開）" },
    ],
    other: "其他",
  },
  fireStations: {
    property: "cat",
    options: [
      { value: "大隊", zh: "大隊" },
      { value: "分隊", zh: "分隊" },
      { value: "分駐所", zh: "分駐所" },
    ],
    other: "其他",
  },
};
