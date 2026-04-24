# Incidents（append-only）

遇到問題並解決後記錄。格式：`## YYYY-MM-DD 標題` → 現象 / 根因 / 對策。

> 只 append，不修改舊條目。長篇紀錄放到 `.claude/pitfalls/` 後這裡附 link。

---

## 2026-04-07 Supabase 遷移後 ship / flight 全空

**現象**：前端切 `VITE_DATA_SOURCE=supabase` 後 ship + flight trails 都空陣列，
但 psql 直連查有資料。

**根因**：RPC 未 GRANT EXECUTE 給 anon role，Supabase 用 anon key 呼叫被擋
（不報錯只回空）。

**對策**：
- Migration 補 `GRANT EXECUTE ON FUNCTION public.get_xxx() TO anon, authenticated`
- PRINCIPLES：RPC 建立後一律補 GRANT

**Long-form**：[.claude/pitfalls/2026-04-07-empty-ships-flights.md](../pitfalls/2026-04-07-empty-ships-flights.md)

---

## 2026-04-10 Bus trails matview OOM

**現象**：`matview_bus_trails` refresh 跑到 OOM，pg_cron 連環失敗。

**根因**：refresh 的 `ORDER BY` 沒對應索引 → 全表 sort 爆記憶體。
用 `mode()` 而非 `MAX()`（前者需額外 sort）。

**對策**：
- refresh function 加索引
- 聚合用 `MAX()` 代替 `mode()`
- 加 `SET work_mem TO '64MB'`
- today + yesterday 合併到同一 cron job 循序跑

**PRINCIPLES**：pre-aggregate 5 大規則升級（索引先行 / 單一 cron / MAX / work_mem / EXPLAIN）

---

## 2026-04-22 `river_lines` 有 2,445 km outlier MultiLineString

**現象**：水庫 context 的 `nearest_river`（KNN）對石門 / 翡翠 / 寶山會「全台亮」。

**根因**：`public.river_lines` 有一筆 MultiLineString 長 2,445 km，
name/type/code 全空（資料源把多條河段聚合成一個 feature）。KNN `<->` 距離運算把
這個巨型 feature 當最近點。

**對策**：
- migration 053 `get_reservoir_watershed_rivers` 改用 `ST_Intersection(river, watershed)`
  剪裁，繞過 outlier
- `nearest_river` 停畫
- Simplify 放 ST_Intersection 之後 10-20x 提速

---

## 2026-04-22 Mapbox custom layer attach `map.once('load')` 永不觸發

**現象**：水庫 3D 水位計 scene 建好、RPC 37 筆回來、rebuild 跑完，
**沒有** `[ReservoirLayer] onAdd` log，畫面沒東西。tsc 0 錯誤。

**根因**：獨立 hook 用 `map.once('load', attach)`，但 hook useEffect 觸發時
map 早已 load 過。`isStyleLoaded()` 短暫 false 時走 else 分支，`load` event
不會再觸發第二次 → attach 永不執行。

**對策**：
- 改用 polling `setInterval(tryAttach, 200)` 直到 `isStyleLoaded()`
- Lessons 升級到 PRINCIPLES「視覺層 debug」
- StationPillarScene 沒踩是因為跟著 `addAllLayers` 在 `handleMapReady` 同步呼叫，
  style 保證 ready；獨立 hook 不能抄相同 pattern

**Long-form**：[.claude/pitfalls/2026-04-22-mapbox-load-once-fired.md](../pitfalls/2026-04-22-mapbox-load-once-fired.md)

---

## 2026-04-22 視覺層 tsc 通過 ≠ 能動

**現象**：Phase 1c 3D 水位計一次改 8+ 檔，tsc 通過就宣布完成，結果 runtime 沒畫面。
用戶截圖 2 輪才找到 bug（~30 min 浪費）。

**根因**：Mapbox custom layer + Three.js scene 從 mount → attach → render 是**多層
非同步 gate**，任何一層壞掉都只表現為「什麼都沒發生」。tsc 只檢查編譯正確性，
不保證 runtime 作動。

