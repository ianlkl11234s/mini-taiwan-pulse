// 印尼國家包：manifest.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IdLayerKey } from "./keys";
import type { LayerManifestEntry } from "../../data/layerManifest";
import { layerName } from "../../data/layerManifest";
import { ID_DATA_SPECS } from "./idDataLayers";
import { ID_RASTER_SPECS } from "./idWavesLayers";
import { type IdDataKey, type IdRasterKey } from "./keys";
import { Activity, Anchor, BedDouble, Building2, Bus, Castle, Church, CloudRain, Construction, Droplets, Factory, FerrisWheel, Fish, Flower2, Fuel, Gavel, GraduationCap, Hospital, Landmark, type LucideIcon, Mail, Map, MapPin, Mountain, PawPrint, Plane, RadioTower, Route, Shield, ShieldAlert, Siren, Sprout, Store, Sun, Tent, Theater, Thermometer, TrainFront, TreePine, Trees, Users, Waves, Zap } from "lucide-react";

/** 印尼第 1–4 波（2026-11-23）規格驅動 19 層的中介資料；規格 SSOT 在 idWavesLayers.ts，畫法重用 usePhDataLayer。 */
const ID_DATA_ENTRY_META: Record<IdDataKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  idStations: { theme: "交通", group: "場站", zh: "鐵道站", alt: "Railway Stations", icon: TrainFront, dataset: "id_stations", topics: ["印尼", "交通", "鐵道", "車站", "OSM"],
    description: "印尼鐵道站 681 處（OSM 補缺，非官方；KAI 無開放站表）", processing: "HOT／HDX OSM 鐵道站 → 4326；省縣判定（Kemendagri 碼）；PMTiles stations z4–14", note: "ODbL 1.0；非官方站數；涵蓋 17/38 省" },
  idRailLines: { theme: "交通", group: "路網", zh: "鐵道線", alt: "Railway Lines", icon: Route, dataset: "id_rail_lines", topics: ["印尼", "交通", "鐵道", "OSM"],
    description: "印尼鐵道線 14,144 段（OSM，非官方；爪哇、蘇門答臘、南蘇拉威西）", processing: "HOT／HDX OSM railway=rail → 4326；線中點判縣市；PMTiles rail z4–12", note: "ODbL 1.0；主要道路（130,328 段）本輪未做；涵蓋 14/38 省" },
  idTransportHubs: { theme: "交通", group: "樞紐節點", zh: "機場與港口", alt: "Airports & Ports", icon: Plane, dataset: "id_transport_hubs", topics: ["印尼", "交通", "機場", "港口", "渡輪", "OSM", "OurAirports"],
    description: "印尼機場 678、港口 396、渡輪碼頭 775（OSM；無名機場 32 處不顯示，不猜名；機場補名取 OurAirports）", processing: "HOT／HDX OSM 樞紐 → 代表點；OurAirports 補機場名（公有領域）；PMTiles hubs z4–14", note: "ODbL 1.0／OurAirports 公有領域；Kemenhub 機場表、ASDP 航線無開放檔" },
  idPowerPlants: { theme: "能源", group: "電力 · 廠", zh: "電廠", alt: "Power Plants", icon: Factory, dataset: "id_power_plants", topics: ["印尼", "能源", "電廠", "發電", "燃煤", "水力", "地熱", "GPPD", "OSM"],
    description: "印尼電廠 559 處（WRI GPPD 2021 版 178＋OSM 補缺 381；依燃料分色、點大小依裝置容量）", processing: "WRI GPPD v1.3.0 濾印尼＋Overture 電廠補缺；省縣判定；PMTiles plants z3–14（點與面）", note: "逐列 CC BY 4.0／ODbL 1.0；GPPD 為 2021 版（STALE）；GEM 追蹤器需填表單，未用" },
  idPowerGrid: { theme: "能源", group: "電力 · 電網", zh: "輸電線與變電所", alt: "Power Lines & Substations", icon: Zap, dataset: "id_power_grid", topics: ["印尼", "能源", "電網", "輸電線", "變電所", "OSM", "Overture"],
    description: "印尼輸電線 4,627 段（依電壓分級）＋變電所 2,820 處（OpenStreetMap via Overture，非官方）", processing: "Overture base/infrastructure power_line／substation → 4326；依 voltage 最大值分級；PMTiles lines z4–13、substations z5–14", note: "ODbL 1.0；OSM 完整度不均，不可當官方電網長度" },
  idRenewables: { theme: "能源", group: "再生能源", zh: "太陽能潛力與風光發電場", alt: "Solar Potential & Wind/Solar Farms", icon: Sun, dataset: "id_renewables", topics: ["印尼", "能源", "再生能源", "太陽能", "風電", "BMKG", "OSM"],
    description: "BMKG 太陽能潛力分區（2 級，DISPLAY_ONLY）＋OSM 太陽能／風力發電場 204 處", processing: "BMKG ArcGIS 太陽能潛力圖簡化 0.001°；Overture generator 太陽能與風力；PMTiles solar_potential z3–10、generators z4–14", note: "BMKG 授權未明示（須署名）；OSM ODbL 1.0；潛力分區是 DISPLAY_ONLY，不是已建設施；不含屋頂型" },
  idFuelStations: { theme: "能源", group: "石化 · 加油站", zh: "加油站", alt: "Fuel Stations", icon: Fuel, dataset: "id_fuel_stations", topics: ["印尼", "能源", "加油站", "Overture", "Pertamina", "Shell", "BP"],
    description: "印尼加油站 5,975 處（Overture 補缺，非官方 SPBU 名冊；Pertamina、Shell、BP 分色）", processing: "Overture places gas_station／fueling_station → 品牌正規化；個人名義記錄級遮蔽；PMTiles fuel z5–14", note: "CDLA-Permissive-2.0；筆數為登記數、可能含歇業" },
  idPlaceNames: { theme: "底圖", group: "地名", zh: "BIG 地名", alt: "BIG Place Names", icon: MapPin, dataset: "id_place_names", topics: ["印尼", "底圖", "地名", "BIG", "Gasetir"],
    description: "印尼地名 12,554 筆（BIG Gasetir 2023 已公布批次；含學校、村辦公室等設施型地名）", processing: "BIG ArcGIS Gasetir 線面轉代表點；省縣判定；PMTiles places z6–14", note: "授權未明示；非全國全部地名；離岸地名保留、省縣欄空白；放大至 z6 才顯示" },
  idOuterIslands: { theme: "底圖", group: "外圍小島", zh: "外圍小島", alt: "Outer Small Islands", icon: Anchor, dataset: "id_outer_islands", topics: ["印尼", "底圖", "外圍小島", "BIG", "PPKT"],
    description: "印尼外圍小島 111 處（BIG PPKT，Keppres 6/2017）；只畫島點，不畫任何海上主張線", processing: "BIG GRI_2024_PPKT → 4326；PMTiles islands z3–14", note: "授權未明示；高程與精度來源皆為 0 未輸出；離陸地面 >5 km 者省碼取 BIG 屬性" },
  idFaults: { theme: "災害", group: "斷層", zh: "活動斷層", alt: "Active Faults", icon: Activity, dataset: "id_faults", topics: ["印尼", "災害", "斷層", "地震", "PVMBG", "PuSGeN"],
    description: "印尼斷層 1,415 條（PVMBG 大尺度活動斷層 1,014＋PuSGeN 2024 淺層地殼斷層 401）", processing: "BNPB ArcGIS 轉存 PVMBG、PuSGeN → 4326；線中點判縣市；PMTiles pvmbg、pusgen z3–12", note: "授權未明示；兩來源比例尺不同、疊合會重複；離岸斷層保留" },
  idMountainRescue: { theme: "災害", group: "山域搜救", zh: "山域搜救事件", alt: "Mountain Search & Rescue", icon: ShieldAlert, dataset: "id_mountain_rescue", topics: ["印尼", "災害", "搜救", "山難", "Basarnas"],
    description: "印尼山域搜救事件 55 筆（Basarnas 2022 單年；山林迷路與墜落）；不含案件敘述與姓名", processing: "Basarnas 手動下載 JSON → 4326；火山噴發事件排除；PMTiles events z5–14", note: "授權未明示；單年資料，不足以做趨勢" },
  idDibiHydromet: { theme: "災害", group: "水文氣象災害", zh: "水文氣象災害次數（縣市）", alt: "Hydrometeorological Disaster Counts", icon: CloudRain, dataset: "id_dibi_hydromet", topics: ["印尼", "災害", "水文氣象", "DIBI", "BNPB"],
    description: "印尼水文氣象災害次數（DIBI 2015–2024，514 縣市；DISPLAY_ONLY）", processing: "BNPB ArcGIS DIBI 縣市彙總接第 0 波縣市面（Kemendagri 碼）；PMTiles kabkota z4–12", note: "授權未明示；0 值佔 80%、欄位語意未說明，DISPLAY_ONLY，不做排名或風險比較" },
  idBridges: { theme: "交通", group: "橋梁", zh: "橋梁", alt: "Bridges", icon: Construction, dataset: "id_bridges", topics: ["印尼", "交通", "橋梁", "BNPB"],
    description: "印尼橋梁 16,208 點（BNPB 轉存基本地形圖，三比例尺合併去重；只有位置與道路等級）", processing: "BNPB Basemap／Jembatan 三比例尺跨層 30 m 去重；PMTiles bridges z7–14", note: "授權未明示；結構屬性未填；放大至 z7 才顯示" },
  idWaterFacilities: { theme: "水資源", group: "水利設施", zh: "水壩、堰與閘", alt: "Dams, Weirs & Gates", icon: Waves, dataset: "id_water_facilities", topics: ["印尼", "水資源", "水壩", "堰", "水閘", "OSM"],
    description: "印尼水壩 893、堰 1,793、水閘 213、泄水閘 138、船閘 147（OSM，非官方）", processing: "HOT／HDX OSM waterways 篩 dam／weir／sluice_gate／lock_gate／floodgate；PMTiles facilities z5–14", note: "ODbL 1.0；筆數是 OSM 物件數，非壩座數；C110（壩）與 C114（堰閘）合一層" },
  idWatersheds: { theme: "水資源", group: "流域", zh: "流域分級", alt: "Watershed Classification", icon: Droplets, dataset: "id_watersheds", topics: ["印尼", "水資源", "流域", "DAS", "KLHK"],
    description: "印尼流域分級 42,210 個細流域（KLHK DAS；維持／待復育；z8 起填色）", processing: "BNPB ArcGIS 轉存 KLHK 分級，伺服端簡化約 30 m；PMTiles watersheds z5–12", note: "授權未明示；das_code 不唯一；面積以 area_ha 為準" },
  idSubsidence: { theme: "災害", group: "地層下陷", zh: "雅加達地層下陷觀測點", alt: "Jakarta Land Subsidence Points", icon: Activity, dataset: "id_subsidence", topics: ["印尼", "災害", "地層下陷", "雅加達", "Satu Data"],
    description: "雅加達地層下陷觀測 502 筆（230 站，2023–2025；依年份篩選，各年速率不可互比）", processing: "Satu Data Jakarta CSV（UTM48S／度分座標轉 4326）；PMTiles stations z8–14", note: "授權未明示；速率單位未標、2023–24 與 2025 量級不同（0.01–0.09 對 1–8）；僅雅加達" },
  idNatureSpots: { theme: "觀光", group: "玩・自然", zh: "景點與觀景點", alt: "Attractions & Viewpoints", icon: Mountain, dataset: "id_nature_spots", topics: ["印尼", "觀光", "景點", "觀景點", "OSM"],
    description: "印尼景點與觀景點 4,337 處（OSM，非官方；attraction 為泛稱）", processing: "HOT／HDX OSM tourism 篩 attraction／viewpoint／picnic_site／theme_park／zoo／aquarium；PMTiles spots z6–14", note: "ODbL 1.0；放大至 z6 才顯示；Overture 對照未併入" },
  idConservationForest: { theme: "自然保育", group: "保護與保育林", zh: "保護與保育林分區（舊版）", alt: "Protection & Conservation Forest (Legacy)", icon: TreePine, dataset: "id_conservation_forest", topics: ["印尼", "自然保育", "保護林", "保育林", "國家公園", "GFW"],
    description: "印尼保護與保育林分區 15,792 面（WRI／GFW 舊版轉存，STALE；z7 起填色）", processing: "BNPB ArcGIS 轉存 GFW 舊版 → 4326；PMTiles zones z4–12", note: "授權未明示；舊版、年份未標；服務描述稱限 Kalimantan、實測涵蓋 38 省" },
  idCamps: { theme: "觀光", group: "營地與山屋", zh: "營地與山屋", alt: "Campsites & Mountain Huts", icon: Tent, dataset: "id_camps", topics: ["印尼", "觀光", "營地", "山屋", "OSM"],
    description: "印尼營地 586、山屋 118（OSM，非官方）", processing: "HOT／HDX OSM camp_site／alpine_hut／wilderness_hut；PMTiles camps z6–14", note: "ODbL 1.0；放大至 z6 才顯示" },
  idSchools: { theme: "教育", group: "學校", zh: "學校與幼兒園", alt: "Schools & Kindergartens", icon: GraduationCap, dataset: "id_schools", topics: ["印尼", "教育", "學校與幼兒園"],
    description: "印尼學校與幼兒園 63,083 處（OSM，非官方；學校 52,856、幼兒園 6,979、大學 1,980、學院 1,268；z7 起顯示）", processing: "HOT／HDX OSM amenity=school／kindergarten／university／college → 代表點；省縣判定；PMTiles points z7–14", note: "ODbL 1.0；非官方，官方 Dapodik（313,664）與 PAUD 未納入；無名 8,880；筆數不可當官方統計" },
  idHealthFacilities: { theme: "醫療", group: "點位", zh: "醫療設施", alt: "Health Facilities", icon: Hospital, dataset: "id_health_facilities", topics: ["印尼", "醫療", "醫療設施"],
    description: "印尼醫療設施 17,998 處（OSM，非官方；醫院、診所、藥局、醫師診間、牙醫）", processing: "HOT／HDX OSM amenity／healthcare → 代表點；PMTiles points z6–14", note: "ODbL 1.0；非官方名冊，筆數不可當官方統計" },
  idFireStations: { theme: "執法治安", group: "消防", zh: "消防站", alt: "Fire Stations", icon: Siren, dataset: "id_fire_stations", topics: ["印尼", "執法治安", "消防站"],
    description: "印尼消防站 425 處（OSM，非官方）", processing: "HOT／HDX OSM amenity=fire_station；PMTiles points z5–14", note: "ODbL 1.0；非官方，涵蓋 32/38 省、縣市 161/514" },
  idPoliceStations: { theme: "執法治安", group: "警政", zh: "警察機關", alt: "Police Stations", icon: Shield, dataset: "id_police_stations", topics: ["印尼", "執法治安", "警察機關"],
    description: "印尼警察機關 3,236 處（OSM，非官方）", processing: "HOT／HDX OSM amenity=police；PMTiles points z5–14", note: "ODbL 1.0；非官方，涵蓋縣市 427/514" },
  idPrisonsCourts: { theme: "執法治安", group: "監所與法院", zh: "監所與法院", alt: "Prisons & Courthouses", icon: Gavel, dataset: "id_prisons_courts", topics: ["印尼", "執法治安", "監所與法院"],
    description: "印尼監所與法院 594 處（OSM，非官方）", processing: "HOT／HDX OSM amenity=prison／courthouse；PMTiles points z5–14", note: "ODbL 1.0；非官方，涵蓋縣市 226/514" },
  idImmigrationOffices: { theme: "執法治安", group: "移民署", zh: "移民署辦公處", alt: "Immigration Offices", icon: Landmark, dataset: "id_immigration_offices", topics: ["印尼", "執法治安", "移民署辦公處"],
    description: "印尼移民署辦公處 218 處（境內有座標；依名稱前綴歸類）", processing: "Direktorat Jenderal Imigrasi 網頁名冊（404 筆，163 無座標、13 海外）→ 4326；類別依名稱前綴；PMTiles offices z4–14", note: "授權未明示；類別為本站歸類、非官方分類；名稱可能因 2026-10 更名過時；不顯示聯絡欄" },
  idTransjakarta: { theme: "交通", group: "公車", zh: "TransJakarta 路線與站位", alt: "TransJakarta Routes & Stops", icon: Bus, dataset: "id_transjakarta", topics: ["印尼", "交通", "TransJakarta 路線與站位"],
    description: "雅加達 TransJakarta 路線 694 條形狀與站位 8,149 處（靜態 GTFS，2026-11-20）", processing: "PT Transportasi Jakarta GTFS 靜態：shapes→trips 對 route，stops 接縣市；PMTiles routes z8–15、stops z9–15", note: "授權未明示；靜態 GTFS，無即時；僅雅加達都會區（3 省、13 縣市）" },
  idSpecialEconomicZones: { theme: "工商登記", group: "經濟特區", zh: "經濟特區 KEK", alt: "Special Economic Zones (KEK)", icon: Factory, dataset: "id_special_economic_zones", topics: ["印尼", "工商登記", "經濟特區 KEK"],
    description: "印尼經濟特區 KEK 12 處（非完整名冊）", processing: "BNPB ArcGIS 轉存 Dewan Nasional KEK → 4326；PMTiles kek z4–13", note: "授權未明示；面積單位未標不顯示；只有 12 個" },
  idIkn: { theme: "底圖", group: "新首都 IKN", zh: "新首都 IKN 範圍與規劃", alt: "New Capital (IKN) Boundaries & Planning", icon: Landmark, dataset: "id_ikn", topics: ["印尼", "底圖", "新首都 IKN 範圍與規劃"],
    description: "印尼新首都 IKN 四個互相重疊的範圍（IKN 範圍、RDTR 4、BWP 北部 1、BWP 六分區）", processing: "BNPB ArcGIS IKN 批次 → 4326；PMTiles delineasi、rdtr、bwp_utara、bwp z5–14", note: "授權未明示；四範圍互相重疊，面積不可相加" },
  idPostOffices: { theme: "基礎建設", group: "郵局", zh: "郵局", alt: "Post Offices", icon: Mail, dataset: "id_post_offices", topics: ["印尼", "基礎建設", "郵局"],
    description: "印尼郵局 1,797 處（OSM，非官方）", processing: "HOT／HDX OSM amenity=post_office；PMTiles points z5–14", note: "ODbL 1.0；非官方，涵蓋縣市 342/514" },
  idMarkets: { theme: "工商登記", group: "市場", zh: "市場", alt: "Marketplaces", icon: Store, dataset: "id_markets", topics: ["印尼", "工商登記", "市場"],
    description: "印尼市場 5,754 處（OSM，非官方）", processing: "HOT／HDX OSM amenity=marketplace；PMTiles points z6–14", note: "ODbL 1.0；非官方，涵蓋縣市 415/514" },
  idBanks: { theme: "基礎建設", group: "金融據點", zh: "銀行與 ATM", alt: "Banks & ATMs", icon: Building2, dataset: "id_banks", topics: ["印尼", "基礎建設", "銀行與 ATM"],
    description: "印尼銀行 8,984 與 ATM 5,606（OSM，非官方；ATM z8 起）", processing: "HOT／HDX OSM amenity=bank／atm；PMTiles points z6–14", note: "ODbL 1.0；非官方，涵蓋縣市 421/514" },
  idCulturalFacilities: { theme: "文化", group: "文化設施", zh: "文化設施", alt: "Cultural Facilities", icon: Theater, dataset: "id_cultural_facilities", topics: ["印尼", "文化", "文化設施"],
    description: "印尼文化設施 3,755 處（OSM；圖書館、博物館、社區中心、劇場、電影院…）", processing: "HOT／HDX OSM 文化類標籤；PMTiles points z6–14", note: "ODbL 1.0；非官方，涵蓋縣市 347/514" },
  idHeritageSites: { theme: "文化", group: "古蹟與紀念地", zh: "歷史與紀念地點", alt: "Heritage & Memorial Sites", icon: Castle, dataset: "id_heritage_sites", topics: ["印尼", "文化", "歷史與紀念地點"],
    description: "印尼歷史與紀念地點 4,286 處（OSM historic 標籤；紀念碑、遺址、要塞、古墓…）", processing: "HOT／HDX OSM historic=*；PMTiles points z6–14", note: "ODbL 1.0；非官方，不是官方文化資產名冊" },
  idCommTowers: { theme: "基礎建設", group: "通訊塔", zh: "通訊塔", alt: "Communications Towers", icon: RadioTower, dataset: "id_comm_towers", topics: ["印尼", "基礎建設", "通訊塔"],
    description: "印尼通訊塔 1,026 處（OSM，非官方）", processing: "HOT／HDX OSM man_made=communications_tower；PMTiles points z6–14", note: "ODbL 1.0；非官方，不是電信業者基地台名冊" },
  idPlacesOfWorship: { theme: "宗教", group: "點位", zh: "宗教場所", alt: "Places of Worship", icon: Church, dataset: "id_places_of_worship", topics: ["印尼", "宗教", "宗教場所"],
    description: "印尼宗教場所 82,202 處（Overture，非官方；伊斯蘭、基督教、天主教、印度教、佛教；z7 起顯示）", processing: "Overture places 宗教場所（confidence≥0.5、已歇業排除、境外 22,781 丟棄）；PMTiles points z7–14", note: "CDLA-Permissive-2.0；非官方 SIMAS 名冊；宗教別是場所分類，不是信徒統計" },
  idExperiences: { theme: "觀光", group: "體驗", zh: "遊樂與露營", alt: "Amusement & Camping", icon: FerrisWheel, dataset: "id_experiences", topics: ["印尼", "觀光", "遊樂與露營"],
    description: "印尼遊樂園、水上樂園、露營地、水族館、動物園共 3,040 處（Overture，非官方）", processing: "Overture places 遊樂與露營類；PMTiles points z6–14", note: "CDLA-Permissive-2.0；非官方；露營地與 OSM「營地與山屋」部分重疊" },
  idAccommodation: { theme: "觀光", group: "住宿", zh: "住宿", alt: "Accommodation", icon: BedDouble, dataset: "id_accommodation", topics: ["印尼", "觀光", "住宿"],
    description: "印尼住宿 67,917 處（Overture，非官方；飯店、旅社、度假村、青旅；z7 起顯示）", processing: "Overture places 住宿類；PMTiles points z7–14", note: "CDLA-Permissive-2.0；非官方；盤點稱 80,282，實際以資料端為準" },
  idWeatherStations: { theme: "環境氣候", group: "氣象站", zh: "氣象站位（BMKG）", alt: "Weather Stations (BMKG)", icon: Thermometer, dataset: "id_weather_stations", topics: ["印尼", "環境氣候", "氣象站位（BMKG）"],
    description: "印尼 BMKG 自動氣象站位 1,315 站（ARG、AWS、AAWS 等；只有站位，沒有觀測值）", processing: "BMKG 自動氣象站 metadata → 4326；PMTiles stations z4–14", note: "授權未明示（BMKG 須署名）；只有 metadata，無觀測值" },
  idFactories: { theme: "工商登記", group: "工廠", zh: "工廠與工場", alt: "Factories & Works", icon: Factory, dataset: "id_factories", topics: ["印尼", "工商登記", "工廠與工場"],
    description: "印尼工廠與工場 3,048 處（OSM，非官方）", processing: "HOT／HDX OSM man_made=works；PMTiles points z6–14", note: "ODbL 1.0；非官方，不等於工業登記名冊" },
  idSportsVenues: { theme: "運動休閒", group: "點位", zh: "運動場地", alt: "Sports Venues", icon: Activity, dataset: "id_sports_venues", topics: ["印尼", "運動休閒", "運動場地"],
    description: "印尼運動場地 18,785 處（OSM 面；球場、體育場、遊憩地、跑道；z8 起顯示）", processing: "Overture base/land_use（OSM 來源）→ 簡化約 10 m；PMTiles areas z8–14", note: "ODbL 1.0；非官方" },
  idParks: { theme: "運動休閒", group: "公園", zh: "公園", alt: "Parks", icon: Trees, dataset: "id_parks", topics: ["印尼", "運動休閒", "公園"],
    description: "印尼公園 9,241 處（OSM 面；z7 起顯示）", processing: "Overture base/land_use park（OSM 來源）；PMTiles areas z7–14", note: "ODbL 1.0；非官方" },
  idCemeteries: { theme: "基礎建設", group: "墓區", zh: "墓地範圍", alt: "Cemeteries", icon: Flower2, dataset: "id_cemeteries", topics: ["印尼", "基礎建設", "墓地範圍"],
    description: "印尼墓地範圍 8,052 處（OSM 面；只有墓區範圍，無個別墓位）", processing: "Overture base/land_use cemetery（OSM 來源）；PMTiles areas z8–14", note: "ODbL 1.0；非官方；無個別墓位" },
  idAquaculture: { theme: "農業", group: "養殖", zh: "養殖池", alt: "Aquaculture Ponds", icon: Fish, dataset: "id_aquaculture", topics: ["印尼", "農業", "養殖池"],
    description: "印尼養殖池 4,642 處（OSM 面）", processing: "Overture base/land_use aquaculture（OSM 來源）；PMTiles areas z6–14", note: "ODbL 1.0；非官方" },
  idFarmland: { theme: "農業", group: "農地", zh: "農地面（OSM 派生）", alt: "Farmland (OSM-derived)", icon: Sprout, dataset: "id_farmland", topics: ["印尼", "農業", "農地面（OSM 派生）"],
    description: "印尼農地面 95,084 處（OSM 派生：農地、果園、農場院落；z8 起顯示）", processing: "Overture base/land_use agriculture／horticulture（OSM 來源）；PMTiles areas z8–14", note: "ODbL 1.0；OSM 登記的農地，涵蓋不均，非農地普查；官方 ATR/BPN 需印尼 IP" },
  idVeterinary: { theme: "農業", group: "獸醫", zh: "獸醫院", alt: "Veterinary Clinics", icon: PawPrint, dataset: "id_veterinary", topics: ["印尼", "農業", "獸醫院"],
    description: "印尼獸醫院 763 處（Overture，非官方）", processing: "Overture places veterinarian；PMTiles points z5–14", note: "CDLA-Permissive-2.0；非官方" },
};

