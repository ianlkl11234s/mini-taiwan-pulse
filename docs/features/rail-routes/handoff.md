# Handoff — rail-routes 軌道路線（靜態圖層）

> 2026-10-04。獨立的靜態圖層 `railRoutes`，與即時列車圖層 `rail`（Three.js RailScene + 時刻表）完全分離；`rail` 與 `RailTracksHost` 未動。

## 資料與建置

| 項目 | 內容 |
|---|---|
| 產物 | `public/rail/routes_static.geojson`（~1.4 MB，33 條 route feature，座標 6 位小數） |
| 建置 | `python3 scripts/preprocess/build-rail-routes.py`（需 shapely；輸出各線保留 track 摘要表） |
| 輸入 | `public/rail/<sys>/tracks/*.geojson`；TRA 只讀 `tracks_golden/`（37 id，與 `railLoader.ts` `TRA_GOLDEN_IDS` 一致）；`public/rail/trtc/extensions/*.geojson` |
| 屬性 | `system` `system_name` `line_id` `name` `color` `source` `track_ids` `offset_slot`（見下節）；東延段所在的 R 線另有 `license` |
| 貓空纜車 | 本圖層**納入** `MK-*`：trtc / `MK` / 「貓空纜車」，色 `#06b8e6`（取自 `MK-1-0` 軌道自帶 `color`），同樣單向最長去重（`MK-1-0`，4.0 km）。即時 `rail` 圖層（`railLoader.ts` postProcess）仍排除，未動 |
| 預設色 | 沿用 `railLoader.ts` `RAIL_SYSTEMS`（TRA 由 `#7B7B7B` 調亮為 `#A8A8A8`，暗色底圖才看得見）；有 `color` 屬性的（捷運各線官方線色）以屬性為準 |

### 去重規則（每條線有大量重疊的行駛型態 track）

1. 分組：trtc 依線（`line_id` 或 id 前綴）；krtc／tmrt 依 `line_id`；tra／thsr／klrt 各為一池。
2. 優先方向 0（`direction==0` 或 id 尾碼 `-0`），取最長者為主線；只用單一方向。
3. 其餘 track（方向 0 先，再方向 1）只保留「距已保留幾何 > 40 m」且連續長度 >= 400 m 的片段（前後各補 1 個連接頂點，不留縫），例如 R-3 新北投支線、G-3 小碧潭支線、O-2 蘆洲支線、V-1 崁頂段。
4. 同一捷運線的主線＋支線合成一個 feature（MultiLineString）；TRA 每條保留 track 各自一個 feature（名稱去掉「(A→B)」）。
5. 副作用：被主線涵蓋的 TRA track 會消失——屏東線 `PT-0` 被 `SK-0`（臺東→新左營）完全涵蓋；`SK-0` 因此標「南迴線」但實際含新左營—枋寮段。六家線／成追線／沙崙線只留與主幹分歧的片段。
6. `SH-0` 在 golden 資料無名稱，依端點對照 stations.geojson（臺南→中洲→沙崙）命名為「沙崙線」（腳本 `TRA_NAME_OVERRIDES`）。

`trtc` 目錄同時含新北捷運（環狀／淡海／安坑／三鶯）與桃園機場捷運，統一歸「台北捷運」系統，線名依 `line_id`（腳本 `TRTC_LINE_NAMES`）。

## 共用走廊平行化（`offset_slot`，2026-10-04）

問題：台鐵／高鐵／捷運並行段幾何只差幾公尺，z13–15 互相穿插成鋸齒。做法全在 `build-rail-routes.py` `assign_offset_slots`，前端只多一個 paint：