**對策**：
- 寫視覺層代碼預設加 checkpoint log（hook mount / RPC 返回 / scene setX /
  rebuild / onAdd / render 1&60）
- PRINCIPLES「視覺層 debug」區
- 一次改 3-4 檔做 smoke test，不要 8+ 檔才驗

---

## 2026-04-22 蓄水率與水利署官網差 5x

**現象**：前端曾文 12%、霧社 12%，水利署 fhy 官網曾文 17%、霧社 73.87%。
用戶質疑「是不是 ID mapping 錯？」

**根因**：`reservoir_situation_v` 分母用 `effective_capacity_wan`（設計有效容量），
水利署官網用 `current_capacity_wan`（現行有效容量，扣淤積）。霧社淤積 81%
（14,860 → 2,869 萬 m³），分母用錯百分比會被壓到 1/5。**不是 ID 問題**。

驗證：曾文 8,250 / 50,479 = 16.34% ≈ 官網 17% ✓

**對策**：
- migration 056 重建 view + `get_reservoir_status_day` + `get_reservoir_timeseries`，
  分母改 `current_capacity_wan`
- alert_level 閾值不變
- current_capacity 40/40 都有值（比 effective_capacity 39/40 覆蓋更好）

---

## 2026-04-22 alert_level 中英文 key 不一致，顏色從未生效

**現象**：水庫 3D 水位計顏色全部青色，不管蓄水率高低。Panel 警示 chip 顏色也不對。

**根因**：`reservoir_situation_v` 的 `alert_level` 輸出**英文**
（`critical/warning/normal/high`），但前端 `ALERT_COLOR_HEX`（3D）與
`ALERT_COLORS`（Panel）都 keyed **中文**（`正常/輕度/中度/重度/嚴重`）。
所有查詢 fallback 到 default 青色，顏色分級從未生效。

**對策**：
- 前端兩處 dict 改英文 key
- 顏色分級：critical=紅 / warning=橘 / normal=青 / high=綠（滿水）
- 加 `ALERT_LABELS` 中文 display 標籤（嚴重/偏低/正常/滿水）

---

## 2026-04-23 水庫 3D Custom Layer 60 FPS 無限 render loop

**現象**：Console 每秒一條 `[ReservoirLayer] render #xxx`，連續刷屏。GPU 不停運轉。

**根因**：`reservoirCustomLayer.render()` 內呼叫 `map.triggerRepaint()` →
Mapbox 下一幀再 render → 再 triggerRepaint → 無限迴圈。

這是動畫型 3D layer（flight/bus 每幀插值）的必要寫法，但水庫是**靜態 3D**
（只有 `setStatuses` / `setActiveOps` / `heightScale` 變動才需重畫），套用同樣
pattern 純粹浪費 GPU。

**對策**：
- 移除 render 內 triggerRepaint
- 改由 hook 在 state 變動 useEffect 內主動 `map.triggerRepaint()`
  - `setStatuses` / `setActiveOps` 時呼叫
  - `heightScale` / `isDark` / `visible` 變動 useEffect
- PRINCIPLES「3D 效能」：靜態 3D layer 禁止 render 內 triggerRepaint

---

## 2026-04-23 水庫日資料 today 只有 28 座閃現

**現象**：`get_reservoir_status_day(today)` 早上時段只返回 28 座水庫
（latest 37 座、yesterday 34 座），使用者感覺「水庫出現又消失」。

**根因**：部分水庫今天還沒回報資料（collector lag），`byIdRef` 只含今天有資料的站，
其他站被完全過濾掉。

**對策**：
- `loadDay(dateKey)` 併 fetch **today + yesterday**，合併 `groupByReservoir`
- `statusesAt` 的 `t ≤ currentTime` 挑選邏輯自動選到最接近的一筆
- 任一天有報的站就看得到

---

## 2026-04-23 3D 進/出流柱 zoom in 看不見

**現象**：點水庫後浮空柱在 z8-9 可見，z9.7+ 消失。

**根因**：柱底浮空 `H_SHELL × 1.25` = 10km，柱高可達 `H_SHELL × 0.65` = 5.2km，
柱頂高達 15 km。在 zoom 10+ + pitch 37° 時柱被推出 viewport 頂部。另外柱橫向
位於 `radius × 0.9` 是殼**內部**，近景時被透明殼遮。

