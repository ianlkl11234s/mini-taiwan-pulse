// 愛爾蘭國家包：manifest.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IeLayerKey } from "./keys";
import type { LayerManifestEntry } from "../../data/layerManifest";
import { layerName } from "../../data/layerManifest";
import { repPointDense, repPointLayer } from "../../data/repPointLayers";
import { IE_COILLTE_FOREST_ROADS, IE_COILLTE_RECREATION } from "./ieCoillteTypes";
import { IE_DATA_SPECS, IE_FLOOD_SCENARIOS, IE_GW_FLOOD_PRODUCTS, IE_NOISE_METRICS, ieFloodScenarioFile, ieGwFloodFile, ieNoiseMetricFile } from "./ieDataLayers";
import { type IeDataKey } from "./keys";
import { Activity, Atom, Baby, BedDouble, Bike, Building2, Bus, Cable, Castle, Church, CloudRain, Dam, Droplet, Droplets, Factory, Fish, Flower, Footprints, Fuel, Gauge, Gavel, GitBranch, Hammer, HeartPulse, Hospital, Landmark, Languages, Layers, LayoutGrid, Leaf, Library, Lock, type LucideIcon, Map, MapPin, Milestone, Mountain, Plane, PlugZap, Radiation, Recycle, Route, School, Shield, ShieldCheck, Ship, Shovel, Siren, Sprout, Theater, Trash2, TreeDeciduous, TreePine, Trees, Volume2, Waves, Wind, Zap } from "lucide-react";

