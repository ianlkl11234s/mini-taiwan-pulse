/**
 * 菲律賓觀光波與第 2–9 波（2026-11-16）manifest 中介資料：主題／群組（對齊台灣面板）、名稱、icon、dataset、說明。
 * 規格本身在 phWavesLayers.ts；layerManifest 的 PH_DATA_ENTRY_META 展開本表。
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity, Anchor, Banknote, BedDouble, Building2, Church, CloudRain, Cross, Droplet, Droplets, Factory, Fish, Flame, Footprints,
  GraduationCap, HandCoins, Hospital, Landmark, Leaf, LifeBuoy, Lock, Mail, MapPinned, Milestone, Mountain, Recycle, School, Shell,
  Ship, Shrub, Siren, Sprout, SquareParking, Tag, Theater, TreePalm, Trees, TriangleAlert, Trophy, Waves,
} from "lucide-react";
import type { PhDataKey } from "./phDataKeys";

export interface PhEntryMeta { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }

const OSM_PROC = (q: string, tile: string) => `Geofabrik philippines-261115.osm.pbf（2026-11-15）取 ${q}；面與線取代表點，同類面內節點視為重複；18 region 空間判定、卡拉延不輸出；PMTiles ${tile}`;
const GFI_PROC = (layer: string, tile: string) => `Geoportal Philippines WMS GetFeatureInfo（${layer}）全國＋2×2 象限代表點去重 → 4326；region 空間判定；PMTiles ${tile}`;
const T = (...xs: string[]) => ["菲律賓", ...xs];

type W = Exclude<PhDataKey, "phTransportHubs" | "phStations" | "phMajorRoads" | "phPowerPlants" | "phPowerGrid" | "phRenewables" | "phFuelStations" | "phPipelines" | "phBusStops" | "phUrbanRail" | "phExpressways">;

export const PH_WAVE_ENTRY_META: Record<W, PhEntryMeta> = {
  // ── 觀光波（analytics #394）
  phTouristAttractions: { theme: "觀光", group: "玩・人文", zh: "景點與世界遺產", alt: "Attractions & World Heritage", icon: Landmark, dataset: "ph_tourist_attractions", topics: T("觀光", "景點", "世界遺產", "UNESCO", "古蹟", "博物館", "OSM", "DOT", "Wikidata"),
    description: "菲律賓景點 7,029 處（UNESCO 6 處 13 構成點、保護區與國家公園、古蹟、博物館、觀景點；低縮放只顯示重要條目，空心＝DOT 近似位置）", processing: "OSM＋DOT 景點清單（Geoportal GFI 2,082）＋UNESCO whc001＋Wikidata（名稱＋距離接回）；tier 1 UNESCO／NIPAS 類別 z4、tier 2 sitelinks ≥5 z7、tier 3 z10、未命名 z12；PMTiles tourist_attractions z4–14", note: "ODbL＋CC BY-SA 4.0＋CC0；DOT 約七成為市鎮中心近似座標（空心）；熱門程度不代表遊客量" },
  phCoastIslands: { theme: "觀光", group: "玩・自然", zh: "海灘、島嶼與潛水點", alt: "Beaches, Islands & Dive Sites", icon: TreePalm, dataset: "ph_coast_islands", topics: T("觀光", "海灘", "島嶼", "潛水", "OSM", "DOT", "Wikidata"),
    description: "菲律賓海灘、島嶼、潛水點與潟湖 7,033 處（Boracay、Alona Beach 等；未命名放大後才出現）", processing: "OSM＋DOT＋Wikidata 合併、名稱＋距離接回；逐筆 tier minzoom；PMTiles coast_islands z4–14", note: "ODbL＋CC0；潛水點只涵蓋 14/18 region" },
  phNatureSpots: { theme: "觀光", group: "玩・自然", zh: "瀑布、洞穴、火山與溫泉", alt: "Waterfalls, Caves, Volcanoes & Hot Springs", icon: Mountain, dataset: "ph_nature_spots", topics: T("觀光", "瀑布", "洞穴", "火山", "溫泉", "OSM", "DOT"),
    description: "菲律賓自然景觀 1,949 處（瀑布 1,094、洞穴 435、火山 327、溫泉 61 等）", processing: "OSM＋DOT＋Wikidata 合併、名稱＋距離接回；逐筆 tier minzoom；PMTiles nature_spots z4–14", note: "ODbL＋CC0；溫泉只涵蓋 11/18 region" },
  phTourismServices: { theme: "觀光", group: "住・食", zh: "住宿與觀光服務", alt: "Lodging & Tourism Services", icon: BedDouble, dataset: "ph_tourism_services", topics: T("觀光", "住宿", "旅館", "度假村", "露營", "遊客中心", "OSM"),
    description: "菲律賓住宿、度假村、樂園動物園、露營地與遊客中心 15,276 處（OSM；餐飲不在本層）", processing: "OSM tourism=hotel／guest_house／resort 等與 leisure=resort；PMTiles tourism_services z4–14（一般條目 z10 起）", note: "ODbL 1.0；OSM 標註不全" },
  phTourismDevelopmentAreas: { theme: "觀光", group: "玩・體驗", zh: "觀光發展區（TDA）", alt: "Tourism Development Areas", icon: MapPinned, dataset: "ph_tourism_development_areas", topics: T("觀光", "觀光發展區", "TDA", "NTDP", "DOT"),
    description: "DOT 國家觀光發展計畫 2023–2028 的 50 個觀光發展區（20 群，依北／中／南三色）", processing: "NTDP 2023–2028 Table 22 人工轉錄 106 列 → 對應市鎮面（OCHA COD-AB）聯集；Palawan 南北與 Siargao 名單為本站自訂；PMTiles tourism_development_areas z4–12", note: "政府規劃文件，授權未明示；12 市鎮不在任何 TDA（空白＝不在計畫內）" },
  // ── 第 2 波（剩餘）
  phPlaceNames: { theme: "底圖", group: "地名 Gazetteer", zh: "地名", alt: "Place Names", icon: Tag, dataset: "ph_place_names", topics: T("底圖", "地名", "GeoNames", "聚落", "山", "河川"),
    description: "菲律賓 GeoNames 地名 68,597 筆（聚落、地形、水文、區域四色；依重要性逐級出現，名稱在彈窗）", processing: "GeoNames PH.zip → 收 P／H／T／L 四類（不收 A、S、R）；region 空間判定；逐筆 minzoom；PMTiles place_names z5–14", note: "CC BY 4.0；不畫文字標籤（PMTiles symbol 會讓地圖 render 中止）" },
  phPoverty: { theme: "人口社經", group: "社經", zh: "貧窮率", alt: "Poverty Incidence", icon: HandCoins, dataset: "ph_poverty", topics: T("人口社經", "貧窮", "貧窮率", "PSA"),
    description: "菲律賓 2023 年貧窮人口比率（PSA，82 省＋36 個高度都市化／獨立市；彈窗另列 2018、2021；BARMM SGA 未涵蓋）", processing: "PSA OpenSTAT 0041F3DF02A（PX 保留 2 位小數）→ 對 OCHA COD-AB 省與 HUC 面；PMTiles poverty z4–11", note: "PSA，依 MO 008 視同署名；省值不含其 HUC；Maguindanao 分省前單值" },
  // ── 第 3 波
  phEarthquakes: { theme: "災害", group: "地震", zh: "地震目錄", alt: "Earthquake Catalogue", icon: Activity, dataset: "ph_earthquakes", topics: T("災害", "地震", "PHIVOLCS"),
    description: "PHIVOLCS 地震目錄 2018-01～2026-10 共 137,230 筆（依深度分色、規模定大小；含海上與卡拉延群島周邊海域）", processing: "PHIVOLCS 月報 HTML（gzip）解析 106 個月；region 空間判定（海上為空）；逐筆 minzoom（M≥5 z4、M≥4 z6、M≥3 z8、其餘 z10）；PMTiles earthquakes z4–12", note: "PHIVOLCS，MO 008 視同署名；靜態快照，不隨時間軸" },
  phNoahFlood100yr: { theme: "災害", group: "淹水", zh: "淹水危害（100 年重現期）", alt: "Flood Hazard (100-year)", icon: CloudRain, dataset: "ph_noah_flood_100yr", topics: T("災害", "淹水", "洪水", "NOAH"),
    description: "UP NOAH 100 年重現期降雨淹水危害（低 0–0.5 m、中 0.5–1.5 m、高 >1.5 m）", processing: "NOAH 危害圖 Hugging Face 鏡像 PMTiles 以 pmtiles extract 依緯度切北中南三檔（範圍重疊、未改幾何）；PMTiles flood_100yr z0–10", note: "ODbL（NOAH）；三檔 78＋71＋48 MB 走 deploy-assets" },
  phNoahLandslide: { theme: "災害", group: "崩塌", zh: "崩塌危害", alt: "Landslide Hazard", icon: TriangleAlert, dataset: "ph_noah_landslide", topics: T("災害", "崩塌", "山崩", "NOAH"),
    description: "UP NOAH 淺層崩塌危害（低、中、高；HAZ=4 來源未說明，另列灰色）", processing: "NOAH 危害圖 Hugging Face 鏡像 PMTiles 以 pmtiles extract 依緯度切北中南三檔（範圍重疊、未改幾何）；PMTiles landslide z0–10", note: "ODbL（NOAH）；三檔 125＋137＋135 MB 走 deploy-assets" },
  phWaterPermits: { theme: "水資源", group: "點位", zh: "取水許可", alt: "Water Permits", icon: Droplet, dataset: "ph_water_permits", topics: T("水資源", "取水", "地下水", "NWRB"),
    description: "NWRB 取水許可 17,411 筆（地下水、地表水兩色；許可人姓名已排除）", processing: GFI_PROC("nwrb water permits", "water_permits z7–14"), note: "Geoportal Conditional downloading；許可人姓名不輸出" },
  phLakes: { theme: "水資源", group: "面／線", zh: "主要湖泊", alt: "Major Lakes", icon: Waves, dataset: "ph_lakes", topics: T("水資源", "湖泊", "HDX"),
    description: "HDX 菲律賓主要湖泊 37 個（10/18 region）", processing: "HDX Philippines lakes → 4326；region 空間判定；PMTiles lakes z5–13", note: "CC0 1.0" },
  phDams: { theme: "水資源", group: "水利設施", zh: "壩與水庫", alt: "Dams & Reservoirs", icon: Droplets, dataset: "ph_dams", topics: T("水資源", "水壩", "水庫", "GDW"),
    description: "Global Dam Watch 菲律賓壩 52 座＋水庫面 27 個（14/18 region）", processing: "GDW v1.0 壩點與水庫面濾菲律賓；PMTiles dams、reservoirs z5–14", note: "CC BY 4.0" },
  // ── 第 4 波
  phBridges: { theme: "交通", group: "路網結構", zh: "國道橋梁", alt: "National Road Bridges", icon: Milestone, dataset: "ph_bridges", topics: T("交通", "橋梁", "DPWH"),
    description: "DPWH 國道橋梁清冊（2021）8,410 座（依 DPWH 狀況評等分色）", processing: GFI_PROC("dpwh_national_bridge", "bridges z8–14"), note: "Geoportal No restriction" },
  phParking: { theme: "交通", group: "停車", zh: "停車場", alt: "Car Parks", icon: SquareParking, dataset: "ph_parking", topics: T("交通", "停車", "OSM"),
    description: "OpenStreetMap 停車場 14,514 處（平面、立體、地下、路邊四色；52% 沒標類型）", processing: OSM_PROC("amenity=parking", "parking z10–14"), note: "ODbL 1.0；BARMM 稀疏" },
  phKmPosts: { theme: "交通", group: "道路設施", zh: "國道里程牌", alt: "Kilometre Posts", icon: Milestone, dataset: "ph_km_posts", topics: T("交通", "里程牌", "DPWH"),
    description: "DPWH 國道里程牌 31,017 支（空心小圓，只當參考座標；km 自馬尼拉 Rizal Park 起算）", processing: GFI_PROC("dpwh_kilometer_post", "km_posts z10–15"), note: "未列於 Geoportal 盤點表（授權未標示，照常上線）" },
  phEcozones: { theme: "工商登記", group: "園區", zh: "經濟特區（PEZA）", alt: "PEZA Ecozones", icon: Factory, dataset: "ph_ecozones", topics: T("工商登記", "經濟特區", "園區", "PEZA"),
    description: "PEZA 經濟特區 391 處（IT、製造、農工、觀光、醫療五色；點位為登記位置）", processing: GFI_PROC("peza_ecozone", "ecozones z5–14"), note: "Geoportal Conditional downloading；開發商為法人，保留" },
  phReclamation: { theme: "工商登記", group: "園區", zh: "填海造地", alt: "Reclamation Projects", icon: Anchor, dataset: "ph_reclamation", topics: T("工商登記", "填海", "PRA"),
    description: "PRA 填海造地專案點位 219 處（含已完成與提案中；狀態代碼 A／D 照原文）", processing: GFI_PROC("reclamationareas", "reclamation z5–14") + "；海上點以 10 km 內最近陸地判 region", note: "Geoportal Conditional downloading；狀態代碼意義未查到" },
  // ── 第 5 波
  phSchools: { theme: "教育", group: "學校 Schools", zh: "學校", alt: "Schools", icon: School, dataset: "ph_schools", topics: T("教育", "學校", "大學", "OSM"),
    description: "OpenStreetMap 學校 53,825 處（中小學、學院、大學、幼兒園；拉遠為熱區）", processing: OSM_PROC("amenity=school／college／university／kindergarten", "schools z7–14"), note: "ODbL 1.0；DepEd 名冊沒有現行座標版" },
  phSchoolCampuses: { theme: "教育", group: "校地 Campus", zh: "校地", alt: "School Campuses", icon: GraduationCap, dataset: "ph_school_campuses", topics: T("教育", "校地", "OSM"),
    description: "OpenStreetMap 校地面 49,456 個（z11 起顯示）", processing: OSM_PROC("amenity=school 等的面", "school_campuses z11–15"), note: "ODbL 1.0" },
  phHealthFacilities: { theme: "醫療", group: "點位", zh: "醫療院所", alt: "Health Facilities", icon: Hospital, dataset: "ph_health_facilities", topics: T("醫療", "醫院", "診所", "藥局", "OSM"),
    description: "OpenStreetMap 醫療院所 17,766 處（醫院、診所、衛生站、藥局、牙科；拉遠為熱區）", processing: OSM_PROC("amenity=hospital／clinic／pharmacy／dentist／doctors 與 healthcare=*", "health_facilities z7–14"), note: "ODbL 1.0；DOH NHFR 需登入未使用；BARMM 稀疏" },
  phFireStations: { theme: "消防", group: "點位", zh: "消防站", alt: "Fire Stations", icon: Flame, dataset: "ph_fire_stations", topics: T("消防", "消防站", "BFP", "OSM"),
    description: "BFP 消防站 1,316 處＋OSM 補缺 742 處（空心）", processing: GFI_PROC("bfp_office", "fire_stations z6–14") + "；OSM 只補 BFP 300 m 內沒有的點", note: "Geoportal Conditional downloading＋OSM ODbL" },
  phNcrSafeOpenSpaces: { theme: "民防避難", group: "避難設施", zh: "避難空地（Metro Manila）", alt: "Safe Open Spaces (Metro Manila)", icon: LifeBuoy, dataset: "ph_ncr_safe_open_spaces", topics: T("民防避難", "避難", "地震", "馬尼拉", "MMDA"),
    description: "Metro Manila 地震避難空地 5,211 面（只涵蓋 NCR；依規模三色；完整性未驗證）", processing: GFI_PROC("safe open spaces", "safe_open_spaces z10–16"), note: "Open（MO 008）；全國一次 5,211、象限 5,005，圖例寫「部分」" },
  phPoliceStations: { theme: "執法治安", group: "警政", zh: "警察據點", alt: "Police Stations", icon: Siren, dataset: "ph_police_stations", topics: T("執法治安", "警察", "MMDA", "OSM"),
    description: "警察據點 2,629 處（NCR 為 MMDA 2003 地標 191 處；其他地區只有 OSM，空心）", processing: GFI_PROC("landmark_point10k 警政類", "police_stations z7–14") + "；OSM 補缺", note: "MMDA Conditional＋OSM ODbL；PNP 全國駐所無公開座標" },
  phJails: { theme: "執法治安", group: "司法矯正", zh: "監所", alt: "Jails & Prisons", icon: Lock, dataset: "ph_jails", topics: T("執法治安", "監所", "監獄", "BJMP", "BuCor"),
    description: "BJMP 監所 462 處（2020，含在押人數）＋OSM 96 處（含 BuCor 監獄，空心）", processing: GFI_PROC("bjmp_managementunit_20200826", "jails z6–14") + "；OSM 補缺", note: "BJMP Conditional＋OSM ODbL" },
  // ── 第 6 波
  phTrees: { theme: "環境氣候", group: "都市樹木", zh: "樹木（OSM）", alt: "Trees (OSM)", icon: Trees, dataset: "ph_trees", topics: T("環境氣候", "樹木", "行道樹", "OSM"),
    description: "OpenStreetMap 樹木 228,210 株＋行道樹 3,415 段（零星標註；z12 起顯示）", processing: OSM_PROC("natural=tree、natural=tree_row", "trees、tree_rows z12–16"), note: "ODbL 1.0；Bicol、BARMM 稀疏" },
  phTrails: { theme: "林業", group: "線", zh: "農林道與步道", alt: "Tracks & Paths", icon: Footprints, dataset: "ph_trails", topics: T("林業", "步道", "農路", "OSM"),
    description: "OpenStreetMap 農林道 116,128 段＋步道 104,471 段（z10 起顯示）", processing: OSM_PROC("highway=track、highway=path", "trails z10–14"), note: "ODbL 1.0" },
  phKba: { theme: "自然保育", group: "綠網與生態", zh: "生物多樣性重要地域（KBA）", alt: "Key Biodiversity Areas", icon: Leaf, dataset: "ph_kba", topics: T("自然保育", "生物多樣性", "KBA"),
    description: "Key Biodiversity Areas 310 處（已認定 120 實線框、提案 190 虛線框）", processing: "KBA 菲律賓資料集 → 4326；排除卡拉延 1、國界外 4；PMTiles kba z4–12", note: "CC BY；NCR 沒有 KBA（實況）" },
  phWetlands: { theme: "自然保育", group: "濕地", zh: "濕地", alt: "Wetlands", icon: Shrub, dataset: "ph_wetlands", topics: T("自然保育", "濕地", "紅樹林", "BMB", "OSM"),
    description: "BMB 內陸濕地 384 面（部分）＋OSM 濕地 8,293 面（含紅樹林，淡色）", processing: GFI_PROC("bmb inland wetlands", "wetlands_official、wetlands_osm z6–14") + "；OSM natural=wetland", note: "BMB Conditional（完整性未驗證）＋OSM ODbL" },
  phForestryPrograms: { theme: "林業", group: "分區", zh: "林業計畫區", alt: "Forestry Programme Areas", icon: Sprout, dataset: "ph_forestry_programs", topics: T("林業", "造林", "NGP", "集水區", "DENR"),
    description: "DENR-FMB 林業計畫區 17,943 面（NGP 造林、投資區、集水區兩類（部分）、FLAg；完整性未驗證）", processing: GFI_PROC("fmb ngp／investment／watershed／flag", "forestry_programs z6–14") + "；聯絡人、地址已排除", note: "FMB Conditional；集水區未收斂，圖例寫「部分」" },
  // ── 第 7 波
  phCoastalResources: { theme: "海洋", group: "海域環境", zh: "海岸資源（珊瑚、海草、紅樹林）", alt: "Coastal Resources", icon: Shell, dataset: "ph_coastal_resources", topics: T("海洋", "珊瑚", "海草", "紅樹林", "NAMRIA"),
    description: "NAMRIA 2020 海岸資源圖 195 面（珊瑚、海草海藻、紅樹林；依省聚合）", processing: GFI_PROC("coastal resources 2020", "coastal_resources z5–13"), note: "Open（MO 008）" },
  phMarineStations: { theme: "海洋", group: "調查站網", zh: "潮位站與航標", alt: "Tide Stations & Navigation Aids", icon: Ship, dataset: "ph_marine_stations", topics: T("海洋", "潮位站", "燈塔", "浮標", "NAMRIA"),
    description: "NAMRIA 潮位站 82（一級 62、二級 20 空心）、燈浮標 617、燈塔 609", processing: GFI_PROC("tide stations、lighted buoys、lighthouses", "marine_stations z6–14") + "；觀測員姓名已排除", note: "潮位站、燈浮標 Open；燈塔 Conditional" },
  phWdpca: { theme: "自然保育", group: "保護區", zh: "保護區（WDPA）", alt: "Protected Areas (WDPA)", icon: Leaf, dataset: "ph_wdpca", topics: T("自然保育", "保護區", "海洋保護區", "WDPA", "國家公園"),
    description: "WDPA 菲律賓保護區 302 處（陸域、海域、陸海混合三色；非商用，只供顯示）", processing: "Protected Planet WDPA／WD-OECM 濾菲律賓 → 扣國界外與卡拉延 6 處；PMTiles wdpca z4–12", note: "WDPA Terms of Use 非商用；DISPLAY_ONLY、不入倉；BMB 官方層 HOLD" },
  phWasteFacilities: { theme: "廢棄物", group: "處理設施", zh: "掩埋場與轉運站", alt: "Landfills & Transfer Stations", icon: Recycle, dataset: "ph_waste_facilities", topics: T("廢棄物", "掩埋場", "轉運站", "DENR", "OSM"),
    description: "DENR 衛生掩埋場 23 處＋OSM 掩埋場 181、轉運站 51（OSM 空心，不分衛生或開放傾倒）", processing: GFI_PROC("denr_landfill", "waste_facilities z6–14") + "；OSM landuse=landfill、amenity=waste_transfer_station", note: "DENR Conditional＋OSM ODbL" },
  phPollutionSources: { theme: "環境氣候", group: "環境污染", zh: "推估排放源（Climate TRACE）", alt: "Modelled Emission Sources", icon: Factory, dataset: "ph_pollution_sources", topics: T("環境氣候", "污染", "排放", "Climate TRACE"),
    description: "Climate TRACE 2025 推估排放源 85 處（製造業、礦業；大小依推估 CO₂e；不是官方許可名冊）", processing: "Climate TRACE 資料集濾菲律賓 manufacturing／mineral-extraction；PMTiles pollution_sources z5–14", note: "CC BY 4.0；推估值" },
  // ── 第 8 波
  phArtsVenues: { theme: "文化", group: "藝文活動", zh: "表演場館與電影院", alt: "Arts Venues & Cinemas", icon: Theater, dataset: "ph_arts_venues", topics: T("文化", "劇場", "電影院", "藝文", "OSM"),
    description: "OpenStreetMap 表演場館 1,107 處（活動場地、劇場、電影院、藝文中心、展覽館）", processing: OSM_PROC("amenity=theatre／arts_centre／cinema／events_venue／exhibition_centre", "arts_venues z8–14"), note: "ODbL 1.0；BARMM 稀疏" },
  phPostOffices: { theme: "基礎建設", group: "郵政與便民", zh: "郵局與快遞據點", alt: "Post Offices & Couriers", icon: Mail, dataset: "ph_post_offices", topics: T("基礎建設", "郵局", "快遞", "PHLPost", "OSM"),
    description: "OpenStreetMap 郵局與快遞據點 1,006 處（含 LBC、J&T）", processing: OSM_PROC("amenity=post_office", "post_offices z7–14"), note: "ODbL 1.0；BARMM 稀疏" },
  phPublicFacilities: { theme: "基礎建設", group: "公共生活", zh: "廳舍、市場與公共設施", alt: "Halls, Markets & Public Facilities", icon: Building2, dataset: "ph_public_facilities", topics: T("基礎建設", "公共設施", "市場", "公廁", "圖書館", "OSM"),
    description: "OpenStreetMap 公共生活設施 19,711 處（廳舍、公廁、市場、社區中心、社福、圖書館；拉遠為熱區）", processing: OSM_PROC("amenity=townhall／library／community_centre／marketplace／social_facility／toilets", "public_facilities z8–14"), note: "ODbL 1.0；BARMM 稀疏" },
  phFinancialServices: { theme: "基礎建設", group: "金融據點", zh: "銀行、當鋪與 ATM", alt: "Banks, Pawnshops & ATMs", icon: Banknote, dataset: "ph_financial_services", topics: T("基礎建設", "銀行", "當鋪", "ATM", "匯款", "OSM"),
    description: "OpenStreetMap 金融據點 17,506 處（銀行、當鋪、ATM、匯款、外幣兌換；拉遠為熱區）", processing: OSM_PROC("amenity=bank／atm／bureau_de_change／money_transfer、shop=pawnbroker", "financial_services z9–14"), note: "ODbL 1.0；BARMM 稀疏" },
  phPlacesOfWorship: { theme: "宗教", group: "點位", zh: "宗教場所", alt: "Places of Worship", icon: Church, dataset: "ph_places_of_worship", topics: T("宗教", "教堂", "清真寺", "OSM"),
    description: "OpenStreetMap 宗教場所 18,341 處（基督宗教、伊斯蘭、佛教、道教、未標宗教；拉遠為熱區）", processing: OSM_PROC("amenity=place_of_worship", "places_of_worship z8–14"), note: "ODbL 1.0；未標宗教不由名稱猜" },
  // ── 第 9 波
  phSportsVenues: { theme: "運動休閒", group: "運動場館", zh: "運動場館", alt: "Sports Venues", icon: Trophy, dataset: "ph_sports_venues", topics: T("運動休閒", "球場", "體育場", "OSM"),
    description: "OpenStreetMap 運動場館 36,709 處（球場、室內場館、運動中心、跑道、體育場；拉遠為熱區）", processing: OSM_PROC("leisure=pitch／sports_hall／sports_centre／track／stadium", "sports_venues z9–14"), note: "ODbL 1.0；有名稱只有 24%" },
  phParks: { theme: "運動休閒", group: "公園", zh: "公園與庭園", alt: "Parks & Gardens", icon: Trees, dataset: "ph_parks", topics: T("運動休閒", "公園", "OSM"),
    description: "OpenStreetMap 公園、庭園面 6,570＋點 454", processing: OSM_PROC("leisure=park／garden", "parks、points z9–15"), note: "ODbL 1.0；BARMM 稀疏" },
  phCemeteries: { theme: "殯葬", group: "墓區範圍", zh: "墓園", alt: "Cemeteries", icon: Cross, dataset: "ph_cemeteries", topics: T("殯葬", "墓園", "墓地", "OSM"),
    description: "OpenStreetMap 墓區面 4,263＋點 110（墓園、教堂墓地）", processing: OSM_PROC("landuse=cemetery、amenity=grave_yard", "cemeteries、points z9–15"), note: "ODbL 1.0；BARMM、NCR 稀疏" },
  phFishPorts: { theme: "農業", group: "點位", zh: "漁港", alt: "Fish Ports", icon: Fish, dataset: "ph_fish_ports", topics: T("農業", "漁港", "漁業", "DA"),
    description: "DA 漁港 47 處（營運 39、興建中 8）", processing: GFI_PROC("da fish ports", "fish_ports z5–14"), note: "Geoportal No restriction" },
  phAquaculture: { theme: "農業", group: "養殖漁業", zh: "養殖用地（OSM）", alt: "Aquaculture (OSM)", icon: Fish, dataset: "ph_aquaculture", topics: T("農業", "養殖", "魚塭", "OSM"),
    description: "OpenStreetMap 養殖面 16,629 個（多數未標物種；z9 起顯示）", processing: OSM_PROC("landuse=aquaculture、aquaculture=*", "aquaculture z9–15"), note: "ODbL 1.0；未標物種不等於魚類" },
};