**對策**：
- `OPS_FLOAT_Z_FACTOR`: 1.25 → 0.1（幾乎貼地）
- `OPS_MAX_HEIGHT_FACTOR`: 0.65 → 0.45（柱頂 ≤ 0.55 × shell）
- `OPS_ROW_OFFSET_FACTOR`: 0.9 → 1.35（兩排到殼外側翼）
- PRINCIPLES「3D 效能」：柱體總高 ≤ shell × 1.5，橫向 > radius × 1.0

---

## 2026-04-23 macOS 預設無 jq，shell script 需改用 python3

**現象**：SessionStart hook 的 `load-session.sh` 原本用 `jq` 組 JSON，pipe-test
時 `jq: command not found`，exit 127。

**根因**：macOS 預設工具鏈不含 jq（需 Homebrew 另裝）。`which jq` 空值。
專案協作若要求使用者預裝 jq 是不合理的門檻。

**對策**：
- Shell script 組 JSON 一律用 `python3 - <<'PY' ... PY` heredoc（Python 預裝）
- PRINCIPLES「技術慣例」加規則：shell 腳本不依賴 jq
- 寫外部工具依賴前先 `command -v <tool>` 檢查

---

## 2026-04-25 Mapbox setStyle() 期間 `map.getStyle()` 會 throw

**現象**：切換底圖時 React 爆 `Uncaught Error: Style is not done loading`，
App 被 error boundary 接住白畫面。

**根因**：6 個 useEffect 用 `if (!map || !map.getStyle()) return;` 當 guard，
預期 `getStyle()` 未載入時回 `undefined`。但 Mapbox GL v3 `setStyle()` 進行
中 Style 物件正處於 mid-swap，內部 `_checkLoaded()` **直接 throw** 而不是
回 null。React passive effect re-run 就炸。

**對策**：
- App.tsx 加 `styleReady(map): map is MapboxMap` type predicate，內部
  try/catch 包 `map.getStyle()`，throw 視為尚未 ready
- 6 處 guard 全換成 `if (!styleReady(map)) return;`
- 用 type predicate 讓後續 `ensureH3Layers(map)` 呼叫 TS 能正確 narrow

---

## 2026-04-25 Supabase PostgREST db-max-rows=20000 硬 cap（兩次踩到）

**現象**：
- 切到「地下水井」圖層完全空白；get_groundwater_day 回 78K rows，前端只
  畫出前 ~190 站，~600 站消失
- 切到「河川水位」看似只有北部有資料；get_river_water_level_day 回 44K
  rows，ORDER BY station_id 讓北部字典序在前通吃 20K，南部 103 站只剩 1

**根因**：Supabase PostgREST 伺服器端寫死 `db-max-rows=20000`，超過的列
**悄悄切掉**（HTTP 206 Partial Content + `content-range: 0-19999/N`），
沒有錯誤訊息。client Range header 無法覆寫（gateway 強制）。

**診斷 SOP**（下次遇到「RPC 資料看起來少一半」先這三步）：
1. `psql` 直查 `SELECT COUNT(*) FROM public.get_xxx(...)` 看實際列數
2. `curl -D /tmp/hdr.txt -X POST .../rpc/get_xxx` 看 `content-range` header
3. 若 `N/M` 且 N=19999 → 命中 cap，需 RPC 側降頻

**對策**：
- Migration 060：`get_groundwater_day` 降到每站每小時（78K → 16.5K）
- Migration 060b：`get_river_water_level_day` 降到每站每小時（44K → 8K）
- 都用 `DISTINCT ON (station_id, date_trunc('hour', observed_at))`
- 降頻對視覺無感（groundwater p50 hourly change 4mm、river 8.5cm/day）

**PRINCIPLES**：+「Supabase RPC 20K cap 必查」原則；新 RPC 預估 rows 超
過 15K 先套 DISTINCT ON hourly pattern

**Long-form（無）**：診斷 SOP 已經在本條與 PRINCIPLES

---

<!-- 追加新事件於此之上 -->