/** 愛爾蘭第 1 波規格驅動 6 層（規格 SSOT 在 ieDataLayers.ts；畫法共用 useKrDataLayer；位置比照台灣同類主題與群組）。 */
const IE_DATA_ENTRY_META: Record<IeDataKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  ieMaritimeBoundaries: { theme: "底圖", group: "海域界線", zh: "海域界線", alt: "Maritime Boundaries", icon: Waves, dataset: "ie_maritime_boundaries", topics: ["愛爾蘭", "領海", "鄰接區", "專屬經濟區", "海域界線", "底圖"],
    description: "愛爾蘭海域界線 17 段（領海 12 浬 13、鄰接區 24 浬 1、專屬經濟區 3）", processing: "Marine Institute 三份 shapefile（2016 版）→ 4326；依界線種類合併；PMTiles z0–10", note: "CC BY 4.0；非航海用" },
  iePlaceNames: { theme: "底圖", group: "地名 Gazetteer", zh: "地名", alt: "Place Names", icon: MapPin, dataset: "ie_place_names", topics: ["愛爾蘭", "地名", "townland", "愛爾蘭語", "底圖"],
    description: "愛爾蘭官方地名 52,402 筆（人口中心 2,022、townland 50,046、島嶼 334；英文＋愛爾蘭語名）", processing: "Tailte National Placenames Gazetteer FeatureServer → 4326；以第 0 波地方政府面指派 LA；英文名轉字首大寫；PMTiles z4–12（townland、島嶼 z9 起）", note: "CC BY 4.0；26/26 郡；只畫點、名稱放 popup" },
  ieGaeltacht: { theme: "原民與農村", group: "愛爾蘭語區 Gaeltacht", zh: "Gaeltacht 語言規劃區", alt: "Gaeltacht Language Planning Areas", icon: Languages, dataset: "ie_gaeltacht_lpa", topics: ["愛爾蘭", "Gaeltacht", "愛爾蘭語", "語言", "普查"],
    description: "愛爾蘭 Gaeltacht 語言規劃區 26 區＋2022 普查愛爾蘭語使用（每天在教育體系外說的比例 2.4%–68.9%）", processing: "Tailte LPA 2026（192 碎片依 BDY_ID dissolve 成 26）＋CSO SAP2022T3T1LPT／T3T2LPT 依愛爾蘭語名對應 26/26；PMTiles z4–12", note: "CC BY 4.0；法定 Gaeltacht 範圍與 LPA 聯集只差 3.72 km²，不另畫" },
  ieActivityLocations: { theme: "運動休閒", group: "運動場館", zh: "運動活動地點", alt: "Activity Locations", icon: Activity, dataset: "ie_activity_locations", topics: ["愛爾蘭", "運動", "運動場館", "Get Ireland Active"],
    description: "愛爾蘭 Get Ireland Active 運動活動地點 5,318 處（戶外 3,016、室內 859、海灘 461…）", processing: "Sport Ireland FeatureServer 5,507 筆 → 以地方政府面剔除北愛 186 與境外 3；排除描述與擁有者名稱欄；PMTiles z4–14", note: "CC BY 4.0；31/31 LA；非完整場館普查" },
  ieParks: { theme: "運動休閒", group: "公園 Parks", zh: "公園", alt: "Parks", icon: Trees, dataset: "ie_parks", topics: ["愛爾蘭", "公園", "綠地", "OSM"],
    description: "愛爾蘭公園 3,221 面（Dublin City、South Dublin 官方 650；其餘 29 個地方政府用 OSM 公園 2,390、公共花園 181）", processing: "DCC Parks 2016＋SDCC Parks FeatureServer；其餘 LA 取 Geofabrik 2026-11-05 PBF leisure=park／garden（排除私人、無名花園只留開放者）；面 PMTiles z6–13＋代表點 z4–14", note: "CC BY 4.0＋ODbL；31/31 LA；29 個 LA 為 OSM、完整度未驗" },
  ieGraveyards: { theme: "殯葬", group: "點位", zh: "墓地", alt: "Graveyards", icon: Flower, dataset: "ie_graveyards", topics: ["愛爾蘭", "墓地", "殯葬", "考古", "SMR"],
    description: "愛爾蘭墓地點位 6,449 處（SMR 考古登錄墓地 3,352、埋葬地 1,326、兒童埋葬地 1,439；Galway、Fingal 議會名冊 332）", processing: "SMR FeatureServer 依 MONUMENT_CLASS 篩三類＋Galway、Fingal 名冊；排除網頁備註與照片欄；PMTiles z4–14", note: "CC BY 4.0；現行公墓只有 Fingal" },
  // 第 2 波（2026-11-07）：房地產（比照台灣「房地產」主題；國有地不是標售清單，群組名不用「標售」）
  ieCommercialValuations: { theme: "房地產", group: "商業房產估值", zh: "商業房產估值", alt: "Commercial Property Valuations", icon: Building2, dataset: "ie_commercial_valuations", topics: ["愛爾蘭", "房地產", "商業房產", "估值", "commercial rates", "Valuation Office"],
    description: "愛爾蘭商業房產估值 156,089 筆（29 個地方政府為淨年值 NAV 129,614 筆；Cork 市、郡為舊制 RV 26,475 筆、不可比）", processing: "Tailte Valuation API 31 個 rating authority 逐一抓 156,660 筆 → 剔座標空 546、26 郡外 25；Category 合併 8 類＋Cork；地址行濾掉疑似商號或人名；PMTiles z4–11 只帶類別、z12–14 全欄位", note: "CC BY 4.0（data.gov.ie 條目）；不含住宅、非市價；Cork 為舊制 RV" },
  ieStateAssets: { theme: "房地產", group: "國有登記土地", zh: "國有登記土地", alt: "State-owned Registered Land", icon: Landmark, dataset: "ie_state_assets", topics: ["愛爾蘭", "房地產", "國有土地", "公有地", "LDA", "folio"],
    description: "愛爾蘭國有登記土地 75,443 個 folio 面（地方政府 34,309、Coillte 17,090、Bord na Móna 8,813…；2023 Q3）", processing: "LDA PRA State Assets FeatureServer → 4326；所有人依 GovAgency／REG_OWNER 分 9 組；以第 0 波地方政府面指派 LA；面 PMTiles z8–14＋代表點 z4–14", note: "CC BY 4.0；folio 邊界受 PRA 版權註記（授權待確認）；2023 Q3 後未更新、非標售清單" },
  // 第 3a 波（2026-11-08）：水系統與洪水（主題比照英國第 3 波：測站、河川、排水在「水資源」，淹水、海岸侵蝕在「災害」）
  ieHydrometricStations: { theme: "水資源", group: "點位", zh: "水文站", alt: "Hydrometric Stations", icon: Gauge, dataset: "ie_hydrometric_stations", topics: ["愛爾蘭", "水文站", "水位", "流量", "水資源", "EPA"],
    description: "愛爾蘭水文站名冊 2,322 站（EPA 名冊 2,591，剔空座標 17、北愛 252；OPW、地方政府、EPA 的水位與流量站）", processing: "EPA GeoServer WFS MON_Hydrometricgauges → 4326；以第 0 波 31 LA 面剔北愛；PMTiles z4–14", note: "CC BY 4.0；只有名冊、沒有讀數（即時水位在第 12 波）" },
  ieWaterMonitoring: { theme: "水資源", group: "水質與污水 Water Quality", zh: "水質監測站與污水處理廠", alt: "Water Monitoring Stations & Waste Water Plants", icon: Droplets, dataset: "ie_water_monitoring", topics: ["愛爾蘭", "水質", "監測站", "地下水", "污水處理廠", "WFD", "EPA"],
    description: "愛爾蘭 EPA 水框架指令監測站 14,220（河川 9,954、湖泊 2,876、河口 608、沿海 492、地下水 290）＋都市污水處理廠 546", processing: "EPA GeoServer WFS MON_WaterStations、LEMA_Facilities_UWW → 4326；剔北愛 41 站；沿海、河口站 LA 面外 15 km 內保留；不收稽查員姓名與地址欄；PMTiles z4–14（拉遠熱區）", note: "CC BY 4.0；只有站點、沒有水質數值" },
  ieRiverWaterBodies: { theme: "水資源", group: "面 / 線", zh: "WFD 河川水體", alt: "WFD River Waterbodies", icon: GitBranch, dataset: "ie_river_water_bodies", topics: ["愛爾蘭", "河川", "水體", "水質", "生態狀態", "WFD", "EPA"],
    description: "愛爾蘭 WFD 河川水體 3,208 段，依 2019–2024 生態狀態著色（良好 1,315、普通 1,090、不佳 572、極佳 222、極差 6）", processing: "EPA GeoServer WFS RWB_WFD_LatestStatus → 4326；PMTiles z5–12", note: "CC BY 4.0；不是全部河網（River Network Routes 11.7 萬段未收）" },
  ieLakeWaterBodies: { theme: "水資源", group: "面 / 線", zh: "WFD 湖泊水體", alt: "WFD Lake Waterbodies", icon: Droplet, dataset: "ie_lake_water_bodies", topics: ["愛爾蘭", "湖泊", "水體", "水質", "生態狀態", "WFD", "EPA"],
    description: "愛爾蘭 WFD 湖泊水體 812 個，依 2019–2024 生態狀態著色（良好 298、極佳 255、普通 180、不佳 66、極差 13）", processing: "EPA GeoServer WFS LWB_WFD_LatestStatus＋WFD_LakeWaterBodiesActive（面積、地方政府）→ 4326；PMTiles z5–12", note: "CC BY 4.0" },
  ieArterialDrainage: { theme: "水資源", group: "面 / 線", zh: "主幹排水渠與堤防", alt: "Arterial Drainage Channels & Embankments", icon: Dam, dataset: "ie_arterial_drainage", topics: ["愛爾蘭", "排水", "堤防", "OPW", "水資源", "防洪"],
    description: "愛爾蘭 OPW 主幹排水渠 6,094 段＋堤防 599 段（Arterial Drainage Acts 1945／1995，65 個工程）", processing: "OPW floodinfo shapefile（Irish Grid TM75，EPSG:29903）→ 4326；依渠道／堤防分類；PMTiles z5–13", note: "CC BY 4.0；不含 Drainage District 與防洪工程" },
  ieRiverFloodExtents: { theme: "災害", group: "淹水", zh: "河川淹水範圍（NIFM）", alt: "River Flood Extents (NIFM)", icon: CloudRain, dataset: "ie_river_flood_extents", topics: ["愛爾蘭", "淹水", "洪水", "河川", "氣候變遷", "OPW", "NIFM"],
    description: "愛爾蘭 OPW 全國指示性河川淹水範圍：現況、中端未來、高端未來 × 20／100／1000 年一遇，共 9 組（現況 100 年一遇 4,116 面）", processing: "OPW NIFM shapefile（ITM）→ 4326，原樣不改屬性；一情境一支 PMTiles z5–13（同一 source-layer），圖層設定切換情境換檔", note: "CC BY-NC-ND 4.0（非商業使用、原樣未改作）；指示性模擬，非地塊判定" },
  ieCoastalErosion: { theme: "災害", group: "海岸侵蝕", zh: "海岸侵蝕線（ICPSS）", alt: "Coastal Erosion Lines (ICPSS)", icon: Waves, dataset: "ie_coastal_erosion", topics: ["愛爾蘭", "海岸侵蝕", "海岸", "氣候變遷", "OPW", "ICPSS"],
    description: "愛爾蘭 OPW ICPSS 2050 侵蝕線 1,220 段＋2010–2014 侵蝕速率線 73,036 段", processing: "OPW floodinfo shapefile（Irish Grid TM75）→ 4326，兩份原樣疊同一支圖磚、以原有 typecode 區分；PMTiles z5–13", note: "CC BY-NC-ND 4.0（非商業使用、原樣未改作）；評估未排除既有海岸防護結構" },
  // 第 3b 波（2026-11-08）：海洋（主題比照台灣、英國「海洋」）
  ieBathingWaters: { theme: "海洋", group: "海域環境", zh: "浴場水質", alt: "Bathing Waters", icon: Waves, dataset: "ie_bathing_waters", topics: ["愛爾蘭", "浴場", "海灘", "海水浴場", "水質", "藍旗", "EPA"],
    description: "愛爾蘭 EPA 浴場名冊 243 處（法定 154、非法定監測點 89），法定浴場依 2025 年度水質分級（極佳 120、良好 23、合格 7、不良 1、未分級 3）", processing: "EPA Bathing Water API locations（Irish Grid 推定 EPSG:29903）→ 4326；第 0 波 LA 面指派；PMTiles z4–14", note: "CC BY 4.0；分級為前 4 季評估，不含即時警示與逐次採樣" },
  ieMarineSurveyStations: { theme: "海洋", group: "調查站網 Survey Sites", zh: "漁業資源調查站位", alt: "Fisheries Survey Stations", icon: Fish, dataset: "ie_marine_survey_stations", topics: ["愛爾蘭", "漁業", "調查站", "海洋調查", "Marine Institute", "ICES"],
    description: "愛爾蘭 Marine Institute 漁業資源調查 7 個系列歷史站位 7,548 點（底拖網 2,280、海螯蝦水下攝影 3,677、鯖魚卵 784、聲學 465、生物採樣 248、深水 78、野豬魚 16；1999–2016）", processing: "atlas.marine.ie midata/Fisheries 7 份 CSV，欄位統一為系列、站號、航次、日期、分層；不剔海上點；PMTiles z4–12", note: "CC BY 4.0；歷史站位、只有位置，部分在愛爾蘭 EEZ 外" },
  ieSeabedSurveyCoverage: { theme: "海洋", group: "調查站網 Survey Sites", zh: "海床測深調查範圍", alt: "Seabed Survey Coverage (INFOMAR)", icon: Ship, dataset: "ie_seabed_survey_coverage", topics: ["愛爾蘭", "INFOMAR", "海床", "測深", "海洋調查", "GSI", "Marine Institute"],
    description: "愛爾蘭 GSI／Marine Institute 海床測深航次足跡 376 個（1996–2026；INFOMAR 291、INSS 22、其他 63）", processing: "GSI Seabed Survey Coverage shapefile（WGS84，109MB）→ 每面各自簡化 20 m；依計畫分類；PMTiles z4–11", note: "CC BY 4.0；範圍不是水深值" },
  ieProtectedMarineSites: { theme: "海洋", group: "海域保護與漁業 Protected Areas & Fisheries", zh: "受保護海域", alt: "Protected Marine Sites", icon: ShieldCheck, dataset: "ie_protected_marine_sites", topics: ["愛爾蘭", "海洋保護區", "SAC", "SPA", "NHA", "Natura 2000", "自然保留區", "拉姆薩", "NMPF"],
    description: "愛爾蘭國家海洋規劃架構（NMPF）受保護海域：只收有海域部分的 SAC、SPA、NHA、生物圈分區與海岸自然保留區、避難所、拉姆薩濕地", processing: "NMPF FeatureServer 7 圖層（伺服器端去點約 2 m）→ 面在第 0 波陸地面外 ≥ 10 ha、點在陸地外或離岸線 ≤ 1 km 才收；幾何不裁切；面 PMTiles z4–13＋代表點 z4–14", note: "CC BY 4.0；陸域保護區在第 5 波；法定 MPA 尚未立法" },
  ieOffshoreRenewables: { theme: "海洋", group: "再生能源", zh: "離岸再生能源海域", alt: "Offshore Renewable Energy Areas", icon: Wind, dataset: "ie_offshore_renewables", topics: ["愛爾蘭", "離岸風電", "風場", "海域許可", "MAC", "AMETS", "NMPF", "再生能源"],
    description: "愛爾蘭 NMPF 離岸風場與試驗場 30 面：2022 第一批海域許可 MAC 8、前灘程序風場 19（已運轉 1、過渡案 6、場址調查 12）、AMETS 3", processing: "NMPF FeatureServer layers 1–3 → 4326；名稱去重複換行；PMTiles z4–12", note: "CC BY 4.0；2020–2022 狀態、非現況；浮標與試驗場點 15 未收" },
  // 第 4 波（2026-11-08）：交通（群組比照南韓、加拿大：場站、路網、樞紐節點）
  ieTransitStops: { theme: "交通", group: "場站", zh: "大眾運輸站牌", alt: "Public Transport Stops", icon: Bus, dataset: "ie_transit_stops", topics: ["愛爾蘭", "交通", "公車", "鐵路", "Luas", "GTFS", "TFI"],
    description: "愛爾蘭大眾運輸站牌 14,149 站（公車 13,874、鐵路 147、Luas 128；TFI 全國整合 GTFS）", processing: "Mobility Database 鏡像 mdb-2364 latest.zip（NTA feed 2026-11-06～2027-11-06）stop_times→trips→routes 推每站運具與路線；剔北愛 37 站；PMTiles z4–14，z12 起點、之下熱區", note: "CC BY 4.0（data.gov.ie nta-gtfs）；NTA 原站對台灣 403 改走鏡像；無班次頻率與即時" },
  ieDublinbikesStations: { theme: "交通", group: "場站", zh: "Dublinbikes 站點", alt: "Dublinbikes Stations", icon: Bike, dataset: "ie_dublinbikes_stations", topics: ["愛爾蘭", "交通", "公共自行車", "都柏林", "dublinbikes"],
    description: "都柏林公共自行車 Dublinbikes 113 站（車柱 3,617）", processing: "Smart Dublin stations.geojson 只取站名、地址、車柱數；PMTiles z4–14", note: "CC BY 4.0；只有都柏林市；即時空位在第 12 波" },
  ieRoadRailNetwork: { theme: "交通", group: "路網", zh: "主要道路與鐵路", alt: "Main Roads & Railways", icon: Route, dataset: "ie_road_rail_network", topics: ["愛爾蘭", "交通", "道路", "高速公路", "鐵路", "Tailte"],
    description: "愛爾蘭 1:250,000 路網：道路 5,188 段（高速 915 km、主要 4,506 km、次要 12,523 km、地方 318 km）＋鐵路 479 段（1,852 km）", processing: "Tailte 250k Roads、Rail Network FeatureServer；RTT 依 ERM 代碼表分級（-32768 空值 40 段為來源未分類）；PMTiles z4–12", note: "CC BY 4.0；等級為推定（Tailte 未附代碼說明）；無路線編號與路名" },
  ieRoadMarkers: { theme: "交通", group: "路網", zh: "國道里程標與交流道", alt: "Road Marker Plates & Interchanges", icon: Milestone, dataset: "ie_road_markers", topics: ["愛爾蘭", "交通", "國道", "里程", "TII", "交流道"],
    description: "愛爾蘭國道里程標 4,163 面（M 3,517、N 646，每 0.5 km）＋交流道 43 處", processing: "TII TIIMarkerPlates.csv（RdPrefix＋RoadNum、mVal）＋Tailte 250k Road Interchanges；PMTiles z4–14", note: "CC BY 4.0；TII 2018 條目；R 路無來源；DirCode 推定為行車方向" },
  ieTrafficCounters: { theme: "交通", group: "路網", zh: "交通量計數站", alt: "Traffic Counters", icon: Gauge, dataset: "ie_traffic_counters", topics: ["愛爾蘭", "交通", "交通量", "TII", "計數站"],
    description: "愛爾蘭國道交通量計數站 308 站位置（TII 2018 名冊，無流量）", processing: "TII tmu-traffic-counters.geojson（field_1…field_5 依內容判讀）；PMTiles z4–14", note: "CC BY 4.0；STALE：2018 名冊，每日計數 2021 後無法取得" },
  ieAirportsPorts: { theme: "交通", group: "樞紐節點", zh: "機場、港口與渡輪碼頭", alt: "Airports, Harbours & Ferry Ports", icon: Plane, dataset: "ie_airports_ports", topics: ["愛爾蘭", "交通", "機場", "港口", "渡輪"],
    description: "愛爾蘭機場 9、小型機場 21、主要港口 6、其他港口 30、渡輪碼頭 38（共 104）", processing: "Tailte 250k Airfield Area（面中心，OurAirports 補名）、Airports、Main／Other Harbours＋NMPF Ferry Port；剔北愛 2；PMTiles z4–14", note: "CC BY 4.0（機場名 OurAirports public domain）；無運量與等級" },
  // 第 5 波（2026-11-08）：自然保護、林業、地質輻射（主題比照台灣：國家公園在觀光、保護區與樹木在環境氣候、步道在林業）
  ieNationalParks: { theme: "觀光", group: "玩・自然 Nature", zh: "國家公園", alt: "National Parks", icon: Trees, dataset: "ie_national_parks", topics: ["愛爾蘭", "國家公園", "自然", "NPWS", "觀光"],
    description: "愛爾蘭 6 座國家公園（Killarney、Glenveagh、Connemara、Burren、Wild Nephin、Wicklow Mountains，693 km²）", processing: "NPWS NationalParkBoundaries FeatureServer → 4326；面 PMTiles z4–13＋代表點（點／面切換，預設面）", note: "CC BY 4.0" },
  ieWildAtlanticWay: { theme: "觀光", group: "玩・自然 Nature", zh: "Wild Atlantic Way 觀光路線", alt: "Wild Atlantic Way", icon: Route, dataset: "ie_wild_atlantic_way", topics: ["愛爾蘭", "觀光", "觀光路線", "海岸", "Fáilte Ireland"],
    description: "愛爾蘭西岸觀光路線 Wild Atlantic Way 406 段、約 2,500 km（Donegal–Cork）", processing: "NMPF_7_3_Heritage_Assets FeatureServer/4 → 4326；PMTiles z4–12", note: "CC BY 4.0；資料年 2020；無路名、Discovery Points 未收" },
  ieProtectedSites: { theme: "環境氣候", group: "保護區", zh: "指定保護區（SAC／SPA／NHA）", alt: "Designated Sites (SAC / SPA / NHA)", icon: Shield, dataset: "ie_protected_sites", topics: ["愛爾蘭", "保護區", "Natura 2000", "SAC", "SPA", "NHA", "生態", "NPWS"],
    description: "愛爾蘭 NPWS 法定指定保護區 806 面：SAC 433、SPA 202、NHA 171（含海域部分）", processing: "NPWSDesignatedAreas FeatureServer layer 3／0／2 → 4326；面 PMTiles z4–13＋代表點（預設點）", note: "CC BY 4.0；pNHA 1,180 未收" },
  ieNationalTrails: { theme: "林業", group: "線", zh: "國家步道登錄", alt: "National Trails Register", icon: Footprints, dataset: "ie_national_trails", topics: ["愛爾蘭", "步道", "綠道", "健行", "單車", "Sport Ireland"],
    description: "愛爾蘭 Sport Ireland 國家步道登錄 1,340 條、約 18,500 km（步行 1,038、單車 133、綠道 49、長距離 44、划槳等）", processing: "NTR_ITM_view FeatureServer → 4326；剔北愛 3；PMTiles z4–13", note: "CC BY 4.0；Coillte 林道另在站主限定層" },
  ieStreetTrees: { theme: "環境氣候", group: "都市樹木 Urban Trees", zh: "都柏林樹木", alt: "Dublin Trees", icon: TreeDeciduous, dataset: "ie_street_trees", topics: ["愛爾蘭", "行道樹", "都市樹木", "樹種", "都柏林"],
    description: "都柏林三議會樹木 67,962 株（Fingal 35,978、DLR 16,235、Dublin City 15,749）", processing: "Fingal FeatureServer＋DLR 2019 GeoJSON＋DCC shapefile（ITM）→ 共用欄位；剔伐除、倒伏、殘株；PMTiles z4–14，z12 起點、之下熱區", note: "CC BY 4.0；只有都柏林 3/31 LA；不收調查人員姓名" },
  ieRadiationStations: { theme: "環境氣候", group: "環境污染", zh: "輻射監測站", alt: "Radiation Monitoring Stations", icon: Radiation, dataset: "ie_radiation_stations", topics: ["愛爾蘭", "輻射", "伽瑪劑量率", "環境輻射", "EPA"],
    description: "愛爾蘭 EPA 環境輻射監測站 41 站（陸地 26、其中即時 15；海域 15）", processing: "EPA WFS RAD_MONITORINGSTATION（MultiPoint 單點）→ PMTiles z4–14", note: "CC BY 4.0；只有站點與採樣項目、無量測值" },
  ieLandslideEvents: { theme: "災害", group: "崩塌 Landslide", zh: "崩塌事件（GSI）", alt: "Landslide Events (GSI)", icon: Mountain, dataset: "ie_landslide_events", topics: ["愛爾蘭", "崩塌", "山崩", "泥炭滑動", "GSI", "地質災害"],
    description: "愛爾蘭 GSI 國家崩塌資料庫事件點 2,779 筆（剔北愛 32；有日期 226）", processing: "GSI SHP zip（MapServer 不回幾何，Range 只取點檔）ITM → 4326；材料依原值合併 5 組；PMTiles z4–14", note: "CC BY 4.0（GSI 指定署名句）；材料分組為推定" },
  ieLandslideExtents: { theme: "災害", group: "崩塌 Landslide", zh: "崩塌範圍（GSI）", alt: "Landslide Extents (GSI)", icon: Mountain, dataset: "ie_landslide_extents", topics: ["愛爾蘭", "崩塌", "山崩", "GSI", "地質災害"],
    description: "愛爾蘭 GSI 判釋崩塌範圍 2,274 面（剔北愛 1）", processing: "GSI SHP zip ITM → 4326；面 PMTiles z8–14＋代表點（預設點）", note: "CC BY 4.0；與事件點無共用 ID" },
  ieRadonRisk: { theme: "災害", group: "地質災害", zh: "氡氣風險圖", alt: "Radon Risk Map", icon: Atom, dataset: "ie_radon_risk", topics: ["愛爾蘭", "氡氣", "輻射", "地質災害", "EPA", "住宅"],
    description: "愛爾蘭 EPA 氡氣風險圖三級：約 1／5（26,553 km²）、1／10（27,118 km²）、1／20（14,616 km²）住宅氡氣偏高", processing: "EPA WFS RadonRiskMapofIreland 68,007 面 → 依級 dissolve 51,861 面；PMTiles z4–11", note: "CC BY 4.0；模型預測；偏高門檻推定 200 Bq/m³" },
  // 第 6 波（2026-11-08）：能源（群組比照台灣、南韓、英國：電力 · 廠／電力 · 電網／再生能源／石化 · 加油站）
  iePowerPlants: { theme: "能源", group: "電力 · 廠", zh: "電廠與能源業設施", alt: "Power Plants & Energy Facilities", icon: Factory, dataset: "ie_power_plants", topics: ["愛爾蘭", "能源", "電廠", "發電", "PRTR", "EPA", "Tailte", "資料中心"],
    description: "愛爾蘭主要電廠 15 座（Tailte 250k）＋EPA PRTR 能源業設施另成點 29（發電 9、資料中心自備燃燒機組 15、煉油與天然氣處理 2、工業鍋爐 3）", processing: "Tailte Power Plant 250K FeatureServer＋EPA GeoServer WFS PRTR_Energy_sector；PRTR 依名稱分類，同站 14 筆（1.5 km 內）併入 Tailte 電廠；PMTiles z4–14", note: "CC BY 4.0；無燃料別與裝置容量；最近申報年早於 2020 者可能已停運" },
  iePowerLines: { theme: "能源", group: "電力 · 電網", zh: "輸電線", alt: "Power Lines", icon: Cable, dataset: "ie_power_lines", topics: ["愛爾蘭", "能源", "電網", "輸電線", "高壓電", "EirGrid", "OSM"],
    description: "愛爾蘭輸電線 2,383 段（400 kV 約 470 km、220 kV 1,841 km、110 kV 5,140 km；OSM）", processing: "Geofabrik PBF 2026-11-05 本地抽取 power=line 全部＋110 kV 以上 power=cable；中點剔北愛；PMTiles z4–13", note: "ODbL 1.0（© OpenStreetMap contributors）；EirGrid／ESB 無開放 GIS；跨境聯絡線與海纜未涵蓋" },
  ieSubstations: { theme: "能源", group: "電力 · 電網", zh: "變電站", alt: "Substations", icon: Zap, dataset: "ie_substations", topics: ["愛爾蘭", "能源", "電網", "變電站", "OSM"],
    description: "愛爾蘭變電站 1,177 處（400 kV 5、220 kV 54、110 kV 267、38 kV 573；OSM）", processing: "Geofabrik PBF 2026-11-05 本地抽取 power=substation 點、封閉 way、multipolygon（面取代表點）；剔北愛 551；PMTiles z4–14", note: "ODbL 1.0（© OpenStreetMap contributors）；無容量與承載" },
  ieWindFarms: { theme: "能源", group: "再生能源", zh: "陸域風場", alt: "Wind Farms", icon: Wind, dataset: "ie_wind_farms", topics: ["愛爾蘭", "能源", "再生能源", "風電", "風場", "SEAI"],
    description: "愛爾蘭風場 313 座（MEC 合計 4,304 MW；SEAI 2022-06）", processing: "SEAI WindFarmsJune2022_ITM.zip（ITM）→ 4326；依 MEC 分 4 級；PMTiles z4–14", note: "CC BY 4.0；點位是接入變電站不是風機；2022-06 後的風場未收（STALE）" },
  ieEvCharging: { theme: "能源", group: "再生能源", zh: "電動車充電站（ESB ecars）", alt: "EV Charging (ESB ecars)", icon: PlugZap, dataset: "ie_ev_charging", topics: ["愛爾蘭", "能源", "電動車", "充電站", "ESB"],
    description: "愛爾蘭 ESB ecars 公共充電站 440 處（充電樁 520；≥150 kW 43、43–149 kW 98、≤22 kW 299）", processing: "ESB its-data-ecars-sites-roi-ni.csv 只取 Territory=RoI（剔北愛 151）；功率欄取最大值分級；PMTiles z4–14", note: "CC BY 4.0；2024-12 快照；只有 ESB 網路" },
  ieFuelStations: { theme: "能源", group: "石化 · 加油站", zh: "加油站", alt: "Fuel Stations", icon: Fuel, dataset: "ie_fuel_stations", topics: ["愛爾蘭", "能源", "加油站", "OSM", "Circle K", "Applegreen"],
    description: "愛爾蘭加油站 1,687 站（Circle K 319、Top 202、Applegreen 162、Texaco 151、Maxol 134；OSM）", processing: "Geofabrik PBF 2026-11-05 本地抽取 amenity=fuel 點與面（面內重複點合併 25）；剔北愛 535；PMTiles z4–14", note: "ODbL 1.0（© OpenStreetMap contributors）；無官方名冊；品牌照 OSM 原文" },
  // 第 7a 波（2026-11-08）：教育（主題比照台灣：學校、幼托在「教育」；規劃區另開群組、不叫學區）
  ieSchools: { theme: "教育", group: "學校 Schools", zh: "學校", alt: "Schools", icon: School, dataset: "ie_schools", topics: ["愛爾蘭", "學校", "教育", "國小", "中學", "特殊學校", "大學", "DEIS"],
    description: "愛爾蘭學校 4,150 點：教育部 2026 名冊 3,927 校（國小 3,062、中學 720、特殊 145）＋OSM 大專 223（大學與校區 85、學院／繼續教育 138）", processing: "DoE Schools_Map_WFL1 FeatureServer（剔缺座標 11；不收校長、Email、電話、地址）＋OSM amenity=university／college（面取代表點、同名合併、與教育部同名或 150 m 內不收）；PMTiles z4–14", note: "教育部名冊授權未標示（授權待確認）；大專點 ODbL" },
  ieSchoolPlanningAreas: { theme: "教育", group: "學校規劃區", zh: "學校規劃區", alt: "School Planning Areas", icon: Map, dataset: "ie_school_planning_areas", topics: ["愛爾蘭", "學校規劃區", "教育", "規劃", "學校"],
    description: "愛爾蘭教育部學校規劃區 314 區（2011 年版、不分學段；不是入學學區），附 2026 區內校數與在學人數", processing: "DoE School_Planning_Areas_2011_Map_Viewer FeatureServer → 4326；以學校名冊規劃區欄彙總校數；PMTiles z4–13，z9 起填色", note: "CC BY 4.0；家長偏好調查欄未收" },
  ieChildcareServices: { theme: "教育", group: "幼托補習 Childcare & Cram", zh: "早期教保服務（托育）", alt: "Early Learning & Care Services", icon: Baby, dataset: "ie_childcare_services", topics: ["愛爾蘭", "托育", "托兒所", "學前教育", "課後照顧", "Pobal", "ECCE"],
    description: "愛爾蘭 Pobal 早期教保服務點 5,071（私人 3,895、社區 1,176；含課後照顧）", processing: "Pobal Childcare_Facilities_NEW FeatureServer/2（剔缺座標 4；不收 email、電話；個人姓名的服務名稱與 Eircode 不收）；PMTiles z4–14", note: "授權未標示（授權待確認）；補助旗標語意推定" },
  // 第 8 波（2026-11-08）：文化遺產與生活據點（主題比照台灣 tourHeritage、culturalMuseums、performingVenues、religionChurches、publicLibraries）
  ieHeritageSites: { theme: "觀光", group: "玩・人文 Heritage", zh: "文化資產（考古遺址、建築遺產）", alt: "Heritage Sites", icon: Castle, dataset: "ie_heritage_sites", topics: ["愛爾蘭", "文化資產", "考古", "古蹟", "SMR", "NIAH", "城堡", "環形堡", "建築遺產"],
    description: "愛爾蘭文化資產 179,916 點：SMR 考古遺址 131,492（環形堡與圍場 50,147、史前 24,053、聚落 17,891、教會遺址 14,516…）＋NIAH 建築遺產 48,324＋開放參觀國家古蹟 100", processing: "NMS SMROpenData（ITM_E>0；排除墓地三類與聖井、與開放參觀古蹟同編號 94 筆）、NIAHBuildingsOpenData、NMSMonumentsToVisit FeatureServer；SMR 470 類依前綴歸 7 組；不收 NIAH 門牌與描述長文；PMTiles z4–11 只帶類別、z12–14 全欄（38.7MB 走 S3）", note: "CC BY 4.0；分組為本站推定；點位是中心點" },
  ieMuseums: { theme: "文化", group: "設施 Facilities", zh: "博物館、典藏與檔案館", alt: "Museums, Collections & Archives", icon: Landmark, dataset: "ie_museums", topics: ["愛爾蘭", "博物館", "文化設施", "檔案館", "遊客中心", "Heritage Council"],
    description: "愛爾蘭 Heritage Council 博物館、典藏與檔案館 523 處（2015 年版；地方政府博物館 12）", processing: "Museums, Collections and Archives 2015 CSV（ITM→4326，剔北愛 64、無座標 63）＋LAMN 比對；不收電話、Email、街道地址、介紹長文；類型依名稱推定；PMTiles z4–14", note: "CC BY 4.0；名冊停在 2015 年" },
  ieArtsVenues: { theme: "文化", group: "藝文活動 Arts & Events", zh: "藝文場館", alt: "Arts Venues", icon: Theater, dataset: "ie_arts_venues", topics: ["愛爾蘭", "藝文", "劇場", "音樂廳", "藝術中心", "表演場館"],
    description: "愛爾蘭 6 個地方政府的藝文場館 84 處（劇場 29、藝術中心 20、音樂 18、視覺藝術 11）", processing: "Dublin City、DLR（兩份）、Fingal、South Dublin（圖書館 7 筆不收）、Galway City、Roscommon 議會名冊；同名 150 m 內去重 2；類型依議會類型欄與名稱推定；PMTiles z4–14", note: "CC BY 4.0；只涵蓋 6/31 地方政府" },
  iePublicFacilities: { theme: "基礎建設", group: "公共設施", zh: "圖書館、社區中心與公廁", alt: "Libraries, Community Centres & Public Toilets", icon: Library, dataset: "ie_public_facilities", topics: ["愛爾蘭", "圖書館", "社區中心", "公廁", "公共設施", "OSM"],
    description: "愛爾蘭圖書館 381、社區中心 1,447、公廁 1,252（議會名冊 428＋OSM 2,652）", processing: "11 個議會圖書館、5 個議會社區中心、3 個議會公廁名冊（修正經緯度互換與 3857 幾何）＋Geofabrik PBF 2026-11-05 amenity=library／community_centre／toilets（同類議會點 150 m 內不收、非公開公廁不收）；PMTiles z4–14", note: "CC BY 4.0（South Dublin 社區中心 CC0）＋ODbL；議會名冊只涵蓋部分地方政府" },
  ieReligiousSites: { theme: "宗教", group: "點位", zh: "禮拜建築與聖井", alt: "Places of Worship & Holy Wells", icon: Church, dataset: "ie_religious_sites", topics: ["愛爾蘭", "宗教", "教堂", "主教座堂", "聖井", "NIAH", "SMR"],
    description: "愛爾蘭 NIAH 禮拜建築 3,224 棟（教堂 3,140、主教座堂 43、會堂與祈禱所 41）＋SMR 聖井 2,726", processing: "NIAHBuildingsOpenData 原始用途為禮拜建築者（本地篩選）＋SMROpenData Ritual site - holy well（ITM_E>0）；教派依名稱推定；PMTiles z4–14", note: "CC BY 4.0；不是現用禮拜場所全貌" },
  // 第 7b 波（2026-11-08）：醫療照護、消防警政、司法（主題與群組比照英國、南韓：社福長照 › 住宿照顧、醫療 › 點位、消防 › 點位、執法治安 › 警政／司法矯正）
  ieHealthFacilities: { theme: "醫療", group: "點位", zh: "醫療院所", alt: "Health Facilities", icon: Hospital, dataset: "ie_health_facilities", topics: ["愛爾蘭", "醫療", "醫院", "診所", "GP", "牙醫", "藥局", "OSM"],
    description: "愛爾蘭醫療院所 3,482 處（藥局 1,493、GP 649、診所 565、牙醫 564、醫院 211；OSM）", processing: "Geofabrik PBF 2026-11-05 本地抽取 amenity=hospital／clinic／doctors／dentist／pharmacy 點與面（面內重複點合併 59）；剔北愛 568；PMTiles z4–14", note: "ODbL 1.0（© OpenStreetMap contributors）；HSE 官方名冊已下架；完整度依 OSM 貢獻" },
  ieCareHomes: { theme: "社福長照", group: "住宿照顧", zh: "HIQA 老人照護機構", alt: "Care Homes (HIQA)", icon: BedDouble, dataset: "ie_care_homes", topics: ["愛爾蘭", "長照", "護理之家", "老人照護", "HIQA", "nursing home"],
    description: "愛爾蘭 HIQA 老人照護指定機構 535 家（名冊 547；核定床位 31,980；HSE 111、其他 424；地址經 Nominatim 推估，12 家查無未上圖）", processing: "HIQA older_persons_register.csv 地址（去 Eircode）→ OSM Nominatim（≤1 次／秒，快取）；精度依回應判定；失敗與郡級不上圖；個資欄不收；PMTiles z4–14", note: "授權待確認（HIQA 未標示）；座標為 Nominatim 推估（ODbL）" },
  ieFireStations: { theme: "消防", group: "點位", zh: "消防站", alt: "Fire Stations", icon: Siren, dataset: "ie_fire_stations", topics: ["愛爾蘭", "消防", "消防站", "Dublin Fire Brigade", "OSM"],
    description: "愛爾蘭消防站 226 站（地方議會官方 42、OSM 補缺 184）", processing: "DFB 2025＋Fingal＋DLR＋Cork City＋Kildare＋Wicklow＋Roscommon 官方點位（300 m 內同站去重）＋Geofabrik OSM amenity=fire_station（距官方 300 m 內捨去）；剔北愛；PMTiles z4–14", note: "CC BY 4.0（官方）＋ODbL 1.0（OSM）；官方只涵蓋約 8/31 地方政府" },
  ieGardaStations: { theme: "執法治安", group: "警政", zh: "Garda 警察站", alt: "Garda Stations", icon: ShieldCheck, dataset: "ie_garda_stations", topics: ["愛爾蘭", "警察", "Garda", "警察局", "治安"],
    description: "愛爾蘭 Garda 警察站 536 站（CSO 名冊 564；官方座標 56、Nominatim 推估 480；28 站查無未上圖）", processing: "CSO CJA11 Garda Station 維度 564 站；DCC／Fingal／DLR／Cork City 官方座標依同郡站名對應；其餘以 OSM Nominatim（≤1 次／秒，快取）查站名＋郡；失敗與郡級不上圖；PMTiles z4–14", note: "CC BY 4.0（CSO、議會）＋ODbL（Nominatim 推估座標）" },
  ieCourts: { theme: "執法治安", group: "司法矯正", zh: "法院", alt: "Courthouses", icon: Gavel, dataset: "ie_courts", topics: ["愛爾蘭", "法院", "司法", "Courts Service"],
    description: "愛爾蘭 Courts Service 法院辦公處 94 處（26 郡；Dublin 16、Western 29、Southern 26、North Midlands 12、Eastern 11）", processing: "Courts Service court-offices.json（自帶 WGS84）；只收 active；PMTiles z4–14", note: "CC BY 4.0；不含監獄與管轄區邊界" },
  // 第 10 波（2026-11-08）：工商與農業（主題與群組比照英國：工商登記 › 製造業、農業 › 養殖漁業 Aquaculture／土壤）
  ieIndustrialFacilities: { theme: "工商登記", group: "製造業", zh: "EPA 持照工業設施", alt: "EPA-licensed Industrial Facilities", icon: Factory, dataset: "ie_industrial_facilities", topics: ["愛爾蘭", "工廠", "製造業", "EPA", "工業排放", "IPPC", "畜牧"],
    description: "愛爾蘭 EPA 持照工業設施 1,005 處（IE 執照 842＋舊制 IPPC 163；集約畜牧 341、廢棄物 124、食品飲料 104、化學 75、能源 71；未標類別 209）", processing: "EPA GeoServer WFS LEMA_Facilities_IEL＋IPPC_LicFacilities（RegCD 去重、IE 優先、不收 Surrendered）；活動代碼對 EPA Act First Schedule 大類；個人姓名的名稱與地址不輸出；PMTiles z4–14", note: "CC BY 4.0；不是全量工廠登記" },
  ieSoils: { theme: "農業", group: "土壤", zh: "全國土壤圖（SIS 1:250k）", alt: "National Soil Map (SIS 1:250k)", icon: Layers, dataset: "ie_soils", topics: ["愛爾蘭", "土壤", "Teagasc", "SIS", "泥炭", "排水"],
    description: "愛爾蘭 Teagasc／EPA 土壤資訊系統 1:250,000 全國土壤圖 25,143 面（泥炭 175 萬 ha、棕壤 148 萬 ha、淋溶土 115 萬 ha、潛育土 99 萬 ha）", processing: "EPA GeoServer WFS SOIL_SISNationalSoils（EPSG:4326 輸出）；PlainEnglish 19 類合併成 11 組；PMTiles z4–12（27.3MB，S3）", note: "CC BY 4.0；2014 完成不再更新；無肥力與適栽" },
  iePeatSoils: { theme: "農業", group: "土壤", zh: "泥炭土壤圖（TCD 2024）", alt: "Peat Soils Map (TCD 2024)", icon: Sprout, dataset: "ie_peat_soils", topics: ["愛爾蘭", "泥炭", "泥炭沼", "bog", "土壤", "TCD"],
    description: "愛爾蘭泥炭土壤圖 2024：5 類共約 163.6 萬 ha（其他泥炭 56.4 萬、低地毯狀沼 40.1 萬、山地毯狀沼 35.8 萬、高位沼 30.8 萬、低位沼 0.4 萬 ha）", processing: "OSF IPSM_soiltype.shp（TM65 改指定 EPSG:29902）；拆單面、去 <1 ha 碎塊；PMTiles z4–12", note: "CC BY 4.0（data.gov.ie 標示）；模型推定，100 m 網格" },
  ieAquaculture: { theme: "農業", group: "養殖漁業 Aquaculture", zh: "持照養殖場與法定漁港中心", alt: "Licensed Aquaculture Sites & Fishery Harbour Centres", icon: Fish, dataset: "ie_aquaculture", topics: ["愛爾蘭", "養殖", "牡蠣", "貽貝", "鮭魚", "漁港", "Aquamis"],
    description: "愛爾蘭 Aquamis 持照養殖場 1,061 處（貝類 929、魚類 90、藻類 16、棘皮 2、混養 24）＋法定漁港中心 6 處", processing: "Aquamis_Production_View_Public FeatureServer（outSR=4326）＋atlas.marine.ie Fishery_Harbours_Centres（WKT）；個人持照人姓名不輸出；面 PMTiles z6–14＋代表點 z4–14", note: "CC BY 4.0；一般漁港未涵蓋" },
  // 第 9 波（2026-11-08）：規劃與環境（分區、規劃申請比照台灣「底圖 › 土地使用分區 Zoning」；噪音、PRTR 比照英國 gbNoise／gbPollutionInventory；廢棄物比照英國 gbRecyclingCentres／gbWastePermits）
  ieZoning: { theme: "底圖", group: "土地使用分區 Zoning", zh: "土地使用分區", alt: "Land-use Zoning", icon: LayoutGrid, dataset: "ie_zoning", topics: ["愛爾蘭", "土地使用分區", "分區", "都市計畫", "MyPlan", "zoning"],
    description: "愛爾蘭 MyPlan 一般化分區 86,678 面（30/31 個地方政府、336 份現行計畫；住宅 37,377、綠地 26,901、混合 7,864、社區 4,990、商業 4,650、初級產業 2,266、網絡 1,695、其他 935）", processing: "GZT_Current_Plan FeatureServer（伺服器端 maxAllowableOffset 約 0.5 m、outSR 4326）；make_valid 修 375 面、刪空幾何 8；GZT 首字母歸 8 大類；面 z9–14、代表點 z4–14", note: "CC BY 4.0；一般化分類、非法定定義；Donegal 未涵蓋" },
  iePlanningApplications: { theme: "底圖", group: "土地使用分區 Zoning", zh: "規劃申請案", alt: "Planning Applications", icon: Hammer, dataset: "ie_planning_applications", topics: ["愛爾蘭", "規劃申請", "建築許可", "planning permission", "開發"],
    description: "愛爾蘭全國規劃申請案 511,576 件（核准 346,416、不受理 70,411、駁回 50,487、撤回 25,622、其他 17,395、部分核准 1,245；31 個規劃機關）", processing: "IrishPlanningApplications FeatureServer 依 OBJECTID 分頁（outSR 4326）；申請人、開發地址、開發說明不收；決定 150+ 種寫法依關鍵字歸 6 類；低縮放 z4–11 只帶類別、z12–14 全欄", note: "CC BY 4.0；各議會收錄年份不同；個人資料欄不收" },
  ieNoiseMaps: { theme: "環境氣候", group: "噪音／聲響 Noise", zh: "策略噪音地圖", alt: "Strategic Noise Maps", icon: Volume2, dataset: "ie_noise_maps", topics: ["愛爾蘭", "噪音", "Lden", "Lnight", "道路噪音", "機場噪音", "EPA"],
    description: "愛爾蘭 EPA 策略噪音地圖第 4 輪（2022）：道路、鐵路、機場、工業 × 全日 Lden／夜間 Lnight；全日 353 面、夜間 403 面（依地方政府 × 5 dB 帶）", processing: "EPA GeoServer WFS 14 層依地方政府分批下載（EPSG:29902）、2 m 容差簡化後轉 WGS84；Dublin 機場在都會區層與全國層重複，只留全國層；Lden、Lnight 各一支 PMTiles z5–12", note: "CC BY 4.0；只涵蓋都會區與主要道路、鐵路、機場周邊；模擬值" },
  ieRecyclingPoints: { theme: "廢棄物", group: "投放點", zh: "回收點", alt: "Recycling Points", icon: Recycle, dataset: "ie_recycling_points", topics: ["愛爾蘭", "回收", "回收桶", "bring bank", "回收中心", "WEEE"],
    description: "愛爾蘭回收點 2,026 處（回收桶站 1,751、回收中心 212、廢電器回收點 63；議會名冊 528＋OSM 1,498）", processing: "10 個議會名冊（shp／kml／csv／geojson）＋Geofabrik PBF 2026-11-05 amenity=recycling（同類官方點 150 m 內不收、private 不收）；電話、電子郵件、Eircode 不收；PMTiles z4–14", note: "CC BY 4.0＋ODbL 1.0；官方只涵蓋 10/31 地方政府" },
  ieWasteFacilities: { theme: "廢棄物", group: "處理設施", zh: "廢棄物許可設施", alt: "Licensed Waste Facilities", icon: Trash2, dataset: "ie_waste_facilities", topics: ["愛爾蘭", "廢棄物", "掩埋場", "轉運站", "EPA", "waste licence"],
    description: "愛爾蘭 EPA 廢棄物許可設施邊界 292 處（掩埋場 76、轉運站 63、資源回收分選 19、堆肥 19、綜合 15、土石 24、有害 20、其他 6、未分類 50）", processing: "EPA WFS WASTE_Boundary；50 處無屬性者以 LEMA_Facilities_Waste 補名 28；聯絡人、電話、稽查員不收，個人營運者不顯示；面＋代表點 z4–14", note: "CC BY 4.0；地方政府核發的許可與登記證未涵蓋" },
  iePrtrFacilities: { theme: "環境氣候", group: "環境污染", zh: "PRTR 申報設施", alt: "PRTR Facilities", icon: Factory, dataset: "ie_prtr_facilities", topics: ["愛爾蘭", "PRTR", "污染排放", "工業排放", "EPA", "IED"],
    description: "愛爾蘭 EPA PRTR 全部門設施 656 處（廢棄物與污水 165、畜牧 134、食品 96、化學 92、礦物 53、能源 43、金屬 31、其他 26、紙木 16）", processing: "EPA WFS All_PRTR_Sectors；重複登記號去 2；集約畜牧個人姓名 49 處不顯示；PMTiles z4–14", note: "CC BY 4.0；不含排放量" },
  // 第 11 波（2026-11-10）：IEADD-1 補做（主題沿用既有：醫療、執法治安、環境氣候、災害、農業）
  ieDefibrillators: { theme: "醫療", group: "點位", zh: "AED 自動體外心臟去顫器", alt: "AEDs (Defibrillators)", icon: HeartPulse, dataset: "ie_defibrillators", topics: ["愛爾蘭", "AED", "去顫器", "急救", "心臟", "OSM"],
    description: "愛爾蘭 OpenStreetMap 標記的 AED 2,463 台（公開可用 1,182、限顧客或員工 246、未標示 1,035；剔除北愛 340）", processing: "Geofabrik PBF 261105 points emergency=defibrillator；剔北愛；不收電話與聯絡人，像個人姓名的管理單位不顯示；PMTiles z4–14", note: "ODbL 1.0；NAS 官方登記冊不公開，非全部" },
  iePrisons: { theme: "執法治安", group: "司法矯正", zh: "監獄", alt: "Prisons", icon: Lock, dataset: "ie_prisons", topics: ["愛爾蘭", "監獄", "矯正", "Irish Prison Service", "OSM"],
    description: "愛爾蘭監獄 11 處（OpenStreetMap；Irish Prison Service 12 處，Wheatfield 與 Cloverhill 同一個面）", processing: "Geofabrik PBF 261105 multipolygons amenity=prison → 代表點；剔北愛 4；PMTiles z4–14", note: "ODbL 1.0；IPS 無開放點位" },
  ieProposedNha: { theme: "環境氣候", group: "保護區", zh: "提議中自然遺產區（pNHA）", alt: "Proposed Natural Heritage Areas (pNHA)", icon: Leaf, dataset: "ie_proposed_nha", topics: ["愛爾蘭", "保護區", "pNHA", "自然遺產", "生態", "NPWS"],
    description: "愛爾蘭 NPWS 提議中自然遺產區 1,089 處、1,180 面（約 84.5 萬公頃，含與 SAC／SPA 重疊部分）", processing: "NPWSDesignatedAreas FeatureServer layer 1 → 4326；面 PMTiles z4–13＋代表點（預設點）", note: "CC BY 4.0；1995 年公布、未完成法定指定" },
  ieFloodZones: { theme: "災害", group: "淹水", zh: "郡議會淹水分區 Flood Zone A／B", alt: "Council Flood Zones A/B", icon: Droplets, dataset: "ie_flood_zones", topics: ["愛爾蘭", "淹水", "Flood Zone", "SFRA", "發展計畫", "Cork", "Galway", "Roscommon", "Wicklow"],
    description: "愛爾蘭 4 個郡議會發展計畫的 Flood Zone A／B（Cork County、Galway County、Roscommon、Wicklow；只涵蓋 4/31 地方政府）", processing: "各郡 ArcGIS FeatureServer（CDP／LAP SFRA）→ 4326；Cork 網格碎片依分區合併相鄰碎片；面 PMTiles z5–14＋代表點（預設點）", note: "CC BY 4.0；各郡方法不一，非全國" },
  ieGroundwaterFlooding: { theme: "災害", group: "淹水", zh: "地下水淹水圖（GSI）", alt: "Groundwater Flood Maps (GSI)", icon: CloudRain, dataset: "ie_groundwater_flooding", topics: ["愛爾蘭", "淹水", "地下水", "喀斯特", "turlough", "GSI"],
    description: "愛爾蘭 GSI 地下水淹水圖 1:20,000：高／中／低機率（554／485／466 面）、歷史最大範圍 3,598 面、2015/16 冬季地表水 15,967 面", processing: "GSI 下載 shapefile（IE26）→ 4326，原樣不改屬性（ID 統一為字串）；一產品一支 PMTiles z5–13，圖層設定切換產品換檔；北愛 1 面整面捨去", note: "CC BY-NC-ND 4.0（非商業使用、原樣未改作）；只涵蓋喀斯特低地" },
  iePeatExtractionBogs: { theme: "農業", group: "土壤", zh: "Bord na Móna 泥炭開採沼地", alt: "Bord na Móna Peat Extraction Bogs", icon: Shovel, dataset: "ie_peat_extraction_bogs", topics: ["愛爾蘭", "泥炭", "泥炭沼", "bog", "Bord na Móna", "EPA", "開採"],
    description: "愛爾蘭 EPA 登錄的 Bord na Móna 持照泥炭開採沼地 162 面、約 7.9 萬公頃（13 個地方政府）", processing: "EPA GeoServer WFS BORDNAMONA_BOGBOUNDARIES（4326 輸出）；面 PMTiles z4–14＋代表點（預設點）", note: "授權未標示（照常上線、標來源 EPA）；執照範圍，2021 起已停採" },
};

