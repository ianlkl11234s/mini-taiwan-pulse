# DATA_QUALITY_REPORT — 場景快照的涵蓋、品質與引擎實跑

> 產生：2026-11-11。產生器 `scripts/preprocess/build-sound-scenes.py`；驗算 `scripts/preprocess/verify-sound-scenes.ts`（vite-node）。模型 `sound-atlas-mvp-a-0.1.0`（§8 起為 `sound-atlas-mvp-b-0.2.0`）。
> 重現：
> ```bash
> SUPABASE_DB_URL=… AWS_PROFILE=<可讀 migu-gis-data-collector 的 profile> python3 -I scripts/preprocess/build-sound-scenes.py
> python3 scripts/deploy/build-public-assets-lock.py add public/sound-atlas/scenes/*.json   # 檔內有 generated_at，重產後 sha 會變
> npx vite-node scripts/preprocess/verify-sound-scenes.ts [--scene ID] [--receiver lon,lat] [--peak HH:MM-HH:MM] [--json OUT]
> ```
> 2026-11-11 這次產生時 shell 沒有 `SUPABASE_DB_URL`，是用一個本機包裝腳本從 mini `.env` 只取這一個變數帶進環境（不印出）；AWS 用既有 profile `pulse-personal`。

## 1. 快照契約（`pulse-sound-scene-v1`）

```
{ schema, id, title_zh, date, focus_time,
  receiver:{lon,lat,height_m:1.5,label_zh,reason_zh}, bbox:[w,s,e,n],
  aviation:{origin, health, rows:[{flight_id,callsign,aircraft_type,origin,destination,trail}]},
  thunder:{origin, health:{cwa,taipower}, events:[{event_id,event_id_str,source,strike_ts,lon,lat,strike_type,intensity_ka}]},
  rain:{origin, health, rows:[get_rain_gauge_day 同形]},
  notes_zh:[…], generated_at }
```

在原始契約之外多了三個欄位：`aviation.health`、`rain.health`（語意同 `thunder.health`）、`events[].event_id_str`（cwa id 超過 2^53，見 §4），以及 `generated_at`。

**接快照的規則（UI／任何讀者照做）**：
- coverage 取快照的 `health`，**不可用 bbox 內筆數重判**。bbox 內 0 筆落雷、但 health=ok，代表「真的沒有」（inactive），不是 unknown。直接把快照餵 `loadThunder` 會依 bbox 內筆數判 `empty`，把它變成 unknown，這是錯的。正確轉換見 `verify-sound-scenes.ts` 的 `sceneToSets`。
- 垃圾車不在快照，前端照常讀既有班表靜態快照（週期資料）。
- `trail` 的高度單位沒有改，照引擎依 `flight_id` 判斷。

裁切規則：bbox＝接收點 ±30 km；航跡保留「任一點落在 bbox」的航班，整條不截斷；落雷只留 bbox 內；雨量只留接收點 ±15 km 內各站（引擎只用 5 km 內最近站；±30 km 會讓臺北場景超過 2 MB）。

## 2. 三個場景

| id | 日期 | 接收點 | 理由（摘要） | focus_time |
|---|---|---|---|---|
| `taipei-1109` | 2026-11-09 | 121.5830, 25.0860 內湖碧湖 | 松山機場東北方、東側起降航線附近（07:39 有航機在斜距 1.8 km）；碧湖國小雨量站（A1AA40）旁 75 m，當天 5 小時有雨（內湖站只 2 小時，所以換點） | 07:39:30（上午飛機潛勢最高、同時在下雨） |
| `taichung-heping-1108` | 2026-11-08 | 121.4380, 24.3350 南湖大山南側 | 台電 10:25:26 落雷（121.4399, 24.3149）北方 2.2 km；從指定的 121.440, 24.315 往北移，讓最近雨量站南湖圈谷（C0F0E0）落在 5 km 內（原點距 5.6 km，雨會整天 unknown） | 10:25:34（雷聲抵達後 1 秒；閃光時刻聲音還沒到） |
| `taipei-typhoon-1024` | 2026-10-24 | 121.5420, 25.1800 陽明山小油坑 | Champi 颱風；小油坑雨量站（A1AD40）旁 270 m；10/24 臺北市 1 小時雨量最大的站（14 時 46.5 mm） | 14:03:00（雨最大、同時有航機在 20 km 內） |

