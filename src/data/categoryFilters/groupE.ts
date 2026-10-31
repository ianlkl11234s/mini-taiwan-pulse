import type { CategoryFilterDef } from "../categoryFilters";
import { VESSEL_CLASSES } from "../vesselWatchTypes";

/**
 * 組別 E（台灣即時／災害／情勢類）。
 * registry 圖層（mountainRescueIncidents、strandings、welfare、noise、lightning、newsEvents…）由 overlayRegistry 自動接線；
 * 自建 hook 圖層（fire、vesselWatch、roadEvents、警報群…）由各 hook 用 `hookCategoryFilter` 套用。
 * 選項順序＝bitmask 位元順序，新增請加在最後。
 */
export const CATEGORY_FILTERS_E: Record<string, CategoryFilterDef | readonly CategoryFilterDef[]> = {
  // ── hook 圖層 ──
  fireEvents: {
    property: "casualty",
    options: [
      { value: "true", zh: "有死傷" },
      { value: "false", zh: "無死傷" },
    ],
  },
  fireLatest: {
    property: "casualty",
    options: [
      { value: "true", zh: "有死傷" },
      { value: "false", zh: "無死傷" },
    ],
  },
  vesselWatch: {
    property: "vessel_class",
    options: VESSEL_CLASSES.map((c) => ({ value: c.value, zh: c.label })),
  },
  animalAdoption: {
    property: "species_color",
    options: [
      { value: "#f59e0b", zh: "犬為主" },
      { value: "#a855f7", zh: "貓為主" },
    ],
  },
  aspectVector: {
    property: "aspect_class",
    label: "坡向",
    options: [
      { value: "1", zh: "北" },
      { value: "2", zh: "東北" },
      { value: "3", zh: "東" },
      { value: "4", zh: "東南" },
      { value: "5", zh: "南" },
      { value: "6", zh: "西南" },
      { value: "7", zh: "西" },
      { value: "8", zh: "西北" },
      { value: "9", zh: "平地（坡度<5°）" },
    ],
  },
  plaActivity: {
    property: "shape_kind",
    options: [
      { value: "rect", zh: "活動走廊" },
      { value: "poly", zh: "活動區" },
    ],
  },
  roadEvents: {
    property: "event_type",
    options: [
      { value: "3", zh: "事故" },
      { value: "1", zh: "壅塞/事故" },
      { value: "2", zh: "施工" },
      { value: "7", zh: "活動/管制" },
      { value: "5", zh: "災害/障礙" },
    ],
  },
  agriPOI: {
    property: "poi_type",
    options: [
      { value: "leisure_farm", zh: "休閒農場" },
      { value: "tian_mama", zh: "田媽媽" },
      { value: "agritourism_certified", zh: "特色農業旅遊場域" },
    ],
  },
  aviationControl: {
    property: "layer",
    options: [
      { value: "FIR", zh: "FIR 飛航情報區" },
      { value: "TMA", zh: "TMA 終端管制區" },
    ],
  },
  aviationRestricted: {
    property: "layer",
    options: [
      { value: ["CTR", "CONTROL", "SURFACE"], zh: "CTR/CONTROL/SURFACE 機場管制" },
      { value: "RCR", zh: "RCR 限航區" },
      { value: "DANGER", zh: "DANGER 危險區" },
      { value: "ULZ", zh: "ULZ 超輕型活動區" },
      { value: "CIRCUIT", zh: "CIRCUIT 起降航線" },
    ],
  },
  // 警報群：5 個 key 共用一支 hook，各自獨立的 mask
  lifelineAlerts: {
    property: "event_term",
    options: [
      { value: "停水", zh: "停水" },
      { value: "電力中斷", zh: "電力中斷" },
      { value: "行動電話中斷", zh: "行動電話中斷" },
      { value: "停班停課", zh: "停班停課" },
    ],
  },
  floodAlerts: {
    property: "event_term",
    options: [
      { value: "淹水", zh: "淹水" },
      { value: "淹水感測", zh: "淹水感測" },
      { value: "水庫放流", zh: "水庫放流" },
      { value: "河川高水位", zh: "河川高水位" },
      { value: "區排警戒", zh: "區排警戒" },
      { value: "土石流及大規模崩塌", zh: "土石流及大規模崩塌" },
      { value: "枯旱預警", zh: "枯旱預警" },
    ],
  },
  weatherAlerts: {
    property: "event_term",
    options: [
      { value: "雷雨", zh: "雷雨" },
      { value: "降雨", zh: "降雨" },
      { value: "強風", zh: "強風" },
      { value: "高溫", zh: "高溫" },
      { value: "低溫", zh: "低溫" },
      { value: "濃霧", zh: "濃霧" },
      { value: "颱風", zh: "颱風" },
      { value: "海嘯", zh: "海嘯" },
    ],
  },
  transitAlerts: {
    property: "event_term",
    options: [
      { value: "道路封閉", zh: "道路封閉" },
      { value: "鐵路事故", zh: "鐵路事故" },
      { value: "捷運營運", zh: "捷運營運" },
      { value: "高速公路路況事件", zh: "高速公路路況事件" },
    ],
  },
  safetyAlerts: {
    property: "event_term",
    options: [
      { value: "火災", zh: "火災" },
      { value: "海洋污染", zh: "海洋污染" },
      { value: "空氣品質", zh: "空氣品質" },
      { value: "國家森林遊樂區", zh: "國家森林遊樂區" },
    ],
  },

  // ── registry 圖層（自動接線）──
  newsEvents: {
    property: "category",
    options: [
      { value: "accident", zh: "事故" },
      { value: "crime", zh: "治安" },
      { value: "disaster", zh: "災害" },
      { value: "traffic", zh: "交通" },
      { value: "health", zh: "健康" },
      { value: "policy", zh: "政策" },
    ],
    other: "其他",
  },
  lightning: {
    property: "strike_type",
    options: [
      { value: "0", zh: "雲對地" },
      { value: "1", zh: "雲中" },
    ],
  },
  lightningCwa: {
    property: "strike_type",
    options: [
      { value: "0", zh: "雲對地" },
      { value: "1", zh: "雲中" },
    ],
  },
  mountainRescueIncidents: {
    property: "cause",
    options: [
      { value: ["迷路", "迷路,遲歸", "迷路,其他"], zh: "迷路" },
      { value: "創傷", zh: "創傷" },
      { value: "墜谷", zh: "墜谷" },
      { value: "疾病", zh: "疾病" },
      { value: "疲勞", zh: "疲勞" },
      { value: "高山症", zh: "高山症" },
      { value: "遲歸", zh: "遲歸" },
      { value: ["天候惡劣", "落石", "落雷", "動物或昆蟲攻擊", "物或昆蟲"], zh: "天候・落石・動物" },
    ],
    other: "其他・不明",
  },
  cetaceanStrandings: {
    property: "animal_status",
    options: [
      { value: "死亡", zh: "死亡" },
      { value: "活體", zh: "活體" },
    ],
  },
  seaTurtleStrandings: {
    property: "species_zh",
    options: [
      { value: "綠蠵龜", zh: "綠蠵龜" },
      { value: "欖蠵龜", zh: "欖蠵龜" },
      { value: "玳瑁", zh: "玳瑁" },
      { value: "赤蠵龜", zh: "赤蠵龜" },
      { value: "革龜", zh: "革龜" },
    ],
    other: "無法辨認",
  },
  floodDisasterPointsNcdr: {
    property: "info_source",
    options: [
      { value: "emic_report", zh: "EMIC 災情通報" },
      { value: "flood_sensor", zh: "淹水感測器" },
      { value: "social_media", zh: "社群媒體" },
      { value: "news_media", zh: "新聞媒體" },
    ],
    other: "其他來源",
  },
  welfareElderlyHomes: {
    property: "attr_type",
    label: "公私別",
    options: [
      { value: ["公立"], zh: "公立" },
      { value: ["公設民營", "公辦民營", "公設\n民營"], zh: "公設民營／公辦民營" },
      { value: ["私立"], zh: "私立" },
    ],
  },
  welfareMentalHealth: {
    property: "sub_code",
    options: [
      { value: "T0105", zh: "社區心理衛生中心" },
      { value: "T0106", zh: "毒品危害防制中心" },
      { value: "T0503", zh: "康復之家" },
      { value: "T0504", zh: "心理諮商所／治療所" },
      { value: "T0502", zh: "社區復健中心" },
    ],
  },
  noiseControlZones: {
    property: "zone_class",
    options: [
      { value: "1", zh: "第一類" },
      { value: "2", zh: "第二類" },
      { value: "3", zh: "第三類" },
      { value: "4", zh: "第四類" },
    ],
  },
};
