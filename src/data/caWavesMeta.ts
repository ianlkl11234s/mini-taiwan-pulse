/**
 * 加拿大第 3–8 波（2026-11-17）manifest 中介資料：主題／群組（對齊台灣面板、比照越南與菲律賓）、名稱、icon、dataset、說明。
 * 規格本身在 caWavesLayers.ts；layerManifest 的 CA_WAVE_MANIFEST_ENTRIES 讀這裡。資料端 taipei-gis-analytics #402。
 */
import type { LucideIcon } from "lucide-react";
import {
  Anchor, Baby, Beef, Bird, CarFront, Construction, Droplets, Dumbbell, Flame, Gavel, Hospital, Layers, Leaf, MountainSnow,
  Pickaxe, Recycle, School, Shield, Ship, Snowflake, Store, Sun, Tent, Theater, TriangleAlert, Trees, Warehouse, Waves, Waypoints, Wifi, Fish, KeyRound,
} from "lucide-react";
import type { CaWaveKey } from "./caWavesKeys";

export interface CaWaveEntryMeta { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }

const T = (...xs: string[]) => ["加拿大", ...xs];
const PROC = (wave: string, extra: string) => `taipei-gis-analytics pipelines/misc/ca/${wave}_build.py：${extra}；省區以 2021 CBF 省界空間判定；PMTiles 不進 Supabase（ADR-0026）`;