## 3. 各源筆數與檔案大小

| id | 檔案 | 航班（ft／m） | 航跡點 | 落雷 health（cwa／taipower） | 落雷全台（cwa＋taipower）／bbox 內 | 雨量站／列 | 來源 |
|---|---|---|---|---|---|---|---|
| taipei-1109 | 1,546,009 B | 1,262（785／477） | 17,238 | empty／ok | 0＋5／0 | 113／2,710 | 全 RPC |
| taichung-heping-1108 | 168,985 B | 127（68／59） | 2,359 | empty／ok | 0＋8／1（taipower） | 10／240 | 全 RPC |
| taipei-typhoon-1024 | 1,084,273 B | 970（603／367） | 13,003 | ok／ok | 3＋9／0 | 75／1,761 | 航跡、落雷 S3；雨 RPC |

三檔都在 2 MB 目標內。

## 4. 品質發現

**時間與歸日**
- `flight_trails_daily.day` 與 S3 `trails/flights/<D>.json.gz` 都是**臺北日**，每列實際涵蓋 D−1 23:00～D+1 01:00。產生器比對了 D±1 檔：三個場景都沒有「時間在 D、飛經 bbox、但 D 檔沒有」的 flight_id。
- S3 落雷 archive 以**收集時間的臺北日**歸檔：`lightning_cwa/archives/2026-10-24.tar.gz` 第一個檔（00:00 收集）裝的是 10-23 23:07（臺北）的事件。所以臺北日 D 要讀 D 與 D+1 兩包、依 `strike_time` 的臺北日期過濾，再以 (source, event_id) 去重。cwa 每 5 分鐘一檔（D 包 287 檔），台電每 30 分鐘一檔。
- cwa `strike_time` 只到分鐘；`event_id` 18 位數超過 2^53，JS 端解析會失真（本次 bbox 內沒有 cwa 事件，未發生相撞）。

**飛機**
- 點距中位數 300 秒、p90 約 300–341 秒；引擎段內 ≤600 秒線性內插。臺北 11/9 段內 10–30 分鐘間隔 267 個（→ unknown）。
- 所有點 alt > 0（快照內沒有地面點）；高度基準未校正。
- 20 km 候選半徑讓臺北「飛機 active」幾乎整天成立（136／144 格），但多數格的值只有 0.01–0.05；UI 若要表達「明顯聽得到」需另設顯示門檻（屬 UI 決定，引擎不改）。

**雨**
- 每站每小時一筆；`precipitation_1hr` 三場景都沒有 null。`precipitation_10min` 臺北 11/9 有 819／2,710 列 null，且 10/24 小油坑 14 時出現 10min＝209.5、1hr＝46.5 的矛盾值，語意待上游查證（不使用）。
- 颱風場景 75 站中 70 站有完整 24 小時。

**雷**
- 11/8、11/9 cwa 全台 0 筆（health=empty）；taipower 有資料（ok）。依引擎規則，只要 taipower ok，接收點附近 0 筆就是 inactive。
- 10/24 兩源都 ok，但颱風外圍沒有落在接收點 30 km 內的雷。

**保留期（快照存在的理由）**
- 航跡、落雷 Supabase 只留 7 天：11/8、11/9 的原始資料約 11/15–16 起就查不到；10/24 已經過期，本次從 S3 取。
- 雨量 Supabase 30 天：10/24 約 11/23 後查不到。

## 5. 引擎實跑（10 分鐘格 × 144 格，接收點如 §2）

