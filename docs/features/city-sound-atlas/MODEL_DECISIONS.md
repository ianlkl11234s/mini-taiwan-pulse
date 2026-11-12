# MODEL_DECISIONS — 聲源 kernel、單位與假設

> 模型版本：`sound-atlas-w6-0.4.0`（`src/sound/model/soundProfiles.ts` 的 `MODEL_VERSION`；§0–§4 為 MVP-A `0.1.0` 的決定、§5 為 `0.2.0`、§6 為 `0.3.0`；`0.3.1` 只改 §5.5 典型車流換算尺度；§8 道路網格為 `0.4.0`，§5.3／§5.5 的道路規則由 §8 取代）。
> 依據：使用者提供的擴充計畫（2026-11-11）§5–§7。**主計劃 01（前一次交付的 `01_CITY_SOUND_ATLAS_HANDOFF.md`）不在手上**，凡兩者可能衝突處，一律以擴充計畫為準。

## 0. 總原則

1. **輸出是相對潛勢，不是 dB。** 每個家族輸出無單位 0–1 的「類別活躍潛勢」；不跨家族加總成總音量。`modeledDbA` 型別固定為 `null`，通過聲學校準 gate（計畫 Phase 5）之前不得填值。
2. **unknown 不是 0。** `inactive`（0）只在「來源健康＋沒有候選」時成立；缺口、太遠、單位不明一律 `unknown`（null）。24h 構成格的規則：格內有任一 active → active（取最大）；否則有 unknown → unknown；否則 inactive（`PROFILE.binRule`）。
3. **參數唯一出處**：引擎與 adapter 不寫魔術數字，全部從 `soundProfiles.ts` 讀，每個參數附 `assumption` 字串；改參數要升 `MODEL_VERSION`。
4. **時間**：內部一律 unix 秒；日期鍵是 Asia/Taipei 的 `YYYY-MM-DD`。
5. **距離**：haversine（地球半徑 6,371,008.8 m，IUGG 平均），不用經緯度度數相減；3D 時取斜距 `hypot(水平, 高差)`。

## 1. 共用 kernel（`engines/relativePotentialKernel.ts`）

| kernel | 公式 | 用在 | 說明 |
|---|---|---|---|
| `proximityPotential(d, half)` | `1 / (1 + (d/half)^2)` | 飛機、雷、垃圾車 | 距離 = half 時 0.5，單調遞減。啟發式形狀，**不是**幾何擴散衰減（−6 dB/倍距）的換算；只保證「越近越高」的排序意義。 |
| `rainPotential(R)` | `1 − exp(−R / 10)`，R＝mm/h | 雨 | 10 mm/h ≈ 0.63、40 mm/h ≈ 0.98；R 為 null／負值 → null。 |
| `thunderEnvelope(s)` | 抵達後 8 秒內從 1 線性降到 0.3，之後 0 | 雷 | 表達「雷聲持續數秒」，不是瞬間點。 |
| `thunderTiming(flash, d)` | `delay = d / 343` | 雷 | 區分閃光時刻與聽到時刻；無通道高度時用水平距離，標 `propagationApproximation='2d'`。 |

## 2. 各家族

### 2.1 飛機 A01（移動 3D 點）

| 參數 | 值 | assumption |
|---|---|---|
| `candidateRadiusM` | 20,000 m | 只查水平 20 km 內；純候選篩選，非可聽距離宣稱 |
| `maxInterpolationGapS` | 600 s | 段內兩點 ≤10 分鐘才線性內插；更長 → unknown |
| `intervalSampleStepS` | 30 s | 區間查詢每 30 秒細取樣，避免漏掉 1–2 分鐘的飛越 |
| `halfPotentialDistanceM` | 2,000 m | 斜距 2 km → 0.5；未依機型噪音資料校準 |
| `feetToMeters` | 0.3048 | 國際英尺 |

- **單位決定**：`flight_id` 8 hex（FR24）＝英尺、6 hex（OpenSky）＝公尺、其他 → unknown（只算 2D、潛勢 null，T05）。理由與出處見 SOURCE_REUSE_AUDIT §2。
- 高度基準（MSL／AGL、氣壓／幾何）未校正，每筆 contribution 附 `altitude_datum_unverified`。
- 同航班被 30 分鐘切段的各段依 `_<n>` 後綴重組；段間 → unknown，不跨缺口內插（T04、計畫風險 4）。
- 不區分起飛／降落／巡航階段（A02 班表日後可補）。

### 2.2 雨 N01（分布式場的站點代理）

