# MVP_B_SOURCES — 鐵道、道路車流、施工：查核、口徑、限制（W4）

> 查核日：2026-11-11（臺北）。模型 `sound-atlas-mvp-b-0.2.0`。計畫書 §3 R01／T01／C01、§5.5、§11。
> 範圍：資料查核＋adapter＋引擎接入＋測試，**不含 UI**（接線規格見 §6）。不新增 RPC、migration、collector。
> 本次 shell 沒有 `SUPABASE_DB_URL`，**沒有查正式 DB**；表格的保留期限依 gis-platform migration 檔，資料樣本取自 S3 正本（唯讀）。

## 1. 結論一覽

| 代號 | 來源（重用） | 可行性 | 證據等級 | 進快照 |
|---|---|---|---|---|
| R01 鐵道 | `railLoader.loadAllRail`（軌道幾何、station_progress）＋`fetchTraDailySchedule`／`fetchSupabaseSchedule(system, 營運日)` | **可做**：列車＝移動點，地下段排除 | scheduled（班表，不是觀測） | 否（班表即時算） |
| T01 車流 | `freewayLoader.fetchFreewayDay`（`get_freeway_congestion_day`） | **只能做道路類型 proxy**：前端沒有任何車流量來源 | inferred（`proxyKind=road_type_no_volume`） | 否 |
| C01 施工 | `roadEventsLoader.fetchRoadEventsDay`（`get_road_events_day`，event_city、EventType=2） | **可做**：許可期間＝可能活動 | scheduled（`proxyKind=permit_window_possible_activity`） | **是**（S3 歸檔，接收點 ±5 km） |

## 2. R01 鐵道

### 2.1 既有資料

- 系統：台北捷運（含環狀、機捷、淡海、安坑；貓空纜車排除）、台鐵、高鐵、高雄捷運、高雄輕軌、台中捷運。
- 軌道：`public/rail/<system>/tracks/*.geojson`＋`station_progress.json`（每條軌道每站的 0–1 progress）。台鐵用 O-D 專屬軌道（`traData.odTracks`，只載 `master_schedule.json` 出現的軌道 id）。
- 班表：`reference.daily_schedules` 的 `<system>_daily`（指定日）→ 沒有時退回 `<system>_fixed`（固定表）。前端拿到的資料分不出是哪一種 → adapter 標 `basis=daily_or_fixed_unverified`。本機 TRTC 班表是「平日範本」（`is_weekday: true`，依班距產生），不是逐班實際時刻。
- **結構屬性：沒有**。查過各系統 stations／tracks 的 properties、`mini-taipei-v3`、`gis-wiki`，都沒有地下／高架欄位（高捷車站地址偶有「地下一層」字樣，不足以判斷站間）。

### 2.2 地下段判定依據（`src/sound/model/railSegments.ts`）

用 OpenStreetMap 的鐵道標記比對 Pulse 軌道幾何，產生站間結構表 `railSegmentTable.generated.ts`：

- 產生器：`scripts/preprocess/build-rail-segments.py`（Overpass 查詢、門檻、OSM 資料時間都寫在表頭 `RAIL_SEGMENT_TABLE_META`）。本次 OSM 基準 `2026-11-11T10:43:01Z`，8,978 條鐵道 way。
- 每對相鄰站（依該軌道 progress 排序）每約 20 m 取樣，找 40 m 內種類相符的 OSM way（台鐵配 rail／narrow_gauge 且非高鐵；高鐵配 highspeed 或高鐵營運者；捷運配 subway／light_rail／monorail；排除 yard／siding／spur／crossover）：
  - underground：`tunnel=yes|culvert`、`location=underground`、或 `layer<0` 且非橋
  - covered：`tunnel=building_passage|covered|avalanche_protector` 且 layer≥0
  - elevated：`bridge≠no` 或 `layer>0`
  - at_grade：都沒有（OSM 慣例：沒標＝地面；這是標記假設，未實地查證）
- 站間分類：未比對比例 >20% → unknown；地下 ≥95% → underground；地下＋covered ≤2% → elevated／at_grade（≥80% 一致）或 surface（兩者混合）；其餘（洞口過渡）→ unknown。同站對在不同軌道結果不一致 → unknown。
- 產出 547 段：

| 系統 | 地下 U | 高架 E | 地面 G | 混合 S | 不明 X |
|---|---|---|---|---|---|
| trtc | 78 | 71 | 8 | 2 | 28 |
| tra | 11 | 21 | 102 | 42 | 81 |
| thsr | 2 | 4 | 0 | 0 | 5 |
| krtc | 23 | 9 | 0 | 0 | 5 |
| tmrt | 0 | 16 | 0 | 1 | 0 |
| klrt | 0 | 0 | 33 | 2 | 3 |