| 場景 | 家族 | active 格 | inactive | unknown | unknown ratio | 最強值＠時刻 |
|---|---|---|---|---|---|---|
| taipei-1109 | 飛機 | 136 | 4 | 4 | 0.028 | 0.764＠15:40 |
| | 雨 | 30 | 114 | 0 | 0 | 0.221＠07:00（2.5 mm/h） |
| | 雷 | 0 | 144 | 0 | 0 | — |
| taichung-heping-1108 | 飛機 | 14 | 130 | 0 | 0 | 0.141＠10:10 |
| | 雨 | 0 | 144 | 0 | 0 | 0（南湖圈谷整天 0 mm） |
| | 雷 | 1 | 143 | 0 | 0 | 0.641＠10:20 格 |
| taipei-typhoon-1024 | 飛機 | 106 | 22 | 16 | 0.111 | 0.361＠21:40 |
| | 雨 | 126 | 18 | 0 | 0 | 0.990＠14:00（小油坑 `precipitation_1hr`＝46.5 mm） |
| | 雷 | 0 | 144 | 0 | 0 | — |

focus_time 瞬時查詢：
- 臺北 07:39:30：飛機 0.555（斜距 1,791 m）、雨 0.221（站距 75 m）。
- 和平 10:25:34：雷 0.559（距離 2,243 m，延遲 6.54 秒，2D 近似）；在閃光時刻 10:25:26 查詢是 inactive（聲音還沒到），這是預期行為。
- 颱風 14:03:00：雨 0.990（站距 273 m）、飛機 0.099（斜距 6,021 m）。颱風日航跡缺口較多（unknown ratio 0.111，例如 08:00 的飛機是 `trail_gap_over_30min_between_segments`）。
- 垃圾車在三個場景都沒有載入（family＝unavailable／source_not_loaded），屬預期。

## 6. UI 接線的實測問題（2026-11-11，W2 commit c31e4843 時的 `src/sound/scenes.ts`）

用 W2 的 `parseSceneSnapshot` → `snapshotFetchers` → `loadThunder` 跑三個真實快照（三檔都能 parse）：

| 場景 | 落雷 coverage（W2 路徑） | 雷 unknown ratio（W2 路徑） | 本報告 §5（health 直接當 coverage） |
|---|---|---|---|
| taipei-1109 | cwa:empty、taipower:**empty** | **1.000（整天 unknown）** | 0（整天 inactive） |
| taichung-heping-1108 | cwa:empty、taipower:ok | 0 | 0 |
| taipei-typhoon-1024 | cwa:empty、taipower:**empty** | **1.000** | 0 |

原因：`snapshotFetchers` 在 health=ok 時只回 bbox 內事件，0 筆時 `loadThunder` 依筆數判 `empty`，兩源都 empty → unknown。修法：coverage 直接取快照 health（`verify-sound-scenes.ts` 的 `sceneToSets` 寫法），不要經 `loadThunder` 重判。另外 `SOUND_SCENES` 內建的接收點／focus 和快照不同（例：和平 121.44, 24.315 離最近雨量站 5.6 km，雨會整天 unknown），建議改讀快照的 `receiver` 與 `focus_time`。

## 7. 未解

- 快照尚未上傳 S3（lock 已登記 `delivery=r2`）；發版前要跑 `scripts/deploy/upload-deploy-assets.sh`，否則正式站 404。見 handoff。
- cwa `event_id` > 2^53 的精度問題在既有 RPC 路徑也存在，未修。
- VALIDATION_REPORT.md（計畫 §13：測試、瀏覽器驗收、效能）未寫，待 W2 UI 完成後補。

## 8. MVP-B（W4，2026-11-11）：施工區塊與三新家族引擎實跑

模型 `sound-atlas-mvp-b-0.2.0`。查核與口徑見 [MVP_B_SOURCES.md](./MVP_B_SOURCES.md)。

