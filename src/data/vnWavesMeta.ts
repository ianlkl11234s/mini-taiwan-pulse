/**
 * 越南觀光波與第 2–7 波（2026-11-17）manifest 中介資料：主題／群組（對齊台灣面板、比照菲律賓）、名稱、icon、dataset、說明。
 * 規格本身在 vnWavesLayers.ts；layerManifest 的 VN_DATA_ENTRY_META 展開 VN_WAVE_ENTRY_META，raster 4 層用 VN_RASTER_META。
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity, Banknote, BedDouble, Bike, Church, CloudRain, Droplet, Droplets, Fish, Gavel, GraduationCap, Hospital, Landmark, Layers, Leaf,
  Mail, MapPinned, Milestone, Mountain, Pickaxe, School, Shield, Sprout, SquareParking, Tag, Toilet, Tractor, TreePalm, Trees, TriangleAlert, Waves,
} from "lucide-react";
import type { VnDataKey, VnRasterKey } from "./vnDataKeys";

export interface VnEntryMeta { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }

const OSM_PROC = (q: string, tile: string) => `Geofabrik vietnam-latest.osm.pbf（2026-11-12）取 ${q}；面與線取代表點；34 省空間判定（省界外取最近省）、南海兩特區不輸出；PMTiles ${tile}`;
const TOUR_PROC = (tile: string) => `OSM＋UNESCO whc001＋Wikidata（sitelinks、P31）＋國家級旅遊區清單合併；tier 1 UNESCO／國家級旅遊區（含規劃潛力）／保護區 z4、tier 2 sitelinks ≥5 z7、tier 3 有名稱 z10、未命名 z12；PMTiles ${tile}`;
const T = (...xs: string[]) => ["越南", ...xs];

type W = Exclude<VnDataKey, "vnStations" | "vnTransportHubs" | "vnMajorRoads" | "vnPowerPlants" | "vnRenewables" | "vnPowerGrid" | "vnFuelStations" | "vnOilGas" | "vnEnvisoftStations" | "vnAngiangDemo">;

export const VN_WAVE_ENTRY_META: Record<W, VnEntryMeta> = {
  // ── 觀光波
  vnTourAttractions: { theme: "觀光", group: "玩・人文", zh: "景點與世界遺產", alt: "Attractions & World Heritage", icon: Landmark, dataset: "vn_tourist_attractions", topics: T("觀光", "景點", "世界遺產", "UNESCO", "古蹟", "寺廟", "博物館", "OSM", "Wikidata"),
    description: "越南景點 2,885 處（UNESCO 世界遺產 9 處、國家公園與保護區、古蹟寺廟、博物館、觀景點；低縮放只顯示重要條目）", processing: TOUR_PROC("tourist_attractions z4–14"), note: "ODbL＋CC BY-SA 4.0＋CC0；知名度分級不代表遊客量" },
  vnTourNature: { theme: "觀光", group: "玩・自然", zh: "海灘、島嶼、瀑布與洞穴", alt: "Beaches, Islands, Waterfalls & Caves", icon: TreePalm, dataset: "vn_nature_spots", topics: T("觀光", "海灘", "島嶼", "瀑布", "洞穴", "潛水", "OSM", "Wikidata"),
    description: "越南自然景點 1,967 處（海灘 649、小島 402、瀑布 333、島 271、洞穴 256 等）", processing: TOUR_PROC("nature_spots z4–14"), note: "ODbL＋CC0；未命名海灘與小島放大後才出現" },
  vnTourServices: { theme: "觀光", group: "住・食", zh: "住宿與觀光服務", alt: "Lodging & Tourism Services", icon: BedDouble, dataset: "vn_tourism_services", topics: T("觀光", "住宿", "旅館", "度假村", "露營", "遊客中心", "OSM"),
    description: "越南住宿、度假村、樂園動物園、露營地與遊客中心 8,490 處（OSM；餐飲不在本層）", processing: TOUR_PROC("tourism_services z4–14（一般條目 z10 起）"), note: "ODbL 1.0；非官方登記旅宿" },
  vnNationalTouristAreas: { theme: "觀光", group: "玩・體驗", zh: "國家級旅遊區", alt: "National Tourist Areas", icon: MapPinned, dataset: "vn_national_tourist_areas", topics: T("觀光", "國家級旅遊區", "KDLQG"),
    description: "越南國家級旅遊區 63 處（已認證 9、規劃潛力 54 空心；清單 70 處中 7 處未定位）", processing: "vi.wikipedia「Khu du lịch quốc gia」清單 → 座標依 vi.wikipedia、Wikidata P625、Nominatim 依序補；34 省空間判定；PMTiles national_tourist_areas z4–14", note: "CC BY-SA 4.0＋CC0＋ODbL；未對官方決定原文；點是代表點，不是旅遊區範圍" },
  // ── 第 2 波
  vnPlaceNames: { theme: "底圖", group: "地名 Gazetteer", zh: "地名", alt: "Place Names", icon: Tag, dataset: "vn_place_names", topics: T("底圖", "地名", "聚落", "城市", "村", "OSM"),
    description: "越南地名 22,509 筆（城市、市鎮、城區、村、小聚落等；依等級逐級出現，名稱在彈窗）", processing: OSM_PROC("place=city／town／suburb／village／hamlet 等", "place_names z5–14（逐筆 minzoom 5／8／10／12）"), note: "ODbL 1.0；不畫文字標籤（PMTiles symbol 會讓地圖 render 中止）" },
  vnBicycleRental: { theme: "交通", group: "共享運具", zh: "自行車租借", alt: "Bicycle Rental", icon: Bike, dataset: "vn_bicycle_rental", topics: T("交通", "自行車", "共享單車", "租借", "OSM"),
    description: "越南自行車租借點 177 處（OSM；17/34 省有資料）", processing: OSM_PROC("amenity=bicycle_rental", "bicycle_rental z8–14"), note: "ODbL 1.0；非營運商站點清單" },
  vnBridges: { theme: "交通", group: "路網結構", zh: "橋梁", alt: "Bridges", icon: Milestone, dataset: "vn_bridges", topics: T("交通", "橋梁", "高架", "OSM"),
    description: "越南橋梁 138,439 段（主要道路、一般道路、步道、鐵路四色；OSM bridge=*）", processing: OSM_PROC("bridge=* 的道路與鐵路線段", "bridges z8–14（主要道路與鐵路 z8、其餘 z12）"), note: "ODbL 1.0；23.7 MB 走 deploy-assets" },
  vnParking: { theme: "交通", group: "停車", zh: "停車場", alt: "Car Parks", icon: SquareParking, dataset: "vn_parking", topics: T("交通", "停車", "機車", "OSM"),
    description: "越南停車場 3,149 處（汽車、機車兩色；74% 沒標停車型態）", processing: OSM_PROC("amenity=parking／motorcycle_parking", "parking z10–14"), note: "ODbL 1.0" },
  // ── 第 3 波
  vnGlideEvents: { theme: "災害", group: "災害事件", zh: "重大災害事件（GLIDE）", alt: "Disaster Events (GLIDE)", icon: CloudRain, dataset: "vn_glide_events", topics: T("災害", "洪水", "颱風", "崩塌", "乾旱", "GLIDE"),
    description: "越南 GLIDE 災害事件 181 筆（洪水、颱風、山洪、崩塌、乾旱、疫情等；省級代表點，不是受災範圍）", processing: "HDX Viet Nam - GLIDE Disaster Events → 地點對 34 省（颱風路徑面改代表點；海上 30 km 外與鄰國 10 筆不畫）；PMTiles glide_events z4–12", note: "CC BY-IGO；靜態快照，不隨時間軸" },
  vnDams: { theme: "水資源", group: "水利設施", zh: "壩與水庫", alt: "Dams & Reservoirs", icon: Droplets, dataset: "vn_dams", topics: T("水資源", "水壩", "水庫", "水力發電", "GDW"),
    description: "Global Dam Watch 越南壩 558 座＋水庫面 491 個（九成壩沒標用途）", processing: "GDW v1.0 壩點與水庫面濾越南；34 省空間判定；PMTiles dams、reservoirs z4–13", note: "CC BY 4.0" },
  vnRivers: { theme: "水資源", group: "面／線", zh: "河川", alt: "Rivers", icon: Waves, dataset: "vn_rivers", topics: T("水資源", "河川", "水系", "ODM"),
    description: "越南河川 2,013 段（依河川級序 1–6 分粗細）", processing: "ODM CKAN River network of Viet Nam → 4326；PMTiles rivers z4–12", note: "ODM 標 CC BY-SA 4.0（原始機關未載明）；資料年不明" },
  vnWaterSupply: { theme: "水資源", group: "自來水", zh: "自來水設施", alt: "Water Supply Facilities", icon: Droplet, dataset: "vn_water_supply", topics: T("水資源", "自來水", "淨水場", "抽水站", "水塔", "OSM"),
    description: "越南淨水場、抽水站、水塔與配水池 241 處（OSM；25/34 省有資料）", processing: OSM_PROC("man_made=water_works／pumping_station／water_tower 等", "water_supply z8–14"), note: "ODbL 1.0" },
  vnWaterStructures: { theme: "水資源", group: "水利設施", zh: "堰、閘門與水門", alt: "Weirs, Locks & Sluices", icon: Droplets, dataset: "vn_water_structures", topics: T("水資源", "水利", "堰", "閘門", "水門", "OSM"),
    description: "越南壩、堰、船閘與水門 1,529 處（OSM；線與面取代表點）", processing: OSM_PROC("waterway=dam／weir／lock_gate／sluice_gate", "water_structures z8–14"), note: "ODbL 1.0" },
  vnRiverbankErosion: { theme: "災害", group: "河岸侵蝕", zh: "河岸與海岸侵蝕點", alt: "Riverbank & Coastal Erosion Points", icon: TriangleAlert, dataset: "vn_riverbank_erosion", topics: T("災害", "侵蝕", "河岸", "海岸", "崩岸", "ODM"),
    description: "越南河岸與海岸侵蝕點 190 處（依警戒等級分色；約 2016–2020 舊資料）", processing: "ODM CKAN Landslide points over whole country → 4326；34 省空間判定；PMTiles riverbank_erosion z5–14", note: "授權未明示（ODM 標 CC BY-SA 4.0）；說明為機器英譯" },
  // ── 第 4 波
  vnSchools: { theme: "教育", group: "學校 Schools", zh: "學校", alt: "Schools", icon: School, dataset: "vn_schools", topics: T("教育", "學校", "大學", "OSM"),
    description: "越南學校 9,879 處（中小學、學院專科、大學三色；OSM）", processing: OSM_PROC("amenity=school／college／university", "schools z7–14"), note: "ODbL 1.0；官方學校名冊未公開" },
  vnSchoolCampuses: { theme: "教育", group: "校地 Campus", zh: "校地範圍", alt: "School Campuses", icon: GraduationCap, dataset: "vn_school_campuses", topics: T("教育", "校地", "學校", "OSM"),
    description: "越南校地面 9,695 個（中小學、幼兒園、學院、大學；z11 起顯示）", processing: "Geofabrik vietnam-latest.osm.pbf（2026-11-12）取 amenity=school 等的面；34 省空間判定；PMTiles school_campuses z11–15", note: "ODbL 1.0" },
  vnKindergartens: { theme: "教育", group: "學校 Schools", zh: "幼兒園與托育", alt: "Kindergartens & Childcare", icon: School, dataset: "vn_kindergartens", topics: T("教育", "幼兒園", "托育", "OSM"),
    description: "越南幼兒園與托育 1,729 處（OSM；33/34 省有資料）", processing: OSM_PROC("amenity=kindergarten／childcare", "kindergartens z9–14"), note: "ODbL 1.0" },
  vnHealthFacilities: { theme: "醫療", group: "點位", zh: "醫療院所", alt: "Health Facilities", icon: Hospital, dataset: "vn_health_facilities", topics: T("醫療", "醫院", "診所", "藥局", "牙科", "OSM"),
    description: "越南醫院、診所、藥局與牙科 6,117 處（OSM；官方醫院名冊未公開）", processing: OSM_PROC("amenity=hospital／clinic／pharmacy／dentist 等", "health_facilities z7–14"), note: "ODbL 1.0" },
  vnPolice: { theme: "執法治安", group: "警政", zh: "警察據點", alt: "Police", icon: Shield, dataset: "vn_police", topics: T("執法治安", "警察", "公安", "OSM"),
    description: "越南警察據點 1,135 處（OSM；33/34 省有資料）", processing: OSM_PROC("amenity=police", "police z8–14"), note: "ODbL 1.0" },
  vnCourtsPrisons: { theme: "執法治安", group: "司法矯正", zh: "法院與監所", alt: "Courts & Prisons", icon: Gavel, dataset: "vn_courts_prisons", topics: T("執法治安", "法院", "監獄", "OSM"),
    description: "越南法院與監所 289 處（OSM；31/34 省有資料）", processing: OSM_PROC("amenity=courthouse／prison", "courts_prisons z7–14"), note: "ODbL 1.0" },
  // ── 第 5 波
  vnPostalServices: { theme: "基礎建設", group: "郵政與便民", zh: "郵局、市場與便民據點", alt: "Post Offices, Markets & Services", icon: Mail, dataset: "vn_postal_services", topics: T("基礎建設", "郵局", "便利商店", "市場", "超市", "人民委員會", "OSM"),
    description: "越南郵局、便利商店、市場、超市、購物中心與廳舍 12,081 處（OSM）", processing: OSM_PROC("amenity=post_office／marketplace／townhall、shop=convenience／supermarket／mall", "postal_services z9–14"), note: "ODbL 1.0" },
  vnPublicAmenities: { theme: "基礎建設", group: "公共生活", zh: "公廁、飲水與回收點", alt: "Toilets, Drinking Water & Recycling", icon: Toilet, dataset: "vn_public_amenities", topics: T("基礎建設", "公廁", "飲水機", "回收", "垃圾桶", "OSM"),
    description: "越南公廁、飲水機、垃圾收集與回收點 1,316 處（OSM；33/34 省有資料）", processing: OSM_PROC("amenity=toilets／drinking_water／waste_disposal／recycling", "public_amenities z10–14"), note: "ODbL 1.0" },
  vnFinancialServices: { theme: "基礎建設", group: "金融據點", zh: "銀行與 ATM", alt: "Banks & ATMs", icon: Banknote, dataset: "vn_financial_services", topics: T("基礎建設", "銀行", "ATM", "外幣兌換", "OSM"),
    description: "越南銀行、ATM 與外幣兌換 5,962 處（OSM）", processing: OSM_PROC("amenity=bank／atm／bureau_de_change", "financial_services z9–14"), note: "ODbL 1.0" },
  vnPlacesOfWorship: { theme: "宗教", group: "點位", zh: "宗教場所", alt: "Places of Worship", icon: Church, dataset: "vn_places_of_worship", topics: T("宗教", "佛寺", "教堂", "高台教", "亭", "廟", "OSM"),
    description: "越南宗教場所 7,449 處（佛教、基督宗教、高台教、民間信仰等；1,884 處未標宗教）", processing: OSM_PROC("amenity=place_of_worship（依 religion 分類，未標不由名稱猜）", "places_of_worship z8–14"), note: "ODbL 1.0" },
  // ── 第 6 波
  vnParks: { theme: "運動休閒", group: "公園", zh: "公園、庭園與遊戲場", alt: "Parks, Gardens & Playgrounds", icon: Trees, dataset: "vn_parks", topics: T("運動休閒", "公園", "庭園", "遊戲場", "OSM"),
    description: "越南公園、庭園與遊戲場面 5,669 個＋只有點的 392 處（OSM）", processing: "Geofabrik vietnam-latest.osm.pbf（2026-11-12）取 leisure=park／garden／playground；面保留、只有點者另成 points；PMTiles parks、points z9–15", note: "ODbL 1.0" },
  vnProtectedAreasOdm: { theme: "自然保育", group: "保護區", zh: "保護區（ODM，非商用）", alt: "Protected Areas (ODM, non-commercial)", icon: Leaf, dataset: "vn_protected_areas_odm", topics: T("自然保育", "保護區", "國家公園", "自然保護區", "濕地", "ODM", "WDPA"),
    description: "越南保護區 171 區（國家公園、自然保護區、物種與棲地、景觀保護區、濕地、特用林；上游 WDPA 2016）", processing: "ODM CKAN 保護區（WDPA 2016 via ADB）→ 4326；同名同型別合併；PMTiles protected_areas z4–12", note: "非商用（ODM 使用限制，從嚴）；國家公園 32 個名稱（官方 34）" },
  // ── 第 7 波
  vnAngiangAquaculture: { theme: "農業", group: "養殖漁業", zh: "安江養殖用地", alt: "An Giang Aquaculture Land", icon: Fish, dataset: "vn_angiang_aquaculture", topics: T("農業", "養殖", "養蝦", "稻蝦", "安江"),
    description: "越南安江省養殖用地分區 9,504 面（稻蝦、稻魚、專業養蝦、海上養殖等；只涵蓋安江省）", processing: "安江省開放資料入口 GIS 圖層 → 4326；只輸出位置與分區類別（W7-1）；PMTiles aquaculture z8–14", note: "授權未明示；只涵蓋安江省（原堅江範圍），其他 33 省未涵蓋；面積等數值不顯示" },
  vnFieldBoundaries: { theme: "農業", group: "農地與農路", zh: "農田邊界樣本（AI 判讀）", alt: "Field Boundary Samples (AI-detected)", icon: Sprout, dataset: "vn_field_boundaries", topics: T("農業", "農田", "地塊", "AI", "Fields of The World"),
    description: "越南農田邊界 120,913 塊（Fields of The World 30 個樣本圖磚，約 5×5 km；不是全國）", processing: "FTW AI4SmallFarms Vietnam subset GeoParquet → 4326；34 省空間判定；PMTiles field_boundaries z10–15", note: "CC BY 4.0；20.5 MB 走 deploy-assets；只有樣本範圍" },
  vnSoil: { theme: "農業", group: "土壤", zh: "土壤類型", alt: "Soil Types", icon: Layers, dataset: "vn_soil", topics: T("農業", "土壤", "FAO", "ODM"),
    description: "越南土壤類型 230 面（FAO 九大類；小比例尺參考圖）", processing: "ODM CKAN Soil types of Vietnam → 4326；PMTiles soil z4–11", note: "授權未明示（ODM 標 CC BY-SA 4.0）；不適合地塊判讀" },
  vnFarmTracks: { theme: "農業", group: "農地與農路", zh: "農林道", alt: "Farm & Forest Tracks", icon: Tractor, dataset: "vn_farm_tracks", topics: T("農業", "農路", "林道", "OSM"),
    description: "越南農林道 145,862 段（highway=track，依 tracktype 1–5 級分色；96% 未標等級）", processing: OSM_PROC("highway=track（線）", "farm_tracks z10–14"), note: "ODbL 1.0；32.4 MB 走 deploy-assets" },
  vnCoalMines: { theme: "能源", group: "礦業", zh: "煤礦", alt: "Coal Mines", icon: Pickaxe, dataset: "vn_coal_mines", topics: T("能源", "礦業", "煤礦", "GEM"),
    description: "越南煤礦 32 處（Global Energy Monitor；運轉中、提案、封存、取消；6/34 省）", processing: "GEM Global Coal Mine Tracker（2026-05）濾越南；34 省空間判定；PMTiles coal_mines z5–14", note: "CC BY 4.0；其他礦區與礦業權圖資未找到" },
};

/** raster 4 層：沒有 feature 屬性與 popup。 */
export const VN_RASTER_META: Record<VnRasterKey, VnEntryMeta> = {
  vnTerrainHillshade: { theme: "底圖", group: "地形", zh: "山體陰影", alt: "Hillshade", icon: Mountain, dataset: "vn_terrain", topics: T("底圖", "地形", "陰影", "Copernicus DEM"),
    description: "越南山體陰影（Copernicus DEM GLO-90，約 90 m；只保留陸域）", processing: "Copernicus DEM GLO-90 → gdaldem hillshade → 34 省陸域遮罩（南海兩特區不含）→ PNG raster PMTiles z5–10", note: "Copernicus DEM（免費、要署名）；22.2 MB 走 deploy-assets；沒有 feature 屬性與 popup" },
  vnTerrainRelief: { theme: "底圖", group: "地形", zh: "色別標高", alt: "Elevation Tint", icon: Mountain, dataset: "vn_terrain", topics: T("底圖", "地形", "標高", "Copernicus DEM"),
    description: "越南色別標高（0–3,147 m 九段色帶，≤0 m 透明）", processing: "Copernicus DEM GLO-90 → gdaldem color-relief（≤0 m 透明）→ 陸域遮罩 → PNG raster PMTiles z5–10", note: "Copernicus DEM（免費、要署名）；沒有 feature 屬性與 popup" },
  vnLandslideSusceptibility: { theme: "災害", group: "崩塌", zh: "崩塌潛勢（區域模型圖）", alt: "Landslide Susceptibility (regional model)", icon: Activity, dataset: "vn_landslide_susceptibility", topics: T("災害", "崩塌", "山崩", "潛勢", "ODM"),
    description: "越南崩塌潛勢（低、中、高三級；極低不畫；區域模型圖，只有圖、不能分析）", processing: "ODM GeoServer WMS ODVietnam:landslide_level_vn（無 CORS）→ 2026-11-17 預渲染 PNG raster PMTiles z5–9（34 省遮罩、極低透明；analytics pipelines/misc/vn/09_landslide_raster.py）", note: "授權未明示（ODM 標 CC BY-SA 4.0）；只有圖、不入倉" },
  vnWdpca: { theme: "自然保育", group: "保護區", zh: "保護區（WDPCA，站主限定）", alt: "Protected Areas (WDPCA, owner only)", icon: Leaf, dataset: "vn_wdpca", topics: T("自然保育", "保護區", "WDPCA", "Ramsar", "世界遺產", "生物圈保留區"),
    description: "越南 WDPCA 保護區 188 面＋Ramsar 點 3（raster 圖片，依類別上色；站主限定）", processing: "WDPCA 2026 越南子集 → 3857 gdal_rasterize（z11 ≈76 m/px，生物圈保留區與世界遺產只畫外框）→ PNG raster PMTiles z5–12（analytics pipelines/misc/vn/08_wdpca_raster.py）", note: "WDPCA 條款禁再散布與可下載地圖（W6-1 站主 2026-11-17 選 A＋B）：只發 raster＋署名、站主限定；非商用；圖磚走私有 owner-data，不進公開上傳清單" },
};