- 抽查（測試 `railSegments.test.ts` 固定住）：板南線 BL01–BL02 地下；高鐵南港–臺北 地下；台鐵 臺北–萬華（1000–1010）地下；文湖線 松山機場–大直（BR13–BR14）地下、內湖段（BR18–BR19）高架、中山國中–松山機場與大直–劍南路為洞口段 → unknown；淡水線 民權西路–圓山（R13–R14）洞口 → unknown、圓山以北高架。高鐵板橋以南多數站間含山岳隧道 → unknown。
- **授權**：表是 OSM 衍生資料（© OpenStreetMap contributors，ODbL 1.0）。網站顯示要標示 OSM；ODbL 對衍生資料庫有相同方式分享要求，正式上線前請主 agent／使用者確認標示方式（§7）。

### 2.3 口徑

- 列車位置與 `RailEngine`／`TraTrainEngine` 同規則（測試在 6 個時刻對照 `RailEngine.update`）。站不在 progress 表 → unknown（引擎用索引比例猜，聲景不猜）。
- 地下段不產生貢獻；unknown 段 → `status=unknown`、潛勢 null；車站點前後結構不同 → unknown。
- 查 D 日讀 D−1、D 兩個營運日。捷運類（trtc、krtc、tmrt、klrt…）沿用引擎的延長日制（05:50 前算前一營運日，`timeToSeconds`）；台鐵、高鐵沿用 `TraTrainEngine` 的日曆日制（班表 D 的 04:57 就是 D 日 04:57）。D−1 營運日的查詢窗延到最後一班的結束時間（延長日制至少到 05:50），05:50 前發車、之後仍在跑的列車不會消失。取不到 → 該（系統、營運日）unavailable，該系統地上段附近回 unknown；不拿今天班表回填（T12）。
- 區間查詢解析求最短距離，不取樣（高鐵不漏）。
- 已知不做：隔音牆、車種、速度、結構噪音、誤點與停駛（颱風停駛日班表照樣跑——10/24 場景鐵道結果只代表「照班表」）。

## 3. T01 道路車流

### 3.1 查核

| 資料 | 位置 | 有流量？ | 前端可讀？ | 保留 | 結論 |
|---|---|---|---|---|---|
| 國道路段壅塞 | `get_freeway_congestion_day` → 路段幾何＋`ts,level,speed` | 否（等級、旅行速率） | 是 | `cleanup_freeway_congestion_daily(7)` | 用作道路類型 proxy 的幾何 |
| 省道路段壅塞 | `get_road_congestion_day`（timeline 字串，幾何在 `public/road/road_congestion_highway.pmtiles`） | 否 | 是（幾何要讀 PMTiles） | 7 天 | 本版不接（要解 PMTiles，且仍無流量） |
| 國道 VD 車流 | `live.freeway_vd_traffic`（mig 011 原 `realtime`，21 天）；S3 `freeway_vd/archives/<D>.tar.gz`（每 10 分鐘，3,285 VD） | **是** | **否**：沒有 public RPC；歸檔只有 `VDID` 字串（例 `VD-N3-N-25-O-SE-1-木柵休息站`），沒有座標 | 21 天／S3 永久 | 要用需新 RPC 或 VD 靜態座標表（本版禁止新增） |
| 市區 VD（臺北、新北） | collector `vd`；S3 `vd/` | 是 | 否 | — | S3 最後一筆 `vd/2026/01/14`、`latest.json` 2026-01-14，之後沒有歸檔；data-collectors `config.py` `_COLLECTOR_TOGGLES` 的 `('VD', False, 5)` 預設停用（主機上的實際設定未查） |
| 國道逐車模擬 | `freewayTdcsSim*`（ADR-0025 sim bundle） | 模擬值 | 是 | — | 是模擬不是觀測，且只涵蓋雙北國道，不接 |

### 3.2 口徑

- 預設只有**道路類型 proxy**：國道路段 500 m 內 → active，潛勢＝`1/(1+(d/100)²)`×道路類型權重（freeway 1）。`proxyKind=road_type_no_volume`、`evidence=inferred`、`acousticConfidence=unmeasured`、`temporalPrecision=none(road_type_static)`。UI 必須寫「道路類型 proxy（無車流量）」。
- 壅塞等級、速率只進 notes（`…(not_volume)`）：凌晨與下午都可能「順暢」，等級不能當流量。
- 500 m 內沒有任何已載入路段 → 一筆 unknown（`road_network_not_covered(only_freeway_sections_loaded)`）。**市區絕大多數接收點會是 unknown**，這是誠實結果。
- payload 保留可選 `volume` 序列：日後有 VD 流量（含座標）注入 → `proxyKind=observed_volume`、`evidence=observed`；樣本超過 15 分鐘或 null → unknown。
- 不進快照：只有道路類型，沒有時變資料需要凍結；node 驗算讀不到 RPC → 驗算顯示 unavailable（§5）。