const IE_DATA_MANIFEST_ENTRIES = Object.fromEntries(IE_DATA_SPECS.map((spec) => {
  const m = IE_DATA_ENTRY_META[spec.key];
  const isPoint = spec.geom === "point";
  return [spec.key, {
    key: spec.key,
    country: "IE", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `useKrDataLayer（IE 規格）自建 mapbox-pmtiles source；source-layer=${spec.sourceLayer}，source z${spec.srcMinzoom}–${spec.srcMaxzoom}、layer minzoom=${spec.minzoom}`, staticAssets: spec.key === "ieRiverFloodExtents" ? IE_FLOOD_SCENARIOS.map((x) => `./world/${ieFloodScenarioFile(x.value)}`) : spec.key === "ieNoiseMaps" ? IE_NOISE_METRICS.map((x) => `./world/${ieNoiseMetricFile(x.value)}`) : spec.key === "ieGroundwaterFlooding" ? IE_GW_FLOOD_PRODUCTS.map((x) => `./world/${ieGwFloodFile(x.value)}`) : [`./world/${spec.file}`] },
    legend: spec.key,
    popup: spec.key,
    params: (() => {
      const rep = repPointLayer(spec.key);
      const kinds = [...(rep || spec.key === "ieRiverFloodExtents" || spec.key === "ieNoiseMaps" || spec.key === "ieGroundwaterFlooding" ? ["select"] : []), ...(spec.cats ? ["multiSelect"] : []), ...(spec.heat ? ["palette"] : []), ...(isPoint ? ["slider", "slider"] : ["slider"]),
        ...(rep && repPointDense(rep) ? ["palette"] : []), ...(rep ? ["slider"] : [])] as ("select" | "multiSelect" | "palette" | "slider")[];
      return { count: kinds.length, kinds };
    })(),
    description: m.description,
    topics: m.topics,
  }];
})) as Record<IeDataKey, LayerManifestEntry>;


