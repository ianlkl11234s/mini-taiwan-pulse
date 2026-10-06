# 圖層總表摘要

> 由 `scripts/research/build-layer-status.mjs` 產生，請勿手改；逐層明細見 [layer-status.csv](./layer-status.csv)。
> 依據 [ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)：L1 可操作、L2 可分析、L3 位置精度（屬性，不是關卡）。

- 圖層總數：**1078**；L1 可操作：**1078/1078**
- L2 倉庫可分析（spatial＋statistics＋attribute）：**883/1078**（81.9%）
- 只有舊瀏覽器 reader：6；尚不可分析：184

## 各面板 L2 狀態

| 面板 | 圖層數 | spatial | statistics | attribute | browser_reader | none | display_only |
|---|---|---|---|---|---|---|---|
| 臺灣圖層 | 638 | 312 | 199 | 2 | 5 | 116 | 4 |
| 統計 | 355 | 1 | 342 | 3 | 0 | 9 | 0 |
| 世界 | 25 | 7 | 0 | 0 | 1 | 17 | 0 |
| 日本 | 60 | 15 | 0 | 2 | 0 | 42 | 1 |

## 尚不可分析的原因

| 原因 | 圖層數 |
|---|---|
| dataset_not_in_warehouse | 97 |
| warehouse_SKIPPED_FORMAT | 15 |
| derived_layer | 9 |
| warehouse_SKIPPED_DISPLAY_ONLY | 8 |
| warehouse_FAILED | 7 |
| upstream_catalog_missing | 3 |
| override: snapshot_candidate: 同一 2025-04 PMTiles artifact 換 filter；LICENSE_UNVERIFIED。 | 2 |
| override: snapshot_candidate: 本地 research PMTiles 靜態界線（A10 2010 historical outer polygon），非現行法定界線／zoning；可入倉做面積、與其他保護區重疊分析；NON_COMMERCIAL_ONLY 限制需保留於 metadata。 | 1 |
| override: snapshot_candidate: 同 jpNaturalParksNational，共用同一份 A10 2010 PMTiles artifact 換 filter_layer_id；outer polygon、非商用限制。 | 1 |
| override: snapshot_candidate: 同上 A10 2010 PMTiles 共用 artifact；都道府縣立自然公園 outer polygon。 | 1 |
| override: snapshot_candidate: A11 2015 PMTiles 靜態界線；HOLD_LICENSE（全國發布待用途別 clearance），historical reference，仍可入倉做空間分析但需標註授權未清。 | 1 |
| override: snapshot_candidate: 同一 A11 2015 PMTiles artifact；HOLD_LICENSE、精度不保證，historical reference。 | 1 |
| override: snapshot_candidate: 同一 A11 2015 PMTiles artifact；HOLD_LICENSE、精度不保證。 | 1 |
| override: snapshot_candidate: 環境省 2025-04 PMTiles 鳥獸保護區界線；LICENSE_UNVERIFIED、本地 research only，可入倉做面積/重疊分析但授權未確認。 | 1 |
| override: snapshot_candidate: UNESCO 現行名錄 GeoJSON 代表點（22 rows，1 筆 null geometry）；CC BY-SA 4.0，代表點非 property boundary，適合做文化景點可及性分析。 | 1 |
| override: snapshot_candidate: UNESCO 現行自然遺產代表點（5 個）；CC BY-SA 4.0，代表點非 property boundary。 | 1 |
| override: snapshot_candidate: KSJ A28-10 2011 historical 面（僅知床／白神山地／屋久島 3 處，缺現行 2 處）；NON_COMMERCIAL_ONLY，資料量小但仍是可入倉的靜態 polygon。 | 1 |
| override: snapshot_candidate: 環境省 Ramsar 名冊衍生點（54 rows：10 個 NAME_MATCH 精確、44 個 ADMIN_OR_OTHER_CENTROID 低精度）；LICENSE_UNVERIFIED + HOLD_GEOMETRY，所有點都非 Ramsar 官方界線，入倉需保留 geocode_quality 欄位。 | 1 |
| override: snapshot_candidate: 環境省 2015 沿岸生態重要海域 PMTiles polygon；STALE_REFERENCE、ATTRIBUTION_REQUIRED，非法定保護區指定，僅生態參考面。 | 1 |
| override: snapshot_candidate: 北市圖 6 分館即時座位為 realtime 指標（10 分鐘資料／5 分鐘輪詢），本身屬 live_only；但 6 分館座標是穩定設施點，可只快照分館位置（不含即時空位率）供可及性分析用。 | 1 |
| override: live_only: 價值在最近 7 天事件時間軸與嚴重度變化（AI 初判＋正式事件混合，候選事件分頁 200/頁），需依時間窗匯出才有意義，不適合單點快照；跨國弧線僅表事件關聯非真實座標移動。 | 1 |
| override: live_only: AISStream 最近 30 分鐘船位，依目前 viewport 查詢，價值在即時位置更新，需時間窗匯出（例如每小時抓一次做軌跡）而非單次快照。 | 1 |
| override: live_only: GFW 舊版每日 vessel presence 快照，本質是逐日變動的歷史時間序列（非最新 release 標準來源），適合按日期範圍匯出而非單一時點快照。 | 1 |
| override: live_only: GFW 小時船舶密度網格，依 UTC 小時變化、隨 timeStore crossfade 呈現，核心價值是時間序列變化而非某一時刻的靜態面。 | 1 |
| override: live_only: GFW schema-4 小時近似航跡，跟隨時間軸載入 H-1/H/H+1，本質是移動軌跡時間序列。 | 1 |
| override: live_only: GFW 每日 apparent fishing effort，以 UTC 日獨立彙整，用於比較不同日期的捕撈活動變化，單一時點快照會失去時間序列比較的分析價值。 | 1 |
| override: live_only: GFW SAR 未匹配 AIS 偵測，依 UTC 小時切分，空時段仍會產生 0-feature，本質是時間序列監測而非靜態設施。 | 1 |
| override: snapshot_candidate: 日本都道府県界 PMTiles（47 筆），純行政邊界，是縣市級空間聚合分析的基礎底圖。 | 1 |
| override: snapshot_candidate: 日本市区町村界 PMTiles（1,905 筆），鄉鎮級行政邊界，可作跨圖層行政區聚合的 join key。 | 1 |
| override: snapshot_candidate: 日本車站靜態 GeoJSON（9,046 點，含路線／營運者／運量 2022-2024），高價值設施點，適合做交通可及性分析。 | 1 |
| override: snapshot_candidate: 日本機場靜態 GeoJSON（108 面，含空港種別／供用狀態／跑道規格），設施類資料，可做機場服務範圍分析。 | 1 |
| override: snapshot_candidate: 日本鐵道路線 PMTiles（21,933 段，含路線名／運営会社／事業者種別），可做路網連通性與可及性分析。 | 1 |
| override: snapshot_candidate: 歷史航班樣本軌跡，已是靜態 manifest+GeoJSON 資產（依機場/日期載入已保留的實測航跡），非持續更新的即時追蹤，可入倉做航線廊道分析；coverage 以 manifest 為準、非完整航班。 | 1 |
| override: snapshot_candidate: 日本全国学校一覧 PMTiles（56,807 點，含校名／所在地／学校分類／設置者），大型教育設施點資料，適合可及性與涵蓋率分析。 | 1 |
| override: snapshot_candidate: 国土数値情報 1km 網格未來推計人口（176,896 格，pop 2020/2030/2040/2050/2070、ratio65 2030起），統計網格資料，是人口/高齡化空間分析的核心素材；注意 ratio65_* 是 0~1 比例、0 值多為隱私遮罩非真 0%。 | 1 |
| override: display_only: Meta/WRI CHMv2 樹冠高度為連續 raster 瓦片（source.kind=pmtiles 但走 rasterProbe popup，逐像素查詢無屬性表），非向量/表格資料，不適合入倉做空間統計分析。 | 1 |
| override: live_only: 即時急診壅塞狀態（等待推床／滯留人數，realtime.er_hospital_status，RPC get_er_hospital_latest），核心分析價值是隨時間變動的壅塞指標，需時間窗匯出；座標是 join 自另一份醫療 GeoJSON（非本層自有的設施表），故不比照『快照站點』處理。 | 1 |
| override: snapshot_candidate: PLATEAU 建物高度（遠距 building_grid 網格＋近距 buildings 輪廓兩組 PMTiles，含高度屬性），為向量設施/建物資料，可做都市紋理與天際線分析；部分區域覆蓋、非全日本完成。 | 1 |
| override: live_only: 核安會環境輻射 63 站 15 分鐘即時劑量率（RPC get_nusc_gamma_latest，migration 419），價值在劑量率隨時間變化；解鎖條件：Zeabur collector 啟用並累積 live.nusc_gamma_measurements 後，以時間窗匯出（測站位置可另做 snapshot）。與台電周界 nuclearRadiation 為不同測站網。 | 1 |
| override: live_only: 放流水連線自動監測每設施最新值（RPC get_water_effluent_latest，migration 420），超限／異常為逐時狀態；解鎖條件：collector 啟用後以時間窗匯出 live.water_effluent_readings；座標 NULL 的設施不畫、不合成。 | 1 |
| override: live_only: CEMS 煙道每設施最新 1 小時值（RPC get_cems_stack_latest，migration 421，上游延遲 4–5 小時），逾限與運轉狀態為逐時狀態；解鎖條件：collector 啟用後以時間窗匯出 live.cems_stack_readings；設施座標借 EMS 列管表（91.4% 對得上）。 | 1 |
| override: live_only: 氣象署紫外線指數「前一天最大值」（RPC get_cwa_uv_latest，migration 422），每日一值、只回最近 30 天；解鎖條件：collector 啟用並累積 live.cwa_uv_daily 後以日期範圍匯出；測站位置可另做 snapshot。 | 1 |
| override: snapshot_candidate: 中央氣象署固定式海洋觀測站，本質是即時觀測值（freshness 隨資料更新），但測站位置（station_uid／經緯度／depth／vertical datum）是穩定設施，可只快照站點中繼資料、不含即時觀測值。 | 1 |
| override: snapshot_candidate: 港灣環境資訊網 ISOHE 港區海氣象固定站，同 CWA：測站位置穩定，可只快照站點中繼資料。 | 1 |
| override: snapshot_candidate: 台灣機場歷史航班樣本軌跡，已是靜態 manifest+GeoJSON 資產（同 jpHistoricalFlightTrails 模式），可入倉做航線廊道分析；coverage 以 manifest 為準、非完整航班或即時軌跡。 | 1 |
| override: snapshot_candidate: 停車 hybrid v1 路邊 RPC；台北為 POLYGON 幾何但『無即時空位』本身就是純靜態設施面，新北/台中為點位含即時空位率——可快照全部路邊停車格 geometry，僅排除即時空位率欄位。 | 1 |
| override: snapshot_candidate: 停車場外 RPC（市區／觀光／國道服務區三源）；停車場點位是穩定設施，可快照位置與類別，排除即時空位率。 | 1 |
| override: display_only: 純視覺 bloom 特效實驗層（additive WebGL CustomLayer），source.note 明載『無自己的資料來源、無靜態檔』，僅借用 facPrimary 資料做視覺疊加，無 legend/popup。 | 1 |
| override: display_only: 純 Mapbox line-blur 霓虹邊框視覺實驗層，source.note 明載『純視覺實驗，無自己的資料來源』，共用 aviationRestricted 既有 PMTiles 做疊層，無 legend/popup。 | 1 |
| override: display_only: 高壓輸電線 bloom 視覺實驗層，借用 energyLoader.fetchOsmPowerLines 資料做 4-pass line-blur 特效，無自有資料來源、無 legend/popup。 | 1 |
| override: display_only: 變電所 EHV bloom 視覺實驗層，借用 energyLoader.fetchOsmSubstations 資料，純視覺疊加、無自有資料來源、無 legend/popup。 | 1 |
| override: snapshot_candidate: SSOT 離岸風電場址 polygon（8 處：大彰化／Formosa／Hai Long），已被 OSM offshoreWindZones（36 面）取代移出 sidebar，但底層 Supabase 表資料仍是真實設施 polygon，可入倉分析。 | 1 |
| override: snapshot_candidate: 離島電網設施（14 處：澎湖／金門／馬祖／蘭嶼／綠島／琉球），facPrimary 的 is_island 已涵蓋而移出 sidebar，但仍是真實設施點資料。 | 1 |
| override: snapshot_candidate: OSM 光電廠 POI centroid（734 處），與 SSOT facilities 重疊移出 sidebar，仍是真實設施點，適合能源設施分布分析。 | 1 |
| override: snapshot_candidate: OSM 電廠（513 處，補 IPP／小型電廠），與 SSOT facilities 可能重疊移出 sidebar，仍是真實設施點資料。 | 1 |
| override: snapshot_candidate: legacy 單一發電廠層 all_power_plants_v（10,665 設施，含 fuel_type／capacity_mw），已被 facPrimary 等 6 層取代移出 sidebar，但資料量大、屬性完整，仍是高價值能源設施資料。 | 1 |
| override: live_only: 非地圖圖層，是 top-left 供電燈號 KPI 卡片（usePowerDashboard RPC 5 分鐘 poll，cron 10 分鐘寫入），無 geometry、無 legend/popup，價值在備轉容量率隨時間變化，需時間序列匯出而非空間快照。 | 1 |
| override: live_only: 北中南東 4 區用電 3D bars，與 powerStatusHud 共用同一份 usePowerDashboard RPC（不重複拉取），4 區僅為粗略聚合質心非真實設施點，核心價值是用電量/備轉指標隨時間變化，需時間序列匯出。 | 1 |
| override: unclear: 全 repo 僅有 type 宣告與三張全量表的值，layerConsistency 僅記載 baseline，無任何 loader/hook/RPC 實作（幽靈 toggle 已於 2026-06-10 自 sidebar 移除）；沒有可查的資料來源，無法判斷屬於哪一類。 | 1 |
| override: unclear: 逐檔 grep 全 repo 找不到任何實際讀取端（僅 type 宣告＋三張全量表），layerConsistency 註解稱『由 wasteTruck 子 UI 控制』但該 UI 不存在；沒有可查的資料來源，無法判斷屬於哪一類。廢棄物主題真正在用的是另一 key `wasteStopsStatic`（不在此清單）。 | 1 |
| override: unclear: 同 wasteRoute，無任何 consumer（僅 type 宣告＋三張全量表），無法判斷資料形態；注意與已上線、有 OVERLAY_REGISTRY entry 的 `wasteStopsStatic`（不同 key，不在此清單）不可混淆。 | 1 |