1. **偵測**：兩條 route 每 20 m 取樣，距離 <= 30 m 且夾角 <= ~30° 的累計長度 >= 300 m，就算共用走廊。
2. **貼齊（snap）**：低優先線在走廊內改用高優先線的幾何（高鐵 > 台鐵 > 捷運 > 輕軌，同級取長者）。中斷 < 800 m 且全程 <= 80 m 的段落（車站咽喉）會接成同一段。接合處各留 40 m 漸變（`BLEND_M`），不會出現缺口。只靠 offset 不貼齊的話，z15 仍會交叉（已實測）。
3. **切段**：走廊內依「與哪些線重合」切成 bundle piece（重合容差 1 m、< 100 m 視為交會點不算）。每段各是一個 Feature，屬性與原線相同，另加 `offset_slot`；走廊外 = 0。因此檔案有 98 個 feature（33 條線）。依「一線一 feature」的地方：`railRoutesTypes.test` 用 `find` 取第一筆，`build-station-points --enrich` 依線取色，兩者皆不受影響。
4. **左右**：每個 bundle 以參考 piece 的方向為準，必要時反轉 piece 座標。各線依「進入前／離開後 150 m 落在走廊哪一側」排左右（側距每端截在 ±100 m）。若兩線在探針處仍重合，就沿用相鄰較長 bundle 的順序（`INHERIT_M`）。槽位置中：2 線 ±0.5、3 線 −1/0/+1。
5. **前端**：`overlayRegistry` railRoutes `line-offset` = `offset_slot ×` 與 `line-width` 相同的 zoom 停駐點（5/9/12/15），任何 zoom 都緊貼。
6. 不另做簡化，只用 0.5 m 容差移除 densify 時加的共線點。

建置會印出每個 bundle 的起訖座標與左右順序（共 16 個；例如台北—板橋 17.2 km：縱貫線北段 −0.5／高鐵 +0.5；板橋三線段：板南 −1／縱貫線北段 0／高鐵 +1）。

已知殘留：
- 兩線在走廊兩端各往不同側離開時（例：中和新蘆線在東門西端往南、東端往北上新生南路；古亭 G/O 南端），交叉無法避免，會落在其中一端；目前選側距總和較小的那端。
- bundle 端點 offset 是階躍（Mapbox 不能逐點漸變），走廊頭尾有約 0.5 線寬的小折角。相鄰 bundle 成員不同時（板橋 2→3 線）也有同樣的小跳動。
- 被貼齊的線在走廊內最多位移約 30 m（車站咽喉橋接段最多約 80 m）。
- 改了路線幾何後，bundle 與 slot 會重新求解。

## 信義線東延段（象山 R02 → 廣慈/奉天宮 R01，2026-08-30 通車）

- 檔案：`public/rail/trtc/extensions/xinyi_east_r01.geojson`（東向營運線 LineString 27 點 ~1.4 km ＋ R01 Point）。
- 來源：OpenStreetMap ways 197881274, 806179562, 453081585；授權 ODbL 1.0 © OpenStreetMap contributors；擷取 2026-10-04。地下線形為近似，非官方施工圖。
- OSM 另有 R01 之後的非營運尾軌（ways 1555091760, 665025772）——刻意丟棄。
- 西端已吸附到 `R-1-0` 象山端點頂點；建置時反轉後接在 `R-1-0` 前，R 線仍是單一連續線。
- R01 站點：`scripts/preprocess/build-station-points.py` 現在也合併 `public/rail/*/extensions/*.geojson` 的 Point，`public/geo/station_points.geojson` 加了 R01（`name_en`、`line_id` 同三鶯線 LB 站的格式）。
- ⚠️ 該腳本原本是舊的：輸出路徑寫 `public/station_points.geojson`（已改為 `public/geo/`），且完整重建會漏掉手動加入的 LB01–LB12、並改動 TRA 蘇澳座標。因此加了 `--append-only` 模式（只把 extension 站補進現有檔案）；本次即以此模式產生，diff 只有 R01。

## 捷運站依線著色／轉乘站（`stationsMetro`）