export const IE_PACK_MANIFEST = {
  ...IE_DATA_MANIFEST_ENTRIES,
  // ══════════════════════════════════════════════════════════════
  // 🇮🇪 愛爾蘭 Ireland（2026-11-07 第 0 波：C001 行政邊界）
  // ══════════════════════════════════════════════════════════════
  ieAdminBoundaries: {
    key: "ieAdminBoundaries",
    country: "IE", section: { theme: "底圖", group: "行政邊界" },
    ...layerName({ zh: "行政區界", alt: "Administrative Boundaries" }),
    expandable: true,
    color: "#9ca3af",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ie_admin_boundaries", confidence: "HIGH" }],
      processing: "Tailte Éireann Local Authorities 2026（9,161 碎片依 BDY_ID dissolve 成 31）＋CSO 2022 統計邊界 Electoral Division 3,420、Small Area 18,919；FeatureServer outSR 4326；人口 join Census 2022 SAPS（LA／ED／SA）；PMTiles tile layer la z3–10／ed z5–12／sa z6–13",
      note: "CC BY 4.0（© Tailte Éireann、© CSO）；26/26 郡、31/31 地方政府；北愛不在本層（屬英國）",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useIeAdminLayers 自建 mapbox-pmtiles source；source-layer=la／ed／sa（select 擇一）",
      staticAssets: ["./world/ie_admin_boundaries.pmtiles"],
    },
    legend: "ieAdminBoundaries",
    popup: "ieAdminBoundaries",
    params: { count: 2, kinds: ["slider", "select"] },
    description: "愛爾蘭行政區界（地方政府 31、CSO 選舉分區 3,420、統計小區 18,919；Tailte Éireann 2026／CSO Census 2022）",
    topics: ["愛爾蘭", "行政區", "邊界", "普查"],
  },
  // 🇮🇪 愛爾蘭第 1 波（2026-11-07）：海床地形 raster；其餘 6 層由 IE_DATA_MANIFEST_ENTRIES 派生
  ieBathymetry: {
    key: "ieBathymetry",
    country: "IE", section: { theme: "底圖", group: "地形" },
    ...layerName({ zh: "海床地形", alt: "Bathymetry", qualifier: "INFOMAR" }),
    expandable: true,
    color: "#2c7ab8",
    icon: Waves,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ie_bathymetry", confidence: "HIGH" }],
      processing: "GSI／Marine Institute INFOMAR 25 m 測深 ImageServer exportImage 取 0.003°（約 300 m）→ 10 段深度色階×山體陰影 → PNG raster PMTiles z4–10；陸地與無資料透明",
      note: "CC BY 4.0；只涵蓋愛爾蘭指定水域（英國水域來源即無資料）；沒有 feature 屬性與 popup；預設關閉",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useIeBathymetryLayer 自建 mapbox-pmtiles raster source（pmtilesRasterCustomSource）；minzoom=4 maxzoom=10，插在底圖第一個 symbol 下；26.5MB 走 S3 deploy-assets（gitignore）",
      staticAssets: ["./world/ie_bathymetry.pmtiles"],
    },
    legend: "ieBathymetry",
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "愛爾蘭海床地形（INFOMAR 測深，約 300 m；0–4,832 m 深度色階＋陰影）",
    topics: ["愛爾蘭", "底圖", "地形", "海床", "測深", "INFOMAR"],
  },
  // 🇮🇪 愛爾蘭第 5c 波（2026-11-08，站主限定）：Coillte 條款「僅限研究或私人學習、不得轉供他人、不得用於其他網站」，使用者 2026-11-07 拍板；
  // 資料只在 Supabase reference.world_ie_coillte_{recreation,forest_roads}，經 owner-only RPC 讀取（gis-platform mig 512）。規格 SSOT：data/ieCoillteTypes.ts
  ieCoillteRecreation: {
    key: "ieCoillteRecreation",
    country: "IE", section: { theme: "林業", group: "點位" },
    ...layerName({ zh: "國有林遊憩點與森林入口", alt: "Coillte Recreation Sites & Forest Entrances", qualifier: "Coillte" }),
    expandable: true,
    color: IE_COILLTE_RECREATION.color,
    icon: TreePine,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ie_coillte_recreation", confidence: "HIGH" }],
      processing: "analytics pipelines/forestry/ie/coillte/07_export.py：Coillte Recreation Information/0（multipoint 取第一點）153＋Access_App_Forest_Entrances/0 12,888 → gis-platform scripts/load_ie_coillte.py 匯入 Supabase；RPC get_ie_coillte_recreation 回 13,041 點",
      note: "Coillte item licenseInfo「not to copy, publish or use the data on another website」「research or private study」→ 站主限定，不進 public/、S3、R2、PMTiles、分析倉庫或任何公開網址；停車場、MTB 柱、森林公園未收",
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: IE_COILLTE_RECREATION.sourceId,
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "ieCoillteRecreation",
    popup: "ieCoillteRecreation",
    params: { count: 4, kinds: ["multiSelect", "palette", "slider", "slider"] },
    description: "站主限定。愛爾蘭國營林業公司 Coillte 遊憩點 153 處與森林入口 12,888 處；授權限私人研究，不公開",
    topics: ["愛爾蘭", "林業", "國有林", "森林遊憩", "Coillte", "OWNER_ONLY"],
  },
  ieCoillteForestRoads: {
    key: "ieCoillteForestRoads",
    country: "IE", section: { theme: "林業", group: "線" },
    ...layerName({ zh: "國有林林道與遊憩步道", alt: "Coillte Forest Roads & Recreation Trails", qualifier: "Coillte" }),
    expandable: true,
    color: IE_COILLTE_FOREST_ROADS.color,
    icon: Route,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ie_coillte_forest_roads", confidence: "HIGH" }],
      processing: "analytics pipelines/forestry/ie/coillte/07_export.py：Coillte_Forest_Road_Dataset/1 15,890（13 條無幾何剔除）＋Recreation Information/3 步道 1,199，約 5 m 簡化 → Supabase；RPC get_ie_coillte_forest_roads 依畫面 p_bbox 分批（z10 起；全 17,076 條整包約 7.9MB）",
      note: "Coillte item 條款同遊憩點 → 站主限定，不進任何公開檔；私有林林道未涵蓋",
    },
    dataClass: "C",
    source: {
      kind: "supabase",
      sourceId: IE_COILLTE_FOREST_ROADS.sourceId,
      fallbackUrl: "./geo/_empty.geojson",
    },
    legend: "ieCoillteForestRoads",
    popup: "ieCoillteForestRoads",
    params: { count: 2, kinds: ["multiSelect", "slider"] },
    description: "站主限定。愛爾蘭 Coillte 國有林林道 15,877 條與遊憩步道 1,199 條；授權限私人研究，不公開",
    topics: ["愛爾蘭", "林業", "林道", "步道", "Coillte", "OWNER_ONLY"],
  },
  // <codemod:append IE_PACK_MANIFEST>
} satisfies Record<Exclude<IeLayerKey, "statsIeAgeOldShareEd" | "statsIeAgeOldShareLa" | "statsIeAgeWorkingShareEd" | "statsIeAgeWorkingShareLa" | "statsIeAgeYoungShareEd" | "statsIeAgeYoungShareLa" | "statsIeAverageRentLa" | "statsIeDegreeShareEd" | "statsIeDegreeShareLa" | "statsIeEmploymentRateEd" | "statsIeEmploymentRateLa" | "statsIeHouseholdsEd" | "statsIeHouseholdsLa" | "statsIeOwnerOccupiedEd" | "statsIeOwnerOccupiedLa" | "statsIeParticipationRateEd" | "statsIeParticipationRateLa" | "statsIePopulationDensityEd" | "statsIePopulationDensityLa" | "statsIePopulationEd" | "statsIePopulationLa" | "statsIePrivateRentedEd" | "statsIePrivateRentedLa" | "statsIeSocialRentedEd" | "statsIeSocialRentedLa" | "statsIeUnemploymentRateEd" | "statsIeUnemploymentRateLa" | "statsIeUrbanShareEd" | "statsIeUrbanShareLa">, LayerManifestEntry>;