| 參數 | 值 | assumption |
|---|---|---|
| `maxStationDistanceM` | 5,000 m | 最近雨量站超過 5 km → unknown，不外推到街區（T09） |
| `potentialScaleMmPerHour` | 10 | 見 kernel 表 |
| `bucketDurationS` | 3,600 s | RPC 每站每小時一筆，`[bucket_at, +1h)` 代表該筆 |

- 用 `precipitation_1hr`（過去 1 小時累積）當 mm/h 代理；`precipitation_10min` 單位不同，只放 notes，不換算混用。
- 該站該小時無列 → unknown；不從其他時刻或雷達填補（T10：不讀著色雷達 PNG）。
- 不處理地表材質（屋頂、樹冠，N06）。

### 2.3 雷 N02（脈衝事件＋延遲）

| 參數 | 值 | assumption |
|---|---|---|
| `candidateRadiusM` | 25,000 m | 雷聲約 15–25 km 內可能聽見；候選篩選非保證 |
| `envelopeDurationS` | 8 s | 固定，不依距離或通道長度變化 |
| `envelopeTailFloor` | 0.3 | envelope 末端剩 30% |
| `halfPotentialDistanceM` | 3,000 m | 3 km → 0.5；**不用 `intensity_ka` 換算聲壓** |
| `sources` | cwa、taipower | jma 只涵蓋日本不納入；某源空集合不代表無雷（T07） |
| `possibleLinkMaxDtS`／`possibleLinkMaxDistanceM` | 1 s／1,000 m | 跨源同一事件只計一次，原始兩筆保留在 `linkedRecordIds`（T08） |

- 已知限制：cwa 時間只到分鐘，±1 秒連結與延遲計算對 cwa 事件精度不足；雲中（strike_type=1）與雲對地不分開處理；通道高度未知 → 2D。

### 2.4 垃圾車 W01（表定停點）

| 參數 | 值 | assumption |
|---|---|---|
| `candidateRadiusM` | 500 m | 只查 500 m 內停點 |
| `halfPotentialDistanceM` | 150 m | 音樂車聲未量測 |
| `approachBufferS` | 120 s | 到站前 2 分鐘起算（接近） |
| `minAudibleDwellS` | 60 s | arrival==departure 時給 1 分鐘 |
| 星期可信度 | listed：高雄、新北、宜蘭、基隆；unknown：臺北；其餘 unverified | 臺北預設回 unknown；unverified 以 `evidence=inferred` 顯示候選 |

- 只在停點位置計算，不沿停點間直線發聲（計畫風險 3）；D−1 跨午夜停點併入 D（T01）。

### 2.5 接收者

- 預設耳高 1.5 m（`COMMON.receiverDefaultHeightM`），環境 `outdoor`；`indoor_unknown` 只加 note，不做隔音衰減。
- 不做建物遮蔽、地形遮蔽、風向折射（計畫 §6.3，留 W5 研究）。

## 3. 為什麼放 mini `src/sound/`，不走 ADR-0025 sim_bundle

ADR-0025 的情境推演模式是「analytics 預先算好固定情境 → `output/<slug>/sim_bundle/` → 前端只切換檔案」。聲景不合：

1. **接收點是使用者在地圖上任意放的**，結果取決於點位，無法事先枚舉成固定情境檔。
2. 要**即時讀既有 RPC**（當天航跡、落雷、雨量），且和全域 timeStore 同步；sim_bundle 是離線結果。
3. 引擎是輕量純函式（每次查詢只掃一天的候選），前端算得動，不需要後端或預計算。

場景快照（`public/sound-atlas/scenes/`）只是「把原始輸入凍結」，引擎照樣在前端跑；它不是 sim_bundle，不含模擬結果。

## 4. 已知不做（MVP-A 範圍外）

聲壓／dB 換算、跨家族能量加總、遮蔽與反射、機型噪音資料、雷達數值雨場、移動接收者／路線剖面（計畫 §8C）、鐵道與車流（MVP-B）。

## 5. MVP-B（W4，2026-11-11）：鐵道、道路車流、施工

> 模型版本升為 `sound-atlas-mvp-b-0.2.0`（只新增三族參數，MVP-A 四族參數與行為不變）。查核與口徑細節見 [MVP_B_SOURCES.md](./MVP_B_SOURCES.md)。

### 5.1 型別：三族先不併入 `SoundSourceFamily`

`components`／`hooks`／`layers` 有多處 `Record<SoundSourceFamily, …>` 窮舉（實測直接擴 union 會讓 9 個檔案 tsc 失敗）。W4 不碰 UI，所以：