## 4. C01 道路施工

### 4.1 查核

- Pulse 已有 `roadEventsLoader`（`get_road_events_day`）＝TDX RoadEvent 四來源；施工在 `event_city`（縣市預告事件，collector `road_event_planned` 每 12 小時抓 10 縣市）。保留：`road_events` 分區 21 天（mig 282）；`road_events_current` 的 event_city 3 天（mig 455）。S3 `road_event_planned/archives/<D>.tar.gz` 有完整歷史（場景三天都在）。
- 2026-11-08 歸檔（1,100 筆）：EventType 2（施工，子類 205／206／207／298／299）1,052 筆；EventType 7／798 48 筆，標題多為「挖掘管制」區（例：臺北「雙效標線試辦作業…納入挖掘管制區域」）——**是管制區不是施工，不納入**。
- per_city（全部事件）：臺北 41、新北 523、桃園 310、臺中 99、基隆 80、嘉義縣 27、宜蘭 20；**臺南、高雄、金門 0**（collector 有查，視為沒有發布）；其餘縣市 collector 沒查。
- **只算 EventType 2**：新北 523、桃園 310、臺中 92、基隆 80、嘉義縣 27、宜蘭 20；**臺北 0——臺北 41 筆全是 EventType 7（挖掘管制區）**。所以臺北市不算涵蓋（unknown），不是「臺北沒有施工」。快照因此另記 `per_city_roadwork`（各縣市 EventType 2 筆數），涵蓋判斷只看它；舊的 `per_city` 含非施工事件，只供參考。
- RPC 語意（mig 312）：`get_road_events_day(D)` 回「臺北日 D 收集到的列」中每個事件的最新版；event_city 每 12 小時整包重抓，所以跨年許可每天都會出現。
- 許可時段：多為跨月甚至跨年（例：新北污水下水道 2022-12-12～2027-01-13）；1,100 筆只有 1 筆描述含「HH:MM–HH:MM」→ **沒有每日工時**。
- `EventStep` 的語意未查證 TDX 規格，只原樣保留在快照列，不使用。

### 4.2 口徑

- 許可期間判定重用 `isRoadEventActive`（缺生效時間不算進行中、沒有到期時間依來源新鮮度 36 小時）。
- 許可期間內：`active`、`evidence=scheduled`、`proxyKind=permit_window_possible_activity`、潛勢＝距離 kernel（half 80 m，候選 300 m，多邊形內＝0 m）×0.5；notes 帶 `permit_is_not_machinery_operation`、`daily_work_hours_unknown`、`permit_span_days`。可切 `permitWindowPolicy='unknown'`。
- 許可期間外 → 不產生貢獻；涵蓋縣市內＋來源健康 → inactive（0）。
- 接收點所在外框有任一非涵蓋縣市（即時：`ROADWORK.coveredCities`，臺北市已移除；快照：`per_city_roadwork`>0，沒有這欄＝全部未涵蓋）→ unknown（`roadwork_city_not_covered`）。副作用：臺北市外框蓋到板橋、三重、汐止等新北地點，這些地點也是 unknown。
- 快照區塊只裁切接收點 ±5 km（±30 km 會讓兩個臺北場景超過 2 MB），區塊自帶 `bbox`；接收點（含 300 m 候選半徑）移出 → unknown（`outside_snapshot_bbox`）。

## 5. 三場景結果（`verify-sound-scenes.ts`，10 分鐘格 ×144）

鐵道用本機固定時刻表範本（`--rail-dir` 指主 checkout `public/rail`，basis=local_template），**不是場景當天實際班表**；道路車流 node 讀不到 RPC → unavailable。詳見 DATA_QUALITY_REPORT §8。

| 場景 | 鐵道 | 道路車流 | 施工 |
|---|---|---|---|
| taipei-1109（內湖碧湖） | active 111／inactive 33；最近文湖線高架段約 0.9 km，最強 0.083；07:39:30 為 0.074（881 m，elevated） | unavailable | unknown 144（`roadwork_city_not_covered`：臺北市當日 0 筆 EventType 2；±5 km 內有 2 筆新北許可） |
| taichung-heping-1108（南湖大山南側） | inactive 144（1.5 km 內無軌道） | unavailable | unknown 144（外框同時落在花蓮縣，未涵蓋） |
| taipei-typhoon-1024（小油坑） | inactive 144 | unavailable | unknown 144（臺北市未涵蓋） |

