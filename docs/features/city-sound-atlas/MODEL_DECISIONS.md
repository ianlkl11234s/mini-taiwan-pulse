# MODEL_DECISIONS — 聲源 kernel、單位與假設

> 模型版本：`sound-atlas-mvp-a-0.1.0`（`src/sound/model/soundProfiles.ts` 的 `MODEL_VERSION`）。
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