- `SoundSourceFamily` 維持四族；新增 `MvpBSoundFamily`、`AnySoundFamily`。
- 引擎型別（`SoundSourceRecord`、`SoundSourceSet`、`SourceCoverage`、`SourceContribution`、`FamilyResult`、`IntervalQuery`、`SoundSourceAdapter`）加第二個泛型參數 `F`，預設仍是四族，UI 不受影響。
- `queryReceiver`／`dayProfile`／`queryFamilyInterval` 改泛型；預設 families 仍是 `SOUND_FAMILIES`（四族）。要查新三族要明確傳 `SOUND_FAMILIES_MVP_B` 或 `SOUND_FAMILIES_ALL`。
- `SourceContribution` 新增兩個可選欄位：`proxyKind`（潛勢依據：`road_type_no_volume`／`observed_volume`／`permit_window_possible_activity`）與 `railStructure`（elevated／at_grade／surface／unknown）。UI 措辭必須照 `proxyKind`。

### 5.2 鐵道 R01（移動點）

| 參數 | 值 | assumption |
|---|---|---|
| `candidateRadiusM` | 1,500 m | 純候選篩選 |
| `halfPotentialDistanceM` | 250 m | 水平距離 250 m → 0.5；未依車種、速度、結構、隔音牆校準 |
| `structureWeight` | elevated 1、at_grade 1、surface 1 | 高架與地面暫不分輕重，只分「會不會直接傳到戶外」 |

- **位置**：與 `RailEngine`／`TraTrainEngine` 同規則（捷運類延長日制 05:50、台鐵／高鐵日曆日制，見 MVP_B_SOURCES §2.3；站間線性推進 progress、`interpolateOnLineString`、環狀線終點修正）。兩個引擎不輸出所在站間，所以 adapter 照同規則重算；測試在 6 個時刻對照 `RailEngine.update` 位置一致。站不在軌道 progress 表 → unknown（引擎用索引比例猜，聲景不猜）。
- **地下段**：`model/railSegments.ts` 依站間結構表（OSM 衍生，見 MVP_B_SOURCES §2）。地下段不產生貢獻；unknown 段（表外、洞口過渡、比對不到 OSM、多軌道結果衝突）→ `status=unknown`、潛勢 null，不當地面。車站點前後兩段結構不同 → unknown。
- **區間查詢不取樣**：求「該時段列車走過的軌道子段」到接收者的最短距離（解析），高鐵 30 秒走 2.5 km 也不會漏。
- **營運日**：查 D 讀 D−1 與 D 兩個營運日（D 00:00–05:50 屬 D−1）。每個（系統、營運日）一筆 coverage；取不到班表 → 該窗 unavailable，並在該系統軌道放 `schedule_unavailable` 佔位（provider `rail_network_static`），接收者在地上段附近回 unknown，不會因「沒有列車」變成 0。**不拿今天班表回填**。
- 班表是 scheduled，不是觀測（誤點、停駛、加班車不反映）。`fetchSupabaseSchedule` 無 `_daily` 時退回 `_fixed`，前端分不出 → `basis=daily_or_fixed_unverified`。

### 5.3 道路車流 T01（線聲源，只有道路類型 proxy）

> **W6-2（0.4.0）起由 §8 取代**；以下保留為歷史紀錄。

| 參數 | 值 | assumption |
|---|---|---|
| `candidateRadiusM` | 500 m | 只查已載入路段（目前只有國道） |
| `halfPotentialDistanceM` | 100 m | 距路段 100 m → 0.5 |
| `roadTypeProxyWeight` | freeway 1 | 不是流量 |
| `volumeMaxAgeS`／`volumeScaleVehPerHour` | 900 s／1,500 輛/時 | 只在注入觀測流量時使用（目前沒有來源） |

- 預設 `proxyKind=road_type_no_volume`、`evidence=inferred`。壅塞等級、旅行速率只進 notes（等級不是流量）。
- 接收者 500 m 內沒有任何已載入路段 → 一筆 unknown（`road_network_not_covered`）。市區街道沒有資料 ≠ 安靜。
- 有注入流量時：樣本超過 15 分鐘或 null → unknown，不沿用舊值，也不退回 proxy。

### 5.4 道路施工 C01（點／線／面，許可期間＝可能活動）