## 6. 給 UI 的接線規格（主 agent 接）

1. **型別**：把 `MvpBSoundFamily` 併進 `SoundSourceFamily`，然後補齊下列 `Record<SoundSourceFamily, …>`（W4 實測 tsc 會指出的 9 檔）：`soundAtlasColors.ts`（SOUND_FAMILY_COLORS）、`components/sound/soundAtlasText.ts`（FAMILY_KEYS）、`components/sound/SoundReceiverPanel.tsx`（FAMILY_LAYER_KEYS、vis）、`components/sound/SoundDayProfile.tsx`、`components/featureInfo/soundAtlasPanels.tsx`（FAMILIES、FAMILY_PROVIDER）、`components/legend/soundAtlasLegends.tsx`（FAMILIES）、`hooks/useSoundAtlasLayer.ts`（POINT／LINK layer id、flags、opacity）、`layers/hosts/soundAtlasHost.tsx`、`sound/soundAtlasData.ts`（`familyLoadKey`、`loadSoundFamily` switch 加 `loadMvpBFamily`、`indexRecords`）、`sound/scenes.ts`（`snapshotOrigin` 加 roadwork）。之後 `SOUND_FAMILIES` 可直接用 `SOUND_FAMILIES_ALL`。
2. **載入**：`src/sound/mvpBSources.ts` 的 `loadMvpBFamily(family, date, snapshotJson)`；快照只在 `snapshotApplies` 為真時傳原始 JSON。鐵道首次載入會跑 `loadAllRail()`（數百個 geojson，已有 loadingRegistry 與 10 分鐘快取）。
3. **layer key 建議**：`soundRail`、`soundRoadTraffic`、`soundRoadwork`（opacity 鍵 `soundRailOpacity` 等，與既有四層同模式）。
4. **顏色建議**（與現有 #38bdf8／#2dd4bf／#facc15／#fb923c 區隔，需過 design-system §3.16）：鐵道 `#a78bfa`、道路車流 `#f87171`、施工 `#e879f9`（不用黃橙系，避免與雷、垃圾車混淆）。
5. **圖例文字三語草稿**：
   - 鐵道｜zh：「列車（地面／高架，依班表）：地下段不發聲；結構不明的路段顯示無法判斷」｜en: "Trains (surface/elevated, scheduled): underground sections are silent; sections of unknown structure show as unknown"｜ja: 「列車（地上・高架、時刻表ベース）：地下区間は対象外、構造不明の区間は判定不能」
   - 道路車流｜zh：「道路類型 proxy（只有國道，無車流量）：離國道越近越高；其他道路無資料」｜en: "Road-type proxy (national freeways only, no traffic volume); other roads: no data"｜ja: 「道路種別による代理指標（国道のみ・交通量なし）：その他の道路はデータなし」
   - 施工｜zh：「道路施工許可期間（可能施工，許可≠機具運轉）」｜en: "Roadwork permit period (possible activity; a permit is not machinery running)"｜ja: 「道路工事の許可期間（工事の可能性。許可＝機械稼働ではない）」
   - 出處：鐵道結構「© OpenStreetMap contributors」；施工「TDX 縣市預告事件」；車流「TDX 國道路況（壅塞等級，非流量）」。
6. **面板措辭**：依 `contribution.proxyKind`／`railStructure` 決定字樣；`road_type_no_volume` 不可出現「車流量」數字或「車多」語意。

## 7. 未解

- 道路車流量：要有國道 VD 座標（TDX `VD/Freeway` 靜態表）＋ public RPC 或 R2 快照，才能從 proxy 升為 observed（需使用者拍板：新 RPC／collector）。市區 VD 收集停在 2026-01-14，collector 預設停用（`VD` toggle false）。
- 臺北市只發布挖掘管制區（EventType 7），施工族在臺北與周邊重疊區一律 unknown；要涵蓋需另找臺北市道路挖掘資料來源（使用者決定）。
- 結構屬性在 mini-taipei-v3、gis-wiki 都沒有（已查），所以改用 OSM。
- 鐵道結構表的 ODbL 標示與分享方式要確認；表外與洞口段 unknown 比例高（台鐵 81／257），若要細化可改存「軌道 progress 子區間」而非站間。
- 台鐵每日班表的 O-D 軌道若不在 `master_schedule.json`，前端沒載幾何 → 這些班次被略過（計數寫在 coverage reason）。
- 施工快照已併入本 worktree 的三個場景檔（gitignored），sha 已變；**lock 未改**，主 agent 要重登記 `build-public-assets-lock.py add` 並上傳。
- 施工 `EventStep` 語意、新北／桃園事件是否含已完工但未下架者，未查。
