# ADVANCED_SOURCES — W5 自然聲源（N03 風×植被、N04 海浪×海岸、N05 河川水聲）與路線剖面

> W5（2026-11-11），模型版本 `sound-atlas-w5-0.3.0`。引擎與 adapter 已接，**UI 尚未接線**。
> 三族都是**活動 proxy**：風速≠聲級、浪高≠岸邊聽到的浪聲、水位≠流量≠聲音。輸出仍是無單位 0–1 相對潛勢，不是 dB。
> 遮蔽、校準、四種產品語意、N06 雨打材質見 [ADVANCED_RESEARCH.md](./ADVANCED_RESEARCH.md)。

## 1. 查核結果（實查，2026-11-11）

| 族 | 時變資料 | 實查 | 靜態脈絡 | 即時路徑 |
|---|---|---|---|---|
| N03 風×植被 | CWA O-A0001-001 全測站逐時（collector `weather.py`）。Supabase `live.weather_observations` 保留 21 天、**沒有 public RPC**。S3 正本 `weather/archives/<D>.tar.gz`：每小時一個 json（`weather_HH58.json`，obs_time＝整點），每檔約 876 站，含座標、海拔、`wind_speed`、`gust_speed` | 10-24 全台 21,024 筆整點觀測；風速缺值 41 站／小時左右，沒有負值缺測碼（仍防呆：負值 → null） | Meta/WRI 2020 10 m 樹冠高度 `public/forestry/canopy_height_rgb_taiwan.pmtiles`（PNG RGBA、z6–12；R＝公尺、A＝遮罩）。**實測 A=0 同時代表「無 ≥1 m 樹冠」「海」「無資料」**：所有 A=255 的像素 R≥1，從不出現 R=0 | 無 → coverage `unavailable`（no_public_rpc_for_weather_observations），家族 unknown |
| N04 海浪×海岸 | CWA O-B0075 浮標／潮位站逐時（collector `cwa_marine_observation.py`）。S3 `cwa_marine_observation/archives/<D>.tar.gz` 約 40 MB／天，每 15 分鐘一個 json，**每個 json 含滾動 48 小時**讀數 → D+1 包的第一個 json 涵蓋 D 全天，用 range GET 只讀檔頭約 4 MB | 10-24：32 個有浪高的站、768 小時列；`wave_height` 有 402 筆 null（保持 null）、最大 12.4 m | 國家公園署 111 年「海岸地區範圍」（analytics `coastal_area_extents.geojson`，data.gov.tw 20821，政府資料開放授權第 1 版）的 **近岸海域** 面當海岸線 proxy（自平均低潮線起算，**不是現行海岸線**） | 即時 RPC 只有逐站逐指標 history（一天要數十次呼叫）→ 本版 `unavailable`（live_marine_loader_not_wired） |
| N05 河川水聲 | 水利署河川水位（collector `river_water_level.py`，10 分鐘）。即時 `get_river_water_level_day`（每站每小時最後一筆，含座標）；S3 `river_water_level/archives/<D>.tar.gz`（約 0.5 MB／天，**沒有座標**），2026-04-19 起有歸檔 | 10-24 全台 374 站；與 `public/geo/water_monitor_stations.geojson`（station_type=river_level）join 359／374（15 站無座標、不放） | 河道線 `public/geo/water_rivers.geojson`（2,015 條 MultiLineString，河名欄位空白）；歷史分位＝場景日前 60 天（不含當天）每小時水位 | 讀 RPC；分位檔 `/sound-atlas/river-level-quantiles.json` 與河道幾何**尚未產出** → unknown |

**時效提醒**：`live.weather_observations` 只留 21 天，但 S3 `weather/archives/` 是完整正本，所以風不受 Supabase 保留期影響（本版完全不需要 `SUPABASE_DB_URL`）。

## 2. 口徑（參數唯一出處 `src/sound/model/soundProfiles.ts`）

### 2.1 N03 風×植被（family `wind_vegetation`，proxyKind `wind_speed_x_canopy`）

- 潛勢 = `windPotential(v) × vegetationFactor(cover)`。
  - `windPotential = 1 − exp(−(v − 1.5)/6)`，v≤1.5 m/s → 0（5 m/s ≈ 0.44、10 m/s ≈ 0.76）。
  - `cover` = 接收點 100 m 內樹冠 ≥3 m 的格點比例；`vegetationFactor = min(1, cover/0.5)`。
- 最近有風速的站 ≤8 km；整點觀測代表其後 1 小時；該小時缺列或風速 null → unknown。
- 植被判定順序：沒有樹冠格網／接收點不在格網內 → `unknown(vegetation_not_sampled)`；100 m 內**全部** A=0 → `unknown(canopy_masked_ambiguous)`；有任一格點有值時，其餘 A=0 才視為「沒有 ≥1 m 樹冠」；覆蓋 0 → **inactive**。
- **不推論建築區紊流／風切聲**（`WIND_VEGETATION.urbanTurbulence=false`）。
- 已知限制：測站高度（陽明山站 607 m）與接收點高度差、山谷風、樹種（針葉／闊葉聲音不同）都沒處理；陣風只進 notes。