| 參數 | 值 | assumption |
|---|---|---|
| `candidateRadiusM` | 300 m | 多邊形內＝距離 0 |
| `halfPotentialDistanceM` | 80 m | 機具、工時未知 |
| `eventTypes` | [2] | EventType 7（挖掘管制區）不納入 |
| `permitWindowPolicy` | possible_activity | 改 `unknown` 則許可期間內一律 unknown |
| `possibleActivityWeight` | 0.5 | 「可能」施工，不與有觀測證據者同級 |
| `coveredCities` | 新北、桃園、臺中、基隆、嘉義縣、宜蘭 | 即時路徑的空間涵蓋；快照改用歸檔 `per_city_roadwork`>0。臺北只發布 EventType 7 → 不涵蓋 |

- 許可期間判定重用 `roadEventsLoader.isRoadEventActive`（缺生效時間不算進行中；沒有到期時間依來源新鮮度）。
- 許可多為跨月／跨年、沒有每日工時（2026-11-08 歸檔 1,100 筆只有 1 筆描述含時段），**不自行假設工時**；contribution 帶 `permit_is_not_machinery_operation`、`daily_work_hours_unknown`、`permit_span_days`。
- 接收者落在任一非涵蓋縣市外框內 → unknown（`roadwork_city_not_covered`），外框重疊處保守處理。

### 5.5 道路車流：臺北市 VD 平日典型值（W2，2026-11-11，使用者同意）

> **W6-2（0.4.0）起**：VD 不再是點聲源，改沿路延伸（§8.3）；平日判定、缺值規則、600 尺度沿用。「取代國道 proxy」規則已不存在（國道改當日實測）。

- **family 沿用 `road_traffic`，不新增 `road_traffic_typical`**：新增 family 要改引擎的 `QUERIES` 表（W5 正在改 `receiverQuery.ts`），也會讓面板、圖例、圖層 key 多一層。改在 adapter 層分流：`queryRoadTrafficCombined` 依 record payload 的 `kind` 拆成「VD 典型值」與「國道路段」兩組。
- **取代規則**：接收者在 `TYPICAL_TRAFFIC.candidateRadiusM`（300 m）內有任何臺北市 VD → 只用 VD 典型值（國道類型 proxy 不出現，註記 `freeway_type_proxy_replaced_by_vd_typical`）；否則維持國道類型 proxy（其他縣市、臺北市沒有 VD 的地方）。
- **只有臺北市平日套用**：週末、國定假日（`nonWorkdays`，取自人事行政總處 114／115 年辦公日曆表）、異常日（`anomalyDays`，目前只有 2026-10-24 Champi 颱風，理由寫在表裡）、放假日表範圍外 → 一筆 unknown（`typical_not_applicable(<reason>)`），**不退回國道 proxy、不當 0**。異常日只讀設定表，程式不寫死日期。
- 潛勢 = `proximityPotential(d, 100 m) × (1 − e^(−Q/600))`（換算尺度 600 輛／小時：使用者 2026-11-11 決定，原 1500；滿格約對應大馬路尖峰的持續車聲，非 dB；`MODEL_VERSION` 升為 `0.3.1`），Q 為該小時典型流量（輛／小時）；區間查詢取區間涵蓋各小時的最大值。`evidence=estimated`、`proxyKind=typical_weekday_volume`、`acousticConfidence=proxy`。
- 缺值：該小時流量 null → unknown `typical_flow_null`；樣本天數 < `minFlowDays`（3）→ unknown `typical_sample_insufficient`；典型流量為 0（夜間無車）→ 不產生貢獻（有效的 0）。
- 資料：`public/sound-atlas/vd-baseline-taipei.json`（`scripts/preprocess/build-sound-vd-baseline.py`；public-assets lock 登記）。基準表 679 支 VD，設備檔沒有座標的 8 支剔除（不合成座標），輸出 671 支。週末流量不輸出（上游 TotalVolume 凍結）。
- UI 必寫：「推估：2025/12–2026/01 平日典型值（N 天樣本），非當日觀測」。

## 6. W5（2026-11-11）：自然聲源三族與路線剖面

> 模型版本升為 `sound-atlas-mvp-b-0.3.0`（只新增 WIND_VEGETATION／COASTAL_WAVE／RIVER_WATER／ROUTE 參數，既有七族不變）。口徑、查核、UI 接線規格見 [ADVANCED_SOURCES.md](./ADVANCED_SOURCES.md)；遮蔽與校準研究見 [ADVANCED_RESEARCH.md](./ADVANCED_RESEARCH.md)。