- `upstream_catalog_missing`：manifest 未對應到 analytics 目錄 dataset（多為前端自建、即時或外部來源）。
- `dataset_not_in_warehouse`：有 upstream dataset，但 analytics 沒有可建表的 manifest／檔案。
- `warehouse_SKIPPED_*`／`warehouse_FAILED`：倉庫建置時略過或失敗，原因見 runtime `build-report.json`。
- `derived_layer`：由其他圖層或資料衍生（例如等時圈、覆蓋面），需另接衍生流程。

## L3 位置精度（spatial 圖層）

| precision_class | 圖層數 |
|---|---|
| official | 135 |
| address_geocode | 84 |
| unknown | 82 |
| google_geocode | 22 |
| address_geocode+official | 6 |
| unknown+official | 3 |
| village_centroid | 2 |
| proxy | 1 |

## 空間涵蓋（spatial 圖層）

| 涵蓋 | 圖層數 |
|---|---|
| national | 187 |
| 19 counties | 34 |
| unknown | 19 |
| 2 counties | 16 |
| 18 counties | 11 |
| 17 counties | 9 |
| 13 counties | 8 |
| 3 counties | 7 |

「N counties」代表區域性資料集：跨地比較時，未涵蓋的縣市應標「未涵蓋」而非 0（引擎的 nearby_profile 已自動處理）。