- 資料：`python3 scripts/preprocess/build-station-points.py --enrich`（需先有 `routes_static.geojson`）。只對非 tra 點補 `line_id`、`line_name`、`line_color`（讀自 routes_static 同線 feature，線色單一來源）、`transfer`；座標、點數、既有屬性（含 `color`）不變，可重跑。
- 站→線：trtc 取站號前綴（R/O/BR/BL/A/G/V/Y/LB/K/MK）；krtc `KR`、`KRK`→R，`KO`、`KOT`→O（`KOT1` 大寮、`KRK1` 岡山車站是紅／橘線延伸段站，不是獨立線）；klrt `C`；tmrt `TG`→G。
- 轉乘：同系統、名稱正規化（去「站」、臺→台、去括號）相同且 <=500 m。共 24 組（49 站）。門檻放寬到 500 m 是因為機場線 A1 台北車站距 R10/BL12 約 410–445 m、動物園 MK01 距 BR01 400 m，同名配對最大 445 m，無誤判。
- 渲染：`overlayRegistry` `metroTransferCore`：`circle-color` = 轉乘 ? 白 : `line_color`（缺則 `color`）；轉乘站描邊 2px（token：`TRANSFER_STATION`／`transferRingColor`，mapStyleScale）。半徑由點規格 tier M 固定（P-1），故未放大。
- 圖例 `MetroStationsLegend`；線清單 `RAIL_METRO_LINES`（railRoutesTypes，源自 `constants/railLines.ts` + MK + 高雄輕軌；`railRoutesTypes.test.ts` 比對 geojson 防不同步）。popup `RailStationPanel` 顯示路線名／轉乘。
- 改 `build-rail-routes.py` 的線色後：重跑 build-rail-routes → `build-station-points.py --enrich`，並同步 `railLines.ts`／`RAIL_METRO_LINES`。
- `stationsTRA` 未動。

## 前端接線

- manifest `railRoutes`（交通 Move / 路網）、spec（寬度、透明度、系統 select 8 選項→原生 `<select>`）、`overlayRegistry`（geojson line，系統篩選走 filter＋`rebuildOnParamKeys`）。
- 色／系統表 SSOT：`src/data/railRoutesTypes.ts`（圖例列的線色須與 geojson `color` 同步；改建置腳本的線色要一起改）。
- 圖例：`src/components/legend/railRoutesLegend.tsx`；popup：`RailRoutesPanel`（transportPanels）＋ `gisClickRegistry`（排在站點／站體面之後）。
- 載入走 `overlayManager.hydrateOverlayIfNeeded`（已註冊 loadingRegistry）。
- 資料來源總覽：由 manifest `upstream`（datasetId `rail`，`processing` 載明 OSM/ODbL）派生。

## 部署／再生注意

- `public/rail/` 原本整夾 gitignore（由 S3 `rail.tar.gz` 供應）。本次在 `.gitignore` 加了例外，只讓 `public/rail/routes_static.geojson` 與 `public/rail/trtc/extensions/` 進 git。
- ⚠️ `scripts/export/export-rail-data.py` 開頭會 `shutil.rmtree(public/rail)`：重跑後 extensions 要 `git checkout -- public/rail/trtc/extensions public/rail/routes_static.geojson` 還原，再跑 `build-rail-routes.py`。
- 正式站 `/rail/` 是純 S3 volume：發布前必須重跑 `scripts/deploy/upload-deploy-assets.sh`（已加 `RAIL_REQUIRED_FILES` 缺檔即中止），否則該層在正式站 404。

## FOLLOW-UP（未做）

- 即時 `rail` 圖層仍止於象山：要加 R01 必須上游重生 `station_progress` 與時刻表——在 mini-taipei-v3 重新匯出 trtc 軌道／`station_progress`／schedules，並更新 Supabase 時刻表資料表；`rail` 圖層與 `RailTracksHost` 目前刻意不碰。
- 現有 `RAIL_SYSTEM_INFO`（transportPanels）把 `tmrt` 標成「桃園捷運」，但資料實際是台中捷運；本圖層的 popup 用自己的系統名稱表，未順手修改。
- 東延段線形為 OSM 近似；官方公布路線／TDX 更新後可替換 extension 檔。