- 型別：`AdvancedSoundFamily` 併入 `AnySoundFamily`、不併入 `SoundSourceFamily`（同 §5.1 理由）；`proxyKind` 新增 `wind_speed_x_canopy`、`wave_height_period_x_coast_distance`、`water_level_percentile`。
- 三族都先判「靜態脈絡」（樹冠／海岸／河道）：脈絡缺 → unknown；脈絡在但沒有候選（無樹、離海 >1 km、離河 >300 m）→ inactive；之後才看時變資料，缺 → unknown。
- 樹冠 A=0 同時代表無樹／海／無資料：範圍內全部 A=0 → unknown；有任一格有值才把其餘 A=0 當無樹。
- 河川活動＝水位在該站前 60 天（不含當天）分位表中的位置；沒有分位或樣本 <336 小時 → unknown。
- 路線剖面：等距取樣、每點時間＝出發＋距離÷速度、逐點瞬時查詢；跨日由 coverage 時間窗挑對的那天。

## 7. W6-1（2026-11-12）：雨勢網格（雷達＋雨量站）

> 架構與新增一族的步驟見 [GRID_ARCHITECTURE.md](./GRID_ARCHITECTURE.md)；量測見 [W6_GRID_SPIKE.md](./W6_GRID_SPIKE.md)。

- 分級正本 `src/sound/grid/rainClasses.json`（`rain-class-v1`）：門檻 0.5／2.5／10／40 mm/h → 無雨／小雨／中雨／大雨／豪雨；雷達 dBZ 以 Z-R（a=200、b=1.6，**假設**）換算。255＝無法判斷，畫斜線，不是無雨。
- 每格雨勢＝max(雷達分級, 最近雨量站分級)，並記錄依據（雷達／雨量站／兩者）；一方未知時用已知的一方，兩方都未知才是 255。
- 時間：網格每 10 分一格，區間內雷達取各幀最大；雨量站每小時一筆，該小時的 6 個 10 分格沿用同一筆，不內插。
- 雜波規則 `clutter-v1`（假設）：≥45 dBZ，且前後兩幀 ±8 格內最大值都低 ≥20 dB → 255。缺鄰幀或當天首末幀不判。已知不足：10-24 有連續多幀 ≥55 dBZ 的回波不會被濾掉。
- 改動：雨分級 0（< 0.5 mm/h）改為「沒有活動」，以前 0 < R < 0.5 會算有活動；雷達潛勢用該級下緣。
- 場景快照只存接收點附近的雨量站（113／75 站），所以場景模式下網格的雨量站覆蓋只有一部分，其餘靠雷達；雷達缺幀時沒有雨量站的格會是 255。
- 網格值＝接收點查詢值：兩者都走 `rainEstimateAt`，測試逐格比對真實日 0 不符。

## 8. W6-2（2026-11-12）：道路車流網格（國道實測／臺北典型／新北推估）

> 模型版本升為 `sound-atlas-w6-0.4.0`。參數正本 `soundProfiles.ts` 的 `ROAD_GRID`；估計規則只在 `src/sound/grid/roadNetwork.ts`（網格、接收點、格 popup 共用 `roadEstimateFromNear`）；預處理 `scripts/preprocess/build-sound-road-grid.py`＋`scripts/preprocess/sound/road_grid_lib.py`。

### 8.1 共通

- 潛勢 = `proximityPotential(d, half) × (1 − e^(−Q/600))`；國道 half 200 m（候選 600 m），市區 half 100 m（候選 300 m）。**國道 200 m 是假設**（車道多、車速高），未依隔音牆、高架、地形校準。
- 一格（或接收點）附近有多條路時取**最大**，不相加；國道兩方向是兩條路段，同樣取大（保守；白天兩方向都近飽和）。
- 三級證據：國道＝當日觀測（observed）／臺北＝平日典型（estimated，延伸是假設）／新北＝等級推估（inferred）。網格碼＝證據基底（0／10／20）＋五級（`potentialClassEdges` 0.1／0.3／0.5／0.75），255＝無法判斷。
- 任一已知來源潛勢 >0 時，家族值用已知的最大值；同格其他候選無法判斷時 popup 註明「其他道路無法判斷，可能更吵」。沒有任何已知來源且有候選無法判斷 → 255。離所有道路超過候選半徑 → 0（真的離路遠，不是缺資料）。
- 10 分格取區間內最大（國道是該格的那一筆樣本；臺北典型取區間涵蓋各小時的最大）。

### 8.2 國道（TDX 路段＋當日 VD）