export const CA_WAVE_ENTRY_META: Record<CaWaveKey, CaWaveEntryMeta> = {
  // ── 第 2 波 C002 ＋ 第 3 波
  caMaritimeZones: { theme: "底圖", group: "海域界線", zh: "海域界線（領海、鄰接區、EEZ）", alt: "Maritime Zones", icon: Anchor, dataset: "ca_maritime_zones", topics: T("海域", "領海", "EEZ", "海洋界線", "VLIZ"),
    description: "加拿大領海、鄰接區、專屬經濟區與加美重疊主張區 4 面＋海域界線（VLIZ Marine Regions，非官方界線）", processing: "pipelines/base_map/ca/maritime_zones/07_export.py：VLIZ WFS（EEZ v12、12／24 浬 v4）→ 4326；PMTiles ca_maritime_zones（面）＋ca_maritime_boundaries（線）z1–9", note: "CC BY 4.0；非加拿大官方界線" },
  caPermafrost: { theme: "災害", group: "永凍土與冰川", zh: "永凍土分布", alt: "Permafrost", icon: Snowflake, dataset: "ca_permafrost", topics: T("永凍土", "地下冰", "Atlas of Canada"),
    description: "加拿大永凍土分布 442 面（連續、廣泛不連續、零星、孤立、海底；1993 年地圖）", processing: PROC("w03", "Atlas of Canada Permafrost → 4326；無永凍土（U）不畫；PMTiles z2–8"), note: "OGL-Canada；1993 年地圖" },
  caDams: { theme: "水資源", group: "水利設施", zh: "水壩（BC、ON）", alt: "Dams (BC, ON)", icon: Waves, dataset: "ca_dams", topics: T("水壩", "水庫", "BC", "安大略"),
    description: "加拿大水壩 4,377 座（卑詩 2,485、安大略 1,892；其他 11 省區未涵蓋）", processing: PROC("w03", "BC Dams（WRIS）＋Ontario Dam Inventory（LIO）合併；PMTiles z3–11"), note: "OGL-BC、OGL-Ontario；2／13" },
  caRecyclingDepots: { theme: "環境氣候", group: "廢棄物", zh: "回收投放點（QC、MB）", alt: "Recycling Depots (QC, MB)", icon: Recycle, dataset: "ca_recycling_depots", topics: T("回收", "廢棄物", "生態中心", "魁北克", "曼尼托巴"),
    description: "加拿大回收投放點 2,466 處（曼尼托巴 2,103、魁北克 363；其他 11 省區未涵蓋）", processing: PROC("w03", "RECYC-QUÉBEC 生態中心＋OpenMB Recycling Depot Locations 合併；PMTiles z3–12"), note: "CC BY 4.0（QC）、Manitoba Open Data Licence；2／13" },
  caFloodMapInventory: { theme: "災害", group: "淹水", zh: "洪水圖研究範圍", alt: "Flood Map Inventory", icon: Droplets, dataset: "ca_flood_map_inventory", topics: T("淹水", "洪水圖", "CFM", "NRCan"),
    description: "加拿大洪水圖研究範圍 675 面（Canada Flood Map Inventory；面是研究範圍，不是淹水範圍）", processing: PROC("w03", "NRCan CFM → 4326；PMTiles z3–10"), note: "OGL-Canada；12／13（NU 未涵蓋）" },
  caAbFloodHazard: { theme: "災害", group: "淹水", zh: "亞伯達洪水危險區", alt: "Alberta Flood Hazard Areas", icon: TriangleAlert, dataset: "ca_ab_flood_hazard", topics: T("淹水", "洪水危險區", "亞伯達", "Floodway"),
    description: "亞伯達省法定洪水危險區 12,919 面（洪水道、高危險洪泛邊緣、洪泛邊緣等；只有亞伯達）", processing: PROC("w03", "Alberta Flood Hazard Identification Program → 只收法定危險區；簡化約 20 m；PMTiles z5–12"), note: "OGL-Alberta；1／13" },
  caGlaciers: { theme: "災害", group: "永凍土與冰川", zh: "冰川（RGI 7.0）", alt: "Glaciers (RGI 7.0)", icon: MountainSnow, dataset: "ca_glaciers", topics: T("冰川", "RGI", "冰原"),
    description: "加拿大冰川 29,976 面（RGI 7.0，約 2000 年輪廓；依省界只留加拿大）", processing: PROC("w03", "RGI 7.0 區 02／03／04 → 省界裁切；PMTiles z3–11"), note: "CC BY 4.0；沒有冰川的 6 省不是未涵蓋" },
  caRiversLakes: { theme: "水資源", group: "面／線", zh: "河湖水系（1:1M）", alt: "Rivers & Lakes (1:1M)", icon: Waves, dataset: "ca_rivers_lakes", topics: T("河川", "湖泊", "水系", "Atlas of Canada"),
    description: "加拿大水體 86,877 面（> 1 km²）＋河段 203,735 段（Atlas of Canada 1:1,000,000）", processing: PROC("w03", "Atlas of Canada 1:1M Rivers／Waterbodies → 4326；低縮放依長度丟棄河段；PMTiles ca_rivers_lakes（面）＋ca_rivers（線）z2–10"), note: "OGL-Canada；小比例尺，小溪未收" },
  // ── 第 4 波
  caProtectedAreas: { theme: "自然保育", group: "保護區", zh: "保護區與 OECM（CPCAD）", alt: "Protected & Conserved Areas (CPCAD)", icon: Trees, dataset: "ca_protected_areas", topics: T("保護區", "國家公園", "OECM", "CPCAD", "IPCA"),
    description: "加拿大保護區與其他有效保育地 22,438 面（CPCAD，含海域與原住民保護區）", processing: PROC("w04", "ECCC CPCAD MapServer → 簡化約 50 m、coded value 解碼；PMTiles z3–11"), note: "OGL-Canada；13／13" },
  caCriticalHabitat: { theme: "自然保育", group: "關鍵棲地", zh: "瀕危物種關鍵棲地（SARA）", alt: "Critical Habitat (SARA)", icon: Bird, dataset: "ca_critical_habitat", topics: T("關鍵棲地", "瀕危物種", "SARA", "生態"),
    description: "加拿大 SARA 物種關鍵棲地 25,180 筆（依類群上色；敏感物種位置已由官方概化）", processing: PROC("w04", "ECCC Critical Habitat MapServer layer 3 → 4326；PMTiles z3–11"), note: "OGL-Canada；類群、保育等級依服務 domain 解碼" },
  caMarineConservation: { theme: "自然保育", group: "保護區", zh: "海洋保護區與 OECM", alt: "Marine Protected Areas & OECMs", icon: Fish, dataset: "ca_marine_conservation", topics: T("海洋保護區", "MPA", "OECM", "DFO"),
    description: "加拿大 Oceans Act 海洋保護區 49 面＋其他有效保育措施 61 面（DFO）", processing: PROC("w04", "DFO REST MapServer → 4326；PMTiles z2–10"), note: "OGL-Canada；聯邦海域" },
  caTideStations: { theme: "海洋", group: "潮位站", zh: "潮位站名冊", alt: "Tide & Water Level Stations", icon: Anchor, dataset: "ca_tide_stations", topics: T("潮位", "水位", "CHS", "海洋"),
    description: "加拿大潮位與水位站 1,839 處（含歷史站；不含即時水位）", processing: PROC("w04", "CHS 站址名冊 → 4326；海上站以 50 km 內最近省歸屬；PMTiles z2–11"), note: "OGL-Canada；SK、AB 內陸無潮位站" },
  caEcozones: { theme: "自然保育", group: "生態分區", zh: "生態帶與生態區", alt: "Ecozones & Ecoregions", icon: Leaf, dataset: "ca_ecozones", topics: T("生態帶", "生態區", "生態分區"),
    description: "加拿大 15 個生態帶（面）＋生態區界（線；National Ecological Framework v2.2）", processing: PROC("w04", "AAFC NEF v2.2 → 4326；PMTiles ca_ecozones（面）＋ca_ecoregions（線）z2–9"), note: "OGL-Canada；13／13" },
  caForestManagement: { theme: "林業", group: "分區", zh: "森林經營型態", alt: "Forest Management", icon: Trees, dataset: "ca_forest_management", topics: T("森林", "林權", "皇家林", "CCFM"),
    description: "加拿大森林經營型態 958 面（皇家林林權、私有林、保護區、原住民土地等；CCFM 2020 低解析度版）", processing: PROC("w04", "CCFM WFS mf_low_resolution → 4326；PMTiles z2–9"), note: "OGL-Canada；250 m 柵格向量化" },
  caBridgesTunnels: { theme: "交通", group: "路網結構", zh: "橋梁、涵洞與隧道", alt: "Bridges, Culverts & Tunnels", icon: Waypoints, dataset: "ca_bridges_tunnels", topics: T("橋梁", "隧道", "涵洞", "ODI", "StatCan"),
    description: "加拿大橋梁、涵洞與隧道 99,209 處（StatCan ODI v2；線狀橋體取代表點）", processing: PROC("w04", "StatCan ODI v2 bridges／tunnels → 代表點；PMTiles z4–12（drop-densest）"), note: "OGL-Canada；沒有材質、年份、狀況欄" },
  caFerryRoutes: { theme: "交通", group: "渡輪", zh: "汽車渡輪航線", alt: "Road Ferry Routes", icon: Ship, dataset: "ca_ferry_routes", topics: T("渡輪", "航線", "Atlas of Canada"),
    description: "加拿大汽車渡輪航線 182 段（Atlas of Canada 1:1M；沒有時刻）", processing: PROC("w04", "AC 1:1M Road Ferries → 4326；PMTiles z3–10"), note: "OGL-Canada；9／13" },
  caTorontoKsi: { theme: "交通", group: "交通事故", zh: "多倫多重大交通事故（KSI）", alt: "Toronto KSI Collisions", icon: CarFront, dataset: "ca_toronto_ksi_collisions", topics: T("交通事故", "多倫多", "KSI", "行人"),
    description: "多倫多市死亡與重傷交通事故 7,677 起（2006 年起；只有多倫多市）", processing: PROC("w04", "Toronto Police KSI → 一事故一點；PMTiles z8–14"), note: "OGL-Toronto；1／13" },
  // ── 第 5、6 波
  caLodeHealth: { theme: "醫療", group: "點位", zh: "醫療設施（LODE ODHF）", alt: "Healthcare Facilities (ODHF)", icon: Hospital, dataset: "ca_lode_health", topics: T("醫院", "診所", "護理之家", "LODE", "ODHF"),
    description: "加拿大醫療設施 6,663 處（醫院、診所與門診、護理與住宿照顧；ODHF 2020 版，OSM 補點空心）", processing: PROC("w05", "StatCan ODHF → 官方座標＋Nominatim 補點（只到城市者不上圖）；PMTiles z3–11"), note: "OGL-Canada＋ODbL（補點）" },
  caLodeSchools: { theme: "教育", group: "學校 Schools", zh: "學校（LODE ODEF）", alt: "Schools (ODEF)", icon: School, dataset: "ca_lode_schools", topics: T("學校", "小學", "中學", "大專", "LODE", "ODEF"),
    description: "加拿大中小學與大專院校 17,161 處（ODEF 2022 版；依學制上色，OSM 補點空心）", processing: PROC("w05", "StatCan ODEF → 官方座標＋Nominatim 補點；PMTiles z3–12（drop-densest）"), note: "OGL-Canada＋ODbL（補點）" },
  caLodeSports: { theme: "運動休閒", group: "運動場館", zh: "運動休閒設施（LODE ODRSF）", alt: "Recreation & Sport Facilities (ODRSF)", icon: Dumbbell, dataset: "ca_lode_sports", topics: T("運動場館", "公園", "遊戲場", "步道", "LODE", "ODRSF"),
    description: "加拿大運動休閒設施 181,849 處（公園、運動場、游泳池、冰場等；步道 14.3 萬點預設關）", processing: PROC("w05", "StatCan ODRSF → 官方座標＋Nominatim 補點；PMTiles z3–12（drop-densest）"), note: "OGL-Canada＋ODbL（補點）；10／13" },
  caBcChildcare: { theme: "教育", group: "托育", zh: "BC 托育中心", alt: "BC Child Care Centres", icon: Baby, dataset: "ca_bc_childcare", topics: T("托育", "幼兒", "BC", "CCFRI"),
    description: "卑詩省群體式托育中心 3,807 處（含空位與育兒費補助；家庭式托育不上圖）", processing: PROC("w05", "BC Child Care Map Data → 只取 Licensed Group；PMTiles z5–13"), note: "OGL-BC；1／13" },
  caLodeCulture: { theme: "文化", group: "設施", zh: "文化藝術設施（LODE ODCAF）", alt: "Cultural & Art Facilities (ODCAF)", icon: Theater, dataset: "ca_lode_culture", topics: T("圖書館", "博物館", "藝廊", "劇院", "古蹟", "LODE", "ODCAF"),
    description: "加拿大文化藝術設施 7,305 處（圖書館、博物館、藝廊、劇院、古蹟等；個人藝術家不上圖）", processing: PROC("w06", "StatCan ODCAF → 官方座標＋Nominatim 補點；artist 類剔除；PMTiles z3–11"), note: "OGL-Canada＋ODbL（補點）" },
  caCbsaOffices: { theme: "執法治安", group: "邊境", zh: "邊境服務署辦公室與口岸", alt: "CBSA Offices & Ports of Entry", icon: Shield, dataset: "ca_cbsa_offices", topics: T("邊境", "海關", "口岸", "CBSA"),
    description: "加拿大邊境服務署辦公室與口岸 978 處（94 筆無座標未上圖）", processing: PROC("w06", "CBSA Directory of Offices → 有座標者；PMTiles z3–11"), note: "OGL-Canada；不合成座標" },
  caParksCanadaAccommodation: { theme: "觀光", group: "住・食", zh: "國家公園營位與住宿", alt: "Parks Canada Campsites & Stays", icon: Tent, dataset: "ca_parks_canada_accommodation", topics: T("露營", "國家公園", "oTENTik", "Parks Canada"),
    description: "Parks Canada 轄管地點的營位與住宿 11,741 處（營位、野營、oTENTik、小屋等）", processing: PROC("w06", "Parks Canada Accommodation → 4326；PMTiles z4–13"), note: "OGL-Canada；12／13（NU 未涵蓋）" },
  caCourtsCorrections: { theme: "執法治安", group: "司法矯正", zh: "法院與矯正設施（BC、ON）", alt: "Courts & Corrections (BC, ON)", icon: Gavel, dataset: "ca_courts_corrections", topics: T("法院", "監獄", "矯正", "BC", "安大略"),
    description: "法院 166 處（BC、ON）＋矯正設施 28 處（只有 BC）；其他 11 省區未涵蓋", processing: PROC("w06", "BC Court Locations、BC Correctional Facilities、Ontario courthouses 合併；PMTiles z4–12"), note: "OGL-BC、OGL-Ontario；2／13" },
  caTorontoTheftFromVehicle: { theme: "執法治安", group: "竊盜", zh: "多倫多車內竊盜", alt: "Toronto Theft from Motor Vehicle", icon: KeyRound, dataset: "ca_toronto_theft_from_vehicle", topics: T("竊盜", "治安", "多倫多", "犯罪"),
    description: "多倫多市車內竊盜 107,088 件（點位為警方偏移至路口；只有多倫多市）", processing: PROC("w06", "Toronto Police Theft from Motor Vehicle → 剔除經緯度 0；PMTiles z9–14"), note: "OGL-Toronto；1／13" },
  caWildfirePoints: { theme: "災害", group: "野火", zh: "歷史大型野火點", alt: "Historical Wildfire Points", icon: Flame, dataset: "ca_wildfire_points", topics: T("野火", "森林火災", "CWFIS", "NFDB"),
    description: "加拿大大型野火點 15,204 處（1980–2023，依年代上色；OGL-Canada，只上位置與年份）", processing: PROC("w06", "CWFIS GeoServer NFDB_point → 只輸出 uid、year；PMTiles z3–11"), note: "Open Government Licence – Canada（2026-11-18 查證，無非商用限制）；只上位置與年份" },
  caBroadbandHex: { theme: "基礎建設", group: "通訊", zh: "寬頻覆蓋（50/10 Mbps）", alt: "Broadband Coverage (50/10 Mbps)", icon: Wifi, dataset: "ca_broadband_hex", topics: T("寬頻", "網路", "通訊", "ISED"),
    description: "加拿大 25 km² 六角格寬頻覆蓋 77,765 格（住戶可用 50/10 Mbps 的比例分級；無住戶不畫）", processing: PROC("w06", "ISED National Broadband Data 六角格 → 4326；PMTiles z3–10"), note: "OGL-Canada；無住戶的格留空，不是 0%" },
  // ── 第 7、8 波
  caMines: { theme: "能源", group: "礦業", zh: "礦場、冶煉廠與探勘案", alt: "Mines, Smelters & Exploration", icon: Pickaxe, dataset: "ca_mines", topics: T("礦業", "礦場", "冶煉", "探勘", "NRCan"),
    description: "加拿大生產礦場 183、冶金設施 96、前 100 大探勘案（NRCan 900A）", processing: PROC("w07", "NRCan 900A＋Top 100 Exploration → 4326；PMTiles z3–11"), note: "OGL-Canada；油氣田與礦業權未收" },
  caGrainElevators: { theme: "農業", group: "倉儲", zh: "穀物升降機", alt: "Grain Elevators", icon: Warehouse, dataset: "ca_grain_elevators", topics: T("穀物", "升降機", "倉儲", "鐵路"),
    description: "加拿大持照穀物升降機 401 座（2015 年；大小依容量）", processing: PROC("w07", "CGC Grain Elevators 2015 → 持照人欄不輸出；PMTiles z3–11"), note: "OGL-Canada；2015 年資料" },
  caDroughtMonitor: { theme: "農業", group: "乾旱", zh: "乾旱監測（2026-10）", alt: "Drought Monitor (Oct 2026)", icon: Sun, dataset: "ca_drought_monitor", topics: T("乾旱", "氣候", "農業", "AAFC"),
    description: "加拿大乾旱監測 2026 年 10 月一期（D0–D4；沒有面＝無乾旱）", processing: PROC("w07", "AAFC Canadian Drought Monitor 2026-10 → 4326；PMTiles z2–9"), note: "OGL-Canada；快照 2026-11-17，不逐月更新" },
  caSoilLandscapes: { theme: "農業", group: "土壤", zh: "土壤景觀（SLC 3.2）", alt: "Soil Landscapes (SLC 3.2)", icon: Layers, dataset: "ca_soil_landscapes", topics: T("土壤", "土綱", "SLC", "AAFC"),
    description: "加拿大土壤景觀 12,353 面（優勢組成的土綱；組成表只有十省南部 4,579 面，其餘未涵蓋）", processing: PROC("w07", "SLC v3.2 多邊形接組成表與土壤名稱表取優勢組成；PMTiles z2–10"), note: "OGL-Canada；未涵蓋的面只畫外框" },
  caNsAquaculture: { theme: "農業", group: "養殖漁業", zh: "新斯科細亞養殖租約", alt: "Nova Scotia Aquaculture Leases", icon: Fish, dataset: "ca_ns_aquaculture", topics: T("養殖", "貝類", "鮭魚", "新斯科細亞"),
    description: "新斯科細亞省養殖租約 202 面（貝類、魚類、混養；租約持有人不輸出）", processing: PROC("w07", "NS Socrata 養殖租約 → 4326；PMTiles z5–13"), note: "OGL-Nova Scotia；1／13" },
  caAbattoirs: { theme: "農業", group: "畜牧 Livestock", zh: "屠宰場（ON、MB）", alt: "Abattoirs (ON, MB)", icon: Beef, dataset: "ca_abattoirs", topics: T("屠宰場", "畜牧", "肉品", "安大略", "曼尼托巴"),
    description: "省級持照屠宰場 135 處（安大略 113、曼尼托巴 22；聯邦 CFIA 肉品廠未收）", processing: PROC("w07", "Ontario 持照屠宰場＋MB 食品加工廠取屠宰場；PMTiles z4–12"), note: "OGL-Ontario、Manitoba Open Data Licence；2／13" },
  caOdbus: { theme: "工商登記", group: "營業登記", zh: "營業登記點位（ODBus）", alt: "Business Licences (ODBus)", icon: Store, dataset: "ca_odbus", topics: T("企業", "營業執照", "NAICS", "ODBus", "StatCan"),
    description: "加拿大部分城市營業執照 312,097 筆（依 NAICS 大類上色；不含名稱與地址）", processing: PROC("w07", "StatCan ODBus v1.0 → 名稱、地址、執照號不輸出；PMTiles z6–13"), note: "OGL-Canada；7／13；無座標 13.4 萬筆未上圖" },
  caTorontoDevApplications: { theme: "底圖", group: "土地使用分區 Zoning", zh: "多倫多開發申請", alt: "Toronto Development Applications", icon: Construction, dataset: "ca_toronto_dev_applications", topics: T("開發申請", "都市計畫", "多倫多", "營建"),
    description: "多倫多市開發申請位置 8,592 筆（授權未明示，只上位置；快照 2026-11-17）", processing: PROC("w08", "Toronto Open Data Development Applications → 只輸出位置；PMTiles z9–14"), note: "授權未明示（CKAN notspecified）；只上位置" },
};

