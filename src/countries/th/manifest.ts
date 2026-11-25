// 泰國國家包：manifest.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { ThLayerKey } from "./keys";
import type { LayerManifestEntry } from "../../data/layerManifest";
import { layerName } from "../../data/layerManifest";
import { type ThDataKey, type ThRasterKey } from "./keys";
import { TH_DATA_SPECS } from "./thDataLayers";
import { TH_RASTER_SPECS } from "./thWavesLayers";
import { AlertTriangle, Anchor, Baby, BedDouble, Car, Castle, Church, Cloud, Droplet, Droplets, Factory, FerrisWheel, Flag, Footprints, Fuel, Gauge, Gavel, GraduationCap, House, Landmark, Leaf, Library, type LucideIcon, Mail, Map, MapPin, Mountain, Plane, Route, Siren, Spline, Sprout, Stethoscope, Store, Sun, Tent, Theater, TrainFront, Trash2, TreePine, Trees, Users, Waves, Wind, Zap } from "lucide-react";

/** 泰國第 1 波規格驅動 8 層（規格 SSOT 在 thDataLayers.ts；畫法重用 usePhDataLayer；主題與群組比照菲律賓、越南）。 */
const TH_DATA_ENTRY_META: Record<ThDataKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  thTransportHubs: { theme: "交通", group: "樞紐節點", zh: "機場、港口與渡輪碼頭", alt: "Airports, Ports & Ferry Terminals", icon: Plane, dataset: "th_transport_hubs", topics: ["泰國", "交通", "機場", "港口", "渡輪碼頭", "NGIS", "GISTDA", "OSM"],
    description: "泰國機場 144（NGIS L14、GISTDA Hosted，授權未明示；預設不顯示 51 筆無名機場）＋港口 38、渡輪碼頭 524（OpenStreetMap 補缺）", processing: "NGIS L14 與 GISTDA Airport 合併（座標距離配對）→ 4326；機場分類由名稱推定；HOT／HDX OSM 港口、渡輪碼頭補缺；77 府空間判定；PMTiles hubs z4–14", note: "機場授權未明示；港口與碼頭 ODbL；旅客數欄單位來源未標；無名機場前端預設濾掉" },
  thStations: { theme: "交通", group: "場站", zh: "鐵路、渡輪車站與公車站", alt: "Rail, Ferry & Bus Stops", icon: TrainFront, dataset: "th_stations", topics: ["泰國", "交通", "車站", "鐵路", "BTS", "MRT", "SRT", "渡輪", "公車", "Namtang"],
    description: "泰國鐵路與渡輪站 533（輕軌 BTS＋SRT 紅線、MRT、國鐵 SRT、渡輪碼頭）＋公車站 16,600（z11 起顯示）；OTP Namtang GTFS", processing: "OTP Namtang 全國 GTFS 靜態檔 stops → 依路線類型分 kind；Pakse（寮）站排除；77 府空間判定；PMTiles stations、bus_stops z4–14", note: "CC BY 4.0 僅見 Transitland 轉述；鐵路、渡輪站涵蓋 40/77 府；agency_name 不輸出" },
  thMajorRoads: { theme: "交通", group: "路網", zh: "國道與鐵道", alt: "Highways & Railways", icon: Route, dataset: "th_major_roads", topics: ["泰國", "交通", "道路", "國道", "高速公路", "鐵道", "DOH", "NGIS"],
    description: "泰國 DOH 國道 3,083 段（高速公路、國道、區域／府／縣級連結）＋鐵道 643 段（NGIS L02008）；授權未明示", processing: "DOH 路線中心線 BE 2568 → 4326；依 hierarchy 分 road_class；NGIS 鐵路中心線；線中點空間判定 77 府；PMTiles roads、rail z4–13", note: "授權未明示；只含 DOH 國道（無鄉道 DRR）；鐵道只有 47/77 府有線段、版本 BE 2554" },
  thPowerPlants: { theme: "能源", group: "電力 · 廠", zh: "電廠", alt: "Power Plants", icon: Factory, dataset: "th_power_plants", topics: ["泰國", "能源", "電廠", "發電", "太陽能", "水力", "DEDE", "GEM", "OSM"],
    description: "泰國電廠 1,367 處（DEDE 再生能源 1,076＋GEM 火力 91＋OSM 補缺 200；GEM 預設只顯示運轉中＋興建中；51 筆個人名義已遮蔽）", processing: "NGIS DEDE RE_Powerplant → 4326（個人名義記錄級遮蔽）；GEM Coal／Oil & Gas Plant Tracker 濾泰國；Overture 電廠補缺只取距官方點 >1.5 km；PMTiles plants z3–14", note: "逐筆授權：DEDE 未明示／GEM CC BY 4.0／OSM ODbL；EGAT 大水電靠 GEM／OSM；太陽能含屋頂型" },
  thPowerGrid: { theme: "能源", group: "電力 · 電網", zh: "輸電線與變電所", alt: "Power Lines & Substations", icon: Zap, dataset: "th_power_grid", topics: ["泰國", "能源", "電網", "輸電線", "變電所", "OSM", "Overture"],
    description: "泰國輸電線 1,524 段（依電壓分級）＋變電所 776 處（OpenStreetMap via Overture，非官方）", processing: "Overture base/infrastructure power_line／substation → 4326；依 voltage 最大值分 kv_class；PMTiles lines、substations z4–14", note: "ODbL 1.0；OSM 覆蓋不均，非官方電網圖" },
  thRenewables: { theme: "能源", group: "再生能源", zh: "風電與太陽能", alt: "Wind & Solar", icon: Sun, dataset: "th_renewables", topics: ["泰國", "能源", "再生能源", "風電", "太陽能", "地熱", "DEDE", "OSM"],
    description: "泰國風場 27、太陽能 562、地熱 1（DEDE，授權未明示）＋OSM 風機機組點 546（z9 起）；太陽能含屋頂型", processing: "NGIS DEDE RE_Powerplant type_code 1／6／8 與 Wind／Solar 子層對帳 → 4326；Overture generator（wind）補風機；PMTiles renewables z4–14", note: "DEDE 授權未明示、OSM ODbL；沒有點的府是未涵蓋，不是沒有" },
  thFuelStations: { theme: "能源", group: "石化 · 加油站", zh: "加油站", alt: "Fuel Stations", icon: Fuel, dataset: "th_fuel_stations", topics: ["泰國", "能源", "加油站", "Overture", "PTT", "Bangchak", "Shell"],
    description: "泰國加油站 14,838 處（Overture 補缺，非官方；PTT、Bangchak、Shell、Esso、Caltex、PT、Susco 分色）", processing: "Overture places taxonomy gas_station／fueling_station（confidence ≥0.5、泰國面內）→ 品牌正規化；PMTiles fuel z5–14", note: "CDLA-Permissive-2.0；筆數為登記數、可能含歇業" },
  thPipelines: { theme: "能源", group: "管線與儲槽", zh: "儲槽與管線", alt: "Storage Tanks & Pipelines", icon: Spline, dataset: "th_pipelines", topics: ["泰國", "能源", "儲槽", "管線", "LNG", "油氣", "GEM", "OSM"],
    description: "泰國儲槽 1,377、氣櫃 81、LNG 接收站 6（GEM）、管線 176 段；依內容物分油氣、水、污水、其他、未標示（預設只顯示油氣與 LNG）", processing: "Overture base/infrastructure storage_tank／gasometer／pipeline → 4326；GEM GGIT／GOIT 泰國列與 LNG Terminals；依 substance／content 分 content_group；PMTiles facilities、pipelines z5–14", note: "ODbL 1.0／CC BY 4.0（逐筆）；多數未標示內容物，不是油氣管線全圖；GEM 管線為示意路徑" },
  thPlaceNames: { theme: "底圖", group: "地名", zh: "聚落地名", alt: "Place Names", icon: MapPin, dataset: "th_place_names", topics: ["泰國", "底圖", "地名", "聚落", "村", "OSM"],
    description: "泰國 OSM 聚落地名 32,514 筆（城市 37、鎮 1,041、村 18,280、小聚落 4,211…；依等級逐級出現，低縮放只有城市）", processing: "HOT／HDX OSM 泰國 place 圖層 → 代表點；依 place 設 per-feature minzoom（city z4、town z6、village z8、hamlet z10）；77 府空間判定；PMTiles places z4–14（-r1）", note: "ODbL 1.0；OSM 聚落名稱，非官方村里名冊；三角點未涵蓋" },
  thElectionConstituencies: { theme: "人口社經", group: "選區", zh: "國會選區", alt: "Electoral Constituencies", icon: Landmark, dataset: "th_election_constituencies", topics: ["泰國", "選舉", "選區", "國會", "ECT"],
    description: "泰國國會小選區邊界兩版（2023 年 400 區、2026 年 400 區；預設 2026）；沒有得票與投票所", processing: "Thai-ECT-election-map（MIT，第三方鏡像；底層 กกต. 選區公告）→ 4326；77 府空間判定；PMTiles constituency_2566、constituency_2569 z4–12", note: "MIT（第三方鏡像），上游 ECT 條款未明示；得票、投票所未涵蓋" },
  thHighlandVillages: { theme: "人口社經", group: "高地村", zh: "高地村", alt: "Highland Villages", icon: Tent, dataset: "th_highland_villages", topics: ["泰國", "人口", "高地", "族群", "村", "HRDI"],
    description: "泰國高地村 4,212 點（HRDI；族群、人口、戶數、所在保護林；只涵蓋 21 個高地府）", processing: "HRDI 高地村調查（UTM 座標轉 4326；zone 推定）→ 77 府空間判定；族群前 7 名分色；PMTiles villages z5–14（-r1）", note: "授權未明示；調查年未標；只涵蓋 21/77 府" },
  thProvinceSocioeconomic: { theme: "人口社經", group: "府級社經", zh: "府級社經（Gini 與收入變動）", alt: "Province Socio-economics (Gini & Income Change)", icon: Gauge, dataset: "th_province_socioeconomic", topics: ["泰國", "社經", "Gini", "所得", "貧窮", "NSO"],
    description: "泰國 77 府 Gini 係數（2013–2023）與收入變動（2011–2025；來源未附定義）；圖例兩指標二選一，預設 Gini", processing: "NSO 府級表接 COD-AB 府面（NSO 表 3 個府名拼字更正）→ PMTiles province z3–10", note: "Creative Commons Attributions（版本未見）；只有府級；收入變動來源未附定義" },
  thFootbridges: { theme: "交通", group: "道路設施", zh: "人行天橋", alt: "Pedestrian Footbridges", icon: Footprints, dataset: "th_footbridges", topics: ["泰國", "交通", "人行天橋", "DOH"],
    description: "泰國國道上的人行天橋 2,147 座（DOH；76/77 府；鋼筋混凝土 2,055、全鋼 92）", processing: "DOH 人行天橋 API → 4326；77 府空間判定；PMTiles footbridges z6–14（-r1）", note: "授權未明示；人行天橋，不是公路橋（DRR 公路橋境外連不上）" },
  thRailCrossings: { theme: "交通", group: "道路設施", zh: "國道與鐵路交會處", alt: "Highway–Railway Crossings", icon: AlertTriangle, dataset: "th_rail_crossings", topics: ["泰國", "交通", "平交道", "鐵路", "DOH"],
    description: "泰國國道與鐵路交會處 290 處（同平面 171、立體 119；45/77 府）", processing: "DOH 國道鐵路交會處 API → 4326；PMTiles rail_crossings z6–14（-r1）", note: "授權未明示；只含國道交會處，非全國平交道" },
  thRoadAccidents: { theme: "交通", group: "交通事故", zh: "道路交通事故（2025）", alt: "Road Traffic Accidents (2025)", icon: Car, dataset: "th_road_accidents", topics: ["泰國", "交通", "事故", "死亡", "GISTDA"],
    description: "泰國 2025-01-01～12-12 道路事故 23,543 件（依死傷分 4 級；低縮放為熱區；不含個人可識別欄位）", processing: "GISTDA Hosted 事故點（來源 DOH／DRR／高速公路局）→ 4326；severity 依死亡、重傷、輕傷分級；PMTiles accidents z6–14（-r1）", note: "授權未明示；非全年；非 A1／A2 分級；169 筆無座標、3 筆在境外已排除" },
  thEec: { theme: "工商登記", group: "產業園區", zh: "東部經濟走廊 EEC", alt: "Eastern Economic Corridor (EEC)", icon: Factory, dataset: "th_eec", topics: ["泰國", "工業", "EEC", "經濟走廊", "GISTDA"],
    description: "泰國東部經濟走廊 EEC 3 府（Chon Buri、Rayong、Chachoengsao）邊界與 290 個鄉面；只涵蓋 3/77 府", processing: "GISTDA Hosted EEC 鄉面 → 4326；3 府邊界取 COD-AB 府面合併；PMTiles eec_tambon z6–13、eec_boundary z4–12", note: "授權未明示（鄉）／CC BY-IGO（邊界）；統計欄名被截斷、語意未驗，不顯示；SEZ 未涵蓋" },
  thFloodHistory: { theme: "災害", group: "淹水", zh: "歷史淹水範圍（2005–2012）", alt: "Historical Flood Extent (2005–2012)", icon: Waves, dataset: "th_flood_history", topics: ["泰國", "災害", "淹水", "歷史", "GISTDA"],
    description: "泰國 2005–2012 歷史淹水範圍 118,727 面（依淹水頻率 1–7 年分級；只涵蓋 16/77 府）", processing: "GISTDA Hosted 歷史淹水面（衛星判釋、一般化）→ 4326；77 府空間判定；PMTiles flood z6–12", note: "授權未明示；只涵蓋 16 府；頻率與逐年旗標加總不一致，popup 並列" },
  thBasins: { theme: "水資源", group: "流域", zh: "流域（DWR 25 主流域）", alt: "River Basins (DWR 25 Main Basins)", icon: Droplets, dataset: "th_basins", topics: ["泰國", "水資源", "流域", "DWR"],
    description: "泰國 DWR 25 主流域與 254 子流域（主流域各色、子流域邊界）；河線與水體面未涵蓋", processing: "NGIS DWR 流域面 → 4326；PMTiles main_basin z3–9、sub_basin z5–12", note: "授權未明示；DWR 25 流域與 ONWR 22 流域不同" },
  thIrrigationProjects: { theme: "水資源", group: "灌溉", zh: "灌溉專案", alt: "Irrigation Projects", icon: Droplet, dataset: "th_irrigation_projects", topics: ["泰國", "水資源", "灌溉", "水庫", "RID"],
    description: "泰國 RID 灌溉專案 796 處（水庫 409、堰 143、水門 88、抽水站 33…；設施類型由名稱推導；71/77 府）", processing: "NGIS RID 灌溉專案點 → 4326；依專案名稱推導 facility_type；PMTiles projects z5–14（-r1）", note: "授權未明示；設施類型為推導；專案面積單位來源未標" },
  thLandslideSafePoints: { theme: "災害", group: "避難場所", zh: "坍方臨時安全點", alt: "Landslide Temporary Safe Points", icon: House, dataset: "th_landslide_safe_points", topics: ["泰國", "災害", "坍方", "避難", "DMR"],
    description: "泰國 DMR 坍方臨時安全點 8,286 處（46/77 府）；崩塌潛勢面圖無可用幾何，未涵蓋", processing: "DMR 安全點 CSV（UTM 座標轉 4326）→ 77 府空間判定；PMTiles safe_points z6–14（-r1）", note: "Creative Commons Attributions（版本未標）；潛勢面圖未涵蓋" },
  thLandfills: { theme: "廢棄物", group: "垃圾場址", zh: "垃圾場址與處理設施", alt: "Landfills & Waste Facilities", icon: Trash2, dataset: "th_landfills", topics: ["泰國", "廢棄物", "垃圾場", "掩埋場", "焚化爐", "PCD", "GISTDA"],
    description: "泰國垃圾場址調查 3,129 處（開放傾倒場 2,893…）與 PCD 設施 2,609 處（兩份調查分開、不可相加；調查年約 2010–2014）", processing: "GISTDA Hosted 垃圾場址調查與 PCD 設施清單 → 4326；site_type 正規化；PMTiles landfill_survey、pcd_facilities z5–14（-r1）", note: "授權未明示；PCD 2566 新版連線失敗未納入；進場廢棄物量單位來源未標" },
  thSchools: { theme: "教育", group: "學校", zh: "學校（OBEC 名冊＋GISTDA 非 OBEC）", alt: "Schools", icon: GraduationCap, dataset: "th_schools", topics: ["泰國", "教育", "學校", "OBEC"],
    description: "泰國學校 41,443 處（OBEC 2563 學年名冊 29,641＋GISTDA 非 OBEC 11,802；低縮放熱區，z7 起個別點）", processing: "OBEC 名冊 API＋GISTDA School_new2 → 4326（OBEC 座標約 100 m）；PMTiles obec z7、other_departments z8（-r1）；不輸出電話、網站、地址", note: "Open Data Common（OBEC）；GISTDA 部分授權未明示；大專學生數、補習班未涵蓋" },
  thKindergartens: { theme: "教育", group: "幼兒教育", zh: "幼兒班與幼兒園", alt: "Kindergartens", icon: Baby, dataset: "th_kindergartens", topics: ["泰國", "教育", "幼兒園", "OBEC", "Overture"],
    description: "泰國幼兒班與幼兒園 31,403 處（OBEC 學校附設 26,418＋Overture 補缺 4,985；點位＝學校位置）", processing: "OBEC 附設班別 → 學校位置；Overture preschool／day_care；PMTiles obec_attached z7、overture z6（-r1）", note: "OGL（OBEC）／CDLA（Overture）；ศพด. 約 2 萬無座標未涵蓋" },
  thElderlyHousing: { theme: "社福長照", group: "長者住宿", zh: "長者住宿（Overture 補缺）", alt: "Elderly Housing (Overture)", icon: Users, dataset: "th_elderly_housing", topics: ["泰國", "社福", "長者", "養老院", "Overture"],
    description: "泰國長者住宿 733 處（Overture 補缺，完整度不明，非官方名冊）", processing: "Overture places retirement_home → 4326；PMTiles retirement_homes z5–14", note: "CDLA-Permissive-2.0；官方 DOP 名冊未涵蓋" },
  thHealthFacilities: { theme: "醫療", group: "點位", zh: "醫療院所", alt: "Health Facilities", icon: Stethoscope, dataset: "th_health_facilities", topics: ["泰國", "醫療", "醫院", "診所", "藥局", "GISTDA", "OSM"],
    description: "泰國醫療點 13,481（GISTDA POI 6,734＋OSM 補缺 6,747；兩來源不去重）", processing: "GISTDA Hospital_POI（名稱前綴推導 kind）＋OSM amenity 醫療類；PMTiles gistda_poi、osm_health z6–14（-r1）", note: "GISTDA 授權未明示＋ODbL；官方 hcode 名冊未取" },
  thPoliceStations: { theme: "執法治安", group: "警政", zh: "警察據點", alt: "Police Stations", icon: Siren, dataset: "th_police_stations", topics: ["泰國", "執法治安", "警察", "GISTDA", "Overture"],
    description: "泰國警察據點 4,707（GISTDA 1,399＋Overture 補缺 3,308；預設只顯示警察局）", processing: "GISTDA 12_police＋Overture police_station → unit_kind；PMTiles gistda、overture z5–14（-r1）", note: "GISTDA 授權未明示＋CDLA；RTP 全國名冊未涵蓋" },
  thJailsCourts: { theme: "執法治安", group: "司法矯正", zh: "監所與法院", alt: "Prisons & Courthouses", icon: Gavel, dataset: "th_jails_courts", topics: ["泰國", "執法治安", "監所", "法院", "DOC", "Overture"],
    description: "泰國監所 142（DOC 2021 版）＋法院 291（Overture 補缺，非 COJ 官方名冊）", processing: "DOC 監所清單（機關地址定位）＋Overture courthouse；PMTiles doc_prisons、overture_courthouse z5–14", note: "DOC 授權未明示＋CDLA；COJ 名單無座標" },
  thNatureSpots: { theme: "觀光", group: "玩・自然", zh: "自然景點（MOC＋OSM／Overture 補缺）", alt: "Nature Spots", icon: Mountain, dataset: "th_nature_spots", topics: ["泰國", "觀光", "景點", "瀑布", "洞穴", "海灘", "MOC", "OSM"],
    description: "泰國自然景點：MOC 官方 573＋OSM 景點與觀景點 5,895＋Overture 瀑布、洞穴、海灘 5,009（海灘預設不開）", processing: "MOC natural 圖層＋OSM tourism＋Overture 類別；PMTiles moc_natural z5、osm_attractions z7、overture_nature z9", note: "MOC CC BY（版本未標）／ODbL／CDLA；TAT 官方景點需登入未取" },
  thNationalReservedForests: { theme: "自然保育", group: "林地", zh: "國有保留林", alt: "National Reserved Forests", icon: Trees, dataset: "th_national_reserved_forests", topics: ["泰國", "自然保育", "保留林", "RFD"],
    description: "泰國國有保留林 1,221 塊（RFD；68/77 府；只有邊界）", processing: "NGIS／RFD 保留林面 → 4326；PMTiles nrf z4–12", note: "授權未明示；保留林地不全是水源保護；林型向量無" },
  thNationalParks: { theme: "自然保育", group: "保護區", zh: "國家公園與野生動物保護區", alt: "National Parks & Wildlife Sanctuaries", icon: Leaf, dataset: "th_national_parks", topics: ["泰國", "自然保育", "國家公園", "保護區", "DNP"],
    description: "泰國國家公園 126、野生動物保護區 58（DNP；含海域部分）", processing: "NGIS／DNP 面 → 4326；PMTiles national_park、wildlife_sanctuary z4–12", note: "授權未明示；非狩獵區、MPA 未涵蓋" },
  thRamsarSites: { theme: "自然保育", group: "濕地", zh: "拉姆薩濕地（代表點）", alt: "Ramsar Sites (Points)", icon: Droplets, dataset: "th_ramsar_sites", topics: ["泰國", "自然保育", "濕地", "Ramsar", "ONEP"],
    description: "泰國拉姆薩濕地 15 處代表點（沒有邊界；12/77 府）", processing: "ONEP Ramsar 名冊 → 代表點；PMTiles ramsar z3–14", note: "CC BY（版本未標）；邊界來源 WDPA 非商用不取" },
  thForestParks: { theme: "自然保育", group: "林地", zh: "森林公園", alt: "Forest Parks", icon: TreePine, dataset: "th_forest_parks", topics: ["泰國", "自然保育", "森林公園", "RFD"],
    description: "泰國森林公園 109 處（RFD；40/77 府；可能與保留林重疊）", processing: "NGIS／RFD 森林公園面 → 4326；PMTiles forest_parks z5–13", note: "授權未明示；未做重疊檢查" },
  thMuseumsLibraries: { theme: "文化", group: "文化設施", zh: "博物館與圖書館（MOC＋OSM 補缺）", alt: "Museums & Libraries", icon: Library, dataset: "th_museums_libraries", topics: ["泰國", "文化", "博物館", "圖書館", "MOC", "OSM"],
    description: "泰國博物館 503＋圖書館 319（MOC 官方）＋OSM 補缺 博物館 606、圖書館 306", processing: "MOC vw_* CSV（去 319 筆完全重複）＋OSM；PMTiles moc_museums、moc_libraries、osm_museums、osm_libraries z5–14", note: "MOC CC BY（版本未標）／ODbL；FAD、SAC 館所未涵蓋" },
  thArtsEvents: { theme: "文化", group: "藝文活動", zh: "藝文場館與歷史活動（2020–2022）", alt: "Arts Venues & Past Events (2020–2022)", icon: Theater, dataset: "th_arts_events", topics: ["泰國", "文化", "藝文", "活動", "劇場", "電影院", "MOC", "OSM"],
    description: "泰國藝文場館 254（OSM 補缺）＋MOC 歷史活動 1,114（2020–2022，非當前；預設隱藏）", processing: "MOC 活動表（府級定位）＋OSM theatre／cinema／arts_centre；PMTiles events z5、venues z6", note: "MOC CC BY（版本未標）／ODbL；活動只有 2020–2022" },
  thHistoricSites: { theme: "文化", group: "文化資產", zh: "古蹟（MOC＋OSM 補缺）", alt: "Historic Sites", icon: Castle, dataset: "th_historic_sites", topics: ["泰國", "文化", "古蹟", "歷史", "MOC", "OSM"],
    description: "泰國古蹟 MOC 1,855＋歷史公園 9＋OSM 補缺 4,442（排除路旁祠與界石）", processing: "MOC 古蹟與歷史公園＋OSM historic；PMTiles moc_parks z4、moc_sites z6、osm_historic z8", note: "MOC CC BY（版本未標）／ODbL；FAD 名冊未取" },
  thExperiences: { theme: "觀光", group: "玩・體驗", zh: "露營與遊樂園區（補缺）", alt: "Camps & Theme Parks (Gap-fill)", icon: FerrisWheel, dataset: "th_experiences", topics: ["泰國", "觀光", "露營", "遊樂園", "動物園", "OSM", "Overture"],
    description: "泰國露營地 569（OSM）＋遊樂園、水上樂園、動物園、水族館 1,127（Overture）；全為補缺", processing: "OSM camp_site＋Overture amusement_park／water_park／zoo／aquarium；PMTiles osm_camps、overture_attractions z6–14", note: "ODbL／CDLA；無官方名冊" },
  thAccommodation: { theme: "觀光", group: "住・食", zh: "住宿（TAT＋OSM 補缺，僅含有座標者）", alt: "Accommodation (with coordinates only)", icon: BedDouble, dataset: "th_accommodation", topics: ["泰國", "觀光", "住宿", "旅館", "TAT", "OSM"],
    description: "泰國住宿 26,417 處（TAT 名冊有座標者 9,309＋OSM 補缺 17,108；聯絡資訊不輸出）", processing: "TAT 住宿名冊（約 1/3 有座標；無座標列不 geocode）＋OSM tourism；PMTiles tat z7、osm z8（-r1）", note: "TAT Open Data Common／ODbL；Overture hotel 不取" },
  thBanks: { theme: "基礎建設", group: "金融據點", zh: "銀行與 ATM（補缺）", alt: "Banks & ATMs (Gap-fill)", icon: Landmark, dataset: "th_banks", topics: ["泰國", "基礎建設", "銀行", "ATM", "Overture", "OSM"],
    description: "泰國銀行分行 Overture 8,637＋OSM 2,644，ATM OSM 3,371（無官方名冊；ATM 預設不開）", processing: "Overture bank＋OSM amenity=bank／atm；PMTiles overture_banks z7、osm_banks z7、osm_atms z8（-r1）", note: "CDLA／ODbL；證券、保險、外幣經辦局未涵蓋" },
  thPlacesOfWorship: { theme: "宗教", group: "點位", zh: "宗教場所（MOC 名冊＋Overture／OSM 補缺）", alt: "Places of Worship (MOC + Overture/OSM gap-fill)", icon: Church, dataset: "th_places_of_worship", topics: ["泰國", "宗教", "寺院", "清真寺", "教堂", "MOC", "Overture", "OSM"],
    description: "泰國宗教場所：MOC 12,262（宗教別由名稱推導）＋OSM 補缺 26,657＋Overture 補缺 70,441；Overture／OSM 為補缺，非官方寺院名冊", processing: "MOC religious_place（religion_guess 名稱推導）＋OSM＋Overture（religion taxonomy）；PMTiles moc_official z7、osm_hot z8、overture z9（-r1）", note: "MOC CC BY／ODbL／CDLA；DRA 清真寺名冊被擋" },
  thPostOffices: { theme: "基礎建設", group: "郵政與便民", zh: "郵局（補缺）", alt: "Post Offices (Gap-fill)", icon: Mail, dataset: "th_post_offices", topics: ["泰國", "基礎建設", "郵局", "Overture", "OSM"],
    description: "泰國郵局 Overture 2,116＋OSM 758（可能含代辦所）", processing: "Overture＋OSM post_office；PMTiles overture、osm z6–14（-r1）", note: "CDLA／ODbL；MDES 官方 CSV 境外不通" },
  thAirQualityStations: { theme: "環境氣候", group: "空品", zh: "空氣品質測站位置（無觀測值）", alt: "Air Quality Station Locations (No Readings)", icon: Wind, dataset: "th_air_quality_stations", topics: ["泰國", "環境", "空氣品質", "測站", "Air4Thai", "PCD"],
    description: "泰國空氣品質測站位置 267 處（Air4Thai 180＋GISTDA PCD 87）；只有位置、沒有任何觀測值，移動站 8 個座標會變", processing: "Air4Thai 站清單與 GISTDA station_pcd → 4326；77 府空間判定；PMTiles air4thai z4、gistda_station_pcd z5（-r1）；不輸出即時值", note: "授權未明示；只有站位，不是即時資料" },
  thWeatherStations: { theme: "環境氣候", group: "氣象", zh: "氣象測站位置（無觀測值）", alt: "Weather Station Locations (No Readings)", icon: Cloud, dataset: "th_weather_stations", topics: ["泰國", "氣象", "測站", "NOAA", "GISTDA"],
    description: "泰國氣象測站位置 294 處（NOAA ISD 170＋GISTDA 124）；只有位置、沒有任何觀測值", processing: "NOAA ISD 清單（停在 2025-08）與 GISTDA station_tmd → 4326；PMTiles noaa_isd、gistda_station_tmd z4–14；TMD API 完全未使用", note: "NOAA 公開／GISTDA 授權未明示；TMD 官方站未涵蓋" },
  thMarineHabitats: { theme: "海洋", group: "棲地", zh: "海洋棲地（珊瑚、海草、紅樹林）", alt: "Marine Habitats (Coral, Seagrass, Mangrove)", icon: Waves, dataset: "th_marine_habitats", topics: ["泰國", "海洋", "珊瑚", "海草", "紅樹林", "GISTDA"],
    description: "泰國珊瑚礁 392（13 府）、海草床 130（12 府）、紅樹林 1,969（23 府）面；年份不詳，不能稱全國完整", processing: "GISTDA Hosted 海洋棲地面 → 4326；PMTiles coral、seagrass、mangrove z5–13", note: "授權未明示；年份不詳；DMCR CSV、PCD 海水水質未涵蓋；不畫海域主張線" },
  thMarineProtectedAreas: { theme: "海洋", group: "保護區", zh: "海洋保護區（2010 年資料，較舊）", alt: "Marine Protected Areas (2010 data, outdated)", icon: Landmark, dataset: "th_marine_protected_areas", topics: ["泰國", "海洋", "保護區", "2010", "GISTDA"],
    description: "泰國海洋保護區 154 塊（2010 版，資料較舊；只涵蓋 9 個沿海府）", processing: "GISTDA Hosted 海洋保護區 → 4326；PMTiles protected_marine z5–12", note: "授權未明示；STALE（2010）；不畫海域主張線" },
  thSeaLevelStations: { theme: "海洋", group: "潮位", zh: "潮位站位置（無觀測值）", alt: "Tide-gauge Station Locations (No Readings)", icon: Anchor, dataset: "th_sea_level_stations", topics: ["泰國", "海洋", "潮位", "海平面", "DMR"],
    description: "泰國 DMR 潮位站位置 7 處；只有位置、沒有潮位值；東岸 2 站座標品質低（位置僅示意）", processing: "DMR 潮位站清單（排除測試站）→ 4326；PMTiles stations z4–14；潮位時序本輪不取", note: "CC BY（版本未標）；兩站座標互不一致 36／16 km" },
  thCoastalChange: { theme: "海洋", group: "海岸", zh: "海岸線變遷（侵淤）", alt: "Coastline Change (Erosion & Accretion)", icon: Waves, dataset: "th_coastal_change", topics: ["泰國", "海洋", "海岸", "侵蝕", "淤積", "DMR"],
    description: "泰國海岸線變遷 460 段（淤積 212、穩定 156、中度侵蝕 63、嚴重侵蝕 29；7 個沿海府；彙編年 2013–2023 各段不同）", processing: "DMR 海岸線段 → 4326；PMTiles coastal_change z5–14", note: "CC BY（版本未標）；各段彙編年不同；不畫海域主張線" },
  thSportsVenues: { theme: "運動休閒", group: "點位", zh: "運動場地（Overture 補缺）", alt: "Sports Venues (Overture Gap-fill)", icon: Flag, dataset: "th_sports_venues", topics: ["泰國", "運動", "體育場", "游泳池", "高爾夫", "Overture"],
    description: "泰國運動場地 11,377 處（Overture 補缺，空心；體育場、游泳池、足球場、球場、高爾夫；一般運動休閒預設關；低縮放熱區）", processing: "Overture places 運動類 → venue_group；PMTiles venues z7、general z9（-r1）", note: "CDLA-Permissive-2.0；DPE 官方名冊非商用未取" },
  thParks: { theme: "運動休閒", group: "公園", zh: "公園（Overture 補缺）", alt: "Parks (Overture Gap-fill)", icon: Trees, dataset: "th_parks", topics: ["泰國", "公園", "遊戲場", "植物園", "Overture"],
    description: "泰國公園 7,495 處（Overture 補缺，空心；只有點、無面積）", processing: "Overture places 公園類 → 4326；PMTiles parks z7、other z8（-r1）", note: "CDLA-Permissive-2.0；BMA 綠地名冊未取" },
  thFactories: { theme: "工商登記", group: "工廠", zh: "工廠（DIW，僅含有座標者）", alt: "Factories (DIW, Records with Coordinates Only)", icon: Factory, dataset: "th_factories", topics: ["泰國", "工業", "工廠", "DIW"],
    description: "泰國工廠 21,320 筆有座標（營運中 7,769＋已註銷等 13,551；全名冊 116,050 筆）；預設只顯示營運中；負責人與地址不輸出", processing: "DIW 工廠名冊（2,321 頁分頁掃描）→ 有座標者 4326；status_class 分類；個人稱謂名稱遮蔽；PMTiles operating z6、inactive z9（-r1）", note: "Open Data Common；營運中 3,695 筆無座標未 geocode" },
  thFarmMarkets: { theme: "農業", group: "市集", zh: "農會與農夫市集（Overture 補缺）", alt: "Farm Co-ops & Farmers' Markets (Overture Gap-fill)", icon: Store, dataset: "th_farm_markets", topics: ["泰國", "農業", "農會", "農夫市集", "Overture"],
    description: "泰國農會與農夫市集 2,137 處（Overture 補缺，空心）", processing: "Overture places 農業合作社、農夫市集 → 4326；PMTiles farm_markets z6（-r1）", note: "CDLA-Permissive-2.0；DOAE 社區企業名冊含個人欄未取" },
  thCrops: { theme: "農業", group: "作物", zh: "主要作物範圍（一般化，稻、木薯、玉米、甘蔗、橡膠、油棕）", alt: "Major Crop Extents (Generalized)", icon: Sprout, dataset: "th_crops", topics: ["泰國", "農業", "作物", "稻米", "橡膠", "油棕", "GISTDA"],
    description: "泰國六種作物範圍（稻 43.5 萬塊、木薯 17.9 萬、玉米、甘蔗、橡膠、油棕）；一般化低解析版，不可用於面積計算", processing: "GISTDA Hosted 作物面 → 稻等簡化 0.003°（約 330 m）丟棄 <1.2 km² 碎片；橡膠、油棕 0.001°；PMTiles rice、cassava、maize、sugarcane z6、rubber、palm z9", note: "授權未明示；單檔 145.9 MB；單位未標；疑為行政區聚合多邊形" },
  thVeterinary: { theme: "農業", group: "獸醫", zh: "獸醫與動物診所（Overture＋GISTDA）", alt: "Veterinary Clinics (Overture + GISTDA)", icon: Stethoscope, dataset: "th_veterinary", topics: ["泰國", "農業", "獸醫", "動物診所", "Overture", "GISTDA"],
    description: "泰國獸醫 3,642 處（Overture 補缺 3,350＋GISTDA 292；商用 POI，不分公私立）", processing: "Overture veterinarian＋GISTDA 獸醫圖層 → 4326；PMTiles overture、gistda z6–14（-r1）", note: "CDLA／GISTDA 授權未明示；官方獸醫名冊無" },
};