- **單位**：`total_volume` 是 1 分鐘車流。證據：高公局 VDLive.xml 根節點 `UpdateInterval=60`、DataCollectTime 對齊整分；data.gov.tw 37662 寫「1 分鐘定時更新」；收集器每 10 分抓一次並只加總 `volume>0` 的車道。合理性：11-09 主線 Σ(144 格)×10 中位 42,555、最大 129,300 輛/日/方向。**輛/時 = 值 × 60**；每格只有一個 1 分鐘樣本，比 10 分鐘平均跳動（假設：該分鐘代表該 10 分鐘）。收集器 print 的「輛/5min」是舊標籤。
- **只用主線 VD**（代碼含 `-M-`）；匝道（I／O）、集散道（C）與 N／L／B／R 不用。
- **QA（`clean_vd_day`）**→ 該格無法判斷，不變 0：status≠0；單車道 >50 輛/分；整天全 0 的 VD；孤立 0（前後鄰格皆 ≥10）。收集器把 -99 壓成 0，原始缺值無法還原，所以夜間真 0 與缺值無法完全分開（未解）。
- **路段配 VD**：TDX 路段幾何長度與里程差最多約 1 km，改用「VD 點投影到路段線（≤150 m）」換算里程；相鄰兩支在里程中點切開；離最近 VD 里程 >2 km 的部分不配 → 無法判斷。投影後偏差中位 12 m、p95 82 m、最大 131 m（436 支）。
- 隧道（OSM `tunnel=yes`）不發聲：國道隧道段以 0.0004° 緩衝排除。每日包缺 → 國道全部無法判斷。

### 8.3 臺北市區（VD 平日典型值沿路延伸，假設）

- VD 吸附到 OSM 主要道路（trunk／primary／secondary／tertiary）：同路名 ≤40 m 優先，否則任一路名 ≤20 m；吸附 576＋67 支，28 支吸不到（不合成）。中位距離 7.9 m。
- **延伸是假設**：從 VD 沿同一基底路名延伸，到路口（與不同路名的主要道路交會）、下一支 VD 的中點、或 600 m 為止。路口另一側不延伸。
- VD 設備沒有方向欄位 → 把該 VD 的值當整條路的流量（可能只測單向或部分車道，偏低，視為下限）。
- 平日判定、缺值、0 是有效值：同 §5.5。週末、假日、異常日 → 延伸路段無法判斷（10-24 整個臺北市區斜線）。
- 臺北主要道路有 VD 涵蓋 287 km、無 VD 648 km：無 VD 的主要道路 → 無法判斷（不用等級推估補，避免同市兩種口徑混在一起）。

### 8.4 新北（及網格內其他縣市）主要道路等級推估

- 依 OSM 等級給固定流量（`estimateClassVehPerHour`）：trunk 279、primary 394、secondary 230、tertiary 184 輛/時＝臺北 VD 平日 07–19 時典型流量中位數依等級分組。**不隨時間變**（03:00＝08:00）、不分平日週末。trunk 低於 primary 是因臺北 trunk 多為高架、VD 只測部分車道。最高只到「低～中」。
- 國道（OSM motorway＝國道）不走推估，一律走 §8.2。

### 8.5 小路與排除

- 小路（residential／unclassified／living_street／road／busway／非 motorway 的 *_link）沒有流量資料：格內有小路且沒有其他已知來源 → 無法判斷（`minor_road_no_data`），不當安靜。12,299 格。
- `service`（停車場、巷內服務道路）不計。

### 8.6 已知不足

- 國道白天大多飽和（流量項 ≈1），只剩距離有差別；尺度 600 是市區口徑的使用者決定，不另設國道尺度。
- 新北推估沒有日變化；臺北延伸沒有方向；39 支國道 VD 在匯出範圍外；靜態路網 1.39 MB（gzip 349 KB）一次載入。

## 9. W6-3（2026-11-12）：飛機、鐵道、風吹樹葉、海浪、河川改為連續潛勢網格

> 規則不變：網格值＝`queryFamilyInterval(格心, [10 分格起點, +600 s))` 的 `familyResultCode`（接收點、24h 構成圖、格 popup 同一套）。kernel 只在 TS；Python 只負責裁切來源檔。模型版本不升（`sound-atlas-w6-0.4.0`，潛勢公式沒變）。

### 9.1 共通假設

