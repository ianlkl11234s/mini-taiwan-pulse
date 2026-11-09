import type { CategoryFilterDef } from "../categoryFilters";

export const CATEGORY_FILTERS_B: Record<string, CategoryFilterDef | readonly CategoryFilterDef[]> = {
  // G53 批 2／3（2026-11-10）：污染管制區介質、列管類型（列管狀態另由 layerParamsSpec 手寫，預設只開列管中）
  pollutionControlZones: [
    { id: "Medium", property: "medium", label: "介質", options: [{ value: "soil", zh: "土壤" }, { value: "groundwater", zh: "地下水" }] },
    {
      id: "Group", property: "status_group", label: "列管類型",
      options: [{ value: "remediation", zh: "整治場址" }, { value: "control", zh: "控制場址" }, { value: "gw_restriction", zh: "地下水受污染使用限制地區" }],
    },
  ],
  // G53 批 2／3（2026-11-10）：水利署防災影像種類（值與 atlasLayerTypes WRA_CCTV_KIND_OPTIONS 同序）
  wraDisasterCctv: {
    property: "kind",
    label: "種類",
    options: [
      { value: "disaster", zh: "水情影像監視站" },
      { value: "dredging", zh: "疏濬工區管制站" },
    ],
  },
  // G53 批 2／3（2026-11-10）：廣播發射站種類（值與 atlasLayerTypes BROADCAST_KIND_OPTIONS 同序）
  broadcastTransmitters: {
    property: "kind",
    label: "種類",
    options: [
      { value: "fm", zh: "FM 廣播" },
      { value: "am", zh: "AM 廣播" },
      { value: "monitoring", zh: "電波監測站" },
    ],
  },
  // G53 批 1（2026-11-09）：國土利用監測變異點類別＋年度（網格層 skipCategoryFilter，改由 paint 依兩個 mask 加總計數欄）
  landUseChangeMonitoring: [
    {
      property: "change_class",
      options: [
        { value: "bare", zh: "裸露地" },
        { value: "building", zh: "建物" },
        { value: "road", zh: "道路" },
        { value: "water", zh: "水體" },
        { value: ["unknown", "farmland", "orchard", "forest"], zh: "其他" },
      ],
    },
    {
      property: "year",
      id: "Year",
      label: "年度",
      options: [
        { value: "107", zh: "107 年" },
        { value: "108", zh: "108 年" },
        { value: "109", zh: "109 年" },
        { value: "110", zh: "110 年" },
        { value: "111", zh: "111 年" },
        { value: "112", zh: "112 年" },
      ],
    },
  ],
  // G53 批 1（2026-11-09）：土石流潛勢溪流風險等級（三檔＋中點檔都有 risk；值與 DEBRIS_RISK_OPTIONS 同序）
  debrisFlowPotential: {
    property: "risk",
    label: "風險等級",
    options: [
      { value: "高", zh: "高" },
      { value: "中", zh: "中" },
      { value: "低", zh: "低" },
      { value: "持續觀察", zh: "持續觀察" },
    ],
  },
  // G53 批 1（2026-11-09）：特定水土保持區分類（值與 atlasLayerTypes SWC_ZONE_TYPE_OPTIONS 同序）
  swcSpecialZones: {
    property: "zone_type",
    label: "分類",
    options: [
      { value: "large_landslide", zh: "大規模崩塌" },
      { value: "debris_flow", zh: "土石流" },
      { value: "landslide", zh: "崩塌地" },
      { value: "reservoir_catchment", zh: "水庫集水區" },
      { value: "riverbank", zh: "河岸" },
    ],
  },
  // G53 批 1（2026-11-09）：郵筒收件類別（值與 atlasLayerTypes MAILBOX_SERVICE_OPTIONS 同序）
  postMailboxes: {
    property: "service",
    label: "郵筒類別",
    options: [
      { value: "regular", zh: "普通郵筒" },
      { value: "express", zh: "限時郵筒" },
      { value: "dual", zh: "限時普通雙用" },
      { value: "pair", zh: "同址兩筒（普通＋限時）" },
    ],
  },
  forestReserve: {
    property: "種類",
    label: "保安林種類",
    options: [
      { value: "土砂捍止保安林", zh: "土砂捍止" },
      { value: "水源涵養保安林", zh: "水源涵養" },
      { value: "防風保安林", zh: "防風" },
      { value: "飛砂防止保安林", zh: "飛砂防止" },
      { value: "潮害防備保安林", zh: "潮害防備" },
      { value: "漁業保安林", zh: "漁業" },
      { value: "自然保育保安林", zh: "自然保育" },
      { value: "風景保安林", zh: "風景" },
      { value: "墜石防止保安林", zh: "墜石防止" },
      { value: "衛生保建保安林", zh: "衛生保建" },
      { value: "土砂捍止保安林,水源涵養保安林", zh: "土砂+水源" },
      { value: "土砂捍止保安林,漁業保安林", zh: "土砂+漁業" },
      { value: "土砂捍止保安林,風景保安林", zh: "土砂+風景" },
    ],
  },
  fossilFuelInfra: {
    property: "facility_type",
    label: "設施類型",
    options: [
      { value: "lng_terminal", zh: "LNG 接收站" },
      { value: "oil_refinery", zh: "煉油廠" },
      { value: "gas_power_plant", zh: "燃氣電廠" },
    ],
  },
  freewayInterchanges: {
    property: "facility_type",
    label: "設施類型",
    options: [
      { value: "system_interchange", zh: "系統交流道" },
      { value: "interchange", zh: "交流道" },
      { value: "connector", zh: "轉接道" },
      { value: "terminus", zh: "路線端點" },
      { value: "other", zh: "其他" },
    ],
  },
  govServiceOffices: {
    property: "type",
    label: "機關類型",
    options: [
      { value: "district_office", zh: "公所" },
      { value: "household_registration", zh: "戶政事務所" },
      { value: "land_office", zh: "地政事務所" },
    ],
  },
  hakkaCulturalZones: {
    property: "hakka_accent",
    label: "客語腔調",
    options: [
      { value: "四縣腔", zh: "四縣腔" },
      { value: "海陸腔", zh: "海陸腔" },
      { value: "四縣腔海陸腔", zh: "四縣腔＋海陸腔" },
      { value: "大埔腔", zh: "大埔腔" },
      { value: "四縣腔大埔腔", zh: "四縣腔＋大埔腔" },
      { value: "詔安腔", zh: "詔安腔" },
    ],
  },
  hikingTrails: {
    property: "source",
    label: "步道來源",
    options: [
      { value: "A_forest", zh: "A 林業署國家步道" },
      { value: "B_osm", zh: "B OpenStreetMap" },
      { value: "C_np_sheipa", zh: "C 雪霸國家公園 SHP" },
      { value: "C_np_kinmen", zh: "C 金門國家公園 KML" },
      { value: "D_taipei_grand", zh: "D 臺北大縱走" },
      { value: "D_newtaipei", zh: "D 新北市觀光局" },
    ],
  },
  indigenousIsolationRisk: {
    property: "cause_combo",
    label: "成因",
    options: [
      { value: "debris+flood+road", zh: "土石流＋淹水＋道路中斷" },
      { value: "debris+road", zh: "土石流＋道路中斷" },
      { value: "flood+road", zh: "淹水＋道路中斷" },
      { value: "debris+flood", zh: "土石流＋淹水" },
      { value: "road", zh: "只有道路中斷" },
      { value: "debris", zh: "只有土石流" },
      { value: "flood", zh: "只有淹水" },
      { value: "none", zh: "未勾選成因" },
    ],
  },
  importantWetlandZones: {
    property: "zone",
    label: "功能分區",
    options: [
      { value: "核心保育區", zh: "核心保育區" },
      { value: "生態復育區", zh: "生態復育區" },
      { value: "環境教育區", zh: "環境教育區" },
      { value: "管理服務區", zh: "管理服務區" },
      { value: "其他分區", zh: "其他分區" },
    ],
  },
  water1944Taipei: {
    property: "status",
    label: "今日狀態",
    options: [
      { value: "still", zh: "今日仍是河道" },
      { value: "gone", zh: "今日已非河道" },
    ],
  },
  indigenousLanguageDialects: {
    property: "ethnic_group",
    label: "族別",
    options: [
      { value: "泰雅族", zh: "泰雅族" },
      { value: "阿美族", zh: "阿美族" },
      { value: "排灣族", zh: "排灣族" },
      { value: "布農族", zh: "布農族" },
      { value: "太魯閣族", zh: "太魯閣族" },
      { value: "賽夏族", zh: "賽夏族" },
      { value: "魯凱族", zh: "魯凱族" },
      { value: "賽德克族", zh: "賽德克族" },
      { value: "卑南族", zh: "卑南族" },
      { value: "鄒族", zh: "鄒族" },
      { value: "雅美族(達悟族)", zh: "雅美族（達悟族）" },
      { value: "邵族", zh: "邵族" },
      { value: "噶瑪蘭族", zh: "噶瑪蘭族" },
      { value: "撒奇萊雅族", zh: "撒奇萊雅族" },
      { value: "拉阿魯哇族", zh: "拉阿魯哇族" },
      { value: "卡那卡那富族", zh: "卡那卡那富族" },
      { value: "multiple", zh: "兩族以上" },
    ],
  },
  indigenousTribes: {
    property: "ethnic_group",
    label: "族別",
    options: [
      { value: "泰雅族", zh: "泰雅族" },
      { value: "阿美族", zh: "阿美族" },
      { value: "排灣族", zh: "排灣族" },
      { value: "布農族", zh: "布農族" },
      { value: "太魯閣族", zh: "太魯閣族" },
      { value: "賽夏族", zh: "賽夏族" },
      { value: "魯凱族", zh: "魯凱族" },
      { value: "賽德克族", zh: "賽德克族" },
      { value: "卑南族", zh: "卑南族" },
      { value: "鄒族", zh: "鄒族" },
      { value: "雅美族(達悟族)", zh: "雅美族（達悟族）" },
      { value: "邵族", zh: "邵族" },
      { value: "噶瑪蘭族", zh: "噶瑪蘭族" },
      { value: "撒奇萊雅族", zh: "撒奇萊雅族" },
      { value: "拉阿魯哇族", zh: "拉阿魯哇族" },
    ],
    other: "其他／多族",
  },
  internetExchangePoints: {
    property: "region",
    label: "區域",
    options: [
      { value: "Africa", zh: "非洲" },
      { value: "Asia-Pacific", zh: "亞太" },
      { value: "Europe", zh: "歐洲" },
      { value: "Latin America", zh: "拉丁美洲" },
      { value: "North America", zh: "北美" },
    ],
  },
  iowStructureMonitoring: {
    property: "structure_category",
    label: "結構類別",
    options: [
      { value: "levee_safety", zh: "堤防結構安全" },
      { value: "gate", zh: "閘門" },
    ],
  },
  islandPowerGrid: {
    property: "fuel_type",
    label: "燃料",
    options: [
      { value: "diesel", zh: "柴油" },
      { value: "gas", zh: "天然氣" },
      { value: "solar", zh: "太陽" },
      { value: "wind", zh: "風力" },
      { value: "hydro", zh: "水力" },
    ],
    other: "其他",
  },
  lakesPondsOsm: {
    property: "water",
    label: "水體類型",
    options: [
      { value: "pond", zh: "埤塘" },
      { value: "lake", zh: "湖泊" },
      { value: "reservoir", zh: "水塘" },
      { value: "basin", zh: "水池" },
    ],
  },
  majorOccupationalAccidents: {
    property: "accident_type",
    label: "災害類型",
    options: [
      { value: "墜落、滾落", zh: "墜落、滾落" },
      { value: "物體倒塌、崩塌", zh: "物體倒塌、崩塌" },
      { value: "物體飛落", zh: "物體飛落" },
      { value: "感電", zh: "感電" },
      { value: "被夾、被捲", zh: "被夾、被捲" },
      { value: "被撞", zh: "被撞" },
      { value: "公路交通事故", zh: "公路交通事故" },
    ],
    other: "其他",
  },
  marineWildlifeAreas: {
    property: "category",
    options: [
      { value: "habitat", zh: "野生動物重要棲息環境" },
      { value: "protected", zh: "野生動物保護區" },
    ],
  },
  maritimeBoundary: {
    property: "layer",
    label: "界線類型",
    options: [
      { value: "baseline", zh: "領海基線" },
      { value: "territorial_sea_12nm", zh: "12 浬領海外界線" },
      { value: "contiguous_zone_24nm", zh: "24 浬鄰接區外界線" },
      { value: "basepoint", zh: "領海基點" },
    ],
  },
  mountainHuts: {
    property: "facility_type",
    label: "設施類型",
    options: [
      { value: "hut", zh: "山屋" },
      { value: "lodge", zh: "山莊" },
      { value: "campsite", zh: "營地" },
      { value: "shelter", zh: "避難山屋" },
    ],
  },
  osmCommunicationSites: {
    property: "site_kind",
    label: "通訊類型",
    options: [
      { value: ["mobile_phone", "mobile"], zh: "行動電話" },
      { value: "radio", zh: "廣播" },
      { value: "television", zh: "電視" },
      { value: "microwave", zh: "微波" },
      { value: "general", zh: "其他通訊" },
    ],
  },
};