**快照變更**：三個場景檔加 `roadwork` 區塊（`build-sound-scenes.py --merge-mvp-b`，只讀 S3、不需資料庫；其他區塊原樣）。

| id | 檔案 | 施工 health | 全台施工事件（EventType 2，D−1＋D 兩包依 EventID 去重） | 接收點 ±5 km 且許可與當日重疊 | `per_city_roadwork`（D 包最後一個檔的 EventType 2 筆數；0＝未涵蓋） |
|---|---|---|---|---|---|
| taipei-1109 | 1,513 KB | ok | 1,644 | 2 | 新北 531、桃園 347、臺中 105、基隆 80、嘉義縣 36；臺北、臺南、高雄、宜蘭、金門 0 |
| taichung-heping-1108 | 166 KB | ok | 2,037 | 0 | 新北 523、桃園 310、臺中 92、基隆 80、嘉義縣 27、宜蘭 20；臺北、臺南、高雄、金門 0 |
| taipei-typhoon-1024 | 1,060 KB | ok | 2,686 | 0 | 新北 510、桃園 233、臺中 194、基隆 129、嘉義縣 54、宜蘭 13、金門 3；臺北、臺南、高雄 0 |

- 兩欄口徑不同：事件取 D−1＋D（含 D−1 收集、D 已下架者），涵蓋只看 D 的最後一次收集。例：宜蘭 11-08 有 20 筆、11-09 為 0 → 11-09 宜蘭算未涵蓋，但 11-08 收到的宜蘭事件仍在事件列表（只對未涵蓋處之外的接收點有影響）。
- 臺北市三天都是 0 筆 EventType 2（只發布 EventType 7 挖掘管制區）→ 兩個臺北場景施工一律 unknown，不是「沒有施工」。
- 施工只裁切接收點 ±5 km（第一次用 ±30 km，兩個臺北場景到 2.3 MB 超標）；區塊帶 `bbox`，接收點移出 → unknown。
- 鐵道（班表，即時算）與道路車流（只有道路類型 proxy）不進快照。
- 三檔 sha 已變，`deploy/public-assets.lock.json` 未改（共用登記檔），要重登記並上傳。

**引擎實跑**（10 分鐘格 ×144；鐵道用本機固定時刻表範本 basis=local_template，不是場景日實際班表；道路車流 node 讀不到 RPC）：

| 場景 | 家族 | active | inactive | unknown | unavailable | 最強值＠時刻 | 說明 |
|---|---|---|---|---|---|---|---|
| taipei-1109 | 鐵道 | 111 | 33 | 0 | 0 | 0.083＠00:00 格 | 文湖線內湖段高架，最近約 0.9 km；01–06 時無車 |
| | 道路車流 | 0 | 0 | 0 | 144 | — | source_not_loaded |
| | 施工 | 0 | 0 | 144 | 0 | — | roadwork_city_not_covered（臺北市未涵蓋） |
| taichung-heping-1108 | 鐵道 | 0 | 144 | 0 | 0 | — | 1.5 km 內無軌道 |
| | 道路車流 | 0 | 0 | 0 | 144 | — | |
| | 施工 | 0 | 0 | 144 | 0 | — | 外框同時落在花蓮縣（未涵蓋）→ roadwork_city_not_covered |
| taipei-typhoon-1024 | 鐵道 | 0 | 144 | 0 | 0 | — | 1.5 km 內無軌道；颱風停駛不反映（班表） |
| | 道路車流 | 0 | 0 | 0 | 144 | — | |
| | 施工 | 0 | 0 | 144 | 0 | — | roadwork_city_not_covered（臺北市未涵蓋） |

focus_time：臺北 07:39:30 鐵道 0.074（881 m，elevated）；和平 10:25:34 施工 unknown；颱風 14:03 鐵道 inactive、施工 unknown；臺北 07:39:30 施工 unknown。MVP-A 四族數值與 §5 相同（未改）。