- **時間**：每 10 分一格，格值＝區間內最大。飛機是區間內每 30 秒取樣（同 `queryAviationInterval`）；鐵道是列車在區間起訖兩個時刻的軌道位置之間掃過的子段（同 `queryRailInterval`，到子段的最短距離）；風、浪、河川用原生頻率的「≤ t 最新一筆」，區間內有兩筆時取大，不內插。
- **碼**：0＝已判斷、沒有；1–200＝潛勢 (0,1]，刻度 1/200；255＝無法判斷。刻度原訂 1/250，但 0.25、0.75 不是 1/250 的整數倍，「潛勢 ≥ 0.25」和「碼 ≥ 門檻碼」會差一格（測試抓到），改 1/200 後 0.02／0.04／0.1／0.2／0.25／0.3／0.4／0.5／0.75 都落在碼界。
- **顯示分級**（五族共用）：沒有／低 (0, 0.25)／中 [0.25, 0.5)／高 [0.5, 0.75)／很高 ≥ 0.75；飛機另有顯示門檻（§9.2），低於門檻歸「沒有或低於門檻」。分級只在色表，換門檻不重算。
- **unknown ≠ 0**：缺幀、航跡缺口、結構不明、測站範圍外、水位站沒有分位、樹冠遮罩都畫斜線；離岸、離河、沒樹冠、20 km 內沒飛機才是「沒有」。
- **資料範圍**：有全北北來源檔（`aviation-src-<D>`、`rain-gauge-<D>`、`natural-<D>`）的日子，網格與接收點讀同一份（origin＝grid）；其他日子接收點照舊讀場景快照或即時、網格整片斜線（`no_full_area_source`）。接收點在網格外（臺中和平）不畫網格，也不讀全範圍檔。
- 目前只有 2026-11-09、2026-10-24 兩天有來源檔。

### 9.2 飛機顯示門檻（提案，待使用者選定；預設中）

| 門檻 | 11-09「有飛機」格×時段比例 | 11-09 最尖峰一幀 | 10-24 比例 | 10-24 最尖峰 |
|---|---|---|---|---|
| 任何 > 0（20 km 內有航機） | 89.9% | 100% | 71.1% | 100% |
| 寬 ≥ 0.1（接收點面板逐筆列出的門檻，約斜距 6 km） | 23.1% | 59.5% | 15.4% | 64.3% |
| **中 ≥ 0.2（預設，約斜距 4 km）** | 12.6% | 38.0% | 8.0% | 44.3% |
| 嚴 ≥ 0.4（約斜距 2.4 km） | 3.6% | 15.5% | 2.8% | 19.4% |

- 不設門檻時北北 9 成格子整天都「有飛機」，看不出航線；寬門檻尖峰時仍蓋掉 6 成地圖。建議預設「中」，展開區可切換，網址 `?soundAviationGate=current|strict|very_strict`。
- 門檻只影響網格分級，不改接收點面板與 24h 構成圖的值。每日包只存分箱碼（箱界＝三個門檻＋分級界＋0.02／0.04／0.3／0.5），格 popup 對格心即時重算精確值。

### 9.3 各族差異

- **飛機**：每日預算包（瀏覽器一幀全網格要數秒）；包記錄來源檔 sha256，前端讀到的來源檔雜湊不同就不用（整幀斜線 `pack_source_mismatch`）。接收點固定預設耳高 1.5 m。
- **鐵道**：不預算。班表在瀏覽器從 Supabase 讀（`_daily → _fixed`），預處理拿不到同一份；前端每幀算，每班車只掃它這 10 分走過的軌道子段 1.5 km 內的格。地下段不計、結構不明與班表缺 → 斜線。**班表不反映當天停駛或誤點**（10-24 颱風日照常有車）。軌道結構 © OpenStreetMap contributors（ODbL）。
- **風吹樹葉**：每格樹冠覆蓋預先算好（`canopy-cells-v1`，格心 100 m 內 ≥3 m 樹冠，Meta/WRI）；風速取最近測站。結果呈「最近測站」的多邊形塊狀（Voronoi 外觀），是最近站模型本身的樣子，不是渲染錯誤。
- **海浪**：最近浮標浪高與週期 × 離近岸海域距離；離岸 > 1 km＝沒有，所以只有海岸帶。
- **河川**：最近水位站相對前 60 天分位 × 離河道距離；水位站範圍外、沒有分位的站 → 斜線（上游山區大片斜線）。前 60 天分位來自本機 S3 快取（W5 同一份），重建來源檔時需要該快取。

### 9.4 場景數字對照（全範圍來源 vs 原場景快照，同一時刻）

| 場景 | 家族 | 場景快照 | 全範圍來源 |
|---|---|---|---|
| 碧湖 11-09 07:39:30 | 飛機 | 0.555、斜距約 1.79 km | 相同 |
| 碧湖 | 雨 | 0.221（75 m 站） | 相同 |
| 小油坑 10-24 14:03 | 雨 | 0.990（273 m 站） | 相同 |
| 金山 10-24 14:03 | 海浪 | 0.921（離岸 73 m） | 相同 |
| 中和橋 10-24 14:03 | 河川 | 0.966（離河 13 m） | 相同 |
| 金山 | 風 | 無法判斷（樹冠未取樣） | 無法判斷（樹冠遮罩分不出） |
| 金山 | 河川 | 無法判斷（河道資料範圍外） | **有活動 0.075**（208 m 外河道） |
| 中和橋 | 風 | 無法判斷（樹冠未取樣） | **有活動 0.46** |