const TH_DATA_MANIFEST_ENTRIES = Object.fromEntries(TH_DATA_SPECS.map((spec) => {
  const m = TH_DATA_ENTRY_META[spec.key];
  const hasPoint = spec.parts.some((x) => x.geom === "point");
  const layers = [...new Set(spec.parts.map((x) => x.sourceLayer))].join("／");
  const kinds = ["multiSelect", ...(spec.statusDefault ? ["multiSelect"] : []), ...(spec.heat ? ["palette"] : []), "slider", ...(hasPoint ? ["slider"] : [])] as ("multiSelect" | "palette" | "slider")[];
  return [spec.key, {
    key: spec.key,
    country: "TH", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `usePhDataLayer（泰國規格）自建 mapbox-pmtiles source；source-layer=${layers}`, staticAssets: [`./world/${spec.file}`] },
    legend: spec.key,
    popup: spec.key,
    params: { count: kinds.length, kinds },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<ThDataKey, LayerManifestEntry>;

/** 泰國 raster 2 層（2026-11-22 第 2 波）：PNG PMTiles，無 feature 屬性與 popup（同 phTerrain）。 */
const TH_RASTER_META: Record<string, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  thTerrainHillshade: { theme: "底圖", group: "地形", zh: "山體陰影", alt: "Hillshade", icon: Mountain, dataset: "th_terrain", topics: ["泰國", "底圖", "地形", "陰影", "Copernicus DEM"],
    description: "泰國山體陰影（Copernicus DEM GLO-90，約 90 m；只保留陸域，DSM）", processing: "Copernicus DEM GLO-90 → gdaldem hillshade → 泰國陸域遮罩 → PNG raster PMTiles z5–10", note: "Copernicus DEM（免費、要署名）；28.1 MB 走 deploy-assets；DSM 含樹冠與建物；GLO-30 待主機搬遷；沒有 feature 屬性與 popup" },
  thTerrainRelief: { theme: "底圖", group: "地形", zh: "色別標高", alt: "Elevation Tint", icon: Mountain, dataset: "th_terrain", topics: ["泰國", "底圖", "地形", "標高", "Copernicus DEM"],
    description: "泰國色別標高（0–2,565 m 色帶，≤0 m 與海面、鄰國透明）", processing: "Copernicus DEM GLO-90 → gdaldem color-relief（≤0 m 透明）→ 泰國陸域遮罩 → PNG raster PMTiles z5–10", note: "Copernicus DEM（免費、要署名）；DSM；沒有 feature 屬性與 popup" },
  thSoilPh: { theme: "農業", group: "土壤", zh: "土壤酸鹼值 pH（約 1 km）", alt: "Soil pH (about 1 km)", icon: Sprout, dataset: "th_soils", topics: ["泰國", "農業", "土壤", "pH", "SoilGrids"],
    description: "泰國表土 pH（SoilGrids 2.0 模型預測，約 1 km；4.0–8.5 色階，0 值透明；最大 z7）", processing: "SoilGrids WCS phh2o_0-5cm → 泰國陸域遮罩 → gdaldem color-relief → PNG raster PMTiles z4–7", note: "CC BY 4.0（推定）；模型預測，非實測，非 LDD 土壤分類" },
  thSoilOrganicCarbon: { theme: "農業", group: "土壤", zh: "土壤有機碳（約 1 km）", alt: "Soil Organic Carbon (about 1 km)", icon: Sprout, dataset: "th_soils", topics: ["泰國", "農業", "土壤", "有機碳", "SoilGrids"],
    description: "泰國表土有機碳（SoilGrids 2.0 模型預測，約 1 km；0–80 g/kg 色階；最大 z7）", processing: "SoilGrids WCS soc_0-5cm → 泰國陸域遮罩 → gdaldem color-relief → PNG raster PMTiles z4–7", note: "CC BY 4.0（推定）；模型預測，非實測" },
};

const TH_RASTER_MANIFEST_ENTRIES = Object.fromEntries(TH_RASTER_SPECS.map((spec) => {
  const m = TH_RASTER_META[spec.key]!;
  return [spec.key, {
    key: spec.key,
    country: "TH", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.steps?.[spec.steps.length - 1]?.color ?? "#9ca3af",
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `useThRasterLayer 自建 mapbox-pmtiles raster source（pmtilesRasterCustomSource）；minzoom=${spec.minzoom} maxzoom=${spec.maxzoom}，插在底圖第一個 symbol 下`, staticAssets: [`./world/${spec.file}`] },
    legend: spec.key,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<ThRasterKey, LayerManifestEntry>;


export const TH_PACK_MANIFEST = {
  ...TH_DATA_MANIFEST_ENTRIES,
  ...TH_RASTER_MANIFEST_ENTRIES,
  // ══════════════════════════════════════════════════════════════
  // 🇹🇭 泰國 Thailand（2026-11-22 第 0–1 波：C001 行政邊界、C023 人口；其餘 8 層由 TH_DATA_MANIFEST_ENTRIES 派生）
  // ══════════════════════════════════════════════════════════════
  thAdminBoundaries: {
    key: "thAdminBoundaries",
    country: "TH", section: { theme: "底圖", group: "行政邊界" },
    ...layerName({ zh: "行政區界", alt: "Administrative Boundaries" }),
    expandable: true,
    color: "#9ca3af",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "th_admin_boundaries", confidence: "HIGH" }],
      processing: "OCHA COD-AB Thailand v01（HDX；來源 Royal Thai Survey Department）國界 1、府 77、amphoe／khet 928、tambon／khwaeng 7,425 → 4326；PMTiles country z2–8／province z3–10／amphoe z6–11／tambon z9–13；曼谷 khwaeng 169（官方 180，版本落後）",
      note: "CC BY-IGO 3.0；不畫海域主張線；邊界依 OCHA 資料（含泰柬邊界段），不代表任何立場",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useThAdminLayers 自建 mapbox-pmtiles source；source-layer=country／province／amphoe／tambon（select 擇一）",
      staticAssets: ["./world/th_admin_boundaries.pmtiles"],
    },
    legend: "thAdminBoundaries",
    popup: "thAdminBoundaries",
    params: { count: 2, kinds: ["slider", "select"] },
    description: "泰國行政區界（國界、府 77、縣 928、區 7,425；OCHA COD-AB，泰文＋英文名）",
    topics: ["泰國", "行政區", "邊界", "府", "amphoe", "tambon", "COD-AB"],
  },
  thPopulation: {
    key: "thPopulation",
    country: "TH", section: { theme: "人口社經", group: "人口分布" },
    ...layerName({ zh: "人口密度", alt: "Population Density", qualifier: "2025 登記" }),
    expandable: true,
    color: "#f59e0b",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "th_population", confidence: "HIGH" }],
      processing: "NSO catalogapi OS_0405_01_0005_01（DOPA 戶籍登記，2021–2025）依 COD-AB pcode 接府（77）與 amphoe（928）面 → 人口密度（人／km²）；PMTiles province z3–10／amphoe z6–13",
      note: "Creative Commons Attributions（版本號未見）；戶籍人口不是普查實住人口；tambon 沒有人口；未涵蓋畫灰，不是 0",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useThPopulationLayers 自建 mapbox-pmtiles source；source-layer=province／amphoe（select 擇一）",
      staticAssets: ["./world/th_population.pmtiles"],
    },
    legend: "thPopulation",
    popup: "thPopulation",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "泰國 2025 年戶籍人口與人口密度（府、amphoe 兩層級；2021–2025 五年人口見 popup）",
    topics: ["泰國", "人口", "人口密度", "戶籍", "DOPA", "NSO"],
  },
  // <codemod:append TH_PACK_MANIFEST>
} satisfies Record<ThLayerKey, LayerManifestEntry>;