### 2.2 N04 海浪×海岸（family `coastal_wave`，proxyKind `wave_height_period_x_coast_distance`）

- 海岸距離 = 接收點到近岸海域面的最短距離（點在面內＝0）。**> 1 km → inactive**（不論浪資料健康與否）。
- 最近有浪高的站 ≤40 km；該小時浪高或週期任一 null → unknown。
- 潛勢 = `(1 − exp(−Hs²·T/18)) × proximity(海岸距離, 250 m)`。Hs²T 正比於深水波能通量，只取單調性。
- 不推近岸衰減、岸型（沙灘／礁岩／消波塊）、地形遮蔽、波向；浮標在外海，代表的是「該海域浪況」。

### 2.3 N05 河川水聲（family `river_water`，proxyKind `water_level_percentile`）

- 河道距離 > 300 m → inactive；沒有河道幾何 → unknown。
- 最近水位站 ≤5 km；**沒有自身歷史分位或樣本 <336 小時（14 天）→ unknown(no_station_history_quantiles)**。
- 分位 = 當小時水位在該站 60 天歷史分位表（p05…p99）中的線性內插位置；潛勢 = 分位 × proximity(河道距離, 80 m)。
- 每筆貢獻固定帶 `water_level_is_not_flow_or_sound`、`station_river_match_unverified`、`tidal_influence_unverified`。
  實例：10-24 `磺溪河口`（1010H007）p99 1.04 m、當日最高 1.06 m——河口站的水位高點很可能是潮汐，不是流量。

### 2.4 路線剖面（`engines/routeProfile.ts`）

- 沿 LineString 每 50 m 取樣（含終點），超過 2,000 點時加大間距、不截斷。
- 每點時間 = 出發 + 累積距離 ÷ 速度；步行 1.3 m/s、自行車 4 m/s、custom 由呼叫端給（等速，不含停等，標 assumption）。
- 每點 `queryReceiver`（瞬時）；`families` 要明確傳（預設只有 MVP-A 四族）。
- 跨午夜：呼叫端要把兩天的來源集合都傳進來；只給一天 → 過午夜的點 `unavailable`（測試已釘）。
- 輸出 `samples[]`（距離、時間、各族結果、dominant）、各族序列與 unknownRatio、`activeSampleCount`。**措辭只能說「沿途主要接觸哪些聲源」，不可叫噪音暴露量**。

## 3. 場景快照區塊 `natural`（schema `pulse-sound-natural-v1`）

產生：`AWS_PROFILE=pulse-personal python3 -I scripts/preprocess/build-sound-scenes.py --merge-w5 [--scene ID]`
（只用 S3 與本機檔；`--public-dir` 預設 worktree 的 public，沒有樹冠檔時退回主 checkout；`--coast-geojson` 預設 analytics processed 路徑）。

| 子區塊 | 內容 | 範圍 |
|---|---|---|
| `wind` | `stations[{id,name,lon,lat,alt_m}]`、`obs[[站序, unix, 風速, 陣風]]`、health | 站：場景 bbox 外擴 8 km；`bbox`＝場景 bbox（接收點在外 → unknown） |
| `wave` | `stations[{id,name,type,lon,lat}]`、`obs[[站序, unix, Hs, T]]`、health | 全部有浪高的站（約 32） |
| `river` | `stations[{id,name,lon,lat,q:{probs,values,n}}]`、`obs[[站序, unix, 水位]]`、`history_basis`、health | 站：bbox 外擴 5 km |
| `canopy` | `bbox,nx,ny,heights[]`（row 0 最北，-1＝遮罩） | 接收點 ±3 km、30 m 格網（200×200，約 140 KB） |
| `coast` | 近岸海域 MultiPolygon（DP 20 m） | 與 bbox 外擴 2 km 相交的面 |
| `river_network` | MultiLineString（DP 15 m） | 接收點 ±6 km（±10 km 時臺北場景逼近 2 MB） |

health：時變子區塊的 archive 存在且有資料＝ok、存在但 0 筆＝empty、缺檔／讀取失敗＝error；前端 coverage 直接取 health，不以 bbox 內筆數重判。
**場景檔是 gitignored 的 public 資產**：合併 W5 分支後，要在有場景檔的 checkout 重跑上面的指令（或從 W5 worktree 複製），再 `build-public-assets-lock.py add` 登記 lock。

## 4. 三場景結果（10 分鐘格，2026-11-11 W5 worktree 實跑）

見 [DATA_QUALITY_REPORT.md](./DATA_QUALITY_REPORT.md) §W5。

## 5. 未做與待決