const ID_DATA_MANIFEST_ENTRIES = Object.fromEntries(ID_DATA_SPECS.map((spec) => {
  const m = ID_DATA_ENTRY_META[spec.key];
  const hasPoint = spec.parts.some((x) => x.geom === "point");
  const layers = [...new Set(spec.parts.map((x) => x.sourceLayer))].join("／");
  const kinds = ["multiSelect", ...(spec.heat ? ["palette"] : []), "slider", ...(hasPoint ? ["slider"] : [])] as ("multiSelect" | "palette" | "slider")[];
  return [spec.key, {
    key: spec.key,
    country: "ID", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `usePhDataLayer（印尼規格）自建 mapbox-pmtiles source；source-layer=${layers}`, staticAssets: [`./world/${spec.file}`] },
    legend: spec.key,
    popup: spec.key,
    params: { count: kinds.length, kinds },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<IdDataKey, LayerManifestEntry>;

/** 印尼 raster 5 層（2026-11-23 第 2–3 波）：PNG PMTiles，無 feature 屬性與 popup；全部 DISPLAY_ONLY（影像底色）。 */
const ID_RASTER_META: Record<IdRasterKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  idTerrainHillshade: { theme: "底圖", group: "地形", zh: "山體陰影", alt: "Hillshade", icon: Mountain, dataset: "id_terrain", topics: ["印尼", "底圖", "地形", "陰影", "Copernicus DEM"],
    description: "印尼山體陰影（Copernicus DEM GLO-90，約 90 m，重取樣約 306 m；DSM；DISPLAY_ONLY）", processing: "Copernicus DEM GLO-90 → gdaldem hillshade → PNG raster PMTiles z4–9", note: "Copernicus DEM（免費、要署名）；25.1 MB 走 R2；DSM 含樹冠與建物；GLO-30、官方等高線未做；沒有 feature 屬性與 popup" },
  idTerrainRelief: { theme: "底圖", group: "地形", zh: "色別標高", alt: "Elevation Tint", icon: Mountain, dataset: "id_terrain", topics: ["印尼", "底圖", "地形", "標高", "Copernicus DEM"],
    description: "印尼色別標高（0–4,500 m 色帶，≤0 m 與海面透明；DISPLAY_ONLY）", processing: "Copernicus DEM GLO-90 → gdaldem color-relief（≤0 m 透明）→ PNG raster PMTiles z4–9", note: "Copernicus DEM（免費、要署名）；23.1 MB 走 R2；DSM；沒有 feature 屬性與 popup" },
  idInariskLandslide: { theme: "災害", group: "InaRISK 危害指數", zh: "崩塌危害指數（InaRISK）", alt: "Landslide Hazard Index (InaRISK)", icon: Mountain, dataset: "id_inarisk_landslide", topics: ["印尼", "災害", "崩塌", "InaRISK", "BNPB"],
    description: "印尼崩塌危害指數（InaRISK，500 m 重取樣，三等分展示色；DISPLAY_ONLY）", processing: "BNPB InaRISK ImageServer 取樣 500 m → 三級色 PNG raster PMTiles z3–9", note: "授權未明示；展示底色，不做 100 m 級分析；非 BNPB 官方 Kelas；沒有 feature 屬性與 popup" },
  idInariskFlood: { theme: "災害", group: "InaRISK 危害指數", zh: "淹水危害指數（InaRISK）", alt: "Flood Hazard Index (InaRISK)", icon: Waves, dataset: "id_inarisk_flood", topics: ["印尼", "災害", "淹水", "InaRISK", "BNPB"],
    description: "印尼淹水危害指數（InaRISK，500 m 重取樣，三等分展示色，值域從 0.33 起；DISPLAY_ONLY）", processing: "BNPB InaRISK ImageServer 取樣 500 m → 三級色 PNG raster PMTiles z3–9", note: "授權未明示；展示底色；官方 Kelas_Banjir 未取；沒有 feature 屬性與 popup" },
  idInariskMulti: { theme: "災害", group: "InaRISK 危害指數", zh: "多災種危害指數（InaRISK）", alt: "Multi-hazard Index (InaRISK)", icon: Activity, dataset: "id_inarisk_multi", topics: ["印尼", "災害", "多災種", "InaRISK", "BNPB"],
    description: "印尼多災種危害指數（InaRISK，5 級分位數相對排名；全國大片紅色是資料本身分布；DISPLAY_ONLY）", processing: "BNPB InaRISK ImageServer 取樣 500 m → 5 級分位數色 PNG raster PMTiles z3–9", note: "授權未明示；相對排名，非絕對風險；建議透明度 60–70%；沒有 feature 屬性與 popup" },
};

const ID_RASTER_MANIFEST_ENTRIES = Object.fromEntries(ID_RASTER_SPECS.map((spec) => {
  const m = ID_RASTER_META[spec.key];
  return [spec.key, {
    key: spec.key,
    country: "ID", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.steps?.[spec.steps.length - 1]?.color ?? "#9ca3af",
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `useIdRasterLayer 自建 mapbox-pmtiles raster source（pmtilesRasterCustomSource）；minzoom=${spec.minzoom} maxzoom=${spec.maxzoom}，插在底圖第一個 symbol 下`, staticAssets: [`./world/${spec.file}`] },
    legend: spec.key,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<IdRasterKey, LayerManifestEntry>;


export const ID_PACK_MANIFEST = {
  ...ID_DATA_MANIFEST_ENTRIES,
  ...ID_RASTER_MANIFEST_ENTRIES,
  // ══════════════════════════════════════════════════════════════
  // 🇮🇩 印尼 Indonesia（2026-11-23 第 0–3 波：C001 行政邊界、C023 人口、C022 農村發展指數；其餘 19＋5 層由 ID_DATA_MANIFEST_ENTRIES／ID_RASTER_MANIFEST_ENTRIES 派生）
  // ══════════════════════════════════════════════════════════════
  idAdminBoundaries: {
    key: "idAdminBoundaries",
    country: "ID", section: { theme: "底圖", group: "行政邊界" },
    ...layerName({ zh: "行政區界", alt: "Administrative Boundaries" }),
    expandable: true,
    color: "#9ca3af",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "id_admin_boundaries", confidence: "HIGH" }],
      processing: "OCHA COD-AB Indonesia v01（HDX；來源 BIG、BPS）國界 1、縣市 514（416 kabupaten＋98 kota）→ 4326，縣市依 Kemendagri 省碼重組為 38 省；PMTiles country z2–8／province z3–10／kabkota z5–12",
      note: "CC BY-IGO 3.0；幾何為 2020 版 COD-AB（舊 34 省）重組；陸界照 COD-AB 原樣，不代表任何立場；不畫海域主張線；省縣碼是 Kemendagri 碼，不是 COD-AB pcode",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useIdAdminLayers 自建 mapbox-pmtiles source；source-layer=country／province／kabkota（select 擇一）",
      staticAssets: ["./world/id_admin_boundaries.pmtiles"],
    },
    legend: "idAdminBoundaries",
    popup: "idAdminBoundaries",
    params: { count: 2, kinds: ["slider", "select"] },
    description: "印尼行政區界（國界、38 省、514 縣市；OCHA COD-AB，邊界不代表任何立場）",
    topics: ["印尼", "行政區", "邊界", "省", "縣市", "COD-AB"],
  },
  idPopulation: {
    key: "idPopulation",
    country: "ID", section: { theme: "人口社經", group: "人口分布" },
    ...layerName({ zh: "人口密度", alt: "Population Density", qualifier: "2020 推估" }),
    expandable: true,
    color: "#f59e0b",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "id_population", confidence: "HIGH" }],
      processing: "UNFPA／BPS COD-PS Indonesia 2020（v3，HDX）縣市人口依 Kemendagri 碼接縣市面；省值由縣市加總（全國 269,603,430 對帳一致）→ 人口密度；PMTiles province z3–10／kabkota z5–12",
      note: "HDX「Other」授權條款未明述（授權未明示，依 2026-11-23 決定照常上線）；2020 推估，不是 SP2020 普查或最新年度",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useIdPopulationLayers 自建 mapbox-pmtiles source；source-layer=province／kabkota（select 擇一）",
      staticAssets: ["./world/id_population.pmtiles"],
    },
    legend: "idPopulation",
    popup: "idPopulation",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "印尼 2020 年推估人口與人口密度（省、縣市兩層級）",
    topics: ["印尼", "人口", "人口密度", "UNFPA", "BPS", "COD-PS"],
  },
  idRuralDevelopment: {
    key: "idRuralDevelopment",
    country: "ID", section: { theme: "人口社經", group: "農村發展" },
    ...layerName({ zh: "農村發展指數 IDM", alt: "Village Development Index (IDM)", qualifier: "2024" }),
    expandable: true,
    color: "#2dd4bf",
    icon: Sprout,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "id_rural_development", confidence: "HIGH" }],
      processing: "Kemendes IDM 2024 hasil pemutakhiran（村級表）依縣市／省加總村均值與五級狀態村數，接 COD-AB 縣市、省面；PMTiles province z3–10／kabkota z5–12",
      note: "Open Data Commons Attribution License（資料集頁標示，條款未重讀）；村簡單平均不加權；縣市 432/514 有資料，82 個無村縣市畫灰「未涵蓋」；96.09、96.10 兩縣碼不在縣市面，其村只計入省層",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useIdRuralDevelopmentLayers 自建 mapbox-pmtiles source；source-layer=province／kabkota（select 擇一）",
      staticAssets: ["./world/id_rural_development.pmtiles"],
    },
    legend: "idRuralDevelopment",
    popup: "idRuralDevelopment",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "印尼農村發展指數 IDM 2024（省、縣市村均值與五級狀態；無村縣市未涵蓋）",
    topics: ["印尼", "農村", "發展指數", "IDM", "Kemendes"],
  },
  // <codemod:append ID_PACK_MANIFEST>
} satisfies Record<IdLayerKey, LayerManifestEntry>;
