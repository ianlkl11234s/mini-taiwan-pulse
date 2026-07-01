# Layer 接線常見漏項清單

**建立日期**：2026-07-01
**目的**：把過去每次新 layer 上線常漏的坑集中一處，作為 `layer-onboarding` skill 的補充。

---

## A. 資料完整性類（Step 1 常漏）

### A1. PMTiles keep_attrs 沒帶到 → popup 空白 / 分色失效
- **Symptom**：前端 popup 顯示 `undefined` 或 `null`；分色圖層全同一色
- **Root cause**：taipei-gis-analytics 側的 tippecanoe 產 PMTiles 時 `--include=<attr>` 沒列全
- **Fix**：回上游檢查產出腳本，補齊 `keep_attrs` 白名單，重跑並 S3 覆蓋
- **預防**：Step 1 用 `tippecanoe-decode` 抽 tile 檢查屬性

### A2. 扁平檔名契約斷了 → 404
- **Symptom**：nginx 或 Zeabur volume 找不到檔
- **Root cause**：在 `public/` 底下開子資料夾（例如 `public/water/xxx.pmtiles`）
- **Fix**：檔名一律 flat 放 `public/`（例如 `public/water_xxx.pmtiles`）
- **預防**：CLAUDE.md 已規定「扁平檔名契約不要改路徑」

### A3. 座標系統沒轉 → 點全掉海裡
- **Symptom**：點位落在赤道附近 / 完全偏移
- **Root cause**：TGOS / 政府資料常輸出 TWD97 TM2 (EPSG:3826)，`|Response_X| > 1000`
- **Fix**：pipeline 側 detect + 轉 WGS84 存
- **預防**：`tgos-batch-geocoding` skill 已內建守門，其他來源要手動加

### A4. Buffer epoch / RANGE_START 契約打破 → 時間軸整體偏移
- **Symptom**：時間軸播放時所有點都在錯誤日期出現
- **Root cause**：Float32 buffer 用相對時間戳，改 `RANGE_START` 沒重打包
- **Fix**：改常數 + 重打包 + 前端同步
- **參考**：real-estate handoff

---

## B. UX 設定類（Step 3 / Step 4 常漏）

### B1. layerCatalog.ts 漏 `LAYER_COLORS` key → TS2739
- **Symptom**：`npx tsc -b` 報 `Property 'xxx' is missing in type ... but required in type '...'`
- **Root cause**：新 layer 加了 `LayerVisibility` key 但沒補 `LAYER_COLORS`
- **Fix**：`layerCatalog.ts` `LAYER_COLORS` 加對應 key
- **預防**：走 `/new-layer` command 自動產

### B2. LEGEND_REGISTRY 沒加 → `layerConsistency` test fail
- **Symptom**：`pnpm test` 掛在 `layerConsistency`
- **Root cause**：分色 ≥ 2 種但沒寫 legend
- **Fix**：`LegendPanel.tsx` sub-component + `LEGEND_REGISTRY` 加行
- **參考**：四鐵則 #2

### B3. Popup 沒接 → 點得到但沒反應
- **Symptom**：點 feature 沒 popup
- **Root cause**：`useMapInteraction.ts` 沒 register + `featureInfo/registry.tsx` 沒對應 renderer
- **Fix**：兩處各加行
- **參考**：四鐵則 #3

### B4. Select options ≥ 4 用 button row → sidebar 爆版
- **Symptom**：sidebar 窄欄橫向按鈕擠成一坨
- **Root cause**：`ctrl.options.length > 3` 沒切成原生 `<select>` dropdown
- **Fix**：改用 dropdown
- **參考**：四鐵則 #4

### B5. 點層太密沒 cluster / 沒抽稀 → 低 zoom 爆量
- **Symptom**：全台 zoom 6 看到黑一片，或 GPU 慢
- **Root cause**：> 100k 點沒開 cluster，PMTiles `-r` 抽稀太保守
- **Fix**：PMTiles 產出時 `-r1.7`（低 zoom 保留 ~4700 點），或前端開 cluster
- **參考**：real-estate 用 `-Z6 -r1.7`

### B6. 透明度 slider 忘記加 → UX 不一致
- **Symptom**：其他 layer 都有，新 layer 沒
- **Root cause**：`useTransportParams.ts` 沒補 opacity control
- **Fix**：補上
- **參考**：四鐵則 #1

---

## C. 動態圖層類（時間軸相關）

### C1. `currentTime` 進 `useEffect` deps → re-render cascade 卡頓
- **Symptom**：時間軸播放時整站掉幀
- **Root cause**：hook 用 React state 塞 currentTime
- **Fix**：改走 `timeStore.subscribeThrottled(ms, cb)` 或 `getTime()` 同步讀
- **參考**：CLAUDE.md §6 + `feedback_dynamic_layer_principle.md`

### C2. 沒 loadingRegistry → 切日時黑屏無提示
- **Symptom**：切 timeline 日期時畫面卡住無反饋
- **Root cause**：`supabase.rpc().then()` 靜默呼叫
- **Fix**：包 `withLoading(id, label, promise)`
- **參考**：CLAUDE.md §3

### C3. 多 layer × rangeDays 大 → Supabase 打掛
- **Symptom**：Supabase pooler unhealthy，用戶看 LOADING 滿屏
- **Root cause**：rangeDays 7 × N layer 沒 concurrency cap
- **Fix**：`dayPrefetch` 全域 queue cap=2 + debounce 500ms
- **參考**：STATUS.md 2026-06-27 段的「fix 3」

---

## D. 跨 repo 對齊類（Step 5 常漏）

### D1. upstream handoff 沒更新 → 半年後自己看不懂
- **Symptom**：3 個月後接類似 feature 忘記當時怎麼決定
- **Fix**：pipeline 改完當下就更新 `taipei-gis-analytics/docs/handoff/<slug>.md`

### D2. downstream handoff.md 沒反向引用 → 溯源斷鏈
- **Symptom**：只看 mini-taiwan-pulse 不知道 upstream 在哪
- **Fix**：`docs/features/<slug>/handoff.md` 必寫 upstream 路徑

### D3. 資料契約改了沒開 ADR
- **Symptom**：欄位改名下游立爆
- **Fix**：任何 breaking 一律先開 `docs/adr/NNNN-*.md`

### D4. taipei-gis-analytics 改動未 push → 下游同事無法復現
- **Symptom**：上游本地 master 有改動但沒推
- **Fix**：完成 layer 上線同時 push 上游

---

## 快速自檢（PR 前跑一遍）

```
[ ] Step 1 資料量對得上（count / attrs / 座標）
[ ] Step 3 UX baseline 表對照過
[ ] Step 4 四鐵則四項都有
[ ] Step 5 upstream handoff 更新 + downstream handoff 反向引用
[ ] npx tsc -b 過
[ ] pnpm test 過
[ ] Browser All Off 單測過
[ ] changelog.md + backlog.md 更新
```