1. **即時風**：需要新的 public RPC（例：`get_weather_wind_day(date)`，pre-aggregate 到每站每小時），屬 migration，本版不做，待使用者拍板。沒有之前，非場景日的風×植被一律 unknown。
2. **即時浪**：同理需要「某日全部浪測站逐時」的 RPC，或前端只取接收點附近 1–2 站的 `get_marine_observation_history`（UI 接線時決定）。
3. **即時河川**：要產兩個靜態資產才會有結果：`/sound-atlas/river-level-quantiles.json`（全台各站 60 天分位，月更）、全台簡化河道（可直接用 `public/geo/water_rivers.geojson`，16 MB 偏大，建議簡化後另存）。
4. **即時植被**：UI 端用 `rasterProbeSampler.sampleCanopyHeight` 在接收點周圍取樣成小格網（例 7×7、30 m），用 `canopyGridRecord` 注入 wind_vegetation 的集合；adapter 不直接 import 瀏覽器專用的取樣器。
5. 地形（山谷、稜線）、樹種、岸型、河寬與落差、瀑布點位都沒有用到。

## 6. UI 接線規格（主 agent 用）

### 6.1 型別與載入

- `AdvancedSoundFamily = "wind_vegetation" | "coastal_wave" | "river_water"`（`types.ts`），已併入 `AnySoundFamily`，**未**併入 `SoundSourceFamily`。接 UI 時把它併入 `SoundSourceFamily`，並補齊所有 `Record<SoundSourceFamily, …>`（清單同 MVP_B_SOURCES.md §6）。
- `SOUND_FAMILIES_ADVANCED`（`engines/receiverQuery.ts`）；`SOUND_FAMILIES_ALL` 已包含。
- 載入：`loadAdvancedFamily(family, date, snapshotJson | null)`（`src/sound/advancedSources.ts`）；`snapshotJson` 只在 `snapshotApplies` 為真時傳。
- 路線：`routeProfile(line, departUnix, sets, { mode, speedMps?, families })`；`sets` 要含出發日與抵達日。

### 6.2 layer key 建議（沿用 soundAtlas 群組的命名，實際以 MVP-B 接線時的慣例為準）

| family | layer key 建議 | 顏色建議 | 理由 |
|---|---|---|---|
| wind_vegetation | `soundWindFoliage` | `#65a30d`（lime-600） | 綠＝植被；與雨（藍）、雷（紫）分開 |
| coastal_wave | `soundCoastalWave` | `#0891b2`（cyan-600） | 海；比雨的藍偏青 |
| river_water | `soundRiverWater` | `#2563eb`（blue-600） | 淡水；若與雨色衝突改 `#0284c7` |
| 路線剖面 | `soundRouteProfile`（面板，不是圖層） | 沿用各族顏色堆疊 | — |

顏色要先對照 `soundAtlasColors.ts` 與 design-system spec 的類別色表，避免與既有七族撞色；以上只是草案。

### 6.3 三語圖例草稿

| key | zh-TW | en | ja |
|---|---|---|---|
| wind_vegetation 名稱 | 風吹樹葉 | Wind in foliage | 風と木の葉 |
| wind_vegetation 說明 | 測站風速 × 附近樹冠覆蓋的活動潛勢；風速不等於音量，市區不推估風切聲 | Station wind speed × nearby tree canopy (activity proxy, not loudness; no urban wind noise inferred) | 観測所の風速×周辺の樹冠による活動ポテンシャル（音量ではありません。市街地の風切り音は推定しません） |
| coastal_wave 名稱 | 海浪拍岸 | Surf | 打ち寄せる波 |
| coastal_wave 說明 | 外海浮標浪高與週期 × 離海岸距離；離岸超過 1 公里不計 | Offshore buoy wave height & period × distance to coast; beyond 1 km not counted | 沖合ブイの波高・周期×海岸からの距離（1 km 以上離れると対象外） |
| river_water 名稱 | 河川水聲（研究） | River water (experimental) | 川の水音（研究中） |
| river_water 說明 | 水位相對該站過去 60 天的高低 × 離河道距離；水位不等於流量或聲音，河口可能是潮汐 | Water level relative to the station's past 60 days × distance to channel; level ≠ flow ≠ sound, estuaries may reflect tides | 観測所の過去60日に対する水位の高さ×河道からの距離（水位≠流量≠音、河口は潮汐の影響あり） |
| unknown 共用 | 無法判斷（資料未涵蓋） | Unknown (no data coverage) | 判定不可（データ範囲外） |
| 路線面板標題 | 沿途主要聲源 | Main sound sources along the route | 経路上の主な音源 |

面板措辭：status=unknown 一律顯示「無法判斷」，不可顯示 0 或「安靜」；notes 中的 `water_level_is_not_flow_or_sound`、`coastline_proxy_not_shoreline` 要翻成白話放在「資料說明」。
