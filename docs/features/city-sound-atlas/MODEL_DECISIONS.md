# MODEL_DECISIONS — 聲源 kernel、單位與假設

> 模型版本：`sound-atlas-mvp-b-0.2.0`（`src/sound/model/soundProfiles.ts` 的 `MODEL_VERSION`；§0–§4 為 MVP-A `0.1.0` 的決定，參數未變）。
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

- **family 沿用 `road_traffic`，不新增 `road_traffic_typical`**：新增 family 要改引擎的 `QUERIES` 表（W5 正在改 `receiverQuery.ts`），也會讓面板、圖例、圖層 key 多一層。改在 adapter 層分流：`queryRoadTrafficCombined` 依 record payload 的 `kind` 拆成「VD 典型值」與「國道路段」兩組。
- **取代規則**：接收者在 `TYPICAL_TRAFFIC.candidateRadiusM`（300 m）內有任何臺北市 VD → 只用 VD 典型值（國道類型 proxy 不出現，註記 `freeway_type_proxy_replaced_by_vd_typical`）；否則維持國道類型 proxy（其他縣市、臺北市沒有 VD 的地方）。
- **只有臺北市平日套用**：週末、國定假日（`nonWorkdays`，取自人事行政總處 114／115 年辦公日曆表）、異常日（`anomalyDays`，目前只有 2026-10-24 Champi 颱風，理由寫在表裡）、放假日表範圍外 → 一筆 unknown（`typical_not_applicable(<reason>)`），**不退回國道 proxy、不當 0**。異常日只讀設定表，程式不寫死日期。
- 潛勢 = `proximityPotential(d, 100 m) × (1 − e^(−Q/1500))`，Q 為該小時典型流量（輛／小時）；區間查詢取區間涵蓋各小時的最大值。`evidence=estimated`、`proxyKind=typical_weekday_volume`、`acousticConfidence=proxy`。
- 缺值：該小時流量 null → unknown `typical_flow_null`；樣本天數 < `minFlowDays`（3）→ unknown `typical_sample_insufficient`；典型流量為 0（夜間無車）→ 不產生貢獻（有效的 0）。
- 資料：`public/sound-atlas/vd-baseline-taipei.json`（`scripts/preprocess/build-sound-vd-baseline.py`；public-assets lock 登記）。基準表 679 支 VD，設備檔沒有座標的 8 支剔除（不合成座標），輸出 671 支。週末流量不輸出（上游 TotalVolume 凍結）。
- UI 必寫：「推估：2025/12–2026/01 平日典型值（N 天樣本），非當日觀測」。