- 子場景說明文字（`scenes.ts` 的 reason_zh）原寫「這裡在樹冠與河道資料範圍外，風與河川顯示無法判斷」，在全範圍來源下不成立；W6-5（2026-11-12）已改：金山寫河川約 0.075、風仍無法判斷（樹冠遮罩）；中和橋寫風吹樹葉約 0.46。

## 10. W6-4/5（2026-11-12）：綜合聲景網格（甲／乙預覽）

> 使用者要「吵／不吵」的綜合網格，但已定規則是「未校準不出 dB、各族不相加」。所以做兩版預覽並排給使用者選（網址 `?soundComposite=a|b`＋地圖底部切換列），**選定前兩版都不是正式定義**。圖例與點選查詢面板固定寫「依資料推估的聲源活動，非實測音量」。常數正本 `soundProfiles.COMPOSITE`，計算 `src/sound/grid/compositeGrid.ts`。

### 10.1 共通

- **輸入**：七族同一個 10 分格的網格碼（雨、道路、飛機、鐵道、風吹樹葉、海浪、河川）；每族先換成顯示分級 L（0–4）與潛勢下緣 s（雨：該級雨量下緣的 rainPotential；道路：五級下緣 0／0.1／0.3／0.5／0.75；其他五族：(碼−1)/200）。飛機用圖層當下的顯示門檻，低於門檻 L＝0、s＝0（和飛機網格一致）。
- **不納入**：雷（北北 0 筆）、垃圾車（星期幾未知）、道路施工（臺北未涵蓋）——維持點／事件呈現；圖例寫明。
- **unknown ≠ 0**：該族在該格無法判斷（255）就不算進任何一版，也不當 0。可判斷的族 < 4（七族不到一半）→ 整格斜線。沒有全範圍來源檔的日子（目前只有 11/09、10/24 有）飛機、風、浪、河整族無法判斷 → 幾乎整片斜線，預覽列與圖例另寫一句原因。
- **只在前端 Worker 算**，不出檔；點選查詢面板對同一格的七個碼呼叫同一支 `compositeCell`，所以面板數字＝地圖顏色。

### 10.2 甲：偏活躍種數（不相加）

- 數 L ≥「中」（activeMinLevel，七族都是 2）的族數：0 種＝平靜、1 種＝一般、≥2 種＝熱鬧（levelCuts [1, 2]）。另列「最明顯的族」（分級最高，同級比潛勢）。
- 假設：各族的「中」是各自的顯示切點，**不代表聽起來一樣大聲**；甲只說「此刻有幾類聲源偏活躍」，不說哪裡比較吵。
- 實測分布（node，七族真實資料）：11-09 各時刻平靜 34–40%、一般 43–50%、熱鬧 16–17%；10-24 14:00（颱風）熱鬧 43%。偏活躍最常見的是風吹樹葉（20–45% 格）；新北道路是等級推估，很少到「中」。

### 10.3 乙：假設權重指數（實質相加）

- 指數＝Σ w·s ／ Σ w，只對可判斷的族加總並重新正規化權重（未知族不當 0）。權重：道路 1、鐵道 0.8、飛機 0.8、雨 0.6、海浪 0.6、風吹樹葉 0.4、河川 0.4。
- **權重是自訂假設、沒有任何量測依據；加權平均等同把不同聲源相加；未經校準。** 這正是「各族不相加」規則想避免的事，所以乙只作為預覽讓使用者比較，選乙等於改規則，需使用者明確同意。
- 斜線：可判斷族 < 4，或可判斷權重占比 < 0.5。後者單獨不夠：沒有全範圍來源檔的日子只剩雨、道路、鐵道，占比 0.52 過半，若只看占比會在只知道三族時照樣上色。
- 色階上限 0.3（displayMaxIndex）：兩個場景日 93–100% 的格指數 < 0.2（加權平均被沒有活動的族拉低），色階若拉到 1 幾乎整片同色。只影響顏色。

### 10.4 驗證

- `src/sound/__tests__/compositeGrid.test.ts`：測試內依本節文字另寫一份公式（不呼叫 compositeCell），對真實 11-09、10-24 各 4 個時刻 × 兩個飛機門檻、每次 ≥200 格逐格比對 Worker 核心輸出；隨機 5,000 格比對；斜線門檻、權重重新正規化、飛機門檻連動各一題。

